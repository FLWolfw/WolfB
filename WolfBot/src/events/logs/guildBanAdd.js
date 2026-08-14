import { Events, AuditLogEvent } from 'discord.js';
import { getGuildConfig } from '../../services/guildConfigService.js';
import { isEventEnabled } from '../../services/loggingService.js';
import { resolveLogChannel } from '../../utils/logChannel.js';
import { fetchExecutor, executorText } from '../../utils/auditLog.js';
import { createLogEmbed } from '../../utils/logEmbed.js';

export default {
  name: Events.GuildBanAdd,

  async execute(ban, client) {
    const guild = ban.guild;
    if (!guild) return;

    const config = await getGuildConfig(client.db, guild.id);
    if (!isEventEnabled(config, 'moderation.ban')) return;

    const logChannel = await resolveLogChannel(guild, config, 'moderation');
    if (!logChannel) return;

    const executor = await fetchExecutor(guild, AuditLogEvent.MemberBanAdd, {
      targetId: ban.user.id,
    });

    const reason =
      ban.reason ||
      executor?.reason ||
      'No especificada';

    const embed = createLogEmbed({
      title: '🔨 Usuario Baneado',
      color: '#721919',
      user: ban.user,
      thumbnail: ban.user.displayAvatarURL({ dynamic: true }),
      fields: [
        {
          name: '👤 Usuario',
          value: `${ban.user.tag}\n${ban.user}\n🆔 \`${ban.user.id}\``,
          inline: true,
        },
        {
          name: '🧑‍💼 Baneado por',
          value: executorText(executor),
          inline: true,
        },
        {
          name: '📝 Razón',
          value: reason,
          inline: false,
        },
      ],
      footer: `Servidor: ${guild.name}`,
    });

    await logChannel.send({ embeds: [embed] });
  },
};
