import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BookDetails } from '../../src/shared/types';

let server: Server;
let base = '';
let directory = '';
let closeDb: () => void;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'book04-'));
  process.env.LIBRARY_DB = join(directory, 'test.sqlite');
  const { db } = await import('../db');
  db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  db.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  closeDb = () => db.close();
  const router = (await import('./04-book')).default;
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listener');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb();
  rmSync(directory, { recursive: true, force: true });
});

const get = async (id: string) => fetch(`${base}/api/books/${id}`);
const patch = (id: string, body: unknown) => fetch(`${base}/api/books/${id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('GET /books/:id', () => {
  it('book-1 has two copies: one available and one borrowed by Tamar', async () => {
    const details = await (await get('book-1')).json() as BookDetails;
    expect(details.copies).toHaveLength(2);
    const available = details.copies.filter((c) => c.activeLoan === null);
    const borrowed = details.copies.filter((c) => c.activeLoan !== null);
    expect(available).toHaveLength(1);
    expect(borrowed).toHaveLength(1);
    expect(borrowed[0].borrower?.fullName).toContain('תמר');
  });
  it('book-3 is available despite a historical loan', async () => {
    const details = await (await get('book-3')).json() as BookDetails;
    expect(details.copies).toHaveLength(1);
    expect(details.copies[0].activeLoan).toBeNull();
    expect(details.copies[0].borrower).toBeNull();
  });
  it('returns 404 for an unknown id', async () => {
    const response = await get('nope');
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /books/:id', () => {
  it('saves the new title without changing ids or barcodes', async () => {
    const before = await (await get('book-1')).json() as BookDetails;
    const response = await patch('book-1', { title: ' שם חדש ', ageGroup: 'ה–ו' });
    expect(response.status).toBe(200);
    expect((await response.json()).book).toEqual({ id: 'book-1', title: 'שם חדש', ageGroup: 'ה–ו' });
    const after = await (await get('book-1')).json() as BookDetails;
    expect(after.book.title).toBe('שם חדש');
    expect(after.copies.map((c) => [c.copy.id, c.copy.barcode])).toEqual(before.copies.map((c) => [c.copy.id, c.copy.barcode]));
  });
  it('rejects empty or invalid fields with 400', async () => {
    for (const body of [{ title: '  ', ageGroup: 'א' }, { title: 'x', ageGroup: '' }, { title: 'x' }, {}]) {
      expect((await patch('book-2', body)).status).toBe(400);
    }
  });
  it('returns 404 for an unknown id', async () => {
    expect((await patch('nope', { title: 'x', ageGroup: 'y' })).status).toBe(404);
  });
});
