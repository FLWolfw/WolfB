import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  createAuthorizationUrl,
  disconnect,
  extractPlaylistId,
  getCurrentPlayback,
  getPlaylists,
  getProfile,
  isConnected,
  nextTrack,
  pausePlayback,
  previousTrack,
  resumePlayback,
  setRepeat,
  setShuffle,
  startPlaylist,
} from '../../services/spotifyService.js';

function trackText(item) {
  if (!item || item.type !== 'track') return 'Nada';
  const artists = (item.artists || []).map((a) => a.name).join(', ');
  return `**${item.name}** — ${artists}`;
}

function spotifyUrl(item) {
  return item?.external_urls?.spotify || null;
}

function playlistIdFromInput(value) {
  const id = extractPlaylistId(value);
  if (!id) throw new Error('No reconocí esa playlist de Spotify. Usa una URL de playlist, URI o ID.');
  return id;
}

export default {
  data: new SlashCommandBuilder()
    .setName('spotify')
    .setDescription('Conecta y controla tu Spotify.')
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('connect').setDescription('Conecta tu cuenta de Spotify con Wolf.'))
    .addSubcommand((s) => s.setName('status').setDescription('Muestra tu estado actual de Spotify.'))
    .addSubcommand((s) => s.setName('playlists').setDescription('Muestra tus playlists de Spotify.'))
    .addSubcommand((s) => s
      .setName('play')
      .setDescription('Reproduce una playlist en tu dispositivo activo de Spotify.')
      .addStringOption((o) => o.setName('playlist').setDescription('URL, URI o ID de la playlist').setRequired(true))
      .addBooleanOption((o) => o.setName('shuffle').setDescription('Activar shuffle').setRequired(false)))
    .addSubcommand((s) => s.setName('nowplaying').setDescription('Muestra lo que estás escuchando en Spotify.'))
    .addSubcommand((s) => s.setName('pause').setDescription('Pausa Spotify.'))
    .addSubcommand((s) => s.setName('resume').setDescription('Reanuda Spotify.'))
    .addSubcommand((s) => s.setName('next').setDescription('Siguiente canción.'))
    .addSubcommand((s) => s.setName('previous').setDescription('Canción anterior.'))
    .addSubcommand((s) => s
      .setName('shuffle')
      .setDescription('Activa o desactiva shuffle.')
      .addBooleanOption((o) => o.setName('enabled').setDescription('true = activar, false = desactivar').setRequired(true)))
    .addSubcommand((s) => s
      .setName('repeat')
      .setDescription('Configura repetición.')
      .addStringOption((o) => o
        .setName('mode')
        .setDescription('Modo de repetición')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Canción', value: 'track' },
          { name: 'Playlist/Contexto', value: 'context' },
        )))
    .addSubcommand((s) => s.setName('disconnect').setDescription('Desconecta tu cuenta de Spotify de Wolf.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      if (sub === 'connect') {
        if (await isConnected(userId)) {
          return interaction.reply({ content: '🟢 Tu Spotify ya está conectado. Usa `/spotify status`.', flags: MessageFlags.Ephemeral });
        }
        const url = await createAuthorizationUrl(userId);
        return interaction.reply({
          content: `🎵 **Conecta Spotify**\n\n[Autorizar Spotify](${url})\n\nDespués de autorizar, vuelve a Discord y usa \/spotify status.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'disconnect') {
        await disconnect(userId);
        return interaction.reply({ content: '🔌 Spotify desconectado de Wolf.', flags: MessageFlags.Ephemeral });
      }

      if (!(await isConnected(userId))) {
        return interaction.reply({ content: '🔐 Primero usa `/spotify connect`.', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'status') {
        const [profile, playback] = await Promise.all([getProfile(userId), getCurrentPlayback(userId).catch(() => null)]);
        const device = playback?.device?.name || 'Sin dispositivo activo';
        const current = playback?.item;
        return interaction.reply({
          content: [
            `🟢 **Spotify conectado** — ${profile.display_name || profile.id}`,
            `📱 Dispositivo: **${device}**`,
            current ? `${playback.is_playing ? '▶️' : '⏸️'} ${trackText(current)}` : '🎵 No hay una canción activa.',
          ].join('\n'),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'playlists') {
        const playlists = await getPlaylists(userId);
        if (!playlists.length) return interaction.reply({ content: '📭 No encontré playlists disponibles.', flags: MessageFlags.Ephemeral });
        const lines = playlists.slice(0, 50).map((p, i) => `${i + 1}. **${p.name}** — ${p.items?.total ?? 0} elementos\n${p.external_urls?.spotify || ''}`);
        return interaction.reply({ content: `🎵 **Tus playlists (${playlists.length})**\n\n${lines.join('\n')}`.slice(0, 3900), flags: MessageFlags.Ephemeral });
      }

      if (sub === 'play') {
        const playlist = interaction.options.getString('playlist', true);
        const shuffle = interaction.options.getBoolean('shuffle') ?? true;
        const id = playlistIdFromInput(playlist);
        const playback = await startPlaylist(userId, id, { shuffle });
        return interaction.reply({
          content: `▶️ Playlist iniciada en Spotify.\n🔀 Shuffle: **${shuffle ? 'ON' : 'OFF'}**${playback?.item ? `\n🎵 ${trackText(playback.item)}` : ''}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'nowplaying') {
        const playback = await getCurrentPlayback(userId);
        if (!playback?.item) return interaction.reply({ content: '🎵 No hay nada reproduciéndose en Spotify.', flags: MessageFlags.Ephemeral });
        const url = spotifyUrl(playback.item);
        return interaction.reply({
          content: `${playback.is_playing ? '▶️' : '⏸️'} ${trackText(playback.item)}\n📱 ${playback.device?.name || 'Dispositivo desconocido'}\n🔀 Shuffle: **${playback.shuffle_state ? 'ON' : 'OFF'}**\n🔁 Repeat: **${playback.repeat_state || 'off'}**${url ? `\n${url}` : ''}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'pause') {
        await pausePlayback(userId);
        return interaction.reply({ content: '⏸️ Spotify pausado.', flags: MessageFlags.Ephemeral });
      }
      if (sub === 'resume') {
        await resumePlayback(userId);
        return interaction.reply({ content: '▶️ Spotify reanudado.', flags: MessageFlags.Ephemeral });
      }
      if (sub === 'next') {
        await nextTrack(userId);
        return interaction.reply({ content: '⏭️ Siguiente canción.', flags: MessageFlags.Ephemeral });
      }
      if (sub === 'previous') {
        await previousTrack(userId);
        return interaction.reply({ content: '⏮️ Canción anterior.', flags: MessageFlags.Ephemeral });
      }
      if (sub === 'shuffle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setShuffle(userId, enabled);
        return interaction.reply({ content: `🔀 Shuffle **${enabled ? 'activado' : 'desactivado'}**.`, flags: MessageFlags.Ephemeral });
      }
      if (sub === 'repeat') {
        const mode = interaction.options.getString('mode', true);
        await setRepeat(userId, mode);
        return interaction.reply({ content: `🔁 Repeat configurado en **${mode}**.`, flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      const status = error?.status ? ` (HTTP ${error.status})` : '';
      const message = String(error?.message || error).slice(0, 1000);
      return interaction.reply({ content: `❌ Spotify${status}: ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
