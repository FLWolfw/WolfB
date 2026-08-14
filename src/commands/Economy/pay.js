import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import EconomyService from '../../services/economyService.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Pay another user some of your cash')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to pay')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to pay')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const guildId = interaction.guildId;

        logger.debug(`[ECONOMY] Pay command initiated`, { senderId, receiverId: receiver.id, amount, guildId });

        if (receiver.bot) {
            throw createError("Cannot pay bot", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.payNoBot'),
                { receiverId: receiver.id, isBot: true });
        }

        if (receiver.id === senderId) {
            throw createError("Cannot pay self", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.payNoSelf'),
                { senderId, receiverId: receiver.id });
        }

        if (amount <= 0) {
            throw createError("Invalid payment amount", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.payAmountInvalid'),
                { amount, senderId });
        }

        const [senderData, receiverData] = await Promise.all([
            getEconomyData(client, guildId, senderId),
            getEconomyData(client, guildId, receiver.id)
        ]);

        if (!senderData) {
            throw createError("Failed to load sender economy data", ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.paySenderFailed'),
                { userId: senderId, guildId });
        }

        if (!receiverData) {
            throw createError("Failed to load receiver economy data", ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.payReceiverFailed'),
                { userId: receiver.id, guildId });
        }

        await EconomyService.transferMoney(client, guildId, senderId, receiver.id, amount);

        const updatedSenderData = await getEconomyData(client, guildId, senderId);
        const updatedReceiverData = await getEconomyData(client, guildId, receiver.id);

        const embed = successEmbed(
            t(lang, 'wolf.cmd.economy.paySuccessTitle'),
            t(lang, 'wolf.cmd.economy.paySuccessDesc', { user: receiver.username, amount: amount.toLocaleString() })
        )
            .addFields(
                { name: t(lang, 'wolf.cmd.economy.payAmountLabel'), value: `$${amount.toLocaleString()}`, inline: true },
                { name: t(lang, 'wolf.cmd.economy.payNewBalance'), value: `$${updatedSenderData.wallet.toLocaleString()}`, inline: true },
            )
            .setFooter({
                text: t(lang, 'wolf.cmd.economy.payFooter', { user: receiver.tag }),
                iconURL: receiver.displayAvatarURL(),
            });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        logger.info(`[ECONOMY] Payment sent successfully`, {
            senderId, receiverId: receiver.id, amount,
            senderBalance: updatedSenderData.wallet,
            receiverBalance: updatedReceiverData.wallet
        });

        try {
            const receiverEmbed = createEmbed({
                title: t(lang, 'wolf.cmd.economy.payIncomingTitle'),
                description: t(lang, 'wolf.cmd.economy.payIncomingDesc', { user: interaction.user.username, amount: amount.toLocaleString() })
            }).addFields({
                name: t(lang, 'wolf.cmd.economy.payYourNewCash'),
                value: `$${updatedReceiverData.wallet.toLocaleString()}`,
                inline: true,
            });
            await receiver.send({ embeds: [receiverEmbed] });
        } catch (e) {
            logger.warn(`Could not DM user ${receiver.id}: ${e.message}`);
        }
    }, { command: 'pay' })
};
