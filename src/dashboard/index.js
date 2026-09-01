import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { createSessionMiddleware, securityHeaders } from './lib/security.js';
import { csrfProtection } from './lib/csrf.js';
import { authRoutes } from './routes/auth.js';
import { pageRoutes } from './routes/pages.js';
import { apiRoutes } from './routes/api.js';
import { antiSpamRoutes } from './routes/antiSpam.js';
import { multibotRoutes } from './routes/multibot.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function setupDashboard(app, client) {
  app.set('trust proxy', 1);
  app.use(express.urlencoded({ extended: true, limit: '32kb' }));
  app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true }));
  app.use(createSessionMiddleware());
  app.use(securityHeaders);
  app.use(csrfProtection);
  app.use('/', authRoutes());
  app.use('/', antiSpamRoutes(client));
  app.use('/', pageRoutes(client));
  app.use('/', multibotRoutes(client, client.multibotManager));
  app.use('/api', apiRoutes(client));
  logger.info('Wolf dashboard mounted (/, /dashboard, /server/:id, /server/:id/antispam, /bots, /api)');
}
