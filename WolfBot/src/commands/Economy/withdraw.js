import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank to your wallet')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to withdraw')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        await InteractionHelper.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const amountInput = interaction.options.getInteger("amount");

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data",
                ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.failedToLoad'),
                { userId, guildId }
            );
        }

        let withdrawAmount = amountInput;

        if (withdrawAmount <= 0) {
            throw createError(
                "Invalid withdrawal amount",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.wdPositive'),
                { amount: withdrawAmount, userId }
            );
        }

        if (withdrawAmount > userData.bank) {
            withdrawAmount = userData.bank;
        }

        if (withdrawAmount === 0) {
            throw createError(
                "Empty bank account",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.wdEmptyBank'),
                { userId, bankBalance: userData.bank }
            );
        }

        userData.wallet += withdrawAmount;
        userData.bank -= withdrawAmount;

        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            t(lang, 'wolf.cmd.economy.wdSuccessTitle'),
            t(lang, 'wolf.cmd.economy.wdSuccessDesc', { amount: withdrawAmount.toLocaleString() })
        ).addFields(
            { name: t(lang, 'wolf.cmd.economy.wdNewCash'), value: `$${userData.wallet.toLocaleString()}`, inline: true },
            { name: t(lang, 'wolf.cmd.economy.wdNewBank'), value: `$${userData.bank.toLocaleString()}`, inline: true },
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'withdraw' })
};
