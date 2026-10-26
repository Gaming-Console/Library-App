import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import type { Student, StudentInput } from '../../src/shared/types';

const tempDb = resolve('tests/.tmp-student-import.sqlite');
const originalDb = process.env.LIBRARY_DB;
let db: typeof import('../db').db;
let server: Server;
let base = '';

beforeAll(async () => {
  if (existsSync(tempDb)) unlinkSync(tempDb);
  if (existsSync(`${tempDb}.tmp`)) unlinkSync(`${tempDb}.tmp`);
  process.env.LIBRARY_DB = tempDb;
  vi.doMock('../db', async () => {
    const actual = await vi.importActual<typeof import('../db')>('../db');
    return { ...actual, db: actual.openDatabase(null) };
  });
  ({ db } = await import('../db'));
  const { createStudentImportRouter } = await import('./06-student-import');
  db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  db.exec(readFileSync('fixtures/demo.sql', 'utf8'));

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', createStudentImportRouter(async () => saveStudentForTest));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
  if (existsSync(tempDb)) unlinkSync(tempDb);
  if (existsSync(`${tempDb}.tmp`)) unlinkSync(`${tempDb}.tmp`);
  if (originalDb) process.env.LIBRARY_DB = originalDb;
  else delete process.env.LIBRARY_DB;
});

function saveStudentForTest(input: StudentInput, id?: string): Student {
  if (id) {
    db.prepare('UPDATE students SET schoolId = ?, fullName = ?, className = ? WHERE id = ?')
      .run(input.schoolId, input.fullName, input.className, id);
    return { id, ...input };
  }
  const studentId = `test-${input.schoolId}`;
  db.prepare('INSERT INTO students (id, schoolId, fullName, className) VALUES (?, ?, ?, ?)')
    .run(studentId, input.schoolId, input.fullName, input.className);
  return { id: studentId, ...input };
}

describe('POST /api/imports/students', () => {
  it('adds one student and updates another in one transaction', async () => {
    const response = await fetch(`${base}/api/imports/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          { schoolId: 'S001', fullName: 'תמר עידכון', className: 'ד2' },
          { schoolId: 'S004', fullName: 'רוני חדש', className: 'א1' },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ added: 1, updated: 1 });

    const updated = db.prepare("SELECT schoolId, fullName, className FROM students WHERE schoolId = 'S001'").get() as { schoolId: string; fullName: string; className: string };
    expect(updated.fullName).toBe('תמר עידכון');
    expect(updated.className).toBe('ד2');

    const newStudent = db.prepare("SELECT schoolId FROM students WHERE schoolId = 'S004'").get() as { schoolId: string } | undefined;
    expect(newStudent?.schoolId).toBe('S004');

    const loans = db.prepare("SELECT COUNT(*) AS count FROM loans WHERE studentId = (SELECT id FROM students WHERE schoolId = 'S001')").get() as { count: number };
    expect(loans.count).toBeGreaterThan(0);
  });

  it('rejects duplicate identifiers inside a single file', async () => {
    const response = await fetch(`${base}/api/imports/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          { schoolId: 'S005', fullName: 'אורית ראשונה', className: 'ג2' },
          { schoolId: 'S005', fullName: 'אורית שנייה', className: 'ג3' },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');
  });

  it('rejects missing data and preserves historical loan records', async () => {
    const before = db.prepare("SELECT COUNT(*) AS count FROM loans WHERE studentId = (SELECT id FROM students WHERE schoolId = 'S001')").get() as { count: number };

    const response = await fetch(`${base}/api/imports/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          { schoolId: 'S006', fullName: '', className: 'ב1' },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');

    const after = db.prepare("SELECT COUNT(*) AS count FROM loans WHERE studentId = (SELECT id FROM students WHERE schoolId = 'S001')").get() as { count: number };
    expect(after.count).toBe(before.count);
  });

  it('does not create duplicate records when the same import is repeated', async () => {
    const rows = [{ schoolId: 'S007', fullName: 'מיכל חוזרת', className: 'ב2' }];
    const sendImport = () => fetch(`${base}/api/imports/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });

    expect(await (await sendImport()).json()).toEqual({ added: 1, updated: 0 });
    expect(await (await sendImport()).json()).toEqual({ added: 0, updated: 1 });

    const count = db.prepare("SELECT COUNT(*) AS count FROM students WHERE schoolId = 'S007'").get() as { count: number };
    expect(count.count).toBe(1);
  });
});
