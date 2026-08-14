import { SlashCommandBuilder, version, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View bot statistics"),

  async execute(interaction, config) {
    const lang = pickLanguage(config, interaction.guild);
    try {
      await InteractionHelper.safeDefer(interaction);

      const totalGuilds = interaction.client.guilds.cache.size;
      const totalMembers = interaction.client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0,
      );
      const nodeVersion = process.version;

      const embed = createEmbed({ title: t(lang, 'wolf.cmd.stats.title'), description: t(lang, 'wolf.cmd.stats.description') }).addFields(
        { name: t(lang, 'wolf.cmd.stats.servers'), value: `${totalGuilds}`, inline: true },
        { name: t(lang, 'wolf.cmd.stats.users'), value: `${totalMembers}`, inline: true },
        { name: "Node.js", value: `${nodeVersion}`, inline: true },
        { name: "Discord.js", value: `v${version}`, inline: true },
        {
          name: t(lang, 'wolf.cmd.stats.memory'),
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          inline: true,
        },
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Stats command error:', error);
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({ title: t(lang, 'wolf.cmd.stats.errorTitle'), description: t(lang, 'wolf.cmd.stats.errorDesc'), color: 'error' })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};




