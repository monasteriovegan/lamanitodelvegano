const fs = require('fs');

console.log("Reading La Manito Del Vegano 🌱.html...");
let html = fs.readFileSync('La Manito Del Vegano 🌱.html', 'utf8');

// 1. Reemplazar imports de Firebase por Supabase y corregir import de app.js
console.log("Updating JS script tags to load Supabase and app.js...");
html = html.replace('<!-- Firebase SDK -->\n<script src="./La Manito Del Vegano 🌱_files/firebase-app-compat.js.descarga"></script>\n<script src="./La Manito Del Vegano 🌱_files/firebase-firestore-compat.js.descarga"></script>\n<script src="./La Manito Del Vegano 🌱_files/firebase-storage-compat.js.descarga"></script>', 
`<!-- Supabase JS Library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`);

html = html.replace('<script src="./La Manito Del Vegano 🌱_files/firebase-app-compat.js.descarga"></script>\n<script src="./La Manito Del Vegano 🌱_files/firebase-firestore-compat.js.descarga"></script>\n<script src="./La Manito Del Vegano 🌱_files/firebase-storage-compat.js.descarga"></script>', 
`<!-- Supabase JS Library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`);

html = html.replace('<script src="./La Manito Del Vegano 🌱_files/app.js.descarga"></script>', '<script src="app.js"></script>');

// También por si acaso
html = html.replace('href="./La Manito Del Vegano 🌱_files/css2"', 'href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,700&display=swap"');

// 2. Modificar variables CSS a tema Claro Premium (Cream/Sage Green/Dark Sage)
console.log("Updating CSS variables for Cream & Sage light theme...");
const oldVars = `:root{
  --v1:#020705;
  --v2:#051f15;
  --v3:#00b884;
  --v4:#00ffb3;
  --v5:rgba(0, 255, 179, 0.08);
  --neon:#00ffb3;
  --c1:#00ffb3;
  --crema:#020705;
  --texto:#e0ede7;
  --muted:#789286;
  --borde:rgba(0, 255, 179, 0.15);
  --wa:#25D366;
  --wa2:#1DA851;
  --mp:#009EE3;
  --rojo:#EF4444;
  --am:#F59E0B;
  --gold:#D4AF37;
}`;

const newVars = `:root{
  --v1:#1B4332; /* Bosque Oscuro */
  --v2:#2D6A4F; /* Sage Medio */
  --v3:#40916C; /* Marca principal */
  --v4:#52B788; /* Verde Claro */
  --v5:rgba(45, 106, 79, 0.08);
  --neon:#40916C;
  --c1:#2D6A4F;
  --crema:#FCFBF7; /* Crema suave */
  --texto:#1A2521; /* Texto oscuro */
  --muted:#5A6861; /* Verde grisáceo */
  --borde:rgba(45, 106, 79, 0.15);
  --wa:#25D366;
  --wa2:#1DA851;
  --mp:#009EE3;
  --rojo:#EF4444;
  --am:#F59E0B;
  --gold:#D4AF37;
}`;

html = html.replace(oldVars, newVars);

// Reemplazar background del body
html = html.replace('body{font-family:\'Space Grotesk\',sans-serif;background:#030907;color:var(--texto);overflow-x:hidden}', 
'body{font-family:\'Space Grotesk\',sans-serif;background:var(--crema);color:var(--texto);overflow-x:hidden}');

// Corregir barra de navegación para que se vea bien en tema claro
console.log("Refactoring navigation bar styling...");
html = html.replace('background: rgba(3, 9, 7, 0.7);', 'background: rgba(252, 251, 247, 0.85); box-shadow: 0 8px 32px rgba(45, 106, 79, 0.08);');
html = html.replace('border: 1px solid rgba(0, 255, 179, 0.2);', 'border: 1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.ntxt{font-family:\'Syne\',sans-serif;color:white;font-size:14px;line-height:1.2;font-weight:800}', 
'.ntxt{font-family:\'Syne\',sans-serif;color:var(--v1);font-size:14px;line-height:1.2;font-weight:800}');
html = html.replace('.nm{color:rgba(255,255,255,0.65);', '.nm{color:var(--muted);');
html = html.replace('.nm:hover,.nm.on{color:var(--neon);background:rgba(0, 255, 179, 0.08)}', '.nm:hover,.nm.on{color:var(--v1);background:rgba(45, 106, 79, 0.08);font-weight:700;}');
html = html.replace('.cbtn{position:relative;background:rgba(0, 255, 179, 0.1);border:1px solid rgba(0, 255, 179, 0.2);color:white;', 
'.cbtn{position:relative;background:rgba(45, 106, 79, 0.08);border:1px solid rgba(45, 106, 79, 0.2);color:var(--v1);');
html = html.replace('.cbtn:hover{background:rgba(0, 255, 179, 0.2);', '.cbtn:hover{background:rgba(45, 106, 79, 0.15);');

