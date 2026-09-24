import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocationItem, RouteData, WeatherData, ThemeMode } from '../types.ts';

interface InteractiveMapProps {
  center: [number, number];
  zoom: number;
  theme?: ThemeMode;
  selectedLocation: LocationItem | null;
  startLocation: LocationItem | null;
  destination: LocationItem | null;
  currentRoute: RouteData | null;
  currentWeather: WeatherData | null;
  onSelectLocation: (loc: LocationItem) => void;
  onSetAsStart: (loc: LocationItem) => void;
  onSetAsDestination: (loc: LocationItem) => void;
}

// Custom crisp SVG pins
function createPinIcon(color: string, label: string = '', iconType: 'pin' | 'start' | 'end' = 'pin') {
  let inner = '';
  if (iconType === 'start') {
    inner = `<text x="14" y="17" font-size="11" font-weight="bold" fill="white" text-anchor="middle">A</text>`;
  } else if (iconType === 'end') {
    inner = `<text x="14" y="17" font-size="11" font-weight="bold" fill="white" text-anchor="middle">B</text>`;
  } else {
    inner = `<circle cx="14" cy="13" r="4" fill="white" />`;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0z" fill="${color}"/>
      ${inner}
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'custom-map-pin',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -36],
  });
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  center,
  zoom,
  theme = 'night',
  selectedLocation,
  startLocation,
  destination,
  currentRoute,
  currentWeather,
  onSelectLocation,
  onSetAsStart,
  onSetAsDestination,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeOutlineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Raffles Place default coordinates
    const initialLat = center[0] || 1.284349;
    const initialLng = center[1] || 103.851072;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: zoom || 14,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: [
        [1.15, 103.55],
        [1.48, 104.1],
      ],
      zoomControl: false,
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer based on current theme
    const tileUrl =
      theme === 'day'
        ? 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
        : 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png';

    const oneMapLayer = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.onemap.gov.sg" target="_blank" rel="noopener">OneMap</a> | &copy; SLA',
      maxZoom: 19,
    });

    // Fallback if OneMap tiles encounter issue
    oneMapLayer.on('tileerror', () => {
      if (tileLayerRef.current === oneMapLayer) {
        map.removeLayer(oneMapLayer);
        const fallbackUrl =
          theme === 'day'
            ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
        const fallback = L.tileLayer(fallbackUrl, {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        tileLayerRef.current = fallback;
      }
    });

    oneMapLayer.addTo(map);
    tileLayerRef.current = oneMapLayer;
    mapInstanceRef.current = map;

    // Map click handler to pick a location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedLoc: LocationItem = {
        name: `Location (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`,
        address: `Singapore (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      onSelectLocation(clickedLoc);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when theme changes (Day <-> Night)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tileUrl =
      theme === 'day'
        ? 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
        : 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png';

    const newLayer = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.onemap.gov.sg" target="_blank" rel="noopener">OneMap</a> | &copy; SLA',
      maxZoom: 19,
    });

    newLayer.on('tileerror', () => {
      if (tileLayerRef.current === newLayer) {
        map.removeLayer(newLayer);
        const fallbackUrl =
          theme === 'day'
            ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
        const fallback = L.tileLayer(fallbackUrl, {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        tileLayerRef.current = fallback;
      }
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [theme]);

  // Update map view center when prop changes (if not in a route)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!currentRoute) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, currentRoute]);

  // Update Selected Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedMarkerRef.current) {
      map.removeLayer(selectedMarkerRef.current);
      selectedMarkerRef.current = null;
    }

    if (selectedLocation) {
      const icon = createPinIcon('#3b82f6', '', 'pin');
      const marker = L.marker([selectedLocation.lat, selectedLocation.lng], { icon }).addTo(map);

      const popupContent = document.createElement('div');
      popupContent.className = `p-1 text-xs font-sans ${theme === 'day' ? 'text-slate-800' : 'text-slate-900'}`;
      popupContent.innerHTML = `
        <div class="font-bold text-sm text-slate-900 mb-1">${selectedLocation.name}</div>
        <div class="text-slate-600 text-xs mb-2">${selectedLocation.address || ''}</div>
        ${selectedLocation.postal ? `<div class="text-[10px] text-slate-500 mb-2 font-mono">Postal: ${selectedLocation.postal}</div>` : ''}
        <div class="flex gap-1.5 pt-1 border-t border-slate-200">
          <button id="btn-set-start" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition cursor-pointer">Set as Start</button>
          <button id="btn-set-dest" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-medium transition cursor-pointer">Set as Destination</button>
        </div>
      `;

      popupContent.querySelector('#btn-set-start')?.addEventListener('click', () => {
        onSetAsStart(selectedLocation);
        marker.closePopup();
      });

      popupContent.querySelector('#btn-set-dest')?.addEventListener('click', () => {
        onSetAsDestination(selectedLocation);
        marker.closePopup();
      });

      marker.bindPopup(popupContent).openPopup();
      selectedMarkerRef.current = marker;
    }
  }, [selectedLocation, theme, onSetAsStart, onSetAsDestination]);

  // Update Start and Destination Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Start marker (Green pin "A")
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (startLocation) {
      const icon = createPinIcon('#10b981', 'A', 'start');
      const marker = L.marker([startLocation.lat, startLocation.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="text-xs p-1 text-slate-900"><span class="font-bold text-emerald-700">Start (A):</span><br/>${startLocation.name}</div>`
        );
      startMarkerRef.current = marker;
    }

    // Destination marker (Red pin "B")
    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    if (destination) {
      const icon = createPinIcon('#ef4444', 'B', 'end');
      const marker = L.marker([destination.lat, destination.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="text-xs p-1 text-slate-900"><span class="font-bold text-rose-700">Destination (B):</span><br/>${destination.name}</div>`
        );
      destMarkerRef.current = marker;
    }
  }, [startLocation, destination]);

  // Update Route Polyline & Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeOutlineRef.current) {
      map.removeLayer(routeOutlineRef.current);
      routeOutlineRef.current = null;
    }

    if (currentRoute && currentRoute.coordinates && currentRoute.coordinates.length > 0) {
      const latLngs = currentRoute.coordinates;

      // Color scheme according to travel mode
      let strokeColor = '#2563eb'; // default blue
      let dashArray = '';
      if (currentRoute.travel_mode === 'walk') {
        strokeColor = '#059669'; // emerald green
        dashArray = '6, 8';
      } else if (currentRoute.travel_mode === 'cycle') {
        strokeColor = '#d97706'; // amber orange
        dashArray = '8, 6';
      } else if (currentRoute.travel_mode === 'drive') {
        strokeColor = '#4f46e5'; // indigo
      } else if (currentRoute.travel_mode === 'pt') {
        strokeColor = '#db2777'; // magenta
      }

      // Route outline for contrast (white outline in day mode, dark in night mode)
      const outlineColor = theme === 'day' ? '#ffffff' : '#0f172a';
      const outline = L.polyline(latLngs, {
        color: outlineColor,
        weight: 8,
        opacity: theme === 'day' ? 0.9 : 0.6,
      }).addTo(map);
      routeOutlineRef.current = outline;

      // Primary route line
      const polyline = L.polyline(latLngs, {
        color: strokeColor,
        weight: 5,
        opacity: 0.95,
        dashArray: dashArray || undefined,
      }).addTo(map);
      routePolylineRef.current = polyline;

      // Zoom so entire route is comfortably visible
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [currentRoute, theme]);

  const isDay = theme === 'day';

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className={`w-full h-full z-0 transition-colors duration-300 ${
          isDay ? 'bg-slate-200' : 'bg-slate-900'
        }`}
      />

      {/* Map Overlay Badge: Active OneMap Mode */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1.5">
        <div
          className={`backdrop-blur px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 border transition-colors ${
            isDay
              ? 'bg-white/95 border-slate-300 text-slate-800'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">
            OneMap SG {isDay ? 'Day Map' : 'Night Map'}
          </span>
        </div>
        {currentRoute && (
          <div
            className={`backdrop-blur px-2.5 py-1 rounded-md text-[11px] shadow border transition-colors ${
              isDay
                ? 'bg-blue-50/95 border-blue-200 text-blue-800'
                : 'bg-indigo-950/90 border-indigo-700/60 text-indigo-200'
            }`}
          >
            Route mode:{' '}
            <span
              className={`font-semibold uppercase tracking-wider ${
                isDay ? 'text-blue-900' : 'text-white'
              }`}
            >
              {currentRoute.travel_mode}
            </span>
          </div>
        )}
      </div>

      {/* Floating Weather Indicator directly on Map */}
      {currentWeather && (
        <div
          className={`absolute top-4 right-4 z-10 pointer-events-auto backdrop-blur px-3 py-2 rounded-xl shadow-xl flex items-center gap-2.5 max-w-[260px] border transition-colors ${
            isDay
              ? 'bg-white/95 border-slate-200 text-slate-800'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-100'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base border ${
              isDay
                ? 'bg-sky-50 border-sky-200 text-sky-600'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}
          >
            🌦️
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-medium uppercase tracking-wider flex items-center gap-1 ${
                isDay ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              <span>SG 2-Hr Forecast</span>
              <span className={`font-semibold ${isDay ? 'text-sky-600' : 'text-sky-400'}`}>
                • {currentWeather.area}
              </span>
            </div>
            <div
              className={`text-xs font-bold truncate ${
                isDay ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              {currentWeather.forecast}
            </div>
            <div className={`text-[10px] ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
              {currentWeather.forecastPeriod}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
