/* ============================================================
   Cotizador PC — app.js
   Vanilla JS, sin dependencias de build. Datos en localStorage.
   ============================================================ */
(function(){
"use strict";

/* ---------------------------- Constantes ---------------------------- */
const DB_KEY = "cotizadorPC.db.v1";
const APP_VERSION = 1;

const DEFAULT_TYPES = [
  "Procesador","Tarjeta madre","Memoria RAM","Almacenamiento SSD",
  "Sistema de refrigeración","Ventilador adicional","Gabinete",
  "Tarjeta de video","Fuente de poder","Monitor",
  "Teclado + mouse (combo)","Software / Licencia"
];

const DEFAULT_NOTES = [
  "Los costos de los componentes contemplados en esta cotización podrán variar sin previo aviso. Los precios finales dependen de la disponibilidad del producto y de las condiciones comerciales vigentes en Amazon al momento de la compra.",
  "Se proporciona una garantía limitada de 30 días posteriores a la entrega, válida únicamente para incidencias derivadas del servicio de instalación de hardware y software realizado. No se incluyen dentro de esta cobertura fallas de los componentes, garantías del fabricante ni afectaciones ocasionadas por mal uso, mantenimiento inadecuado o cambios posteriores al servicio entregado. Cualquier eventualidad fuera del alcance descrito será analizada caso por caso."
];

const DEFAULT_EYEBROW = "COTIZACIÓN · ENSAMBLE DE EQUIPO DE CÓMPUTO";

const PILL_MAP = [
  {label:"CPU", types:["procesador"]},
  {label:"RAM", types:["memoria ram","ram"]},
  {label:"ALMACENAMIENTO", types:["almacenamiento","ssd","disco"]},
  {label:"MONITOR", types:["monitor"]},
  {label:"REFRIGERACIÓN", types:["refrigeración","refrigeracion","cooler","enfriamiento"]},
  {label:"SOFTWARE", types:["software","licencia"]}
];

const OPT_ACCENTS = [
  {key:"copper", name:"Cobre"},
  {key:"olive", name:"Olivo"},
  {key:"ink", name:"Tinta"},
  {key:"deep", name:"Violeta"}
];
const OPT_LETTERS = "ABCDEFGH";

/* ---------------------------- Utilidades ---------------------------- */
const $ = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const uid = ()=> "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const pad3 = n=> String(n).padStart(3,"0");
const esc = s=> String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s=> String(s||"").trim().toLowerCase();
const todayISO = ()=> new Date().toISOString().slice(0,10);

function money(n){
  const c = (state.db.settings.currency)||"MXN";
  try{ return new Intl.NumberFormat("es-MX",{style:"currency",currency:c}).format(Number(n)||0); }
  catch(e){ return "$"+(Number(n)||0).toFixed(2); }
}
function fmtDate(iso){
  if(!iso) return "—";
  const d = new Date(iso+"T00:00:00");
  if(isNaN(d)) return iso;
  return new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"long",year:"numeric"}).format(d);
}
function num(v){ const n=parseFloat(String(v).replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }

/* ---------------------------- Almacenamiento ---------------------------- */
function freshDB(){
  return {
    version: APP_VERSION,
    settings: {
      businessName: "",
      sellerName: "David Ventura",
      phone: "5542998087",
      logoDataUrl: null,
      installPct: 15,
      currency: "MXN",
      folioPrefix: "COT",
      folioCountersByYear: {},
      eyebrow: DEFAULT_EYEBROW,
      notes: DEFAULT_NOTES.slice(),
      types: DEFAULT_TYPES.slice()
    },
    quotations: [],
    catalog: []
  };
}
function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return freshDB();
    const db = JSON.parse(raw);
    // merge defensivo
    const f = freshDB();
    db.settings = Object.assign(f.settings, db.settings||{});
    if(!Array.isArray(db.settings.types)||!db.settings.types.length) db.settings.types = DEFAULT_TYPES.slice();
    if(!Array.isArray(db.settings.notes)||!db.settings.notes.length) db.settings.notes = DEFAULT_NOTES.slice();
    db.quotations = db.quotations||[];
    db.catalog = db.catalog||[];
    return db;
  }catch(e){ console.error("DB corrupta, reiniciando vista en memoria:",e); return freshDB(); }
}
function saveDB(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(state.db)); }
  catch(e){ toast("No se pudo guardar (¿almacenamiento lleno?). Exporta un respaldo.","err"); console.error(e); }
}

/* ---------------------------- Estado ---------------------------- */
const state = {
  db: null,
  view: "list",
  search: "",
  catSearch: "",
  draft: null,        // cotización en edición
  editingId: null,    // id de cotización guardada que se está editando (=> al guardar crea revisión)
  activeOpt: 0
};

/* ---------------------------- Toast / Modal ---------------------------- */
function toast(msg, kind){
  const w = $("#toasts");
  const t = document.createElement("div");
  t.className = "toast "+(kind||"");
  t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg><span>'+esc(msg)+'</span>';
  w.appendChild(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(()=>t.remove(),250); }, 2600);
}
function openModal(html){
  $("#modalBox").className = "modal"+ (html.wide?" wide":"");
  $("#modalBox").innerHTML = html.body||html;
  $("#overlay").classList.add("open");
}
function closeModal(){ $("#overlay").classList.remove("open"); $("#modalBox").innerHTML=""; }
$("#overlay").addEventListener("click", e=>{ if(e.target.id==="overlay") closeModal(); });

function confirmDialog(opts){
  return new Promise(res=>{
    openModal({ wide:false, body:
      '<h2>'+esc(opts.title)+'</h2>'+
      '<p class="modal-sub">'+ (opts.msg||"") +'</p>'+
      '<div class="modal-actions">'+
        '<button class="btn ghost" id="cdNo">'+esc(opts.cancel||"Cancelar")+'</button>'+
        '<button class="btn '+(opts.danger?"danger":"primary")+'" id="cdYes">'+esc(opts.ok||"Aceptar")+'</button>'+
      '</div>'
    });
    $("#cdNo").onclick=()=>{ closeModal(); res(false); };
    $("#cdYes").onclick=()=>{ closeModal(); res(true); };
  });
}

/* ---------------------------- Folio ---------------------------- */
function nextFolio(year){
  const s = state.db.settings;
  const y = String(year);
  s.folioCountersByYear[y] = (s.folioCountersByYear[y]||0)+1;
  return s.folioPrefix+"-"+y+"-"+pad3(s.folioCountersByYear[y]);
}

/* ---------------------------- Modelos ---------------------------- */
function newComponent(type){
  return { id:uid(), type:type||"", name:type||"", spec:"", brandModel:"", price:0, link:"", status:"incluido" };
}
function newOption(idx){
  return {
    id: uid(),
    label: OPT_LETTERS[idx]||String(idx+1),
    accent: OPT_ACCENTS[idx % OPT_ACCENTS.length].key,
    heading: "",
    description: "",
    pills: PILL_MAP.map(p=>({label:p.label, value:""})),
    components: []
  };
}
function newDraft(){
  return {
    id: uid(),
    baseFolio: null,
    folio: null,
    revision: 0,
    rootId: null,
    parentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: todayISO(),
    client: "",
    title: "",
    eyebrow: state.db.settings.eyebrow || DEFAULT_EYEBROW,
    installPct: state.db.settings.installPct,
    notes: state.db.settings.notes.slice(),
    options: [ newOption(0) ]
  };
}

/* ---------------------------- Cálculos ---------------------------- */
function optSubtotal(opt){
  return opt.components.reduce((s,c)=> s + (c.status==="cliente"?0:num(c.price)), 0);
}
function optTotals(opt, pct){
  const sub = optSubtotal(opt);
  const inst = sub * (num(pct)/100);
  return { sub, inst, total: sub+inst };
}
function quoteTotal(q){
  // suma de totales de todas las opciones (referencia para la lista)
  return q.options.reduce((s,o)=> s + optTotals(o,q.installPct).total, 0);
}

