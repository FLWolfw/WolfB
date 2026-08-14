import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Rolls dice using standard notation (e.g., 2d20, 1d6 + 5).")
        .addStringOption((option) =>
            option
                .setName("notation")
                .setDescription("The dice notation (e.g., 2d6, 1d20 + 4)")
                .setRequired(true)
                .setMaxLength(50),
        ),
    category: 'Fun',

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            await InteractionHelper.safeDefer(interaction);

            const notation = interaction.options
                .getString("notation")
                .toLowerCase()
                .replace(/\s/g, "");

            const match = notation.match(/^(\d*)d(\d+)([\+\-]\d+)?$/);

            if (!match) {
                throw new TitanBotError(
                    `Invalid dice notation: ${notation}`,
                    ErrorTypes.USER_INPUT,
                    t(lang, 'wolf.cmd.fun.rollInvalid')
                );
            }

            const numDice = parseInt(match[1] || "1", 10);
            const numSides = parseInt(match[2], 10);
            const modifier = parseInt(match[3] || "0", 10);

            if (numDice < 1 || numDice > 20) {
                throw new TitanBotError(
                    `Too many dice requested: ${numDice}`,
                    ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.fun.rollTooMany')
                );
            }

            if (numSides < 1 || numSides > 1000) {
                throw new TitanBotError(
                    `Invalid number of sides: ${numSides}`,
                    ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.fun.rollSides')
                );
            }

            let rolls = [];
            let totalRoll = 0;

            for (let i = 0; i < numDice; i++) {
                const roll = Math.floor(Math.random() * numSides) + 1;
                rolls.push(roll);
                totalRoll += roll;
            }

            const finalTotal = totalRoll + modifier;

            const rollsLine = numDice > 1 ? `${t(lang, 'wolf.cmd.fun.rollRollsLabel')} ${rolls.join(" + ")}\n` : "";
            const modText = modifier !== 0 ? ` + (${modifier})` : "";
            const modSign = modifier !== 0 ? match[3] : "";

            const embed = successEmbed(
                t(lang, 'wolf.cmd.fun.rollTitle', { dice: numDice, sides: numSides, mod: modSign }),
                t(lang, 'wolf.cmd.fun.rollDesc', { rollsLine, total: totalRoll, modText, final: finalTotal }),
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.debug(`Roll command executed by user ${interaction.user.id} with notation ${notation} in guild ${interaction.guildId}`);
        } catch (error) {
            await handleInteractionError(interaction, error, { commandName: 'roll', source: 'roll_command' });
        }
    },
};
