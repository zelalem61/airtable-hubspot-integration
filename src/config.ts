import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  HUBSPOT_ACCESS_TOKEN: z.string().min(1),
  AIRTABLE_ACCESS_TOKEN: z.string().min(1).optional(),
  AIRTABLE_BASE_ID: z.string().min(1).optional(),
  AIRTABLE_WEBHOOK_SECRET: z.string().min(16).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  MIGRATION_ZIP: z.string().default('./Migration Data.zip'),
});

export type Config = z.infer<typeof baseSchema>;

export function loadConfig(requireAirtable = false): Config {
  const parsed = baseSchema.parse(process.env);
  if (requireAirtable) {
    if (!parsed.AIRTABLE_ACCESS_TOKEN || !parsed.AIRTABLE_BASE_ID || !parsed.AIRTABLE_WEBHOOK_SECRET) {
      throw new Error('AIRTABLE_ACCESS_TOKEN, AIRTABLE_BASE_ID, and AIRTABLE_WEBHOOK_SECRET are required');
    }
  }
  return parsed;
}
