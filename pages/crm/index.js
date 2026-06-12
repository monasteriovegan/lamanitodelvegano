/**
 * pages/crm/index.js
 * CRM completo de La Manito del Vegano
 * Usa /api/chat como proxy multi-proveedor
 */

import { useState, useEffect, useRef } from "react";
import { MODELS, PROVIDERS, getModel } from "../../lib/models";

// ════════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ════════════════════════════════════════════════════════════════
const T = {
  green:  "#2D6A4F", lime:   "#52B788", mint:   "#B7E4C7",
  cream:  "#F8F4EC", sand:   "#E9DCC9", hemp:   "#9C6933",
  dark:   "#12221A", mid:    "#3D5A47", muted:  "#7A8F82",
  white:  "#FFFFFF", red:    "#D64045", amber:  "#E8A838",
  blue:   "#2176AE", purple: "#6B4FA0", soft:   "#EEF6F1",
};

// ════════════════════════════════════════════════════════════════
//  CONSTANTES
// ════════════════════════════════════════════════════════════════
const STAGES = [
  { id: "nuevo",      label: "Nuevo",      color: T.muted,  emoji: "🌱" },
  { id: "contactado", label: "Contactado", color: T.blue,   emoji: "📨" },
  { id: "interesado", label: "Interesado", color: T.amber,  emoji: "🔥" },
  { id: "cotizado",   label: "Cotizado",   color: T.purple, emoji: "📋" },
  { id: "cerrado",    label: "Cerrado ✓",  color: T.green,  emoji: "🎉" },
  { id: "perdido",    label: "Perdido",    color: T.red,    emoji: "❌" },
];

const PRODUCTOS = [
  "Manjar de cáñamo", "Empanadas veganas", "Pack Dúo",
  "Box regalo vegano", "Semillas de cáñamo", "Otro / Consulta",
];

const CANALES = ["Instagram DM", "WhatsApp", "Web", "Referido", "TikTok", "Facebook", "Presencial"];

// ════════════════════════════════════════════════════════════════
//  STORAGE LOCAL (fallback mientras no hay Supabase)
// ════════════════════════════════════════════════════════════════
const LS = {
  get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set: (k, v)   => localStorage.setItem(k, JSON.stringify(v)),
};

// ════════════════════════════════════════════════════════════════
//  PROMPT SISTEMA
// ════════════════════════════════════════════════════════════════
function buildSystem(lead) {
  const stage = STAGES.find(s => s.id === lead?.stage) || STAGES[0];
  return `Eres el agente de ventas IA de "La Manito del Vegano" (@lamanitodelvegano), marca chilena artesanal de productos veganos a base de semillas de cáñamo. Productos estrella: manjar de cáñamo y empanadas veganas. Operas en Santiago y Pucón, Chile.

CLIENTE: ${lead?.name || "desconocido"} | Canal: ${lead?.channel} | Producto: ${lead?.product} | Etapa: ${stage.emoji} ${stage.label} | Interacciones: ${lead?.interactions || 0} | Notas: ${lead?.notes || "ninguna"} | Valor: ${lead?.value ? "$" + Number(lead.value).toLocaleString("es-CL") : "sin cotizar"}

ESTRATEGIA SEGÚN ETAPA:
- nuevo: genera curiosidad, pregunta qué los llevó aquí
- contactado: profundiza la necesidad
- interesado: presenta beneficios, maneja objeciones, cotiza
- cotizado: seguimiento, resuelve dudas, cierra con urgencia
- cerrado: felicita, pide reseña, ofrece recompra
- perdido: recupera con nueva propuesta de valor

OBJECIONES:
- "Es caro" → "El manjar rinde bastante, una tapa dura semanas. ¿Cuánto pagas hoy por algo así de especial?"
- "No conozco el cáñamo" → "Es la semilla más completa nutricionalmente. ¿Nunca habías probado algo así?"
- "Sin delivery" → "Despachamos a Santiago y Pucón, ¿dónde estás tú?"

PRECIOS: manjar $4.500-6.000 | empanadas $2.500-3.500 c/u | pack dúo $9.000
PAGO: transferencia, MercadoPago, efectivo
TONO: ${lead?.tone || "amigable y cercano"} | Español chileno natural. Respuestas cortas para chat (máx 4 párrafos). Termina siempre con un CTA claro.`;
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const uid      = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const nowISO   = () => new Date().toISOString();
const fmtDate  = iso => iso ? new Date(iso).toLocaleDateString("es-CL", { day:"2-digit", month:"short" }) : "—";
const fmtTime  = iso => iso ? new Date(iso).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }) : "";
const daysLeft = iso => iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : null;

