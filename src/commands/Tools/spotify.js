import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  createAuthorizationUrl,
  isConfigured,
  getStatus,
  disconnect,
  getPlaylists,
  getCurrentlyPlaying,
  getDevices,
  resume,
  pause,
  next,
  previous,
  setShuffle,
  setRepeat,
  playContext,
} from '../../services/spotifyService.js';

function errorText(error) {
  const data = error?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (data?.error_description) return data.error_description;
  return error?.message || 'Unknown Spotify error.';
}

function trackText(item) {
  const track = item?.item || item;
  if (!track?.name) return 'Nothing is playing right now.';
  const artists = (track.artists || []).map((artist) => artist.name).join(', ');
  return `**${track.name}**${artists ? ` — ${artists}` : ''}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('spotify')
    .setDescription('Conecta y controla tu cuenta de Spotify.')
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('connect').setDescription('Conecta tu cuenta de Spotify con Wolf.'))
    .addSubcommand((s) => s.setName('status').setDescription('Muestra el estado de tu conexión con Spotify.'))
    .addSubcommand((s) => s.setName('disconnect').setDescription('Desconecta tu cuenta de Spotify de Wolf.'))
    .addSubcommand((s) => s.setName('playlists').setDescription('Muestra tus playlists de Spotify.'))
    .addSubcommand((s) => s.setName('nowplaying').setDescription('Muestra lo que estás escuchando en Spotify.'))
    .addSubcommand((s) => s.setName('devices').setDescription('Muestra tus dispositivos Spotify activos.'))
    .addSubcommand((s) => s.setName('play').setDescription('Reanuda tu reproducción de Spotify.'))
    .addSubcommand((s) => s.setName('pause').setDescription('Pausa tu reproducción de Spotify.'))
    .addSubcommand((s) => s.setName('next').setDescription('Pasa a la siguiente canción.'))
    .addSubcommand((s) => s.setName('previous').setDescription('Vuelve a la canción anterior.'))
    .addSubcommand((s) => s.setName('shuffle').setDescription('Activa o desactiva el shuffle.')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Activado o desactivado.').setRequired(true)))
    .addSubcommand((s) => s.setName('repeat').setDescription('Configura repetición.')
      .addStringOption((o) => o.setName('mode').setDescription('Modo de repetición.').setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Context / Playlist', value: 'context' },
        )))
    .addSubcommand((s) => s.setName('playlist').setDescription('Reproduce una playlist por su ID de Spotify.')
      .addStringOption((o) => o.setName('id').setDescription('ID o URI de la playlist.').setRequired(true))),

  // IMPORTANT: the global interaction handler calls every command as
  // execute(interaction, guildConfig, client). Keep that signature here.
  async execute(interaction, _guildConfig, client) {
    const sub = interaction.options.getSubcommand();
    const db = client?.db;
    const userId = interaction.user.id;

    try {
      if (!db || typeof db.get !== 'function') {
        throw new Error('Database is not available. Please restart Wolf and try again.');
      }

      if (sub === 'connect') {
        if (!isConfigured()) {
          return interaction.reply({ content: '❌ Spotify no está configurado en Railway. Faltan `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` o `SPOTIFY_REDIRECT_URI`.', flags: MessageFlags.Ephemeral });
        }
        const url = createAuthorizationUrl(userId);
        return interaction.reply({ content: `🎵 **Conecta Spotify**\n\n[Autorizar mi cuenta de Spotify](${url})\n\nEl enlace expira en 10 minutos.`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'disconnect') {
        await disconnect(db, userId);
        return interaction.reply({ content: '✅ Tu cuenta de Spotify fue desconectada de Wolf.', flags: MessageFlags.Ephemeral });
      }

      if (sub === 'status') {
        const result = await getStatus(db, userId);
        if (!result.connected) return interaction.reply({ content: '🔴 No tienes Spotify conectado. Usa `/spotify connect`.', flags: MessageFlags.Ephemeral });
        const name = result.profile.display_name || result.profile.id;
        return interaction.reply({ content: `🟢 **Spotify conectado**\nCuenta: **${name}**\nID: \`${result.profile.id}\``, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'playlists') {
        const data = await getPlaylists(db, userId, 20);
        const items = data.items || [];
        if (!items.length) return interaction.reply({ content: 'No encontré playlists disponibles.', flags: MessageFlags.Ephemeral });
        const lines = items.map((playlist, i) => `${i + 1}. **${playlist.name}** — \`${playlist.id}\``);
        return interaction.reply({ content: `📋 **Tus playlists de Spotify**\n\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'nowplaying') {
        const data = await getCurrentlyPlaying(db, userId);
        if (!data?.item) return interaction.reply({ content: '⏹️ No estás reproduciendo nada en Spotify.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: `🎵 **Now Playing**\n${trackText(data)}\n\n${data.is_playing ? '▶️ Reproduciendo' : '⏸️ Pausado'}\nDispositivo: **${data.device?.name || 'Desconocido'}**` });
      }

      if (sub === 'devices') {
        const data = await getDevices(db, userId);
        const devices = data.devices || [];
        if (!devices.length) return interaction.reply({ content: '📱 Spotify no reporta dispositivos disponibles ahora mismo.', flags: MessageFlags.Ephemeral });
        const lines = devices.map((device) => `${device.is_active ? '🟢' : '⚪'} **${device.name}** — ${device.type} — \`${device.id}\``);
        return interaction.reply({ content: `📱 **Dispositivos Spotify**\n\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'play') {
        await resume(db, userId);
        return interaction.reply('▶️ Spotify reanudado.');
      }
      if (sub === 'pause') {
        await pause(db, userId);
        return interaction.reply('⏸️ Spotify pausado.');
      }
      if (sub === 'next') {
        await next(db, userId);
        return interaction.reply('⏭️ Siguiente canción.');
      }
      if (sub === 'previous') {
        await previous(db, userId);
        return interaction.reply('⏮️ Canción anterior.');
      }
      if (sub === 'shuffle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setShuffle(db, userId, enabled);
        return interaction.reply(`${enabled ? '🔀' : '➡️'} Shuffle ${enabled ? 'activado' : 'desactivado'}.`);
      }
      if (sub === 'repeat') {
        const mode = interaction.options.getString('mode', true);
        await setRepeat(db, userId, mode);
        return interaction.reply(`🔁 Repeat: **${mode}**.`);
      }
      if (sub === 'playlist') {
        let id = interaction.options.getString('id', true).trim();
        const match = id.match(/playlist[/:]([A-Za-z0-9]+)(?:\?|$)/);
        if (match) id = match[1];
        await playContext(db, userId, `spotify:playlist:${id}`);
        return interaction.reply(`▶️ Reproduciendo la playlist de Spotify: \`${id}\``);
      }
    } catch (error) {
      return interaction.reply({ content: `❌ Spotify: ${errorText(error)}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
