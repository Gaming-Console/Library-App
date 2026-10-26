import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { createLoansRouter } from './11-loans';
import { openDatabase } from '../db';

const database = openDatabase(null);
database.exec(readFileSync('fixtures/schema.sql', 'utf8'));
database.exec(readFileSync('fixtures/demo.sql', 'utf8'));
const app = express();
app.use('/api', createLoansRouter(database));

let server: Server;
let base = '';
beforeAll(async () => {
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

async function getLoans(params = '') {
  const response = await fetch(`${base}/api/loans${params}`);
  return { response, body: await response.json() as { items: Array<{ loan: { id: string; returnedOn: string | null }; overdue: boolean; student: { fullName: string; className: string }; book: { title: string } }> } };
}

describe('GET /loans', () => {
  it('defaults to active loans and identifies only the overdue active loan for the supplied day', async () => {
    const { body } = await getLoans('?today=2026-10-26');
    expect(body.items).toHaveLength(2);
    expect(body.items.filter((item) => item.overdue).map((item) => item.loan.id)).toEqual(['loan-2']);
  });

  it('does not include returned loans in overdue results and includes history in all', async () => {
    const overdue = await getLoans('?status=overdue&today=2026-10-26');
    expect(overdue.body.items.map((item) => item.loan.id)).toEqual(['loan-2']);
    const all = await getLoans('?status=all&today=2026-10-26');
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items.find((item) => item.loan.id === 'loan-3')).toMatchObject({
      loan: { returnedOn: '2026-09-10' }, overdue: false,
    });
  });

  it('combines class and search filters', async () => {
    const result = await getLoans(`?today=2026-10-26&status=all&className=${encodeURIComponent('ד1')}&q=${encodeURIComponent('הנעלם')}`);
    expect(result.body.items).toHaveLength(1);
    expect(result.body.items[0]).toMatchObject({
      student: { className: 'ד1' }, book: { title: 'מסע אל האי הנעלם' },
    });
  });

  it('returns a structured validation error for an invalid date', async () => {
    const { response, body } = await getLoans('?today=2026-02-30');
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });

  it('returns one structured error for repeated query parameters', async () => {
    const { response, body } = await getLoans('?status=all&status=active');
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });
});