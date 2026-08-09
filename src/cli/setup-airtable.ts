import { loadConfig } from '../config.js';
import { HttpError } from '../lib/errors.js';

interface AirtableField {
  id: string;
  name: string;
  type: string;
}

interface AirtableTableSchema {
  id: string;
  name: string;
  fields: AirtableField[];
}

const config = loadConfig(true);
const baseUrl = `https://api.airtable.com/v0/meta/bases/${config.AIRTABLE_BASE_ID}`;

const desired: Record<string, {
  renames: Record<string, string>;
  additions: Array<{
    name: string;
    type: 'singleLineText' | 'number';
    options?: { precision: number };
  }>;
}> = {
  Companies: {
    renames: { 'Company Name': 'company_name', Industry: 'industry' },
    additions: [
      { name: 'company_id', type: 'singleLineText' },
      { name: 'domain', type: 'singleLineText' },
      { name: 'number_of_employees', type: 'number', options: { precision: 0 } },
      { name: 'hubspot_record_id', type: 'singleLineText' },
    ],
  },
  Contacts: {
    renames: { 'Contact Name': 'first_name', Email: 'email', Company: 'company_id' },
    additions: [
      { name: 'last_name', type: 'singleLineText' },
      { name: 'contact_id', type: 'singleLineText' },
      { name: 'hubspot_record_id', type: 'singleLineText' },
    ],
  },
  Deals: {
    renames: {
      'Deal Name': 'deal_name', Company: 'company_id', Stage: 'status', Amount: 'amount',
      'Expected Close Date': 'close_date',
    },
    additions: [
      { name: 'deal_id', type: 'singleLineText' },
      { name: 'hubspot_record_id', type: 'singleLineText' },
    ],
  },
  'Line Items': {
    renames: { 'Line Item Name': 'product_name', Deal: 'deal_id', Quantity: 'quantity', 'Unit Price': 'unit_price' },
    additions: [{ name: 'hubspot_record_id', type: 'singleLineText' }],
  },
};

let tables = await request<{ tables: AirtableTableSchema[] }>('/tables');
for (const [tableName, definition] of Object.entries(desired)) {
  const table = tables.tables.find((item) => item.name === tableName);
  if (!table) throw new Error(`Missing Airtable table: ${tableName}`);

  for (const [oldName, newName] of Object.entries(definition.renames)) {
    if (table.fields.some((field) => field.name === newName)) {
      console.log(`Ready: ${tableName}.${newName}`);
      continue;
    }
    const field = table.fields.find((item) => item.name === oldName);
    if (!field) throw new Error(`Cannot find ${tableName}.${oldName} to rename to ${newName}`);
    await request(`/tables/${table.id}/fields/${field.id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }) });
    field.name = newName;
    console.log(`Ready: ${tableName}.${newName}`);
  }

  for (const field of definition.additions) {
    if (!table.fields.some((item) => item.name === field.name)) {
      const created = await request<AirtableField>(`/tables/${table.id}/fields`, {
        method: 'POST', body: JSON.stringify(field),
      });
      table.fields.push(created);
    }
    console.log(`Ready: ${tableName}.${field.name}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
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
