/* Alternances IAE — page Analyse univariée (TD 1).
   Tout est recalculé depuis data/offres.js : les graphiques et les phrases de lecture suivent les mises à jour. */
(function(){
"use strict";
document.addEventListener("DOMContentLoaded", init);

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (n, d=0) => Number(n).toLocaleString("fr-FR", {minimumFractionDigits:d, maximumFractionDigits:d});
const eur = n => fmt(Math.round(n)) + " €";
const pct = (a, b) => { if(!b) return "0 %"; const p = 100*a/b; return (p > 0 && p < 1 ? "< 1" : fmt(Math.round(p))) + " %"; };
const dateFR = d => d ? d.split("-").reverse().join("/") : "";
const dateLong = d => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"});

/* ---------- statistiques (formules d'Excel) ---------- */
const somme = v => v.reduce((a,b) => a+b, 0);
const moyenne = v => somme(v) / v.length;
function quantile(v, p){ // QUARTILE.INCLURE
  const s = v.slice().sort((a,b) => a-b), h = (s.length-1)*p, lo = Math.floor(h);
  return s[lo] + (h-lo)*((s[lo+1] ?? s[lo]) - s[lo]);
}
const mediane = v => quantile(v, .5);
function ecartType(v){ const m = moyenne(v); return Math.sqrt(somme(v.map(x => (x-m)**2)) / (v.length-1)); } // ECARTYPE
function asymetrie(v){ const n = v.length, m = moyenne(v), s = ecartType(v); return n/((n-1)*(n-2)) * somme(v.map(x => ((x-m)/s)**3)); }
function aplatissement(v){ // KURTOSIS (en excès : 0 pour une loi normale)
  const n = v.length, m = moyenne(v), s = ecartType(v);
  return n*(n+1)/((n-1)*(n-2)*(n-3)) * somme(v.map(x => ((x-m)/s)**4)) - 3*(n-1)**2/((n-2)*(n-3));
}
function resume(v){
  if(!v.length) return null;
  const s = v.slice().sort((a,b) => a-b), q1 = quantile(s,.25), q3 = quantile(s,.75), m = moyenne(s), et = s.length > 1 ? ecartType(s) : 0;
  return {n:s.length, min:s[0], q1, med:quantile(s,.5), q3, max:s[s.length-1], moy:m, et, eiq:q3-q1, cv: m ? et/m : 0};
}

/* ---------- recodages ---------- */
// Salaire : texte libre -> montant mensuel brut minimum
function salaire(o){
  const t = o.salaire || "";
  if(!t) return {etat:"vide"};
  const m = /^(Mensuel|Annuel|Horaire) de ([\d.]+) Euros/.exec(t);
  if(!m) return {etat:"illisible"};
  const v = parseFloat(m[2]);
  if(m[1] === "Mensuel") return {etat:"mensuel", v};
  if(m[1] === "Horaire") return {etat:"horaire", v: v*151.67};
  if(v < 3000) return {etat:"annuel suspect", v};      // « Annuel de 486 € » : c'est un montant mensuel mal étiqueté
  return {etat:"annuel", v: v/12};
}
// Expérience : 13 libellés bruts -> une échelle ordonnée
const EXP_ORDRE = ["Débutant accepté","Moins d'un an","1 an","2 ans","3 ans","4 ans","5 ans","6 ans et plus","Exigée, sans durée"];
function experience(o){
  const t = (o.experience || "").trim();
  if(/^débutant/i.test(t)) return "Débutant accepté";
  const m = /^(\d+)\s*(An|Mois)/i.exec(t);
  if(m){
    const ans = /mois/i.test(m[2]) ? +m[1]/12 : +m[1];
    if(ans === 0) return "Débutant accepté";
    if(ans < 1) return "Moins d'un an";
    if(ans >= 6) return "6 ans et plus";
    return Math.round(ans) + (Math.round(ans) > 1 ? " ans" : " an");
  }
  return "Exigée, sans durée";
}
const dureeMois = o => { const m = /(\d+)\s*Mois/i.exec(o.duree || ""); return m ? +m[1] : null; };
function lundi(d){ const x = new Date(d + "T12:00:00"); const j = (x.getDay()+6)%7; x.setDate(x.getDate()-j); return x.toISOString().slice(0,10); }

/* ---------- infobulle commune ---------- */
let tip;
function infobulles(){
  tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener("mousemove", e => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if(!el){ tip.hidden = true; return; }
    tip.innerHTML = el.dataset.tip; tip.hidden = false;
    const r = tip.getBoundingClientRect(), x = Math.min(e.clientX + 14, innerWidth - r.width - 8), y = e.clientY - r.height - 12;
    tip.style.left = x + "px"; tip.style.top = (y < 8 ? e.clientY + 18 : y) + "px";
  });
}

/* ---------- graphiques SVG ---------- */
const redessins = [];
let minuteur;
window.addEventListener("resize", () => { clearTimeout(minuteur); minuteur = setTimeout(() => redessins.forEach(f => f()), 120); });
const largeur = svg => Math.max(300, Math.round(svg.parentElement.getBoundingClientRect().width - 40) || 720);
function dessine(f){ f(); redessins.push(f); }
const pasAxe = max => { const brut = max/5, p = 10**Math.floor(Math.log10(brut || 1)); return [1,2,2.5,5,10].map(k => k*p).find(k => k >= brut) || p; };

// Barres horizontales « n (x %) ». rows : [{label, n, muted, note}]
function barres(svg, rows, total, opt={}){
  const W = largeur(svg), rowH = 30, left = Math.round(Math.min(opt.left || 210, W*0.45)), right = 92, H = rows.length*rowH + 2;
  const max = Math.max(1, ...rows.map(r => r.n));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = rows.map((r,i) => {
    const y = i*rowH, w = Math.max(r.n ? 3 : 0, (W-left-right)*r.n/max), tipTxt = `<b>${esc(r.label)}</b><br>${fmt(r.n)} offres · ${pct(r.n,total)}${r.note ? "<br>" + esc(r.note) : ""}`;
    return `<g data-tip="${esc(tipTxt)}">
      <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"></rect>
      <text x="${left-10}" y="${y+19}" font-size="13.5" text-anchor="end">${esc(r.label)}</text>
      <rect x="${left}" y="${y+6}" width="${w}" height="18" rx="4" fill="${r.muted ? "var(--zaut)" : (opt.c || "var(--mod)")}"></rect>
      <text x="${left+w+8}" y="${y+19}" font-size="13" class="mut" font-family="var(--mono)">${fmt(r.n)} (${pct(r.n,total)})</text></g>`;
  }).join("");
}

// Histogramme avec repères (médiane, moyenne), mode mis en avant, courbe normale en option
function histogramme(svg, vals, o){
  const W = largeur(svg), H = o.reperes ? 280 : 250, l = 44, r = 16, t = o.reperes ? 46 : 16, b = 34;
  const cap = o.cap, bw = o.binw, nb = Math.ceil(cap/bw);
  const bins = Array.from({length:nb}, (_,i) => ({a:i*bw, b:(i+1)*bw, n:0}));
  vals.forEach(v => { if(v < cap) bins[Math.min(nb-1, Math.floor(v/bw))].n++; });
  let ymax = Math.max(...bins.map(x => x.n));
  const pdf = x => Math.exp(-((x-o.moy)**2)/(2*o.et**2)) / (o.et*Math.sqrt(2*Math.PI));
  if(o.normal) ymax = Math.max(ymax, vals.length*bw*pdf(o.moy));
  const pas = pasAxe(ymax); ymax = Math.ceil(ymax/pas)*pas;
  const X = x => l + (W-l-r)*x/cap, Y = n => t + (H-t-b)*(1 - n/ymax);
  const mode = bins.reduce((a,x) => x.n > a.n ? x : a, bins[0]);
  let h = "";
  for(let g = 0; g <= ymax; g += pas) h += `<line x1="${l}" x2="${W-r}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)" stroke-width="1"></line><text x="${l-8}" y="${Y(g)+4}" font-size="12" text-anchor="end" class="mut" font-family="var(--mono)">${g}</text>`;
  const tx = cap <= 3000 ? 500 : 1000;
  for(let x = 0; x <= cap; x += tx) h += `<text x="${X(x)}" y="${H-12}" font-size="12" text-anchor="middle" class="mut" font-family="var(--mono)">${fmt(x)}</text>`;
  bins.forEach(x => {
    if(!x.n) return;
    const est = x === mode && o.mode;
    h += `<g data-tip="${esc(`<b>${fmt(x.a)} à ${fmt(x.b)} €</b><br>${x.n} offre${x.n>1?"s":""} · ${pct(x.n, vals.length)}${est ? "<br>classe modale" : ""}`)}">
      <rect x="${X(x.a)}" y="${t}" width="${X(x.b)-X(x.a)}" height="${H-t-b}" fill="transparent"></rect>
      <rect x="${X(x.a)+1}" y="${Y(x.n)}" width="${Math.max(1, X(x.b)-X(x.a)-2)}" height="${Y(0)-Y(x.n)}" rx="3" fill="${est ? "var(--mod)" : "var(--zidf)"}"></rect></g>`;
  });
  h += `<line x1="${l}" x2="${W-r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-width="1"></line>`;
  if(o.normal){
    let d = ""; for(let i = 0; i <= 120; i++){ const x = cap*i/120; d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(vals.length*bw*pdf(x)).toFixed(1); }
    h += `<path d="${d}" fill="none" stroke="var(--dcib)" stroke-width="2"></path>`;
  }
  if(o.reperes){
    const xm = X(o.med), xy = X(o.moy), proche = Math.abs(xm-xy) < 120;
    h += `<line x1="${xm}" x2="${xm}" y1="${t-26}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="2"></line>
      <text x="${xm-6}" y="${t-30}" font-size="13" text-anchor="end" font-weight="600">médiane ${eur(o.med)}</text>
      <line x1="${xy}" x2="${xy}" y1="${t-8}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 3"></line>
      <text x="${xy+6}" y="${proche ? t-2 : t-12}" font-size="13">moyenne ${eur(o.moy)}</text>`;
    if(o.mode) h += `<text x="${Math.min(W-r-4, X(mode.b)+6)}" y="${Math.max(t+14, Y(mode.n)+14)}" font-size="12" class="mut" text-anchor="${X(mode.b)+140 > W ? "end" : "start"}">mode : ${fmt(mode.a)} à ${fmt(mode.b)} €</text>`;
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = h;
  return mode;
}

// Boîtes à moustaches horizontales, échelle commune
function boites(svg, groupes, cap){
  const W = largeur(svg), l = Math.min(200, W*.36), r = 20, rowH = 64, H = groupes.length*rowH + 34;
  const X = x => l + (W-l-r)*Math.min(x,cap)/cap;
  let h = "";
  const tx = cap <= 3000 ? 500 : 1000;
  for(let x = 0; x <= cap; x += tx) h += `<line x1="${X(x)}" x2="${X(x)}" y1="4" y2="${H-26}" stroke="var(--line)"></line><text x="${X(x)}" y="${H-8}" font-size="12" text-anchor="middle" class="mut" font-family="var(--mono)">${fmt(x)}</text>`;
  groupes.forEach((g,i) => {
    const s = resume(g.v), y = 10 + i*rowH, c = y + 20;
    if(!s) return;
    const lo = Math.min(...g.v.filter(x => x >= s.q1 - 1.5*s.eiq)), hi = Math.max(...g.v.filter(x => x <= s.q3 + 1.5*s.eiq));
    const horsNorme = g.v.filter(x => x < lo || x > hi);
    const tipTxt = `<b>${esc(g.label)}</b> · ${s.n} offres<br>Q1 ${eur(s.q1)} · médiane ${eur(s.med)} · Q3 ${eur(s.q3)}<br>moustaches ${eur(lo)} à ${eur(hi)}`;
    h += `<g data-tip="${esc(tipTxt)}"><rect x="0" y="${y-4}" width="${W}" height="${rowH-8}" fill="transparent"></rect>
      <text x="${l-12}" y="${c-2}" font-size="14" font-weight="600" text-anchor="end">${esc(g.label)}</text>
      <text x="${l-12}" y="${c+15}" font-size="12" text-anchor="end" class="mut">${s.n} offres${s.n < 30 ? " · effectif faible" : ""}</text>
      <line x1="${X(lo)}" x2="${X(hi)}" y1="${c}" y2="${c}" stroke="var(--muted)" stroke-width="2"></line>
      <line x1="${X(lo)}" x2="${X(lo)}" y1="${c-8}" y2="${c+8}" stroke="var(--muted)" stroke-width="2"></line>
      <line x1="${X(hi)}" x2="${X(hi)}" y1="${c-8}" y2="${c+8}" stroke="var(--muted)" stroke-width="2"></line>
      <rect x="${X(s.q1)}" y="${c-14}" width="${Math.max(2, X(s.q3)-X(s.q1))}" height="28" rx="4" fill="var(--zidf)" stroke="var(--mod)" stroke-width="1.5"></rect>
      <line x1="${X(s.med)}" x2="${X(s.med)}" y1="${c-14}" y2="${c+14}" stroke="var(--ink)" stroke-width="3"></line>
      ${horsNorme.map(x => `<circle cx="${X(x)}" cy="${c}" r="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"></circle>`).join("")}</g>`;
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = h;
}

// Courbe : points [{x, label, n, partiel}]
function courbe(svg, pts){
  const W = largeur(svg), H = 260, l = 44, r = 26, t = 30, b = 34;
  let ymax = Math.max(...pts.map(p => p.n)); const pas = pasAxe(ymax); ymax = Math.ceil(ymax*1.12/pas)*pas;
  const X = i => l + (W-l-r)*i/Math.max(1, pts.length-1), Y = n => t + (H-t-b)*(1 - n/ymax);
  let h = "";
  for(let g = 0; g <= ymax; g += pas) h += `<line x1="${l}" x2="${W-r}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)"></line><text x="${l-8}" y="${Y(g)+4}" font-size="12" text-anchor="end" class="mut" font-family="var(--mono)">${g}</text>`;
  const chaque = Math.ceil(pts.length / Math.max(2, Math.floor((W-l-r)/64)));
  pts.forEach((p,i) => { if(i % chaque === 0 || i === pts.length-1) h += `<text x="${X(i)}" y="${H-12}" font-size="12" text-anchor="middle" class="mut" font-family="var(--mono)">${p.label}</text>`; });
  const plein = pts.filter(p => !p.partiel);
  h += `<path d="${plein.map((p,i) => (i ? "L" : "M") + X(i) + " " + Y(p.n)).join("")}" fill="none" stroke="var(--mod)" stroke-width="2" stroke-linejoin="round"></path>`;
  if(pts.length > 1 && pts[pts.length-1].partiel){ const i = pts.length-1; h += `<path d="M${X(i-1)} ${Y(pts[i-1].n)}L${X(i)} ${Y(pts[i].n)}" fill="none" stroke="var(--mod)" stroke-width="2" stroke-dasharray="4 4"></path>`; }
  const imax = pts.reduce((a,p,i) => p.n > pts[a].n ? i : a, 0);
  pts.forEach((p,i) => {
    h += `<g data-tip="${esc(`<b>Semaine du ${p.label}</b><br>${p.n} offres encore actives${p.partiel ? "<br>semaine incomplète" : ""}`)}">
      <rect x="${X(i)-12}" y="${t}" width="24" height="${H-t-b}" fill="transparent"></rect>
      <circle cx="${X(i)}" cy="${Y(p.n)}" r="4.5" fill="${p.partiel ? "var(--surface)" : "var(--mod)"}" stroke="${p.partiel ? "var(--mod)" : "var(--surface)"}" stroke-width="2"></circle></g>`;
    if(i === imax || i === pts.length-1) h += `<text x="${X(i)}" y="${Y(p.n)-12}" font-size="13" font-weight="600" text-anchor="${i === pts.length-1 ? "end" : "middle"}">${p.n}</text>`;
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = h;
}

window.AIAE = {esc, fmt, eur, pct, dateLong, salaire, moyenne, ecartType, quantile, mediane, largeur, dessine, barres, pasAxe};

/* ======================================================
   Page
   ====================================================== */
function init(){
  if(!document.getElementById("natures")) return;
  const D = window.DATA || {offres:[]}, O = D.offres, N = O.length;
  if(!N) return;
  infobulles();
  const source = `Données : dépôt metier (API France Travail), offres d'alternance actives au ${dateLong(D.maj)}.`;
  document.querySelectorAll("[data-v]").forEach(el => { el.textContent = el.dataset.v === "maj" ? dateLong(D.maj) : fmt(N); });

  // Salaires
  const SAL = O.map(o => Object.assign({o}, salaire(o)));
  const SV = SAL.filter(s => s.v != null), V = SV.map(s => s.v), R = resume(V);
  const etat = k => SAL.filter(s => s.etat === k).length;

  /* ---- 1. Nature des variables ---- */
  const exemple = (k, f) => { const o = O.find(o => (f ? f(o) : o[k])); return o ? (f ? f(o) : o[k]) : ""; };
  $("#natures").innerHTML = [
    ["Qualitative nominale", "type de contrat", "Contrat apprentissage, Cont. professionnalisation", "effectifs, fréquences, mode", "diagramme en barres"],
    ["Qualitative ordinale", "expérience demandée", "Débutant accepté < 1 an < 2 ans…", "fréquences, médiane", "barres, dans l'ordre"],
    ["Quantitative", "salaire mensuel brut", `${eur(R.min)} à ${eur(R.max)}`, "moyenne, médiane, écart-type, quartiles", "histogramme, boîte à moustaches"],
    ["Date", "date de publication", `${dateFR(O.reduce((a,o) => o.date < a ? o.date : a, O[0].date))} au ${dateFR(D.maj)}`, "effectifs par semaine", "courbe"]
  ].map(([nat, ex, val, res, gr]) => `<div class="nat"><h3>${nat}</h3><dl><dt>exemple</dt><dd>${ex}<small>${esc(val)}</small></dd><dt>résumé</dt><dd>${res}</dd><dt>graphique</dt><dd>${gr}</dd></dl></div>`).join("");

  const rempli = f => O.filter(f).length;
  const nonVide = k => o => Array.isArray(o[k]) ? o[k].length > 0 : String(o[k] ?? "").trim() !== "";
  const DICT = [
    ["titre", "Texte libre", nonVide("titre"), "—", "—"],
    ["entreprise", "Qualitative nominale", o => o.entreprise !== "Entreprise non communiquée", "effectifs (les plus fréquentes)", "barres"],
    ["employeur", "Qualitative nominale", nonVide("employeur"), "effectifs, fréquences", "barres", "Type d'annonceur, construit par notre tri"],
    ["metier / rome", "Qualitative nominale", nonVide("rome"), "effectifs, fréquences", "barres", "Le code ROME s'écrit en chiffres mais ne se moyenne pas"],
    ["dep", "Qualitative nominale", nonVide("dep"), "effectifs", "barres ou carte", "Un numéro de département n'est pas une quantité"],
    ["zone", "Qualitative nominale", nonVide("zone"), "effectifs, fréquences", "barres"],
    ["contrat", "Qualitative nominale", nonVide("contrat"), "effectifs, fréquences", "barres"],
    ["duree", "Quantitative discrète", o => dureeMois(o) != null, "médiane, mode (en mois)", "barres", "Texte « CDD - 12 Mois » à convertir ; les CDI n'ont pas de durée"],
    ["temps", "Qualitative nominale", nonVide("temps"), "effectifs", "barres"],
    ["niveau", "Qualitative ordinale", o => o.niveau !== "Non précisé", "fréquences, médiane", "barres dans l'ordre", "Déduit du texte de l'annonce"],
    ["experience", "Qualitative ordinale", nonVide("experience"), "fréquences, médiane", "barres dans l'ordre", "À recoder (section 7)"],
    ["effectif", "Qualitative ordinale", nonVide("effectif"), "fréquences, médiane", "barres dans l'ordre", "Tranches de taille de l'établissement"],
    ["secteur", "Qualitative nominale", nonVide("secteur"), "effectifs", "barres"],
    ["teletravail", "Qualitative nominale (oui/non)", () => true, "fréquence", "barre ou chiffre seul"],
    ["salaire", "Quantitative continue", nonVide("salaire"), "moyenne, médiane, écart-type, quartiles", "histogramme, boîte", "Texte à convertir en euros par mois (section 9)"],
    ["date", "Date", nonVide("date"), "effectifs par semaine", "courbe"],
    ["competences", "Liste (nombre = quantitative)", nonVide("competences"), "médiane du nombre", "histogramme"],
    ["score", "Quantitative discrète", () => true, "médiane, quartiles", "barres", "Construit par notre tri (méthode)"]
  ];
  $("#dict").innerHTML = DICT.map(([k, nat, f, res, gr, note]) => {
    const n = rempli(f), ex = k === "metier / rome" ? `${O[0].metier} (${O[0].rome})` : k === "duree" ? exemple("duree") : k === "teletravail" ? "1 = mentionné, 0 = non" : k === "date" ? dateFR(O[0].date) : String(exemple(k.split(" ")[0], o => { const v = o[k.split(" ")[0]]; return Array.isArray(v) ? v.join(", ") : v; }) ?? "");
    return `<tr><td><code>${esc(k)}</code>${note ? `<div class="s">${esc(note)}</div>` : ""}</td><td>${nat}</td><td class="ex">${esc(ex.length > 42 ? ex.slice(0,41) + "…" : ex)}</td>
      <td><span class="fill"><i style="width:${(100*n/N).toFixed(0)}%"></i></span><span class="num">${pct(n,N)}</span></td><td>${res}</td><td>${gr}</td></tr>`;
  }).join("");
  $("#dict-cap").innerHTML = `À lire : sur ${fmt(N)} offres, le salaire n'est renseigné que dans <b>${pct(SAL.length - etat("vide"), N)}</b> des cas et la taille de l'établissement dans <b>${pct(rempli(nonVide("effectif")), N)}</b>. Une analyse de ces colonnes porte donc sur beaucoup moins d'offres que la base. ${source}`;

  /* ---- 2. Effectifs et fréquences ---- */
  const compte = f => { const c = {}; O.forEach(o => { const k = f(o); c[k] = (c[k]||0) + 1; }); return Object.entries(c).sort((a,b) => b[1]-a[1]); };
  const ann = compte(o => o.employeur);
  const NOTE_ANN = {"École / CFA":"recrute pour sa propre formation", "Anonyme":"entreprise non nommée", "Entreprise":"employeur nommé"};
  dessine(() => barres($("#c-annonceur"), ann.map(([k,n]) => ({label:k, n, note:NOTE_ANN[k]})), N, {left:150}));
  const ec = (ann.find(a => a[0] === "École / CFA") || [0,0])[1];
  $("#cap-annonceur").innerHTML = `À lire : <b>${fmt(ec)}</b> des ${fmt(N)} offres d'alternance (${pct(ec,N)}) sont publiées par une école ou un CFA : ${ec/N > .4 ? "plus de deux sur cinq" : "plus d'une sur trois"} ne viennent pas d'un employeur. ${source}`;
  const ctr = compte(o => o.contrat);
  $("#t-contrat").innerHTML = ctr.map(([k,n]) => `<tr><td>${esc(k)}</td><td class="num">${fmt(n)}</td><td class="num">${pct(n,N)}</td></tr>`).join("") + `<tr class="tot"><td>Total</td><td class="num">${fmt(N)}</td><td class="num">100 %</td></tr>`;
  $("#cap-contrat").innerHTML = `À lire : ${pct(ctr[0][1],N)} des offres sont des contrats d'${ctr[0][0].includes("apprentissage") ? "apprentissage" : ctr[0][0].toLowerCase()}. Mode : « ${esc(ctr[0][0])} ».`;
  const zn = compte(o => o.zone);
  dessine(() => barres($("#c-zone"), zn.map(([k,n]) => ({label: k === "Auvergne-Rhône-Alpes" ? "Reste de la région" : k, n, note: k === "Auvergne-Rhône-Alpes" ? "Auvergne-Rhône-Alpes hors Puy-de-Dôme" : ""})), N, {left:150}));
  const z63 = (zn.find(z => z[0] === "Puy-de-Dôme") || [0,0])[1], zaura = (zn.find(z => z[0] === "Auvergne-Rhône-Alpes") || [0,0])[1];
  $("#cap-zone").innerHTML = `À lire : seulement <b>${z63}</b> offre${z63>1?"s":""} dans le Puy-de-Dôme et ${zaura + z63} dans toute la région Auvergne-Rhône-Alpes (${pct(zaura+z63, N)}), contre ${fmt((zn.find(z => z[0] === "Île-de-France") || [0,0])[1])} en Île-de-France. « Reste de la région » : Auvergne-Rhône-Alpes hors Puy-de-Dôme.`;

  /* ---- 3. Moyenne, médiane, mode ---- */
  const cap = Math.max(1000, Math.ceil(quantile(V, .98)/500)*500), dehors = V.filter(v => v >= cap);
  $("#h-hist").textContent = `Salaire mensuel brut minimum affiché, sur ${fmt(R.n)} offres (tranches de 100 €)`;
  let mode;
  dessine(() => { mode = histogramme($("#c-hist"), V, {cap, binw:100, med:R.med, moy:R.moy, reperes:true, mode:true}); });
  $("#cap-hist").innerHTML = `Lecture : la moitié des ${fmt(R.n)} offres qui affichent un salaire propose un minimum de moins de <b>${eur(R.med)}</b> brut par mois ; les ${V.filter(v => v >= 1500).length} offres à 1 500 € et plus tirent la moyenne à <b>${eur(R.moy)}</b>. Le mode est la tranche ${fmt(mode.a)} à ${fmt(mode.b)} € (${mode.n} offres).${dehors.length ? ` ${dehors.length} offre${dehors.length>1?"s":""} au-delà de ${fmt(cap)} € (jusqu'à ${eur(R.max)}) ${dehors.length>1?"sont comptées":"est comptée"} dans les calculs mais hors du cadre.` : ""} ${source}`;
  const plancher = V.filter(v => v >= 400 && v < 520).length, smic = V.filter(v => v >= 1780 && v < 1950).length;
  $("#cap-smic").innerHTML = `<strong>Ce que ce chiffre ne dit pas :</strong> ${plancher} offres (${pct(plancher, R.n)}) affichent un minimum entre 400 et 520 €, et ${smic} autour du SMIC. Les fourchettes du type « 486 € à 1 801 € » recopient la grille légale de l'apprentissage, du plus jeune apprenti jusqu'au SMIC. Le minimum affiché est donc souvent le plancher légal, pas ce que touchera un étudiant de master, dont la rémunération dépend de son âge. D'où la distribution en plusieurs paquets.`;

  /* ---- 4. Dispersion ---- */
  const APP = SV.filter(s => /apprentissage/i.test(s.o.contrat)).map(s => s.v), PRO = SV.filter(s => /profession/i.test(s.o.contrat)).map(s => s.v);
  const RA = resume(APP), RP = resume(PRO);
  $("#th-all").textContent = "Toutes"; $("#th-app").textContent = "Apprentissage"; $("#th-pro").textContent = "Professionnalisation";
  const LIGNES = [["Effectif (n)", s => fmt(s.n)], ["Minimum", s => eur(s.min)], ["1er quartile (Q1)", s => eur(s.q1)], ["Médiane", s => eur(s.med)], ["3e quartile (Q3)", s => eur(s.q3)], ["Maximum", s => eur(s.max)],
    ["Moyenne", s => eur(s.moy)], ["Écart-type", s => eur(s.et)], ["Écart interquartile (Q3 − Q1)", s => eur(s.eiq)], ["Coefficient de variation", s => fmt(100*s.cv) + " %"]];
  $("#t-disp").innerHTML = LIGNES.map(([l,f]) => `<tr><td>${l}</td>${[R,RA,RP].map(s => `<td class="num">${s ? f(s) : "—"}</td>`).join("")}</tr>`).join("");
  dessine(() => boites($("#c-box"), [{label:"Apprentissage", v:APP}, {label:"Professionnalisation", v:PRO}], cap));
  if(RA && RP) $("#cap-box").innerHTML = `Lecture : en apprentissage, la moitié centrale des ${RA.n} offres tient entre ${eur(RA.q1)} et ${eur(RA.q3)} (écart interquartile ${eur(RA.eiq)}) ; en professionnalisation, entre ${eur(RP.q1)} et ${eur(RP.q3)} (${eur(RP.eiq)}). Médianes : ${eur(RA.med)} contre ${eur(RP.med)}.${RP.n < 30 ? ` Attention : ${RP.n} offres de professionnalisation seulement, c'est trop peu pour conclure.` : ""} Les points isolés sont au-delà de 1,5 écart interquartile. ${source}`;

  /* ---- 5. Asymétrie et aplatissement ---- */
  const sk = asymetrie(V), ku = aplatissement(V);
  dessine(() => histogramme($("#c-norm"), V, {cap, binw:100, moy:R.moy, et:R.et, normal:true}));
  $("#k-forme").innerHTML = [["Asymétrie", fmt(sk,2), "0 pour une loi normale ; positive : queue vers les hauts salaires"], ["Aplatissement (en excès)", fmt(ku,2), "0 pour une loi normale ; Excel (KURTOSIS) donne l'excès"], ["Moyenne − médiane", eur(R.moy - R.med), "positif quand la queue tire vers le haut"]]
    .map(([l,v,s]) => `<div class="kpi"><span>${l}</span><b class="num">${v}</b><span>${s}</span></div>`).join("");
  $("#cap-norm").innerHTML = `Lecture : sur ${fmt(R.n)} offres, l'asymétrie vaut <b>${fmt(sk,2)}</b> et l'aplatissement <b>${fmt(ku,2)}</b>. Les barres se tassent à gauche, près du plancher légal, alors que la courbe place le sommet sur la moyenne (${eur(R.moy)}). La distribution n'est ni symétrique ni en cloche : c'est une raison de préférer la médiane à la moyenne. ${source}`;

  /* ---- 6. Classes ---- */
  const T = [[0,500,"Moins de 500 €"],[500,1000,"500 à 1 000 €"],[1000,1500,"1 000 à 1 500 €"],[1500,2000,"1 500 à 2 000 €"],[2000,Infinity,"2 000 € et plus"]];
  const cl1 = T.map(([a,b,l]) => ({label:l, n:V.filter(v => v >= a && v < b).length}));
  const qs = [R.q1, R.med, R.q3];
  const cl2 = [
    {label:`Moins de ${eur(qs[0])}`, n:V.filter(v => v < qs[0]).length},
    {label:`${eur(qs[0])} à ${eur(qs[1])}`, n:V.filter(v => v >= qs[0] && v < qs[1]).length},
    {label:`${eur(qs[1])} à ${eur(qs[2])}`, n:V.filter(v => v >= qs[1] && v < qs[2]).length},
    {label:`${eur(qs[2])} et plus`, n:V.filter(v => v >= qs[2]).length}];
  dessine(() => barres($("#c-cl1"), cl1, R.n, {left:140}));
  dessine(() => barres($("#c-cl2"), cl2, R.n, {left:140}));
  const big = cl1.reduce((a,x) => x.n > a.n ? x : a, cl1[0]), inegal = Math.max(...cl2.map(c => c.n)) - Math.min(...cl2.map(c => c.n));
  $("#cap-cl").innerHTML = `À gauche, des tranches de même largeur : ${pct(big.n, R.n)} des offres tombent dans la seule tranche « ${big.label} ». À droite, des classes bornées par les quartiles, censées contenir chacune un quart des offres.${inegal > R.n*0.08 ? ` Elles n'en contiennent pas autant (de ${Math.min(...cl2.map(c => c.n))} à ${Math.max(...cl2.map(c => c.n))}) : beaucoup d'offres affichent exactement le même montant, et des valeurs identiques ne peuvent pas être coupées en deux.` : ""} Nous retenons les tranches de 500 € : leurs bornes se lisent sans calcul. ${source}`;

  /* ---- 7. Le bon graphique ---- */
  const brut = compte(o => o.experience || "Non renseigné");
  const rowsBrut = brut.slice(0, 8).map(([k,n]) => ({label: k.length > 22 ? k.slice(0,21) + "…" : k, n, note: k}));
  const reste = brut.slice(8); if(reste.length) rowsBrut.push({label:`${reste.length} autres libellés`, n: somme(reste.map(r => r[1]))});
  dessine(() => barres($("#c-exp1"), rowsBrut, N, {left:200}));
  const rec = {}; O.forEach(o => { const k = experience(o); rec[k] = (rec[k]||0) + 1; });
  const rowsRec = EXP_ORDRE.filter(k => rec[k]).map(k => ({label:k, n:rec[k], muted: k === "Exigée, sans durée"}));
  dessine(() => barres($("#c-exp2"), rowsRec, N, {left:150}));
  const deb = rec["Débutant accepté"] || 0;
  $("#cap-exp").innerHTML = `La même variable deux fois. À gauche, ${brut.length} libellés différents : les mois et les années se mélangent (« 12 Mois » et « 1 An(s) » disent la même chose) et des commentaires collés au libellé créent de fausses modalités. À droite, une seule unité, l'ordre des durées, et l'inclassable mis à part en gris. Lecture : <b>${pct(deb, N)}</b> des ${fmt(N)} offres acceptent un débutant ; la médiane est « ${medOrd(O.map(experience), EXP_ORDRE)} ». ${source}`;

  /* ---- 8. Courbe par semaine ---- */
  const sem = {}; O.forEach(o => { const k = lundi(o.date); sem[k] = (sem[k]||0) + 1; });
  const cles = Object.keys(sem).sort(), pts = [];
  for(let d = new Date(cles[0] + "T12:00:00"), fin = new Date(cles[cles.length-1] + "T12:00:00"); d <= fin; d.setDate(d.getDate()+7)){
    const k = d.toISOString().slice(0,10); pts.push({k, label: dateFR(k).slice(0,5), n: sem[k] || 0});
  }
  const dern = pts[pts.length-1]; const finSem = new Date(dern.k + "T12:00:00"); finSem.setDate(finSem.getDate()+6);
  dern.partiel = finSem.toISOString().slice(0,10) > D.maj;
  // Commencer à la première semaine qui compte au moins 1 % des offres, pour ne pas écraser la courbe
  const debut = Math.max(0, pts.findIndex(p => p.n >= N*0.01)), vis = pts.slice(debut), avant = somme(pts.slice(0, debut).map(p => p.n));
  dessine(() => courbe($("#c-date"), vis));
  const pic = vis.reduce((a,p) => p.n > a.n ? p : a, vis[0]), dates = O.map(o => o.date).sort(), dmed = dates[Math.floor(dates.length/2)];
  const recents = somme(vis.slice(-4).map(p => p.n));
  $("#cap-date").innerHTML = `Lecture : sur les ${fmt(N)} offres encore actives le ${dateLong(D.maj)}, <b>${pic.n}</b> ont été publiées la semaine du ${dateLong(pic.k)} ; la moitié l'a été après le ${dateLong(dmed)}, et les quatre dernières semaines en regroupent ${pct(recents, N)}. Attention, ce n'est pas le rythme des publications : les offres plus anciennes ont déjà été pourvues ou retirées, et seules les survivantes restent dans la base.${dern.partiel ? " Dernier point en creux : semaine incomplète." : ""}${avant ? ` ${avant} offre${avant>1?"s":""} plus ancienne${avant>1?"s":""} ne ${avant>1?"sont":"est"} pas tracée${avant>1?"s":""}.` : ""} ${source}`;

  /* ---- 9. Le désordre ---- */
  const nv = k => O.filter(o => !String(o[k] ?? "").trim()).length;
  const cleDoublon = o => (o.titre + "|" + o.entreprise + "|" + o.lieu).toLowerCase(), cd = {}; O.forEach(o => { const k = cleDoublon(o); cd[k] = (cd[k]||0) + 1; });
  const doublons = somme(Object.values(cd).map(c => c-1));
  const cleTE = o => (o.titre + "|" + o.entreprise).toLowerCase(), ct = {}; O.forEach(o => { const k = cleTE(o); ct[k] = (ct[k]||0) + 1; });
  const multi = O.filter(o => ct[cleTE(o)] > 1), multiEc = multi.filter(o => o.employeur !== "Entreprise").length;
  const annuelSusp = etat("annuel suspect");
  $("#desordre").innerHTML = [
    ["Ce qui manque", pct(nv("salaire"), N), `des offres sans salaire. Aussi vides : la taille de l'établissement (${pct(nv("effectif"),N)}), le temps de travail (${pct(nv("temps"),N)}), le secteur (${pct(nv("secteur"),N)}).`],
    ["Pas au bon format", "3", `unités pour le salaire, écrit en texte : ${etat("mensuel")} « Mensuel », ${etat("annuel") + annuelSusp} « Annuel », ${etat("horaire")} « Horaire ». La durée est aussi du texte (« CDD - 12 Mois »).`],
    ["En double", fmt(doublons), `annonces identiques (même titre, même entreprise, même lieu) : des republications. ${fmt(multi.length)} offres partagent un titre et un annonceur, dont ${pct(multiEc, multi.length)} d'écoles ou d'anonymes qui publient la même annonce dans plusieurs villes.`],
    ["Pas ce qu'on croit", fmt(annuelSusp), `salaires « annuels » de moins de 3 000 € : ce sont des montants mensuels mal étiquetés. Et ${pct(ec,N)} des « employeurs » sont en fait des écoles.`],
    ["Pas là du tout", "0", `offre de HelloWork, Welcome to the Jungle, Indeed ou LinkedIn : la base ne contient que France Travail, et seulement 23 métiers du marketing. La vente B2B, l'export et la gestion de magasin n'y sont pas.`]
  ].map(([t,n,s]) => `<div class="dcard"><span class="eyebrow">${t}</span><b class="num">${n}</b><p>${s}</p></div>`).join("");

  // Analyse de salaire : les republications sont gardées (choix expliqué dans la phrase)
  const trace = [[D.actives, "Offres actives, tous contrats", ""], [N, "Offres d'alternance", "hors alternance retirées"], [N - etat("vide"), "Avec un salaire affiché", "sans salaire retirées"], [R.n, "Avec un salaire convertible en euros par mois", "illisibles retirées"]];
  $("#trace").innerHTML = trace.map(([n,l,d],i) =>
    (i ? `<div class="fdrop">− ${fmt(trace[i-1][0] - n)} · ${d}</div>` : "") +
    `<div class="fstep"><div><div class="flabel">${l}</div><div class="fbar${i===trace.length-1?" last":""}"><span style="width:${(100*n/Math.max(1,trace[0][0])).toFixed(1)}%"></span></div></div><span class="num">${fmt(n)}</span></div>`).join("");
  $("#cap-trace").innerHTML = `Une analyse de salaire porte sur <b>${fmt(R.n)}</b> offres, pas sur ${fmt(N)} : c'est ce qu'il faut écrire à côté de chaque chiffre. ${annuelSusp} montants « annuels » inférieurs à 3 000 € ont été lus comme mensuels, les montants horaires multipliés par 151,67 heures. Les ${doublons} republications identiques sont gardées : elles changent peu les résultats et chacune reste une offre ouverte. ${source}`;
}

// Médiane d'une variable ordinale
function medOrd(vals, ordre){
  const s = vals.map(v => ordre.indexOf(v)).filter(i => i >= 0 && ordre[i] !== "Exigée, sans durée").sort((a,b) => a-b);
  return ordre[s[Math.floor((s.length-1)/2)]] || "";
}
})();
