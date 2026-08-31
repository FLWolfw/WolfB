import { appShell, esc } from './layout.js';
import { icon } from './icons.js';

const allowedStatuses = new Set(['online', 'idle', 'dnd', 'invisible']);

export function renderMultibotConfig({ user, bot, csrf }) {
  const settings = bot.settings || {};
  const status = allowedStatuses.has(settings.presenceStatus) ? settings.presenceStatus : 'online';
  const activityType = ['Playing', 'Listening', 'Watching', 'Competing'].includes(settings.activityType) ? settings.activityType : 'Playing';
  const online = bot.status === 'online';
  const avatarUrl = String(settings.avatarUrl || '').trim();
  const bannerUrl = String(settings.bannerUrl || '').trim();

  const body = `<div class="page-head">
    <div class="eyebrow">Multibot B1 · Configuración</div>
    <h1>${icon('settings', 22)} ${esc(settings.name || bot.bot_username || 'Bot')}</h1>
    <p>Personaliza esta instancia sin afectar a tus otros bots.</p>
  </div>

  <div class="grid" style="max-width:980px">
    <div class="card">
      <div class="row spread" style="margin-bottom:18px">
        <div>
          <h2>${icon('bot', 19)} Perfil del bot</h2>
          <p class="hint" style="margin:5px 0 0">${esc(bot.bot_username || 'Bot')} · ID ${esc(bot.bot_user_id)}</p>
        </div>
        <span class="badge ${online ? 'on' : 'off'}">● ${online ? 'online' : 'offline'}</span>
      </div>

      <div class="grid-2">
        <div>
          <label class="field">Nombre personalizado</label>
          <input id="bot-name" type="text" maxlength="32" value="${esc(settings.name || '')}" placeholder="Mi Bot">
          <p class="hint">Se aplicará como nombre de usuario del bot en Discord.</p>
        </div>
        <div>
          <label class="field">Idioma del panel</label>
          <select id="bot-language">
            <option value="es" ${settings.language !== 'en' ? 'selected' : ''}>Español</option>
            <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>

      <div style="margin-top:16px">
        <label class="field">Descripción privada</label>
        <textarea id="bot-description" maxlength="500" rows="4" placeholder="Describe para qué usarás este bot…">${esc(settings.description || '')}</textarea>
        <p class="hint">Esta descripción queda guardada en tu configuración de Wolf.</p>
      </div>

      <div style="margin-top:16px">
        <label class="field">Avatar del bot</label>
        <input id="bot-avatar" type="url" maxlength="1000" value="${esc(avatarUrl)}" placeholder="https://ejemplo.com/avatar.png">
        <p class="hint">Pega una URL pública de una imagen.</p>
      </div>

      <div style="margin-top:16px">
        <label class="field">Banner del bot</label>
        <input id="bot-banner" type="url" maxlength="1000" value="${esc(bannerUrl)}" placeholder="https://ejemplo.com/banner.png">
        <p class="hint">Pega una URL pública de la imagen que quieras usar como banner del perfil del bot.</p>
        <div id="banner-preview" style="margin-top:12px;border-radius:12px;overflow:hidden;min-height:90px;background:rgba(255,255,255,.04);display:${bannerUrl ? 'block' : 'none'}">
          ${bannerUrl ? `<img src="${esc(bannerUrl)}" alt="Vista previa del banner" style="display:block;width:100%;height:150px;object-fit:cover">` : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>${icon('wave', 19)} Presencia de Discord</h2>
      <p class="hint">Controla el estado y la actividad que verán los usuarios.</p>
      <div class="grid-2" style="margin-top:16px">
        <div>
          <label class="field">Estado</label>
          <select id="presence-status">
            <option value="online" ${status === 'online' ? 'selected' : ''}>🟢 Online</option>
            <option value="idle" ${status === 'idle' ? 'selected' : ''}>🌙 Ausente</option>
            <option value="dnd" ${status === 'dnd' ? 'selected' : ''}>⛔ No molestar</option>
            <option value="invisible" ${status === 'invisible' ? 'selected' : ''}>⚫ Invisible</option>
          </select>
        </div>
        <div>
          <label class="field">Tipo de actividad</label>
          <select id="activity-type">
            <option value="Playing" ${activityType === 'Playing' ? 'selected' : ''}>Jugando</option>
            <option value="Listening" ${activityType === 'Listening' ? 'selected' : ''}>Escuchando</option>
            <option value="Watching" ${activityType === 'Watching' ? 'selected' : ''}>Viendo</option>
            <option value="Competing" ${activityType === 'Competing' ? 'selected' : ''}>Compitiendo</option>
          </select>
        </div>
      </div>
      <div style="margin-top:16px">
        <label class="field">Texto de actividad</label>
        <input id="activity-text" type="text" maxlength="128" value="${esc(settings.activityText || '')}" placeholder="mi servidor">
      </div>
    </div>

    <div class="card">
      <h2>${icon('shield', 19)} Estado de la instancia</h2>
      <p class="hint">Puedes encender o apagar esta instancia sin tocar las demás.</p>
      <div class="row" style="flex-wrap:wrap;margin-top:16px">
        ${online ? `<button class="btn-ghost" onclick="stopBot()">⏹ Apagar</button>` : `<button onclick="startBot()">▶ Encender</button>`}
        <button onclick="saveBot()">${icon('check', 15)} Guardar cambios</button>
        <a class="btn btn-ghost" href="/bots">← Volver a mis bots</a>
      </div>
      <p id="msg" class="hint" style="min-height:20px;margin:12px 0 0"></p>
    </div>
  </div>

  <script>
    const CSRF = ${JSON.stringify(csrf)};
    const BOT_ID = ${JSON.stringify(String(bot.id))};
    async function api(url, method, body) {
      const r = await fetch(url, { method, headers: {'Content-Type':'application/json','X-CSRF-Token':CSRF}, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'request_failed');
      return data;
    }
    function collectSettings() {
      return {
        name: document.getElementById('bot-name').value.trim(),
        language: document.getElementById('bot-language').value,
        description: document.getElementById('bot-description').value.trim(),
        avatarUrl: document.getElementById('bot-avatar').value.trim(),
        bannerUrl: document.getElementById('bot-banner').value.trim(),
        presenceStatus: document.getElementById('presence-status').value,
        activityType: document.getElementById('activity-type').value,
        activityText: document.getElementById('activity-text').value.trim()
      };
    }
    document.getElementById('bot-banner').addEventListener('input', (e) => {
      const url = e.target.value.trim(); const box = document.getElementById('banner-preview');
      box.innerHTML = url ? '<img src="'+url.replace(/"/g,'&quot;')+'" alt="Vista previa del banner" style="display:block;width:100%;height:150px;object-fit:cover">' : '';
      box.style.display = url ? 'block' : 'none';
    });
    async function saveBot() {
      const msg = document.getElementById('msg');
      msg.textContent = 'Guardando y aplicando cambios…';
      try { await api('/api/multibot/'+BOT_ID,'PATCH',{settings: collectSettings()}); msg.textContent = '✓ Cambios guardados.'; setTimeout(() => location.reload(), 500); }
      catch (e) { msg.textContent = 'No se pudo guardar: ' + e.message; }
    }
    async function startBot() {
      const msg = document.getElementById('msg'); msg.textContent = 'Conectando con Discord…';
      try { await api('/api/multibot/'+BOT_ID+'/start','POST'); location.reload(); } catch (e) { msg.textContent = 'No se pudo encender: ' + e.message; }
    }
    async function stopBot() {
      const msg = document.getElementById('msg'); msg.textContent = 'Desconectando…';
      try { await api('/api/multibot/'+BOT_ID+'/stop','POST'); location.reload(); } catch (e) { msg.textContent = 'No se pudo apagar: ' + e.message; }
    }
  </script>`;

  return appShell({ title: `Configurar ${settings.name || bot.bot_username || 'Bot'}`, user, active: 'multibot', body });
}
