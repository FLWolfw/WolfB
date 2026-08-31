import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';
export default {
    data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get detailed information about a user")
    .addUserOption((option) => option.setName("target").setDescription("The user to inspect (defaults to you)")),

  async execute(interaction, config) {
    const lang = pickLanguage(config, interaction.guild);
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) return;

      const user = interaction.options.getUser("target") || interaction.user;
      const member = interaction.guild?.members.cache.get(user.id);
      const tr = (key, fallback) => {
        const value = t(lang, key);
        return typeof value === 'string' && value.trim() ? value : fallback;
      };

      const createdTimestamp = Math.floor(user.createdAt.getTime() / 1000);
      const joinedTimestamp = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;
      const roles = member && member.roles.cache.size > 1
        ? member.roles.cache.map(r => r.name).slice(0, 5).join(', ')
        : tr('wolf.cmd.userinfo.none', 'Ninguno');

      const embed = createEmbed({
        title: tr('wolf.cmd.userinfo.title', `Información de ${user.username}`),
        description: `Información de usuario para ${user.tag}`,
      })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: tr('wolf.cmd.userinfo.id', 'ID'), value: user.id, inline: true },
          { name: tr('wolf.cmd.userinfo.bot', 'Bot'), value: user.bot ? tr('wolf.cmd.userinfo.yes', 'Sí') : tr('wolf.cmd.userinfo.no', 'No'), inline: true },
          { name: tr('wolf.cmd.userinfo.roles', 'Roles'), value: roles, inline: true },
          { name: tr('wolf.cmd.userinfo.createdAt', 'Cuenta creada'), value: `<t:${createdTimestamp}:R>`, inline: false },
          { name: tr('wolf.cmd.userinfo.joinedAt', 'Entró al servidor'), value: joinedTimestamp ? `<t:${joinedTimestamp}:R>` : tr('wolf.cmd.userinfo.notInServer', 'No está en este servidor'), inline: false },
          { name: tr('wolf.cmd.userinfo.highestRole', 'Rol más alto'), value: member?.roles?.highest?.name || tr('wolf.cmd.userinfo.none', 'Ninguno'), inline: true },
        );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.info(`UserInfo command executed`, { userId: interaction.user.id, targetUserId: user.id, guildId: interaction.guildId });
    } catch (error) {
      logger.error(`UserInfo command execution failed`, { error: error.message, stack: error.stack, userId: interaction.user.id, guildId: interaction.guildId, commandName: 'userinfo' });
      await handleInteractionError(interaction, error, { commandName: 'userinfo', source: 'userinfo_command' });
    }
  },
};