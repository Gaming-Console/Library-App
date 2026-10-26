import { describe, expect, it } from 'vitest';
import { activeNavId, navItems, parseRoute, screenTitles } from '../src/shell/routes';

describe('app shell routes', () => {
  it('parses hash routes with and without query strings', () => {
    expect(parseRoute('#/04-book?id=book-1')).toBe('04-book');
    expect(parseRoute('#/12-settings')).toBe('12-settings');
    expect(parseRoute('')).toBe('');
  });

  it('highlights the parent navigation item for sub-screens', () => {
    expect(activeNavId('04-book')).toBe('03-catalog');
    expect(activeNavId('08-student-card')).toBe('07-students');
    expect(activeNavId('12-settings')).toBe('12-settings');
  });

  it('gives every navigation item a known screen title', () => {
    for (const item of navItems) expect(screenTitles[item.id]).toBeTruthy();
    expect(Object.keys(screenTitles)).toHaveLength(12);
  });
});
