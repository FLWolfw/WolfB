import { appShell, esc } from './layout.js';
import { icon } from './icons.js';

export function renderMultibot({ user, bots, csrf }) {
  const cards = bots.length ? bots.map((bot) => {
    const settings = bot.settings || {};
    const online = bot.status === 'online';
    const displayName = settings.name || bot.bot_username || 'Bot';
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(bot.bot_user_id)}&scope=bot%20applications.commands&permissions=0`;
    const avatar = settings.avatarUrl ? `<img src="${esc(settings.avatarUrl)}" class="icon" style="object-fit:cover" alt="">` : `<div class="fallback">${esc(displayName.charAt(0).toUpperCase())}</div>`;
    return `<div class="card" style="display:flex;flex-direction:column;gap:14px">
      <div class="row spread">
        <div style="display:flex;align-items:center;gap:12px">${avatar}<div><h2>${icon('bot', 18)} ${esc(displayName)}</h2><p class="hint" style="margin:4px 0 0">ID: ${esc(bot.bot_user_id)}</p></div></div>
        <span id="status-${bot.id}" class="badge ${online ? 'on' : 'off'}">● ${online ? 'online' : 'offline'}</span>
      </div>
      ${settings.description ? `<p class="hint" style="margin:0">${esc(settings.description)}</p>` : ''}
      <div class="row" style="flex-wrap:wrap">
        <a class="btn" href="/bots/${esc(bot.id)}">${icon('settings', 15)} Configurar</a>
        <a class="btn btn-ghost" href="/bots/${esc(bot.id)}/commands">⌘ Comandos</a>
        ${online ? `<button class="btn-ghost" onclick="stopBot(${bot.id})">⏹ Apagar</button>` : `<button onclick="startBot(${bot.id})">▶ Encender</button>`}
        <a class="btn btn-ghost" href="${inviteUrl}" target="_blank" rel="noopener">🔗 Invitar</a>
        <button class="btn-ghost" onclick="removeBot(${bot.id})">Eliminar</button>
      </div>
      <p id="msg-${bot.id}" class="hint" style="min-height:20px;margin:0"></p>
    </div>`;
  }).join('') : `<div class="card"><h2>${icon('bot', 18)} No tienes bots todavía</h2><p class="hint">Crea una aplicación en Discord, genera su bot y pega aquí el token para conectarlo a tu cuenta de Wolf.</p></div>`;

  const body = `<div class="page-head"><div class="eyebrow">Multibot B1</div><h1>Mis bots</h1><p>Crea y administra instancias independientes desde el mismo dashboard.</p></div>
  <div class="grid" style="margin-bottom:18px">
    <div class="card"><h2>${icon('bot', 20)} Agregar un bot</h2><p class="hint">El token se verifica con Discord y se guarda cifrado. Nunca se muestra de nuevo.</p><label class="field">Token del bot</label><input id="bot-token" type="password" autocomplete="off" placeholder="Pega aquí el token de tu bot"><p id="bot-msg" class="hint" style="min-height:20px"></p><button class="btn-lg" onclick="addBot()">${icon('plus', 16)} Verificar y agregar</button></div>
    <div class="card"><h2>${icon('shield', 20)} Cómo funciona</h2><p class="hint">1. Crea tu aplicación en Discord.<br>2. Entra en la sección Bot y genera el token.<br>3. Pega el token aquí.<br>4. Wolf verifica que pertenece a un bot válido.<br>5. Después podrás encender, apagar y personalizar esa instancia.</p><p class="hint">No compartas tu token con otras personas.</p></div>
  </div>
  <div class="page-head" style="margin-bottom:16px"><h1 style="font-size:18px">Tus instancias</h1></div><div class="grid">${cards}</div>
  <script>
    const CSRF = ${JSON.stringify(csrf)};
    async function api(url, method, body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||data.error||'request_failed');return data;}
    async function addBot(){const msg=document.getElementById('bot-msg');const token=document.getElementById('bot-token').value.trim();if(!token){msg.textContent='Pega el token del bot primero.';return;}msg.textContent='Verificando con Discord…';try{await api('/api/multibot','POST',{token});location.reload();}catch(e){msg.textContent=e.message==='invalid_bot_token'?'El token no es válido.':(e.message==='bot_already_added'?'Ese bot ya está agregado.':'No se pudo agregar el bot.');}}
    async function startBot(id){const msg=document.getElementById('msg-'+id);msg.textContent='Conectando con Discord…';try{await api('/api/multibot/'+id+'/start','POST');location.reload();}catch(e){msg.textContent='No se pudo encender: '+e.message;}}
    async function stopBot(id){const msg=document.getElementById('msg-'+id);msg.textContent='Desconectando…';try{await api('/api/multibot/'+id+'/stop','POST');location.reload();}catch(e){msg.textContent='No se pudo apagar: '+e.message;}}
    async function removeBot(id){if(!confirm('¿Eliminar esta instancia de tu cuenta?'))return;try{await api('/api/multibot/'+id,'DELETE');location.reload();}catch(e){alert('No se pudo eliminar: '+e.message);}}
  </script>`;
  return appShell({ title: 'Mis bots', user, active: 'multibot', body });
}