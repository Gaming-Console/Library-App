import express, { type Router } from 'express';
import { db, type openDatabase } from '../db';

type Database = ReturnType<typeof openDatabase>;

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function queryValue(value: unknown, fallback: string) {
  if (value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return null;
}

export function createLoansRouter(database: Database = db): Router {
  const router = express.Router();

  router.get('/loans', (req, res) => {
    const q = queryValue(req.query.q, '');
    const className = queryValue(req.query.className, '');
    const status = queryValue(req.query.status, 'active');
    const today = queryValue(req.query.today, localDate());
    if (q === null || className === null || status === null || today === null) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'פרמטרי החיפוש אינם תקינים' } });
      return;
    }
    if (!['active', 'overdue', 'all'].includes(status)) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'סטטוס ההשאלה אינו תקין' } });
      return;
    }
    if (!isDate(today)) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'התאריך אינו תקין' } });
      return;
    }

    const conditions: string[] = [];
    const parameters: string[] = [];
    if (status === 'active') conditions.push('l.returnedOn IS NULL');
    if (status === 'overdue') {
      conditions.push('l.returnedOn IS NULL', 'l.dueOn < ?');
      parameters.push(today);
    }
    if (className.trim()) {
      conditions.push('s.className = ?');
      parameters.push(className.trim());
    }
    if (q.trim()) {
      const escaped = q.trim().replace(/[\\%_]/g, '\\$&').toLowerCase();
      conditions.push("(LOWER(s.fullName) LIKE ? ESCAPE '\\' OR LOWER(s.className) LIKE ? ESCAPE '\\' OR LOWER(b.title) LIKE ? ESCAPE '\\' OR LOWER(c.barcode) LIKE ? ESCAPE '\\')");
      const pattern = `%${escaped}%`;
      parameters.push(pattern, pattern, pattern, pattern);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = database.prepare(`
      SELECT
        l.id AS loan_id, l.studentId AS loan_studentId, l.copyId AS loan_copyId,
        l.borrowedOn AS loan_borrowedOn, l.dueOn AS loan_dueOn, l.returnedOn AS loan_returnedOn,
        c.id AS copy_id, c.bookId AS copy_bookId, c.barcode AS copy_barcode,
        b.id AS book_id, b.title AS book_title, b.ageGroup AS book_ageGroup,
        s.id AS student_id, s.schoolId AS student_schoolId,
        s.fullName AS student_fullName, s.className AS student_className
      FROM loans l
      JOIN copies c ON c.id = l.copyId
      JOIN books b ON b.id = c.bookId
      JOIN students s ON s.id = l.studentId
      ${where}
      ORDER BY l.dueOn, s.fullName, b.title
    `).all(...parameters);

    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const items = rows.map((row) => {
      const returnedOn = row.loan_returnedOn === null ? null : text(row.loan_returnedOn);
      const dueOn = text(row.loan_dueOn);
      return {
        loan: {
          id: text(row.loan_id), studentId: text(row.loan_studentId), copyId: text(row.loan_copyId),
          borrowedOn: text(row.loan_borrowedOn), dueOn, returnedOn,
        },
        copy: { id: text(row.copy_id), bookId: text(row.copy_bookId), barcode: text(row.copy_barcode) },
        book: { id: text(row.book_id), title: text(row.book_title), ageGroup: text(row.book_ageGroup) },
        student: {
          id: text(row.student_id), schoolId: text(row.student_schoolId),
          fullName: text(row.student_fullName), className: text(row.student_className),
        },
        overdue: returnedOn === null && dueOn < today,
      };
    });
    res.json({ items });
  });

  return router;
}

export default createLoansRouter();