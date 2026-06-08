$html = Get-Content 'index.html' -Raw -Encoding UTF8

$html = $html.Replace("Ã­", "í")
$html = $html.Replace("Ã³", "ó")
$html = $html.Replace("Â¡", "¡")
$html = $html.Replace("Â¿", "¿")
$html = $html.Replace("Ã±", "ñ")
$html = $html.Replace("ðŸ¤–", "🤖")
$html = $html.Replace("ðŸ’¬", "💬")
$html = $html.Replace("ðŸŒ±", "🌱")
$html = $html.Replace("âž•", "➕")
$html = $html.Replace("â­ ", "⭐")
$html = $html.Replace("Ã©", "é")
$html = $html.Replace("Ã¡", "á")
$html = $html.Replace("Ãº", "ú")

$html = $html.Replace("Solo pedidos · Santiago · Despacho propio", "Solo pedidos · Santiago y Pucón · Despacho propio")
$html = $html.Replace("Santiago · Chile", "Santiago y Pucón · Chile")
$html = $html.Replace("Todo Santiago con tarifas fijas", "Todo Santiago y Pucón con tarifas fijas")
$html = $html.Replace("Ubicación</div><div class=`"ccp`">Santiago, Chile", "Ubicación</div><div class=`"ccp`">Santiago y Pucón, Chile")

$oldHist = @"
<p>La Manito Del Vegano nació de una convicción profunda: que la alimentación plant based puede ser deliciosa, accesible y llena de amor. Desde nuestra cocina en Santiago, elaboramos cada producto con ingredientes 100% vegetales.</p>
    <p>Empezamos con una receta de empanadas y hoy tenemos un catálogo completo que incluye nuestro producto más especial: el manjar de semilla de cáñamo — el único en Chile.</p>
"@

$newHist = @"
<p><strong>La Manito Del Vegano</strong> nació de una convicción profunda: que la alimentación <em>plant based</em> puede ser deliciosa, accesible y llena de amor. Todo comenzó en nuestra cocina, buscando alternativas éticas que no sacrificaran el sabor de la comida tradicional chilena.</p>
    <p>Hoy, con orgullo operamos en <strong>Santiago y Pucón</strong>, llevando nuestros productos artesanales a cientos de familias. Empezamos con una receta de empanadas de pino de soya y hoy tenemos un catálogo completo que incluye nuestro producto más especial: el <strong>manjar de semilla de cáñamo</strong> — el único en Chile, creado por nosotros con un proceso único de fermentación y amor.</p>
    <p>Creemos firmemente en que cada decisión que tomamos al comer puede cambiar el mundo. ¡Gracias por ser parte de este hermoso camino! 🌱</p>
"@

$html = $html.Replace($oldHist, $newHist)

[IO.File]::WriteAllText((Join-Path (Get-Location) 'index.html'), $html, [System.Text.Encoding]::UTF8)

# FIX APP.JS
$js = Get-Content 'app.js' -Raw -Encoding UTF8

$idx = $js.IndexOf('function renderAdminTab(tab) {')
if ($idx -gt -1) {
    $js = $js.Substring(0, $idx)
}

$newJs = @"
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
      h += '<td style="font-weight:600;color:var(--v2)">$$'+p.precio.toLocaleString('es-CL')+'</td>';
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
    h += '<div><label class="flbl">Precio ($$)</label><input class="finp" id="nzpre" type="number" value="0" min="0" step="500"></div>';
    h += '<button class="btn-add" onclick="agregarZona()">Guardar</button></div></div>';
    
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Nombre</th><th>Comunas</th><th>Precio ($$)</th><th>Acciones</th></tr></thead><tbody>';
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
// ADMIN ACCIONES
// ============================================================
function abrirModalProd(id) {
  editandoId = id;
  if (id===null) {
    document.getElementById('modaltit').textContent = '➕ Nuevo Producto';
    document.getElementById('fnombre').value='';
    document.getElementById('fdesc').value='';
    document.getElementById('fprecio').value='';
    document.getElementById('fprecioant').value='';
    document.getElementById('fcat').value='empanadas';
    document.getElementById('femoji').value='🥟';
    document.getElementById('fetiqueta').value='';
    document.getElementById('fcolor').value='#F0FFF4';
    document.getElementById('fimagen').value='';
  } else {
    var p = productos.find(function(x){return x.id === id;});
    if (!p) return;
    document.getElementById('modaltit').textContent = '✏️ Editar Producto';
    document.getElementById('fnombre').value=p.nombre;
    document.getElementById('fdesc').value=p.descripcion;
    document.getElementById('fprecio').value=p.precio;
    document.getElementById('fprecioant').value=p.precio_anterior||'';
    document.getElementById('fcat').value=p.categoria;
    document.getElementById('femoji').value=p.emoji;
    document.getElementById('fetiqueta').value=p.etiqueta||'';
    document.getElementById('fcolor').value=p.color_fondo;
    document.getElementById('fimagen').value=p.imagen_url||'';
  }
  document.getElementById('modalov').classList.add('open');
}

function guardarProd() {
  var nombre = document.getElementById('fnombre').value.trim();
  var precio = parseInt(document.getElementById('fprecio').value);
  if (!nombre||!precio) { showToast('⚠️ Nombre y precio son obligatorios'); return; }
  var etiqueta = document.getElementById('fetiqueta').value;
  var etiqueta_label = etiqueta==='nuevo'?'Nuevo':etiqueta==='oferta'?'Oferta':etiqueta==='estrella'?'⭐ Único':null;
  var data = {
    nombre:nombre, descripcion:document.getElementById('fdesc').value,
    precio:precio, precio_anterior:parseInt(document.getElementById('fprecioant').value)||null,
    categoria:document.getElementById('fcat').value, emoji:document.getElementById('femoji').value||'🌿',
    etiqueta:etiqueta||null, etiqueta_label:etiqueta_label,
    color_fondo:document.getElementById('fcolor').value||'#F0FFF4',
    imagen_url:document.getElementById('fimagen').value||null
  };

  if (!db || firebaseConfig.apiKey === "TU_API_KEY") {
    showToast('⚠️ Debes configurar Firebase primero para guardar'); return;
  }

  if (editandoId===null) {
    data.destacado = false;
    db.collection("productos").add(data).then(function() { showToast('✅ Producto agregado'); });
  } else {
    var p = productos.find(function(x){return x.id === editandoId;});
    if(p) data.destacado = p.destacado;
    db.collection("productos").doc(editandoId).update(data).then(function() { showToast('✅ Producto actualizado'); });
  }
  document.getElementById('modalov').classList.remove('open');
}

function eliminarProd(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") { showToast('⚠️ Configura Firebase primero'); return; }
  db.collection("productos").doc(id).delete().then(function() { showToast('🗑 Producto eliminado'); });
}

function toggleDestacado(id) {
  var p = productos.find(function(x){return x.id === id;});
  if (!p) return;
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") { showToast('⚠️ Configura Firebase primero'); return; }
  db.collection("productos").doc(id).update({destacado: !p.destacado}).then(function() { showToast('⭐ Destacado actualizado'); });
}

function guardarZona(id) {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") { showToast('⚠️ Configura Firebase primero'); return; }
  var nom = document.getElementById('znom_'+id).value;
  var com = document.getElementById('zcom_'+id).value;
  var pre = parseInt(document.getElementById('zpre_'+id).value)||0;
  db.collection("zonas").doc(id).update({nombre:nom, comunas:com, precio:pre}).then(function() { showToast('✅ Zona guardada'); });
}

function agregarZona() {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") { showToast('⚠️ Configura Firebase primero'); return; }
  var nom = document.getElementById('nznom').value.trim();
  var com = document.getElementById('nzcom').value.trim();
  var pre = parseInt(document.getElementById('nzpre').value)||0;
  if (!nom) { showToast('⚠️ Ingresa el nombre de la zona'); return; }
  db.collection("zonas").add({nombre:nom, comunas:com, precio:pre}).then(function() {
    document.getElementById('nznom').value='';
    document.getElementById('nzcom').value='';
    document.getElementById('nzpre').value='0';
    showToast('✅ Zona agregada');
  });
}

function eliminarZona(id) {
  if (!confirm('¿Eliminar esta zona?')) return;
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") { showToast('⚠️ Configura Firebase primero'); return; }
  db.collection("zonas").doc(id).delete().then(function() { showToast('🗑 Zona eliminada'); });
}

function cerrarModal(e) { if(e.target.id==='modalov') document.getElementById('modalov').classList.remove('open'); }

// ============================================================
// HELPERS
// ============================================================
function showConf(ic,tit,msg) {
  document.getElementById('cfic').textContent=ic;
  document.getElementById('cftit').textContent=tit;
  document.getElementById('cfmsg').textContent=msg;
  document.getElementById('confov').classList.add('open');
}
function cerrarConf() { document.getElementById('confov').classList.remove('open'); }
function tfaq(el) { var a=el.nextElementSibling; a.classList.toggle('open'); el.querySelector('span').textContent=a.classList.contains('open')?'▲':'▼'; }
function showToast(msg) { var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},2400); }

