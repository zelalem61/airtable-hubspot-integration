const TRUE_VALUES = new Set(['true', '1', 'yes', 'y']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n']);

export function normalizeBoolean(value: unknown): 'true' | 'false' | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return 'true';
  if (FALSE_VALUES.has(normalized)) return 'false';
  throw new Error(`Invalid boolean: ${String(value)}`);
}

export function normalizeNumber(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const normalized = String(value).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Invalid number: ${String(value)}`);
  return String(number);
}

export function normalizeDate(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const raw = String(value).trim();
  const yearMonth = /^(\d{1,2})\/(\d{4})$/.exec(raw);
  if (yearMonth) return `${yearMonth[2]}-${yearMonth[1]!.padStart(2, '0')}-01`;
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  if (ymd) return checkedDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), raw);
  const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    const year = Number(parts[3]);
    // Unambiguous DD/MM when first > 12; otherwise use US MM/DD, documented in README.
    return first > 12
      ? checkedDate(year, second, first, raw)
      : checkedDate(year, first, second, raw);
  }
  throw new Error(`Unsupported date: ${raw}`);
}

function checkedDate(year: number, month: number, day: number, source: string): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${source}`);
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dealStage(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (normalized === 'won' || normalized === 'closedwon') return 'closedwon';
  if (normalized === 'lost' || normalized === 'closedlost') return 'closedlost';
  return 'qualifiedtobuy';
}

const INDUSTRY_MAP: Record<string, string> = {
  robotics: 'INDUSTRIAL_AUTOMATION',
  biotech: 'BIOTECHNOLOGY',
  technology: 'INFORMATION_TECHNOLOGY_AND_SERVICES',
  defense: 'DEFENSE_SPACE',
  'r&d': 'RESEARCH',
  insurance: 'INSURANCE',
  pharmaceuticals: 'PHARMACEUTICALS',
  agriculture: 'FARMING',
  energy: 'OIL_ENERGY',
  finance: 'FINANCIAL_SERVICES',
  education: 'EDUCATION_MANAGEMENT',
  healthcare: 'HOSPITAL_HEALTH_CARE',
  logistics: 'LOGISTICS_AND_SUPPLY_CHAIN',
  hospitality: 'HOSPITALITY',
  construction: 'CONSTRUCTION',
  telecom: 'TELECOMMUNICATIONS',
  manufacturing: 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING',
  'food & beverage': 'FOOD_BEVERAGES',
  retail: 'RETAIL',
  media: 'MEDIA_PRODUCTION',
};

export function normalizeIndustry(value: unknown): string | undefined {
  const source = stringValue(value)?.toLowerCase();
  if (!source) return undefined;
  const mapped = INDUSTRY_MAP[source];
  if (!mapped) throw new Error(`Unsupported HubSpot industry: ${String(value)}`);
  return mapped;
}

export function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const result = String(value).trim();
  return result || undefined;
}

export function linkedRecordId(value: unknown): string | undefined {
  if (Array.isArray(value)) return stringValue(value[0]);
  return stringValue(value);
}

export function compactProperties(input: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => entry[1] !== undefined));
}
