/* Alternances IAE — page « Autres canaux » : offres Arbeitnow et Adzuna (data/canaux.js, généré par scripts/canaux.rb). */
(function(){
"use strict";
document.addEventListener("DOMContentLoaded", init);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n).toLocaleString("fr-FR");
const dateFR = d => d ? d.split("-").reverse().join("/") : "";
const P = {mod:"MOD", retail:"Retail", dcib:"DCIB"};
const SRC = {
  arbeitnow: {nom:"Arbeitnow", site:"https://www.arbeitnow.com", mention: `<a href="https://www.arbeitnow.com" target="_blank" rel="noopener">via Arbeitnow</a>`},
  adzuna:    {nom:"Adzuna", site:"https://www.adzuna.fr", mention: `<span class="adz"><a href="https://www.adzuna.fr" target="_blank" rel="noopener">Jobs</a> by <a href="https://www.adzuna.fr" target="_blank" rel="noopener" class="adz-logo">Adzuna</a></span>`}
};

const MOD_KW  = /marketing|digital|num[ée]rique|social media|r[ée]seaux sociaux|community|seo|sea\b|acquisition|growth|contenu|content|brand|marque|chef de produit|product marketing|emailing|crm|communication/i;
const RET_KW  = /retail|magasin|boutique|enseigne|point de vente|merchandis|category|cat[ée]gor|trade marketing|relation client|exp[ée]rience client|customer (success|experience)|e-?commerce|omnicanal|distribution/i;
const DCIB_KW = /export|international|business develop|biz ?dev|d[ée]veloppement commercial|commercial|key account|grands? comptes|b2b|account (manager|executive)|sales|prospection|n[ée]gociation|ing[ée]nieur d.affaires/i;
const ALT_KW = /alternan|apprenti|contrat pro|work[- ]study/i, STAGE_KW = /\bstage\b|stagiaire|intern(ship)?\b/i;
const FRANCE = /france|paris|lyon|marseille|lille|toulouse|bordeaux|nantes|clermont|rennes|strasbourg|montpellier|grenoble|nice|rouen|tours|dijon|angers|reims|aix|annecy|orl[ée]ans|metz|nancy|caen|brest|limoges|amiens|saint-[ée]tienne|villeurbanne|boulogne|nanterre|puteaux|courbevoie|issy|levallois|neuilly|versailles/i;
const texte = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

// Arbeitnow : API publique, sans clé, interrogée en direct par le navigateur (300 offres par page, les plus récentes d'abord)
let pageSuivante = "https://www.arbeitnow.com/api/job-board-api", lues = 0;
async function chargerArbeitnow(nbPages){
  const out = [];
  for(let i = 0; i < nbPages && pageSuivante; i++){
    const j = await (await fetch(pageSuivante)).json();
    pageSuivante = j.links && j.links.next;
    (j.data || []).forEach(x => {
      lues++;
      if(!FRANCE.test(x.location || "")) return;
      const t = String(x.title || "").trim(), c = (x.job_types || []).join(", ");
      const o = {source:"arbeitnow", id:"arbeitnow-" + x.slug, titre:t, entreprise:x.company_name, lieu:x.location,
        date:new Date((x.created_at || 0)*1000).toISOString().slice(0,10), url:x.url, contrat:c, salaire:"",
        alternance: ALT_KW.test(t + " " + c) ? 1 : 0, stage: STAGE_KW.test(t + " " + c) ? 1 : 0,
        mod: MOD_KW.test(t) ? 1 : 0, retail: RET_KW.test(t) ? 1 : 0, dcib: DCIB_KW.test(t) ? 1 : 0, extrait: texte(x.description).slice(0, 280)};
      if(o.mod + o.retail + o.dcib + o.alternance + o.stage > 0) out.push(o);
    });
  }
  return out;
}

async function init(){
  if(document.body.dataset.page !== "canaux") return;
  const C = window.CANAUX || {sources:{}, offres:[]};
  const O = (C.offres || []).filter(o => o.source !== "arbeitnow");   // Arbeitnow est chargé en direct, plus frais
  const etatSrc = Object.assign({}, C.sources);
  $("#c-count").textContent = "Chargement des offres Arbeitnow…";
  try { O.push(...await chargerArbeitnow(3)); etatSrc.arbeitnow = {ok:true, vues:lues}; }
  catch(e){ etatSrc.arbeitnow = {ok:false, erreur:"Arbeitnow ne répond pas pour l'instant"}; }
  O.sort((a,b) => b.date.localeCompare(a.date));
  $("#c-lede").innerHTML += ` Arbeitnow est interrogé en direct à chaque visite${C.maj ? ` ; dernière collecte Adzuna le <b>${dateFR(C.maj)}</b>` : " ; Adzuna est prêt et attend sa clé"}.`;

  // État de chaque canal
  $("#c-sources").innerHTML = Object.entries(SRC).map(([k, s]) => {
    const st = etatSrc[k] || {ok:false, erreur:"pas encore interrogé"}, n = O.filter(o => o.source === k).length;
    const etat = st.ok ? `<span class="dec oui">Actif</span>` : `<span class="dec non">En attente</span>`;
    const txt = k === "arbeitnow"
      ? (st.ok ? `${fmt(n)} offres en France dans nos métiers ou en alternance et stage, parmi les ${fmt(st.vues || 0)} offres européennes les plus récentes. API gratuite et sans clé, interrogée en direct.` : `Collecte en échec : ${esc(st.erreur)}.`)
      : (st.ok ? `Offres des 7 derniers jours en France, ${fmt(st.appels || 0)} recherches par jour, sous le quota gratuit. Chaque offre porte la mention « Jobs by Adzuna ».`
               : `Le code est prêt, il manque la clé gratuite. 1. Créer un compte sur <a href="https://developer.adzuna.com/signup" target="_blank" rel="noopener">developer.adzuna.com</a>. 2. Dans le dépôt GitHub : Settings → Secrets and variables → Actions → New repository secret, ajouter <code>ADZUNA_APP_ID</code> puis <code>ADZUNA_APP_KEY</code>. Il restera à lancer la collecte quotidienne (voir README).`);
    return `<div class="panel stack canal"><div class="canal-h"><h3>${s.nom}</h3>${etat}</div><p>${txt}</p></div>`;
  }).join("");

  // Filtres
  const etat = {src:"", par:"", limite:50};
  const presentes = Object.keys(SRC).filter(k => O.some(o => o.source === k));
  $("#c-src").innerHTML = [["","Tous les canaux"], ...presentes.map(k => [k, SRC[k].nom])].map(([k,l]) => `<button class="chip" type="button" data-k="${k}">${l}</button>`).join("");
  $("#c-par").innerHTML = [["","Tous les parcours"], ...Object.entries(P)].map(([k,l]) => `<button class="chip" type="button" data-k="${k}">${l}</button>`).join("");
  $("#c-src").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ etat.src = b.dataset.k; etat.limite = 50; dessiner(); } });
  $("#c-par").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ etat.par = b.dataset.k; etat.limite = 50; dessiner(); } });
  $("#c-alt").addEventListener("change", () => { etat.limite = 50; dessiner(); });
  $("#c-q").addEventListener("input", () => { etat.limite = 50; dessiner(); });
  $("#c-more").addEventListener("click", () => { etat.limite += 50; dessiner(); });
  const plus = document.createElement("button"); plus.className = "btn"; plus.type = "button"; plus.textContent = "Charger des offres Arbeitnow plus anciennes";
  plus.addEventListener("click", async () => { plus.disabled = true; plus.textContent = "Chargement…";
    try { O.push(...await chargerArbeitnow(2)); O.sort((a,b) => b.date.localeCompare(a.date)); } catch(e){}
    plus.disabled = !pageSuivante; plus.textContent = pageSuivante ? "Charger des offres Arbeitnow plus anciennes" : "Toutes les offres Arbeitnow sont chargées"; dessiner(); });
  $("#c-more").after(plus);

  function dessiner(){
    const q = $("#c-q").value.trim().toLowerCase(), alt = $("#c-alt").checked;
    const l = O.filter(o => (!etat.src || o.source === etat.src) && (!etat.par || o[etat.par]) && (!alt || o.alternance || o.stage)
      && (!q || [o.titre, o.entreprise, o.lieu, o.extrait].join(" ").toLowerCase().includes(q)));
    $("#c-count").textContent = `${fmt(l.length)} offre${l.length > 1 ? "s" : ""}` + (l.length > etat.limite ? ` · ${etat.limite} affichées` : "");
    $("#c-tbody").innerHTML = l.slice(0, etat.limite).map(o => `<tr>
      <td><a class="t" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.titre)}</a><div class="s">${esc(o.entreprise)}${o.contrat ? " · " + esc(o.contrat) : ""}${o.salaire ? " · " + esc(o.salaire) : ""}</div>
        ${o.alternance ? `<span class="pill alt">Alternance</span>` : ""}${o.stage ? `<span class="pill alt">Stage</span>` : ""}${o.extrait ? `<div class="s ext">${esc(o.extrait)}…</div>` : ""}</td>
      <td>${Object.keys(P).filter(k => o[k]).map(k => `<span class="pill ${k}">${P[k]}</span>`).join("") || `<span class="s">—</span>`}</td>
      <td>${esc(o.lieu)}</td><td class="num" style="font-size:13px">${dateFR(o.date)}</td>
      <td class="src">${SRC[o.source] ? SRC[o.source].mention : esc(o.source)}</td></tr>`).join("")
      || `<tr><td colspan="5" class="empty">Aucune offre ne correspond à ces filtres.</td></tr>`;
    $("#c-more").hidden = l.length <= etat.limite;
    document.querySelectorAll("#c-src .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === etat.src));
    document.querySelectorAll("#c-par .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === etat.par));
  }
  dessiner();
}
})();
