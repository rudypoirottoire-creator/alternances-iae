/* Alternances IAE — CM 2 : poser une hypothèse et la tester sur nos offres.
   Tous les tests sont recalculés depuis data/offres.js. Les p-values viennent des lois t, F et du chi²,
   calculées ici (fonctions bêta et gamma incomplètes), sans bibliothèque externe. */
(function(){
"use strict";
document.addEventListener("DOMContentLoaded", init);

/* ---------- lois de probabilité ---------- */
function lgamma(x){
  const c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + .5)*Math.log(t); let s = 1.000000000190015;
  for(const k of c) s += k/++y;
  return -t + Math.log(2.5066282746310005*s/x);
}
function betacf(a, b, x){
  const EPS = 3e-14, FPMIN = 1e-300; let qab = a+b, qap = a+1, qam = a-1, c = 1, d = 1 - qab*x/qap;
  if(Math.abs(d) < FPMIN) d = FPMIN; d = 1/d; let h = d;
  for(let m = 1; m <= 300; m++){
    const m2 = 2*m; let aa = m*(b-m)*x/((qam+m2)*(a+m2));
    d = 1 + aa*d; if(Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa/c; if(Math.abs(c) < FPMIN) c = FPMIN; d = 1/d; h *= d*c;
    aa = -(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d = 1 + aa*d; if(Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa/c; if(Math.abs(c) < FPMIN) c = FPMIN; d = 1/d;
    const del = d*c; h *= del; if(Math.abs(del-1) < EPS) break;
  }
  return h;
}
function ibeta(x, a, b){ // bêta incomplète régularisée I_x(a, b)
  if(x <= 0) return 0; if(x >= 1) return 1;
  const bt = Math.exp(lgamma(a+b) - lgamma(a) - lgamma(b) + a*Math.log(x) + b*Math.log(1-x));
  return x < (a+1)/(a+b+2) ? bt*betacf(a,b,x)/a : 1 - bt*betacf(b,a,1-x)/b;
}
function gammq(a, x){ // gamma incomplète régularisée supérieure Q(a, x)
  if(x <= 0) return 1;
  if(x < a+1){ let ap = a, sum = 1/a, del = sum; for(let n = 0; n < 500; n++){ ap++; del *= x/ap; sum += del; if(Math.abs(del) < Math.abs(sum)*3e-14) break; }
    return 1 - sum*Math.exp(-x + a*Math.log(x) - lgamma(a)); }
  let b = x+1-a, c = 1e300, d = 1/b, h = d;
  for(let i = 1; i < 500; i++){ const an = -i*(i-a); b += 2; d = an*d + b; if(Math.abs(d) < 1e-300) d = 1e-300; c = b + an/c; if(Math.abs(c) < 1e-300) c = 1e-300; d = 1/d; const del = d*c; h *= del; if(Math.abs(del-1) < 3e-14) break; }
  return Math.exp(-x + a*Math.log(x) - lgamma(a))*h;
}
const pT = (t, df) => ibeta(df/(df + t*t), df/2, .5);                 // bilatérale
const pChi = (x, k) => gammq(k/2, x/2);
const pF = (f, d1, d2) => f <= 0 ? 1 : ibeta(d2/(d2 + d1*f), d2/2, d1/2);
const dT = (t, df) => Math.exp(lgamma((df+1)/2) - lgamma(df/2) - .5*Math.log(df*Math.PI) - (df+1)/2*Math.log(1 + t*t/df));
const dChi = (x, k) => x <= 0 ? 0 : Math.exp((k/2-1)*Math.log(x) - x/2 - (k/2)*Math.log(2) - lgamma(k/2));
const dF = (x, d1, d2) => x <= 0 ? 0 : Math.exp(.5*(d1*Math.log(d1*x) + d2*Math.log(d2) - (d1+d2)*Math.log(d1*x+d2)) - Math.log(x) - (lgamma(d1/2)+lgamma(d2/2)-lgamma((d1+d2)/2)));
function critique(p, lo, hi){ for(let i = 0; i < 80; i++){ const m = (lo+hi)/2; if(p(m) > .05) lo = m; else hi = m; } return (lo+hi)/2; }
function phi(z){ // loi normale centrée réduite, fonction de répartition (Abramowitz-Stegun 26.2.17)
  const t = 1/(1 + .2316419*Math.abs(z)), d = .3989423*Math.exp(-z*z/2);
  const p = d*t*(.3193815 + t*(-.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274))));
  return z > 0 ? 1-p : p;
}

/* ---------- statistiques ---------- */
const somme = v => v.reduce((a,b) => a+b, 0), moy = v => somme(v)/v.length;
const varS = v => { const m = moy(v); return somme(v.map(x => (x-m)**2))/(v.length-1); };
function rangs(v){ // rangs moyens en cas d'égalité
  const idx = v.map((x,i) => [x,i]).sort((a,b) => a[0]-b[0]), r = new Array(v.length);
  for(let i = 0; i < idx.length;){ let j = i; while(j+1 < idx.length && idx[j+1][0] === idx[i][0]) j++; const rm = (i+j)/2 + 1; for(let k = i; k <= j; k++) r[idx[k][1]] = rm; i = j+1; }
  return r;
}
function correctionEgalites(v){ const c = {}; v.forEach(x => c[x] = (c[x]||0) + 1); return somme(Object.values(c).map(t => t**3 - t)); }
function welch(a, b){
  const va = varS(a), vb = varS(b), se = Math.sqrt(va/a.length + vb/b.length), t = (moy(a)-moy(b))/se;
  const df = (va/a.length + vb/b.length)**2 / ((va/a.length)**2/(a.length-1) + (vb/b.length)**2/(b.length-1));
  const sp = Math.sqrt(((a.length-1)*va + (b.length-1)*vb)/(a.length+b.length-2));
  return {t, df, p:pT(t, df), d:(moy(a)-moy(b))/sp};
}
function mannWhitney(a, b){
  const all = a.concat(b), r = rangs(all), n1 = a.length, n2 = b.length, N = n1+n2;
  const U = somme(r.slice(0,n1)) - n1*(n1+1)/2, mu = n1*n2/2;
  const s = Math.sqrt(n1*n2/12*((N+1) - correctionEgalites(all)/(N*(N-1))));
  const z = (Math.abs(U-mu) - .5)/s; return {U, p: 2*(1-phi(z))};
}
function anova(groupes){
  const all = groupes.flat(), m = moy(all), k = groupes.length, N = all.length;
  const ssb = somme(groupes.map(g => g.length*(moy(g)-m)**2)), sst = somme(all.map(x => (x-m)**2)), ssw = sst - ssb;
  const F = (ssb/(k-1))/(ssw/(N-k)); return {F, df1:k-1, df2:N-k, p:pF(F, k-1, N-k), eta2: ssb/sst};
}
function kruskal(groupes){
  const all = groupes.flat(), r = rangs(all), N = all.length; let i = 0, H = 0;
  groupes.forEach(g => { const rg = r.slice(i, i+g.length); i += g.length; H += somme(rg)**2/g.length; });
  H = 12/(N*(N+1))*H - 3*(N+1); H /= 1 - correctionEgalites(all)/(N**3 - N);
  return {H, p:pChi(H, groupes.length-1)};
}
function pearson(x, y){
  const mx = moy(x), my = moy(y); let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v,i) => { sxy += (v-mx)*(y[i]-my); sxx += (v-mx)**2; syy += (y[i]-my)**2; });
  const r = sxy/Math.sqrt(sxx*syy), n = x.length, t = r*Math.sqrt((n-2)/(1-r*r));
  return {r, t, df:n-2, p:pT(t, n-2)};
}
function chi2(table){ // table[ligne][colonne]
  const L = table.map(l => somme(l)), C = table[0].map((_,j) => somme(table.map(l => l[j]))), N = somme(L);
  let x = 0, minAtt = Infinity;
  table.forEach((l,i) => l.forEach((o,j) => { const e = L[i]*C[j]/N; minAtt = Math.min(minAtt, e); x += (o-e)**2/e; }));
  const df = (table.length-1)*(table[0].length-1);
  return {chi2:x, df, p:pChi(x, df), V: Math.sqrt(x/(N*(Math.min(table.length, table[0].length)-1))), minAtt, N};
}

