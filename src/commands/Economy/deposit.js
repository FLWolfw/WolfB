import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money from your wallet into your bank')
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to deposit (number or "all")')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const amountInput = interaction.options.getString("amount");

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data",
                ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.failedToLoad'),
                { userId, guildId }
            );
        }

        const maxBank = getMaxBankCapacity(userData);
        let depositAmount;

        if (amountInput.toLowerCase() === "all") {
            depositAmount = userData.wallet;
        } else {
            depositAmount = parseInt(amountInput);

            if (isNaN(depositAmount) || depositAmount <= 0) {
                throw createError(
                    "Invalid deposit amount",
                    ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.economy.depInvalid', { input: amountInput }),
                    { amountInput, userId }
                );
            }
        }

        if (depositAmount === 0) {
            throw createError(
                "Zero deposit amount",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.depZero'),
                { userId, walletBalance: userData.wallet }
            );
        }

        if (depositAmount > userData.wallet) {
            depositAmount = userData.wallet;
            await interaction.followUp({
                embeds: [warningEmbed(
                    t(lang, 'wolf.cmd.economy.depSuccessTitle'),
                    t(lang, 'wolf.cmd.economy.depOverWallet', { amount: depositAmount.toLocaleString() })
                )],
                flags: ["Ephemeral"],
            });
        }

        const availableSpace = maxBank - userData.bank;

        if (availableSpace <= 0) {
            throw createError(
                "Bank is full",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.depBankFull', { max: maxBank.toLocaleString() }),
                { maxBank, currentBank: userData.bank, userId }
            );
        }

        if (depositAmount > availableSpace) {
            depositAmount = availableSpace;

            if (amountInput.toLowerCase() !== "all") {
                await interaction.followUp({
                    embeds: [warningEmbed(
                        t(lang, 'wolf.cmd.economy.depSuccessTitle'),
                        t(lang, 'wolf.cmd.economy.depOverSpace', { amount: depositAmount.toLocaleString(), max: maxBank.toLocaleString() })
                    )],
                    flags: ["Ephemeral"],
                });
            }
        }

        if (depositAmount === 0) {
            throw createError(
                "No space or cash for deposit",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.depZeroFinal'),
                { depositAmount, availableSpace, walletBalance: userData.wallet }
            );
        }

        userData.wallet -= depositAmount;
        userData.bank += depositAmount;

        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            t(lang, 'wolf.cmd.economy.depSuccessTitle'),
            t(lang, 'wolf.cmd.economy.depSuccessDesc', { amount: depositAmount.toLocaleString() })
        ).addFields(
            { name: t(lang, 'wolf.cmd.economy.depNewCash'), value: `$${userData.wallet.toLocaleString()}`, inline: true },
            { name: t(lang, 'wolf.cmd.economy.depNewBank'), value: `$${userData.bank.toLocaleString()} / $${maxBank.toLocaleString()}`, inline: true },
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'deposit' })
};
