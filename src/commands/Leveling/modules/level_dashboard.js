import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getLevelingConfig, saveLevelingConfig } from '../../../services/leveling.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';
import { t, pickLanguage } from '../../../services/i18n.js';

// ─── Embed & Menu Builders ────────────────────────────────────────────────────

function buildDashboardEmbed(lang, cfg, guild) {
    const channel = cfg.levelUpChannel ? `<#${cfg.levelUpChannel}>` : `\`${t(lang, 'wolf.cmd.leveling.admin.dashboard.notSet')}\``;
    const xpMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const xpMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;
    const cooldown = cfg.xpCooldown ?? 60;
    const rawMsg = cfg.levelUpMessage || t(lang, 'wolf.cmd.leveling.admin.dashboard.defaultMsg');
    const msgPreview = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;

    return new EmbedBuilder()
        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.title'))
        .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.description', { guild: guild.name }))
        .setColor(getColor('info'))
        .addFields(
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldChannel'), value: channel, inline: true },
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldStatus'), value: cfg.enabled ? t(lang, 'wolf.cmd.leveling.admin.dashboard.enabled') : t(lang, 'wolf.cmd.leveling.admin.dashboard.disabled'), inline: true },
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldAnnouncements'), value: cfg.announceLevelUp !== false ? t(lang, 'wolf.cmd.leveling.admin.dashboard.enabled') : t(lang, 'wolf.cmd.leveling.admin.dashboard.disabled'), inline: true },
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldXpRange'), value: `\`${xpMin} – ${xpMax}\``, inline: true },
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldCooldown'), value: `\`${cooldown}s\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: t(lang, 'wolf.cmd.leveling.admin.dashboard.fieldMessage'), value: msgPreview, inline: false },
        )
        .setFooter({ text: t(lang, 'wolf.cmd.leveling.admin.dashboard.footer') })
        .setTimestamp();
}

function buildSelectMenu(lang, guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`level_cfg_${guildId}`)
        .setPlaceholder(t(lang, 'wolf.cmd.leveling.admin.dashboard.placeholder'))
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.optChannelLabel'))
                .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.optChannelDesc'))
                .setValue('channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.optMessageLabel'))
                .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.optMessageDesc'))
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.optXpRangeLabel'))
                .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.optXpRangeDesc'))
                .setValue('xp_range')
                .setEmoji('🎲'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.optCooldownLabel'))
                .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.optCooldownDesc'))
                .setValue('xp_cooldown')
                .setEmoji('⏱️'),
        );
}

