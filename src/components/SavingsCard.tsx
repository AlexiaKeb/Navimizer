import { Clock, Leaf, Route, Fuel } from 'lucide-react';
import { useRouteStore } from '../store/routeStore';
import { FUEL_ASSUMPTIONS } from '../lib/savings';
import { formatDistance, formatDuration } from '../lib/format';

/** Gains de l'optimisation par rapport à l'ordre saisi. */
export function SavingsCard() {
  const { savings, stale, mode } = useRouteStore();
  if (!savings || stale) return null;

  if (savings.optimal) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        👌 Votre ordre de passage était déjà optimal : rien à gagner sur cette tournée.
      </div>
    );
  }

  const tiles = [
    savings.duration >= 60 && { Icon: Clock, label: 'Temps gagné', value: formatDuration(savings.duration) },
    savings.distance >= 100 && { Icon: Route, label: 'Distance évitée', value: formatDistance(savings.distance) },
    savings.euros >= 0.1 && { Icon: Fuel, label: 'Carburant ≈', value: `${savings.euros.toFixed(2).replace('.', ',')} €` },
    savings.co2Kg >= 0.1 && { Icon: Leaf, label: 'CO₂ évité ≈', value: `${savings.co2Kg.toFixed(1).replace('.', ',')} kg` },
  ].filter(Boolean) as { Icon: typeof Clock; label: string; value: string }[];
  if (tiles.length === 0) return null;

  const pct = Math.round((Math.max(savings.duration, 0) / savings.baselineDuration) * 100);
  return (
    <section className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-3" aria-label="Économies réalisées">
      <h3 className="mb-2 text-sm font-semibold text-green-900">
        🎉 Vous économisez{pct >= 1 ? ` ${pct} % de temps` : ''} par rapport à votre ordre
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
            <Icon className="h-4 w-4 shrink-0 text-green-600" />
            <div><div className="text-[11px] text-gray-500">{label}</div><div className="text-sm font-semibold text-gray-900">{value}</div></div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-green-800/80">
        {savings.distance < 0 && 'Le trajet le plus rapide est un peu plus long en distance. '}
        {mode === 'car'
          ? `Estimation : ${FUEL_ASSUMPTIONS.litersPer100km} L/100 km, ${FUEL_ASSUMPTIONS.euroPerLiter.toFixed(2).replace('.', ',')} €/L.`
          : 'Les économies de carburant ne concernent que la voiture.'}
      </p>
    </section>
  );
}
