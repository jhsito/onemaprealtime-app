import React from 'react';
import {
  Cloud,
  CloudSun,
  Sun,
  CloudRain,
  CloudLightning,
  RefreshCw,
  Clock,
  MapPin,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { WeatherData, ThemeMode } from '../types.ts';

interface WeatherCardProps {
  weather: WeatherData | null;
  isLoading: boolean;
  theme?: ThemeMode;
  onRefresh: () => void;
  error?: string | null;
}

function getWeatherIcon(forecast: string) {
  const f = (forecast || '').toLowerCase();
  if (f.includes('thunder') || f.includes('thundery')) {
    return <CloudLightning className="w-8 h-8 text-amber-500" />;
  }
  if (f.includes('rain') || f.includes('shower')) {
    return <CloudRain className="w-8 h-8 text-sky-500" />;
  }
  if (f.includes('cloud') || f.includes('overcast')) {
    return <CloudSun className="w-8 h-8 text-blue-400" />;
  }
  if (f.includes('fair') || f.includes('sunny') || f.includes('clear')) {
    return <Sun className="w-8 h-8 text-amber-500" />;
  }
  return <Cloud className="w-8 h-8 text-slate-400" />;
}

function formatUpdatedTime(timestamp: string): string {
  if (!timestamp) return 'Just now';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return timestamp;
  }
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  weather,
  isLoading,
  theme = 'night',
  onRefresh,
  error,
}) => {
  const isDay = theme === 'day';

  return (
    <div
      className={`rounded-2xl p-6 shadow-xl border transition-all duration-200 ${
        isDay
          ? 'bg-white border-slate-200 shadow-slate-200/60'
          : 'bg-slate-900/90 border-slate-800 shadow-2xl'
      }`}
    >
      {/* Top Bar with Prominent Heading */}
      <div
        className={`flex items-center justify-between pb-4 mb-4 border-b ${
          isDay ? 'border-slate-200' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
          <h2
            className={`text-lg sm:text-xl font-extrabold tracking-tight ${
              isDay ? 'text-slate-900' : 'text-white'
            }`}
          >
            2-Hour Weather Forecast
          </h2>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border disabled:opacity-50 ${
            isDay
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
          title="Refresh live 2-hour forecast"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
          <span>{isLoading ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
          <p className={`text-sm font-medium ${isDay ? 'text-slate-600' : 'text-slate-300'}`}>
            Retrieving live 2-hour forecast...
          </p>
        </div>
      ) : error ? (
        /* Error State */
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            isDay
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <div className="font-semibold">
              Live 2-hour weather information is temporarily unavailable.
            </div>
            {error !== 'Live 2-hour weather information is temporarily unavailable.' && (
              <div className="text-xs mt-1 opacity-80">{error}</div>
            )}
          </div>
        </div>
      ) : weather ? (
        /* Active Weather Forecast Display */
        <div className="space-y-5">
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
              isDay
                ? 'bg-gradient-to-br from-sky-50/70 to-blue-50/30 border-sky-100'
                : 'bg-gradient-to-br from-slate-950 to-slate-900 border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3.5 rounded-2xl border ${
                  isDay
                    ? 'bg-sky-100/80 border-sky-200 shadow-sm'
                    : 'bg-sky-500/10 border-sky-500/20'
                }`}
              >
                {getWeatherIcon(weather.forecast)}
              </div>
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wider ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                  Location
                </div>
                <div
                  className={`text-2xl font-bold flex items-center gap-2 ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  <MapPin className="w-5 h-5 text-sky-500 shrink-0" />
                  <span>{weather.area}</span>
                </div>
                <div className={`text-base font-semibold mt-1 ${isDay ? 'text-sky-700' : 'text-sky-400'}`}>
                  Forecast: <span className="font-bold">{weather.forecast}</span>
                </div>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex flex-col gap-1 sm:text-right ${
                isDay
                  ? 'bg-white/80 border-slate-200'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                Official Feed
              </span>
              <span className="text-xs font-mono font-bold text-emerald-500">
                data.gov.sg LIVE
              </span>
              <span className={`text-[11px] ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                2-Hour Nowcast
              </span>
            </div>
          </div>

          {/* Details Row: Forecast Period and Last Updated */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className={`text-[11px] font-medium uppercase ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                  Forecast Period
                </div>
                <div className={`text-sm font-bold ${isDay ? 'text-slate-900' : 'text-slate-100'}`}>
                  {weather.forecastPeriod || weather.validPeriod?.text || 'Next 2 Hours'}
                </div>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className={`text-[11px] font-medium uppercase ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                  Last Updated
                </div>
                <div className={`text-sm font-bold ${isDay ? 'text-slate-900' : 'text-slate-100'}`}>
                  {formatUpdatedTime(weather.updateTime)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Initial State */
        <div className={`text-center py-8 text-sm ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
          Select a forecast area from the search or list below to view its live 2-hour forecast.
        </div>
      )}

      {/* Footer Disclaimer */}
      <div
        className={`mt-4 pt-3 border-t text-[11px] text-center ${
          isDay ? 'border-slate-200 text-slate-400' : 'border-slate-800 text-slate-500'
        }`}
      >
        Official Singapore 2-Hour Weather Nowcast from data.gov.sg (National Environment Agency)
      </div>
    </div>
  );
};
