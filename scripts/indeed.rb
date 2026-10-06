# encoding: utf-8
# Canal Indeed : réduit les données ouvertes d'Indeed Hiring Lab (Job Postings Index, licence CC BY 4.0)
# à ce que le site affiche, et écrit data/indeed.js.
#
# Usage : ruby scripts/indeed.rb <aggregate_job_postings_FR.csv> <job_postings_by_sector_FR.csv> <regional_fr.csv>
# Source : https://github.com/hiring-lab/job_postings_tracker (dossier FR)
require "csv"
require "json"

agg, sect, reg = ARGV
abort "Usage : ruby scripts/indeed.rb <aggregate FR> <sector FR> <regional FR>" unless agg && sect && reg
racine = File.expand_path("..", __dir__)
DEBUT = "2024-01-01"
SECTEURS = ["Marketing", "Sales", "Retail", "Media & Communications"]  # MOD, DCIB, Retail, communication

serie = ->(rows) { rows.select { |r| r[0] >= DEBUT }.sort_by(&:first) }
out = { maj: nil, debut: DEBUT, france: {}, secteurs: {}, region: {} }

# France entière (indice corrigé des variations saisonnières)
%w[total new].each { |v| out[:france][v] = [] }
CSV.foreach(agg, headers: true) do |r|
  v = r["variable"].to_s.start_with?("new") ? "new" : "total"
  out[:france][v] << [r["date"], r["indeed_job_postings_index_SA"].to_f]
end
# Secteurs
SECTEURS.each { |s| out[:secteurs][s] = { "total" => [], "new" => [] } }
CSV.foreach(sect, headers: true) do |r|
  s = r["display_name"]; next unless out[:secteurs][s]
  v = r["variable"].to_s.start_with?("new") ? "new" : "total"
  out[:secteurs][s][v] << [r["date"], r["indeed_job_postings_index"].to_f]
end
# Régions (tous secteurs) : Auvergne-Rhône-Alpes et Île-de-France
REGIONS = { "ara" => "Auvergne-Rhône-Alpes", "a8" => "Île-de-France" }
REGIONS.each_value { |n| out[:region][n] = [] }
CSV.foreach(reg, headers: true) do |r|
  n = REGIONS[r["region"]]; next unless n
  out[:region][n] << [r["date"], r["indeed_job_postings_index"].to_f]
end

out[:france].transform_values!(&serie)
out[:secteurs].each_value { |h| h.transform_values!(&serie) }
out[:region].transform_values!(&serie)
out[:maj] = out[:france]["total"].last&.first

File.write(File.join(racine, "data", "indeed.js"),
  "// Généré par scripts/indeed.rb le #{Time.now.strftime("%d/%m/%Y %H:%M")}. Source : Indeed Hiring Lab, Job Postings Index (CC BY 4.0).\n" \
  "window.INDEED = " + JSON.generate(out) + ";\n", encoding: "utf-8")
puts "Canal Indeed : données au #{out[:maj]}, secteurs #{SECTEURS.join(", ")}."
