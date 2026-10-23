import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { searchAddresses } from '../lib/geocode';
import type { Place } from '../types';

interface Props {
  value: Place;
  onChange: (p: Place) => void;
  placeholder: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

export function AddressInput({ value, onChange, placeholder, leading, trailing, invalid }: Props) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abort = useRef<AbortController>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  const handleInput = (text: string) => {
    onChange({ label: text });
    clearTimeout(timer.current);
    abort.current?.abort();
    if (text.trim().length < 3) {
      setSuggestions([]);
      setBusy(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      setBusy(true);
      try {
        const res = await searchAddresses(text, ctrl.signal);
        setSuggestions(res);
        // Ne rouvrir la liste que si l'utilisateur est toujours dans ce champ
        setOpen(Boolean(box.current?.contains(document.activeElement)));
        setFailed(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setSuggestions([]);
        if (!failed) toast.error('Recherche indisponible. Vous pouvez saisir l\'adresse manuellement.');
        setFailed(true);
      } finally {
        if (abort.current === ctrl) setBusy(false);
      }
    }, 400);
  };

  return (
    <div ref={box} className="relative">
      <div className={`flex items-center gap-2 rounded-lg border bg-white px-3 focus-within:ring-1 ${invalid ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500' : 'border-gray-300 focus-within:border-blue-600 focus-within:ring-blue-600'}`}>
        {leading}
        <input
          value={value.label}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
          autoComplete="off"
        />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {trailing}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                  setSuggestions([]);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
