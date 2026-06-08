$c = Get-Content 'index.html' -Raw -Encoding UTF8

$css = @"
/* ADMIN DASHBOARD V2 */
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
.btn-add:hover { background:var(--v2); transform:translateY(-1px); }

/* CHATBOT WIDGET */
.chat-btn { position:fixed; bottom:24px; right:24px; width:60px; height:60px; background:var(--v3); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; box-shadow:0 8px 24px rgba(64,145,108,0.3); cursor:pointer; z-index:900; transition:0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.chat-btn:hover { transform:scale(1.1); background:var(--v2); }
.chat-window { position:fixed; bottom:100px; right:24px; width:340px; height:480px; background:white; border-radius:20px; box-shadow:0 12px 40px rgba(0,0,0,0.15); z-index:900; display:flex; flex-direction:column; overflow:hidden; opacity:0; pointer-events:none; transform:translateY(20px); transition:0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.chat-window.open { opacity:1; pointer-events:auto; transform:translateY(0); }
.chat-head { background:var(--v1); color:white; padding:20px; display:flex; align-items:center; gap:12px; }
.chat-av { width:40px; height:40px; background:var(--v5); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; }
.chat-htit { font-weight:700; font-family:Fraunces,serif; font-size:16px; margin-bottom:2px; }
.chat-hsub { font-size:12px; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:4px; }
.chat-dot { width:6px; height:6px; background:#4ADE80; border-radius:50%; }
.chat-body { flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:#F8FAFC; }
.cmsg { max-width:85%; padding:12px 16px; border-radius:16px; font-size:14px; line-height:1.4; position:relative; }
.cmsg.bot { background:white; color:var(--texto); border-bottom-left-radius:4px; align-self:flex-start; box-shadow:0 2px 8px rgba(0,0,0,0.04); border:1px solid #F1F5F9; }
.cmsg.user { background:var(--v3); color:white; border-bottom-right-radius:4px; align-self:flex-end; box-shadow:0 2px 8px rgba(64,145,108,0.2); }
.chat-foot { padding:16px; background:white; border-top:1px solid #F1F5F9; display:flex; gap:12px; align-items:center; }
.chat-inp { flex:1; background:#F1F5F9; border:none; padding:12px 16px; border-radius:100px; font-family:'DM Sans',sans-serif; font-size:14px; outline:none; transition:0.2s; }
.chat-inp:focus { background:#E2E8F0; }
.chat-send { width:40px; height:40px; background:var(--v3); color:white; border:none; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.2s; flex-shrink:0; }
.chat-send:hover { background:var(--v2); }
.chat-send:disabled { background:#CBD5E1; cursor:not-allowed; }
.typing-dot { display:inline-block; width:4px; height:4px; background:#CBD5E1; border-radius:50%; margin:0 2px; animation:blink 1.4s infinite both; }
.typing-dot:nth-child(2) { animation-delay:0.2s; }
.typing-dot:nth-child(3) { animation-delay:0.4s; }
@keyframes blink { 0% { opacity:0.2; } 20% { opacity:1; } 100% { opacity:0.2; } }
</style>
"@

$c = $c -replace '</style>', $css

$adminHTML = @"
<!-- ADMIN OVERLAY -->
<div class="ov" id="adminov" style="padding:0">
  <div class="admin-dash" style="width:100%;height:100%;">
    <div class="admin-side">
      <div class="admin-slogo">🌱 La Manito Panel</div>
      <div class="admin-smenu">
        <div class="atab on" onclick="aTab('productos',this)">📦 Inventario</div>
        <div class="atab" onclick="aTab('zonas',this)">🚚 Zonas de Envío</div>
        <div class="atab" onclick="aTab('stats',this)">📊 Estadísticas</div>
      </div>
      <div style="margin-top:auto; padding:24px;">
        <button class="btn-sm btn-sec" style="width:100%; justify-content:center; color:white; background:rgba(255,255,255,0.1)" onclick="cerrarAdmin()">🚪 Salir del panel</button>
      </div>
    </div>
    <div class="admin-main">
      <div class="acont" id="acont" style="padding:0; border:none; background:transparent; overflow:visible;"></div>
    </div>
  </div>
</div>
"@

$c = $c -replace '(?s)<!-- ADMIN OVERLAY -->.*?</div>\s*</div>\s*</div>', $adminHTML

$chatHTML = @"
<!-- CHATBOT WIDGET -->
<div class="chat-btn" onclick="toggleChat()" id="chatBtn">💬</div>
<div class="chat-window" id="chatWin">
  <div class="chat-head">
    <div class="chat-av">🤖</div>
    <div>
      <div class="chat-htit">Asistente Vegano</div>
      <div class="chat-hsub"><div class="chat-dot"></div> En línea</div>
    </div>
    <div style="margin-left:auto; cursor:pointer; font-size:24px; opacity:0.8" onclick="toggleChat()">&times;</div>
  </div>
  <div class="chat-body" id="chatBody">
    <div class="cmsg bot">¡Hola! Soy tu asistente inteligente 🌱. ¿Te puedo ayudar a elegir algo rico hoy o tienes alguna duda?</div>
  </div>
  <div class="chat-foot">
    <input type="text" class="chat-inp" id="chatInp" placeholder="Escribe tu mensaje..." onkeypress="if(event.key==='Enter') sendChat()">
    <button class="chat-send" id="chatSend" onclick="sendChat()">
      <svg style="width:18px;height:18px;fill:white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
</div>
<script src="app.js"></script>
</body>
</html>
"@

$c = $c -replace '<script src="app.js"></script>\s*</body>\s*</html>', $chatHTML

Set-Content 'index.html' -Value $c -Encoding UTF8
