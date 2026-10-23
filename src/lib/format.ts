export function formatDistance(m: number): string {
  return m > 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

export function formatDuration(s: number): string {
  const minutes = Math.max(1, Math.round(s / 60));
  if (s > 3600) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} h ${String(m).padStart(2, '0')} min`;
  }
  return `${minutes} min`;
}
