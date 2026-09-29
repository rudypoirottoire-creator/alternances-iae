#!/bin/bash
# Télécharge les dernières offres du dépôt vincentfavarin/metier et régénère data/offres.js.
# Usage : bash scripts/mettre_a_jour.sh
set -euo pipefail
cd "$(dirname "$0")/.."

API=https://api.github.com/repos/vincentfavarin/metier/contents/data
RAW=https://raw.githubusercontent.com/vincentfavarin/metier/main/data
CACHE=scripts/.cache
rm -rf "$CACHE" && mkdir -p "$CACHE/brut" data

echo "→ Recherche de la dernière liste d'offres actives…"
DERNIER=$(curl -fsSL "$API/actives" | jq -r '[.[].name | select(endswith(".csv"))] | sort | last')
curl -fsSL -o "$CACHE/actives.csv" "$RAW/actives/$DERNIER"
echo "  $DERNIER"

echo "→ Téléchargement des annonces brutes…"
for MOIS in $(curl -fsSL "$API/brut" | jq -r '.[] | select(.type == "dir") | .name'); do
  mkdir -p "$CACHE/brut/$MOIS"
  for F in $(curl -fsSL "$API/brut/$MOIS" | jq -r '.[] | select(.name | endswith(".jsonl")) | .name'); do
    curl -fsSL -o "$CACHE/brut/$MOIS/$F" "$RAW/brut/$MOIS/$F" &
  done
  wait
  echo "  $MOIS : $(ls "$CACHE/brut/$MOIS" | wc -l | tr -d ' ') fichiers"
done

echo "→ Classement des offres…"
ruby scripts/classer.rb "$CACHE/actives.csv" "$CACHE/brut" "${DERNIER%.csv}"
rm -rf "$CACHE"
echo "✓ Terminé. Rechargez index.html dans le navigateur."
