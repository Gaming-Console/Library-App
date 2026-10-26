import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JsBarcode from 'jsbarcode';
import { tasks } from '../materials/tasks.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public/workshop');
mkdirSync(resolve(root, 'docs/tasks'), { recursive: true });
mkdirSync(resolve(output, 'samples'), { recursive: true });
mkdirSync(resolve(output, 'cards'), { recursive: true });
const bullets = (items) => items.map((item) => `- ${item}`).join('\n');

for (const task of tasks) {
  const api = task.api.map(([method, path, request, response]) =>
    `| ${method} | \`${path}\` | \`${request}\` | \`${response}\` |`).join('\n');
  const card = `# ${task.id} — ${task.title}

${task.mission}

**רמת קושי:** ${task.level} · **ענף:** \`feature/${task.slug}\`

## גבול האחריות
${task.boundary}

## קראי לפני העבודה
- [חוזי החיבור](../CONTRACTS.md)
- [הנחיות העיצוב](../DESIGN.md)
- [טיפוסי הישויות](../../src/shared/types.ts)
- [הדמיית המסך](../../public/workshop/mockups.html#${task.id})

## קבצים שאת יוצרת
- \`src/features/${task.slug}/Page.tsx\` — export default של רכיב React.
- \`src/features/${task.slug}/Page.module.css\` ועזרים/בדיקות מקומיים.
${task.id === '05' ? '- במשימה זו אין צורך בקובץ שרת.' : `- \`server/features/${task.slug}.ts\` — export default של Express Router.\n- \`server/features/${task.slug}.test.ts\` — בדיקות ממוקדות.`}

אין קבצים מוכנים עבורך בתיקייה זו. את וה־AI יוצרים אותם. לא משנים קבצים משותפים או קבצים של משתתפת אחרת.

## מה רואים ב־UI?
${bullets(task.ui)}

## חוזה HTTP
בשרת הנתיב ללא /api; בדפדפן מוסיפים /api.

| Method | Path | Request | Response |
|---|---|---|---|
${api.replaceAll(' | ', ' | ')}

## כללי המימוש
${bullets(task.logic)}

## בדיקות קבלה — חובה
${bullets(task.tests)}

## תלויות וחיבור
${task.depends.length ? `נדרש מיזוג משימות: ${task.depends.join(', ')}. עד אז פתחי UI ובדיקות עם mocks בבדיקות בלבד; אל תצרי את הקבצים שלהן.` : 'אפשר לפתח ישירות מול מסד הדוגמה בלי לחכות למשימה אחרת.'}

${task.provides}

## התחלה עם AI
> אני אחראית רק למשימה ${task.id}: ${task.title}. קראי את הכרטיס הזה, את docs/CONTRACTS.md, docs/DESIGN.md ואת src/shared/types.ts. תכנני בקצרה וממשי את ה־UI, הלוגיקה וה־API בתחום שלי בלבד. אל תממשי משימות אחרות ואל תשני טיפוסים, חבילות או קבצים משותפים. אם חסרה תלות של משתתפת אחרת, הסבירי מה חסר והשתמשי ב־mock בבדיקות בלבד. הוסיפי בדיקות קבלה והריצי בדיקות ובנייה. אל תדווחי הצלחה אם פעולה אינה ממומשת או אם השרת נכשל.

## הגשה
1. פתחי \`http://127.0.0.1:5173/#/${task.slug}\`.
2. אם נוצר מודול שרת חדש, הפעילי מחדש npm run dev.
3. הריצי \`npm test\`, \`npm run build\` ו־\`npm run check:scope -- ${task.slug}\`.
4. צרפי ל־PR צילום מסך, הוראות בדיקה ותלויות שטרם מוזגו.
5. הוסיפי רק את קובצי המשימה, commit ו־push לענף שלך. לא ל־main.

## הדגמה של חצי דקה
${task.demo}
`;
  writeFileSync(resolve(root, `docs/tasks/${task.slug}.md`), card);
  writeFileSync(resolve(output, `cards/${task.slug}.md`), card);
}

const guideFiles = ['FACILITATOR', 'CONTRACTS', 'DESIGN'];
const guides = Object.fromEntries(guideFiles.map((name) => [name, readFileSync(resolve(root, `docs/${name}.md`), 'utf8')]));
const encoded = {};
JsBarcode(encoded, 'LIB-000001', { format: 'CODE128', displayValue: false });
const bits = encoded.encodings.map((entry) => entry.data).join('');
let bars = '';
for (let i = 0; i < bits.length; i++) if (bits[i] === '1') bars += `<rect x="${24 + i * 2}" y="10" width="2" height="72"/>`;
const barcode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length * 2 + 48} 108" role="img" aria-label="CODE128 LIB-000001"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g><text x="50%" y="101" text-anchor="middle" font-family="monospace" font-size="15">LIB-000001</text></svg>`;
writeFileSync(resolve(output, 'barcode.svg'), barcode);
writeFileSync(resolve(output, 'tasks.js'), `window.WORKSHOP_TASKS = ${JSON.stringify(tasks, null, 2)};\nwindow.WORKSHOP_GUIDES = ${JSON.stringify(guides)};\n`);

// Minimal standards-based XLSX writer: stored ZIP entries and inline-string cells.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(text), crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    locals.push(header, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + data.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(Buffer.concat(central).length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}
const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function workbook(rows) {
  const cells = rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => {
    const address = `${String.fromCharCode(65 + column)}${index + 1}`;
    return typeof value === 'number' ? `<c r="${address}"><v>${value}</v></c>` : `<c r="${address}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="נתונים" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetData>${cells}</sheetData></worksheet>`,
  });
}
writeFileSync(resolve(output, 'samples/books.xlsx'), workbook([
  ['שם ספר', 'גיל יעד', 'כמות עותקים'],
  ['מסע אל האי הנעלם', 'ג–ד', 2],
  ['הגינה הסודית שלנו', 'ה–ו', 3],
]));
writeFileSync(resolve(output, 'samples/students.xlsx'), workbook([
  ['מזהה תלמידה', 'שם מלא', 'כיתה'],
  ['S001', 'תמר לדוגמה', 'ד2'],
  ['S004', 'יעל לדוגמה', 'ג1'],
]));
console.log('Generated 12 Markdown cards, browser data, valid CODE128 SVG and two XLSX samples.');
