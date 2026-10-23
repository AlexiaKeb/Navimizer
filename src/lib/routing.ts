import { FunctionsHttpError } from '@supabase/supabase-js';
import { optimizeRoute, OptimizeError, PUBLIC_SERVERS } from '../../supabase/functions/_shared/optimize.ts';
import type { OptimizeRequest, RouteResult } from '../types';
import { isBackendConfigured, supabase } from './supabase';

export { OptimizeError };

/**
 * Calcule la tournée via la fonction serveur `optimize` (serveurs de routage et clés côté serveur).
 * Si la fonction n'est pas déployée ou injoignable, repli sur un calcul direct depuis le navigateur
 * avec les serveurs publics (sans garantie de disponibilité).
 */
export async function requestRoute(req: OptimizeRequest): Promise<RouteResult> {
  if (isBackendConfigured) {
    const { data, error } = await supabase.functions.invoke<RouteResult>('optimize', { body: req });
    if (!error && data) return data;
    if (error instanceof FunctionsHttpError && (error.context.status === 400 || error.context.status === 422)) {
      const body = (await error.context.json().catch(() => null)) as { code?: 'invalid' | 'no_route'; message?: string } | null;
      throw new OptimizeError(body?.code ?? 'invalid', body?.message);
    }
    console.warn('Fonction « optimize » indisponible, calcul direct depuis le navigateur.', error);
  }
  return optimizeRoute(req, PUBLIC_SERVERS);
}