// ════════════════════════════════════════════════════════════════
//  SUB-COMPONENTES
// ════════════════════════════════════════════════════════════════
function Badge({ color, children }) {
  return <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{children}</span>;
}

function Btn({ onClick, children, color=T.green, outline, small, disabled, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: outline ? "transparent" : (disabled ? T.sand : color),
      border:`1.5px solid ${disabled ? T.sand : color}`,
      borderRadius:8, color: outline ? color : (disabled ? T.muted : T.white),
      padding: small ? "5px 12px" : "8px 16px",
      fontSize: small ? 12 : 13, fontWeight:600,
      cursor: disabled ? "not-allowed" : "pointer",
      width: full ? "100%" : "auto",
    }}>{children}</button>
  );
}

function Field({ label, value, onChange, type="text", placeholder, options }) {
  const s = { width:"100%", marginTop:4, padding:"8px 12px", border:`1.5px solid ${T.sand}`, borderRadius:8, fontSize:13, background:T.soft, outline:"none", fontFamily:"inherit" };
  return (
    <div style={{ marginBottom:12 }}>
      {label && <div style={{ fontSize:11, fontWeight:700, color:T.hemp, textTransform:"uppercase", letterSpacing:.8 }}>{label}</div>}
      {options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={s}>{options.map(o=><option key={o.value||o}>{o.label||o}</option>)}</select>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s} />
      }
    </div>
  );
}

