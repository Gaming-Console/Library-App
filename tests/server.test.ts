import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../server/app';

let server: Server;
let base = '';
beforeAll(async () => {
  const app = await createApp('tests/no-feature-modules');
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

describe('empty local API', () => {
  it('exposes health, not a completed product', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(await response.json()).toEqual({ ok: true, mode: 'workshop-starter' });
  });
  it('returns an explicit 404 for business functions not yet implemented', async () => {
    const response = await fetch(`${base}/api/books`);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });
  it('rejects an unrelated browser origin', async () => {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://example.invalid' } });
    expect(response.status).toBe(403);
  });
});
