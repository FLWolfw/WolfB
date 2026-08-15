import { ChannelType } from 'discord.js';

// Final ticket compatibility patch.
// Fixes two regressions without touching the ticket interaction/modal flow:
// 1) guarantees the ticket creator gets a channel-specific ViewChannel overwrite;
// 2) normalizes the remaining hard-coded English ticket messages to Spanish.

const originalCreate = (await import('discord.js')).GuildChannelManager?.prototype?.create;

if (originalCreate) {
  const managerProto = (await import('discord.js')).GuildChannelManager.prototype;
  if (!managerProto.__wolfTicketCreatePatch) {
    managerProto.__wolfTicketCreatePatch = true;
    managerProto.create = async function patchedTicketCreate(options) {
      const channel = await originalCreate.call(this, options);

      try {
        const isTicket = channel?.type === ChannelType.GuildText && /^ticket-\d+$/.test(channel.name);
        if (isTicket && Array.isArray(options?.permissionOverwrites)) {
          const creator = options.permissionOverwrites.find((ow) => {
            const id = typeof ow.id === 'string' ? ow.id : String(ow.id ?? '');
            return id && id !== channel.guild.id && ow.allow?.includes?.('ViewChannel');
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
        console.warn('[ticketFinalPatch] Could not reinforce creator permissions:', err?.message || err);
      }

      return channel;
    };
  }
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
      .replaceAll("**.\\nSelect a rating below — it only takes a second!", '**.\\n¡Selecciona una valoración! Solo te tomará un segundo!')
      .replaceAll('This ticket has been closed by', 'Este ticket ha sido cerrado por')
      .replaceAll('A DM has been sent to the ticket creator.', 'Se ha enviado un DM al creador del ticket.');
  }

  if (Array.isArray(out.fields)) {
    out.fields = out.fields.map((field) => ({
      ...field,
      name: String(field.name || '')
        .replace('Status', 'Estado')
        .replace('Claimed By', 'Reclamado por')
        .replace('Created', 'Creado'),
      value: String(field.value || '')
        .replace('🟢 Open', '🟢 Abierto')
        .replace('Not claimed', 'No reclamado')
        .replace('🔴 Closed', '🔴 Cerrado'),
    }));
  }

  return out;
}

function patchComponents(components) {
  if (!Array.isArray(components)) return components;
  return components.map((row) => ({
    ...row,
    components: Array.isArray(row?.components)
      ? row.components.map((component) => {
          const c = { ...component };
          if (c.label === 'Close Ticket') c.label = 'Cerrar Ticket';
          if (c.label === 'Claim') c.label = 'Reclamar';
          if (c.label === 'Pin') c.label = 'Fijar';
          if (c.label === 'Reopen Ticket') c.label = 'Reabrir Ticket';
          if (c.label === 'Delete Ticket') c.label = 'Eliminar Ticket';
          if (c.label === 'No thanks') c.label = 'No, gracias';
          return c;
        })
      : row?.components,
  }));
}

// Patch the common channel.send path. This is intentionally narrow: only
// ticket channels or the known ticket survey/close messages are modified.
const channelProto = (await import('discord.js')).BaseGuildTextChannel?.prototype;
if (channelProto && !channelProto.__wolfTicketSendPatch) {
  channelProto.__wolfTicketSendPatch = true;
  const originalSend = channelProto.send;
  channelProto.send = function patchedTicketSend(payload) {
    if (this.type === ChannelType.GuildText && /^ticket-\d+$/.test(this.name) && payload && typeof payload === 'object') {
      const next = { ...payload };
      if (Array.isArray(next.embeds)) next.embeds = next.embeds.map(patchEmbed);
      if (Array.isArray(next.components)) next.components = patchComponents(next.components);
      if (typeof next.content === 'string') next.content = next.content;
      return originalSend.call(this, next);
    }
    return originalSend.call(this, payload);
  };
}

console.log('[ticketFinalPatch] Final ticket permission + Spanish compatibility patch enabled');
