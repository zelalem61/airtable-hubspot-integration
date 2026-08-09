import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMigrationZip, validateMigrationData } from '../src/migration/data.js';

describe('provided migration data', () => {
  const data = readMigrationZip(resolve('Migration Data.zip'));
  const warnings = validateMigrationData(data);

  it('contains the expected record counts', () => {
    expect(data.companies).toHaveLength(300);
    expect(data.contacts).toHaveLength(400);
    expect(data.deals).toHaveLength(400);
  });

  it('reports source anomalies without mutating relationships', () => {
    expect(warnings.filter((item) => item.type === 'missing-reference')).toHaveLength(7);
    expect(warnings.filter((item) => item.type === 'relationship-conflict')).toHaveLength(398);
    expect(warnings.filter((item) => item.type === 'missing-value')).toHaveLength(8);
  });
});
