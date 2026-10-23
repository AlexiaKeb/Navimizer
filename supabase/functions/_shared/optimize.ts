// Orchestration : matrice de coûts (OSRM /table) -> ordre optimal (solver) -> tracé (OSRM /route).
// Utilisé par la fonction serveur `optimize` et, en repli, directement par le navigateur.

import { solveOrder } from './solver.ts';
import { MAX_POINTS } from './types.ts';
import type { Leg, Mode, OptimizeRequest, Point, RouteResult, Stop } from './types.ts';

export type OptimizeErrorCode = 'invalid' | 'no_route' | 'upstream';

export class OptimizeError extends Error {
  constructor(public code: OptimizeErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'OptimizeError';
  }
}

export type Servers = Record<Mode, string>;

/** Serveurs publics de démonstration : sans garantie de disponibilité, à remplacer en production. */
export const PUBLIC_SERVERS: Servers = {
  car: 'https://router.project-osrm.org',
  bike: 'https://routing.openstreetmap.de/routed-bike',
  walk: 'https://routing.openstreetmap.de/routed-foot',
};

// Les serveurs OSRM ignorent le profil dans l'URL (un serveur = un profil) : "driving" est le segment attendu partout.
const PROFILE = 'driving';

const MODES: Mode[] = ['car', 'bike', 'walk'];

export function validateRequest(body: unknown): OptimizeRequest {
  const b = body as Partial<OptimizeRequest> | null;
  if (!b || typeof b !== 'object') throw new OptimizeError('invalid', 'Requête invalide');
  if (!MODES.includes(b.mode as Mode)) throw new OptimizeError('invalid', 'Mode de transport invalide');
  if (b.optimization !== 'time' && b.optimization !== 'distance')
    throw new OptimizeError('invalid', "Type d'optimisation invalide");
  if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > MAX_POINTS)
    throw new OptimizeError('invalid', `Entre 2 et ${MAX_POINTS} points sont attendus`);
  const points: Point[] = b.points.map((p) => {
    const q = p as Partial<Point>;
    const ok =
      typeof q.lat === 'number' && typeof q.lon === 'number' &&
      Number.isFinite(q.lat) && Number.isFinite(q.lon) &&
      Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180;
    if (!ok) throw new OptimizeError('invalid', 'Coordonnées invalides');
    return { label: String(q.label ?? '').slice(0, 300), lat: q.lat!, lon: q.lon! };
  });
  return { points, mode: b.mode as Mode, optimization: b.optimization, optimize: b.optimize !== false };
}

const coordPath = (pts: Point[]) => pts.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal: withTimeout(signal, 25_000) });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new OptimizeError('upstream', 'Service de routage injoignable');
  }
  // OSRM renvoie un JSON { code, message } même sur 400 (ex. NoRoute, NoSegment)
  let json: (T & { code?: string }) | null = null;
  try {
    json = (await res.json()) as T & { code?: string };
  } catch {
    /* corps non JSON */
  }
  if (json?.code === 'NoRoute' || json?.code === 'NoSegment' || json?.code === 'NoTable')
    throw new OptimizeError('no_route', json.code);
  if (!res.ok || !json || (json.code && json.code !== 'Ok'))
    throw new OptimizeError('upstream', `Service de routage : ${res.status} ${json?.code ?? ''}`.trim());
  return json;
}

interface OsrmLeg { distance: number; duration: number }

export async function optimizeRoute(
  req: OptimizeRequest,
  servers: Servers = PUBLIC_SERVERS,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const { points, mode, optimization, optimize } = validateRequest(req);
  const base = servers[mode];
  const n = points.length;

  let order = Array.from({ length: n }, (_, i) => i);
  if (n > 2 && optimize !== false) {
    const table = await getJson<{ durations: (number | null)[][]; distances: (number | null)[][] }>(
      `${base}/table/v1/${PROFILE}/${coordPath(points)}?annotations=duration,distance`,
      signal,
    );
    const raw = optimization === 'time' ? table.durations : table.distances;
    // Un trajet impossible (null) est rendu prohibitif plutôt qu'ignoré
    const cost = raw.map((row) => row.map((v) => (v === null ? 1e9 : v)));
    order = solveOrder(cost);
  }

  const ordered = order.map((i) => points[i]);
  const route = await getJson<{
    routes: { distance: number; duration: number; legs: OsrmLeg[]; geometry: { coordinates: [number, number][] } }[];
  }>(`${base}/route/v1/${PROFILE}/${coordPath(ordered)}?overview=full&geometries=geojson&steps=false`, signal);

  const r = route.routes?.[0];
  if (!r) throw new OptimizeError('no_route');

  const stops: Stop[] = ordered.map((p, i) => ({ ...p, kind: i === 0 ? 'start' : i === n - 1 ? 'end' : 'via' }));
  const legs: Leg[] = r.legs.map((l) => ({ distance: l.distance, duration: l.duration }));
  return {
    order,
    stops,
    legs,
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  };
}
