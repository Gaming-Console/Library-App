import { describe, expect, it } from 'vitest';
import { screenTitles, sections } from '../src/shell/routes';
import { tourSteps } from '../src/shell/tourSteps';

describe('guided tour', () => {
  it('only points at real menu sections and screens', () => {
    for (const step of tourSteps) {
      if (step.target) expect(sections.some((s) => s.id === step.target)).toBe(true);
      if (step.route) expect(screenTitles[step.route]).toBeTruthy();
      for (const item of step.checklist ?? []) expect(screenTitles[item.href.replace('#/', '')]).toBeTruthy();
    }
  });
  it('opens with a welcome and ends with how to start', () => {
    expect(tourSteps[0].id).toBe('welcome');
    expect(tourSteps.at(-1)?.checklist?.length).toBeGreaterThanOrEqual(3);
  });
  it('covers every menu section', () => {
    for (const section of sections) expect(tourSteps.some((s) => s.target === section.id)).toBe(true);
  });
});
