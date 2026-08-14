import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bug')
        .setDescription('Report a bug or issue with the bot'),

    async execute(interaction, config) {
        const lang = pickLanguage(config, interaction.guild);

        const githubButton = new ButtonBuilder()
            .setLabel(t(lang, 'wolf.cmd.bug.button'))
            .setStyle(ButtonStyle.Link)
            .setURL('https://github.com/FLWolfw/Wolf-Bot/issues');

        const row = new ActionRowBuilder().addComponents(githubButton);

        const embed = createEmbed({
            title: t(lang, 'wolf.cmd.bug.title'),
            description: t(lang, 'wolf.cmd.bug.description'),
            color: 'error',
        }).setTimestamp();

        await InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            components: [row],
        });
    },
};
