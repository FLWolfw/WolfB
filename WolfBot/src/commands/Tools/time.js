import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Get the current time in different timezones')
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('The timezone to display (e.g., UTC, America/New_York)')
                .setRequired(false)),

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        await InteractionHelper.safeExecute(
            interaction,
            async () => {
                const timezone = interaction.options.getString('timezone') || 'UTC';

                let timeString;
                try {
                    timeString = new Date().toLocaleString('en-US', {
                        timeZone: timezone,
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    });
                } catch (error) {
                    logger.warn(`Invalid timezone requested: ${timezone}`);
                    const embed = errorEmbed(
                        t(lang, 'wolf.cmd.tools.time.invalidTimezoneTitle'),
                        t(lang, 'wolf.cmd.tools.time.invalidTimezoneDesc')
                    );
                    embed.setColor(getColor('error'));
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [embed],
                    });
                    return;
                }

                const now = new Date();
                const unixTimestamp = Math.floor(now.getTime() / 1000);

                const embed = successEmbed(
                    t(lang, 'wolf.cmd.tools.time.successTitle'),
                    t(lang, 'wolf.cmd.tools.time.successDesc', {
                        timezone,
                        timeString,
                        unixTimestamp,
                        isoString: now.toISOString()
                    })
                );

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            },
            t(lang, 'wolf.cmd.tools.time.sysError'),
            {
                autoDefer: true,
                deferOptions: { flags: MessageFlags.Ephemeral }
            }
        );
    },
};




