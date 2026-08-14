import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your economy inventory'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        logger.debug(`[ECONOMY] Inventory requested for ${userId}`, { userId, guildId });

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data for inventory",
                ErrorTypes.DATABASE,
                t(lang, 'wolf.cmd.economy.failedToLoad'),
                { userId, guildId }
            );
        }

        const inventory = userData.inventory || {};

        let inventoryDescription = t(lang, 'wolf.cmd.economy.invEmpty');

        if (Object.keys(inventory).length > 0) {
            const lines = Object.entries(inventory)
                .filter(([itemId, quantity]) => {
                    const item = SHOP_ITEMS.find(i => i.id === itemId);
                    return quantity > 0 && item;
                })
                .map(([itemId, quantity]) => {
                    const item = SHOP_ITEMS.find(i => i.id === itemId);
                    return `**${item.name}:** ${quantity}x`;
                });

            if (lines.length > 0) inventoryDescription = lines.join("\n");
        }

        logger.info(`[ECONOMY] Inventory retrieved`, {
            userId,
            guildId,
            itemCount: Object.keys(inventory).length
        });

        const embed = createEmbed({
            title: t(lang, 'wolf.cmd.economy.invTitle', { user: interaction.user.username }),
            description: inventoryDescription,
        }).setThumbnail(interaction.user.displayAvatarURL());

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'inventory' })
};
