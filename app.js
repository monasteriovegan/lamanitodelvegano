var DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var ADMIN_PASS = 'manito2024';
var editandoId = null;

// === CONFIGURACIÓN DE FIREBASE ===
// Pega aquí los datos de tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC6CjNZtcSKilwirggvx7Ez80FbAF1wBSs",
  authDomain: "la-manito-del-vegano.firebaseapp.com",
  projectId: "la-manito-del-vegano",
  storageBucket: "la-manito-del-vegano.firebasestorage.app",
  messagingSenderId: "33295844484",
  appId: "1:33295844484:web:c6cabb28382651301eaed1",
  measurementId: "G-1Q7QB5EZ33"
};

var app, db = null;
var storage = null;
try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();
} catch(e) { console.log("Firebase no configurado aún", e); }

var productos = [];
var zonas = [];
var pedidos = [];
var categorias = [];

function loadData() {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") {
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
  
  db.collection("productos").onSnapshot(function(querySnapshot) {
    var p = [];
    querySnapshot.forEach(function(doc) { var d = doc.data(); d.id = doc.id; p.push(d); });
    productos = p;
    renderGrid(); renderDestacados();
    var tab = document.querySelector('.atab.on');
    if (tab) {
      var tabVal = tab.getAttribute('onclick').split("'")[1];
      if (tabVal === 'productos' || tabVal === 'destacados' || tabVal === 'stats') {
        renderAdminTab(tabVal);
      }
    }
  });

  db.collection("zonas").onSnapshot(function(querySnapshot) {
    var z = [];
    querySnapshot.forEach(function(doc) { var d = doc.data(); d.id = doc.id; z.push(d); });
    zonas = z;
    renderZonas();
    var tab = document.querySelector('.atab.on');
    if (tab) {
      var tabVal = tab.getAttribute('onclick').split("'")[1];
      if (tabVal === 'zonas' || tabVal === 'stats') {
        renderAdminTab(tabVal);
      }
    }
  });

  db.collection("pedidos").orderBy("createdAt", "desc").onSnapshot(function(querySnapshot) {
    var ped = [];
    querySnapshot.forEach(function(doc) { var d = doc.data(); d.id = doc.id; ped.push(d); });
    pedidos = ped;
    var tab = document.querySelector('.atab.on');
    if (tab) {
      var tabVal = tab.getAttribute('onclick').split("'")[1];
      if (tabVal === 'pedidos' || tabVal === 'stats') {
        renderAdminTab(tabVal);
      }
    }
  });

  db.collection("categorias").onSnapshot(function(querySnapshot) {
    var cats = [];
    querySnapshot.forEach(function(doc) { var d = doc.data(); d.id = doc.id; cats.push(d); });
    categorias = cats;
    
    if (categorias.length === 0 && db && firebaseConfig.apiKey !== "TU_API_KEY") {
      var defaultCats = [
        { nombre: 'Empanadas', emoji: '🥟', slug: 'empanadas' },
        { nombre: 'Pies', emoji: '🫐', slug: 'pies' },
        { nombre: 'Manjares', emoji: '🍯', slug: 'manjares' },
        { nombre: 'Packs', emoji: '📦', slug: 'packs' }
      ];
      defaultCats.forEach(function(cat) {
        db.collection("categorias").add(cat);
      });
      return;
    }
    
    renderCategoriasUI();

    var tab = document.querySelector('.atab.on');
    if (tab) {
      var tabVal = tab.getAttribute('onclick').split("'")[1];
      if (tabVal === 'categorias' || tabVal === 'productos') {
        renderAdminTab(tabVal);
      }
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
  for (var i = 0; i < pgs.length; i++) {
    pgs[i].classList.remove('active-page', 'show-page', 'on');
  }
  var pg = document.getElementById('pg-' + hash);
  if (!pg) pg = document.getElementById('pg-home');
  
  if (pg) {
    pg.classList.add('active-page');
    // Trigger reflow to initiate opacity transition
    pg.offsetWidth;
    pg.classList.add('show-page');
  }
  
  var nms = document.querySelectorAll('.nm');
  for (var i = 0; i < nms.length; i++) nms[i].classList.remove('on');
  var idx = {home:0,nosotros:1,blog:2,contacto:3};
  if (nms[idx[hash]] !== undefined) nms[idx[hash]].classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  
  crearPedido('WhatsApp', 'WhatsApp').then(function(pedidoId) {
    var msg = 'Hola! 🌱 Quiero hacer un pedido:\n\n';
    if (pedidoId) msg += '🆔 *Pedido: #' + pedidoId.substring(0, 6).toUpperCase() + '*\n';
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
  });
}

function pagarMP() {
  var nombre = document.getElementById('inpnom') ? document.getElementById('inpnom').value.trim() : 'Cliente';
  var dir = document.getElementById('inpdir') ? document.getElementById('inpdir').value.trim() : '';
  var tel = document.getElementById('inptel') ? document.getElementById('inptel').value.trim() : '';
  
  if (zonaSel === null) {
    showToast('⚠️ Selecciona tu zona de envío primero.');
    return;
  }
  if (fechaSel === null) {
    showToast('⚠️ Selecciona una fecha de entrega disponible.');
    return;
  }
  if (!nombre) {
    showToast('⚠️ Ingresa tu nombre para proceder al pago.');
    return;
  }
  if (!dir) {
    showToast('⚠️ Ingresa tu dirección para el envío.');
    return;
  }

  var fechas = genFechas();
  var fecha = fechas[fechaSel];
  var fechaTxt = DIAS[fecha.fecha.getDay()] + ' ' + fecha.fecha.getDate() + ' ' + MESES[fecha.fecha.getMonth()];
  var zona = zonas.find(function(x){return x.id === zonaSel;});
  var zonaTxt = zona ? zona.nombre : '';

  var btn = document.querySelector('.bmpb');
  var originalTxt = btn ? btn.innerHTML : '💳 Pagar con Mercado Pago';
  if (btn) {
    btn.innerHTML = ' Redirigiendo a Mercado Pago...';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
  }

  crearPedido('Mercado Pago', 'Pendiente').then(function(pedidoId) {
    if (!pedidoId) {
      if (btn) {
        btn.innerHTML = originalTxt;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
      showToast('❌ Error al guardar el pedido en base de datos.');
      return;
    }

    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrito: carrito,
        nombre: nombre,
        direccion: dir,
        telefono: tel,
        zona: zonaTxt,
        envio: costoEnvio(),
        fecha: fechaTxt,
        pedidoId: pedidoId
      })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) { throw new Error(err.error || 'Error desconocido'); });
      }
      return res.json();
    })
    .then(function(data) {
      if (data.init_point) {
        localStorage.setItem('ultimoPedidoId', pedidoId);
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió la URL de pago.');
      }
    })
    .catch(function(err) {
      console.error('Error al iniciar el pago:', err);
      if (btn) {
        btn.innerHTML = originalTxt;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
      showToast('❌ Error: ' + err.message);
    });
  });
}

