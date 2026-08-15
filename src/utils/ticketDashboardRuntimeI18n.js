import { CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';

const ES = new Map([
  ['Ticket System Dashboard', 'Panel del Sistema de Tickets'],
  ['Manage ticket system settings for', 'Administra la configuración del sistema de tickets para'],
  ['Select an option below to modify a setting.', 'Selecciona una opción a continuación para modificar un ajuste.'],
  ['Panel Channel', 'Canal del Panel'],
  ['Staff Role', 'Rol del Staff'],
  ['Open Tickets Category', 'Categoría de Tickets Abiertos'],
  ['Closed Tickets Category', 'Categoría de Tickets Cerrados'],
  ['Panel Message', 'Mensaje del Panel'],
  ['Button Label', 'Etiqueta del Botón'],
  ['Max Tickets/User', 'Máx. Tickets/Usuario'],
  ['DM on Close', 'DM al Cerrar'],
  ['Enabled', 'Activado'],
  ['Disabled', 'Desactivado'],
  ['Ticket Logs Channel', 'Canal de Logs de Tickets'],
  ['Transcript Channel', 'Canal de Transcripciones'],
  ['Not set', 'Sin configurar'],
  ['Select an option below • Dashboard closes after 10 minutes of inactivity', 'Selecciona una opción • El panel se cierra después de 10 minutos de inactividad'],
  ['Select a setting to configure...', 'Selecciona un ajuste para configurar...'],
  ['Edit Panel Message', 'Editar Mensaje del Panel'],
  ['Change the message displayed on the ticket creation panel', 'Cambia el mensaje mostrado en el panel de creación de tickets'],
  ['Edit Button Label', 'Editar Etiqueta del Botón'],
  ['Change the label on the Create Ticket button', 'Cambia la etiqueta del botón Crear Ticket'],
  ['Change Open Tickets Category', 'Cambiar Categoría de Tickets Abiertos'],
  ['Category where new tickets are created', 'Categoría donde se crean los nuevos tickets'],
  ['Change Closed Tickets Category', 'Cambiar Categoría de Tickets Cerrados'],
  ['Category where closed tickets are moved', 'Categoría a la que se mueven los tickets cerrados'],
  ['Set Max Tickets per User', 'Establecer Máximo de Tickets por Usuario'],
  ['Limit how many open tickets one user can have at once', 'Limita cuántos tickets abiertos puede tener un usuario a la vez'],
  ['Set Ticket Logs Channel', 'Establecer Canal de Logs de Tickets'],
  ['Channel to receive ticket feedback, lifecycle events, and logs', 'Canal donde se recibirán valoraciones, eventos y logs de tickets'],
  ['Set Transcript Channel', 'Establecer Canal de Transcripciones'],
  ['Channel to receive auto-generated transcripts on deletion', 'Canal donde se recibirán las transcripciones automáticas al eliminar tickets'],
  ['Delete System', 'Eliminar Sistema'],
  ['Change Staff Role', 'Cambiar Rol del Staff'],
  ['Dashboard Timed Out', 'Panel Expirado'],
  ['This dashboard has been closed due to inactivity. Please run the command again to continue.', 'Este panel se ha cerrado por inactividad. Ejecuta el comando nuevamente para continuar.'],
  ['Ticket system not configured', 'Sistema de tickets no configurado'],
  ['The ticket system has not been set up yet. Run `/ticket setup` first to configure it.', 'El sistema de tickets todavía no está configurado. Ejecuta `/ticket setup` primero para configurarlo.'],
  ['An error occurred while processing your selection.', 'Ocurrió un error al procesar tu selección.'],
  ['An unexpected error occurred while updating the configuration.', 'Ocurrió un error inesperado al actualizar la configuración.'],
  ['Configuration Error', 'Error de Configuración'],
  ['Failed to open the ticket configuration dashboard.', 'No se pudo abrir el panel de configuración de tickets.'],
  ['Edit Panel Message', 'Editar Mensaje del Panel'],
  ['Success', 'Éxito'],
  ['Panel Message Updated', 'Mensaje del Panel Actualizado'],
  ['The panel message has been updated.', 'El mensaje del panel ha sido actualizado.'],
  ['The live ticket panel has also been refreshed.', 'El panel de tickets activo también ha sido actualizado.'],
  ['The live panel could not be located.', 'No se pudo encontrar el panel activo.'],
  ['The new message will apply the next time you run `/ticket setup`.', 'El nuevo mensaje se aplicará la próxima vez que ejecutes `/ticket setup`.'],
  ['Button Label Updated', 'Etiqueta del Botón Actualizada'],
  ['Button label changed to', 'La etiqueta del botón cambió a'],
  ['The live ticket panel button has also been updated.', 'El botón del panel de tickets activo también ha sido actualizado.'],
  ['The new label will apply the next time you run `/ticket setup`.', 'La nueva etiqueta se aplicará la próxima vez que ejecutes `/ticket setup`.'],
  ['Select the staff role...', 'Selecciona el rol del staff...'],
  ['Current:', 'Actual:'],
  ['Select the role that should have staff access to manage tickets.', 'Selecciona el rol que tendrá acceso de staff para gestionar los tickets.'],
  ['Staff Role Updated', 'Rol del Staff Actualizado'],
  ['Staff role set to', 'Rol del staff establecido en'],
  ['Timed Out', 'Tiempo Agotado'],
  ['No role was selected. The staff role was not changed.', 'No se seleccionó ningún rol. El rol del staff no fue modificado.'],
  ['Select a category...', 'Selecciona una categoría...'],
  ['Select the category where new tickets will be created.', 'Selecciona la categoría donde se crearán los nuevos tickets.'],
  ['Open Category Updated', 'Categoría de Tickets Abiertos Actualizada'],
  ['New tickets will now be created in', 'Los nuevos tickets ahora se crearán en'],
  ['Select the category where closed tickets will be moved.', 'Selecciona la categoría a la que se moverán los tickets cerrados.'],
  ['Closed Category Updated', 'Categoría de Tickets Cerrados Actualizada'],
  ['Closed tickets will now be moved to', 'Los tickets cerrados ahora se moverán a'],
  ['No category was selected. The setting was not changed.', 'No se seleccionó ninguna categoría. El ajuste no fue modificado.'],
  ['Set Max Tickets per User', 'Establecer Máximo de Tickets por Usuario'],
  ['Max Open Tickets (1–10)', 'Máximo de Tickets Abiertos (1–10)'],
  ['Invalid Value', 'Valor Inválido'],
  ['Max tickets must be a whole number between **1** and **10**.', 'El máximo de tickets debe ser un número entero entre **1** y **10**.'],
  ['Max Tickets Updated', 'Máximo de Tickets Actualizado'],
  ['Users can now have at most', 'Los usuarios ahora pueden tener como máximo'],
  ['open tickets at a time.', 'tickets abiertos a la vez.'],
  ['DM on Close Updated', 'DM al Cerrar Actualizado'],
  ['now', 'ahora'],
  ['no longer', 'ya no'],
  ['receive a DM when their ticket is closed.', 'recibirán un DM cuando se cierre su ticket.'],
  ['Select a channel...', 'Selecciona un canal...'],
  ['Select Ticket Logs Channel', 'Seleccionar Canal de Logs de Tickets'],
  ['Choose where ticket feedback, lifecycle events (open, close, claim, etc.), and other logs will be sent.', 'Elige dónde se enviarán las valoraciones, eventos del ciclo de vida (abrir, cerrar, reclamar, etc.) y otros logs de tickets.'],
  ['Logs Channel Updated', 'Canal de Logs Actualizado'],
  ['Ticket logs will be sent to', 'Los logs de tickets se enviarán a'],
  ['No channel selected. No changes were made.', 'No se seleccionó ningún canal. No se realizaron cambios.'],
  ['Select Transcript Channel', 'Seleccionar Canal de Transcripciones'],
  ['Choose where auto-generated transcripts will be sent when tickets are deleted.', 'Elige dónde se enviarán las transcripciones automáticas cuando se eliminen tickets.'],
  ['Transcript Channel Updated', 'Canal de Transcripciones Actualizado'],
  ['Transcripts will be sent to', 'Las transcripciones se enviarán a'],
  ['Check User Tickets', 'Comprobar Tickets del Usuario'],
  ['Select a user to check...', 'Selecciona un usuario para comprobarlo...'],
  ['Select a user to view their current open ticket count.', 'Selecciona un usuario para ver su cantidad actual de tickets abiertos.'],
  ['Ticket Check', 'Comprobación de Tickets'],
  ['Open Tickets:', 'Tickets Abiertos:'],
  ['Remaining:', 'Restantes:'],
  ['This user has reached their ticket limit.', 'Este usuario ha alcanzado su límite de tickets.'],
  ['This user can still open more tickets.', 'Este usuario todavía puede abrir más tickets.'],
  ['No user was selected.', 'No se seleccionó ningún usuario.'],
  ['Delete Ticket System', 'Eliminar Sistema de Tickets'],
  ['Type "DELETE" to confirm', 'Escribe "DELETE" para confirmar'],
  ['Incorrect Confirmation', 'Confirmación Incorrecta'],
  ['You must type "DELETE" exactly to confirm deletion.', 'Debes escribir "DELETE" exactamente para confirmar la eliminación.'],
  ['Ticket System Deleted', 'Sistema de Tickets Eliminado'],
  ['All ticket system configuration has been cleared. Run `/ticket setup` to set it up again.', 'Se eliminó toda la configuración del sistema de tickets. Ejecuta `/ticket setup` para configurarlo nuevamente.'],
  ['The ticket system configuration has been cleared.', 'La configuración del sistema de tickets ha sido eliminada.'],
]);

const entries = [...ES.entries()].sort((a, b) => b[0].length - a[0].length);

function normalizeLanguage(language) {
  const value = String(language ?? '').trim().toLowerCase();
  return value === 'es' || value === 'es-es' || value === 'spanish' || value === 'español' || value.startsWith('es-') ? 'es' : 'en';
}

function translate(value, language) {
  if (language !== 'es' || typeof value !== 'string') return value;
  let result = value;
  for (const [from, to] of entries) result = result.split(from).join(to);
  return result;
}

function translateObject(value, language) {
  if (language !== 'es') return value;
  if (typeof value === 'string') return translate(value, language);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => translateObject(v, language));
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = translateObject(child, language);
  return out;
}

