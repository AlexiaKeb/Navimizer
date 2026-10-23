import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

const HomePage = lazy(() => import('./pages/HomePage'));
const AppLayout = lazy(() => import('./components/AppLayout'));

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);

  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app" element={<AppLayout />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </>
  );
}
