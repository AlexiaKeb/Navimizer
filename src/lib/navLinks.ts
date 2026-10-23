import type { Mode, Stop } from '../types';

const pt = (s: Stop) => `${s.lat},${s.lon}`;

export function googleMapsUrl(stops: Stop[], mode: Mode): string {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const via = stops.slice(1, -1).map(pt).join('|');
  const travel = { car: 'driving', bike: 'bicycling', walk: 'walking' }[mode];
  const p = new URLSearchParams({ api: '1', origin: pt(first), destination: pt(last), travelmode: travel });
  if (via) p.set('waypoints', via);
  return `https://www.google.com/maps/dir/?${p}`;
}

export function wazeUrl(stops: Stop[]): string {
  const last = stops[stops.length - 1];
  return `https://waze.com/ul?ll=${last.lat},${last.lon}&navigate=yes`;
}

/** Navigation vers un seul arrêt (mode chauffeur). */
export function googleMapsToStop(stop: Stop, mode: Mode): string {
  const travel = { car: 'driving', bike: 'bicycling', walk: 'walking' }[mode];
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: pt(stop), travelmode: travel })}`;
}

export const wazeToStop = (stop: Stop) => wazeUrl([stop]);
