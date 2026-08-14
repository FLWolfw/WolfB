import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTraceContext } from './traceContext.js';

const { createLogger, format, transports } = winston;
const { combine, timestamp, errors, printf, colorize } = format;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Nivel ────────────────────────────────────────────────────────────────────

const validLogLevels = new Set(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);
const logLevelAliases = { warning: 'warn', warnings: 'warn', warns: 'warn', err: 'error', information: 'info' };
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const rawLevel = process.env.LOG_LEVEL?.toLowerCase().trim();
const resolvedLogLevel = validLogLevels.has(logLevelAliases[rawLevel] || rawLevel)
  ? (logLevelAliases[rawLevel] || rawLevel)
  : defaultLogLevel;

const pendingInvalidLevelWarning = rawLevel && !validLogLevels.has(logLevelAliases[rawLevel] || rawLevel)
  ? `[logger] Invalid LOG_LEVEL "${process.env.LOG_LEVEL}". Falling back to "${defaultLogLevel}".`
  : null;

const shouldPromoteUserFacingLogs = process.env.NODE_ENV === 'production' && resolvedLogLevel === 'warn';

// ─── Iconos y colores por nivel ───────────────────────────────────────────────

const LEVEL_STYLES = {
  error:   { icon: '✖', color: '\x1b[31m',    label: 'ERROR  ' },
  warn:    { icon: '⚠', color: '\x1b[33m',    label: 'WARN   ' },
  info:    { icon: '●', color: '\x1b[36m',    label: 'INFO   ' },
  http:    { icon: '→', color: '\x1b[35m',    label: 'HTTP   ' },
  verbose: { icon: '…', color: '\x1b[37m',    label: 'VERBOSE' },
  debug:   { icon: '◌', color: '\x1b[90m',    label: 'DEBUG  ' },
  silly:   { icon: '~', color: '\x1b[90m',    label: 'SILLY  ' },
  startup: { icon: '◆', color: '\x1b[32m',    label: 'START  ' },
  status:  { icon: '◈', color: '\x1b[32m',    label: 'STATUS ' },
};

const RESET  = '\x1b[0m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';

// ─── Formato consola (dev) ────────────────────────────────────────────────────

const devConsoleFormat = printf((info) => {
  const displayLevel = info.displayLevel || info.level;
  const style = LEVEL_STYLES[displayLevel] || LEVEL_STYLES[info.level] || LEVEL_STYLES.info;

  const time = `${DIM}${info.timestamp}${RESET}`;
  const levelStr = `${style.color}${BOLD}${style.icon} ${style.label}${RESET}`;
  const msg = info.stack
    ? `${info.message}\n${DIM}${info.stack}${RESET}`
    : info.message;

  // Contexto de trace (guild, user, comando) si existe
  const trace = info.traceId ? `${DIM} [${info.traceId.slice(0, 12)}]${RESET}` : '';
  const ctx = [
    info.guildId  ? `guild:${info.guildId}`   : null,
    info.userId   ? `user:${info.userId}`      : null,
    info.command  ? `cmd:/${info.command}`     : null,
  ].filter(Boolean).join(' ');
  const ctxStr = ctx ? ` ${DIM}(${ctx})${RESET}` : '';

  return `${time} ${levelStr} ${msg}${trace}${ctxStr}`;
});

// ─── Formato consola (prod) ───────────────────────────────────────────────────
// Más limpio, sin colores extra, pero igualmente legible

const prodConsoleFormat = printf((info) => {
  const displayLevel = info.displayLevel || info.level;
  const style = LEVEL_STYLES[displayLevel] || LEVEL_STYLES[info.level] || LEVEL_STYLES.info;
  const msg = info.stack ? `${info.message}\n${info.stack}` : info.message;
  const ctx = [
    info.guildId ? `guild:${info.guildId}` : null,
    info.command ? `cmd:/${info.command}`  : null,
  ].filter(Boolean).join(' ');
  return `[${info.timestamp}] ${style.icon} ${style.label} ${msg}${ctx ? ` (${ctx})` : ''}`;
});

// ─── Formato archivo (JSON estructurado) ─────────────────────────────────────

