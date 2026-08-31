import { Client, GatewayIntentBits, Partials, ActivityType, Routes, REST, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getStoredToken, updateBot, addWarning, listWarnings } from './multibotService.js';

const ACTIVITY_TYPES = { Playing: ActivityType.Playing, Listening: ActivityType.Listening, Watching: ActivityType.Watching, Competing: ActivityType.Competing };
const PRESENCE_STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);
const IMAGE_VALUE = /^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i;

function cleanName(value, fallback) { const name = String(value ?? '').trim().slice(0, 32); return name || fallback; }
function profileKey(settings, botRecord, instance) { const name = cleanName(settings.name, botRecord.bot_username || instance.user.username); return JSON.stringify({ name, avatarUrl: String(settings.avatarUrl || '').trim(), bannerUrl: String(settings.bannerUrl || '').trim() }); }

const COMMANDS = [
  { name: 'ping', description: 'Muestra la latencia del bot.', category: 'general' },
  { name: 'help', description: 'Muestra los comandos disponibles.', category: 'general' },
  { name: 'about', description: 'Muestra información sobre este bot.', category: 'general' },
  { name: 'server', description: 'Muestra información del servidor actual.', category: 'general' },
  { name: 'user', description: 'Muestra información sobre un usuario.', option: 'user', category: 'general' },
  { name: 'avatar', description: 'Muestra el avatar de un usuario.', option: 'user', category: 'general' },
  { name: 'userinfo', description: 'Muestra información detallada de un usuario.', option: 'user_reason_required', category: 'moderation', permission: PermissionFlagsBits.KickMembers },
  { name: 'ban', description: 'Banea a un usuario del servidor.', option: 'user_reason', category: 'moderation', permission: PermissionFlagsBits.BanMembers },
  { name: 'kick', description: 'Expulsa a un usuario del servidor.', option: 'user_reason', category: 'moderation', permission: PermissionFlagsBits.KickMembers },
  { name: 'timeout', description: 'Silencia temporalmente a un usuario.', option: 'timeout', category: 'moderation', permission: PermissionFlagsBits.ModerateMembers },
  { name: 'clear', description: 'Elimina mensajes recientes del canal.', option: 'clear', category: 'moderation', permission: PermissionFlagsBits.ManageMessages },
  { name: 'lock', description: 'Bloquea el canal para @everyone.', category: 'moderation', permission: PermissionFlagsBits.ManageChannels },
  { name: 'unlock', description: 'Desbloquea el canal para @everyone.', category: 'moderation', permission: PermissionFlagsBits.ManageChannels },
  { name: 'warn', description: 'Añade una advertencia a un usuario.', option: 'user_reason_required', category: 'moderation', permission: PermissionFlagsBits.ModerateMembers },
  { name: 'warnings', description: 'Muestra las advertencias de un usuario.', option: 'user', category: 'moderation', permission: PermissionFlagsBits.ModerateMembers },
];

function commandDefinitions(settings = {}) {
  const enabled = settings.commands && typeof settings.commands === 'object' ? settings.commands : {};
  return COMMANDS.filter(command => enabled[command.name] !== false).map(command => {
    const builder = new SlashCommandBuilder().setName(command.name).setDescription(command.description);
    if (command.permission) builder.setDefaultMemberPermissions(command.permission);
    if (command.option === 'user' || command.option === 'user_reason' || command.option === 'user_reason_required') builder.addUserOption(option => option.setName('usuario').setDescription('Usuario a consultar.').setRequired(true));
    if (command.option === 'user_reason' || command.option === 'user_reason_required') builder.addStringOption(option => option.setName('razon').setDescription('Razón de la moderación.').setMaxLength(500).setRequired(command.option === 'user_reason_required'));
    if (command.option === 'timeout') {
      builder.addUserOption(option => option.setName('usuario').setDescription('Usuario a silenciar.').setRequired(true));
      builder.addIntegerOption(option => option.setName('minutos').setDescription('Duración del timeout en minutos (1-40320).').setMinValue(1).setMaxValue(40320).setRequired(true));
      builder.addStringOption(option => option.setName('razon').setDescription('Razón del timeout.').setMaxLength(500).setRequired(false));
    }
    if (command.option === 'clear') builder.addIntegerOption(option => option.setName('cantidad').setDescription('Cantidad de mensajes a eliminar (1-100).').setMinValue(1).setMaxValue(100).setRequired(true));
    return builder;
  });
}

function hasPermission(interaction, permission) { return Boolean(interaction.memberPermissions?.has(permission)); }
function targetIsBot(interaction, target) { return target?.id === interaction.client.user?.id; }
function targetIsSelf(interaction, target) { return target?.id === interaction.user?.id; }
function formatReason(reason) { return String(reason || 'Sin razón').trim().slice(0, 500) || 'Sin razón'; }

