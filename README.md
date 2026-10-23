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
| `005_billing.sql` | abonnements Stripe (`subscriptions`, fonction `is_pro()`), partage par lien réservé au plan Pro |

## Fonctions serveur (Supabase Edge Functions)

| Fonction | Rôle | Secrets |
|---|---|---|
| `optimize` | ordre optimal d'une tournée | `OSRM_URL_CAR`, `OSRM_URL_BIKE`, `OSRM_URL_FOOT` (optionnels) |
| `create-checkout` | ouvre le paiement Stripe (abonnement Pro) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `SITE_URL` |
| `customer-portal` | portail Stripe (carte, factures, résiliation) | `STRIPE_SECRET_KEY`, `SITE_URL` |
| `stripe-webhook` | tient la table `subscriptions` à jour (déployée **sans** JWT, signature Stripe vérifiée) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `extract-addresses` | adresses depuis un texte en vrac ou une photo (Claude) | `ANTHROPIC_API_KEY` (obligatoire), `ANTHROPIC_MODEL` (défaut `claude-opus-5-5` ; `claude-haiku-5-5` pour réduire fortement le coût), `AI_DAILY_LIMIT` (défaut 30 par utilisateur et par jour) |

Sans `ANTHROPIC_API_KEY`, l'import de texte reste utilisable (lecture simple) ; l'import par photo est désactivé.

## Abonnements Stripe

**Plans** (modifiables dans `supabase/functions/_shared/billing.ts` et `src/lib/plans.ts`) : Gratuit = 10 arrêts par tournée ;
Pro = 100 arrêts, mode chauffeur, partage par lien, import intelligent. Les limites sont **appliquées côté serveur** (fonctions
`optimize` et `extract-addresses`, règle de la base pour le partage) ; l'interface ne fait qu'expliquer.

**Mise en place (commencer en mode test de Stripe)**
1. Stripe → Produits : créer « Navimizer Pro » avec un prix récurrent mensuel ; noter l'identifiant du prix (`price_…`).
2. Stripe → Paramètres → Portail de facturation : activer le portail client (changement de carte, factures, résiliation).
3. Stripe → Développeurs → Webhooks : ajouter l'endpoint `https://<projet>.supabase.co/functions/v1/stripe-webhook` avec les
   événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` ; noter la clé de signature (`whsec_…`).
4. Supabase → Edge Functions → Secrets : `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`,
   `SITE_URL` (adresse du site, sans `/` final).
5. Variable du site (Render) : `VITE_PRO_PRICE_LABEL` = libellé affiché, identique au prix Stripe (ex. `19 € / mois`), puis redéployer.
6. Tester avec la carte `4242 4242 4242 4242`, puis refaire les étapes 3 et 4 avec les clés de production (`sk_live_…`).

**Donner le plan Pro à un compte sans paiement** (test, partenaire) :
`insert into public.subscriptions (user_id, status) select id, 'active' from auth.users where email = 'adresse@exemple.fr' on conflict (user_id) do update set status = 'active';`

**Avant de vendre** : mentions légales, CGV (droit de rétractation, résiliation), politique de confidentialité.

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
