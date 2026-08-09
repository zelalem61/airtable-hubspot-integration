import { HttpError } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { AirtableRecord, AirtableTable } from '../types.js';

export class AirtableClient {
  constructor(private readonly token: string, private readonly baseId: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return withRetry(async () => {
      const response = await fetch(`https://api.airtable.com/v0/${this.baseId}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...init.headers },
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : undefined;
      if (!response.ok) throw new HttpError(`Airtable ${response.status}: ${path}`, response.status, body);
      return body as T;
    });
  }

  async getRecord(table: AirtableTable, recordId: string): Promise<AirtableRecord> {
    return this.request(`/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`);
  }

  async updateRecord(table: AirtableTable, recordId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    return this.request(`/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH', body: JSON.stringify({ fields }),
    });
  }
}