// INIT
handleHash();
loadData();

// ============================================================
// CHATBOT WIDGET E INTELIGENCIA SIMULADA
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

  // LÓGICA DE SIMULACIÓN DE VENTAS Y PERSUASIÓN
  setTimeout(function() {
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    
    var m = msg.toLowerCase();
    var respuesta = '¡Hola! Qué gusto saludarte. Soy el asistente de La Manito Del Vegano. 🌱 ¿Te puedo tentar con alguna de nuestras deliciosas empanadas o con nuestro increíble manjar de cáñamo?';
    
    if(m.includes('horario') || m.includes('hora') || m.includes('abierto')) {
      respuesta = '¡Trabajamos bajo pedido! ⏰ Puedes encargar cuando quieras y despachamos con al menos 3 días de anticipación. ¡Así aseguramos que todo esté ultra fresco y recién horneado para ti! ¿Qué te gustaría pedir?';
    } 
    else if(m.includes('donde') || m.includes('ubicacion') || m.includes('direccion') || m.includes('santiago') || m.includes('pucon') || m.includes('pucón')) {
      respuesta = '📍 ¡Estamos en Santiago y en Pucón! Tenemos despacho propio en ambas zonas para cuidar que tus productos lleguen perfectos. ¡Aprovecha que estamos tomando pedidos esta semana!';
    }
    else if(m.includes('precio') || m.includes('valor') || m.includes('cuanto')) {
      respuesta = '¡Nuestros precios son súper accesibles para la calidad artesanal que entregamos! 🥟 Puedes ver todos los valores navegando en la página. Te recomiendo muchísimo probar el pack en Oferta, ¡es lo que más llevan nuestros clientes!';
    }
    else if(m.includes('manjar') || m.includes('cañamo') || m.includes('cáñamo')) {
      respuesta = '🍯 ¡Ay, nuestro manjar de semilla de cáñamo! Es único en Chile, literalmente no vas a encontrar otro igual. Es súper cremoso, nutritivo y perfecto para el pan o postres. ¡Agrégalo a tu carrito antes de que se agote el stock de esta semana!';
    }
    else if(m.includes('empanada')) {
      respuesta = '🥟 ¡Nuestras empanadas de pino de soya tienen una masa crocante espectacular! Además, el pino está sazonado con la receta secreta de la abuela, pero 100% libre de crueldad. ¡Te prometo que te van a encantar!';
    }
    else if(m.includes('gracias')) {
      respuesta = '¡Gracias a ti por apoyar el movimiento plant based! 💚 Si tienes otra duda o quieres hacer tu pedido directo al carrito, aquí estaré.';
    }

    bdiv.innerHTML = respuesta;
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
  }, 1200);

  // === AQUÍ SE CONECTARÁ CON n8n A FUTURO ===
  // Para usar tu propia IA (Claude/Hermes), borra la lógica de arriba y descomenta este bloque:
  /*
  var webhook_url = 'https://tu-url-de-n8n.com/webhook/chat'; 
  fetch(webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: msg })
  }).then(res => res.json()).then(data => {
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    bdiv.textContent = data.respuesta;
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
  }).catch(err => {
    body.removeChild(tdiv);
    console.error("Error en el chat:", err);
  });
  */
}
"@

$js = $js + $newJs

[IO.File]::WriteAllText((Join-Path (Get-Location) 'app.js'), $js, [System.Text.Encoding]::UTF8)

Write-Host "Fix completed successfully."
