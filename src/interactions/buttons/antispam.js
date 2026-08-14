import { MessageFlags } from 'discord.js';
import { getAntiSpamConfig, updateAntiSpam } from '../../services/antiSpam.js';
import { createAntiSpamPanel } from '../../commands/Moderation/antispam.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'antispam',

  async execute(interaction, client, args) {
    try {
      const action = (args?.[0] || 'refresh').toLowerCase();
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este panel solo puede usarse dentro de un servidor.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'enable') await updateAntiSpam(client.db, interaction.guildId, { enabled: true });
      if (action === 'disable') await updateAntiSpam(client.db, interaction.guildId, { enabled: false });

      const config = await getAntiSpamConfig(client.db, interaction.guildId);
      await interaction.update(createAntiSpamPanel(config));
    } catch (error) {
      logger.error('Anti-Spam panel failed', {
        event: 'antispam.panel_failed',
        guildId: interaction.guildId,
        userId: interaction.user?.id,
        action: args?.[0],
        error: { name: error?.name, message: error?.message, code: error?.code, stack: error?.stack },
      });
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❌ No pude actualizar la configuración de Anti-Spam.', flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ No pude actualizar la configuración de Anti-Spam.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
