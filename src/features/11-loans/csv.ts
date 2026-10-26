import type { LoanView } from '../../shared/types';

export function localToday() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildLoansCsv(items: LoanView[], today: string) {
  const headers = ['תלמידה', 'כיתה', 'ספר', 'ברקוד', 'מועד החזרה', 'סטטוס'];
  const rows = items.map(({ loan, copy, book, student, overdue }) => [
    student.fullName,
    student.className,
    book.title,
    copy.barcode,
    loan.dueOn,
    loan.returnedOn ? 'הוחזרה' : overdue || loan.dueOn < today ? 'באיחור' : 'פעילה',
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}