// Ajustes del Hero para tema claro
console.log("Refactoring Hero section background...");
html = html.replace('background:radial-gradient(circle at 50% 0%, rgba(5, 31, 21, 0.8), #030907 70%);', 
'background:radial-gradient(circle at 50% 0%, #E8F5E9 0%, var(--crema) 80%);');
html = html.replace('.hero h1{font-family:\'Space Grotesk\',sans-serif;font-weight:800;font-size:clamp(28px,8vw,48px);color:white;', 
'.hero h1{font-family:\'Syne\',sans-serif;font-weight:800;font-size:clamp(28px,8vw,48px);color:var(--v1);');
html = html.replace('.hero h1{font-family:\'Syne\',sans-serif;font-weight:800;font-size:clamp(28px,8vw,48px);color:white;', 
'.hero h1{font-family:\'Syne\',sans-serif;font-weight:800;font-size:clamp(28px,8vw,48px);color:var(--v1);');
html = html.replace('.hero p{color:rgba(255,255,255,0.7);', '.hero p{color:var(--muted);');
html = html.replace('.htag{background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.8);padding:5px 12px;border-radius:50px;font-size:11px;border:1px solid rgba(255,255,255,0.08)}', 
'.htag{background:white;color:var(--v2);padding:5px 12px;border-radius:50px;font-size:11px;border:1px solid var(--borde);box-shadow:0 2px 8px rgba(0,0,0,0.02)}');
html = html.replace('.btno{background:transparent;color:white;padding:12px 24px;border-radius:50px;font-size:13.5px;font-weight:600;border:2px solid rgba(255,255,255,0.2);', 
'.btno{background:transparent;color:var(--v2);padding:12px 24px;border-radius:50px;font-size:13.5px;font-weight:600;border:2px solid var(--v2);');
html = html.replace('.btno:hover{border-color:white;background:rgba(255,255,255,0.05)}', '.btno:hover{border-color:var(--v1);color:var(--v1);background:rgba(45,106,79,0.05)}');
html = html.replace('.scroll-ind { margin-top: 26px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; color: rgba(255,255,255,0.6);', 
'.scroll-ind { margin-top: 26px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 2px solid var(--v3); border-radius: 50%; color: var(--v2);');

// Ajustes de Stats
console.log("Refactoring stats card styling...");
html = html.replace('background: rgba(5, 20, 14, 0.65);', 'background: white;');
html = html.replace('.stn {', '.stn {\n  color: var(--v2) !important;\n');

// Ajustes del grid de destacados y secciones
console.log("Refactoring destacados overlay and general sections...");
html = html.replace('.dest-sec h2{font-family:\'Syne\',sans-serif;font-weight:800;font-size:20px;color:white;', 
'.dest-sec h2{font-family:\'Syne\',sans-serif;font-weight:800;font-size:20px;color:var(--v1);');
html = html.replace('.dest-overlay{position:absolute;inset:0;background:linear-gradient(to top, rgba(2, 7, 5, 0.95) 0%, rgba(2, 7, 5, 0.4) 60%, transparent 100%);', 
'.dest-overlay{position:absolute;inset:0;background:linear-gradient(to top, rgba(252, 251, 247, 0.95) 0%, rgba(252, 251, 247, 0.2) 60%, transparent 100%);');
html = html.replace('.dest-name{font-family:\'Syne\',sans-serif;font-weight:700;font-size:17px;color:white;', 
'.dest-name{font-family:\'Syne\',sans-serif;font-weight:700;font-size:17px;color:var(--texto);');
html = html.replace('.dest-price{font-size:14px;color:var(--neon);', '.dest-price{font-size:14px;color:var(--v2);');

// Zonas banner y categorización
html = html.replace('.ebanner{margin:0 16px 16px;background:rgba(0, 255, 179, 0.04);', '.ebanner{margin:0 16px 16px;background:white;');
html = html.replace('.ebtit{font-family:\'Syne\',sans-serif;font-weight:700;font-size:15px;color:white;', 
'.ebtit{font-family:\'Syne\',sans-serif;font-weight:700;font-size:15px;color:var(--v1);');
html = html.replace('.zitem{background:rgba(0,0,0,0.2);', '.zitem{background:#f9fafb;');
html = html.replace('.znom{font-size:11px;font-weight:600;color:white}', '.znom{font-size:11px;font-weight:600;color:var(--texto)}');

