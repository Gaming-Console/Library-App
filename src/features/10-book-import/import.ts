import type { BookInput, BookImportRow, CatalogItem, ImportIssue } from '../../shared/types';

export interface ParsedBookRow {
  row: number;
  title: string;
  ageGroup: string;
  quantity: number | null;
  issues: string[];
}

export interface ParsedBookImport {
  rows: ParsedBookRow[];
  validRows: BookImportRow[];
  issues: ImportIssue[];
  /** template: שלוש עמודות עם כותרות. list: רשימת שמות פשוטה (שם ספר, ומחבר אופציונלי). */
  mode: 'template' | 'list';
  /** בקובץ רשימה: כמה שורות כפולות אוחדו לעותקים נוספים. */
  merged: number;
  /** בקובץ רשימה: כמה ספרים יובאו עם שם המחבר בסוגריים. */
  withAuthor: number;
}

export const MAX_ROWS = 1000;
export const MAX_COPIES = 2000;
export const DEFAULT_AGE_GROUP = 'כללי';

const expectedHeaders = ['שם ספר', 'גיל יעד', 'כמות עותקים'];

function isBlankRow(values: unknown[]) {
  return values.every((value) => value == null || (typeof value === 'string' && value.trim() === ''));
}

const titleHeader = /^(שם( ה| )ספר|שם|כותר|ספר)$/;
const cellText = (value: unknown) => (value == null ? '' : String(value).trim());

/** רשימת ספרים פשוטה: עמודה א׳ שם ספר, עמודה ב׳ מחבר (לא חובה), בלי כותרות ובלי כמות. */
function parseSimpleList(sheet: unknown[][], ageGroup: string): ParsedBookImport {
  const first = cellText(sheet[0]?.[0]);
  const start = titleHeader.test(first) ? 1 : 0;
  const rows: ParsedBookRow[] = [];
  const byKey = new Map<string, ParsedBookRow>();
  const issues: ImportIssue[] = [];
  let merged = 0;
  let withAuthor = 0;
  for (let index = start; index < sheet.length; index++) {
    const values = sheet[index];
    if (isBlankRow(values)) continue;
    const name = cellText(values[0]);
    const author = cellText(values[1]);
    const title = author ? `${name} (${author})` : name;
    const rowIssues: string[] = [];
    if (!name) rowIssues.push('חסר שם ספר');
    const key = title.toLowerCase();
    const existing = name ? byKey.get(key) : undefined;
    if (existing && existing.quantity !== null) { existing.quantity += 1; merged++; continue; }
    const row: ParsedBookRow = { row: index + 1, title, ageGroup, quantity: 1, issues: rowIssues };
    if (author && name) withAuthor++;
    rows.push(row);
    if (name) byKey.set(key, row);
    for (const message of rowIssues) issues.push({ row: row.row, message });
  }
  if (rows.length === 0) issues.push({ row: 1, message: 'לא נמצאו שורות ספרים בקובץ' });
  if (rows.length > MAX_ROWS) issues.push({ row: rows[MAX_ROWS].row, message: `אפשר לייבא עד ${MAX_ROWS.toLocaleString('en')} ספרים בכל פעם` });
  const copies = rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  if (copies > MAX_COPIES) issues.push({ row: rows[rows.length - 1].row, message: `אפשר לייבא עד ${MAX_COPIES.toLocaleString('en')} עותקים בסך הכול` });
  if (!ageGroup.trim()) issues.push({ row: 1, message: 'יש להזין גיל יעד לכל הספרים' });
  const validRows = rows
    .filter((item) => item.issues.length === 0 && item.quantity !== null && ageGroup.trim())
    .map((item) => ({ row: item.row, title: item.title, ageGroup: ageGroup.trim(), quantity: item.quantity as number }));
  return { rows, validRows, issues, mode: 'list', merged, withAuthor };
}

function isSimpleList(sheet: unknown[][]) {
  const header = sheet[0];
  if (!header || cellText(header[0]) === expectedHeaders[0] && cellText(header[1]) === expectedHeaders[1]) return false;
  return sheet.every((values) => values.slice(2).every((value) => cellText(value) === ''));
}

