import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { createStudentCardRouter } from './08-student-card';

let database: ReturnType<typeof openDatabase>;
let server: Server;
let base = '';

beforeEach(async () => {
  database = openDatabase(null);
  database.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  database.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  const app = express();
  app.use('/api', createStudentCardRouter(database));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}/api`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
});

describe('GET /students/:id/card', () => {
  it('returns active and historical loans and marks only past due active loans overdue', async () => {
    const response = await fetch(`${base}/students/student-1/card?today=2026-11-04`);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.student).toMatchObject({ id: 'student-1', schoolId: 'S001', className: 'ד1' });
    expect(result.loans).toHaveLength(2);
    expect(result.loans[0]).toMatchObject({ loan: { id: 'loan-1', returnedOn: null }, copy: { barcode: 'LIB-000002' }, overdue: true });
    expect(result.loans[1]).toMatchObject({ loan: { id: 'loan-3', returnedOn: '2026-09-10' }, book: { id: 'book-3' }, overdue: false });
  });

  it('does not mark a loan overdue on its due date', async () => {
    const response = await fetch(`${base}/students/student-1/card?today=2026-11-03`);
    const result = await response.json();
    expect(result.loans.find((item: { loan: { id: string } }) => item.loan.id === 'loan-1').overdue).toBe(false);
  });

  it('returns an empty loan list for a known student without loans', async () => {
    database.prepare('INSERT INTO students VALUES (?, ?, ?, ?)').run('student-empty', 'S004', 'תלמידה ללא השאלות', 'א1');
    const response = await fetch(`${base}/students/student-empty/card`);
    expect(response.status).toBe(200);
    expect((await response.json()).loans).toEqual([]);
  });

  it('reflects a return after the card is fetched again and returns 404 for an unknown student', async () => {
    const first = await fetch(`${base}/students/student-1/card?today=2026-11-04`);
    expect((await first.json()).loans.filter((item: { loan: { returnedOn: string | null } }) => item.loan.returnedOn === null)).toHaveLength(1);

    database.prepare('UPDATE loans SET returnedOn = ? WHERE id = ?').run('2026-11-04', 'loan-1');
    const reloaded = await fetch(`${base}/students/student-1/card?today=2026-11-04`);
    const result = await reloaded.json();
    expect(result.loans.every((item: { loan: { returnedOn: string | null } }) => item.loan.returnedOn !== null)).toBe(true);
    expect(result.loans.find((item: { loan: { id: string } }) => item.loan.id === 'loan-1').overdue).toBe(false);

    const missing = await fetch(`${base}/students/not-a-student/card`);
    expect(missing.status).toBe(404);
  });

  it('rejects malformed calendar dates', async () => {
    const response = await fetch(`${base}/students/student-1/card?today=2026-02-30`);
    expect(response.status).toBe(400);
  });
});