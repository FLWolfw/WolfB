import { SlashCommandBuilder } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

const CRIME_COOLDOWN = 60 * 60 * 1000;
const JAIL_TIME = 2 * 60 * 60 * 1000;

const CRIME_TYPES = [
    { name: "Pickpocketing", min: 100, max: 500, risk: 0.3 },
    { name: "Burglary", min: 300, max: 1000, risk: 0.4 },
    { name: "Bank Heist", min: 1000, max: 5000, risk: 0.6 },
    { name: "Art Theft", min: 2000, max: 10000, risk: 0.7 },
    { name: "Cybercrime", min: 5000, max: 20000, risk: 0.8 },
];

export default {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a crime to earn money (risky)')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of crime to commit')
                .setRequired(true)
                .addChoices(
                    { name: 'Pickpocketing', value: 'pickpocketing' },
                    { name: 'Burglary', value: 'burglary' },
                    { name: 'Bank Heist', value: 'bank-heist' },
                    { name: 'Art Theft', value: 'art-theft' },
                    { name: 'Cybercrime', value: 'cybercrime' },
                )
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const lang = pickLanguage(config, interaction.guild);
        await InteractionHelper.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);
        const lastCrime = userData.cooldowns?.crime || 0;
        const isJailed = userData.jailedUntil && userData.jailedUntil > now;

        if (isJailed) {
            const timeLeft = Math.ceil((userData.jailedUntil - now) / (1000 * 60));
            throw createError(
                "User is in jail",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.crimeJailed', { minutes: timeLeft }),
                { jailTimeRemaining: userData.jailedUntil - now }
            );
        }

        if (now < lastCrime + CRIME_COOLDOWN) {
            const timeLeft = Math.ceil((lastCrime + CRIME_COOLDOWN - now) / (1000 * 60));
            throw createError(
                "Crime cooldown active",
                ErrorTypes.RATE_LIMIT,
                t(lang, 'wolf.cmd.economy.crimeCooldown', { minutes: timeLeft }),
                { remaining: lastCrime + CRIME_COOLDOWN - now, cooldownType: 'crime' }
            );
        }

        const crimeType = interaction.options.getString("type").toLowerCase();
        const crime = CRIME_TYPES.find(
            c => c.name.toLowerCase().replace(/\s+/g, '-') === crimeType
        );

        if (!crime) {
            throw createError(
                "Invalid crime type",
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.economy.crimeInvalid'),
                { crimeType }
            );
        }

        const isSuccess = Math.random() > crime.risk;
        const amountEarned = isSuccess
            ? Math.floor(Math.random() * (crime.max - crime.min + 1)) + crime.min
            : 0;

        userData.cooldowns = userData.cooldowns || {};
        userData.cooldowns.crime = now;

        if (isSuccess) {
            userData.wallet = (userData.wallet || 0) + amountEarned;
            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed(
                t(lang, 'wolf.cmd.economy.crimeSuccessTitle'),
                t(lang, 'wolf.cmd.economy.crimeSuccessDesc', { crime: crime.name, amount: amountEarned })
            );
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } else {
            const fine = Math.floor(amountEarned * 0.2);
            userData.wallet = Math.max(0, (userData.wallet || 0) - fine);
            userData.jailedUntil = now + JAIL_TIME;
            await setEconomyData(client, guildId, userId, userData);

            const embed = errorEmbed(
                t(lang, 'wolf.cmd.economy.crimeFailTitle'),
                t(lang, 'wolf.cmd.economy.crimeFailDesc', { crime: crime.name, fine })
            );
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'crime' })
};
