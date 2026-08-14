import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor } from '../../config/bot.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { getLoggingStatus } from '../../services/loggingService.js';
import { getLevelingConfig } from '../../services/leveling.js';
import { getConfiguration as getJoinToCreateConfiguration } from '../../services/joinToCreateService.js';
import { getWelcomeConfig, getApplicationSettings } from '../../utils/database.js';
import { errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { t, pickLanguage } from '../../services/i18n.js';

function pill(enabled, lang) {
    return enabled ? t(lang, 'wolf.cmd.overview.on') : t(lang, 'wolf.cmd.overview.off');
}

async function formatChannelMention(guild, id, lang) {
    if (!id) return t(lang, 'wolf.cmd.overview.notConfigured');
    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    return channel ? channel.toString() : t(lang, 'wolf.cmd.overview.missing', { id });
}

function formatRoleMention(guild, id, lang) {
    if (!id) return t(lang, 'wolf.cmd.overview.notConfigured');
    const role = guild.roles.cache.get(id);
    return role ? role.toString() : t(lang, 'wolf.cmd.overview.missing', { id });
}

export default {
    data: new SlashCommandBuilder()
        .setName('overview')
        .setDescription('Read-only snapshot of all server system statuses.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            await InteractionHelper.safeDefer(interaction);

            const [guildConfig, loggingStatus, levelingConfig, welcomeConfig, applicationConfig, joinToCreateConfig] =
                await Promise.all([
                    getGuildConfig(client, interaction.guildId),
                    getLoggingStatus(client, interaction.guildId),
                    getLevelingConfig(client, interaction.guildId),
                    getWelcomeConfig(client, interaction.guildId),
                    getApplicationSettings(client, interaction.guildId),
                    getJoinToCreateConfiguration(client, interaction.guildId),
                ]);

            const verificationEnabled = Boolean(guildConfig.verification?.enabled);
            const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);
            const autoRoleId = guildConfig.autoRole || welcomeConfig?.roleIds?.[0];

            // ── Channels ──────────────────────────────────────────────────────
            const [auditChannel, lifecycleChannel, transcriptChannel, reportChannel, birthdayChannel] =
                await Promise.all([
                    formatChannelMention(interaction.guild, loggingStatus.channelId || guildConfig.logging?.channelId || guildConfig.logChannelId, lang),
                    formatChannelMention(interaction.guild, guildConfig.ticketLogsChannelId, lang),
                    formatChannelMention(interaction.guild, guildConfig.ticketTranscriptChannelId, lang),
                    formatChannelMention(interaction.guild, guildConfig.reportChannelId, lang),
                    formatChannelMention(interaction.guild, guildConfig.birthdayChannelId, lang),
                ]);

            const L = (key) => t(lang, `wolf.cmd.overview.labels.${key}`);

            const embed = new EmbedBuilder()
                .setTitle(t(lang, 'wolf.cmd.overview.title'))
                .setDescription(t(lang, 'wolf.cmd.overview.description', { server: interaction.guild.name }))
                .setColor(getColor('primary'))
                .addFields(
                    {
                        name: t(lang, 'wolf.cmd.overview.coreSystems'),
                        value: [
                            `${L('audit')} — ${pill(Boolean(loggingStatus.enabled), lang)}`,
                            `${L('leveling')} — ${pill(Boolean(levelingConfig?.enabled), lang)}`,
                            `${L('welcome')} — ${pill(Boolean(welcomeConfig?.enabled), lang)}`,
                            `${L('goodbye')} — ${pill(Boolean(welcomeConfig?.goodbyeEnabled), lang)}`,
                            `${L('birthdays')} — ${pill(Boolean(guildConfig.birthdayChannelId), lang)}`,
                            `${L('applications')} — ${pill(Boolean(applicationConfig?.enabled), lang)}`,
                            `${L('verification')} — ${pill(verificationEnabled, lang)}`,
                            `${L('autoverify')} — ${pill(autoVerifyEnabled, lang)}`,
                            `${L('jointocreate')} — ${pill(Boolean(joinToCreateConfig?.enabled), lang)}`,
                            `${L('autorole')} — ${autoRoleId ? `✅ ${formatRoleMention(interaction.guild, autoRoleId, lang)}` : t(lang, 'wolf.cmd.overview.off')}`,
                        ].join('\n'),
                        inline: false,
                    },
                    {
                        name: t(lang, 'wolf.cmd.overview.channels'),
                        value: [
                            `${L('auditChannel')} ${auditChannel}`,
                            `${L('ticketLogs')} ${lifecycleChannel}`,
                            `${L('ticketTranscripts')} ${transcriptChannel}`,
                            `${L('reports')} ${reportChannel}`,
                            `${L('birthdayChannel')} ${birthdayChannel}`,
                        ].join('\n'),
                        inline: false,
                    },
                    {
                        name: t(lang, 'wolf.cmd.overview.snapshot'),
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true,
                    },
                )
                .setFooter({ text: t(lang, 'wolf.cmd.overview.footer') })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('overview command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(t(lang, 'wolf.cmd.overview.errorTitle'), t(lang, 'wolf.cmd.overview.errorDesc'))],
            });
        }
    },
};
