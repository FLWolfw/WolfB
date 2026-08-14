import { createEmbed } from '../../../utils/embeds.js';
import { getUserBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../../services/i18n.js';

export default {
    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            await InteractionHelper.safeDefer(interaction);

            const targetUser = interaction.options.getUser("user") || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;

            const birthdayData = await getUserBirthday(client, guildId, userId);

            if (!birthdayData) {
                const isSelf = targetUser.id === interaction.user.id;
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.noBirthdayTitle'),
                        description: isSelf
                            ? t(lang, 'wolf.cmd.birthday.noBirthdayDescSelf')
                            : t(lang, 'wolf.cmd.birthday.noBirthdayDescOther', { user: targetUser.username }),
                        color: 'error'
                    })]
                });
            }

            const isSelf = targetUser.id === interaction.user.id;
            const embed = createEmbed({
                title: t(lang, 'wolf.cmd.birthday.infoTitle'),
                description: t(lang, 'wolf.cmd.birthday.infoDesc', {
                    month: birthdayData.monthName,
                    day: birthdayData.day,
                    user: targetUser.toString()
                }),
                color: 'info',
                footer: isSelf
                    ? t(lang, 'wolf.cmd.birthday.footerSelf')
                    : t(lang, 'wolf.cmd.birthday.footerOther', { user: targetUser.username })
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            logger.info('Birthday info retrieved successfully', {
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                guildId,
                commandName: 'birthday_info'
            });
        } catch (error) {
            logger.error("Birthday info command execution failed", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_info'
            });
            await handleInteractionError(interaction, error, { commandName: 'birthday_info', source: 'birthday_info_module' });
        }
    }
};
