import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ onClose, onSuccess }: Props) {
  const { signIn, signUp } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const error = await (mode === 'login' ? signIn : signUp)(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(mode === 'login' ? 'Connexion réussie' : 'Compte créé avec succès');
    onClose();
    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Connexion">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600" />
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">Mot de passe</label>
        <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          className="mb-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600" />
        <p className="mb-4 text-xs text-gray-500">6 caractères minimum</p>
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="mt-4 w-full text-center text-sm text-blue-600 hover:underline">
          {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  );
}
