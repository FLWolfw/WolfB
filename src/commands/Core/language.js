import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change Wolf\'s language for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString()),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🌎 Wolf — Language')
      .setDescription('Select the language Wolf should use in this server.\n\nSelecciona el idioma que Wolf debe usar en este servidor.')
      .setFooter({ text: 'The setting is saved per server.' });

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
