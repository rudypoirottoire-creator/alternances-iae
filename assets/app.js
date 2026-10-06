/* Alternances IAE — logique commune à toutes les pages.
   Les données viennent de data/offres.js (window.DATA), le suivi du groupe est gardé dans le navigateur (localStorage). */
(function(){
"use strict";

const D = window.DATA || {offres:[], maj:"", actives:0};
const OFFRES = D.offres;
const PAR_ID = Object.fromEntries(OFFRES.map(o => [o.id, o]));
const ADAPTEES = OFFRES.filter(o => o.adaptee);

const P = {
  mod:    {label:"MOD",    nom:"Marketing Opérationnel & Digital",               c:"var(--mod)"},
  retail: {label:"Retail", nom:"Retail Management & Relation client",            c:"var(--retail)"},
  dcib:   {label:"DCIB",   nom:"Direction Commerciale & International Business", c:"var(--dcib)"}
};
const ZONES = [["Puy-de-Dôme","var(--z63)"],["Auvergne-Rhône-Alpes","var(--zaura)"],["Île-de-France","var(--zidf)"],["Autres régions","var(--zaut)"]];
const STATUTS = [
  ["etudier","À étudier"],["postuler","À postuler"],["envoyee","Candidature envoyée"],
  ["relance","Relancée"],["entretien","Entretien"],["acceptee","Acceptée"],["refus","Refusée"]
];
const STATUT_NOM = Object.fromEntries(STATUTS);
const GROUPE_DEFAUT = [
  {nom:"Étudiant·e MOD 1", parcours:"mod"}, {nom:"Étudiant·e MOD 2", parcours:"mod"}, {nom:"Étudiant·e MOD 3", parcours:"mod"},
  {nom:"Étudiant·e Retail", parcours:"retail"}, {nom:"Étudiant·e DCIB", parcours:"dcib"}
];

/* ---------- utilitaires ---------- */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmt = n => Number(n).toLocaleString("fr-FR");
const pct = (a, b) => b ? Math.round(100*a/b) + " %" : "0 %";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateFR = d => d ? d.split("-").reverse().join("/") : "";
const proche = o => o.zone === "Puy-de-Dôme" || o.zone === "Auvergne-Rhône-Alpes";
const remplacerURL = u => { try { history.replaceState(null, "", u); } catch(e){} };
const pills = o => Object.keys(P).filter(k => o[k]).map(k => `<span class="pill ${k}">${P[k].label}</span>`).join("");

function toast(msg){
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.setAttribute("role","status");
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}
function telecharger(nom, contenu, type){
  const url = URL.createObjectURL(new Blob([contenu], {type}));
  const a = document.createElement("a"); a.href = url; a.download = nom; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
function csv(lignes){
  return "﻿" + lignes.map(l => l.map(v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v; }).join(";")).join("\n");
}

/* ---------- stockage local ---------- */
const store = {
  get(k, def){ try { const v = localStorage.getItem("alternance." + k); return v ? JSON.parse(v) : def; } catch(e){ return def; } },
  set(k, v){ try { localStorage.setItem("alternance." + k, JSON.stringify(v)); return true; } catch(e){ toast("Impossible d'enregistrer dans ce navigateur."); return false; } }
};
const suivi = {
  all(){ return store.get("suivi", {}); },
  get(id){ return this.all()[id]; },
  save(id, patch){ const s = this.all(); s[id] = Object.assign({statut:"etudier", qui:"", note:""}, s[id], patch, {maj:new Date().toISOString().slice(0,10)}); store.set("suivi", s); majBadge(); return s[id]; },
  remove(id){ const s = this.all(); delete s[id]; store.set("suivi", s); majBadge(); },
  has(id){ return !!this.all()[id]; }
};
const groupe = () => store.get("groupe", GROUPE_DEFAUT);

/* ---------- en-tête commun ---------- */
function entete(){
  const page = document.body.dataset.page;
  const liens = [["index","index.html","Tableau de bord"],["offres","offres.html","Offres"],["suivi","suivi.html","Suivi du groupe"],["canaux","index.html#canaux","Canaux"],["analyse","index.html#analyse","Analyse (TD 1)"],["cm2","index.html#cm2","Hypothèses (CM 2)"],["methode","methode.html","Méthode"]];
  const h = document.createElement("div"); h.className = "top";
  h.innerHTML = `<div class="top-in">
    <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"><i style="background:var(--mod)"></i><i style="background:var(--retail)"></i><i style="background:var(--dcib)"></i></span>Alternances IAE</a>
    <nav class="nav" aria-label="Navigation principale">${liens.map(([k,href,l]) => `<a href="${href}"${k===page?' aria-current="page"':""}>${l}${k==="suivi"?'<span class="badge" id="badge" hidden></span>':""}</a>`).join("")}</nav>
    <span class="maj">Offres France Travail au <b class="num">${dateFR(D.maj)}</b></span></div>`;
  document.body.prepend(h);
  const f = document.createElement("footer"); f.className = "foot";
  f.innerHTML = `Données : <a href="https://github.com/vincentfavarin/metier" target="_blank" rel="noopener">vincentfavarin/metier</a> (API France Travail). Classement automatique par mots-clés : relisez chaque offre avant de postuler.`;
  document.body.appendChild(f);
  majBadge();
}
function majBadge(){
  const b = $("#badge"); if(!b) return;
  const n = Object.keys(suivi.all()).filter(id => PAR_ID[id]).length;
  b.textContent = n; b.hidden = !n;
}


/* ---------- canal Welcome to the Jungle (consulté en lien, aucune donnée collectée) ----------
   Le site de WTTJ ne lit pas la recherche dans l'adresse et demande un compte pour lister les offres :
   un clic copie la recherche prête à coller, puis ouvre WTTJ dans un nouvel onglet. */
const WTTJ_URL = "https://www.welcometothejungle.com/fr/jobs";
const WTTJ = {
  mod:    ["alternance marketing digital", "alternance chef de projet marketing digital", "alternance traffic manager", "alternance CRM", "alternance chargé d'acquisition", "alternance community manager"],
  retail: ["alternance retail", "alternance category manager", "alternance trade marketing", "alternance e-commerce", "alternance relation client"],
  dcib:   ["alternance business developer", "alternance commercial B2B", "alternance key account manager", "alternance export", "alternance international"]
};
async function copier(txt){
  try { await navigator.clipboard.writeText(txt); return true; } catch(e){
    try { const t = document.createElement("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch(e2){ return false; }
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-wttj]"); if(!b) return;
  e.preventDefault();
  const txt = b.dataset.wttj === "__offres" ? rechercheOffres() : b.dataset.wttj;
  window.open(WTTJ_URL, "_blank", "noopener");
  copier(txt).then(ok => toast(ok ? `Recherche copiée : « ${txt} ». Collez-la dans Welcome to the Jungle.` : `Recherche à taper dans Welcome to the Jungle : « ${txt} »`));
});
// Sur la page Offres : la recherche suit le filtre de parcours et le mot-clé saisis
function rechercheOffres(){
  const q = ($("#fq") && $("#fq").value.trim()) || "";
  const k = (new URLSearchParams(location.search)).get("parcours") || ($$("#ptabs .chip[aria-pressed='true']")[0] || {dataset:{}}).dataset.k || "";
  const base = q ? "alternance " + q : (WTTJ[k] ? WTTJ[k][0] : "alternance marketing");
  const z = $("#fzone") ? $("#fzone").value : "";
  const lieu = z === "Puy-de-Dôme" ? " Clermont-Ferrand" : z === "Île-de-France" ? " Paris" : z === "proche" ? " Lyon" : "";
  return base + lieu;
}
// Lien Indeed de la page Offres : recherche et lieu repris des filtres (Indeed lit ces paramètres dans l'adresse)
document.addEventListener("pointerdown", e => {
  const a = e.target.closest("#lien-indeed"); if(!a) return;
  const z = $("#fzone") ? $("#fzone").value : "", q = rechercheOffres().replace(/ (Clermont-Ferrand|Paris|Lyon)$/, "");
  const l = z === "Puy-de-Dôme" ? "Clermont-Ferrand (63)" : z === "Île-de-France" ? "Île-de-France" : z === "proche" ? "Auvergne-Rhône-Alpes" : "";
  a.href = "https://fr.indeed.com/jobs?q=" + encodeURIComponent(q).replace(/%20/g, "+") + (l ? "&l=" + encodeURIComponent(l).replace(/%20/g, "+") : "");
});
function blocCanaux(){
  const el = $("#canaux-wttj"); if(!el) return;
  el.innerHTML = Object.entries(P).map(([k,p]) => `<div class="canal-p"><span class="tag ${k}">${p.label}</span>
    <div class="chips">${WTTJ[k].map(q => `<button class="chip" type="button" data-wttj="${esc(q)}" title="Copier cette recherche et ouvrir Welcome to the Jungle">${esc(q.replace(/^alternance /, ""))}</button>`).join("")}</div></div>`).join("");
  const n = $("#canaux-ft"); if(n) n.textContent = fmt(OFFRES.length);
  const d = $("#canaux-date"); if(d) d.textContent = dateFR(D.maj);
}

/* ---------- graphiques SVG ---------- */
// Les graphiques sont dessinés à la largeur réelle de leur conteneur et redessinés quand la fenêtre change de taille.
const redessins = [];
let minuteur;
window.addEventListener("resize", () => { clearTimeout(minuteur); minuteur = setTimeout(() => redessins.forEach(f => f()), 120); });
const largeur = svg => Math.max(300, Math.round(svg.parentElement.getBoundingClientRect().width - 40) || 720);

function barresEmpilees(svg, lignes){
  // lignes : [{label, segments:[{n, c, nom}]}]
  const W = largeur(svg), rowH = 46, left = 64, right = 44, H = lignes.length*rowH + 8;
  const max = Math.max(1, ...lignes.map(l => l.segments.reduce((a,s)=>a+s.n,0)));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = lignes.map((l,i) => {
    const y = i*rowH + 8; let x = left, h = `<text x="0" y="${y+19}" font-size="15" font-weight="600">${esc(l.label)}</text>`;
    l.segments.forEach(s => {
      const w = (W-left-right)*s.n/max; if(!s.n) return;
      h += `<rect x="${x}" y="${y}" width="${Math.max(w,2)}" height="28" fill="${s.c}"><title>${esc(s.nom)} : ${s.n}</title></rect>`;
      if(w > 30) h += `<text x="${x+w/2}" y="${y+19}" font-size="13" text-anchor="middle" style="fill:${s.clair?"var(--ink)":"var(--bg)"}">${s.n}</text>`;
      x += w;
    });
    return h + `<text x="${x+8}" y="${y+19}" font-size="14" class="mut" font-family="ui-monospace, Menlo, monospace">${l.segments.reduce((a,s)=>a+s.n,0)}</text>`;
  }).join("");
}
function barresH(svg, data, couleur){
  const W = largeur(svg), rowH = 34, left = Math.round(Math.min(290, W*0.5)), H = data.length*rowH + 4, max = Math.max(1, ...data.map(d => d[1]));
  const car = Math.floor((left - 14) / 7.4);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = data.map(([lab,n],i) => {
    const y = i*rowH, w = (W-left-44)*n/max, c = lab.replace(/^(\S+) \/ \S+/, "$1"), l = c.length > car ? c.slice(0,car-1) + "…" : c;
    return `<text x="${left-10}" y="${y+19}" font-size="14" text-anchor="end"><title>${esc(lab)}</title>${esc(l)}</text>
      <rect x="${left}" y="${y+4}" width="${Math.max(w,2)}" height="22" rx="2" fill="${couleur}"></rect>
      <text x="${left+w+8}" y="${y+20}" font-size="14" class="mut" font-family="ui-monospace, Menlo, monospace">${n}</text>`;
  }).join("");
}
function compter(liste, cle){
  const c = {}; liste.forEach(o => { const k = typeof cle === "function" ? cle(o) : o[cle]; c[k] = (c[k]||0) + 1; });
  return Object.entries(c).sort((a,b) => b[1]-a[1]);
}

/* ---------- fiche détail (partagée) ---------- */
function ficheDetail(){
  let dlg = $("#fiche");
  if(dlg) return dlg;
  dlg = document.createElement("dialog"); dlg.id = "fiche";
  document.body.appendChild(dlg);
  dlg.addEventListener("click", e => { if(e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => { if(location.hash.startsWith("#o-")) remplacerURL(location.pathname + location.search); document.dispatchEvent(new CustomEvent("suivi-change")); });
  return dlg;
}
function ouvrirOffre(id){
  const o = PAR_ID[id]; if(!o) return;
  const dlg = ficheDetail(), s = suivi.get(id), membres = groupe();
  const faits = [
    ["Entreprise", o.entreprise], ["Lieu", o.lieu], ["Contrat", o.contrat + (o.duree ? " · " + o.duree : "")],
    ["Temps de travail", o.temps], ["Niveau demandé", o.niveau === "Bac+5" ? "Bac+5 / master mentionné" : o.niveau],
    ["Expérience", o.experience], ["Salaire", o.salaire || "Non indiqué"], ["Secteur", o.secteur],
    ["Taille de l'établissement", o.effectif], ["Publiée le", dateFR(o.date)], ["Télétravail", o.teletravail ? "Mentionné" : "Non mentionné"], ["Métier (ROME)", `${o.metier} (${o.rome})`]
  ].filter(f => f[1]);
  dlg.innerHTML = `<div class="dlg">
    <div class="dlg-head" style="position:relative">
      <button class="btn x" type="button" data-close aria-label="Fermer">Fermer</button>
      <div>${pills(o)}${o.exclusion ? `<span class="excl">Exclue : ${esc(o.exclusion)}</span>` : ""}</div>
      <h2 style="padding-right:90px">${esc(o.titre)}</h2>
      <p class="muted">${esc(o.entreprise)} · ${esc(o.lieu)}</p>
      <div class="chips"><a class="btn primary" href="${esc(o.url)}" target="_blank" rel="noopener">Voir l'annonce sur France Travail</a></div>
    </div>
    <div class="dlg-body">
      <div class="suivi-box">
        <h3>Suivi de la candidature</h3>
        <div class="row2">
          <label class="field" for="f-statut">Statut
            <select id="f-statut"><option value="">Non suivie</option>${STATUTS.map(([k,l]) => `<option value="${k}"${s&&s.statut===k?" selected":""}>${l}</option>`).join("")}</select></label>
          <label class="field" for="f-qui">Qui s'en occupe
            <select id="f-qui"><option value="">Personne</option>${membres.map(m => `<option${s&&s.qui===m.nom?" selected":""}>${esc(m.nom)}</option>`).join("")}</select></label>
        </div>
        <label for="f-note" class="field" style="display:grid">Notes
          <textarea id="f-note" placeholder="Contact, date de relance, impressions…">${esc(s ? s.note : "")}</textarea></label>
      </div>
      <dl class="facts">${faits.map(([k,v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      ${o.competences.length ? `<div class="stack"><h3>Compétences demandées</h3><div class="tags">${o.competences.map(c => `<span>${esc(c)}</span>`).join("")}</div></div>` : ""}
      ${o.avantages.length ? `<div class="stack"><h3>Avantages</h3><div class="tags">${o.avantages.map(c => `<span>${esc(c)}</span>`).join("")}</div></div>` : ""}
      <div class="stack"><h3>Description</h3><p class="desc">${esc(o.description)}</p></div>
    </div></div>`;
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());
  const enregistrer = () => {
    const statut = $("#f-statut", dlg).value, qui = $("#f-qui", dlg).value, note = $("#f-note", dlg).value;
    if(!statut && !qui && !note.trim()){ if(suivi.has(id)){ suivi.remove(id); toast("Offre retirée du suivi"); } return; }
    const neuf = !suivi.has(id);
    suivi.save(id, {statut: statut || "etudier", qui, note});
    if(!statut) $("#f-statut", dlg).value = "etudier";
    if(neuf) toast("Offre ajoutée au suivi du groupe");
  };
  $("#f-statut", dlg).addEventListener("change", enregistrer);
  $("#f-qui", dlg).addEventListener("change", enregistrer);
  $("#f-note", dlg).addEventListener("change", enregistrer);
  if(!dlg.open) dlg.showModal();
  $(".dlg-body", dlg).scrollTop = 0;
  remplacerURL("#o-" + id);
}

/* ======================================================
   Page : tableau de bord
   ====================================================== */
function pageAccueil(){
  $("#h-total").textContent = fmt(OFFRES.length);
  $("#h-actives").textContent = fmt(D.actives);

  // Entonnoir
  const e1 = OFFRES, e2 = e1.filter(o => o.employeur !== "École / CFA"), e3 = e2.filter(o => o.niveau !== "Bac+2/3"),
        e4 = e3.filter(o => o.exclusion !== "Poste de premier niveau"), e5 = e4.filter(o => o.adaptee);
  const etapes = [[e1,"Offres d'alternance actives",""],[e2,"Publiées par une entreprise","écoles et CFA retirés"],
    [e3,"Sans cible Bac+2/3","offres pour BTS, BUT ou bachelor retirées"],[e4,"Hors postes de premier niveau","SAV, vente, employé retirés"],
    [e5,"Correspondent à un parcours","offres sans rapport avec MOD, Retail ou DCIB retirées"]];
  $("#funnel").innerHTML = etapes.map(([s,l,d],i) =>
    (i ? `<div class="fdrop">− ${fmt(etapes[i-1][0].length - s.length)} · ${d}</div>` : "") +
    `<div class="fstep"><div><div class="flabel">${l}</div><div class="fbar${i===etapes.length-1?" last":""}"><span style="width:${(100*s.length/Math.max(1,e1.length)).toFixed(1)}%"></span></div></div><span class="num">${fmt(s.length)}</span></div>`).join("");
  const ec = OFFRES.filter(o => o.employeur === "École / CFA").length;
  $("#c-ecoles").textContent = fmt(ec); $("#c-ecoles-pct").textContent = pct(ec, OFFRES.length);
  $("#h-adaptees").textContent = fmt(ADAPTEES.length);

  // Cartes parcours
  const membres = groupe();
  $("#profiles").innerHTML = Object.entries(P).map(([k,p]) => {
    const s = ADAPTEES.filter(o => o[k]), qui = membres.filter(m => m.parcours === k).map(m => m.nom);
    return `<div class="prof">
      <div class="who"><span class="tag ${k}">${p.label}</span><span class="eyebrow">${qui.length} étudiant${qui.length>1?"s":""}</span></div>
      <h3>${p.nom}</h3>
      <div class="big num" style="color:${p.c}">${fmt(s.length)}<small>offres adaptées</small></div>
      <ul>
        <li><b>${s.filter(o => o.niveau === "Bac+5").length}</b> mentionnent Bac+5 ou master</li>
        <li><b>${s.filter(proche).length}</b> en Auvergne-Rhône-Alpes, dont <b>${s.filter(o => o.zone === "Puy-de-Dôme").length}</b> dans le Puy-de-Dôme</li>
        <li><b>${s.filter(o => o.zone === "Île-de-France").length}</b> en Île-de-France</li>
        <li><b>${s.filter(o => o.teletravail).length}</b> évoquent le télétravail</li>
      </ul>
      <p class="muted" style="font-size:13.5px">${qui.map(esc).join(", ")}</p>
      <a class="go" href="offres.html?parcours=${k}">Voir les ${fmt(s.length)} offres →</a>
      <a class="go wttj" href="${WTTJ_URL}" data-wttj="${esc(WTTJ[k][0])}">Chercher aussi sur Welcome to the Jungle ↗</a></div>`;
  }).join("");

  // Zones
  const zones = () => barresEmpilees($("#zones"), Object.entries(P).map(([k,p]) => ({label:p.label,
    segments: ZONES.map(([z,c],i) => ({nom:z, c, n: ADAPTEES.filter(o => o[k] && o.zone === z).length, clair: i >= 2}))})));
  zones(); redessins.push(zones);
  const pr = ADAPTEES.filter(proche).length;
  $("#zones-cap").innerHTML = `À lire : sur <b>${fmt(ADAPTEES.length)}</b> offres adaptées, <b>${ADAPTEES.filter(o => o.zone === "Puy-de-Dôme").length}</b> sont dans le Puy-de-Dôme et <b>${pr}</b> dans toute la région Auvergne-Rhône-Alpes (${pct(pr, ADAPTEES.length)}). L'Île-de-France en compte <b>${ADAPTEES.filter(o => o.zone === "Île-de-France").length}</b>.`;

  // Métiers + priorités, par parcours
  let sel = "mod";
  const dessiner = () => {
    const s = ADAPTEES.filter(o => o[sel]), top = compter(s, "metier").slice(0,8);
    barresH($("#metiers"), top, P[sel].c);
    $("#metiers-cap").innerHTML = top.length ? `À lire : <b>${esc(top[0][0])}</b> est le métier le plus proposé en ${P[sel].label}, avec <b>${top[0][1]}</b> offres sur ${s.length} (${pct(top[0][1], s.length)}).` : "Aucune offre.";
    $("#picks-title").textContent = `À regarder en priorité · ${P[sel].label}`;
    $("#picks").innerHTML = s.slice(0,6).map(o => `<a class="pick" href="offres.html#o-${o.id}"><span class="t">${esc(o.titre)}</span><span class="s">${esc(o.entreprise)} · ${esc(o.lieu)}${o.niveau==="Bac+5"?" · Bac+5":""}</span><span class="num">${dateFR(o.date)}</span></a>`).join("") || `<p class="muted">Aucune offre.</p>`;
    $$("#mtabs .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === sel));
  };
  $("#mtabs").innerHTML = Object.entries(P).map(([k,p]) => `<button class="chip" type="button" data-k="${k}">${p.label}</button>`).join("");
  $("#mtabs").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ sel = b.dataset.k; dessiner(); } });
  dessiner(); redessins.push(dessiner);

  // Employeurs
  const emp = compter(OFFRES, "employeur"), employeurs = () => barresH($("#employeurs"), emp, "var(--ink)");
  employeurs(); redessins.push(employeurs);
  const ecoles = compter(OFFRES.filter(o => o.employeur === "École / CFA" && o.entreprise !== "Entreprise non communiquée"), "entreprise").slice(0,3).map(([n,c]) => `${esc(n)} (${c})`).join(", ");
  $("#employeurs-cap").innerHTML = `À lire : <b>${pct(ec, OFFRES.length)}</b> des offres d'alternance viennent d'écoles ou de CFA. Les plus actifs sont ${ecoles}.`;
}

/* ======================================================
   Page : offres
   ====================================================== */
function pageOffres(){
  const params = new URLSearchParams(location.search);
  const etat = { parcours: P[params.get("parcours")] ? params.get("parcours") : "", limite: 50 };
  const tabs = [["","Tous"], ...Object.entries(P).map(([k,p]) => [k,p.label])];
  $("#ptabs").innerHTML = tabs.map(([k,l]) => `<button class="chip" type="button" data-k="${k}">${l}</button>`).join("");
  $("#ptabs").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ etat.parcours = b.dataset.k; etat.limite = 50; dessiner(); } });
  ["fzone","fbac5","ftt","fexcl","fsuivi","ftri"].forEach(id => $("#"+id).addEventListener("change", () => { etat.limite = 50; dessiner(); }));
  $("#fq").addEventListener("input", () => { etat.limite = 50; dessiner(); });
  $("#more").addEventListener("click", () => { etat.limite += 50; dessiner(); });
  $("#reset").addEventListener("click", () => {
    etat.parcours = ""; $("#fzone").value = ""; ["fbac5","ftt","fexcl","fsuivi"].forEach(id => $("#"+id).checked = false); $("#fq").value = ""; $("#ftri").value = "pertinence"; dessiner();
  });

  function filtrer(){
    const z = $("#fzone").value, b5 = $("#fbac5").checked, tt = $("#ftt").checked, ex = $("#fexcl").checked, sv = $("#fsuivi").checked;
    const q = $("#fq").value.trim().toLowerCase(), s = suivi.all();
    let l = (ex ? OFFRES : ADAPTEES).filter(o =>
      (!etat.parcours || o[etat.parcours]) &&
      (!z || (z === "proche" ? proche(o) : o.zone === z)) &&
      (!b5 || o.niveau === "Bac+5") && (!tt || o.teletravail) && (!sv || s[o.id]) &&
      (!q || [o.titre, o.entreprise, o.lieu, o.metier, o.appellation, o.secteur, o.competences.join(" "), o.description].join(" ").toLowerCase().includes(q)));
    const tri = $("#ftri").value;
    if(tri === "date") l = l.slice().sort((a,b) => b.date.localeCompare(a.date));
    else if(tri === "lieu") l = l.slice().sort((a,b) => (proche(b) - proche(a)) || (b.zone === "Puy-de-Dôme") - (a.zone === "Puy-de-Dôme") || b.score - a.score);
    else l = l.slice().sort((a,b) => (a.adaptee === b.adaptee ? 0 : b.adaptee - a.adaptee) || b.score - a.score || b.date.localeCompare(a.date));
    return l;
  }
  function dessiner(){
    const l = filtrer(), s = suivi.all(), ex = $("#fexcl").checked;
    $("#count").textContent = `${fmt(l.length)} offre${l.length > 1 ? "s" : ""}` + (l.length > etat.limite ? ` · ${etat.limite} affichées` : "");
    $("#tbody").innerHTML = l.slice(0, etat.limite).map(o => {
      const st = s[o.id];
      return `<tr class="row" data-id="${o.id}">
        <td><button class="star" type="button" data-star="${o.id}" aria-pressed="${!!st}" aria-label="${st ? "Retirer du suivi" : "Ajouter au suivi"}" title="${st ? "Retirer du suivi" : "Ajouter au suivi"}">★</button></td>
        <td><div class="t">${esc(o.titre)}</div><div class="s">${esc(o.entreprise)} · ${esc(o.metier)}</div>${ex && o.exclusion ? `<div class="excl">Exclue : ${esc(o.exclusion)}</div>` : ""}</td>
        <td>${pills(o)}</td>
        <td>${esc(o.lieu)}</td>
        <td class="lvl ${o.niveau === "Bac+5" ? "ok" : ""}">${o.niveau === "Bac+5" ? "Bac+5 / master" : esc(o.niveau)}</td>
        <td class="num" style="font-size:13px">${dateFR(o.date)}</td>
        <td>${st ? `<span class="status s-${st.statut}">${STATUT_NOM[st.statut] || ""}</span>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="7" class="empty">Aucune offre ne correspond à ces filtres. Élargissez la zone ou retirez un critère.</td></tr>`;
    $("#more").hidden = l.length <= etat.limite;
    $$("#ptabs .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === etat.parcours));
    const url = etat.parcours ? `?parcours=${etat.parcours}` : location.pathname.split("/").pop();
    remplacerURL(url + location.hash);
  }
  $("#tbody").addEventListener("click", e => {
    const star = e.target.closest("[data-star]");
    if(star){ const id = star.dataset.star; if(suivi.has(id)){ suivi.remove(id); toast("Offre retirée du suivi"); } else { suivi.save(id, {}); toast("Offre ajoutée au suivi du groupe"); } dessiner(); return; }
    const tr = e.target.closest("tr.row"); if(tr) ouvrirOffre(tr.dataset.id);
  });
  $("#export").addEventListener("click", () => {
    const l = filtrer(), s = suivi.all();
    telecharger(`offres-alternance-${D.maj}.csv`, csv([
      ["Titre","Entreprise","Métier","Lieu","Zone","Parcours","Niveau","Contrat","Télétravail","Salaire","Publiée le","Statut","Qui","Lien"],
      ...l.map(o => [o.titre, o.entreprise, o.metier, o.lieu, o.zone, Object.keys(P).filter(k => o[k]).map(k => P[k].label).join(" + "), o.niveau, o.contrat, o.teletravail ? "oui" : "", o.salaire, dateFR(o.date), s[o.id] ? STATUT_NOM[s[o.id].statut] : "", s[o.id] ? s[o.id].qui : "", o.url])
    ]), "text/csv;charset=utf-8");
  });
  document.addEventListener("suivi-change", dessiner);
  dessiner();
  const h = location.hash.match(/^#o-(\w+)/); if(h) ouvrirOffre(h[1]);
}

/* ======================================================
   Page : suivi du groupe
   ====================================================== */
function pageSuivi(){
  function dessinerMembres(){
    const m = groupe();
    $("#members").innerHTML = m.map((x,i) => `<div class="member">
      <input type="text" id="m-nom-${i}" value="${esc(x.nom)}" aria-label="Nom du membre ${i+1}">
      <select id="m-par-${i}" aria-label="Parcours du membre ${i+1}">${Object.entries(P).map(([k,p]) => `<option value="${k}"${x.parcours===k?" selected":""}>${p.label}</option>`).join("")}</select></div>`).join("");
  }
  $("#members").addEventListener("change", () => {
    const ancien = groupe();
    const m = ancien.map((x,i) => ({nom: $("#m-nom-"+i).value.trim() || x.nom, parcours: $("#m-par-"+i).value}));
    // Reporte un changement de nom sur les offres déjà attribuées
    const s = suivi.all(); let modif = false;
    ancien.forEach((x,i) => { if(x.nom !== m[i].nom) Object.values(s).forEach(v => { if(v.qui === x.nom){ v.qui = m[i].nom; modif = true; } }); });
    if(modif) store.set("suivi", s);
    store.set("groupe", m); toast("Groupe enregistré"); dessiner();
  });

  function dessiner(){
    const s = suivi.all(), ids = Object.keys(s).filter(id => PAR_ID[id]), m = groupe();
    const qui = $("#fqui").value;
    $("#fqui").innerHTML = `<option value="">Tout le groupe</option><option value="__personne"${qui==="__personne"?" selected":""}>Non attribuées</option>` + m.map(x => `<option${qui===x.nom?" selected":""}>${esc(x.nom)}</option>`).join("");
    const liste = ids.filter(id => !qui || (qui === "__personne" ? !s[id].qui : s[id].qui === qui));
    $("#kpis").innerHTML = `<div class="kpi"><b class="num">${liste.length}</b><span>offres suivies</span></div>` +
      STATUTS.map(([k,l]) => `<div class="kpi"><b class="num">${liste.filter(id => s[id].statut === k).length}</b><span>${l}</span></div>`).join("");
    const ordre = Object.fromEntries(STATUTS.map(([k],i) => [k,i]));
    liste.sort((a,b) => (ordre[s[a].statut] - ordre[s[b].statut]) || (s[b].maj || "").localeCompare(s[a].maj || ""));
    $("#tbody").innerHTML = liste.map(id => { const o = PAR_ID[id], v = s[id]; return `<tr class="row" data-id="${id}">
      <td><div class="t">${esc(o.titre)}</div><div class="s">${esc(o.entreprise)} · ${esc(o.lieu)}</div>${v.note ? `<div class="s" style="margin-top:4px">📝 ${esc(v.note.length > 90 ? v.note.slice(0,89) + "…" : v.note)}</div>` : ""}</td>
      <td>${pills(o)}</td>
      <td><select data-statut="${id}" aria-label="Statut">${STATUTS.map(([k,l]) => `<option value="${k}"${v.statut===k?" selected":""}>${l}</option>`).join("")}</select></td>
      <td><select data-qui="${id}" aria-label="Qui s'en occupe"><option value="">Personne</option>${m.map(x => `<option${v.qui===x.nom?" selected":""}>${esc(x.nom)}</option>`).join("")}</select></td>
      <td class="num" style="font-size:13px">${dateFR(v.maj)}</td></tr>`; }).join("")
      || `<tr><td colspan="5" class="empty">Aucune offre suivie pour l'instant. Dans la page <a href="offres.html">Offres</a>, cliquez sur ★ ou ouvrez une offre pour lui donner un statut.</td></tr>`;
    const perdus = Object.keys(s).length - ids.length;
    $("#perdus").hidden = !perdus;
    $("#perdus").textContent = `${perdus} offre${perdus>1?"s":""} suivie${perdus>1?"s":""} ne figure${perdus>1?"nt":""} plus dans les données : elle${perdus>1?"s ont":" a"} sans doute été pourvue${perdus>1?"s":""} ou retirée${perdus>1?"s":""} de France Travail. ${perdus>1?"Elles restent":"Elle reste"} dans la sauvegarde.`;
  }
  $("#fqui").addEventListener("change", dessiner);
  $("#tbody").addEventListener("change", e => {
    const t = e.target;
    if(t.dataset.statut){ suivi.save(t.dataset.statut, {statut: t.value}); dessiner(); }
    if(t.dataset.qui !== undefined){ suivi.save(t.dataset.qui, {qui: t.value}); dessiner(); }
  });
  $("#tbody").addEventListener("click", e => { if(e.target.closest("select")) return; const tr = e.target.closest("tr.row"); if(tr) ouvrirOffre(tr.dataset.id); });
  document.addEventListener("suivi-change", dessiner);

  // Partage : export / import
  $("#exp-json").addEventListener("click", () => {
    telecharger(`suivi-alternance-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({version:1, groupe: groupe(), suivi: suivi.all()}, null, 2), "application/json");
  });
  $("#exp-csv").addEventListener("click", () => {
    const s = suivi.all();
    telecharger(`suivi-alternance-${new Date().toISOString().slice(0,10)}.csv`, csv([
      ["Titre","Entreprise","Lieu","Parcours","Statut","Qui","Notes","Mis à jour","Lien"],
      ...Object.keys(s).filter(id => PAR_ID[id]).map(id => { const o = PAR_ID[id], v = s[id]; return [o.titre, o.entreprise, o.lieu, Object.keys(P).filter(k => o[k]).map(k => P[k].label).join(" + "), STATUT_NOM[v.statut], v.qui, v.note, dateFR(v.maj), o.url]; })
    ]), "text/csv;charset=utf-8");
  });
  $("#imp-file").addEventListener("change", e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result); if(!d.suivi) throw new Error();
        const s = suivi.all(); let n = 0;
        Object.entries(d.suivi).forEach(([id,v]) => { if(!s[id] || (v.maj || "") >= (s[id].maj || "")){ s[id] = v; n++; } });
        store.set("suivi", s);
        if(d.groupe && $("#imp-groupe").checked) store.set("groupe", d.groupe);
        dessinerMembres(); dessiner(); majBadge();
        toast(`${n} offre${n>1?"s":""} fusionnée${n>1?"s":""} dans le suivi`);
      } catch(err){ toast("Ce fichier n'est pas une sauvegarde de suivi valide."); }
      e.target.value = "";
    };
    r.readAsText(f);
  });
  $("#vider").addEventListener("click", () => {
    const b = $("#vider");
    if(b.dataset.confirm){ store.set("suivi", {}); delete b.dataset.confirm; b.textContent = "Vider le suivi"; dessiner(); majBadge(); toast("Suivi vidé"); }
    else { b.dataset.confirm = "1"; b.textContent = "Confirmer : tout effacer ?"; setTimeout(() => { delete b.dataset.confirm; b.textContent = "Vider le suivi"; }, 4000); }
  });

  dessinerMembres(); dessiner();
  const h = location.hash.match(/^#o-(\w+)/); if(h) ouvrirOffre(h[1]);
}

/* ---------- démarrage ---------- */
document.addEventListener("DOMContentLoaded", () => {
  entete();
  blocCanaux();
  if(!OFFRES.length){
    $(".wrap").insertAdjacentHTML("afterbegin", `<div class="callout"><strong>Données absentes.</strong> Le fichier data/offres.js est introuvable ou vide. Lancez <code>bash scripts/mettre_a_jour.sh</code> depuis le dossier du site.</div>`);
    return;
  }
  const page = document.body.dataset.page;
  if(page === "index") pageAccueil();
  if(page === "offres") pageOffres();
  if(page === "suivi") pageSuivi();
  if(page === "methode"){ $$("[data-v]").forEach(el => { const k = el.dataset.v; el.textContent = k === "maj" ? dateFR(D.maj) : fmt(D[k]); }); }
});
})();
