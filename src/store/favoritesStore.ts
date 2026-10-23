import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Favorite {
  id: string;
  name: string;
  address: string;
}

interface FavoritesState {
  favorites: Favorite[];
  add: (name: string, address: string) => void;
  update: (id: string, name: string, address: string) => void;
  remove: (id: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],
      add: (name, address) =>
        set((s) => ({ favorites: [...s.favorites, { id: crypto.randomUUID(), name, address }] })),
      update: (id, name, address) =>
        set((s) => ({ favorites: s.favorites.map((f) => (f.id === id ? { ...f, name, address } : f)) })),
      remove: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
    }),
    { name: 'navimizer_favorites' },
  ),
);
