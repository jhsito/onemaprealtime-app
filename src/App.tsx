/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SearchHeader } from './components/SearchHeader.tsx';
import { WeatherCard } from './components/WeatherCard.tsx';
import { AiAssistantPanel } from './components/AiAssistantPanel.tsx';
import { HealthModal } from './components/HealthModal.tsx';
import {
  ForecastArea,
  WeatherData,
  ThemeMode,
  ChatMessage,
} from './types.ts';
import { CloudSun, Sun, Moon, Activity, MapPin } from 'lucide-react';

export default function App() {
  // Day / Night Theme State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('sg_weather_theme');
      return saved === 'day' || saved === 'night' ? saved : 'night';
    } catch {
      return 'night';
    }
  });

  const isDay = theme === 'day';

  const toggleTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('sg_weather_theme', newTheme);
    } catch {
      // Ignore storage errors
    }
  };

  // Weather State
  const [availableAreas, setAvailableAreas] = useState<ForecastArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('Bedok');
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to track current selected area for background refresh
  const selectedAreaRef = React.useRef(selectedArea);
  useEffect(() => {
    selectedAreaRef.current = selectedArea;
  }, [selectedArea]);

  // Health Modal State
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // AI Assistant State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Welcome to the Singapore 2-Hour Weather Assistant!\n\nI provide official live 2-hour nowcasts from data.gov.sg across all 47 Singapore forecast areas.\n\nTry asking:\n• "What\'s the weather in Bedok?"\n• "Will it rain in Jurong?"\n• "Show me the 2-hour forecast for Tampines."',
      timestamp: 'Ready',
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAgentStep, setActiveAgentStep] = useState<string | null>(null);

  // Fetch 2-Hour Weather from /api/weather
  const fetchWeather = async (areaName?: string, isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const targetArea = areaName || selectedAreaRef.current || 'Bedok';
      const url = targetArea ? `/api/weather?area=${encodeURIComponent(targetArea)}` : '/api/weather';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Live 2-hour weather information is temporarily unavailable.');
      }
      const data = await res.json();
      if (data.success || data.status === 'ok') {
        if (data.areas && Array.isArray(data.areas)) {
          setAvailableAreas(data.areas);
        }

        // If the previously selected area is still present in returned areas, keep it; else update to returned area
        const resolvedArea = data.area || targetArea;
        setSelectedArea(resolvedArea);

        const periodVal = data.forecastPeriod || data.validPeriod?.text || 'Next 2 Hours';
        const updateVal = data.lastUpdated || data.updateTime || new Date().toISOString();

        setCurrentWeather({
          area: resolvedArea,
          forecast: data.forecast,
          forecastPeriod: periodVal,
          validPeriod: data.validPeriod,
          lastUpdated: updateVal,
          updateTime: updateVal,
        });
      } else {
        setError(data.message || 'Live 2-hour weather information is temporarily unavailable.');
      }
    } catch {
      setError('Live 2-hour weather information is temporarily unavailable.');
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  // Initial fetch on mount & 5-minute periodic refresh
  useEffect(() => {
    fetchWeather('Bedok');

    // 5-minute periodic refresh interval (preserves user's selected area)
    const intervalId = setInterval(() => {
      fetchWeather(selectedAreaRef.current, true);
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Handle area selection from search or quick picks
  const handleSelectArea = (areaName: string) => {
    setSelectedArea(areaName);
    fetchWeather(areaName);
  };

  // AI Chat Handler
  const handleSendMessage = async (userPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);
    setActiveAgentStep('Retrieving live 2-hour forecast...');

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          currentState: { selectedArea, currentWeather },
        }),
      });

      if (!res.ok) {
        throw new Error(`AI assistant error (${res.status})`);
      }

      const data = await res.json();

      // Apply state updates from assistant (e.g. updated weather card)
      if (data.stateUpdates) {
        if (data.stateUpdates.currentWeather) {
          setCurrentWeather(data.stateUpdates.currentWeather);
        }
        if (data.stateUpdates.selectedArea) {
          setSelectedArea(data.stateUpdates.selectedArea);
        }
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Request completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: data.actions || [],
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Live 2-hour weather information is temporarily unavailable.',
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
      className={`min-h-screen w-screen font-sans flex flex-col transition-colors duration-200 overflow-x-hidden ${
        isDay ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Application Header */}
      <header
        className={`h-16 shrink-0 backdrop-blur px-4 sm:px-6 flex items-center justify-between border-b transition-colors duration-200 sticky top-0 z-30 ${
          isDay ? 'bg-white/95 border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <CloudSun className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
              <span>Singapore 2-Hour Weather Assistant</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline ${
                  isDay
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-sky-950 text-sky-300 border-sky-800/60'
                }`}
              >
                data.gov.sg LIVE
              </span>
            </h1>
            <div className={`text-[11px] hidden sm:block ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
              Official National Environment Agency 2-Hour Nowcast
            </div>
          </div>
        </div>

        {/* Controls: Day/Night Toggle & /api/health */}
        <div className="flex items-center gap-3">
          {/* Day / Night Mode Toggle */}
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
                  ? 'bg-white text-sky-700 shadow-sm font-semibold'
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
                  ? 'bg-slate-700 text-sky-300 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Night Mode"
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Night</span>
            </button>
          </div>

          {/* /api/health Diagnostics Button */}
          <button
            onClick={() => setIsHealthModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              isDay
                ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 text-emerald-800 shadow-sm'
                : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-700/60 text-emerald-300 shadow-sm'
            }`}
            title="Inspect /api/health diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-semibold">/api/health</span>
          </button>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Search Bar & Quick Picks */}
        <section>
          <SearchHeader
            availableAreas={availableAreas}
            selectedArea={selectedArea}
            onSelectArea={handleSelectArea}
            theme={theme}
            isLoading={isLoading}
          />
        </section>

        {/* 2-Column Responsive Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Left Column: Prominent Weather Card + 47-Area Island Nowcast Overview */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <WeatherCard
              weather={currentWeather}
              isLoading={isLoading}
              theme={theme}
              onRefresh={() => fetchWeather(selectedArea)}
              error={error}
            />

            {/* Island-wide 47 Singapore Forecast Areas Overview */}
            {availableAreas.length > 0 && (
              <div
                className={`rounded-2xl p-5 border shadow-xl transition-all duration-200 ${
                  isDay ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800 shadow-2xl'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-sky-500" />
                    <h3 className={`text-sm font-bold tracking-tight ${isDay ? 'text-slate-900' : 'text-slate-100'}`}>
                      All Singapore Forecast Areas ({availableAreas.length})
                    </h3>
                  </div>
                  <span className={`text-[11px] ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                    Click any area to view nowcast
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                  {availableAreas.map((area) => {
                    const isSelected = selectedArea.toLowerCase() === area.name.toLowerCase();
                    const isRain =
                      area.forecast.toLowerCase().includes('rain') ||
                      area.forecast.toLowerCase().includes('shower') ||
                      area.forecast.toLowerCase().includes('thunder');

                    return (
                      <button
                        key={area.name}
                        onClick={() => handleSelectArea(area.name)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-semibold shadow-sm'
                            : isDay
                            ? 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-700'
                            : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <span className="font-semibold truncate">{area.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                            isRain
                              ? 'bg-sky-500/20 text-sky-400 font-medium'
                              : 'text-slate-400'
                          }`}
                        >
                          {area.forecast}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: AI 2-Hour Weather Assistant */}
          <div className="lg:col-span-5 h-full">
            <AiAssistantPanel
              messages={messages}
              isLoading={isAiLoading}
              theme={theme}
              onSendMessage={handleSendMessage}
              activeAgentStep={activeAgentStep}
            />
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <footer
        className={`shrink-0 py-3 px-4 border-t text-center text-xs transition-colors duration-200 ${
          isDay ? 'border-slate-200 bg-white text-slate-500' : 'border-slate-800 bg-slate-900/60 text-slate-400'
        }`}
      >
        <p>
          Official Singapore weather data provided by{' '}
          <a
            href="https://data.gov.sg"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-sky-500 font-semibold"
          >
            data.gov.sg
          </a>{' '}
          (National Environment Agency). This application provides strictly 2-hour nowcasts.
        </p>
      </footer>

      {/* Health Modal */}
      <HealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        theme={theme}
      />
    </div>
  );
}
