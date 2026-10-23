import type { Comparison, Mode } from '../types';

/** Hypothèses de l'estimation (voiture thermique moyenne) ; affichées à l'utilisateur. */
export const FUEL_ASSUMPTIONS = { litersPer100km: 7, euroPerLiter: 1.85, kgCo2PerLiter: 2.31 };

export interface Savings {
  distance: number; // m gagnés (négatif si l'ordre optimal est plus long mais plus rapide)
  duration: number; // s gagnées
  baselineDistance: number;
  baselineDuration: number;
  fuelLiters: number;
  euros: number;
  co2Kg: number;
  /** L'ordre saisi était déjà (quasi) optimal. */
  optimal: boolean;
}

export function computeSavings(c: Comparison, mode: Mode): Savings {
  const distance = c.baselineDistance - c.optimizedDistance;
  const duration = c.baselineDuration - c.optimizedDuration;
  const optimal = duration < Math.max(60, c.baselineDuration * 0.01) && distance < Math.max(100, c.baselineDistance * 0.01);
  const km = mode === 'car' && distance > 0 ? distance / 1000 : 0;
  const fuelLiters = (km * FUEL_ASSUMPTIONS.litersPer100km) / 100;
  return {
    distance,
    duration,
    baselineDistance: c.baselineDistance,
    baselineDuration: c.baselineDuration,
    fuelLiters,
    euros: fuelLiters * FUEL_ASSUMPTIONS.euroPerLiter,
    co2Kg: fuelLiters * FUEL_ASSUMPTIONS.kgCo2PerLiter,
    optimal,
  };
}
