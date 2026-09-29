# encoding: utf-8
# Trie les offres d'alternance du dépôt vincentfavarin/metier pour le groupe
# (3 MOD, 1 Retail, 1 DCIB) et écrit data/offres.js + data/offres.csv.
#
# Usage : ruby scripts/classer.rb <actives.csv> <dossier brut> <date AAAA-MM-JJ>
require "json"
require "csv"

actives_csv, brut_dir, date_maj = ARGV
abort "Usage : ruby scripts/classer.rb <actives.csv> <dossier brut> <date>" unless actives_csv && brut_dir && date_maj
racine = File.expand_path("..", __dir__)

# 1. Offres actives du jour, dernière version de chaque annonce
actifs = {}
CSV.foreach(actives_csv, headers: true, encoding: "utf-8") { |l| actifs[l["id"]] = true }
dernieres = {}
Dir[File.join(brut_dir, "**", "*.jsonl")].each do |f|
  File.foreach(f, encoding: "utf-8") do |ligne|
    r = JSON.parse(ligne) rescue next
    next unless r["offre"] && actifs[r["id"]]
    prec = dernieres[r["id"]]
    dernieres[r["id"]] = r if prec.nil? || r["vu_le"].to_s >= prec["vu_le"].to_s
  end
end
alternances = dernieres.values.select do |r|
  o = r["offre"]
  o["alternance"] == true || o["natureContrat"].to_s =~ /apprentissage|professionnalisation/i
end

