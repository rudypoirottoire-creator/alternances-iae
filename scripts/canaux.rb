# encoding: utf-8
# Autres canaux : récupère les offres de deux API d'emploi repérées dans la liste public-apis/public-apis
# (section Jobs) et écrit data/canaux.js, affiché par la page canaux.html.
#
#  - Arbeitnow : API publique, sans clé. Conditions : faire un lien vers arbeitnow.com.
#  - Adzuna    : API gratuite avec clé (variables ADZUNA_APP_ID et ADZUNA_APP_KEY). Conditions : chaque offre
#                affichée porte la mention « Jobs by Adzuna » avec un lien vers adzuna.fr ; publier des
#                statistiques (nombres d'offres, salaires moyens) demande un accord écrit d'Adzuna.
#                Sans clé, ce canal est simplement sauté.
#
# Usage : ruby scripts/canaux.rb
# Méthode Adzuna reprise du guide public du groupe H-Wen-LIN (github.com/H-Wen-LIN/metier, guide-adzuna.md).
require "json"
require "net/http"
require "uri"
require "time"

racine = File.expand_path("..", __dir__)
UA = "alternances-iae (projet etudiant IAE Clermont Auvergne)"

def get_json(url)
  uri = URI(url)
  req = Net::HTTP::Get.new(uri, "User-Agent" => UA, "Accept" => "application/json")
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 20, read_timeout: 40) { |h| h.request(req) }
  raise "HTTP #{res.code} sur #{uri.host}" unless res.is_a?(Net::HTTPSuccess)
  JSON.parse(res.body)
end

# Mêmes règles de parcours que scripts/classer.rb, appliquées au titre de l'offre
MOD_KW  = /marketing|digital|num[ée]rique|social media|r[ée]seaux sociaux|community|seo|sea\b|acquisition|growth|contenu|content|brand|marque|chef de produit|product marketing|emailing|crm|communication/i
RET_KW  = /retail|magasin|boutique|enseigne|point de vente|merchandis|category|cat[ée]gor|trade marketing|relation client|exp[ée]rience client|customer (success|experience)|e-?commerce|omnicanal|distribution/i
DCIB_KW = /export|international|business develop|biz ?dev|d[ée]veloppement commercial|commercial|key account|grands? comptes|b2b|account (manager|executive)|sales|prospection|n[ée]gociation|ing[ée]nieur d.affaires/i
ALT_KW  = /alternan|apprenti|contrat pro|work[- ]study/i
STAGE_KW = /\bstage\b|stagiaire|intern(ship)?\b/i
FRANCE  = /france|paris|lyon|marseille|lille|toulouse|bordeaux|nantes|clermont|rennes|strasbourg|montpellier|grenoble|nice|rouen|tours|dijon|angers|reims|le mans|aix|annecy|orl[ée]ans|metz|nancy|caen|brest|limoges|amiens|perpignan|besan[cç]on|saint-[ée]tienne|villeurbanne|boulogne|nanterre|puteaux|courbevoie|issy|levallois|neuilly|cergy|massy|[ée]vry|versailles/i

