import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BillingError, startCheckout } from '../lib/billing';
import { UPGRADE_HEADLINES } from '../lib/plans';
import { useEscape } from '../lib/useEscape';
import { usePlanStore } from '../store/planStore';
import { PricingCards } from './PricingCards';

/** Fenêtre « Passer Pro », ouverte depuis n'importe quel blocage via le store de plan. */
export function PricingModal() {
  const { upgradeReason, closeUpgrade, isPro } = usePlanStore();
  const [busy, setBusy] = useState(false);
  useEscape(closeUpgrade);
  if (!upgradeReason) return null;

  const upgrade = async () => {
    setBusy(true);
    try {
      await startCheckout(); // redirige vers Stripe : la page se quitte
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof BillingError ? e.message : 'Paiement indisponible');
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Passer Pro">
      <div className="my-auto w-full max-w-2xl rounded-lg bg-gray-50 p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{UPGRADE_HEADLINES[upgradeReason]}</h2>
          <button onClick={closeUpgrade} aria-label="Fermer"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <PricingCards isPro={isPro} proBusy={busy} onFree={closeUpgrade} onPro={() => void upgrade()} freeLabel="Rester en gratuit" />
      </div>
    </div>
  );
}
