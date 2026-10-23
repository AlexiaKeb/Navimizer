import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode, GeocodeError, searchAddresses } from '../src/lib/geocode';

const feature = (label: string, score: number, lon = 2.35, lat = 48.85) => ({
  geometry: { coordinates: [lon, lat] },
  properties: { label, score },
});
const mockFetch = (impl: (url: string) => Response | Promise<Response>) =>
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(impl(url))));
const ok = (features: unknown[]) => new Response(JSON.stringify({ features }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('BAN', () => {
  it("convertit [lon, lat] en lat/lon et demande l'autocomplétion", async () => {
    let called = '';
    mockFetch((u) => ((called = u), ok([feature('8 Boulevard du Port 80000 Amiens', 0.9, 2.3, 49.9)])));
    const res = await searchAddresses('8 bd du port amiens');
    expect(res[0]).toMatchObject({ label: '8 Boulevard du Port 80000 Amiens', lat: 49.9, lon: 2.3 });
    expect(called).toContain('autocomplete=1');
    expect(called).toContain('limit=5');
  });

  it("n'appelle pas l'API sous 3 caractères", async () => {
    mockFetch(() => ok([]));
    expect(await searchAddresses('ab')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('géocode : adresse introuvable si le score est trop faible', async () => {
    mockFetch(() => ok([feature('Quelque part', 0.1)]));
    await expect(geocode('zzzz introuvable')).rejects.toMatchObject({ kind: 'notfound', label: 'zzzz introuvable' });
  });

  it('géocode : service indisponible sur erreur HTTP, résultat mis en cache sinon', async () => {
    mockFetch(() => new Response('', { status: 429 }));
    await expect(geocode('1 rue de la Paix Paris')).rejects.toBeInstanceOf(GeocodeError);
    mockFetch(() => ok([feature('1 Rue de la Paix 75002 Paris', 0.95)]));
    const a = await geocode('10 rue du cache Paris');
    const b = await geocode('10 rue du cache Paris');
    expect(b).toBe(a);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
