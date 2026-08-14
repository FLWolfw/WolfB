import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, LabelBuilder } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { t, pickLanguage } from '../../services/i18n.js';
import {
    initializeJoinToCreate,
    getChannelConfiguration,
    updateChannelConfig,
    removeTriggerChannel,
    hasManageGuildPermission,
    logConfigurationChange,
    getConfiguration
} from '../../services/joinToCreateService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("jointocreate")
        .setNameLocalizations({
            'es-ES': 'unirsecrear',
            'es-419': 'unirsecrear'
        })
        .setDescription("Manage Join to Create voice channels system.")
        .setDescriptionLocalizations({
            'es-ES': 'Gestiona el sistema de canales de voz "Unirse para Crear"',
            'es-419': 'Gestiona el sistema de canales de voz "Unirse para Crear"'
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setNameLocalizations({
                    'es-ES': 'configurar',
                    'es-419': 'configurar'
                })
                .setDescription("Set up a new Join to Create voice channel.")
                .setDescriptionLocalizations({
                    'es-ES': 'Configura un nuevo canal de voz "Unirse para Crear"',
                    'es-419': 'Configura un nuevo canal de voz "Unirse para Crear"'
                })
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setNameLocalizations({
                            'es-ES': 'categoria',
                            'es-419': 'categoria'
                        })
                        .setDescription("Category to create the channel in.")
                        .setDescriptionLocalizations({
                            'es-ES': 'Categoría en la que se creará el canal',
                            'es-419': 'Categoría en la que se creará el canal'
                        })
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption((option) =>
                    option
                        .setName("channel_name")
                        .setNameLocalizations({
                            'es-ES': 'nombre_canal',
                            'es-419': 'nombre_canal'
                        })
                        .setDescription("Select a template for naming temporary voice channels.")
                        .setDescriptionLocalizations({
                            'es-ES': 'Selecciona una plantilla para nombrar canales de voz temporales',
                            'es-419': 'Selecciona una plantilla para nombrar canales de voz temporales'
                        })
                        .addChoices(
                            { name: "{username}'s Room (Default)", value: "{username}'s Room" },
                            { name: "{username}'s Channel", value: "{username}'s Channel" },
                            { name: "{username}'s Lounge", value: "{username}'s Lounge" },
                            { name: "{username}'s Space", value: "{username}'s Space" },
                            { name: "{displayName}'s Room", value: "{displayName}'s Room" },
                            { name: "{username}'s VC", value: "{username}'s VC" },
                            { name: "🎮 {username}'s Gaming Room", value: "🎮 {username}'s Gaming Room" },
                            { name: "💬 {username}'s Chat Room", value: "💬 {username}'s Chat Room" },
                            { name: "{username}'s Private Room", value: "{username}'s Private Room" }
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("user_limit")
                        .setNameLocalizations({
                            'es-ES': 'limite_usuarios',
                            'es-419': 'limite_usuarios'
                        })
                        .setDescription("Maximum number of users in temporary channels. (0 = unlimited)")
                        .setDescriptionLocalizations({
                            'es-ES': 'Número máximo de usuarios en canales temporales (0 = ilimitado)',
                            'es-419': 'Número máximo de usuarios en canales temporales (0 = ilimitado)'
                        })
                )
                .addIntegerOption((option) =>
                    option
                        .setName("bitrate")
                        .setNameLocalizations({
                            'es-ES': 'bitrate',
                            'es-419': 'bitrate'
                        })
                        .setDescription("Bitrate for temporary channels in kbps (8-96).")
                        .setDescriptionLocalizations({
                            'es-ES': 'Tasa de bits (bitrate) para canales temporales en kbps (8-96)',
                            'es-419': 'Tasa de bits (bitrate) para canales temporales en kbps (8-96)'
                        })
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setNameLocalizations({
                    'es-ES': 'panel',
                    'es-419': 'panel'
                })
                .setDescription("Configure an existing Join to Create system.")
                .setDescriptionLocalizations({
                    'es-ES': 'Configura un sistema "Unirse para Crear" existente',
                    'es-419': 'Configura un sistema "Unirse para Crear" existente'
                })
                .addChannelOption((option) =>
                    option
                        .setName("trigger_channel")
                        .setNameLocalizations({
                            'es-ES': 'canal_origen',
                            'es-419': 'canal_origen'
                        })
                        .setDescription("The Join to Create trigger channel to configure.")
                        .setDescriptionLocalizations({
                            'es-ES': 'El canal de voz origen que se configurará',
                            'es-419': 'El canal de voz origen que se configurará'
                        })
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        ),
    category: "utility",

    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);
        try {
            if (!hasManageGuildPermission(interaction.member)) {
                throw new TitanBotError(
                    'User lacks ManageGuild permission',
                    ErrorTypes.PERMISSION,
                    t(lang, 'wolf.cmd.jtc.permDenied')
                );
            }

            const subcommand = interaction.options.getSubcommand();
            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            if (subcommand === "setup") {
                await handleSetupSubcommand(interaction, client, lang);
                return;
            } else if (subcommand === "dashboard") {
                await handleConfigSubcommand(interaction, client, lang);
                return;
            }

        } catch (error) {
            try {
                let errorMessage = t(lang, 'wolf.cmd.jtc.genericError');

                if (error instanceof TitanBotError) {
                    errorMessage = error.userMessage || t(lang, 'wolf.cmd.jtc.genericError');
                    logger.debug(`TitanBotError [${error.type}]: ${error.message}`, error.context || {});
                } else {
                    logger.error('Unexpected error in jointocreate command:', error);
                    errorMessage = t(lang, 'wolf.cmd.jtc.unexpectedError');
                }

                const errorEmbedObj = errorEmbed(t(lang, 'wolf.cmd.jtc.errorTitle'), errorMessage);

                if (interaction.deferred) {
                    return await InteractionHelper.safeEditReply(interaction, { embeds: [errorEmbedObj] });
                } else {
                    return await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedObj], flags: MessageFlags.Ephemeral });
                }
            } catch (replyError) {
                logger.error('Failed to send error message:', replyError);
            }
        }
    }
};

