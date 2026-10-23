import type { Place } from '../types';

// Base Adresse Nationale (api-adresse.data.gouv.fr) : gratuite, sans clé, autocomplétion autorisée,
// limite de 50 requêtes/s par IP. Couvre la France.
const BASE = 'https://api-adresse.data.gouv.fr/search/';
const MIN_SCORE = 0.4;

export class GeocodeError extends Error {
  constructor(
    public kind: 'notfound' | 'unavailable',
    public label?: string,
  ) {
    super(kind);
  }
}

interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string; score: number };
}

export interface Suggestion extends Required<Place> {
  score: number;
}

async function ban(query: string, limit: number, autocomplete: boolean, signal?: AbortSignal): Promise<Suggestion[]> {
  // La BAN exige 3 caractères minimum, 200 maximum et 20 mots maximum.
  const q = query.trim().split(/\s+/).slice(0, 20).join(' ').slice(0, 200);
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: String(limit), autocomplete: autocomplete ? '1' : '0' });
  let res: Response;
  try {
    res = await fetch(`${BASE}?${params}`, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new GeocodeError('unavailable');
  }
  if (!res.ok) throw new GeocodeError('unavailable');
  const data = (await res.json()) as { features?: BanFeature[] };
  return (data.features ?? []).map((f) => ({
    label: f.properties.label,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    score: f.properties.score,
  }));
}

export const searchAddresses = (query: string, signal?: AbortSignal) => ban(query, 5, true, signal);

// Cache + simultanéité limitée pour géocoder jusqu'à 100 adresses sans saturer l'API.
const cache = new Map<string, Required<Place>>();
const MAX_PARALLEL = 8;
let active = 0;
const waiting: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export async function geocode(label: string): Promise<Required<Place>> {
  const key = label.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const [best] = await limited(() => ban(label, 1, false));
    if (!best || best.score < MIN_SCORE) throw new GeocodeError('notfound', label);
    const found = { label, lat: best.lat, lon: best.lon };
    cache.set(key, found);
    return found;
  } catch (e) {
    if (e instanceof GeocodeError) throw Object.assign(e, { label: e.label ?? label });
    throw e;
  }
}

/** Complète les coordonnées manquantes (sans toucher aux lieux déjà localisés). */
export async function ensureCoords(place: Place): Promise<Required<Place>> {
  if (place.lat !== undefined && place.lon !== undefined) return place as Required<Place>;
  return geocode(place.label);
}
