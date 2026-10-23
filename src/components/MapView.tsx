import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, LocateFixed, Navigation, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouteStore } from '../store/routeStore';
import { googleMapsUrl, wazeUrl } from '../lib/navLinks';

const PARIS: [number, number] = [48.8566, 2.3522];

const icon = (text: string, color: string) =>
  L.divIcon({
    className: '',
    html: `<div class="nv-marker" style="background:${color}">${text}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function FitRoute({ visible }: { visible: boolean }) {
  const map = useMap();
  const geometry = useRouteStore((s) => s.result?.geometry);
  useEffect(() => {
    if (!geometry?.length || !visible) return;
    // La carte peut être masquée (mobile) : recalculer sa taille avant de cadrer
    map.invalidateSize();
    map.fitBounds(L.latLngBounds(geometry), { padding: [50, 50] });
  }, [geometry, visible, map]);
  return null;
}

type Target = { pos: [number, number]; zoom: number; id: number };

function MapController({ target }: { target: Target | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target.pos, target.zoom);
  }, [target, map]);
  return null;
}

export function MapView({ visible }: { visible: boolean }) {
  const result = useRouteStore((s) => s.result);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [follow, setFollow] = useState<Target | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const watchId = useRef<number | null>(null);

  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
    setPosition(null);
  };
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  const toggleTracking = () => {
    if (tracking) return stopTracking();
    if (!('geolocation' in navigator)) return void toast.error("La géolocalisation n'est pas supportée par votre navigateur");
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setPosition(pos);
        setFollow({ pos, zoom: 16, id: Date.now() });
      },
      (err) => {
        stopTracking();
        toast.error(err.code === err.PERMISSION_DENIED ? 'Permission de géolocalisation refusée' : 'Impossible de déterminer votre position');
      },
      { enableHighAccuracy: true },
    );
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer center={PARIS} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRoute visible={visible} />
        <MapController target={follow} />
        {result && <Polyline positions={result.geometry} pathOptions={{ color: '#2563eb', weight: 5 }} />}
        {result?.stops.map((s, i) => (
          <Marker key={i} position={[s.lat, s.lon]}
            icon={s.kind === 'start' ? icon('D', '#16a34a') : s.kind === 'end' ? icon('A', '#2563eb') : icon(String(i), '#475569')} />
        ))}
        {position && <Marker position={position} icon={icon('•', '#dc2626')} />}
      </MapContainer>

      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col items-end gap-2">
        {result && (
          <div className="relative">
            {navOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-lg bg-white shadow-lg">
                <a href={googleMapsUrl(result.stops, useRouteStore.getState().mode)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50">Google Maps <ExternalLink className="h-3.5 w-3.5" /></a>
                <a href={wazeUrl(result.stops)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50">Waze <ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            )}
            <button onClick={() => setNavOpen((o) => !o)} aria-label="Navigation" className="rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700"><Navigation className="h-5 w-5" /></button>
          </div>
        )}
        <button onClick={toggleTracking} aria-label="Suivi GPS" aria-pressed={tracking}
          className={`rounded-full p-3 shadow-lg ${tracking ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}><LocateFixed className="h-5 w-5" /></button>
        <button onClick={() => setFollow({ pos: PARIS, zoom: 13, id: Date.now() })} aria-label="Recentrer sur Paris" className="rounded-full bg-white p-3 text-gray-700 shadow-lg hover:bg-gray-50"><Home className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
