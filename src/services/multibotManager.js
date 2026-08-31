import { Client, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getStoredToken, updateBot } from './multibotService.js';

const ACTIVITY_TYPES = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
};

const PRESENCE_STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);
const IMAGE_VALUE = /^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i;

function cleanName(value, fallback) {
  const name = String(value ?? '').trim().slice(0, 32);
  return name || fallback;
}

export class MultibotManager {
  constructor(ownerClient) {
    this.ownerClient = ownerClient;
    this.instances = new Map();
    this.starting = new Map();
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
    const instance = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      partials: [Partials.Channel],
    });

    instance.once('ready', async () => {
      this.instances.set(id, instance);
      try {
        await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'online' });
        logger.info(`[multibot] ${instance.user.tag} is online (instance ${id})`);
        await this.applySettings(botRecord);
      } catch (error) {
        logger.error(`[multibot] Failed to initialize instance ${id}: ${error?.message || error}`);
      }
    });

    instance.on('error', async (error) => {
      logger.error(`[multibot] Discord client error for ${id}: ${error?.message || error}`);
      if (this.instances.get(id) === instance) {
        this.instances.delete(id);
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

  async applySettings(botRecord) {
    const instance = this.instances.get(Number(botRecord.id));
    if (!instance?.user) return false;

    const settings = botRecord.settings || {};
    const name = cleanName(settings.name, botRecord.bot_username || instance.user.username);
    const status = PRESENCE_STATUSES.has(settings.presenceStatus) ? settings.presenceStatus : 'online';
    const activityType = ACTIVITY_TYPES[settings.activityType] ?? ActivityType.Playing;
    const activityText = String(settings.activityText || '').trim().slice(0, 128);

    if (name && instance.user.username !== name) {
      try { await instance.user.setUsername(name); }
      catch (error) { logger.error(`[multibot] Failed to set username for ${botRecord.id}: ${error?.message || error}`); }
    }

    instance.user.setPresence(activityText
      ? { status, activities: [{ name: activityText, type: activityType }] }
      : { status, activities: [] });

    const avatarUrl = String(settings.avatarUrl || '').trim();
    if (avatarUrl && IMAGE_VALUE.test(avatarUrl)) {
      try { await instance.user.setAvatar(avatarUrl); }
      catch (error) { logger.error(`[multibot] Failed to set avatar for ${botRecord.id}: ${error?.message || error}`); }
    }

    const bannerUrl = String(settings.bannerUrl || '').trim();
    if (bannerUrl && IMAGE_VALUE.test(bannerUrl)) {
      try {
        await instance.user.setBanner(bannerUrl);
      } catch (error) {
        logger.error(`[multibot] Failed to set banner for ${botRecord.id}: ${error?.message || error}`);
      }
    }

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
    try { instance.destroy(); } finally {
      await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' });
    }
    return true;
  }

  get(id) {
    return this.instances.get(Number(id)) || null;
  }

  async shutdown() {
    const entries = [...this.instances.entries()];
    this.instances.clear();
    await Promise.all(entries.map(async ([id, instance]) => {
      try { instance.destroy(); } catch {}
    }));
  }
}
