import { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { logger } from '../utils/logger.js';

const VOICE_COMMAND = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Controla la conexión de voz de este bot.')
  .addSubcommand(subcommand => subcommand
    .setName('join')
    .setDescription('Conecta este bot a un canal de voz.')
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Canal de voz al que se conectará el bot.')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('leave')
    .setDescription('Desconecta este bot del canal de voz.'));

function voiceEnabled(botRecord) {
  const commands = botRecord?.settings?.commands;
  return !(commands && typeof commands === 'object' && commands.voice === false);
}

function commandJsonWithoutVoice(commands) {
  return commands.filter(command => command?.name !== 'voice');
}

function botCanConnect(channel, interaction) {
  const me = interaction.guild?.members?.me;
  if (!me) return { ok: false, message: '❌ No pude encontrar al bot en este servidor.' };
  const permissions = channel.permissionsFor(me);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    return { ok: false, message: '❌ No tengo permiso para ver ese canal de voz.' };
  }
  if (!permissions.has(PermissionFlagsBits.Connect)) {
    return { ok: false, message: '❌ No tengo permiso para conectarme a ese canal de voz.' };
  }
  if (channel.full) {
    return { ok: false, message: '❌ Ese canal de voz está lleno.' };
  }
  return { ok: true };
}

export function installMultibotVoiceCommands(manager) {
  if (!manager || manager.__wolfVoiceInstalled) return;
  manager.__wolfVoiceInstalled = true;
  manager.voiceConnections = new Map();
  manager.voiceRegistration = new Map();

  const originalRegister = manager.registerInstanceCommands.bind(manager);
  manager.registerInstanceCommands = async (instance, botRecord, token = null) => {
    const result = await originalRegister(instance, botRecord, token);
    if (!instance?.user?.id || !voiceEnabled(botRecord)) return result;

    const id = Number(botRecord.id);
    const previous = manager.voiceRegistration.get(id) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      const authToken = token || manager.instanceTokens?.get(id);
      if (!authToken) return result;
      try {
        const rest = new REST({ version: '10' }).setToken(authToken);
        const registered = await rest.get(Routes.applicationCommands(instance.user.id));
        const commands = commandJsonWithoutVoice(Array.isArray(registered) ? registered : []);
        commands.push(VOICE_COMMAND.toJSON());
        await rest.put(Routes.applicationCommands(instance.user.id), { body: commands });
        manager.commandRegistration?.set(id, commands.map(command => command.name));
        logger.info(`[multibot] Ensured /voice for instance ${id} without duplicate top-level commands`);
      } catch (error) {
        logger.error(`[multibot] Failed to register /voice for instance ${id}: ${error?.message || error}`);
      }
      return result;
    });
    manager.voiceRegistration.set(id, current.finally(() => {
      if (manager.voiceRegistration.get(id) === current) manager.voiceRegistration.delete(id);
    }));
    return current;
  };

  const originalHandle = manager.handleCommand.bind(manager);
  manager.handleCommand = async (interaction, botRecord) => {
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'voice') {
      if (!voiceEnabled(botRecord)) {
        return interaction.reply({ content: '❌ El comando `/voice` está desactivado para este bot.', ephemeral: true });
      }
      return handleVoiceCommand(manager, interaction, botRecord);
    }

    const result = await originalHandle(interaction, botRecord);
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'help' && interaction.replied && voiceEnabled(botRecord)) {
      try {
        const embed = interaction.message?.embeds?.[0];
        if (embed) {
          const description = `${embed.description || ''}\n**/voice** — Controla la conexión de voz de este bot.`;
          const next = EmbedBuilder.from(embed).setDescription(description.trim());
          await interaction.editReply({ embeds: [next] });
        }
      } catch (error) {
        logger.debug(`[multibot] Could not append /voice to help for instance ${botRecord.id}: ${error?.message || error}`);
      }
    }
    return result;
  };

  const originalStop = typeof manager.stop === 'function' ? manager.stop.bind(manager) : null;
  if (originalStop) {
    manager.stop = async botRecord => {
      leaveAllForInstance(manager, botRecord?.id);
      return originalStop(botRecord);
    };
  }

  logger.info('[multibot] Isolated /voice command service installed');
}

async function handleVoiceCommand(manager, interaction, botRecord) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ `/voice` solo funciona dentro de un servidor.', ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const instanceId = Number(botRecord.id);
  const guildId = interaction.guild.id;
  const key = `${instanceId}:${guildId}`;

  if (subcommand === 'leave') {
    const connection = manager.voiceConnections.get(key) || getVoiceConnection(guildId, `wolf-multibot-${instanceId}`);
    if (!connection) {
      return interaction.reply({ content: 'ℹ️ Este bot no está conectado a un canal de voz.', ephemeral: true });
    }
    connection.destroy();
    manager.voiceConnections.delete(key);
    return interaction.reply({ content: '🔌 Me desconecté del canal de voz.', ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');
  if (!channel?.isVoiceBased?.() || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)) {
    return interaction.reply({ content: '❌ Debes seleccionar un canal de voz válido.', ephemeral: true });
  }

  const permissionCheck = botCanConnect(channel, interaction);
  if (!permissionCheck.ok) return interaction.reply({ content: permissionCheck.message, ephemeral: true });

  const existing = manager.voiceConnections.get(key) || getVoiceConnection(guildId, `wolf-multibot-${instanceId}`);
  if (existing) existing.destroy();

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
    group: `wolf-multibot-${instanceId}`,
  });

  manager.voiceConnections.set(key, connection);
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Signalling, 5_000);
    } catch {
      connection.destroy();
      if (manager.voiceConnections.get(key) === connection) manager.voiceConnections.delete(key);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    return interaction.reply({ content: `🔊 Me conecté a **${channel.name}**.`, ephemeral: true });
  } catch (error) {
    connection.destroy();
    if (manager.voiceConnections.get(key) === connection) manager.voiceConnections.delete(key);
    logger.error(`[multibot] Voice connection failed for instance ${instanceId} in guild ${guildId}: ${error?.message || error}`);
    return interaction.reply({ content: '❌ No pude conectarme al canal de voz. Revisa los permisos del bot y vuelve a intentarlo.', ephemeral: true });
  }
}

function leaveAllForInstance(manager, instanceId) {
  const prefix = `${Number(instanceId)}:`;
  for (const [key, connection] of manager.voiceConnections || []) {
    if (key.startsWith(prefix)) {
      try { connection.destroy(); } catch {}
      manager.voiceConnections.delete(key);
    }
  }
}