/* ---------------------------- Catálogo (historial componentes) ---------------------------- */
function catKey(type, model){ return norm(type)+"|"+norm(model); }
function purgeCatalogForQuote(quoteId){
  state.db.catalog.forEach(item=>{
    item.priceHistory = item.priceHistory.filter(h=> h.quotationId!==quoteId);
  });
  state.db.catalog = state.db.catalog.filter(i=> i.priceHistory.length>0);
}
function recordCatalog(q){
  purgeCatalogForQuote(q.id);
  q.options.forEach(opt=>{
    opt.components.forEach(c=>{
      const model = (c.brandModel||"").trim();
      if(!model || c.status==="cliente") return;
      const price = num(c.price);
      if(price<=0) return;
      const key = catKey(c.type, model);
      let item = state.db.catalog.find(i=> i.key===key);
      if(!item){
        item = { id:uid(), key, type:c.type||"", brandModel:model, lastSpec:c.spec||"", lastLink:c.link||"", priceHistory:[] };
        state.db.catalog.push(item);
      }
      item.lastSpec = c.spec||item.lastSpec;
      item.lastLink = c.link||item.lastLink;
      item.priceHistory.push({ price, date:q.date, folio:q.folio, quotationId:q.id });
    });
  });
  // ordenar historial por fecha
  state.db.catalog.forEach(i=> i.priceHistory.sort((a,b)=> (a.date||"").localeCompare(b.date||"")));
}
function catalogSuggest(type, query){
  const q = norm(query);
  return state.db.catalog
    .filter(i=> !type || norm(i.type)===norm(type))
    .filter(i=> !q || norm(i.brandModel).includes(q))
    .slice(0,8);
}

/* ---------------------------- Guardar cotización ---------------------------- */
function persistNew(draft){
  const year = (draft.date||todayISO()).slice(0,4);
  draft.folio = nextFolio(year);
  draft.baseFolio = draft.folio;
  draft.rootId = draft.id;
  draft.revision = 0;
  draft.updatedAt = new Date().toISOString();
  state.db.quotations.push(draft);
  recordCatalog(draft);
  saveDB();
  return draft;
}
function persistRevision(draft, original){
  const rootId = original.rootId || original.id;
  const sibs = state.db.quotations.filter(q=> (q.rootId||q.id)===rootId);
  const maxRev = sibs.reduce((m,q)=> Math.max(m, q.revision||0), 0);
  const rev = maxRev+1;
  const copy = JSON.parse(JSON.stringify(draft));
  copy.id = uid();
  copy.rootId = rootId;
  copy.parentId = original.id;
  copy.baseFolio = original.baseFolio;
  copy.revision = rev;
  copy.folio = original.baseFolio + "-R" + rev;
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  state.db.quotations.push(copy);
  recordCatalog(copy);
  saveDB();
  return copy;
}

/* ============================================================
   VISTAS
   ============================================================ */
function render(){
  $$("#nav button").forEach(b=> b.classList.toggle("active", b.dataset.view===state.view && state.view!=="editor"));
  const app = $("#app");
  if(state.view==="list") app.innerHTML = viewList();
  else if(state.view==="catalog") app.innerHTML = viewCatalog();
  else if(state.view==="settings") app.innerHTML = viewSettings();
  else if(state.view==="editor") app.innerHTML = viewEditor();
  // bind por vista
  if(state.view==="list") bindList();
  else if(state.view==="catalog") bindCatalog();
  else if(state.view==="settings") bindSettings();
  else if(state.view==="editor") bindEditor();
  window.scrollTo(0,0);
}
function go(view){ state.view=view; render(); }

/* ---------- icono check ---------- */
const ICON_CK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></svg>';
const ICON_OFF= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3"><circle cx="12" cy="12" r="9"/></svg>';

/* ======================= LISTA / HISTORIAL ======================= */
function viewList(){
  // agrupar por rootId, mostrar última revisión como tarjeta principal
  const groups = {};
  state.db.quotations.forEach(q=>{
    const r = q.rootId||q.id;
    (groups[r]=groups[r]||[]).push(q);
  });
  let entries = Object.values(groups).map(arr=>{
    arr.sort((a,b)=> (a.revision||0)-(b.revision||0));
    return { latest: arr[arr.length-1], all: arr };
  });
  // filtro por cliente / folio
  const s = norm(state.search);
  if(s){
    entries = entries.filter(e=>
      norm(e.latest.client).includes(s) ||
      norm(e.latest.folio).includes(s) ||
      norm(e.latest.title).includes(s)
    );
  }
  entries.sort((a,b)=> (b.latest.updatedAt||"").localeCompare(a.latest.updatedAt||""));

  let cards = "";
  if(!entries.length){
    cards = '<div class="empty">'+
      '<div class="ico">'+ICON_CK+'</div>'+
      '<h3>'+(s?"Sin resultados":"Aún no hay cotizaciones")+'</h3>'+
      '<p>'+(s?"Prueba con otro cliente o folio.":"Crea tu primera cotización con el formato de ensamble de PC. Puedes capturar los componentes a mano o importar un Excel.")+'</p>'+
      (s?'':'<button class="btn primary" id="emptyNew">Nueva cotización</button>')+
    '</div>';
  } else {
    cards = '<div class="cards">'+ entries.map(e=> qcard(e)).join("") +'</div>';
  }

  return ''+
  '<div class="page-head"><div>'+
    '<div class="klabel eyebrow">Historial</div>'+
    '<h1>Cotizaciones</h1>'+
    '<p class="sub">'+state.db.quotations.length+' documento(s) · '+entries.length+' cliente/proyecto(s)</p>'+
  '</div>'+
  '<button class="btn primary" id="newQuote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Nueva cotización</button>'+
  '</div>'+
  '<div class="toolbar">'+
    '<div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>'+
    '<input id="searchInput" placeholder="Filtrar por cliente, folio o título…" value="'+esc(state.search)+'"></div>'+
  '</div>'+
  cards;
}
function qcard(e){
  const q = e.latest;
  const revs = e.all.length>1;
  const optCount = q.options.length;
  const revBadge = q.revision>0 ? '<span class="rev">R'+q.revision+'</span>' : '';
  const histLine = revs ? '<div class="meta" style="margin-top:8px">'+ e.all.map(r=>'<span>'+esc(r.folio)+'</span>').join(" · ") +'</div>' : '';
  return ''+
  '<div class="qcard" data-id="'+q.id+'">'+
    '<div class="qcard-top">'+
      '<div class="grow">'+
        '<span class="folio">'+esc(q.folio)+'</span>'+revBadge+
        '<div class="client">'+esc(q.client||"Sin cliente")+'</div>'+
        '<div class="meta"><span>'+fmtDate(q.date)+'</span><span>'+optCount+' opción(es)</span></div>'+
      '</div>'+
      '<div class="total"><div class="amt">'+money(quoteTotal(q))+'</div><div class="opts">total combinado</div></div>'+
    '</div>'+
    (q.title? '<div class="title-line">'+esc(q.title)+'</div>':'')+
    '<div class="qcard-actions">'+
      '<button class="btn sm dark" data-act="pdf" data-id="'+q.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg> PDF</button>'+
      '<button class="btn sm" data-act="view" data-id="'+q.id+'">Vista previa</button>'+
      '<button class="btn sm" data-act="edit" data-id="'+q.id+'">Editar (revisión)</button>'+
      '<button class="btn sm" data-act="dup" data-id="'+q.id+'">Duplicar</button>'+
      '<button class="btn sm danger" data-act="del" data-id="'+q.id+'">Eliminar</button>'+
    '</div>'+
    histLine+
  '</div>';
}
function bindList(){
  const ni = $("#newQuote"); if(ni) ni.onclick=startNew;
  const en = $("#emptyNew"); if(en) en.onclick=startNew;
  const si = $("#searchInput");
  if(si){ si.oninput=()=>{ state.search=si.value; const pos=si.selectionStart; render(); const n=$("#searchInput"); if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}} }; }
  $$('[data-act]').forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.id, act=b.dataset.act;
      const q = state.db.quotations.find(x=>x.id===id);
      if(!q) return;
      if(act==="pdf"){ openPrint(q); }
      else if(act==="view"){ previewModal(q); }
      else if(act==="edit"){ editExisting(q); }
      else if(act==="dup"){ duplicateQuote(q); }
      else if(act==="del"){ deleteGroup(q); }
    };
  });
}

