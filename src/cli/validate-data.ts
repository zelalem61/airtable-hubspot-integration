import { resolve } from 'node:path';
import 'dotenv/config';
import { readMigrationZip, validateMigrationData } from '../migration/data.js';

const path = resolve(process.env.MIGRATION_ZIP ?? './Migration Data.zip');
const data = readMigrationZip(path);
const warnings = validateMigrationData(data);
const verbose = process.argv.includes('--verbose');
console.log(JSON.stringify({
  counts: { companies: data.companies.length, contacts: data.contacts.length, deals: data.deals.length },
  warningCounts: Object.fromEntries([...new Set(warnings.map((item) => item.type))].map((type) => [type, warnings.filter((item) => item.type === type).length])),
  ...(verbose ? { warnings } : { note: 'Run pnpm validate:data -- --verbose to print every warning.' }),
}, null, 2));
