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

  it('rejects incorrect headers and more than 1,000 non-empty rows', () => {
    expect(parseBookRows([['שם', ...headers.slice(1)], ['ספר', 'א–ב', 1]]).issues[0].row).toBe(1);
    const result = parseBookRows([headers, ...Array.from({ length: 1001 }, () => ['ספר', 'א–ב', 1])]);
    expect(result.issues).toContainEqual({ row: 1002, message: 'אפשר לייבא עד 1,000 שורות בכל פעם' });
  });

  it('enforces the 2,000-copy total limit', () => {
    const result = parseBookRows([headers, ...Array.from({ length: 21 }, () => ['ספר', 'א–ב', 100])]);
    expect(result.issues).toContainEqual({ row: 22, message: 'אפשר לייבא עד 2,000 עותקים בסך הכול' });
  });
});

describe('simple book list (no headers, optional author column)', () => {
  it('reads titles without headers, defaulting age group and quantity', () => {
    const result = parseBookRows([['אבוד בארץ העבדים', null], ['אז תצעקו', 'תמר מור']]);
    expect(result.mode).toBe('list');
    expect(result.issues).toEqual([]);
    expect(result.validRows).toEqual([
      { row: 1, title: 'אבוד בארץ העבדים', ageGroup: 'כללי', quantity: 1 },
      { row: 2, title: 'אז תצעקו (תמר מור)', ageGroup: 'כללי', quantity: 1 },
    ]);
    expect(result.withAuthor).toBe(1);
  });
  it('merges repeated titles into extra copies and skips a title header', () => {
    const result = parseBookRows([['שם ספר'], ['ילדוליס 7'], ['ילדוליס 7'], ['ילדוליס 7'], [''], ['ילדוליס 8']], { defaultAgeGroup: 'ה–ו' });
    expect(result.validRows).toEqual([
      { row: 2, title: 'ילדוליס 7', ageGroup: 'ה–ו', quantity: 3 },
      { row: 6, title: 'ילדוליס 8', ageGroup: 'ה–ו', quantity: 1 },
    ]);
    expect(result.merged).toBe(2);
  });
  it('requires an age group and accepts a few hundred books at once', () => {
    expect(parseBookRows([['ספר']], { defaultAgeGroup: ' ' }).issues).toContainEqual({ row: 1, message: 'יש להזין גיל יעד לכל הספרים' });
    const many = parseBookRows(Array.from({ length: 282 }, (_, i) => [`ספר ${i}`]));
    expect(many.issues).toEqual([]);
    expect(many.validRows).toHaveLength(282);
  });
  it('still rejects a three-column sheet with wrong headers', () => {
    const result = parseBookRows([['x', 'y', 'z'], ['ספר', 'א', 1]]);
    expect(result.mode).toBe('template');
    expect(result.issues[0].row).toBe(1);
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