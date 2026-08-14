import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { t, pickLanguage } from '../services/i18n.js';
import { getGuildConfig } from '../services/guildConfig.js';

function createControlButtons(countdownId, isPaused = false, lang = 'en') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`countdown_pause:${countdownId}`)
            .setLabel(isPaused ? t(lang, 'wolf.cmd.tools.countdown.labelResume') : t(lang, 'wolf.cmd.tools.countdown.labelPause'))
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`countdown_cancel:${countdownId}`)
            .setLabel(t(lang, 'wolf.cmd.tools.countdown.labelCancel'))
            .setStyle(ButtonStyle.Danger),
    );
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [
        h > 0 ? h.toString().padStart(2, "0") : null,
        m.toString().padStart(2, "0"),
        s.toString().padStart(2, "0"),
    ]
        .filter(Boolean)
        .join(":");
}

function startCountdown(countdownId, countdownData, activeCountdowns) {
    if (countdownData.interval) {
        clearInterval(countdownData.interval);
        countdownData.interval = null;
    }

    const lang = countdownData.lang || 'en';

    logger.info(`Countdown started: ${countdownData.title} (${countdownData.remainingTime / 1000}s remaining)`);

    countdownData.interval = setInterval(async () => {
        try {
            if (countdownData.isPaused) return;

            const now = Date.now();
            const remaining = Math.max(0, countdownData.endTime - now);
            countdownData.remainingTime = remaining;

            if (now - countdownData.lastUpdate >= 1000) {
                countdownData.lastUpdate = now;

                const embed = successEmbed(
                    `⏱️ ${countdownData.title}`,
                    t(lang, 'wolf.cmd.tools.countdown.remaining', { time: formatTime(Math.ceil(remaining / 1000)) }),
                );

                try {
                    await countdownData.message.edit({
                        embeds: [embed],
                        components: [
                            createControlButtons(
                                countdownId,
                                countdownData.isPaused,
                                lang
                            ),
                        ],
                    });
                } catch (error) {
                    logger.error("Error updating countdown message:", error);
                }
            }

            if (remaining <= 0) {
                clearInterval(countdownData.interval);

                const finishedEmbed = successEmbed(
                    `⏱️ ${countdownData.title} (${t(lang, 'wolf.cmd.tools.countdown.statusFinished')})`,
                    t(lang, 'wolf.cmd.tools.countdown.timeUp'),
                );

                await countdownData.message.edit({
                    embeds: [finishedEmbed],
                    components: [],
                });

                cleanupCountdown(countdownId, activeCountdowns);
            }
        } catch (error) {
            logger.error("Countdown update error:", error);
            cleanupCountdown(countdownId, activeCountdowns);
        }
    }, 100);
}

function cleanupCountdown(countdownId, activeCountdowns) {
    const countdownData = activeCountdowns.get(countdownId);
    if (countdownData) {
        clearInterval(countdownData.interval);
        activeCountdowns.delete(countdownId);
    }
}

async function countdownButtonHandler(interaction, client, args) {
    try {
        const { activeCountdowns } = await import('../commands/Tools/countdown.js');
        const action = args[0];
        const countdownId = args[1];

        const countdownData = activeCountdowns.get(countdownId);

        let lang = 'en';
        if (countdownData && countdownData.lang) {
            lang = countdownData.lang;
        } else {
            try {
                const config = await getGuildConfig(client, interaction.guildId);
                lang = pickLanguage(config, interaction.guild);
            } catch (err) {
                logger.error('Failed to get guild config or language in countdownButtonHandler:', err);
            }
        }

        if (!countdownData) {
            return await interaction.reply({
                content: t(lang, 'wolf.cmd.tools.countdown.expired'),
                flags: ["Ephemeral"],
            });
        }

        if (!interaction.member.permissions.has("ManageMessages")) {
            return await interaction.reply({
                content: t(lang, 'wolf.cmd.tools.countdown.noPerms'),
                flags: ["Ephemeral"],
            });
        }

        switch (action) {
            case "pause":
                if (countdownData.isPaused) {
                    countdownData.isPaused = false;
                    countdownData.endTime = Date.now() + countdownData.remainingTime;
                    startCountdown(countdownId, countdownData, activeCountdowns);

                    const currentEmbed = countdownData.message.embeds[0];
                    await countdownData.message.edit({
                        embeds: [currentEmbed],
                        components: [createControlButtons(countdownId, false, lang)],
                    });

                    await interaction.reply({
                        content: t(lang, 'wolf.cmd.tools.countdown.resumed'),
                        flags: ["Ephemeral"],
                    });
                } else {
                    clearInterval(countdownData.interval);
                    countdownData.isPaused = true;
                    countdownData.remainingTime = countdownData.endTime - Date.now();

                    const currentEmbed = countdownData.message.embeds[0];
                    await countdownData.message.edit({
                        embeds: [currentEmbed],
                        components: [createControlButtons(countdownId, true, lang)],
                    });

                    await interaction.reply({
                        content: t(lang, 'wolf.cmd.tools.countdown.paused'),
                        flags: ["Ephemeral"],
                    });
                }
                break;

            case "cancel":
                clearInterval(countdownData.interval);

                const embed = successEmbed(
                    `⏱️ ${countdownData.title} (${t(lang, 'wolf.cmd.tools.countdown.statusCancelled')})`,
                    t(lang, 'wolf.cmd.tools.countdown.wasCancelled'),
                );

                await countdownData.message.edit({
                    embeds: [embed],
                    components: [],
                });

                cleanupCountdown(countdownId, activeCountdowns);

                await interaction.reply({
                    content: t(lang, 'wolf.cmd.tools.countdown.cancelled'),
                    flags: ["Ephemeral"],
                });
                break;
        }
    } catch (error) {
        logger.error('Countdown button handler error:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                let errLang = 'en';
                try {
                    const config = await getGuildConfig(client, interaction.guildId);
                    errLang = pickLanguage(config, interaction.guild);
                } catch (e) {}
                await interaction.reply({
                    embeds: [errorEmbed('Error', t(errLang, 'wolf.cmd.tools.countdown.errControl'))],
                    flags: ['Ephemeral']
                });
            }
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

export { createControlButtons, formatTime, startCountdown, cleanupCountdown, countdownButtonHandler };
export default countdownButtonHandler;
