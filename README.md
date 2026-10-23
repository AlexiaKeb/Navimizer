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

## Démarrage

```bash
cp .env.example .env        # URL + clé anon Supabase
npm install
npm run dev
npm test                    # solveur, orchestration (faux serveur OSRM), géocodage
```

Base de données : appliquer `supabase/migrations/001_routes.sql`. Désactiver la confirmation par email (Auth).

## Déploiement

- Front (Netlify ou Render Static Site) : `npm install && npm run build`, dossier `dist`, réécriture `/*` → `/index.html`.
- Fonction : `supabase functions deploy optimize` (+ secrets `OSRM_URL_CAR|BIKE|FOOT` pour des serveurs dédiés).

## Avant la mise en production

Pages légales, vrais témoignages, serveurs de routage dédiés.

## Écran principal

Une seule liste d'arrêts (glisser-déposer, tactile compris) : le premier est le départ, le dernier l'arrivée (fixes lors de
l'optimisation). Chaque adresse affiche son statut (reconnue / introuvable), l'import CSV est vérifié immédiatement.
Après un calcul, la liste prend l'ordre de passage et affiche heure d'arrivée, distance et durée de chaque étape
(heure de départ et durée d'arrêt réglables). Réordonner à la main recalcule le tracé dans votre ordre, sans ré-optimiser.
Le **mode chauffeur** présente un arrêt à la fois (navigation Waze/Google Maps, livré / échec) ; la progression est
conservée 24 h dans le navigateur.
