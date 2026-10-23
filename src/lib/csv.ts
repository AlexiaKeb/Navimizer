import { MAX_WAYPOINTS } from '../types';

export class CsvError extends Error {}

/** Une adresse par ligne ; lignes vides et commentaires (#) ignorés. */
export function parseAddresses(text: string): string[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^"(.*)"$/, '$1').trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) throw new CsvError('Aucune adresse valide trouvée dans le fichier');
  if (lines.length > MAX_WAYPOINTS)
    throw new CsvError(`Le nombre maximum de points intermédiaires est de ${MAX_WAYPOINTS}`);
  return lines;
}

export async function readCsvFile(file: File): Promise<string[]> {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new CsvError('Le fichier doit être au format CSV');
  return parseAddresses(await file.text());
}
