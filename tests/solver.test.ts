import { describe, expect, it } from 'vitest';
import { pathCost, solveExact, solveHeuristic, solveOrder, type Matrix } from '../supabase/functions/_shared/solver.ts';

function rng(seed: number) {
  let a = seed;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function randomMatrix(n: number, seed: number, asymmetric = false): Matrix {
  const r = rng(seed);
  const pts = Array.from({ length: n }, () => [r() * 100, r() * 100]);
  return pts.map((a, i) =>
    pts.map((b, j) => (i === j ? 0 : Math.hypot(a[0] - b[0], a[1] - b[1]) * (asymmetric && j > i ? 1.2 : 1))),
  );
}

function bruteForce(cost: Matrix): number {
  const n = cost.length;
  const middle = Array.from({ length: n - 2 }, (_, i) => i + 1);
  let best = Infinity;
  const permute = (arr: number[], k: number) => {
    if (k === arr.length) return void (best = Math.min(best, pathCost(cost, [0, ...arr, n - 1])));
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(middle, 0);
  return best;
}

const isValid = (path: number[], n: number) =>
  path.length === n && path[0] === 0 && path[n - 1] === n - 1 && new Set(path).size === n;

describe('solveExact', () => {
  it.each([2, 3, 4, 7, 9])('trouve l\'optimum (brute force) pour n=%i', (n) => {
    for (const asym of [false, true]) {
      const cost = randomMatrix(n, n * 7, asym);
      const path = solveExact(cost);
      expect(isValid(path, n)).toBe(true);
      expect(pathCost(cost, path)).toBeCloseTo(bruteForce(cost), 6);
    }
  });
});

describe('solveHeuristic', () => {
  it('reste proche de l\'optimum exact (≤ 2 %) sur 12 points intermédiaires', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const cost = randomMatrix(14, seed * 13);
      const opt = pathCost(cost, solveExact(cost));
      const h = solveHeuristic(cost, { timeBudgetMs: 2000, seed });
      expect(isValid(h, 14)).toBe(true);
      expect(pathCost(cost, h)).toBeLessThanOrEqual(opt * 1.02);
    }
  });

  it('traite 100 points en moins de 2 s avec un chemin valide meilleur que le plus proche voisin', () => {
    const cost = randomMatrix(100, 42);
    const t = Date.now();
    const path = solveOrder(cost, { timeBudgetMs: 600 });
    expect(Date.now() - t).toBeLessThan(2000);
    expect(isValid(path, 100)).toBe(true);
    const naive = pathCost(cost, Array.from({ length: 100 }, (_, i) => i));
    expect(pathCost(cost, path)).toBeLessThan(naive * 0.5);
  });
});
