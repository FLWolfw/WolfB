import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const FISH_COOLDOWN = 45 * 60 * 1000;
const BASE_MIN_REWARD = 300;
const BASE_MAX_REWARD = 900;
const FISHING_ROD_MULTIPLIER = 1.5;

const FISH_TYPES = [
    { name: 'Bass', emoji: '🐟', rarity: 'common' },
    { name: 'Salmon', emoji: '🐟', rarity: 'common' },
    { name: 'Trout', emoji: '🐟', rarity: 'common' },
    { name: 'Tuna', emoji: '🐟', rarity: 'uncommon' },
    { name: 'Swordfish', emoji: '🐟', rarity: 'uncommon' },
    { name: 'Octopus', emoji: '🐙', rarity: 'rare' },
    { name: 'Lobster', emoji: '🦞', rarity: 'rare' },
    { name: 'Shark', emoji: '🦈', rarity: 'epic' },
    { name: 'Whale', emoji: '🐋', rarity: 'legendary' },
];

export default {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing to catch fish and earn money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);
        const lastFish = userData.lastFish || 0;
        const hasFishingRod = userData.inventory["fishing_rod"] || 0;

        if (now < lastFish + FISH_COOLDOWN) {
            const remaining = lastFish + FISH_COOLDOWN - now;
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            throw createError(
                "Fishing cooldown active",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.fishCooldown', { hours, minutes }),
                { remaining, cooldownType: 'fish' }
            );
        }

        const rand = Math.random();
        let fishCaught;

        if (rand < 0.5) {
            fishCaught = FISH_TYPES.filter(f => f.rarity === 'common')[Math.floor(Math.random() * 3)];
        } else if (rand < 0.75) {
            fishCaught = FISH_TYPES.filter(f => f.rarity === 'uncommon')[Math.floor(Math.random() * 2)];
        } else if (rand < 0.9) {
            fishCaught = FISH_TYPES.filter(f => f.rarity === 'rare')[Math.floor(Math.random() * 2)];
        } else if (rand < 0.98) {
            fishCaught = FISH_TYPES.find(f => f.rarity === 'epic');
        } else {
            fishCaught = FISH_TYPES.find(f => f.rarity === 'legendary');
        }

        const baseEarned = Math.floor(Math.random() * (BASE_MAX_REWARD - BASE_MIN_REWARD + 1)) + BASE_MIN_REWARD;
        let finalEarned = baseEarned;
        let bonus = "";

        if (hasFishingRod > 0) {
            finalEarned = Math.floor(baseEarned * FISHING_ROD_MULTIPLIER);
            bonus = t(lang, 'wolf.cmd.economy.fishRodBonus');
        }

        const catchIdx = Math.floor(Math.random() * 5) + 1;
        const catchMessage = t(lang, `wolf.cmd.economy.fishCatch${catchIdx}`);

        userData.wallet += finalEarned;
        userData.lastFish = now;
        await setEconomyData(client, guildId, userId, userData);

        const rarityColors = {
            common: '#95A5A6',
            uncommon: '#2ECC71',
            rare: '#3498DB',
            epic: '#9B59B6',
            legendary: '#F1C40F'
        };

        const embed = createEmbed({
            title: t(lang, 'wolf.cmd.economy.fishSuccessTitle'),
            description: t(lang, 'wolf.cmd.economy.fishSuccessDesc', {
                catchMsg: catchMessage,
                emoji: fishCaught.emoji,
                name: fishCaught.name,
                amount: finalEarned.toLocaleString(),
                bonus,
            }),
            color: rarityColors[fishCaught.rarity]
        })
            .addFields(
                { name: t(lang, 'wolf.cmd.economy.fishNewCash'), value: `$${userData.wallet.toLocaleString()}`, inline: true },
                { name: t(lang, 'wolf.cmd.economy.fishRarity'), value: fishCaught.rarity.charAt(0).toUpperCase() + fishCaught.rarity.slice(1), inline: true }
            )
            .setFooter({ text: t(lang, 'wolf.cmd.economy.fishFooter') });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'fish' })
};
