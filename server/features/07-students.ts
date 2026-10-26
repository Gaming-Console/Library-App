import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import type { Student, StudentInput } from '../../src/shared/types';
import { db, openDatabase } from '../db';

type StudentDatabase = ReturnType<typeof openDatabase>;

class StudentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function normalizeInput(value: unknown): StudentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StudentError('יש להזין פרטי תלמידה', 400, 'INVALID_INPUT');
  }

  const input = value as Record<string, unknown>;
  const schoolId = typeof input.schoolId === 'string' ? input.schoolId.trim() : '';
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const className = typeof input.className === 'string' ? input.className.trim() : '';
  if (!schoolId || !fullName || !className) {
    throw new StudentError('יש למלא מזהה, שם וכיתה', 400, 'INVALID_INPUT');
  }
  return { schoolId, fullName, className };
}

function studentFromRow(row: Record<string, string | number | Uint8Array | null>): Student {
  const id = row.id;
  const schoolId = row.schoolId;
  const fullName = row.fullName;
  const className = row.className;
  if (typeof id !== 'string' || typeof schoolId !== 'string'
    || typeof fullName !== 'string' || typeof className !== 'string') {
    throw new Error('Invalid student row in database');
  }
  return { id, schoolId, fullName, className };
}

function save(inputValue: unknown, id: string | undefined, database: StudentDatabase): Student {
  const input = normalizeInput(inputValue);
  const duplicate = database.prepare(
    'SELECT id FROM students WHERE schoolId = ? AND id != ?',
  ).get(input.schoolId, id ?? '')?.id;
  if (duplicate !== undefined) {
    throw new StudentError('מזהה בית־ספרי זה כבר משויך לתלמידה אחרת', 409, 'DUPLICATE_SCHOOL_ID');
  }

  if (id) {
    const existing = database.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!existing) throw new StudentError('התלמידה לא נמצאה', 404, 'NOT_FOUND');
    try {
      database.prepare(
        'UPDATE students SET schoolId = ?, fullName = ?, className = ? WHERE id = ?',
      ).run(input.schoolId, input.fullName, input.className, id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: students.schoolId')) {
        throw new StudentError('מזהה בית־ספרי זה כבר משויך לתלמידה אחרת', 409, 'DUPLICATE_SCHOOL_ID');
      }
      throw error;
    }
    return { id, ...input };
  }

  const student: Student = { id: randomUUID(), ...input };
  try {
    database.prepare(
      'INSERT INTO students (id, schoolId, fullName, className) VALUES (?, ?, ?, ?)',
    ).run(student.id, student.schoolId, student.fullName, student.className);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: students.schoolId')) {
      throw new StudentError('מזהה בית־ספרי זה כבר משויך לתלמידה אחרת', 409, 'DUPLICATE_SCHOOL_ID');
    }
    throw error;
  }
  return student;
}

export function saveStudent(input: StudentInput, id?: string, database: StudentDatabase = db): Student {
  return save(input, id, database);
}

function sendError(error: unknown, res: Response) {
  if (error instanceof StudentError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Student request failed', error);
  res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'שמירת או טעינת התלמידות נכשלה. בדקי את חלון השרת.' },
  });
}

function queryValue(value: unknown, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new StudentError(`המסנן ${label} אינו תקין`, 400, 'INVALID_INPUT');
  }
  return value.trim();
}

export function createStudentRouter(database: StudentDatabase = db) {
  const router = express.Router();

  router.get('/students', (req: Request, res: Response) => {
    try {
      const query = queryValue(req.query.q, 'חיפוש');
      const className = queryValue(req.query.className, 'כיתה');
      const pattern = `%${query.replace(/[!%_]/g, '!$&')}%`;
      const items = database.prepare(
        `SELECT id, schoolId, fullName, className
         FROM students
         WHERE (? = '' OR fullName LIKE ? ESCAPE '!' OR schoolId LIKE ? ESCAPE '!')
           AND (? = '' OR className = ?)
         ORDER BY rowid`,
      ).all(query, pattern, pattern, className, className).map(studentFromRow);
      res.json({ items });
    } catch (error) {
      sendError(error, res);
    }
  });

  router.post('/students', (req: Request, res: Response) => {
    try {
      const student = save(req.body, undefined, database);
      res.status(201).json({ student });
    } catch (error) {
      sendError(error, res);
    }
  });

  router.patch('/students/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) {
        throw new StudentError('מזהה התלמידה אינו תקין', 400, 'INVALID_INPUT');
      }
      const student = save(req.body, id, database);
      res.json({ student });
    } catch (error) {
      sendError(error, res);
    }
  });

  return router;
}

export default createStudentRouter();
