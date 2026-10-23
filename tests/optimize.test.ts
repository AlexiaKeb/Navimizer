import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { optimizeRoute, OptimizeError, validateRequest } from '../supabase/functions/_shared/optimize.ts';
import type { Point } from '../supabase/functions/_shared/types.ts';

// Faux serveur OSRM : distances euclidiennes (1 degré = 100 km), durée = distance / 10 m/s.
let server: http.Server;
let base: string;
let failRoute = false;
let tableCalls = 0;

const parse = (path: string): [number, number][] =>
  path.split('/')[4].split('?')[0].split(';').map((c) => c.split(',').map(Number) as [number, number]);
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 100_000;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url!;
    const pts = parse(url);
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.includes('/table/')) {
      tableCalls++;
      const distances = pts.map((a) => pts.map((b) => dist(a, b)));
      return send(200, { code: 'Ok', distances, durations: distances.map((r) => r.map((d) => d / 10)) });
    }
    if (failRoute) return send(400, { code: 'NoRoute' });
    const legs = pts.slice(1).map((p, i) => ({ distance: dist(pts[i], p), duration: dist(pts[i], p) / 10 }));
    send(200, {
      code: 'Ok',
      routes: [{
        distance: legs.reduce((s, l) => s + l.distance, 0),
        duration: legs.reduce((s, l) => s + l.duration, 0),
        legs,
        geometry: { coordinates: pts },
      }],
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const servers = () => ({ car: base, bike: base, walk: base });
// points alignés sur l'axe des longitudes (lat = 0)
const P = (lon: number, label = String(lon)): Point => ({ label, lat: 0, lon });

describe('optimizeRoute', () => {
  it("réordonne les points intermédiaires pour éviter les allers-retours", async () => {
    const points = [P(0, 'dep'), P(0.3, 'c'), P(0.1, 'a'), P(0.2, 'b'), P(0.4, 'arr')];
    const res = await optimizeRoute({ points, mode: 'car', optimization: 'time' }, servers());
    expect(res.stops.map((s) => s.label)).toEqual(['dep', 'a', 'b', 'c', 'arr']);
    expect(res.stops.map((s) => s.kind)).toEqual(['start', 'via', 'via', 'via', 'end']);
    expect(res.legs).toHaveLength(4);
    expect(res.distance).toBeCloseTo(0.4 * 100_000, 0);
    expect(res.geometry[0]).toEqual([0, 0]);
    expect(res.order).toEqual([0, 2, 3, 1, 4]); // indices d'origine dans l'ordre de passage
  });

  it("conserve l'ordre fourni avec optimize: false (sans appel à /table)", async () => {
    tableCalls = 0;
    const points = [P(0, 'dep'), P(0.3, 'c'), P(0.1, 'a'), P(0.4, 'arr')];
    const res = await optimizeRoute({ points, mode: 'car', optimization: 'time', optimize: false }, servers());
    expect(res.order).toEqual([0, 1, 2, 3]);
    expect(res.stops.map((s) => s.label)).toEqual(['dep', 'c', 'a', 'arr']);
    expect(tableCalls).toBe(0);
  });

  it('gère 100 points', async () => {
    const points = Array.from({ length: 100 }, (_, i) => P(((i * 37) % 100) / 100, String(i)));
    points[0] = P(0, 'dep');
    points[99] = P(1, 'arr');
    const res = await optimizeRoute({ points, mode: 'bike', optimization: 'distance' }, servers());
    expect(res.stops).toHaveLength(100);
    expect(res.stops[0].label).toBe('dep');
    expect(res.stops[99].label).toBe('arr');
    expect(new Set(res.stops.map((s) => s.label)).size).toBe(100);
  });

  it('calcule un simple trajet sans point intermédiaire', async () => {
    const res = await optimizeRoute({ points: [P(0), P(0.1)], mode: 'walk', optimization: 'time' }, servers());
    expect(res.stops).toHaveLength(2);
  });

  it("remonte no_route quand le serveur répond NoRoute", async () => {
    failRoute = true;
    await expect(optimizeRoute({ points: [P(0), P(0.1)], mode: 'car', optimization: 'time' }, servers()))
      .rejects.toMatchObject({ code: 'no_route' });
    failRoute = false;
  });

  it('remonte upstream quand le serveur est injoignable', async () => {
    await expect(
      optimizeRoute({ points: [P(0), P(0.1)], mode: 'car', optimization: 'time' }, { car: 'http://127.0.0.1:1', bike: '', walk: '' }),
    ).rejects.toMatchObject({ code: 'upstream' });
  });
});

describe('validateRequest', () => {
  const ok = { points: [P(0), P(1)], mode: 'car', optimization: 'time' };
  it('accepte une requête valide', () => expect(validateRequest(ok).points).toHaveLength(2));
  it.each([
    ['null', null],
    ['1 seul point', { ...ok, points: [P(0)] }],
    ['101 points', { ...ok, points: Array.from({ length: 101 }, () => P(0)) }],
    ['mode inconnu', { ...ok, mode: 'plane' }],
    ['optimisation inconnue', { ...ok, optimization: 'fun' }],
    ['latitude hors limites', { ...ok, points: [{ label: 'x', lat: 91, lon: 0 }, P(1)] }],
    ['coordonnée NaN', { ...ok, points: [{ label: 'x', lat: NaN, lon: 0 }, P(1)] }],
  ])('rejette : %s', (_name, body) => {
    expect(() => validateRequest(body)).toThrowError(OptimizeError);
  });
});
