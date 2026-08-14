import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your or someone else's balance")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check balance for')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const targetUser = interaction.options.getUser("user") || interaction.user;
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Balance check for ${targetUser.id}`, { userId: targetUser.id, guildId });

            if (targetUser.bot) {
                throw createError("Bot user queried for balance", ErrorTypes.VALIDATION, t(lang, 'wolf.cmd.economy.botNoBalance'));
            }

            const userData = await getEconomyData(client, guildId, targetUser.id);

            if (!userData) {
                throw createError("Failed to load economy data", ErrorTypes.DATABASE, t(lang, 'wolf.cmd.economy.failedToLoad'), { userId: targetUser.id, guildId });
            }

            const maxBank = getMaxBankCapacity(userData);

            const wallet = typeof userData.wallet === 'number' ? userData.wallet : 0;
            const bank = typeof userData.bank === 'number' ? userData.bank : 0;

            const embed = createEmbed({
                title: `💰 ${t(lang, 'wolf.cmd.economy.balanceTitle', { user: targetUser.username })}`,
                description: t(lang, 'wolf.cmd.economy.balanceDesc', { user: targetUser.username }),
            })
                .addFields(
                    { name: t(lang, 'wolf.cmd.economy.cash'), value: `$${wallet.toLocaleString()}`, inline: true },
                    { name: t(lang, 'wolf.cmd.economy.bank'), value: `$${bank.toLocaleString()} / $${maxBank.toLocaleString()}`, inline: true },
                    { name: t(lang, 'wolf.cmd.economy.total'), value: `$${(wallet + bank).toLocaleString()}`, inline: true },
                )
                .setFooter({
                    text: t(lang, 'wolf.cmd.economy.requestedBy', { user: interaction.user.tag }),
                    iconURL: interaction.user.displayAvatarURL(),
                });

            logger.info(`[ECONOMY] Balance retrieved`, { userId: targetUser.id, wallet, bank });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'balance' })
};




