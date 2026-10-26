import { describe, expect, it } from 'vitest';
import type { LoanView } from '../../shared/types';
import { buildLoansCsv } from './csv';

const baseItem: LoanView = {
  loan: { id: 'loan-1', studentId: 'student-1', copyId: 'copy-1', borrowedOn: '2026-10-01', dueOn: '2026-10-26', returnedOn: null },
  copy: { id: 'copy-1', bookId: 'book-1', barcode: 'LIB-000001' },
  book: { id: 'book-1', title: 'הספר, "החדש"', ageGroup: 'ג–ד' },
  student: { id: 'student-1', schoolId: 'S001', fullName: 'רות, כהן', className: 'ד1' },
  overdue: false,
};

describe('loan CSV export', () => {
  it('exports Hebrew headers and values with a UTF-8 BOM and valid CSV quoting', () => {
    const csv = buildLoansCsv([baseItem], '2026-10-26');
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('"תלמידה","כיתה","ספר","ברקוד","מועד החזרה","סטטוס"');
    expect(csv).toContain('"רות, כהן","ד1","הספר, ""החדש""","LIB-000001","2026-10-26","פעילה"');
  });

  it('quotes multiline cells and prefixes spreadsheet formula values', () => {
    const csv = buildLoansCsv([{
      ...baseItem,
      student: { ...baseItem.student, fullName: '=1+1, "שם"\nשורה' },
    }], '2026-10-26');
    expect(csv).toContain(`"'=1+1, ""שם""\nשורה"`);
  });
});