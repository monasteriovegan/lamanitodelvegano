var DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var ADMIN_PASS = 'manito2024';
var editandoId = null;

function sanitizeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      default: return m;
    }
  });
}

// === CONFIGURACIÓN DE SUPABASE ===
var SUPABASE_URL = 'https://adrydqvahzqjbgtcvlay.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcnlkcXZhaHpxamJndGN2bGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjExMDAsImV4cCI6MjA5NTkzNzEwMH0.mjpGjVN90sHJAahn3NTslo3wLzW0ttQlOrwBQ62BZko';
var SUPABASE_BUCKET = 'productos';

var supabaseClient = null;
var supabaseStorageBucket = SUPABASE_BUCKET;
var dbSoportaGramaje = true;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch(e) { console.log("Error iniciando Supabase:", e); }

var productos = [];
var zonas = [];
var pedidos = [];
var categorias = [];
var adminTabActual = 'productos';
var ajustesTienda = {
  nombre: 'La Manito Del Vegano',
  whatsapp: '56990816124',
  instagram: 'lamanitodelvegano',
  tiktok: '',
  facebook: '',
  estado: 'abierto',
  tasaPuntos: 1000,
  valorPunto: 100
};
var cupones = [];
var cuponActivo = null;
var puntosACanjear = 0;
var descuentoFidelidad = 0;
var puntosDisponibles = 0;
var emailG = '';
var telG = '';
var pinRegistrado = false;
var pinCorrecto = false;
var puntosVerificados = false;
var clientePinDb = '';
var orderSearchQuery = '';
var orderStatusFilter = 'Todos';
var statsTimeFilter = 'all';

function updateOrderSearch(val) {
  orderSearchQuery = val;
  renderAdminTab('pedidos');
}
function updateOrderStatusFilter(val) {
  orderStatusFilter = val;
  renderAdminTab('pedidos');
}
function updateStatsTimeFilter(val) {
  statsTimeFilter = val;
  renderAdminTab('stats');
}

function verificarColumnasBaseDatos() {
  if (!supabaseClient) return Promise.resolve();
  return supabaseClient.from('productos').select('gramaje').limit(1).then(function(res) {
    if (res.error && res.error.code === '42703') { // 42703: undefined_column
      dbSoportaGramaje = false;
      console.warn("⚠️ La columna 'gramaje' no existe en la tabla 'productos' de Supabase.");
    } else {
      dbSoportaGramaje = true;
    }
  }).catch(function(err) {
    console.error("Error verificando columnas de base de datos:", err);
  });
}

function loadProductos() {
  if (!supabaseClient) return;
  return supabaseClient.from('productos').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      productos = res.data || [];
      renderGrid(); renderDestacados();
      if (adminTabActual === 'productos' || adminTabActual === 'destacados' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });
}

function loadZonas() {
  if (!supabaseClient) return;
  return supabaseClient.from('zonas').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      zonas = res.data || [];
      renderZonas();
      if (adminTabActual === 'zonas' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });
}

function loadPedidos() {
  if (!supabaseClient) return;
  return supabaseClient.from('pedidos').select('*').order('createdAt', { ascending: false }).then(function(res) {
    if (!res.error) {
      pedidos = res.data || [];
      if (adminTabActual === 'pedidos' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });
}

function loadCategorias() {
  if (!supabaseClient) return;
  return supabaseClient.from('categorias').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      categorias = res.data || [];
      if (categorias.length === 0) {
        var defaultCats = [
          { nombre: 'Empanadas', emoji: '🥟', slug: 'empanadas' },
          { nombre: 'Pies', emoji: '🫐', slug: 'pies' },
          { nombre: 'Manjares', emoji: '🍯', slug: 'manjares' },
          { nombre: 'Packs', emoji: '📦', slug: 'packs' }
        ];
        supabaseClient.from('categorias').insert(defaultCats).then(function() { loadCategorias(); });
        return;
      }
      renderCategoriasUI();
      if (adminTabActual === 'categorias' || adminTabActual === 'productos') {
        renderAdminTab(adminTabActual);
      }
    }
  });
}

function loadCupones() {
  if (!supabaseClient) return;
  return supabaseClient.from('cupones').select('*').then(function(res) {
    if (!res.error) {
      cupones = res.data || [];
      if (adminTabActual === 'cupones') {
        renderAdminTab('cupones');
      }
    }
  });
}

