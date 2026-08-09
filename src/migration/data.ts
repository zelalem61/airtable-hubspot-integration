import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

export interface MigrationData {
  companies: Record<string, string>[];
  contacts: Record<string, string>[];
  deals: Record<string, string>[];
}

export function readMigrationZip(path: string): MigrationData {
  const zip = new AdmZip(path);
  const read = (name: string): Record<string, string>[] => {
    const entry = zip.getEntry(name);
    if (!entry) throw new Error(`Missing ${name} in ${path}`);
    return parse(entry.getData().toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });
  };
  return { companies: read('companies.csv'), contacts: read('contacts.csv'), deals: read('deals.csv') };
}

export interface DataWarning {
  type: 'missing-reference' | 'relationship-conflict' | 'missing-value';
  message: string;
}

export function validateMigrationData(data: MigrationData): DataWarning[] {
  const warnings: DataWarning[] = [];
  const companyIds = new Set(data.companies.map((row) => row.company_id));
  const contacts = new Map(data.contacts.map((row) => [row.contact_id, row]));

  for (const contact of data.contacts) {
    if (!companyIds.has(contact.company_id)) {
      warnings.push({ type: 'missing-reference', message: `Contact ${contact.contact_id} references missing company ${contact.company_id}` });
    }
  }
  for (const deal of data.deals) {
    if (!companyIds.has(deal.company_id)) {
      warnings.push({ type: 'missing-reference', message: `Deal ${deal.deal_id} references missing company ${deal.company_id}` });
    }
    const contact = contacts.get(deal.contact_id);
    if (!contact) {
      warnings.push({ type: 'missing-reference', message: `Deal ${deal.deal_id} references missing contact ${deal.contact_id}` });
    } else if (contact.company_id !== deal.company_id) {
      warnings.push({
        type: 'relationship-conflict',
        message: `Deal ${deal.deal_id} company ${deal.company_id} differs from contact ${deal.contact_id} company ${contact.company_id}`,
      });
    }
    if (!deal.amount) warnings.push({ type: 'missing-value', message: `Deal ${deal.deal_id} has no amount` });
  }
  return warnings;
}
