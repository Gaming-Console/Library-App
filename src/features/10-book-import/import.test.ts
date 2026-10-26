import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../shared/types';
import { buildBookInputs, matchBooks, parseBookRows } from './import';

const headers = ['שם ספר', 'גיל יעד', 'כמות עותקים'];
const catalog: CatalogItem[] = [
  { book: { id: 'book-1', title: 'מסע אל האי הנעלם', ageGroup: 'ג–ד' }, totalCopies: 2, availableCopies: 1 },
];

describe('book workbook parsing', () => {
  it('trims fields and preserves Excel row numbers', () => {
    const result = parseBookRows([headers, [' מסע אל האי הנעלם ', ' ג–ד ', 3]]);
    expect(result.issues).toEqual([]);
    expect(result.validRows).toEqual([{ row: 2, title: 'מסע אל האי הנעלם', ageGroup: 'ג–ד', quantity: 3 }]);
  });

  it('reports missing fields and fractional quantities by row', () => {
    const result = parseBookRows([headers, ['ספר', '', 1.5]]);
    expect(result.issues).toEqual([
      { row: 2, message: 'חסר גיל יעד' },
      { row: 2, message: 'כמות העותקים חייבת להיות מספר שלם' },
    ]);
    expect(result.validRows).toEqual([]);
  });

  it('rejects incorrect headers and more than 100 non-empty rows', () => {
    expect(parseBookRows([['שם', ...headers.slice(1)], ['ספר', 'א–ב', 1]]).issues[0].row).toBe(1);
    const result = parseBookRows([headers, ...Array.from({ length: 101 }, () => ['ספר', 'א–ב', 1])]);
    expect(result.issues).toContainEqual({ row: 102, message: 'אפשר לייבא עד 100 שורות בכל פעם' });
  });

  it('enforces the 500-copy total limit', () => {
    const result = parseBookRows([headers, ...Array.from({ length: 6 }, () => ['ספר', 'א–ב', 100])]);
    expect(result.issues).toContainEqual({ row: 7, message: 'אפשר לייבא עד 500 עותקים בסך הכול' });
  });
});

describe('book matching decisions', () => {
  const row = { row: 2, title: 'מסע אל האי הנעלם', ageGroup: 'ג–ד', quantity: 3 };

  it('matches only a trimmed title and age group pair', () => {
    expect(matchBooks({ ...row, title: ' מסע אל האי הנעלם ' }, catalog)).toHaveLength(1);
    expect(matchBooks({ ...row, ageGroup: 'ה–ו' }, catalog)).toHaveLength(0);
  });

  it('requires an explicit decision and targets an existing book only when selected', () => {
    expect(buildBookInputs([row], catalog, {}).issues).toHaveLength(1);
    expect(buildBookInputs([row], catalog, { 2: 'new' }).items[0]).not.toHaveProperty('targetBookId');
    expect(buildBookInputs([row], catalog, { 2: 'book-1' }).items[0]).toEqual({
      title: row.title, ageGroup: row.ageGroup, quantity: 3, targetBookId: 'book-1',
    });
  });
});