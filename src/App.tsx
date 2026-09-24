/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { InteractiveMap } from './components/InteractiveMap.tsx';
import { SearchHeader } from './components/SearchHeader.tsx';
import { DirectionsPanel } from './components/DirectionsPanel.tsx';
import { WeatherCard } from './components/WeatherCard.tsx';
import { AiAssistantPanel } from './components/AiAssistantPanel.tsx';
import {
  LocationItem,
  RouteData,
  WeatherData,
  TravelMode,
  ThemeMode,
  ChatMessage,
  AppState,
} from './types.ts';
import { Navigation2, Sun, Moon } from 'lucide-react';

const INITIAL_RAFFLES_PLACE: LocationItem = {
  name: 'Raffles Place',
  address: 'Raffles Place, Downtown Core, Singapore 048616',
  lat: 1.284349,
  lng: 103.851072,
  postal: '048616',
};

export default function App() {
  // Day / Night Theme State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('sg_nav_theme');
      return saved === 'day' || saved === 'night' ? saved : 'night';
    } catch {
      return 'night';
    }
  });

  const isDay = theme === 'day';

  const toggleTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('sg_nav_theme', newTheme);
    } catch {
      // Ignore storage errors
    }
  };

  // Core Application State
  const [mapCenter, setMapCenter] = useState<[number, number]>([1.284349, 103.851072]);
  const [zoom, setZoom] = useState<number>(14);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(INITIAL_RAFFLES_PLACE);
  const [startLocation, setStartLocation] = useState<LocationItem | null>(INITIAL_RAFFLES_PLACE);
  const [destination, setDestination] = useState<LocationItem | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);

  // Status & Loading States
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAgentStep, setActiveAgentStep] = useState<string | null>(null);

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hello! I am your agentic Singapore Travel & Navigation Assistant. I can search Singapore locations via OneMap, calculate walking, driving, cycling, and transit routes, and retrieve real-time 2-hour weather forecasts from data.gov.sg.\n\nTry the primary demo: "How do I get from Raffles Place to Marina Bay Sands, and what will the weather be like for the next 2 hours?"',
      timestamp: 'Ready',
    },
  ]);

  // Initial fetch: Load 2-hour weather for default location (Raffles Place)
  useEffect(() => {
    fetchWeatherForLocation(INITIAL_RAFFLES_PLACE.lat, INITIAL_RAFFLES_PLACE.lng, 'City');
  }, []);

  // Fetch 2-hour weather from data.gov.sg
  const fetchWeatherForLocation = async (lat?: number, lng?: number, areaQuery?: string) => {
    setIsWeatherLoading(true);
    setWeatherError(null);
    try {
      let url = '/api/weather';
      if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
      } else if (areaQuery) {
        url += `?area=${encodeURIComponent(areaQuery)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Weather API call failed');
      }
      const data = await res.json();
      if (data.status === 'ok') {
        setCurrentWeather({
          area: data.area,
          forecast: data.forecast,
          forecastPeriod: data.forecastPeriod,
          validPeriod: data.validPeriod,
          updateTime: data.updateTime,
        });
      } else {
        setWeatherError(data.message || 'Live weather unavailable');
      }
    } catch (err: any) {
      setWeatherError('Live 2-hour weather temporarily unavailable');
    } finally {
      setIsWeatherLoading(false);
    }
  };

  // Location selection handler
  const handleSelectLocation = (loc: LocationItem) => {
    setSelectedLocation(loc);
    setMapCenter([loc.lat, loc.lng]);
    setZoom(15);
    fetchWeatherForLocation(loc.lat, loc.lng, loc.name);
  };

  // Set as start
  const handleSetAsStart = (loc: LocationItem) => {
    setStartLocation(loc);
  };

  // Set as destination
  const handleSetAsDestination = (loc: LocationItem) => {
    setDestination(loc);
    fetchWeatherForLocation(loc.lat, loc.lng, loc.name);
  };

  // Manual Get Directions
  const handleGetDirections = async () => {
    if (!startLocation || !destination) return;
    setIsRoutingLoading(true);
    try {
      const url = `/api/onemap-route?start=${startLocation.lat},${startLocation.lng}&end=${destination.lat},${destination.lng}&routeType=${travelMode}&startName=${encodeURIComponent(
        startLocation.name
      )}&endName=${encodeURIComponent(destination.name)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 0 && data.coordinates) {
        setCurrentRoute(data);
      } else {
        alert(data.status_message || 'Could not compute directions between these points.');
      }
    } catch (err: any) {
      alert('Routing request failed. Please check connection.');
    } finally {
      setIsRoutingLoading(false);
    }
  };

  // Swap endpoints
  const handleSwapEndpoints = async () => {
    if (!startLocation || !destination) return;
    const newStart = destination;
    const newDest = startLocation;
    setStartLocation(newStart);
    setDestination(newDest);

    if (currentRoute) {
      setIsRoutingLoading(true);
      try {
        const url = `/api/onemap-route?start=${newStart.lat},${newStart.lng}&end=${newDest.lat},${newDest.lng}&routeType=${travelMode}&startName=${encodeURIComponent(
          newStart.name
        )}&endName=${encodeURIComponent(newDest.name)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 0 && data.coordinates) {
          setCurrentRoute(data);
        }
      } catch {
        // Keep prior route
      } finally {
        setIsRoutingLoading(false);
      }
    }
  };

  // Clear route
  const handleClearRoute = () => {
    setCurrentRoute(null);
    setDestination(null);
  };

  // AI Assistant message handler
  const handleSendAiMessage = async (userPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);
    setActiveAgentStep('Analyzing query and determining tools...');

    // Prepare current state snapshot for AI
    const currentState: AppState = {
      mapCenter,
      zoom,
      selectedLocation,
      startLocation,
      destination,
      travelMode,
      currentRoute,
      currentWeather,
    };

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          currentState,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI assistant error (${res.status})`);
      }

      const data = await res.json();

      // Apply state updates returned by agent
      if (data.stateUpdates) {
        const u = data.stateUpdates;
        if (u.selectedLocation !== undefined) setSelectedLocation(u.selectedLocation);
        if (u.startLocation !== undefined) setStartLocation(u.startLocation);
        if (u.destination !== undefined) setDestination(u.destination);
        if (u.travelMode !== undefined) setTravelMode(u.travelMode);
        if (u.currentRoute !== undefined) setCurrentRoute(u.currentRoute);
        if (u.currentWeather !== undefined) setCurrentWeather(u.currentWeather);
        if (u.mapCenter !== undefined) setMapCenter(u.mapCenter);
        if (u.zoom !== undefined) setZoom(u.zoom);
      }

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Request completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: data.actions || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'I encountered an issue processing your request. Please ensure the server has network access and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
      setActiveAgentStep(null);
    }
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen font-sans overflow-hidden transition-colors duration-200 ${
        isDay ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`h-14 shrink-0 backdrop-blur px-4 flex items-center justify-between z-20 border-b transition-colors duration-200 ${
          isDay
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 text-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Navigation2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
              <span>Singapore Travel Assistant</span>
              <span
                className={`text-[10px] font-normal px-2 py-0.5 rounded-full border hidden sm:inline ${
                  isDay
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-blue-950 text-blue-300 border-blue-800/60'
                }`}
              >
                OneMap + data.gov.sg
              </span>
            </h1>
            <div
              className={`text-[10px] hidden sm:block ${
                isDay ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Agentic navigation with live OneMap geocoding, routing & 2-hr nowcast
            </div>
          </div>
        </div>

        {/* Header Right: Day/Night Mode Toggle & Status */}
        <div className="flex items-center gap-3">
          {/* Day / Night Mode Segmented Control */}
          <div
            className={`flex items-center p-0.5 rounded-xl border transition-colors ${
              isDay ? 'bg-slate-200/80 border-slate-300' : 'bg-slate-800/80 border-slate-700/70'
            }`}
            role="group"
            aria-label="Theme mode toggle"
          >
            <button
              onClick={() => toggleTheme('day')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                isDay
                  ? 'bg-white text-blue-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Day Mode"
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="text-[11px]">Day</span>
            </button>
            <button
              onClick={() => toggleTheme('night')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                !isDay
                  ? 'bg-slate-700 text-blue-300 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Night Mode"
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Night</span>
            </button>
          </div>

          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
              isDay
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">OneMap Connected</span>
          </div>
        </div>
      </header>

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center Area: Map-First View */}
        <div className="flex-1 flex flex-col relative h-[55%] lg:h-full overflow-hidden">
          {/* Floating Search Bar on Map */}
          <div className="absolute top-4 left-4 right-4 sm:left-6 sm:w-96 z-20">
            <SearchHeader
              onSelectLocation={handleSelectLocation}
              selectedLocation={selectedLocation}
              theme={theme}
            />
          </div>

          {/* Leaflet Map with OneMap Tiles (Day / Night) */}
          <div className="flex-1 w-full h-full">
            <InteractiveMap
              center={mapCenter}
              zoom={zoom}
              theme={theme}
              selectedLocation={selectedLocation}
              startLocation={startLocation}
              destination={destination}
              currentRoute={currentRoute}
              currentWeather={currentWeather}
              onSelectLocation={handleSelectLocation}
              onSetAsStart={handleSetAsStart}
              onSetAsDestination={handleSetAsDestination}
            />
          </div>
        </div>

        {/* Right Sidebar: Directions, Weather & AI Assistant */}
        <div
          className={`w-full lg:w-[460px] xl:w-[490px] h-[45%] lg:h-full border-t lg:border-t-0 lg:border-l flex flex-col shrink-0 overflow-y-auto z-10 transition-colors duration-200 ${
            isDay ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="p-4 space-y-4">
            {/* AI Assistant Section */}
            <AiAssistantPanel
              messages={messages}
              isLoading={isAiLoading}
              theme={theme}
              onSendMessage={handleSendAiMessage}
              activeAgentStep={activeAgentStep}
            />

            {/* Directions Section */}
            <DirectionsPanel
              startLocation={startLocation}
              destination={destination}
              travelMode={travelMode}
              currentRoute={currentRoute}
              isLoading={isRoutingLoading}
              theme={theme}
              onSetStart={setStartLocation}
              onSetDestination={setDestination}
              onSetTravelMode={(mode) => {
                setTravelMode(mode);
                if (currentRoute && startLocation && destination) {
                  // Re-query route with new mode
                  const url = `/api/onemap-route?start=${startLocation.lat},${startLocation.lng}&end=${destination.lat},${destination.lng}&routeType=${mode}&startName=${encodeURIComponent(
                    startLocation.name
                  )}&endName=${encodeURIComponent(destination.name)}`;
                  fetch(url)
                    .then((r) => r.json())
                    .then((d) => {
                      if (d.status === 0) setCurrentRoute(d);
                    })
                    .catch(() => {});
                }
              }}
              onGetDirections={handleGetDirections}
              onSwapEndpoints={handleSwapEndpoints}
              onClearRoute={handleClearRoute}
            />

            {/* Weather Card Section */}
            <WeatherCard
              weather={currentWeather}
              isLoading={isWeatherLoading}
              theme={theme}
              onRefresh={() => {
                if (selectedLocation) {
                  fetchWeatherForLocation(selectedLocation.lat, selectedLocation.lng, selectedLocation.name);
                } else {
                  fetchWeatherForLocation(undefined, undefined, 'City');
                }
              }}
              error={weatherError}
            />

            {/* Footer Disclaimer */}
            <footer
              className={`text-[10px] text-center py-2 border-t leading-relaxed transition-colors ${
                isDay ? 'border-slate-200 text-slate-400' : 'border-slate-900 text-slate-500'
              }`}
            >
              This is an SMU course project and is not affiliated with or endorsed by OneMap, SLA, data.gov.sg, or the Singapore Government.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
