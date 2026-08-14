import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../../services/guildConfigService.js';
import { t } from '../../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription("Change Wolf's language for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return await interaction.reply({
        content: '❌ ' + t('es', 'wolf.cmd.welcome.missingPerms', { cmd: 'language' }),
        ephemeral: true,
      });
    }

    const config = await getGuildConfig(interaction.client.db, interaction.guildId);
    const language = config?.language === 'en' ? 'en' : 'es';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t(language, 'wolf.setup.title', { brand: 'Wolf' }))
      .setDescription(t(language, 'wolf.setup.description'))
      .setFooter({ text: t(language, 'wolf.setup.note') });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wolf_lang:es')
        .setLabel(t(language, 'wolf.setup.langButtonES'))
        .setEmoji('🇪🇸')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wolf_lang:en')
        .setLabel(t(language, 'wolf.setup.langButtonEN'))
        .setEmoji('🇺🇸')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
