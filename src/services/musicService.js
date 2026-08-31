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

const YTDLP_BASE_ARGS = ['--js-runtimes', 'deno', '--remote-components', 'ejs:npm', '--no-warnings'];
const YOUTUBE_PLAYBACK_ARGS = ['--extractor-args', 'youtube:player_client=web_embedded,tv'];

function getSession(guildId) {
  let session = sessions.get(guildId);
  if (!session) {
    const player = createAudioPlayer({ behavior: NoSubscriberBehavior.Play });
    session = { player, queue: [], current: null, ytProcess: null, ffmpegProcess: null, starting: false, generation: 0, transitioning: false, transitionTimer: null };
    player.on(AudioPlayerStatus.Idle, () => {
      if (session.transitioning || session.starting) return;
      session.current = null;
      schedulePlayNext(guildId, 0);
    });
    player.on('error', (error) => {
      logger.error('music player error', { guildId, error: error?.message, stack: error?.stack });
      stopProcesses(session); session.current = null; session.generation += 1; session.transitioning = false; schedulePlayNext(guildId, 0);
    });
    sessions.set(guildId, session);
  }
  return session;
}

function stopProcesses(session) {
  for (const process of [session.ytProcess, session.ffmpegProcess]) {
    if (process && !process.killed) process.kill('SIGKILL');
  }
  session.ytProcess = null; session.ffmpegProcess = null;
}

function schedulePlayNext(guildId, delay = 0) {
  const session = sessions.get(guildId);
  if (!session) return;
  if (session.transitionTimer) clearTimeout(session.transitionTimer);
  session.transitionTimer = setTimeout(() => {
    session.transitionTimer = null;
    const latest = sessions.get(guildId);
    if (!latest || latest.transitioning || latest.starting || latest.current || latest.queue.length === 0) return;
    playNext(guildId).catch((error) => logger.error('music next-track error', { guildId, error: error?.message, stack: error?.stack }));
  }, Math.max(0, delay));
}

function isUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim().slice(-4000) || `yt-dlp exited with code ${code}`)));
  });
}

export async function resolveTrack(query) {
  const target = isUrl(query) ? query : `ytsearch1:${query}`;
  const json = await runYtDlp([...YTDLP_BASE_ARGS, '--dump-single-json', '--flat-playlist', '--skip-download', target]);
  const data = JSON.parse(json); const entry = data.entries?.[0] ?? data;
  if (!entry?.id && !entry?.url) throw new Error('No encontré una canción con esa búsqueda.');
  const id = entry.id;
  return { title: entry.title || 'Audio', url: entry.webpage_url || (id ? `https://www.youtube.com/watch?v=${id}` : entry.url), duration: entry.duration ?? null, thumbnail: entry.thumbnail ?? null, requestedBy: null };
}

async function ensureConnection(guild, channel) {
  let connection = getVoiceConnection(guild.id);
  if (!connection) connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  return connection;
}

async function playNext(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.starting || session.transitioning || session.current || session.queue.length === 0) return;
  const item = session.queue.shift(); const generation = ++session.generation;
  session.starting = true; session.current = item; stopProcesses(session);
  try {
    const guild = item.guild; const channel = guild.channels.cache.get(item.channelId);
    if (!channel) throw new Error('El canal de voz ya no existe.');
    const connection = await ensureConnection(guild, channel);
    if (session.current !== item || session.generation !== generation) return;
    connection.subscribe(session.player);
    const yt = spawn('yt-dlp', [...YTDLP_BASE_ARGS, ...YOUTUBE_PLAYBACK_ARGS, '--no-playlist', '-f', 'bestaudio/best', '-o', '-', item.url], { stdio: ['ignore', 'pipe', 'pipe'] });
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] });
    session.ytProcess = yt; session.ffmpegProcess = ffmpeg;
    let ytError = '', ffmpegError = '';
    yt.stderr.setEncoding('utf8'); yt.stderr.on('data', (chunk) => { ytError += chunk; });
    ffmpeg.stderr.setEncoding('utf8'); ffmpeg.stderr.on('data', (chunk) => { ffmpegError += chunk; });
    yt.stdout.on('error', () => {}); ffmpeg.stdin.on('error', () => {});
    yt.on('error', (error) => logger.error('yt-dlp process error', { guildId, error: error?.message }));
    ffmpeg.on('error', (error) => logger.error('ffmpeg process error', { guildId, error: error?.message }));
    yt.stdout.pipe(ffmpeg.stdin);
    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    session.player.play(resource);
    yt.once('close', (code) => {
      if (code !== 0 && session.current === item && session.generation === generation) {
        console.error(`\n========== [MUSIC] YT-DLP PLAYBACK FAILED ==========\nGuild: ${guildId}\nExit code: ${code}\n${ytError.trim().slice(-4000)}\n====================================================\n`);
        session.player.stop(true);
      }
    });
    ffmpeg.once('close', (code) => {
      if (code !== 0 && session.current === item && session.generation === generation) {
        console.error(`\n========== [MUSIC] FFMPEG PLAYBACK FAILED ==========\nGuild: ${guildId}\nExit code: ${code}\n${ffmpegError.trim().slice(-4000)}\n====================================================\n`);
        session.player.stop(true);
      }
    });
  } catch (error) {
    if (session.current === item && session.generation === generation) {
      logger.error('music start error', { guildId, error: error?.message || String(error), stack: error?.stack, name: error?.name });
      stopProcesses(session); session.current = null;
    }
  } finally {
    session.starting = false;
    if (!session.transitioning && !session.current && session.queue.length > 0) schedulePlayNext(guildId, 0);
  }
}

export async function enqueue({ guild, channel, query, requestedBy }) {
  const track = await resolveTrack(query); track.guild = guild; track.channelId = channel.id; track.requestedBy = requestedBy;
  const session = getSession(guild.id); const wasPlaying = Boolean(session.current) || session.starting || session.transitioning;
  session.queue.push(track); if (!wasPlaying && !session.starting) schedulePlayNext(guild.id, 0);
  return { track, position: session.queue.length + (wasPlaying ? 1 : 0), session };
}
export function getQueue(guildId) { const session = sessions.get(guildId); return session ? { current: session.current, queue: [...session.queue] } : { current: null, queue: [] }; }
export function pause(guildId) { return Boolean(sessions.get(guildId)?.player.pause()); }
export function resume(guildId) { return Boolean(sessions.get(guildId)?.player.unpause()); }
export function skip(guildId) { return false; }
export function stop(guildId) { const session = sessions.get(guildId); if (!session) return false; if (session.transitionTimer) clearTimeout(session.transitionTimer); session.transitioning = true; session.generation += 1; session.queue = []; session.current = null; stopProcesses(session); const stopped = session.player.stop(true); setTimeout(() => { const latest = sessions.get(guildId); if (latest) latest.transitioning = false; }, 350); return stopped; }
export function destroy(guildId) { const session = sessions.get(guildId); if (!session) return; stop(guildId); getVoiceConnection(guildId)?.destroy(); sessions.delete(guildId); }
