import { Router, type Request, type Response } from 'express';
import type { SqlValue } from 'sql.js';
import { db as defaultDb } from '../db';
import type { Book, CatalogItem, Copy, CopyView, Loan, Student } from '../../src/shared/types';

type Database = Pick<typeof defaultDb, 'prepare'>;

const MAX_QUERY_LENGTH = 100;

function invalid(res: Response, message: string) {
  res.status(400).json({ error: { code: 'INVALID_INPUT', message } });
}

function single(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null;
}

export function searchBooks(db: Database, filters: { q: string; ageGroup: string; availableOnly: boolean }): CatalogItem[] {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (filters.q) {
    where.push('(instr(lower(title), lower(?)) > 0 OR EXISTS (SELECT 1 FROM copies c WHERE c.bookId = catalog.id AND c.barcode = ?))');
    params.push(filters.q, filters.q.toUpperCase());
  }
  if (filters.ageGroup) {
    where.push('ageGroup = ?');
    params.push(filters.ageGroup);
  }
  if (filters.availableOnly) where.push('availableCopies > 0');
  const rows = db.prepare(`
    SELECT id, title, ageGroup, totalCopies, availableCopies FROM (
      SELECT b.id, b.title, b.ageGroup,
        (SELECT COUNT(*) FROM copies c WHERE c.bookId = b.id) AS totalCopies,
        (SELECT COUNT(*) FROM copies c WHERE c.bookId = b.id
           AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copyId = c.id AND l.returnedOn IS NULL)) AS availableCopies
      FROM books b
    ) AS catalog
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY title, id`).all(...params);
  return rows.map((row) => ({
    book: { id: String(row.id), title: String(row.title), ageGroup: String(row.ageGroup) },
    totalCopies: Number(row.totalCopies),
    availableCopies: Number(row.availableCopies),
  }));
}

export function listCopies(db: Database, bookId?: string): CopyView[] {
  const rows = db.prepare(`
    SELECT c.id AS copyId, c.bookId, c.barcode, b.title, b.ageGroup,
      l.id AS loanId, l.studentId, l.borrowedOn, l.dueOn,
      s.schoolId, s.fullName, s.className
    FROM copies c
    JOIN books b ON b.id = c.bookId
    LEFT JOIN loans l ON l.copyId = c.id AND l.returnedOn IS NULL
    LEFT JOIN students s ON s.id = l.studentId
    ${bookId === undefined ? '' : 'WHERE c.bookId = ?'}
    ORDER BY c.barcode, c.id`).all(...(bookId === undefined ? [] : [bookId]));
  return rows.map((row) => {
    const copy: Copy = { id: String(row.copyId), bookId: String(row.bookId), barcode: String(row.barcode) };
    const book: Book = { id: copy.bookId, title: String(row.title), ageGroup: String(row.ageGroup) };
    const activeLoan: Loan | null = row.loanId === null ? null : {
      id: String(row.loanId), studentId: String(row.studentId), copyId: copy.id,
      borrowedOn: String(row.borrowedOn), dueOn: String(row.dueOn), returnedOn: null,
    };
    const borrower: Student | null = row.loanId === null ? null : {
      id: String(row.studentId), schoolId: String(row.schoolId), fullName: String(row.fullName), className: String(row.className),
    };
    return { copy, book, activeLoan, borrower };
  });
}

export function createCatalogRouter(db: Database = defaultDb) {
  const router = Router();

  router.get('/books', (req: Request, res: Response) => {
    const q = single(req.query.q);
    const ageGroup = single(req.query.ageGroup);
    const available = single(req.query.availableOnly);
    if (q === null || ageGroup === null || available === null) return invalid(res, 'פרמטרי החיפוש אינם תקינים');
    if (available !== undefined && available !== 'true' && available !== 'false') return invalid(res, 'availableOnly חייב להיות true או false');
    const term = (q ?? '').trim();
    if (term.length > MAX_QUERY_LENGTH) return invalid(res, 'טקסט החיפוש ארוך מדי');
    res.json({ items: searchBooks(db, { q: term, ageGroup: (ageGroup ?? '').trim(), availableOnly: available === 'true' }) });
  });

  router.get('/copies', (req: Request, res: Response) => {
    const bookId = single(req.query.bookId);
    if (bookId === null || bookId === '') return invalid(res, 'bookId אינו תקין');
    res.json({ items: listCopies(db, bookId) });
  });

  return router;
}

export default createCatalogRouter();
