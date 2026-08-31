import express from 'express';
import { listBots, addBot, removeBot, updateBot, ensureMultibotSchema } from '../../services/multibotService.js';
import { ensureCsrfToken } from '../lib/csrf.js';
import { requireLogin } from '../middleware/auth.js';
import { renderMultibot } from '../views/multibotPage.js';

export function multibotRoutes(client) {
  const router = express.Router();
  let schemaReady;

  async function ensureSchema() {
    if (!schemaReady) {
      schemaReady = ensureMultibotSchema(client.db).catch((error) => {
        schemaReady = null;
        throw error;
      });
    }
    return schemaReady;
  }

  router.get('/bots', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const bots = await listBots(client.db, req.session.user.id);
      res.send(renderMultibot({ user: req.session.user, bots, csrf: ensureCsrfToken(req) }));
    } catch (error) {
      console.error('[multibot] Failed to load bots:', error?.message || error);
      res.status(500).send('Error cargando tus bots.');
    }
  });

  router.get('/api/multibot', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      res.json({ bots: await listBots(client.db, req.session.user.id) });
    } catch (error) {
      console.error('[multibot] Failed to list bots:', error?.message || error);
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
      if (error?.code === '23505') return res.status(409).json({ error: 'bot_already_added' });
      console.error('[multibot] Failed to add bot:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.patch('/api/multibot/:id', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : {};
      const bot = await updateBot(client.db, req.session.user.id, req.params.id, { settings });
      if (!bot) return res.status(404).json({ error: 'not_found' });
      res.json({ bot });
    } catch (error) {
      console.error('[multibot] Failed to update bot:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.delete('/api/multibot/:id', requireLogin, async (req, res) => {
    try {
      await ensureSchema();
      res.json({ removed: await removeBot(client.db, req.session.user.id, req.params.id) });
    } catch (error) {
      console.error('[multibot] Failed to remove bot:', error?.message || error);
      res.status(500).json({ error: 'database_error' });
    }
  });

  return router;
}