export class MultibotManager {
  constructor(ownerClient) { this.ownerClient = ownerClient; this.instances = new Map(); this.starting = new Map(); this.applying = new Map(); this.appliedProfiles = new Map(); this.commandRegistration = new Map(); }

  async restoreOnlineBots() {
    const pool = this.ownerClient.db?.db?.pool || this.ownerClient.db?.pool || this.ownerClient.db?.db;
    if (!pool || typeof pool.query !== 'function') throw new Error('PostgreSQL query interface is unavailable.');
    const { rows } = await pool.query('SELECT * FROM bot_instances WHERE status=$1 ORDER BY id ASC', ['online']);
    logger.info(`[multibot] Restoring ${rows.length} online bot instance(s) after engine restart`);
    for (const bot of rows) { try { await this.start(bot); } catch (error) { logger.error(`[multibot] Failed to restore instance ${bot.id}: ${error?.message || error}`); try { await updateBot(this.ownerClient.db, bot.owner_id, bot.id, { status: 'offline' }); } catch {} } }
  }

  async start(botRecord) {
    const id = Number(botRecord.id);
    if (this.instances.has(id)) { await this.registerInstanceCommands(this.instances.get(id), botRecord); await this.applySettings(botRecord); return this.instances.get(id); }
    if (this.starting.has(id)) return this.starting.get(id);
    const promise = this.#startInternal(botRecord).finally(() => this.starting.delete(id)); this.starting.set(id, promise); return promise;
  }

