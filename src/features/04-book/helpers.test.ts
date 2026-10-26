import { describe, expect, it } from 'vitest';
import { availableText, formatDate, readBookId } from './helpers';

describe('book card helpers', () => {
  it('words the available count', () => {
    expect(availableText(0)).toBe('אין עותקים זמינים');
    expect(availableText(1)).toBe('עותק אחד זמין');
    expect(availableText(3)).toBe('3 עותקים זמינים');
  });
  it('reads the id from the hash', () => {
    expect(readBookId('#/04-book?id=book-1')).toBe('book-1');
  });
  it('returns null when the id is missing or empty', () => {
    expect(readBookId('#/04-book')).toBeNull();
    expect(readBookId('#/04-book?id=')).toBeNull();
  });
  it('formats a date without timezone shifts', () => {
    expect(formatDate('2026-11-03')).toBe('03.11.2026');
  });
});
