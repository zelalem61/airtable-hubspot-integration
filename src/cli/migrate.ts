import { resolve } from 'node:path';
import { loadConfig } from '../config.js';
import { HubSpotClient } from '../hubspot/client.js';
import { runMigration } from '../migration/migrate.js';

const config = loadConfig();
const report = await runMigration(resolve(config.MIGRATION_ZIP), new HubSpotClient(config.HUBSPOT_ACCESS_TOKEN));
console.log(JSON.stringify({
  objects: report.objects,
  associations: report.associations,
  warningCount: report.warnings.length,
  errorCount: report.errors.length,
}, null, 2));
if (report.errors.length) process.exitCode = 1;
