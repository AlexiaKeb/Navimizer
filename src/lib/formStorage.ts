import type { Mode, Optimization, StopRow, Visit } from '../types';

const KEY = 'navimizer_form';
const TTL = 24 * 60 * 60 * 1000;

export interface FormData {
  mode: Mode;
  optimization: Optimization;
  stops: StopRow[];
  departAt: string; // "HH:MM"
  serviceMin: number;
  visits: Record<string, Visit>;
}

interface LegacyData {
  mode: Mode;
  optimization: Optimization;
  origin: { label: string; lat?: number; lon?: number };
  destination: { label: string; lat?: number; lon?: number };
  waypoints: { id: string; label: string; lat?: number; lon?: number }[];
}

const toRow = (p: { id?: string; label: string; lat?: number; lon?: number }): StopRow => ({
  id: p.id ?? crypto.randomUUID(),
  label: p.label,
  lat: p.lat,
  lon: p.lon,
  status: p.lat !== undefined ? 'ok' : 'idle',
});

/** Reprend aussi l'ancien format (origine / destination / waypoints séparés). */
function migrate(data: FormData | LegacyData): Partial<FormData> {
  if ('stops' in data) {
    return { ...data, stops: data.stops.map((s) => ({ ...s, status: s.lat !== undefined ? 'ok' : 'idle', error: undefined })) };
  }
  return {
    mode: data.mode,
    optimization: data.optimization,
    stops: [data.origin, ...data.waypoints, data.destination].map(toRow),
  };
}

export function loadForm(): Partial<FormData> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw) as { savedAt: number; data: FormData | LegacyData };
    if (Date.now() - savedAt > TTL) {
      localStorage.removeItem(KEY);
      return null;
    }
    return migrate(data);
  } catch {
    return null;
  }
}

export function saveForm(data: FormData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* stockage indisponible */
  }
}

export function clearForm() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
