export type ObjectType = 'companies' | 'contacts' | 'deals' | 'line_items';
export type AirtableTable = 'Companies' | 'Contacts' | 'Deals' | 'Line Items';

export interface HubSpotRecord {
  id: string;
  properties: Record<string, string | null>;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface MigrationReport {
  startedAt: string;
  finishedAt?: string;
  objects: Record<'companies' | 'contacts' | 'deals', {
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }>;
  associations: { created: number; skipped: number; failed: number };
  warnings: string[];
  errors: string[];
}
