import { User, EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { t, pickLanguage } from '../services/i18n.js';

// Runtime safety-net for the ticket feedback survey.
// The survey is still created by the legacy ticket service, so translate it
// at send time based on the configured language of the originating guild.
if (!User.prototype.__wolfTicketFeedbackI18nPatched) {
  const originalSend = User.prototype.send;

  User.prototype.send = async function patchedTicketFeedbackSend(options, ...args) {
    try {
      if (options && Array.isArray(options.components)) {
        const components = options.components;
        const feedbackComponent = components
          .flatMap(row => row?.components || [])
          .find(component =>
            typeof component?.data?.custom_id === 'string' &&
            (component.data.custom_id.startsWith('ticket_feedback:') ||
             component.data.custom_id.startsWith('ticket_feedback_decline:'))
          );

        if (feedbackComponent) {
          const customId = feedbackComponent.data.custom_id;
          const parts = customId.split(':');
          const guildId = parts[1];

          if (guildId) {
            const guildConfig = await getGuildConfig(this.client, guildId).catch(() => null);
            const guild = this.client?.guilds?.cache?.get(guildId);
            const language = pickLanguage(guildConfig, guild);

            if (language === 'es') {
              const translated = {
                ...options,
                embeds: Array.isArray(options.embeds)
                  ? options.embeds.map(embed => {
                      const data = typeof embed?.toJSON === 'function' ? embed.toJSON() : embed;
                      const translatedEmbed = new EmbedBuilder(data);
                      translatedEmbed
                        .setTitle(t('es', 'wolf.ticketFeedback.surveyTitle'))
                        .setDescription(t('es', 'wolf.ticketFeedback.surveyDesc', {
                          ticket: data?.description?.match(/\*\*(.*?)\*\*/)?.[1] || 'ticket',
                        }))
                        .setFooter({ text: t('es', 'wolf.ticketFeedback.surveyFooter') });
                      return translatedEmbed;
                    })
                  : options.embeds,
                components: components.map(row => {
                  const clonedRow = { ...row, components: (row.components || []).map(component => {
                    const componentData = typeof component?.toJSON === 'function' ? component.toJSON() : component;
                    if (componentData?.custom_id?.startsWith('ticket_feedback_decline:')) {
                      return new component.constructor(componentData).setLabel(
                        t('es', 'wolf.ticketFeedback.declineButton')
                      );
                    }
                    return component;
                  }) };
                  return clonedRow;
                }),
              };

              // Avoid rebuilding ActionRowBuilder internals manually: Discord.js
              // accepts the original rows when only button labels need changing.
              translated.components = components.map(row => {
                const rowJson = typeof row?.toJSON === 'function' ? row.toJSON() : row;
                const buttonJson = (rowJson.components || []).map(component => {
                  if (component.custom_id?.startsWith('ticket_feedback_decline:')) {
                    return { ...component, label: t('es', 'wolf.ticketFeedback.declineButton') };
                  }
                  return component;
                });
                return { ...rowJson, components: buttonJson };
              });

              return originalSend.call(this, translated, ...args);
            }
          }
        }
      }
    } catch {
      // Never let translation interfere with ticket creation/closure.
    }

    return originalSend.call(this, options, ...args);
  };

  Object.defineProperty(User.prototype, '__wolfTicketFeedbackI18nPatched', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

console.log('[i18n] Ticket feedback survey translation enabled');
