import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName("flip")
        .setDescription("Flips a coin (Heads or Tails)."),
    category: 'Fun',

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            const isHeads = Math.random() < 0.5;
            const result = isHeads ? t(lang, 'wolf.cmd.fun.flipHeads') : t(lang, 'wolf.cmd.fun.flipTails');
            const emoji = isHeads ? "🪙" : "🔮";

            const embed = successEmbed(
                t(lang, 'wolf.cmd.fun.flipTitle'),
                t(lang, 'wolf.cmd.fun.flipResult', { result, emoji }),
            );

            await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            logger.debug(`Flip command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
        } catch (error) {
            logger.error('Flip command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'flip', source: 'flip_command' });
        }
    },
};
