import express, { type ErrorRequestHandler } from 'express';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createApp(featureDirectory = resolve('server/features')) {
  const app = express();
  // Local binding alone does not prevent cross-origin browser requests.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'];
    if (origin && !allowed.includes(origin)) {
      res.status(403).json({ error: { code: 'ORIGIN_DENIED', message: 'מקור הבקשה אינו מורשה' } });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'workshop-starter' }));
  if (existsSync(featureDirectory)) {
    const entries = readdirSync(featureDirectory).filter((name) => /^\d{2}-[\w-]+\.ts$/.test(name)).sort();
    for (const entry of entries) {
      const feature: { default: express.Router } = await import(pathToFileURL(resolve(featureDirectory, entry)).href);
      app.use('/api', feature.default);
      console.log(`Loaded feature: ${entry}`);
    }
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'הפעולה אינה קיימת או טרם נבנתה' } }));
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist')));
    app.get('/', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    console.error('Request failed', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'הפעולה נכשלה בשרת. בדקי את חלון השרת לפני ניסיון נוסף.' } });
  };
  app.use(errors);
  return app;
}
