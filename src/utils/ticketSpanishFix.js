import { BaseGuildTextChannel, Message, CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction, User, ModalBuilder, TextInputBuilder } from 'discord.js';

// IMPORTANT: Do not recursively clone Discord.js builders.
// Discord.js builders contain internal state and must keep their own prototypes.
// The old recursive translator converted EmbedBuilder/ActionRowBuilder/etc.
// into plain objects, which could leave interactions stuck or produce invalid
// Discord payloads. Translate only the serializable message fields we actually
// need and leave components untouched.

const replacements = [
  ['Tu ticket has been created in', 'Tu ticket ha sido creado en'],
  ['Reclamared By', 'Reclamado por'],
  ['Reclaimed By', 'Reclamado por'],
  ['Claimed By', 'Reclamado por'],
  ['Not claimed', 'No reclamado'],
  ['Your Ticket Has Been Closed', 'Tu Ticket Ha Sido Cerrado'],
  ['Your ticket', 'Tu ticket'],
  ['has been closed.', 'ha sido cerrado.'],
  ['Closed by:', 'Cerrado por:'],
  ['Closed at:', 'Cerrado el:'],
  ['A DM has been sent to the ticket creator.', 'Se ha enviado un mensaje privado al creador del ticket.'],
];

function translateString(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
}

function translateEmbed(embed) {
  if (!embed) return embed;

  // Convert only the embed itself to JSON. Never recursively clone the builder.
  const data = typeof embed.toJSON === 'function' ? embed.toJSON() : { ...embed };

  if (typeof data.title === 'string') data.title = translateString(data.title);
  if (typeof data.description === 'string') data.description = translateString(data.description);
  if (data.footer && typeof data.footer.text === 'string') {
    data.footer = { ...data.footer, text: translateString(data.footer.text) };
  }
  if (Array.isArray(data.fields)) {
    data.fields = data.fields.map(field => ({
      ...field,
      name: translateString(field?.name),
      value: translateString(field?.value),
    }));
  }

  return data;
}

function translatePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  // Keep MessagePayload/options and all component builders intact.
  const out = { ...payload };

  if (typeof out.content === 'string') {
    out.content = translateString(out.content);
  }

  if (Array.isArray(out.embeds)) {
    out.embeds = out.embeds.map(translateEmbed);
  }

  // DO NOT touch components. Discord modal/action-row builders must retain
  // their component type metadata and prototypes.
  return out;
}

function patch(klass, method) {
  const original = klass?.prototype?.[method];
  if (typeof original !== 'function') return;

  const marker = `__wolfSpanishSafe_${method}`;
  if (klass.prototype[marker]) return;

  klass.prototype[method] = function patched(value, ...args) {
    return original.call(this, translatePayload(value), ...args);
  };

  Object.defineProperty(klass.prototype, marker, {
    value: true,
    enumerable: false,
  });
}

// Modal builders cannot be translated through reply/editReply payloads because
// showModal receives the builder directly. Translate only the visible strings
// while preserving the actual builder/component objects and their `type` data.
function patchBuilderString(klass, method, replacements, markerName) {
  const original = klass?.prototype?.[method];
  if (typeof original !== 'function') return;

  const marker = `__wolfSpanishModal_${markerName}`;
  if (klass.prototype[marker]) return;

  klass.prototype[method] = function patchedBuilderString(value, ...args) {
    const translated = typeof value === 'string'
      ? replacements.reduce((text, [from, to]) => text.split(from).join(to), value)
      : value;
    return original.call(this, translated, ...args);
  };

  Object.defineProperty(klass.prototype, marker, {
    value: true,
    enumerable: false,
  });
}

patchBuilderString(ModalBuilder, 'setTitle', [
  ['Create a Ticket', 'Crear un Ticket'],
  ['Close Ticket', 'Cerrar Ticket'],
], 'title');

patchBuilderString(TextInputBuilder, 'setLabel', [
  ['Why are you creating this ticket?', '¿Por qué estás creando este ticket?'],
  ['Reason for closing (optional)', 'Motivo del cierre (opcional)'],
], 'label');

patchBuilderString(TextInputBuilder, 'setPlaceholder', [
  ['Describe your issue...', 'Describe tu problema...'],
  ['Add an optional reason for closing this ticket...', 'Añade un motivo opcional para cerrar este ticket...'],
], 'placeholder');

for (const Klass of [
  CommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
]) {
  patch(Klass, 'reply');
  patch(Klass, 'editReply');
  patch(Klass, 'followUp');
  patch(Klass, 'update');
  // NEVER patch showModal. Modal builders must be passed through untouched.
}

patch(BaseGuildTextChannel, 'send');
patch(Message, 'edit');
patch(User, 'send');

console.log('[i18n] Safe Spanish ticket wording + modal fix enabled');
