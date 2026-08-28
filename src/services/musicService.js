import { spawn } from 'node:child_process';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { logger } from '../utils/logger.js';

const sessions = new Map();

function getSession(guildId) {
  let session = sessions.get(guildId);
  if (!session) {
    const player = createAudioPlayer({ behavior: NoSubscriberBehavior.Play });
    session = {
      player,
      queue: [],
      current: null,
      ytProcess: null,
      ffmpegProcess: null,
      starting: false,
    };
    player.on(AudioPlayerStatus.Idle, () => {
      if (session.current) session.current = null;
      playNext(guildId).catch((error) => logger.error('music next-track error', { guildId, error: error?.message }));
    });
    player.on('error', (error) => {
      logger.error('music player error', { guildId, error: error?.message, stack: error?.stack });
      stopProcesses(session);
      session.current = null;
      playNext(guildId).catch((err) => logger.error('music recovery error', { guildId, error: err?.message, stack: err?.stack }));
    });
    sessions.set(guildId, session);
  }
  return session;
}

function stopProcesses(session) {
  for (const process of [session.ytProcess, session.ffmpegProcess]) {
    if (process && !process.killed) process.kill('SIGKILL');
  }
  session.ytProcess = null;
  session.ffmpegProcess = null;
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim().slice(-2000) || `yt-dlp exited with code ${code}`));
    });
  });
}

export async function resolveTrack(query) {
  const target = isUrl(query) ? query : `ytsearch1:${query}`;
  const json = await runYtDlp([
    '--js-runtimes', 'deno',
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--skip-download',
    target,
  ]);
  const data = JSON.parse(json);
  const entry = data.entries?.[0] ?? data;
  if (!entry?.id && !entry?.url) throw new Error('No encontré una canción con esa búsqueda.');

  const id = entry.id;
  const url = entry.webpage_url || (id ? `https://www.youtube.com/watch?v=${id}` : entry.url);
  return {
    title: entry.title || 'Audio',
    url,
    duration: entry.duration ?? null,
    thumbnail: entry.thumbnail ?? null,
    requestedBy: null,
  };
}

async function ensureConnection(guild, channel) {
  let connection = getVoiceConnection(guild.id);
  if (!connection) {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
  } else {
    const currentChannelId = connection.joinConfig.channelId;
    if (currentChannelId !== channel.id || connection.state.status === VoiceConnectionStatus.Destroyed) {
      connection.destroy();
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
      });
    }
  }
  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  return connection;
}

async function playNext(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.starting || session.queue.length === 0) return;

  const item = session.queue.shift();
  session.starting = true;
  session.current = item;
  stopProcesses(session);

  try {
    const guild = item.guild;
    const channel = guild.channels.cache.get(item.channelId);
    if (!channel) throw new Error('El canal de voz ya no existe.');
    const connection = await ensureConnection(guild, channel);
    connection.subscribe(session.player);

    const yt = spawn('yt-dlp', [
      '--js-runtimes', 'deno',
      '--no-warnings',
      '--no-playlist',
      '-f', 'bestaudio/best',
      '-o', '-',
      item.url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    session.ytProcess = yt;
    session.ffmpegProcess = ffmpeg;

    let ytError = '';
    yt.stderr.setEncoding('utf8');
    yt.stderr.on('data', (chunk) => { ytError += chunk; });
    ffmpeg.stderr.setEncoding('utf8');
    ffmpeg.stderr.on('data', (chunk) => { ytError += chunk; });

    yt.on('error', (error) => {
      logger.error('yt-dlp process error', { guildId, error: error?.message, stack: error?.stack });
    });
    ffmpeg.on('error', (error) => {
      logger.error('ffmpeg process error', { guildId, error: error?.message, stack: error?.stack });
    });

    yt.stdout.pipe(ffmpeg.stdin);
    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });
    session.player.play(resource);

    yt.once('close', (code) => {
      if (code !== 0 && session.current === item) {
        logger.error('yt-dlp playback failed', { guildId, code, error: ytError.slice(-2000) });
        session.player.stop(true);
      }
    });
    ffmpeg.once('close', (code) => {
      if (code !== 0 && session.current === item) {
        logger.error('ffmpeg playback failed', { guildId, code, error: ytError.slice(-2000) });
        session.player.stop(true);
      }
    });
  } catch (error) {
    logger.error('music start error', {
      guildId,
      error: error?.message || String(error),
      stack: error?.stack,
      name: error?.name,
    });
    stopProcesses(session);
    session.current = null;
    await playNext(guildId);
  } finally {
    session.starting = false;
  }
}

export async function enqueue({ guild, channel, query, requestedBy }) {
  const track = await resolveTrack(query);
  track.guild = guild;
  track.channelId = channel.id;
  track.requestedBy = requestedBy;

  const session = getSession(guild.id);
  const wasPlaying = Boolean(session.current);
  session.queue.push(track);
  if (!wasPlaying && !session.starting) await playNext(guild.id);
  return { track, position: session.queue.length + (wasPlaying ? 1 : 0), session };
}

export function getQueue(guildId) {
  const session = sessions.get(guildId);
  if (!session) return { current: null, queue: [] };
  return { current: session.current, queue: [...session.queue] };
}

export function pause(guildId) {
  const session = sessions.get(guildId);
  return Boolean(session?.player.pause());
}

export function resume(guildId) {
  const session = sessions.get(guildId);
  return Boolean(session?.player.unpause());
}

export function skip(guildId) {
  const session = sessions.get(guildId);
  if (!session?.current) return false;
  stopProcesses(session);
  return session.player.stop(true);
}

export function stop(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.queue = [];
  session.current = null;
  stopProcesses(session);
  return session.player.stop(true);
}

export function destroy(guildId) {
  const session = sessions.get(guildId);
  if (!session) return;
  stop(guildId);
  getVoiceConnection(guildId)?.destroy();
  sessions.delete(guildId);
}
