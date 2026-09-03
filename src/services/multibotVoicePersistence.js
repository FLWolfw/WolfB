import { ChannelType } from 'discord.js';
import {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { logger } from '../utils/logger.js';

function sqlDb(db) {
  const pg = db?.db || db;
  const pool = pg?.pool || pg;
  if (!pool || typeof pool.query !== 'function') throw new Error('PostgreSQL query interface is unavailable.');
  return pool;
}

async function ensureSchema(manager) {
  const sql = sqlDb(manager.ownerClient.db);
  await sql.query(`CREATE TABLE IF NOT EXISTS bot_voice_connections (bot_instance_id BIGINT NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (bot_instance_id, guild_id))`);
}

async function saveTarget(manager, botInstanceId, guildId, channelId) {
  const sql = sqlDb(manager.ownerClient.db);
  await sql.query(`INSERT INTO bot_voice_connections (bot_instance_id, guild_id, channel_id) VALUES ($1,$2,$3) ON CONFLICT (bot_instance_id,guild_id) DO UPDATE SET channel_id=EXCLUDED.channel_id, updated_at=NOW()`, [botInstanceId, String(guildId), String(channelId)]);
}

async function removeTarget(manager, botInstanceId, guildId) {
  const sql = sqlDb(manager.ownerClient.db);
  await sql.query(`DELETE FROM bot_voice_connections WHERE bot_instance_id=$1 AND guild_id=$2`, [botInstanceId, String(guildId)]);
}

async function hasTarget(manager, botInstanceId, guildId) {
  const sql = sqlDb(manager.ownerClient.db);
  const { rows } = await sql.query(`SELECT 1 FROM bot_voice_connections WHERE bot_instance_id=$1 AND guild_id=$2 LIMIT 1`, [botInstanceId, String(guildId)]);
  return rows.length > 0;
}

function wireConnection(manager, instanceId, guild, channel) {
  const key = `${instanceId}:${guild.id}`;
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
    group: `wolf-multibot-${instanceId}`,
  });

  manager.voiceConnections.set(key, connection);
  connection.on('error', error => {
    logger.error(`[multibot] Persistent voice error for instance ${instanceId} in guild ${guild.id}: ${error?.message || error}`);
    scheduleReconnect(manager, instanceId, guild.id);
  });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Signalling, 5_000);
    } catch {
      connection.destroy();
      if (manager.voiceConnections.get(key) === connection) manager.voiceConnections.delete(key);
      scheduleReconnect(manager, instanceId, guild.id);
    }
  });
  return connection;
}

function scheduleReconnect(manager, instanceId, guildId) {
  const key = `${instanceId}:${guildId}`;
  if (manager.voiceReconnectTimers.has(key)) return;
  const timer = setTimeout(async () => {
    manager.voiceReconnectTimers.delete(key);
    if (!await hasTarget(manager, instanceId, guildId).catch(() => false)) return;
    try {
      await manager.restoreVoiceConnections({ instanceId, guildId });
    } catch (error) {
      logger.error(`[multibot] Voice reconnect failed for ${key}: ${error?.message || error}`);
      scheduleReconnect(manager, instanceId, guildId);
    }
  }, 5_000);
  manager.voiceReconnectTimers.set(key, timer);
}

export function installMultibotVoicePersistence(manager) {
  if (!manager || manager.__wolfVoicePersistenceInstalled) return;
  manager.__wolfVoicePersistenceInstalled = true;
  manager.voiceReconnectTimers = new Map();

  manager.restoreVoiceConnections = async ({ instanceId = null, guildId = null } = {}) => {
    await ensureSchema(manager);
    const sql = sqlDb(manager.ownerClient.db);
    const params = [];
    const filters = [];
    if (instanceId !== null) { params.push(Number(instanceId)); filters.push(`bot_instance_id=$${params.length}`); }
    if (guildId !== null) { params.push(String(guildId)); filters.push(`guild_id=$${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await sql.query(`SELECT bot_instance_id, guild_id, channel_id FROM bot_voice_connections ${where} ORDER BY bot_instance_id, guild_id`, params);
    let restored = 0;
    for (const row of rows) {
      const id = Number(row.bot_instance_id);
      const instance = manager.instances.get(id);
      if (!instance) continue;
      const guild = instance.guilds.cache.get(String(row.guild_id));
      if (!guild) continue;
      const channel = await guild.channels.fetch(String(row.channel_id)).catch(() => null);
      if (!channel || !channel.isVoiceBased?.() || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)) {
        logger.warn(`[multibot] Saved voice channel ${row.channel_id} is unavailable for instance ${id} in guild ${row.guild_id}`);
        continue;
      }
      const key = `${id}:${guild.id}`;
      const existing = manager.voiceConnections.get(key) || getVoiceConnection(guild.id, `wolf-multibot-${id}`);
      if (existing && existing.state?.status === VoiceConnectionStatus.Ready) continue;
      if (existing) existing.destroy();
      try {
        const connection = wireConnection(manager, id, guild, channel);
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        restored += 1;
        logger.info(`[multibot] Restored voice for instance ${id} in guild ${guild.id}: #${channel.name}`);
      } catch (error) {
        logger.error(`[multibot] Failed to restore voice for instance ${id} in guild ${guild.id}: ${error?.message || error}`);
        try { manager.voiceConnections.delete(key); } catch {}
        scheduleReconnect(manager, id, guild.id);
      }
    }
    if (rows.length || restored) logger.info(`[multibot] Voice persistence checked ${rows.length} saved connection(s), restored ${restored}`);
    return restored;
  };

  const originalHandle = manager.handleCommand.bind(manager);
  manager.handleCommand = async (interaction, botRecord) => {
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'voice' && interaction.guild) {
      const instanceId = Number(botRecord.id);
      const guildId = interaction.guild.id;
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'leave') {
        await removeTarget(manager, instanceId, guildId).catch(error => logger.error(`[multibot] Failed to clear saved voice target ${instanceId}:${guildId}: ${error?.message || error}`));
        return originalHandle(interaction, botRecord);
      }
      const result = await originalHandle(interaction, botRecord);
      const key = `${instanceId}:${guildId}`;
      const connection = manager.voiceConnections.get(key);
      if (connection?.state?.status === VoiceConnectionStatus.Ready) {
        const channel = interaction.options.getChannel('channel');
        if (channel?.id) await saveTarget(manager, instanceId, guildId, channel.id).catch(error => logger.error(`[multibot] Failed to save voice target ${instanceId}:${guildId}: ${error?.message || error}`));
      }
      return result;
    }
    return originalHandle(interaction, botRecord);
  };

  logger.info('[multibot] Voice persistence/reconnect service installed');
}