function startNew(){
  state.draft = newDraft();
  state.editingId = null;
  state.activeOpt = 0;
  go("editor");
}
function editExisting(q){
  state.draft = JSON.parse(JSON.stringify(q));
  state.editingId = q.id;
  state.activeOpt = 0;
  go("editor");
  toast("Al guardar se creará una revisión nueva; la original se conserva.");
}
function duplicateQuote(q){
  const d = JSON.parse(JSON.stringify(q));
  d.id = uid(); d.baseFolio=null; d.folio=null; d.revision=0; d.rootId=null; d.parentId=null;
  d.createdAt=new Date().toISOString(); d.updatedAt=d.createdAt; d.date=todayISO();
  state.draft = d; state.editingId=null; state.activeOpt=0;
  go("editor");
  toast("Copia lista. Se guardará como cotización nueva con folio propio.");
}
async function deleteGroup(q){
  const root = q.rootId||q.id;
  const sibs = state.db.quotations.filter(x=>(x.rootId||x.id)===root);
  const ok = await confirmDialog({
    title:"Eliminar cotización",
    msg:"Se eliminará "+esc(q.baseFolio)+" y sus "+(sibs.length-1)+" revisión(es). Esta acción no se puede deshacer.",
    ok:"Eliminar", danger:true
  });
  if(!ok) return;
  sibs.forEach(s=> purgeCatalogForQuote(s.id));
  state.db.catalog = state.db.catalog.filter(i=> i.priceHistory.length>0);
  state.db.quotations = state.db.quotations.filter(x=>(x.rootId||x.id)!==root);
  saveDB(); render(); toast("Cotización eliminada.","ok");
}

/* ======================= EDITOR ======================= */
function viewEditor(){
  const d = state.draft;
  const isRev = state.editingId!=null;
  const opt = d.options[state.activeOpt] || d.options[0];

  const tabs = d.options.map((o,i)=>{
    const acc = OPT_ACCENTS.find(a=>a.key===o.accent)||OPT_ACCENTS[0];
    const col = {copper:"#c06a39",olive:"#6d7438",ink:"#1c2230",deep:"#7a5cab"}[o.accent]||"#c06a39";
    return '<button class="opt-tab '+(i===state.activeOpt?"active":"")+'" data-tab="'+i+'">'+
      '<span class="dot" style="background:'+col+'"></span> Opción '+esc(o.label)+
      (d.options.length>1?' <span class="x" data-delopt="'+i+'" title="Quitar opción">✕</span>':'')+
    '</button>';
  }).join("");

  return ''+
  '<div class="page-head"><div>'+
    '<div class="klabel eyebrow">'+(isRev?"Editando · creará revisión":"Nueva cotización")+'</div>'+
    '<h1>'+(isRev? esc(d.folio||"")+" → revisión" : "Captura de cotización")+'</h1>'+
  '</div></div>'+

  // --- Encabezado del documento ---
  '<div class="panel">'+
    '<div class="panel-head"><h2>Datos de la cotización</h2></div>'+
    '<div class="row2">'+
      '<div class="field"><label>Cliente</label><input id="f-client" value="'+esc(d.client)+'" placeholder="Nombre del cliente"></div>'+
      '<div class="field"><label>Fecha</label><input id="f-date" type="date" value="'+esc(d.date)+'"></div>'+
    '</div>'+
    '<div class="field"><label>Título de la propuesta</label><input id="f-title" value="'+esc(d.title)+'" placeholder="Ej. Propuesta de configuración de equipo para software de Arquitectura"></div>'+
    '<div class="row2">'+
      '<div class="field"><label>Texto superior (eyebrow)</label><input id="f-eyebrow" value="'+esc(d.eyebrow)+'"></div>'+
      '<div class="field"><label>% de instalación</label><input id="f-pct" type="number" min="0" step="0.5" value="'+esc(d.installPct)+'"></div>'+
    '</div>'+
  '</div>'+

  // --- Opciones ---
  '<div class="panel" style="margin-top:18px">'+
    '<div class="panel-head"><h2>Opciones de configuración</h2>'+
      '<button class="btn sm" id="addOpt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Agregar opción</button>'+
    '</div>'+
    '<div class="opt-tabs">'+tabs+'</div>'+
    optionEditor(opt)+
  '</div>'+

  // --- barra inferior ---
  '<div class="editor-bar">'+
    '<button class="btn ghost" id="cancelEdit">Cancelar</button>'+
    '<span class="draftnote">'+(isRev?"Modo revisión · "+esc(d.baseFolio||""):"Borrador sin guardar")+'</span>'+
    '<div class="spacer"></div>'+
    '<button class="btn" id="prevBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg> Vista previa</button>'+
    '<button class="btn dark" id="pdfBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg> Descargar PDF</button>'+
    '<button class="btn primary" id="saveBtn">'+(isRev?"Guardar revisión":"Guardar cotización")+'</button>'+
  '</div>';
}

function optionEditor(opt){
  const accentSel = OPT_ACCENTS.map(a=>'<option value="'+a.key+'" '+(opt.accent===a.key?"selected":"")+'>'+a.name+'</option>').join("");
  const rows = opt.components.map((c,i)=> compRow(c,i)).join("");
  const t = optTotals(opt, state.draft.installPct);
  const pills = opt.pills.map((p,i)=>(
    '<div class="flex" style="gap:6px" data-pillrow="'+i+'">'+
      '<input class="mono" style="max-width:140px;font-size:11px;font-family:var(--mono)" data-pilllabel="'+i+'" value="'+esc(p.label)+'" placeholder="ETIQUETA">'+
      '<input style="flex:1" data-pillval="'+i+'" value="'+esc(p.value)+'" placeholder="valor (ej. 32 GB DDR4 3200 MHz)">'+
      '<button class="btn sm ghost" data-pilldel="'+i+'" title="Quitar">✕</button>'+
    '</div>'
  )).join("");

  return ''+
  '<div class="row2">'+
    '<div class="field"><label>Etiqueta de la opción</label><input id="o-label" value="'+esc(opt.label)+'" placeholder="A"></div>'+
    '<div class="field"><label>Color del badge</label><select id="o-accent">'+accentSel+'</select></div>'+
  '</div>'+
  '<div class="field"><label>Subtítulo / encabezado</label><input id="o-heading" value="'+esc(opt.heading)+'" placeholder="Ej. Entornos de trabajo intensivos: multitarea, modelado 3D y renderizado profesional"></div>'+
  '<div class="field"><label>Descripción (párrafos)</label><textarea id="o-desc" placeholder="Describe la configuración. Deja una línea en blanco para separar párrafos.">'+esc(opt.description)+'</textarea><span class="hint">Separa párrafos con una línea en blanco.</span></div>'+

  '<div class="rule-nodes" style="margin:18px 0"></div>'+

  // Resumen (pills)
  '<div class="panel-head" style="margin-bottom:10px"><h2 style="font-size:14px">Resumen (pills superiores)</h2>'+
    '<div class="flex"><button class="btn sm ghost" id="pillAuto">Autollenar</button><button class="btn sm ghost" id="pillAdd">+ Pill</button></div>'+
  '</div>'+
  '<div id="pillBox" style="display:flex;flex-direction:column;gap:8px;margin-bottom:6px">'+pills+'</div>'+

  '<div class="rule-nodes" style="margin:18px 0"></div>'+

  // Componentes
  '<div class="panel-head" style="margin-bottom:8px"><h2 style="font-size:14px">Componentes</h2>'+
    '<div class="flex wrap-w">'+
      '<button class="btn sm" id="impXlsx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Importar Excel</button>'+
      '<button class="btn sm primary" id="addComp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Agregar componente</button>'+
    '</div>'+
  '</div>'+
  '<table class="comp-table" id="compTable"><thead><tr>'+
    '<th></th><th>Tipo / Componente</th><th>Descripción</th><th>Marca / Modelo</th><th>Estado</th><th style="text-align:right">Precio</th><th>Enlace</th><th></th>'+
  '</tr></thead><tbody id="compBody">'+ (rows||'<tr><td colspan="8" class="muted" style="padding:16px;text-align:center">Sin componentes. Agrega uno o importa un Excel.</td></tr>') +'</tbody></table>'+

  '<div class="totals-mini">'+
    '<div class="ln"><span>Subtotal componentes</span><span class="v" id="tSub">'+money(t.sub)+'</span></div>'+
    '<div class="ln"><span>'+esc(state.draft.installPct)+'% instalación</span><span class="v" id="tInst">'+money(t.inst)+'</span></div>'+
    '<div class="ln grand"><span>Total opción '+esc(opt.label)+'</span><span class="v" id="tTot">'+money(t.total)+'</span></div>'+
  '</div>';
}

