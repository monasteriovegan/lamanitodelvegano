const fs = require('fs');
const path = require('path');

// 1. UPDATE INDEX.HTML
let html = fs.readFileSync('index.html', 'utf8');

// Update CSS for Admin
const oldAdminCSS = `/* ADMIN DASHBOARD V2 */
.admin-dash { display:flex; height:100vh; background:#F8FAFC; color:#1E293B; }
.admin-side { width:260px; background:var(--v1); color:white; padding:24px 0; display:flex; flex-direction:column; }
.admin-slogo { font-family:Fraunces,serif; font-size:20px; font-weight:700; padding:0 24px 32px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:24px; }
.admin-smenu { flex:1; }
.atab { padding:14px 24px; cursor:pointer; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:12px; transition:0.2s; font-weight:500; font-size:15px; }
.atab:hover { background:rgba(255,255,255,0.05); color:white; }
.atab.on { background:rgba(255,255,255,0.1); color:white; border-right:3px solid var(--wa); }
.admin-main { flex:1; padding:32px 48px; overflow-y:auto; }
.admin-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; }
.admin-tit { font-family:Fraunces,serif; font-size:28px; font-weight:700; color:var(--texto); }
.admin-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:32px; }
.kpi-card { background:white; padding:24px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.03); border:1px solid #F1F5F9; }
.kpi-val { font-size:32px; font-weight:700; color:var(--v2); font-family:Fraunces,serif; }
.kpi-lbl { font-size:14px; color:#64748B; margin-top:4px; font-weight:500; }
.admin-card { background:white; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.03); border:1px solid #F1F5F9; padding:24px; overflow:hidden; margin-bottom:24px; }
.atbl { width:100%; border-collapse:collapse; }
.atbl th { text-align:left; padding:16px; font-size:13px; color:#64748B; font-weight:600; text-transform:uppercase; border-bottom:1px solid #E2E8F0; }
.atbl td { padding:16px; font-size:14px; border-bottom:1px solid #F1F5F9; vertical-align:middle; }
.atbl tr:last-child td { border-bottom:none; }
.atbl-emoji { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
.btn-sm { padding:6px 12px; font-size:13px; font-weight:600; border-radius:6px; cursor:pointer; border:none; display:inline-flex; align-items:center; gap:6px; transition:0.2s; }
.btn-pri { background:var(--v2); color:white; }
.btn-pri:hover { background:var(--v1); }
.btn-sec { background:#F1F5F9; color:#475569; }
.btn-sec:hover { background:#E2E8F0; }
.btn-dan { background:#FEF2F2; color:#EF4444; }
.btn-dan:hover { background:#FEE2E2; }
.btn-add { background:var(--v3); color:white; padding:10px 20px; font-weight:600; border-radius:8px; font-size:14px; cursor:pointer; border:none; display:inline-flex; align-items:center; gap:8px; transition:0.2s; box-shadow:0 4px 12px rgba(64,145,108,0.2); }
.btn-add:hover { background:var(--v2); transform:translateY(-1px); }`;

