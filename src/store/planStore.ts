import { create } from 'zustand';
import { isProStatus } from '../../supabase/functions/_shared/billing.ts';
import { FREE_MAX_POINTS, type UpgradeReason } from '../lib/plans';
import { supabase } from '../lib/supabase';
import { MAX_POINTS } from '../types';

interface PlanState {
  isPro: boolean;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loaded: boolean;
  /** Raison d'ouverture de la fenêtre de tarifs (null = fermée). */
  upgradeReason: UpgradeReason | null;
  refresh: () => Promise<void>;
  reset: () => void;
  openUpgrade: (reason?: UpgradeReason) => void;
  closeUpgrade: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  isPro: false,
  status: 'none',
  periodEnd: null,
  cancelAtPeriodEnd: false,
  loaded: false,
  upgradeReason: null,

  refresh: async () => {
    // La politique de sécurité de la base ne renvoie que la ligne de l'utilisateur connecté.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .maybeSingle();
    if (error) {
      set({ loaded: true }); // en cas d'erreur on conserve l'état connu (gratuit par défaut)
      return;
    }
    set({
      isPro: isProStatus(data?.status),
      status: data?.status ?? 'none',
      periodEnd: data?.current_period_end ?? null,
      cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
      loaded: true,
    });
  },

  reset: () => set({ isPro: false, status: 'none', periodEnd: null, cancelAtPeriodEnd: false, loaded: false, upgradeReason: null }),
  openUpgrade: (reason = 'plans') => set({ upgradeReason: reason }),
  closeUpgrade: () => set({ upgradeReason: null }),
}));

export const maxPointsFor = (isPro: boolean) => (isPro ? MAX_POINTS : FREE_MAX_POINTS);
export const currentMaxPoints = () => maxPointsFor(usePlanStore.getState().isPro);
