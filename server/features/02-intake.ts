import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { BookInput } from '../../src/shared/types';
import { db } from '../db';

class IntakeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function validateItems(value: unknown): BookInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new IntakeError(400, 'INVALID_INPUT', 'יש להוסיף בין שורה אחת ל־100 שורות');
  }

  let totalCopies = 0;
  const items = value.map((candidate): BookInput => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new IntakeError(400, 'INVALID_INPUT', 'פרטי אחת השורות אינם תקינים');
    }

    const item = candidate as Record<string, unknown>;
    if (typeof item.title !== 'string' || !item.title.trim()) {
      throw new IntakeError(400, 'INVALID_INPUT', 'יש להזין שם ספר');
    }
    if (typeof item.ageGroup !== 'string' || !item.ageGroup.trim()) {
      throw new IntakeError(400, 'INVALID_INPUT', 'יש להזין גיל יעד');
    }
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new IntakeError(400, 'INVALID_INPUT', 'יש להזין כמות שלמה בין 1 ל־100');
    }
    if (item.targetBookId !== undefined && (typeof item.targetBookId !== 'string' || !item.targetBookId.trim())) {
      throw new IntakeError(400, 'INVALID_INPUT', 'בחירת הספר הקיים אינה תקינה');
    }

    totalCopies += item.quantity;
    return {
      title: item.title.trim(),
      ageGroup: item.ageGroup.trim(),
      quantity: item.quantity,
      ...(item.targetBookId === undefined ? {} : { targetBookId: item.targetBookId as string }),
    };
  });

  if (totalCopies > 500) {
    throw new IntakeError(400, 'INVALID_INPUT', 'אפשר ליצור עד 500 עותקים בבקשה אחת');
  }
  return items;
}

function createBookRecords(database: typeof db, input: unknown) {
  const items = validateItems(input);
  return database.transaction(() => {
      for (const item of items) {
        if (item.targetBookId && !database.prepare('SELECT id FROM books WHERE id = ?').get(item.targetBookId)) {
          throw new IntakeError(404, 'BOOK_NOT_FOUND', 'הספר שנבחר אינו קיים');
        }
      }

      const highestBarcode = database.prepare(
        'SELECT MAX(CAST(substr(barcode, 5) AS INTEGER)) AS highest FROM copies',
      ).get()?.highest;
      let nextBarcode = typeof highestBarcode === 'number' ? highestBarcode + 1 : 1;
      if (nextBarcode + items.reduce((sum, item) => sum + item.quantity, 0) - 1 > 999999) {
        throw new IntakeError(400, 'BARCODE_LIMIT', 'לא ניתן ליצור עותקים נוספים: טווח הברקודים הסתיים');
      }

      const copyIds: string[] = [];
      const insertBook = database.prepare('INSERT INTO books (id, title, ageGroup) VALUES (?, ?, ?)');
      const insertCopy = database.prepare('INSERT INTO copies (id, bookId, barcode) VALUES (?, ?, ?)');
      for (const item of items) {
        const bookId = item.targetBookId ?? randomUUID();
        if (!item.targetBookId) insertBook.run(bookId, item.title, item.ageGroup);
        for (let index = 0; index < item.quantity; index++) {
          const copyId = randomUUID();
          insertCopy.run(copyId, bookId, `LIB-${String(nextBarcode).padStart(6, '0')}`);
          copyIds.push(copyId);
          nextBarcode++;
        }
      }
      const copies = copyIds.map((id) => database.prepare(
        'SELECT id, bookId, barcode FROM copies WHERE id = ?',
      ).get(id));
      return { copyIds, copies };
    })();
}

export function createAddBooks(database: typeof db) {
  return (input: BookInput[]): string[] => createBookRecords(database, input).copyIds;
}

export const addBooks = createAddBooks(db);

export function createIntakeRouter(database: typeof db = db): Router {
  const router = express.Router();

  router.get('/intake/books', (_req, res, next) => {
    try {
      const items = database.prepare('SELECT id, title, ageGroup FROM books ORDER BY title COLLATE NOCASE').all();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post('/books', (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(createBookRecords(database, req.body?.items));
    } catch (error) {
      if (error instanceof IntakeError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  });

  return router;
}

export default createIntakeRouter();
