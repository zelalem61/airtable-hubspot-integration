import { HttpError } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { HubSpotRecord, ObjectType } from '../types.js';

export class HubSpotClient {
  private readonly baseUrl = 'https://api.hubapi.com';

  constructor(private readonly token: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return withRetry(async () => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
      const text = await response.text();
      const body = text ? safeJson(text) : undefined;
      if (!response.ok) {
        const detail = body && typeof body === 'object' && 'message' in body ? ` - ${String(body.message)}` : '';
        throw new HttpError(`HubSpot ${response.status}: ${path}${detail}`, response.status, body);
      }
      return body as T;
    });
  }

  async findByUniqueProperty(objectType: ObjectType, property: string, value: string): Promise<HubSpotRecord | undefined> {
    const result = await this.request<{ results: HubSpotRecord[] }>(`/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: property, operator: 'EQ', value }] }],
        properties: [property],
        limit: 2,
      }),
    });
    if (result.results.length > 1) throw new Error(`Multiple ${objectType} records found for ${property}=${value}`);
    return result.results[0];
  }

  async create(objectType: ObjectType, properties: Record<string, string>): Promise<HubSpotRecord> {
    return this.request(`/crm/v3/objects/${objectType}`, {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  }

  async update(objectType: ObjectType, id: string, properties: Record<string, string>): Promise<HubSpotRecord> {
    return this.request(`/crm/v3/objects/${objectType}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async upsert(
    objectType: ObjectType,
    uniqueProperty: string,
    uniqueValue: string,
    properties: Record<string, string>,
    knownId?: string,
  ): Promise<{ record: HubSpotRecord; operation: 'created' | 'updated' }> {
    let existing: HubSpotRecord | undefined;
    if (knownId) {
      try {
        existing = await this.get(objectType, knownId, [uniqueProperty]);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 404)) throw error;
      }
    }
    existing ??= await this.findByUniqueProperty(objectType, uniqueProperty, uniqueValue);
    if (existing) return { record: await this.update(objectType, existing.id, properties), operation: 'updated' };
    return { record: await this.create(objectType, { ...properties, [uniqueProperty]: uniqueValue }), operation: 'created' };
  }

  async get(objectType: ObjectType, id: string, properties: string[] = [], associations: ObjectType[] = []): Promise<HubSpotRecord & { associations?: Record<string, { results: Array<{ id: string }> }> }> {
    const query = new URLSearchParams();
    if (properties.length) query.set('properties', properties.join(','));
    if (associations.length) query.set('associations', associations.join(','));
    return this.request(`/crm/v3/objects/${objectType}/${encodeURIComponent(id)}?${query}`);
  }

  async replaceDefaultAssociation(fromType: ObjectType, fromId: string, toType: ObjectType, toId: string): Promise<void> {
    const record = await this.get(fromType, fromId, [], [toType]);
    const existing = record.associations?.[toType]?.results ?? [];
    await Promise.all(existing.filter((item) => item.id !== toId).map((item) =>
      this.request(`/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${item.id}`, { method: 'DELETE' }),
    ));
    if (!existing.some((item) => item.id === toId)) {
      await this.request(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, { method: 'PUT' });
    }
  }

  async ensureDefaultAssociation(fromType: ObjectType, fromId: string, toType: ObjectType, toId: string): Promise<void> {
    await this.request(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, { method: 'PUT' });
  }

  async ensureProperty(objectType: ObjectType, definition: PropertyDefinition): Promise<void> {
    try {
      await this.request(`/crm/v3/properties/${objectType}/${definition.name}`);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) throw error;
      await this.request(`/crm/v3/properties/${objectType}`, { method: 'POST', body: JSON.stringify(definition) });
    }
  }
}

export interface PropertyDefinition {
  name: string;
  label: string;
  groupName: string;
  type: 'string' | 'number' | 'bool' | 'date' | 'enumeration';
  fieldType: 'text' | 'number' | 'booleancheckbox' | 'date';
  hasUniqueValue?: boolean;
  options?: Array<{
    label: string;
    value: string;
    displayOrder: number;
    hidden: boolean;
  }>;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
