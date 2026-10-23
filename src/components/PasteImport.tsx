import { useRef, useState } from 'react';
import { Camera, Loader2, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { extractAddresses, ImportError } from '../lib/importAddresses';
import { useEscape } from '../lib/useEscape';
import { useRouteStore } from '../store/routeStore';
import { maxPointsFor, usePlanStore } from '../store/planStore';

interface Item {
  id: number;
  text: string;
  checked: boolean;
}

/** Import d'adresses depuis un texte collé (e-mail, WhatsApp, tableur) ou une photo, avec vérification avant ajout. */
export function PasteImport({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const addStops = useRouteStore((s) => s.addStops);
  const isPro = usePlanStore((s) => s.isPro);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const room = useRouteStore((s) => maxPointsFor(isPro) - s.stops.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [source, setSource] = useState<'ai' | 'local'>('local');

  const run = async () => {
    setBusy(true);
    try {
      const res = await extractAddresses({ text, image: image ?? undefined, allowAi: isPro });
      if (res.addresses.length === 0) {
        toast.error('Aucune adresse trouvée dans ce contenu.');
        return;
      }
      setSource(res.source);
      setItems(res.addresses.map((a, i) => ({ id: i, text: a, checked: true })));
    } catch (e) {
      if (e instanceof ImportError && e.code === 'pro_required') {
        onClose();
        openUpgrade('ai');
        return;
      }
      toast.error(e instanceof ImportError ? e.message : "L'analyse a échoué");
    } finally {
      setBusy(false);
    }
  };

  const selected = items?.filter((i) => i.checked && i.text.trim()) ?? [];

  const confirm = () => {
    const n = addStops(selected.map((i) => i.text.trim()));
    if (n) {
      toast.success(`${n} adresse${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`);
      onClose();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      setImage(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Importer des adresses">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-blue-600" /> Importer des adresses</h2>
          <button onClick={onClose} aria-label="Fermer"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {!items ? (
          <div className="space-y-3 overflow-y-auto">
            <p className="text-sm text-gray-600">Collez un e-mail, un message, un tableau Excel… ou prenez en photo votre liste. Vous vérifierez les adresses avant de les ajouter.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              rows={7}
              placeholder={'Bonjour, voici les livraisons de demain :\n- 12 rue de la Paix 75002 Paris\n- 8 avenue Foch 75116 Paris…'}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-600"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                <Camera className="h-4 w-4" /> Photo ou capture d'écran
              </button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              {image && (
                <span className="flex min-w-0 items-center gap-1 text-xs text-gray-600">
                  <span className="truncate">{image.name || 'image collée'}</span>
                  <button onClick={() => setImage(null)} aria-label="Retirer l'image" className="text-gray-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                </span>
              )}
            </div>
            <button onClick={() => void run()} disabled={busy || (!text.trim() && !image)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Analyse en cours...' : 'Extraire les adresses'}
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="text-sm text-gray-600">
              {items.length} adresse{items.length > 1 ? 's' : ''} trouvée{items.length > 1 ? 's' : ''}
              {source === 'ai' ? ' par l\'analyse intelligente' : ' (lecture simple du texte)'}. Corrigez ou décochez avant d'ajouter.
              {source === 'local' && !isPro && <> <button onClick={() => { onClose(); openUpgrade('ai'); }} className="text-blue-600 underline">Passez Pro</button> pour l'analyse intelligente.</>}
            </p>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={it.checked} aria-label="Inclure cette adresse"
                    onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, checked: e.target.checked } : x)))} />
                  <input value={it.text} onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-600" />
                </li>
              ))}
            </ul>
            {selected.length > room && <p className="text-xs text-red-600">Trop d'adresses : il reste de la place pour {room} arrêt(s){!isPro && ' (plan gratuit)'}.</p>}
            <div className="flex gap-2">
              <button onClick={() => setItems(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">Retour</button>
              <button onClick={confirm} disabled={selected.length === 0 || selected.length > room}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                Ajouter {selected.length} adresse{selected.length > 1 ? 's' : ''} à la tournée
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
