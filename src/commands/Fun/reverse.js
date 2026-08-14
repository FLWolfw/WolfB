import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName("reverse")
        .setDescription("Writes your text backwards.")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("The text to reverse.")
                .setRequired(true)
                .setMaxLength(1000),
        ),
    category: 'Fun',

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            const originalText = interaction.options.getString("text");

            if (!originalText || originalText.trim().length === 0) {
                throw new TitanBotError(
                    'Empty text provided to reverse command',
                    ErrorTypes.USER_INPUT,
                    t(lang, 'wolf.cmd.fun.reverseEmpty')
                );
            }

            const sanitizedText = sanitizeInput(originalText, 1000);
            const reversedText = sanitizedText.split("").reverse().join("");

            const embed = successEmbed(
                t(lang, 'wolf.cmd.fun.reverseTitle'),
                t(lang, 'wolf.cmd.fun.reverseDesc', { original: sanitizedText, reversed: reversedText }),
            );

            await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            logger.debug(`Reverse command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
        } catch (error) {
            logger.error('Reverse command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'reverse', source: 'reverse_command' });
        }
    },
};
