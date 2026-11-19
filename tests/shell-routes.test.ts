import { describe, expect, it } from 'vitest';
import { activeTabId, defaultRoute, parseRoute, screenTitles, sectionOf, sections } from '../src/shell/routes';

describe('app shell routes', () => {
  it('parses hash routes with and without query strings', () => {
    expect(parseRoute('#/04-book?id=book-1')).toBe('04-book');
    expect(parseRoute('#/12-settings')).toBe('12-settings');
    expect(parseRoute('')).toBe('');
  });

  it('keeps the main menu small: four daily sections plus settings', () => {
    expect(sections).toHaveLength(5);
    expect(sections.filter((s) => !s.utility)).toHaveLength(4);
  });

  it('places every screen in exactly one section', () => {
    for (const id of Object.keys(screenTitles)) {
      expect(sections.filter((s) => s.tabs.some((t) => t.id === id) || s.children?.includes(id))).toHaveLength(1);
    }
    expect(sectionOf(defaultRoute)).toBeDefined();
  });

  it('highlights the parent tab for sub-screens', () => {
    expect(activeTabId('04-book')).toBe('03-catalog');
    expect(activeTabId('08-student-card')).toBe('07-students');
    expect(activeTabId('01-storage')).toBe('01-storage');
    expect(activeTabId('nope')).toBeUndefined();
  });

  it('gives every tab a known screen title', () => {
    for (const s of sections) for (const tab of s.tabs) expect(screenTitles[tab.id]).toBeTruthy();
    expect(Object.keys(screenTitles)).toHaveLength(12);
  });
});
