import { BaseGuildTextChannel, CommandInteraction, Message, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalBuilder } from 'discord.js';

const original = new Map();

const ES = new Map([
  ['Create a Ticket', 'Crear un Ticket'],
  ['Why are you creating this ticket?', '¿Por qué estás creando este ticket?'],
  ['Describe your issue...', 'Describe tu problema...'],
  ['Close Ticket', 'Cerrar Ticket'],
  ['Close Ticket', 'Cerrar Ticket'],
  ['Reason for closing (optional)', 'Motivo del cierre (opcional)'],
  ['Add an optional reason for closing this ticket...', 'Añade un motivo opcional para cerrar este ticket...'],
  ['Claim', 'Reclamar'],
  ['Claimed', 'Reclamado'],
  ['Unclaim', 'Liberar'],
  ['Pin', 'Fijar'],
  ['Low', 'Baja'],
  ['Medium', 'Media'],
  ['High', 'Alta'],
  ['Urgent', 'Urgente'],
  ['None', 'Ninguna'],
  ['Ticket Created', 'Ticket Creado'],
  ['Ticket Closed', 'Ticket Cerrado'],
  ['Ticket Reopened', 'Ticket Reabierto'],
  ['Ticket Deleted', 'Ticket Eliminado'],
  ['Ticket Claimed', 'Ticket Reclamado'],
  ['Ticket Unclaimed', 'Ticket Liberado'],
  ['Priority Updated', 'Prioridad Actualizada'],
  ['Not a Ticket Channel', 'No es un canal de Ticket'],
  ['Permission Denied', 'Permiso Denegado'],
  ['Request Timeout', 'Tiempo de espera agotado'],
  ['Error', 'Error'],
  ['Rate Limited', 'Límite de solicitudes'],
  ['Ticket Limit Reached', 'Límite de Tickets Alcanzado'],
  ['Status', 'Estado'],
  ['Open', 'Abierto'],
  ['Closed', 'Cerrado'],
  ['Claimed By', 'Reclamado por'],
  ['Not claimed', 'No reclamado'],
  ['Created', 'Creado'],
  ['Reason', 'Motivo'],
  ['Priority', 'Prioridad'],
  ['Reopen Ticket', 'Reabrir Ticket'],
  ['Delete Ticket', 'Eliminar Ticket'],
  ['Ticket Pinned', 'Ticket Fijado'],
  ['Ticket Unpinned', 'Ticket No Fijado'],
  ['This ticket has been pinned to the top of the category.', 'Este ticket ha sido fijado en la parte superior de la categoría.'],
  ['This ticket has been unpinned and moved back to normal position.', 'Este ticket ha dejado de estar fijado y volvió a su posición normal.'],
  ['You have successfully claimed this ticket!', '¡Has reclamado este ticket correctamente!'],
  ['You have successfully unclaimed this ticket!', '¡Has liberado este ticket correctamente!'],
  ['You have successfully reopened this ticket!', '¡Has reabierto este ticket correctamente!'],
  ['This ticket has been closed.', 'Este ticket ha sido cerrado.'],
  ['This ticket will be permanently deleted in 3 seconds.', 'Este ticket será eliminado permanentemente en 3 segundos.'],
  ['A priority value is required.', 'Se requiere un valor de prioridad.'],
  ['Ticket priority set to', 'Prioridad del ticket establecida en'],
  ['Ticket priority updated to', 'Prioridad del ticket actualizada a'],
  ['This action can only be used in a valid ticket channel.', 'Esta acción solo puede utilizarse en un canal de ticket válido.'],
  ['This action can only be used in a server.', 'Esta acción solo puede utilizarse en un servidor.'],
  ['You must have **Manage Channels** or the configured **Ticket Staff Role**.', 'Debes tener **Gestionar canales** o el **rol de personal de Tickets** configurado.'],
  ['You must have **Manage Channels**, the configured **Ticket Staff Role**, or be the **ticket creator**.', 'Debes tener **Gestionar canales**, el **rol de personal de Tickets** configurado o ser el **creador del ticket**.'],
  ['You cannot close this ticket.', 'No puedes cerrar este ticket.'],
  ['You cannot claim tickets.', 'No puedes reclamar tickets.'],
  ['You cannot unclaim tickets.', 'No puedes liberar tickets.'],
  ['You cannot reopen tickets.', 'No puedes reabrir tickets.'],
  ['You cannot delete tickets.', 'No puedes eliminar tickets.'],
  ['You cannot pin tickets.', 'No puedes fijar tickets.'],
  ['You cannot change ticket priority.', 'No puedes cambiar la prioridad del ticket.'],
  ['The permission check took too long. Please try again.', 'La comprobación de permisos tardó demasiado. Inténtalo de nuevo.'],
  ['Failed to check permissions:', 'No se pudieron comprobar los permisos:'],
  ['This ticket is already claimed by', 'Este ticket ya ha sido reclamado por'],
  ['This ticket is not currently closed', 'Este ticket no está cerrado actualmente'],
  ['This ticket is not currently claimed', 'Este ticket no está reclamado actualmente'],
  ['You can only unclaim your own tickets or need Manage Channels permission.', 'Solo puedes liberar tus propios tickets o necesitas el permiso Gestionar canales.'],
  ['Your Ticket Has Been Closed', 'Tu Ticket Ha Sido Cerrado'],
  ['Your ticket', 'Tu ticket'],
  ['has been closed.', 'ha sido cerrado.'],
  ['Closed by:', 'Cerrado por:'],
  ['Closed at:', 'Cerrado el:'],
  ['Thank you for using our support system! If you have any further questions, feel free to create a new ticket.', '¡Gracias por utilizar nuestro sistema de soporte! Si tienes más preguntas, puedes crear un nuevo ticket.'],
  ['How was your support experience?', '¿Cómo fue tu experiencia con el soporte?'],
  ["We'd love to know how we did with", 'Nos gustaría saber cómo lo hicimos con'],
  ['Select a rating below — it only takes a second!', 'Selecciona una valoración; solo tardarás un segundo.'],
  ['Your feedback helps us improve.', 'Tus comentarios nos ayudan a mejorar.'],
  ['No thanks', 'No, gracias'],
  ['This ticket has been closed by', 'Este ticket ha sido cerrado por'],
  ['This ticket has been reopened by', 'Este ticket ha sido reabierto por'],
  ['has reopened this ticket!', '¡ha reabierto este ticket!'],
  ['has claimed this ticket!', '¡ha reclamado este ticket!'],
  ['has unclaimed this ticket!', '¡ha liberado este ticket!'],
  ['Thanks for creating a ticket!', '¡Gracias por crear un ticket!'],
  ['Your ticket has been created in', 'Tu ticket ha sido creado en'],
  ['You have reached the maximum number of open tickets', 'Has alcanzado el número máximo de tickets abiertos'],
  ['Please close your existing tickets before creating a new one.', 'Cierra tus tickets existentes antes de crear uno nuevo.'],
  ['Current Tickets:', 'Tickets actuales:'],
  ['Failed to create ticket. Please try again in a moment.', 'No se pudo crear el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to close ticket. Please try again in a moment.', 'No se pudo cerrar el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to reopen ticket. Please try again in a moment.', 'No se pudo reabrir el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to delete ticket. Please try again in a moment.', 'No se pudo eliminar el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to claim ticket. Please try again in a moment.', 'No se pudo reclamar el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to unclaim ticket. Please try again in a moment.', 'No se pudo liberar el ticket. Inténtalo de nuevo en un momento.'],
  ['Failed to update ticket priority. Please try again in a moment.', 'No se pudo actualizar la prioridad del ticket. Inténtalo de nuevo en un momento.'],
  ['Ticket operation failed:', 'La operación del ticket falló:'],
  ['Ticket Transcript', 'Transcripción del Ticket'],
  ['Transcript for ticket', 'Transcripción del ticket'],
  ['Ticket ID', 'ID del Ticket'],
  ['Channel', 'Canal'],
  ['Generated', 'Generado'],
  ['Deleted by:', 'Eliminado por:'],
  ['Timestamp (UTC)', 'Marca de tiempo (UTC)'],
  ['Author', 'Autor'],
  ['Message', 'Mensaje'],
  ['Transcript', 'Transcripción'],
]);