const LOG_SCHEMA_DEFAULTS = Object.freeze({
  event: 'application.log',
  guildId: null,
  userId: null,
  command: null,
  errorCode: null,
  traceId: null,
});

function deriveErrorCode(info) {
  if (info.errorCode) return info.errorCode;
  if (typeof info.code === 'string' || typeof info.code === 'number') return String(info.code);
  if (typeof info.type === 'string') return info.type;
  if (info.error?.code) return String(info.error.code);
  return null;
}

function normalizeEvent(info) {
  if (typeof info.event === 'string' && info.event.trim()) return info.event;
  const dl = info.displayLevel?.toLowerCase().trim();
  if (dl === 'startup') return 'system.startup';
  if (dl === 'status')  return 'system.status';
  return `log.${info.level || 'info'}`;
}

const attachTraceContext = format((info) => {
  const tc = getTraceContext();
  if (!tc) return info;
  info.traceId      = info.traceId      || tc.traceId;
  info.guildId      = info.guildId      || tc.guildId;
  info.userId       = info.userId       || tc.userId;
  info.command      = info.command      || tc.command;
  info.interactionId = info.interactionId || tc.interactionId;
  return info;
});

const enforceLogSchema = format((info) => {
  info.event    = normalizeEvent(info);
  info.guildId  = info.guildId  ?? LOG_SCHEMA_DEFAULTS.guildId;
  info.userId   = info.userId   ?? LOG_SCHEMA_DEFAULTS.userId;
  info.command  = info.command  ?? LOG_SCHEMA_DEFAULTS.command;
  info.traceId  = info.traceId  ?? LOG_SCHEMA_DEFAULTS.traceId;
  info.errorCode = deriveErrorCode(info);
  return info;
});

// ─── Creación del logger ──────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: resolvedLogLevel,
  format: combine(
    attachTraceContext(),
    enforceLogSchema(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'titanbot' },
  transports: [
    // Errores en archivo separado (14 días)
    new transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
    // Todos los niveles combinados (7 días)
    new transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [
    new transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/exceptions-%DATE%.log'),
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
  rejectionHandlers: [
    new transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/rejections-%DATE%.log'),
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
});

// Consola: dev con colores, prod limpio
logger.add(new transports.Console({
  level: resolvedLogLevel,
  format: combine(
    attachTraceContext(),
    enforceLogSchema(),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    isProd ? prodConsoleFormat : devConsoleFormat
  ),
}));

// ─── Stream para morgan / HTTP logs ──────────────────────────────────────────

logger.stream = {
  write: (message) => logger.http(message.trim()),
};

// Advertencia de nivel inválido (se loga después de crear el logger)
if (pendingInvalidLevelWarning) {
  logger.warn(pendingInvalidLevelWarning);
}

// ─── Helpers de startup / shutdown ───────────────────────────────────────────

const STARTUP_LINE = '─'.repeat(52);

/**
 * Imprime una línea de startup con formato visual especial.
 * En producción con LOG_LEVEL=warn se sube a warn para que sea visible.
 */
function startupLog(message) {
  const level = shouldPromoteUserFacingLogs ? 'warn' : 'info';
  logger.log({ level, message, displayLevel: 'startup' });
}

/**
 * Imprime el banner de inicio del bot con un separador visual claro.
 */
function printStartupBanner(botTag, commandCount, dbType) {
  const lines = [
    STARTUP_LINE,
    `  TitanBot v${process.env.npm_package_version || '2.0.0'}`,
    `  Bot:      ${botTag}`,
    `  Commands: ${commandCount}`,
    `  Database: ${dbType}`,
    `  Env:      ${process.env.NODE_ENV || 'development'}`,
    `  Level:    ${resolvedLogLevel}`,
    STARTUP_LINE,
  ];

  for (const line of lines) {
    startupLog(line);
  }
}

/**
 * Imprime una línea de status/shutdown.
 */
function shutdownLog(message) {
  const level = shouldPromoteUserFacingLogs ? 'warn' : 'info';
  logger.log({ level, message, displayLevel: 'status' });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { logger, startupLog, shutdownLog, printStartupBanner };
export default logger;