function compRow(c,i){
  const types = state.db.settings.types;
  const typeOpts = '<option value=""></option>'+ types.map(t=>'<option '+(norm(t)===norm(c.type)?"selected":"")+'>'+esc(t)+'</option>').join("") +
    (c.type && !types.some(t=>norm(t)===norm(c.type)) ? '<option selected>'+esc(c.type)+'</option>':'');
  const statusSel =
    '<option value="incluido" '+(c.status==="incluido"?"selected":"")+'>Incluido</option>'+
    '<option value="servicio" '+(c.status==="servicio"?"selected":"")+'>Servicio</option>'+
    '<option value="cliente" '+(c.status==="cliente"?"selected":"")+'>Del cliente</option>';
  return '<tr data-i="'+i+'" draggable="false">'+
    '<td class="c-handle" data-handle="'+i+'" title="Arrastra para reordenar">⠿</td>'+
    '<td><select data-f="type" data-i="'+i+'">'+typeOpts+'</select></td>'+
    '<td><textarea data-f="spec" data-i="'+i+'" rows="1" placeholder="Descripción / specs">'+esc(c.spec)+'</textarea></td>'+
    '<td class="ac-wrap"><input data-f="brandModel" data-i="'+i+'" value="'+esc(c.brandModel)+'" placeholder="Marca / modelo" autocomplete="off"><div class="ac-list" data-ac="'+i+'"></div></td>'+
    '<td><select data-f="status" data-i="'+i+'">'+statusSel+'</select></td>'+
    '<td class="c-price"><input data-f="price" data-i="'+i+'" value="'+esc(c.price)+'" inputmode="decimal" placeholder="0.00"></td>'+
    '<td><input data-f="link" data-i="'+i+'" value="'+esc(c.link)+'" placeholder="https://amazon…"></td>'+
    '<td class="c-del"><button data-del="'+i+'" title="Eliminar">✕</button></td>'+
  '</tr>';
}

function bindEditor(){
  const d = state.draft;
  // encabezado
  $("#f-client").oninput=e=>d.client=e.target.value;
  $("#f-date").oninput=e=>d.date=e.target.value;
  $("#f-title").oninput=e=>d.title=e.target.value;
  $("#f-eyebrow").oninput=e=>d.eyebrow=e.target.value;
  $("#f-pct").oninput=e=>{ d.installPct=num(e.target.value); refreshTotals(); };

  // tabs
  $$("[data-tab]").forEach(b=> b.onclick=e=>{ if(e.target.dataset.delopt!=null) return; state.activeOpt=+b.dataset.tab; render(); });
  $$("[data-delopt]").forEach(x=> x.onclick=async e=>{
    e.stopPropagation();
    if(d.options.length<=1){ toast("Debe haber al menos una opción.","err"); return; }
    const i=+x.dataset.delopt;
    const ok=await confirmDialog({title:"Quitar opción",msg:"Se eliminará la opción "+esc(d.options[i].label)+" con sus componentes.",ok:"Quitar",danger:true});
    if(!ok) return;
    d.options.splice(i,1);
    state.activeOpt=Math.max(0,Math.min(state.activeOpt,d.options.length-1));
    render();
  });
  $("#addOpt").onclick=()=>{ d.options.push(newOption(d.options.length)); state.activeOpt=d.options.length-1; render(); };

  const opt = d.options[state.activeOpt];

  // campos de opción
  $("#o-label").oninput=e=>{ opt.label=e.target.value; };
  $("#o-accent").oninput=e=>{ opt.accent=e.target.value; };
  $("#o-heading").oninput=e=>opt.heading=e.target.value;
  $("#o-desc").oninput=e=>opt.description=e.target.value;

  // pills
  bindPills(opt);
  $("#pillAdd").onclick=()=>{ opt.pills.push({label:"",value:""}); render(); };
  $("#pillAuto").onclick=()=>{ autofillPills(opt); render(); toast("Pills autollenadas desde los componentes."); };

  // componentes
  $("#addComp").onclick=()=>{ opt.components.push(newComponent("")); render(); focusLastRow(); };
  $("#impXlsx").onclick=()=> openExcelImport(opt);
  bindCompTable(opt);

  // barra
  $("#cancelEdit").onclick=async()=>{
    const ok=await confirmDialog({title:"Salir del editor",msg:"Se perderán los cambios no guardados.",ok:"Salir",cancel:"Seguir editando",danger:true});
    if(ok){ state.draft=null; state.editingId=null; go("list"); }
  };
  $("#prevBtn").onclick=()=> previewModal(d);
  $("#pdfBtn").onclick=()=> openPrint(d);
  $("#saveBtn").onclick=saveDraft;
}

function bindPills(opt){
  $$("[data-pilllabel]").forEach(inp=> inp.oninput=e=>{ opt.pills[+inp.dataset.pilllabel].label=e.target.value; });
  $$("[data-pillval]").forEach(inp=> inp.oninput=e=>{ opt.pills[+inp.dataset.pillval].value=e.target.value; });
  $$("[data-pilldel]").forEach(btn=> btn.onclick=()=>{ opt.pills.splice(+btn.dataset.pilldel,1); render(); });
}
function autofillPills(opt){
  opt.pills.forEach(p=>{
    if(p.value) return;
    const map = PILL_MAP.find(m=> norm(m.label)===norm(p.label));
    if(!map) return;
    const c = opt.components.find(c=> map.types.some(t=> norm(c.type).includes(t)));
    if(c) p.value = c.spec || c.brandModel || "";
  });
}

function bindCompTable(opt){
  // edición de celdas
  $$('#compBody [data-f]').forEach(inp=>{
    inp.oninput=e=>{
      const i=+inp.dataset.i, f=inp.dataset.f;
      const c=opt.components[i]; if(!c) return;
      if(f==="price") c.price=inp.value; else c[f]=inp.value;
      if(f==="type" && (!c.name||c.name===c.prevType)) c.name=inp.value;
      if(f==="price"||f==="status") refreshTotals();
      if(f==="brandModel") showAutocomplete(opt,i,inp.value);
      // autoajuste textarea
      if(inp.tagName==="TEXTAREA"){ inp.style.height="auto"; inp.style.height=(inp.scrollHeight)+"px"; }
    };
    if(inp.tagName==="TEXTAREA"){ inp.style.height="auto"; inp.style.height=(inp.scrollHeight)+"px"; }
    if(inp.dataset.f==="brandModel"){
      inp.onfocus=()=> showAutocomplete(opt,+inp.dataset.i,inp.value);
      inp.onblur=()=> setTimeout(()=>{ const l=$('[data-ac="'+inp.dataset.i+'"]'); if(l) l.classList.remove("open"); },180);
    }
  });
  // eliminar
  $$('#compBody [data-del]').forEach(b=> b.onclick=()=>{ opt.components.splice(+b.dataset.del,1); render(); });
  // drag reorder
  enableDrag(opt);
}

