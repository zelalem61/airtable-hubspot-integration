import { describe, expect, it } from 'vitest';
import { dealStage, normalizeBoolean, normalizeDate, normalizeIndustry, normalizeNumber } from '../src/lib/normalize.js';

describe('normalization', () => {
  it.each([
    ['True', 'true'], ['1', 'true'], ['yes', 'true'], ['False', 'false'], ['0', 'false'], ['No', 'false'],
  ])('normalizes boolean %s', (input, expected) => expect(normalizeBoolean(input)).toBe(expected));

  it.each([
    ['$48,469', '48469'], ['141994.39', '141994.39'], ['15%', '15'],
  ])('normalizes number %s', (input, expected) => expect(normalizeNumber(input)).toBe(expected));

  it.each([
    ['2021/09/07', '2021-09-07'], ['2022-02-04', '2022-02-04'], ['02/2022', '2022-02-01'],
    ['27/08/2023', '2023-08-27'], ['04/06/2024', '2024-04-06'],
    ['11-22-2026', '2026-11-22'], ['01-03-2026', '2026-01-03'], ['13-02-2025', '2025-02-13'],
  ])('normalizes date %s', (input, expected) => expect(normalizeDate(input)).toBe(expected));

  it.each([
    ['Won', 'closedwon'], ['lost', 'closedlost'], ['Qualified', 'qualifiedtobuy'], ['', 'qualifiedtobuy'],
  ])('maps status %s', (input, expected) => expect(dealStage(input)).toBe(expected));

  it.each([
    ['Biotech', 'BIOTECHNOLOGY'],
    ['Technology', 'INFORMATION_TECHNOLOGY_AND_SERVICES'],
    ['Food & Beverage', 'FOOD_BEVERAGES'],
    ['Telecom', 'TELECOMMUNICATIONS'],
    ['Robotics', 'INDUSTRIAL_AUTOMATION'],
  ])('maps industry %s', (input, expected) => expect(normalizeIndustry(input)).toBe(expected));
});
