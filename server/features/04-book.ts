import { Router } from 'express';
import type { Book, BookDetails, CopyView, Loan, Student } from '../../src/shared/types';
import { db } from '../db';

const router = Router();

function fail(res: import('express').Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

function findBook(id: string): Book | null {
  const row = db.prepare('SELECT id, title, ageGroup FROM books WHERE id = ?').get(id);
  return row ? { id: String(row.id), title: String(row.title), ageGroup: String(row.ageGroup) } : null;
}

function loadDetails(book: Book): BookDetails {
  const rows = db.prepare(`
    SELECT c.id AS copyId, c.bookId, c.barcode,
           l.id AS loanId, l.studentId, l.borrowedOn, l.dueOn, l.returnedOn,
           s.schoolId, s.fullName, s.className
    FROM copies c
    LEFT JOIN loans l ON l.copyId = c.id AND l.returnedOn IS NULL
    LEFT JOIN students s ON s.id = l.studentId
    WHERE c.bookId = ?
    ORDER BY c.barcode`).all(book.id);
  const copies: CopyView[] = rows.map((r) => {
    const activeLoan: Loan | null = r.loanId == null ? null : {
      id: String(r.loanId), studentId: String(r.studentId), copyId: String(r.copyId),
      borrowedOn: String(r.borrowedOn), dueOn: String(r.dueOn), returnedOn: null,
    };
    const borrower: Student | null = activeLoan === null ? null : {
      id: activeLoan.studentId, schoolId: String(r.schoolId),
      fullName: String(r.fullName), className: String(r.className),
    };
    return {
      copy: { id: String(r.copyId), bookId: String(r.bookId), barcode: String(r.barcode) },
      book, activeLoan, borrower,
    };
  });
  return { book, copies };
}

router.get('/books/:id', (req, res) => {
  const book = findBook(req.params.id);
  if (!book) return fail(res, 404, 'NOT_FOUND', 'הספר המבוקש לא נמצא');
  res.json(loadDetails(book));
});

router.patch('/books/:id', (req, res) => {
  const body: unknown = req.body;
  const { title, ageGroup } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof title !== 'string' || typeof ageGroup !== 'string' || !title.trim() || !ageGroup.trim()) {
    return fail(res, 400, 'INVALID_INPUT', 'יש למלא שם ספר וגיל יעד');
  }
  if (!findBook(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'הספר המבוקש לא נמצא');
  db.prepare('UPDATE books SET title = ?, ageGroup = ? WHERE id = ?').run(title.trim(), ageGroup.trim(), req.params.id);
  res.json({ book: findBook(req.params.id) });
});

export default router;
