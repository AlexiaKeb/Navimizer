import type { Leg, Mode, Point, RouteResult } from '../types';
import { supabase } from './supabase';

/** Tournée partagée par lien : tout ce qu'il faut pour l'exécuter, sans compte. */
export interface SharedTour {
  v: 1;
  mode: Mode;
  departAt: string; // "HH:MM"
  serviceMin: number;
  stops: Point[];
  legs: Leg[];
  distance: number;
  duration: number;
}

export function buildTour(result: RouteResult, mode: Mode, departAt: string, serviceMin: number): SharedTour {
  return {
    v: 1,
    mode,
    departAt,
    serviceMin,
    stops: result.stops.map(({ label, lat, lon }) => ({ label, lat, lon })),
    legs: result.legs.map(({ distance, duration }) => ({ distance, duration })),
    distance: result.distance,
    duration: result.duration,
  };
}

const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Valide strictement une tournée reçue du serveur (ce contenu a été écrit par un autre utilisateur). */
export function parseSharedTour(raw: unknown): SharedTour | null {
  const t = raw as Partial<SharedTour> | null;
  if (!t || typeof t !== 'object' || t.v !== 1) return null;
  if (t.mode !== 'car' && t.mode !== 'bike' && t.mode !== 'walk') return null;
  if (typeof t.departAt !== 'string' || !/^\d{1,2}:\d{2}$/.test(t.departAt)) return null;
  if (!num(t.serviceMin, 0, 240) || !num(t.distance, 0, 1e8) || !num(t.duration, 0, 1e7)) return null;
  if (!Array.isArray(t.stops) || t.stops.length < 2 || t.stops.length > 100) return null;
  if (!Array.isArray(t.legs) || t.legs.length !== t.stops.length - 1) return null;

  const stops: Point[] = [];
  for (const s of t.stops) {
    if (!s || typeof s.label !== 'string' || !num(s.lat, -90, 90) || !num(s.lon, -180, 180)) return null;
    stops.push({ label: s.label.slice(0, 300), lat: s.lat, lon: s.lon });
  }
  const legs: Leg[] = [];
  for (const l of t.legs) {
    if (!l || !num(l.distance, 0, 1e8) || !num(l.duration, 0, 1e7)) return null;
    legs.push({ distance: l.distance, duration: l.duration });
  }
  return { v: 1, mode: t.mode, departAt: t.departAt, serviceMin: t.serviceMin, stops, legs, distance: t.distance, duration: t.duration };
}

export const shareUrl = (token: string) => `${window.location.origin}/t/${token}`;

/** Crée un lien de partage (valable 30 jours) et renvoie son adresse. */
export async function createShareLink(userId: string, tour: SharedTour): Promise<string> {
  const { data, error } = await supabase
    .from('shared_routes')
    .insert({ user_id: userId, payload: tour })
    .select('token')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Création du lien impossible');
  return shareUrl(data.token);
}

export type FetchTourResult = { status: 'ok'; tour: SharedTour } | { status: 'notfound' } | { status: 'error' };

export async function fetchSharedTour(token: string): Promise<FetchTourResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: 'notfound' };
  const { data, error } = await supabase.rpc('get_shared_route', { p_token: token });
  if (error) return { status: 'error' };
  const tour = parseSharedTour(data);
  return tour ? { status: 'ok', tour } : { status: 'notfound' };
}
