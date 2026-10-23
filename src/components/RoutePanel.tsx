import { useState } from 'react';
import { ArrowUpDown, Bike, Car, Footprints, Loader2, Navigation, Plus, RotateCcw, Ruler, Save, Share2, Sparkles, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouteStore } from '../store/routeStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { formatDistance, formatDuration } from '../lib/format';
import { buildSchedule, formatClock, parseClock } from '../lib/schedule';
import { buildTour, createShareLink } from '../lib/share';
import { MAX_POINTS, type Mode, type Optimization } from '../types';
import { CsvImport } from './CsvImport';
import { FavoritesModal } from './FavoritesModal';
import { StopList } from './StopList';
import { SavingsCard } from './SavingsCard';
import { PasteImport } from './PasteImport';

const MODES: { id: Mode; label: string; Icon: typeof Car }[] = [
  { id: 'car', label: 'Voiture', Icon: Car },
  { id: 'bike', label: 'Vélo', Icon: Bike },
  { id: 'walk', label: 'À pied', Icon: Footprints },
];

const OPTIMS: { id: Optimization; label: string; Icon: typeof Zap }[] = [
  { id: 'time', label: 'Le plus rapide', Icon: Zap },
  { id: 'distance', label: 'Le plus court', Icon: Ruler },
];

const SERVICE_OPTIONS = [0, 2, 5, 10, 15, 20, 30, 45, 60];

export function RoutePanel() {
  const s = useRouteStore();
  const user = useAuthStore((a) => a.user);
  const [favFor, setFavFor] = useState<'first' | 'last' | null>(null);
  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const filled = s.stops.filter((r) => r.label.trim()).length;
  const schedule = s.result && !s.stale && s.result.legs.length === s.stops.length - 1
    ? buildSchedule(s.result.legs, parseClock(s.departAt), s.serviceMin * 60)
    : null;

  const save = async () => {
    if (!user) return toast.error('Vous devez être connecté pour sauvegarder un itinéraire');
    if (!s.result) return toast.error('Aucun itinéraire à sauvegarder');
    if (!routeName.trim()) return toast.error('Veuillez donner un nom à votre itinéraire');
    setSaving(true);
    const { stops } = s.result;
    const { error } = await supabase.from('routes').insert({
      user_id: user.id,
      name: routeName.trim(),
      origin: stops[0].label,
      destination: stops[stops.length - 1].label,
      waypoints: stops.slice(1, -1).map((p) => p.label),
      mode: s.mode,
      distance: Math.round(s.result.distance),
      duration: Math.round(s.result.duration),
    });
    setSaving(false);
    if (error) return toast.error("Impossible de sauvegarder l'itinéraire");
    toast.success('Itinéraire sauvegardé');
    setRouteName('');
    setShowSave(false);
  };

  const share = async () => {
    if (!user || !s.result || s.stale) return toast.error("Optimisez d'abord la tournée pour la partager");
    setSharing(true);
    try {
      const url = await createShareLink(user.id, buildTour(s.result, s.mode, s.departAt, s.serviceMin));
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Tournée Navimizer', text: 'Ma tournée', url });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié — valable 30 jours');
      } catch {
        window.prompt('Copiez ce lien (valable 30 jours) :', url);
      }
    } catch {
      toast.error('Impossible de créer le lien de partage');
    } finally {
      setSharing(false);
    }
  };

  const pick = (address: string) => {
    const row = favFor === 'first' ? s.stops[0] : s.stops[s.stops.length - 1];
    s.updateStop(row.id, { label: address });
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-4">
        {/* Résultat */}
        {s.result && (
          <section className={`space-y-3 rounded-lg border p-3 ${s.stale ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}>
            {s.stale && <p className="text-xs text-yellow-800">La liste a changé : relancez l'optimisation pour mettre à jour les heures d'arrivée.</p>}
            <SavingsCard />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white p-2 shadow-sm"><div className="text-[11px] text-gray-500">Distance</div><div className="text-sm font-semibold">{formatDistance(s.result.distance)}</div></div>
              <div className="rounded-lg bg-white p-2 shadow-sm"><div className="text-[11px] text-gray-500">Conduite</div><div className="text-sm font-semibold">{formatDuration(s.result.duration)}</div></div>
              <div className="rounded-lg bg-white p-2 shadow-sm"><div className="text-[11px] text-gray-500">Fin estimée</div><div className="text-sm font-semibold">{schedule ? formatClock(schedule.end) : '—'}</div></div>
            </div>
            <button onClick={() => s.setDriver(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
              <Navigation className="h-4 w-4" /> Démarrer la tournée (mode chauffeur)
            </button>
            {user && (
              <div>
                <button onClick={() => void share()} disabled={sharing || s.stale}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60">
                  {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Partager la tournée (lien)
                </button>
                <p className="mt-1 text-[11px] text-gray-500">Le chauffeur l'ouvre sans compte. Valable 30 jours : toute personne ayant le lien voit les adresses.</p>
              </div>
            )}
            {user && (showSave ? (
              <div className="flex gap-2">
                <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Ex : Tournée du lundi matin"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600" />
                <button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Sauvegarde...</> : 'OK'}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSave(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                <Save className="h-4 w-4" /> Sauvegarder
              </button>
            ))}
          </section>
        )}

        {/* Réglages */}
        <section className="space-y-2">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mode de transport">
            {MODES.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => s.setMode(id)} aria-pressed={s.mode === id}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium ${s.mode === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type d'optimisation">
            {OPTIMS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => s.setOptimization(id)} aria-pressed={s.optimization === id}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium ${s.optimization === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
              Départ à
              <input type="time" value={s.departAt} onChange={(e) => s.setDepartAt(e.target.value)} className="bg-transparent text-sm font-medium text-gray-900 outline-none" />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
              Durée d'arrêt
              <select value={s.serviceMin} onChange={(e) => s.setServiceMin(Number(e.target.value))} className="bg-transparent text-sm font-medium text-gray-900 outline-none">
                {SERVICE_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Liste des arrêts */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Arrêts <span className="font-normal text-gray-500">({s.stops.length}/{MAX_POINTS})</span></h2>
            <button type="button" onClick={s.swap} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ArrowUpDown className="h-3.5 w-3.5" /> Inverser départ/arrivée
            </button>
          </div>
          <StopList onFavorites={setFavFor} />
          <button type="button" onClick={() => s.addStop()} disabled={s.stops.length >= MAX_POINTS}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Ajouter un arrêt
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPasteOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
              <Sparkles className="h-4 w-4" /> Coller / Photo
            </button>
            <CsvImport />
          </div>
          <p className="text-xs text-gray-500">Glissez ⠿ pour réordonner : le tracé est recalculé dans votre ordre. Le départ et l'arrivée restent fixes lors de l'optimisation.</p>
        </section>

      </div>

      {/* Barre d'action toujours visible */}
      <div className="sticky bottom-0 flex gap-2 border-t border-gray-200 bg-white p-3">
        <button onClick={() => void s.compute({ showMap: true })} disabled={s.loading || filled < 2}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {s.loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {s.loading ? 'Optimisation en cours...' : "Optimiser l'itinéraire"}
        </button>
        <button onClick={s.reset} disabled={s.loading} aria-label="Réinitialiser"
          className="rounded-lg border border-gray-300 px-3 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><RotateCcw className="h-4 w-4" /></button>
      </div>

      {pasteOpen && <PasteImport onClose={() => setPasteOpen(false)} />}
      {favFor && <FavoritesModal onClose={() => setFavFor(null)} onSelect={pick} />}
    </div>
  );
}
