import { FREE_MAX_POINTS } from '../../supabase/functions/_shared/billing.ts';
import { MAX_POINTS } from '../types';

export { FREE_MAX_POINTS };

/** Libellé du prix affiché (ex. « 19 € / mois »), à aligner sur le prix créé dans Stripe. Défini à la construction du site. */
export const PRO_PRICE_LABEL = (import.meta.env.VITE_PRO_PRICE_LABEL as string | undefined)?.trim() || null;

export const FREE_FEATURES = [
  `Jusqu'à ${FREE_MAX_POINTS} arrêts par tournée`,
  "Optimisation de l'ordre et économies chiffrées",
  "Heures d'arrivée, glisser-déposer",
  'Sauvegarde et historique des tournées',
  'Import CSV et listes d\'adresses',
];

export const PRO_FEATURES = [
  `Jusqu'à ${MAX_POINTS} arrêts par tournée`,
  'Mode chauffeur : livré / échec, navigation par arrêt',
  'Partage de tournée par lien (sans compte pour le chauffeur)',
  'Import intelligent : texte en vrac, e-mail, photo',
  'Tout le plan gratuit',
];

export type UpgradeReason = 'limit' | 'driver' | 'share' | 'ai' | 'plans';

export const UPGRADE_HEADLINES: Record<UpgradeReason, string> = {
  limit: `Le plan gratuit est limité à ${FREE_MAX_POINTS} arrêts par tournée`,
  driver: 'Le mode chauffeur est réservé au plan Pro',
  share: 'Le partage de tournée par lien est réservé au plan Pro',
  ai: "L'import intelligent (texte en vrac, photo) est réservé au plan Pro",
  plans: 'Choisissez votre formule',
};
