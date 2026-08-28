import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import express from 'express';
import cron from 'node-cron';
import { loadCommands } from './handlers/commandLoader.js';
import loadInteractions from './handlers/interactions.js';
import loadEvents from './handlers/events.js';
import { initializeDatabase } from './utils/database.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import appConfig from './config/application.js';
import { checkGiveaways } from './services/giveawayService.js';
import { checkBirthdays } from './services/birthdayService.js';
import { setupDashboard } from './dashboard/index.js';
import { finishAuthorization } from './services/spotifyService.js';

export class TitanBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildEmojisAndStickers,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
    });
    this.commands = new Collection(); this.buttons = new Collection(); this.selectMenus = new Collection(); this.modals = new Collection();
    this.config = appConfig; this.db = null; this.startTime = Date.now();
  }
  async start() {
    try {
      startupLog('Initializing database...'); const databaseResult = await initializeDatabase(); this.db = databaseResult.db;
      startupLog(`Database ready — ${this.db.getConnectionType()}`); startupLog('Loading commands...'); await loadCommands(this);
      this.startWebServer(); startupLog('Loading interactions...'); await loadInteractions(this); startupLog('Loading events...'); await loadEvents(this);
      startupLog('Logging into Discord...'); await this.login(this.config.bot.token); startupLog('Registering slash commands globally...'); await this.registerCommands(); this.setupCronJobs();
    } catch (error) { logger.error('Failed to start bot:', error); shutdownLog('Bot startup failed'); process.exit(1); }
  }
  startWebServer() {
    const app = express(); app.set('trust proxy', 1); app.use(express.json());
    app.get('/health', (req, res) => res.json({ ok: true, bot: this.user ? this.user.tag : null, guilds: this.guilds.cache.size, uptime: Math.floor((Date.now() - this.startTime) / 1000) }));
    app.get('/spotify/callback', async (req, res) => {
      const { code, state, error } = req.query;
      if (error) return res.status(400).send(`<h2>Spotify authorization cancelled</h2><p>${escapeHtml(error)}</p>`);
      if (!code || !state) return res.status(400).send('<h2>Spotify authorization failed</h2><p>Missing code or state.</p>');
      try {
        const result = await finishAuthorization(this.db, String(code), String(state));
        const name = result.profile?.display_name || result.profile?.id || 'Spotify';
        return res.send(`<h2>Spotify connected successfully</h2><p>Connected account: <strong>${escapeHtml(name)}</strong></p><p>You can close this window and return to Discord.</p>`);
      } catch (err) {
        logger.error('Spotify OAuth callback failed', { error: err?.message });
        return res.status(500).send(`<h2>Spotify connection failed</h2><p>${escapeHtml(err?.message || err)}</p><p>Run /spotify connect again.</p>`);
      }
    });
    setupDashboard(app, this); app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.url}` }));
    const PORT = process.env.PORT || 3000; app.listen(PORT, '0.0.0.0', () => startupLog(`Web server listening on port ${PORT}`));
  }
  setupCronJobs() { cron.schedule('0 6 * * *', () => checkBirthdays(this)); cron.schedule('* * * * *', () => checkGiveaways(this)); logger.debug('Cron jobs scheduled (birthdays, giveaways)'); }
  async registerCommands() {
    if (!this.application) throw new Error('Discord application is not available after login; cannot register global commands.');
    const commands = []; const names = new Set();
    for (const command of this.commands.values()) { if (!command?.data || typeof command.data.toJSON !== 'function') continue; const commandJson = command.data.toJSON(); if (!commandJson.name || names.has(commandJson.name)) continue; names.add(commandJson.name); commands.push(commandJson); }
    if (commands.length > 100) throw new Error(`Cannot register ${commands.length} global commands: Discord allows a maximum of 100 top-level commands.`);
    startupLog(`Global registration: sending ${commands.length} commands to Discord...`); startupLog(`Global registration: antispam local=${names.has('antispam')}`);
    const registered = await this.application.commands.set(commands); startupLog(`Global registration: Discord accepted ${registered.size} commands.`);
    const verified = await this.application.commands.fetch(); const verifiedNames = new Set(verified.map(command => command.name));
    startupLog(`Global registration: Discord currently exposes ${verified.size} global commands.`); startupLog(`Global registration: antispam discord=${verifiedNames.has('antispam')}`);
    if (names.has('antispam') && !verifiedNames.has('antispam')) throw new Error("Discord did not return the global 'antispam' command after registration.");
  }
}
function escapeHtml(value) { return String(value).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c])); }
process.on('SIGTERM', () => { shutdownLog('Received SIGTERM — shutting down gracefully'); process.exit(0); }); process.on('SIGINT', () => { shutdownLog('Received SIGINT — shutting down gracefully'); process.exit(0); });
const bot = new TitanBot(); bot.start();