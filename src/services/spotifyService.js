import crypto from 'node:crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const STATE_TTL_MS = 10 * 60 * 1000;

const pendingStates = new Map();

const scopes = [
  'user-read-private',
  'user-read-email',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

function config() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Spotify is not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI.');
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

function tokenKey(discordUserId) {
  return `spotify:user:${discordUserId}`;
}

function cleanupStates() {
  const now = Date.now();
  for (const [state, value] of pendingStates) {
    if (value.expiresAt <= now) pendingStates.delete(state);
  }
}

export function isConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI);
}

export function createAuthorizationUrl(discordUserId) {
  const { clientId, redirectUri } = config();
  cleanupStates();
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, { discordUserId, expiresAt: Date.now() + STATE_TTL_MS });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function consumeState(state) {
  cleanupStates();
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  return entry;
}

async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = config();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const response = await axios.post(TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    timeout: 15000,
  });
  return response.data;
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = config();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await axios.post(TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    timeout: 15000,
  });
  return response.data;
}

async function loadToken(db, discordUserId) {
  const token = await db.get(tokenKey(discordUserId), null);
  return token && token.refreshToken ? token : null;
}

async function saveToken(db, discordUserId, token, previous = null) {
  const expiresAt = Date.now() + Math.max(0, Number(token.expires_in || 3600) - 60) * 1000;
  const record = {
    accessToken: token.access_token || previous?.accessToken,
    refreshToken: token.refresh_token || previous?.refreshToken,
    expiresAt,
    scope: token.scope || previous?.scope || scopes,
    spotifyUser: previous?.spotifyUser || null,
    updatedAt: new Date().toISOString(),
  };
  await db.set(tokenKey(discordUserId), record);
  return record;
}

async function getValidToken(db, discordUserId) {
  let token = await loadToken(db, discordUserId);
  if (!token) return null;

  if (token.accessToken && token.expiresAt && Date.now() < token.expiresAt) return token;

  try {
    const refreshed = await refreshAccessToken(token.refreshToken);
    token = await saveToken(db, discordUserId, refreshed, token);
    return token;
  } catch (error) {
    logger.warn('Spotify token refresh failed', { userId: discordUserId, error: error?.response?.data || error?.message });
    await db.delete(tokenKey(discordUserId));
    return null;
  }
}

async function api(db, discordUserId, method, path, data = undefined, params = undefined) {
  let token = await getValidToken(db, discordUserId);
  if (!token) throw new Error('Spotify account is not connected. Use /spotify connect first.');

  try {
    return await axios({
      method,
      url: `${API_URL}${path}`,
      data,
      params,
      headers: { Authorization: `Bearer ${token.accessToken}` },
      timeout: 15000,
    });
  } catch (error) {
    if (error?.response?.status === 401 && token.refreshToken) {
      const refreshed = await refreshAccessToken(token.refreshToken);
      token = await saveToken(db, discordUserId, refreshed, token);
      return axios({
        method,
        url: `${API_URL}${path}`,
        data,
        params,
        headers: { Authorization: `Bearer ${token.accessToken}` },
        timeout: 15000,
      });
    }
    throw error;
  }
}

export async function finishAuthorization(db, code, state) {
  const pending = consumeState(state);
  if (!pending) throw new Error('Invalid or expired Spotify authorization state. Please run /spotify connect again.');

  const token = await exchangeCode(code);
  const saved = await saveToken(db, pending.discordUserId, token);
  const profile = await getCurrentUser(db, pending.discordUserId);
  saved.spotifyUser = {
    id: profile.id,
    accountId: profile.account_id || null,
    displayName: profile.display_name || null,
    email: profile.email || null,
  };
  await db.set(tokenKey(pending.discordUserId), saved);
  return { discordUserId: pending.discordUserId, profile };
}

export async function disconnect(db, discordUserId) {
  await db.delete(tokenKey(discordUserId));
}

export async function getCurrentUser(db, discordUserId) {
  const response = await api(db, discordUserId, 'GET', '/me');
  return response.data;
}

export async function getStatus(db, discordUserId) {
  const token = await loadToken(db, discordUserId);
  if (!token) return { connected: false };
  const profile = await getCurrentUser(db, discordUserId);
  return { connected: true, profile };
}

export async function getPlaylists(db, discordUserId, limit = 20) {
  const response = await api(db, discordUserId, 'GET', '/me/playlists', undefined, { limit, offset: 0 });
  return response.data;
}

export async function getPlaylist(db, discordUserId, playlistId) {
  const response = await api(db, discordUserId, 'GET', `/playlists/${encodeURIComponent(playlistId)}`, undefined, { fields: 'id,name,description,owner(display_name),images,items(limit(100),items(track(id,name,artists(name),duration_ms,type)))' });
  return response.data;
}

export async function getCurrentlyPlaying(db, discordUserId) {
  const response = await api(db, discordUserId, 'GET', '/me/player');
  return response.data;
}

export async function getDevices(db, discordUserId) {
  const response = await api(db, discordUserId, 'GET', '/me/player/devices');
  return response.data;
}

export async function resume(db, discordUserId, deviceId = null) {
  await api(db, discordUserId, 'PUT', '/me/player/play', {}, deviceId ? { device_id: deviceId } : undefined);
}

export async function pause(db, discordUserId, deviceId = null) {
  await api(db, discordUserId, 'PUT', '/me/player/pause', undefined, deviceId ? { device_id: deviceId } : undefined);
}

export async function next(db, discordUserId, deviceId = null) {
  await api(db, discordUserId, 'POST', '/me/player/next', undefined, deviceId ? { device_id: deviceId } : undefined);
}

export async function previous(db, discordUserId, deviceId = null) {
  await api(db, discordUserId, 'POST', '/me/player/previous', undefined, deviceId ? { device_id: deviceId } : undefined);
}

export async function setShuffle(db, discordUserId, state, deviceId = null) {
  await api(db, discordUserId, 'PUT', '/me/player/shuffle', undefined, { state: Boolean(state), ...(deviceId ? { device_id: deviceId } : {}) });
}

export async function setRepeat(db, discordUserId, state, deviceId = null) {
  await api(db, discordUserId, 'PUT', '/me/player/repeat', undefined, { state, ...(deviceId ? { device_id: deviceId } : {}) });
}

export async function playContext(db, discordUserId, contextUri, deviceId = null) {
  await api(db, discordUserId, 'PUT', '/me/player/play', { context_uri: contextUri }, deviceId ? { device_id: deviceId } : undefined);
}