function showAutocomplete(opt,i,query){
  const box=$('[data-ac="'+i+'"]'); if(!box) return;
  const type=opt.components[i].type;
  const sug=catalogSuggest(type,query);
  if(!sug.length || !query){ box.classList.remove("open"); box.innerHTML=""; return; }
  box.innerHTML=sug.map(s=>{
    const last=s.priceHistory[s.priceHistory.length-1];
    return '<div class="ac-item" data-pick="'+esc(s.key)+'"><div class="nm">'+esc(s.brandModel)+'</div>'+
      '<div class="mt">'+esc(s.type)+' · últ. '+money(last?last.price:0)+(last?(' · '+fmtDate(last.date)):'')+'</div></div>';
  }).join("");
  box.classList.add("open");
  $$('.ac-item',box).forEach(it=> it.onmousedown=e=>{
    e.preventDefault();
    const item=state.db.catalog.find(x=>x.key===it.dataset.pick);
    if(!item) return;
    const c=opt.components[i];
    c.brandModel=item.brandModel;
    if(!c.spec) c.spec=item.lastSpec||"";
    if(!c.link) c.link=item.lastLink||"";
    const last=item.priceHistory[item.priceHistory.length-1];
    if(last && (!c.price||num(c.price)===0)) c.price=last.price;
    if(!c.type) c.type=item.type;
    box.classList.remove("open");
    render(); // re-render fila
  });
}

function enableDrag(opt){
  let dragIdx=null;
  $$('#compBody [data-handle]').forEach(h=>{
    const tr=h.closest("tr");
    h.onmousedown=()=>tr.setAttribute("draggable","true");
    tr.addEventListener("dragstart",e=>{ dragIdx=+h.dataset.handle; tr.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; });
    tr.addEventListener("dragend",()=>{ tr.classList.remove("dragging"); tr.setAttribute("draggable","false"); $$('#compBody tr').forEach(r=>r.classList.remove("drop-target")); });
  });
  $$('#compBody tr').forEach(tr=>{
    tr.addEventListener("dragover",e=>{ e.preventDefault(); tr.classList.add("drop-target"); });
    tr.addEventListener("dragleave",()=> tr.classList.remove("drop-target"));
    tr.addEventListener("drop",e=>{
      e.preventDefault();
      const to=+tr.dataset.i;
      if(dragIdx==null||to===dragIdx) return;
      const [m]=opt.components.splice(dragIdx,1);
      opt.components.splice(to,0,m);
      render();
    });
  });
}

function focusLastRow(){
  const rows=$$('#compBody tr'); const last=rows[rows.length-1];
  if(last){ const sel=last.querySelector('select[data-f="type"]'); if(sel) sel.focus(); }
}
function refreshTotals(){
  const d=state.draft, opt=d.options[state.activeOpt];
  const t=optTotals(opt,d.installPct);
  const a=$("#tSub"),b=$("#tInst"),c=$("#tTot");
  if(a)a.textContent=money(t.sub); if(b)b.textContent=money(t.inst); if(c)c.textContent=money(t.total);
  const lbl=$(".totals-mini .ln:nth-child(2) span:first-child"); if(lbl) lbl.textContent=d.installPct+"% instalación";
}

async function saveDraft(){
  const d=state.draft;
  if(!d.client.trim()){ toast("Falta el nombre del cliente.","err"); $("#f-client").focus(); return; }
  const hasComp = d.options.some(o=>o.components.length);
  if(!hasComp){ const ok=await confirmDialog({title:"Sin componentes",msg:"Ninguna opción tiene componentes. ¿Guardar de todos modos?",ok:"Guardar"}); if(!ok) return; }

  if(state.editingId==null){
    const saved=persistNew(d);
    state.draft=null; state.editingId=null;
    go("list");
    toast("Cotización guardada: "+saved.folio,"ok");
  } else {
    const original=state.db.quotations.find(q=>q.id===state.editingId);
    const rev=persistRevision(d, original);
    state.draft=null; state.editingId=null;
    go("list");
    toast("Revisión creada: "+rev.folio+" (original conservada)","ok");
  }
}