function buildButtonRow(lang, cfg, guildId, disabled = false) {
    const announceOn = cfg.announceLevelUp !== false;
    const systemOn = cfg.enabled !== false;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_announce_${guildId}`)
            .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.btnAnnouncements'))
            .setStyle(announceOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('📣')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_system_${guildId}`)
            .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.btnLeveling'))
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('⚡')
            .setDisabled(disabled),
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshDashboard(lang, rootInteraction, cfg, guildId) {
    const selectMenu = buildSelectMenu(lang, guildId);
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(lang, cfg, rootInteraction.guild)],
        components: [
            buildButtonRow(lang, cfg, guildId),
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    }).catch(() => {});
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            const guildId = interaction.guild.id;
            const cfg = await getLevelingConfig(client, guildId);

            if (!cfg.configured) {
                throw new TitanBotError(
                    'Leveling system not configured',
                    ErrorTypes.CONFIGURATION,
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.notConfiguredDesc'),
                );
            }

            const selectMenu = buildSelectMenu(lang, guildId);
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(lang, cfg, interaction.guild)],
                components: [buildButtonRow(lang, cfg, guildId), selectRow],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id && i.customId === `level_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'channel':
                            await handleChannel(lang, selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'message':
                            await handleMessage(lang, selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_range':
                            await handleXpRange(lang, selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_cooldown':
                            await handleXpCooldown(lang, selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                } catch (error) {
                    if (error instanceof TitanBotError) {
                        logger.debug(`Leveling config validation error: ${error.message}`);
                    } else {
                        logger.error('Unexpected leveling dashboard error:', error);
                    }

                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || t(lang, 'wolf.cmd.leveling.admin.dashboard.errProcessing')
                            : t(lang, 'wolf.cmd.leveling.admin.dashboard.errUpdating');

                    if (!selectInteraction.replied && !selectInteraction.deferred) {
                        await selectInteraction.deferUpdate().catch(() => {});
                    }

                    await selectInteraction
                        .followUp({
                            embeds: [errorEmbed(t(lang, 'wolf.cmd.leveling.admin.dashboard.errTitle'), errorMessage)],
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            });

            // ── Button collector for the two toggle buttons ──────────────────
            const btnCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    (i.customId === `level_cfg_toggle_announce_${guildId}` ||
                        i.customId === `level_cfg_toggle_system_${guildId}`),
                time: 600_000,
            });

            btnCollector.on('collect', async btnInteraction => {
                try {
                    await btnInteraction.deferUpdate().catch(() => null);
                } catch (err) {
                    logger.debug('Button interaction already expired:', err.message);
                    return;
                }
                const isAnnounce = btnInteraction.customId === `level_cfg_toggle_announce_${guildId}`;

                if (isAnnounce) {
                    cfg.announceLevelUp = cfg.announceLevelUp === false;
                    await saveLevelingConfig(client, guildId, cfg);
                    await btnInteraction.followUp({
                        embeds: [
                            successEmbed(
                                t(lang, 'wolf.cmd.leveling.admin.dashboard.announceUpdatedTitle'),
                                cfg.announceLevelUp 
                                    ? t(lang, 'wolf.cmd.leveling.admin.dashboard.announceUpdatedDescEnabled')
                                    : t(lang, 'wolf.cmd.leveling.admin.dashboard.announceUpdatedDescDisabled')
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const wasEnabled = cfg.enabled !== false;
                    cfg.enabled = !wasEnabled;
                    await saveLevelingConfig(client, guildId, cfg);
                    await btnInteraction.followUp({
                        embeds: [
                            successEmbed(
                                t(lang, 'wolf.cmd.leveling.admin.dashboard.systemUpdatedTitle'),
                                cfg.enabled
                                    ? t(lang, 'wolf.cmd.leveling.admin.dashboard.systemUpdatedDescEnabled')
                                    : t(lang, 'wolf.cmd.leveling.admin.dashboard.systemUpdatedDescDisabled')
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await refreshDashboard(lang, interaction, cfg, guildId);
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    btnCollector.stop();
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.timeoutTitle'))
                        .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.timeoutDesc'))
                        .setColor(getColor('error'));
                    
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [timeoutEmbed],
                        components: [],
                    }).catch(() => {});
                }
            });

            btnCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.timeoutTitle'))
                        .setDescription(t(lang, 'wolf.cmd.leveling.admin.dashboard.timeoutDesc'))
                        .setColor(getColor('error'));
                    
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [timeoutEmbed],
                        components: [],
                    }).catch(() => {});
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in level_dashboard:', error);
            throw new TitanBotError(
                `Level dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                t(lang, 'wolf.cmd.leveling.admin.dashboard.notConfiguredTitle'),
            );
        }
    },
};

// ─── Change Level-up Channel ──────────────────────────────────────────────────

