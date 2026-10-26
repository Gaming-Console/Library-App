import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { LibraryData } from '../../src/shared/types';
import { db } from '../db';

type StorageDatabase = typeof db;
type Entity = Record<string, unknown>;

class InvalidBackupError extends Error {}

const schema = readFileSync(resolve('fixtures/schema.sql'), 'utf8');

export function initializeStorage(database: StorageDatabase = db) {
  database.exec(schema);
  database.prepare(
    'INSERT OR IGNORE INTO settings (id, libraryName, loanDays, maxActiveLoans) VALUES (1, ?, ?, ?)',
  ).run('מדף — ספריית בית הספר', 14, 3);
}

initializeStorage();

function isRecord(value: unknown): value is Entity {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Entity {
  if (!isRecord(value)) throw new InvalidBackupError(`${label} חייב להיות אובייקט.`);
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidBackupError(`${label} חייב להיות טקסט שאינו ריק.`);
  }
  return value;
}

function requireDate(value: unknown, label: string): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidBackupError(`${label} חייב להיות תאריך תקין בפורמט YYYY-MM-DD.`);
  }
  return value;
}

function requireRows(value: unknown, label: string): Entity[] {
  if (!Array.isArray(value)) throw new InvalidBackupError(`${label} חייבת להיות רשימה.`);
  return value.map((row, index) => requireRecord(row, `${label}, שורה ${index + 1}`));
}

function validateBackup(value: unknown): LibraryData {
  const data = requireRecord(value, 'הגיבוי');
  if (data.schemaVersion !== 1) throw new InvalidBackupError('גרסת הגיבוי אינה נתמכת.');

  const books = requireRows(data.books, 'ספרים').map((book, index) => ({
    id: requireText(book.id, `מזהה ספר ${index + 1}`),
    title: requireText(book.title, `שם ספר ${index + 1}`),
    ageGroup: requireText(book.ageGroup, `קבוצת גיל של ספר ${index + 1}`),
  }));
  const copies = requireRows(data.copies, 'עותקים').map((copy, index) => {
    const barcode = requireText(copy.barcode, `ברקוד עותק ${index + 1}`);
    if (!/^LIB-\d{6}$/.test(barcode)) {
      throw new InvalidBackupError(`ברקוד עותק ${index + 1} אינו בפורמט LIB-000001.`);
    }
    return {
      id: requireText(copy.id, `מזהה עותק ${index + 1}`),
      bookId: requireText(copy.bookId, `מזהה ספר בעותק ${index + 1}`),
      barcode,
    };
  });
  const students = requireRows(data.students, 'תלמידות').map((student, index) => ({
    id: requireText(student.id, `מזהה תלמידה ${index + 1}`),
    schoolId: requireText(student.schoolId, `מזהה בית ספר של תלמידה ${index + 1}`),
    fullName: requireText(student.fullName, `שם תלמידה ${index + 1}`),
    className: requireText(student.className, `כיתה של תלמידה ${index + 1}`),
  }));
  const loans = requireRows(data.loans, 'השאלות').map((loan, index) => {
    const borrowedOn = requireDate(loan.borrowedOn, `תאריך השאלה ${index + 1}`);
    const dueOn = requireDate(loan.dueOn, `תאריך החזרה ${index + 1}`);
    const returnedOn = loan.returnedOn === null
      ? null
      : requireDate(loan.returnedOn, `תאריך החזרה בפועל ${index + 1}`);
    if (dueOn < borrowedOn || (returnedOn !== null && returnedOn < borrowedOn)) {
      throw new InvalidBackupError(`התאריכים בהשאלה ${index + 1} אינם בסדר תקין.`);
    }
    return {
      id: requireText(loan.id, `מזהה השאלה ${index + 1}`),
      studentId: requireText(loan.studentId, `מזהה תלמידה בהשאלה ${index + 1}`),
      copyId: requireText(loan.copyId, `מזהה עותק בהשאלה ${index + 1}`),
      borrowedOn,
      dueOn,
      returnedOn,
    };
  });
  const settings = requireRecord(data.settings, 'הגדרות');
  const libraryName = requireText(settings.libraryName, 'שם הספרייה');
  if (
    !Number.isInteger(settings.loanDays) || Number(settings.loanDays) < 1 || Number(settings.loanDays) > 90
    || !Number.isInteger(settings.maxActiveLoans) || Number(settings.maxActiveLoans) < 1 || Number(settings.maxActiveLoans) > 20
  ) {
    throw new InvalidBackupError('הגדרות ימי ההשאלה ומספר ההשאלות חייבות להיות בטווח המותר.');
  }

  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new InvalidBackupError(`${label} חייבים להיות ייחודיים.`);
  };
  unique(
    [...books, ...copies, ...students, ...loans].map((row) => row.id),
    'המזהים',
  );
  unique(copies.map((copy) => copy.barcode), 'הברקודים');
  unique(students.map((student) => student.schoolId), 'מזהי בית הספר');

  const bookIds = new Set(books.map((book) => book.id));
  const copyIds = new Set(copies.map((copy) => copy.id));
  const studentIds = new Set(students.map((student) => student.id));
  for (const copy of copies) {
    if (!bookIds.has(copy.bookId)) throw new InvalidBackupError(`הספר ${copy.bookId} של אחד העותקים אינו קיים.`);
  }
  const activeCopyIds = new Set<string>();
  for (const loan of loans) {
    if (!studentIds.has(loan.studentId)) throw new InvalidBackupError(`התלמידה ${loan.studentId} באחת ההשאלות אינה קיימת.`);
    if (!copyIds.has(loan.copyId)) throw new InvalidBackupError(`העותק ${loan.copyId} באחת ההשאלות אינו קיים.`);
    if (loan.returnedOn === null) {
      if (activeCopyIds.has(loan.copyId)) {
        throw new InvalidBackupError(`לעותק ${loan.copyId} יש יותר מהשאלה פעילה אחת.`);
      }
      activeCopyIds.add(loan.copyId);
    }
  }

  return {
    schemaVersion: 1,
    books,
    copies,
    students,
    loans,
    settings: {
      libraryName,
      loanDays: Number(settings.loanDays),
      maxActiveLoans: Number(settings.maxActiveLoans),
    },
  };
}

