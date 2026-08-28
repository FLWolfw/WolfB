import axios from 'axios';
import crypto from 'node:crypto';
import { db } from '../utils/database.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const STATE_TTL_SECONDS = 10 * 60;
const SCOPES = [
  'user-read-private',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function redirectUri() {
  return required('SPOTIFY_REDIRECT_URI');
}

function encryptionKey() {
  const raw = required('SPOTIFY_TOKEN_SECRET');
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  const [ivPart, tagPart, dataPart] = String(value).split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Invalid encrypted Spotify token.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

function tokenKey(discordUserId) {
  return `spotify:token:${discordUserId}`;
}

function stateKey(state) {
  return `spotify:oauth-state:${state}`;
}

function basicAuth() {
  return Buffer.from(`${required('SPOTIFY_CLIENT_ID')}:${required('SPOTIFY_CLIENT_SECRET')}`).toString('base64');
}

export function createAuthorizationUrl(discordUserId) {
  const state = crypto.randomBytes(32).toString('base64url');
  const value = { discordUserId, createdAt: Date.now() };
  return db.set(stateKey(state), value, STATE_TTL_SECONDS).then(() => {
    const params = new URLSearchParams({
      client_id: required('SPOTIFY_CLIENT_ID'),
      response_type: 'code',
      redirect_uri: redirectUri(),
      state,
      scope: SCOPES.join(' '),
      show_dialog: 'true',
    });
    return `${AUTH_URL}?${params.toString()}`;
  });
}

export async function handleOAuthCallback({ code, state }) {
  if (!code || !state) throw new Error('Missing Spotify authorization code or state.');

  const stateData = await db.get(stateKey(state), null);
  if (!stateData?.discordUserId) throw new Error('Invalid or expired Spotify authorization state.');
  await db.delete(stateKey(state));

  const tokenResponse = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    },
  );

  const token = tokenResponse.data;
  const profile = await spotifyRequestWithAccessToken(token.access_token, 'GET', '/me');
  const record = {
    accountId: profile.account_id || profile.id,
    spotifyUserId: profile.id,
    displayName: profile.display_name || profile.id,
    accessToken: encrypt(token.access_token),
    refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
    expiresAt: Date.now() + (Number(token.expires_in || 3600) * 1000),
    connectedAt: new Date().toISOString(),
  };

  await db.set(tokenKey(stateData.discordUserId), record);
  return { discordUserId: stateData.discordUserId, profile };
}

async function getStoredToken(discordUserId) {
  const record = await db.get(tokenKey(discordUserId), null);
  if (!record?.accessToken) return null;

  if (Number(record.expiresAt || 0) > Date.now() + 60_000) {
    return { record, accessToken: decrypt(record.accessToken) };
  }

  if (!record.refreshToken) return { record, accessToken: decrypt(record.accessToken) };

  const refreshResponse = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decrypt(record.refreshToken),
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    },
  );

  const token = refreshResponse.data;
  const updated = {
    ...record,
    accessToken: encrypt(token.access_token),
    refreshToken: token.refresh_token ? encrypt(token.refresh_token) : record.refreshToken,
    expiresAt: Date.now() + (Number(token.expires_in || 3600) * 1000),
  };
  await db.set(tokenKey(discordUserId), updated);
  return { record: updated, accessToken: token.access_token };
}

export async function isConnected(discordUserId) {
  return Boolean(await db.get(tokenKey(discordUserId), null));
}

export async function disconnect(discordUserId) {
  await db.delete(tokenKey(discordUserId));
}

async function spotifyRequestWithAccessToken(accessToken, method, path, data = undefined, params = undefined) {
  const response = await axios({
    method,
    url: `${API_URL}${path}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
    params,
    timeout: 15000,
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    const message = response.data?.error?.message || response.data?.error_description || `Spotify API returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.spotify = response.data;
    throw error;
  }
  return response.data;
}

export async function spotifyRequest(discordUserId, method, path, data, params) {
  const stored = await getStoredToken(discordUserId);
  if (!stored) {
    const error = new Error('Spotify is not connected. Use /spotify connect first.');
    error.code = 'SPOTIFY_NOT_CONNECTED';
    throw error;
  }

  try {
    return await spotifyRequestWithAccessToken(stored.accessToken, method, path, data, params);
  } catch (error) {
    if (error.status !== 401 || !stored.record.refreshToken) throw error;
    const refreshed = await getStoredToken(discordUserId);
    return spotifyRequestWithAccessToken(refreshed.accessToken, method, path, data, params);
  }
}

export async function getProfile(discordUserId) {
  return spotifyRequest(discordUserId, 'GET', '/me');
}

export async function getPlaylists(discordUserId) {
  const all = [];
  let offset = 0;
  while (true) {
    const page = await spotifyRequest(discordUserId, 'GET', '/me/playlists', undefined, { limit: 50, offset });
    all.push(...(page?.items || []));
    if (!page?.next || !page.items?.length) break;
    offset += page.items.length;
  }
  return all;
}

export async function getCurrentPlayback(discordUserId) {
  return spotifyRequest(discordUserId, 'GET', '/me/player');
}

export async function startPlaylist(discordUserId, playlistId, { shuffle = true } = {}) {
  const uri = `spotify:playlist:${playlistId}`;
  await spotifyRequest(discordUserId, 'PUT', '/me/player/play', { context_uri: uri });
  if (shuffle) await spotifyRequest(discordUserId, 'PUT', '/me/player/shuffle', undefined, { state: 'true' });
  return getCurrentPlayback(discordUserId);
}

export async function pausePlayback(discordUserId) {
  return spotifyRequest(discordUserId, 'PUT', '/me/player/pause');
}

export async function resumePlayback(discordUserId) {
  return spotifyRequest(discordUserId, 'PUT', '/me/player/play');
}

export async function nextTrack(discordUserId) {
  return spotifyRequest(discordUserId, 'POST', '/me/player/next');
}

export async function previousTrack(discordUserId) {
  return spotifyRequest(discordUserId, 'POST', '/me/player/previous');
}

export async function setShuffle(discordUserId, state) {
  return spotifyRequest(discordUserId, 'PUT', '/me/player/shuffle', undefined, { state: String(Boolean(state)) });
}

export async function setRepeat(discordUserId, state) {
  if (!['track', 'context', 'off'].includes(state)) throw new Error('Repeat must be track, context, or off.');
  return spotifyRequest(discordUserId, 'PUT', '/me/player/repeat', undefined, { state });
}

export function extractPlaylistId(input) {
  const value = String(input || '').trim();
  const uriMatch = value.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = value.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{10,}$/.test(value)) return value;
  return null;
}
