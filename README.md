# Alternances IAE

Site local pour trier les offres d'alternance marketing (France Travail) selon les parcours du groupe : 3 MOD, 1 Retail, 1 DCIB (Master Marketing Vente, IAE Clermont Auvergne).

## Ouvrir le site

Double-cliquez sur `index.html`. Il n'y a rien à installer et le site marche sans connexion (sauf les liens vers les annonces France Travail).

- **Tableau de bord** : le tri des offres, les chiffres par parcours, la carte des régions, les métiers et les offres prioritaires.
- **Offres** : la liste filtrable (parcours, zone, Bac+5, télétravail, recherche) et la fiche complète de chaque annonce. Export CSV possible.
- **Suivi du groupe** : les offres retenues, leur statut (à postuler, envoyée, entretien…) et qui s'en occupe.
- **Méthode** : comment les offres sont triées.

## Partager le suivi entre vous 5

Le suivi est enregistré dans le navigateur de chacun. Pour le partager : page Suivi, **Exporter la sauvegarde (.json)**, envoyez le fichier aux autres, qui cliquent sur **Importer une sauvegarde**. L'import fusionne les deux suivis et garde la version la plus récente de chaque offre.

## Mettre à jour les offres

Ouvrez le Terminal dans ce dossier puis lancez :

    bash scripts/mettre_a_jour.sh

Le script télécharge les dernières offres du dépôt [vincentfavarin/metier](https://github.com/vincentfavarin/metier), refait le tri et remplace `data/offres.js` et `data/offres.csv`. Le suivi du groupe n'est pas touché. Les règles de tri se trouvent dans `scripts/classer.rb`.
