import { MAX_POINTS } from '../supabase/functions/_shared/types.ts';
import type { Mode } from '../supabase/functions/_shared/types.ts';

export type { Leg, Mode, OptimizeRequest, Optimization, Point, RouteResult, Stop } from '../supabase/functions/_shared/types.ts';

export interface Place {
  label: string;
  lat?: number;
  lon?: number;
}

/** Une ligne de la liste d'arrêts : la première est le départ, la dernière l'arrivée. */
export interface StopRow extends Place {
  id: string;
  status: 'idle' | 'checking' | 'ok' | 'error';
  error?: string;
}

export type Visit = 'done' | 'failed';

export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  origin: string;
  destination: string;
  waypoints: string[];
  mode: Mode;
  distance: number;
  duration: number;
  created_at: string;
}

export { MAX_POINTS };

/** Points intermédiaires maximum : MAX_POINTS moins le départ et l'arrivée. */
export const MAX_WAYPOINTS = MAX_POINTS - 2;
