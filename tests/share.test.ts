import { describe, expect, it } from 'vitest';
import { buildTour, parseSharedTour } from '../src/lib/share';
import type { RouteResult } from '../src/types';

const result: RouteResult = {
  order: [0, 1, 2],
  stops: [
    { label: 'A', lat: 48.8, lon: 2.3, kind: 'start' },
    { label: 'B', lat: 48.9, lon: 2.4, kind: 'via' },
    { label: 'C', lat: 49, lon: 2.5, kind: 'end' },
  ],
  legs: [{ distance: 1000, duration: 120 }, { distance: 2000, duration: 240 }],
  distance: 3000,
  duration: 360,
  geometry: [[48.8, 2.3]],
};

describe('partage de tournée', () => {
  it("construit puis relit une tournée à l'identique", () => {
    const tour = buildTour(result, 'car', '09:00', 5);
    expect(JSON.parse(JSON.stringify(parseSharedTour(tour)))).toEqual(JSON.parse(JSON.stringify(tour)));
    expect(tour.stops.every((s) => !('kind' in s))).toBe(true); // pas de champs superflus
  });

  it.each([
    ['null', null],
    ['version inconnue', { v: 2 }],
    ['mode inconnu', { ...buildTour(result, 'car', '09:00', 5), mode: 'avion' }],
    ['heure invalide', { ...buildTour(result, 'car', '09:00', 5), departAt: '9h' }],
    ['nombre de tronçons incohérent', { ...buildTour(result, 'car', '09:00', 5), legs: [] }],
    ['latitude hors limites', { ...buildTour(result, 'car', '09:00', 5), stops: [{ label: 'x', lat: 120, lon: 0 }, { label: 'y', lat: 0, lon: 0 }, { label: 'z', lat: 0, lon: 0 }] }],
    ['durée négative', { ...buildTour(result, 'car', '09:00', 5), legs: [{ distance: 1, duration: -5 }, { distance: 1, duration: 5 }] }],
    ['trop d\'arrêts', { ...buildTour(result, 'car', '09:00', 5), stops: Array.from({ length: 101 }, () => ({ label: 'x', lat: 0, lon: 0 })), legs: Array.from({ length: 100 }, () => ({ distance: 1, duration: 1 })) }],
  ])('rejette : %s', (_n, raw) => expect(parseSharedTour(raw)).toBeNull());

  it('tronque les libellés trop longs', () => {
    const tour = buildTour(result, 'car', '09:00', 5);
    tour.stops[0].label = 'x'.repeat(1000);
    expect(parseSharedTour(tour)!.stops[0].label).toHaveLength(300);
  });
});
