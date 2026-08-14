import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';
import { logger } from '../../utils/logger.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Trae el bot a un canal de voz y déjalo ahí (sin música).')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addSubcommand((s) =>
      s.setName('join')
        .setDescription('El bot entra a un canal de voz y se queda permanentemente.')
        .addChannelOption((o) =>
          o.setName('channel')
            .setDescription('Canal de voz al que entrar (no hace falta que tú estés dentro).')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(true)))
    .addSubcommand((s) =>
      s.setName('leave').setDescription('El bot sale del canal de voz.')),

  async execute(interaction, config) {
    const lang = pickLanguage(config, interaction.guild);
    const sub = interaction.options.getSubcommand();

    if (sub === 'join') {
      const vc = interaction.options.getChannel('channel');
      if (!vc || (vc.type !== ChannelType.GuildVoice && vc.type !== ChannelType.GuildStageVoice)) {
        return interaction.reply({
          embeds: [{ color: 0xef4444, title: t(lang, 'wolf.cmd.voice.invalidChannelTitle'), description: t(lang, 'wolf.cmd.voice.invalidChannelDesc') }],
          flags: MessageFlags.Ephemeral,
        });
      }

      const me = interaction.guild.members.me;
      if (
        !vc.permissionsFor(me)?.has(PermissionFlagsBits.Connect) ||
        !vc.permissionsFor(me)?.has(PermissionFlagsBits.Speak)
      ) {
        return interaction.reply({
          embeds: [{ color: 0xef4444, title: t(lang, 'wolf.cmd.voice.noPermsTitle'), description: t(lang, 'wolf.cmd.voice.noPermsDesc', { channel: `${vc}` }) }],
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        joinVoiceChannel({
          channelId: vc.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false,
        });
        return interaction.reply({
          embeds: [{ color: 0x22c55e, title: t(lang, 'wolf.cmd.voice.joinedTitle'), description: t(lang, 'wolf.cmd.voice.joinedDesc', { channel: `${vc}` }) }],
        });
      } catch (err) {
        logger.error('voice join error', { error: err?.message });
        return interaction.reply({
          embeds: [{ color: 0xef4444, title: 'Error', description: '```' + String(err?.message || err).slice(0, 500) + '```' }],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (sub === 'leave') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) {
        return interaction.reply({
          embeds: [{ color: 0xf5b942, title: t(lang, 'wolf.cmd.voice.notConnectedTitle'), description: t(lang, 'wolf.cmd.voice.notConnectedDesc') }],
          flags: MessageFlags.Ephemeral,
        });
      }
      try {
        connection.destroy();
      } catch (err) {
        logger.error('voice leave error', { error: err?.message });
      }
      return interaction.reply({
        embeds: [{ color: 0x7b6cff, title: t(lang, 'wolf.cmd.voice.leftTitle'), description: t(lang, 'wolf.cmd.voice.leftDesc') }],
      });
    }
  },
};
