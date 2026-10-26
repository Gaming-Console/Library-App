import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { openDatabase } from '../db';
import { createCatalogRouter } from './03-catalog';

const db = openDatabase(null);
db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
db.exec(readFileSync('fixtures/demo.sql', 'utf8'));

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use('/api', createCatalogRouter(db));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

const get = async (path: string) => {
  const response = await fetch(`${base}/api${path}`);
  return { status: response.status, body: await response.json() };
};
const ids = (items: { book: { id: string } }[]) => items.map((i) => i.book.id);

describe('GET /books', () => {
  it('shows the island book once with 2 copies, 1 available', async () => {
    const { body } = await get('/books?q=' + encodeURIComponent('מסע'));
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ book: { id: 'book-1' }, totalCopies: 2, availableCopies: 1 });
  });
  it('finds a book by exact barcode', async () => {
    expect(ids((await get('/books?q=LIB-000002')).body.items)).toEqual(['book-1']);
  });
  it('does not match a partial barcode', async () => {
    expect((await get('/books?q=LIB-00000')).body.items).toEqual([]);
  });
  it('availableOnly hides fully borrowed books', async () => {
    expect(ids((await get('/books')).body.items)).toContain('book-2');
    expect(ids((await get('/books?availableOnly=true')).body.items)).not.toContain('book-2');
  });
  it('filters by age group and returns an empty list for no match', async () => {
    expect(ids((await get('/books?ageGroup=' + encodeURIComponent('א–ב'))).body.items)).toEqual(['book-3']);
    expect((await get('/books?q=nothing-here')).body.items).toEqual([]);
  });
  it('treats SQL and LIKE characters as plain text', async () => {
    expect((await get('/books?q=' + encodeURIComponent("' OR 1=1 --"))).body.items).toEqual([]);
    expect((await get('/books?q=%25')).body.items).toEqual([]);
  });
  it('rejects invalid parameters', async () => {
    expect((await get('/books?availableOnly=maybe')).status).toBe(400);
    expect((await get('/books?q=a&q=b')).status).toBe(400);
  });
});

describe('GET /copies', () => {
  it('lists copies with active loan and borrower', async () => {
    const { body } = await get('/copies?bookId=book-1');
    expect(body.items).toHaveLength(2);
    const borrowed = body.items.filter((i: { activeLoan: unknown }) => i.activeLoan);
    expect(borrowed).toHaveLength(1);
    expect(borrowed[0].borrower).not.toBeNull();
  });
  it('lists all copies without bookId and nothing for an unknown book', async () => {
    expect((await get('/copies')).body.items).toHaveLength(4);
    expect((await get('/copies?bookId=nope')).body.items).toEqual([]);
  });
});
