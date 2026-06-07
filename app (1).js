var DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var ADMIN_PASS = 'manito2024';
var editandoId = null;

// === CONFIGURACIÓN DE SUPABASE ===
var SUPABASE_URL = 'https://adrydqvahzqjbgtcvlay.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcnlkcXZhaHpxamJndGN2bGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjExMDAsImV4cCI6MjA5NTkzNzEwMH0.mjpGjVN90sHJAahn3NTslo3wLzW0ttQlOrwBQ62BZko';
var SUPABASE_BUCKET = 'productos';

var supabaseClient = null;
var supabaseStorageBucket = SUPABASE_BUCKET;
var db = null; // Se inicializa abajo vía Supabase

try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    db = supabaseClient; // db apunta a supabase para las operaciones de datos
  }
} catch(e) { console.log("Error iniciando Supabase:", e); }

var productos = [];
var zonas = [];

function loadData() {
  if (!supabaseClient) {
    // Datos de prueba si Supabase no está disponible
    productos = [
      {id:'t1',nombre:'Empanada Pino Soya',descripcion:'Pino de soya',precio:2500,categoria:'empanadas',emoji:'🥟',color_fondo:'#F0FFF4',destacado:false},
      {id:'t2',nombre:'Pie de Arándanos',descripcion:'Masa crocante',precio:18900,precio_anterior:22000,categoria:'pies',emoji:'🫐',color_fondo:'#F5F0FF',etiqueta:'oferta',etiqueta_label:'Oferta',destacado:true}
    ];
    zonas = [
      {id:'z1',nombre:'Centro',comunas:'Santiago',precio:2000},
      {id:'z2',nombre:'Retiro',comunas:'Coordinar por WhatsApp',precio:0}
    ];
    renderGrid(); renderDestacados(); renderZonas();
    return;
  }
  
  supabaseClient.from('productos').select('*')
    .then(function(result) {
      if (result.error) { console.error('Error productos:', result.error); return; }
      productos = result.data || [];
      renderGrid(); renderDestacados();
      var tab = document.querySelector('.atab.on');
      if (tab && (tab.textContent.includes('Productos') || tab.textContent.includes('Destacados') || tab.textContent.includes('Stats'))) {
        renderAdminTab(tab.getAttribute('onclick').split("'")[1]);
      }
    });

  supabaseClient.from('zonas').select('*')
    .then(function(result) {
      if (result.error) { console.error('Error zonas:', result.error); return; }
      zonas = result.data || [];
      renderZonas();
      var tab = document.querySelector('.atab.on');
      if (tab && (tab.textContent.includes('Envíos') || tab.textContent.includes('Stats'))) {
        renderAdminTab(tab.getAttribute('onclick').split("'")[1]);
      }
    });
    zonas = z;
    renderZonas();
    var tab = document.querySelector('.atab.on');
    if (tab && (tab.textContent.includes('Envíos') || tab.textContent.includes('Stats'))) {
      renderAdminTab(tab.getAttribute('onclick').split("'")[1]);
    }
  });
}

var carrito = {};
var zonaSel = null;
var fechaSel = null;
var catActual = 'todos';
var nombreG = '';
var dirG = '';