function getBackup(database: StorageDatabase): LibraryData {
  const books = database.prepare('SELECT id, title, ageGroup FROM books ORDER BY rowid').all()
    .map((row) => ({ id: String(row.id), title: String(row.title), ageGroup: String(row.ageGroup) }));
  const copies = database.prepare('SELECT id, bookId, barcode FROM copies ORDER BY rowid').all()
    .map((row) => ({ id: String(row.id), bookId: String(row.bookId), barcode: String(row.barcode) }));
  const students = database.prepare('SELECT id, schoolId, fullName, className FROM students ORDER BY rowid').all()
    .map((row) => ({
      id: String(row.id),
      schoolId: String(row.schoolId),
      fullName: String(row.fullName),
      className: String(row.className),
    }));
  const loans = database.prepare('SELECT id, studentId, copyId, borrowedOn, dueOn, returnedOn FROM loans ORDER BY rowid').all()
    .map((row) => ({
      id: String(row.id),
      studentId: String(row.studentId),
      copyId: String(row.copyId),
      borrowedOn: String(row.borrowedOn),
      dueOn: String(row.dueOn),
      returnedOn: row.returnedOn === null ? null : String(row.returnedOn),
    }));
  const settings = database.prepare('SELECT libraryName, loanDays, maxActiveLoans FROM settings WHERE id=1').get();
  if (!settings) throw new Error('Library settings are missing after storage initialization');
  return {
    schemaVersion: 1,
    books,
    copies,
    students,
    loans,
    settings: {
      libraryName: String(settings.libraryName),
      loanDays: Number(settings.loanDays),
      maxActiveLoans: Number(settings.maxActiveLoans),
    },
  };
}

function counts(data: LibraryData) {
  return {
    books: data.books.length,
    copies: data.copies.length,
    students: data.students.length,
    loans: data.loans.length,
  };
}

function sendValidationError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof InvalidBackupError) {
    response.status(400).json({ error: { code: 'INVALID_BACKUP', message: error.message } });
    return;
  }
  next(error);
}

export function createStorageRouter(database: StorageDatabase = db) {
  const router = express.Router();

  router.get('/backup', (_request, response, next) => {
    try {
      response.json(getBackup(database));
    } catch (error) {
      next(error);
    }
  });

  router.post('/backup/validate', (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!isRecord(request.body) || !('data' in request.body)) {
        throw new InvalidBackupError('לא נמצא תוכן גיבוי בבקשה.');
      }
      response.json({ counts: counts(validateBackup(request.body.data)) });
    } catch (error) {
      sendValidationError(error, response, next);
    }
  });

  router.post('/backup/restore', (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!isRecord(request.body) || !('data' in request.body)) {
        throw new InvalidBackupError('לא נמצא תוכן גיבוי בבקשה.');
      }
      if (request.body.confirm !== true) {
        throw new InvalidBackupError('יש לאשר במפורש את החלפת המאגר.');
      }
      const data = validateBackup(request.body.data);
      database.transaction(() => {
        database.prepare('DELETE FROM loans').run();
        database.prepare('DELETE FROM copies').run();
        database.prepare('DELETE FROM books').run();
        database.prepare('DELETE FROM students').run();

        const insertBook = database.prepare('INSERT INTO books (id, title, ageGroup) VALUES (?, ?, ?)');
        for (const book of data.books) insertBook.run(book.id, book.title, book.ageGroup);
        const insertCopy = database.prepare('INSERT INTO copies (id, bookId, barcode) VALUES (?, ?, ?)');
        for (const copy of data.copies) insertCopy.run(copy.id, copy.bookId, copy.barcode);
        const insertStudent = database.prepare(
          'INSERT INTO students (id, schoolId, fullName, className) VALUES (?, ?, ?, ?)',
        );
        for (const student of data.students) {
          insertStudent.run(student.id, student.schoolId, student.fullName, student.className);
        }
        const insertLoan = database.prepare(
          'INSERT INTO loans (id, studentId, copyId, borrowedOn, dueOn, returnedOn) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const loan of data.loans) {
          insertLoan.run(loan.id, loan.studentId, loan.copyId, loan.borrowedOn, loan.dueOn, loan.returnedOn);
        }
        database.prepare(
          'UPDATE settings SET libraryName=?, loanDays=?, maxActiveLoans=? WHERE id=1',
        ).run(data.settings.libraryName, data.settings.loanDays, data.settings.maxActiveLoans);
      })();
      response.json({ restored: true });
    } catch (error) {
      sendValidationError(error, response, next);
    }
  });

  return router;
}

export default createStorageRouter();
