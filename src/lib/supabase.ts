import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isBackendConfigured = Boolean(url && anon);

// Valeurs factices si non configuré : l'app se charge, l'authentification échouera proprement.
export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anon || 'anon-key-not-configured',
);
