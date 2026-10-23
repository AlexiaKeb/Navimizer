import { Check, Loader2 } from 'lucide-react';
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE_LABEL } from '../lib/plans';

interface Props {
  isPro?: boolean;
  proBusy?: boolean;
  onFree: () => void;
  onPro: () => void;
  freeLabel?: string;
}

/** Comparatif Gratuit / Pro, utilisé sur la page d'accueil et dans la fenêtre « Passer Pro ». */
export function PricingCards({ isPro, proBusy, onFree, onPro, freeLabel = 'Commencer gratuitement' }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-lg font-semibold">Gratuit</h3>
        <p className="mt-1 text-3xl font-bold">0 €</p>
        <ul className="my-4 flex-1 space-y-2 text-sm text-gray-700">
          {FREE_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />{f}</li>)}
        </ul>
        <button onClick={onFree} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">{freeLabel}</button>
      </div>

      <div className="relative flex flex-col rounded-lg border-2 border-blue-600 bg-white p-5 shadow-lg">
        <span className="absolute -top-3 left-5 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">Recommandé</span>
        <h3 className="text-lg font-semibold">Pro</h3>
        <p className="mt-1 text-3xl font-bold">{PRO_PRICE_LABEL ?? 'Abonnement'}</p>
        {!PRO_PRICE_LABEL && <p className="text-xs text-gray-500">Tarif affiché sur la page de paiement</p>}
        <ul className="my-4 flex-1 space-y-2 text-sm text-gray-700">
          {PRO_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{f}</li>)}
        </ul>
        <button onClick={onPro} disabled={proBusy || isPro}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {proBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPro ? 'Votre formule actuelle' : proBusy ? 'Redirection vers le paiement...' : 'Passer Pro'}
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">Paiement sécurisé par Stripe · résiliable à tout moment</p>
      </div>
    </div>
  );
}
