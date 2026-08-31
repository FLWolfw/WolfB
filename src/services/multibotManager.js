import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getStoredToken, updateBot } from './multibotService.js';

export class MultibotManager {
  constructor(ownerClient) {
    this.ownerClient = ownerClient;
    this.instances = new Map();
    this.starting = new Map();
  }

  async start(botRecord) {
    const id = Number(botRecord.id);
    if (this.instances.has(id)) return this.instances.get(id);
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
      } catch (error) {
        logger.error(`[multibot] Failed to persist online state for ${id}: ${error?.message || error}`);
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
