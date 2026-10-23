import { describe, expect, it } from 'vitest';
import { computeSavings, FUEL_ASSUMPTIONS } from '../src/lib/savings';

const cmp = { baselineDistance: 50_000, baselineDuration: 3600, optimizedDistance: 32_000, optimizedDuration: 2400 };

describe('computeSavings', () => {
  it('calcule temps, distance, carburant et CO2 en voiture', () => {
    const s = computeSavings(cmp, 'car');
    expect(s.distance).toBe(18_000);
    expect(s.duration).toBe(1200);
    expect(s.optimal).toBe(false);
    expect(s.fuelLiters).toBeCloseTo((18 * FUEL_ASSUMPTIONS.litersPer100km) / 100, 6);
    expect(s.euros).toBeCloseTo(s.fuelLiters * FUEL_ASSUMPTIONS.euroPerLiter, 6);
    expect(s.co2Kg).toBeCloseTo(s.fuelLiters * FUEL_ASSUMPTIONS.kgCo2PerLiter, 6);
  });

  it('ne compte pas de carburant à vélo ou à pied', () => {
    for (const mode of ['bike', 'walk'] as const) {
      const s = computeSavings(cmp, mode);
      expect(s.euros).toBe(0);
      expect(s.co2Kg).toBe(0);
      expect(s.duration).toBe(1200);
    }
  });

  it("détecte un ordre déjà optimal", () => {
    expect(computeSavings({ ...cmp, optimizedDistance: 49_900, optimizedDuration: 3590 }, 'car').optimal).toBe(true);
  });

  it("n'attribue pas d'économie de carburant quand la distance augmente (trajet plus rapide mais plus long)", () => {
    const s = computeSavings({ baselineDistance: 30_000, baselineDuration: 3000, optimizedDistance: 34_000, optimizedDuration: 2000 }, 'car');
    expect(s.distance).toBeLessThan(0);
    expect(s.duration).toBe(1000);
    expect(s.euros).toBe(0);
    expect(s.optimal).toBe(false);
  });
});
