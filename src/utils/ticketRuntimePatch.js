import {
  ButtonInteraction,
  BaseGuildTextChannel,
  User,
} from 'discord.js';
import { getGuildConfig } from '../services/guildConfigService.js';

const MAP = new Map([
  ['Create a Ticket', 'Crear un Ticket'],
  ['Why are you creating this ticket?', '¿Por qué estás creando este ticket?'],
  ['Describe your issue...', 'Describe tu problema...'],
  ['Close Ticket', 'Cerrar Ticket'],
  ['Reason for closing (optional)', 'Motivo del cierre (opcional)'],
  ['Add an optional reason for closing this ticket...', 'Añade un motivo opcional para cerrar este ticket...'],
  ['Cancel', 'Cancelar'],
  ['Submit', 'Enviar'],
  ['Your Ticket Has Been Closed', 'Tu Ticket Ha Sido Cerrado'],
  ['Your ticket', 'Tu ticket'],
  ['has been closed.', 'ha sido cerrado.'],
  ['Closed by:', 'Cerrado por:'],
  ['Closed at:', 'Cerrado el:'],
  ['Thank you for using our support system! If you have any further questions, feel free to create a new ticket.', '¡Gracias por utilizar nuestro sistema de soporte! Si tienes más preguntas, puedes crear un nuevo ticket.'],
  ['How was your support experience?', '¿Cómo fue tu experiencia con el soporte?'],
  ["We'd love to know how we did with", 'Nos gustaría saber cómo lo hicimos con'],
  ['Select a rating below — it only takes a second!', 'Selecciona una valoración — solo te tomará un segundo.'],
  ['Your feedback helps us improve.', 'Tus comentarios nos ayudan a mejorar.'],
  ['No thanks', 'No, gracias'],
  ['Ticket Created', 'Ticket Creado'],
  ['Ticket Claimed', 'Ticket Reclamado'],
  ['Ticket Unclaimed', 'Ticket Liberado'],
  ['Ticket Reopened', 'Ticket Reabierto'],
  ['Ticket Deleted', 'Ticket Eliminado'],
  ['Ticket Pinned', 'Ticket Fijado'],
  ['Ticket Unpinned', 'Ticket Desfijado'],
  ['Priority Updated', 'Prioridad Actualizada'],
  ['Priority', 'Prioridad'],
  ['Status', 'Estado'],
  ['Claimed By', 'Reclamado por'],
  ['Not claimed', 'No reclamado'],
  ['Created', 'Creado'],
  ['Open', 'Abierto'],
  ['Closed', 'Cerrado'],
]);

function isSpanish(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'es' || normalized.startsWith('es-') || normalized === 'spanish' || normalized === 'español';
}

async function isGuildSpanish(client, guildId) {
  if (!client || !guildId) return false;
  try {
    const config = await getGuildConfig(client, guildId);
    return isSpanish(config?.language);
  } catch (error) {
    console.error(`[ticket-i18n] failed to load language for guild ${guildId}:`, error);
    return false;
  }
}

function translateString(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of MAP) result = result.split(from).join(to);
  return result;
}

function translateObject(value) {
  if (typeof value === 'string') return translateString(value);
  if (Array.isArray(value)) return value.map(translateObject);
  if (!value || typeof value !== 'object') return value;
  const out = { ...value };
  for (const [key, child] of Object.entries(out)) out[key] = translateObject(child);
  return out;
}

function translateModal(modal) {
  if (!modal?.data) return;
  modal.data.title = translateString(modal.data.title);
  if (Array.isArray(modal.data.components)) {
    for (const row of modal.data.components) {
      for (const component of row.components ?? []) {
        component.label = translateString(component.label);
        component.placeholder = translateString(component.placeholder);
      }
    }
  }
}

function findGuildForTicket(user, payload) {
  const client = user?.client;
  if (!client?.guilds?.cache) return null;
  const serialized = JSON.stringify(payload ?? '');
  const match = serialized.match(/ticket-\d+/i);
  if (!match) return null;
  const ticketName = match[0].toLowerCase();
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name?.toLowerCase() === ticketName);
    if (channel) return guild;
  }
  return null;
}

const originalShowModal = ButtonInteraction.prototype.showModal;
ButtonInteraction.prototype.showModal = async function patchedShowModal(modal, ...args) {
  if (await isGuildSpanish(this.client, this.guildId)) translateModal(modal);
  return originalShowModal.call(this, modal, ...args);
};

const originalChannelSend = BaseGuildTextChannel.prototype.send;
BaseGuildTextChannel.prototype.send = async function patchedChannelSend(payload, ...args) {
  if (await isGuildSpanish(this.client, this.guildId)) payload = translateObject(payload);
  return originalChannelSend.call(this, payload, ...args);
};

const originalUserSend = User.prototype.send;
User.prototype.send = async function patchedUserSend(payload, ...args) {
  const guild = findGuildForTicket(this, payload);
  if (guild && await isGuildSpanish(this.client, guild.id)) payload = translateObject(payload);
  return originalUserSend.call(this, payload, ...args);
};

console.log('[i18n] Ticket-specific Discord builder/message translation enabled');
