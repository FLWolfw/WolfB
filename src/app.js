import { Client, Collection, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import express from 'express';
import session from 'express-session';
import cron from 'node-cron';
import { loadCommands } from './handlers/commandLoader.js';
import { loadInteractions } from './handlers/interactions.js';
import loadEvents from './handlers/events.js';
import { registerCommands as registerSlashCommands } from './handlers/commandLoader.js';
import { createDatabase } from './utils/database.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import { appConfig } from './config/application.js';
import botConfig from './config/bot.js';
import { updateAllCounters, getServerCounters, updateCounter } from './services/counterService.js';
import { checkGiveaways } from './services/giveawayService.js';
import { checkBirthdays } from './services/birthdayService.js';

export class TitanBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildEmojisAndStickers,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
      ],
    });

    this.commands = new Collection();
    this.buttons = new Collection();
    this.selectMenus = new Collection();
    this.modals = new Collection();
    this.config = appConfig;
    this.db = null;
    this.startTime = Date.now();
  }

  async start() {
    try {
      startupLog('Initializing database...');
      this.db = await createDatabase();
      startupLog(`Database ready — ${this.db.type}`);

      startupLog('Loading commands...');
      await loadCommands(this);

      this.startWebServer();

      startupLog('Loading interactions...');
      await loadInteractions(this);

      startupLog('Loading events...');
      await loadEvents(this);

      startupLog('Logging into Discord...');
      await this.login(this.config.bot.token);

      startupLog('Registering slash commands globally...');
      await this.registerCommands();

      this.setupCronJobs();
    } catch (error) {
      logger.error('Failed to start bot:', error);
      shutdownLog('Bot startup failed');
      process.exit(1);
    }
  }

  startWebServer() {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
      secret: process.env.SESSION_SECRET || 'change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    }));

    app.get('/health', (req, res) => res.json({
      ok: true,
      bot: this.user ? this.user.tag : null,
      guilds: this.guilds.cache.size,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    }));

    app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.url}` }));

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, '0.0.0.0', () => {
      startupLog(`Web server listening on port ${PORT}`);
    });
  }

  setupCronJobs() {
    cron.schedule('0 6 * * *', () => checkBirthdays(this));
    cron.schedule('* * * * *', () => checkGiveaways(this));
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.updateAllCounters();
      } catch (err) {
        logger.error('Cron error — updateAllCounters failed', { error: err });
      }
    });

    logger.debug('Cron jobs scheduled (birthdays, giveaways, counters)');
  }

  async updateAllCounters() {
    for (const guild of this.guilds.cache.values()) {
      const counters = await getServerCounters(this, guild.id);
      for (const counter of counters) {
        await updateCounter(this, guild, counter);
      }
    }
  }

  async registerCommands() {
    // Wolf is a multi-server bot. Register slash commands globally so every
    // guild the bot is installed in receives the same command set. GUILD_ID
    // is intentionally not used for registration; guild-specific deployment
    // is useful for development but would hide commands from other servers.
    await registerSlashCommands(this, null);
  }
}

process.on('SIGTERM', () => {
  shutdownLog('Received SIGTERM — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  shutdownLog('Received SIGINT — shutting down gracefully');
  process.exit(0);
});

const bot = new TitanBot();
bot.start();