# 2. Règles de classement
AURA     = %w[01 03 07 15 26 38 42 43 63 69 73 74]
IDF      = %w[75 77 78 91 92 93 94 95]
ECOLE_NOM = /iscod|formation|business school|icademie|agepac|pigier|imparare|alternance|alfae|[eé]cole|school|campus|\bcfa\b|academy|institut format|iscom|efap|studi|openclassrooms|fcf-argos|e2se|tetranergy|ipac|ifag|mbway|ieseg|ascencia|groupe igs|digital school|sup de|napoleon|\bwis\b|ifocop|win sport/i
ECOLE_TXT = /notre [eé]cole|rejoindr?as? (notre|l['’]?)?\s*(école|ecole|formation)|tu rejoindras [A-Z]|entreprise partenaire|nos entreprises partenaires|titre rncp|frais de scolarit|(bachelor|mba|mastère|mastere) .{0,40}(en alternance|chez nous|au sein de notre)|inscri(s|ption|vez).{0,40}formation/i
MOD_ROME = %w[M1705 M1718 M1716 M1620 E1101 E1124 M1703 M1886 M1426 E1405 E1404 M1430 M1711 E1112]
RET_ROME = %w[D1506 D1415 D1438 E1113 M1706]
MOD_KW  = /marketing|digital|num[ée]rique|social media|r[ée]seaux sociaux|community|seo|sea|acquisition|growth|contenu|content|brand|marque|chef de produit|product|webmarket|emailing|crm|data|web/i
RET_KW  = /retail|magasin|boutique|enseigne|point de vente|merchandis|category|cat[ée]gor|trade marketing|relation client|exp[ée]rience client|service client|fid[ée]lisation|e-?commerce|omnicanal|distribution|grande distribution|gms|rayon/i
DCIB_KW = /export|international|business develop|biz ?dev|d[ée]veloppement commercial|d[ée]veloppeur commercial|commercial|key account|grands? comptes|b2b|ing[ée]nieur d.affaires|charg[ée].? d.affaires|account manager|sales|prospection|n[ée]gociation|appels? d.offres|adv\b|administration des ventes|import/i
BAC5  = /bac\s*\+\s*[45]|bac\s*\+\s*4\s*\/\s*5|master|mast[èe]re|\bmba\b|\bm1\b|\bm2\b|grande [ée]cole|\bmsc\b|[ée]cole de commerce|iae\b/i
BAC23 = /bac\s*\+\s*[23]|bachelor|licence|\bbts\b|\bbut\b|\bdut\b|niveau bac\b/i
BAS   = /conseill[eè]re? de vente|employ[ée]|lin[ée]aires|[ée]talagiste|vendeu|h[ôo]te|caissi|mise en rayon|t[ée]l[ée]conseill|t[ée]l[ée]op[ée]rat|service apr[èe]s|\bsav\b/i

offres = alternances.map do |r|
  o = r["offre"]
  titre = o["intitule"].to_s.strip.gsub(/\s+/, " ")
  desc  = o["description"].to_s
  role  = "#{titre} #{o["appellationlibelle"]}"
  nom   = o.dig("entreprise", "nom").to_s.strip
  lieu  = o.dig("lieuTravail", "libelle").to_s
  dep   = lieu[/^\d[\dAB]/] || ""

  ecole = (nom =~ ECOLE_NOM && nom !~ /institut national de recherche/i) || desc =~ ECOLE_TXT
  employeur = ecole ? "École / CFA" : (nom.empty? ? "Anonyme" : "Entreprise")

  mod    = MOD_ROME.include?(r["rome"]) || role =~ MOD_KW
  retail = RET_ROME.include?(r["rome"]) || role =~ RET_KW || desc.scan(RET_KW).size >= 3 || o["codeNAF"].to_s.start_with?("47")
  dcib   = role.sub(/affaires marketing/i, "") =~ DCIB_KW || desc.scan(/export|international|grands comptes|key account|b2b/i).size >= 2

  niveau = (desc =~ BAC5 || titre =~ BAC5) ? "Bac+5" : (desc =~ BAC23 ? "Bac+2/3" : "Non précisé")
  bas    = !!(titre =~ BAS)
  zone = if dep == "63" then "Puy-de-Dôme"
         elsif AURA.include?(dep) then "Auvergne-Rhône-Alpes"
         elsif IDF.include?(dep) || lieu =~ /le-de-France/ then "Île-de-France"
         else "Autres régions" end

  exclusion = if ecole then "Publiée par une école ou un CFA"
              elsif niveau == "Bac+2/3" then "Vise un Bac+2/3"
              elsif bas then "Poste de premier niveau"
              elsif !(mod || retail || dcib) then "Hors de nos parcours"
              else "" end

  score = 0
  score += 3 if employeur == "Entreprise"
  score += 1 if employeur == "Anonyme"
  score += 2 if niveau == "Bac+5"
  score += 2 if zone == "Puy-de-Dôme"
  score += 1 if zone == "Auvergne-Rhône-Alpes"

  {
    id: r["id"], titre: titre, metier: o["romeLibelle"].to_s, appellation: o["appellationlibelle"].to_s, rome: r["rome"],
    entreprise: nom.empty? ? "Entreprise non communiquée" : nom, employeur: employeur,
    lieu: lieu, dep: dep, zone: zone,
    contrat: o["natureContrat"].to_s, duree: o["typeContratLibelle"].to_s, temps: o["dureeTravailLibelleConverti"].to_s,
    niveau: niveau, experience: o["experienceLibelle"].to_s,
    mod: mod ? 1 : 0, retail: retail ? 1 : 0, dcib: dcib ? 1 : 0,
    teletravail: desc =~ /t[ée]l[ée]travail|remote|hybride/i ? 1 : 0,
    salaire: o.dig("salaire", "libelle").to_s, avantages: (o.dig("salaire", "listeComplements") || []).map { |c| c["libelle"] },
    competences: (o["competences"] || []).map { |c| c["libelle"] }, secteur: o["secteurActiviteLibelle"].to_s,
    effectif: o["trancheEffectifEtab"].to_s, date: o["dateCreation"].to_s[0, 10],
    description: desc, score: score, exclusion: exclusion, adaptee: exclusion.empty? ? 1 : 0,
    url: o.dig("origineOffre", "urlOrigine") || "https://candidat.francetravail.fr/offres/recherche/detail/#{r["id"]}"
  }
end
offres.sort! { |a, b| [b[:score], b[:date]] <=> [a[:score], a[:date]] }

meta = { maj: date_maj, actives: actifs.size, alternances: offres.size, adaptees: offres.count { |x| x[:adaptee] == 1 } }
File.write(File.join(racine, "data", "offres.js"),
           "// Généré par scripts/classer.rb le #{Time.now.strftime("%d/%m/%Y %H:%M")}\nwindow.DATA = " +
           JSON.generate(meta.merge(offres: offres)) + ";\n", encoding: "utf-8")

cols = %i[id titre entreprise employeur metier lieu zone contrat niveau mod retail dcib teletravail salaire secteur date score exclusion url]
CSV.open(File.join(racine, "data", "offres.csv"), "w:utf-8", col_sep: ";") do |csv|
  csv.to_io.write("﻿")
  csv << cols
  offres.each { |x| csv << cols.map { |c| x[c] } }
end

puts "Mise à jour du #{date_maj} : #{meta[:actives]} offres actives, #{meta[:alternances]} en alternance, #{meta[:adaptees]} adaptées au groupe."
%i[mod retail dcib].each { |k| puts "  #{k.to_s.upcase.ljust(6)} #{offres.count { |x| x[:adaptee] == 1 && x[k] == 1 }}" }
