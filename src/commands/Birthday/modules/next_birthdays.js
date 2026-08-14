import { createEmbed } from '../../../utils/embeds.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
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

            const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

            if (next5.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.noUpcomingTitle'),
                        description: t(lang, 'wolf.cmd.birthday.noUpcomingDesc'),
                        color: 'error'
                    })]
                });
            }

            const embed = createEmbed({
                title: t(lang, 'wolf.cmd.birthday.nextTitle'),
                description: t(lang, 'wolf.cmd.birthday.nextDesc', { guild: interaction.guild.name }),
                color: 'info'
            });

            let displayIndex = 0;
            for (const birthday of next5) {
                const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
                if (!member) {
                    deleteBirthday(client, interaction.guildId, birthday.userId).catch(() => null);
                    continue;
                }
                displayIndex++;

                let timeUntil = '';
                if (birthday.daysUntil === 0) {
                    timeUntil = t(lang, 'wolf.cmd.birthday.timeToday');
                } else if (birthday.daysUntil === 1) {
                    timeUntil = t(lang, 'wolf.cmd.birthday.timeTomorrow');
                } else {
                    const key = birthday.daysUntil > 1 ? 'wolf.cmd.birthday.timeInDays' : 'wolf.cmd.birthday.timeInDay';
                    timeUntil = t(lang, key, { n: birthday.daysUntil });
                }

                const dateLabel = t(lang, 'wolf.cmd.birthday.entryDateLabel');
                const timeLabel = t(lang, 'wolf.cmd.birthday.entryTimeLabel');

                embed.addFields({
                    name: `${displayIndex}. ${member.displayName}`,
                    value: `<@${birthday.userId}>\n${dateLabel} ${birthday.monthName} ${birthday.day}\n${timeLabel} ${timeUntil}`,
                    inline: false
                });
            }

            if (displayIndex === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: t(lang, 'wolf.cmd.birthday.noCurrentUpcomingTitle'),
                        description: t(lang, 'wolf.cmd.birthday.noCurrentUpcomingDesc'),
                        color: 'error'
                    })]
                });
            }

            embed.setFooter({
                text: t(lang, 'wolf.cmd.birthday.nextFooter'),
                iconURL: interaction.guild.iconURL()
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            logger.info('Next birthdays retrieved successfully', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                upcomingCount: displayIndex,
                commandName: 'next_birthdays'
            });
        } catch (error) {
            logger.error('Next birthdays command execution failed', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'next_birthdays'
            });
            await handleInteractionError(interaction, error, { commandName: 'next_birthdays', source: 'next_birthdays_module' });
        }
    }
};
