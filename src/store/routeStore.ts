import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { MAX_POINTS, type Mode, type Optimization, type Place, type RouteResult, type StopRow, type Visit } from '../types';
import { ensureCoords, GeocodeError } from '../lib/geocode';
import { OptimizeError, requestRoute } from '../lib/routing';
import { clearForm, loadForm, saveForm } from '../lib/formStorage';
import { nextQuarter } from '../lib/schedule';

interface ComputeOptions {
  /** false : garder l'ordre de la liste et recalculer uniquement le tracé. */
  optimize?: boolean;
  /** Demander l'affichage de la carte (mobile). */
  showMap?: boolean;
}

interface RouteState {
  mode: Mode;
  optimization: Optimization;
  stops: StopRow[];
  departAt: string;
  serviceMin: number;
  result: RouteResult | null;
  /** true dès que la liste a changé depuis le dernier calcul : les heures d'arrivée ne sont plus fiables. */
  stale: boolean;
  loading: boolean;
  mapSignal: number;
  visits: Record<string, Visit>;
  driver: boolean;

  setMode: (m: Mode) => void;
  setOptimization: (o: Optimization) => void;
  setDepartAt: (t: string) => void;
  setServiceMin: (m: number) => void;
  updateStop: (id: string, p: Place) => void;
  addStop: (p?: Place) => void;
  addStops: (labels: string[]) => number;
  removeStop: (id: string) => void;
  reorder: (from: number, to: number) => void;
  swap: () => void;
  reset: () => void;
  load: (r: { origin: string; destination: string; waypoints: string[]; mode: Mode }) => void;
  verify: () => Promise<void>;
  compute: (opts?: ComputeOptions) => Promise<void>;
  setVisit: (id: string, v: Visit | undefined) => void;
  setDriver: (on: boolean) => void;
}

const newRow = (p: Place = { label: '' }): StopRow => ({
  id: crypto.randomUUID(),
  label: p.label,
  lat: p.lat,
  lon: p.lon,
  status: p.lat !== undefined ? 'ok' : 'idle',
});
const blankList = () => [newRow(), newRow()];

const restored = loadForm();
let requestId = 0;

const geocodeMessage = (e: unknown) =>
  e instanceof GeocodeError && e.kind === 'notfound' ? 'Adresse introuvable' : 'Recherche indisponible';

