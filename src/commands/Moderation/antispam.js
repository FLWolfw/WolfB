import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getAntiSpamConfig } from '../../services/antiSpam.js';

function buildPanel(config) {
  const status = config.enabled ? '🟢 ACTIVADO' : '🔴 DESACTIVADO';
  const timeoutSeconds = Math.round(config.timeoutMs / 1000);
  return new EmbedBuilder()
    .setColor(config.enabled ? 0x22c55e : 0xef4444)
    .setTitle('🛡️ Wolf — Anti-Spam')
    .setDescription('Protege el servidor contra mensajes enviados demasiado rápido o repetidos.\n\nUsa los botones para activar o desactivar el sistema.')
    .addFields(
      { name: 'Estado', value: status, inline: true },
      { name: 'Límite', value: `${config.maxMessages} mensajes / ${config.windowMs / 1000}s`, inline: true },
      { name: 'Repetidos', value: `${config.duplicateThreshold} iguales`, inline: true },
      { name: 'Acción', value: `${config.deleteMessages ? 'Eliminar mensaje + ' : ''}Timeout ${timeoutSeconds}s`, inline: false },
    )
    .setFooter({ text: 'La configuración se guarda por servidor en PostgreSQL.' });
}

function buildButtons(enabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('antispam:enable').setLabel('Activar').setEmoji('🟢').setStyle(ButtonStyle.Success).setDisabled(enabled),
    new ButtonBuilder().setCustomId('antispam:disable').setLabel('Desactivar').setEmoji('🔴').setStyle(ButtonStyle.Danger).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('antispam:refresh').setLabel('Actualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );
}

export function createAntiSpamPanel(config) {
  return { embeds: [buildPanel(config)], components: [buildButtons(config.enabled)] };
}

export default {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Abre el panel de protección Anti-Spam')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString()),

  async execute(interaction, _guildConfig, client) {
    const config = await getAntiSpamConfig(client.db, interaction.guildId);
    await interaction.reply({ ...createAntiSpamPanel(config), ephemeral: true });
  },
};
