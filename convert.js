const fs = require('fs');

console.log("Reading app.js.descarga...");
let js = fs.readFileSync('La Manito Del Vegano 🌱_files/app.js.descarga', 'utf8');

// 1. Reemplazar configuración de Firebase por Supabase
console.log("Replacing Firebase config with Supabase...");
const oldFirebaseInit = `// === CONFIGURACIÓN DE FIREBASE ===
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
  if (storage) {
    storage.setMaxUploadRetryTime(5000); // 5 segundos max retry para evitar bloqueos
  }
} catch(e) { console.log("Firebase no configurado aún", e); }`;

const newSupabaseInit = `// === CONFIGURACIÓN DE SUPABASE ===
var SUPABASE_URL = 'https://adrydqvahzqjbgtcvlay.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcnlkcXZhaHpxamJndGN2bGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjExMDAsImV4cCI6MjA5NTkzNzEwMH0.mjpGjVN90sHJAahn3NTslo3wLzW0ttQlOrwBQ62BZko';
var SUPABASE_BUCKET = 'productos';

var supabaseClient = null;
var supabaseStorageBucket = SUPABASE_BUCKET;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch(e) { console.log("Error iniciando Supabase:", e); }`;

js = js.replace(oldFirebaseInit, newSupabaseInit);

// 2. Reemplazar loadData()
console.log("Replacing loadData function...");
const oldLoadDataStart = `function loadData() {
  if (!db || firebaseConfig.apiKey === "TU_API_KEY") {`;

// Buscamos el final de la función loadData que termina antes de var carrito = {};
const loadDataEndIdx = js.indexOf('var carrito = {};');
const loadDataStartIdx = js.indexOf('function loadData() {');

const newLoadData = `function loadData() {
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
  
  supabaseClient.from('productos').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      productos = res.data || [];
      renderGrid(); renderDestacados();
      if (adminTabActual === 'productos' || adminTabActual === 'destacados' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });

  supabaseClient.from('zonas').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      zonas = res.data || [];
      renderZonas();
      if (adminTabActual === 'zonas' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });

  supabaseClient.from('pedidos').select('*').order('createdAt', { ascending: false }).then(function(res) {
    if (!res.error) {
      pedidos = res.data || [];
      if (adminTabActual === 'pedidos' || adminTabActual === 'stats') {
        renderAdminTab(adminTabActual);
      }
    }
  });

  supabaseClient.from('categorias').select('*').order('nombre').then(function(res) {
    if (!res.error) {
      categorias = res.data || [];
      if (categorias.length === 0) {
        var defaultCats = [
          { nombre: 'Empanadas', emoji: '🥟', slug: 'empanadas' },
          { nombre: 'Pies', emoji: '🫐', slug: 'pies' },
          { nombre: 'Manjares', emoji: '🍯', slug: 'manjares' },
          { nombre: 'Packs', emoji: '📦', slug: 'packs' }
        ];
        supabaseClient.from('categorias').insert(defaultCats).then(function() { loadData(); });
        return;
      }
      renderCategoriasUI();
      if (adminTabActual === 'categorias' || adminTabActual === 'productos') {
        renderAdminTab(adminTabActual);
      }
    }
  });

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

  supabaseClient.from('cupones').select('*').then(function(res) {
    if (!res.error) {
      cupones = res.data || [];
      if (adminTabActual === 'cupones') {
        renderAdminTab('cupones');
      }
    }
  });

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

`;

js = js.substring(0, loadDataStartIdx) + newLoadData + js.substring(loadDataEndIdx);

// 3. Reemplazar operaciones individuales
console.log("Replacing Firestore operations with Supabase equivalents...");