export const useRouteStore = create<RouteState>((set, get) => {
  const filledCount = () => get().stops.filter((s) => s.label.trim()).length;
  const ready = () => {
    const { stops } = get();
    return stops.length >= 2 && Boolean(stops[0].label.trim()) && Boolean(stops[stops.length - 1].label.trim());
  };

  const patchRow = (id: string, patch: Partial<StopRow>) =>
    set((s) => ({ stops: s.stops.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  /** Géocode les lignes sans coordonnées ; renvoie les lignes résolues (dans l'ordre) ou null si l'une échoue. */
  const resolve = async (rows: StopRow[], id: number): Promise<StopRow[] | null> => {
    const todo = rows.filter((r) => r.lat === undefined);
    todo.forEach((r) => patchRow(r.id, { status: 'checking', error: undefined }));
    const settled = await Promise.allSettled(todo.map((r) => ensureCoords(r)));
    if (id !== requestId) return null;
    let firstError: unknown;
    const resolved = new Map<string, StopRow>();
    settled.forEach((res, i) => {
      const row = todo[i];
      if (res.status === 'fulfilled') {
        patchRow(row.id, { lat: res.value.lat, lon: res.value.lon, status: 'ok', error: undefined });
        resolved.set(row.id, { ...row, lat: res.value.lat, lon: res.value.lon, status: 'ok' });
      } else {
        patchRow(row.id, { status: 'error', error: geocodeMessage(res.reason) });
        firstError ??= Object.assign(res.reason, { label: (res.reason as GeocodeError).label ?? row.label });
      }
    });
    if (firstError) {
      const e = firstError as GeocodeError;
      toast.error(
        e instanceof GeocodeError && e.kind === 'notfound'
          ? `Adresse introuvable : « ${e.label} ». Corrigez-la dans la liste.`
          : "La recherche d'adresses est temporairement indisponible. Réessayez dans quelques instants.",
      );
      return null;
    }
    return rows.map((r) => resolved.get(r.id) ?? r);
  };

  const recompute = (optimize: boolean) => {
    if (ready()) void get().compute({ optimize });
  };

  return {
    mode: restored?.mode ?? 'car',
    optimization: restored?.optimization ?? 'time',
    stops: restored?.stops && restored.stops.length >= 2 ? restored.stops : blankList(),
    departAt: restored?.departAt ?? nextQuarter(),
    serviceMin: restored?.serviceMin ?? 5,
    result: null,
    stale: false,
    loading: false,
    mapSignal: 0,
    visits: restored?.visits ?? {},
    driver: false,

    setMode: (mode) => { set({ mode }); recompute(true); },
    setOptimization: (optimization) => { set({ optimization }); recompute(true); },
    setDepartAt: (departAt) => set({ departAt }),
    setServiceMin: (serviceMin) => set({ serviceMin }),

    updateStop: (id, p) =>
      set((s) => ({
        stale: true,
        stops: s.stops.map((r) =>
          r.id === id
            ? { id, label: p.label, lat: p.lat, lon: p.lon, status: p.lat !== undefined ? 'ok' : 'idle' }
            : r,
        ),
      })),

    addStop: (p) => {
      if (get().stops.length >= MAX_POINTS) {
        toast.error(`Le nombre maximum de points est de ${MAX_POINTS}`);
        return;
      }
      // Les nouveaux arrêts s'insèrent avant l'arrivée
      set((s) => ({ stale: true, stops: [...s.stops.slice(0, -1), newRow(p), s.stops[s.stops.length - 1]] }));
    },

    addStops: (labels) => {
      if (get().stops.length + labels.length > MAX_POINTS) {
        toast.error(`Le nombre maximum de points est de ${MAX_POINTS}`);
        return 0;
      }
      set((s) => ({ stale: true, stops: [...s.stops.slice(0, -1), ...labels.map((label) => newRow({ label })), s.stops[s.stops.length - 1]] }));
      void get().verify();
      return labels.length;
    },

    removeStop: (id) => {
      const { stops, result } = get();
      if (stops.length <= 2) {
        // Départ et arrivée restent toujours présents : on vide simplement la ligne
        get().updateStop(id, { label: '' });
        return;
      }
      set((s) => ({ stale: true, stops: s.stops.filter((r) => r.id !== id) }));
      if (result) recompute(false);
    },

    reorder: (from, to) => {
      if (from === to) return;
      set((s) => ({ stale: true, stops: arrayMove(s.stops, from, to) }));
      if (get().result) recompute(false);
    },

    swap: () => {
      set((s) => {
        const stops = [...s.stops];
        [stops[0], stops[stops.length - 1]] = [stops[stops.length - 1], stops[0]];
        return { stops, stale: true };
      });
      recompute(true);
    },

    reset: () => {
      requestId++;
      clearForm();
      set({ stops: blankList(), result: null, stale: false, loading: false, mode: 'car', optimization: 'time', visits: {}, driver: false });
    },

    load: ({ origin, destination, waypoints, mode }) => {
      set({
        mode,
        stops: [origin, ...waypoints, destination].map((label) => newRow({ label })),
        visits: {},
        stale: true,
      });
      void get().compute({ optimize: true, showMap: true });
    },

    /** Vérifie les adresses saisies sans lancer le calcul (utile après un import). */
    verify: async () => {
      const id = ++requestId;
      await resolve(get().stops.filter((r) => r.label.trim()), id);
    },

    compute: async ({ optimize = true, showMap = false } = {}) => {
      if (!ready() || filledCount() < 2) {
        toast.error('Veuillez saisir une origine et une destination');
        return;
      }
      const id = ++requestId;
      set({ loading: true });
      try {
        // Les lignes vides sont ignorées (le départ et l'arrivée sont garantis par ready())
        const filled = get().stops.filter((s) => s.label.trim());
        const rows = await resolve(filled, id);
        if (id !== requestId) return;
        if (!rows) return void set({ loading: false });

        const { mode, optimization } = get();
        const result = await requestRoute({
          points: rows.map((r) => ({ label: r.label, lat: r.lat!, lon: r.lon! })),
          mode,
          optimization,
          optimize,
        });
        if (id !== requestId) return;
        set((s) => ({
          // La liste prend l'ordre de passage calculé : c'est la tournée.
          stops: result.order.map((i) => rows[i]),
          result,
          stale: false,
          loading: false,
          mapSignal: showMap ? s.mapSignal + 1 : s.mapSignal,
        }));
        toast.success(optimize ? 'Itinéraire optimisé' : 'Itinéraire recalculé');
      } catch (e) {
        if (id !== requestId) return;
        set({ loading: false });
        toast.error(
          e instanceof OptimizeError && e.code === 'no_route'
            ? "Aucun itinéraire n'a été trouvé entre ces points."
            : "Une erreur est survenue lors du calcul de l'itinéraire. Réessayez dans quelques instants.",
        );
      }
    },

    setVisit: (id, v) =>
      set((s) => {
        const visits = { ...s.visits };
        if (v) visits[id] = v;
        else delete visits[id];
        return { visits };
      }),
    setDriver: (driver) => set({ driver }),
  };
});

// Persistance locale (24 h)
const persist = () => {
  const { mode, optimization, stops, departAt, serviceMin, visits } = useRouteStore.getState();
  saveForm({
    mode,
    optimization,
    departAt,
    serviceMin,
    visits,
    stops: stops.map((s) => ({ ...s, status: s.lat !== undefined ? 'ok' : 'idle', error: undefined })),
  });
};
useRouteStore.subscribe(persist);
window.addEventListener('pagehide', persist);
