import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { StudentInput } from '../../src/shared/types';
import { openDatabase } from '../db';
import { createStudentRouter, saveStudent } from './07-students';

const database = openDatabase(null);
database.exec(readFileSync('fixtures/schema.sql', 'utf8'));
database.exec(readFileSync('fixtures/demo.sql', 'utf8'));

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(createStudentRouter(database));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
});

describe('students feature', () => {
  it('returns duplicate names as separate students and filters by class', async () => {
    const names = await fetch(`${base}/students?q=${encodeURIComponent('תמר')}`).then((response) => response.json());
    expect(names.items).toHaveLength(2);
    expect(names.items[0].id).not.toBe(names.items[1].id);

    const classResults = await fetch(`${base}/students?className=${encodeURIComponent('ד1')}`).then((response) => response.json());
    expect(classResults.items.map((student: { className: string }) => student.className)).toEqual(['ד1']);
  });

  it('trims fields, assigns a UUID, and rejects duplicate school IDs without inserting', () => {
    const input: StudentInput = { schoolId: ' S-TEST ', fullName: ' תמר בדיקה ', className: ' ד1 ' };
    const created = saveStudent(input, undefined, database);
    expect(created).toMatchObject({ schoolId: 'S-TEST', fullName: 'תמר בדיקה', className: 'ד1' });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);

    expect(() => saveStudent({ ...input, fullName: 'תלמידה נוספת' }, undefined, database))
      .toThrow('מזהה בית־ספרי זה כבר משויך לתלמידה אחרת');
    expect(database.prepare('SELECT count(*) AS count FROM students WHERE schoolId = ?').get('S-TEST')?.count).toBe(1);
  });

  it('updates a student without changing the internal ID or loan history', async () => {
    const response = await fetch(`${base}/students/student-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: 'S001', fullName: 'תמר לדוגמה', className: 'ד2' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).student).toEqual({
      id: 'student-1', schoolId: 'S001', fullName: 'תמר לדוגמה', className: 'ד2',
    });
    expect(database.prepare('SELECT count(*) AS count FROM loans WHERE studentId = ?').get('student-1')?.count).toBe(2);

    const refreshed = await fetch(`${base}/students?className=${encodeURIComponent('ד2')}`).then((result) => result.json());
    expect(refreshed.items).toContainEqual({
      id: 'student-1', schoolId: 'S001', fullName: 'תמר לדוגמה', className: 'ד2',
    });
  });

  it('returns explicit conflict, invalid-input, and not-found responses', async () => {
    const duplicate = await fetch(`${base}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: 'S001', fullName: 'שם חדש', className: 'א1' }),
    });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe('DUPLICATE_SCHOOL_ID');

    const invalid = await fetch(`${base}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: 'S003', fullName: '  ', className: 'א1' }),
    });
    expect(invalid.status).toBe(400);

    const missing = await fetch(`${base}/students/missing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: 'S004', fullName: 'לא קיימת', className: 'א1' }),
    });
    expect(missing.status).toBe(404);
  });
});
