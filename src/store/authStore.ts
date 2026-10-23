import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearForm } from '../lib/formStorage';

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? 'Email ou mot de passe incorrect' : null;
  },
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // Sans confirmation d'email, une session est renvoyée immédiatement.
    return error || !data.session ? 'Impossible de créer le compte' : null;
  },
  signOut: async () => {
    await supabase.auth.signOut();
    clearForm();
    set({ user: null });
  },
}));
