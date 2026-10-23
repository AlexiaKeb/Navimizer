import type { Leg } from '../types';

/** "HH:MM" -> secondes depuis minuit (0 si invalide). */
export function parseClock(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return 0;
  return Math.min(Number(m[1]), 23) * 3600 + Math.min(Number(m[2]), 59) * 60;
}

/** Secondes depuis minuit -> "HH:MM", avec "+1j" au-delà de minuit. */
export function formatClock(sec: number): string {
  const day = Math.floor(sec / 86400);
  const s = Math.round(sec) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${hh}:${mm}${day > 0 ? ` +${day}j` : ''}`;
}

/** Heure courante arrondie aux 5 minutes supérieures, au format "HH:MM". */
export function nextQuarter(now = new Date()): string {
  const total = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  const h = Math.floor(total / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface Schedule {
  arrive: number[]; // heure d'arrivée à chaque arrêt (secondes depuis minuit) ; [0] = heure de départ
  end: number; // fin estimée, durée d'arrêt du dernier point comprise
  serviceTotal: number; // somme des durées d'arrêt (s)
}

/** Une durée d'arrêt est appliquée à chaque arrêt sauf le départ. */
export function buildSchedule(legs: Leg[], departSec: number, serviceSec: number): Schedule {
  const n = legs.length + 1;
  const arrive = [departSec];
  let clock = departSec;
  for (let i = 1; i < n; i++) {
    clock += legs[i - 1].duration;
    arrive.push(clock);
    clock += serviceSec;
  }
  return { arrive, end: clock, serviceTotal: serviceSec * (n - 1) };
}
