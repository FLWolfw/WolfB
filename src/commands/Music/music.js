import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import {
  enqueue,
  getQueue,
  pause,
  resume,
  skip,
  stop,
} from '../../services/musicService.js';

function inVoice(interaction) {
  return interaction.member?.voice?.channel ?? null;
}

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'LIVE';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Reproduce música en un canal de voz.')
    .setDMPermission(false)
    .addSubcommand((s) => s
      .setName('play')
      .setDescription('Busca y reproduce una canción o URL de YouTube.')
      .addStringOption((o) => o
        .setName('query')
        .setDescription('Nombre de la canción o URL de YouTube')
        .setRequired(true)))
    .addSubcommand((s) => s.setName('pause').setDescription('Pausa la canción actual.'))
    .addSubcommand((s) => s.setName('resume').setDescription('Reanuda la canción.'))
    .addSubcommand((s) => s.setName('skip').setDescription('Salta a la siguiente canción.'))
    .addSubcommand((s) => s.setName('stop').setDescription('Detiene la música y vacía la cola.'))
    .addSubcommand((s) => s.setName('queue').setDescription('Muestra la cola actual.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const channel = inVoice(interaction);

    if (sub === 'queue') {
      const { current, queue } = getQueue(guild.id);
      const lines = [];
      if (current) lines.push(`▶️ **${current.title}** — ${fmtDuration(current.duration)}`);
      queue.slice(0, 20).forEach((track, index) => lines.push(`${index + 1}. **${track.title}** — ${fmtDuration(track.duration)}`));
      return interaction.reply({
        content: lines.length ? lines.join('\n') : '📭 La cola está vacía.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'pause') {
      return interaction.reply({ content: pause(guild.id) ? '⏸️ Música pausada.' : '❌ No hay música reproduciéndose.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'resume') {
      return interaction.reply({ content: resume(guild.id) ? '▶️ Música reanudada.' : '❌ No hay una canción pausada.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'skip') {
      return interaction.reply({ content: skip(guild.id) ? '⏭️ Canción saltada.' : '❌ No hay una canción reproduciéndose.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'stop') {
      return interaction.reply({ content: stop(guild.id) ? '⏹️ Música detenida y cola vaciada.' : '❌ No hay una sesión de música activa.', flags: MessageFlags.Ephemeral });
    }

    if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
      return interaction.reply({ content: '🔊 Entra primero a un canal de voz para usar `/music play`.', flags: MessageFlags.Ephemeral });
    }

    const me = guild.members.me;
    const permissions = channel.permissionsFor(me);
    if (!permissions?.has('ViewChannel') || !permissions?.has('Connect') || !permissions?.has('Speak')) {
      return interaction.reply({ content: '❌ Necesito **Ver canal**, **Conectar** y **Hablar** en ese canal de voz.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const query = interaction.options.getString('query', true);

    try {
      const result = await enqueue({ guild, channel, query, requestedBy: interaction.user.id });
      const connection = getVoiceConnection(guild.id);
      const text = result.session.current === result.track
        ? `🎵 **${result.track.title}**\n▶️ Reproduciendo ahora.`
        : `🎶 **${result.track.title}**\n📋 Añadida a la cola en la posición **${result.position}**.`;
      await interaction.editReply({ content: text + (connection ? '' : '\n⚠️ La conexión de voz aún no está lista; reintentando.') });
    } catch (error) {
      await interaction.editReply({ content: `❌ No pude reproducir esa canción.\n\`${String(error?.message || error).slice(0, 1200)}\`` });
    }
  },
};
