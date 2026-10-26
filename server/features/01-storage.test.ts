import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { createStorageRouter, initializeStorage } from './01-storage';
import { openDatabase } from '../db';

const databases: ReturnType<typeof openDatabase>[] = [];
const servers: Server[] = [];

async function startApi() {
  const database = openDatabase(null);
  databases.push(database);
  initializeStorage(database);
  const app = express();
  app.use(express.json());
  app.use(createStorageRouter(database));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  return { database, base: `http://127.0.0.1:${address.port}` };
}

function loadDemo(database: ReturnType<typeof openDatabase>) {
  database.prepare('DELETE FROM settings').run();
  database.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  initializeStorage(database);
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  databases.splice(0).forEach((database) => database.close());
});

describe('storage and backup API', () => {
  it('initializes an empty database with schema and defaults, but no demo rows', async () => {
    const { database, base } = await startApi();
    initializeStorage(database);

    const response = await fetch(`${base}/backup`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      books: [],
      copies: [],
      students: [],
      loans: [],
      settings: { libraryName: 'מדף — ספריית בית הספר', loanDays: 14, maxActiveLoans: 3 },
    });
  });

  it('exports all demo records, rejects invalid references without mutation, and restores a valid snapshot', async () => {
    const { database, base } = await startApi();
    loadDemo(database);

    const originalResponse = await fetch(`${base}/backup`);
    const original = await originalResponse.json();
    expect(originalResponse.status).toBe(200);
    expect({ books: original.books.length, copies: original.copies.length, students: original.students.length, loans: original.loans.length })
      .toEqual({ books: 3, copies: 4, students: 3, loans: 3 });

    const invalid = structuredClone(original);
    invalid.copies[0].bookId = 'missing-book';
    const validation = await fetch(`${base}/backup/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: invalid }),
    });
    expect(validation.status).toBe(400);
    expect((await validation.json()).error.code).toBe('INVALID_BACKUP');
    expect(await (await fetch(`${base}/backup`)).json()).toEqual(original);

    const unconfirmed = await fetch(`${base}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: original, confirm: false }),
    });
    expect(unconfirmed.status).toBe(400);

    database.prepare('UPDATE settings SET libraryName=? WHERE id=1').run('שם זמני');
    const restored = await fetch(`${base}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: original, confirm: true }),
    });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ restored: true });
    expect(await (await fetch(`${base}/backup`)).json()).toEqual(original);
  });

  it('rolls back a failed restore transaction and preserves an existing database', async () => {
    const { database, base } = await startApi();
    loadDemo(database);
    const original = await (await fetch(`${base}/backup`)).json();
    const failingRestore = structuredClone(original);
    failingRestore.books.push({ id: 'forced-failure', title: 'ספר נוסף', ageGroup: 'א–ב' });
    database.exec(`
      CREATE TRIGGER reject_test_book BEFORE INSERT ON books
      WHEN NEW.id = 'forced-failure'
      BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;
    `);

    const response = await fetch(`${base}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: failingRestore, confirm: true }),
    });
    expect(response.status).toBe(500);
    expect(await (await fetch(`${base}/backup`)).json()).toEqual(original);
  });
});
