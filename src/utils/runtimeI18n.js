import {
  BaseGuildTextChannel,
  CommandInteraction,
  Message,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  User,
  ModalBuilder,
  TextInputBuilder,
} from 'discord.js';

const original = new Map();
const ticketGuildByChannelId = new Map();

const ES = new Map([
  ['Create a Ticket', 'Crear un Ticket'], ['Why are you creating this ticket?', '¿Por qué estás creando este ticket?'], ['Describe your issue...', 'Describe tu problema...'],
  ['Close Ticket', 'Cerrar Ticket'], ['Reason for closing (optional)', 'Motivo del cierre (opcional)'], ['Add an optional reason for closing this ticket...', 'Añade un motivo opcional para cerrar este ticket...'],
  ['Claim', 'Reclamar'], ['Claimed', 'Reclamado'], ['Unclaim', 'Liberar'], ['Pin', 'Fijar'], ['Low', 'Baja'], ['Medium', 'Media'], ['High', 'Alta'], ['Urgent', 'Urgente'], ['None', 'Ninguna'],
  ['Ticket Created', 'Ticket Creado'], ['Ticket Closed', 'Ticket Cerrado'], ['Ticket Reopened', 'Ticket Reabierto'], ['Ticket Deleted', 'Ticket Eliminado'], ['Ticket Claimed', 'Ticket Reclamado'], ['Ticket Unclaimed', 'Ticket Liberado'],
  ['Priority Updated', 'Prioridad Actualizada'], ['Status', 'Estado'], ['Open', 'Abierto'], ['Closed', 'Cerrado'], ['Claimed By', 'Reclamado por'], ['Reclaimed By', 'Reclamado por'], ['Not claimed', 'No reclamado'], ['Created', 'Creado'], ['Reason', 'Motivo'], ['Priority', 'Prioridad'],
  ['Reopen Ticket', 'Reabrir Ticket'], ['Delete Ticket', 'Eliminar Ticket'], ['Ticket Pinned', 'Ticket Fijado'], ['Ticket Unpinned', 'Ticket No Fijado'],
  ['Your Ticket Has Been Closed', 'Tu Ticket Ha Sido Cerrado'], ['Your ticket', 'Tu ticket'], ['has been closed.', 'ha sido cerrado.'], ['Closed by:', 'Cerrado por:'], ['Closed at:', 'Cerrado el:'],
  ['This ticket has been closed by', 'Este ticket ha sido cerrado por'], ['This ticket has been reopened by', 'Este ticket ha sido reabierto por'], ['has reopened this ticket!', '¡ha reabierto este ticket!'], ['has claimed this ticket!', '¡ha reclamado este ticket!'], ['has unclaimed this ticket!', '¡ha liberado este ticket!'],
  ['Thanks for creating a ticket!', '¡Gracias por crear un ticket!'], ['thanks for creating a ticket!', '¡gracias por crear un ticket!'], ['Your ticket has been created in', 'Tu ticket ha sido creado en'],
  ['This ticket has been pinned to the top of the category.', 'Este ticket ha sido fijado en la parte superior de la categoría.'], ['This ticket has been unpinned and moved back to normal position.', 'Este ticket ha dejado de estar fijado y volvió a su posición normal.'],
  ['This ticket has been closed.', 'Este ticket ha sido cerrado.'], ['This ticket will be permanently deleted in 3 seconds.', 'Este ticket será eliminado permanentemente en 3 segundos.'], ['A priority value is required.', 'Se requiere un valor de prioridad.'],
  ['Ticket priority set to', 'Prioridad del ticket establecida en'], ['Ticket priority updated to', 'Prioridad del ticket actualizada a'], ['How was your support experience?', '¿Cómo fue tu experiencia con el soporte?'], ["We'd love to know how we did with", 'Nos gustaría saber qué tal lo hicimos con'],
  ['Select a rating below — it only takes a second!', 'Selecciona una valoración; solo tardarás un segundo.'], ['Select a rating below — it only takes a second!', 'Selecciona una valoración; solo te tomará un segundo.'], ['Your feedback helps us improve.', 'Tus comentarios nos ayudan a mejorar.'], ['No thanks', 'No, gracias'],
  ['Thank you for using our support system! If you have any further questions, feel free to create a new ticket.', '¡Gracias por utilizar nuestro sistema de soporte! Si tienes más preguntas, puedes crear un nuevo ticket.'],
  ['You have reached the maximum number of open tickets', 'Has alcanzado el número máximo de tickets abiertos'], ['Please close your existing tickets before creating a new one.', 'Cierra tus tickets existentes antes de crear uno nuevo.'], ['Current Tickets:', 'Tickets actuales:'],
  ['Failed to create ticket. Please try again in a moment.', 'No se pudo crear el ticket. Inténtalo de nuevo en un momento.'], ['Failed to close ticket. Please try again in a moment.', 'No se pudo cerrar el ticket. Inténtalo de nuevo en un momento.'], ['Failed to reopen ticket. Please try again in a moment.', 'No se pudo reabrir el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to delete ticket. Please try again in a moment.', 'No se pudo eliminar el ticket. Inténtalo de nuevo en un momento.'], ['Failed to claim ticket. Please try again in a moment.', 'No se pudo reclamar el ticket. Inténtalo de nuevo en un momento.'], ['Failed to unclaim ticket. Please try again in a moment.', 'No se pudo liberar el ticket. Inténtalo de nuevo en un momento.'], ['Failed to update ticket priority. Please try again in a moment.', 'No se pudo actualizar la prioridad del ticket. Inténtalo de nuevo en un momento.'],
  ['Ticket Transcript', 'Transcripción del Ticket'], ['Transcript for ticket', 'Transcripción del ticket'], ['Ticket ID', 'ID del Ticket'], ['Channel', 'Canal'], ['Generated', 'Generado'], ['Deleted by:', 'Eliminado por:'], ['Timestamp (UTC)', 'Marca de tiempo (UTC)'], ['Author', 'Autor'], ['Message', 'Mensaje'], ['Transcript', 'Transcripción'],
  ['Not a Ticket Channel', 'No es un canal de Ticket'], ['Permission Denied', 'Permiso Denegado'], ['Request Timeout', 'Tiempo de espera agotado'], ['Rate Limited', 'Límite de solicitudes'], ['Ticket Limit Reached', 'Límite de Tickets Alcanzado'],
  ['You cannot close this ticket.', 'No puedes cerrar este ticket.'], ['You cannot claim tickets.', 'No puedes reclamar tickets.'], ['You cannot unclaim tickets.', 'No puedes liberar tickets.'], ['You cannot reopen tickets.', 'No puedes reabrir tickets.'], ['You cannot delete tickets.', 'No puedes eliminar tickets.'], ['You cannot pin tickets.', 'No puedes fijar tickets.'], ['You cannot change ticket priority.', 'No puedes cambiar la prioridad del ticket.'],
  ['The permission check took too long. Please try again.', 'La comprobación de permisos tardó demasiado.'], ['Failed to check permissions:', 'No se pudieron comprobar los permisos:'], ['This ticket is already claimed by', 'Este ticket ya ha sido reclamado por'], ['This ticket is not currently closed', 'Este ticket no está cerrado actualmente'], ['This ticket is not currently claimed', 'Este ticket no está reclamado actualmente'],
  ['You can only unclaim your own tickets or need Manage Channels permission.', 'Solo puedes liberar tus propios tickets o necesitas el permiso Gestionar canales.'], ['Ticket operation failed:', 'La operación del ticket falló:'],
  ['Guild Only', 'Solo servidores'], ['This action can only be used in a server.', 'Esta acción solo se puede utilizar en un servidor.'],
  ['Support Tickets', 'Tickets de Soporte'], ['Open ticket', 'Abrir ticket'], ['Create Ticket', 'Crear Ticket'], ['Cancel', 'Cancelar'], ['Send', 'Enviar'],
]);

