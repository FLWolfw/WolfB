const DEFAULT_CONFIG = {
  guild_id: null,
  language: 'es',
  welcome: { enabled: false, channel: null, message: '🎉 Bienvenido {user} a {server}' },
  logs: {
    enabled: false,
    mode: 'single',
    channel: null,
    enabledEvents: {},
    categories: { message: null, member: null, moderation: null, voice: null, role: null, channel: null }
  },
  antiNuke: {
    enabled: true,
    emergencyMode: true,
    windowMs: 10000,
    incidentWindowMs: 30000,
    action: 'quarantine',
    quarantinePersistent: true,
    quarantineBypassAction: 're_quarantine',
    quarantineTimeoutMs: 60 * 60 * 1000,
    thresholds: { channelDelete: 3, channelCreate: 5, channelUpdate: 5, roleCreate: 3, roleDelete: 3, roleUpdate: 3, ban: 3, kick: 3, webhook: 2, dangerousPermission: 1 },
    protections: { channelDelete: true, channelCreate: true, channelUpdate: true, roleCreate: true, roleDelete: true, roleUpdate: true, ban: true, kick: true, webhook: true, dangerousPermissions: true },
    safeRoleIds: [], protectedRoleIds: [], protectedUserIds: [],
  },
  antiSpam: {
    enabled: false,
    maxMessages: 5,
    windowMs: 5000,
    duplicateThreshold: 3,
    timeoutMs: 60000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
  },
};

export async function getGuildConfig(db, guildId) {
  const key = `guild:${guildId}:config`;
  let config = await db.get(key, null);

  if (!config) {
    config = { ...DEFAULT_CONFIG, guild_id: guildId, antiNuke: JSON.parse(JSON.stringify(DEFAULT_CONFIG.antiNuke)), antiSpam: JSON.parse(JSON.stringify(DEFAULT_CONFIG.antiSpam)) };
    await db.set(key, config);
  }

  let updated = false;
  if (!config.language) { config.language = 'es'; updated = true; }
  if (!config.welcome) { config.welcome = { enabled: config.welcome_enabled || false, channel: config.welcome_channel || null, message: config.welcome_message || '🎉 Bienvenido {user} a {server}' }; updated = true; }
  if (!config.logs) { config.logs = { enabled: config.logging_enabled || false, mode: 'single', channel: config.log_channel || null, categories: { message: null, member: null, moderation: null, voice: null, role: null, channel: null } }; updated = true; }
  if (!config.logs.mode) { config.logs.mode = 'single'; updated = true; }
  if (!config.logs.categories) { config.logs.categories = { message: null, member: null, moderation: null, voice: null, role: null, channel: null }; updated = true; }
  if (!config.logs.enabledEvents || typeof config.logs.enabledEvents !== 'object') { config.logs.enabledEvents = {}; updated = true; }
  if (!config.logs.channel) {
    const legacyChannel = config.logging?.channelId || config.logChannelId || null;
    if (legacyChannel) { config.logs.channel = legacyChannel; if (config.logging?.enabled === true || config.enableLogging === true) config.logs.enabled = true; updated = true; }
  }

  const d = DEFAULT_CONFIG.antiNuke;
  if (!config.antiNuke || typeof config.antiNuke !== 'object') { config.antiNuke = JSON.parse(JSON.stringify(d)); updated = true; }
  if (typeof config.antiNuke.enabled !== 'boolean') { config.antiNuke.enabled = d.enabled; updated = true; }
  if (typeof config.antiNuke.emergencyMode !== 'boolean') { config.antiNuke.emergencyMode = d.emergencyMode; updated = true; }
  if (!Number.isFinite(Number(config.antiNuke.windowMs))) { config.antiNuke.windowMs = d.windowMs; updated = true; }
  if (!Number.isFinite(Number(config.antiNuke.incidentWindowMs))) { config.antiNuke.incidentWindowMs = d.incidentWindowMs; updated = true; }
  if (!['alert', 'quarantine', 'ban'].includes(config.antiNuke.action)) { config.antiNuke.action = d.action; updated = true; }
  if (typeof config.antiNuke.quarantinePersistent !== 'boolean') { config.antiNuke.quarantinePersistent = d.quarantinePersistent; updated = true; }
  if (!['alert', 're_quarantine', 'ban'].includes(config.antiNuke.quarantineBypassAction)) { config.antiNuke.quarantineBypassAction = d.quarantineBypassAction; updated = true; }
  if (!Number.isFinite(Number(config.antiNuke.quarantineTimeoutMs))) { config.antiNuke.quarantineTimeoutMs = d.quarantineTimeoutMs; updated = true; }
  config.antiNuke.thresholds = { ...d.thresholds, ...(config.antiNuke.thresholds || {}) };
  config.antiNuke.protections = { ...d.protections, ...(config.antiNuke.protections || {}) };
  config.antiNuke.safeRoleIds = Array.isArray(config.antiNuke.safeRoleIds) ? config.antiNuke.safeRoleIds : [];
  config.antiNuke.protectedRoleIds = Array.isArray(config.antiNuke.protectedRoleIds) ? config.antiNuke.protectedRoleIds : [];
  config.antiNuke.protectedUserIds = Array.isArray(config.antiNuke.protectedUserIds) ? config.antiNuke.protectedUserIds : [];

  const s = DEFAULT_CONFIG.antiSpam;
  if (!config.antiSpam || typeof config.antiSpam !== 'object') { config.antiSpam = JSON.parse(JSON.stringify(s)); updated = true; }
  if (typeof config.antiSpam.enabled !== 'boolean') { config.antiSpam.enabled = s.enabled; updated = true; }
  if (!Number.isFinite(Number(config.antiSpam.maxMessages))) { config.antiSpam.maxMessages = s.maxMessages; updated = true; }
  if (!Number.isFinite(Number(config.antiSpam.windowMs))) { config.antiSpam.windowMs = s.windowMs; updated = true; }
  if (!Number.isFinite(Number(config.antiSpam.duplicateThreshold))) { config.antiSpam.duplicateThreshold = s.duplicateThreshold; updated = true; }
  if (!Number.isFinite(Number(config.antiSpam.timeoutMs))) { config.antiSpam.timeoutMs = s.timeoutMs; updated = true; }
  if (typeof config.antiSpam.deleteMessages !== 'boolean') { config.antiSpam.deleteMessages = s.deleteMessages; updated = true; }
  if (!Array.isArray(config.antiSpam.ignoredChannels)) { config.antiSpam.ignoredChannels = []; updated = true; }
  if (!Array.isArray(config.antiSpam.ignoredRoles)) { config.antiSpam.ignoredRoles = []; updated = true; }

  if (updated) await db.set(key, config);
  return config;
}

