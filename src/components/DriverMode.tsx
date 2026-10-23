import { Check, ChevronLeft, ExternalLink, PartyPopper, X } from 'lucide-react';
import { useRouteStore } from '../store/routeStore';
import { buildSchedule, formatClock, parseClock } from '../lib/schedule';
import { formatDistance, formatDuration } from '../lib/format';
import { googleMapsToStop, wazeToStop } from '../lib/navLinks';

/** Mode chauffeur : un arrêt à la fois, plein écran, pensé pour le mobile. */
export function DriverMode() {
  const { stops, result, stale, mode, visits, setVisit, setDriver, departAt, serviceMin } = useRouteStore();
  if (!result || result.stops.length !== stops.length) return null;

  const total = stops.length - 1; // le départ n'est pas une visite
  const doneCount = stops.slice(1).filter((s) => visits[s.id]).length;
  const current = stops.findIndex((s, i) => i > 0 && !visits[s.id]);
  const finished = current === -1;
  const schedule = buildSchedule(result.legs, parseClock(departAt), serviceMin * 60);
  const failed = stops.slice(1).filter((s) => visits[s.id] === 'failed').length;

  const stop = finished ? null : result.stops[current];
  const leg = finished ? null : result.legs[current - 1];

  return (
    <div className="fixed inset-0 z-[4000] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Mode chauffeur">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <button onClick={() => setDriver(false)} className="flex items-center gap-1 text-sm text-gray-700"><ChevronLeft className="h-5 w-5" /> Quitter</button>
        <span className="text-sm font-semibold">{doneCount}/{total} arrêts</span>
      </header>
      <div className="h-1.5 bg-gray-100"><div className="h-full bg-green-600 transition-all" style={{ width: `${(doneCount / total) * 100}%` }} /></div>

      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {stale && <p className="rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800">La liste a changé depuis le dernier calcul : les heures peuvent être inexactes.</p>}

        {finished ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <PartyPopper className="h-14 w-14 text-green-600" />
            <h2 className="text-2xl font-bold">Tournée terminée</h2>
            <p className="text-gray-600">{total - failed} livré{total - failed > 1 ? 's' : ''}{failed > 0 && ` · ${failed} en échec`}</p>
            <button onClick={() => setDriver(false)} className="mt-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">Fermer</button>
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{current === stops.length - 1 ? 'A' : current}</span>
                Prochain arrêt
              </div>
              <p className="text-xl font-semibold leading-snug">{stop!.label}</p>
              <p className="mt-2 text-sm text-gray-600">
                Arrivée prévue <strong>{formatClock(schedule.arrive[current])}</strong>
                {leg && <> · {formatDistance(leg.distance)} · {formatDuration(leg.duration)}</>}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <a href={googleMapsToStop(stop!, mode)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium">Google Maps <ExternalLink className="h-4 w-4" /></a>
              <a href={wazeToStop(stop!)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium">Waze <ExternalLink className="h-4 w-4" /></a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVisit(stops[current].id, 'failed')} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 py-4 text-base font-semibold text-white"><X className="h-5 w-5" /> Échec</button>
              <button onClick={() => setVisit(stops[current].id, 'done')} className="flex items-center justify-center gap-2 rounded-lg bg-green-600 py-4 text-base font-semibold text-white"><Check className="h-5 w-5" /> Livré</button>
            </div>
          </>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Toute la tournée</h3>
          <ol className="space-y-1.5">
            {stops.slice(1).map((s, k) => {
              const i = k + 1;
              const v = visits[s.id];
              return (
                <li key={s.id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${i === current ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${v === 'done' ? 'bg-green-600' : v === 'failed' ? 'bg-red-600' : 'bg-slate-500'}`}>
                    {v === 'done' ? '✓' : v === 'failed' ? '✗' : i === stops.length - 1 ? 'A' : i}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{result.stops[i].label}</span>
                  <span className="text-xs text-gray-500">{formatClock(schedule.arrive[i])}</span>
                  {v && <button onClick={() => setVisit(s.id, undefined)} className="text-xs text-blue-600 underline">Annuler</button>}
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