// Cupones get
js = js.replace(/db\.collection\("cupones"\)\.doc\(codigo\)\.get\(\)\.then\(function\(doc\) \{[\r\n\s]*if \(doc\.exists\) \{[\r\n\s]*cuponActivo = doc\.data\(\);[\r\n\s]*cuponActivo\.code = doc\.id;/g,
`supabaseClient.from('cupones').select('*').eq('id', codigo).maybeSingle().then(function(res) {
    if (res.data) {
      cuponActivo = res.data;
      cuponActivo.code = res.data.id;`);

// Puntos set/upsert
js = js.replace(/db\.collection\("puntos_pins"\)\.doc\(identifier\)\.set\(\{[\r\n\s]*pin: nuevoPin,[\r\n\s]*createdAt: new Date\(\)\.toISOString\(\)[\r\n\s]*\}\)\.then\(function\(\) \{/g,
`supabaseClient.from('puntos_pins').upsert({
    id: identifier,
    pin: nuevoPin,
    created_at: new Date().toISOString()
  }).then(function(res) {
    if (res.error) throw res.error;`);

// Puntos get pedidos
js = js.replace(/db\.collection\("pedidos"\)\.get\(\)\.then\(function\(querySnapshot\) \{[\r\n\s]*var totalGanados = 0;[\r\n\s]*var totalCanjeados = 0;[\r\n\s]*querySnapshot\.forEach\(function\(doc\) \{[\r\n\s]*var p = doc\.data\(\);/g,
`supabaseClient.from('pedidos').select('*').then(function(res) {
    if (res.error) throw res.error;
    var totalGanados = 0;
    var totalCanjeados = 0;
    (res.data || []).forEach(function(p) {`);

// Puntos check pin
js = js.replace(/db\.collection\("puntos_pins"\)\.doc\(identifier\)\.get\(\)\.then\(function\(doc\) \{[\r\n\s]*if \(doc\.exists\) \{[\r\n\s]*pinRegistrado = true;[\r\n\s]*clientePinDb = doc\.data\(\)\.pin;/g,
`supabaseClient.from('puntos_pins').select('*').eq('id', identifier).maybeSingle().then(function(res2) {
        if (res2.data) {
          pinRegistrado = true;
          clientePinDb = res2.data.pin;`);

// Crear pedido y descontar stock
const oldCreatePedido = `  return db.collection("pedidos").add(pedidoData).then(function(docRef) {
    ultimoPedidoId = docRef.id;
    
    var batch = db.batch();
    var keys = Object.keys(carrito);
    for (var i=0; i<keys.length; i++) {
      var item = carrito[keys[i]];
      if (item.id.indexOf('t') !== 0) { // No descontar stock de productos fake
        var docRefProd = db.collection("productos").doc(item.id);
        // Descontar stock
        var originalProd = productos.find(function(x){return x.id === item.id;});
        if (originalProd && originalProd.maneja_stock) {
          var nuevoStock = Math.max(0, originalProd.stock - item.qty);
          batch.update(docRefProd, { stock: nuevoStock });
        }
      }
    }
    return batch.commit().then(function() {
      return docRef;
    });
  });`;

const newCreatePedido = `  return supabaseClient.from('pedidos').insert([pedidoData]).select().then(function(res) {
    if (res.error) throw res.error;
    var docRef = { id: res.data[0].id };
    ultimoPedidoId = docRef.id;
    
    var promises = [];
    var keys = Object.keys(carrito);
    for (var i=0; i<keys.length; i++) {
      var item = carrito[keys[i]];
      if (item.id.indexOf('t') !== 0) {
        var originalProd = productos.find(function(x){return x.id === item.id;});
        if (originalProd && originalProd.maneja_stock) {
          var nuevoStock = Math.max(0, originalProd.stock - item.qty);
          promises.push(
            supabaseClient.from('productos').update({ stock: nuevoStock }).eq('id', item.id)
          );
        }
      }
    }
    return Promise.all(promises).then(function() {
      return docRef;
    });
  });`;

js = js.replace(oldCreatePedido, newCreatePedido);

// Guardar producto
const oldGuardarProd = `  if (editandoId===null) {
    data.destacado = false;
    db.collection("productos").add(data).then(function() { showToast('✅ Producto agregado'); });
  } else {
    var p = productos.find(function(x){return x.id === editandoId;});
    if(p) data.destacado = p.destacado;
    db.collection("productos").doc(editandoId).update(data).then(function() { showToast('✅ Producto actualizado'); });
  }`;

const newGuardarProd = `  if (precio > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  if (precio_anterior && precio_anterior > 2147483647) { showToast('⚠️ El precio anterior supera el límite permitido'); return; }

  if (editandoId===null) {
    data.destacado = false;
    supabaseClient.from('productos').insert([data]).then(function(res) { 
      if(res.error) showToast('❌ Error: ' + res.error.message);
      else showToast('✅ Producto agregado'); 
    });
  } else {
    var p = productos.find(function(x){return x.id === editandoId;});
    if(p) data.destacado = p.destacado;
    supabaseClient.from('productos').update(data).eq('id', editandoId).then(function(res) { 
      if(res.error) showToast('❌ Error: ' + res.error.message);
      else showToast('✅ Producto actualizado'); 
    });
  }`;

js = js.replace(oldGuardarProd, newGuardarProd);

// Eliminar producto
js = js.replace(/db\.collection\("productos"\)\.doc\(id\)\.delete\(\)\.then\(function\(\) \{[\r\n\s]*showToast\('🗑️ Producto eliminado'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('productos').delete().eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('🗑️ Producto eliminado'); 
  });`);

// Destacar producto
js = js.replace(/db\.collection\("productos"\)\.doc\(id\)\.update\(\{destacado:[\r\n\s]*!p\.destacado\}\)\.then\(function\(\) \{[\r\n\s]*showToast\('⭐ Destacado actualizado'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('productos').update({destacado: !p.destacado}).eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('⭐ Destacado actualizado'); 
  });`);

// Guardar zona
js = js.replace(/db\.collection\("zonas"\)\.doc\(id\)\.update\(\{nombre:nom, comunas:com, precio:pre\}\)\.then\(function\(\) \{[\r\n\s]*showToast\('✅ Zona guardada'\);[\r\n\s]*\}\);/g,
`if (pre > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  supabaseClient.from('zonas').update({nombre:nom, comunas:com, precio:pre}).eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('✅ Zona guardada'); 
  });`);

// Agregar zona
js = js.replace(/db\.collection\("zonas"\)\.add\(\{nombre:nom, comunas:com, precio:pre\}\)\.then\(function\(\) \{[\r\n\s]*document\.getElementById\('nznom'\)\.value='';[\r\n\s]*document\.getElementById\('nzcom'\)\.value='';[\r\n\s]*document\.getElementById\('nzpre'\)\.value='0';[\r\n\s]*showToast\('✅ Zona agregada'\);[\r\n\s]*\}\);/g,
`if (pre > 2147483647) { showToast('⚠️ El precio supera el límite permitido'); return; }
  supabaseClient.from('zonas').insert([{nombre:nom, comunas:com, precio:pre}]).then(function(res) {
    if(res.error) { showToast('❌ Error: ' + res.error.message); return; }
    document.getElementById('nznom').value='';
    document.getElementById('nzcom').value='';
    document.getElementById('nzpre').value='0';
    showToast('✅ Zona agregada');
  });`);

// Eliminar zona
js = js.replace(/db\.collection\("zonas"\)\.doc\(id\)\.delete\(\)\.then\(function\(\) \{[\r\n\s]*showToast\('🗑️ Zona eliminada'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('zonas').delete().eq('id', id).then(function(res) { 
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('🗑️ Zona eliminada'); 
  });`);

// Guardar ajustes
js = js.replace(/db\.collection\("ajustes"\)\.doc\("global"\)\.set\(data\)\.then\(function\(\) \{[\r\n\s]*showToast\('✅ Ajustes guardados'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('ajustes').upsert({id: 'global', data: data}).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('✅ Ajustes guardados');
  });`);

// Agregar cupón
js = js.replace(/db\.collection\("cupones"\)\.doc\(code\)\.set\(data\)\.then\(function\(\) \{[\r\n\s]*document\.getElementById\('nccode'\)\.value='';[\r\n\s]*document\.getElementById\('ncvalor'\)\.value='';[\r\n\s]*document\.getElementById\('ncmin'\)\.value='0';[\r\n\s]*showToast\('✅ Cupón guardado'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('cupones').upsert({
    id: code,
    code: code,
    tipo: data.tipo,
    valor: data.valor,
    minMonto: data.minMonto
  }).then(function(res) {
    if(res.error) { showToast('❌ Error: ' + res.error.message); return; }
    document.getElementById('nccode').value='';
    document.getElementById('ncvalor').value='';
    document.getElementById('ncmin').value='0';
    showToast('✅ Cupón guardado');
  });`);

// Eliminar cupón
js = js.replace(/db\.collection\("cupones"\)\.doc\(code\)\.delete\(\)\.then\(function\(\) \{[\r\n\s]*showToast\('🗑️ Cupón eliminado'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('cupones').delete().eq('id', code).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('🗑️ Cupón eliminado');
  });`);

// Mercado Pago callback 1
js = js.replace(/db\.collection\("pedidos"\)\.doc\(ultimoPedidoId\)\.update\(\{[\r\n\s]*txHash: hash,[\r\n\s]*status: 'Confirmado'[\r\n\s]*\}\)\.then\(function\(\) \{/g,
`supabaseClient.from('pedidos').update({
        txHash: hash,
        status: 'Confirmado'
      }).eq('id', ultimoPedidoId).then(function(res) {
        if(res.error) throw res.error;`);

// Mercado Pago callback 2
js = js.replace(/db\.collection\("pedidos"\)\.doc\(ultimoPedidoId\)\.update\(\{[\r\n\s]*status: 'Confirmado'[\r\n\s]*\}\)\.then\(function\(\) \{/g,
`supabaseClient.from('pedidos').update({
        status: 'Confirmado'
      }).eq('id', ultimoPedidoId).then(function(res) {
        if(res.error) throw res.error;`);

// Actualizar estado pedido
js = js.replace(/db\.collection\("pedidos"\)\.doc\(id\)\.update\(\{ status: nuevoEstado \}\)\.then\(function\(\) \{[\r\n\s]*showToast\('📋 Estado de pedido actualizado'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('pedidos').update({ status: nuevoEstado }).eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('📋 Estado de pedido actualizado');
  });`);

// Eliminar pedido
js = js.replace(/function eliminarPedido\(id\) \{[\r\n\s]*if \(!confirm\('¿Eliminar este pedido definitivamente\?'\)\) return;[\r\n\s]*db\.collection\("pedidos"\)\.doc\(id\)\.delete\(\)\.then\(function\(\) \{[\r\n\s]*showToast\('🗑️ Pedido eliminado'\);[\r\n\s]*\}\);[\r\n\s]*\}/g,
`function eliminarPedido(id) {
  if (!confirm('¿Eliminar este pedido definitivamente?')) return;
  supabaseClient.from('pedidos').delete().eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('🗑️ Pedido eliminado');
  });
}`);

// Agregar categoría
js = js.replace(/db\.collection\("categorias"\)\.add\(\{[\r\n\s]*nombre: nom,[\r\n\s]*emoji: emo,[\r\n\s]*slug: slug[\r\n\s]*\}\)\.then\(function\(\) \{[\r\n\s]*document\.getElementById\('ncatnom'\)\.value = '';[\r\n\s]*document\.getElementById\('ncatemo'\)\.value = '🌿';[\r\n\s]*showToast\('✅ Categoría agregada'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('categorias').insert([{
    nombre: nom,
    emoji: emo,
    slug: slug
  }]).then(function(res) {
    if(res.error) { showToast('❌ Error: ' + res.error.message); return; }
    document.getElementById('ncatnom').value = '';
    document.getElementById('ncatemo').value = '🌿';
    showToast('✅ Categoría agregada');
  });`);

// Eliminar categoría
js = js.replace(/db\.collection\("categorias"\)\.doc\(id\)\.delete\(\)\.then\(function\(\) \{[\r\n\s]*showToast\('🗑️ Categoría eliminada'\);[\r\n\s]*\}\);/g,
`supabaseClient.from('categorias').delete().eq('id', id).then(function(res) {
    if(res.error) showToast('❌ Error: ' + res.error.message);
    else showToast('🗑️ Categoría eliminada');
  });`);

// Rastrear pedido
js = js.replace(/db\.collection\("pedidos"\)\.get\(\)\.then\(function\(querySnapshot\) \{[\r\n\s]*var encontrado = false;[\r\n\s]*var pedDoc = null;[\r\n\s]*querySnapshot\.forEach\(function\(doc\) \{[\r\n\s]*if \(doc\.id\.toLowerCase\(\)\.substring\(0,6\) === code \|\| doc\.id\.toLowerCase\(\) === code\) \{[\r\n\s]*encontrado = true;[\r\n\s]*pedDoc = doc;[\r\n\s]*\}[\r\n\s]*\}\);/g,
`supabaseClient.from('pedidos').select('*').then(function(res) {
    if (res.error) throw res.error;
    var encontrado = false;
    var pedDoc = null;
    (res.data || []).forEach(function(doc) {
      if (doc.id.toLowerCase().substring(0,6) === code || doc.id.toLowerCase() === code) {
        encontrado = true;
        pedDoc = doc;
      }
    });`);

js = js.replace(/var pedDoc = null;[\r\n\s]*\(res\.data \|\| \[\]\)\.forEach\(function\(doc\) \{[\r\n\s]*if \(doc\.id\.toLowerCase\(\)\.substring\(0,6\) === code \|\| doc\.id\.toLowerCase\(\) === code\) \{[\r\n\s]*encontrado = true;[\r\n\s]*pedDoc = doc;[\r\n\s]*\}[\r\n\s]*\}\);[\r\n\s]*if \(encontrado\) \{[\r\n\s]*if \(typeof trackerListener === 'function'\) trackerListener\(\);[\r\n\s]*trackerListener = db\.collection\("pedidos"\)\.doc\(pedDoc\.id\)\.onSnapshot\(function\(doc\) \{[\r\n\s]*if \(doc\.exists\) \{[\r\n\s]*renderPedidoTrackerUI\(doc\.data\(\), doc\.id\);[\r\n\s]*\}[\r\n\s]*\}\);/g,
`var pedDoc = null;
    (res.data || []).forEach(function(doc) {
      if (doc.id.toLowerCase().substring(0,6) === code || doc.id.toLowerCase() === code) {
        encontrado = true;
        pedDoc = doc;
      }
    });
    if (encontrado) {
      renderPedidoTrackerUI(pedDoc, pedDoc.id);`);

// 4. Reemplazar subirImagen con la versión de Supabase
console.log("Replacing image upload logic with Supabase storage upload...");
const oldSubirImagenStart = `function subirImagen(input) {`;
const nextFuncStartIdx = js.indexOf('function actualizarPreview(val) {');
const subirImagenStartIdx = js.indexOf('function subirImagen(input) {');

const newSubirImagen = `function subirImagen(input) {
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
    .replace(/[\\u0300-\\u036f]/g, '')
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
`;

js = js.substring(0, subirImagenStartIdx) + newSubirImagen + js.substring(nextFuncStartIdx);

console.log("Writing patched app.js to root...");
fs.writeFileSync('app.js', js, 'utf8');
console.log("Patched successfully!");
