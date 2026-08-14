import { getGuildConfig } from '../services/guildConfigService.js';

const ES = {
  closeTitle: 'Cerrar Ticket',
  closeReason: 'Motivo del cierre (opcional)',
  closePlaceholder: 'Añade un motivo opcional para cerrar este ticket...',
  cancel: 'Cancelar',
  submit: 'Enviar',
  feedbackTitle: '¿Cómo fue tu experiencia con el soporte?',
  feedbackDescription: (ticket) => `Nos gustaría saber cómo lo hicimos con ${ticket}.`,
  feedbackPrompt: 'Selecciona una valoración — solo te tomará un segundo.',
  feedbackThanks: 'Tus comentarios nos ayudan a mejorar.',
  noThanks: 'No, gracias',
  created: 'Creado',
  reclaimedBy: 'Reclamado por',
  notClaimed: 'No reclamado',
  open: 'Abierto',
  closed: 'Cerrado',
  priority: 'Prioridad',
  status: 'Estado',
  reason: 'Motivo',
  closedBy: 'Cerrado por',
  closedAt: 'Cerrado el',
  ticketClosed: 'Tu Ticket Ha Sido Cerrado',
  ticketClosedDescription: (ticket) => `Tu ticket ${ticket} ha sido cerrado.`,
  thankYou: '¡Gracias por utilizar nuestro sistema de soporte! Si tienes más preguntas, puedes crear un nuevo ticket.',
  closeTicket: 'Cerrar Ticket',
  claim: 'Reclamar',
  pin: 'Fijar',
  ticket: 'Ticket',
  thanksCreating: '¡gracias por crear un ticket!'
};

export async function ticketT(db, guildId, key, ...args) {
  try {
    const config = await getGuildConfig(db, guildId);
    const lang = String(config?.language ?? 'en').toLowerCase();
    if (!lang.startsWith('es')) return null;
    const value = ES[key];
    return typeof value === 'function' ? value(...args) : value ?? null;
  } catch (error) {
    console.error(`[ticket-i18n] Failed to read language for guild ${guildId}:`, error);
    return null;
  }
}

export function ticketEs(key, ...args) {
  const value = ES[key];
  return typeof value === 'function' ? value(...args) : value ?? key;
}
