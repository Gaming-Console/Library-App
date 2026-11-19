import express, { type ErrorRequestHandler } from 'express';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createApp(featureDirectory = resolve('server/features')) {
  const app = express();
  app.disable('x-powered-by');
  const hosts = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
  const origins = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
  // האפליקציה פועלת רק מול הדפדפן במחשב הזה: בודקים גם את הכתובת (נגד DNS rebinding) וגם את המקור (נגד אתרים אחרים).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (!hosts.test(req.headers.host ?? '') || (origin && !origins.test(origin))) {
      res.status(403).json({ error: { code: 'ORIGIN_DENIED', message: 'מקור הבקשה אינו מורשה' } });
      return;
    }
    // בקשת שינוי חייבת להיות JSON: כך אתר אחר לא יכול לשלוח אותה מתוך טופס רגיל.
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && hasBody && !req.is('application/json')) {
      res.status(415).json({ error: { code: 'UNSUPPORTED_TYPE', message: 'הבקשה חייבת להישלח כ־JSON' } });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  if (existsSync(featureDirectory)) {
    const entries = readdirSync(featureDirectory).filter((name) => /^\d{2}-[\w-]+\.ts$/.test(name)).sort();
    for (const entry of entries) {
      const feature: { default: express.Router } = await import(pathToFileURL(resolve(featureDirectory, entry)).href);
      app.use('/api', feature.default);
      console.log(`Loaded feature: ${entry}`);
    }
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'הפעולה המבוקשת לא קיימת' } }));
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist'), { index: 'index.html', maxAge: '1h' }));
  }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    console.error('Request failed', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'משהו השתבש בשמירה או בטעינה. נסי שוב; אם זה חוזר, בדקי את חלון השרת.' } });
  };
  app.use(errors);
  return app;
}
