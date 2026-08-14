import { MessageFlags } from 'discord.js';
import { logger } from './logger.js';

function sanitizeEditReplyOptions(options = {}) {
    const sanitized = { ...options };
    // Discord does not accept ephemeral flags on editReply payloads.
    if ('flags' in sanitized) delete sanitized.flags;
    return sanitized;
}

export class InteractionHelper {
    static patchInteractionResponses(interaction) {
        if (!interaction || interaction.__wolfInteractionPatched) return;
        interaction.__wolfInteractionPatched = true;
    }

    static isInteractionValid(interaction) {
        if (!interaction) return false;
        if (!interaction.id || !interaction.token) return false;
        const createdAt = interaction.createdTimestamp || Date.now();
        return Date.now() - createdAt < 14 * 60 * 1000;
    }

    static async safeDefer(interaction, options = {}) {
        try {
            if (!this.isInteractionValid(interaction)) {
                logger.warn(`Interaction ${interaction.id} has expired before defer, ignoring`);
                return false;
            }
            await interaction.deferReply(options);
            return true;
        } catch (error) {
            if (error.code === 10062 || error.code === 10008) {
                logger.warn(`Interaction ${interaction.id} is no longer available during defer:`, error.message);
                return false;
            }
            if (error.name === 'InteractionAlreadyReplied' || error.code === 40060) {
                logger.warn(`Interaction ${interaction.id} already acknowledged during defer:`, error.message);
                return true;
            }
            logger.error('Failed to defer reply:', error);
            return false;
        }
    }

    static async safeEditReply(interaction, options) {
        try {
            if (!this.isInteractionValid(interaction)) {
                logger.warn(`Interaction ${interaction.id} has expired before edit, ignoring`);
                return false;
            }

            if (!interaction.replied && !interaction.deferred) {
                logger.debug(`Interaction ${interaction.id} not deferred, using reply fallback instead of edit`);
                return await this.safeReply(interaction, options);
            }

            await interaction.editReply(sanitizeEditReplyOptions(options));
            return true;
        } catch (error) {
            // 10008 means the original interaction response no longer exists.
            // This can happen if Discord or another handler deleted it before a
            // later edit. It is not a database/application failure and should
            // not produce a noisy ERROR stack trace.
            if (error.code === 10008) {
                logger.warn('Interaction reply no longer exists; skipping edit', {
                    interactionId: interaction.id,
                    guildId: interaction.guildId,
                    userId: interaction.user?.id,
                    errorCode: error.code,
                });
                return false;
            }
            if (error.code === 10062) {
                logger.warn(`Interaction ${interaction.id} expired during edit:`, error.message);
                return false;
            }
            if (error.code === 40060) {
                logger.warn(`Interaction ${interaction.id} already acknowledged during edit:`, error.message);
                return false;
            }
            if (error.name === 'InteractionNotReplied' || error.message?.includes('not been sent or deferred')) {
                logger.debug(`Interaction ${interaction.id} not replied, using reply fallback instead of edit:`, error.message);
                return await this.safeReply(interaction, options);
            }
            logger.error('Failed to edit reply:', error);
            return false;
        }
    }

    static async safeReply(interaction, options) {
        try {
            if (!this.isInteractionValid(interaction)) {
                logger.warn(`Interaction ${interaction.id} has expired before reply, ignoring`);
                return false;
            }

            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply(sanitizeEditReplyOptions(options));
                return true;
            }

            if (interaction.replied) {
                await interaction.followUp(options);
                return true;
            }

            await interaction.reply(options);
            return true;
        } catch (error) {
            if (error.code === 10008 || error.code === 10062) {
                logger.warn(`Interaction ${interaction.id} is no longer available while replying:`, error.message);
                return false;
            }
            if (error.code === 40060 || error.name === 'InteractionAlreadyReplied') {
                logger.warn(`Interaction ${interaction.id} was already acknowledged while replying:`, error.message);
                return false;
            }
            logger.error('Failed to send interaction reply:', error);
            return false;
        }
    }
}
