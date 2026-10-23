// Résolution de l'ordre de passage : problème du voyageur de commerce avec départ (0) et arrivée (n-1) fixes.
// Exact (Held-Karp) jusqu'à 12 points intermédiaires, heuristique (plus proche voisin + 2-opt + or-opt
// avec redémarrages) au-delà.

export type Matrix = number[][];

export const EXACT_LIMIT = 12;

/** Coût d'un chemin complet (indices de la matrice, départ et arrivée inclus). */
export function pathCost(cost: Matrix, path: number[]): number {
  let t = 0;
  for (let i = 1; i < path.length; i++) t += cost[path[i - 1]][path[i]];
  return t;
}

const full = (n: number, middle: number[]) => [0, ...middle, n - 1];

export function solveExact(cost: Matrix): number[] {
  const n = cost.length;
  const m = n - 2;
  if (m <= 0) return Array.from({ length: n }, (_, i) => i);
  if (m > EXACT_LIMIT) throw new Error(`solveExact: trop de points (${m})`);

  const size = 1 << m;
  const dp = Array.from({ length: size }, () => new Float64Array(m).fill(Infinity));
  const parent = Array.from({ length: size }, () => new Int8Array(m).fill(-1));
  for (let j = 0; j < m; j++) dp[1 << j][j] = cost[0][j + 1];

  for (let mask = 1; mask < size; mask++) {
    for (let j = 0; j < m; j++) {
      const cur = dp[mask][j];
      if (!(mask & (1 << j)) || cur === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const c = cur + cost[j + 1][k + 1];
        if (c < dp[next][k]) {
          dp[next][k] = c;
          parent[next][k] = j;
        }
      }
    }
  }

  let best = Infinity;
  let last = 0;
  for (let j = 0; j < m; j++) {
    const c = dp[size - 1][j] + cost[j + 1][n - 1];
    if (c < best) {
      best = c;
      last = j;
    }
  }
  const middle: number[] = [];
  let mask = size - 1;
  for (let j = last; j !== -1; ) {
    middle.push(j + 1);
    const p = parent[mask][j];
    mask &= ~(1 << j);
    j = p;
  }
  return full(n, middle.reverse());
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HeuristicOptions {
  timeBudgetMs?: number;
  maxRestarts?: number;
  seed?: number;
}

export function solveHeuristic(cost: Matrix, opts: HeuristicOptions = {}): number[] {
  const n = cost.length;
  const m = n - 2;
  if (m <= 0) return Array.from({ length: n }, (_, i) => i);
  const { timeBudgetMs = 400, maxRestarts = 40, seed = 1 } = opts;
  const deadline = Date.now() + timeBudgetMs;
  const rand = mulberry32(seed);

  const total = (mid: number[]) => {
    let t = cost[0][mid[0]];
    for (let i = 1; i < mid.length; i++) t += cost[mid[i - 1]][mid[i]];
    return t + cost[mid[mid.length - 1]][n - 1];
  };

  const nearestNeighbour = () => {
    const left = new Set<number>();
    for (let i = 1; i <= m; i++) left.add(i);
    const mid: number[] = [];
    let cur = 0;
    while (left.size) {
      let next = -1;
      for (const c of left) if (next < 0 || cost[cur][c] < cost[cur][next]) next = c;
      mid.push(next);
      left.delete(next);
      cur = next;
    }
    return mid;
  };

  /** Descente locale : 2-opt puis or-opt (segments de 1 à 3 points, éventuellement inversés). */
  const localSearch = (start: number[]) => {
    let mid = start;
    let best = total(mid);
    let improved = true;
    while (improved && Date.now() < deadline) {
      improved = false;

      for (let i = 0; i < mid.length - 1 && !improved; i++) {
        for (let j = i + 1; j < mid.length; j++) {
          const cand = [...mid.slice(0, i), ...mid.slice(i, j + 1).reverse(), ...mid.slice(j + 1)];
          const c = total(cand);
          if (c < best - 1e-9) {
            mid = cand;
            best = c;
            improved = true;
            break;
          }
        }
      }
      if (improved) continue;

      outer: for (let len = 1; len <= 3; len++) {
        for (let i = 0; i + len <= mid.length; i++) {
          const seg = mid.slice(i, i + len);
          const rest = [...mid.slice(0, i), ...mid.slice(i + len)];
          for (let k = 0; k <= rest.length; k++) {
            if (k === i) continue;
            for (const s of len === 1 ? [seg] : [seg, [...seg].reverse()]) {
              const cand = [...rest.slice(0, k), ...s, ...rest.slice(k)];
              const c = total(cand);
              if (c < best - 1e-9) {
                mid = cand;
                best = c;
                improved = true;
                break outer;
              }
            }
          }
        }
      }
    }
    return { mid, cost: best };
  };

  const perturb = (mid: number[]) => {
    if (mid.length < 8) {
      const p = [...mid];
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
      }
      return p;
    }
    // double-bridge
    const cuts = new Set<number>();
    while (cuts.size < 3) cuts.add(1 + Math.floor(rand() * (mid.length - 1)));
    const [a, b, c] = [...cuts].sort((x, y) => x - y);
    return [...mid.slice(0, a), ...mid.slice(b, c), ...mid.slice(a, b), ...mid.slice(c)];
  };

  let best = localSearch(nearestNeighbour());
  for (let r = 0; r < maxRestarts && Date.now() < deadline; r++) {
    const cand = localSearch(perturb(best.mid));
    if (cand.cost < best.cost - 1e-9) best = cand;
  }
  return full(n, best.mid);
}

export function solveOrder(cost: Matrix, opts: HeuristicOptions = {}): number[] {
  return cost.length - 2 <= EXACT_LIMIT ? solveExact(cost) : solveHeuristic(cost, opts);
}