function crearPedido(metodoPago, statusInicial) {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") return Promise.resolve(null);
  
  var nombre = document.getElementById('inpnom') ? document.getElementById('inpnom').value.trim() : 'Cliente';
  var dir = document.getElementById('inpdir') ? document.getElementById('inpdir').value.trim() : '';
  var tel = document.getElementById('inptel') ? document.getElementById('inptel').value.trim() : '';
  
  var fechas = genFechas();
  var fecha = fechas[fechaSel];
  var fechaTxt = DIAS[fecha.fecha.getDay()] + ' ' + fecha.fecha.getDate() + ' ' + MESES[fecha.fecha.getMonth()];
  var zona = zonas.find(function(x){return x.id === zonaSel;});
  var zonaTxt = zona ? zona.nombre : '';

  var itemsArray = [];
  var keys = Object.keys(carrito);
  for (var i = 0; i < keys.length; i++) {
    var item = carrito[keys[i]];
    itemsArray.push({
      id: item.id,
      nombre: item.nombre,
      precio: item.precio,
      qty: item.qty,
      emoji: item.emoji || '🌱'
    });
  }

  var pedidoData = {
    cliente: {
      nombre: nombre,
      direccion: dir,
      telefono: tel
    },
    items: itemsArray,
    subtotal: subtotal(),
    envio: costoEnvio(),
    total: totalFinal(),
    zonaEnvio: zonaTxt,
    fechaEntrega: fechaTxt,
    metodoPago: metodoPago,
    status: statusInicial,
    createdAt: new Date().toISOString()
  };

  return db.collection("pedidos").add(pedidoData).then(function(docRef) {
    return docRef.id;
  }).catch(function(err) {
    console.error("Error guardando pedido:", err);
    return null;
  });
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
  } else if (tab==='destacados') {
    var h = '<div class="admin-head"><div class="admin-tit">Productos Destacados en Portada</div></div>';
    var dest = productos.filter(function(p){ return p.destacado; });
    if (dest.length === 0) {
      h += '<div class="admin-card admin-card-pad" style="text-align:center;color:var(--muted)">No tienes productos destacados actualmente. Ve a la pestaña de "Productos" y haz clic en la estrella ⭐ para destacar uno.</div>';
    } else {
      h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>';
      for (var i=0;i<dest.length;i++) {
        var p = dest[i];
        h += '<tr>';
        h += '<td><div style="display:flex;align-items:center;gap:12px">';
        h += '<div class="atbl-emoji" style="background:'+p.color_fondo+'">';
        if(p.imagen_url) h += '<img src="'+p.imagen_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:4px">';
        else h += p.emoji;
        h += '</div><div><div style="font-weight:600">'+p.nombre+'</div>';
        h += '</div></div></td>';
        h += '<td><span class="status-pill pill-cat">'+p.categoria+'</span></td>';
        h += '<td>$'+p.precio.toLocaleString('es-CL')+'</td>';
        h += '<td><div style="display:flex;gap:8px;align-items:center">';
        h += '<div class="star-icon active" onclick="toggleDestacado(\''+p.id+'\')" title="Quitar de Destacados">⭐</div>';
        h += '</div></td></tr>';
      }
      h += '</tbody></table></div>';
    }
    c.innerHTML = h;
  } else if (tab === 'categorias') {
    var h = '<div class="admin-head"><div class="admin-tit">Gestión de Categorías</div></div>';
    h += '<div class="admin-card admin-card-pad" style="background:#fafbfb;border-style:dashed">';
    h += '<div style="font-weight:600;font-size:14px;margin-bottom:12px;">Agregar nueva categoría</div><div style="display:flex;gap:12px;align-items:flex-end">';
    h += '<div style="flex:2"><label class="flbl">Nombre</label><input class="finp" id="ncatnom" placeholder="Ej: Hamburguesas"></div>';
    h += '<div style="flex:1"><label class="flbl">Emoji</label><input class="finp" id="ncatemoj" placeholder="Ej: 🍔"></div>';
    h += '<button class="btn-add" style="margin-bottom:4px" onclick="agregarCategoria()">Guardar</button></div></div>';
    
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Emoji</th><th>Nombre</th><th>Slug (identificador)</th><th>Acciones</th></tr></thead><tbody>';
    for (var i = 0; i < categorias.length; i++) {
      var c = categorias[i];
      h += '<tr>';
      h += '<td style="font-size:24px">' + c.emoji + '</td>';
      h += '<td><strong>' + c.nombre + '</strong></td>';
      h += '<td><code>' + c.slug + '</code></td>';
      h += '<td><button class="btn-sm btn-dan" onclick="eliminarCategoria(\'' + c.id + '\')">Borrar</button></td>';
      h += '</tr>';
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
  } else if (tab==='pedidos') {
    var h = '<div class="admin-head"><div class="admin-tit">Gestión de Pedidos</div></div>';
    if (pedidos.length === 0) {
      h += '<div class="admin-card admin-card-pad" style="text-align:center;color:var(--muted)">Aún no tienes pedidos registrados 🌱</div>';
    } else {
      h += '<div class="admin-card" style="overflow-x:auto"><table class="atbl">';
      h += '<thead><tr><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
      for (var i = 0; i < pedidos.length; i++) {
        var p = pedidos[i];
        var fechaStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CL') : 'Reciente';
        
        var selectHtml = '<select class="fsel" style="padding:4px 8px;font-size:12px;width:120px" onchange="cambiarEstadoPedido(\'' + p.id + '\', this.value)">';
        var estados = ['Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado', 'WhatsApp'];
        for (var j = 0; j < estados.length; j++) {
          var sel = p.status === estados[j] ? ' selected' : '';
          selectHtml += '<option value="' + estados[j] + '"' + sel + '>' + estados[j] + '</option>';
        }
        selectHtml += '</select>';

        var itemsHtml = '';
        if (p.items) {
          if (Array.isArray(p.items)) {
            for (var k = 0; k < p.items.length; k++) {
              itemsHtml += '<div>' + p.items[k].qty + 'x ' + p.items[k].nombre + '</div>';
            }
          } else {
            var ikeys = Object.keys(p.items);
            for (var k = 0; k < ikeys.length; k++) {
              itemsHtml += '<div>' + p.items[ikeys[k]].qty + 'x ' + p.items[ikeys[k]].nombre + '</div>';
            }
          }
        }

        h += '<tr>';
        h += '<td><strong>#' + p.id.substring(0,6).toUpperCase() + '</strong><div style="font-size:10px;color:var(--muted)">' + fechaStr + '</div></td>';
        h += '<td><strong>' + p.cliente.nombre + '</strong><div style="font-size:11px;color:var(--muted)">' + p.cliente.direccion + '</div><div style="font-size:11px;color:var(--muted)">' + (p.cliente.telefono || '-') + '</div></td>';
        h += '<td style="font-size:12px">' + itemsHtml + '<div style="font-size:10px;color:var(--v2);margin-top:4px">Entrega: ' + p.fechaEntrega + '</div></td>';
        h += '<td><strong>$' + p.total.toLocaleString('es-CL') + '</strong><div style="font-size:10px;color:var(--muted)">Envío: $' + p.envio.toLocaleString('es-CL') + '</div></td>';
        h += '<td><span class="status-pill ' + (p.metodoPago==='Mercado Pago'?'pill-cat':'pill-oferta') + '">' + p.metodoPago + '</span></td>';
        h += '<td><span class="status-pill" style="background:#f4f6f8;border:1px solid #c9cccf;color:#202223">' + p.status + '</span></td>';
        h += '<td><div style="display:flex;gap:6px;align-items:center">' + selectHtml + '<button class="btn-sm btn-dan" onclick="eliminarPedido(\'' + p.id + '\')" title="Eliminar">🗑</button></div></td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    c.innerHTML = h;
  } else if (tab==='stats') {
    var ingresos = 0;
    var validos = 0;
    var mpCount = 0;
    var waCount = 0;
    var prodSales = {}; 

    for (var i = 0; i < pedidos.length; i++) {
      var p = pedidos[i];
      if (p.status !== 'Cancelado') {
        ingresos += p.total || 0;
        validos++;
        if (p.metodoPago === 'Mercado Pago') mpCount++;
        else waCount++;

        var items = p.items || [];
        if (Array.isArray(items)) {
          for (var k = 0; k < items.length; k++) {
            var it = items[k];
            prodSales[it.nombre] = (prodSales[it.nombre] || 0) + (it.qty || 0);
          }
        } else {
          var ikeys = Object.keys(items);
          for (var k = 0; k < ikeys.length; k++) {
            var it = items[ikeys[k]];
            prodSales[it.nombre] = (prodSales[it.nombre] || 0) + (it.qty || 0);
          }
        }
      }
    }

    var ticketPromedio = validos > 0 ? Math.round(ingresos / validos) : 0;

    var topProds = [];
    var pnames = Object.keys(prodSales);
    for (var i = 0; i < pnames.length; i++) {
      topProds.push({ nombre: pnames[i], qty: prodSales[pnames[i]] });
    }
    topProds.sort(function(a, b) { return b.qty - a.qty; });
    var topSalesHtml = '';
    if (topProds.length === 0) {
      topSalesHtml = '<p style="color:var(--muted);font-size:13px">Aún no hay ventas registradas.</p>';
    } else {
      topSalesHtml += '<table class="atbl"><thead><tr><th>Producto</th><th style="text-align:right">Cantidad Vendida</th></tr></thead><tbody>';
      var maxShow = Math.min(topProds.length, 5);
      for (var i = 0; i < maxShow; i++) {
        topSalesHtml += '<tr><td><strong>' + topProds[i].nombre + '</strong></td><td style="text-align:right;font-weight:700">' + topProds[i].qty + ' uds</td></tr>';
      }
      topSalesHtml += '</tbody></table>';
    }

    var h = '<div class="admin-head"><div class="admin-tit">Métricas & Rendimiento</div></div>';
    h += '<div class="admin-kpis">';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ingresos Totales</div><div class="kpi-val">$' + ingresos.toLocaleString('es-CL') + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ventas Totales</div><div class="kpi-val">' + validos + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ticket Promedio</div><div class="kpi-val">$' + ticketPromedio.toLocaleString('es-CL') + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Métodos de Pago</div><div class="kpi-val" style="font-size:15px;margin-top:14px;font-weight:600;line-height:1.5">💳 Mercado Pago: ' + mpCount + '<br>💬 WhatsApp: ' + waCount + '</div></div>';
    h += '</div>';

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;margin-top:20px">';
    h += '<div class="admin-card admin-card-pad"><h3>🏆 Top 5 Productos más Vendidos</h3><div style="margin-top:12px">' + topSalesHtml + '</div></div>';
    h += '<div class="admin-card admin-card-pad"><h3>📦 Resumen del Catálogo</h3><ul style="margin-top:12px;list-style:none;padding:0;font-size:14px;line-height:2.2">';
    h += '<li>🌿 Total Productos: <strong>' + productos.length + '</strong></li>';
    h += '<li>🚚 Zonas de Envío: <strong>' + zonas.length + '</strong></li>';
    h += '<li>⭐ Destacados en Portada: <strong>' + productos.filter(function(p){return p.destacado;}).length + '</strong></li>';
    h += '<li>🏷️ En Oferta: <strong>' + productos.filter(function(p){return p.etiqueta==='oferta';}).length + '</strong></li>';
    h += '</ul></div>';
    h += '</div>';
    c.innerHTML = h;
  }
}

// ============================================================
// ADMIN ACCIONES
// ============================================================
function abrirModalProd(id) {
  editandoId = id;
  
  var modalbox = document.querySelector('.modalbox');
  if (modalbox) modalbox.scrollTop = 0;

  var imgPreview = document.getElementById('fimagen_preview');
  var uploadText = document.querySelector('.upload-text');

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
    if (imgPreview) {
      imgPreview.style.display = 'none';
      imgPreview.src = '';
    }
    if (uploadText) uploadText.textContent = "Subir imagen desde tu dispositivo";
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
    if (p.imagen_url) {
      if (imgPreview) {
        imgPreview.src = p.imagen_url;
        imgPreview.style.display = 'block';
      }
      if (uploadText) uploadText.textContent = "Cambiar imagen del producto";
    } else {
      if (imgPreview) {
        imgPreview.style.display = 'none';
        imgPreview.src = '';
      }
      if (uploadText) uploadText.textContent = "Subir imagen desde tu dispositivo";
    }
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
checkPaymentStatus();
initScrollReveal();
initFloatingLeaves();

function checkPaymentStatus() {
  var urlParams = new URLSearchParams(window.location.search);
  var status = urlParams.get('status');
  var collectionStatus = urlParams.get('collection_status');

  if (status === 'success' || collectionStatus === 'approved') {
    carrito = {};
    updBdg();
    renderGrid();
    if (typeof cerrarCarrito === 'function') cerrarCarrito();
    
    var ultimoPedidoId = localStorage.getItem('ultimoPedidoId');
    if (ultimoPedidoId && db) {
      db.collection("pedidos").doc(ultimoPedidoId).update({
        status: 'Pagado'
      }).then(function() {
        console.log("Pedido actualizado a Pagado en Firebase");
        localStorage.removeItem('ultimoPedidoId');
      }).catch(function(e) {
        console.error("Error actualizando estado del pedido:", e);
      });
    }

    showConf('🎉', '¡Pago Exitoso!', 'Tu pago ha sido procesado correctamente con Mercado Pago.\n🌱 ¡Muchas gracias por tu compra! Te contactaremos pronto para coordinar el despacho.');
    
    var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  } else if (status === 'failure' || collectionStatus === 'rejected') {
    showToast('❌ El pago fue rechazado o cancelado. Por favor, intenta de nuevo o coordina por WhatsApp.');
    
    var ultimoPedidoId = localStorage.getItem('ultimoPedidoId');
    if (ultimoPedidoId && db) {
      db.collection("pedidos").doc(ultimoPedidoId).update({
        status: 'Cancelado'
      });
      localStorage.removeItem('ultimoPedidoId');
    }

    var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }
}

function cambiarEstadoPedido(id, nuevoEstado) {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") return;
  db.collection("pedidos").doc(id).update({ status: nuevoEstado }).then(function() {
    showToast('✅ Estado del pedido actualizado');
  });
}

function eliminarPedido(id) {
  if (!confirm('¿Eliminar este registro de pedido?')) return;
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") return;
  db.collection("pedidos").doc(id).delete().then(function() {
    showToast('🗑 Pedido eliminado');
  });
}

function subirImagen(input) {
  var file = input.files[0];
  if (!file) return;

  var uploadText = document.querySelector('.upload-text');
  var imgPreview = document.getElementById('fimagen_preview');

  if (!storage) {
    showToast("⚠️ Firebase Storage no inicializado.");
    return;
  }

  var originalText = uploadText ? uploadText.textContent : "Subir imagen";
  if (uploadText) uploadText.textContent = "Subiendo imagen... ⏳";
  
  var fileName = 'productos/' + Date.now() + '_' + file.name.replace(/\s+/g, '_');
  var storageRef = storage.ref().child(fileName);

  storageRef.put(file).then(function(snapshot) {
    return snapshot.ref.getDownloadURL();
  }).then(function(downloadURL) {
    document.getElementById('fimagen').value = downloadURL;
    if (imgPreview) {
      imgPreview.src = downloadURL;
      imgPreview.style.display = 'block';
    }
    if (uploadText) uploadText.textContent = "¡Subida con éxito! ✅";
    showToast("📸 Imagen guardada en tu Firebase");
  }).catch(function(error) {
    console.error("Error al subir imagen:", error);
    if (uploadText) uploadText.textContent = originalText;
    showToast("❌ Error al subir: " + error.message + " (Puedes pegar el link de la imagen abajo alternativamente)");
    toggleUrlInput(); // Abre la alternativa de URL automáticamente
  });
}

function toggleUrlInput() {
  var container = document.getElementById('url_input_container');
  if (container) {
    var isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
  }
}

function actualizarPreview(val) {
  document.getElementById('fimagen').value = val;
  var imgPreview = document.getElementById('fimagen_preview');
  if (imgPreview) {
    if (val.trim()) {
      imgPreview.src = val;
      imgPreview.style.display = 'block';
    } else {
      imgPreview.style.display = 'none';
      imgPreview.src = '';
    }
  }
}

function agregarCategoria() {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") return;
  var nom = document.getElementById('ncatnom').value.trim();
  var emoj = document.getElementById('ncatemoj').value.trim() || '🌱';
  if (!nom) { showToast('⚠️ Ingresa el nombre de la categoría'); return; }
  
  var slug = nom.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-');

  db.collection("categorias").add({
    nombre: nom,
    emoji: emoj,
    slug: slug
  }).then(function() {
    document.getElementById('ncatnom').value = '';
    document.getElementById('ncatemoj').value = '';
    showToast('✅ Categoría agregada');
  });
}

function eliminarCategoria(id) {
  if (!confirm('¿Eliminar esta categoría? Los productos asociados a ella no se borrarán pero quedarán sin categoría asignada.')) return;
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") return;
  db.collection("categorias").doc(id).delete().then(function() {
    showToast('🗑 Categoría eliminada');
  });
}

function renderCategoriasUI() {
  var catsContainer = document.querySelector('.cats');
  if (catsContainer) {
    var h = '<button class="cat ' + (catActual === 'todos' ? 'on' : '') + '" onclick="filtrar(\'todos\',this)">Todos</button>';
    for (var i = 0; i < categorias.length; i++) {
      var c = categorias[i];
      var sel = catActual === c.slug ? 'on' : '';
      h += '<button class="cat ' + sel + '" onclick="filtrar(\'' + c.slug + '\',this)">' + c.emoji + ' ' + c.nombre + '</button>';
    }
    catsContainer.innerHTML = h;
  }

  var fcatSelect = document.getElementById('fcat');
  if (fcatSelect) {
    var sh = '';
    for (var i = 0; i < categorias.length; i++) {
      var c = categorias[i];
      sh += '<option value="' + c.slug + '">' + c.emoji + ' ' + c.nombre + '</option>';
    }
    fcatSelect.innerHTML = sh;
  }
}

function initScrollReveal() {
  var sections = [
    document.querySelector('.hero'),
    document.querySelector('.stats'),
    document.getElementById('dest-sec'),
    document.querySelector('.cats'),
    document.getElementById('prodsec'),
    document.getElementById('pgrid'),
    document.querySelector('.reswrap'),
    document.querySelector('.infog')
  ];

  var observer = new IntersectionObserver(function(entries) {
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].isIntersecting) {
        entries[j].target.classList.add('active');
      }
    }
  }, { threshold: 0.05 });

  for (var i = 0; i < sections.length; i++) {
    if (sections[i]) {
      sections[i].classList.add('reveal');
      observer.observe(sections[i]);
    }
  }
}

