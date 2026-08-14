import { PermissionsBitField, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { t, pickLanguage } from '../../../services/i18n.js';

export default {
    async execute(interaction, config, client) {
        const lang = pickLanguage(config, interaction.guild);

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.birthday.permDeniedTitle'),
                    t(lang, 'wolf.cmd.birthday.permDeniedDesc')
                )],
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const channel = interaction.options.getChannel('channel');
            const guildId = interaction.guildId;
            const guildConfig = await getGuildConfig(client, guildId);

            if (channel) {
                guildConfig.birthdayChannelId = channel.id;
                await setGuildConfig(client, guildId, guildConfig);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed(
                        t(lang, 'wolf.cmd.birthday.enabledTitle'),
                        t(lang, 'wolf.cmd.birthday.enabledDesc', { channel })
                    )],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                guildConfig.birthdayChannelId = null;
                await setGuildConfig(client, guildId, guildConfig);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed(
                        t(lang, 'wolf.cmd.birthday.disabledTitle'),
                        t(lang, 'wolf.cmd.birthday.disabledDesc')
                    )],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            logger.error('birthday_setchannel error:', error);
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed(
                    t(lang, 'wolf.cmd.birthday.configErrorTitle'),
                    t(lang, 'wolf.cmd.birthday.configErrorDesc')
                )],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
