import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const BASE_WIN_CHANCE = 0.4;
const CLOVER_WIN_BONUS = 0.1;
const CHARM_WIN_BONUS = 0.08;
const PAYOUT_MULTIPLIER = 2.0;
const GAMBLE_COOLDOWN = 5 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your money for a chance to win more')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to gamble')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const betAmount = interaction.options.getInteger("amount");
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);
        const lastGamble = userData.lastGamble || 0;
        const cloverCount = userData.inventory["lucky_clover"] || 0;
        const charmCount = userData.inventory["lucky_charm"] || 0;

        if (now < lastGamble + GAMBLE_COOLDOWN) {
            const remaining = lastGamble + GAMBLE_COOLDOWN - now;
            const minutes = Math.floor(remaining / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            throw createError(
                "Gamble cooldown active",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.gambleCooldown', { minutes, seconds }),
                { remaining, cooldownType: 'gamble' }
            );
        }

        if (userData.wallet < betAmount) {
            throw createError(
                "Insufficient cash for gamble",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.gambleNotEnough', { current: userData.wallet.toLocaleString(), bet: betAmount.toLocaleString() }),
                { required: betAmount, current: userData.wallet }
            );
        }

        let winChance = BASE_WIN_CHANCE;
        let bonusMsg = "";
        let usedClover = false;
        let usedCharm = false;

        if (cloverCount > 0) {
            winChance += CLOVER_WIN_BONUS;
            userData.inventory["lucky_clover"] -= 1;
            bonusMsg = t(lang, 'wolf.cmd.economy.gambleClover');
            usedClover = true;
        } else if (charmCount > 0) {
            winChance += CHARM_WIN_BONUS;
            userData.inventory["lucky_charm"] -= 1;
            bonusMsg = t(lang, 'wolf.cmd.economy.gambleCharm', { remaining: charmCount - 1 });
            usedCharm = true;
        }

        const win = Math.random() < winChance;
        let cashChange = 0;
        let resultEmbed;

        if (win) {
            const amountWon = Math.floor(betAmount * PAYOUT_MULTIPLIER);
            cashChange = amountWon;
            resultEmbed = successEmbed(
                t(lang, 'wolf.cmd.economy.gambleWonTitle'),
                t(lang, 'wolf.cmd.economy.gambleWonDesc', { bet: betAmount.toLocaleString(), won: amountWon.toLocaleString(), bonus: bonusMsg })
            );
        } else {
            cashChange = -betAmount;
            resultEmbed = errorEmbed(
                t(lang, 'wolf.cmd.economy.gambleLostTitle'),
                t(lang, 'wolf.cmd.economy.gambleLostDesc', { bet: betAmount.toLocaleString() })
            );
        }

        userData.wallet = (userData.wallet || 0) + cashChange;
        userData.lastGamble = now;
        await setEconomyData(client, guildId, userId, userData);

        const newCash = userData.wallet;

        resultEmbed.addFields({
            name: t(lang, 'wolf.cmd.economy.gambleNewCash'),
            value: `$${newCash.toLocaleString()}`,
            inline: true,
        });

        const pct = Math.round(winChance * 100);
        const basePct = Math.round(BASE_WIN_CHANCE * 100);

        if (usedClover) {
            resultEmbed.setFooter({ text: t(lang, 'wolf.cmd.economy.gambleFooterClover', { n: userData.inventory["lucky_clover"], pct }) });
        } else if (usedCharm) {
            resultEmbed.setFooter({ text: t(lang, 'wolf.cmd.economy.gambleFooterCharm', { n: userData.inventory["lucky_charm"], pct }) });
        } else {
            resultEmbed.setFooter({ text: t(lang, 'wolf.cmd.economy.gambleFooter', { pct: basePct }) });
        }

        await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'gamble' })
};