export async function updateWelcome(db, guildId, value) { const config = await getGuildConfig(db, guildId); config.welcome.enabled = value; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateWelcomeChannel(db, guildId, channelId) { const config = await getGuildConfig(db, guildId); config.welcome.channel = channelId; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateWelcomeMessage(db, guildId, message) { const config = await getGuildConfig(db, guildId); config.welcome.message = message; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateLogging(db, guildId, value) { const config = await getGuildConfig(db, guildId); config.logs.enabled = value; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateLogChannel(db, guildId, channelId) { const config = await getGuildConfig(db, guildId); config.logs.channel = channelId; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateLogMode(db, guildId, mode) { const config = await getGuildConfig(db, guildId); config.logs.mode = mode === 'advanced' || mode === 'Advanced Categories' ? 'advanced' : 'single'; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateLogCategory(db, guildId, category, channelId) { const config = await getGuildConfig(db, guildId); if (!config.logs.categories) config.logs.categories = {}; config.logs.categories[category] = channelId; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateLanguage(db, guildId, language) { const config = await getGuildConfig(db, guildId); config.language = language; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateAntiNukeConfig(db, guildId, antiNuke) { const config = await getGuildConfig(db, guildId); config.antiNuke = { ...config.antiNuke, ...antiNuke, thresholds: { ...config.antiNuke.thresholds, ...(antiNuke.thresholds || {}) }, protections: { ...config.antiNuke.protections, ...(antiNuke.protections || {}) } }; await db.set(`guild:${guildId}:config`, config); return config; }
export async function updateAntiSpamConfig(db, guildId, antiSpam) { const config = await getGuildConfig(db, guildId); config.antiSpam = { ...config.antiSpam, ...antiSpam }; await db.set(`guild:${guildId}:config`, config); return config; }
export async function patchGuildConfig(db, guildId, patch = {}) { const config = await getGuildConfig(db, guildId); for (const [key, value] of Object.entries(patch)) { const isPlainObject = value && typeof value === 'object' && !Array.isArray(value); if (isPlainObject && config[key] && typeof config[key] === 'object') config[key] = { ...config[key], ...value }; else config[key] = value; } await db.set(`guild:${guildId}:config`, config); return config; }
