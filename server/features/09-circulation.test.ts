import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const databasePath = resolve('data/test-circulation.sqlite');
let server: Server;
let base = '';

beforeAll(async () => {
  vi.resetModules();
  if (existsSync(databasePath)) unlinkSync(databasePath);
  process.env.LIBRARY_DB = databasePath;
  const { db } = await import('../db');
  db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  db.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  const { createApp } = await import('../app');
  const app = await createApp();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  try {
    const { db } = await import('../db');
    db.close();
  } catch {
    // no-op in case the module was reset during earlier imports
  }
  if (existsSync(databasePath)) unlinkSync(databasePath);
});

describe('circulation flow', () => {
  it('shows a copy state and completes checkout and return', async () => {
    const scan = await fetch(`${base}/api/scan/LIB-000001`);
    expect(scan.status).toBe(200);
    const available = await scan.json();
    expect(available.activeLoan).toBeNull();

    const checkout = await fetch(`${base}/api/circulation/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'student-2', barcode: 'LIB-000001', borrowedOn: '2026-10-26' }),
    });
    expect(checkout.status).toBe(201);
    const loan = await checkout.json();
    expect(loan.loan.dueOn).toBe('2026-11-09');

    const postScan = await fetch(`${base}/api/scan/LIB-000001`);
    expect(postScan.status).toBe(200);
    const afterCheckout = await postScan.json();
    expect(afterCheckout.activeLoan?.studentId).toBe('student-2');

    const returned = await fetch(`${base}/api/circulation/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: 'LIB-000001', returnedOn: '2026-10-29' }),
    });
    expect(returned.status).toBe(200);
    const returnedPayload = await returned.json();
    expect(returnedPayload.loan.returnedOn).toBe('2026-10-29');

    const finalScan = await fetch(`${base}/api/scan/LIB-000001`);
    expect(finalScan.status).toBe(200);
    const emptyState = await finalScan.json();
    expect(emptyState.activeLoan).toBeNull();
    expect(emptyState.borrower).toBeNull();
  });

  it('rejects invalid input, duplicate checkout, and limit violations without mutating data', async () => {
    const unknownBarcode = await fetch(`${base}/api/scan/LIB-999999`);
    expect(unknownBarcode.status).toBe(404);

    const unknownStudent = await fetch(`${base}/api/circulation/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'student-missing', barcode: 'LIB-000002', borrowedOn: '2026-10-27' }),
    });
    expect(unknownStudent.status).toBe(404);

    const { db } = await import('../db');
    db.prepare('UPDATE settings SET maxActiveLoans = 1 WHERE id = 1').run();

    const limitResponse = await fetch(`${base}/api/circulation/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'student-1', barcode: 'LIB-000003', borrowedOn: '2026-10-27' }),
    });
    expect(limitResponse.status).toBe(409);

    const duplicate = await fetch(`${base}/api/circulation/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'student-2', barcode: 'LIB-000001', borrowedOn: '2026-10-28' }),
    });
    expect(duplicate.status).toBe(409);

    const earlyReturn = await fetch(`${base}/api/circulation/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: 'LIB-000002', returnedOn: '2026-10-18' }),
    });
    expect(earlyReturn.status).toBe(409);
  });
});