export function parseBookRows(sheet: unknown[][], options: { defaultAgeGroup?: string } = {}): ParsedBookImport {
  if (isSimpleList(sheet)) return parseSimpleList(sheet, (options.defaultAgeGroup ?? DEFAULT_AGE_GROUP).trim());
  const issues: ImportIssue[] = [];
  const header = sheet[0];
  if (!header || expectedHeaders.some((expected, index) => String(header[index] ?? '').trim() !== expected) || header.length !== expectedHeaders.length) {
    return {
      rows: [],
      validRows: [],
      issues: [{ row: 1, message: 'כותרות העמודות צריכות להיות: שם ספר | גיל יעד | כמות עותקים' }],
      mode: 'template',
      merged: 0,
      withAuthor: 0,
    };
  }

  const populatedRows = sheet.slice(1)
    .map((values, index) => ({ values, row: index + 2 }))
    .filter(({ values }) => !isBlankRow(values));
  if (populatedRows.length === 0) {
    issues.push({ row: 2, message: 'לא נמצאו שורות ספרים בקובץ' });
  }
  if (populatedRows.length > MAX_ROWS) {
    issues.push({ row: populatedRows[MAX_ROWS].row, message: `אפשר לייבא עד ${MAX_ROWS.toLocaleString('en')} שורות בכל פעם` });
  }

  const rows: ParsedBookRow[] = [];
  let totalCopies = 0;
  let totalLimitReported = false;
  for (const { values, row } of populatedRows.slice(0, MAX_ROWS)) {
    const rowIssues: string[] = [];
    const title = typeof values[0] === 'string' ? values[0].trim() : '';
    const ageGroup = typeof values[1] === 'string' ? values[1].trim() : '';
    const rawQuantity = values[2];
    const quantityValue = typeof rawQuantity === 'number'
      ? rawQuantity
      : typeof rawQuantity === 'string' && rawQuantity.trim() !== ''
        ? Number(rawQuantity.trim())
        : Number.NaN;
    const quantity = Number.isInteger(quantityValue) ? quantityValue : null;

    if (!title) rowIssues.push('חסר שם ספר');
    if (!ageGroup) rowIssues.push('חסר גיל יעד');
    if (quantity === null) rowIssues.push('כמות העותקים חייבת להיות מספר שלם');
    else if (quantity < 1 || quantity > 100) rowIssues.push('הכמות חייבת להיות בין 1 ל־100');

    if (title && ageGroup && quantity !== null && quantity >= 1 && quantity <= 100) {
      totalCopies += quantity;
      if (totalCopies > MAX_COPIES && !totalLimitReported) {
        rowIssues.push(`אפשר לייבא עד ${MAX_COPIES.toLocaleString('en')} עותקים בסך הכול`);
        totalLimitReported = true;
      }
    }

    rows.push({ row, title, ageGroup, quantity, issues: rowIssues });
    for (const message of rowIssues) issues.push({ row, message });
  }

  const validRows = rows
    .filter((item) => item.issues.length === 0 && item.quantity !== null)
    .map((item) => ({ row: item.row, title: item.title, ageGroup: item.ageGroup, quantity: item.quantity as number }));

  return { rows, validRows, issues, mode: 'template', merged: 0, withAuthor: 0 };
}

export function matchBooks(row: BookImportRow, catalog: CatalogItem[]) {
  const title = row.title.trim();
  const ageGroup = row.ageGroup.trim();
  return catalog.filter(({ book }) => book.title.trim() === title && book.ageGroup.trim() === ageGroup);
}

export function buildBookInputs(
  rows: BookImportRow[],
  catalog: CatalogItem[],
  decisions: Record<number, string>,
) {
  const issues: ImportIssue[] = [];
  const items: BookInput[] = rows.map((row) => {
    const matches = matchBooks(row, catalog);
    if (matches.length === 0) return { title: row.title.trim(), ageGroup: row.ageGroup.trim(), quantity: row.quantity };

    const decision = decisions[row.row];
    if (!decision) {
      issues.push({ row: row.row, message: 'יש לבחור אם ליצור ספר חדש או להוסיף עותקים לספר קיים' });
      return { title: row.title.trim(), ageGroup: row.ageGroup.trim(), quantity: row.quantity };
    }
    if (decision === 'new') return { title: row.title.trim(), ageGroup: row.ageGroup.trim(), quantity: row.quantity };

    const target = matches.find(({ book }) => book.id === decision);
    if (!target) {
      issues.push({ row: row.row, message: 'הבחירה אינה תואמת לאחד הספרים שנמצאו' });
      return { title: row.title.trim(), ageGroup: row.ageGroup.trim(), quantity: row.quantity };
    }
    return { title: row.title.trim(), ageGroup: row.ageGroup.trim(), quantity: row.quantity, targetBookId: target.book.id };
  });

  return { items, issues };
}