async function handleChannel(lang, selectInteraction, rootInteraction, cfg, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('level_cfg_channel')
        .setPlaceholder(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanPlaceholder'))
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    const currentChan = cfg.levelUpChannel ? `<#${cfg.levelUpChannel}>` : `\`${t(lang, 'wolf.cmd.leveling.admin.dashboard.notSet')}\``;

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanTitle'))
                .setDescription(
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanDesc', { current: currentChan }),
                )
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'level_cfg_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        await chanInteraction.deferUpdate();
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
            await chanInteraction.followUp({
                embeds: [
                    errorEmbed(
                        t(lang, 'wolf.cmd.leveling.admin.missingPermsTitle'),
                        t(lang, 'wolf.cmd.leveling.admin.botMissingPermsDesc', { channel: channel.toString() }),
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        cfg.levelUpChannel = channel.id;
        await saveLevelingConfig(client, guildId, cfg);

        await chanInteraction.followUp({
            embeds: [
                successEmbed(
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanSuccessTitle'),
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanSuccessDesc', { channel: channel.toString() }),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(lang, rootInteraction, cfg, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction
                .followUp({
                    embeds: [
                        errorEmbed(
                            t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanTimeoutTitle'),
                            t(lang, 'wolf.cmd.leveling.admin.dashboard.actionChanTimeoutDesc'),
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });
}

// ─── Edit Level-up Message ────────────────────────────────────────────────────

async function handleMessage(lang, selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('level_cfg_message')
        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionMsgModalTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionMsgInputLabel'))
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.levelUpMessage || t(lang, 'wolf.cmd.leveling.admin.dashboard.defaultMsg'))
                    .setMaxLength(500)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionMsgInputPlaceholder')),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newMessage = submitted.fields.getTextInputValue('message_input').trim();

    if (!newMessage.includes('{user}') && !newMessage.includes('{level}')) {
        logger.warn(
            `Level-up message set without {user} or {level} placeholders in guild ${guildId}`,
        );
    }

    cfg.levelUpMessage = newMessage;
    await saveLevelingConfig(client, guildId, cfg);

    const preview = newMessage.replace('{user}', '@User').replace('{level}', '5');

    await submitted.reply({
        embeds: [
            successEmbed(
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionMsgSuccessTitle'),
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionMsgSuccessDesc', { preview: preview }),
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(lang, rootInteraction, cfg, guildId);
}

// ─── Set XP Range ─────────────────────────────────────────────────────────────

async function handleXpRange(lang, selectInteraction, rootInteraction, cfg, guildId, client) {
    const currentMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const currentMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;

    const modal = new ModalBuilder()
        .setCustomId('level_cfg_xp_range')
        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpModalTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('xp_min_input')
                    .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpMinLabel'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(currentMin))
                    .setMaxLength(3)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('15'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('xp_max_input')
                    .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpMaxLabel'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(currentMax))
                    .setMaxLength(3)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('25'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_xp_range' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawMin = submitted.fields.getTextInputValue('xp_min_input').trim();
    const rawMax = submitted.fields.getTextInputValue('xp_max_input').trim();
    const newMin = parseInt(rawMin, 10);
    const newMax = parseInt(rawMax, 10);

    if (isNaN(newMin) || isNaN(newMax) || newMin < 1 || newMax < 1 || newMin > 500 || newMax > 500) {
        await submitted.reply({
            embeds: [
                errorEmbed(
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpErrValTitle'),
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpErrValDesc'),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (newMin > newMax) {
        await submitted.reply({
            embeds: [
                errorEmbed(
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpErrRangeTitle'),
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpErrRangeDesc'),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    cfg.xpRange = { min: newMin, max: newMax };
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [
            successEmbed(
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpSuccessTitle'),
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionXpSuccessDesc', { min: newMin, max: newMax }),
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(lang, rootInteraction, cfg, guildId);
}

// ─── Set XP Cooldown ──────────────────────────────────────────────────────────

async function handleXpCooldown(lang, selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('level_cfg_cooldown')
        .setTitle(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownModalTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('cooldown_input')
                    .setLabel(t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownInputLabel'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(cfg.xpCooldown ?? 60))
                    .setMaxLength(4)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('60'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_cooldown' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const raw = submitted.fields.getTextInputValue('cooldown_input').trim();
    const newCooldown = parseInt(raw, 10);

    if (isNaN(newCooldown) || newCooldown < 0 || newCooldown > 3600) {
        await submitted.reply({
            embeds: [
                errorEmbed(
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownErrValTitle'),
                    t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownErrValDesc'),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    cfg.xpCooldown = newCooldown;
    await saveLevelingConfig(client, guildId, cfg);

    const plural = newCooldown !== 1 ? (lang === 'es' ? 'es' : 's') : '';
    const extra = newCooldown === 0 ? t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownSuccessExtra') : '';

    await submitted.reply({
        embeds: [
            successEmbed(
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownSuccessTitle'),
                t(lang, 'wolf.cmd.leveling.admin.dashboard.actionCooldownSuccessDesc', {
                    cooldown: newCooldown,
                    plural: plural,
                    extra: extra,
                }),
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(lang, rootInteraction, cfg, guildId);
}
