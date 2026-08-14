import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const ROB_COOLDOWN = 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = 0.25;
const ROB_PERCENTAGE = 0.15;
const FINE_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user (very risky)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to rob')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const robberId = interaction.user.id;
        const victimUser = interaction.options.getUser("user");
        const guildId = interaction.guildId;
        const now = Date.now();

        if (robberId === victimUser.id) {
            throw createError("Cannot rob self", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.robNoSelf'),
                { robberId, victimId: victimUser.id });
        }

        if (victimUser.bot) {
            throw createError("Cannot rob bot", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.robNoBot'),
                { victimId: victimUser.id, isBot: true });
        }

        const robberData = await getEconomyData(client, guildId, robberId);
        const victimData = await getEconomyData(client, guildId, victimUser.id);

        if (!robberData || !victimData) {
            throw createError("Failed to load economy data", ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.robFailLoad'),
                { robberId: !!robberData, victimId: !!victimData, guildId });
        }

        const lastRob = robberData.lastRob || 0;

        if (now < lastRob + ROB_COOLDOWN) {
            const remaining = lastRob + ROB_COOLDOWN - now;
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            throw createError("Robbery cooldown active", ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.robCooldown', { hours, minutes }),
                { remaining, hours, minutes, cooldownType: 'rob' });
        }

        if (victimData.wallet < 500) {
            throw createError("Victim too poor", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.robTooPoor', { user: victimUser.username }),
                { victimWallet: victimData.wallet, required: 500 });
        }

        const hasSafe = victimData.inventory["personal_safe"] || 0;

        if (hasSafe > 0) {
            robberData.lastRob = now;
            await setEconomyData(client, guildId, robberId, robberData);

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [warningEmbed(
                    t(lang, 'wolf.cmd.economy.robSafeTitle'),
                    t(lang, 'wolf.cmd.economy.robSafe', { user: victimUser.username })
                )],
            });
        }

        const isSuccessful = Math.random() < BASE_ROB_SUCCESS_CHANCE;
        let resultEmbed;

        if (isSuccessful) {
            const amountStolen = Math.floor(victimData.wallet * ROB_PERCENTAGE);
            robberData.wallet = (robberData.wallet || 0) + amountStolen;
            victimData.wallet = (victimData.wallet || 0) - amountStolen;

            resultEmbed = successEmbed(
                t(lang, 'wolf.cmd.economy.robSuccessTitle'),
                t(lang, 'wolf.cmd.economy.robSuccessDesc', { amount: amountStolen.toLocaleString(), user: victimUser.username })
            );
        } else {
            const fineAmount = Math.floor((robberData.wallet || 0) * FINE_PERCENTAGE);
            if ((robberData.wallet || 0) < fineAmount) {
                robberData.wallet = 0;
            } else {
                robberData.wallet = (robberData.wallet || 0) - fineAmount;
            }

            resultEmbed = errorEmbed(
                t(lang, 'wolf.cmd.economy.robFailTitle'),
                t(lang, 'wolf.cmd.economy.robFailDesc', { fine: fineAmount.toLocaleString() })
            );
        }

        robberData.lastRob = now;

        await setEconomyData(client, guildId, robberId, robberData);
        await setEconomyData(client, guildId, victimUser.id, victimData);

        resultEmbed
            .addFields(
                { name: t(lang, 'wolf.cmd.economy.robYourCash', { user: interaction.user.username }), value: `$${robberData.wallet.toLocaleString()}`, inline: true },
                { name: t(lang, 'wolf.cmd.economy.robVictimCash', { user: victimUser.username }), value: `$${victimData.wallet.toLocaleString()}`, inline: true },
            )
            .setFooter({ text: t(lang, 'wolf.cmd.economy.robFooter') });

        await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'rob' })
};