def offre(source, id:, titre:, entreprise:, lieu:, date:, url:, contrat: "", salaire: "", extrait: "")
  t = titre.to_s.strip.gsub(/\s+/, " ")
  { source: source, id: "#{source}-#{id}", titre: t, entreprise: entreprise.to_s.strip, lieu: lieu.to_s.strip,
    date: date.to_s[0, 10], url: url, contrat: contrat, salaire: salaire,
    alternance: (t =~ ALT_KW || contrat =~ ALT_KW) ? 1 : 0, stage: (t =~ STAGE_KW || contrat =~ STAGE_KW) ? 1 : 0,
    mod: t =~ MOD_KW ? 1 : 0, retail: t =~ RET_KW ? 1 : 0, dcib: t =~ DCIB_KW ? 1 : 0,
    extrait: extrait.to_s.gsub(/<[^>]+>/, " ").gsub(/&[a-z#0-9]+;/i, " ").gsub(/\s+/, " ").strip[0, 280] }
end

sources = {}
offres = []

# --- Arbeitnow : toutes les pages (300 offres par page), on garde la France et nos métiers ---
begin
  url = "https://www.arbeitnow.com/api/job-board-api"; pages = 0; vues = 0
  while url && pages < 15
    j = get_json(url); pages += 1
    (j["data"] || []).each do |x|
      vues += 1
      next unless x["location"].to_s =~ FRANCE
      o = offre("arbeitnow", id: x["slug"], titre: x["title"], entreprise: x["company_name"], lieu: x["location"],
                date: Time.at(x["created_at"].to_i).utc.iso8601, url: x["url"],
                contrat: (x["job_types"] || []).join(", "), extrait: x["description"])
      offres << o if o[:mod] + o[:retail] + o[:dcib] > 0 || o[:alternance] + o[:stage] > 0
    end
    url = j.dig("links", "next")
    sleep 1
  end
  sources[:arbeitnow] = { ok: true, pages: pages, vues: vues }
rescue => e
  sources[:arbeitnow] = { ok: false, erreur: e.message }
end

# --- Adzuna (France) : recherches dans le titre, offres des 7 derniers jours ---
ADZ_RECH = [
  ["mod", "alternance marketing"], ["mod", "marketing digital"], ["mod", "community manager"], ["mod", "chef de produit"],
  ["retail", "alternance commerce"], ["retail", "category manager"], ["retail", "e-commerce"],
  ["dcib", "business developer"], ["dcib", "commercial export"], ["dcib", "key account manager"], ["dcib", "alternance commercial"]
]
if ENV["ADZUNA_APP_ID"].to_s.empty? || ENV["ADZUNA_APP_KEY"].to_s.empty?
  sources[:adzuna] = { ok: false, erreur: "clé absente : ajouter ADZUNA_APP_ID et ADZUNA_APP_KEY dans les secrets du dépôt" }
else
  begin
    vus = {}; appels = 0
    ADZ_RECH.each do |_, q|
      p = URI.encode_www_form(app_id: ENV["ADZUNA_APP_ID"], app_key: ENV["ADZUNA_APP_KEY"], results_per_page: 50,
                              title_only: q, max_days_old: 7, sort_by: "date", "content-type" => "application/json")
      j = get_json("https://api.adzuna.com/v1/api/jobs/fr/search/1?#{p}"); appels += 1
      (j["results"] || []).each do |x|
        next if vus[x["id"]]; vus[x["id"]] = true
        sal = (x["salary_is_predicted"].to_s == "1" || !x["salary_min"]) ? "" : "#{x["salary_min"].to_i} à #{x["salary_max"].to_i} € par an"
        offres << offre("adzuna", id: x["id"], titre: x["title"], entreprise: x.dig("company", "display_name"),
                        lieu: x.dig("location", "display_name"), date: x["created"], url: x["redirect_url"],
                        contrat: [x["contract_type"], x["contract_time"]].compact.join(", "), salaire: sal, extrait: x["description"])
      end
      sleep 2.5 # 25 appels par minute au plus
    end
    sources[:adzuna] = { ok: true, appels: appels }
  rescue => e
    sources[:adzuna] = { ok: false, erreur: e.message }
  end
end

offres.sort_by! { |o| o[:date] }.reverse!  # les plus récentes d'abord
out = { maj: Time.now.utc.strftime("%Y-%m-%d"), sources: sources, offres: offres }
File.write(File.join(racine, "data", "canaux.js"),
  "// Généré par scripts/canaux.rb le #{Time.now.strftime("%d/%m/%Y %H:%M")}.\nwindow.CANAUX = " + JSON.generate(out) + ";\n", encoding: "utf-8")
puts "Autres canaux : #{offres.size} offres (" + sources.map { |k, v| "#{k} #{v[:ok] ? "ok" : "sauté : " + v[:erreur].to_s}" }.join(", ") + ")"
