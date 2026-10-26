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
}

const expectedHeaders = ['שם ספר', 'גיל יעד', 'כמות עותקים'];

function isBlankRow(values: unknown[]) {
  return values.every((value) => value == null || (typeof value === 'string' && value.trim() === ''));
}

export function parseBookRows(sheet: unknown[][]): ParsedBookImport {
  const issues: ImportIssue[] = [];
  const header = sheet[0];
  if (!header || expectedHeaders.some((expected, index) => String(header[index] ?? '').trim() !== expected) || header.length !== expectedHeaders.length) {
    return {
      rows: [],
      validRows: [],
      issues: [{ row: 1, message: 'כותרות העמודות צריכות להיות: שם ספר | גיל יעד | כמות עותקים' }],
    };
  }

  const populatedRows = sheet.slice(1)
    .map((values, index) => ({ values, row: index + 2 }))
    .filter(({ values }) => !isBlankRow(values));
  if (populatedRows.length === 0) {
    issues.push({ row: 2, message: 'לא נמצאו שורות ספרים בקובץ' });
  }
  if (populatedRows.length > 100) {
    issues.push({ row: populatedRows[100].row, message: 'אפשר לייבא עד 100 שורות בכל פעם' });
  }

  const rows: ParsedBookRow[] = [];
  let totalCopies = 0;
  let totalLimitReported = false;
  for (const { values, row } of populatedRows.slice(0, 100)) {
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
      if (totalCopies > 500 && !totalLimitReported) {
        rowIssues.push('אפשר לייבא עד 500 עותקים בסך הכול');
        totalLimitReported = true;
      }
    }

    rows.push({ row, title, ageGroup, quantity, issues: rowIssues });
    for (const message of rowIssues) issues.push({ row, message });
  }

  const validRows = rows
    .filter((item) => item.issues.length === 0 && item.quantity !== null)
    .map((item) => ({ row: item.row, title: item.title, ageGroup: item.ageGroup, quantity: item.quantity as number }));

  return { rows, validRows, issues };
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