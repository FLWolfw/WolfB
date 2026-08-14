import { BaseGuildTextChannel, Message, CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction, User } from 'discord.js';

const replacements = [
  ['Tu ticket has been created in', 'Tu ticket ha sido creado en'],
  ['Reclamared By', 'Reclamado por'],
  ['Reclaimed By', 'Reclamado por'],
];

function translateString(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
}

function translateObject(value, seen = new WeakSet()) {
  if (typeof value === 'string') return translateString(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => translateObject(item, seen));

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = translateObject(child, seen);
  }
  return out;
}

function patch(klass, method) {
  const original = klass?.prototype?.[method];
  if (typeof original !== 'function') return;
  const marker = `__wolfSpanishFix_${method}`;
  if (klass.prototype[marker]) return;

  klass.prototype[method] = function patched(value, ...args) {
    return original.call(this, translateObject(value), ...args);
  };
  Object.defineProperty(klass.prototype, marker, { value: true, enumerable: false });
}

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
  patch(Klass, 'showModal');
}

patch(BaseGuildTextChannel, 'send');
patch(Message, 'edit');
patch(User, 'send');

console.log('[i18n] Final Spanish ticket wording fix enabled');
