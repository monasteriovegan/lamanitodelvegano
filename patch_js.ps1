$c = Get-Content 'app.js' -Raw -Encoding UTF8

$newRender = @"
function renderAdminTab(tab) {
  var c = document.getElementById('acont');
  if (tab==='productos') {
    var h = '<div class="admin-head"><div class="admin-tit">📦 Inventario & Ofertas</div><button class="btn-add" onclick="abrirModalProd(null)">➕ Nuevo Producto</button></div>';
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>';
    for (var i=0;i<productos.length;i++) {
      var p = productos[i];
      h += '<tr>';
      h += '<td><div style="display:flex;align-items:center;gap:16px">';
      h += '<div class="atbl-emoji" style="background:'+p.color_fondo+'">';
      if(p.imagen_url) h += '<img src="'+p.imagen_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';
      else h += p.emoji;
      h += '</div><div><div style="font-weight:600;color:var(--texto)">'+p.nombre+'</div>';
      if(p.destacado) h += '<span style="font-size:11px;background:#FEF3C7;color:#D97706;padding:2px 8px;border-radius:100px;font-weight:600;margin-top:4px;display:inline-block">⭐ Destacado</span>';
      h += '</div></div></td>';
      h += '<td><span style="background:#F1F5F9;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500">'+p.categoria+'</span></td>';
      h += '<td style="font-weight:600;color:var(--v2)">$'+p.precio.toLocaleString('es-CL')+'</td>';
      h += '<td><div style="display:flex;gap:8px">';
      h += '<button class="btn-sm btn-pri" onclick="abrirModalProd(\''+p.id+'\')">✏️ Editar</button>';
      h += '<button class="btn-sm btn-sec" onclick="toggleDestacado(\''+p.id+'\')">'+(p.destacado?'Quitar Destacado':'⭐ Destacar')+'</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarProd(\''+p.id+'\')">🗑</button>';
      h += '</div></td></tr>';
    }
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } else if (tab==='zonas') {
    var h = '<div class="admin-head"><div class="admin-tit">🚚 Zonas de Envío</div></div>';
    h += '<div class="admin-card" style="background:#F8FFF9;border:2px dashed var(--v3)"><div style="font-weight:700;font-size:16px;margin-bottom:16px;color:var(--v2)">➕ Agregar nueva zona</div><div style="display:flex;gap:12px;align-items:flex-end">';
    h += '<div style="flex:1"><label class="flbl">Nombre zona</label><input class="finp" id="nznom" placeholder="Ej: Zona Sur"></div>';
    h += '<div style="flex:2"><label class="flbl">Comunas</label><input class="finp" id="nzcom" placeholder="Ej: La Florida, Puente Alto, San Bernardo"></div>';
    h += '<div><label class="flbl">Precio ($)</label><input class="finp" id="nzpre" type="number" value="0" min="0" step="500"></div>';
    h += '<button class="btn-add" onclick="agregarZona()">Guardar</button></div></div>';
    
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Nombre</th><th>Comunas</th><th>Precio ($)</th><th>Acciones</th></tr></thead><tbody>';
    for (var i=0;i<zonas.length;i++) {
      var z = zonas[i];
      h += '<tr>';
      h += '<td><input class="finp" style="margin:0" id="znom_'+z.id+'" value="'+z.nombre+'"></td>';
      h += '<td><input class="finp" style="margin:0" id="zcom_'+z.id+'" value="'+z.comunas+'"></td>';
      h += '<td><input class="finp" style="margin:0;width:100px" id="zpre_'+z.id+'" type="number" value="'+z.precio+'" min="0" step="500"></td>';
      h += '<td><div style="display:flex;gap:8px">';
      h += '<button class="btn-sm btn-pri" onclick="guardarZona(\''+z.id+'\')">💾</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarZona(\''+z.id+'\')">🗑</button>';
      h += '</div></td></tr>';
    }
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } else if (tab==='stats') {
    var h = '<div class="admin-head"><div class="admin-tit">📊 Estadísticas</div></div>';
    h += '<div class="admin-kpis">';
    h += '<div class="kpi-card"><div class="kpi-val">'+productos.length+'</div><div class="kpi-lbl">Total de Productos</div></div>';
    h += '<div class="kpi-card"><div class="kpi-val">'+zonas.length+'</div><div class="kpi-lbl">Zonas de Envío</div></div>';
    h += '<div class="kpi-card"><div class="kpi-val">'+productos.filter(function(p){return p.destacado;}).length+'</div><div class="kpi-lbl">Destacados</div></div>';
    h += '<div class="kpi-card"><div class="kpi-val">'+productos.filter(function(p){return p.etiqueta==='oferta';}).length+'</div><div class="kpi-lbl">En Oferta</div></div>';
    h += '</div>';
    c.innerHTML = h;
  }
}

// ============================================================
"@

$c = $c -replace '(?s)function renderAdminTab\(tab\) \{.*?\}[\r\n\s]*// ============================================================', $newRender

$newEnd = @"
// INIT
handleHash();
loadData();

// ============================================================
// CHATBOT WIDGET
// ============================================================
function toggleChat() {
  document.getElementById('chatWin').classList.toggle('open');
}

function sendChat() {
  var input = document.getElementById('chatInp');
  var msg = input.value.trim();
  if(!msg) return;
  input.value = '';
  
  var body = document.getElementById('chatBody');
  var udiv = document.createElement('div');
  udiv.className = 'cmsg user';
  udiv.textContent = msg;
  body.appendChild(udiv);
  body.scrollTop = body.scrollHeight;
  
  var tdiv = document.createElement('div');
  tdiv.className = 'cmsg bot';
  tdiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  body.appendChild(tdiv);
  body.scrollTop = body.scrollHeight;

  // === AQUÍ SE CONECTARÁ CON n8n ===
  // URL de ejemplo. Reemplaza esto con la URL de tu Webhook de n8n.
  var webhook_url = 'https://tu-url-de-n8n.com/webhook/chat'; 
  
  setTimeout(function() {
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    bdiv.innerHTML = '¡Hola! Aún no estoy conectado a tu n8n, pero cuando lo esté, procesaré tu mensaje: <strong>"' + msg + '"</strong>';
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
  }, 1500);

  /* EJEMPLO DE CONEXIÓN REAL (Descomenta cuando tengas la URL de n8n):
  fetch(webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: msg })
  }).then(res => res.json()).then(data => {
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    bdiv.textContent = data.respuesta; // Cambia "respuesta" por el campo que devuelva n8n
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
  }).catch(err => {
    body.removeChild(tdiv);
    console.error("Error en el chat:", err);
  });
  */
}
"@

$c = $c -replace '(?s)// INIT.*$', $newEnd

Set-Content 'app.js' -Value $c -Encoding UTF8
