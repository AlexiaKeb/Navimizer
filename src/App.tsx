import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { usePlanStore } from './store/planStore';

const HomePage = lazy(() => import('./pages/HomePage'));
const AppLayout = lazy(() => import('./components/AppLayout'));
const TourPage = lazy(() => import('./pages/TourPage'));

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);

  // Le plan suit la session : chargé à la connexion, remis à zéro à la déconnexion
  const userId = useAuthStore((s) => s.user?.id);
  const refreshPlan = usePlanStore((s) => s.refresh);
  const resetPlan = usePlanStore((s) => s.reset);
  useEffect(() => {
    if (userId) void refreshPlan();
    else resetPlan();
  }, [userId, refreshPlan, resetPlan]);

  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app" element={<AppLayout />} />
          <Route path="/t/:token" element={<TourPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </>
  );
}