/* ---------- seuils de Cohen (1988, 1992) ---------- */
const SEUILS = {V:[.1,.3,.5], d:[.2,.5,.8], eta2:[.01,.06,.14], r:[.1,.3,.5]};
const NOM_EFFET = {V:"V de Cramér", d:"d de Cohen", eta2:"êta²", r:"r de Pearson"};
function niveau(type, v){ const s = SEUILS[type], a = Math.abs(v); return a >= s[2] ? "fort" : a >= s[1] ? "moyen" : a >= s[0] ? "petit" : "négligeable"; }
// Effectifs nécessaires pour une puissance de 80 % au seuil de 5 % (Cohen, 1992, « A power primer », tableau 2)
const PUISSANCE = [
  {test:"Chi² (2 degrés de liberté)", unite:"offres au total", n:[964,107,39]},
  {test:"Test t (deux groupes)", unite:"offres par groupe", n:[393,64,26]},
  {test:"ANOVA (trois groupes)", unite:"offres par groupe", n:[322,52,21]},
  {test:"Corrélation", unite:"offres au total", n:[783,85,28]}
];

/* ---------- mise en forme ---------- */
let A;
const fp = p => p < .001 ? "< 0,001" : A.fmt(p, 3);
const pEq = p => p < .001 ? "p < 0,001" : "p = " + A.fmt(p, 3);
const f2 = x => A.fmt(x, 2);
const decision = p => p < .05 ? `<span class="dec oui">H0 rejetée</span>` : `<span class="dec non">H0 non rejetée</span>`;