  async #startInternal(botRecord) {
    const id = Number(botRecord.id); const token = getStoredToken(botRecord);
    const instance = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates], partials: [Partials.Channel] });
    instance.once('ready', async () => {
      this.instances.set(id, instance);
      try {
        await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'online' });
        logger.info(`[multibot] ${instance.user.tag} is online (instance ${id})`);
        this.attachCommandHandler(instance, botRecord);
        await this.registerInstanceCommands(instance, botRecord, token);
        await this.applySettings(botRecord, { forceProfile: true });
      } catch (error) { logger.error(`[multibot] Failed to initialize instance ${id}: ${error?.message || error}`); }
    });
    instance.on('error', async error => {
      logger.error(`[multibot] Discord client error for ${id}: ${error?.message || error}`);
      if (this.instances.get(id) === instance) { this.instances.delete(id); this.appliedProfiles.delete(id); this.commandRegistration.delete(id); try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {} }
    });
    try { await instance.login(token); return instance; } catch (error) { try { instance.destroy(); } catch {} try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {} throw error; }
  }

  async registerInstanceCommands(instance, botRecord, token = null) {
    if (!instance?.user?.id) return false;
    const id = Number(botRecord.id); const commands = commandDefinitions(botRecord.settings || {}).map(command => command.toJSON());
    try {
      const authToken = token || getStoredToken(botRecord);
      const rest = new REST({ version: '10' }).setToken(authToken);
      await rest.put(Routes.applicationCommands(instance.user.id), { body: commands });
      this.commandRegistration.set(id, commands.map(command => command.name));
      logger.info(`[multibot] Registered ${commands.length} commands for instance ${id}`);
      return true;
    } catch (error) {
      logger.error(`[multibot] Failed to register commands for instance ${id}: ${error?.message || error}`);
      return false;
    }
  }

  attachCommandHandler(instance, botRecord) {
    if (instance.__wolfMultibotCommandsAttached) return; instance.__wolfMultibotCommandsAttached = true;
    instance.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;
      try { await this.handleCommand(interaction, botRecord); }
      catch (error) { logger.error(`[multibot] Command /${interaction.commandName} failed for ${botRecord.id}: ${error?.message || error}`); const payload = { content: '❌ Ocurrió un error ejecutando el comando.', ephemeral: true }; if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {}); else await interaction.reply(payload).catch(() => {}); }
    });
  }

  async handleCommand(interaction, botRecord) {
    const command = interaction.commandName;
    const commandConfig = COMMANDS.find(item => item.name === command);
    if (commandConfig?.permission && !hasPermission(interaction, commandConfig.permission)) return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
    if (command === 'ping') return interaction.reply({ content: `🏓 Pong! Latencia: ${interaction.client.ws.ping}ms`, ephemeral: true });
    if (command === 'help') { const names = commandDefinitions(botRecord.settings || {}).map(c => `**/${c.name}** — ${c.description}`).join('\n'); return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🤖 ${interaction.client.user.username} · Comandos`).setDescription(names || 'No hay comandos activados.').setColor(0x7c5cff)] }); }
    if (command === 'about') return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🤖 ${interaction.client.user.username}`).setDescription('Bot creado y administrado desde Wolf Multibot B1.').addFields({ name: 'ID', value: interaction.client.user.id, inline: true }, { name: 'Servidores', value: String(interaction.client.guilds.cache.size), inline: true }).setColor(0x7c5cff)] });
    if (command === 'server') { if (!interaction.guild) return interaction.reply({ content: '❌ Este comando solo funciona dentro de un servidor.', ephemeral: true }); const guild = interaction.guild; return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏠 ${guild.name}`).addFields({ name: 'Miembros', value: String(guild.memberCount), inline: true }, { name: 'Canales', value: String(guild.channels.cache.size), inline: true }).setColor(0x7c5cff)] }); }
    if (command === 'user' || command === 'avatar') { const user = interaction.options.getUser('usuario') || interaction.user; if (command === 'user') return interaction.reply({ content: `👤 **${user.tag}**\nID: \`${user.id}\`\nCuenta creada: <t:${Math.floor(user.createdTimestamp / 1000)}:F>`, ephemeral: true }); return interaction.reply({ content: `🖼️ Avatar de **${user.tag}**\n${user.displayAvatarURL({ size: 1024, extension: 'png' })}` }); }
    if (command === 'userinfo') { const user = interaction.options.getUser('usuario'); const member = interaction.guild?.members.cache.get(user.id) || await interaction.guild?.members.fetch(user.id).catch(() => null); if (!member) return interaction.reply({ content: '❌ No pude encontrar a ese miembro en este servidor.', ephemeral: true }); const roles = member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.toString()).slice(0, 15).join(' ') || 'Sin roles'; return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`👤 ${user.tag}`).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields({ name: 'ID', value: user.id, inline: true }, { name: 'Cuenta', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true }, { name: 'Entrada', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Desconocida', inline: true }, { name: 'Roles', value: roles }).setColor(0x7c5cff)] }); }
    if (!interaction.guild) return interaction.reply({ content: '❌ Este comando solo funciona dentro de un servidor.', ephemeral: true });
    if (command === 'ban' || command === 'kick') { const target = interaction.options.getUser('usuario'); const reason = formatReason(interaction.options.getString('razon')); if (targetIsSelf(interaction, target)) return interaction.reply({ content: '❌ No puedes moderarte a ti mismo.', ephemeral: true }); if (targetIsBot(interaction, target)) return interaction.reply({ content: '❌ No puedes moderar a este bot.', ephemeral: true }); const member = await interaction.guild.members.fetch(target.id).catch(() => null); if (member && !member.moderatable) return interaction.reply({ content: '❌ No puedo moderar a ese usuario. Revisa mi rol y la jerarquía de roles.', ephemeral: true }); if (command === 'ban') { await interaction.guild.members.ban(target.id, { reason }); return interaction.reply({ content: `🔨 **${target.tag}** fue baneado.\nRazón: ${reason}` }); } if (!member) return interaction.reply({ content: '❌ Ese usuario no está en el servidor.', ephemeral: true }); await member.kick(reason); return interaction.reply({ content: `👢 **${target.tag}** fue expulsado.\nRazón: ${reason}` }); }
    if (command === 'timeout') { const target = interaction.options.getUser('usuario'); const minutes = interaction.options.getInteger('minutos'); const reason = formatReason(interaction.options.getString('razon')); const member = await interaction.guild.members.fetch(target.id).catch(() => null); if (!member) return interaction.reply({ content: '❌ Ese usuario no está en el servidor.', ephemeral: true }); if (targetIsSelf(interaction, target) || targetIsBot(interaction, target)) return interaction.reply({ content: '❌ No puedes aplicar timeout a ese usuario.', ephemeral: true }); if (!member.moderatable) return interaction.reply({ content: '❌ No puedo aplicar timeout. Revisa la jerarquía de roles.', ephemeral: true }); await member.timeout(minutes * 60 * 1000, reason); return interaction.reply({ content: `⏱️ **${target.tag}** recibió un timeout de **${minutes} minuto(s)**.\nRazón: ${reason}` }); }
    if (command === 'clear') { const amount = interaction.options.getInteger('cantidad'); if (!interaction.channel?.isTextBased?.() || typeof interaction.channel.bulkDelete !== 'function') return interaction.reply({ content: '❌ Este comando no funciona en este canal.', ephemeral: true }); const deleted = await interaction.channel.bulkDelete(amount, true); return interaction.reply({ content: `🧹 Eliminé **${deleted.size}** mensaje(s).`, ephemeral: true }); }
    if (command === 'lock' || command === 'unlock') { if (!interaction.channel?.permissionOverwrites) return interaction.reply({ content: '❌ No puedo modificar los permisos de este canal.', ephemeral: true }); await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: command === 'unlock' ? null : false }, { reason: `${command === 'lock' ? 'Bloqueo' : 'Desbloqueo'} ejecutado por ${interaction.user.tag}` }); return interaction.reply({ content: command === 'lock' ? '🔒 Canal bloqueado para @everyone.' : '🔓 Canal desbloqueado para @everyone.' }); }
    if (command === 'warn') { const target = interaction.options.getUser('usuario'); const reason = formatReason(interaction.options.getString('razon')); if (targetIsSelf(interaction, target) || targetIsBot(interaction, target)) return interaction.reply({ content: '❌ No puedes advertir a ese usuario.', ephemeral: true }); const member = await interaction.guild.members.fetch(target.id).catch(() => null); if (!member) return interaction.reply({ content: '❌ Ese usuario no está en el servidor.', ephemeral: true }); const warning = await addWarning(this.ownerClient.db, { botInstanceId: botRecord.id, guildId: interaction.guild.id, userId: target.id, moderatorId: interaction.user.id, reason }); return interaction.reply({ content: `⚠️ **${target.tag}** recibió una advertencia #${warning.id}.\nRazón: ${reason}` }); }
    if (command === 'warnings') { const target = interaction.options.getUser('usuario'); const warnings = await listWarnings(this.ownerClient.db, { botInstanceId: botRecord.id, guildId: interaction.guild.id, userId: target.id, limit: 10 }); if (!warnings.length) return interaction.reply({ content: `📋 **${target.tag}** no tiene advertencias registradas.`, ephemeral: true }); const description = warnings.map((warning, index) => `**#${warning.id}** · <t:${Math.floor(new Date(warning.created_at).getTime() / 1000)}:d>\n${formatReason(warning.reason)} · Moderador: <@${warning.moderator_id}>`).join('\n\n'); return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📋 Advertencias de ${target.tag}`).setDescription(description).setColor(0x7c5cff)] }); }
  }

  async applySettings(botRecord, { forceProfile = false } = {}) { const id = Number(botRecord.id); const instance = this.instances.get(id); if (!instance?.user) return false; if (this.applying.has(id)) return this.applying.get(id); const run = this.#applySettingsInternal(botRecord, { forceProfile }).finally(() => this.applying.delete(id)); this.applying.set(id, run); return run; }

  async #applySettingsInternal(botRecord, { forceProfile }) {
    const id = Number(botRecord.id); const instance = this.instances.get(id); const settings = botRecord.settings || {};
    const name = cleanName(settings.name, botRecord.bot_username || instance.user.username); const status = PRESENCE_STATUSES.has(settings.presenceStatus) ? settings.presenceStatus : 'online'; const activityType = ACTIVITY_TYPES[settings.activityType] ?? ActivityType.Playing; const activityText = String(settings.activityText || '').trim().slice(0, 128);
    const key = profileKey(settings, botRecord, instance);
    if (forceProfile || this.appliedProfiles.get(id) !== key) {
      const body = {}; if (name && instance.user.username !== name) body.username = name;
      const avatarUrl = String(settings.avatarUrl || '').trim(); const bannerUrl = String(settings.bannerUrl || '').trim();
      if (avatarUrl && IMAGE_VALUE.test(avatarUrl)) body.avatar = avatarUrl; if (bannerUrl && IMAGE_VALUE.test(bannerUrl)) body.banner = bannerUrl;
      if (Object.keys(body).length) { try { await instance.rest.patch(Routes.user(), { body }); this.appliedProfiles.set(id, key); logger.info(`[multibot] Discord profile updated for instance ${id}`); } catch (error) { logger.error(`[multibot] Failed to update Discord profile for ${id}: ${error?.message || error}`); } } else this.appliedProfiles.set(id, key);
    }
    const presence = activityText ? { status, activities: [{ name: activityText, type: activityType }] } : { status, activities: [] };
    try {
      await instance.user.setPresence(presence);
    } catch (error) {
      logger.warn(`[multibot] Presence update failed for instance ${id}: ${error?.message || error}`);
    }
    return true;
  }

  async stop(botRecord) { const id = Number(botRecord.id); const instance = this.instances.get(id); if (!instance) { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); return false; } this.instances.delete(id); this.appliedProfiles.delete(id); this.applying.delete(id); this.commandRegistration.delete(id); try { instance.destroy(); } finally { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } return true; }
  get(id) { return this.instances.get(Number(id)) || null; }
  async shutdown() { const entries = [...this.instances.entries()]; this.instances.clear(); this.appliedProfiles.clear(); this.applying.clear(); this.commandRegistration.clear(); await Promise.all(entries.map(async ([id, instance]) => { try { instance.destroy(); } catch {} })); }
}