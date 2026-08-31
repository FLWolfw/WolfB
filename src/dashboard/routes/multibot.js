import express from 'express';
import { makeRequireOwner } from '../../middleware/auth.js';
import { listBots, addBot, removeBot, updateBot } from '../../services/multibotService.js';

export function multibotRoutes(client) {
  const router = express.Router();
  router.get('/api/multibot', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'login_required' });
    try { res.json({ bots: await listBots(client.db, req.session.user.id) }); }
    catch (error) { res.status(500).json({ error: 'database_error' }); }
  });

  router.post('/api/multibot', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'login_required' });
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token_required' });
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` } });
      if (!response.ok) return res.status(400).json({ error: 'invalid_bot_token' });
      const user = await response.json();
      const bot = await addBot(client.db, { ownerId: req.session.user.id, botUserId: user.id, botUsername: user.username, token });
      res.status(201).json({ bot });
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ error: 'bot_already_added' });
      res.status(500).json({ error: 'database_error' });
    }
  });

  router.patch('/api/multibot/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'login_required' });
    try {
      const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : {};
      const bot = await updateBot(client.db, req.session.user.id, req.params.id, { settings });
      if (!bot) return res.status(404).json({ error: 'not_found' });
      res.json({ bot });
    } catch { res.status(500).json({ error: 'database_error' }); }
  });

  router.delete('/api/multibot/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'login_required' });
    try { res.json({ removed: await removeBot(client.db, req.session.user.id, req.params.id) }); }
    catch { res.status(500).json({ error: 'database_error' }); }
  });
  return router;
}
