import JsBarcode from 'jsbarcode';

export interface LabelContent {
  title: string;
  ageGroup: string;
  barcode: string;
}

export interface DownloadLabel extends LabelContent {
  barcodeSvg: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export function createBarcodeSvg(barcode: string, displayValue = false): string {
  if (!barcode.trim()) {
    throw new Error('לא ניתן ליצור ברקוד ללא מזהה עותק.');
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, barcode, {
    format: 'CODE128',
    lineColor: '#000000',
    background: '#ffffff',
    margin: 12,
    displayValue,
    font: 'Consolas, monospace',
    fontSize: 18,
    textMargin: 6,
    height: 72,
    width: 2,
  });
  return new XMLSerializer().serializeToString(svg);
}

export function createLabelsHtml(labels: DownloadLabel[]): string {
  const labelMarkup = labels.map((label) => `
    <article class="label">
      <h2>${escapeHtml(label.title)}</h2>
      <p>גיל יעד: ${escapeHtml(label.ageGroup)}</p>
      <div class="barcode">${label.barcodeSvg}</div>
      <p class="code" dir="ltr">${escapeHtml(label.barcode)}</p>
    </article>
  `).join('');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>מדבקות ספרייה</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: #17324d; font-family: Arial, sans-serif; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .label { border: 1px solid #d9e5eb; border-radius: 12px; padding: 16px; break-inside: avoid; }
    h2 { margin: 0; font-size: 20px; }
    p { margin: 8px 0; }
    .barcode { display: flex; justify-content: center; overflow: hidden; background: #fff; }
    .barcode svg { display: block; max-width: 100%; height: auto; }
    .code { text-align: center; font-family: Consolas, monospace; }
    @media print {
      body { padding: 0; }
      main { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .label { border-color: #999; border-radius: 0; }
    }
  </style>
</head>
<body><main>${labelMarkup}</main></body>
</html>`;
}
