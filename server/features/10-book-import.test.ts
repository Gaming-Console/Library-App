import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookInput } from '../../src/shared/types';
import { createBookImportRouter } from './10-book-import';

let server: Server;
let base = '';
let received: BookInput[][] = [];

async function start(resolveAddBooks: () => Promise<(items: BookInput[]) => string[]>) {
  const app = express();
  app.use(express.json());
  app.use('/api', createBookImportRouter(resolveAddBooks));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
}

beforeEach(async () => {
  received = [];
  await start(async () => (items) => {
    received.push(items);
    return items.flatMap((item, index) => Array.from({ length: item.quantity }, (_, copy) => `copy-${index}-${copy}`));
  });
});

afterEach(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

describe('POST /imports/books', () => {
  it('delegates all copies to addBooks and returns the created copy IDs', async () => {
    const response = await fetch(`${base}/api/imports/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ title: ' ספר ', ageGroup: ' ג–ד ', quantity: 3, targetBookId: 'book-1' }] }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ copyIds: ['copy-0-0', 'copy-0-1', 'copy-0-2'] });
    expect(received).toEqual([[{ title: 'ספר', ageGroup: 'ג–ד', quantity: 3, targetBookId: 'book-1' }]]);
  });

  it('rejects missing fields, fractional quantities, and totals above 500', async () => {
    const invalidBodies = [
      { items: [{ title: 'ספר', ageGroup: 'ג–ד', quantity: 1.5 }] },
      { items: [{ title: '', ageGroup: 'ג–ד', quantity: 1 }] },
      { items: Array.from({ length: 6 }, () => ({ title: 'ספר', ageGroup: 'ג–ד', quantity: 100 })) },
    ];
    for (const body of invalidBodies) {
      const response = await fetch(`${base}/api/imports/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_INPUT');
    }
    expect(received).toEqual([]);
  });

  it('does not claim success before the intake dependency is available', async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await start(async () => { throw new Error('task 02 is not merged'); });
    const response = await fetch(`${base}/api/imports/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ title: 'ספר', ageGroup: 'ג–ד', quantity: 1 }] }),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});