// Grid de productos
console.log("Refactoring grid of products styling...");
html = html.replace('.sec{font-family:\'Syne\',sans-serif;font-weight:700;font-size:18px;color:white;', 
'.sec{font-family:\'Syne\',sans-serif;font-weight:700;font-size:18px;color:var(--v1);');
html = html.replace('.card{background:rgba(5, 15, 11, 0.65) !important;border:1px solid rgba(0, 255, 179, 0.15) !important;', 
'.card{background:white !important;border:1px solid rgba(45, 106, 79, 0.12) !important;');
html = html.replace('.cname{font-weight:700;font-size:12.5px;margin-bottom:3px;color:white;', 
'.cname{font-weight:700;font-size:12.5px;margin-bottom:3px;color:var(--texto);');

// Reseñas/Comentarios
console.log("Refactoring testimonials styling...");
html = html.replace('.res{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.res{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.rest{font-size:11px;color:rgba(255,255,255,0.9);', '.rest{font-size:11px;color:var(--texto);');
html = html.replace('.resa{font-size:10px;color:var(--neon);', '.resa{font-size:10px;color:var(--v2);');

// Info importante y otras páginas
html = html.replace('.ic{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.ic{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.it{font-weight:700;font-size:12px;margin-bottom:4px;color:white;', 
'.it{font-weight:700;font-size:12px;margin-bottom:4px;color:var(--v1);');
html = html.replace('.val{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.val{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.vt{font-weight:700;font-size:12px;color:var(--neon);', '.vt{font-weight:700;font-size:12px;color:var(--v3);');
html = html.replace('.bc{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.bc{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.btit{font-family:\'Syne\',sans-serif;font-weight:700;font-size:14.5px;margin-bottom:6px;line-height:1.3;color:white}', 
'.btit{font-family:\'Syne\',sans-serif;font-weight:700;font-size:14.5px;margin-bottom:6px;line-height:1.3;color:var(--texto)}');
html = html.replace('.cc{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.cc{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.cch3{font-weight:700;font-size:13px;margin-bottom:1px;color:white;', 
'.cch3{font-weight:700;font-size:13px;margin-bottom:1px;color:var(--texto);');
html = html.replace('.fi{background:rgba(5, 15, 11, 0.65);border:1px solid rgba(0, 255, 179, 0.15);', 
'.fi{background:white;border:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.fq{padding:14px;font-weight:600;font-size:12.5px;cursor:pointer;display:flex;justify-content:space-between;color:white}', 
'.fq{padding:14px;font-weight:600;font-size:12.5px;cursor:pointer;display:flex;justify-content:space-between;color:var(--texto)}');

// Drawer del Carrito (Claro)
console.log("Refactoring cart drawer theme...");
html = html.replace('.cp{background:rgba(4, 12, 9, 0.95);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-left:1px solid rgba(0, 255, 179, 0.2);', 
'.cp{background:white;border-left:1px solid rgba(45, 106, 79, 0.15);');
html = html.replace('.ctit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:21px;margin-bottom:16px;color:white}', 
'.ctit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:21px;margin-bottom:16px;color:var(--v1)}');
html = html.replace('.cin{font-weight:600;font-size:12.5px;color:white;', '.cin{font-weight:600;font-size:12.5px;color:var(--texto);');
html = html.replace('.cip{font-size:12px;color:var(--neon);', '.cip{font-size:12px;color:var(--v3);');
html = html.replace('.totlbl{font-weight:700;font-size:14px;color:white}', '.totlbl{font-weight:700;font-size:14px;color:var(--texto)}');
html = html.replace('.totamt{font-family:\'Space Grotesk\',sans-serif;font-size:24px;color:var(--neon);', 
'.totamt{font-family:\'Space Grotesk\',sans-serif;font-size:24px;color:var(--v2);');
html = html.replace('.ftit{font-weight:700;font-size:12px;margin:12px 0 8px;color:rgba(255,255,255,0.9)}', 
'.ftit{font-weight:700;font-size:12px;margin:12px 0 8px;color:var(--texto)}');
html = html.replace('.fb{padding:8px 3px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);text-align:center;font-family:\'Space Grotesk\',sans-serif;color:white}', 
'.fb{padding:8px 3px;border-radius:9px;border:1px solid var(--borde);background:#f9fafb;text-align:center;font-family:\'Space Grotesk\',sans-serif;color:var(--texto)}');
html = html.replace('.ilbl{font-weight:600;font-size:12px;margin-bottom:4px;display:block;color:rgba(255,255,255,0.9)}', 
'.ilbl{font-weight:600;font-size:12px;margin-bottom:4px;display:block;color:var(--texto)}');
html = html.replace('.inp{width:100%;padding:10px 12px;border:1px solid rgba(0, 255, 179, 0.2);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:rgba(0,0,0,0.3);color:white;', 
'.inp{width:100%;padding:10px 12px;border:1px solid var(--borde);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:white;color:var(--texto);');
html = html.replace('.bclose{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:10px;border-radius:12px;font-size:12px;color:rgba(255,255,255,0.8);', 
'.bclose{width:100%;background:#f1f3f2;border:1px solid var(--borde);padding:10px;border-radius:12px;font-size:12px;color:var(--muted);');