async function handleSetupSubcommand(interaction, client, lang) {
    try {
        const category = interaction.options.getChannel('category');
        const nameTemplate = interaction.options.getString('channel_name') || "{username}'s Room";
        const userLimit = interaction.options.getInteger('user_limit') || 0;
        const bitrate = interaction.options.getInteger('bitrate') || 64;
        const guildId = interaction.guild.id;

        logger.debug(`Setting up Join to Create in guild ${guildId} with template: ${nameTemplate}`);

        const existingConfig = await getConfiguration(client, guildId);

        if (Array.isArray(existingConfig.triggerChannels) && existingConfig.triggerChannels.length > 0) {
            const activeTriggerChannels = [];
            const staleTriggerChannelIds = [];

            for (const existingChannelId of existingConfig.triggerChannels) {
                const existingChannel = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
                if (existingChannel) activeTriggerChannels.push(existingChannel);
                else staleTriggerChannelIds.push(existingChannelId);
            }

            if (staleTriggerChannelIds.length > 0) {
                for (const staleChannelId of staleTriggerChannelIds) {
                    logger.info(`Cleaning up stale JTC trigger ${staleChannelId} from guild ${guildId}`);
                    await removeTriggerChannel(client, guildId, staleChannelId);
                }
            }

            if (activeTriggerChannels.length > 0) {
                const primaryTrigger = activeTriggerChannels[0];
                throw new TitanBotError(
                    'Guild already has a Join to Create channel',
                    ErrorTypes.VALIDATION,
                    t(lang, 'wolf.cmd.jtc.alreadyExists', { channel: primaryTrigger }),
                    { guildId, activeTriggerCount: activeTriggerChannels.length, expected: true, suppressErrorLog: true }
                );
            }
        }

        let triggerChannel = await interaction.guild.channels.create({
            name: 'Join to Create',
            type: ChannelType.GuildVoice,
            parent: category?.id,
            userLimit: 0,
            bitrate: 64000,
            permissionOverwrites: [
                { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
            ],
        });

        await initializeJoinToCreate(client, guildId, triggerChannel.id, {
            nameTemplate,
            userLimit,
            bitrate: bitrate * 1000,
            categoryId: category?.id
        });

        await logConfigurationChange(client, guildId, interaction.user.id, 'Initialized Join to Create', {
            channelId: triggerChannel.id, nameTemplate, userLimit, bitrate
        });

        logger.info(`Successfully created Join to Create system in guild ${guildId}`);

        const limitStr = userLimit === 0
            ? t(lang, 'wolf.cmd.jtc.setupUnlimited')
            : t(lang, 'wolf.cmd.jtc.setupUsers', { n: userLimit });
        const categoryLine = category
            ? t(lang, 'wolf.cmd.jtc.setupCategoryLine', { name: category.name })
            : t(lang, 'wolf.cmd.jtc.setupRootLine');

        const responseEmbed = successEmbed(
            t(lang, 'wolf.cmd.jtc.setupSuccessTitle'),
            t(lang, 'wolf.cmd.jtc.setupSuccessDesc', {
                channel: triggerChannel,
                template: nameTemplate,
                limit: limitStr,
                bitrate,
                category: categoryLine,
            })
        );

        return await InteractionHelper.safeEditReply(interaction, { embeds: [responseEmbed] });

    } catch (error) {
        logger.error('Error in handleSetupSubcommand:', error);
        if (error instanceof TitanBotError) throw error;
        throw new TitanBotError(
            `Setup failed: ${error.message}`,
            ErrorTypes.DISCORD_API,
            t(lang, 'wolf.cmd.jtc.setupFailed')
        );
    }
}

async function handleConfigSubcommand(interaction, client, lang) {
    try {
        const triggerChannel = interaction.options.getChannel('trigger_channel');
        const currentConfig = await getChannelConfiguration(client, interaction.guild.id, triggerChannel.id);
        const channelConfig = currentConfig.channelConfig || {};

        const userLimit = channelConfig.userLimit ?? currentConfig.userLimit ?? 0;
        const userLimitStr = userLimit === 0
            ? t(lang, 'wolf.cmd.jtc.unlimited')
            : t(lang, 'wolf.cmd.jtc.usersSuffix', { n: userLimit });

        const configEmbed = new EmbedBuilder()
            .setTitle(t(lang, 'wolf.cmd.jtc.configTitle'))
            .setDescription(t(lang, 'wolf.cmd.jtc.configDesc', { channel: triggerChannel }))
            .setColor(getColor('info'))
            .addFields(
                {
                    name: t(lang, 'wolf.cmd.jtc.fieldNameTemplate'),
                    value: `\`${channelConfig.nameTemplate || currentConfig.channelNameTemplate || "{username}'s Room"}\``,
                    inline: false
                },
                {
                    name: t(lang, 'wolf.cmd.jtc.fieldUserLimit'),
                    value: userLimitStr,
                    inline: true
                },
                {
                    name: t(lang, 'wolf.cmd.jtc.fieldBitrate'),
                    value: `${(channelConfig.bitrate ?? currentConfig.bitrate ?? 64000) / 1000} kbps`,
                    inline: true
                }
            )
            .setFooter({ text: t(lang, 'wolf.cmd.jtc.configFooter') })
            .setTimestamp();

        const nameButton = new ButtonBuilder()
            .setCustomId(`jtc_config_name_${triggerChannel.id}`)
            .setLabel(t(lang, 'wolf.cmd.jtc.btnNameTemplate'))
            .setStyle(ButtonStyle.Primary);

        const limitButton = new ButtonBuilder()
            .setCustomId(`jtc_config_limit_${triggerChannel.id}`)
            .setLabel(t(lang, 'wolf.cmd.jtc.btnUserLimit'))
            .setStyle(ButtonStyle.Primary);

        const bitrateButton = new ButtonBuilder()
            .setCustomId(`jtc_config_bitrate_${triggerChannel.id}`)
            .setLabel(t(lang, 'wolf.cmd.jtc.btnBitrate'))
            .setStyle(ButtonStyle.Primary);

        const deleteButton = new ButtonBuilder()
            .setCustomId(`jtc_config_delete_${triggerChannel.id}`)
            .setLabel(t(lang, 'wolf.cmd.jtc.btnRemoveChannel'))
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(nameButton, limitButton, bitrateButton, deleteButton);

        await InteractionHelper.safeEditReply(interaction, { embeds: [configEmbed], components: [row] });

        const message = await interaction.fetchReply();

        if (!message || typeof message.createMessageComponentCollector !== 'function') {
            throw new TitanBotError(
                'Failed to fetch interaction reply for collector setup',
                ErrorTypes.DISCORD_API,
                t(lang, 'wolf.cmd.jtc.configControlsFailed')
            );
        }

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async (buttonInteraction) => {
            try {
                if (!hasManageGuildPermission(buttonInteraction.member)) {
                    await buttonInteraction.reply({
                        content: t(lang, 'wolf.cmd.jtc.permDeniedButton'),
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const customId = buttonInteraction.customId;

                if (customId.includes('jtc_config_name_')) {
                    await handleNameTemplateModal(buttonInteraction, triggerChannel, currentConfig, client, lang);
                } else if (customId.includes('jtc_config_limit_')) {
                    await handleUserLimitModal(buttonInteraction, triggerChannel, currentConfig, client, lang);
                } else if (customId.includes('jtc_config_bitrate_')) {
                    await handleBitrateModal(buttonInteraction, triggerChannel, currentConfig, client, lang);
                } else if (customId.includes('jtc_config_delete_')) {
                    await handleChannelDeletion(buttonInteraction, triggerChannel, currentConfig, client, lang);
                }
            } catch (error) {
                logger.error('JTC configuration interaction error:', error);
                try {
                    if (!buttonInteraction.replied && !buttonInteraction.deferred) {
                        await buttonInteraction.reply({
                            content: t(lang, 'wolf.cmd.jtc.configInteractionError'),
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        await buttonInteraction.followUp({
                            content: t(lang, 'wolf.cmd.jtc.configInteractionError'),
                            flags: MessageFlags.Ephemeral
                        });
                    }
                } catch (replyError) {
                    logger.error('Failed to send JTC config interaction error:', replyError);
                }
            }
        });

        collector.on('end', async () => {
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    nameButton.setDisabled(true),
                    limitButton.setDisabled(true),
                    bitrateButton.setDisabled(true),
                    deleteButton.setDisabled(true)
                );
                await InteractionHelper.safeEditReply(interaction, { components: [disabledRow] });
            } catch (error) {
                logger.debug('JTC collector cleanup skipped', { error: error?.message });
            }
        });

    } catch (error) {
        logger.error('Error in handleConfigSubcommand:', error);
        if (error instanceof TitanBotError) throw error;
        throw new TitanBotError(
            `Dashboard configuration failed: ${error.message}`,
            ErrorTypes.DISCORD_API,
            t(lang, 'wolf.cmd.jtc.configFailed')
        );
    }
}

async function handleNameTemplateModal(interaction, triggerChannel, currentConfig, client, lang) {
    const modal = new ModalBuilder()
        .setCustomId(`jtc_name_modal_${triggerChannel.id}`)
        .setTitle(t(lang, 'wolf.cmd.jtc.nameModalTitle'));

    const nameInput = new TextInputBuilder()
        .setCustomId('name_template')
        .setLabel(t(lang, 'wolf.cmd.jtc.nameTemplateLabel'))
        .setStyle(TextInputStyle.Short)
        .setValue(currentConfig.channelNameTemplate || "{username}'s Room")
        .setPlaceholder("{username}'s Room")
        .setRequired(true)
        .setMaxLength(100);

    const row = new ActionRowBuilder().addComponents(nameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === `jtc_name_modal_${triggerChannel.id}` && i.user.id === interaction.user.id,
        time: 60000
    }).catch(() => null);

    if (!modalSubmit) return;

    try {
        await modalSubmit.deferUpdate();
        const newNameTemplate = modalSubmit.fields.getTextInputValue('name_template');
        if (!newNameTemplate || newNameTemplate.trim().length === 0) {
            throw new TitanBotError(
                'Invalid name template',
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.jtc.invalidNameTemplate')
            );
        }

        await updateChannelConfig(client, interaction.guild.id, triggerChannel.id, {
            nameTemplate: newNameTemplate.trim()
        });

        await logConfigurationChange(client, interaction.guild.id, interaction.user.id, 'Updated channel name template', {
            channelId: triggerChannel.id,
            nameTemplate: newNameTemplate.trim()
        });

        await modalSubmit.editReply({
            content: t(lang, 'wolf.cmd.jtc.nameUpdated'),
            embeds: [],
            components: []
        });

    } catch (error) {
        logger.error('Error updating name template:', error);
        const errorMsg = error instanceof TitanBotError ? error.userMessage : t(lang, 'wolf.cmd.jtc.updateFailed');
        if (modalSubmit.deferred || modalSubmit.replied) {
            await modalSubmit.editReply({ content: errorMsg, embeds: [], components: [] });
        } else {
            await modalSubmit.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        }
    }
}

async function handleUserLimitModal(interaction, triggerChannel, currentConfig, client, lang) {
    const modal = new ModalBuilder()
        .setCustomId(`jtc_limit_modal_${triggerChannel.id}`)
        .setTitle(t(lang, 'wolf.cmd.jtc.limitModalTitle'));

    const limitInput = new TextInputBuilder()
        .setCustomId('user_limit')
        .setLabel(t(lang, 'wolf.cmd.jtc.limitLabel'))
        .setStyle(TextInputStyle.Short)
        .setValue(String(currentConfig.userLimit || 0))
        .setPlaceholder('0-99')
        .setRequired(true)
        .setMaxLength(2);

    const row = new ActionRowBuilder().addComponents(limitInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === `jtc_limit_modal_${triggerChannel.id}` && i.user.id === interaction.user.id,
        time: 60000
    }).catch(() => null);

    if (!modalSubmit) return;

    try {
        await modalSubmit.deferUpdate();
        const limitValue = parseInt(modalSubmit.fields.getTextInputValue('user_limit'), 10);
        if (isNaN(limitValue) || limitValue < 0 || limitValue > 99) {
            throw new TitanBotError(
                'Invalid user limit',
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.jtc.invalidLimit')
            );
        }

        await updateChannelConfig(client, interaction.guild.id, triggerChannel.id, {
            userLimit: limitValue
        });

        await triggerChannel.setUserLimit(limitValue);

        await logConfigurationChange(client, interaction.guild.id, interaction.user.id, 'Updated user limit', {
            channelId: triggerChannel.id,
            userLimit: limitValue
        });

        await modalSubmit.editReply({
            content: t(lang, 'wolf.cmd.jtc.limitUpdated', { n: limitValue }),
            embeds: [],
            components: []
        });

    } catch (error) {
        logger.error('Error updating user limit:', error);
        const errorMsg = error instanceof TitanBotError ? error.userMessage : t(lang, 'wolf.cmd.jtc.updateFailed');
        if (modalSubmit.deferred || modalSubmit.replied) {
            await modalSubmit.editReply({ content: errorMsg, embeds: [], components: [] });
        } else {
            await modalSubmit.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        }
    }
}

async function handleBitrateModal(interaction, triggerChannel, currentConfig, client, lang) {
    const modal = new ModalBuilder()
        .setCustomId(`jtc_bitrate_modal_${triggerChannel.id}`)
        .setTitle(t(lang, 'wolf.cmd.jtc.bitrateModalTitle'));

    const bitrateInput = new TextInputBuilder()
        .setCustomId('bitrate')
        .setLabel(t(lang, 'wolf.cmd.jtc.bitrateLabel'))
        .setStyle(TextInputStyle.Short)
        .setValue(String((currentConfig.bitrate || 64000) / 1000))
        .setPlaceholder('8-96')
        .setRequired(true)
        .setMaxLength(2);

    const row = new ActionRowBuilder().addComponents(bitrateInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === `jtc_bitrate_modal_${triggerChannel.id}` && i.user.id === interaction.user.id,
        time: 60000
    }).catch(() => null);

    if (!modalSubmit) return;

    try {
        await modalSubmit.deferUpdate();
        const bitrateValue = parseInt(modalSubmit.fields.getTextInputValue('bitrate'), 10);
        if (isNaN(bitrateValue) || bitrateValue < 8 || bitrateValue > 96) {
            throw new TitanBotError(
                'Invalid bitrate',
                ErrorTypes.VALIDATION,
                t(lang, 'wolf.cmd.jtc.invalidBitrate')
            );
        }

        await updateChannelConfig(client, interaction.guild.id, triggerChannel.id, {
            bitrate: bitrateValue * 1000
        });

        await triggerChannel.setBitrate(bitrateValue * 1000);

        await logConfigurationChange(client, interaction.guild.id, interaction.user.id, 'Updated bitrate', {
            channelId: triggerChannel.id,
            bitrate: bitrateValue
        });

        await modalSubmit.editReply({
            content: t(lang, 'wolf.cmd.jtc.bitrateUpdated', { n: bitrateValue }),
            embeds: [],
            components: []
        });

    } catch (error) {
        logger.error('Error updating bitrate:', error);
        const errorMsg = error instanceof TitanBotError ? error.userMessage : t(lang, 'wolf.cmd.jtc.updateFailed');
        if (modalSubmit.deferred || modalSubmit.replied) {
            await modalSubmit.editReply({ content: errorMsg, embeds: [], components: [] });
        } else {
            await modalSubmit.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        }
    }
}

async function handleChannelDeletion(interaction, triggerChannel, currentConfig, client, lang) {
    try {
        await interaction.deferUpdate();
        await triggerChannel.delete('Join to Create system removed by admin');
        await removeTriggerChannel(client, interaction.guild.id, triggerChannel.id);

        await logConfigurationChange(client, interaction.guild.id, interaction.user.id, 'Removed Join to Create system', {
            channelId: triggerChannel.id
        });

        await interaction.editReply({
            content: t(lang, 'wolf.cmd.jtc.channelRemoved'),
            embeds: [],
            components: []
        });

    } catch (error) {
        logger.error('Error deleting Join to Create channel:', error);
        const errorMsg = error instanceof TitanBotError ? error.userMessage : t(lang, 'wolf.cmd.jtc.deleteFailed');
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMsg, embeds: [], components: [] });
        } else {
            await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        }
    }
}
