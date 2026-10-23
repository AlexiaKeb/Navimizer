import type { Mode, Point } from '../types';

const pt = (s: Point) => `${s.lat},${s.lon}`;

/** Google Maps n'accepte que 9 étapes intermédiaires dans un lien : au-delà, seuls les premiers arrêts sont repris. */
export const GOOGLE_MAPS_MAX_POINTS = 11;

export function googleMapsUrl(stops: Point[], mode: Mode): string {
  const pts = stops.slice(0, GOOGLE_MAPS_MAX_POINTS);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const via = pts.slice(1, -1).map(pt).join('|');
  const travel = { car: 'driving', bike: 'bicycling', walk: 'walking' }[mode];
  const p = new URLSearchParams({ api: '1', origin: pt(first), destination: pt(last), travelmode: travel });
  if (via) p.set('waypoints', via);
  return `https://www.google.com/maps/dir/?${p}`;
}

/** Waze ne gère qu'une destination : on l'utilise pour atteindre un arrêt précis. */
export function wazeUrl(stops: Point[]): string {
  const last = stops[stops.length - 1];
  return `https://waze.com/ul?ll=${last.lat},${last.lon}&navigate=yes`;
}

/** Navigation vers un seul arrêt (mode chauffeur). */
export function googleMapsToStop(stop: Point, mode: Mode): string {
  const travel = { car: 'driving', bike: 'bicycling', walk: 'walking' }[mode];
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: pt(stop), travelmode: travel })}`;
}

export const wazeToStop = (stop: Point) => wazeUrl([stop]);
