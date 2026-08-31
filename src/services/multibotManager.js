import { Client, GatewayIntentBits, Partials, ActivityType, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getStoredToken, updateBot } from './multibotService.js';

const ACTIVITY_TYPES = { Playing: ActivityType.Playing, Listening: ActivityType.Listening, Watching: ActivityType.Watching, Competing: ActivityType.Competing };
const PRESENCE_STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);
const IMAGE_VALUE = /^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i;

function cleanName(value, fallback) { const name = String(value ?? '').trim().slice(0, 32); return name || fallback; }
function profileKey(settings, botRecord, instance) { const name = cleanName(settings.name, botRecord.bot_username || instance.user.username); return JSON.stringify({ name, avatarUrl: String(settings.avatarUrl || '').trim(), bannerUrl: String(settings.bannerUrl || '').trim() }); }

const COMMANDS = [
  { name: 'ping', description: 'Muestra la latencia del bot.' },
  { name: 'help', description: 'Muestra los comandos disponibles.' },
  { name: 'about', description: 'Muestra información sobre este bot.' },
  { name: 'server', description: 'Muestra información del servidor actual.' },
  { name: 'user', description: 'Muestra información sobre un usuario.', option: true },
  { name: 'avatar', description: 'Muestra el avatar de un usuario.', option: true },
];

function commandDefinitions(settings = {}) {
  const enabled = settings.commands && typeof settings.commands === 'object' ? settings.commands : {};
  return COMMANDS.filter(command => enabled[command.name] !== false).map(command => {
    const builder = new SlashCommandBuilder().setName(command.name).setDescription(command.description);
    if (command.option) builder.addUserOption(option => option.setName('usuario').setDescription('Usuario a consultar.').setRequired(false));
    return builder;
  });
}

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
        await this.registerInstanceCommands(instance, botRecord);
        await this.applySettings(botRecord, { forceProfile: true });
      } catch (error) { logger.error(`[multibot] Failed to initialize instance ${id}: ${error?.message || error}`); }
    });
    instance.on('error', async error => {
      logger.error(`[multibot] Discord client error for ${id}: ${error?.message || error}`);
      if (this.instances.get(id) === instance) { this.instances.delete(id); this.appliedProfiles.delete(id); this.commandRegistration.delete(id); try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {} }
    });
    try { await instance.login(token); return instance; } catch (error) { try { instance.destroy(); } catch {} try { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } catch {} throw error; }
  }

  async registerInstanceCommands(instance, botRecord) {
    const id = Number(botRecord.id); const commands = commandDefinitions(botRecord.settings || {}).map(command => command.toJSON());
    try { await instance.application.commands.set(commands); this.commandRegistration.set(id, commands.map(command => command.name)); logger.info(`[multibot] Registered ${commands.length} commands for instance ${id}`); }
    catch (error) { logger.error(`[multibot] Failed to register commands for instance ${id}: ${error?.message || error}`); }
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
    if (command === 'ping') return interaction.reply({ content: `🏓 Pong! Latencia: **${interaction.client.ws.ping}ms**`, ephemeral: true });
    if (command === 'help') {
      const names = commandDefinitions(botRecord.settings || {}).map(c => `**/${c.name}** — ${c.description}`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🤖 ${interaction.client.user.username} · Comandos`).setDescription(names || 'No hay comandos activados.').setColor(0x7c5cff)] });
    }
    if (command === 'about') return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🤖 ${interaction.client.user.username}`).setDescription('Bot creado y administrado desde Wolf Multibot B1.').addFields({ name: 'ID', value: interaction.client.user.id, inline: true }, { name: 'Servidores', value: String(interaction.client.guilds.cache.size), inline: true }).setColor(0x7c5cff)] });
    if (command === 'server') {
      if (!interaction.guild) return interaction.reply({ content: '❌ Este comando solo funciona dentro de un servidor.', ephemeral: true });
      const guild = interaction.guild; return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏠 ${guild.name}`).addFields({ name: 'Miembros', value: String(guild.memberCount), inline: true }, { name: 'Canales', value: String(guild.channels.cache.size), inline: true }, { name: 'Roles', value: String(guild.roles.cache.size), inline: true }).setColor(0x7c5cff)] });
    }
    if (command === 'user') { const user = interaction.options.getUser('usuario') || interaction.user; return interaction.reply({ content: `👤 **${user.tag}**\nID: \`${user.id}\`\nCuenta creada: <t:${Math.floor(user.createdTimestamp / 1000)}:F>`, ephemeral: true }); }
    if (command === 'avatar') { const user = interaction.options.getUser('usuario') || interaction.user; return interaction.reply({ content: `🖼️ Avatar de **${user.tag}**\n${user.displayAvatarURL({ size: 1024, extension: 'png' })}` }); }
  }

  async applySettings(botRecord, { forceProfile = false } = {}) {
    const id = Number(botRecord.id); const instance = this.instances.get(id); if (!instance?.user) return false;
    if (this.applying.has(id)) return this.applying.get(id);
    const run = this.#applySettingsInternal(botRecord, { forceProfile }).finally(() => this.applying.delete(id)); this.applying.set(id, run); return run;
  }

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
    instance.user.setPresence(activityText ? { status, activities: [{ name: activityText, type: activityType }] } : { status, activities: [] }); return true;
  }

  async stop(botRecord) { const id = Number(botRecord.id); const instance = this.instances.get(id); if (!instance) { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); return false; } this.instances.delete(id); this.appliedProfiles.delete(id); this.applying.delete(id); this.commandRegistration.delete(id); try { instance.destroy(); } finally { await updateBot(this.ownerClient.db, botRecord.owner_id, id, { status: 'offline' }); } return true; }
  get(id) { return this.instances.get(Number(id)) || null; }
  async shutdown() { const entries = [...this.instances.entries()]; this.instances.clear(); this.appliedProfiles.clear(); this.applying.clear(); this.commandRegistration.clear(); await Promise.all(entries.map(async ([id, instance]) => { try { instance.destroy(); } catch {} })); }
}
