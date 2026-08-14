import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType,
    ChannelType,
    EmbedBuilder,
    LabelBuilder,
    RadioGroupBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';
import { t, pickLanguage } from '../../services/i18n.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FIELDS = 25;
const IDLE_TIMEOUT = 900_000; // 15 minutes

const COLOR_PRESETS = [
    { label: 'Primary (Blue)',        value: '#336699', emoji: '🔵' },
    { label: 'Success (Green)',       value: '#57F287', emoji: '🟢' },
    { label: 'Error (Red)',           value: '#ED4245', emoji: '🔴' },
    { label: 'Warning (Yellow)',      value: '#FEE75C', emoji: '🟡' },
    { label: 'Info (Bright Blue)',    value: '#3498DB', emoji: '💙' },
    { label: 'Blurple (Discord)',     value: '#5865F2', emoji: '🟣' },
    { label: 'Fuchsia',              value: '#EB459E', emoji: '💜' },
    { label: 'Gold',                  value: '#F1C40F', emoji: '🟠' },
    { label: 'White',                 value: '#FFFFFF', emoji: '⚪' },
    { label: 'Dark',                  value: '#202225', emoji: '⚫' },
    { label: 'Custom Hex...',         value: '__custom__', emoji: '🎨' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidHex(str) {
    return /^#[0-9A-Fa-f]{6}$/.test(str);
}

// ─── Embed Builders ────────────────────────────────────────────────────────────

/**
 * Builds the live preview embed from current state.
 */
function getPresetLabel(value, lang) {
    switch (value) {
        case '#336699': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.primary');
        case '#57F287': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.success');
        case '#ED4245': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.error');
        case '#FEE75C': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.warning');
        case '#3498DB': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.info');
        case '#5865F2': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.blurple');
        case '#EB459E': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.fuchsia');
        case '#F1C40F': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.gold');
        case '#FFFFFF': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.white');
        case '#202225': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.dark');
        case '__custom__': return t(lang, 'wolf.cmd.tools.embedbuilder.colorPresets.custom');
        default: return value;
    }
}

function buildPreviewEmbed(state) {
    const embed = new EmbedBuilder();

    if (state.title)       embed.setTitle(state.title.substring(0, 256));
    if (state.description) embed.setDescription(state.description.substring(0, 4096));

    try {
        embed.setColor(state.color || getColor('primary'));
    } catch {
        embed.setColor(getColor('primary'));
    }

    if (state.author?.name) {
        const obj = { name: state.author.name.substring(0, 256) };
        if (state.author.iconUrl && isValidUrl(state.author.iconUrl)) obj.iconURL = state.author.iconUrl;
        if (state.author.url   && isValidUrl(state.author.url))      obj.url     = state.author.url;
        embed.setAuthor(obj);
    }

    if (state.footer?.text) {
        const obj = { text: state.footer.text.substring(0, 2048) };
        if (state.footer.iconUrl && isValidUrl(state.footer.iconUrl)) obj.iconURL = state.footer.iconUrl;
        embed.setFooter(obj);
    }

    if (state.thumbnail && isValidUrl(state.thumbnail)) embed.setThumbnail(state.thumbnail);
    if (state.image     && isValidUrl(state.image))     embed.setImage(state.image);
    if (state.timestamp) embed.setTimestamp();

    if (state.fields.length > 0) embed.addFields(state.fields.slice(0, 25));

    // Ensure the embed renders if completely empty
    if (
        !state.title &&
        !state.description &&
        state.fields.length === 0 &&
        !state.author?.name
    ) {
        embed.setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.emptyPreview'));
    }

    return embed;
}

/**
 * Builds the status/control dashboard embed (shown below the preview).
 */
function buildDashboardEmbed(state) {
    const trunc = (str, n) =>
        str.length > n ? str.substring(0, n) + '…' : str;

    const lines = [
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusTitle')}** › ${state.title ? `\`${trunc(state.title, 40)}\`` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusDesc')}** › ${state.description ? `${t(state.lang, 'wolf.cmd.tools.embedbuilder.valCharCount', { count: state.description.length })}` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusColor')}** › ${state.color ? `\`${state.color}\`` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valDefault')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusAuthor')}** › ${state.author?.name ? `\`${trunc(state.author.name, 30)}\`` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusFooter')}** › ${state.footer?.text ? `\`${trunc(state.footer.text, 30)}\`` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusThumbnail')}** › ${state.thumbnail ? t(state.lang, 'wolf.cmd.tools.embedbuilder.valSet') : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusImage')}** › ${state.image ? t(state.lang, 'wolf.cmd.tools.embedbuilder.valSet') : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusTimestamp')}** › ${state.timestamp ? t(state.lang, 'wolf.cmd.tools.embedbuilder.valEnabled') : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisabled')}\``}`,
        `**${t(state.lang, 'wolf.cmd.tools.embedbuilder.statusFields')}** › ${state.fields.length} / ${MAX_FIELDS}`,
    ];

    return new EmbedBuilder()
        .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.dashboardTitle'))
        .setDescription(lines.join('\n'))
        .setColor(getColor('info'))
        .setFooter({ text: t(state.lang, 'wolf.cmd.tools.embedbuilder.dashboardFooter') });
}

/**
 * Builds the main action select menu.
 */
function buildMainMenu(state) {
    const select = new StringSelectMenuBuilder()
        .setCustomId('eb_menu')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.mainMenuPlaceholder'))
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optEditContent'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optEditContentDesc'))
                .setValue('edit_content')
                .setEmoji('✏️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetColor'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetColorDesc'))
                .setValue('set_color')
                .setEmoji('🎨'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetAuthor'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetAuthorDesc'))
                .setValue('set_author')
                .setEmoji('👤'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetFooter'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetFooterDesc'))
                .setValue('set_footer')
                .setEmoji('📄'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetImages'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetImagesDesc'))
                .setValue('set_images')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optAddField', { count: state.fields.length, max: MAX_FIELDS }))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optAddFieldDesc'))
                .setValue('add_field')
                .setEmoji('➕'),
        );

    if (state.fields.length > 0) {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optEditField'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optEditFieldDesc'))
                .setValue('edit_field')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optRemoveField'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optRemoveFieldDesc'))
                .setValue('remove_field')
                .setEmoji('➖'),
        );

        if (state.fields.length >= 2) {
            select.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optReorderFields'))
                    .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optReorderFieldsDesc'))
                    .setValue('reorder_fields')
                    .setEmoji('↕️'),
            );
        }
    }

    select.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel(state.timestamp ? t(state.lang, 'wolf.cmd.tools.embedbuilder.optToggleTimestampDisable') : t(state.lang, 'wolf.cmd.tools.embedbuilder.optToggleTimestampEnable'))
            .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optToggleTimestampDesc'))
            .setValue('toggle_timestamp')
            .setEmoji('🕐'),
        new StringSelectMenuOptionBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optPostEmbed'))
            .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optPostEmbedDesc'))
            .setValue('post_embed')
            .setEmoji('📤'),
        new StringSelectMenuOptionBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optJsonExport'))
            .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optJsonExportDesc'))
            .setValue('json_export')
            .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optResetAll'))
            .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optResetAllDesc'))
            .setValue('reset_all')
            .setEmoji('🗑️'),
    );

    return select;
}

/**
 * Updates the dashboard message with the latest state.
 */
async function refreshDashboard(interaction, state) {
    return await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildPreviewEmbed(state), buildDashboardEmbed(state)],
        components: [new ActionRowBuilder().addComponents(buildMainMenu(state))],
    });
}

// ─── Option Handlers ──────────────────────────────────────────────────────────

async function handleEditContent(selectInteraction, rootInteraction, state) {
    const modal = new ModalBuilder()
        .setCustomId('eb_content')
        .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalContentTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_title')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelTitle'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.title || '')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderTitle')),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('eb_description')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelDesc'))
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(state.description ? state.description.substring(0, 4000) : '')
                    .setMaxLength(4000)
                    .setRequired(false)
                    .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderDesc')),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_content' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    // Defer immediately to avoid interaction timeout
    await submitted.deferUpdate().catch(() => {});

    state.title       = submitted.fields.getTextInputValue('eb_title').trim()       || null;
    state.description = submitted.fields.getTextInputValue('eb_description').trim() || null;

    await refreshDashboard(rootInteraction, state);
}

async function handleSetColor(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const colorSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_color_pick')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.colorPickPlaceholder'))
        .addOptions(
            COLOR_PRESETS.map(c =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(getPresetLabel(c.value, state.lang))
                    .setValue(c.value)
                    .setEmoji(c.emoji)
                    .setDescription(c.value !== '__custom__' ? c.value : (state.lang === 'es' ? 'Ingresa tu propio valor #RRGGBB' : 'Enter your own #RRGGBB value')),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.colorPickTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.colorPickDesc'))
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(colorSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const colorCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_color_pick',
        time: 60_000,
        max: 1,
    });

    colorCollector.on('collect', async colorInter => {
        const picked = colorInter.values[0];

        if (picked === '__custom__') {
            const hexModal = new ModalBuilder()
                .setCustomId('eb_custom_hex')
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalCustomHexTitle'))
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('hex_value')
                            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelHexValue'))
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('#5865F2')
                            .setMaxLength(7)
                            .setMinLength(7)
                            .setRequired(true),
                    ),
                );

            await colorInter.showModal(hexModal);

            const hexSubmit = await colorInter
                .awaitModalSubmit({
                    filter: i =>
                        i.customId === 'eb_custom_hex' && i.user.id === colorInter.user.id,
                    time: 60_000,
                })
                .catch(() => null);

            if (!hexSubmit) return;

            const hex = hexSubmit.fields.getTextInputValue('hex_value').trim();
            if (!isValidHex(hex)) {
                await hexSubmit.reply({
                    embeds: [
                        errorEmbed(
                            t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidHexTitle'),
                            t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidHexDesc', { hex }),
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            state.color = hex;
            await hexSubmit.deferUpdate().catch(() => {});
        } else {
            state.color = picked;
            await colorInter.deferUpdate().catch(() => {});
        }

        await refreshDashboard(rootInteraction, state);
    });
}

async function handleSetAuthor(selectInteraction, rootInteraction, state) {
    const modal = new ModalBuilder()
        .setCustomId('eb_author')
        .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalAuthorTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('author_name')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelAuthorName'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.author?.name || '')
                    .setMaxLength(256)
                    .setRequired(false)
                    .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderAuthorName')),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('author_icon')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelAuthorIcon'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.author?.iconUrl || '')
                    .setRequired(false)
                    .setPlaceholder('https://example.com/icon.png'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('author_url')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelAuthorUrl'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.author?.url || '')
                    .setRequired(false)
                    .setPlaceholder('https://example.com'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_author' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const name    = submitted.fields.getTextInputValue('author_name').trim();
    const iconUrl = submitted.fields.getTextInputValue('author_icon').trim();
    const url     = submitted.fields.getTextInputValue('author_url').trim();

    if (iconUrl && !isValidUrl(iconUrl)) {
        await submitted.reply({
            embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidUrlTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidAuthorIcon'))],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (url && !isValidUrl(url)) {
        await submitted.reply({
            embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidUrlTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidAuthorLink'))],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    state.author = name ? { name, iconUrl: iconUrl || null, url: url || null } : null;

    await submitted.deferUpdate().catch(() => {});
    await refreshDashboard(rootInteraction, state);
}

async function handleSetFooter(selectInteraction, rootInteraction, state) {
    const modal = new ModalBuilder()
        .setCustomId('eb_footer')
        .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalFooterTitle'))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('footer_text')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFooterText'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.footer?.text || '')
                    .setMaxLength(2048)
                    .setRequired(false)
                    .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderFooterText')),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('footer_icon')
                    .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFooterIcon'))
                    .setStyle(TextInputStyle.Short)
                    .setValue(state.footer?.iconUrl || '')
                    .setRequired(false)
                    .setPlaceholder('https://example.com/icon.png'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_footer' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const text    = submitted.fields.getTextInputValue('footer_text').trim();
    const iconUrl = submitted.fields.getTextInputValue('footer_icon').trim();

    if (iconUrl && !isValidUrl(iconUrl)) {
        await submitted.reply({
            embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidUrlTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidFooterIcon'))],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    state.footer = text ? { text, iconUrl: iconUrl || null } : null;

    await submitted.deferUpdate().catch(() => {});
    await refreshDashboard(rootInteraction, state);
}

async function handleSetImages(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate().catch(() => {});

    const imageSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_image_pick')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.colorPickPlaceholder'))
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetThumbnail'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetThumbnailDesc'))
                .setValue('set_thumbnail')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetLargeImage'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optSetLargeImageDesc'))
                .setValue('set_image')
                .setEmoji('📸'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optClearThumbnail'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optClearThumbnailDesc'))
                .setValue('clear_thumbnail')
                .setEmoji('🗑️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.optClearLargeImage'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.optClearLargeImageDesc'))
                .setValue('clear_image')
                .setEmoji('🗑️'),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.imagesTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.imagesDesc'))
                .addFields(
                    { name: t(state.lang, 'wolf.cmd.tools.embedbuilder.imagesLabelThumbnail'),    value: state.thumbnail ? `[${t(state.lang, 'wolf.cmd.tools.embedbuilder.valLinkView')}](${state.thumbnail})` : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``, inline: true },
                    { name: t(state.lang, 'wolf.cmd.tools.embedbuilder.imagesLabelLargeImage'),  value: state.image     ? `[${t(state.lang, 'wolf.cmd.tools.embedbuilder.valLinkView')}](${state.image})`     : `\`${t(state.lang, 'wolf.cmd.tools.embedbuilder.valNotSet')}\``, inline: true },
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(imageSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const imgMenuCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_image_pick',
        time: 60_000,
        max: 1,
    });

    imgMenuCollector.on('collect', async imgInter => {
        const pick = imgInter.values[0];

        if (pick === 'clear_thumbnail') {
            state.thumbnail = null;
            await imgInter.deferUpdate();
            await refreshDashboard(rootInteraction, state);
            return;
        }
        if (pick === 'clear_image') {
            state.image = null;
            await imgInter.deferUpdate();
            await refreshDashboard(rootInteraction, state);
            return;
        }

        const isThumb = pick === 'set_thumbnail';

        const urlModal = new ModalBuilder()
            .setCustomId('eb_image_url')
            .setTitle(t(state.lang, isThumb ? 'wolf.cmd.tools.embedbuilder.optSetThumbnail' : 'wolf.cmd.tools.embedbuilder.optSetLargeImage'))
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('image_url')
                        .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelImageUrl'))
                        .setStyle(TextInputStyle.Short)
                        .setValue(isThumb ? (state.thumbnail || '') : (state.image || ''))
                        .setRequired(true)
                        .setPlaceholder('https://example.com/image.png'),
                ),
            );

        await imgInter.showModal(urlModal);

        const submitted = await imgInter
            .awaitModalSubmit({
                filter: i =>
                    i.customId === 'eb_image_url' && i.user.id === imgInter.user.id,
                time: 60_000,
            })
            .catch(() => null);

        if (!submitted) return;

        const url = submitted.fields.getTextInputValue('image_url').trim();
        if (!isValidUrl(url)) {
            await submitted.reply({
                embeds: [
                    errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidUrlTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errInvalidImageUrl')),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (isThumb) state.thumbnail = url;
        else         state.image     = url;

        await submitted.deferUpdate().catch(() => {});
        await refreshDashboard(rootInteraction, state);
    });
}

async function handleAddField(selectInteraction, rootInteraction, state) {
    if (state.fields.length >= MAX_FIELDS) {
        await selectInteraction.deferUpdate();
        await selectInteraction.followUp({
            embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errFieldsFullTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errFieldsFullDesc', { max: MAX_FIELDS }))],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('eb_add_field')
        .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalAddFieldTitle'));

    const fieldNameLabel = new LabelBuilder()
        .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFieldName'))
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('field_name')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(256)
                .setRequired(true)
                .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderFieldName')),
        );

    const fieldValueLabel = new LabelBuilder()
        .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFieldValue'))
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('field_value')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1024)
                .setRequired(true)
                .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.placeholderFieldValue')),
        );

    const inlineRadio = new RadioGroupBuilder()
        .setCustomId('field_inline')
        .setRequired(false)
        .addOptions([
            { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineNo'), value: 'no' },
            { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineYes'), value: 'yes' },
        ]);

    const inlineLabel = new LabelBuilder()
        .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelDisplayInline'))
        .setRadioGroupComponent(inlineRadio);

    modal.addLabelComponents(fieldNameLabel, fieldValueLabel, inlineLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'eb_add_field' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const name     = submitted.fields.getTextInputValue('field_name').trim();
    const value    = submitted.fields.getTextInputValue('field_value').trim();
    const inline   = submitted.fields.getRadioGroup('field_inline') === 'yes';

    state.fields.push({ name, value, inline });

    await submitted.deferUpdate().catch(() => {});
    await refreshDashboard(rootInteraction, state);
}

async function handleEditField(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_edit_field_pick')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.selectFieldEditPlaceholder'))
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(
                        t(state.lang, 'wolf.cmd.tools.embedbuilder.fieldOptionDesc', {
                            val: `${f.value.substring(0, 80)}${f.value.length > 80 ? '…' : ''}`,
                            align: f.inline
                                ? t(state.lang, 'wolf.cmd.tools.embedbuilder.fieldOptionAlignInline')
                                : t(state.lang, 'wolf.cmd.tools.embedbuilder.fieldOptionAlignBlock'),
                        })
                    )
                    .setValue(String(i))
                    .setEmoji('📝'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.editFieldTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.editFieldDesc'))
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const pickCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_edit_field_pick',
        time: 60_000,
        max: 1,
    });

    pickCollector.on('collect', async pickInter => {
        const idx   = parseInt(pickInter.values[0], 10);
        const field = state.fields[idx];
        if (!field) { await pickInter.deferUpdate(); return; }

        const modal = new ModalBuilder()
            .setCustomId('eb_edit_field_modal')
            .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.modalEditFieldTitle', { index: idx + 1 }));

        const editNameLabel = new LabelBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFieldName'))
            .setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('field_name')
                    .setStyle(TextInputStyle.Short)
                    .setValue(field.name)
                    .setMaxLength(256)
                    .setRequired(true),
            );

        const editValueLabel = new LabelBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelFieldValue'))
            .setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('field_value')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(field.value.substring(0, 4000))
                    .setMaxLength(1024)
                    .setRequired(true),
            );

        const editInlineRadio = new RadioGroupBuilder()
            .setCustomId('field_inline')
            .setRequired(false)
            .addOptions([
                { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineNo'), value: 'no' },
                { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineYes'), value: 'yes' },
            ]);
        // Pre-select the current value
        if (field.inline) {
            editInlineRadio.setOptions([
                { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineNo'), value: 'no' },
                { label: t(state.lang, 'wolf.cmd.tools.embedbuilder.valDisplayInlineYes'), value: 'yes', default: true },
            ]);
        }

        const editInlineLabel = new LabelBuilder()
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.labelDisplayInline'))
            .setRadioGroupComponent(editInlineRadio);

        modal.addLabelComponents(editNameLabel, editValueLabel, editInlineLabel);

        await pickInter.showModal(modal);

        const submitted = await pickInter
            .awaitModalSubmit({
                filter: i =>
                    i.customId === 'eb_edit_field_modal' && i.user.id === pickInter.user.id,
                time: 120_000,
            })
            .catch(() => null);

        if (!submitted) return;

        const name   = submitted.fields.getTextInputValue('field_name').trim();
        const value  = submitted.fields.getTextInputValue('field_value').trim();
        const inline = submitted.fields.getRadioGroup('field_inline') === 'yes';

        state.fields[idx] = { name, value, inline };

        await submitted.deferUpdate().catch(() => {});
        await refreshDashboard(rootInteraction, state);
    });
}

async function handleRemoveField(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_remove_field_pick')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.selectFieldRemovePlaceholder'))
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(
                        `${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`,
                    )
                    .setValue(String(i))
                    .setEmoji('➖'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.removeFieldTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.removeFieldDesc'))
                .setColor(getColor('warning')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const removeCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_remove_field_pick',
        time: 60_000,
        max: 1,
    });

    removeCollector.on('collect', async removeInter => {
        await removeInter.deferUpdate();
        const idx = parseInt(removeInter.values[0], 10);
        state.fields.splice(idx, 1);
        await refreshDashboard(rootInteraction, state);
    });
}

