import { MessageFlags } from 'discord.js';
import { updateLanguage } from '../../services/guildConfigService.js';
import { t } from '../../services/i18n.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'wolf_lang',

  async execute(interaction, client, args) {
    const choice = (args?.[0] || '').toLowerCase();
    const lang = choice === 'en' ? 'en' : 'es';
    const langName = lang === 'en' ? 'English' : 'Español';

    try {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '❌ This setting can only be changed inside a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await updateLanguage(client.db, interaction.guildId, lang);

      await interaction.reply({
        embeds: [{
          color: 0x22c55e,
          description: t(lang, 'wolf.setup.langSet', { language: langName }),
        }],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.error('wolf_lang button failed', {
        event: 'wolf_lang.database_update_failed',
        guildId: interaction.guildId,
        userId: interaction.user?.id,
        language: lang,
        error: {
          name: err?.name,
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
          cause: err?.cause,
        },
      });

      const errorMessage = lang === 'en'
        ? '❌ I could not save the server language. Please try again in a moment.'
        : '❌ No pude guardar el idioma del servidor. Inténtalo de nuevo en un momento.';

      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      }).catch(async (replyError) => {
        logger.error('wolf_lang failed to send error response', {
          event: 'wolf_lang.error_response_failed',
          guildId: interaction.guildId,
          userId: interaction.user?.id,
          error: {
            name: replyError?.name,
            message: replyError?.message,
            code: replyError?.code,
            stack: replyError?.stack,
          },
        });
      });
    }
  },
};
