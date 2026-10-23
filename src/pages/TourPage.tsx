import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Map as MapIcon, Navigation } from 'lucide-react';
import { fetchSharedTour, type SharedTour } from '../lib/share';
import { buildSchedule, formatClock, parseClock } from '../lib/schedule';
import { formatDistance, formatDuration } from '../lib/format';
import { googleMapsUrl, GOOGLE_MAPS_MAX_POINTS } from '../lib/navLinks';
import type { Visit } from '../types';
import { DriverMode } from '../components/DriverMode';

type State = { status: 'loading' } | { status: 'notfound' } | { status: 'error' } | { status: 'ok'; tour: SharedTour };

/** Page publique d'une tournée partagée : consultable et exécutable sans compte. */
export default function TourPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [departAt, setDepartAt] = useState('');
  const [driver, setDriver] = useState(false);
  const storageKey = `navimizer_tour_${token}`;
  const [visits, setVisits] = useState<Record<string, Visit>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, Visit>;
    } catch {
      return {};
    }
  });

  // Lien privé : à ne pas indexer
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'Tournée partagée | Navimizer';
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSharedTour(token).then((r) => {
      if (cancelled) return;
      if (r.status === 'ok') setDepartAt(r.tour.departAt);
      setState(r);
    });
    return () => { cancelled = true; };
  }, [token]);

  const setVisit = (id: string, v: Visit | undefined) =>
    setVisits((prev) => {
      const next = { ...prev };
      if (v) next[id] = v;
      else delete next[id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });

  const tour = state.status === 'ok' ? state.tour : null;
  const schedule = useMemo(
    () => (tour ? buildSchedule(tour.legs, parseClock(departAt || tour.departAt), tour.serviceMin * 60) : null),
    [tour, departAt],
  );

  if (state.status === 'loading') return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (!tour || !schedule) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MapIcon className="h-10 w-10 text-gray-400" />
        <h1 className="text-lg font-semibold">{state.status === 'error' ? 'Chargement impossible' : 'Tournée introuvable'}</h1>
        <p className="max-w-sm text-sm text-gray-600">
          {state.status === 'error' ? 'Vérifiez votre connexion et réessayez.' : 'Ce lien est incorrect ou a expiré (les liens sont valables 30 jours). Demandez-en un nouveau à la personne qui vous l\'a envoyé.'}
        </p>
      </div>
    );
  }

  const stops = tour.stops.map((s, i) => ({ id: String(i), ...s }));
  const done = stops.slice(1).filter((s) => visits[s.id]).length;

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col bg-white">
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-lg font-bold text-gray-900">
        <Navigation className="h-6 w-6 fill-blue-600 text-blue-600" /> Navi<span className="-ml-2 text-blue-600">mizer</span>
        <span className="ml-auto text-xs font-normal text-gray-500">Tournée partagée</span>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[11px] text-gray-500">Distance</div><div className="text-sm font-semibold">{formatDistance(tour.distance)}</div></div>
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[11px] text-gray-500">Conduite</div><div className="text-sm font-semibold">{formatDuration(tour.duration)}</div></div>
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[11px] text-gray-500">Fin estimée</div><div className="text-sm font-semibold">{formatClock(schedule.end)}</div></div>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">
          Heure de départ
          <input type="time" value={departAt} onChange={(e) => setDepartAt(e.target.value)} className="bg-transparent font-medium text-gray-900 outline-none" />
        </label>

        <button onClick={() => setDriver(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3.5 font-semibold text-white hover:bg-green-700">
          <Navigation className="h-5 w-5" /> {done > 0 ? `Reprendre la tournée (${done}/${stops.length - 1})` : 'Démarrer la tournée'}
        </button>
        <a href={googleMapsUrl(tour.stops, tour.mode)} target="_blank" rel="noopener noreferrer"
          className="block rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium hover:bg-gray-50">
          {tour.stops.length > GOOGLE_MAPS_MAX_POINTS ? `Ouvrir les ${GOOGLE_MAPS_MAX_POINTS} premiers arrêts dans Google Maps` : 'Ouvrir tout le trajet dans Google Maps'}
        </a>

        <ol className="space-y-2">
          {stops.map((s, i) => {
            const v = visits[s.id];
            const leg = i > 0 ? tour.legs[i - 1] : null;
            return (
              <li key={s.id} className={`flex gap-3 rounded-lg border p-3 ${i === 0 ? 'border-green-200 bg-green-50' : i === stops.length - 1 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${v === 'done' ? 'bg-green-600' : v === 'failed' ? 'bg-red-600' : i === 0 ? 'bg-green-600' : i === stops.length - 1 ? 'bg-blue-600' : 'bg-slate-600'}`}>
                  {v === 'done' ? '✓' : v === 'failed' ? '✗' : i === 0 ? 'D' : i === stops.length - 1 ? 'A' : i}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{s.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {i === 0 ? 'Départ' : 'Arrivée'} {formatClock(schedule.arrive[i])}
                    {leg && <> · {formatDistance(leg.distance)} · {formatDuration(leg.duration)}</>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </main>

      <footer className="border-t border-gray-100 p-4 text-center text-xs text-gray-500">Planifié avec Navimizer · la progression est enregistrée sur cet appareil</footer>

      {driver && (
        <DriverMode stops={stops} legs={tour.legs} arrive={schedule.arrive} mode={tour.mode} visits={visits} onVisit={setVisit} onClose={() => setDriver(false)} />
      )}
    </div>
  );
}