function translateText(value, language) {
  if (language !== 'es' || typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of ES) {
    result = result.split(from).join(to);
  }
  return result;
}

async function getLanguage(client, guildId) {
  if (!client || !guildId) return 'en';
  try {
    const { getGuildConfig } = await import('../services/guildConfig.js');
    const config = await getGuildConfig(client, guildId);
    return config?.language === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

function transformObject(value, language) {
  if (!value || language !== 'es') return value;
  if (typeof value === 'string') return translateText(value, language);
  if (Array.isArray(value)) {
    for (const item of value) transformObject(item, language);
    return value;
  }
  if (typeof value !== 'object') return value;

  const translatableKeys = new Set(['content', 'title', 'description', 'label', 'placeholder', 'name', 'value', 'text']);
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && translatableKeys.has(key)) {
      value[key] = translateText(child, language);
    } else if (child && typeof child === 'object') {
      transformObject(child, language);
    }
  }
  return value;
}

async function translatePayload(payload, client, guildId) {
  const language = await getLanguage(client, guildId);
  if (language !== 'es') return payload;

  if (typeof payload === 'string') return translateText(payload, language);
  if (!payload || typeof payload !== 'object') return payload;

  if (payload.data && typeof payload.data === 'object') transformObject(payload.data, language);
  transformObject(payload, language);
  return payload;
}

function patchMethod(klass, method, handler) {
  if (!klass?.prototype?.[method] || original.has(`${klass.name}.${method}`)) return;
  const key = `${klass.name}.${method}`;
  const fn = klass.prototype[method];
  original.set(key, fn);
  klass.prototype[method] = handler(fn);
}

patchMethod(CommandInteraction, 'reply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(CommandInteraction, 'editReply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(CommandInteraction, 'followUp', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(CommandInteraction, 'showModal', (fn) => async function (modal, ...args) {
  await translatePayload(modal, this.client, this.guildId);
  return fn.call(this, modal, ...args);
});
patchMethod(ModalSubmitInteraction, 'reply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(ModalSubmitInteraction, 'editReply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(ModalSubmitInteraction, 'followUp', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(ButtonInteraction, 'reply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(ButtonInteraction, 'editReply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(StringSelectMenuInteraction, 'reply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(StringSelectMenuInteraction, 'editReply', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(BaseGuildTextChannel, 'send', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});
patchMethod(Message, 'edit', (fn) => async function (payload, ...args) {
  return fn.call(this, await translatePayload(payload, this.client, this.guildId), ...args);
});

console.log('[i18n] Runtime server-language translation enabled');
