import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { appShell, esc } from '../views/layout.js';
import { icon } from '../views/icons.js';
import { csrfField, ensureCsrfToken } from '../lib/csrf.js';
import { makeRequireGuildAdmin } from '../middleware/auth.js';
import { getGuildConfig, updateAntiSpamConfig } from '../../services/guildConfigService.js';
import { logger } from '../../utils/logger.js';

function clampInt(raw, min, max, fallback) {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function idsFromBody(raw) {
  const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return [...new Set(values.map(String))];
}

function channelOptions(guild, selected) {
  const selectedIds = new Set(selected || []);
  const channels = guild.channels.cache
    .filter((channel) => channel.type === 0)
    .sort((a, b) => a.position - b.position)
    .map((channel) => `<label class="pill ${selectedIds.has(channel.id) ? 'on' : 'off'}" style="display:block;margin:6px 0"><input type="checkbox" name="ignoredChannels" value="${esc(channel.id)}" ${selectedIds.has(channel.id) ? 'checked' : ''} style="margin-right:8px">#${esc(channel.name)}</label>`)
    .join('');
  return channels || '<div class="hint">No hay canales de texto disponibles.</div>';
}

function roleOptions(guild, selected) {
  const selectedIds = new Set(selected || []);
  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((a, b) => b.rawPosition - a.rawPosition)
    .map((role) => `<label class="pill ${selectedIds.has(role.id) ? 'on' : 'off'}" style="display:block;margin:6px 0"><input type="checkbox" name="ignoredRoles" value="${esc(role.id)}" ${selectedIds.has(role.id) ? 'checked' : ''} style="margin-right:8px">@${esc(role.name)}</label>`)
    .join('');
  return roles || '<div class="hint">No hay roles disponibles.</div>';
}

function renderAntiSpam({ user, guild, config, csrf, flash }) {
  const antiSpam = config.antiSpam || {};
  const botMember = guild.members.me;
  const hasModerateMembers = Boolean(botMember?.permissions.has(PermissionFlagsBits.ModerateMembers));
  const botRole = botMember?.roles?.highest;
  const timeoutReady = hasModerateMembers && Boolean(botRole);
  const body = `
    <div class="page-head">
      <div class="eyebrow">Seguridad</div>
      <h1>${icon('shield')} Anti-Spam</h1>
      <p>Configura el Anti-Spam de <strong>${esc(guild.name)}</strong>. Estos ajustes solo afectan a este servidor.</p>
    </div>

    <div class="card section">
      <div class="sec-head">
        <h2>${icon('shield')} Protección Anti-Spam</h2>
        <p>Detecta ráfagas de mensajes y mensajes repetidos. Elimina el contenido y aplica timeout cuando Discord permita moderar al usuario.</p>
      </div>
      <div class="divider"></div>
      ${flash ? `<div class="card" style="margin-bottom:16px">${esc(flash.msg)}</div>` : ''}
      <form method="POST" action="/server/${esc(guild.id)}/antispam">
        ${csrfField(csrf)}
        <label class="field">Estado</label>
        <select name="enabled">
          <option value="1" ${antiSpam.enabled ? 'selected' : ''}>Activado</option>
          <option value="0" ${!antiSpam.enabled ? 'selected' : ''}>Desactivado</option>
        </select>

        <div class="grid-2">
          <div>
            <label class="field">Mensajes máximos</label>
            <input type="number" name="maxMessages" min="2" max="50" value="${esc(antiSpam.maxMessages ?? 5)}">
            <div class="small">Cantidad de mensajes dentro de la ventana.</div>
          </div>
          <div>
            <label class="field">Ventana (segundos)</label>
            <input type="number" name="windowSeconds" min="1" max="60" value="${esc(Math.round((antiSpam.windowMs ?? 5000) / 1000))}">
            <div class="small">De 1 a 60 segundos.</div>
          </div>
          <div>
            <label class="field">Mensajes repetidos</label>
            <input type="number" name="duplicateThreshold" min="2" max="20" value="${esc(antiSpam.duplicateThreshold ?? 3)}">
            <div class="small">Repeticiones consecutivas para detectar spam.</div>
          </div>
          <div>
            <label class="field">Timeout (segundos)</label>
            <input type="number" name="timeoutSeconds" min="5" max="2419200" value="${esc(Math.round((antiSpam.timeoutMs ?? 60000) / 1000))}">
            <div class="small">Máximo permitido por Discord: 28 días.</div>
          </div>
        </div>

        <div class="divider"></div>
        <label class="field">Acciones</label>
        <label class="row" style="justify-content:flex-start;gap:10px;margin:8px 0"><input type="checkbox" name="deleteMessages" value="1" ${antiSpam.deleteMessages !== false ? 'checked' : ''}> Eliminar el mensaje que dispara el Anti-Spam</label>
        <label class="row" style="justify-content:flex-start;gap:10px;margin:8px 0"><input type="checkbox" name="timeout" value="1" ${antiSpam.timeout !== false ? 'checked' : ''}> Aplicar timeout al usuario cuando sea moderable</label>

        <div class="divider"></div>
        <div class="card" style="margin-bottom:16px">
          <strong>${timeoutReady ? '✓ Timeout disponible' : '⚠️ Timeout no disponible ahora'}</strong>
          <p class="hint" style="margin:6px 0 0">${hasModerateMembers ? 'Wolf tiene Moderate Members.' : 'Wolf necesita el permiso Moderate Members.'} ${botRole ? `Rol más alto: @${esc(botRole.name)}.` : 'No se pudo determinar el rol más alto de Wolf.'} La jerarquía de Discord no puede saltarse: usuarios con un rol igual o superior al de Wolf no pueden recibir timeout.</p>
        </div>

        <div class="divider"></div>
        <div class="grid-2">
          <div>
            <label class="field">Canales ignorados</label>
            <div class="small">El Anti-Spam no actuará en estos canales.</div>
            <div style="max-height:300px;overflow:auto;margin-top:8px">${channelOptions(guild, antiSpam.ignoredChannels)}</div>
          </div>
          <div>
            <label class="field">Roles ignorados</label>
            <div class="small">Los miembros con estos roles quedan fuera del Anti-Spam.</div>
            <div style="max-height:300px;overflow:auto;margin-top:8px">${roleOptions(guild, antiSpam.ignoredRoles)}</div>
          </div>
        </div>

        <div class="divider"></div>
        <button class="btn-block">${icon('check', 16)} Guardar Anti-Spam</button>
      </form>
    </div>

    <div style="margin-top:16px"><a class="btn" href="/server/${esc(guild.id)}">← Volver a la configuración del servidor</a></div>
  `;

  return appShell({ title: `Anti-Spam · ${guild.name}`, user, active: 'dashboard', flash: null, body });
}

export function antiSpamRoutes(client) {
  const router = express.Router();
  const requireGuildAdmin = makeRequireGuildAdmin(client);

  router.get('/server/:id/antispam', requireGuildAdmin, async (req, res) => {
    try {
      const config = await getGuildConfig(client.db, req.guild.id);
      res.send(renderAntiSpam({
        user: req.session.user,
        guild: req.guild,
        config,
        csrf: ensureCsrfToken(req),
        flash: req.session.flash || null,
      }));
      delete req.session.flash;
    } catch (error) {
      logger.error('Anti-Spam dashboard page failed', { error: error?.message, guildId: req.guild?.id });
      res.status(500).send('Error cargando Anti-Spam.');
    }
  });

  router.post('/server/:id/antispam', requireGuildAdmin, async (req, res) => {
    try {
      const guild = req.guild;
      const validChannelIds = new Set(guild.channels.cache.filter((channel) => channel.type === 0).map((channel) => channel.id));
      const validRoleIds = new Set(guild.roles.cache.filter((role) => role.id !== guild.id && !role.managed).map((role) => role.id));
      const ignoredChannels = idsFromBody(req.body.ignoredChannels).filter((id) => validChannelIds.has(id));
      const ignoredRoles = idsFromBody(req.body.ignoredRoles).filter((id) => validRoleIds.has(id));

      await updateAntiSpamConfig(client.db, guild.id, {
        enabled: req.body.enabled === '1',
        maxMessages: clampInt(req.body.maxMessages, 2, 50, 5),
        windowMs: clampInt(req.body.windowSeconds, 1, 60, 5) * 1000,
        duplicateThreshold: clampInt(req.body.duplicateThreshold, 2, 20, 3),
        timeoutMs: clampInt(req.body.timeoutSeconds, 5, 2419200, 60) * 1000,
        timeout: req.body.timeout === '1',
        deleteMessages: req.body.deleteMessages === '1',
        ignoredChannels,
        ignoredRoles,
      });

      req.session.flash = { type: 'ok', msg: 'Anti-Spam guardado correctamente.' };
      res.redirect(`/server/${guild.id}/antispam`);
    } catch (error) {
      logger.error('Anti-Spam dashboard save failed', { error: error?.message, stack: error?.stack, guildId: req.guild?.id });
      req.session.flash = { type: 'err', msg: 'No se pudo guardar Anti-Spam. Revisa los logs del bot.' };
      res.redirect(`/server/${req.guild.id}/antispam`);
    }
  });

  return router;
}
