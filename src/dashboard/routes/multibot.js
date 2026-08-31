import express from 'express';
import { listBots, addBot, removeBot, updateBot, ensureMultibotSchema, getBot } from '../../services/multibotService.js';
import { ensureCsrfToken } from '../lib/csrf.js';
import { requireLogin } from '../middleware/auth.js';
import { renderMultibot } from '../views/multibotPage.js';
import { renderMultibotConfig } from '../views/multibotConfigPage.js';

export function multibotRoutes(client, manager) {
  const router = express.Router();
  let schemaPromise = null;

  async function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = ensureMultibotSchema(client.db).catch((error) => {
        schemaPromise = null;
        throw error;
      });
    }
    await schemaPromise;
  }

  router.get('/bots', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bots = await listBots(client.db, req.session.user.id);
      res.send(renderMultibot({ user: req.session.user, bots, csrf: ensureCsrfToken(req) }));
    } catch (error) {
      console.error('[multibot] GET /bots failed:', error?.message || error);
      res.status(500).send('Error cargando tus bots.');
    }
  });

  router.get('/bots/:id', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bot = await getBot(client.db, req.session.user.id, req.params.id);
      if (!bot) return res.status(404).send('Bot no encontrado.');
      res.send(renderMultibotConfig({ user: req.session.user, bot, csrf: ensureCsrfToken(req) }));
    } catch (error) {
      console.error(`[multibot] GET /bots/${req.params.id} failed:`, error?.message || error);
      res.status(500).send('Error cargando la configuración del bot.');
    }
  });

  router.get('/api/multibot', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      res.json({ bots: await listBots(client.db, req.session.user.id) });
    } catch (error) {
      console.error('[multibot] GET /api/multibot failed:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.post('/api/multibot', requireLogin, async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });
    try {
      await ensureSchema();
      const response = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` } });
      if (!response.ok) return res.status(400).json({ error: 'invalid_bot_token' });
      const user = await response.json();
      if (!user.bot) return res.status(400).json({ error: 'not_a_bot_user' });
      const bot = await addBot(client.db, { ownerId: req.session.user.id, botUserId: user.id, botUsername: user.username, token });
      res.status(201).json({ bot });
    } catch (error) {
      console.error('[multibot] POST /api/multibot failed:', error?.message || error);
      if (error?.code === '23505') return res.status(409).json({ error: 'bot_already_added' });
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.post('/api/multibot/:id/start', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bot = await getBot(client.db, req.session.user.id, req.params.id);
      if (!bot) return res.status(404).json({ error: 'not_found' });
      await manager.start(bot);
      res.json({ ok: true, status: 'online' });
    } catch (error) {
      console.error(`[multibot] start ${req.params.id} failed:`, error?.message || error);
      res.status(400).json({ error: 'start_failed', message: error?.message || 'No se pudo iniciar el bot.' });
    }
  });

  router.post('/api/multibot/:id/stop', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bot = await getBot(client.db, req.session.user.id, req.params.id);
      if (!bot) return res.status(404).json({ error: 'not_found' });
      await manager.stop(bot);
      res.json({ ok: true, status: 'offline' });
    } catch (error) {
      console.error(`[multibot] stop ${req.params.id} failed:`, error?.message || error);
      res.status(500).json({ error: 'stop_failed' });
    }
  });

  router.patch('/api/multibot/:id', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : {};
      const bot = await updateBot(client.db, req.session.user.id, req.params.id, { settings });
      if (!bot) return res.status(404).json({ error: 'not_found' });
      if (manager) {
        await manager.applySettings(bot).catch((error) => {
          console.error(`[multibot] apply settings ${req.params.id} failed:`, error?.message || error);
        });
      }
      res.json({ bot });
    } catch (error) {
      console.error('[multibot] PATCH /api/multibot failed:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.delete('/api/multibot/:id', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bot = await getBot(client.db, req.session.user.id, req.params.id);
      if (bot) await manager.stop(bot);
      res.json({ removed: await removeBot(client.db, req.session.user.id, req.params.id) });
    } catch (error) {
      console.error('[multibot] DELETE /api/multibot failed:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });
  return router;
}
