import { EmbedBuilder } from 'discord.js';
import { getTicketData, saveTicketData } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { t, pickLanguage } from '../../services/i18n.js';

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        const [guildId, channelId, ratingStr] = args;
        const guild = interaction.guild || client.guilds.cache.get(guildId);
        let guildConfig = null;
        try {
            guildConfig = await getGuildConfig(client, guildId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load guild config', { guildId, error: err.message });
        }
        const lang = pickLanguage(guildConfig, guild);
        const tr = (key, vars = {}) => t(lang, `wolf.ticketFeedback.${key}`, vars);
        const starLabel = (rating) => tr(`starLabels.${String(rating)}`) || `${rating} stars`;

        if (!guildId || !channelId || !ratingStr) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(tr('invalidTitle'))
                        .setDescription(tr('invalidDesc'))
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(tr('notFoundTitle'))
                        .setDescription(tr('notFoundDesc'))
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(tr('notAllowedTitle'))
                        .setDescription(tr('notAllowedDesc'))
                        .setColor(getColor('error')),
                ],
                ephemeral: true,
            });
            return;
        }

        if (ticketData.feedback?.rating) {
            const ratingLabel = starLabel(ticketData.feedback.rating);
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(tr('alreadySubmittedTitle'))
                        .setDescription(tr('alreadySubmittedDesc', { rating: ratingLabel }))
                        .setColor(getColor('success')),
                ],
                components: [],
            });
            return;
        }

        const rating = parseInt(ratingStr, 10);
        const ratingLabel = starLabel(rating);

        try {
            ticketData.feedback = {
                rating,
                submittedAt: new Date().toISOString(),
            };
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedback: failed to save feedback', { guildId, channelId, rating, error: err.message });
        }

        try {
            if (guildConfig?.ticketLogsChannelId) {
                const logsChannel = await interaction.client.channels.fetch(guildConfig.ticketLogsChannelId).catch(() => null);
                if (logsChannel && logsChannel.isSendable()) {
                    const feedbackEmbed = new EmbedBuilder()
                        .setTitle(tr('feedbackLogTitle'))
                        .setDescription(tr('feedbackLogDesc'))
                        .setColor(getColor('info'))
                        .addFields(
                            { name: tr('ticketId'), value: `\`${channelId}\``, inline: true },
                            { name: tr('rating'), value: ratingLabel, inline: true },
                            { name: tr('user'), value: `<@${interaction.user.id}>`, inline: true },
                            { name: tr('submitted'), value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                        )
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setFooter({ text: tr('userId', { id: interaction.user.id }) })
                        .setTimestamp();

                    await logsChannel.send({ embeds: [feedbackEmbed] });
                }
            }
        } catch (err) {
            logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
        }

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle(tr('thanksTitle'))
                    .setDescription(tr('thanksDesc', { rating: ratingLabel }))
                    .setColor(getColor('success'))
                    .setFooter({ text: tr('footer') })
                    .setTimestamp(),
            ],
            components: [],
        });

        logger.info('Ticket feedback submitted', {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating,
        });
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(interaction) {
        const guildId = interaction.guildId;
        const guildConfig = guildId ? await getGuildConfig(interaction.client, guildId).catch(() => null) : null;
        const lang = pickLanguage(guildConfig, interaction.guild);

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle(t(lang, 'wolf.ticketFeedback.declineTitle'))
                    .setDescription(t(lang, 'wolf.ticketFeedback.declineDesc'))
                    .setColor(getColor('default')),
            ],
            components: [],
        });
    },
};

export default [feedbackHandler, declineHandler];