function normalizeLanguage(language) {
  const value = String(language ?? '').trim().toLowerCase();
  if (value === 'es' || value === 'es-es' || value === 'spanish' || value === 'español' || value.startsWith('es-')) return 'es';
  return 'en';
}

function translateText(value, language) {
  if (language !== 'es' || typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of ES) result = result.split(from).join(to);
  return result;
}

async function getLanguage(client, guildId) {
  if (!client || !guildId) return 'en';
  try {
    const { getGuildConfig } = await import('../services/guildConfig.js');
    const config = await getGuildConfig(client, guildId);
    return normalizeLanguage(config?.language);
  } catch (error) {
    console.warn(`[i18n] Could not read guild language for ${guildId}: ${error?.message || error}`);
    return 'en';
  }
}

function toPlain(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (typeof value.toJSON === 'function') { try { return toPlain(value.toJSON(), seen); } catch {} }
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map(v => toPlain(v, seen));
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = toPlain(child, seen);
  return out;
}

function translateObject(value, language) {
  if (language !== 'es') return value;
  if (typeof value === 'string') return translateText(value, language);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => translateObject(v, language));
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = typeof child === 'string' ? translateText(child, language) : translateObject(child, language);
  return out;
}

async function translatePayload(payload, client, guildId) {
  const language = await getLanguage(client, guildId);
  if (language !== 'es') return payload;
  if (typeof payload === 'string') return translateText(payload, language);
  if (!payload || typeof payload !== 'object') return payload;
  return translateObject(toPlain(payload), language);
}

