import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName("shorten")
        .setDescription("Shorten a URL using is.gd")
        .addStringOption(option =>
            option
                .setName("url")
                .setDescription("The URL to shorten")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("custom")
                .setDescription("Custom URL ending (optional)")
                .setRequired(false)
        )
        .setDMPermission(false),
    category: "Tools",

    async execute(interaction, config) {
        const lang = pickLanguage(config, interaction.guild);
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });
        if (!deferSuccess) {
            logger.warn(`Shorten interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shorten'
            });
            return;
        }

        try {
            const url = interaction.options.getString("url");
            const custom = interaction.options.getString("custom");

            try {
                new URL(url);
            } catch (e) {
                const embed = errorEmbed(t(lang, "wolf.cmd.tools.shorten.errInvalidUrlTitle"), t(lang, "wolf.cmd.tools.shorten.errInvalidUrlDesc"));
                embed.setColor(getColor('error'));
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            }

            if (custom && !/^[a-zA-Z0-9_-]+$/.test(custom)) {
                const embed = errorEmbed(t(lang, "wolf.cmd.tools.shorten.errInvalidCustomTitle"), t(lang, "wolf.cmd.tools.shorten.errInvalidCustomDesc"));
                embed.setColor(getColor('error'));
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            }

            let apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
            if (custom) {
                apiUrl += `&shorturl=${encodeURIComponent(custom)}`;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            let response;
            try {
                response = await fetch(apiUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'TitanBot URL Shortener/1.0'
                    }
                });
            } catch (networkError) {
                const message = networkError?.name === 'AbortError'
                    ? t(lang, 'wolf.cmd.tools.shorten.errTimeoutDesc')
                    : t(lang, 'wolf.cmd.tools.shorten.errNetworkDesc');
                const embed = errorEmbed(t(lang, 'wolf.cmd.tools.shorten.errNetworkTitle'), message);
                embed.setColor(getColor('error'));
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                const embed = errorEmbed(t(lang, 'wolf.cmd.tools.shorten.errFailedTitle'), t(lang, 'wolf.cmd.tools.shorten.errFailedDesc', { status: response.status }));
                embed.setColor(getColor('error'));
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            }

            const shortUrl = await response.text();

            try {
                new URL(shortUrl);
            } catch (e) {
                if (shortUrl.includes("already exists")) {
                    const embed = errorEmbed(t(lang, "wolf.cmd.tools.shorten.errTakenTitle"), t(lang, "wolf.cmd.tools.shorten.errTakenDesc"));
                    embed.setColor(getColor('error'));
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [embed],
                    });
                } else if (shortUrl.includes("invalid")) {
                    const embed = errorEmbed(t(lang, "wolf.cmd.tools.shorten.errInvalidUrlTitle"), t(lang, "wolf.cmd.tools.shorten.errInvalidUrlDesc"));
                    embed.setColor(getColor('error'));
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [embed],
                    });
                }
                const embed = errorEmbed(t(lang, "wolf.cmd.tools.shorten.errFailedTitle"), t(lang, "wolf.cmd.tools.shorten.errGeneralFailedDesc", { error: shortUrl }));
                embed.setColor(getColor('error'));
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            }

            const embed = successEmbed(t(lang, "wolf.cmd.tools.shorten.successTitle"), t(lang, "wolf.cmd.tools.shorten.successDesc", { url: shortUrl }));
            embed.setColor(getColor('success'));
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
            });
        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'shorten'
            });
        }
    },
};


