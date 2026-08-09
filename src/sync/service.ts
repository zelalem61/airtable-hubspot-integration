import { AirtableClient } from '../airtable/client.js';
import { HubSpotClient } from '../hubspot/client.js';
import { KeyedLock } from '../lib/keyed-lock.js';
import { linkedRecordId, stringValue } from '../lib/normalize.js';
import { mapCompany, mapContact, mapDeal, mapLineItem } from '../mappings.js';
import type { AirtableRecord, AirtableTable, ObjectType } from '../types.js';

const TABLE_TO_OBJECT: Record<AirtableTable, ObjectType> = {
  Companies: 'companies', Contacts: 'contacts', Deals: 'deals', 'Line Items': 'line_items',
};
const UNIQUE_PROPERTY: Record<ObjectType, string> = {
  companies: 'source_company_id', contacts: 'source_contact_id', deals: 'source_deal_id', line_items: 'source_line_item_id',
};

export class SyncService {
  private readonly locks = new KeyedLock();

  constructor(private readonly airtable: AirtableClient, private readonly hubspot: HubSpotClient) {}

  async sync(table: AirtableTable, recordId: string): Promise<{ hubspotId: string; operation: 'created' | 'updated' }> {
    return this.locks.run(`${table}:${recordId}`, async () => {
      const record = await this.airtable.getRecord(table, recordId);
      return this.syncRecord(table, record);
    });
  }

  private async syncRecord(table: AirtableTable, record: AirtableRecord): Promise<{ hubspotId: string; operation: 'created' | 'updated' }> {
    const objectType = TABLE_TO_OBJECT[table];
    const sourceId = this.sourceId(table, record);
    const knownId = stringValue(record.fields.hubspot_record_id);
    const properties = this.properties(table, record, sourceId);
    const result = await this.hubspot.upsert(objectType, UNIQUE_PROPERTY[objectType], sourceId, properties, knownId);

    await this.syncAssociation(table, record, result.record.id);
    if (knownId !== result.record.id) {
      await this.airtable.updateRecord(table, record.id, { hubspot_record_id: result.record.id });
    }
    return { hubspotId: result.record.id, operation: result.operation };
  }

  private properties(table: AirtableTable, record: AirtableRecord, sourceId: string): Record<string, string> {
    if (table === 'Companies') return mapCompany(record.fields, sourceId);
    if (table === 'Contacts') return mapContact(record.fields, sourceId);
    if (table === 'Deals') return mapDeal(record.fields, sourceId, true);
    return mapLineItem(record.fields, sourceId);
  }

  private sourceId(table: AirtableTable, record: AirtableRecord): string {
    const field = table === 'Companies' ? 'company_id' : table === 'Contacts' ? 'contact_id' : table === 'Deals' ? 'deal_id' : 'line_item_id';
    return stringValue(record.fields[field]) ?? record.id;
  }

  private async syncAssociation(table: AirtableTable, record: AirtableRecord, hubspotId: string): Promise<void> {
    if (table === 'Companies') return;
    const parentTable: AirtableTable = table === 'Contacts' || table === 'Deals' ? 'Companies' : 'Deals';
    const parentField = table === 'Contacts' || table === 'Deals' ? 'company_id' : 'deal_id';
    const parentRecordId = linkedRecordId(record.fields[parentField]);
    if (!parentRecordId) throw new Error(`${table} ${record.id} has no linked ${parentField}`);
    const parent = await this.sync(parentTable, parentRecordId);
    const parentType = TABLE_TO_OBJECT[parentTable];
    await this.hubspot.replaceDefaultAssociation(TABLE_TO_OBJECT[table], hubspotId, parentType, parent.hubspotId);
  }
}