function findTicketChannelId(payload) {
  try {
    const text = JSON.stringify(toPlain(payload));
    const footerMatch = text.match(/(?:Ticket ID|ID del Ticket)[^0-9]*(\d{15,})/i);
    if (footerMatch) return footerMatch[1];
    const feedbackMatch = text.match(/ticket_feedback(?:_decline)?[^0-9]*(\d{15,})/i);
    if (feedbackMatch) return feedbackMatch[1];
  } catch {}
  return null;
}

async function resolveTicketGuildId(client, ticketChannelId) {
  if (!client || !ticketChannelId) return null;
  const cached = ticketGuildByChannelId.get(ticketChannelId);
  if (cached) return cached;
  for (const guild of client.guilds?.cache?.values?.() || []) {
    if (guild.channels?.cache?.has(ticketChannelId)) {
      ticketGuildByChannelId.set(ticketChannelId, guild.id);
      return guild.id;
    }
  }
  return null;
}

function patchMethod(klass, method, handler) {
  if (!klass?.prototype?.[method] || original.has(`${klass.name}.${method}`)) return;
  const key = `${klass.name}.${method}`;
  const fn = klass.prototype[method];
  original.set(key, fn);
  klass.prototype[method] = handler(fn);
}

for (const K of [CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction]) {
  patchMethod(K, 'reply', fn => async function(payload, ...args) { return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args); });
  patchMethod(K, 'editReply', fn => async function(payload, ...args) { return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args); });
  patchMethod(K, 'followUp', fn => async function(payload, ...args) { return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args); });
  patchMethod(K, 'update', fn => async function(payload, ...args) { return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args); });
  // showModal is intentionally not rebuilt. Modal builders keep their Discord.js internals.
  patchMethod(K, 'showModal', fn => async function(modal, ...args) { return fn.call(this, modal, ...args); });
}

// Translate modal text at the builder level while preserving the original
// ModalBuilder/TextInputBuilder objects and Discord's required component types.
patchMethod(ModalBuilder, 'setTitle', fn => function(value, ...args) {
  return fn.call(this, translateText(value, 'es'), ...args);
});
patchMethod(TextInputBuilder, 'setLabel', fn => function(value, ...args) {
  return fn.call(this, translateText(value, 'es'), ...args);
});
patchMethod(TextInputBuilder, 'setPlaceholder', fn => function(value, ...args) {
  return fn.call(this, translateText(value, 'es'), ...args);
});

patchMethod(BaseGuildTextChannel, 'send', fn => async function(payload, ...args) {
  ticketGuildByChannelId.set(this.id, this.guildId);
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(Message, 'edit', fn => async function(payload, ...args) { return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args); });
patchMethod(User, 'send', fn => async function(payload, ...args) {
  const ticketChannelId = findTicketChannelId(payload);
  const ticketGuildId = await resolveTicketGuildId(this.client, ticketChannelId);
  return fn.call(this, await translatePayload(payload, this.client, ticketGuildId), ...args);
});

console.log('[i18n] Runtime server-language translation enabled');
