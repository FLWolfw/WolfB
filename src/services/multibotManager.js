import { Client, GatewayIntentBits, Partials, ActivityType, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getStoredToken, updateBot } from './multibotService.js';

const ACTIVITY_TYPES = { Playing: ActivityType.Playing, Listening: ActivityType.Listening, Watching: ActivityType.Watching, Competing: ActivityType.Competing };
const PRESENCE_STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);
const IMAGE_VALUE = /^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i;

function cleanName(value, fallback) {
  const name = String(value ?? '').trim().slice(0, 32);
  return name || fallback;
}

function profileKey(settings, botRecord, instance) {
  const name = cleanName(settings.name, botRecord.bot_username || instance.user.username);
  return JSON.stringify({ name, avatarUrl: String(settings.avatarUrl || '').trim(), bannerUrl: String(settings.bannerUrl || '').trim() });
}

export class MultibotManager {
  constructor(ownerClient) {
    this.ownerClient = ownerClient;
    this.instances = new Map();
    this.starting = new Map();
    this.applying = new Map();
    this.appliedProfiles = new Map();
  }

  async restoreOnlineBots() {
    const pool = this.ownerClient.db?.db?.pool || this.ownerClient.db?.pool || this.ownerClient.db?.db;
    if (!pool || typeof pool.query !== 'function') throw new Error('PostgreSQL query interface is unavailable.');
    const { rows } = await pool.query('SELECT * FROM bot_instances WHERE status=$1 ORDER BY id ASC', ['online']);
    logger.info(`[multibot] Restoring ${rows.length} online bot instance(s) after engine restart`);
    for (const bot of rows) {
      try {
        await this.start(bot);
      } catch (error) {
        logger.error(`[multibot] Failed to restore instance ${bot.id}: ${error?.message || error}`);
        try { await updateBot(this.ownerClient.db, bot.owner_id, bot.id, { status: 'offline' }); } catch {}
      }
    }
  }

  async start(botRecord) {
    const id = Number(botRecord.id);
    if (this.instances.has(id)) {
      await this.applySettings(botRecord);
      return this.instances.get(id);
    }
    if (this.starting.has(id)) return this.starting.get(id);
    const promise = this.#startInternal(botRecord).finally(() => this.starting.delete(id));
    this.starting.set(id, promise);
    return promise;
  }

  async #startInternal(botRecord) {
    const id = Number(botRecord.id);
    const token = getStoredToken(botRecord);
    const instance = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates], partials: [Partials.Channel] });
    instance.once('ready', async () => {
      this.instances.set(id, instance);
      try {
        await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'online' });
        logger.info(`[multibot] ${instance.user.tag} is online (instance ${id})`);
        await this.applySettings(botRecord, { forceProfile: true });
      } catch (error) {
        logger.error(`[multibot] Failed to initialize instance ${id}: ${error?.message || error}`);
      }
    });
    instance.on('error', async (error) => {
      logger.error(`[multibot] Discord client error for ${id}: ${error?.message || error}`);
      if (this.instances.get(id) === instance) {
        this.instances.delete(id);
        this.appliedProfiles.delete(id);
        try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {}
      }
    });
    try {
      await instance.login(token);
      return instance;
    } catch (error) {
      try { instance.destroy(); } catch {}
      try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {}
      throw error;
    }
  }

  async applySettings(botRecord, { forceProfile = false } = {}) {
    const id = Number(botRecord.id);
    const instance = this.instances.get(id);
    if (!instance?.user) return false;
    if (this.applying.has(id)) return this.applying.get(id);
    const run = this.#applySettingsInternal(botRecord, { forceProfile }).finally(() => this.applying.delete(id));
    this.applying.set(id, run);
    return run;
  }

  async #applySettingsInternal(botRecord, { forceProfile }) {
    const id = Number(botRecord.id);
    const instance = this.instances.get(id);
    const settings = botRecord.settings || {};
    const name = cleanName(settings.name, botRecord.bot_username || instance.user.username);
    const status = PRESENCE_STATUSES.has(settings.presenceStatus) ? settings.presenceStatus : 'online';
    const activityType = ACTIVITY_TYPES[settings.activityType] ?? ActivityType.Playing;
    const activityText = String(settings.activityText || '').trim().slice(0, 128);
    const key = profileKey(settings, botRecord, instance);
    if (forceProfile || this.appliedProfiles.get(id) !== key) {
      const body = {};
      if (name && instance.user.username !== name) body.username = name;
      const avatarUrl = String(settings.avatarUrl || '').trim();
      const bannerUrl = String(settings.bannerUrl || '').trim();
      if (avatarUrl && IMAGE_VALUE.test(avatarUrl)) body.avatar = avatarUrl;
      if (bannerUrl && IMAGE_VALUE.test(bannerUrl)) body.banner = bannerUrl;
      if (Object.keys(body).length) {
        try {
          await instance.rest.patch(Routes.user(), { body });
          this.appliedProfiles.set(id, key);
          logger.info(`[multibot] Discord profile updated for instance ${id}`);
        } catch (error) {
          logger.error(`[multibot] Failed to update Discord profile for ${id}: ${error?.message || error}`);
        }
      } else this.appliedProfiles.set(id, key);
    }
    instance.user.setPresence(activityText ? { status, activities: [{ name: activityText, type: activityType }] } : { status, activities: [] });
    return true;
  }

  async stop(botRecord) {
    const id = Number(botRecord.id);
    const instance = this.instances.get(id);
    if (!instance) {
      await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' });
      return false;
    }
    this.instances.delete(id);
    this.appliedProfiles.delete(id);
    this.applying.delete(id);
    try { instance.destroy(); } finally { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); }
    return true;
  }

  get(id) { return this.instances.get(Number(id)) || null; }

  async shutdown() {
    const entries = [...this.instances.entries()];
    this.instances.clear();
    this.appliedProfiles.clear();
    this.applying.clear();
    await Promise.all(entries.map(async ([id, instance]) => { try { instance.destroy(); } catch {} }));
  }
}
