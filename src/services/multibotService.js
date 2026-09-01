import crypto from 'node:crypto';

const TABLE = 'bot_instances';
const WARNINGS_TABLE = 'multibot_warnings';

function key() {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('SESSION_SECRET or ENCRYPTION_KEY is required for multibot token encryption.');
  return crypto.createHash('sha256').update(secret).digest();
}

function sqlDb(db) {
  const pg = db?.db || db;
  const pool = pg?.pool || pg;
  if (!pool || typeof pool.query !== 'function') throw new Error('PostgreSQL query interface is unavailable.');
  return pool;
}

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(value) {
  const [ivRaw, tagRaw, dataRaw] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), ivRaw ? Buffer.from(ivRaw, 'base64url') : Buffer.alloc(0));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export async function ensureMultibotSchema(db) {
  const sql = sqlDb(db);
  await sql.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (id BIGSERIAL PRIMARY KEY, owner_id TEXT NOT NULL, bot_user_id TEXT NOT NULL UNIQUE, bot_username TEXT, encrypted_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'offline', settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await sql.query(`CREATE TABLE IF NOT EXISTS ${WARNINGS_TABLE} (id BIGSERIAL PRIMARY KEY, bot_instance_id BIGINT NOT NULL REFERENCES ${TABLE}(id) ON DELETE CASCADE, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await sql.query(`CREATE INDEX IF NOT EXISTS multibot_warnings_lookup ON ${WARNINGS_TABLE}(bot_instance_id, guild_id, user_id, created_at DESC)`);
}

export async function listBots(db, ownerId) {
  const sql = sqlDb(db);
  const { rows } = await sql.query(`SELECT id, bot_user_id, bot_username, status, settings, created_at, updated_at FROM ${TABLE} WHERE owner_id=$1 ORDER BY id DESC`, [String(ownerId)]);
  return rows;
}

export async function getBot(db, ownerId, id) {
  const sql = sqlDb(db);
  const { rows } = await sql.query(`SELECT * FROM ${TABLE} WHERE id=$1 AND owner_id=$2 LIMIT 1`, [id, String(ownerId)]);
  return rows[0] || null;
}

export async function addBot(db, { ownerId, botUserId, botUsername, token }) {
  const sql = sqlDb(db);
  const encryptedToken = encryptToken(token);
  const { rows } = await sql.query(`INSERT INTO ${TABLE} (owner_id, bot_user_id, bot_username, encrypted_token) VALUES ($1,$2,$3,$4) RETURNING id, bot_user_id, bot_username, status, settings, created_at`, [String(ownerId), String(botUserId), botUsername || null, encryptedToken]);
  return rows[0];
}

export async function updateBot(db, ownerId, id, patch) {
  const sql = sqlDb(db);
  const bot = await getBot(db, ownerId, id);
  if (!bot) return null;
  const settings = { ...(bot.settings || {}), ...(patch.settings || {}) };
  const status = patch.status || bot.status;
  const { rows } = await sql.query(`UPDATE ${TABLE} SET status=$1, settings=$2, updated_at=NOW() WHERE id=$3 AND owner_id=$4 RETURNING id, bot_user_id, bot_username, status, settings, created_at, updated_at`, [status, JSON.stringify(settings), id, String(ownerId)]);
  return rows[0] || null;
}

export async function addWarning(db, { botInstanceId, guildId, userId, moderatorId, reason }) {
  const sql = sqlDb(db);
  const { rows } = await sql.query(`INSERT INTO ${WARNINGS_TABLE} (bot_instance_id, guild_id, user_id, moderator_id, reason) VALUES ($1,$2,$3,$4,$5) RETURNING id, guild_id, user_id, moderator_id, reason, created_at`, [botInstanceId, String(guildId), String(userId), String(moderatorId), String(reason || 'Sin razón')]);
  return rows[0];
}

export async function listWarnings(db, { botInstanceId, guildId, userId, limit = 10 }) {
  const sql = sqlDb(db);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const { rows } = await sql.query(`SELECT id, guild_id, user_id, moderator_id, reason, created_at FROM ${WARNINGS_TABLE} WHERE bot_instance_id=$1 AND guild_id=$2 AND user_id=$3 ORDER BY created_at DESC LIMIT $4`, [botInstanceId, String(guildId), String(userId), safeLimit]);
  return rows;
}

export async function removeBot(db, ownerId, id) {
  const sql = sqlDb(db);
  const result = await sql.query(`DELETE FROM ${TABLE} WHERE id=$1 AND owner_id=$2`, [id, String(ownerId)]);
  return result.rowCount > 0;
}

export function getStoredToken(bot) { return decryptToken(bot.encrypted_token); }
