import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { isBackendConfigured, supabase } from '../lib/supabase';
import { clearForm } from '../lib/formStorage';

const NOT_CONFIGURED =
  'Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies avant le build';

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: () => {
    supabase.auth
      .getSession()
      .then(({ data }) => set({ user: data.session?.user ?? null, loading: false }))
      .catch(() => set({ loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false });
    });
    return () => data.subscription.unsubscribe();
  },
  signIn: async (email, password) => {
    if (!isBackendConfigured) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    return error.message.toLowerCase().includes('confirm')
      ? 'Email non confirmé : cliquez sur le lien reçu par email'
      : 'Email ou mot de passe incorrect';
  },
  signUp: async (email, password) => {
    if (!isBackendConfigured) return NOT_CONFIGURED;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes('already registered')) return 'Un compte existe déjà avec cet email : connectez-vous';
      if (m.includes('rate limit')) return "Trop de tentatives d'inscription : réessayez dans quelques minutes";
      if (m.includes('password')) return 'Mot de passe trop faible (6 caractères minimum)';
      return `Impossible de créer le compte (${error.message})`;
    }
    // Compte créé mais sans session : la confirmation par email est activée côté Supabase.
    if (!data.session) return 'Compte créé : confirmez votre email via le lien reçu, puis connectez-vous';
    return null;
  },
  signOut: async () => {
    await supabase.auth.signOut();
    clearForm();
    set({ user: null });
  },
}));
