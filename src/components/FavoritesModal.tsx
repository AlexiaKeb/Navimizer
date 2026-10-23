import { useState } from 'react';
import { Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFavoritesStore, type Favorite } from '../store/favoritesStore';
import { AddressInput } from './AddressInput';
import type { Place } from '../types';

interface Props {
  onSelect: (address: string) => void;
  onClose: () => void;
}

export function FavoritesModal({ onSelect, onClose }: Props) {
  const { favorites, add, update, remove } = useFavoritesStore();
  const [editing, setEditing] = useState<Favorite | 'new' | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState<Place>({ label: '' });

  const startEdit = (f: Favorite | 'new') => {
    setEditing(f);
    setName(f === 'new' ? '' : f.name);
    setAddress({ label: f === 'new' ? '' : f.address });
  };

  const save = () => {
    if (!name.trim() || !address.label.trim()) {
      toast.error('Renseignez un nom et une adresse');
      return;
    }
    if (editing === 'new') add(name.trim(), address.label.trim());
    else if (editing) update(editing.id, name.trim(), address.label.trim());
    toast.success('Favori enregistré');
    setEditing(null);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Adresses favorites">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" /> Adresses favorites
          </h2>
          <button onClick={onClose} aria-label="Fermer"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom (ex : Domicile)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            />
            <AddressInput value={address} onChange={setAddress} placeholder="Adresse complète" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
              <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Enregistrer</button>
            </div>
          </div>
        ) : (
          <>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {favorites.length === 0 && <li className="py-6 text-center text-sm text-gray-500">Aucun favori pour le moment.</li>}
              {favorites.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => { onSelect(f.address); onClose(); }}>
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="truncate text-xs text-gray-500">{f.address}</div>
                  </button>
                  <button onClick={() => startEdit(f)} aria-label="Modifier" className="p-1 text-gray-500 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(f.id)} aria-label="Supprimer" className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <button onClick={() => startEdit('new')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Ajouter un favori
            </button>
          </>
        )}
      </div>
    </div>
  );
}
