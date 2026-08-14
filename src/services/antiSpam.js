import { PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, updateAntiSpamConfig } from './guildConfigService.js';
import { logger } from '../utils/logger.js';

const runtime = new Map();

const DEFAULTS = {
  enabled: false,
  maxMessages: 5,
  windowMs: 5000,
  duplicateThreshold: 3,
  timeoutMs: 60000,
  timeout: true,
  deleteMessages: true,
  ignoredChannels: [],
  ignoredRoles: [],
};

function getGuildRuntime(guildId) {
  if (!runtime.has(guildId)) runtime.set(guildId, new Map());
  return runtime.get(guildId);
}

function normalizeConfig(config) {
  const value = config?.antiSpam || {};
  return {
    ...DEFAULTS,
    ...value,
    maxMessages: Math.max(2, Math.min(50, Number(value.maxMessages) || DEFAULTS.maxMessages)),
    windowMs: Math.max(1000, Math.min(60000, Number(value.windowMs) || DEFAULTS.windowMs)),
    duplicateThreshold: Math.max(2, Math.min(20, Number(value.duplicateThreshold) || DEFAULTS.duplicateThreshold)),
    timeoutMs: Math.max(5000, Math.min(28 * 24 * 60 * 60 * 1000, Number(value.timeoutMs) || DEFAULTS.timeoutMs)),
    timeout: value.timeout !== false,
    ignoredChannels: Array.isArray(value.ignoredChannels) ? value.ignoredChannels : [],
    ignoredRoles: Array.isArray(value.ignoredRoles) ? value.ignoredRoles : [],
  };
}

export async function getAntiSpamConfig(db, guildId) {
  const config = await getGuildConfig(db, guildId);
  return normalizeConfig(config);
}

export async function updateAntiSpam(db, guildId, patch) {
  const current = await getAntiSpamConfig(db, guildId);
  const next = normalizeConfig({ antiSpam: { ...current, ...patch } });
  await updateAntiSpamConfig(db, guildId, next);
  return next;
}

export function resetAntiSpamRuntime(guildId) {
  runtime.delete(guildId);
}

export async function processAntiSpam(message, client) {
  if (!message.guild || !message.member || message.author.bot) return false;

  const config = await getAntiSpamConfig(client.db, message.guild.id);
  if (!config.enabled) return false;
  if (config.ignoredChannels.includes(message.channel.id)) return false;
  if (config.ignoredRoles.some((roleId) => message.member.roles.cache.has(roleId))) return false;

  const perms = message.member.permissions;
  if (perms.has(PermissionFlagsBits.ManageMessages) || perms.has(PermissionFlagsBits.Administrator)) return false;

  const guildRuntime = getGuildRuntime(message.guild.id);
  const now = Date.now();
  const existing = guildRuntime.get(message.author.id) || { timestamps: [], contents: [] };
  existing.timestamps = existing.timestamps.filter((timestamp) => now - timestamp <= config.windowMs);
  existing.contents = existing.contents.slice(-(config.duplicateThreshold - 1));
  existing.timestamps.push(now);
  existing.contents.push((message.content || '').trim().toLowerCase());
  guildRuntime.set(message.author.id, existing);

  const duplicateCount = existing.contents.length >= config.duplicateThreshold
    ? existing.contents.filter((content) => content && content === existing.contents.at(-1)).length
    : 0;
  const spamDetected = existing.timestamps.length >= config.maxMessages || duplicateCount >= config.duplicateThreshold;
  if (!spamDetected) return false;

  existing.timestamps = [];
  existing.contents = [];

  if (config.deleteMessages) {
    await message.delete().catch((error) => {
      logger.warn(`Anti-Spam could not delete message in guild ${message.guild.id}: ${error?.message || error}`);
    });
  }

  if (!config.timeout) return true;

  const botMember = message.guild.members.me;
  const canModerate = botMember?.permissions.has(PermissionFlagsBits.ModerateMembers) && message.member.moderatable;

  if (!canModerate) {
    logger.warn(
      `Anti-Spam detected spam in guild ${message.guild.id} from ${message.author.id}, ` +
      `but timeout was skipped: botModerateMembers=${Boolean(botMember?.permissions.has(PermissionFlagsBits.ModerateMembers))}, ` +
      `targetModeratable=${Boolean(message.member.moderatable)}. ` +
      'Ensure Wolf has Moderate Members and its role is above the target member.'
    );
    return true;
  }

  try {
    await message.member.timeout(config.timeoutMs, 'Wolf Anti-Spam: message spam detected');
    logger.info(`Anti-Spam timeout applied to ${message.author.tag} (${message.author.id}) in guild ${message.guild.id} for ${config.timeoutMs}ms`);
  } catch (error) {
    logger.error(`Anti-Spam timeout failed in guild ${message.guild.id} for ${message.author.id}:`, error);
  }

  return true;
}

export function getAntiSpamDefaults() {
  return { ...DEFAULTS };
}
