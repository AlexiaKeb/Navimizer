import { describe, expect, it } from 'vitest';
import { buildSchedule, formatClock, nextQuarter, parseClock } from '../src/lib/schedule';

describe('schedule', () => {
  it('parse et formate les heures', () => {
    expect(parseClock('08:30')).toBe(30600);
    expect(parseClock('nimporte quoi')).toBe(0);
    expect(formatClock(30600)).toBe('08:30');
    expect(formatClock(86400 + 3600)).toBe('01:00 +1j');
  });

  it('arrondit l\'heure courante aux 5 minutes supérieures', () => {
    expect(nextQuarter(new Date(2026, 0, 1, 9, 2))).toBe('09:05');
    expect(nextQuarter(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(nextQuarter(new Date(2026, 0, 1, 23, 58))).toBe('00:00');
  });

  it("ajoute la durée d'arrêt après chaque arrêt (hors départ)", () => {
    const legs = [{ distance: 1000, duration: 600 }, { distance: 2000, duration: 900 }];
    const s = buildSchedule(legs, parseClock('09:00'), 300);
    expect(s.arrive.map(formatClock)).toEqual(['09:00', '09:10', '09:30']);
    expect(formatClock(s.end)).toBe('09:35');
    expect(s.serviceTotal).toBe(600);
  });
});
