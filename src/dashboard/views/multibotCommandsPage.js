import { appShell, esc } from './layout.js';
import { icon } from './icons.js';

const GENERAL_COMMANDS = [
  ['ping', 'Muestra la latencia del bot.', '🧪'],
  ['help', 'Muestra los comandos disponibles.', '📖'],
  ['about', 'Muestra información sobre este bot.', '🤖'],
  ['server', 'Muestra información del servidor actual.', '🏠'],
  ['user', 'Muestra información de un usuario.', '👤'],
  ['avatar', 'Muestra el avatar de un usuario.', '🖼️'],
  ['voice', 'Conecta o desconecta el bot de un canal de voz.', '🔊'],
];

const MODERATION_COMMANDS = [
  ['userinfo', 'Muestra información detallada de un miembro.', '👤'],
  ['ban', 'Banea a un usuario del servidor.', '🔨'],
  ['kick', 'Expulsa a un usuario del servidor.', '👢'],
  ['timeout', 'Silencia temporalmente a un usuario.', '⏱️'],
  ['clear', 'Elimina entre 1 y 100 mensajes recientes.', '🧹'],
  ['lock', 'Bloquea el canal para @everyone.', '🔒'],
  ['unlock', 'Desbloquea el canal para @everyone.', '🔓'],
  ['warn', 'Añade una advertencia persistente a un usuario.', '⚠️'],
  ['warnings', 'Muestra las advertencias de un usuario.', '📋'],
];

function commandRows(commands, enabled) {
  return commands.map(([name, description, emoji]) => `
    <label class="command-row">
      <div class="command-info"><span class="command-icon">${emoji}</span><div><strong>/${name}</strong><p>${description}</p></div></div>
      <input class="toggle" type="checkbox" data-command="${name}" ${enabled[name] !== false ? 'checked' : ''}>
    </label>`).join('');
}

export function renderMultibotCommands({ user, bot, csrf }) {
  const settings = bot.settings || {};
  const enabled = settings.commands && typeof settings.commands === 'object' ? settings.commands : {};
  const displayName = settings.name || bot.bot_username || 'Bot';
  const body = `<div class="page-head">
    <div class="eyebrow">Multibot B1 · Comandos</div>
    <h1>${icon('terminal', 22)} Comandos de ${esc(displayName)}</h1>
    <p>Activa o desactiva los comandos de esta instancia sin afectar a tus otros bots.</p>
  </div>
  <div class="grid" style="max-width:900px">
    <div class="card">
      <div class="row spread" style="margin-bottom:14px"><div><h2>📜 Comandos disponibles</h2><p class="hint" style="margin:5px 0 0">Los cambios se registran en Discord cuando guardas.</p></div><span class="badge ${bot.status === 'online' ? 'on' : 'off'}">● ${bot.status === 'online' ? 'online' : 'offline'}</span></div>
      <section class="command-section"><h3>✨ Generales</h3><div class="command-list">${commandRows(GENERAL_COMMANDS, enabled)}</div></section>
      <section class="command-section"><h3>🛡️ Moderación</h3><p class="section-hint">Los comandos de moderación también exigen el permiso correspondiente de Discord.</p><div class="command-list">${commandRows(MODERATION_COMMANDS, enabled)}</div></section>
      <div class="row" style="margin-top:18px;flex-wrap:wrap"><button onclick="saveCommands()">${icon('check', 15)} Guardar comandos</button><a class="btn btn-ghost" href="/bots/${esc(bot.id)}">⚙️ Configuración</a><a class="btn btn-ghost" href="/bots">← Mis bots</a></div>
      <p id="msg" class="hint" style="min-height:20px;margin:12px 0 0"></p>
    </div>
    <div class="card"><h2>💡 Cómo funciona</h2><p class="hint">Los comandos se registran directamente en la aplicación de Discord de <strong>${esc(displayName)}</strong>. Al desactivar uno, desaparece de los comandos disponibles de ese bot.</p><p class="hint">Cada instancia mantiene su propia configuración. Los comandos de Wolf-Bot y de tus otras instancias no se modifican.</p><p class="hint">🔊 <strong>/voice</strong> usa una conexión de voz aislada por bot y servidor. <code>/voice join</code> te deja elegir el canal; <code>/voice leave</code> lo desconecta.</p><p class="hint">🛡️ <strong>Seguridad:</strong> los comandos de moderación siguen exigiendo los permisos correspondientes de Discord, y `/voice` comprueba que el bot pueda ver y conectarse al canal seleccionado.</p></div>
  </div>
  <style>
    .command-section{margin-top:18px}.command-section h3{font-size:14px;margin:0 0 9px}.section-hint{margin:-3px 0 10px;color:rgba(255,255,255,.5);font-size:12px}.command-list{display:flex;flex-direction:column;gap:8px}.command-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);cursor:pointer}.command-info{display:flex;align-items:center;gap:13px;min-width:0}.command-icon{font-size:22px}.command-info strong{font-size:15px}.command-info p{margin:3px 0 0;color:rgba(255,255,255,.55);font-size:13px}.toggle{appearance:none;width:46px;height:25px;border-radius:999px;background:#30313d;position:relative;cursor:pointer;flex:0 0 auto}.toggle:after{content:'';position:absolute;width:19px;height:19px;top:3px;left:3px;border-radius:50%;background:#aaa;transition:.15s}.toggle:checked{background:#6f5cff}.toggle:checked:after{left:24px;background:white}
  </style>
  <script>
    const CSRF = ${JSON.stringify(csrf)}; const BOT_ID = ${JSON.stringify(String(bot.id))};
    async function saveCommands(){
      const msg=document.getElementById('msg'); msg.textContent='Guardando y registrando comandos en Discord…';
      const commands={}; document.querySelectorAll('[data-command]').forEach(el=>commands[el.dataset.command]=el.checked);
      try { const r=await fetch('/api/multibot/'+BOT_ID,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify({settings:{commands}})}); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.message||data.error||'Error'); msg.textContent='✓ Comandos guardados.'; }
      catch(e){ msg.textContent='❌ No se pudieron guardar: '+e.message; }
    }
  </script>`;
  return appShell({ title: `Comandos · ${displayName}`, user, active: 'multibot', body });
}