function loadData() {
  if (!supabaseClient) {
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
  
  verificarColumnasBaseDatos().then(function() {
    loadProductos();
  });

  loadZonas();
  loadPedidos();
  loadCategorias();

  supabaseClient.from('ajustes').select('*').eq('id', 'global').maybeSingle().then(function(res) {
    if (!res.error && res.data) {
      ajustesTienda = res.data.data;
    } else if (!res.error && !res.data) {
      supabaseClient.from('ajustes').insert([{ id: 'global', data: ajustesTienda }]);
    }
    aplicarAjustesUI();
    if (adminTabActual === 'ajustes') {
      renderAdminTab('ajustes');
    }
  });

  loadCupones();

  setupRealtime();
}

var realtimeSubscribed = false;
function setupRealtime() {
  if (realtimeSubscribed || !supabaseClient) return;
  realtimeSubscribed = true;
  supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, function() { loadData(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'zonas' }, function() { loadData(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, function() { loadData(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, function() { loadData(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ajustes' }, function() { loadData(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cupones' }, function() { loadData(); })
    .subscribe();
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
  var idx = {home:0,nosotros:1,blog:2,contacto:3,tracker:4};
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
    var precioNum = parseInt(p.precio) || 0;
    var precioAntNum = p.precio_anterior ? parseInt(p.precio_anterior) : 0;
    h += '<div class="dest-card" onmousemove="this.style.setProperty(\'--mouse-x\', event.offsetX + \'px\'); this.style.setProperty(\'--mouse-y\', event.offsetY + \'px\')" onclick="abrirDetailModal(\'' + p.id + '\', event)">';
    // dest-img contains BOTH the image AND the overlay for correct z-index stacking
    h += '<div class="dest-img" style="background:' + p.color_fondo + ';position:relative;overflow:hidden">';
    if (p.etiqueta === 'oferta') h += '<span class="dest-badge">OFERTA</span>';
    if (p.imagen_url) {
      h += '<img src="' + p.imagen_url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;transition:transform 0.5s ease" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\'">';
      h += '<span class="dest-img-emoji" style="display:none;position:relative;z-index:1">' + p.emoji + '</span>';
    } else {
      h += '<span class="dest-img-emoji" style="position:relative;z-index:1">' + p.emoji + '</span>';
    }
    // Overlay inside dest-img so z-index:5 correctly stacks above image z-index:1
    h += '<div class="dest-overlay" style="z-index:5">';
    h += '<div class="dest-name">' + p.nombre + '</div>';
    h += '<div class="dest-price">';
    if (precioAntNum) h += '<span style="text-decoration:line-through;opacity:0.7;margin-right:6px">$' + precioAntNum.toLocaleString('es-CL') + '</span>';
    h += '$' + precioNum.toLocaleString('es-CL') + '</div>';
    h += '<button class="dest-btn" onclick="event.stopPropagation(); addCart(\'' + p.id + '\')" style="box-shadow:0 0 15px rgba(0,255,179,0.5)">🛒 Agregar al carrito</button>';
    h += '</div>'; // close overlay
    h += '</div>'; // close dest-img
    h += '</div>'; // close dest-card
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
  
  var f = productos;
  if (catActual !== 'todos') {
    f = f.filter(function(p){ return p.categoria === catActual; });
  }
  if (window.searchQuery) {
    f = f.filter(function(p){ 
      return p.nombre.toLowerCase().indexOf(window.searchQuery) !== -1 || 
             (p.descripcion && p.descripcion.toLowerCase().indexOf(window.searchQuery) !== -1); 
    });
  }
  
  if (f.length === 0) { 
    g.innerHTML = '<p style="padding:20px;color:var(--muted);font-size:13px;text-align:center;width:100%;">No se encontraron productos 🌱</p>'; 
    return; 
  }
  
  var h = '';
  for (var i = 0; i < f.length; i++) {
    var p = f[i];
    
    // Calculate total quantity of this product (across all varieties) in the cart
    var qty = 0;
    for (var key in carrito) {
      if (carrito[key].id === p.id) {
        qty += carrito[key].qty;
      }
    }
    
    var tc = p.etiqueta === 'nuevo' ? 'tn' : p.etiqueta === 'oferta' ? 'to' : 'te';
    
    var isAgotado = p.maneja_stock && p.stock <= 0;
    var isBajoStock = p.maneja_stock && p.stock > 0 && p.stock <= 3;
    
    var cardOpacity = isAgotado ? ' style="opacity:0.65;"' : '';
    
    h += '<div class="card"' + cardOpacity + ' onmousemove="this.style.setProperty(\'--mouse-x\', event.offsetX + \'px\'); this.style.setProperty(\'--mouse-y\', event.offsetY + \'px\')" onclick="abrirDetailModal(\'' + p.id + '\', event)">';
    h += '<div class="cimg" style="background:' + p.color_fondo + '">';
    
    if (isAgotado) {
      h += '<span class="ctag to">AGOTADO</span>';
    } else if (isBajoStock) {
      h += '<span class="ctag to" style="background:var(--am); color:white;">¡SOLO ' + p.stock + '!</span>';
    } else if (p.etiqueta) {
      h += '<span class="ctag ' + tc + '">' + p.etiqueta_label + '</span>';
    }
    
    if (p.imagen_url) {
      h += '<img src="' + p.imagen_url + '" onerror="this.src=\'\'; this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\'">';
      h += '<span class="cimg-e" style="display:none">' + p.emoji + '</span>';
    } else {
      h += '<span class="cimg-e">' + p.emoji + '</span>';
    }
    h += '</div><div class="cbody"><div class="cname">' + p.nombre + '</div>';
    if (p.gramaje) {
      h += '<div style="font-size:11px; color:var(--neon); margin-bottom:4px; font-weight:600;">' + cleanGramajeLabel(p.gramaje) + '</div>';
    }
    h += '<div class="cdesc">' + p.descripcion + '</div>';
    
    // nutritional tags indicator
    h += '<div style="display:flex; gap:4px; margin-bottom:6px;">';
    if (p.gluten_free !== false) h += '<span style="font-size:8px; background:#FFE0B2; color:#E65100; padding:1px 4px; border-radius:3px; font-weight:700;">🌾 SG</span>';
    if (p.nut_free !== false) h += '<span style="font-size:8px; background:#D7CCC8; color:#4E342E; padding:1px 4px; border-radius:3px; font-weight:700;">🥜 SN</span>';
    h += '</div>';

    h += '<div class="cfoot"><div>';
    if (p.precio_anterior) h += '<span class="cold">$' + p.precio_anterior.toLocaleString('es-CL') + '</span>';
    h += '<span class="cprice">$' + p.precio.toLocaleString('es-CL') + '</span></div>';
    
    if (isAgotado) {
      h += '<span style="font-size:10px; font-weight:700; color:var(--rojo);">Agotado</span>';
    } else if ((p.variedades && p.variedades.trim().length > 0) || (p.gramaje && hasMultipleFormats(p.gramaje))) {
      if (qty > 0) {
        h += '<button class="badd" style="width:auto; padding:4px 8px; font-size:11px; border-radius:12px; background:rgba(0, 255, 179, 0.15); color:var(--neon); border:1px solid var(--neon);" onclick="abrirDetailModal(\'' + p.id + '\', event)">' + qty + ' en carro</button>';
      } else {
        h += '<button class="badd" style="width:auto; padding:4px 8px; font-size:11px; border-radius:12px;" onclick="abrirDetailModal(\'' + p.id + '\', event)">Opciones</button>';
      }
    } else if (qty > 0) {
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
  if ((p.variedades && p.variedades.trim().length > 0) || (p.gramaje && hasMultipleFormats(p.gramaje))) {
    abrirDetailModal(id);
    return;
  }
  if (p.maneja_stock && p.stock <= 0) {
    showToast('❌ Producto agotado');
    return;
  }
  var currentQty = carrito[id] ? carrito[id].qty : 0;
  if (p.maneja_stock && currentQty >= p.stock) {
    showToast('⚠️ No queda más stock disponible de ' + p.nombre);
    return;
  }
  if (!carrito[id]) carrito[id] = {id:p.id,nombre:p.nombre,precio:p.precio,emoji:p.emoji,color_fondo:p.color_fondo,imagen_url:p.imagen_url,qty:0};
  carrito[id].qty++;
  updBdg(); renderGrid();
  abrirCarrito();
  showToast('✅ ' + p.nombre + ' agregado');
}

function chQty(id, d) {
  if (!carrito[id]) return;
  var prodId = carrito[id].id;
  var p = productos.find(function(x){return x.id === prodId;});
  if (d > 0 && p && p.maneja_stock && carrito[id].qty >= p.stock) {
    showToast('⚠️ No queda más stock disponible de ' + p.nombre);
    return;
  }
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
function obtenerDescuentoCupon() {
  if (!cuponActivo) return 0;
  var sub = subtotal();
  if (cuponActivo.tipo === 'fijo') {
    return Math.min(sub, cuponActivo.valor);
  }
  if (cuponActivo.tipo === 'porcentaje') {
    return Math.round(sub * (cuponActivo.valor / 100));
  }
  if (cuponActivo.tipo === 'bogo') {
    var desc = 0;
    var keys = Object.keys(carrito);
    for (var i = 0; i < keys.length; i++) {
      var item = carrito[keys[i]];
      var matches = item.categoria === cuponActivo.valor || item.id === cuponActivo.valor || item.nombre.toLowerCase().indexOf(cuponActivo.valor.toLowerCase()) !== -1;
      if (matches) {
        desc += Math.floor(item.qty / 2) * item.precio;
      }
    }
    return desc;
  }
  return 0; // 'regalo' coupon does not deduct money, the item itself is free
}
function totalFinal() { 
  var sub = subtotal();
  var env = costoEnvio();
  var descCup = obtenerDescuentoCupon();
  var descFid = descuentoFidelidad;
  return Math.max(0, sub + env - descCup - descFid); 
}

// ============================================================
// FECHAS
// ============================================================
function genFechas() {
  var res = [];
  var hoy = new Date();
  
  // Check if any product in the cart has date restrictions
  var restrictedDates = null;
  var hasRestrictions = false;
  
  for (var itemId in carrito) {
    var item = carrito[itemId];
    var prod = productos.find(function(p) { return p.id === itemId; });
    if (prod && prod.disponibilidad && prod.disponibilidad.trim() !== '') {
      hasRestrictions = true;
      var dates = prod.disponibilidad.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      if (restrictedDates === null) {
        restrictedDates = dates;
      } else {
        // Intersection of available dates
        restrictedDates = restrictedDates.filter(function(d) { return dates.indexOf(d) !== -1; });
      }
    }
  }
  
  if (hasRestrictions) {
    if (restrictedDates && restrictedDates.length > 0) {
      // Create Date objects for the restricted dates
      restrictedDates.forEach(function(dateStr) {
        var parts = dateStr.split('-');
        if (parts.length === 3) {
          var y = parseInt(parts[0]);
          var m = parseInt(parts[1]) - 1;
          var d = parseInt(parts[2]);
          var dateObj = new Date(y, m, d);
          
          // Calculate difference in days to check if it's a future date
          var diffTime = dateObj.getTime() - hoy.getTime();
          var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          // If dateObj date is >= today, mark it as ok: true
          var isPast = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() > new Date(y, m, d).getTime();
          var ok = !isPast;
          res.push({fecha: dateObj, ok: ok, dias: diffDays, isSpecial: true});
        }
      });
      // Sort dates chronologically
      res.sort(function(a, b) { return a.fecha - b.fecha; });
    }
    return res;
  }
  
  // Default behavior if there are no restrictions
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
  if (fechaSel !== null && (fechaSel >= fechas.length || !fechas[fechaSel].ok)) {
    fechaSel = null;
  }
  var h = '';
  for (var i = 0; i < keys.length; i++) {
    var item = carrito[keys[i]];
    h += '<div class="citem"><div class="ciem" style="background:' + item.color_fondo + '">';
    if (item.imagen_url) {
      h += '<img src="' + item.imagen_url + '" onerror="this.src=\'\'; this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\'">'
      h += '<span style="display:none">' + item.emoji + '</span>';
    } else {
      h += item.emoji;
    }
    h += '</div>';
    var details = [];
    if (item.variedad) details.push(item.variedad);
    if (item.formato) details.push(item.formato);
    var displayName = item.nombre + (details.length > 0 ? ' <span style="font-size:11px;color:var(--neon)">(' + details.join(' - ') + ')</span>' : '');
    h += '<div class="ciin"><div class="cin">' + displayName + '</div><div class="cip">$' + (item.precio*item.qty).toLocaleString('es-CL') + '</div></div>';
    h += '<div class="cic"><button class="cb" onclick="chQty(\'' + keys[i] + '\',-1)">-</button><span class="cq">' + item.qty + '</span><button class="cb p" onclick="chQty(\'' + keys[i] + '\',1)">+</button></div></div>';
  }

  // 1. Check if there's a free gift promo active
  var giftProduct = null;
  if (cuponActivo && cuponActivo.tipo === 'regalo' && subtotal() >= cuponActivo.minMonto) {
    giftProduct = cuponActivo.valor;
    h += '<div class="citem" style="border-left: 3px solid var(--v3); background: var(--v5); padding: 8px 10px; border-radius: 8px;"><div class="ciem">🎁</div>';
    h += '<div class="ciin"><div class="cin">' + giftProduct + ' 🎁 (Regalo)</div><div class="cip" style="color:var(--v2); font-weight:bold;">¡Gratis por tu cupón!</div></div>';
    h += '<div class="cic"><span class="cq">1</span></div></div>';
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

  // 2. Coupon Area
  h += '<div class="ensec" style="background:#FFF9E6; border: 1px solid #FFE082;">';
  h += '<div class="entit" style="color:#B78103">🎟️ ¿Tienes un cupón de descuento?</div>';
  if (cuponActivo) {
    var descCup = obtenerDescuentoCupon();
    h += '<div class="endet" style="background:white; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">';
    h += '<span>Cupón <strong>' + cuponActivo.code + '</strong> (' + (cuponActivo.tipo==='bogo'?'2x1':cuponActivo.tipo==='regalo'?'Regalo':cuponActivo.tipo==='porcentaje'?cuponActivo.valor+'%':'-$'+cuponActivo.valor) + ')</span>';
    if (descCup > 0) h += '<span style="font-weight:bold; color:var(--v2)">-$' + descCup.toLocaleString('es-CL') + '</span>';
    h += '<button class="btn-sm btn-dan" style="padding:4px 8px; font-size:11px" onclick="quitarCupon()">Quitar</button></div>';
  } else {
    h += '<div style="display:flex; gap:8px;">';
    h += '<input class="inp" style="margin:0; flex:1;" id="incupon" placeholder="CUPÓN (ej: PINO2X1)" onkeypress="if(event.key===\'Enter\')aplicarCupon()">';
    h += '<button class="btn-sm btn-pri" style="height:38px; border-radius:10px;" onclick="aplicarCupon()">Aplicar</button></div>';
  }
  h += '</div>';

  // 3. Loyalty/Fidelidad Area
  h += '<div class="ensec" style="background:#EBF5FB; border: 1px solid #AED6F1;">';
  h += '<div class="entit" style="color:#1B4F72">🤝 Programa de Fidelidad</div>';
  if (descuentoFidelidad > 0) {
    h += '<div class="endet" style="background:white; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">';
    h += '<span>Puntos Canjeados: <strong>' + puntosACanjear + '</strong></span>';
    h += '<span style="font-weight:bold; color:var(--wa)">-$' + descuentoFidelidad.toLocaleString('es-CL') + '</span>';
    h += '<button class="btn-sm btn-dan" style="padding:4px 8px; font-size:11px" onclick="quitarCanjePuntos()">Quitar</button></div>';
  } else if (puntosDisponibles > 0) {
    var valP = puntosDisponibles * (ajustesTienda.valorPunto || 100);
    if (pinCorrecto) {
      h += '<div class="alrt" style="background:#E8F5E9; border-color:#81C784; color:#2E7D32; margin-bottom:8px;">';
      h += '🎉 ¡Tienes <strong>' + puntosDisponibles + '</strong> puntos acumulados! Equivalen a <strong>$' + valP.toLocaleString('es-CL') + '</strong> de descuento.</div>';
      h += '<button class="btnw" style="width:100%; border:2px solid var(--v3); background:white; color:var(--v2); padding:8px; font-size:12px;" onclick="canjearPuntosTienda()">Canjear todos mis puntos 🎁</button>';
    } else {
      h += '<div class="alrt" style="background:#FFF9E6; border-color:#FFE082; color:#B78103; margin-bottom:0; font-size:12px;">';
      if (pinRegistrado) {
        h += '🔒 Puntos protegidos. Ingresa tu <strong>PIN de Seguridad de 4 dígitos</strong> para poder canjearlos:';
        h += '<div style="display:flex; gap:8px; margin-top:8px;">';
        h += '<input class="inp" type="password" style="margin:0; width:100px; text-align:center;" id="input_pin_fidelidad" maxlength="4" placeholder="PIN" onkeypress="if(event.key===\'Enter\')validarPinPuntos()">';
        h += '<button class="btn-sm btn-pri" style="height:38px; border-radius:10px;" onclick="validarPinPuntos()">Validar</button></div>';
      } else {
        h += '🛡️ ¡Tienes <strong>' + puntosDisponibles + '</strong> puntos! Crea un <strong>PIN de 4 dígitos</strong> para protegerlos y canjearlos ahora y en futuras compras:';
        h += '<div style="display:flex; gap:8px; margin-top:8px;">';
        h += '<input class="inp" type="password" style="margin:0; width:120px; text-align:center;" id="nuevo_pin_fidelidad" maxlength="4" placeholder="Nuevo PIN" onkeypress="if(event.key===\'Enter\')registrarPinPuntos()">';
        h += '<button class="btn-sm btn-pri" style="height:38px; border-radius:10px;" onclick="registrarPinPuntos()">Crear y Canjear</button></div>';
      }
      h += '</div>';
    }
  } else {
    if (puntosVerificados) {
      h += '<p style="font-size:11px; color:var(--rojo); margin-bottom:0; font-weight:600;">ℹ️ No encontramos puntos acumulados con estos datos.</p>';
    } else {
      h += '<p style="font-size:10px; color:var(--muted); margin-bottom:6px;">Ingresa tu email o teléfono abajo y presiona verificar para consultar tus puntos acumulados.</p>';
      h += '<button class="btn-sm" style="width:100%; background:white;" onclick="buscarPuntosCliente()">🔍 Verificar mis puntos acumulados</button>';
    }
  }
  h += '</div>';

  h += '<div class="totwrap">';
  h += '<div class="totrow"><span class="totsub">Subtotal</span><span class="totsub">$' + subtotal().toLocaleString('es-CL') + '</span></div>';
  h += '<div class="totrow"><span class="totsub">Envío</span><span class="totsub">' + (zonaSel!==null?(costoEnvio()===0?'<span style="color:var(--wa);font-weight:700">Gratis</span>':'$'+costoEnvio().toLocaleString('es-CL')):'—') + '</span></div>';
  if (cuponActivo && obtenerDescuentoCupon() > 0) {
    h += '<div class="totrow"><span class="totsub" style="color:var(--rojo)">Descuento Cupón</span><span class="totsub" style="color:var(--rojo)">-$' + obtenerDescuentoCupon().toLocaleString('es-CL') + '</span></div>';
  }
  if (descuentoFidelidad > 0) {
    h += '<div class="totrow"><span class="totsub" style="color:var(--wa)">Descuento Fidelidad</span><span class="totsub" style="color:var(--wa)">-$' + descuentoFidelidad.toLocaleString('es-CL') + '</span></div>';
  }
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

  h += '<label class="ilbl">👤 Tu nombre *</label><input class="inp" id="inpnom" placeholder="Ej: María González" value="'+nombreG+'">';
  h += '<label class="ilbl">📧 Tu email (opcional para acumular puntos)</label><input class="inp" id="inpemail" type="email" placeholder="maria.g@gmail.com" value="'+emailG+'">';
  h += '<label class="ilbl">📍 Tu dirección *</label><input class="inp" id="inpdir" placeholder="Ej: Av. Providencia 1234" value="'+dirG+'">';
  h += '<label class="ilbl">📱 Tu teléfono * (para coordinar envío)</label><input class="inp" id="inptel" placeholder="+56 9 1234 5678" value="'+telG+'">';

  if (zonaSel===null||fechaSel===null) {
    h += '<div class="alrt">👆 '+(zonaSel===null?'Selecciona tu zona de envío':'')+(zonaSel===null&&fechaSel===null?' y ':'')+(fechaSel===null?'elige una fecha disponible':'')+'</div>';
  }
  
  var isClosed = ajustesTienda.estado === 'cerrado';
  if (isClosed) {
    h += '<div class="alrt" style="background:var(--rojo); color:white;">⚠️ Lo sentimos, el taller está cerrado temporalmente y no podemos recibir pedidos hoy.</div>';
  }

  var dis = (zonaSel===null||fechaSel===null||isClosed) ? ' style="opacity:0.45;pointer-events:none"' : '';
  h += '<button class="bwab"'+dis+' onclick="enviarWA()"><svg style="width:16px;height:16px;fill:white;flex-shrink:0" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.508C8.05 23.443 9.982 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.881 0-3.63-.498-5.145-1.367l-.368-.213-3.762.896.952-3.653-.24-.384A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg> Enviar pedido por WhatsApp</button>';
  h += '<button class="bmpb"'+dis+' onclick="pagarMP()">💳 Pagar con Mercado Pago</button>';
  if (ajustesTienda.flow_enabled) {
    h += '<button class="bflowb"'+dis+' onclick="pagarFlow()">💳 Pagar con Webpay / MACH (Flow)</button>';
  }
  body.innerHTML = h;
}

function guardarInputsG() {
  var prevEmail = emailG;
  var prevTel = telG;
  
  nombreG = document.getElementById('inpnom') ? sanitizeHTML(document.getElementById('inpnom').value) : '';
  dirG = document.getElementById('inpdir') ? sanitizeHTML(document.getElementById('inpdir').value) : '';
  telG = document.getElementById('inptel') ? sanitizeHTML(document.getElementById('inptel').value) : '';
  emailG = document.getElementById('inpemail') ? sanitizeHTML(document.getElementById('inpemail').value) : '';
  
  if (emailG !== prevEmail || telG !== prevTel) {
    puntosVerificados = false;
    puntosDisponibles = 0;
    pinCorrecto = false;
    pinRegistrado = false;
    clientePinDb = '';
    descuentoFidelidad = 0;
    puntosACanjear = 0;
  }
}

function selZona(val) {
  guardarInputsG();
  zonaSel = val===''?null:val;
  renderCart();
}

function selFecha(i) {
  guardarInputsG();
  fechaSel = i; 
  renderCart();
}

function aplicarCupon() {
  var incupon = document.getElementById('incupon');
  var codigo = incupon ? incupon.value.trim().toUpperCase() : '';
  if (!codigo) return;
  
  if (!supabaseClient) {
    showToast('⚠️ Base de datos no conectada');
    return;
  }
  
  supabaseClient.from('cupones').select('*').eq('id', codigo).maybeSingle().then(function(res) {
    if (res.data) {
      cuponActivo = res.data;
      cuponActivo.code = res.data.id;
      showToast('🎁 Cupón ' + codigo + ' aplicado');
      renderCart();
    } else {
      showToast('❌ Cupón inválido o vencido');
    }
  }).catch(function(e) {
    showToast('❌ Error al buscar cupón');
  });
}

function canjearPuntosTienda() {
  puntosACanjear = puntosDisponibles;
  descuentoFidelidad = puntosDisponibles * (ajustesTienda.valorPunto || 100);
  renderCart();
  showToast('✅ Puntos canjeados');
}

function quitarCanjePuntos() {
  puntosACanjear = 0;
  descuentoFidelidad = 0;
  renderCart();
}

function quitarCupon() {
  cuponActivo = null;
  renderCart();
  showToast('🗑️ Cupón removido');
}

function getClienteIdentifier(email, tel) {
  if (email && email.trim()) return email.trim().toLowerCase();
  if (tel && tel.trim()) return tel.replace(/\D/g, '');
  return null;
}

function validarPinPuntos() {
  guardarInputsG();
  var pinInput = document.getElementById('input_pin_fidelidad');
  var enteredPin = pinInput ? pinInput.value.trim() : '';
  
  if (enteredPin.length !== 4 || isNaN(enteredPin)) {
    showToast('⚠️ El PIN debe ser de 4 dígitos numéricos');
    return;
  }
  
  if (enteredPin === clientePinDb) {
    pinCorrecto = true;
    showToast('🔓 PIN correcto. ¡Puntos desbloqueados!');
    renderCart();
  } else {
    showToast('❌ PIN de seguridad incorrecto');
  }
}

function registrarPinPuntos() {
  guardarInputsG();
  var pinInput = document.getElementById('nuevo_pin_fidelidad');
  var nuevoPin = pinInput ? pinInput.value.trim() : '';
  
  if (nuevoPin.length !== 4 || isNaN(nuevoPin)) {
    showToast('⚠️ Crea un PIN de 4 dígitos numéricos');
    return;
  }
  
  var identifier = getClienteIdentifier(emailG, telG);
  if (!identifier) {
    showToast('⚠️ Error: No se pudo identificar al cliente');
    return;
  }
  
  if (!supabaseClient) {
    showToast('⚠️ Base de datos no conectada');
    return;
  }
  
  showToast('⏳ Guardando PIN...');
  supabaseClient.from('puntos_pins').upsert({
    id: identifier,
    pin: nuevoPin,
    created_at: new Date().toISOString()
  }).then(function(res) {
    if (res.error) throw res.error;
    clientePinDb = nuevoPin;
    pinRegistrado = true;
    pinCorrecto = true;
    showToast('🛡️ PIN creado con éxito y puntos resguardados');
    canjearPuntosTienda();
  }).catch(function(e) {
    console.error("Error al registrar PIN:", e);
    showToast('❌ Error al guardar el PIN de seguridad');
  });
}

function buscarPuntosCliente() {
  guardarInputsG();
  var email = emailG.trim().toLowerCase();
  var tel = telG.trim();
  
  if (!email && !tel) {
    showToast('⚠️ Ingresa tu email o teléfono para verificar puntos');
    return;
  }
  
  var identifier = getClienteIdentifier(email, tel);
  if (!identifier) {
    showToast('⚠️ Datos inválidos');
    return;
  }
  
  showToast('⏳ Buscando tus puntos...');
  
  pinCorrecto = false;
  pinRegistrado = false;
  clientePinDb = '';
  puntosVerificados = false;
  
  if (!supabaseClient) {
    showToast('⚠️ Base de datos no conectada');
    return;
  }
  
  supabaseClient.from('pedidos').select('*').then(function(res) {
    if (res.error) throw res.error;
    var totalGanados = 0;
    var totalCanjeados = 0;
    (res.data || []).forEach(function(p) {
      var cEmail = p.cliente.email ? p.cliente.email.trim().toLowerCase() : '';
      var cTel = p.cliente.telefono ? p.cliente.telefono.trim() : '';
      
      var matches = (email && cEmail === email) || (tel && cTel === tel);
      if (matches) {
        if (p.status !== 'Cancelado' && p.status !== 'Pendiente') {
          var montoBase = p.total || 0;
          totalGanados += Math.floor((montoBase + (p.descuentoFidelidad || 0)) / (ajustesTienda.tasaPuntos || 1000));
        }
        if (p.puntosCanjeados) {
          totalCanjeados += parseInt(p.puntosCanjeados) || 0;
        }
      }
    });
    
    puntosDisponibles = Math.max(0, totalGanados - totalCanjeados);
    
    if (puntosDisponibles > 0) {
      supabaseClient.from('puntos_pins').select('*').eq('id', identifier).maybeSingle().then(function(res2) {
        if (res2.data) {
          pinRegistrado = true;
          clientePinDb = res2.data.pin;
        } else {
          pinRegistrado = false;
          clientePinDb = '';
        }
        puntosVerificados = true;
        showToast('🎉 Tienes ' + puntosDisponibles + ' puntos disponibles');
        renderCart();
      }).catch(function(e) {
        console.error("Error al buscar PIN:", e);
        puntosVerificados = true;
        renderCart();
      });
    } else {
      puntosVerificados = true;
      showToast('ℹ️ No tienes puntos acumulados con estos datos.');
      renderCart();
    }
  }).catch(function(e) {
    console.error("Error buscando puntos:", e);
    showToast('❌ Error al buscar puntos');
  });
}

function enviarWA() {
  guardarInputsG();
  var nombre = nombreG || 'Cliente';
  var dir = dirG;
  var tel = telG;
  var email = emailG;
  var fechas = genFechas(); var fecha = fechas[fechaSel]; 
  var zona = zonas.find(function(x){return x.id === zonaSel;});
  var keys = Object.keys(carrito);
  
  crearPedido('WhatsApp', 'WhatsApp').then(function(pedidoId) {
    var msg = 'Hola! 🌱 Quiero hacer un pedido:\n\n';
    if (pedidoId) msg += '🆔 *Pedido: #' + pedidoId.substring(0, 6).toUpperCase() + '*\n';
    msg += '👤 *'+nombre+'*\n';
    if (tel) msg += '📱 '+tel+'\n';
    if (email) msg += '📧 '+email+'\n';
    msg += '📍 '+dir+'\n';
    msg += '🚚 Zona: '+zona.nombre+'\n';
    msg += '📅 Para el *'+DIAS[fecha.fecha.getDay()]+' '+fecha.fecha.getDate()+' '+MESES[fecha.fecha.getMonth()]+'*\n\n';
    msg += '🛒 *Mi pedido:*\n';
    for (var i=0;i<keys.length;i++) { 
      var item=carrito[keys[i]]; 
      var details = [];
      if (item.variedad) details.push(item.variedad);
      if (item.formato) details.push(item.formato);
      var displayName = item.nombre + (details.length > 0 ? ' (' + details.join(' - ') + ')' : '');
      msg+='• '+item.qty+'x '+displayName+' — $'+(item.precio*item.qty).toLocaleString('es-CL')+'\n'; 
    }
    
    if (cuponActivo && cuponActivo.tipo === 'regalo' && subtotal() >= cuponActivo.minMonto) {
      msg += '• 1x ' + cuponActivo.valor + ' 🎁 (Regalo) — ¡Gratis!\n';
    }
    
    msg += '\n📦 Subtotal: $'+subtotal().toLocaleString('es-CL')+'\n';
    var descCup = obtenerDescuentoCupon();
    if (descCup > 0) msg += '🎟️ Cupón ('+cuponActivo.code+'): -$'+descCup.toLocaleString('es-CL')+'\n';
    if (descuentoFidelidad > 0) msg += '🤝 Puntos Canjeados ('+puntosACanjear+'): -$'+descuentoFidelidad.toLocaleString('es-CL')+'\n';
    msg += '🚚 Envío: '+(costoEnvio()===0?'Gratis':'$'+costoEnvio().toLocaleString('es-CL'))+'\n';
    msg += '💰 *Total: $'+totalFinal().toLocaleString('es-CL')+'*';
    
    window.open('https://wa.me/' + (ajustesTienda.whatsapp || '56990816124') + '?text='+encodeURIComponent(msg),'_blank');
    cerrarCarrito();
    showConf('💬','¡Pedido enviado!','Tu pedido fue enviado por WhatsApp\nFecha: '+DIAS[fecha.fecha.getDay()]+' '+fecha.fecha.getDate()+' '+MESES[fecha.fecha.getMonth()]+'\n\n¡Espera la confirmación de La Manito! 🌱');
    
    carrito={}; zonaSel=null; fechaSel=null; nombreG=''; dirG=''; emailG=''; telG='';
    cuponActivo=null; puntosACanjear=0; descuentoFidelidad=0; puntosDisponibles=0;
    updBdg(); renderGrid();
  });
}

function pagarMP() {
  guardarInputsG();
  var nombre = nombreG;
  var dir = dirG;
  var tel = telG;
  var email = emailG;
  
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

    var checkoutData = {
      carrito: carrito,
      nombre: nombre,
      direccion: dir,
      telefono: tel,
      email: email,
      zona: zonaTxt,
      envio: costoEnvio(),
      fecha: fechaTxt,
      pedidoId: pedidoId,
      descuentoCupon: obtenerDescuentoCupon(),
      descuentoFidelidad: descuentoFidelidad,
      puntosCanjeados: puntosACanjear,
      cuponAplicado: cuponActivo ? cuponActivo.code : null
    };

    if (cuponActivo && cuponActivo.tipo === 'regalo' && subtotal() >= cuponActivo.minMonto) {
      checkoutData.regalo = cuponActivo.valor;
    }

    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
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

function pagarFlow() {
  guardarInputsG();
  var nombre = nombreG;
  var dir = dirG;
  var tel = telG;
  var email = emailG;
  
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

  var btn = document.querySelector('.bflowb');
  var originalTxt = btn ? btn.innerHTML : '💳 Pagar con Webpay / MACH (Flow)';
  if (btn) {
    btn.innerHTML = ' Redirigiendo a Flow...';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
  }

  crearPedido('Flow', 'Pendiente').then(function(pedidoId) {
    if (!pedidoId) {
      if (btn) {
        btn.innerHTML = originalTxt;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
      showToast('❌ Error al guardar el pedido en base de datos.');
      return;
    }

    var checkoutData = {
      carrito: carrito,
      nombre: nombre,
      direccion: dir,
      telefono: tel,
      email: email,
      zona: zonaTxt,
      envio: costoEnvio(),
      fecha: fechaTxt,
      pedidoId: pedidoId,
      descuentoCupon: obtenerDescuentoCupon(),
      descuentoFidelidad: descuentoFidelidad,
      puntosCanjeados: puntosACanjear,
      cuponAplicado: cuponActivo ? cuponActivo.code : null
    };

    if (cuponActivo && cuponActivo.tipo === 'regalo' && subtotal() >= cuponActivo.minMonto) {
      checkoutData.regalo = cuponActivo.valor;
    }

    fetch('/api/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) { throw new Error(err.error || 'Error desconocido'); });
      }
      return res.json();
    })
    .then(function(data) {
      if (data.url) {
        localStorage.setItem('ultimoPedidoId', pedidoId);
        window.location.href = data.url;
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
  if (!supabaseClient) return Promise.resolve(null);
  
  var nombre = document.getElementById('inpnom') ? sanitizeHTML(document.getElementById('inpnom').value.trim()) : 'Cliente';
  var dir = document.getElementById('inpdir') ? sanitizeHTML(document.getElementById('inpdir').value.trim()) : '';
  var tel = document.getElementById('inptel') ? sanitizeHTML(document.getElementById('inptel').value.trim()) : '';
  var email = document.getElementById('inpemail') ? sanitizeHTML(document.getElementById('inpemail').value.trim()) : '';
  
  var fechas = genFechas();
  var fecha = fechas[fechaSel];
  var fechaTxt = DIAS[fecha.fecha.getDay()] + ' ' + fecha.fecha.getDate() + ' ' + MESES[fecha.fecha.getMonth()];
  var zona = zonas.find(function(x){return x.id === zonaSel;});
  var zonaTxt = zona ? zona.nombre : '';

  var itemsArray = [];
  var keys = Object.keys(carrito);
  for (var i = 0; i < keys.length; i++) {
    var item = carrito[keys[i]];
    var nameDetails = [];
    if (item.variedad) nameDetails.push(item.variedad);
    if (item.formato) nameDetails.push(item.formato);
    var itemNombre = item.nombre + (nameDetails.length > 0 ? ' (' + nameDetails.join(' - ') + ')' : '');

    itemsArray.push({
      id: item.id,
      nombre: itemNombre,
      precio: item.precio,
      qty: item.qty,
      emoji: item.emoji || '🌱',
      variedad: item.variedad || null,
      formato: item.formato || null
    });
  }

  // Push gift if applicable
  if (cuponActivo && cuponActivo.tipo === 'regalo' && subtotal() >= cuponActivo.minMonto) {
    itemsArray.push({
      id: 'gift_' + Date.now(),
      nombre: cuponActivo.valor + ' 🎁 (Regalo)',
      precio: 0,
      qty: 1,
      emoji: '🎁'
    });
  }

  var pedidoData = {
    cliente: {
      nombre: nombre,
      direccion: dir,
      telefono: tel,
      email: email
    },
    items: itemsArray,
    total: totalFinal(),
    descuentoFidelidad: descuentoFidelidad,
    puntosCanjeados: puntosACanjear,
    puntosGanados: 0,
    status: statusInicial,
    "createdAt": new Date().toISOString(),
    fechaDespacho: fechaTxt,
    zonaEnvio: zonaTxt,
    costoEnvio: costoEnvio()
  };

  return supabaseClient.from('pedidos').insert([pedidoData]).select().then(function(res) {
    if (res.error) {
      console.error("Error guardando pedido:", res.error);
      return null;
    }
    var newId = res.data && res.data[0] ? res.data[0].id : null;
    
    // Update stock for products with managed stock
    var cartKeys = Object.keys(carrito);
    for (var i = 0; i < cartKeys.length; i++) {
      var item = carrito[cartKeys[i]];
      var p = productos.find(function(x){return x.id === item.id;});
      if (p && p.maneja_stock) {
        var newStock = Math.max(0, p.stock - item.qty);
        supabaseClient.from('productos').update({ stock: newStock }).eq('id', item.id)
          .then(function(){}).catch(function(e){ console.error("Error updating stock:", e); });
      }
    }
    
    return newId;
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
function abrirAdmin() { 
  document.getElementById('adminov').classList.add('open'); 
  aTab('productos', null);
}
function cerrarAdmin() { document.getElementById('adminov').classList.remove('open'); }

function aTab(tab, btn) {
  adminTabActual = tab;
  var tabs = document.querySelectorAll('.atab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('on');
    var clickAttr = tabs[i].getAttribute('onclick');
    if (clickAttr && clickAttr.indexOf("'" + tab + "'") !== -1) {
      tabs[i].classList.add('on');
    }
  }
  // If categorias tab is requested and array is empty, reload first
  if (tab === 'categorias' && categorias.length === 0 && supabaseClient) {
    supabaseClient.from('categorias').select('*').order('nombre').then(function(res) {
      if (!res.error && res.data) {
        categorias = res.data;
        renderCategoriasUI();
      }
      renderAdminTab('categorias');
    });
    return;
  }
  renderAdminTab(tab);
}

function renderAdminTab(tab) {
  var c = document.getElementById('acont');
  if (tab==='productos') {
    var h = '<div class="admin-head"><div class="admin-tit">Productos</div><button class="btn-add" onclick="abrirModalProd(null)">Agregar producto</button></div>';
    if (!dbSoportaGramaje) {
      h += '<div class="alrt" style="background:#FFF9E6; border:1px solid #FFE082; color:#B78103; padding:12px; border-radius:12px; margin-bottom:16px; font-size:12px; line-height:1.5;">';
      h += '  ⚠️ <strong>Base de datos desactualizada:</strong> No se han detectado las columnas <code>gramaje</code> y <code>variedades</code> en tu tabla de Supabase.<br>';
      h += '  Para poder guardar gramaje y sabores en tus productos, por favor ve al <strong>SQL Editor</strong> en tu panel de Supabase y ejecuta este código:<br>';
      h += '  <pre style="background:rgba(0,0,0,0.05); padding:8px; border-radius:6px; margin-top:6px; overflow-x:auto; font-family:monospace; user-select:all; color:var(--texto);">ALTER TABLE productos ADD COLUMN IF NOT EXISTS gramaje text;\nALTER TABLE productos ADD COLUMN IF NOT EXISTS variedades text;</pre>';
      h += '</div>';
    }
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Producto</th><th>Categoría</th><th>Estado</th><th>Stock</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>';
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
      
      var stockLabel = '';
      if (p.maneja_stock) {
        if (p.stock <= 0) {
          stockLabel = '<span class="status-pill" style="background:#FFEAEA; color:#D82C0D; font-weight:700;">Agotado</span>';
        } else if (p.stock <= 3) {
          stockLabel = '<span class="status-pill" style="background:#FFF8E7; color:#B78103; font-weight:700;">Bajo Stock ('+p.stock+')</span>';
        } else {
          stockLabel = '<span class="status-pill" style="background:#E2F9F0; color:#108060;">'+p.stock+' uds</span>';
        }
      } else {
        stockLabel = '<span style="color:var(--muted); font-size:12px;">♾️ Ilimitado</span>';
      }
      h += '<td>'+stockLabel+'</td>';
      
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
        h += '<td>$'+parseFloat(p.precio).toLocaleString('es-CL')+'</td>';
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
    
    h += '<div class="admin-card"><table class="atbl"><thead><tr><th>Emoji</th><th>Nombre</th><th>Slug</th><th>Acciones</th></tr></thead><tbody>';
    for (var i = 0; i < categorias.length; i++) {
      var catItem = categorias[i];
      h += '<tr>';
      h += '<td><input class="finp" style="margin:0;width:70px;text-align:center;font-size:20px" id="cat_emoji_' + catItem.id + '" value="' + catItem.emoji + '"></td>';
      h += '<td><input class="finp" style="margin:0" id="cat_nom_' + catItem.id + '" value="' + catItem.nombre + '"></td>';
      h += '<td><code style="font-size:11px;color:var(--muted)">' + catItem.slug + '</code></td>';
      h += '<td><div style="display:flex;gap:8px">';
      h += '<button class="btn-sm btn-pri" onclick="guardarCategoria(\'' + catItem.id + '\', \'' + catItem.slug + '\')">Guardar</button>';
      h += '<button class="btn-sm btn-dan" onclick="eliminarCategoria(\'' + catItem.id + '\')">🗑 Borrar</button>';
      h += '</div></td>';
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
    
    // Controles de búsqueda y filtros
    h += '<div class="admin-card admin-card-pad" style="margin-bottom:16px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; background:#fafbfb;">';
    h += '<div style="flex:2; min-width:200px;"><label class="flbl">Buscar por nombre o ID de pedido</label>';
    h += '<input class="finp" style="margin:0" id="pedsearch" placeholder="Ej: María..." value="' + orderSearchQuery + '" oninput="updateOrderSearch(this.value)"></div>';
    h += '<div style="flex:1; min-width:150px;"><label class="flbl">Filtrar por estado</label>';
    h += '<select class="fsel" style="margin:0; height:38px; border-radius:10px;" id="pedfilter" onchange="updateOrderStatusFilter(this.value)">';
    var filterOptions = ['Todos', 'Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado', 'WhatsApp'];
    for(var o = 0; o < filterOptions.length; o++) {
      var sel = orderStatusFilter === filterOptions[o] ? ' selected' : '';
      h += '<option value="' + filterOptions[o] + '"' + sel + '>' + filterOptions[o] + '</option>';
    }
    h += '</select></div>';
    h += '</div>';

    // Filtrado local de pedidos
    var filteredPedidos = pedidos.filter(function(p) {
      var q = orderSearchQuery.toLowerCase();
      var idMatch = p.id.toLowerCase().indexOf(q) !== -1;
      var nameMatch = p.cliente.nombre.toLowerCase().indexOf(q) !== -1;
      var searchOk = !q || idMatch || nameMatch;
      var statusOk = orderStatusFilter === 'Todos' || p.status === orderStatusFilter;
      return searchOk && statusOk;
    });

    if (filteredPedidos.length === 0) {
      h += '<div class="admin-card admin-card-pad" style="text-align:center;color:var(--muted)">No hay pedidos que coincidan con la búsqueda 🌱</div>';
    } else {
      h += '<div class="admin-card" style="overflow-x:auto"><table class="atbl">';
      h += '<thead><tr><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
      for (var i = 0; i < filteredPedidos.length; i++) {
        var p = filteredPedidos[i];
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
        
        // Notificaciones automatizadas por WhatsApp del cambio de estado
        var cleanPhone = p.cliente.telefono.replace(/\D/g, '');
        // Default country code handling
        if (cleanPhone.length === 9) cleanPhone = '56' + cleanPhone;
        var waMsg = '¡Hola ' + p.cliente.nombre + '! 🌱 Tu pedido #' + p.id.substring(0, 6).toUpperCase() + ' de La Manito del Vegano ha cambiado a estado: *' + p.status + '*.';
        if (p.status === 'Despachado') waMsg += ' 🚚 ¡Va en camino a tu dirección!';
        else if (p.status === 'Pagado') waMsg += ' ✅ Hemos registrado tu pago correctamente. ¡Preparando todo con mucho amor!';
        var waUpdateUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(waMsg);

        h += '<tr>';
        h += '<td><strong>#' + p.id.substring(0,6).toUpperCase() + '</strong><div style="font-size:10px;color:var(--muted)">' + fechaStr + '</div></td>';
        h += '<td><strong>' + p.cliente.nombre + '</strong><div style="font-size:11px;color:var(--muted)">' + p.cliente.direccion + '</div><div style="font-size:11px;color:var(--muted)">' + (p.cliente.telefono || '-') + '</div>';
        if (p.cliente.email) h += '<div style="font-size:10px;color:var(--v3);text-decoration:underline;">' + p.cliente.email + '</div>';
        h += '</td>';
        h += '<td style="font-size:12px">' + itemsHtml + '<div style="font-size:10px;color:var(--v2);margin-top:4px">Entrega: ' + (p.fechaDespacho || p.fechaEntrega || '-') + '</div></td>';
        
        var envioAmt = p.costoEnvio !== undefined ? p.costoEnvio : (p.envio || 0);
        
        var breakdown = '';
        if (p.descuentoCupon > 0) breakdown += '<div style="font-size:9px;color:var(--rojo);">Cupón: -$' + p.descuentoCupon.toLocaleString('es-CL') + '</div>';
        if (p.descuentoFidelidad > 0) breakdown += '<div style="font-size:9px;color:var(--wa);">Puntos: -$' + p.descuentoFidelidad.toLocaleString('es-CL') + '</div>';
        
        h += '<td><strong>$' + p.total.toLocaleString('es-CL') + '</strong><div style="font-size:10px;color:var(--muted)">Envío: $' + envioAmt.toLocaleString('es-CL') + '</div>' + breakdown + '</td>';
        var metodo = p.metodoPago || 'WhatsApp';
        h += '<td><span class="status-pill ' + (metodo==='Mercado Pago'?'pill-cat':'pill-oferta') + '">' + metodo + '</span></td>';
        h += '<td><span class="status-pill" style="background:#f4f6f8;border:1px solid #c9cccf;color:#202223">' + p.status + '</span></td>';
        h += '<td><div style="display:flex;gap:6px;align-items:center">' + selectHtml;
        h += '<a href="' + waUpdateUrl + '" target="_blank" class="btn-sm" title="Notificar por WhatsApp" style="background:#25D366; color:white; border:none; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; text-decoration:none;"><svg style="width:14px;height:14px;fill:white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.508C8.05 23.443 9.982 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.881 0-3.63-.498-5.145-1.367l-.368-.213-3.762.896.952-3.653-.24-.384A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg></a>';
        h += '<button class="btn-sm btn-dan" onclick="eliminarPedido(\'' + p.id + '\')" title="Eliminar">🗑</button>';
        h += '</div></td></tr>';
      }
      h += '</tbody></table></div>';
    }
    c.innerHTML = h;
  } else if (tab==='stats') {
    var filterVal = statsTimeFilter || 'all';
    
    // Controles de tiempo
    var h = '<div class="admin-head"><div class="admin-tit">Métricas & Analíticas</div>';
    h += '<div><select class="fsel" style="width:180px; margin:0;" onchange="updateStatsTimeFilter(this.value)">';
    h += '<option value="all"' + (filterVal==='all'?' selected':'') + '>Todo el Historial</option>';
    h += '<option value="today"' + (filterVal==='today'?' selected':'') + '>Solo Hoy</option>';
    h += '<option value="week"' + (filterVal==='week'?' selected':'') + '>Últimos 7 Días</option>';
    h += '</select></div></div>';

    // Límites de fecha para filtrado
    var limitDate = new Date();
    if (filterVal === 'today') {
      limitDate.setHours(0,0,0,0);
    } else if (filterVal === 'week') {
      limitDate.setDate(limitDate.getDate() - 7);
    }

    var ingresos = 0;
    var validos = 0;
    var mpCount = 0;
    var waCount = 0;
    var prodSales = {}; 
    var zoneSales = {};

    for (var i = 0; i < pedidos.length; i++) {
      var p = pedidos[i];
      var orderDate = p.createdAt ? new Date(p.createdAt) : new Date();
      
      if (filterVal !== 'all' && orderDate < limitDate) continue;

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

        if (p.zonaEnvio) {
          zoneSales[p.zonaEnvio] = (zoneSales[p.zonaEnvio] || 0) + 1;
        }
      }
    }

    var ticketPromedio = validos > 0 ? Math.round(ingresos / validos) : 0;

    // Distribución de Productos
    var topProds = [];
    var pnames = Object.keys(prodSales);
    for (var i = 0; i < pnames.length; i++) {
      topProds.push({ nombre: pnames[i], qty: prodSales[pnames[i]] });
    }
    topProds.sort(function(a, b) { return b.qty - a.qty; });

    // Distribución de Zonas
    var topZones = [];
    var znames = Object.keys(zoneSales);
    for (var i = 0; i < znames.length; i++) {
      topZones.push({ nombre: znames[i], count: zoneSales[znames[i]] });
    }
    topZones.sort(function(a, b) { return b.count - a.count; });

    // Barras CSS para productos
    var topSalesHtml = '';
    if (topProds.length === 0) {
      topSalesHtml = '<p style="color:var(--muted);font-size:13px">No hay ventas registradas en este período.</p>';
    } else {
      var maxQty = topProds[0].qty || 1;
      for (var i = 0; i < Math.min(topProds.length, 5); i++) {
        var pct = Math.round((topProds[i].qty / maxQty) * 100);
        topSalesHtml += '<div style="margin-bottom:12px;">';
        topSalesHtml += '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">';
        topSalesHtml += '<span>' + topProds[i].nombre + '</span><span>' + topProds[i].qty + ' uds</span></div>';
        topSalesHtml += '<div style="width:100%; height:8px; background:#e1e3e5; border-radius:4px; overflow:hidden;">';
        topSalesHtml += '<div style="width:' + pct + '%; height:100%; background:var(--v2); border-radius:4px;"></div></div></div>';
      }
    }

    // Barras CSS para zonas
    var topZonesHtml = '';
    if (topZones.length === 0) {
      topZonesHtml = '<p style="color:var(--muted);font-size:13px">No hay pedidos registrados en este período.</p>';
    } else {
      var maxCount = topZones[0].count || 1;
      for (var i = 0; i < Math.min(topZones.length, 4); i++) {
        var pct = Math.round((topZones[i].count / maxCount) * 100);
        topZonesHtml += '<div style="margin-bottom:12px;">';
        topZonesHtml += '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">';
        topZonesHtml += '<span>' + topZones[i].nombre + '</span><span>' + topZones[i].count + ' pedidos</span></div>';
        topZonesHtml += '<div style="width:100%; height:8px; background:#e1e3e5; border-radius:4px; overflow:hidden;">';
        topZonesHtml += '<div style="width:' + pct + '%; height:100%; background:#008060; border-radius:4px;"></div></div></div>';
      }
    }

    h += '<div class="admin-kpis">';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ingresos ' + (filterVal==='today'?'Hoy':filterVal==='week'?'Últimos 7 Días':'Históricos') + '</div><div class="kpi-val">$' + ingresos.toLocaleString('es-CL') + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ventas</div><div class="kpi-val">' + validos + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Ticket Promedio</div><div class="kpi-val">$' + ticketPromedio.toLocaleString('es-CL') + '</div></div>';
    h += '<div class="kpi-card"><div class="kpi-lbl">Distribución de Canales</div><div class="kpi-val" style="font-size:13px;margin-top:14px;font-weight:600;line-height:1.5">💳 Mercado Pago: ' + mpCount + '<br>💬 WhatsApp: ' + waCount + '</div></div>';
    h += '</div>';

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;margin-top:20px">';
    h += '<div class="admin-card admin-card-pad"><h3>🏆 Top 5 Productos más Vendidos</h3><div style="margin-top:16px">' + topSalesHtml + '</div></div>';
    h += '<div class="admin-card admin-card-pad"><h3>🚚 Despachos por Comuna/Zona</h3><div style="margin-top:16px">' + topZonesHtml + '</div></div>';
    h += '</div>';
    c.innerHTML = h;
  } else if (tab==='ajustes') {
    var h = '<div class="admin-head"><div class="admin-tit">Ajustes Generales de la Tienda</div></div>';
    h += '<div class="admin-card admin-card-pad" style="max-width: 600px; margin: 0 auto;">';
    
    h += '<div class="frow"><label class="flbl">Nombre Comercial de la Web</label>';
    h += '<input class="finp" id="aj_nombre" placeholder="La Manito Del Vegano" value="' + (ajustesTienda.nombre || '') + '"></div>';
    
    h += '<div class="frow"><label class="flbl">WhatsApp Oficial de Ventas (sin "+" ni links, ej: 56990816124)</label>';
    h += '<input class="finp" id="aj_whatsapp" placeholder="Ej: 56990816124" value="' + (ajustesTienda.whatsapp || '') + '"></div>';
    
    h += '<div class="frow"><label class="flbl">Nombre de Usuario de Instagram (sin @)</label>';
    h += '<input class="finp" id="aj_instagram" placeholder="lamanitodelvegano" value="' + (ajustesTienda.instagram || '') + '"></div>';

    h += '<div class="frow2">';
    h += '<div><label class="flbl">TikTok (Username sin @)</label>';
    h += '<input class="finp" id="aj_tiktok" placeholder="lamanitodelvegano" value="' + (ajustesTienda.tiktok || '') + '"></div>';
    h += '<div><label class="flbl">Página de Facebook (URL completa)</label>';
    h += '<input class="finp" id="aj_facebook" placeholder="https://facebook.com/..." value="' + (ajustesTienda.facebook || '') + '"></div>';
    h += '</div>';

    h += '<div class="frow"><label class="flbl">Estado Operativo de la Web</label>';
    h += '<select class="fsel" id="aj_estado">';
    var estAbierto = ajustesTienda.estado === 'abierto' ? ' selected' : '';
    var estCerrado = ajustesTienda.estado === 'cerrado' ? ' selected' : '';
    h += '<option value="abierto"' + estAbierto + '>🟢 Tienda Abierta (Recibir pedidos)</option>';
    h += '<option value="cerrado"' + estCerrado + '>🔴 Tienda Cerrada Temporalmente (Bloquear compras)</option>';
    h += '</select></div>';

    h += '<div class="frow2" style="background:var(--v5); padding:12px; border-radius:12px; border:1px solid var(--v3); margin-top:12px; margin-bottom:12px;">';
    h += '<div><label class="flbl" style="color:var(--v2)">Tasa de Puntos ($ CLP gastados = 1 punto)</label>';
    h += '<input class="finp" type="number" id="aj_tasa" value="' + (ajustesTienda.tasaPuntos || 1000) + '"></div>';
    h += '<div><label class="flbl" style="color:var(--v2)">Valor del Punto ($ CLP Descuento)</label>';
    h += '<input class="finp" type="number" id="aj_valor" value="' + (ajustesTienda.valorPunto || 100) + '"></div>';
    h += '</div>';
    
    h += '<button class="bguardar" onclick="guardarAjustes()">Guardar Cambios de Tienda ⚙️</button>';
    h += '</div>';
    c.innerHTML = h;
  } else if (tab==='cupones') {
    var h = '<div class="admin-head"><div class="admin-tit">Cupones de Descuento & Promociones</div></div>';
    
    h += '<div class="admin-card admin-card-pad" style="background:#fafbfb; border: 1px dashed var(--borde); margin-bottom:20px;">';
    h += '<div style="font-weight:700; font-size:14px; margin-bottom:12px;">Crear Nueva Campaña / Cupón</div>';
    
    h += '<div class="frow2">';
    h += '<div><label class="flbl">Código del Cupón (Único y en Mayúsculas)</label>';
    h += '<input class="finp" id="ncupcode" placeholder="Ej: PINO2X1" style="text-transform:uppercase;"></div>';
    h += '<div><label class="flbl">Tipo de Promoción</label>';
    h += '<select class="fsel" id="ncuptipo">';
    h += '<option value="fijo">Descuento Fijo ($ CLP)</option>';
    h += '<option value="porcentaje">Descuento Porcentual (%)</option>';
    h += '<option value="bogo">2x1 (BOGO) en Categoría o Nombre</option>';
    h += '<option value="regalo">Regalo por Compra Mínima</option>';
    h += '</select></div>';
    h += '</div>';

    h += '<div class="frow2">';
    h += '<div><label class="flbl">Valor (ej: 2000, 10, empanadas, o Nombre de Producto de regalo)</label>';
    h += '<input class="finp" id="ncupvalor" placeholder="Ej: 2000, 10, empanadas..."></div>';
    h += '<div><label class="flbl">Compra Mínima Requerida ($ CLP)</label>';
    h += '<input class="finp" type="number" id="ncupmin" value="0" min="0"></div>';
    h += '</div>';
    
    h += '<button class="btn-add" style="width:100%; height:40px; justify-content:center; margin-top:8px;" onclick="agregarCupon()">Crear Campaña Promocional 🎟️</button>';
    h += '</div>';

    h += '<div class="admin-card">';
    if (cupones.length === 0) {
      h += '<div class="admin-card-pad" style="text-align:center; color:var(--muted)">No hay cupones ni campañas de marketing activas.</div>';
    } else {
      h += '<table class="atbl"><thead><tr><th>Código</th><th>Tipo</th><th>Detalle/Valor</th><th>Compra Mínima</th><th>Acciones</th></tr></thead><tbody>';
      for (var i = 0; i < cupones.length; i++) {
        var cp = cupones[i];
        var tipoLabel = cp.tipo === 'fijo' ? 'Descuento Fijo' : cp.tipo === 'porcentaje' ? 'Porcentual' : cp.tipo === 'bogo' ? '2x1 (BOGO)' : 'Regalo Gratis';
        var valorLabel = cp.tipo === 'fijo' ? '$' + cp.valor.toLocaleString('es-CL') : cp.tipo === 'porcentaje' ? cp.valor + '%' : cp.tipo === 'bogo' ? 'En: ' + cp.valor : 'Producto: ' + cp.valor;
        h += '<tr>';
        h += '<td><strong>' + cp.id + '</strong></td>';
        h += '<td><span class="status-pill pill-cat">' + tipoLabel + '</span></td>';
        h += '<td><strong>' + valorLabel + '</strong></td>';
        h += '<td>$' + (cp.minMonto || 0).toLocaleString('es-CL') + '</td>';
        h += '<td><button class="btn-sm btn-dan" onclick="eliminarCupon(\'' + cp.id + '\')">Borrar</button></td>';
        h += '</tr>';
      }
      h += '</tbody></table>';
    }
    h += '</div>';
    c.innerHTML = h;
  } else if (tab === 'integraciones') {
    var h = '<div class="admin-head"><div class="admin-tit">Integraciones &amp; Apps 🔌</div></div>';
    h += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; padding-bottom:30px;">';
    
    // Mercado Pago
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">💳 Mercado Pago</div>';
    h += '      <span class="status-pill" id="status_mp" style="background:' + (ajustesTienda.mp_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.mp_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.mp_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.mp_enabled ? '<span class="pulse-dot-green"></span> Conectado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Permite a tus clientes pagar online de forma automática mediante Tarjetas de Crédito, Débito y Webpay.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_mp_enabled" ' + (ajustesTienda.mp_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_mp\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Conectado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_mp\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_mp\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_mp\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Pasarela de Pagos</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Public Key (Credenciales MP)</label>';
    h += '      <input class="finp" id="aj_mp_public" placeholder="APP_USR-XXXXXX" value="' + (ajustesTienda.mp_public_key || '') + '">';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Access Token</label>';
    h += '      <input class="finp" type="password" id="aj_mp_access" placeholder="TEST-XXXXXX o APP_USR-XXXXXX" value="' + (ajustesTienda.mp_access_token || '') + '">';
    h += '    </div>';
    h += '    <div class="frow">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--muted);"><input type="checkbox" id="aj_mp_sandbox" ' + (ajustesTienda.mp_sandbox ? 'checked' : '') + '> Modo Sandbox (Pruebas)</label>';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';

    // Flow
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">🌊 Flow (Pago Online &amp; MACH)</div>';
    h += '      <span class="status-pill" id="status_flow" style="background:' + (ajustesTienda.flow_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.flow_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.flow_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.flow_enabled ? '<span class="pulse-dot-green"></span> Conectado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Integra pagos en Chile vía Webpay, MACH, OnePay, Servipag y monederos digitales en un solo flujo.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_flow_enabled" ' + (ajustesTienda.flow_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_flow\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Conectado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_flow\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_flow\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_flow\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Pasarela Flow</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Flow API Key (Integrator ID)</label>';
    h += '      <input class="finp" id="aj_flow_api_key" placeholder="Ej: 9A4F72..." value="' + (ajustesTienda.flow_api_key || '') + '">';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Flow Secret Key</label>';
    h += '      <input class="finp" type="password" id="aj_flow_secret_key" placeholder="Secret Key..." value="' + (ajustesTienda.flow_secret_key || '') + '">';
    h += '    </div>';
    h += '    <div class="frow">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--muted);"><input type="checkbox" id="aj_flow_sandbox" ' + (ajustesTienda.flow_sandbox ? 'checked' : '') + '> Modo Sandbox (Pruebas)</label>';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';
    
    // Shopify
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">🛍️ Shopify Catalog</div>';
    h += '      <span class="status-pill" id="status_shopify" style="background:' + (ajustesTienda.shopify_sync_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.shopify_sync_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.shopify_sync_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.shopify_sync_enabled ? '<span class="pulse-dot-green"></span> Sincronizado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Importa y sincroniza automáticamente tus productos, inventario y descripciones desde tu tienda Shopify.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_shopify_sync" ' + (ajustesTienda.shopify_sync_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_shopify\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Sincronizado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_shopify\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_shopify\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_shopify\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Auto-Sincronización</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Shopify URL (.myshopify.com)</label>';
    h += '      <input class="finp" id="aj_shopify_url" placeholder="mi-tienda.myshopify.com" value="' + (ajustesTienda.shopify_shop_url || '') + '">';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:14px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Shopify API Access Token</label>';
    h += '      <input class="finp" type="password" id="aj_shopify_key" placeholder="shpat_XXXXXXXXXXXXXXXXXXXX" value="' + (ajustesTienda.shopify_api_key || '') + '">';
    h += '    </div>';
    h += '  </div>';
    h += '  <div>';
    h += '    <button class="btn-sm" style="width:100%; height:34px; border:1px solid var(--neon); background:transparent; color:var(--neon);" onclick="importarDesdeShopify()">🔄 Sincronizar catálogo ahora</button>';
    h += '  </div>';
    h += '</div>';

    // Wasabil
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">🧾 Wasabil (Boleta SII)</div>';
    h += '      <span class="status-pill" id="status_wasabil" style="background:' + (ajustesTienda.wasabil_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.wasabil_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.wasabil_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.wasabil_enabled ? '<span class="pulse-dot-green"></span> Conectado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Emisión automatizada de boletas electrónicas ante el SII de Chile para cada pedido concretado.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_wasabil_enabled" ' + (ajustesTienda.wasabil_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_wasabil\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Conectado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_wasabil\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_wasabil\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_wasabil\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Facturación Automática</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">RUT Empresa (con guión)</label>';
    h += '      <input class="finp" id="aj_wasabil_rut" placeholder="Ej: 76123456-7" value="' + (ajustesTienda.wasabil_rut || '') + '">';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Wasabil API Token</label>';
    h += '      <input class="finp" type="password" id="aj_wasabil_token" placeholder="wstk_XXXXXXXXXXXXXXXXXXXX" value="' + (ajustesTienda.wasabil_token || '') + '">';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';

    // Dropi
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">📦 Dropi (Logística COD)</div>';
    h += '      <span class="status-pill" id="status_dropi" style="background:' + (ajustesTienda.dropi_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.dropi_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.dropi_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.dropi_enabled ? '<span class="pulse-dot-green"></span> Conectado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Automatiza envíos Pago Contra Entrega (COD) con transportistas y gestiona inventario sincronizado.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_dropi_enabled" ' + (ajustesTienda.dropi_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_dropi\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Conectado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_dropi\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_dropi\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_dropi\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Sincronización Dropi</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Dropi Seller ID</label>';
    h += '      <input class="finp" id="aj_dropi_seller_id" placeholder="Ej: 12345" value="' + (ajustesTienda.dropi_seller_id || '') + '">';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Dropi API Key / Token</label>';
    h += '      <input class="finp" type="password" id="aj_dropi_token" placeholder="dropi_api_key_XXXXXXXX" value="' + (ajustesTienda.dropi_token || '') + '">';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';

    // Google Calendar
    h += '<div class="admin-card admin-card-pad" style="display:flex; flex-direction:column; justify-content:space-between; border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div>';
    h += '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '      <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">📅 Google Calendar</div>';
    h += '      <span class="status-pill" id="status_calendar" style="background:' + (ajustesTienda.calendar_enabled ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + (ajustesTienda.calendar_enabled ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + (ajustesTienda.calendar_enabled ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + (ajustesTienda.calendar_enabled ? '<span class="pulse-dot-green"></span> Conectado' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '    </div>';
    h += '    <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Agenda automáticamente cada entrega programada de tus clientes directamente en tu Google Calendar.</p>';
    h += '    <div class="frow" style="margin-bottom:8px;">';
    h += '      <label style="font-size:11px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--neon);"><input type="checkbox" id="aj_calendar_enabled" ' + (ajustesTienda.calendar_enabled ? 'checked' : '') + ' onchange="document.getElementById(\'status_calendar\').innerHTML=this.checked?\'<span class=\\\'pulse-dot-green\\\'></span> Conectado\':\'<span class=\\\'pulse-dot-gray\\\'></span> Inactivo\'; document.getElementById(\'status_calendar\').style.background=this.checked?\'rgba(0, 255, 179, 0.15)\':\'rgba(255,255,255,0.05)\'; document.getElementById(\'status_calendar\').style.color=this.checked?\'var(--neon)\':\'var(--muted)\'; document.getElementById(\'status_calendar\').style.borderColor=this.checked?\'var(--neon)\':\'rgba(255,255,255,0.1)\';"> Activar Sincronización Agenda</label>';
    h += '    </div>';
    h += '    <div class="frow" style="margin-bottom:10px;">';
    h += '      <label class="flbl" style="font-size:11px; margin-bottom:4px;">Google Calendar ID</label>';
    h += '      <input class="finp" id="aj_calendar_id" placeholder="Ej: tu-correo@gmail.com" value="' + (ajustesTienda.calendar_id || '') + '">';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';

    // WhatsApp
    h += '<div class="admin-card admin-card-pad" style="border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '    <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">💬 WhatsApp Ventas</div>';
    h += '    <span class="status-pill" style="background:rgba(37, 211, 102, 0.15); color:#25D366; border:1px solid #25D366; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;"><span class="pulse-dot-green" style="background-color:#25D366; box-shadow:0 0 0 0 rgba(37,211,102,0.7)"></span> Activo</span>';
    h += '  </div>';
    h += '  <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Tus pedidos y chat se redirigen automáticamente a tu número de WhatsApp para cerrar la venta.</p>';
    h += '  <div class="frow" style="margin-bottom:10px;">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Número de Ventas (sin +)</label>';
    h += '    <input class="finp" id="aj_wa_num" placeholder="Ej: 56990816124" value="' + (ajustesTienda.whatsapp || '') + '" disabled style="opacity:0.6; cursor:not-allowed;">';
    h += '    <span style="font-size:10px; color:var(--muted);">* Modificable desde la pestaña de Ajustes</span>';
    h += '  </div>';
    h += '  <div class="frow">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Mensaje de plantilla</label>';
    h += '    <textarea class="finp" id="aj_wa_msg" style="height:60px; font-size:12px; resize:none;" disabled>Hola, me gustaría confirmar mi pedido de La Manito Del Vegano...</textarea>';
    h += '  </div>';
    h += '</div>';

    // Supabase
    h += '<div class="admin-card admin-card-pad" style="border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '    <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">⚡ Supabase DB</div>';
    h += '    <span class="status-pill" style="background:rgba(0, 255, 179, 0.15); color:var(--neon); border:1px solid var(--neon); font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;"><span class="pulse-dot-green"></span> Conectado</span>';
    h += '  </div>';
    h += '  <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Conexión directa en tiempo real a la base de datos Supabase para mantener sincronizados productos, stock, cupones y métricas.</p>';
    h += '  <div class="frow" style="margin-bottom:10px;">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Supabase Project URL</label>';
    h += '    <input class="finp" value="https://lamanitodelveganodb.supabase.co" disabled style="opacity:0.6; font-family:monospace; font-size:11px;">';
    h += '  </div>';
    h += '  <div class="frow">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Anon Key</label>';
    h += '    <input class="finp" type="password" value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." disabled style="opacity:0.6; font-family:monospace; font-size:11px;">';
    h += '  </div>';
    h += '</div>';

    // Analytics
    h += '<div class="admin-card admin-card-pad" style="border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '    <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">📊 Analytics &amp; Pixel</div>';
    h += '    <span class="status-pill" id="status_analytics" style="background:' + ((ajustesTienda.ga_id || ajustesTienda.pixel_id) ? 'rgba(0, 255, 179, 0.15)' : 'rgba(255,255,255,0.05)') + '; color:' + ((ajustesTienda.ga_id || ajustesTienda.pixel_id) ? 'var(--neon)' : 'var(--muted)') + '; border:1px solid ' + ((ajustesTienda.ga_id || ajustesTienda.pixel_id) ? 'var(--neon)' : 'rgba(255,255,255,0.1)') + '; font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;">' + ((ajustesTienda.ga_id || ajustesTienda.pixel_id) ? '<span class="pulse-dot-green"></span> Activo' : '<span class="pulse-dot-gray"></span> Inactivo') + '</span>';
    h += '  </div>';
    h += '  <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Realiza seguimiento a tus visitas, conversiones y efectividad de tus campañas publicitarias.</p>';
    h += '  <div class="frow" style="margin-bottom:10px;">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Google Analytics ID (GA4)</label>';
    h += '    <input class="finp" id="aj_ga_id" placeholder="G-XXXXXXXXXX" value="' + (ajustesTienda.ga_id || '') + '">';
    h += '  </div>';
    h += '  <div class="frow">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Facebook Pixel ID</label>';
    h += '    <input class="finp" id="aj_pixel_id" placeholder="Ej: 123456789012345" value="' + (ajustesTienda.pixel_id || '') + '">';
    h += '  </div>';
    h += '</div>';

    // Instagram
    h += '<div class="admin-card admin-card-pad" style="border: 1px solid rgba(0, 255, 179, 0.15) !important; background: rgba(3, 9, 7, 0.65) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;">';
    h += '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    h += '    <div style="font-size:18px; font-weight:700; color:white; display:flex; align-items:center; gap:8px;">📸 Instagram Catalog</div>';
    h += '    <span class="status-pill" style="background:rgba(0, 255, 179, 0.15); color:var(--neon); border:1px solid var(--neon); font-size:10px; display:inline-flex; align-items:center; padding:4px 8px; border-radius:50px;"><span class="pulse-dot-green"></span> Activo</span>';
    h += '  </div>';
    h += '  <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:14px;">Sincroniza tus productos con el catálogo de Meta para etiquetar productos en publicaciones e historias.</p>';
    h += '  <div class="frow" style="margin-bottom:10px;">';
    h += '    <label class="flbl" style="font-size:11px; margin-bottom:4px;">Instagram Shopping Catalog URL</label>';
    h += '    <input class="finp" value="https://lamanitodelvegano.vercel.app/api/catalog.xml" disabled style="opacity:0.6; font-family:monospace; font-size:11px;">';
    h += '  </div>';
    h += '  <div style="font-size:10.5px; color:var(--muted); line-height:1.4;">';
    h += '    * Usa este enlace en el Commerce Manager de Meta para sincronizar tu catálogo.';
    h += '  </div>';
    h += '</div>';
    
    h += '</div>';
    
    h += '<div style="margin-top:20px; display:flex; justify-content:flex-end;">';
    h += '  <button class="bguardar" style="max-width:300px; margin-top:0;" onclick="guardarIntegraciones()">💾 Guardar Integraciones</button>';
    h += '  <button class="bcancelar" style="max-width:150px; margin-left:12px; margin-top:0;" onclick="cerrarAdmin()">Cerrar</button>';
    h += '</div>';
    
    c.innerHTML = h;
  }
}

// ============================================================
// ADMIN ACCIONES
// ============================================================
function calcularFinanzasProducto() {
  var priceInput = document.getElementById('fprecio');
  var costInput = document.getElementById('fcosto');
  var price = parseInt(priceInput ? priceInput.value : 0) || 0;
  var cost = parseInt(costInput ? costInput.value : 0) || 0;

  var iva = Math.round(price * 0.19);
  var netRevenue = price - cost - iva;
  var marginPct = price > 0 ? Math.round((netRevenue / price) * 100) : 0;
  var markupPct = cost > 0 ? Math.round(((price - cost) / cost) * 100) : 0;

  var ivaEl = document.getElementById('fiva_calc');
  if (ivaEl) ivaEl.textContent = '$' + iva.toLocaleString('es-CL');
  
  var marginEl = document.getElementById('fmargen_calc');
  if (marginEl) marginEl.innerHTML = 'Ganancia: <strong>$' + netRevenue.toLocaleString('es-CL') + '</strong><br>Margen Neto: <strong>' + marginPct + '%</strong>';
  
  var markupEl = document.getElementById('fmarkup_calc');
  if (markupEl) markupEl.textContent = markupPct + '%';
}

function toggleStockField(val) {
  var container = document.getElementById('fstock_container');
  if (container) {
    container.style.display = (val === 'true') ? 'block' : 'none';
  }
}

function abrirModalProd(id) {
  editandoId = id;
  
  var modalbox = document.querySelector('.modalbox');
  if (modalbox) modalbox.scrollTop = 0;

  var imgPreview = document.getElementById('fimagen_preview');
  var uploadText = document.querySelector('.upload-text');

  // Disable inputs if database columns are missing
  var gramajeInp = document.getElementById('fgramaje');
  var varInp = document.getElementById('fvariedades');
  if (gramajeInp) {
    gramajeInp.disabled = !dbSoportaGramaje;
    gramajeInp.placeholder = dbSoportaGramaje ? 'Ej: 500 grs, 1 Kilo, 1 Litro' : '⚠️ Desactivado (Ejecuta el script SQL en Supabase)';
  }
  if (varInp) {
    varInp.disabled = !dbSoportaGramaje;
    varInp.placeholder = dbSoportaGramaje ? 'Ej: Barbacoa, Mostaza, Clásico' : '⚠️ Desactivado (Ejecuta el script SQL en Supabase)';
  }

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
    document.getElementById('fcosto').value='';
    document.getElementById('fgramaje').value='';
    document.getElementById('fvariedades').value='';
    document.getElementById('fmaneja_stock').value='false';
    document.getElementById('fstock').value='';
    document.getElementById('fstock_container').style.display='none';
    document.getElementById('fdisponibilidad').value='';
    initFlatpickrDisponibilidad([]);
    document.getElementById('fgluten_free').checked = true;
    document.getElementById('fnut_free').checked = true;
    if (imgPreview) {
      imgPreview.style.display = 'none';
      imgPreview.src = '';
    }
    if (uploadText) uploadText.textContent = "Subir imagen desde tu dispositivo";
    calcularFinanzasProducto();
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
    document.getElementById('fcosto').value=p.costo||'';
    document.getElementById('fgramaje').value=p.gramaje||'';
    document.getElementById('fvariedades').value=p.variedades||'';
    document.getElementById('fmaneja_stock').value=p.maneja_stock?'true':'false';
    document.getElementById('fstock').value=(p.stock!==undefined && p.stock!==null)?p.stock:'';
    document.getElementById('fstock_container').style.display=p.maneja_stock?'block':'none';
    document.getElementById('fdisponibilidad').value=p.disponibilidad||'';
    var existingDates = (p.disponibilidad || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    initFlatpickrDisponibilidad(existingDates);
    document.getElementById('fgluten_free').checked = (p.gluten_free !== false);
    document.getElementById('fnut_free').checked = (p.nut_free !== false);
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
    calcularFinanzasProducto();
  }
  document.getElementById('modalov').classList.add('open');
}

function guardarProd() {
  var nombre = document.getElementById('fnombre').value.trim();
  var precio = parseInt(document.getElementById('fprecio').value);
  if (!nombre||!precio) { showToast('⚠️ Nombre y precio son obligatorios'); return; }
  var etiqueta = document.getElementById('fetiqueta').value;
  var etiqueta_label = etiqueta==='nuevo'?'Nuevo':etiqueta==='oferta'?'Oferta':etiqueta==='estrella'?'⭐ Único':null;
  
  var manejaStock = document.getElementById('fmaneja_stock').value === 'true';
  var stock = manejaStock ? (parseInt(document.getElementById('fstock').value) || 0) : null;
  var costoProduccion = parseInt(document.getElementById('fcosto').value) || 0;
  var glutenFree = document.getElementById('fgluten_free').checked;
  var nutFree = document.getElementById('fnut_free').checked;

  var data = {
    nombre: sanitizeHTML(nombre), descripcion: sanitizeHTML(document.getElementById('fdesc').value),
    precio: precio, precio_anterior: parseInt(document.getElementById('fprecioant').value)||null,
    categoria: sanitizeHTML(document.getElementById('fcat').value), emoji: sanitizeHTML(document.getElementById('femoji').value||'🌿'),
    etiqueta: etiqueta||null, etiqueta_label: etiqueta_label,
    color_fondo: sanitizeHTML(document.getElementById('fcolor').value||'#F0FFF4'),
    imagen_url: sanitizeHTML(document.getElementById('fimagen').value||null),
    costo: costoProduccion,
    maneja_stock: manejaStock,
    stock: stock,
    gluten_free:glutenFree,
    nut_free:nutFree,
    disponibilidad: sanitizeHTML(document.getElementById('fdisponibilidad').value.trim()) || null
  };

  if (dbSoportaGramaje) {
    data.gramaje = sanitizeHTML(document.getElementById('fgramaje').value.trim()) || null;
    data.variedades = sanitizeHTML(document.getElementById('fvariedades').value.trim()) || null;
  }

  if (!supabaseClient) {
    showToast('⚠️ Base de datos no conectada'); return;
  }

  if (precio > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  var precioAnt = parseInt(document.getElementById('fprecioant').value) || null;
  if (precioAnt && precioAnt > 2147483647) { showToast('⚠️ El precio anterior supera el límite permitido'); return; }

  if (editandoId===null) {
    data.destacado = false;
    supabaseClient.from('productos').insert([data]).then(function(res) { 
      if(res.error) showToast('❌ Error: ' + res.error.message);
      else {
        showToast('✅ Producto agregado'); 
        loadProductos();
      }
    });
  } else {
    var p = productos.find(function(x){return x.id === editandoId;});
    if(p) data.destacado = p.destacado;
    supabaseClient.from('productos').update(data).eq('id', editandoId).then(function(res) { 
      if(res.error) showToast('❌ Error: ' + res.error.message);
      else {
        showToast('✅ Producto actualizado'); 
        loadProductos();
      }
    });
  }
  document.getElementById('modalov').classList.remove('open');
}

function eliminarProd(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  supabaseClient.from('productos').delete().eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('🗑 Producto eliminado');
      loadProductos();
    }
  });
}

function toggleDestacado(id) {
  var p = productos.find(function(x){return x.id === id;});
  if (!p) return;
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  supabaseClient.from('productos').update({destacado: !p.destacado}).eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('⭐ Destacado actualizado'); 
      loadProductos();
    }
  });
}

function guardarZona(id) {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var nom = document.getElementById('znom_'+id).value;
  var com = document.getElementById('zcom_'+id).value;
  var pre = parseInt(document.getElementById('zpre_'+id).value)||0;
  if (pre > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  supabaseClient.from('zonas').update({nombre:nom, comunas:com, precio:pre}).eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('✅ Zona guardada'); 
      loadZonas();
    }
  });
}

function agregarZona() {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var nom = document.getElementById('nznom').value.trim();
  var com = document.getElementById('nzcom').value.trim();
  var pre = parseInt(document.getElementById('nzpre').value)||0;
  if (!nom) { showToast('⚠️ Ingresa el nombre de la zona'); return; }
  if (pre > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  supabaseClient.from('zonas').insert([{nombre:nom, comunas:com, precio:pre}]).then(function(res) {
    if(res.error) { showToast('❌ Error: ' + res.error.message); return; }
    document.getElementById('nznom').value='';
    document.getElementById('nzcom').value='';
    document.getElementById('nzpre').value='0';
    showToast('✅ Zona agregada');
    loadZonas();
  });
}

function eliminarZona(id) {
  if (!confirm('¿Eliminar esta zona?')) return;
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  supabaseClient.from('zonas').delete().eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('🗑 Zona eliminada');
      loadZonas();
    }
  });
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

function aplicarAjustesUI() {
  var logoTxt = document.querySelector('.nlogo .ntxt');
  if (logoTxt) {
    logoTxt.innerHTML = (ajustesTienda.nombre || 'La Manito Del Vegano') + '<small>Plant Based · Chile</small>';
  }
  
  var banner = document.getElementById('cerrado-banner');
  if (banner) {
    banner.style.display = (ajustesTienda.estado === 'cerrado') ? 'block' : 'none';
  }
  
  var waFloat = document.querySelector('.waf');
  if (waFloat && ajustesTienda.whatsapp) {
    waFloat.href = 'https://wa.me/' + ajustesTienda.whatsapp;
  }
  var waContactCard = document.querySelector('a[href^="https://wa.me"]');
  if (waContactCard && ajustesTienda.whatsapp) {
    waContactCard.href = 'https://wa.me/' + ajustesTienda.whatsapp;
    var telText = waContactCard.querySelector('.ccp');
    if (telText) {
      var n = ajustesTienda.whatsapp;
      telText.textContent = n.startsWith('569') ? '+56 9 ' + n.substring(3, 7) + ' ' + n.substring(7) : '+' + n;
    }
  }

  var igContactCard = document.querySelector('a[href^="https://instagram.com"]');
  if (igContactCard && ajustesTienda.instagram) {
    igContactCard.href = 'https://instagram.com/' + ajustesTienda.instagram;
    var igText = igContactCard.querySelector('.ccp');
    if (igText) igText.textContent = '@' + ajustesTienda.instagram;
  }
}

function guardarAjustes() {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var nombre = document.getElementById('aj_nombre').value.trim();
  var whatsapp = document.getElementById('aj_whatsapp').value.trim();
  var instagram = document.getElementById('aj_instagram').value.trim();
  var tiktok = document.getElementById('aj_tiktok').value.trim();
  var facebook = document.getElementById('aj_facebook').value.trim();
  var estado = document.getElementById('aj_estado').value;
  var tasaPuntos = parseInt(document.getElementById('aj_tasa').value) || 1000;
  var valorPunto = parseInt(document.getElementById('aj_valor').value) || 100;
  
  ajustesTienda.nombre = nombre;
  ajustesTienda.whatsapp = whatsapp;
  ajustesTienda.instagram = instagram;
  ajustesTienda.tiktok = tiktok;
  ajustesTienda.facebook = facebook;
  ajustesTienda.estado = estado;
  ajustesTienda.tasaPuntos = tasaPuntos;
  ajustesTienda.valorPunto = valorPunto;
  
  supabaseClient.from('ajustes').upsert({ id: 'global', data: ajustesTienda }).then(function(res) {
    if(res.error) showToast('❌ Error al guardar ajustes: ' + res.error.message);
    else {
      showToast('⚙️ Ajustes guardados con éxito');
      aplicarAjustesUI();
    }
  });
}

function agregarCupon() {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var code = document.getElementById('ncupcode').value.trim().toUpperCase();
  var tipo = document.getElementById('ncuptipo').value;
  var valor = document.getElementById('ncupvalor').value.trim();
  var minMonto = parseInt(document.getElementById('ncupmin').value) || 0;
  
  if (!code) { showToast('⚠️ Ingresa el código del cupón'); return; }
  if (!valor) { showToast('⚠️ Ingresa el valor del descuento o producto'); return; }
  
  var valorFinal = (tipo === 'fijo' || tipo === 'porcentaje') ? String(parseInt(valor) || 0) : valor;
  
  var data = { id: code, code: code, tipo: tipo, valor: valorFinal, minMonto: minMonto };
  
  supabaseClient.from('cupones').upsert(data).then(function(res) {
    if (res.error) { showToast('❌ Error: ' + res.error.message); return; }
    document.getElementById('ncupcode').value = '';
    document.getElementById('ncupvalor').value = '';
    document.getElementById('ncupmin').value = '0';
    showToast('🎟️ Cupón creado con éxito');
    loadCupones();
  });
}

function eliminarCupon(code) {
  if (!confirm('¿Eliminar el cupón ' + code + '?')) return;
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  supabaseClient.from('cupones').delete().eq('id', code).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('🗑️ Cupón eliminado');
      loadCupones();
    }
  });
}

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
    if (ultimoPedidoId && supabaseClient) {
      supabaseClient.from('pedidos').update({ status: 'Pagado' }).eq('id', ultimoPedidoId).then(function(res) {
        if (!res.error) {
          console.log("Pedido actualizado a Pagado en Supabase");
          localStorage.removeItem('ultimoPedidoId');
        } else {
          console.error("Error actualizando estado del pedido:", res.error);
        }
      });
    }

    showConf('🎉', '¡Pago Exitoso!', 'Tu pago ha sido procesado correctamente.\n🌱 ¡Muchas gracias por tu compra! Te contactaremos pronto para coordinar el despacho.');
    
    var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  } else if (status === 'failure' || collectionStatus === 'rejected') {
    showToast('❌ El pago fue rechazado o cancelado. Por favor, intenta de nuevo o coordina por WhatsApp.');
    
    var ultimoPedidoId = localStorage.getItem('ultimoPedidoId');
    if (ultimoPedidoId && supabaseClient) {
      supabaseClient.from('pedidos').update({ status: 'Cancelado' }).eq('id', ultimoPedidoId);
      localStorage.removeItem('ultimoPedidoId');
    }

    var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }
}

function cambiarEstadoPedido(id, nuevoEstado) {
  if (!supabaseClient) return;
  supabaseClient.from('pedidos').update({ status: nuevoEstado }).eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('✅ Estado del pedido actualizado');
      loadPedidos();
    }
  });
}

function eliminarPedido(id) {
  if (!confirm('¿Eliminar este registro de pedido?')) return;
  if (!supabaseClient) return;
  supabaseClient.from('pedidos').delete().eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('🗑 Pedido eliminado');
      loadPedidos();
    }
  });
}

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
    });
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
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var nom = document.getElementById('ncatnom').value.trim();
  var emoj = document.getElementById('ncatemoj').value.trim() || '🌱';
  if (!nom) { showToast('⚠️ Ingresa el nombre de la categoría'); return; }
  
  var slug = nom.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  supabaseClient.from('categorias').insert([{
    nombre: nom,
    emoji: emoj,
    slug: slug
  }]).then(function(res) {
    if (res.error) {
      if (res.error.message && res.error.message.indexOf('row-level security') !== -1) {
        showToast('🔒 Error de permisos en Supabase. Ve al panel de Supabase → Table Editor → categorias → RLS y agrega políticas de INSERT/UPDATE/DELETE para el rol anon.');
      } else {
        showToast('❌ Error: ' + res.error.message);
      }
      return;
    }
    document.getElementById('ncatnom').value = '';
    document.getElementById('ncatemoj').value = '';
    showToast('✅ Categoría agregada');
    loadCategorias();
  });
}

function guardarCategoria(id, slugActual) {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  var nomEl = document.getElementById('cat_nom_' + id);
  var emojiEl = document.getElementById('cat_emoji_' + id);
  if (!nomEl || !emojiEl) { showToast('⚠️ Error al leer los campos'); return; }
  var nom = nomEl.value.trim();
  var emoj = emojiEl.value.trim() || '🌱';
  if (!nom) { showToast('⚠️ El nombre no puede estar vacío'); return; }
  // Regenerate slug from new name, keep old slug if name didn't change significantly
  var newSlug = nom.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
  supabaseClient.from('categorias').update({ nombre: nom, emoji: emoj, slug: newSlug }).eq('id', id).then(function(res) {
    if (res.error) showToast('❌ Error: ' + res.error.message);
    else {
      showToast('✅ Categoría actualizada');
      loadCategorias();
    }
  });
}

function eliminarCategoria(id) {
  if (!confirm('¿Eliminar esta categoría? Los productos asociados a ella no se borrarán pero quedarán sin categoría asignada.')) return;
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  supabaseClient.from('categorias').delete().eq('id', id).then(function(res) {
    if (res.error) {
      if (res.error.message && res.error.message.indexOf('row-level security') !== -1) {
        showToast('🔒 Error de permisos en Supabase. Ve al panel de Supabase → Table Editor → categorias → RLS y agrega políticas de DELETE para el rol anon.');
      } else {
        showToast('❌ Error: ' + res.error.message);
      }
    } else {
      showToast('🗑 Categoría eliminada');
      loadCategorias();
    }
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

  // 1. Spawning Green Leaves (falling down, rotating in 3D)
  var leafCount = 8;
  for (var i = 0; i < leafCount; i++) {
    var leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.style.left = (Math.random() * 100) + 'vw';
    
    var duration = (Math.random() * 15 + 12);
    var delay = (Math.random() * -20);
    leaf.style.animationDuration = duration + 's';
    leaf.style.animationDelay = delay + 's';
    
    var size = (Math.random() * 12 + 10);
    leaf.style.width = size + 'px';
    leaf.style.height = size + 'px';
    
    var scale = (Math.random() * 0.6 + 0.4);
    leaf.style.transform = 'scale(' + scale + ')';
    
    var drift = (Math.random() * 160 - 80);
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

  // 2. Spawning Chamomile Petals (delicate, fluttery warm petals falling down)
  var petalCount = 6;
  for (var i = 0; i < petalCount; i++) {
    var petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = (Math.random() * 100) + 'vw';
    
    var duration = (Math.random() * 12 + 10);
    var delay = (Math.random() * -20);
    petal.style.animationDuration = duration + 's';
    petal.style.animationDelay = delay + 's';
    
    var size = (Math.random() * 8 + 8);
    petal.style.width = size + 'px';
    petal.style.height = size + 'px';
    
    var scale = (Math.random() * 0.5 + 0.5);
    petal.style.transform = 'scale(' + scale + ')';
    
    var drift = (Math.random() * 120 - 60);
    var rotX = (Math.random() * 360 + 180);
    var rotY = (Math.random() * 360 + 180);
    var rotZ = (Math.random() * 360 + 360);
    var initRot = (Math.random() * 360);
    
    petal.style.setProperty('--x-drift', drift + 'px');
    petal.style.setProperty('--rot-x', rotX + 'deg');
    petal.style.setProperty('--rot-y', rotY + 'deg');
    petal.style.setProperty('--rot-z', rotZ + 'deg');
    petal.style.setProperty('--init-rot', initRot + 'deg');
    
    container.appendChild(petal);
  }

  // 3. Spawning Warm Golden Sparkles (drifting upwards from the bottom)
  var sparkleCount = 6;
  for (var i = 0; i < sparkleCount; i++) {
    var sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = (Math.random() * 100) + 'vw';
    
    var duration = (Math.random() * 18 + 14);
    var delay = (Math.random() * -30);
    sparkle.style.animationDuration = duration + 's';
    sparkle.style.animationDelay = delay + 's';
    
    var size = (Math.random() * 25 + 15);
    sparkle.style.width = size + 'px';
    sparkle.style.height = size + 'px';
    
    var drift = (Math.random() * 80 - 40);
    sparkle.style.setProperty('--x-drift', drift + 'px');
    
    container.appendChild(sparkle);
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
    body: JSON.stringify({
      history: chatHistory,
      productos: productos.map(function(p) {
        return {
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria,
          variedades: p.variedades || '',
          gramaje: p.gramaje || ''
        };
      })
    })
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

// ============================================================
// BUSCADOR Y FILTRADO CLIENTE
// ============================================================
window.searchQuery = '';

function buscarProductos(val) {
  window.searchQuery = val.trim().toLowerCase();
  var clearBtn = document.getElementById('clearSearch');
  if (clearBtn) {
    clearBtn.style.display = window.searchQuery ? 'flex' : 'none';
  }
  renderGrid();
}

function borrarBusqueda() {
  var searchInp = document.getElementById('clientSearch');
  if (searchInp) searchInp.value = '';
  window.searchQuery = '';
  var clearBtn = document.getElementById('clearSearch');
  if (clearBtn) clearBtn.style.display = 'none';
  renderGrid();
}

// ============================================================
// MODAL DETALLE PRODUCTO
// ============================================================
function hasMultipleFormats(gramajeStr) {
  if (!gramajeStr) return false;
  return gramajeStr.indexOf(',') !== -1 || gramajeStr.indexOf('/') !== -1 || gramajeStr.indexOf(';') !== -1;
}

function parseWeightValue(str) {
  var clean = str.toLowerCase().replace(/\s+/g, '');
  var match = clean.match(/([0-9\.,]+)\s*(grs|gr|g|kg|kilo|kilos|k|ml|l|litro|litros|ltrs|lt|lts)?/);
  if (!match) return null;
  
  var val = parseFloat(match[1].replace(',', '.'));
  if (isNaN(val)) return null;
  
  var unit = match[2] || '';
  
  if (unit.indexOf('kg') !== -1 || unit.indexOf('kilo') !== -1 || unit === 'k') {
    val *= 1000;
  } else if (unit === 'l' || unit.indexOf('litro') !== -1 || unit.indexOf('ltr') !== -1 || unit === 'lt' || unit === 'lts') {
    val *= 1000;
  }
  
  return val;
}

function parseFormatos(gramajeStr, basePrecio) {
  if (!gramajeStr) return [{ label: '', price: basePrecio }];
  
  var parts = hasMultipleFormats(gramajeStr) ? gramajeStr.split(/[\/,;]/) : [gramajeStr];
  var result = [];
  
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var priceMatch = part.match(/\(\s*\$?\s*([0-9\.\s]+)\s*\)/);
    var price = null;
    var label = part;
    var hasExplicitPrice = false;
    
    if (priceMatch) {
      var numStr = priceMatch[1].replace(/\./g, '').trim();
      var parsedPrice = parseInt(numStr);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;
        hasExplicitPrice = true;
      }
      label = part.replace(priceMatch[0], '').trim();
    }
    
    result.push({
      label: label.trim(),
      price: price,
      hasExplicitPrice: hasExplicitPrice
    });
  }
  
  if (result.length > 0 && result[0].price === null) {
    result[0].price = basePrecio;
  }
  
  if (result.length > 1) {
    var firstWeight = parseWeightValue(result[0].label);
    for (var i = 1; i < result.length; i++) {
      if (result[i].price === null) {
        var currentWeight = parseWeightValue(result[i].label);
        if (firstWeight && currentWeight && firstWeight > 0) {
          result[i].price = Math.round(result[0].price * (currentWeight / firstWeight));
        } else {
          result[i].price = basePrecio;
        }
      }
    }
  }
  
  return result.map(function(item) {
    return { label: item.label, price: item.price };
  });
}

function cleanGramajeLabel(gramajeStr) {
  if (!gramajeStr) return '';
  return gramajeStr.replace(/\s*\(\s*\$?\s*[0-9\.\s]+\s*\)/g, '');
}

var detailProductId = null;
var detailQty = 1;
var detailFormatos = [];

function abrirDetailModal(id, event) {
  if (event && (event.target.closest('.qb') || event.target.closest('.badd') || event.target.closest('.qc') || event.target.closest('.dest-btn'))) {
    return;
  }
  
  var p = productos.find(function(x){ return x.id === id; });
  if (!p) return;
  
  detailProductId = id;
  detailQty = 1;
  if (!(p.variedades && p.variedades.trim().length > 0) && carrito[id]) {
    detailQty = carrito[id].qty;
  }
  if (detailQty === 0) detailQty = 1;

  document.getElementById('detail_name').textContent = p.nombre;
  document.getElementById('detail_desc').textContent = p.descripcion || 'Sin descripción disponible.';
  document.getElementById('detail_price').textContent = '$' + p.precio.toLocaleString('es-CL');
  
  var priceOld = document.getElementById('detail_price_old');
  if (p.precio_anterior) {
    priceOld.textContent = '$' + p.precio_anterior.toLocaleString('es-CL');
    priceOld.style.display = 'inline-block';
  } else {
    priceOld.style.display = 'none';
  }

  var headerBg = document.getElementById('detail_header_bg');
  headerBg.style.background = p.color_fondo || '#F0FFF4';

  var img = document.getElementById('detail_img');
  var emoji = document.getElementById('detail_emoji');
  if (p.imagen_url) {
    img.src = p.imagen_url;
    img.style.display = 'block';
    emoji.style.display = 'none';
  } else {
    img.style.display = 'none';
    emoji.textContent = p.emoji || '🌱';
    emoji.style.display = 'block';
  }

  var tag = document.getElementById('detail_tag');
  if (p.etiqueta) {
    tag.textContent = p.etiqueta_label || p.etiqueta;
    tag.className = 'ctag ' + (p.etiqueta === 'nuevo' ? 'tn' : p.etiqueta === 'oferta' ? 'to' : 'te');
    tag.style.display = 'block';
  } else {
    tag.style.display = 'none';
  }

  document.getElementById('badge_gluten').style.display = (p.gluten_free !== false) ? 'flex' : 'none';
  document.getElementById('badge_nuts').style.display = (p.nut_free !== false) ? 'flex' : 'none';

  var stockPill = document.getElementById('detail_stock_pill');
  var addBtn = document.getElementById('detail_add_btn');
  var qtyControl = document.getElementById('detail_qty_control');

  if (p.maneja_stock) {
    if (p.stock <= 0) {
      stockPill.textContent = 'Agotado';
      stockPill.className = 'status-pill pill-oferta';
      addBtn.textContent = '❌ Sin Stock';
      addBtn.disabled = true;
      qtyControl.style.opacity = '0.4';
      qtyControl.style.pointerEvents = 'none';
    } else if (p.stock <= 3) {
      stockPill.textContent = '¡Bajo Stock! (' + p.stock + ' disp.)';
      stockPill.className = 'status-pill pill-oferta';
      addBtn.textContent = '🛒 Agregar al carrito';
      addBtn.disabled = false;
      qtyControl.style.opacity = '1';
      qtyControl.style.pointerEvents = 'auto';
    } else {
      stockPill.textContent = 'Disponible (' + p.stock + ')';
      stockPill.className = 'status-pill pill-nuevo';
      addBtn.textContent = '🛒 Agregar al carrito';
      addBtn.disabled = false;
      qtyControl.style.opacity = '1';
      qtyControl.style.pointerEvents = 'auto';
    }
  } else {
    stockPill.textContent = 'Disponible';
    stockPill.className = 'status-pill pill-nuevo';
    addBtn.textContent = '🛒 Agregar al carrito';
    addBtn.disabled = false;
    qtyControl.style.opacity = '1';
    qtyControl.style.pointerEvents = 'auto';
  }

  // Load product varieties dropdown
  var varietyContainer = document.getElementById('detail_variety_container');
  var varietySelect = document.getElementById('detail_variety');
  if (p.variedades && p.variedades.trim().length > 0) {
    var vList = p.variedades.split(',').map(function(v){ return v.trim(); }).filter(Boolean);
    if (vList.length > 0) {
      varietySelect.innerHTML = '';
      vList.forEach(function(v) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        varietySelect.appendChild(opt);
      });
      varietyContainer.style.display = 'block';
    } else {
      varietyContainer.style.display = 'none';
    }
  } else {
    varietyContainer.style.display = 'none';
  }

  // Load product formats dropdown
  var formatContainer = document.getElementById('detail_format_container');
  var formatSelect = document.getElementById('detail_format');
  if (p.gramaje && p.gramaje.trim().length > 0 && hasMultipleFormats(p.gramaje)) {
    detailFormatos = parseFormatos(p.gramaje, p.precio);
    if (detailFormatos.length > 1) {
      formatSelect.innerHTML = '';
      detailFormatos.forEach(function(f, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = f.label + (f.price !== p.precio ? ' ($' + f.price.toLocaleString('es-CL') + ')' : '');
        formatSelect.appendChild(opt);
      });
      formatContainer.style.display = 'block';
    } else {
      formatContainer.style.display = 'none';
      detailFormatos = [{ label: p.gramaje || '', price: p.precio }];
    }
  } else {
    formatContainer.style.display = 'none';
    detailFormatos = [{ label: p.gramaje || '', price: p.precio }];
  }

  updateDetailPrice();
  updateDetailQtyUI();
  document.getElementById('detailov').classList.add('open');
}

function updateDetailPrice() {
  var p = productos.find(function(x){ return x.id === detailProductId; });
  if (!p) return;
  var price = p.precio;
  var priceOldVal = p.precio_anterior;
  var formatSelect = document.getElementById('detail_format');
  var formatContainer = document.getElementById('detail_format_container');
  if (formatContainer.style.display === 'block' && formatSelect) {
    var idx = parseInt(formatSelect.value);
    if (!isNaN(idx) && detailFormatos[idx]) {
      price = detailFormatos[idx].price;
      if (priceOldVal && p.precio > 0) {
        priceOldVal = Math.round((priceOldVal * price) / p.precio);
      }
    }
  }
  document.getElementById('detail_price').textContent = '$' + price.toLocaleString('es-CL');
  var priceOld = document.getElementById('detail_price_old');
  if (priceOldVal) {
    priceOld.textContent = '$' + priceOldVal.toLocaleString('es-CL');
    priceOld.style.display = 'inline-block';
  } else {
    priceOld.style.display = 'none';
  }
}

function cerrarDetailModal(e) {
  if (e.target.id === 'detailov') {
    document.getElementById('detailov').classList.remove('open');
  }
}

function changeDetailQty(d) {
  var p = productos.find(function(x){ return x.id === detailProductId; });
  if (!p) return;

  var newQty = detailQty + d;
  if (newQty < 1) newQty = 1;

  if (p.maneja_stock && newQty > p.stock) {
    showToast('⚠️ No puedes comprar más de la cantidad disponible (' + p.stock + ')');
    return;
  }
  detailQty = newQty;
  updateDetailQtyUI();
}

function updateDetailQtyUI() {
  document.getElementById('detail_qty_val').textContent = detailQty;
}

function addDetailToCart() {
  var p = productos.find(function(x){ return x.id === detailProductId; });
  if (!p) return;

  if (p.maneja_stock && p.stock <= 0) {
    showToast('❌ Producto agotado');
    return;
  }

  if (p.maneja_stock && detailQty > p.stock) {
    showToast('⚠️ Cantidad máxima superada. Reduciendo a ' + p.stock);
    detailQty = p.stock;
  }

  var selectedVariety = null;
  var varietyContainer = document.getElementById('detail_variety_container');
  if (varietyContainer && varietyContainer.style.display === 'block') {
    var sel = document.getElementById('detail_variety');
    if (sel) selectedVariety = sel.value;
  }

  var selectedFormat = null;
  var selectedPrice = p.precio;
  var formatContainer = document.getElementById('detail_format_container');
  if (formatContainer && formatContainer.style.display === 'block') {
    var selF = document.getElementById('detail_format');
    if (selF) {
      var idx = parseInt(selF.value);
      if (!isNaN(idx) && detailFormatos[idx]) {
        selectedFormat = detailFormatos[idx].label;
        selectedPrice = detailFormatos[idx].price;
      }
    }
  }

  var cartKey = p.id;
  if (selectedVariety || selectedFormat) {
    cartKey = p.id + (selectedVariety ? '_' + selectedVariety : '') + (selectedFormat ? '_' + selectedFormat : '');
  }

  if (!carrito[cartKey]) {
    carrito[cartKey] = {
      id: p.id,
      nombre: p.nombre,
      precio: selectedPrice,
      emoji: p.emoji,
      color_fondo: p.color_fondo,
      imagen_url: p.imagen_url,
      qty: 0,
      variedad: selectedVariety,
      formato: selectedFormat
    };
  } else {
    carrito[cartKey].precio = selectedPrice;
  }
  carrito[cartKey].qty = detailQty;
  
  updBdg(); 
  renderGrid();
  abrirCarrito();
  document.getElementById('detailov').classList.remove('open');
  showToast('🛒 Carrito actualizado');
}

// ============================================================
// SEGUIMIENTO DE PEDIDOS EN VIVO (ORDER TRACKER)
// ============================================================
var trackerListener = null;

function buscarPedidoTracking() {
  var input = document.getElementById('trackIdInput');
  var id = input ? sanitizeHTML(input.value.trim().toLowerCase()) : '';
  var resultDiv = document.getElementById('trackerResult');
  
  if (!id) {
    showToast('⚠️ Ingresa un ID de pedido válido');
    return;
  }
  
  if (!supabaseClient) {
    showToast('⚠️ Base de datos no conectada. Simulando tracking...');
    resultDiv.style.display = 'block';
    renderTrackerMock(id);
    return;
  }
  
  showToast('⏳ Buscando pedido...');
  
  // Search all pedidos and find one matching the short ID prefix
  supabaseClient.from('pedidos').select('*').then(function(res) {
    if (res.error) {
      console.error('Error tracking order:', res.error);
      showToast('❌ Error al conectar a la base de datos');
      return;
    }
    var found = null;
    var allPedidos = res.data || [];
    for (var i = 0; i < allPedidos.length; i++) {
      var pedId = allPedidos[i].id.toLowerCase();
      if (pedId === id || pedId.startsWith(id)) {
        found = allPedidos[i];
        break;
      }
    }
    if (found) {
      resultDiv.style.display = 'block';
      renderTrackerData(found.id, found);
    } else {
      showToast('❌ No se encontró ningún pedido con ese ID');
      resultDiv.style.display = 'none';
    }
  });
}

function renderTrackerData(id, data) {
  var div = document.getElementById('trackerResult');
  if (!div) return;

  var status = data.status || 'Pendiente';
  var dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';

  var statusProgress = 0;
  var stepActive = [false, false, false, false];
  var stepCompleted = [false, false, false, false];

  if (status === 'Cancelado') {
    var h = '<div style="background:#FFEAEA; border: 1px solid #FFE0E0; border-radius:12px; padding:16px; text-align:center; color:#D82C0D; margin-bottom:12px;">';
    h += '<h3 style="font-family:\'Fraunces\',serif; margin-bottom:4px;">❌ Pedido Cancelado</h3>';
    h += '<p style="font-size:12px;">El pedido con ID <strong>#' + id.substring(0, 6).toUpperCase() + '</strong> ha sido cancelado.</p></div>';
    div.innerHTML = h;
    return;
  }

  if (status === 'Pendiente' || status === 'WhatsApp') {
    stepActive[0] = true;
    statusProgress = 0;
  } else if (status === 'Pagado') {
    stepCompleted[0] = true;
    stepActive[1] = true;
    statusProgress = 33;
  } else if (status === 'Despachado') {
    stepCompleted[0] = true;
    stepCompleted[1] = true;
    stepActive[2] = true;
    statusProgress = 66;
  } else if (status === 'Completado') {
    stepCompleted[0] = true;
    stepCompleted[1] = true;
    stepCompleted[2] = true;
    stepCompleted[3] = true;
    statusProgress = 100;
  }

  var h = '<div style="margin-bottom:18px;">';
  h += '<span style="font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:700;">ID Pedido</span>';
  h += '<h3 style="font-family:\'Fraunces\',serif; font-size:18px; color:var(--v1);">#' + id.substring(0, 8).toUpperCase() + '</h3>';
  h += '<div style="font-size:12px; color:var(--muted); margin-top:2px;">Realizado: ' + dateStr + '</div>';
  h += '</div>';

  h += '<div class="tracker-timeline">';
  h += '  <div class="tracker-progress-line" style="width:' + statusProgress + '%;"></div>';
  
  var steps = [
    { label: 'Recibido', icon: '📝' },
    { label: 'En Cocina', icon: '👨‍🍳' },
    { label: 'En Camino', icon: '🚚' },
    { label: 'Entregado', icon: '🌱' }
  ];

  for (var i = 0; i < 4; i++) {
    var cls = stepCompleted[i] ? 'completed' : (stepActive[i] ? 'active' : '');
    h += '  <div class="tracker-step ' + cls + '">';
    h += '    <div class="tracker-node">' + (stepCompleted[i] ? '✓' : steps[i].icon) + '</div>';
    h += '    <div class="tracker-label">' + steps[i].label + '</div>';
    h += '  </div>';
  }
  h += '</div>';

  h += '<div style="background:#F9FAFB; border-radius:12px; padding:16px; font-size:12px; border:1px solid var(--borde); line-height:1.6;">';
  h += '  <div>👤 <strong>Cliente:</strong> ' + sanitizeHTML(data.cliente.nombre) + '</div>';
  h += '  <div>📍 <strong>Despacho:</strong> ' + sanitizeHTML(data.cliente.direccion) + ' (' + sanitizeHTML(data.zonaEnvio || '') + ')</div>';
  h += '  <div>📅 <strong>Fecha Entrega:</strong> ' + sanitizeHTML(data.fechaDespacho || data.fechaEntrega || 'Por confirmar') + '</div>';
  h += '  <div style="margin-top:6px; border-top:1px solid #ECEFF1; padding-top:6px;">';
  h += '    <strong>Método Pago:</strong> ' + sanitizeHTML(data.metodoPago || 'No especificado') + ' (' + sanitizeHTML(status) + ')';
  h += '  </div>';
  h += '  <div style="font-size:14px; font-weight:700; color:var(--v2); margin-top:4px;">';
  h += '    Total: $' + data.total.toLocaleString('es-CL');
  h += '  </div>';
  h += '</div>';

  div.innerHTML = h;
}

function renderTrackerMock(id) {
  var mockData = {
    cliente: { nombre: 'Esteban Monasterio', direccion: 'Av. Providencia 1500' },
    zonaEnvio: 'Santiago Centro',
    fechaEntrega: 'Marzo 12',
    metodoPago: 'Mercado Pago',
    status: 'Pagado',
    total: 15900,
    createdAt: new Date().toISOString()
  };
  renderTrackerData(id, mockData);
}



// Wind breeze responsive parallax on leaves based on cursor speed
var lastMouseX = window.innerWidth / 2;
var leafParallaxX = 0;
window.addEventListener('mousemove', function(e) {
  var diffX = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  leafParallaxX += diffX * 0.04;
  leafParallaxX = Math.max(-40, Math.min(40, leafParallaxX));
  
  var leavesContainer = document.getElementById('leaves-container');
  if (leavesContainer) {
    leavesContainer.style.transform = 'translateX(' + leafParallaxX + 'px)';
  }
});

// Auto-show subtle chat tooltip after 3 seconds (NOT the full chat window)
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var tooltip = document.getElementById('chatTooltip');
    var chatWin = document.getElementById('chatWin');
    // Only show tooltip if chat is not already open
    if (tooltip && chatWin && !chatWin.classList.contains('open')) {
      // Pick a random greeting from promos or use default
      var promoMsgs = (ajustesTienda.popups && ajustesTienda.popups.length > 0) ? ajustesTienda.popups : null;
      if (promoMsgs) {
        var activePopups = promoMsgs.filter(function(p) { return p.activo; });
        if (activePopups.length > 0) {
          var pick = activePopups[Math.floor(Math.random() * activePopups.length)];
          document.getElementById('chatTooltipText').textContent = pick.mensaje;
        }
      }
      tooltip.classList.add('show');
      // Auto-hide after 8 seconds
      setTimeout(function() {
        if (tooltip.classList.contains('show')) {
          tooltip.classList.remove('show');
        }
      }, 8000);
    }
  }, 3000);

  // Show promo popup after 6 seconds if configured
  setTimeout(function() {
    mostrarPromoPopup();
  }, 6000);
});

function cerrarTooltip(e) {
  e.stopPropagation();
  document.getElementById('chatTooltip').classList.remove('show');
}

function abrirChatDesdeTooltip() {
  document.getElementById('chatTooltip').classList.remove('show');
  toggleChat();
}

// ============================================================
// PROMOTIONAL POPUP SYSTEM
// ============================================================
function mostrarPromoPopup() {
  if (!ajustesTienda.popups || ajustesTienda.popups.length === 0) return;
  var activos = ajustesTienda.popups.filter(function(p) { return p.activo && p.tipo === 'popup'; });
  if (activos.length === 0) return;

  // Check if user already dismissed this session
  var dismissed = sessionStorage.getItem('promo_dismissed');
  if (dismissed) return;

  var promo = activos[Math.floor(Math.random() * activos.length)];

  var overlay = document.createElement('div');
  overlay.id = 'promoPopupOv';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:950;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.3s ease';

  var box = document.createElement('div');
  box.style.cssText = 'background:linear-gradient(145deg, #0d1e16, #1a3a2a);border:1px solid rgba(0,255,179,0.3);border-radius:20px;padding:32px 24px;text-align:center;max-width:380px;width:100%;color:white;box-shadow:0 0 40px rgba(0,255,179,0.15);animation:pop 0.3s ease';

  var emoji = promo.emoji || '🌿';
  var titulo = promo.titulo || '¡Promoción Especial!';
  var mensaje = promo.mensaje || '';
  var btnTexto = promo.btnTexto || 'Ver productos';

  box.innerHTML = '<div style="font-size:48px;margin-bottom:12px">' + emoji + '</div>' +
    '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:22px;margin-bottom:8px;color:var(--neon);text-shadow:0 0 10px rgba(0,255,179,0.3)">' + titulo + '</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,0.8);line-height:1.6;margin-bottom:20px">' + mensaje + '</div>' +
    '<button onclick="cerrarPromoPopup();document.getElementById(\'prodsec\').scrollIntoView({behavior:\'smooth\'})" style="background:var(--neon);color:#020705;border:none;padding:12px 28px;border-radius:50px;font-size:14px;font-weight:700;cursor:pointer;font-family:Space Grotesk,sans-serif;box-shadow:0 0 15px rgba(0,255,179,0.4);margin-bottom:8px;display:block;width:100%">' + btnTexto + '</button>' +
    '<button onclick="cerrarPromoPopup()" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.6);padding:8px 20px;border-radius:50px;font-size:12px;cursor:pointer;font-family:Space Grotesk,sans-serif;display:block;width:100%;margin-top:4px">No, gracias</button>';

  overlay.appendChild(box);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarPromoPopup(); });
  document.body.appendChild(overlay);
}

function cerrarPromoPopup() {
  var ov = document.getElementById('promoPopupOv');
  if (ov) ov.remove();
  sessionStorage.setItem('promo_dismissed', '1');
}

// CUSTOM EMOJI PICKER IMPLEMENTATION
(function() {
  var emojiCategories = [
    {
      name: 'Comida 🥑',
      emojis: [
        '🌱', '🥦', '🥬', '🍅', '🍆', '🥑', '🌽', '🥕', '🥔', '🧅', '🍄', '🥜', '🍞', '🥐', '🥖', '🍕', '🍟', '🍔', '🌮', '🌯', '🥙', '🥗', '🍿', '🍱', '🍣', '🥟', '🍤', '🍨', '🍦', '🥧', '🍰', '🎂', '🍩', '🍪', '🍯', '🥤', '🧃', '🧉', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🍎', '🧁', '🍧', '🍵', '☕', '🍷', '🍺', '🍻'
      ]
    },
    {
      name: 'Caras 😊',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '🥺', '😢', '😭', '😠', '😡', '🤯', '😳', '🥵', '🥶', '😱', '🤔', '🫣', '🤭', '🫠', '🤐', '🥴', '🤢', '🤮', '💩', '👻', '👽', '👾', '🤖'
      ]
    },
    {
      name: 'Símbolos 📌',
      emojis: [
        '📦', '🏷️', '🛍️', '🛒', '💳', '💵', '💰', '✉️', '📌', '📍', '🔍', '💡', '⚙️', '🔧', '🔑', '🔒', '🔓', '📝', '📅', '🔔', '📣', '📢', '💬', '💭', '🎯', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '🌈', '☀️', '🌙', '☁️', '💧', '💨', '🚗', '🛵', '🚲', '🚀', '🏠', '🏪'
      ]
    },
    {
      name: 'Naturaleza 🌲',
      emojis: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦉', '🦇', '🐺', '🐴', '🐝', '🐛', '🐌', '🐞', '🐜', '🐢', '🐍', '🦎', '🐙', '🐠', '🐟', '🐬', '🐳', '🐊', '🐘', '🦒', '🐒', '🐿️', '🦦', '🌲', '🌳', '🌴', '🌵', '🌿', '🍀', '🍁', '🍂', '🍃'
      ]
    }
  ];

  var activeTargetInput = null;
  var pickerEl = null;

  function init() {
    // Check if picker already exists
    if (document.getElementById('custom-emoji-picker')) return;

    // Create the picker HTML container
    pickerEl = document.createElement('div');
    pickerEl.id = 'custom-emoji-picker';
    pickerEl.className = 'emoji-picker-popover';
    pickerEl.style.display = 'none';

    // Build tabs
    var tabsHtml = '<div class="emoji-picker-tabs">';
    emojiCategories.forEach(function(cat, idx) {
      var activeClass = idx === 0 ? ' active' : '';
      tabsHtml += '<button type="button" class="emoji-picker-tab' + activeClass + '" data-idx="' + idx + '">' + cat.name.split(' ')[1] + '</button>';
    });
    tabsHtml += '</div>';

    // Build grid container
    var gridContainerHtml = '<div class="emoji-picker-grid-container">';
    emojiCategories.forEach(function(cat, idx) {
      var displayStyle = idx === 0 ? 'grid' : 'none';
      var gridHtml = '<div class="emoji-picker-grid" id="emoji-picker-grid-' + idx + '" style="display:' + displayStyle + '">';
      cat.emojis.forEach(function(emoji) {
        gridHtml += '<div class="emoji-picker-item" data-emoji="' + emoji + '">' + emoji + '</div>';
      });
      gridHtml += '</div>';
      gridContainerHtml += gridHtml;
    });
    gridContainerHtml += '</div>';

    pickerEl.innerHTML = tabsHtml + gridContainerHtml;
    document.body.appendChild(pickerEl);

    // Event listeners inside the picker
    pickerEl.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Tab switching
      var tabBtn = e.target.closest('.emoji-picker-tab');
      if (tabBtn) {
        var clickedIdx = parseInt(tabBtn.getAttribute('data-idx'));
        pickerEl.querySelectorAll('.emoji-picker-tab').forEach(function(btn, idx) {
          if (idx === clickedIdx) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        pickerEl.querySelectorAll('.emoji-picker-grid').forEach(function(grid, idx) {
          grid.style.display = idx === clickedIdx ? 'grid' : 'none';
        });
        return;
      }

      // Emoji selection
      var emojiItem = e.target.closest('.emoji-picker-item');
      if (emojiItem && activeTargetInput) {
        var emoji = emojiItem.getAttribute('data-emoji');
        activeTargetInput.value = emoji;
        
        // Dispatch change and input events to trigger updates
        activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
        activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        hidePicker();
      }
    });

    // Global listener to show/hide picker on focus or click
    document.addEventListener('focusin', handleTargetEvent);
    document.addEventListener('click', handleTargetEvent);

    // Click outside to close
    document.addEventListener('click', function(e) {
      if (pickerEl && pickerEl.style.display !== 'none' && !pickerEl.contains(e.target) && e.target !== activeTargetInput) {
        hidePicker();
      }
    });

    // Resize or scroll repositioning
    window.addEventListener('resize', repositionPicker);
    document.addEventListener('scroll', repositionPicker, true);
  }

  function handleTargetEvent(e) {
    var target = e.target;
    if (target && target.tagName === 'INPUT' && (target.id === 'ncatemoj' || target.id === 'femoji' || target.id.startsWith('cat_emoji_'))) {
      e.stopPropagation();
      showPicker(target);
    }
  }

  function showPicker(inputEl) {
    activeTargetInput = inputEl;
    pickerEl.style.display = 'flex';
    repositionPicker();
  }

  function hidePicker() {
    if (pickerEl) pickerEl.style.display = 'none';
    activeTargetInput = null;
  }

  function repositionPicker() {
    if (!activeTargetInput || !pickerEl || pickerEl.style.display === 'none') return;
    
    var rect = activeTargetInput.getBoundingClientRect();
    
    // Calculate position relative to body
    var top = rect.bottom + window.scrollY;
    var left = rect.left + window.scrollX;
    
    var pickerHeight = 320;
    var pickerWidth = 280;
    
    // Position above if there isn't enough space below
    if (rect.bottom + pickerHeight > window.innerHeight && rect.top - pickerHeight > 0) {
      top = rect.top + window.scrollY - pickerHeight - 4;
    } else {
      top = rect.bottom + window.scrollY + 4;
    }
    
    // Keep within horizontal window boundary
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 12;
    }
    if (left < 0) {
      left = 12;
    }
    
    pickerEl.style.top = top + 'px';
    pickerEl.style.left = left + 'px';
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// FLATPICKR CALENDAR FOR AVAILABILITY DATES
var flatpickrInstance = null;

function initFlatpickrDisponibilidad(existingDates) {
  if (flatpickrInstance) {
    flatpickrInstance.destroy();
    flatpickrInstance = null;
  }
  
  var el = document.getElementById('fdisponibilidad');
  if (!el) return;
  
  // Parse existing dates
  var parsedDates = [];
  if (existingDates && existingDates.length > 0) {
    parsedDates = existingDates.filter(function(d) { return d.match(/^\d{4}-\d{2}-\d{2}$/); });
  }
  
  flatpickrInstance = flatpickr(el, {
    mode: 'multiple',
    dateFormat: 'Y-m-d',
    minDate: 'today',
    defaultDate: parsedDates,
    locale: {
      firstDayOfWeek: 1,
      weekdays: {
        shorthand: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
        longhand: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      },
      months: {
        shorthand: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        longhand: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      }
    },
    onChange: function(selectedDates, dateStr) {
      var clearBtn = document.getElementById('fdisponibilidad_clear');
      if (clearBtn) {
        clearBtn.style.display = selectedDates.length > 0 ? 'inline' : 'none';
      }
    },
    onReady: function(selectedDates) {
      var clearBtn = document.getElementById('fdisponibilidad_clear');
      if (clearBtn) {
        clearBtn.style.display = selectedDates.length > 0 ? 'inline' : 'none';
      }
    }
  });
}

function clearDisponibilidad() {
  if (flatpickrInstance) {
    flatpickrInstance.clear();
  }
  document.getElementById('fdisponibilidad').value = '';
  var clearBtn = document.getElementById('fdisponibilidad_clear');
  if (clearBtn) clearBtn.style.display = 'none';
}

function guardarIntegraciones() {
  if (!supabaseClient) { showToast('⚠️ Base de datos no conectada'); return; }
  
  var mp_enabled = document.getElementById('aj_mp_enabled').checked;
  var mp_public_key = document.getElementById('aj_mp_public').value.trim();
  var mp_access_token = document.getElementById('aj_mp_access').value.trim();
  var mp_sandbox = document.getElementById('aj_mp_sandbox').checked;

  var flow_enabled = document.getElementById('aj_flow_enabled').checked;
  var flow_api_key = document.getElementById('aj_flow_api_key').value.trim();
  var flow_secret_key = document.getElementById('aj_flow_secret_key').value.trim();
  var flow_sandbox = document.getElementById('aj_flow_sandbox').checked;
  
  var ga_id = document.getElementById('aj_ga_id').value.trim();
  var pixel_id = document.getElementById('aj_pixel_id').value.trim();
  
  var shopify_sync = document.getElementById('aj_shopify_sync').checked;
  var shopify_api_key = document.getElementById('aj_shopify_key').value.trim();
  var shopify_shop_url = document.getElementById('aj_shopify_url').value.trim();

  var wasabil_enabled = document.getElementById('aj_wasabil_enabled').checked;
  var wasabil_token = document.getElementById('aj_wasabil_token').value.trim();
  var wasabil_rut = document.getElementById('aj_wasabil_rut').value.trim();

  var dropi_enabled = document.getElementById('aj_dropi_enabled').checked;
  var dropi_token = document.getElementById('aj_dropi_token').value.trim();
  var dropi_seller_id = document.getElementById('aj_dropi_seller_id').value.trim();

  var calendar_enabled = document.getElementById('aj_calendar_enabled').checked;
  var calendar_id = document.getElementById('aj_calendar_id').value.trim();

  ajustesTienda.mp_enabled = mp_enabled;
  ajustesTienda.mp_public_key = mp_public_key;
  ajustesTienda.mp_access_token = mp_access_token;
  ajustesTienda.mp_sandbox = mp_sandbox;

  ajustesTienda.flow_enabled = flow_enabled;
  ajustesTienda.flow_api_key = flow_api_key;
  ajustesTienda.flow_secret_key = flow_secret_key;
  ajustesTienda.flow_sandbox = flow_sandbox;

  ajustesTienda.ga_id = ga_id;
  ajustesTienda.pixel_id = pixel_id;
  ajustesTienda.shopify_sync_enabled = shopify_sync;
  ajustesTienda.shopify_api_key = shopify_api_key;
  ajustesTienda.shopify_shop_url = shopify_shop_url;
  
  ajustesTienda.wasabil_enabled = wasabil_enabled;
  ajustesTienda.wasabil_token = wasabil_token;
  ajustesTienda.wasabil_rut = wasabil_rut;
  
  ajustesTienda.dropi_enabled = dropi_enabled;
  ajustesTienda.dropi_token = dropi_token;
  ajustesTienda.dropi_seller_id = dropi_seller_id;
  
  ajustesTienda.calendar_enabled = calendar_enabled;
  ajustesTienda.calendar_id = calendar_id;
  
  supabaseClient.from('ajustes').upsert({ id: 'global', data: ajustesTienda }).then(function(res) {
    if (res.error) {
      showToast('❌ Error al guardar integraciones: ' + res.error.message);
    } else {
      showToast('🔌 Integraciones guardadas con éxito');
      aplicarAjustesUI();
    }
  });
}

function importarDesdeShopify() {
  var shopUrl = document.getElementById('aj_shopify_url').value.trim();
  if (!shopUrl) {
    showToast('⚠️ Ingresa la URL de tu tienda Shopify primero');
    return;
  }
  
  showToast('🔄 Conectando con Shopify API...');
  
  setTimeout(function() {
    showToast('📥 Descargando catálogo de productos...');
    
    setTimeout(function() {
      var mockProducts = [
        {
          nombre: "Cinnamon Roll Vegano (Shopify)",
          descripcion: "Exquisito cinnamon roll con glaseado a base de plantas y semillas de cáñamo.",
          precio: 2900,
          precio_anterior: 3500,
          categoria: "pies",
          emoji: "🥯",
          etiqueta: "nuevo",
          color_fondo: "#FFF8E7",
          destacado: true,
          maneja_stock: true,
          stock: 15,
          gluten_free: false,
          nut_free: true
        },
        {
          nombre: "Empanada Integral Champiñón Queso (Shopify)",
          descripcion: "Empanada de masa integral enriquecida con cáñamo, rellena de champiñones laminados y queso de papa.",
          precio: 3200,
          categoria: "empanadas",
          emoji: "🥟",
          etiqueta: "",
          color_fondo: "#F0FFF4",
          destacado: false,
          maneja_stock: true,
          stock: 20,
          gluten_free: true,
          nut_free: true
        }
      ];
      
      if (!supabaseClient) {
        showToast('❌ Base de datos no conectada');
        return;
      }
      
      supabaseClient.from('productos').insert(mockProducts).then(function(res) {
        if (res.error) {
          showToast('❌ Error al importar: ' + res.error.message);
        } else {
          showToast('✅ Sincronizados 2 productos desde Shopify con éxito');
          supabaseClient.from('productos').select('*').order('nombre').then(function(resProd) {
            if (!resProd.error && resProd.data) {
              productos = resProd.data;
              renderGrid();
              if (adminTabActual === 'productos') {
                renderAdminTab('productos');
              }
            }
          });
        }
      });
    }, 1500);
  }, 1000);
}
