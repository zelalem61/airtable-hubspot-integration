import { writeFile } from 'node:fs/promises';
import { HubSpotClient } from '../hubspot/client.js';
import { errorMessage } from '../lib/errors.js';
import { mapCompany, mapContact, mapDeal } from '../mappings.js';
import type { MigrationReport } from '../types.js';
import { readMigrationZip, validateMigrationData } from './data.js';

export async function runMigration(zipPath: string, hubspot: HubSpotClient): Promise<MigrationReport> {
  const startedAtMs = Date.now();
  const data = readMigrationZip(zipPath);
  const validation = validateMigrationData(data);
  const report: MigrationReport = {
    startedAt: new Date().toISOString(),
    objects: {
      companies: { processed: 0, created: 0, updated: 0, failed: 0 },
      contacts: { processed: 0, created: 0, updated: 0, failed: 0 },
      deals: { processed: 0, created: 0, updated: 0, failed: 0 },
    },
    associations: { created: 0, skipped: 0, failed: 0 },
    warnings: validation.map((warning) => warning.message),
    errors: [],
  };
  const companyMap = new Map<string, string>();
  const contactMap = new Map<string, string>();

  console.log(`[migration] Loaded ${data.companies.length} companies, ${data.contacts.length} contacts, and ${data.deals.length} deals.`);
  console.log(`[migration] Source validation found ${validation.length} warnings; details will be written to migration-report.json.`);
  console.log('[migration] Phase 1/3: syncing companies...');

  for (const row of data.companies) {
    report.objects.companies.processed += 1;
    try {
      const sourceId = required(row, 'company_id');
      const result = await hubspot.upsert('companies', 'source_company_id', sourceId, mapCompany(row, sourceId));
      report.objects.companies[result.operation] += 1;
      companyMap.set(sourceId, result.record.id);
    } catch (error) {
      report.objects.companies.failed += 1;
      report.errors.push(`Company ${row.company_id}: ${errorMessage(error)}`);
      logFailure('company', row.company_id, error, report.objects.companies.failed);
    }
    logProgress('companies', report.objects.companies, data.companies.length, startedAtMs);
  }

  console.log('[migration] Phase 2/3: syncing contacts and company associations...');
  for (const row of data.contacts) {
    report.objects.contacts.processed += 1;
    try {
      const sourceId = required(row, 'contact_id');
      const companySourceId = required(row, 'company_id');
      const result = await hubspot.upsert('contacts', 'source_contact_id', sourceId, mapContact(row, sourceId));
      report.objects.contacts[result.operation] += 1;
      contactMap.set(sourceId, result.record.id);
      const companyId = companyMap.get(companySourceId);
      if (companyId) {
        await hubspot.ensureDefaultAssociation('contacts', result.record.id, 'companies', companyId);
        report.associations.created += 1;
      } else report.associations.skipped += 1;
    } catch (error) {
      report.objects.contacts.failed += 1;
      report.errors.push(`Contact ${row.contact_id}: ${errorMessage(error)}`);
      logFailure('contact', row.contact_id, error, report.objects.contacts.failed);
    }
    logProgress('contacts', report.objects.contacts, data.contacts.length, startedAtMs);
  }

  console.log('[migration] Phase 3/3: syncing deals and associations...');
  for (const row of data.deals) {
    report.objects.deals.processed += 1;
    try {
      const sourceId = required(row, 'deal_id');
      const result = await hubspot.upsert('deals', 'source_deal_id', sourceId, mapDeal(row, sourceId));
      report.objects.deals[result.operation] += 1;
      for (const [type, id] of [
        ['companies', companyMap.get(required(row, 'company_id'))],
        ['contacts', contactMap.get(required(row, 'contact_id'))],
      ] as const) {
        if (!id) { report.associations.skipped += 1; continue; }
        try {
          await hubspot.ensureDefaultAssociation('deals', result.record.id, type, id);
          report.associations.created += 1;
        } catch (error) {
          report.associations.failed += 1;
          report.errors.push(`Deal ${row.deal_id} -> ${type} ${id}: ${errorMessage(error)}`);
        }
      }
    } catch (error) {
      report.objects.deals.failed += 1;
      report.errors.push(`Deal ${row.deal_id}: ${errorMessage(error)}`);
      logFailure('deal', row.deal_id, error, report.objects.deals.failed);
    }
    logProgress('deals', report.objects.deals, data.deals.length, startedAtMs);
  }

  report.finishedAt = new Date().toISOString();
  await writeFile('migration-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[migration] Complete in ${formatDuration(Date.now() - startedAtMs)}. Report: migration-report.json`);
  return report;
}

function logProgress(
  label: string,
  counts: { processed: number; created: number; updated: number; failed: number },
  total: number,
  startedAtMs: number,
): void {
  if (counts.processed !== total && counts.processed % 10 !== 0) return;
  const percent = Math.round((counts.processed / total) * 100);
  console.log(
    `[migration] ${label}: ${counts.processed}/${total} (${percent}%) | ` +
    `created ${counts.created}, updated ${counts.updated}, failed ${counts.failed} | ` +
    `elapsed ${formatDuration(Date.now() - startedAtMs)}`,
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function logFailure(label: string, sourceId: string | undefined, error: unknown, failureCount: number): void {
  if (failureCount <= 3 || failureCount % 25 === 0) {
    console.error(`[migration] Failed ${label} ${sourceId ?? '(missing ID)'}: ${errorMessage(error)}`);
  }
}

function required(row: Record<string, string>, field: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`Missing required field ${field}`);
  return value;
}