async function languageFor(client, guildId) {
  if (!client || !guildId) return 'en';
  try {
    const { getGuildConfig } = await import('../services/guildConfig.js');
    const config = await getGuildConfig(client, guildId);
    return normalizeLanguage(config?.language);
  } catch {
    return 'en';
  }
}

function patch(klass, method, transform) {
  if (!klass?.prototype?.[method] || klass.prototype[method].__ticketDashboardI18n) return;
  const original = klass.prototype[method];
  const wrapped = async function(payload, ...args) {
    const language = await languageFor(this.client, this.guildId);
    return original.call(this, transform(payload, language), ...args);
  };
  wrapped.__ticketDashboardI18n = true;
  klass.prototype[method] = wrapped;
}

for (const K of [CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction]) {
  for (const method of ['reply', 'editReply', 'followUp', 'update']) patch(K, method, (payload, language) => translateObject(payload, language));
}

for (const K of [CommandInteraction, ModalSubmitInteraction, ButtonInteraction, StringSelectMenuInteraction]) {
  patch(K, 'showModal', (modal, language) => {
    if (language !== 'es' || !modal) return modal;
    if (typeof modal.data?.title === 'string') modal.setTitle(translate(modal.data.title, language));
    for (const row of modal.components || []) {
      for (const input of row?.components || []) {
        if (typeof input?.data?.label === 'string') input.setLabel(translate(input.data.label, language));
        if (typeof input?.data?.placeholder === 'string') input.setPlaceholder(translate(input.data.placeholder, language));
      }
    }
    return modal;
  });
}

console.log('[i18n] Ticket dashboard translation enabled');
