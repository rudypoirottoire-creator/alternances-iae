# Alternances IAE

Site local pour trier les offres d'alternance marketing (France Travail) selon les parcours du groupe : 3 MOD, 1 Retail, 1 DCIB (Master Marketing Vente, IAE Clermont Auvergne).

## Ouvrir le site

Double-cliquez sur `index.html`. Il n'y a rien à installer et le site marche sans connexion (sauf les liens vers les annonces France Travail).

- **Tableau de bord** : le tri des offres, les chiffres par parcours, la carte des régions, les métiers et les offres prioritaires.
- **Offres** : la liste filtrable (parcours, zone, Bac+5, télétravail, recherche) et la fiche complète de chaque annonce. Export CSV possible.
- **Suivi du groupe** : les offres retenues, leur statut (à postuler, envoyée, entretien…) et qui s'en occupe.
- **Analyse (TD 1)**, en bas du tableau de bord : l'analyse univariée demandée au TD 1 (nature des variables, effectifs et fréquences, moyenne/médiane/mode, dispersion, asymétrie, mise en classes, bon graphique, lecture avec un chiffre, désordre des données). Chaque graphique a sa phrase de lecture, recalculée à chaque mise à jour des données.
- **Méthode** : comment les offres sont triées.

## Partager le suivi entre vous 5

Le suivi est enregistré dans le navigateur de chacun. Pour le partager : page Suivi, **Exporter la sauvegarde (.json)**, envoyez le fichier aux autres, qui cliquent sur **Importer une sauvegarde**. L'import fusionne les deux suivis et garde la version la plus récente de chaque offre.

## Mettre à jour les offres

Ouvrez le Terminal dans ce dossier puis lancez :

    bash scripts/mettre_a_jour.sh

Le script télécharge les dernières offres du dépôt [vincentfavarin/metier](https://github.com/vincentfavarin/metier), refait le tri et remplace `data/offres.js` et `data/offres.csv`. Le suivi du groupe n'est pas touché. Les règles de tri se trouvent dans `scripts/classer.rb`.

## Les canaux

- **France Travail** : les offres analysées (dépôt public vincentfavarin/metier, API officielle).
- **Indeed** : les tendances du marché par secteur et par région, d'après les données ouvertes d'Indeed Hiring Lab (dépôt hiring-lab/job_postings_tracker, licence CC BY 4.0). Le script `scripts/indeed.rb` les réduit dans `data/indeed.js` ; `mettre_a_jour.sh` les télécharge. Les offres Indeed se consultent par des liens de recherche préremplis : aucune offre n'est collectée, les CGU d'Indeed l'interdisent.
- **Welcome to the Jungle** : consulté en lien (recherches prêtes à coller), pas de données collectées.
- **Arbeitnow** (API repérée dans la liste public-apis) : ses offres en France sont chargées en direct par la page `canaux.html`, à chaque visite.
- **Adzuna** : `scripts/canaux.rb` récupère ses offres avec les clés `ADZUNA_APP_ID` et `ADZUNA_APP_KEY` et écrit `data/canaux.js`, affiché sur la même page avec la mention « Jobs by Adzuna ».