// Drawer del Login y Modales (Claros)
console.log("Refactoring modales and login overlay...");
html = html.replace('.loginbox{background:#040c09;border:1px solid rgba(0, 255, 179, 0.2);border-radius:20px;padding:30px 24px;text-align:center;max-width:320px;width:100%;color:white;', 
'.loginbox{background:white;border:1px solid var(--borde);border-radius:20px;padding:30px 24px;text-align:center;max-width:320px;width:100%;color:var(--texto);');
html = html.replace('.logintit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:22px;margin-bottom:6px;color:white}', 
'.logintit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:22px;margin-bottom:6px;color:var(--v1)}');
html = html.replace('.logininp{width:100%;padding:12px 14px;border:1px solid rgba(0, 255, 179, 0.2);border-radius:11px;font-size:16px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:rgba(0,0,0,0.3);color:white;', 
'.logininp{width:100%;padding:12px 14px;border:1px solid var(--borde);border-radius:11px;font-size:16px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:#f9fafb;color:var(--texto);');
html = html.replace('.modalbox{background:#040c09;border:1px solid rgba(0, 255, 179, 0.2);border-radius:20px;padding:20px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.6);animation:pop 0.2s ease-out;color:white}', 
'.modalbox{background:white;border:1px solid var(--borde);border-radius:20px;padding:20px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.06);animation:pop 0.2s ease-out;color:var(--texto)}');
html = html.replace('.modaltit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:19px;margin-bottom:14px;color:white}', 
'.modaltit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:19px;margin-bottom:14px;color:var(--v1)}');
html = html.replace('.flbl{font-weight:600;font-size:12px;margin-bottom:4px;display:block;color:rgba(255,255,255,0.9)}', 
'.flbl{font-weight:600;font-size:12px;margin-bottom:4px;display:block;color:var(--texto)}');
html = html.replace('.finp{width:100%;padding:10px 12px;border:1px solid rgba(0, 255, 179, 0.2);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:rgba(0,0,0,0.3);color:white}', 
'.finp{width:100%;padding:10px 12px;border:1px solid var(--borde);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:#f9fafb;color:var(--texto)}');
html = html.replace('.fsel{width:100%;padding:10px 12px;border:1px solid rgba(0, 255, 179, 0.2);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:rgba(0,0,0,0.3);color:white}', 
'.fsel{width:100%;padding:10px 12px;border:1px solid var(--borde);border-radius:10px;font-size:12px;font-family:\'Space Grotesk\',sans-serif;outline:none;background:white;color:var(--texto)}');
html = html.replace('.bcancelar{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);', 
'.bcancelar{background:#f1f3f2;border:1px solid var(--borde);color:var(--muted);');

// Confirm modal
html = html.replace('.confbox{background:#040c09;border:1px solid rgba(0, 255, 179, 0.2);border-radius:20px;padding:28px 20px;text-align:center;max-width:320px;width:100%;color:white;', 
'.confbox{background:white;border:1px solid var(--borde);border-radius:20px;padding:28px 20px;text-align:center;max-width:320px;width:100%;color:var(--texto);');
html = html.replace('.cftit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:19px;margin-bottom:6px;color:white}', 
'.cftit{font-family:\'Syne\',sans-serif;font-weight:800;font-size:19px;margin-bottom:6px;color:var(--v1)}');

// Detail modal (Cliente)
console.log("Refactoring client detail modal theme...");
html = html.replace('.modalbox" style="padding: 0; overflow: hidden; max-width: 450px;">', 
'.modalbox" style="padding: 0; overflow: hidden; max-width: 450px; background:white; color:var(--texto);">');
html = html.replace('color:var(--v1); margin-bottom:8px;', 'color:var(--v1); margin-bottom:8px; font-weight:800;');
html = html.replace('color:var(--v2); font-weight:700;', 'color:var(--v3); font-weight:800;');

// Footer
console.log("Refactoring footer theme...");
html = html.replace('footer{background:rgba(2, 7, 5, 0.8);', 'footer{background:var(--v1); color:white;');

console.log("Writing patched html to index.html...");
fs.writeFileSync('index.html', html, 'utf8');
console.log("HTML Patched successfully!");