/* ======================= CATÁLOGO ======================= */
function viewCatalog(){
  const s=norm(state.catSearch);
  let items=state.db.catalog.slice();
  if(s) items=items.filter(i=> norm(i.brandModel).includes(s)||norm(i.type).includes(s));
  // agrupar por tipo
  const byType={};
  items.forEach(i=> (byType[i.type||"(sin tipo)"]=byType[i.type||"(sin tipo)"]||[]).push(i));
  const orderedTypes=state.db.settings.types.filter(t=>byType[t]).concat(Object.keys(byType).filter(t=>!state.db.settings.types.includes(t)));

  let body="";
  if(!items.length){
    body='<div class="empty"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16"/></svg></div>'+
      '<h3>'+(s?"Sin coincidencias":"El catálogo está vacío")+'</h3>'+
      '<p>'+(s?"Prueba otra búsqueda.":"Cada vez que guardes una cotización, sus componentes se registran aquí con su precio y fecha para que puedas comparar cómo cambian.")+'</p></div>';
  } else {
    body=orderedTypes.map(t=>{
      const arr=byType[t].sort((a,b)=>a.brandModel.localeCompare(b.brandModel));
      return '<div class="cat-type"><h3>'+esc(t)+' <span class="count">'+arr.length+' modelo(s)</span></h3>'+
        arr.map(catItem).join("")+'</div>';
    }).join("");
  }
  return ''+
  '<div class="page-head"><div>'+
    '<div class="klabel eyebrow">Referencia</div>'+
    '<h1>Componentes</h1>'+
    '<p class="sub">'+state.db.catalog.length+' modelo(s) registrados · historial de precios por fecha</p>'+
  '</div></div>'+
  '<div class="toolbar"><div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>'+
    '<input id="catSearch" placeholder="Buscar modelo o tipo…" value="'+esc(state.catSearch)+'"></div></div>'+
  body;
}
function catItem(i){
  const hist=i.priceHistory;
  const prices=hist.map(h=>h.price);
  const min=Math.min.apply(null,prices), max=Math.max.apply(null,prices);
  const last=hist[hist.length-1], first=hist[0];
  let delta="", dcls="delta-flat";
  if(hist.length>1){
    const diff=last.price-first.price;
    const pct=first.price? (diff/first.price*100):0;
    dcls=diff>0?"delta-up":diff<0?"delta-down":"delta-flat";
    delta=(diff>0?"▲ +":diff<0?"▼ ":"= ")+ (Math.abs(pct).toFixed(1))+"%";
  }
  // sparkline
  const range=max-min||1;
  const bars=hist.map(h=>{
    const ht=18+ ((h.price-min)/range)*28;
    return '<div class="bar" style="height:'+ht.toFixed(0)+'px" title="'+esc(fmtDate(h.date))+' · '+money(h.price)+'"></div>';
  }).join("");
  const rows=hist.slice().reverse().map((h,idx,arr)=>{
    const prev=arr[idx+1];
    let d="";
    if(prev){ const diff=h.price-prev.price; d=diff>0?'<span class="delta-up">+'+money(diff)+'</span>':diff<0?'<span class="delta-down">'+money(diff)+'</span>':'<span class="delta-flat">=</span>'; }
    return '<tr><td class="f">'+esc(h.folio||"")+'</td><td>'+esc(fmtDate(h.date))+'</td><td class="p">'+money(h.price)+'</td><td style="text-align:right">'+d+'</td></tr>';
  }).join("");

  return '<div class="cat-item" data-key="'+esc(i.key)+'">'+
    '<div class="ci-head">'+
      '<div><span class="model">'+esc(i.brandModel)+'</span>'+(i.lastSpec?'<div class="muted" style="font-size:11.5px;margin-top:2px">'+esc(i.lastSpec)+'</div>':'')+'</div>'+
      '<div class="ci-stats">'+
        '<span>usos <b>'+hist.length+'</b></span>'+
        '<span>últ. <b>'+money(last.price)+'</b></span>'+
        '<span>mín <b>'+money(min)+'</b></span>'+
        '<span>máx <b>'+money(max)+'</b></span>'+
        (delta?'<span class="'+dcls+'">'+delta+'</span>':'')+
      '</div>'+
    '</div>'+
    '<div class="spark">'+bars+'</div>'+
    '<div style="margin-top:8px"><button class="btn sm ghost" data-hist="'+esc(i.key)+'">Ver historial de precios ▾</button>'+
      (i.lastLink?' <a class="btn sm ghost" href="'+esc(i.lastLink)+'" target="_blank" rel="noopener">Abrir enlace ↗</a>':'')+
    '</div>'+
    '<div class="price-hist" data-histbox="'+esc(i.key)+'"><table><tbody>'+
      '<tr><td class="f"><b>FOLIO</b></td><td><b>FECHA</b></td><td class="p"><b>PRECIO</b></td><td style="text-align:right"><b>Δ</b></td></tr>'+
      rows+'</tbody></table></div>'+
  '</div>';
}
function bindCatalog(){
  const cs=$("#catSearch");
  if(cs) cs.oninput=()=>{ state.catSearch=cs.value; const p=cs.selectionStart; render(); const n=$("#catSearch"); if(n){n.focus();try{n.setSelectionRange(p,p);}catch(e){}} };
  $$('[data-hist]').forEach(b=> b.onclick=()=>{ const box=$('[data-histbox="'+b.dataset.hist.replace(/"/g,'\\"')+'"]'); if(box){ box.classList.toggle("open"); b.textContent=box.classList.contains("open")?"Ocultar historial ▴":"Ver historial de precios ▾"; } });
}

/* ======================= AJUSTES ======================= */
function viewSettings(){
  const s=state.db.settings;
  const types=s.types.map((t,i)=>(
    '<div class="type-row" data-trow="'+i+'"><span class="drag">⠿</span><input data-tname="'+i+'" value="'+esc(t)+'"><button class="btn sm danger" data-tdel="'+i+'">✕</button></div>'
  )).join("");
  const notes=s.notes.map((n,i)=>(
    '<div class="field"><label>Nota '+(i+1)+'</label><textarea data-note="'+i+'">'+esc(n)+'</textarea><div class="flex"><button class="btn sm danger" data-notedel="'+i+'">Quitar nota</button></div></div>'
  )).join("");

  return ''+
  '<div class="page-head"><div><div class="klabel eyebrow">Configuración</div><h1>Ajustes</h1></div></div>'+
  '<div class="settings-grid">'+

    '<div class="panel"><div class="panel-head"><h2>Identidad en la cotización</h2></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Tu nombre (vendedor)</label><input id="s-seller" value="'+esc(s.sellerName)+'"></div>'+
        '<div class="field"><label>Celular / contacto</label><input id="s-phone" value="'+esc(s.phone)+'"></div>'+
      '</div>'+
      '<div class="field"><label>Razón social / negocio (opcional, a futuro)</label><input id="s-biz" value="'+esc(s.businessName)+'" placeholder="Nombre de tu negocio"></div>'+
      '<div class="field"><label>Logo (opcional, a futuro)</label>'+
        '<div class="logo-drop" id="logoDrop">'+ (s.logoDataUrl?'<img class="logo-prev" src="'+s.logoDataUrl+'">':'Haz clic para subir tu logo (PNG/SVG)') +'</div>'+
        (s.logoDataUrl?'<div class="flex" style="margin-top:8px"><button class="btn sm danger" id="logoDel">Quitar logo</button></div>':'')+
      '</div>'+
    '</div>'+

    '<div class="panel"><div class="panel-head"><h2>Numeración y cálculo</h2></div>'+
      '<div class="row3">'+
        '<div class="field"><label>Prefijo de folio</label><input id="s-prefix" value="'+esc(s.folioPrefix)+'"></div>'+
        '<div class="field"><label>% instalación por defecto</label><input id="s-pct" type="number" min="0" step="0.5" value="'+esc(s.installPct)+'"></div>'+
        '<div class="field"><label>Moneda</label><select id="s-cur"><option '+(s.currency==="MXN"?"selected":"")+'>MXN</option><option '+(s.currency==="USD"?"selected":"")+'>USD</option><option '+(s.currency==="EUR"?"selected":"")+'>EUR</option></select></div>'+
      '</div>'+
      '<div class="field"><label>Texto superior por defecto (eyebrow)</label><input id="s-eyebrow" value="'+esc(s.eyebrow)+'"></div>'+
      '<p class="hint">Folio actual del año '+new Date().getFullYear()+': '+(s.folioCountersByYear[String(new Date().getFullYear())]||0)+' emitidos.</p>'+
    '</div>'+

    '<div class="panel"><div class="panel-head"><h2>Tipos de componente</h2><button class="btn sm" id="typeAdd">+ Tipo</button></div>'+
      '<div class="types-editor" id="typesEditor">'+types+'</div>'+
      '<p class="hint" style="margin-top:10px">Estos tipos aparecen al capturar componentes y agrupan el catálogo.</p>'+
    '</div>'+

    '<div class="panel"><div class="panel-head"><h2>Notas al pie por defecto</h2><button class="btn sm" id="noteAdd">+ Nota</button></div>'+notes+'</div>'+

    '<div class="panel"><div class="panel-head"><h2>Guardar ajustes</h2></div>'+
      '<p class="hint" style="margin-bottom:12px">Los cambios se aplican a las cotizaciones nuevas.</p>'+
      '<button class="btn primary" id="saveSettings">Guardar ajustes</button>'+
    '</div>'+

  '</div>';
}
function bindSettings(){
  const s=state.db.settings;
  const collect=()=>{
    s.sellerName=$("#s-seller").value; s.phone=$("#s-phone").value; s.businessName=$("#s-biz").value;
    s.folioPrefix=$("#s-prefix").value.trim()||"COT"; s.installPct=num($("#s-pct").value); s.currency=$("#s-cur").value;
    s.eyebrow=$("#s-eyebrow").value;
    s.types=$$('#typesEditor [data-tname]').map(i=>i.value.trim()).filter(Boolean);
    s.notes=$$('[data-note]').map(i=>i.value.trim()).filter(Boolean);
  };
  $("#saveSettings").onclick=()=>{ collect(); saveDB(); toast("Ajustes guardados.","ok"); render(); };
  $("#typeAdd").onclick=()=>{ collect(); s.types.push("Nuevo tipo"); render(); };
  $$('[data-tdel]').forEach(b=> b.onclick=()=>{ collect(); s.types.splice(+b.dataset.tdel,1); render(); });
  $("#noteAdd").onclick=()=>{ collect(); s.notes.push(""); render(); };
  $$('[data-notedel]').forEach(b=> b.onclick=()=>{ collect(); s.notes.splice(+b.dataset.notedel,1); render(); });
  // logo
  $("#logoDrop").onclick=()=> $("#fileLogo").click();
  const ld=$("#logoDel"); if(ld) ld.onclick=()=>{ collect(); s.logoDataUrl=null; saveDB(); render(); };
}

/* ======================= DOCUMENTO (vista previa + PDF) ======================= */
function buildDoc(q){
  const pages = q.options.map((opt,idx)=> docPage(q,opt,idx)).join("");
  return '<div class="doc">'+pages+'</div>';
}
function docPage(q,opt,idx){
  const t=optTotals(opt,q.installPct);
  const accentClass = opt.accent==="copper"?"":opt.accent;
  const totalsOlive = opt.accent==="olive"?"olive":"";
  // banda solo en la primera página
  const band = idx===0 ? docBand(q) : "";

  const pills = opt.pills.filter(p=>p.value||p.label).map(p=>
    '<div class="doc-pill"><div class="pk">'+esc(p.label)+'</div><div class="pv">'+esc(p.value||"—")+'</div></div>'
  ).join("");

  const rows = opt.components.map(c=>{
    const off = c.status==="cliente";
    let model, price, link;
    if(c.status==="cliente"){ model='<span class="muted">Aportado por el cliente</span>'; price='<span class="dash">—</span>'; link='<span class="dash">—</span>'; }
    else if(c.status==="servicio"){ model='<span class="c-model">'+(c.brandModel?esc(c.brandModel):'<span class="muted">Servicio incluido</span>')+'</span>'; price=money(num(c.price)); link= c.link?'<a class="c-link" href="'+esc(c.link)+'" target="_blank" rel="noopener">Ver enlace ↗</a>':'<span class="dash">—</span>'; }
    else { model='<span class="c-model">'+esc(c.brandModel||"—")+'</span>'; price=money(num(c.price)); link= c.link?'<a class="c-link" href="'+esc(c.link)+'" target="_blank" rel="noopener">Ver en Amazon ↗</a>':'<span class="dash">—</span>'; }
    return '<tr class="'+(off?"is-off":"")+'">'+
      '<td class="ck">'+(off?'<span class="off">'+ICON_OFF+'</span>':ICON_CK)+'</td>'+
      '<td><div class="c-name">'+esc(c.name||c.type||"—")+'</div>'+(c.spec?'<div class="c-spec">'+esc(c.spec)+'</div>':'')+'</td>'+
      '<td>'+model+'</td>'+
      '<td class="r c-price">'+price+'</td>'+
      '<td>'+link+'</td>'+
    '</tr>';
  }).join("");

  const descHtml = (opt.description||"").split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+esc(p).replace(/\n/g,"<br>")+'</p>').join("") || "";

  const notes = q.notes.map((n,i)=>'<p><b>Nota '+(i+1)+'.</b> '+esc(n)+'</p>').join("");
  const s=state.db.settings;
  const footL = (s.sellerName||"")+(s.phone?(" · "+s.phone):"");
  const footR = q.folio;

  return '<div class="doc-page">'+
    band+
    '<div class="doc-body">'+
      '<div class="opt-badge '+accentClass+'">OPCIÓN '+esc(opt.label)+'</div>'+
      (opt.heading?'<h2 class="opt-head">'+esc(opt.heading)+'</h2>':'')+
      '<div class="opt-desc">'+descHtml+'</div>'+
      (pills?'<div class="doc-pills">'+pills+'</div>':'')+
      '<table class="doc-table"><thead><tr><th></th><th>Componente</th><th>Marca / Modelo</th><th class="r">Precio</th><th>Enlace</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="doc-totals '+totalsOlive+'"><div class="tt">'+
        '<div class="ln"><span>Subtotal componentes</span><span class="v">'+money(t.sub)+'</span></div>'+
        '<div class="ln"><span>'+esc(q.installPct)+'% instalación</span><span class="v">'+money(t.inst)+'</span></div>'+
        '<div class="grand"><span class="lbl">Total opción '+esc(opt.label)+'</span><span class="v">'+money(t.total)+'</span></div>'+
      '</div></div>'+
    '</div>'+
    '<div class="doc-notes">'+notes+'</div>'+
    '<div class="doc-foot"><span>'+esc(footL)+'</span><span>'+esc(footR)+'</span></div>'+
  '</div>';
}
function docBand(q){
  const s=state.db.settings;
  const logo = s.logoDataUrl?'<img src="'+s.logoDataUrl+'" style="max-height:40px;margin-bottom:10px">':'';
  const biz = s.businessName?('<b>'+esc(s.businessName)+'</b> · '):'';
  return '<div class="doc-band">'+
    '<div class="db-grid">'+
      '<div>'+logo+'<div class="eyebrow">'+esc(q.eyebrow||DEFAULT_EYEBROW)+'</div>'+
        '<h1>'+esc(q.title||"Propuesta de configuración de equipo")+'</h1>'+
        '<div class="biz">'+biz+'<b>'+esc(s.sellerName||"")+'</b>'+(s.phone?(' · '+esc(s.phone)):'')+'</div>'+
      '</div>'+
      '<div class="meta">'+
        '<div><span class="k">Folio</span> <b>'+esc(q.folio||"—")+'</b></div>'+
        '<div><span class="k">Fecha</span> <b>'+esc(fmtDate(q.date))+'</b></div>'+
        '<div><span class="k">Cliente</span> <b>'+esc(q.client||"—")+'</b></div>'+
      '</div>'+
    '</div>'+
    '<div class="doc-band-rule"><i></i><i></i><i></i></div>'+
  '</div>';
}

function previewModal(q){
  openModal({ wide:true, body:
    '<div class="flex" style="justify-content:space-between;margin-bottom:14px">'+
      '<div><h2 style="font-size:17px">Vista previa</h2><div class="muted" style="font-size:12.5px">'+esc(q.folio||"Borrador")+' · '+esc(q.client||"Sin cliente")+'</div></div>'+
      '<div class="flex"><button class="btn dark" id="pvPdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg> Descargar PDF</button><button class="btn ghost" id="pvClose">Cerrar</button></div>'+
    '</div>'+
    '<div class="preview-scroll">'+buildDoc(q)+'</div>'
  });
  $("#pvClose").onclick=closeModal;
  $("#pvPdf").onclick=()=>{ closeModal(); openPrint(q); };
}

function openPrint(q){
  const root=$("#print-root");
  root.innerHTML=buildDoc(q);
  const title="Cotizacion_"+(q.folio||"borrador").replace(/[^\w\-]/g,"_")+(q.client?("_"+q.client.replace(/[^\w]+/g,"_")):"");
  const prevTitle=document.title;
  document.title=title;
  // dar tiempo a aplicar estilos
  setTimeout(()=>{ window.print(); setTimeout(()=>{ document.title=prevTitle; },500); }, 60);
  toast("En el diálogo elige “Guardar como PDF”.");
}

/* ======================= EXCEL ======================= */
const XLS_HEADERS = ["Tipo","Componente","Descripción","Marca/Modelo","Precio","Enlace","Estado"];
function downloadTemplate(){
  if(typeof XLSX==="undefined"){ toast("Motor de Excel aún cargando, intenta de nuevo.","err"); return; }
  const rows=[
    XLS_HEADERS,
    ["Procesador","Procesador","16 núcleos / 32 hilos · hasta 4.8 GHz","AMD Ryzen 9 5900XT",6223.97,"https://amazon...","incluido"],
    ["Tarjeta madre","Tarjeta madre","Socket AM4 · chipset B550","ASUS ROG Strix B550-F",3782,"https://amazon...","incluido"],
    ["Memoria RAM","Memoria RAM","Kit 2×16 GB · 32 GB · 3200 MHz","Kingston",4284,"","incluido"],
    ["Tarjeta de video","Tarjeta de video","","",,"","cliente"],
    ["Software / Licencia","Licencia Autodesk (1 año)","Activación y configuración","Autodesk",600,"","servicio"]
  ];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:20},{wch:24},{wch:40},{wch:24},{wch:12},{wch:30},{wch:12}];
  // hoja de ayuda
  const help=XLSX.utils.aoa_to_sheet([
    ["Instrucciones"],
    ["1. Llena una fila por componente. No borres la fila de encabezados."],
    ["2. Columna Estado admite: incluido / servicio / cliente"],
    ["   • incluido = se suma al subtotal (la mayoría)"],
    ["   • servicio = servicio incluido (ej. licencia), también se suma"],
    ["   • cliente  = lo aporta el cliente, sin precio (no se suma)"],
    ["3. Precio: solo número (ej. 6223.97), sin símbolo $ ni comas."],
    ["4. Tipo: usa los tipos de la app para que el catálogo agrupe bien."],
    ["5. Guarda y súbelo en la app con “Importar Excel”."]
  ]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Componentes");
  XLSX.utils.book_append_sheet(wb,help,"Instrucciones");
  XLSX.writeFile(wb,"Plantilla_Cotizador_PC.xlsx");
  toast("Plantilla descargada.","ok");
}

function openExcelImport(opt){
  state._impOpt=opt;
  openModal({ body:
    '<h2>Importar componentes desde Excel</h2>'+
    '<p class="modal-sub">Sube un archivo con las columnas de la plantilla. Se agregarán a la opción '+esc(opt.label)+'.</p>'+
    '<div class="dropzone" id="dz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg><div>Arrastra tu Excel aquí o haz clic para elegir</div><div class="muted" style="font-size:12px;margin-top:4px">.xlsx · .xls · .csv</div></div>'+
    '<div class="modal-actions"><button class="btn ghost" id="impTpl">Descargar plantilla</button><button class="btn ghost" id="impClose">Cerrar</button></div>'
  });
  const dz=$("#dz");
  dz.onclick=()=> $("#fileXlsx").click();
  dz.ondragover=e=>{ e.preventDefault(); dz.classList.add("drag"); };
  dz.ondragleave=()=> dz.classList.remove("drag");
  dz.ondrop=e=>{ e.preventDefault(); dz.classList.remove("drag"); if(e.dataTransfer.files[0]) handleXlsx(e.dataTransfer.files[0]); };
  $("#impTpl").onclick=downloadTemplate;
  $("#impClose").onclick=closeModal;
}
function normHeader(h){ return norm(h).replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u").replace(/[^a-z0-9]/g,""); }
function handleXlsx(file){
  if(typeof XLSX==="undefined"){ toast("Motor de Excel no disponible.","err"); return; }
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"binary"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      if(!data.length){ toast("El archivo está vacío.","err"); return; }
      // localizar fila de encabezados
      let hi=0;
      for(let r=0;r<Math.min(5,data.length);r++){
        const joined=data[r].map(normHeader).join("|");
        if(joined.includes("componente")||joined.includes("marca")||joined.includes("tipo")){ hi=r; break; }
      }
      const headers=data[hi].map(normHeader);
      const col=name=>{
        const aliases={tipo:["tipo","categoria","categoría"],componente:["componente","nombre","concepto"],descripcion:["descripcion","descripción","specs","caracteristicas","características","detalle"],modelo:["marcamodelo","marca","modelo","marcaymodelo"],precio:["precio","costo","importe","price"],enlace:["enlace","link","url"],estado:["estado","status"]};
        const al=aliases[name]||[name];
        for(const a of al){ const idx=headers.findIndex(h=>h===normHeader(a)); if(idx>=0) return idx; }
        return -1;
      };
      const ci={tipo:col("tipo"),comp:col("componente"),desc:col("descripcion"),mod:col("modelo"),precio:col("precio"),enlace:col("enlace"),estado:col("estado")};
      const out=[];
      for(let r=hi+1;r<data.length;r++){
        const row=data[r]; if(!row || row.every(v=>String(v).trim()==="")) continue;
        const get=k=> ci[k]>=0? row[ci[k]] : "";
        const tipo=String(get("tipo")||"").trim();
        const comp=String(get("comp")||"").trim()|| tipo;
        const mod=String(get("mod")||"").trim();
        if(!tipo && !comp && !mod) continue;
        let st=norm(get("estado"));
        if(["cliente","aportado","del cliente","aportado por el cliente"].some(x=>st.includes(x))) st="cliente";
        else if(["servicio","incluido servicio","licencia"].some(x=>st.includes(x))) st="servicio";
        else st="incluido";
        out.push({ id:uid(), type:tipo, name:comp||tipo, spec:String(get("desc")||"").trim(), brandModel:mod, price:num(get("precio")), link:String(get("enlace")||"").trim(), status:st });
      }
      if(!out.length){ toast("No se encontraron filas de componentes.","err"); return; }
      state._impOpt.components=state._impOpt.components.concat(out);
      closeModal(); render();
      toast(out.length+" componente(s) importado(s).","ok");
    }catch(err){ console.error(err); toast("No se pudo leer el Excel. Usa la plantilla.","err"); }
  };
  reader.readAsBinaryString(file);
}

/* ======================= RESPALDO JSON ======================= */
function exportJson(){
  const blob=new Blob([JSON.stringify(state.db,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="respaldo_cotizador_"+todayISO()+".json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("Respaldo exportado.","ok");
}
function importJson(file){
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data || !Array.isArray(data.quotations)){ toast("Archivo no válido.","err"); return; }
      const ok=await confirmDialog({title:"Importar respaldo",msg:"Esto reemplazará TODOS los datos actuales ("+state.db.quotations.length+" cotización/es) por los del archivo ("+data.quotations.length+"). ¿Continuar?",ok:"Reemplazar",danger:true});
      if(!ok) return;
      const f=freshDB();
      data.settings=Object.assign(f.settings,data.settings||{});
      data.catalog=data.catalog||[];
      state.db=data; saveDB(); go("list");
      toast("Respaldo importado.","ok");
    }catch(err){ console.error(err); toast("No se pudo leer el JSON.","err"); }
  };
  reader.readAsText(file);
}

/* ======================= MENÚ DATOS / ARCHIVOS ======================= */
function bindGlobal(){
  // nav
  $$("#nav button").forEach(b=> b.onclick=async()=>{
    if(state.view==="editor" && state.draft){
      const ok=await confirmDialog({title:"Salir del editor",msg:"Tienes una cotización en edición. Si sales se perderán los cambios no guardados.",ok:"Salir",cancel:"Seguir editando",danger:true});
      if(!ok) return;
    }
    state.view=b.dataset.view; state.draft=null; state.editingId=null; render();
  });
  // menú datos
  const dm=$("#dataMenu"), db=$("#dataBtn");
  db.onclick=e=>{ e.stopPropagation(); dm.classList.toggle("open"); };
  document.addEventListener("click",()=> dm.classList.remove("open"));
  dm.addEventListener("click",e=>e.stopPropagation());
  $("#mExport").onclick=()=>{ dm.classList.remove("open"); exportJson(); };
  $("#mImport").onclick=()=>{ dm.classList.remove("open"); $("#fileJson").click(); };
  $("#mTemplate").onclick=()=>{ dm.classList.remove("open"); downloadTemplate(); };
  $("#mWipe").onclick=async()=>{ dm.classList.remove("open");
    const ok=await confirmDialog({title:"Borrar todos los datos",msg:"Se eliminarán todas las cotizaciones, el catálogo y los ajustes de este navegador. Exporta un respaldo antes si quieres conservarlos.",ok:"Borrar todo",danger:true});
    if(ok){ localStorage.removeItem(DB_KEY); state.db=freshDB(); go("list"); toast("Datos borrados.","ok"); }
  };
  // inputs de archivo
  $("#fileJson").onchange=e=>{ if(e.target.files[0]) importJson(e.target.files[0]); e.target.value=""; };
  $("#fileXlsx").onchange=e=>{ if(e.target.files[0]) handleXlsx(e.target.files[0]); e.target.value=""; };
  $("#fileLogo").onchange=e=>{ const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>{ state.db.settings.logoDataUrl=ev.target.result; saveDB(); render(); toast("Logo guardado.","ok"); }; r.readAsDataURL(f); e.target.value="";
  };
  // imprimir con Ctrl/Cmd+P desde una vista previa no aplica; nada extra
}

/* ======================= PWA ======================= */
function registerSW(){
  if("serviceWorker" in navigator && location.protocol.startsWith("http")){
    navigator.serviceWorker.register("sw.js").catch(err=> console.warn("SW no registrado:",err));
  }
}

/* ======================= BOOT ======================= */
function boot(){
  state.db=loadDB();
  bindGlobal();
  render();
  registerSW();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();

})();
