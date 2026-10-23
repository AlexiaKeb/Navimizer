# Navimizer

Optimisation d'itinéraires multi-arrêts (jusqu'à 100 points) — React 18, Vite, TypeScript, Tailwind, Zustand, Leaflet, Supabase.

## Architecture

```
navigateur ──(JWT)──> fonction Supabase `optimize` ──> serveurs OSRM (table + route)
     │                      └─ solveur d'ordre (exact ≤ 12 arrêts, heuristique au-delà)
     └─ adresses : Base Adresse Nationale (api-adresse.data.gouv.fr)
```

- `supabase/functions/_shared/` : solveur et orchestration, partagés par la fonction serveur et le navigateur.
- `supabase/functions/optimize/` : fonction serveur. **Repli automatique** : si elle n'est pas déployée, le navigateur
  calcule directement avec les serveurs publics (utile en développement, déconseillé en production).
- `infra/osrm/` : héberger ses propres serveurs de routage.

## Fonctionnalités clés

- **Économies chiffrées** : après chaque optimisation, temps, distance, carburant et CO₂ gagnés par rapport à l'ordre saisi.
- **Import intelligent** : coller un e-mail, un message ou un tableau, ou photographier une liste. Les listes propres sont lues
  localement (gratuit) ; le reste est analysé par Claude (fonction `extract-addresses`, quota par utilisateur). Les adresses sont
  vérifiées par l'utilisateur avant d'être ajoutées.
- **Partage par lien** : `/t/<jeton>` ouvre la tournée sans compte (liste, heures, mode chauffeur). Valable 30 jours, jeton secret de 256 bits.
- **Mode chauffeur** : un arrêt à la fois, navigation Waze / Google Maps, livré / échec.

## Démarrage

```bash
cp .env.example .env        # URL + clé anon Supabase
npm install
npm run dev
npm test                    # solveur, orchestration (faux serveur OSRM), géocodage
```

Base de données : appliquer `supabase/migrations/001_routes.sql`. Désactiver la confirmation par email (Auth).

## Base de données (migrations à appliquer dans l'ordre)

| Fichier | Contenu |
|---|---|
| `001_routes.sql` | itinéraires sauvegardés (RLS : chacun ses données) |
| `002_ai_quota.sql` | quota quotidien d'analyses IA par utilisateur |
| `003_shared_routes.sql` | tournées partagées par lien (lecture publique uniquement via le jeton) |
| `004_rls_initplan.sql` | optimisation des règles de sécurité (évaluation unique de `auth.uid()`) |

## Fonctions serveur (Supabase Edge Functions)

| Fonction | Rôle | Secrets |
|---|---|---|
| `optimize` | ordre optimal d'une tournée | `OSRM_URL_CAR`, `OSRM_URL_BIKE`, `OSRM_URL_FOOT` (optionnels) |
| `extract-addresses` | adresses depuis un texte en vrac ou une photo (Claude) | `ANTHROPIC_API_KEY` (obligatoire), `ANTHROPIC_MODEL` (défaut `claude-opus-5-5` ; `claude-haiku-5-5` pour réduire fortement le coût), `AI_DAILY_LIMIT` (défaut 30 par utilisateur et par jour) |

Sans `ANTHROPIC_API_KEY`, l'import de texte reste utilisable (lecture simple) ; l'import par photo est désactivé.

## Déploiement

- Front (Netlify ou Render Static Site) : `npm install && npm run build`, dossier `dist`, réécriture `/*` → `/index.html`.
- Fonctions : `supabase functions deploy optimize` et `supabase functions deploy extract-addresses`.
- En-têtes de sécurité (CSP, anti-clickjacking) : `public/_headers` (Netlify) ou `render.yaml` (Render, Blueprint) ; sinon les recopier dans l'onglet Headers du tableau de bord Render.

## Avant la mise en production

Pages légales, vrais témoignages, serveurs de routage dédiés.

## Écran principal

Une seule liste d'arrêts (glisser-déposer, tactile compris) : le premier est le départ, le dernier l'arrivée (fixes lors de
l'optimisation). Chaque adresse affiche son statut (reconnue / introuvable), l'import CSV est vérifié immédiatement.
Après un calcul, la liste prend l'ordre de passage et affiche heure d'arrivée, distance et durée de chaque étape
(heure de départ et durée d'arrêt réglables). Réordonner à la main recalcule le tracé dans votre ordre, sans ré-optimiser.
Le **mode chauffeur** présente un arrêt à la fois (navigation Waze/Google Maps, livré / échec) ; la progression est
conservée 24 h dans le navigateur.
