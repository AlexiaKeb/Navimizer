import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Crown, History, LogOut, Map as MapIcon, Menu, Navigation, Route, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useRouteStore } from '../store/routeStore';
import { RoutePanel } from './RoutePanel';
import { HistoryPanel } from './HistoryPanel';
import { MapView } from './MapView';
import { DriverModeFromStore } from './DriverMode';
import { PricingModal } from './PricingModal';
import { usePlanStore } from '../store/planStore';
import { BillingError, openBillingPortal } from '../lib/billing';

export default function AppLayout() {
  const { user, loading, signOut } = useAuthStore();
  const mapSignal = useRouteStore((s) => s.mapSignal);
  const driver = useRouteStore((s) => s.driver);
  const { isPro, cancelAtPeriodEnd, periodEnd, refresh, openUpgrade } = usePlanStore();
  const [params, setParams] = useSearchParams();
  const handledReturn = useRef(false);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [mobileView, setMobileView] = useState<'panel' | 'map'>('panel');

  // Sur mobile, afficher la carte après un calcul demandé explicitement (pas après un glisser-déposer)
  useEffect(() => {
    if (mapSignal > 0) setMobileView('map');
  }, [mapSignal]);

  // Retour de Stripe (?checkout=success|cancel) ou intention « Passer Pro » venue de la page d'accueil (?upgrade=1)
  useEffect(() => {
    if (handledReturn.current || !user) return;
    const checkout = params.get('checkout');
    const upgrade = params.get('upgrade');
    if (!checkout && !upgrade) return;
    handledReturn.current = true;
    setParams({}, { replace: true });
    if (upgrade) openUpgrade('plans');
    if (checkout === 'cancel') toast("Paiement annulé : vous n'avez pas été débité.");
    if (checkout === 'success') {
      // L'abonnement est activé par le webhook Stripe, quelques secondes après le paiement
      const id = toast.loading('Activation de votre abonnement…');
      let tries = 0;
      const timer = setInterval(async () => {
        await refresh();
        tries++;
        if (usePlanStore.getState().isPro) {
          clearInterval(timer);
          toast.success('Bienvenue dans Navimizer Pro !', { id });
        } else if (tries >= 15) {
          clearInterval(timer);
          toast("Paiement reçu : l'activation peut prendre un instant. Rechargez la page si besoin.", { id });
        }
      }, 2000);
    }
  }, [params, setParams, user, refresh, openUpgrade]);

  const manageBilling = async () => {
    try {
      await openBillingPortal();
    } catch (e) {
      toast.error(e instanceof BillingError ? e.message : 'Portail indisponible');
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Chargement…</div>;
  if (!user) return <Navigate to="/" replace />;

  const handleSignOut = async () => {
    await signOut();
    toast.success('Vous êtes déconnecté');
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button className="md:hidden" onClick={() => setMobileView('panel')} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900"><Navigation className="h-6 w-6 fill-blue-600 text-blue-600" /><span>Navi<span className="text-blue-600">mizer</span></span></Link>
        </div>
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setMobileView('map')} aria-label="Carte"><MapIcon className="h-5 w-5" /></button>
          {isPro ? (
            <button onClick={() => void manageBilling()} title={periodEnd ? `${cancelAtPeriodEnd ? 'Se termine' : 'Se renouvelle'} le ${new Date(periodEnd).toLocaleDateString('fr-FR')}` : 'Gérer l\'abonnement'}
              className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200">
              <Crown className="h-3.5 w-3.5" /> Pro<span className="hidden sm:inline"> · Gérer</span>
            </button>
          ) : (
            <button onClick={() => openUpgrade('plans')} className="flex items-center gap-1 rounded-full border border-blue-600 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              <Sparkles className="h-3.5 w-3.5" /> Passer Pro
            </button>
          )}
          <span className="hidden text-sm text-gray-500 md:inline">{user.email}</span>
          <button onClick={() => void handleSignOut()} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${mobileView === 'panel' ? 'flex' : 'hidden'} w-full flex-col bg-gray-50 shadow-lg md:flex md:w-1/3`}>
          <nav className="flex border-b border-gray-200 bg-white">
            {([['new', 'Nouvel itinéraire', Route], ['history', 'Historique', History]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium ${tab === id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'new' ? <RoutePanel /> : <HistoryPanel onLoaded={() => setTab('new')} />}
          </div>
        </aside>
        <main className={`${mobileView === 'map' ? 'block' : 'hidden'} min-w-0 flex-1 md:block md:w-2/3`}>
          <MapView visible={mobileView === 'map'} />
        </main>
      </div>
      {driver && <DriverModeFromStore />}
      <PricingModal />
    </div>
  );
}
