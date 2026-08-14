import { createEmbed, successEmbed } from '../../../utils/embeds.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../../services/i18n.js';

export default {
    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            await InteractionHelper.safeDefer(interaction);

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            const result = await deleteBirthday(client, guildId, userId);

            if (result.success) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed(
                        t(lang, 'wolf.cmd.birthday.removedTitle'),
                        t(lang, 'wolf.cmd.birthday.removedDesc')
                    )]
                });
            } else if (result.notFound) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.notSetTitle'),
                        description: t(lang, 'wolf.cmd.birthday.notSetDesc'),
                        color: 'error'
                    })]
                });
            }
        } catch (error) {
            logger.error("Birthday remove command execution failed", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_remove'
            });
            await handleInteractionError(interaction, error, { commandName: 'birthday_remove', source: 'birthday_remove_module' });
        }
    }
};
