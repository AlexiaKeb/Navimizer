import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { formatDistance, formatDuration } from '../lib/format';
import { useRouteStore } from '../store/routeStore';
import type { SavedRoute } from '../types';

export function HistoryPanel({ onLoaded }: { onLoaded: () => void }) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const load = useRouteStore((s) => s.load);

  const fetchRoutes = useCallback(async () => {
    const { data, error } = await supabase.from('routes').select('*').order('created_at', { ascending: false });
    if (error) toast.error("Impossible de charger l'historique");
    else setRoutes(data as SavedRoute[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRoutes();
    const id = setInterval(() => void fetchRoutes(), 30_000);
    return () => clearInterval(id);
  }, [fetchRoutes]);

  const rename = async (id: string) => {
    if (!draft.trim()) return toast.error('Veuillez donner un nom à votre itinéraire');
    const { error } = await supabase.from('routes').update({ name: draft.trim() }).eq('id', id);
    if (error) return toast.error('Impossible de renommer l\'itinéraire');
    setEditing(null);
    toast.success('Itinéraire renommé');
    void fetchRoutes();
  };

  const remove = async (r: SavedRoute) => {
    if (!window.confirm(`Supprimer « ${r.name} » ?`)) return;
    const { error } = await supabase.from('routes').delete().eq('id', r.id);
    if (error) return toast.error("Impossible de supprimer l'itinéraire");
    toast.success('Itinéraire supprimé');
    setRoutes((rs) => rs.filter((x) => x.id !== r.id));
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (routes.length === 0) return <p className="p-6 text-center text-sm text-gray-500">Aucun itinéraire sauvegardé.</p>;

  return (
    <ul className="space-y-2 p-4">
      {routes.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2">
            {editing === r.id ? (
              <>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void rename(r.id)}
                  className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-600" />
                <button onClick={() => void rename(r.id)} aria-label="Valider" className="p-1 text-green-600"><Check className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <button className="min-w-0 flex-1 text-left" onClick={() => { load(r); onLoaded(); }}>
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('fr-FR')}</div>
                  <div className="mt-1 truncate text-xs text-gray-600">{r.origin} → {r.destination}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatDistance(r.distance)} · {formatDuration(r.duration)}</div>
                </button>
                <button onClick={() => { setEditing(r.id); setDraft(r.name); }} aria-label="Renommer" className="p-1 text-gray-500 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => void remove(r)} aria-label="Supprimer" className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