const newAdminCSS = `/* SHOPIFY ADMIN DASHBOARD */
.admin-dash { display:flex; height:100vh; background:#f4f6f8; color:#202223; font-family:-apple-system,BlinkMacSystemFont,"San Francisco","Segoe UI",Roboto,"Helvetica Neue",sans-serif; }
.admin-side { width:240px; background:#ebebeb; color:#202223; padding:16px 8px; display:flex; flex-direction:column; border-right:1px solid #e1e3e5; }
.admin-slogo { font-weight:700; font-size:18px; padding:12px 16px; margin-bottom:16px; color:#202223; display:flex; align-items:center; gap:8px; }
.admin-smenu { flex:1; }
.atab { padding:8px 12px; margin:4px 0; cursor:pointer; color:#434648; display:flex; align-items:center; gap:12px; transition:0.1s; font-weight:500; font-size:14px; border-radius:6px; }
.atab:hover { background:#e1e3e5; color:#202223; }
.atab.on { background:#f4f6f8; color:#202223; font-weight:600; }
.admin-main { flex:1; padding:32px 48px; overflow-y:auto; }
.admin-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.admin-tit { font-size:24px; font-weight:700; color:#202223; }
.admin-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; }
.kpi-card { background:white; padding:16px 20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #e1e3e5; }
.kpi-val { font-size:28px; font-weight:600; color:#202223; margin-top:8px; }
.kpi-lbl { font-size:13px; color:#6d7175; font-weight:500; }
.admin-card { background:white; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #e1e3e5; overflow:hidden; margin-bottom:24px; }
.admin-card-pad { padding:20px; }
.atbl { width:100%; border-collapse:collapse; }
.atbl th { text-align:left; padding:12px 16px; font-size:12px; color:#6d7175; font-weight:600; border-bottom:1px solid #e1e3e5; background:#f9fafb; }
.atbl td { padding:12px 16px; font-size:14px; border-bottom:1px solid #e1e3e5; vertical-align:middle; color:#202223; }
.atbl tr:last-child td { border-bottom:none; }
.atbl tr:hover { background:#fafbfb; }
.atbl-emoji { width:36px; height:36px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:18px; border:1px solid #e1e3e5; }
.btn-sm { padding:5px 10px; font-size:13px; font-weight:500; border-radius:4px; cursor:pointer; border:1px solid #c9cccf; display:inline-flex; align-items:center; gap:6px; transition:0.1s; background:white; color:#202223; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
.btn-sm:hover { background:#f4f6f8; }
.btn-pri { background:#008060; color:white; border:1px solid #008060; }
.btn-pri:hover { background:#006e52; color:white; }
.btn-dan { background:white; color:#d82c0d; }
.btn-dan:hover { background:#fbeae5; border-color:#d82c0d; }
.btn-add { background:#008060; color:white; padding:8px 16px; font-weight:600; border-radius:4px; font-size:13px; cursor:pointer; border:1px solid #008060; display:inline-flex; align-items:center; gap:8px; transition:0.1s; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
.btn-add:hover { background:#006e52; }
.star-icon { cursor:pointer; opacity:0.3; transition:0.2s; font-size:18px; }
.star-icon:hover { opacity:0.7; transform:scale(1.1); }
.star-icon.active { opacity:1; color:#ffb800; }
.status-pill { display:inline-flex; align-items:center; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:500; }
.pill-cat { background:#e4f0f6; color:#005e8a; }
.pill-oferta { background:#ffea8a; color:#8a6116; }
.pill-nuevo { background:#aee9d1; color:#005c3b; }`;

html = html.replace(oldAdminCSS, newAdminCSS);

// Update Nosotros Text
const oldNosotros = `<div class="hist">
    <h2>¿Quiénes somos?</h2>
    <p><strong>La Manito Del Vegano</strong> nació de una convicción profunda: que la alimentación <em>plant based</em> puede ser deliciosa, accesible y llena de amor. Todo comenzó en nuestra cocina, buscando alternativas éticas que no sacrificaran el sabor de la comida tradicional chilena.</p>
    <p>Hoy, con orgullo operamos en <strong>Santiago y Pucón</strong>, llevando nuestros productos artesanales a cientos de familias. Empezamos con una receta de empanadas de pino de soya y hoy tenemos un catálogo completo que incluye nuestro producto más especial: el <strong>manjar de semilla de cáñamo</strong> — el único en Chile, creado por nosotros con un proceso único de fermentación y amor.</p>
    <p>Creemos firmemente en que cada decisión que tomamos al comer puede cambiar el mundo. ¡Gracias por ser parte de este hermoso camino! 🌱</p>
  </div>`;

const newNosotros = `<div class="hist">
    <h2>Nuestra Misión y Legado</h2>
    <p>Hubo un tiempo donde se creía que ser vegano significaba renunciar al sabor de nuestras tradiciones. <strong>La Manito Del Vegano</strong> nació para desafiar esa creencia. Todo comenzó en una pequeña cocina, con las manos manchadas de harina y el corazón puesto en crear una alternativa ética que mantuviera la esencia de la comida casera chilena.</p>
    <p>Nuestra mayor victoria llegó después de meses de pruebas y errores: logramos crear el <strong>primer manjar de semilla de cáñamo de todo Chile</strong>. Una receta 100% libre de crueldad, cremosísima y nutritiva que hoy se ha convertido en nuestro sello.</p>
    <p>Hoy, con mucho orgullo y esfuerzo, nuestro taller despacha cientos de pedidos en <strong>Santiago y Pucón</strong>. Creemos que la revolución comienza en nuestro plato, y cada empanada que elaboramos es un acto de amor hacia los animales, hacia nuestro planeta y hacia ti. 🌱</p>
  </div>`;

