import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const COOLDOWN = 30 * 60 * 1000;
const MIN_WIN = 50;
const MAX_WIN = 200;
const SUCCESS_CHANCE = 0.7;

export default {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for a small amount of money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        let userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data",
                ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.failedToLoad'),
                { userId, guildId }
            );
        }

        const lastBeg = userData.lastBeg || 0;
        const remainingTime = lastBeg + COOLDOWN - Date.now();

        if (remainingTime > 0) {
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            const timeMessage = minutes > 0 ? `${minutes}m` : `${seconds}s`;

            throw createError(
                "Beg cooldown active",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.begCooldown', { time: timeMessage }),
                { remainingTime, minutes, seconds, cooldownType: 'beg' }
            );
        }

        const success = Math.random() < SUCCESS_CHANCE;

        let replyEmbed;
        let newCash = userData.wallet;

        if (success) {
            const amountWon = Math.floor(Math.random() * (MAX_WIN - MIN_WIN + 1)) + MIN_WIN;
            newCash += amountWon;

            const idx = Math.floor(Math.random() * 4) + 1;
            const msg = t(lang, `wolf.cmd.economy.begSuccess${idx}`, { amount: amountWon.toLocaleString() });

            replyEmbed = successEmbed(t(lang, 'wolf.cmd.economy.begSuccessTitle'), msg);
        } else {
            const idx = Math.floor(Math.random() * 4) + 1;
            const msg = t(lang, `wolf.cmd.economy.begFail${idx}`);

            replyEmbed = errorEmbed(t(lang, 'wolf.cmd.economy.begFailTitle'), msg);
        }

        userData.wallet = newCash;
        userData.lastBeg = Date.now();

        await setEconomyData(client, guildId, userId, userData);

        await InteractionHelper.safeEditReply(interaction, { embeds: [replyEmbed] });
    }, { command: 'beg' })
};
