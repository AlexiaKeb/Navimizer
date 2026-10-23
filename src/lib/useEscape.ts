import { useEffect, useRef } from 'react';

/**
 * Ferme une fenêtre modale avec la touche Échap.
 * Un seul écouteur stable par fenêtre : s'il était réenregistré à chaque rendu, une mise à jour d'état provoquée par une autre
 * fenêtre pendant l'événement le ferait ignorer par le navigateur (les écouteurs retirés en cours d'événement ne sont plus appelés).
 */
export function useEscape(onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && latest.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
