import { AirtableClient } from './client.js';
import { HttpError } from '../lib/errors.js';
import { KeyedLock } from '../lib/keyed-lock.js';
import { SyncService } from '../sync/service.js';
import type { AirtableTable } from '../types.js';

interface WebhookPayloadPage {
  cursor: number;
  mightHaveMore: boolean;
  payloads: Array<{
    baseTransactionNumber: number;
    changedTablesById?: Record<string, {
      changedRecordsById?: Record<string, unknown>;
    }>;
  }>;
}

export class AirtableNativeWebhookProcessor {
  private readonly cursors = new Map<string, number>();
  private readonly locks = new KeyedLock();
  private tableNames?: Map<string, AirtableTable>;

  constructor(
    private readonly token: string,
    private readonly baseId: string,
    private readonly syncService: SyncService,
  ) {}

  async process(webhookId: string): Promise<void> {
    await this.locks.run(`airtable-webhook:${webhookId}`, async () => {
      const tableNames = await this.getTableNames();
      // Airtable omits the first pending payload when no cursor is supplied.
      // Cursor 0 means "from the beginning of this webhook subscription".
      let cursor = this.cursors.get(webhookId) ?? 0;
      let more = true;
      while (more) {
        const query = `?cursor=${cursor}`;
        const page = await this.request<WebhookPayloadPage>(
          `/v0/bases/${this.baseId}/webhooks/${webhookId}/payloads${query}`,
        );
        for (const payload of page.payloads) {
          for (const [tableId, change] of Object.entries(payload.changedTablesById ?? {})) {
            const table = tableNames.get(tableId);
            if (!table) continue;
            for (const recordId of Object.keys(change.changedRecordsById ?? {})) {
              const result = await this.syncService.sync(table, recordId);
              console.log(`[airtable-webhook] ${table} ${recordId} -> HubSpot ${result.hubspotId} (${result.operation})`);
            }
          }
        }
        cursor = page.cursor;
        this.cursors.set(webhookId, cursor);
        more = page.mightHaveMore;
      }
    });
  }

  private async getTableNames(): Promise<Map<string, AirtableTable>> {
    if (this.tableNames) return this.tableNames;
    const schema = await this.request<{ tables: Array<{ id: string; name: string }> }>(
      `/v0/meta/bases/${this.baseId}/tables`,
    );
    const allowed = new Set<AirtableTable>(['Companies', 'Contacts', 'Deals', 'Line Items']);
    this.tableNames = new Map(
      schema.tables
        .filter((table): table is { id: string; name: AirtableTable } => allowed.has(table.name as AirtableTable))
        .map((table) => [table.id, table.name]),
    );
    return this.tableNames;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.airtable.com${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new HttpError(`Airtable ${response.status}: ${path}`, response.status, body);
    return body as T;
  }
}
