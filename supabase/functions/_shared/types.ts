// Types partagés entre le navigateur et la fonction serveur `optimize` (aucune API spécifique à Deno ou au DOM).

export type Mode = 'car' | 'bike' | 'walk';
export type Optimization = 'time' | 'distance';

export interface Point {
  label: string;
  lat: number;
  lon: number;
}

export interface Stop extends Point {
  kind: 'start' | 'via' | 'end';
}

export interface Leg {
  distance: number; // m
  duration: number; // s
}

/** Coût de l'ordre saisi comparé à l'ordre optimisé (mêmes matrices OSRM, donc comparables). */
export interface Comparison {
  baselineDistance: number; // m
  baselineDuration: number; // s
  optimizedDistance: number;
  optimizedDuration: number;
}

export interface RouteResult {
  order: number[]; // indices d'origine (dans la requête) des arrêts, dans l'ordre de passage
  stops: Stop[]; // dans l'ordre de passage
  legs: Leg[];
  distance: number;
  duration: number;
  geometry: [number, number][]; // [lat, lon]
  /** Présent seulement quand une optimisation a eu lieu. */
  comparison?: Comparison;
}

export interface OptimizeRequest {
  points: Point[]; // [départ, ...intermédiaires, arrivée]
  mode: Mode;
  optimization: Optimization;
  /** false : conserver l'ordre fourni et calculer uniquement le tracé (défaut : true). */
  optimize?: boolean;
}

/** Nombre maximal de points (départ + arrivée inclus) : limite des serveurs OSRM par défaut. */
export const MAX_POINTS = 100;