if(html.includes(oldNosotros)) {
    html = html.replace(oldNosotros, newNosotros);
} else {
    // try to find just the section
    const startIdx = html.indexOf('<div class="hist">');
    if (startIdx !== -1) {
        const endIdx = html.indexOf('</div>', startIdx) + 6;
        html = html.substring(0, startIdx) + newNosotros + html.substring(endIdx);
    }
}

fs.writeFileSync('index.html', html, 'utf8');

// 2. UPDATE APP.JS
let js = fs.readFileSync('app.js', 'utf8');

const idx = js.indexOf('function renderAdminTab(tab) {');
if (idx !== -1) {
    js = js.substring(0, idx);
}

const newJs = `function renderAdminTab(tab) {
  var c = document.getElementById('acont');
  if (tab==='productos') {
    var h = '<div class="admin-head"><div class="admin-tit">Productos</div><button class="btn-add" onclick="abrirModalProd(null)">Agregar producto</button></div>';
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Producto</th><th>Categoría</th><th>Estado</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>';
    for (var i=0;i<productos.length;i++) {
      var p = productos[i];
      h += '<tr>';
      h += '<td><div style="display:flex;align-items:center;gap:12px">';
      h += '<div class="atbl-emoji" style="background:'+p.color_fondo+'">';
      if(p.imagen_url) h += '<img src="'+p.imagen_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:4px">';
      else h += p.emoji;
      h += '</div><div><div style="font-weight:600">'+p.nombre+'</div>';
      h += '</div></div></td>';
      h += '<td><span class="status-pill pill-cat">'+p.categoria+'</span></td>';
      
      var lbl = '';
      if(p.etiqueta==='oferta') lbl = '<span class="status-pill pill-oferta">En Oferta</span>';
      else if(p.etiqueta==='nuevo') lbl = '<span class="status-pill pill-nuevo">Nuevo</span>';
      else lbl = '<span style="font-size:12px;color:#6d7175">-</span>';
      h += '<td>'+lbl+'</td>';
      
      h += '<td>$'+p.precio.toLocaleString('es-CL')+'</td>';
      h += '<td><div style="display:flex;gap:8px;align-items:center">';
      h += '<div class="star-icon '+(p.destacado?'active':'')+'" onclick="toggleDestacado(\\''+p.id+'\\')" title="Destacar">⭐</div>';
      h += '<button class="btn-sm" onclick="abrirModalProd(\\''+p.id+'\\')">Editar</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarProd(\\''+p.id+'\\')" title="Eliminar">🗑</button>';
      h += '</div></td></tr>';
    }
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } else if (tab==='zonas') {
    var h = '<div class="admin-head"><div class="admin-tit">Zonas de Envío</div></div>';
    h += '<div class="admin-card admin-card-pad" style="background:#fafbfb;border-style:dashed">';
    h += '<div style="font-weight:600;font-size:14px;margin-bottom:12px;">Agregar nueva zona</div><div style="display:flex;gap:12px;align-items:flex-end">';
    h += '<div style="flex:1"><label class="flbl">Nombre</label><input class="finp" id="nznom" placeholder="Ej: Zona Sur"></div>';
    h += '<div style="flex:2"><label class="flbl">Comunas</label><input class="finp" id="nzcom" placeholder="Ej: La Florida, Puente Alto, San Bernardo"></div>';
    h += '<div><label class="flbl">Precio ($)</label><input class="finp" id="nzpre" type="number" value="0" min="0" step="500"></div>';
    h += '<button class="btn-add" style="margin-bottom:4px" onclick="agregarZona()">Guardar</button></div></div>';
    
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Zona</th><th>Comunas</th><th>Tarifa ($)</th><th>Acciones</th></tr></thead><tbody>';
    for (var i=0;i<zonas.length;i++) {
      var z = zonas[i];
      h += '<tr>';
      h += '<td><input class="finp" style="margin:0" id="znom_'+z.id+'" value="'+z.nombre+'"></td>';
      h += '<td><input class="finp" style="margin:0" id="zcom_'+z.id+'" value="'+z.comunas+'"></td>';
      h += '<td><input class="finp" style="margin:0;width:100px" id="zpre_'+z.id+'" type="number" value="'+z.precio+'" min="0" step="500"></td>';
      h += '<td><div style="display:flex;gap:8px">';
      h += '<button class="btn-sm btn-pri" onclick="guardarZona(\\''+z.id+'\\')">Guardar</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarZona(\\''+z.id+'\\')">Borrar</button>';
      h += '</div></td></tr>';
    }
    h += '</tbody></table></div>';
    c.innerHTML = h;
  } else if (tab==='stats') {
    var h = '<div class="admin-head"><div class="admin-tit">Resumen General</div></div>';
    h += '<div class="admin-kpis">';
    h += '<div class="kpi-card"><div class="kpi-lbl">Total de Productos</div><div class="kpi-val">'+productos.length+'</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Zonas de Envío</div><div class="kpi-val">'+zonas.length+'</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Destacados</div><div class="kpi-val">'+productos.filter(function(p){return p.destacado;}).length+'</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">En Oferta</div><div class="kpi-val">'+productos.filter(function(p){return p.etiqueta==='oferta';}).length+'</div></div>';
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
    document.getElementById('modaltit').textContent = 'Nuevo Producto';
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
    document.getElementById('modaltit').textContent = 'Editar Producto';
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
// CHATBOT WIDGET: IA REAL VÍA VERCEL API
// ============================================================
function toggleChat() {
  document.getElementById('chatWin').classList.toggle('open');
}

function sendChat(forceMsg) {
  var input = document.getElementById('chatInp');
  var msg = forceMsg || input.value.trim();
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

  // Llama a nuestra API Serverless en Vercel
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: msg })
  }).then(function(res){ return res.json(); }).then(function(data){
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    bdiv.textContent = data.respuesta;
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
  }).catch(function(err){
    body.removeChild(tdiv);
    var bdiv = document.createElement('div');
    bdiv.className = 'cmsg bot';
    bdiv.style.color = 'var(--rojo)';
    bdiv.textContent = '❌ Error de red. Asegúrate de configurar la API Key de Gemini en Vercel.';
    body.appendChild(bdiv);
    body.scrollTop = body.scrollHeight;
    console.error("Error en el chat:", err);
  });
}
`;