/* ---------- graphique : la loi de la statistique si H0 est vraie ---------- */
function loiH0(svg, h){
  const W = A.largeur(svg), H = 250, l = 20, r = 20, t = 30, b = 46;
  const s = h.loi; let xmin, xmax, dens, pfun, crit, bilat = false;
  if(s.type === "t"){ bilat = true; xmax = 4.5; xmin = -4.5; dens = x => dT(x, s.df); pfun = x => pT(x, s.df); crit = critique(x => pT(x, s.df), 0, 60); }
  else if(s.type === "chi"){ crit = critique(x => pChi(x, s.df), 0, 400); xmin = 0; xmax = crit*1.6; dens = x => dChi(x, s.df); }
  else { crit = critique(x => pF(x, s.df1, s.df2), 0, 400); xmin = 0; xmax = crit*2.2; dens = x => dF(x, s.df1, s.df2); }
  const X = x => l + (W-l-r)*(x-xmin)/(xmax-xmin);
  const dd = x => s.type === "t" ? dens(x) : dens(Math.max(x, 1e-6));
  let ymax = 0; for(let i = 0; i <= 200; i++){ const x = xmin + (xmax-xmin)*i/200; ymax = Math.max(ymax, dd(x)); }
  const Y = y => t + (H-t-b)*(1 - Math.min(y, ymax)/ymax);
  const zone = (a, z) => { let d = `M${X(a)} ${Y(0)}`; for(let i = 0; i <= 60; i++){ const x = a + (z-a)*i/60; d += `L${X(x).toFixed(1)} ${Y(dd(x)).toFixed(1)}`; } return d + `L${X(z)} ${Y(0)}Z`; };
  const obs = s.stat, obsAbs = Math.abs(obs);
  let h_ = "";
  // zone de rejet (claire) puis p-value (foncée)
  if(bilat){ h_ += `<path d="${zone(crit, xmax)}" fill="var(--zidf)"></path><path d="${zone(xmin, -crit)}" fill="var(--zidf)"></path>`;
    if(obsAbs < xmax){ h_ += `<path d="${zone(obsAbs, xmax)}" fill="var(--mod)"></path><path d="${zone(xmin, -obsAbs)}" fill="var(--mod)"></path>`; } }
  else { h_ += `<path d="${zone(crit, xmax)}" fill="var(--zidf)"></path>`; if(obs < xmax) h_ += `<path d="${zone(Math.max(obs,1e-6), xmax)}" fill="var(--mod)"></path>`; }
  let d = ""; for(let i = 0; i <= 240; i++){ const x = xmin + (xmax-xmin)*i/240; d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(dd(x)).toFixed(1); }
  h_ += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2"></path><line x1="${l}" x2="${W-r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)"></line>`;
  const marques = bilat ? [-crit, crit] : [crit];
  marques.forEach(c => h_ += `<line x1="${X(c)}" x2="${X(c)}" y1="${Y(0)}" y2="${Y(0)+6}" stroke="var(--muted)"></line><text x="${X(c)}" y="${Y(0)+20}" font-size="12" text-anchor="middle" class="mut" font-family="var(--mono)">${c > 0 && bilat ? "+" : ""}${f2(c)}</text>`);
  h_ += `<text x="${X(bilat ? 0 : xmin)}" y="${H-6}" font-size="12" text-anchor="${bilat ? "middle" : "start"}" class="mut">${bilat ? "0 : aucune différence" : "0 : aucun écart à H0"}</text>`;
  const nom = s.type === "t" ? "t" : s.type === "chi" ? "chi²" : "F";
  if(obs > xmax || obs < xmin){
    h_ += `<text x="${W-r}" y="${t+4}" font-size="13" text-anchor="end" font-weight="600">${nom} observé = ${f2(obs)} →</text><text x="${W-r}" y="${t+20}" font-size="12" text-anchor="end" class="mut">bien au-delà du cadre</text>`;
  } else {
    const xo = X(obs), droite = xo > W*0.6;
    h_ += `<line x1="${xo}" x2="${xo}" y1="${t-8}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 3"></line><text x="${xo + (droite ? -6 : 6)}" y="${t}" font-size="13" font-weight="600" text-anchor="${droite ? "end" : "start"}">${nom} observé = ${f2(obs)}</text>`;
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = h_;
  return {crit, nom};
}

/* ---------- jauges de taille d'effet ---------- */
function jauges(svg, rows){
  const W = A.largeur(svg), l = Math.min(300, W*.46), r = 20, rowH = 46, H = rows.length*rowH + 6;
  let h = "";
  rows.forEach((row, i) => {
    const s = SEUILS[row.type], max = s[2]*1.6, X = v => l + (W-l-r)*Math.min(Math.abs(v), max)/max, y = i*rowH + 6;
    h += `<g data-tip="${A.esc(`<b>${row.label}</b><br>${NOM_EFFET[row.type]} = ${f2(row.v)} : effet ${niveau(row.type, row.v)}<br>seuils : ${s.map(x => A.fmt(x,2)).join(" · ")}`)}">
      <rect x="0" y="${y-4}" width="${W}" height="${rowH-4}" fill="transparent"></rect>
      <text x="${l-12}" y="${y+12}" font-size="13" font-weight="600" text-anchor="end">${A.esc(row.label.length > Math.floor((l-16)/7) ? row.label.slice(0, Math.floor((l-16)/7)-1) + "…" : row.label)}</text>
      <text x="${l-12}" y="${y+28}" font-size="12" text-anchor="end" class="mut">${NOM_EFFET[row.type]} = ${f2(row.v)} · ${niveau(row.type, row.v)}</text>
      <rect x="${l}" y="${y+6}" width="${W-l-r}" height="16" rx="4" fill="var(--soft)"></rect>
      <rect x="${l}" y="${y+6}" width="${Math.max(3, X(row.v)-l)}" height="16" rx="4" fill="var(--mod)"></rect>
      ${s.map((v,k) => `<line x1="${X(v)}" x2="${X(v)}" y1="${y+2}" y2="${y+26}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 2"></line>${i === 0 ? `<text x="${X(v)}" y="${y-0}" font-size="11" text-anchor="middle" class="mut">${["petit","moyen","fort"][k]}</text>` : ""}`).join("")}</g>`;
  });
  svg.setAttribute("viewBox", `0 -10 ${W} ${H+10}`); svg.innerHTML = h;
}

/* ======================================================
   Section CM 2
   ====================================================== */
function init(){
  if(!document.getElementById("cm2") || !window.AIAE) return;
  A = window.AIAE;
  const D = window.DATA || {offres:[]}, O = D.offres, N = O.length; if(!N) return;
  const source = `Données : dépôt metier (API France Travail), offres d'alternance actives au ${A.dateLong(D.maj)}.`;
  const SAL = O.map(o => ({o, v: A.salaire(o).v})).filter(s => s.v != null);
  const $ = s => document.querySelector(s);

  /* --- H1 : chi², Bac+5 × type d'annonceur --- */
  const ANN = ["École / CFA", "Entreprise", "Anonyme"].filter(a => O.some(o => o.employeur === a));
  const tab = ANN.map(a => [O.filter(o => o.employeur === a && o.niveau === "Bac+5").length, O.filter(o => o.employeur === a && o.niveau !== "Bac+5").length]);
  const r1 = chi2(tab);
  const parts1 = ANN.map((a,i) => `${a === "École / CFA" ? "écoles et CFA" : a === "Entreprise" ? "entreprises nommées" : "annonceurs anonymes"} ${A.pct(tab[i][0], tab[i][0]+tab[i][1])}`);
  /* --- H2 : test t, salaire × contrat --- */
  const app = SAL.filter(s => /apprentissage/i.test(s.o.contrat)).map(s => s.v), pro = SAL.filter(s => /profession/i.test(s.o.contrat)).map(s => s.v);
  const r2 = welch(pro, app), mw = mannWhitney(pro, app);
  /* --- H3 : ANOVA, salaire × type d'annonceur --- */
  const G3 = ANN.map(a => SAL.filter(s => s.o.employeur === a).map(s => s.v)).filter(g => g.length > 1);
  const r3 = anova(G3), kw = kruskal(G3);
  /* --- H4 : corrélation, longueur de l'annonce × salaire --- */
  const xs = SAL.map(s => s.o.description.length), ys = SAL.map(s => s.v);
  const r4 = pearson(xs, ys), sp = pearson(rangs(xs), rangs(ys));

  const HYP = [
    {id:"H1", court:"Bac+5 selon l'annonceur", question:"La mention d'un Bac+5 dépend-elle de qui publie l'offre ?",
     expl:"Bac+5 ou master mentionné (oui / non)", nExpl:"qualitative nominale", explic:"Type d'annonceur (école ou CFA, entreprise, anonyme)", nExplic:"qualitative nominale",
     test:"Chi² d'indépendance", type:"V", effet:r1.V, n:r1.N,
     h0:"La mention d'un Bac+5 est indépendante du type d'annonceur : la part d'offres Bac+5 est la même chez les écoles, les entreprises et les anonymes.",
     h1:"La part d'offres qui mentionnent un Bac+5 n'est pas la même selon le type d'annonceur.",
     vu:`Part d'offres qui mentionnent un Bac+5 : ${parts1.join(", ")}.`,
     stat:`chi² = ${f2(r1.chi2)}`, ddl:`${r1.df}`, p:r1.p, loi:{type:"chi", df:r1.df, stat:r1.chi2},
     cond:`Effectif attendu minimum ${A.fmt(r1.minAtt,1)} : la condition (au moins 5 par case) ${r1.minAtt >= 5 ? "est respectée" : "n'est pas respectée"}.`,
     puis:{ligne:0, n:r1.N, txt:`${A.fmt(r1.N)} offres au total`}},
    {id:"H2", court:"Salaire selon le contrat", question:"Le salaire minimum affiché dépend-il du type de contrat ?",
     expl:"Salaire mensuel brut minimum affiché", nExpl:"quantitative", explic:"Type de contrat (professionnalisation, apprentissage)", nExplic:"qualitative, deux groupes",
     test:"Test t de Welch", type:"d", effet:r2.d, n:app.length+pro.length,
     h0:"Le salaire moyen est le même en contrat de professionnalisation et en apprentissage.",
     h1:"Le salaire moyen n'est pas le même selon le contrat.",
     vu:`Moyennes : ${A.eur(moy(pro))} en professionnalisation (${pro.length} offres), ${A.eur(moy(app))} en apprentissage (${app.length} offres).`,
     stat:`t = ${f2(r2.t)}`, ddl:A.fmt(r2.df,1), p:r2.p, loi:{type:"t", df:r2.df, stat:r2.t},
     cond:`Groupes très inégaux (${pro.length} et ${app.length} offres) et salaires asymétriques : le test de Mann-Whitney, qui compare les rangs, donne ${pEq(mw.p)}.`,
     puis:{ligne:1, n:Math.min(app.length, pro.length), txt:`${Math.min(app.length, pro.length)} offres dans le plus petit groupe`}},
    {id:"H3", court:"Salaire selon l'annonceur", question:"Le salaire minimum affiché dépend-il de qui publie l'offre ?",
     expl:"Salaire mensuel brut minimum affiché", nExpl:"quantitative", explic:"Type d'annonceur (école ou CFA, entreprise, anonyme)", nExplic:"qualitative, trois groupes",
     test:"ANOVA à un facteur", type:"eta2", effet:r3.eta2, n:G3.flat().length,
     h0:"Le salaire moyen est le même chez les écoles, les entreprises et les anonymes.",
     h1:"Au moins un type d'annonceur a un salaire moyen différent des autres.",
     vu:`Moyennes : ${ANN.map((a,i) => `${a === "École / CFA" ? "écoles" : a === "Entreprise" ? "entreprises" : "anonymes"} ${A.eur(moy(G3[i]))} (${G3[i].length})`).join(", ")}.`,
     stat:`F = ${f2(r3.F)}`, ddl:`${r3.df1} et ${r3.df2}`, p:r3.p, loi:{type:"F", df1:r3.df1, df2:r3.df2, stat:r3.F},
     cond:`Salaires asymétriques et groupes inégaux : le test de Kruskal-Wallis, sur les rangs, donne ${pEq(kw.p)}.`,
     puis:{ligne:2, n:Math.min(...G3.map(g => g.length)), txt:`${Math.min(...G3.map(g => g.length))} offres dans le plus petit groupe`}},
    {id:"H4", court:"Salaire et longueur de l'annonce", question:"Les annonces les plus détaillées affichent-elles de meilleurs salaires ?",
     expl:"Salaire mensuel brut minimum affiché", nExpl:"quantitative", explic:"Longueur de l'annonce (nombre de caractères)", nExplic:"quantitative",
     test:"Corrélation de Pearson", type:"r", effet:r4.r, n:xs.length,
     h0:"Il n'y a pas de lien linéaire entre la longueur de l'annonce et le salaire (r = 0).",
     h1:"Il existe un lien linéaire entre la longueur de l'annonce et le salaire (r ≠ 0).",
     vu:`r = ${f2(r4.r)} sur ${xs.length} offres qui affichent un salaire.`,
     stat:`r = ${f2(r4.r)} (t = ${f2(r4.t)})`, ddl:`${r4.df}`, p:r4.p, loi:{type:"t", df:r4.df, stat:r4.t},
     cond:`Quelques salaires extrêmes pèsent sur r : la corrélation de Spearman, sur les rangs, vaut ${f2(sp.r)} (${pEq(sp.p)}).`,
     puis:{ligne:3, n:xs.length, txt:`${xs.length} offres`}}
  ];

  /* 1. Présentation : la loi sous H0, au choix de l'hypothèse */
  let sel = 0;
  const dessinerLoi = () => {
    const h = HYP[sel], res = loiH0($("#c-h0"), h);
    $("#h0-titre").textContent = `${h.id} · ${h.question} — si H0 est vraie, la statistique ${res.nom} suit cette loi (${h.ddl} degré${/^1$/.test(h.ddl) ? "" : "s"} de liberté)`;
    $("#cap-h0").innerHTML = h.p < .05
      ? `Lecture : la statistique observée (${h.stat}) tombe dans la zone de rejet, au-delà de ${f2(res.crit)}. Si H0 était vraie, un écart au moins aussi grand n'arriverait que ${h.p < .001 ? "moins d'une fois sur mille" : `${A.fmt(h.p*100, 1)} fois sur 100`} (${pEq(h.p)}) : on rejette H0. ${source}`
      : `Lecture : la statistique observée (${h.stat}) reste en deçà de ${f2(res.crit)}, hors de la zone de rejet. Si H0 était vraie, un écart au moins aussi grand arriverait ${A.fmt(h.p*100, 0)} fois sur 100 (${pEq(h.p)}) : on ne rejette pas H0. ${source}`;
    document.querySelectorAll("#h-tabs .chip").forEach((b,i) => b.setAttribute("aria-pressed", i === sel));
  };
  $("#h-tabs").innerHTML = HYP.map((h,i) => `<button class="chip" type="button" data-i="${i}">${h.id} · ${h.court}</button>`).join("");
  $("#h-tabs").addEventListener("click", e => { const b = e.target.closest(".chip"); if(b){ sel = +b.dataset.i; dessinerLoi(); } });
  A.dessine(dessinerLoi);

  /* 2. Variable expliquée / explicative */
  $("#t-roles").innerHTML = HYP.map(h => `<tr><td><b>${h.id}</b></td><td>${h.question}</td><td>${h.expl}<div class="s">${h.nExpl}</div></td><td>${h.explic}<div class="s">${h.nExplic}</div></td><td>${h.test}</td></tr>`).join("");

  /* 3. H0 et H1 */
  $("#hyp-cards").innerHTML = HYP.map(h => `<div class="hcard"><span class="eyebrow">${h.id} · ${h.test}</span><h3>${h.question}</h3>
    <dl><dt>H0</dt><dd>${h.h0}</dd><dt>H1</dt><dd>${h.h1}</dd></dl><p class="vu">${h.vu}</p></div>`).join("");

  /* 4. p-value et seuil de 5 % */
  $("#t-pval").innerHTML = HYP.map(h => `<tr><td><b>${h.id}</b> ${h.court}</td><td>${h.test}</td><td class="num">${h.stat}</td><td class="num">${h.ddl}</td><td class="num">${fp(h.p)}</td><td>${decision(h.p)}</td></tr>
    <tr class="cond"><td></td><td colspan="5">${h.cond}</td></tr>`).join("");
  const rej = HYP.filter(h => h.p < .05).map(h => h.id), nonRej = HYP.filter(h => h.p >= .05).map(h => h.id);
  $("#cap-pval").innerHTML = `Lecture : au seuil de 5 %, on rejette H0 pour ${rej.length ? rej.join(", ") : "aucune hypothèse"}${nonRej.length ? ` ; on ne la rejette pas pour ${nonRej.join(", ")}` : ""}. Tous les tests sont bilatéraux, comme dans les logiciels par défaut. Ne pas rejeter H0 ne prouve pas qu'elle est vraie : la section « puissance » dit si nous avions assez d'offres pour voir un écart. ${source}`;

  /* 5. Taille de l'effet */
  A.dessine(() => jauges($("#c-effet"), HYP.map(h => ({label:`${h.id} · ${h.court}`, type:h.type, v:h.effet}))));
  $("#cap-effet").innerHTML = "Lecture : " + HYP.map(h => `${h.id}, ${NOM_EFFET[h.type]} = ${f2(h.effet)}, effet ${niveau(h.type, h.effet)}${h.p < .05 ? "" : " mais non significatif"}`).join(" ; ") + `. Une p-value dit si un écart est probablement réel ; la taille de l'effet dit s'il compte. Seuils de Cohen (1988), en pointillés. ${source}`;

  /* 6. Puissance */
  $("#t-puis").innerHTML = PUISSANCE.map((p,i) => {
    const h = HYP.find(h => h.puis.ligne === i); if(!h) return "";
    const niv = niveau(h.type, h.effet), k = Math.max(0, ["petit","moyen","fort"].indexOf(niv)), lib = ["petit","moyen","fort"][k], ok = h.puis.n >= p.n[k];
    return `<tr><td>${p.test}<div class="s">${p.unite}</div></td>${p.n.map((n,j) => `<td class="num${j === k ? " vise" : ""}">${A.fmt(n)}</td>`).join("")}<td><b>${h.id}</b> : ${h.puis.txt}<div class="s">effet observé : ${niv}</div></td><td>${ok ? `<span class="dec oui">assez pour un effet ${lib}</span>` : `<span class="dec non">trop peu pour un effet ${lib}</span>`}</td></tr>`;
  }).join("");
  const h2 = HYP[1], nh = 2/(1/app.length + 1/pro.length), puisMoy = phi(.5*Math.sqrt(nh/2) - 1.96), puisFort = phi(.8*Math.sqrt(nh/2) - 1.96);
  $("#cap-puis").innerHTML = `Lecture : pour H2, ${pro.length} offres de professionnalisation affichent un salaire. Avec si peu d'observations, le test n'avait qu'environ ${A.fmt(100*puisMoy)} % de chances de détecter un écart moyen, et ${A.fmt(100*puisFort)} % un écart fort. Son « H0 non rejetée » ne prouve donc pas que les deux contrats paient pareil : il faudrait au moins ${PUISSANCE[1].n[1]} offres par groupe. À l'inverse, H1 porte sur ${A.fmt(r1.N)} offres : ${r1.N >= PUISSANCE[0].n[0] ? `bien au-delà des ${PUISSANCE[0].n[0]} qu'il faut pour voir même un petit effet` : `bien plus que les ${PUISSANCE[0].n[1]} qu'il faut pour voir un effet moyen (il en faudrait ${PUISSANCE[0].n[0]} pour un petit)`} : son résultat est solide. Pour H4, r = ${f2(r4.r)} est un petit effet : il faudrait ${PUISSANCE[3].n[0]} offres pour le détecter à coup sûr, nous en avons ${xs.length}. Effectifs pour une puissance de 80 % au seuil de 5 %, d'après Cohen (1992) ; en gras, la colonne qui correspond à l'effet observé.`;
}
})();
