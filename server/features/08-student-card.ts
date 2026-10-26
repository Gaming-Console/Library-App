import express from 'express';
import { db, type openDatabase } from '../db';

type Database = Pick<ReturnType<typeof openDatabase>, 'prepare'>;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function createStudentCardRouter(database: Database) {
  const router = express.Router();

  router.get('/students/:id/card', (req, res, next) => {
    try {
      const requestedToday = req.query.today;
      const today = requestedToday === undefined ? localDate() : requestedToday;
      if (typeof today !== 'string' || !isDate(today)) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'יש להזין תאריך תקין בפורמט YYYY-MM-DD' } });
        return;
      }

      const student = database.prepare(
        'SELECT id, schoolId, fullName, className FROM students WHERE id = ?',
      ).get(req.params.id);
      if (!student) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'התלמידה לא נמצאה' } });
        return;
      }

      const rows = database.prepare(`
        SELECT l.id AS loanId, l.studentId, l.copyId, l.borrowedOn, l.dueOn, l.returnedOn,
               c.id AS copyIdValue, c.bookId, c.barcode,
               b.id AS bookIdValue, b.title, b.ageGroup
        FROM loans l
        JOIN copies c ON c.id = l.copyId
        JOIN books b ON b.id = c.bookId
        WHERE l.studentId = ?
        ORDER BY l.borrowedOn DESC, l.id DESC
      `).all(req.params.id);

      const loans = rows.map((row) => ({
        loan: {
          id: row.loanId as string,
          studentId: row.studentId as string,
          copyId: row.copyId as string,
          borrowedOn: row.borrowedOn as string,
          dueOn: row.dueOn as string,
          returnedOn: row.returnedOn as string | null,
        },
        copy: {
          id: row.copyIdValue as string,
          bookId: row.bookId as string,
          barcode: row.barcode as string,
        },
        book: {
          id: row.bookIdValue as string,
          title: row.title as string,
          ageGroup: row.ageGroup as string,
        },
        student: {
          id: student.id as string,
          schoolId: student.schoolId as string,
          fullName: student.fullName as string,
          className: student.className as string,
        },
        overdue: row.returnedOn === null && (row.dueOn as string) < today,
      }));

      res.json({ student, loans });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createStudentCardRouter(db);