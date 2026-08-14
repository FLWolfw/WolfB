import { createEmbed } from '../../../utils/embeds.js';
import { getAllBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../../services/i18n.js';

export default {
    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            await InteractionHelper.safeDefer(interaction);

            const guildId = interaction.guildId;
            const sortedBirthdays = await getAllBirthdays(client, guildId);

            if (sortedBirthdays.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.noBirthdaysTitle'),
                        description: t(lang, 'wolf.cmd.birthday.noBirthdaysDesc'),
                        color: 'error'
                    })]
                });
            }

            const embed = createEmbed({
                title: t(lang, 'wolf.cmd.birthday.serverBirthdaysTitle'),
                color: 'info'
            });

            const userIds = sortedBirthdays.map(b => b.userId);
            const fetchedMembers = await interaction.guild.members.fetch({ user: userIds }).catch(() => null);

            let birthdayList = '';
            let displayIndex = 0;
            const staleUserIds = [];

            for (const birthday of sortedBirthdays) {
                if (fetchedMembers && !fetchedMembers.has(birthday.userId)) {
                    staleUserIds.push(birthday.userId);
                    continue;
                }
                displayIndex++;
                birthdayList += `${displayIndex}. <@${birthday.userId}> - ${birthday.monthName} ${birthday.day}\n`;
            }

            if (fetchedMembers && staleUserIds.length > 0) {
                for (const userId of staleUserIds) {
                    deleteBirthday(client, guildId, userId).catch(() => null);
                }
            }

            if (displayIndex === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.noBirthdaysTitle'),
                        description: t(lang, 'wolf.cmd.birthday.noCurrentDesc'),
                        color: 'error'
                    })]
                });
            }

            birthdayList = t(lang, 'wolf.cmd.birthday.listHeader', { n: displayIndex, guild: interaction.guild.name }) + birthdayList;

            embed.setDescription(birthdayList);
            embed.setFooter({ text: t(lang, 'wolf.cmd.birthday.listFooter', { n: displayIndex }) });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            logger.info('Birthday list retrieved successfully', {
                userId: interaction.user.id,
                guildId,
                birthdayCount: displayIndex,
                staleRemoved: staleUserIds.length,
                commandName: 'birthday_list'
            });
        } catch (error) {
            logger.error("Birthday list command execution failed", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_list'
            });
            await handleInteractionError(interaction, error, { commandName: 'birthday_list', source: 'birthday_list_module' });
        }
    }
};
