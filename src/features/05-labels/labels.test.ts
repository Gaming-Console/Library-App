import { describe, expect, it } from 'vitest';
import { createLabelsHtml, escapeHtml } from './labels';

describe('label document helpers', () => {
  it('escapes user-provided text for HTML', () => {
    expect(escapeHtml(`<img src=x onerror="bad">&'`))
      .toBe('&lt;img src=x onerror=&quot;bad&quot;&gt;&amp;&#39;');
  });

  it('creates a standalone Hebrew HTML document with embedded SVG labels', () => {
    const html = createLabelsHtml([{
      title: '<שם ספר>',
      ageGroup: 'ג–ד',
      barcode: 'LIB-000001',
      barcodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
    }]);

    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain('&lt;שם ספר&gt;');
    expect(html).not.toContain('<h2><שם ספר></h2>');
    expect(html).toContain('LIB-000001');
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(html).toContain('@media print');
  });
});
