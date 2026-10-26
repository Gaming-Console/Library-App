import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { BookInput } from '../../src/shared/types';
import { createAddBooks, createIntakeRouter } from './02-intake';
import { openDatabase } from '../db';

let database: ReturnType<typeof openDatabase>;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  database = openDatabase(null);
  database.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  const app = express();
  app.use(express.json());
  app.use('/api', createIntakeRouter(database));
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
});

async function postBooks(items: unknown) {
  return fetch(`${baseUrl}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

function counts() {
  return {
    books: database.prepare('SELECT count(*) AS count FROM books').get()?.count,
    copies: database.prepare('SELECT count(*) AS count FROM copies').get()?.count,
  };
}

describe('book intake', () => {
  it('creates one book and three unique copies with consecutive barcodes', async () => {
    const response = await postBooks([{ title: 'הגינה הסודית', ageGroup: 'ה–ו', quantity: 3 }]);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.copyIds).toHaveLength(3);
    expect(result.copies.map((copy: { barcode: string }) => copy.barcode)).toEqual([
      'LIB-000001', 'LIB-000002', 'LIB-000003',
    ]);
    expect(new Set(result.copyIds).size).toBe(3);
    expect(counts()).toEqual({ books: 1, copies: 3 });
  });

  it('adds copies to a selected book without changing its details or creating another book', async () => {
    database.prepare('INSERT INTO books (id, title, ageGroup) VALUES (?, ?, ?)').run('existing', 'כותר מקורי', 'ג–ד');
    const response = await postBooks([{
      title: 'שם שאסור לעדכן', ageGroup: 'א–ב', quantity: 2, targetBookId: 'existing',
    }]);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.copies.every((copy: { bookId: string }) => copy.bookId === 'existing')).toBe(true);
    expect(database.prepare('SELECT title, ageGroup FROM books WHERE id = ?').get('existing')).toEqual({
      title: 'כותר מקורי', ageGroup: 'ג–ד',
    });
    expect(counts()).toEqual({ books: 1, copies: 2 });
  });

  it.each([
    ['zero quantity', [{ title: 'ספר', ageGroup: 'א–ב', quantity: 0 }]],
    ['fractional quantity', [{ title: 'ספר', ageGroup: 'א–ב', quantity: 1.5 }]],
    ['invalid later row', [
      { title: 'תקין', ageGroup: 'א–ב', quantity: 1 },
      { title: 'לא תקין', ageGroup: 'א–ב', quantity: 101 },
    ]],
    ['empty request', []],
  ])('rejects %s without partial writes', async (_name, items) => {
    const response = await postBooks(items);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');
    expect(counts()).toEqual({ books: 0, copies: 0 });
  });

  it('allocates new barcodes on sequential requests', async () => {
    const first = await postBooks([{ title: 'ראשון', ageGroup: 'א–ב', quantity: 1 }]);
    const second = await postBooks([{ title: 'שני', ageGroup: 'ג–ד', quantity: 2 }]);

    expect((await first.json()).copies[0].barcode).toBe('LIB-000001');
    expect((await second.json()).copies.map((copy: { barcode: string }) => copy.barcode)).toEqual([
      'LIB-000002', 'LIB-000003',
    ]);
  });

  it('rejects unknown target books and over-limit requests without writing', async () => {
    const missingBook = await postBooks([{
      title: 'ספר', ageGroup: 'א–ב', quantity: 1, targetBookId: 'missing',
    }]);
    expect(missingBook.status).toBe(404);
    expect((await missingBook.json()).error.code).toBe('BOOK_NOT_FOUND');

    const tooMany = await postBooks([{ title: 'ספר', ageGroup: 'א–ב', quantity: 100 }]);
    expect(tooMany.status).toBe(201);
    const tooManyRows = Array.from({ length: 6 }, (_, index): BookInput => ({
      title: `ספר ${index}`, ageGroup: 'א–ב', quantity: 100,
    }));
    const overflow = await postBooks(tooManyRows);
    expect(overflow.status).toBe(400);
    expect((await overflow.json()).error.code).toBe('INVALID_INPUT');
  });

  it('rolls back all rows if barcode space is exhausted', () => {
    database.prepare('INSERT INTO books (id, title, ageGroup) VALUES (?, ?, ?)').run('last', 'אחרון', 'א–ב');
    database.prepare('INSERT INTO copies (id, bookId, barcode) VALUES (?, ?, ?)').run(
      'last-copy', 'last', 'LIB-999999',
    );
    const addBooks = createAddBooks(database);
    const items: BookInput[] = [
      { title: 'חדש', ageGroup: 'ג–ד', quantity: 1 },
      { title: 'חדש נוסף', ageGroup: 'ה–ו', quantity: 1 },
    ];

    expect(() => addBooks(items)).toThrow('טווח הברקודים הסתיים');
    expect(counts()).toEqual({ books: 1, copies: 1 });
  });
});