async function handleReorderFields(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const pickSelect = new StringSelectMenuBuilder()
        .setCustomId('eb_reorder_pick')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.selectFieldReorderPlaceholder'))
        .addOptions(
            state.fields.slice(0, 25).map((f, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${f.name.substring(0, 50)}`)
                    .setDescription(
                        `${f.value.substring(0, 90)}${f.value.length > 90 ? '…' : ''}`,
                    )
                    .setValue(String(i))
                    .setEmoji('↕️'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.reorderFieldsTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.reorderFieldsDesc'))
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(pickSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const pickCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_reorder_pick',
        time: 60_000,
        max: 1,
    });

    pickCollector.on('collect', async pickInter => {
        await pickInter.deferUpdate();
        const sourceIdx = parseInt(pickInter.values[0], 10);

        const upBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_up')
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.btnMoveUp'))
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬆️')
            .setDisabled(sourceIdx === 0);

        const downBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_down')
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.btnMoveDown'))
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬇️')
            .setDisabled(sourceIdx === state.fields.length - 1);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('eb_reorder_cancel')
            .setLabel(t(state.lang, 'wolf.cmd.tools.embedbuilder.btnCancel'))
            .setStyle(ButtonStyle.Secondary);

        await pickInter.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.moveFieldTitle'))
                    .setDescription(
                        t(state.lang, 'wolf.cmd.tools.embedbuilder.moveFieldDesc', {
                            name: state.fields[sourceIdx].name,
                            pos: sourceIdx + 1,
                            total: state.fields.length,
                        })
                    )
                    .setColor(getColor('info')),
            ],
            components: [new ActionRowBuilder().addComponents(upBtn, downBtn, cancelBtn)],
            flags: MessageFlags.Ephemeral,
        });

        const dirCollector = rootInteraction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i =>
                i.user.id === selectInteraction.user.id &&
                ['eb_reorder_up', 'eb_reorder_down', 'eb_reorder_cancel'].includes(i.customId),
            time: 30_000,
            max: 1,
        });

        dirCollector.on('collect', async dirInter => {
            await dirInter.deferUpdate();
            if (dirInter.customId === 'eb_reorder_cancel') return;

            const targetIdx =
                dirInter.customId === 'eb_reorder_up' ? sourceIdx - 1 : sourceIdx + 1;

            if (targetIdx < 0 || targetIdx >= state.fields.length) return;

            const temp             = state.fields[sourceIdx];
            state.fields[sourceIdx] = state.fields[targetIdx];
            state.fields[targetIdx] = temp;

            await refreshDashboard(rootInteraction, state);
        });
    });
}

async function handlePostEmbed(selectInteraction, rootInteraction, state, guild) {
    if (
        !state.title &&
        !state.description &&
        state.fields.length === 0 &&
        !state.author?.name
    ) {
        await selectInteraction.deferUpdate();
        await selectInteraction.followUp({
            embeds: [
                errorEmbed(
                    t(state.lang, 'wolf.cmd.tools.embedbuilder.errEmptyEmbedTitle'),
                    t(state.lang, 'wolf.cmd.tools.embedbuilder.errEmptyEmbedDesc'),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await selectInteraction.deferUpdate();

    const chanSelect = new ChannelSelectMenuBuilder()
        .setCustomId('eb_post_channel')
        .setPlaceholder(t(state.lang, 'wolf.cmd.tools.embedbuilder.postChannelPlaceholder'))
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.postEmbedTitle'))
                .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.postEmbedDesc'))
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(chanSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'eb_post_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInter => {
        await chanInter.deferUpdate();
        const channel = chanInter.channels.first();

        if (!channel) {
            await chanInter.followUp({
                embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.errNoChannelTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.errNoChannelDesc'))],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const perms = channel.permissionsFor(guild.members.me);
        if (!perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            await chanInter.followUp({
                embeds: [
                    errorEmbed(
                        t(state.lang, 'wolf.cmd.tools.embedbuilder.errMissingPermsTitle'),
                        t(state.lang, 'wolf.cmd.tools.embedbuilder.errMissingPermsDesc', { channel: channel.toString() }),
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const finalEmbed = buildPreviewEmbed(state);

        // Remove the placeholder description before sending
        if (finalEmbed.data.description === t(state.lang, 'wolf.cmd.tools.embedbuilder.emptyPreview')) {
            finalEmbed.setDescription(null);
        }

        await channel.send({ embeds: [finalEmbed] });

        await chanInter.followUp({
            embeds: [successEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.successEmbedSentTitle'), t(state.lang, 'wolf.cmd.tools.embedbuilder.successEmbedSentDesc', { channel: channel.toString() }))],
            flags: MessageFlags.Ephemeral,
        });
    });
}

async function handleJsonExport(selectInteraction, rootInteraction, state) {
    await selectInteraction.deferUpdate();

    const previewEmbed = buildPreviewEmbed(state);
    const json = JSON.stringify(previewEmbed.toJSON(), null, 2);

    if (json.length <= 3980) {
        await selectInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.jsonExportTitle'))
                    .setDescription(`\`\`\`json\n${json}\n\`\`\``)
                    .setColor(getColor('info')),
            ],
            flags: MessageFlags.Ephemeral,
        });
    } else {
        await selectInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(t(state.lang, 'wolf.cmd.tools.embedbuilder.jsonExportTitle'))
                    .setDescription(t(state.lang, 'wolf.cmd.tools.embedbuilder.jsonTooLongDesc'))
                    .setColor(getColor('info')),
            ],
            files: [
                {
                    attachment: Buffer.from(json, 'utf-8'),
                    name: 'embed.json',
                },
            ],
            flags: MessageFlags.Ephemeral,
        });
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('embedbuilder')
        .setDescription('Build and post a fully custom embed with live preview')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, config) {
        try {
            const lang = pickLanguage(config, interaction.guild);
            const deferSuccess = await InteractionHelper.safeDefer(interaction, {
                flags: MessageFlags.Ephemeral,
            });
            if (!deferSuccess) return;

            const guild = interaction.guild;

            // Builder state — holds every embed property being constructed
            const state = {
                lang,
                title:       null,
                description: null,
                color:       getColor('primary'),
                author:      null,
                footer:      null,
                thumbnail:   null,
                image:       null,
                timestamp:   false,
                fields:      [],
            };

            await refreshDashboard(interaction, state);

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id && i.customId === 'eb_menu',
                time: IDLE_TIMEOUT,
            });

            collector.on('collect', async ci => {
                try {
                    switch (ci.values[0]) {
                        case 'edit_content':
                            await handleEditContent(ci, interaction, state);
                            break;
                        case 'set_color':
                            await handleSetColor(ci, interaction, state);
                            break;
                        case 'set_author':
                            await handleSetAuthor(ci, interaction, state);
                            break;
                        case 'set_footer':
                            await handleSetFooter(ci, interaction, state);
                            break;
                        case 'set_images':
                            await handleSetImages(ci, interaction, state);
                            break;
                        case 'add_field':
                            await handleAddField(ci, interaction, state);
                            break;
                        case 'edit_field':
                            await handleEditField(ci, interaction, state);
                            break;
                        case 'remove_field':
                            await handleRemoveField(ci, interaction, state);
                            break;
                        case 'reorder_fields':
                            await handleReorderFields(ci, interaction, state);
                            break;
                        case 'toggle_timestamp':
                            state.timestamp = !state.timestamp;
                            await ci.deferUpdate();
                            await refreshDashboard(interaction, state);
                            break;
                        case 'post_embed':
                            await handlePostEmbed(ci, interaction, state, guild);
                            break;
                        case 'json_export':
                            await handleJsonExport(ci, interaction, state);
                            break;
                        case 'reset_all':
                            state.title       = null;
                            state.description = null;
                            state.color       = getColor('primary');
                            state.author      = null;
                            state.footer      = null;
                            state.thumbnail   = null;
                            state.image       = null;
                            state.timestamp   = false;
                            state.fields      = [];
                            await ci.deferUpdate();
                            await refreshDashboard(interaction, state);
                            break;
                        default:
                            await ci.deferUpdate();
                    }
                } catch (error) {
                    logger.error('Error in embedbuilder collector:', error);
                    const msg =
                        error instanceof TitanBotError
                            ? error.userMessage || t(state.lang, 'wolf.cmd.tools.calculate.generalErr')
                            : t(state.lang, 'wolf.cmd.tools.calculate.generalErr');
                    if (!ci.replied && !ci.deferred) await ci.deferUpdate().catch(() => {});
                    await ci
                        .followUp({
                            embeds: [errorEmbed(t(state.lang, 'wolf.cmd.tools.embedbuilder.contextErrorTitle'), msg)],
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in embedbuilder:', error);
            throw new TitanBotError(
                `embedbuilder failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                t(lang, 'wolf.cmd.tools.embedbuilder.errFailedOpenTitle'),
            );
        }
    },
};
