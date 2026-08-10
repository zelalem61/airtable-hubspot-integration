import { writeFile } from 'node:fs/promises';
import { loadConfig } from '../config.js';
import { HttpError } from '../lib/errors.js';
import type { AirtableTable } from '../types.js';

interface TableSchema {
  id: string;
  name: AirtableTable;
  fields: Array<{ id: string; name: string }>;
}

const config = loadConfig(true);
const notificationUrl = process.env.AIRTABLE_NOTIFICATION_URL
  ?? 'https://airtable-hubspot-sync.onrender.com/webhooks/airtable-native';
const businessFields: Record<AirtableTable, string[]> = {
  Companies: ['company_name', 'company_id', 'domain', 'industry', 'number_of_employees'],
  Contacts: ['first_name', 'last_name', 'email', 'contact_id', 'company_id'],
  Deals: ['deal_name', 'amount', 'status', 'close_date', 'deal_id', 'company_id'],
  'Line Items': ['product_name', 'quantity', 'unit_price', 'deal_id'],
};

const schema = await request<{ tables: TableSchema[] }>(`/v0/meta/bases/${config.AIRTABLE_BASE_ID}/tables`);
const created: Array<{ table: AirtableTable; id: string; expirationTime?: string }> = [];

for (const [tableName, fieldNames] of Object.entries(businessFields) as Array<[AirtableTable, string[]]>) {
  const table = schema.tables.find((item) => item.name === tableName);
  if (!table) throw new Error(`Missing Airtable table ${tableName}`);
  const fieldIds = fieldNames.map((name) => {
    const field = table.fields.find((item) => item.name === name);
    if (!field) throw new Error(`Missing Airtable field ${tableName}.${name}`);
    return field.id;
  });
  const webhook = await request<{ id: string; expirationTime?: string }>(
    `/v0/bases/${config.AIRTABLE_BASE_ID}/webhooks`,
    {
      method: 'POST',
      body: JSON.stringify({
        notificationUrl,
        specification: {
          options: {
            filters: {
              dataTypes: ['tableData'],
              recordChangeScope: table.id,
              watchDataInFieldIds: fieldIds,
              changeTypes: ['add', 'update'],
            },
          },
        },
      }),
    },
  );
  created.push({ table: tableName, id: webhook.id, expirationTime: webhook.expirationTime });
  console.log(`Created Airtable webhook: ${tableName} -> ${webhook.id}`);
}

await writeFile('.airtable-webhooks.json', `${JSON.stringify({ notificationUrl, webhooks: created }, null, 2)}\n`, 'utf8');
console.log('Saved non-secret webhook IDs to .airtable-webhooks.json');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.airtable.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.AIRTABLE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new HttpError(`Airtable ${response.status}: ${path}`, response.status, body);
  return body as T;
}
