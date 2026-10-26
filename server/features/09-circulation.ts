import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import type { CopyView, Loan, Settings, Student } from '../../src/shared/types';

const router = Router();
const barcodeSchema = z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^LIB-\d{6}$/));
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}, 'Invalid date');

function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function getSettings(): Settings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as unknown as Settings | undefined;
  if (!row) throw new Error('Missing settings row');
  return row;
}

function addCalendarDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function readCopyView(barcode: string): CopyView | null {
  const copy = db.prepare('SELECT * FROM copies WHERE barcode = ?').get(barcode) as { id: string; bookId: string; barcode: string } | undefined;
  if (!copy) return null;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(copy.bookId) as { id: string; title: string; ageGroup: string } | undefined;
  if (!book) return null;
  const activeLoan = db.prepare('SELECT * FROM loans WHERE copyId = ? AND returnedOn IS NULL').get(copy.id) as unknown as Loan | undefined;
  const borrower = activeLoan ? (db.prepare('SELECT * FROM students WHERE id = ?').get(activeLoan.studentId) as unknown as Student | undefined) ?? null : null;
  return {
    copy,
    book,
    activeLoan: activeLoan ?? null,
    borrower,
  };
}

router.get('/scan/:barcode', (req, res) => {
  const parsed = barcodeSchema.safeParse(req.params.barcode);
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_INPUT', 'הברקוד חייב להיות בפורמט LIB-000001');
  }
  const view = readCopyView(parsed.data);
  if (!view) {
    return sendError(res, 404, 'COPY_NOT_FOUND', 'העותק לא נמצא');
  }
  return res.json(view);
});

router.post('/circulation/checkout', (req, res) => {
  const parsed = z.object({
    studentId: z.string().trim().min(1),
    barcode: barcodeSchema,
    borrowedOn: dateSchema,
  }).safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_INPUT', 'יש להזין מזהה תלמידה, ברקוד תקין ותאריך חוקי');
  }

  const { studentId, barcode, borrowedOn } = parsed.data;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as unknown as Student | undefined;
  if (!student) {
    return sendError(res, 404, 'STUDENT_NOT_FOUND', 'התלמידה לא נמצאה');
  }

  const copy = db.prepare('SELECT * FROM copies WHERE barcode = ?').get(barcode) as { id: string; bookId: string; barcode: string } | undefined;
  if (!copy) {
    return sendError(res, 404, 'COPY_NOT_FOUND', 'העותק לא נמצא');
  }

  const loanId = `loan-${randomUUID()}`;

  try {
    db.transaction(() => {
      const activeLoan = db.prepare('SELECT * FROM loans WHERE copyId = ? AND returnedOn IS NULL').get(copy.id) as unknown as Loan | undefined;
      if (activeLoan) throw new Error('COPY_ALREADY_BORROWED');

      const settings = getSettings();
      const activeCount = (db.prepare('SELECT COUNT(*) AS count FROM loans WHERE studentId = ? AND returnedOn IS NULL').get(studentId) as { count: number }).count;
      if (activeCount >= settings.maxActiveLoans) throw new Error('LOAN_LIMIT_REACHED');

      const dueOn = addCalendarDays(borrowedOn, settings.loanDays);
      db.prepare('INSERT INTO loans (id, studentId, copyId, borrowedOn, dueOn, returnedOn) VALUES (?, ?, ?, ?, ?, NULL)').run(loanId, studentId, copy.id, borrowedOn, dueOn);
    })();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'COPY_ALREADY_BORROWED') {
      return sendError(res, 409, 'COPY_ALREADY_BORROWED', 'העותק כבר מושאל');
    }
    if (message === 'LOAN_LIMIT_REACHED') {
      return sendError(res, 409, 'LOAN_LIMIT_REACHED', 'התלמידה הגיעה למגבלת ההשאלות הפעילות');
    }
    if (error instanceof Error && /UNIQUE constraint failed|constraint failed/i.test(error.message)) {
      return sendError(res, 409, 'COPY_ALREADY_BORROWED', 'העותק כבר מושאל');
    }
    console.error('Checkout failed', error);
    return sendError(res, 500, 'SERVER_ERROR', 'הפעולה נכשלה בשרת. בדקי את חלון השרת לפני ניסיון נוסף.');
  }

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as unknown as Loan | undefined;
  if (!loan) {
    return sendError(res, 500, 'SERVER_ERROR', 'לא נוצרה השאלה');
  }

  return res.status(201).json({ loan });
});

router.post('/circulation/return', (req, res) => {
  const parsed = z.object({
    barcode: barcodeSchema,
    returnedOn: dateSchema,
  }).safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_INPUT', 'יש להזין ברקוד תקין ותאריך חוקי');
  }

  const { barcode, returnedOn } = parsed.data;
  const copy = db.prepare('SELECT * FROM copies WHERE barcode = ?').get(barcode) as { id: string; bookId: string; barcode: string } | undefined;
  if (!copy) {
    return sendError(res, 404, 'COPY_NOT_FOUND', 'העותק לא נמצא');
  }

  try {
    let loan: Loan | undefined;
    db.transaction(() => {
      const activeLoan = db.prepare('SELECT * FROM loans WHERE copyId = ? AND returnedOn IS NULL').get(copy.id) as unknown as Loan | undefined;
      if (!activeLoan) throw new Error('RETURN_NOT_ALLOWED');
      if (returnedOn < activeLoan.borrowedOn) throw new Error('RETURN_NOT_ALLOWED');
      db.prepare('UPDATE loans SET returnedOn = ? WHERE id = ? AND returnedOn IS NULL').run(returnedOn, activeLoan.id);
      loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(activeLoan.id) as unknown as Loan | undefined;
    })();

    if (!loan) {
      return sendError(res, 500, 'SERVER_ERROR', 'לא עודכנה ההחזרה');
    }

    return res.json({ loan });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'RETURN_NOT_ALLOWED') {
      return sendError(res, 409, 'RETURN_NOT_ALLOWED', 'העותק כבר הוחזר או לא מושאל');
    }
    console.error('Return failed', error);
    return sendError(res, 500, 'SERVER_ERROR', 'הפעולה נכשלה בשרת. בדקי את חלון השרת לפני ניסיון נוסף.');
  }
});

export default router;
