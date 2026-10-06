/* Alternances IAE — canal Indeed.
   Tendances : données ouvertes d'Indeed Hiring Lab (Job Postings Index, licence CC BY 4.0), dans data/indeed.js.
   Offres : liens de recherche Indeed préremplis (aucune offre n'est collectée : les CGU d'Indeed l'interdisent). */
(function(){
"use strict";
document.addEventListener("DOMContentLoaded", init);

const SERIES = [
  {k:"Marketing", nom:"Marketing", parcours:"MOD", c:"var(--mod)"},
  {k:"Sales", nom:"Vente", parcours:"DCIB", c:"var(--dcib)"},
  {k:"Retail", nom:"Commerce de détail", parcours:"Retail", c:"var(--retail)"},
  {k:"__france", nom:"Ensemble France", parcours:"", c:"var(--muted)", tirets:true}
];
const RECH = {
  MOD:    ["alternance marketing digital", "alternance chef de projet marketing", "alternance community manager"],
  Retail: ["alternance retail", "alternance category manager", "alternance trade marketing"],
  DCIB:   ["alternance business developer", "alternance commercial B2B", "alternance export"]
};
const LIEUX = [["Clermont-Ferrand (63)","Clermont-Ferrand (63)"],["Lyon (69)","Lyon (69)"],["Paris (75)","Paris (75)"],["Toute la France",""]];
const lienIndeed = (q, l) => "https://fr.indeed.com/jobs?q=" + encodeURIComponent(q).replace(/%20/g,"+") + (l ? "&l=" + encodeURIComponent(l).replace(/%20/g,"+") : "");

let A;
const moisFR = d => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {month:"short", year:"numeric"});

/* ---------- courbes multiples avec infobulle au survol ---------- */
function courbes(svg, series, opt){
  const W = A.largeur(svg), H = 300, l = 44, r = 150, t = 16, b = 30;
  const n = series[0].pts.length, dates = series[0].pts.map(p => p[0]);
  const vals = series.flatMap(s => s.pts.map(p => p[1])).concat([100]);
  let lo = Math.floor(Math.min(...vals)/10)*10, hi = Math.ceil(Math.max(...vals)/10)*10;
  const X = i => l + (W-l-r)*i/(n-1), Y = v => t + (H-t-b)*(1 - (v-lo)/(hi-lo));
  const pas = (hi-lo) > 80 ? 20 : 10;
  let h = "";
  for(let g = lo; g <= hi; g += pas) h += `<line x1="${l}" x2="${W-r}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)"></line><text x="${l-8}" y="${Y(g)+4}" font-size="12" text-anchor="end" class="mut" font-family="var(--mono)">${g}</text>`;
  h += `<line x1="${l}" x2="${W-r}" y1="${Y(100)}" y2="${Y(100)}" stroke="var(--ink)" stroke-dasharray="3 3"></line><text x="${l+4}" y="${Y(100)-6}" font-size="11.5" class="mut halo">100 = niveau du 1er février 2020</text>`;
  // repères de mois (janvier et juillet)
  const repere = (W-l-r) < 600 ? /-01-01$/ : /-(01|07)-01$/;
  dates.forEach((d,i) => { if(repere.test(d)) h += `<line x1="${X(i)}" x2="${X(i)}" y1="${H-b}" y2="${H-b+5}" stroke="var(--muted)"></line><text x="${X(i)}" y="${H-10}" font-size="12" text-anchor="middle" class="mut" font-family="var(--mono)">${(W-l-r) < 400 ? d.slice(0,4) : moisFR(d)}</text>`; });
  series.forEach(s => {
    const d = s.pts.map((p,i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
    h += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round"${s.tirets ? ' stroke-dasharray="6 4"' : ""}></path>`;
  });
  // étiquettes directes en bout de courbe, écartées pour ne pas se chevaucher
  const fins = series.map(s => ({s, y:Y(s.pts[n-1][1]), v:s.pts[n-1][1]})).sort((a,b) => a.y - b.y);
  for(let i = 1; i < fins.length; i++) if(fins[i].y - fins[i-1].y < 33) fins[i].y = fins[i-1].y + 33;
  fins.forEach(f => h += `<circle cx="${X(n-1)}" cy="${Y(f.v)}" r="4" fill="${f.s.c}" stroke="var(--surface)" stroke-width="2"></circle>
    <text x="${X(n-1)+10}" y="${f.y-1}" font-size="12.5" font-weight="600">${f.s.nom}</text><text x="${X(n-1)+10}" y="${f.y+14}" font-size="12" class="mut" font-family="var(--mono)">${A.fmt(f.v,1)}${f.s.parcours ? " · " + f.s.parcours : ""}</text>`);
  h += `<g class="cross" visibility="hidden"><line y1="${t}" y2="${H-b}" stroke="var(--ink)" stroke-width="1"></line>${series.map(s => `<circle r="4" fill="${s.c}" stroke="var(--surface)" stroke-width="2"></circle>`).join("")}</g>
    <rect class="zone" x="${l}" y="${t}" width="${W-l-r}" height="${H-t-b}" fill="transparent"></rect>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = h;
  // survol : ligne verticale + infobulle avec toutes les séries à la date pointée
  const zone = svg.querySelector(".zone"), cross = svg.querySelector(".cross");
  const montrer = e => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const i = Math.max(0, Math.min(n-1, Math.round((p.x - l)/(W-l-r)*(n-1))));
    cross.setAttribute("visibility", "visible"); cross.querySelector("line").setAttribute("x1", X(i)); cross.querySelector("line").setAttribute("x2", X(i));
    cross.querySelectorAll("circle").forEach((c,k) => { c.setAttribute("cx", X(i)); c.setAttribute("cy", Y(series[k].pts[i][1])); });
    // l'infobulle commune du site lit l'attribut data-tip de l'élément survolé
    zone.dataset.tip = `<b>${new Date(dates[i]+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</b><br>` + series.map(s => `${s.nom} : ${A.fmt(s.pts[i][1],1)}`).join("<br>");
  };
  zone.addEventListener("mousemove", montrer);
  zone.addEventListener("mouseleave", () => cross.setAttribute("visibility", "hidden"));
}

function init(){
  if(!document.getElementById("indeed") || !window.AIAE || !window.INDEED) return;
  A = window.AIAE;
  const I = window.INDEED, $ = s => document.querySelector(s);
  const source = `Données : Indeed Hiring Lab, Job Postings Index (licence CC BY 4.0), au ${A.dateLong(I.maj)}.`;
  const serieDe = (k, v) => k === "__france" ? I.france[v] : I.secteurs[k][v];
  const ilYaUnAn = (pts) => { const d = new Date(pts[pts.length-1][0] + "T12:00:00"); d.setFullYear(d.getFullYear()-1); const c = d.toISOString().slice(0,10); return pts.find(p => p[0] >= c) || pts[0]; };
  let variable = "total";

  const dessiner = () => {
    const S = SERIES.map(s => Object.assign({}, s, {pts: serieDe(s.k, variable)}));
    courbes($("#c-indeed"), S);
    // tuiles : niveau actuel et évolution sur un an
    $("#k-indeed").innerHTML = S.map(s => { const a = s.pts[s.pts.length-1][1], b = ilYaUnAn(s.pts)[1], ev = 100*(a-b)/b;
      return `<div class="kpi"><span>${s.nom}${s.parcours ? ` · ${s.parcours}` : ""}</span><b class="num">${A.fmt(a,0)}</b><span>${ev >= 0 ? "+" : "−"}${A.fmt(Math.abs(ev),0)} % en un an</span></div>`; }).join("");
    const m = S[0], fr = S[3], am = m.pts[m.pts.length-1][1], af = fr.pts[fr.pts.length-1][1], bm = ilYaUnAn(m.pts)[1];
    $("#cap-indeed").innerHTML = `Lecture : au ${A.dateLong(I.maj)}, les ${variable === "new" ? "nouvelles offres (moins de 7 jours)" : "offres"} de marketing sur Indeed sont à l'indice <b>${A.fmt(am,0)}</b> : ${am < 100 ? `${A.fmt(100-am,0)} % de moins` : `${A.fmt(am-100,0)} % de plus`} qu'en février 2020, contre ${A.fmt(af,0)} pour l'ensemble des métiers en France. En un an, l'indice marketing est passé de ${A.fmt(bm,0)} à ${A.fmt(am,0)}. Ce sont des indices, pas des nombres d'offres : 100 correspond au niveau de chaque série au 1er février 2020. ${source}`;
    $("#h-indeed").textContent = am < af ? "Sur Indeed, les offres de marketing ont reculé plus que le reste du marché" : "Sur Indeed, les offres de marketing résistent mieux que le reste du marché";
    document.querySelectorAll("#indeed-var .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.var === variable));
  };
  $("#indeed-var").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ variable = b.dataset.var; dessiner(); } });
  A.dessine(dessiner);

  // régions (tous métiers confondus)
  const R = [{nom:"Auvergne-Rhône-Alpes", parcours:"", c:"var(--mod)", pts:I.region["Auvergne-Rhône-Alpes"]},
             {nom:"Île-de-France", parcours:"", c:"var(--dcib)", pts:I.region["Île-de-France"]},
             {nom:"Ensemble France", parcours:"", c:"var(--muted)", tirets:true, pts:I.france.total}];
  A.dessine(() => courbes($("#c-indeed-reg"), R));
  const ara = R[0].pts[R[0].pts.length-1][1], idf = R[1].pts[R[1].pts.length-1][1];
  $("#cap-indeed-reg").innerHTML = `Lecture : tous métiers confondus, les offres Indeed en Auvergne-Rhône-Alpes sont à l'indice <b>${A.fmt(ara,0)}</b>, contre <b>${A.fmt(idf,0)}</b> en Île-de-France : ${ara > idf ? "le marché régional a mieux résisté depuis 2020 que celui de l'Île-de-France" : "le marché régional a moins bien résisté que celui de l'Île-de-France"}. Indeed ne publie pas ces séries régionales par métier. ${source}`;

  // liens de recherche Indeed préremplis
  $("#indeed-liens").innerHTML = Object.entries(RECH).map(([p, qs]) => `<div class="canal-p"><span class="tag ${p.toLowerCase()}">${p}</span>
    <div class="ind-grid">${qs.map(q => `<div class="ind-q"><span>${A.esc(q.replace(/^alternance /,""))}</span><span class="chips">${LIEUX.map(([lab, l]) => `<a class="chip" href="${lienIndeed(q, l)}" target="_blank" rel="noopener">${lab.replace(/ \(\d+\)/,"")}</a>`).join("")}</span></div>`).join("")}</div></div>`).join("");
}
})();
