import { describe, expect, it } from 'vitest';
import { addCalendarDays, toLocalDateString } from './date';

describe('settings due-date preview', () => {
  it('adds calendar days across a month and year boundary', () => {
    expect(toLocalDateString(addCalendarDays(new Date(2026, 9, 26), 14))).toBe('2026-11-09');
    expect(toLocalDateString(addCalendarDays(new Date(2026, 11, 25), 7))).toBe('2027-01-01');
  });

  it('handles leap days using local calendar dates', () => {
    expect(toLocalDateString(addCalendarDays(new Date(2024, 1, 28), 1))).toBe('2024-02-29');
  });
});