js += newJs;
fs.writeFileSync('app.js', js, 'utf8');

// 3. CREATE API/CHAT.JS
const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)){
    fs.mkdirSync(apiDir);
}

const chatApiCode = `export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mensaje } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      respuesta: "⚠️ Para que yo (el Asistente Virtual) pueda pensar, mi creador necesita agregar la variable GEMINI_API_KEY en los ajustes de Vercel."
    });
  }

  try {
    const prompt = \`Eres el asistente virtual experto en ventas de "La Manito Del Vegano", una tienda de comida 100% plant-based y artesanal en Santiago y Pucón, Chile.
Tu objetivo es ser amable, cercano y muy persuasivo para vender.
- El producto estrella es el Manjar de Semilla de Cáñamo (único en Chile).
- Tienen empanadas veganas de pino, pies de arándanos, y packs en oferta.
- Se pide con 3 días de anticipación y hay despacho propio.
Responde de forma MUY concisa y directa (máximo 2-3 líneas). Usa un tono súper entusiasta y amigable. 
El cliente dice: "\${mensaje}"\`;

    const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
        throw new Error('Error en API de Gemini');
    }

    const data = await response.json();
    const texto = data.candidates[0].content.parts[0].text;

    res.status(200).json({ respuesta: texto.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error conectando con la IA', respuesta: 'Ups, tuve un pequeño mareo cibernético. ¿Puedes repetir eso?' });
  }
}
`;

fs.writeFileSync(path.join(apiDir, 'chat.js'), chatApiCode, 'utf8');

console.log("Refactor V2 completed successfully.");