// ============================================================
// NAVEGACIÓN
// ============================================================
function handleHash() {
  var hash = window.location.hash.substring(1) || 'home';
  var pgs = document.querySelectorAll('.pg');
  for (var i = 0; i < pgs.length; i++) pgs[i].classList.remove('on');
  var pg = document.getElementById('pg-' + hash);
  if (pg) pg.classList.add('on');
  else document.getElementById('pg-home').classList.add('on');
  var nms = document.querySelectorAll('.nm');
  for (var i = 0; i < nms.length; i++) nms[i].classList.remove('on');
  var idx = {home:0,nosotros:1,blog:2,contacto:3};
  if (nms[idx[hash]] !== undefined) nms[idx[hash]].classList.add('on');
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', handleHash);

function goPage(id) {
  window.location.hash = id;
}

// ============================================================
// DESTACADOS
// ============================================================
function renderDestacados() {
  var dest = productos.filter(function(p){ return p.destacado; });
  var sec = document.getElementById('dest-sec');
  var grid = document.getElementById('dest-grid');
  if (dest.length === 0) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  var h = '';
  for (var i = 0; i < dest.length; i++) {
    var p = dest[i];
    h += '<div class="dest-card">';
    h += '<div class="dest-img" style="background:' + p.color_fondo + '">';
    if (p.etiqueta === 'oferta') h += '<span class="dest-badge">OFERTA</span>';
    if (p.imagen_url) h += '<img src="' + p.imagen_url + '" onerror="this.style.display=\'none\'">';
    h += '<span class="dest-img-emoji">' + p.emoji + '</span>';
    h += '</div>';
    h += '<div class="dest-overlay">';
    h += '<div class="dest-name">' + p.nombre + '</div>';
    h += '<div class="dest-price">';
    if (p.precio_anterior) h += '<span style="text-decoration:line-through;opacity:0.7;margin-right:6px">$' + p.precio_anterior.toLocaleString('es-CL') + '</span>';
    h += '$' + p.precio.toLocaleString('es-CL') + '</div>';
    h += '<button class="dest-btn" onclick="addCart(\'' + p.id + '\')">🛒 Agregar al carrito</button>';
    h += '</div></div>';
  }
  grid.innerHTML = h;
}

// ============================================================
// ZONAS BANNER
// ============================================================
function renderZonas() {
  var z = zonas.slice(0,4);
  var h = '';
  for (var i = 0; i < z.length; i++) {
    h += '<div class="zitem"><div><div class="znom">' + z[i].nombre + '</div>';
    h += '<div class="zcom">' + z[i].comunas.split(',')[0] + '...</div></div>';
    h += z[i].precio === 0 ? '<span class="zgrat">Gratis</span>' : '<span class="zpre">$' + z[i].precio.toLocaleString('es-CL') + '</span>';
    h += '</div>';
  }
  var zbanner = document.getElementById('zbanner');
  if(zbanner) zbanner.innerHTML = h;
}

// ============================================================
// GRID PRODUCTOS
// ============================================================
function filtrar(cat, btn) {
  catActual = cat;
  var cats = document.querySelectorAll('.cat');
  for (var i = 0; i < cats.length; i++) cats[i].classList.remove('on');
  btn.classList.add('on');
  renderGrid();
}

function renderGrid() {
  var g = document.getElementById('pgrid');
  if(!g) return;
  var f = catActual === 'todos' ? productos : productos.filter(function(p){ return p.categoria === catActual; });
  if (f.length === 0) { g.innerHTML = '<p style="padding:20px;color:var(--muted);font-size:13px">No hay productos en esta categoría.</p>'; return; }
  var h = '';
  for (var i = 0; i < f.length; i++) {
    var p = f[i];
    var qty = carrito[p.id] ? carrito[p.id].qty : 0;
    var tc = p.etiqueta === 'nuevo' ? 'tn' : p.etiqueta === 'oferta' ? 'to' : 'te';
    h += '<div class="card"><div class="cimg" style="background:' + p.color_fondo + '">';
    if (p.etiqueta) h += '<span class="ctag ' + tc + '">' + p.etiqueta_label + '</span>';
    if (p.imagen_url) h += '<img src="' + p.imagen_url + '" onerror="this.style.display=\'none\'">';
    h += '<span class="cimg-e">' + p.emoji + '</span>';
    h += '</div><div class="cbody"><div class="cname">' + p.nombre + '</div>';
    h += '<div class="cdesc">' + p.descripcion + '</div>';
    h += '<div class="cfoot"><div>';
    if (p.precio_anterior) h += '<span class="cold">$' + p.precio_anterior.toLocaleString('es-CL') + '</span>';
    h += '<span class="cprice">$' + p.precio.toLocaleString('es-CL') + '</span></div>';
    if (qty > 0) {
      h += '<div class="qc"><button class="qb" onclick="chQty(\'' + p.id + '\',-1)">-</button><span class="qn">' + qty + '</span><button class="qb p" onclick="chQty(\'' + p.id + '\',1)">+</button></div>';
    } else {
      h += '<button class="badd" onclick="addCart(\'' + p.id + '\')">+</button>';
    }
    h += '</div></div></div>';
  }
  g.innerHTML = h;
}

function addCart(id) {
  var p = productos.find(function(x){return x.id === id;});
  if (!p) return;
  if (!carrito[id]) carrito[id] = {id:p.id,nombre:p.nombre,precio:p.precio,emoji:p.emoji,color_fondo:p.color_fondo,imagen_url:p.imagen_url,qty:0};
  carrito[id].qty++;
  updBdg(); renderGrid();
  showToast('✅ ' + p.nombre + ' agregado');
}

function chQty(id, d) {
  if (!carrito[id]) return;
  carrito[id].qty += d;
  if (carrito[id].qty <= 0) delete carrito[id];
  updBdg(); renderGrid();
  if (Object.keys(carrito).length === 0) cerrarCarrito();
  else renderCart();
}

function updBdg() {
  var t = 0;
  var keys = Object.keys(carrito);
  for (var i = 0; i < keys.length; i++) t += carrito[keys[i]].qty;
  var b = document.getElementById('bdg');
  if(!b) return;
  b.textContent = t;
  t === 0 ? b.classList.add('h') : b.classList.remove('h');
}

function subtotal() {
  var s = 0;
  var keys = Object.keys(carrito);
  for (var i = 0; i < keys.length; i++) s += carrito[keys[i]].qty * carrito[keys[i]].precio;
  return s;
}
function costoEnvio() { 
  if(!zonaSel) return 0;
  var z = zonas.find(function(x){return x.id === zonaSel;});
  return z ? z.precio : 0; 
}
function totalFinal() { return subtotal() + costoEnvio(); }

// ============================================================
// FECHAS
// ============================================================
function genFechas() {
  var res = [];
  var hoy = new Date();
  var diasOk = [1,2,3,4,5,6];
  for (var i = 1; res.length < 9; i++) {
    var d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    var ok = i >= 3 && diasOk.indexOf(d.getDay()) !== -1;
    res.push({fecha:d,ok:ok,dias:i});
    if (res.filter(function(x){return x.ok;}).length >= 6 && i >= 5) break;
  }
  return res;
}

// ============================================================
// CARRITO
// ============================================================
function abrirCarrito() { renderCart(); document.getElementById('cartov').classList.add('open'); }
function cerrarCarrito() { document.getElementById('cartov').classList.remove('open'); }
function cclick(e) { if (e.target.id === 'cartov') cerrarCarrito(); }

function renderCart() {
  var body = document.getElementById('cartbody');
  if(!body) return;
  var keys = Object.keys(carrito);
  if (keys.length === 0) { body.innerHTML = '<div class="cempty"><span>🛒</span>Tu carrito está vacío</div>'; return; }
  var fechas = genFechas();
  var h = '';
  for (var i = 0; i < keys.length; i++) {
    var item = carrito[keys[i]];
    h += '<div class="citem"><div class="ciem" style="background:' + item.color_fondo + '">';
    if (item.imagen_url) h += '<img src="' + item.imagen_url + '" onerror="this.style.display=\'none\'">';
    h += item.emoji + '</div>';
    h += '<div class="ciin"><div class="cin">' + item.nombre + '</div><div class="cip">$' + (item.precio*item.qty).toLocaleString('es-CL') + '</div></div>';
    h += '<div class="cic"><button class="cb" onclick="chQty(\'' + item.id + '\',-1)">-</button><span class="cq">' + item.qty + '</span><button class="cb p" onclick="chQty(\'' + item.id + '\',1)">+</button></div></div>';
  }
  h += '<div class="ensec"><div class="entit">🚚 Selecciona tu zona de envío</div>';
  h += '<select class="selzona" id="selzona" onchange="selZona(this.value)"><option value="">— Elige tu zona —</option>';
  for (var i = 0; i < zonas.length; i++) {
    var sel = zonaSel === zonas[i].id ? ' selected' : '';
    h += '<option value="' + zonas[i].id + '"' + sel + '>' + zonas[i].nombre + ' — ' + (zonas[i].precio === 0 ? 'Gratis' : '$' + zonas[i].precio.toLocaleString('es-CL')) + '</option>';
  }
  h += '</select>';
  if (zonaSel !== null) {
    var zz = zonas.find(function(x){return x.id === zonaSel;});
    if(zz){
      h += '<div class="endet"><span style="font-size:10px;color:var(--muted)">' + zz.comunas + '</span>';
      h += '<span style="font-family:Fraunces,serif;font-size:15px;color:' + (zz.precio===0?'var(--wa)':'var(--v2)') + ';font-weight:700">' + (zz.precio===0?'¡Gratis!':'$'+zz.precio.toLocaleString('es-CL')) + '</span></div>';
    }
  }
  h += '</div>';
  h += '<div class="totwrap">';
  h += '<div class="totrow"><span class="totsub">Subtotal</span><span class="totsub">$' + subtotal().toLocaleString('es-CL') + '</span></div>';
  h += '<div class="totrow"><span class="totsub">Envío</span><span class="totsub">' + (zonaSel!==null?(costoEnvio()===0?'<span style="color:var(--wa);font-weight:700">Gratis</span>':'$'+costoEnvio().toLocaleString('es-CL')):'—') + '</span></div>';
  h += '<div class="totdiv"></div>';
  h += '<div class="totrow"><span class="totlbl">Total</span><span class="totamt">$' + totalFinal().toLocaleString('es-CL') + '</span></div></div>';
  h += '<div class="ftit">📅 ¿Para qué fecha necesitas tu pedido?</div><div class="fgrid">';
  for (var i = 0; i < fechas.length; i++) {
    var f = fechas[i];
    var sel = fechaSel === i ? ' sel' : '';
    var cls = f.ok ? 'ok'+sel : 'no';
    var st = f.ok ? '✅ Disponible' : (f.dias<3?'⏰ Muy pronto':'❌ Sin despacho');
    var click = f.ok ? ' onclick="selFecha('+i+')"' : '';
    h += '<div class="fb '+cls+'"'+click+'><div class="fd">'+DIAS[f.fecha.getDay()]+'</div><div class="fn">'+f.fecha.getDate()+'</div><div class="fm">'+MESES[f.fecha.getMonth()]+'</div><div class="fs">'+st+'</div></div>';
  }
  h += '</div>';
  h += '<label class="ilbl">👤 Tu nombre</label><input class="inp" id="inpnom" placeholder="Ej: María González" value="'+nombreG+'">';
  h += '<label class="ilbl">📍 Tu dirección</label><input class="inp" id="inpdir" placeholder="Ej: Av. Providencia 1234" value="'+dirG+'">';
  h += '<label class="ilbl">📱 Tu teléfono (opcional)</label><input class="inp" id="inptel" placeholder="+56 9 1234 5678">';
  if (zonaSel===null||fechaSel===null) {
    h += '<div class="alrt">👆 '+(zonaSel===null?'Selecciona tu zona de envío':'')+(zonaSel===null&&fechaSel===null?' y ':'')+(fechaSel===null?'elige una fecha disponible':'')+'</div>';
  }
  var dis = (zonaSel===null||fechaSel===null) ? ' style="opacity:0.45;pointer-events:none"' : '';
  h += '<button class="bwab"'+dis+' onclick="enviarWA()"><svg style="width:16px;height:16px;fill:white;flex-shrink:0" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.508C8.05 23.443 9.982 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.881 0-3.63-.498-5.145-1.367l-.368-.213-3.762.896.952-3.653-.24-.384A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg> Enviar pedido por WhatsApp</button>';
  h += '<button class="bmpb"'+dis+' onclick="pagarMP()">💳 Pagar con Mercado Pago</button>';
  body.innerHTML = h;
}

function selZona(val) {
  nombreG = document.getElementById('inpnom')?document.getElementById('inpnom').value:'';
  dirG = document.getElementById('inpdir')?document.getElementById('inpdir').value:'';
  zonaSel = val===''?null:val;
  renderCart();
}

function selFecha(i) {
  nombreG = document.getElementById('inpnom')?document.getElementById('inpnom').value:'';
  dirG = document.getElementById('inpdir')?document.getElementById('inpdir').value:'';
  fechaSel = i; renderCart();
}

function enviarWA() {
  var nombre = document.getElementById('inpnom')?document.getElementById('inpnom').value:'Cliente';
  var dir = document.getElementById('inpdir')?document.getElementById('inpdir').value:'';
  var tel = document.getElementById('inptel')?document.getElementById('inptel').value:'';
  var fechas = genFechas(); var fecha = fechas[fechaSel]; 
  var zona = zonas.find(function(x){return x.id === zonaSel;});
  var keys = Object.keys(carrito);
  var msg = 'Hola! 🌱 Quiero hacer un pedido:\n\n';
  msg += '👤 *'+nombre+'*\n';
  if (tel) msg += '📱 '+tel+'\n';
  msg += '📍 '+dir+'\n';
  msg += '🚚 Zona: '+zona.nombre+'\n';
  msg += '📅 Para el *'+DIAS[fecha.fecha.getDay()]+' '+fecha.fecha.getDate()+' '+MESES[fecha.fecha.getMonth()]+'*\n\n';
  msg += '🛒 *Mi pedido:*\n';
  for (var i=0;i<keys.length;i++) { var item=carrito[keys[i]]; msg+='• '+item.qty+'x '+item.nombre+' — $'+(item.precio*item.qty).toLocaleString('es-CL')+'\n'; }
  msg += '\n📦 Subtotal: $'+subtotal().toLocaleString('es-CL')+'\n';
  msg += '🚚 Envío: '+(costoEnvio()===0?'Gratis':'$'+costoEnvio().toLocaleString('es-CL'))+'\n';
  msg += '💰 *Total: $'+totalFinal().toLocaleString('es-CL')+'*';
  window.open('https://wa.me/56990816124?text='+encodeURIComponent(msg),'_blank');
  cerrarCarrito();
  showConf('💬','¡Pedido enviado!','Tu pedido fue enviado por WhatsApp\nFecha: '+DIAS[fecha.fecha.getDay()]+' '+fecha.fecha.getDate()+' '+MESES[fecha.fecha.getMonth()]+'\n\n¡Espera la confirmación de La Manito! 🌱');
  carrito={}; zonaSel=null; fechaSel=null; nombreG=''; dirG='';
  updBdg(); renderGrid();
}

function pagarMP() {
  cerrarCarrito();
  showConf('💳','Mercado Pago','Próximamente podrás pagar directo\ncon tarjeta o transferencia 🌱\n\nPor ahora usa WhatsApp para coordinar el pago.');
}

// ============================================================
// ADMIN
// ============================================================
function abrirLogin() {
  document.getElementById('loginpass').value='';
  document.getElementById('loginerr').style.display='none';
  document.getElementById('loginov').classList.add('open');
  setTimeout(function(){ document.getElementById('loginpass').focus(); },300);
}
function loginClick(e) { if(e.target.id==='loginov') document.getElementById('loginov').classList.remove('open'); }
function checkLogin() {
  var pass = document.getElementById('loginpass').value;
  if (pass===ADMIN_PASS) {
    document.getElementById('loginov').classList.remove('open');
    abrirAdmin();
  } else {
    document.getElementById('loginerr').style.display='block';
    document.getElementById('loginpass').value='';
  }
}
function abrirAdmin() { document.getElementById('adminov').classList.add('open'); renderAdminTab('productos'); }
function cerrarAdmin() { document.getElementById('adminov').classList.remove('open'); }

function aTab(tab, btn) {
  var tabs = document.querySelectorAll('.atab');
  for (var i=0;i<tabs.length;i++) tabs[i].classList.remove('on');
  btn.classList.add('on');
  renderAdminTab(tab);
}

function renderAdminTab(tab) {
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
      h += '<div class="star-icon '+(p.destacado?'active':'')+'" onclick="toggleDestacado(\''+p.id+'\')" title="Destacar">⭐</div>';
      h += '<button class="btn-sm" onclick="abrirModalProd(\''+p.id+'\')">Editar</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarProd(\''+p.id+'\')" title="Eliminar">🗑</button>';
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
      h += '<button class="btn-sm btn-pri" onclick="guardarZona(\''+z.id+'\')">Guardar</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarZona(\''+z.id+'\')">Borrar</button>';
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
    if (typeof actualizarPreview === 'function') actualizarPreview('');
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
  if (typeof actualizarPreview === 'function') {
    actualizarPreview(document.getElementById('fimagen').value || '');
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

  if (!supabaseClient) { showToast('⚠️ Supabase no está configurado'); return; }

  if (editandoId===null) {
    data.destacado = false;
    supabaseClient.from('productos').insert([data])
      .then(function(result) {
        if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
        showToast('✅ Producto agregado');
        loadData();
      });
  } else {
    var p = productos.find(function(x){return x.id === editandoId;});
    if(p) data.destacado = p.destacado;
    supabaseClient.from('productos').update(data).eq('id', editandoId)
      .then(function(result) {
        if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
        showToast('✅ Producto actualizado');
        loadData();
      });
  }
  document.getElementById('modalov').classList.remove('open');
}

function eliminarProd(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  if (!supabaseClient) { showToast('⚠️ Supabase no configurado'); return; }
  supabaseClient.from('productos').delete().eq('id', id)
    .then(function(result) {
      if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
      showToast('🗑 Producto eliminado');
      loadData();
    });
}

function toggleDestacado(id) {
  var p = productos.find(function(x){return x.id === id;});
  if (!p) return;
  if (!supabaseClient) { showToast('⚠️ Supabase no configurado'); return; }
  supabaseClient.from('productos').update({destacado: !p.destacado}).eq('id', id)
    .then(function(result) {
      if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
      showToast('⭐ Destacado actualizado');
      loadData();
    });
}

function guardarZona(id) {
  if (!supabaseClient) { showToast('⚠️ Supabase no configurado'); return; }
  var nom = document.getElementById('znom_'+id).value;
  var com = document.getElementById('zcom_'+id).value;
  var pre = parseInt(document.getElementById('zpre_'+id).value)||0;
  supabaseClient.from('zonas').update({nombre:nom, comunas:com, precio:pre}).eq('id', id)
    .then(function(result) {
      if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
      showToast('✅ Zona guardada');
      loadData();
    });
}

function agregarZona() {
  if (!supabaseClient) { showToast('⚠️ Supabase no configurado'); return; }
  var nom = document.getElementById('nznom').value.trim();
  var com = document.getElementById('nzcom').value.trim();
  var pre = parseInt(document.getElementById('nzpre').value)||0;
  if (!nom) { showToast('⚠️ Ingresa el nombre de la zona'); return; }
  supabaseClient.from('zonas').insert([{nombre:nom, comunas:com, precio:pre}])
    .then(function(result) {
      if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
      document.getElementById('nznom').value='';
      document.getElementById('nzcom').value='';
      document.getElementById('nzpre').value='0';
      showToast('✅ Zona agregada');
      loadData();
    });
}

function eliminarZona(id) {
  if (!confirm('¿Eliminar esta zona?')) return;
  if (!supabaseClient) { showToast('⚠️ Supabase no configurado'); return; }
  supabaseClient.from('zonas').delete().eq('id', id)
    .then(function(result) {
      if (result.error) { showToast('❌ Error: ' + result.error.message); return; }
      showToast('🗑 Zona eliminada');
      loadData();
    });
}

function cerrarModal(e) { if(e.target.id==='modalov') document.getElementById('modalov').classList.remove('open'); }


function subirImagen(input) {
  var file = input.files[0];
  if (!file) return;

  var uploadText = document.querySelector('.upload-text');
  var imgPreview = document.getElementById('fimagen_preview');
  var originalText = uploadText ? uploadText.textContent : 'Subir imagen desde tu dispositivo';

  if (!supabaseClient) {
    showToast('⚠️ Supabase Storage no está configurado');
    var container = document.getElementById('url_input_container');
    if (container) container.style.display = 'block';
    setTimeout(function() {
      alert('Falta configurar Supabase Storage en window.SUPABASE_CONFIG dentro de index.html.');
    }, 100);
    input.value = '';
    return;
  }

  if (!file.type || file.type.indexOf('image/') !== 0) {
    showToast('⚠️ Selecciona un archivo de imagen válido');
    input.value = '';
    return;
  }

  var maxSizeMb = 8;
  if (file.size > maxSizeMb * 1024 * 1024) {
    showToast('⚠️ La imagen no puede superar ' + maxSizeMb + ' MB');
    input.value = '';
    return;
  }

  if (uploadText) uploadText.textContent = 'Subiendo imagen... ⏳';

  var safeName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  var filePath = 'productos/' + Date.now() + '_' + safeName;

  supabaseClient.storage
    .from(supabaseStorageBucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    })
    .then(function(result) {
      if (result.error) throw result.error;
      var publicResult = supabaseClient.storage.from(supabaseStorageBucket).getPublicUrl(filePath);
      var publicUrl = publicResult && publicResult.data ? publicResult.data.publicUrl : '';
      if (!publicUrl) throw new Error('Supabase no devolvió una URL pública.');
      document.getElementById('fimagen').value = publicUrl;
      actualizarPreview(publicUrl);
      if (uploadText) uploadText.textContent = '¡Subida con éxito! ✅';
      showToast('📸 Imagen guardada en Supabase');
    })
    .catch(function(error) {
      console.error('Error al subir imagen a Supabase:', error);
      if (uploadText) uploadText.textContent = originalText;
      input.value = '';
      var container = document.getElementById('url_input_container');
      if (container) container.style.display = 'block';
      showToast('⚠️ Falló la subida a Supabase');
      setTimeout(function() {
        alert('No se pudo subir la imagen a Supabase. Revisa que el bucket "' + supabaseStorageBucket + '" exista, sea público y permita inserts con anon key.\n\nDetalle: ' + (error.message || error));
      }, 100);
    });
}

function actualizarPreview(val) {
  var hiddenInput = document.getElementById('fimagen');
  var imgPreview = document.getElementById('fimagen_preview');
  if (hiddenInput) hiddenInput.value = val || '';
  if (!imgPreview) return;
  if (val && val.trim()) {
    imgPreview.src = val;
    imgPreview.style.display = 'block';
  } else {
    imgPreview.removeAttribute('src');
    imgPreview.style.display = 'none';
  }
}

function toggleUrlInput() {
  var container = document.getElementById('url_input_container');
  if (!container) return;
  container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

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
