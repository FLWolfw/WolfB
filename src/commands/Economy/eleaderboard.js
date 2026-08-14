import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName("eleaderboard")
        .setDescription("View the server's top 10 richest users.")
        .setDMPermission(false),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const guildId = interaction.guildId;

        logger.debug(`[ECONOMY] Leaderboard requested`, { guildId });

        const prefix = `economy:${guildId}:`;

        let allKeys = await client.db.list(prefix);

        if (!Array.isArray(allKeys)) {
            allKeys = [];
        }

        if (allKeys.length === 0) {
            throw createError(
                "No economy data found",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.lbNoData')
            );
        }

        let allUserData = [];

        for (const key of allKeys) {
            const userId = key.replace(prefix, "");
            const userData = await client.db.get(key);

            if (userData) {
                allUserData.push({
                    userId,
                    net_worth: (userData.wallet || 0) + (userData.bank || 0),
                });
            }
        }

        allUserData.sort((a, b) => b.net_worth - a.net_worth);

        const topUsers = allUserData.slice(0, 10);
        const userRank = allUserData.findIndex((u) => u.userId === interaction.user.id) + 1;
        const rankEmoji = ["🥇", "🥈", "🥉"];
        const leaderboardEntries = [];

        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const rank = i + 1;
            const emoji = rankEmoji[i] || `**#${rank}**`;
            leaderboardEntries.push(`${emoji} <@${user.userId}> - 🏦 ${user.net_worth.toLocaleString()}`);
        }

        logger.info(`[ECONOMY] Leaderboard generated`, { guildId, userCount: allUserData.length, userRank });

        const description = leaderboardEntries.length > 0
            ? leaderboardEntries.join("\n")
            : t(lang, 'wolf.cmd.economy.lbEmptyDesc');

        const rankText = userRank > 0
            ? `#${userRank}`
            : t(lang, 'wolf.cmd.economy.lbNoRank');

        const embed = createEmbed({
            title: t(lang, 'wolf.cmd.economy.lbTitle'),
            description,
            footer: t(lang, 'wolf.cmd.economy.lbFooter', { rank: rankText }),
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'eleaderboard' })
};
