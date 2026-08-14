import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const MINE_COOLDOWN = 60 * 60 * 1000;
const BASE_MIN_REWARD = 400;
const BASE_MAX_REWARD = 1200;
const PICKAXE_MULTIPLIER = 1.2;
const DIAMOND_PICKAXE_MULTIPLIER = 2.0;

export default {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Go mining to earn money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);
        const lastMine = userData.lastMine || 0;
        const hasDiamondPickaxe = userData.inventory["diamond_pickaxe"] || 0;
        const hasPickaxe = userData.inventory["pickaxe"] || 0;

        if (now < lastMine + MINE_COOLDOWN) {
            const remaining = lastMine + MINE_COOLDOWN - now;
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            throw createError(
                "Mining cooldown active",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.mineCooldown', { hours, minutes }),
                { remaining, cooldownType: 'mine' }
            );
        }

        const baseEarned = Math.floor(Math.random() * (BASE_MAX_REWARD - BASE_MIN_REWARD + 1)) + BASE_MIN_REWARD;
        let finalEarned = baseEarned;
        let bonus = "";

        if (hasDiamondPickaxe > 0) {
            finalEarned = Math.floor(baseEarned * DIAMOND_PICKAXE_MULTIPLIER);
            bonus = t(lang, 'wolf.cmd.economy.mineDiamondBonus');
        } else if (hasPickaxe > 0) {
            finalEarned = Math.floor(baseEarned * PICKAXE_MULTIPLIER);
            bonus = t(lang, 'wolf.cmd.economy.minePickBonus');
        }

        const locIdx = Math.floor(Math.random() * 5) + 1;
        const location = t(lang, `wolf.cmd.economy.mineLoc${locIdx}`);

        userData.wallet += finalEarned;
        userData.lastMine = now;
        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            t(lang, 'wolf.cmd.economy.mineSuccessTitle'),
            t(lang, 'wolf.cmd.economy.mineSuccessDesc', { location, amount: finalEarned.toLocaleString(), bonus })
        )
            .addFields({ name: t(lang, 'wolf.cmd.economy.mineNewCash'), value: `$${userData.wallet.toLocaleString()}`, inline: true })
            .setFooter({ text: t(lang, 'wolf.cmd.economy.mineFooter') });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'mine' })
};