function initFloatingLeaves() {
  var container = document.getElementById('leaves-container');
  if (!container) return;

  var leafCount = 12;
  for (var i = 0; i < leafCount; i++) {
    var leaf = document.createElement('div');
    leaf.className = 'leaf';
    
    // Position
    leaf.style.left = (Math.random() * 100) + 'vw';
    
    // Timing: Slower/faster organic speeds, with negative delay so leaves fall immediately on load
    var duration = (Math.random() * 15 + 12);
    var delay = (Math.random() * -20);
    leaf.style.animationDuration = duration + 's';
    leaf.style.animationDelay = delay + 's';
    
    // Size and Scale
    var size = (Math.random() * 12 + 12);
    leaf.style.width = size + 'px';
    leaf.style.height = size + 'px';
    
    var scale = (Math.random() * 0.6 + 0.4);
    leaf.style.transform = 'scale(' + scale + ')';
    
    // Dynamic 3D leaf variables
    var drift = (Math.random() * 200 - 100);
    var rotX = (Math.random() * 540 + 180);
    var rotY = (Math.random() * 540 + 180);
    var rotZ = (Math.random() * 720 + 360);
    var initRot = (Math.random() * 360);
    
    leaf.style.setProperty('--x-drift', drift + 'px');
    leaf.style.setProperty('--rot-x', rotX + 'deg');
    leaf.style.setProperty('--rot-y', rotY + 'deg');
    leaf.style.setProperty('--rot-z', rotZ + 'deg');
    leaf.style.setProperty('--init-rot', initRot + 'deg');
    
    container.appendChild(leaf);
  }
}

// ============================================================
// CHATBOT WIDGET: IA REAL VÍA VERCEL API
// ============================================================
var chatHistory = [];

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
  
  chatHistory.push({ role: "user", parts: [{ text: msg }] });

  var tdiv = document.createElement('div');
  tdiv.className = 'cmsg bot';
  tdiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  body.appendChild(tdiv);
  body.scrollTop = body.scrollHeight;

  // Llama a nuestra API Serverless en Vercel
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: chatHistory })
  }).then(function(res){ return res.json(); }).then(function(data){
    body.removeChild(tdiv);
    chatHistory.push({ role: "model", parts: [{ text: data.respuesta }] });
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
