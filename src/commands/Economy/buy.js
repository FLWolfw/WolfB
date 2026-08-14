import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID of the item to buy')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Quantity to buy (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const itemId = interaction.options.getString("item_id").toLowerCase();
        const quantity = interaction.options.getInteger("quantity") || 1;

        const item = SHOP_ITEMS.find(i => i.id === itemId);

        if (!item) {
            throw createError(
                `Item ${itemId} not found`,
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.buyItemNotFound', { id: itemId }),
                { itemId }
            );
        }

        if (quantity < 1) {
            throw createError("Invalid quantity", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.buyInvalidQty'),
                { quantity });
        }

        const totalCost = item.price * quantity;

        const guildConfig = await getGuildConfig(client, guildId);
        const PREMIUM_ROLE_ID = guildConfig.premiumRoleId;

        const userData = await getEconomyData(client, guildId, userId);

        if (userData.wallet < totalCost) {
            throw createError("Insufficient funds", ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.buyInsuff', { cost: totalCost.toLocaleString(), qty: quantity, name: item.name, current: userData.wallet.toLocaleString() }),
                { required: totalCost, current: userData.wallet, itemId, quantity });
        }

        if (item.type === "role" && itemId === "premium_role") {
            if (!PREMIUM_ROLE_ID) {
                throw createError("Premium role not configured", ErrorTypes.CONFIGURATION,
                    t(lang, 'wolf.cmd.economy.buyPremRoleNotConfigured'),
                    { itemId });
            }
            if (interaction.member.roles.cache.has(PREMIUM_ROLE_ID)) {
                throw createError("Role already owned", ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.economy.buyRoleOwned', { name: item.name }),
                    { itemId, roleId: PREMIUM_ROLE_ID });
            }
            if (quantity > 1) {
                throw createError("Invalid quantity for role", ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.economy.buyRoleQtyInvalid', { name: item.name }),
                    { itemId, quantity });
            }
        }

        userData.wallet -= totalCost;

        let successDescription = t(lang, 'wolf.cmd.economy.buySuccessDesc', { qty: quantity, name: item.name, cost: totalCost.toLocaleString() });

        if (item.type === "role" && itemId === "premium_role") {
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(PREMIUM_ROLE_ID);

            if (!role) {
                throw createError("Role not found", ErrorTypes.CONFIGURATION,
                    t(lang, 'wolf.cmd.economy.buyRoleNotExists'),
                    { roleId: PREMIUM_ROLE_ID });
            }

            try {
                await member.roles.add(role, `Purchased role: ${item.name}`);
                successDescription += t(lang, 'wolf.cmd.economy.buyRoleGranted', { role: role.toString() });
            } catch (roleError) {
                userData.wallet += totalCost;
                await setEconomyData(client, guildId, userId, userData);
                throw createError("Role assignment failed", ErrorTypes.DISCORD_API,
                    t(lang, 'wolf.cmd.economy.buyRoleAssignFail'),
                    { roleId: PREMIUM_ROLE_ID, originalError: roleError.message });
            }
        } else if (item.type === "upgrade") {
            userData.upgrades[itemId] = true;
            successDescription += t(lang, 'wolf.cmd.economy.buyUpgradeActive');
        } else if (item.type === "consumable") {
            userData.inventory[itemId] = (userData.inventory[itemId] || 0) + quantity;
        }

        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            t(lang, 'wolf.cmd.economy.buySuccessTitle'),
            successDescription,
        ).addFields({
            name: t(lang, 'wolf.cmd.economy.buyNewBalance'),
            value: `$${userData.wallet.toLocaleString()}`,
            inline: true,
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }, { command: 'buy' })
};
