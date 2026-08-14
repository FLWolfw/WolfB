import { BaseGuildTextChannel, Message, User } from 'discord.js';

const ES = new Map([
  ['Your Ticket Has Been Closed', 'Tu Ticket Ha Sido Cerrado'],
  ['Your ticket', 'Tu ticket'],
  ['has been closed.', 'ha sido cerrado.'],
  ['Closed by:', 'Cerrado por:'],
  ['Closed at:', 'Cerrado el:'],
  ['Your ticket has been created in', 'Tu ticket ha sido creado en'],
  ['Reclaimed By', 'Reclamado por'],
  ['Claimed By', 'Reclamado por'],
  ['Not claimed', 'No reclamado'],
]);

function translate(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const [from, to] of ES) out = out.split(from).join(to);
  return out;
}

function patchEmbed(embed) {
  if (!embed || typeof embed !== 'object') return embed;
  const out = { ...embed };
  if (typeof out.title === 'string') out.title = translate(out.title);
  if (typeof out.description === 'string') out.description = translate(out.description);
  if (out.footer && typeof out.footer === 'object') out.footer = { ...out.footer, text: translate(out.footer.text) };
  if (Array.isArray(out.fields)) out.fields = out.fields.map(field => ({ ...field, name: translate(field?.name), value: translate(field?.value) }));
  return out;
}

function patchPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (Array.isArray(out.embeds)) out.embeds = out.embeds.map(patchEmbed);
  if (typeof out.content === 'string') out.content = translate(out.content);
  return out;
}

function patch(klass, method) {
  const original = klass?.prototype?.[method];
  if (!original || original.__wolfSpanishFix2) return;
  const wrapped = async function(payload, ...args) { return original.call(this, patchPayload(payload), ...args); };
  Object.defineProperty(wrapped, '__wolfSpanishFix2', { value: true });
  klass.prototype[method] = wrapped;
}

patch(BaseGuildTextChannel, 'send');
patch(Message, 'edit');
patch(User, 'send');
console.log('[i18n] Final Spanish ticket wording fix v2 enabled');
