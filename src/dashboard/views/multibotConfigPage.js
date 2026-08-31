import { appShell, esc } from './layout.js';
import { icon } from './icons.js';

const allowedStatuses = new Set(['online', 'idle', 'dnd', 'invisible']);
const activityTypes = new Set(['Playing', 'Listening', 'Watching', 'Competing']);

export function renderMultibotConfig({ user, bot, csrf }) {
  const settings = bot.settings || {};
  const status = allowedStatuses.has(settings.presenceStatus) ? settings.presenceStatus : 'online';
  const activityType = activityTypes.has(settings.activityType) ? settings.activityType : 'Playing';
  const online = bot.status === 'online';
  const avatarUrl = String(settings.avatarUrl || '').trim();
  const bannerUrl = String(settings.bannerUrl || '').trim();
  const initialAvatar = avatarUrl;
  const initialBanner = bannerUrl;

  const body = `<div class="page-head">
    <div class="eyebrow">Multibot B1 · Configuración</div>
    <h1>${icon('settings', 22)} ${esc(settings.name || bot.bot_username || 'Bot')}</h1>
    <p>Personaliza esta instancia sin afectar a tus otros bots.</p>
  </div>

  <div class="grid" style="max-width:1100px">
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
    </div>

    <div class="card">
      <div class="row spread" style="margin-bottom:14px">
        <div>
          <h2>🖼️ Imagen de perfil</h2>
          <p class="hint" style="margin:5px 0 0">Sube una imagen desde tu PC y ajusta el encuadre antes de aplicarla.</p>
        </div>
        <span class="badge">512 × 512</span>
      </div>

      <div class="media-editor" id="avatar-editor">
        <div class="media-stage avatar-stage" id="avatar-stage">
          <div class="checker"></div>
          <canvas id="avatar-canvas" width="512" height="512"></canvas>
          <div class="media-empty" id="avatar-empty" style="display:${initialAvatar ? 'none' : 'flex'}">Sin imagen</div>
        </div>
        <div class="media-controls">
          <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <div class="row" style="flex-wrap:wrap">
            <button type="button" class="btn" onclick="document.getElementById('avatar-file').click()">📁 Subir imagen</button>
            <button type="button" class="btn btn-ghost" onclick="resetImageEditor('avatar')">↺ Restablecer</button>
            <button type="button" class="btn btn-ghost" onclick="clearImage('avatar')">✕ Quitar</button>
          </div>
          <label class="field" style="margin-top:15px">Zoom <span id="avatar-zoom-label">100%</span></label>
          <input id="avatar-zoom" class="range" type="range" min="100" max="300" step="1" value="100">
          <div class="grid-2" style="margin-top:10px">
            <div><label class="field">Horizontal</label><input id="avatar-x" class="range" type="range" min="-100" max="100" value="0"></div>
            <div><label class="field">Vertical</label><input id="avatar-y" class="range" type="range" min="-100" max="100" value="0"></div>
          </div>
          <p class="hint">También puedes arrastrar la imagen directamente dentro del recuadro.</p>
        </div>
      </div>
      <input id="bot-avatar" type="hidden" value="${esc(initialAvatar)}">
    </div>

    <div class="card">
      <div class="row spread" style="margin-bottom:14px">
        <div>
          <h2>🖼️ Banner del bot</h2>
          <p class="hint" style="margin:5px 0 0">Crea el banner directamente desde una imagen de tu PC y controla exactamente qué parte se muestra.</p>
        </div>
        <span class="badge">1200 × 480</span>
      </div>

      <div class="media-editor" id="banner-editor">
        <div class="media-stage banner-stage" id="banner-stage">
          <div class="checker"></div>
          <canvas id="banner-canvas" width="1200" height="480"></canvas>
          <div class="media-empty" id="banner-empty" style="display:${initialBanner ? 'none' : 'flex'}">Sin banner</div>
        </div>
        <div class="media-controls">
          <input id="banner-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <div class="row" style="flex-wrap:wrap">
            <button type="button" class="btn" onclick="document.getElementById('banner-file').click()">📁 Subir imagen</button>
            <button type="button" class="btn btn-ghost" onclick="resetImageEditor('banner')">↺ Restablecer</button>
            <button type="button" class="btn btn-ghost" onclick="clearImage('banner')">✕ Quitar</button>
          </div>
          <label class="field" style="margin-top:15px">Zoom <span id="banner-zoom-label">100%</span></label>
          <input id="banner-zoom" class="range" type="range" min="100" max="300" step="1" value="100">
          <div class="grid-2" style="margin-top:10px">
            <div><label class="field">Horizontal</label><input id="banner-x" class="range" type="range" min="-100" max="100" value="0"></div>
            <div><label class="field">Vertical</label><input id="banner-y" class="range" type="range" min="-100" max="100" value="0"></div>
          </div>
          <p class="hint">El resultado se redimensiona y comprime automáticamente para mantener el panel ligero.</p>
        </div>
      </div>
      <input id="bot-banner" type="hidden" value="${esc(initialBanner)}">
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

  <style>
    .media-editor{display:grid;grid-template-columns:minmax(260px,1fr) minmax(260px,1.15fr);gap:20px;align-items:start}
    .media-stage{position:relative;width:100%;overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.035);touch-action:none;user-select:none}
    .avatar-stage{max-width:430px;aspect-ratio:1/1;margin:auto}
    .banner-stage{aspect-ratio:2.5/1}
    .media-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
    .media-stage.dragging canvas{cursor:grabbing}
    .checker{position:absolute;inset:0;background-image:linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,.035) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,.035) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,.035) 75%);background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0}
    .media-empty{position:absolute;inset:0;align-items:center;justify-content:center;color:rgba(255,255,255,.42);font-size:14px;pointer-events:none}
    .media-controls{min-width:0}
    .range{width:100%;accent-color:currentColor}
    @media(max-width:800px){.media-editor{grid-template-columns:1fr}.avatar-stage{max-width:100%}}
  </style>

  <script>
    const CSRF = ${JSON.stringify(csrf)};
    const BOT_ID = ${JSON.stringify(String(bot.id))};
    const initialImages = { avatar: ${JSON.stringify(initialAvatar)}, banner: ${JSON.stringify(initialBanner)} };
    const editors = {
      avatar: { width: 512, height: 512, image: null, zoom: 100, x: 0, y: 0, dragX: 0, dragY: 0, source: initialImages.avatar, dirty: false },
      banner: { width: 1200, height: 480, image: null, zoom: 100, x: 0, y: 0, dragX: 0, dragY: 0, source: initialImages.banner, dirty: false }
    };

    async function api(url, method, body) {
      const r = await fetch(url, { method, headers: {'Content-Type':'application/json','X-CSRF-Token':CSRF}, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'request_failed');
      return data;
    }

    function fitCover(img, width, height, zoom, x, y) {
      const base = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const scale = base * (zoom / 100);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const maxX = Math.max(0, (dw - width) / 2);
      const maxY = Math.max(0, (dh - height) / 2);
      return { dw, dh, dx: (width - dw) / 2 + maxX * (x / 100), dy: (height - dh) / 2 + maxY * (y / 100) };
    }

    function drawEditor(kind) {
      const state = editors[kind];
      const canvas = document.getElementById(kind + '-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, state.width, state.height);
      if (!state.image) return;
      const p = fitCover(state.image, state.width, state.height, state.zoom, state.x, state.y);
      ctx.drawImage(state.image, p.dx, p.dy, p.dw, p.dh);
      document.getElementById(kind + '-zoom-label').textContent = state.zoom + '%';
      document.getElementById(kind + '-zoom').value = state.zoom;
      document.getElementById(kind + '-x').value = state.x;
      document.getElementById(kind + '-y').value = state.y;
    }

    function loadImage(kind, source) {
      if (!source) { editors[kind].image = null; drawEditor(kind); return; }
      const img = new Image();
      img.onload = () => { editors[kind].image = img; document.getElementById(kind + '-empty').style.display = 'none'; drawEditor(kind); };
      img.onerror = () => setMessage('No se pudo cargar la imagen del ' + (kind === 'avatar' ? 'avatar' : 'banner') + '.');
      img.src = source;
    }

    function resetImageEditor(kind) {
      const state = editors[kind];
      state.zoom = 100; state.x = 0; state.y = 0; state.source = initialImages[kind]; state.dirty = false;
      document.getElementById(kind === 'avatar' ? 'bot-avatar' : 'bot-banner').value = state.source;
      document.getElementById(kind + '-empty').style.display = state.source ? 'none' : 'flex';
      loadImage(kind, state.source);
    }

    function clearImage(kind) {
      const state = editors[kind];
      state.image = null; state.source = ''; state.dirty = true; state.zoom = 100; state.x = 0; state.y = 0;
      document.getElementById(kind === 'avatar' ? 'bot-avatar' : 'bot-banner').value = '';
      document.getElementById(kind + '-empty').style.display = 'flex';
      drawEditor(kind);
    }

    function setMessage(text) { document.getElementById('msg').textContent = text; }

    function bindRange(kind, field) {
      document.getElementById(kind + '-' + field).addEventListener('input', (e) => {
        editors[kind][field] = Number(e.target.value);
        editors[kind].dirty = true;
        drawEditor(kind);
      });
    }

    function bindFile(kind) {
      document.getElementById(kind + '-file').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 12 * 1024 * 1024) { setMessage('La imagen es demasiado grande. Máximo 12 MB.'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => {
          editors[kind].source = reader.result;
          editors[kind].zoom = 100; editors[kind].x = 0; editors[kind].y = 0; editors[kind].dirty = true;
          document.getElementById(kind === 'avatar' ? 'bot-avatar' : 'bot-banner').value = '';
          document.getElementById(kind + '-empty').style.display = 'none';
          loadImage(kind, reader.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      });
    }

    function bindDrag(kind) {
      const stage = document.getElementById(kind + '-stage');
      let start = null;
      stage.addEventListener('pointerdown', (e) => {
        if (!editors[kind].image) return;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('dragging');
        start = { px: e.clientX, py: e.clientY, x: editors[kind].x, y: editors[kind].y };
      });
      stage.addEventListener('pointermove', (e) => {
        if (!start) return;
        const rect = stage.getBoundingClientRect();
        const state = editors[kind];
        const scaleX = 200 / Math.max(1, rect.width);
        const scaleY = 200 / Math.max(1, rect.height);
        state.x = Math.max(-100, Math.min(100, start.x + (e.clientX - start.px) * scaleX));
        state.y = Math.max(-100, Math.min(100, start.y + (e.clientY - start.py) * scaleY));
        state.dirty = true;
        drawEditor(kind);
      });
      const end = () => { start = null; stage.classList.remove('dragging'); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end); stage.addEventListener('pointerleave', () => { if (start) end(); });
    }

    function canvasToDataUrl(kind) {
      const state = editors[kind];
      if (!state.image) return '';
      const canvas = document.getElementById(kind + '-canvas');
      let quality = 0.82;
      let data = canvas.toDataURL('image/jpeg', quality);
      while (data.length > 280000 && quality > 0.45) { quality -= 0.07; data = canvas.toDataURL('image/jpeg', quality); }
      return data;
    }

    function collectSettings() {
      const avatarState = editors.avatar;
      const bannerState = editors.banner;
      const avatar = avatarState.dirty ? canvasToDataUrl('avatar') : document.getElementById('bot-avatar').value.trim();
      const banner = bannerState.dirty ? canvasToDataUrl('banner') : document.getElementById('bot-banner').value.trim();
      return {
        name: document.getElementById('bot-name').value.trim(),
        language: document.getElementById('bot-language').value,
        description: document.getElementById('bot-description').value.trim(),
        avatarUrl: avatar,
        bannerUrl: banner,
        presenceStatus: document.getElementById('presence-status').value,
        activityType: document.getElementById('activity-type').value,
        activityText: document.getElementById('activity-text').value.trim()
      };
    }

    async function saveBot() {
      const msg = document.getElementById('msg');
      msg.textContent = 'Preparando imágenes y guardando…';
      try {
        const settings = collectSettings();
        const total = JSON.stringify(settings).length;
        if (total > 900000) throw new Error('Las imágenes siguen siendo demasiado grandes. Prueba con imágenes más pequeñas.');
        await api('/api/multibot/' + BOT_ID, 'PATCH', { settings });
        msg.textContent = '✓ Cambios guardados y aplicados.';
        setTimeout(() => location.reload(), 700);
      } catch (e) { msg.textContent = 'No se pudo guardar: ' + e.message; }
    }

    async function startBot() {
      const msg = document.getElementById('msg'); msg.textContent = 'Conectando con Discord…';
      try { await api('/api/multibot/' + BOT_ID + '/start', 'POST'); location.reload(); } catch (e) { msg.textContent = 'No se pudo encender: ' + e.message; }
    }
    async function stopBot() {
      const msg = document.getElementById('msg'); msg.textContent = 'Desconectando…';
      try { await api('/api/multibot/' + BOT_ID + '/stop', 'POST'); location.reload(); } catch (e) { msg.textContent = 'No se pudo apagar: ' + e.message; }
    }

    ['zoom','x','y'].forEach(field => { bindRange('avatar', field); bindRange('banner', field); });
    ['avatar','banner'].forEach(kind => { bindFile(kind); bindDrag(kind); loadImage(kind, editors[kind].source); });
  </script>`;

  return appShell({ title: `Configurar ${settings.name || bot.bot_username || 'Bot'}`, user, active: 'multibot', body });
}
