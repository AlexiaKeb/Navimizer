import { Component, type ReactNode } from 'react';

/** Évite l'écran blanc : affiche un message et permet de recharger. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
        <p className="max-w-sm text-sm text-gray-600">Rechargez la page : votre saisie en cours est conservée.</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Recharger</button>
      </div>
    );
  }
}
