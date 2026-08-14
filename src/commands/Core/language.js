import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription("Change Wolf's language for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return await interaction.reply({
        content: '❌ You need the **Manage Server** permission to change Wolf\'s language.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🌎 Wolf — Language / Idioma')
      .setDescription('Select the language Wolf should use in this server.\n\nSelecciona el idioma que Wolf debe usar en este servidor.')
      .setFooter({ text: 'The setting is saved per server. • La configuración se guarda por servidor.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wolf_lang:es')
        .setLabel('Español')
        .setEmoji('🇪🇸')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wolf_lang:en')
        .setLabel('English')
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
