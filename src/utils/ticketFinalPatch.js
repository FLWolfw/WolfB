import { ChannelType, GuildChannelManager, BaseGuildTextChannel } from 'discord.js';

const managerProto = GuildChannelManager.prototype;
if (!managerProto.__wolfTicketCreatePatch) {
  managerProto.__wolfTicketCreatePatch = true;
  const originalCreate = managerProto.create;
  managerProto.create = async function patchedTicketCreate(options) {
    const channel = await originalCreate.call(this, options);
    try {
      const isTicket = channel?.type === ChannelType.GuildText && /^ticket-\d+$/.test(channel.name);
      if (isTicket && Array.isArray(options?.permissionOverwrites)) {
        const creator = options.permissionOverwrites.find((ow) => {
          const id = String(ow?.id ?? '');
          return id && id !== channel.guild.id && ow?.allow?.includes?.('ViewChannel');
        });
        if (creator?.id) {
          await channel.permissionOverwrites.edit(creator.id, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            ReadMessageHistory: true,
          });
        }
      }
    } catch (err) {
      console.warn('[ticketFinalPatch] creator permission repair failed:', err?.message || err);
    }
    return channel;
  };
}

function patchEmbed(embed) {
  if (!embed || typeof embed !== 'object') return embed;
  const out = { ...embed };
  if (out.title === 'Ticket Closed') out.title = 'Ticket Cerrado';
  if (out.title === '🎫 Your Ticket Has Been Closed') out.title = '🎫 Tu Ticket Ha Sido Cerrado';
  if (out.title === '⭐ How was your support experience?') out.title = '⭐ ¿Qué te pareció tu experiencia de soporte?';
  if (typeof out.description === 'string') {
    out.description = out.description
      .replaceAll('Your ticket **', 'Tu ticket **')
      .replaceAll('** has been closed.', '** ha sido cerrado.')
      .replaceAll('**Reason:**', '**Motivo:**')
      .replaceAll('**Closed by:**', '**Cerrado por:**')
      .replaceAll('**Closed at:**', '**Cerrado el:**')
      .replaceAll('Thank you for using our support system! If you have any further questions, feel free to create a new ticket.', '¡Gracias por utilizar nuestro sistema de soporte! Si tienes más preguntas, puedes crear un nuevo ticket.')
      .replaceAll("We'd love to know how we did with **", 'Nos gustaría saber qué tal lo hicimos con **')
      .replaceAll('Select a rating below — it only takes a second!', '¡Selecciona una valoración! Solo te tomará un segundo!')
      .replaceAll('This ticket has been closed by', 'Este ticket ha sido cerrado por')
      .replaceAll('A DM has been sent to the ticket creator.', 'Se ha enviado un DM al creador del ticket.');
  }
  if (Array.isArray(out.fields)) {
    out.fields = out.fields.map((field) => ({
      ...field,
      name: String(field.name || '').replace('Status', 'Estado').replace('Claimed By', 'Reclamado por').replace('Created', 'Creado'),
      value: String(field.value || '').replace('🟢 Open', '🟢 Abierto').replace('Not claimed', 'No reclamado').replace('🔴 Closed', '🔴 Cerrado'),
    }));
  }
  return out;
}

function patchComponents(components) {
  if (!Array.isArray(components)) return components;
  return components.map((row) => ({
    ...row,
    components: Array.isArray(row?.components) ? row.components.map((component) => {
      const c = { ...component };
      if (c.label === 'Close Ticket') c.label = 'Cerrar Ticket';
      if (c.label === 'Claim') c.label = 'Reclamar';
      if (c.label === 'Pin') c.label = 'Fijar';
      if (c.label === 'Reopen Ticket') c.label = 'Reabrir Ticket';
      if (c.label === 'Delete Ticket') c.label = 'Eliminar Ticket';
      if (c.label === 'No thanks') c.label = 'No, gracias';
      return c;
    }) : row?.components,
  }));
}

const channelProto = BaseGuildTextChannel.prototype;
if (!channelProto.__wolfTicketSendPatch) {
  channelProto.__wolfTicketSendPatch = true;
  const originalSend = channelProto.send;
  channelProto.send = function patchedTicketSend(payload) {
    if (this.type === ChannelType.GuildText && /^ticket-\d+$/.test(this.name) && payload && typeof payload === 'object') {
      const next = { ...payload };
      if (Array.isArray(next.embeds)) next.embeds = next.embeds.map(patchEmbed);
      if (Array.isArray(next.components)) next.components = patchComponents(next.components);
      return originalSend.call(this, next);
    }
    return originalSend.call(this, payload);
  };
}

console.log('[ticketFinalPatch] Ticket permissions + Spanish text patch enabled');