function Card({ children, style={} }) {
  return <div style={{ background:T.white, borderRadius:12, border:`1px solid ${T.sand}`, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", ...style }}>{children}</div>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(18,34,26,0.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:T.white, borderRadius:16, padding:24, maxWidth:520, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:16, color:T.dark }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:T.muted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Selector de modelo agrupado por proveedor ──────────────────
function ModelSelector({ value, onChange }) {
  const current = getModel(value);
  return (
    <div style={{ position:"relative" }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background:"rgba(255,255,255,0.08)",
          border:`1px solid rgba(82,183,136,0.35)`,
          borderRadius:8, color:T.lime,
          padding:"5px 10px", fontSize:12,
          cursor:"pointer", outline:"none",
          maxWidth:200,
        }}
      >
        {PROVIDERS.map(prov => (
          <optgroup key={prov} label={`── ${prov} ──`} style={{ background:T.dark, color:T.muted }}>
            {MODELS.filter(m => m.provider === prov).map(m => (
              <option key={m.id} value={m.id} style={{ background:T.dark, color:T.white }}>
                {m.label}  {m.tag}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function ManitoCRM() {
  const [view,        setView]       = useState("dashboard");
  const [leads,       setLeads]      = useState([]);
  const [followups,   setFU]         = useState([]);
  const [convs,       setConvs]      = useState({});
  const [activeLead,  setActive]     = useState(null);
  const [model,       setModel]      = useState(MODELS[0].id);
  const [toast,       setToast]      = useState(null);
  const [showNewLead, setShowNL]     = useState(false);
  const [showFU,      setShowFU]     = useState(false);
  const [editLead,    setEditL]      = useState(null);
  const [chatInput,   setChatIn]     = useState("");
  const [chatLoading, setChatLoad]   = useState(false);
  const chatRef = useRef(null);

  const emptyL = { name:"", phone:"", channel:CANALES[0], product:PRODUCTOS[0], stage:"nuevo", notes:"", value:"", tone:"amigable y cercano" };
  const emptyF = { leadId:"", type:"WhatsApp", note:"", dueDate:"" };
  const [lf, setLF] = useState(emptyL);
  const [ff, setFF] = useState(emptyF);

  // ── Cargar datos ──
  useEffect(() => {
    setLeads(LS.get("lm_leads", []));
    setFU(LS.get("lm_fu", []));
    setConvs(LS.get("lm_convs", {}));
  }, []);

  const saveLeads = d => { setLeads(d); LS.set("lm_leads", d); };
  const saveFU    = d => { setFU(d);   LS.set("lm_fu", d); };
  const saveConvs = d => { setConvs(d); LS.set("lm_convs", d); };

  const flash = (msg, color=T.green) => { setToast({msg,color}); setTimeout(()=>setToast(null), 3000); };

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [convs, activeLead, chatLoading]);

  // ── CRUD Leads ──
  const saveLead = () => {
    if (!lf.name.trim()) { flash("Nombre requerido", T.red); return; }
    if (editLead) {
      saveLeads(leads.map(l => l.id === editLead.id ? { ...l, ...lf, updatedAt:nowISO() } : l));
      flash("Lead actualizado ✓");
    } else {
      saveLeads([{ ...lf, id:uid(), createdAt:nowISO(), updatedAt:nowISO(), interactions:0, value:Number(lf.value)||0 }, ...leads]);
      flash("Lead creado ✓");
    }
    setLF(emptyL); setEditL(null); setShowNL(false);
  };

  const updateStage = (id, stage) => {
    saveLeads(leads.map(l => l.id === id ? { ...l, stage, updatedAt:nowISO() } : l));
    flash(`→ ${STAGES.find(s=>s.id===stage)?.label}`);
  };

  const deleteLead = id => {
    saveLeads(leads.filter(l => l.id !== id));
    if (activeLead?.id === id) setActive(null);
    flash("Eliminado", T.red);
  };

  // ── CRUD Followups ──
  const saveFup = () => {
    if (!ff.leadId || !ff.dueDate) { flash("Completa lead y fecha", T.red); return; }
    saveFU([{ ...ff, id:uid(), createdAt:nowISO(), done:false }, ...followups]);
    flash("Seguimiento agendado 🔔");
    setFF(emptyF); setShowFU(false);
  };

  const toggleFup = id => saveFU(followups.map(f => f.id === id ? { ...f, done:!f.done, doneAt:nowISO() } : f));

  // ── Chat ──
  const openChat = lead => {
    setActive(lead);
    if (!convs[lead.id]) {
      const welcome = { role:"assistant", content:`¡Hola${lead.name ? ", "+lead.name.split(" ")[0] : ""}! 👋 Soy tu asistente de ventas para La Manito del Vegano.\n\nVeo que tu interés es **${lead.product}** y estás en etapa "${STAGES.find(s=>s.id===lead.stage)?.label}". ¿En qué te puedo ayudar?`, ts:nowISO() };
      saveConvs({ ...convs, [lead.id]: [welcome] });
    }
    setView("chat");
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !activeLead) return;
    const userMsg = { role:"user", content:chatInput.trim(), ts:nowISO() };
    const conv = convs[activeLead.id] || [];
    const newConv = [...conv, userMsg];
    saveConvs({ ...convs, [activeLead.id]: newConv });
    setChatIn(""); setChatLoad(true);

    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model,
          system: buildSystem(activeLead),
          messages: newConv.map(m => ({ role:m.role, content:m.content })),
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");

      const aMsg = { role:"assistant", content: data.text, ts:nowISO() };
      saveConvs({ ...convs, [activeLead.id]: [...newConv, aMsg] });
      const updLeads = leads.map(l => l.id === activeLead.id ? { ...l, interactions:(l.interactions||0)+1, lastContact:nowISO() } : l);
      saveLeads(updLeads);
      setActive(prev => ({ ...prev, interactions:(prev.interactions||0)+1 }));
    } catch(e) {
      const err = { role:"assistant", content:`❌ ${e.message}`, ts:nowISO() };
      saveConvs({ ...convs, [activeLead.id]: [...newConv, err] });
    } finally {
      setChatLoad(false);
    }
  };

  // ── Métricas ──
  const M = {
    total:      leads.length,
    cerrados:   leads.filter(l=>l.stage==="cerrado").length,
    interesados:leads.filter(l=>l.stage==="interesado").length,
    revenue:    leads.filter(l=>l.stage==="cerrado").reduce((s,l)=>s+(l.value||0),0),
    pipeline:   leads.filter(l=>!["cerrado","perdido"].includes(l.stage)).reduce((s,l)=>s+(l.value||0),0),
    pendFU:     followups.filter(f=>!f.done).length,
    urgFU:      followups.filter(f=>!f.done && daysLeft(f.dueDate)<=1).length,
  };

  const stageGroups = STAGES.map(s => ({ ...s, leads: leads.filter(l=>l.stage===s.id) }));
  const pendingFU   = followups.filter(f=>!f.done).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const currentModel = getModel(model);

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:"100vh", background:T.cream, fontFamily:"'Inter','Segoe UI',sans-serif", display:"flex", flexDirection:"column" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:16, right:16, zIndex:9999, background:toast.color, color:T.white, padding:"10px 18px", borderRadius:10, fontWeight:600, fontSize:13, boxShadow:"0 4px 16px rgba(0,0,0,0.2)", animation:"fadeIn .2s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ background:T.dark, padding:"0 16px", display:"flex", alignItems:"center", gap:10, height:54, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 12px rgba(0,0,0,0.3)", flexWrap:"wrap" }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg,${T.green},${T.lime})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🌿</div>
        <span style={{ color:T.white, fontWeight:800, fontSize:14, letterSpacing:-.3 }}>La Manito <span style={{ color:T.lime }}>CRM</span></span>

        <div style={{ flex:1 }} />

        {/* Nav */}
        {[
          { id:"dashboard", icon:"📊", label:"Dashboard" },
          { id:"pipeline",  icon:"🔄", label:"Pipeline" },
          { id:"leads",     icon:"👥", label:"Leads" },
          { id:"followups", icon:"🔔", label:`Seguimientos${M.urgFU>0?" ⚠️":M.pendFU>0?` (${M.pendFU})`:""}` },
        ].map(v => (
          <button key={v.id} onClick={()=>setView(v.id)} style={{
            background: view===v.id ? T.green : "transparent",
            border:"none", borderRadius:7,
            color: view===v.id ? T.white : T.muted,
            padding:"5px 10px", fontSize:12, fontWeight:600,
            cursor:"pointer", whiteSpace:"nowrap",
          }}>{v.icon} {v.label}</button>
        ))}

        {/* Modelo con proveedor */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:currentModel.color, flexShrink:0 }} />
          <ModelSelector value={model} onChange={setModel} />
        </div>

        <Btn small onClick={()=>{ setLF(emptyL); setEditL(null); setShowNL(true); }}>+ Lead</Btn>
      </header>

      {/* ════════ VISTAS ════════ */}
      <div style={{ flex:1, overflow:"auto" }}>

        {/* ── DASHBOARD ── */}
        {view==="dashboard" && (
          <div style={{ padding:20, maxWidth:1100, margin:"0 auto" }}>
            <h2 style={{ margin:"0 0 4px", color:T.dark, fontSize:22, fontWeight:800 }}>Panel de ventas</h2>
            <p style={{ margin:"0 0 20px", color:T.muted, fontSize:13 }}>La Manito del Vegano · {new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</p>

            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:20 }}>
              {[
                { label:"Leads totales",  val:M.total,                              icon:"👥", color:T.blue   },
                { label:"Interesados",    val:M.interesados,                        icon:"🔥", color:T.amber  },
                { label:"Cerrados",       val:M.cerrados,                           icon:"🎉", color:T.green  },
                { label:"Revenue",        val:`$${M.revenue.toLocaleString("es-CL")}`, icon:"💰", color:T.green },
                { label:"En pipeline",    val:`$${M.pipeline.toLocaleString("es-CL")}`, icon:"📈", color:T.purple},
                { label:"Seguimientos",   val:M.pendFU,                             icon:"🔔", color:M.urgFU>0?T.red:T.muted },
              ].map(k=>(
                <Card key={k.label}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:k.color }}>{k.val}</div>
                  <div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>{k.label}</div>
                </Card>
              ))}
            </div>

            {/* Modelo activo */}
            <Card style={{ marginBottom:20, display:"flex", alignItems:"center", gap:14, padding:"12px 16px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:currentModel.color }} />
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>Modelo activo: {currentModel.label}</div>
                <div style={{ fontSize:11, color:T.muted }}>{currentModel.provider} · {currentModel.tag}</div>
              </div>
              <div style={{ flex:1 }} />
              <ModelSelector value={model} onChange={setModel} />
            </Card>

            {/* Leads recientes + FU urgentes */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Card>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>🌱 Leads recientes</div>
                {leads.slice(0,5).map(l=>{
                  const s=STAGES.find(s=>s.id===l.stage);
                  return (
                    <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.sand}`, cursor:"pointer" }} onClick={()=>openChat(l)}>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:s?.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>{s?.emoji}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:700,fontSize:13 }}>{l.name}</div>
                        <div style={{ fontSize:11,color:T.muted }}>{l.product} · {l.channel}</div>
                      </div>
                      <Badge color={s?.color}>{s?.label}</Badge>
                    </div>
                  );
                })}
                {leads.length===0 && <div style={{ color:T.muted,fontSize:13,textAlign:"center",padding:20 }}>Sin leads aún</div>}
              </Card>

              <Card>
                <div style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>🔔 Seguimientos hoy</div>
                {pendingFU.slice(0,5).map(f=>{
                  const lead=leads.find(l=>l.id===f.leadId);
                  const days=daysLeft(f.dueDate);
                  const urg=days!==null&&days<=1;
                  return (
                    <div key={f.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.sand}` }}>
                      <div style={{ fontSize:18 }}>{urg?"🚨":"📅"}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700,fontSize:12,color:urg?T.red:T.dark }}>{lead?.name||"—"}</div>
                        <div style={{ fontSize:11,color:T.muted }}>{f.type} · {f.note}</div>
                      </div>
                      <div style={{ fontSize:11,color:urg?T.red:T.muted,fontWeight:700 }}>{days<=0?"Hoy":`${days}d`}</div>
                      <button onClick={()=>toggleFup(f.id)} style={{ background:T.green,border:"none",borderRadius:6,color:T.white,padding:"3px 8px",fontSize:11,cursor:"pointer" }}>✓</button>
                    </div>
                  );
                })}
                {pendingFU.length===0 && <div style={{ color:T.muted,fontSize:13,textAlign:"center",padding:20 }}>Sin pendientes 🎉</div>}
              </Card>
            </div>
          </div>
        )}

        {/* ── PIPELINE ── */}
        {view==="pipeline" && (
          <div style={{ padding:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <h2 style={{ margin:0,color:T.dark,fontSize:20,fontWeight:800 }}>🔄 Pipeline</h2>
              <Btn small onClick={()=>{ setLF(emptyL); setEditL(null); setShowNL(true); }}>+ Nuevo lead</Btn>
            </div>
            <div style={{ display:"flex",gap:12,overflowX:"auto",paddingBottom:8 }}>
              {stageGroups.map(sg=>(
                <div key={sg.id} style={{ minWidth:210,flex:"0 0 210px" }}>
                  <div style={{ background:sg.color+"18",border:`1.5px solid ${sg.color}44`,borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <span style={{ fontWeight:700,fontSize:13,color:sg.color }}>{sg.emoji} {sg.label}</span>
                    <Badge color={sg.color}>{sg.leads.length}</Badge>
                  </div>
                  {sg.leads.map(lead=>{
                    const fu=followups.filter(f=>f.leadId===lead.id&&!f.done);
                    return (
                      <div key={lead.id} style={{ background:T.white,border:`1px solid ${T.sand}`,borderRadius:10,padding:12,marginBottom:8,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }} onClick={()=>openChat(lead)}>
                        <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>{lead.name}</div>
                        <div style={{ fontSize:11,color:T.muted,marginBottom:6 }}>{lead.product}</div>
                        <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:6 }}>
                          <Badge color={T.blue}>{lead.channel}</Badge>
                          {lead.value>0 && <Badge color={T.green}>${Number(lead.value).toLocaleString("es-CL")}</Badge>}
                          {fu.length>0 && <Badge color={T.amber}>🔔{fu.length}</Badge>}
                        </div>
                        <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                          {STAGES.filter(s=>s.id!==sg.id).slice(0,3).map(s=>(
                            <button key={s.id} onClick={e=>{e.stopPropagation();updateStage(lead.id,s.id);}} style={{ background:s.color+"18",border:`1px solid ${s.color}44`,borderRadius:6,padding:"2px 7px",fontSize:10,cursor:"pointer",color:s.color,fontWeight:600 }}>→{s.emoji}</button>
                          ))}
                        </div>
                        <div style={{ fontSize:10,color:T.muted,marginTop:6 }}>{lead.interactions||0} interac. · {fmtDate(lead.updatedAt)}</div>
                      </div>
                    );
                  })}
                  {sg.leads.length===0 && <div style={{ textAlign:"center",padding:"18px 8px",color:T.muted,fontSize:12,border:`1.5px dashed ${T.sand}`,borderRadius:10 }}>Vacío</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LEADS TABLA ── */}
        {view==="leads" && (
          <div style={{ padding:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <h2 style={{ margin:0,color:T.dark,fontSize:20,fontWeight:800 }}>👥 Leads ({leads.length})</h2>
              <div style={{ display:"flex",gap:8 }}>
                <Btn small outline color={T.amber} onClick={()=>{ setFF(emptyF); setShowFU(true); }}>+ Seguimiento</Btn>
                <Btn small onClick={()=>{ setLF(emptyL); setEditL(null); setShowNL(true); }}>+ Lead</Btn>
              </div>
            </div>
            <Card style={{ padding:0,overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:T.soft }}>
                      {["Nombre","Canal","Producto","Etapa","Valor","Interac.","Última act.","Acciones"].map(h=>(
                        <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead,i)=>{
                      const s=STAGES.find(s=>s.id===lead.stage);
                      const fu=followups.filter(f=>f.leadId===lead.id&&!f.done);
                      return (
                        <tr key={lead.id} style={{ borderTop:`1px solid ${T.sand}`,background:i%2===0?T.white:"#FAFAF8" }}>
                          <td style={{ padding:"10px 14px" }}>
                            <div style={{ fontWeight:700,fontSize:13 }}>{lead.name}</div>
                            {lead.phone && <div style={{ fontSize:11,color:T.muted }}>{lead.phone}</div>}
                          </td>
                          <td style={{ padding:"10px 14px" }}><Badge color={T.blue}>{lead.channel}</Badge></td>
                          <td style={{ padding:"10px 14px",fontSize:12,color:T.mid }}>{lead.product}</td>
                          <td style={{ padding:"10px 14px" }}>
                            <select value={lead.stage} onChange={e=>updateStage(lead.id,e.target.value)} style={{ background:s?.color+"18",border:`1px solid ${s?.color}44`,borderRadius:8,padding:"3px 8px",fontSize:12,color:s?.color,fontWeight:700,cursor:"pointer",outline:"none" }}>
                              {STAGES.map(st=><option key={st.id} value={st.id}>{st.emoji} {st.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding:"10px 14px",fontSize:13,fontWeight:700,color:T.green }}>{lead.value>0?`$${Number(lead.value).toLocaleString("es-CL")}`:"—"}</td>
                          <td style={{ padding:"10px 14px",textAlign:"center" }}>
                            <span style={{ fontWeight:700 }}>{lead.interactions||0}</span>
                            {fu.length>0 && <span style={{ marginLeft:6 }}><Badge color={T.amber}>🔔{fu.length}</Badge></span>}
                          </td>
                          <td style={{ padding:"10px 14px",fontSize:12,color:T.muted }}>{fmtDate(lead.updatedAt)}</td>
                          <td style={{ padding:"10px 14px" }}>
                            <div style={{ display:"flex",gap:5 }}>
                              <button onClick={()=>openChat(lead)} style={{ background:T.green,border:"none",borderRadius:7,color:T.white,padding:"5px 9px",fontSize:12,cursor:"pointer" }}>💬</button>
                              <button onClick={()=>{ setFF({...emptyF,leadId:lead.id}); setShowFU(true); }} style={{ background:T.amber,border:"none",borderRadius:7,color:T.white,padding:"5px 9px",fontSize:12,cursor:"pointer" }}>🔔</button>
                              <button onClick={()=>{ setLF({name:lead.name,phone:lead.phone||"",channel:lead.channel,product:lead.product,stage:lead.stage,notes:lead.notes||"",value:lead.value||"",tone:lead.tone||"amigable y cercano"}); setEditL(lead); setShowNL(true); }} style={{ background:T.blue,border:"none",borderRadius:7,color:T.white,padding:"5px 9px",fontSize:12,cursor:"pointer" }}>✏️</button>
                              <button onClick={()=>{ if(confirm(`¿Eliminar ${lead.name}?`)) deleteLead(lead.id); }} style={{ background:T.red,border:"none",borderRadius:7,color:T.white,padding:"5px 9px",fontSize:12,cursor:"pointer" }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {leads.length===0 && (
                  <div style={{ textAlign:"center",padding:40,color:T.muted }}>
                    <div style={{ fontSize:40,marginBottom:10 }}>🌱</div>
                    <div style={{ fontSize:14,fontWeight:600 }}>Sin leads aún</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── SEGUIMIENTOS ── */}
        {view==="followups" && (
          <div style={{ padding:20 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <h2 style={{ margin:0,color:T.dark,fontSize:20,fontWeight:800 }}>🔔 Seguimientos</h2>
              <Btn small onClick={()=>{ setFF(emptyF); setShowFU(true); }}>+ Agendar</Btn>
            </div>
            {["pending","done"].map(tab=>{
              const list = tab==="pending"
                ? followups.filter(f=>!f.done).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))
                : followups.filter(f=>f.done).slice(0,20);
              return (
                <div key={tab} style={{ marginBottom:24 }}>
                  <div style={{ fontWeight:700,fontSize:14,color:tab==="pending"?T.amber:T.muted,marginBottom:10 }}>
                    {tab==="pending"?`⏳ Pendientes (${list.length})`:`✅ Completados (${list.length})`}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10 }}>
                    {list.map(f=>{
                      const lead=leads.find(l=>l.id===f.leadId);
                      const days=daysLeft(f.dueDate);
                      const urg=!f.done&&days!==null&&days<=1;
                      return (
                        <Card key={f.id} style={{ border:urg?`2px solid ${T.red}`:undefined,opacity:f.done?.6:1 }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                            <div>
                              <div style={{ fontWeight:700,fontSize:13,color:urg?T.red:T.dark }}>{lead?.name||"Lead eliminado"}</div>
                              <div style={{ fontSize:12,color:T.muted,marginTop:2 }}>{f.type} · {f.note||"Sin nota"}</div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontSize:12,fontWeight:700,color:urg?T.red:T.muted }}>{fmtDate(f.dueDate)}</div>
                              {!f.done&&days!==null&&<div style={{ fontSize:10,color:urg?T.red:T.muted }}>{days<=0?"¡Hoy!":`en ${days}d`}</div>}
                            </div>
                          </div>
                          {!f.done&&(
                            <div style={{ marginTop:10,display:"flex",gap:8 }}>
                              <Btn small onClick={()=>toggleFup(f.id)}>✓ Listo</Btn>
                              {lead&&<Btn small outline color={T.green} onClick={()=>openChat(lead)}>💬 Chat</Btn>}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                    {list.length===0&&<div style={{ color:T.muted,fontSize:13,padding:10 }}>{tab==="pending"?"Todo al día 🎉":"Sin completados"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CHAT ── */}
        {view==="chat" && activeLead && (
          <div style={{ display:"flex",flexDirection:"column",height:"calc(100vh - 54px)" }}>
            <div style={{ background:T.white,padding:"10px 16px",borderBottom:`1px solid ${T.sand}`,display:"flex",alignItems:"center",gap:10 }}>
              <button onClick={()=>setView("leads")} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:20 }}>←</button>
              <div style={{ width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.green},${T.lime})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:T.white,flexShrink:0 }}>
                {activeLead.name?.[0]?.toUpperCase()||"?"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:14 }}>{activeLead.name}</div>
                <div style={{ fontSize:11,color:T.muted }}>{activeLead.product} · {STAGES.find(s=>s.id===activeLead.stage)?.emoji} {STAGES.find(s=>s.id===activeLead.stage)?.label} · {activeLead.interactions||0} interacciones</div>
              </div>
              <select value={activeLead.stage} onChange={e=>{ updateStage(activeLead.id,e.target.value); setActive(p=>({...p,stage:e.target.value})); }} style={{ border:`1px solid ${T.sand}`,borderRadius:8,padding:"4px 8px",fontSize:12,outline:"none",cursor:"pointer" }}>
                {STAGES.map(s=><option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
              <Btn small outline color={T.amber} onClick={()=>{ setFF({...emptyF,leadId:activeLead.id}); setShowFU(true); }}>🔔</Btn>
            </div>

            <div ref={chatRef} style={{ flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10 }}>
              {(convs[activeLead.id]||[]).map((msg,i)=>(
                <div key={i} style={{ display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",gap:8,alignItems:"flex-end" }}>
                  {msg.role==="assistant"&&<div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.green},${T.lime})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0 }}>🌿</div>}
                  <div style={{ maxWidth:"75%",background:msg.role==="user"?T.green:T.white,color:msg.role==="user"?T.white:T.dark,borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",fontSize:13,lineHeight:1.6,border:msg.role==="assistant"?`1px solid ${T.sand}`:"none",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",whiteSpace:"pre-wrap",wordBreak:"break-word" }}>
                    {msg.content.replace(/\*\*(.*?)\*\*/g,"$1")}
                    <div style={{ fontSize:10,color:msg.role==="user"?"rgba(255,255,255,0.6)":T.muted,marginTop:4 }}>{fmtTime(msg.ts)}</div>
                  </div>
                </div>
              ))}
              {chatLoading&&(
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.green},${T.lime})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🌿</div>
                  <div style={{ background:T.white,border:`1px solid ${T.sand}`,borderRadius:"18px 18px 18px 4px",padding:"12px 16px",display:"flex",gap:5 }}>
                    {[0,1,2].map(j=><div key={j} style={{ width:7,height:7,borderRadius:"50%",background:T.lime,animation:"bounce 1.2s ease-in-out infinite",animationDelay:`${j*.2}s` }}/>)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding:"6px 12px",background:T.soft,borderTop:`1px solid ${T.sand}`,display:"flex",gap:8,overflowX:"auto" }}>
              {["¿Cuánto cuesta?","¿Hacen despacho?","Quiero hacer un pedido","¿Tienen oferta?","¿Cuándo llega mi pedido?"].map(q=>(
                <button key={q} onClick={()=>setChatIn(q)} style={{ background:T.white,border:`1.5px solid ${T.sand}`,borderRadius:20,padding:"4px 12px",fontSize:11.5,color:T.dark,cursor:"pointer",whiteSpace:"nowrap" }}>{q}</button>
              ))}
            </div>

            <div style={{ display:"flex",gap:10,padding:"10px 16px",background:T.white,borderTop:`2px solid ${T.sand}`,alignItems:"flex-end" }}>
              <textarea value={chatInput} onChange={e=>setChatIn(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();} }}
                placeholder="Simula al cliente o consulta como vendedor..."
                rows={1}
                style={{ flex:1,resize:"none",border:`1.5px solid ${T.sand}`,borderRadius:12,padding:"10px 14px",fontSize:13,fontFamily:"inherit",outline:"none",background:T.soft,lineHeight:1.5,maxHeight:120,overflowY:"auto" }}
                onInput={e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
              />
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} style={{ background:chatLoading||!chatInput.trim()?T.sand:T.green,border:"none",borderRadius:12,padding:"10px 18px",color:T.white,fontSize:20,cursor:chatLoading||!chatInput.trim()?"not-allowed":"pointer",flexShrink:0 }}>
                {chatLoading?"⏳":"➤"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════ MODALES ════════ */}
      <Modal open={showNewLead} onClose={()=>setShowNL(false)} title={editLead?"✏️ Editar lead":"🌱 Nuevo lead"}>
        <Field label="Nombre *" value={lf.name} onChange={v=>setLF(p=>({...p,name:v}))} placeholder="María González" />
        <Field label="Teléfono / WhatsApp" value={lf.phone} onChange={v=>setLF(p=>({...p,phone:v}))} placeholder="+56 9 1234 5678" />
        <Field label="Canal" value={lf.channel} onChange={v=>setLF(p=>({...p,channel:v}))} options={CANALES} />
        <Field label="Producto" value={lf.product} onChange={v=>setLF(p=>({...p,product:v}))} options={PRODUCTOS} />
        <Field label="Etapa" value={lf.stage} onChange={v=>setLF(p=>({...p,stage:v}))} options={STAGES.map(s=>s.id)} />
        <Field label="Valor estimado ($CLP)" value={lf.value} onChange={v=>setLF(p=>({...p,value:v}))} type="number" placeholder="9000" />
        <Field label="Tono del agente" value={lf.tone} onChange={v=>setLF(p=>({...p,tone:v}))} options={["amigable y cercano","profesional","divertido y juvenil","apasionado y activista","empático y cálido"]} />
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:700,color:T.hemp,textTransform:"uppercase",letterSpacing:.8,marginBottom:4 }}>Notas</div>
          <textarea value={lf.notes} onChange={e=>setLF(p=>({...p,notes:e.target.value}))} placeholder="Contexto relevante..." rows={3} style={{ width:"100%",padding:"8px 12px",border:`1.5px solid ${T.sand}`,borderRadius:8,fontSize:13,background:T.soft,outline:"none",fontFamily:"inherit",resize:"vertical" }}/>
        </div>
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <Btn outline color={T.muted} onClick={()=>setShowNL(false)}>Cancelar</Btn>
          <Btn onClick={saveLead}>{editLead?"Guardar":"Crear lead"}</Btn>
        </div>
      </Modal>

      <Modal open={showFU} onClose={()=>setShowFU(false)} title="🔔 Agendar seguimiento">
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:700,color:T.hemp,textTransform:"uppercase",letterSpacing:.8 }}>Lead *</div>
          <select value={ff.leadId} onChange={e=>setFF(p=>({...p,leadId:e.target.value}))} style={{ width:"100%",marginTop:4,padding:"8px 12px",border:`1.5px solid ${T.sand}`,borderRadius:8,fontSize:13,background:T.soft,outline:"none" }}>
            <option value="">— Selecciona un lead —</option>
            {leads.map(l=><option key={l.id} value={l.id}>{l.name} · {l.product}</option>)}
          </select>
        </div>
        <Field label="Tipo" value={ff.type} onChange={v=>setFF(p=>({...p,type:v}))} options={["WhatsApp","Llamada","Instagram DM","Email","Visita presencial","Envío muestra"]} />
        <Field label="Fecha y hora *" value={ff.dueDate} onChange={v=>setFF(p=>({...p,dueDate:v}))} type="datetime-local" />
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:700,color:T.hemp,textTransform:"uppercase",letterSpacing:.8,marginBottom:4 }}>Nota / objetivo</div>
          <textarea value={ff.note} onChange={e=>setFF(p=>({...p,note:e.target.value}))} placeholder="¿Qué quieres lograr?" rows={2} style={{ width:"100%",padding:"8px 12px",border:`1.5px solid ${T.sand}`,borderRadius:8,fontSize:13,background:T.soft,outline:"none",fontFamily:"inherit",resize:"vertical" }}/>
        </div>
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
          <Btn outline color={T.muted} onClick={()=>setShowFU(false)}>Cancelar</Btn>
          <Btn color={T.amber} onClick={saveFup}>Agendar</Btn>
        </div>
      </Modal>

      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.sand};border-radius:4px}
      `}</style>
    </div>
  );
}
