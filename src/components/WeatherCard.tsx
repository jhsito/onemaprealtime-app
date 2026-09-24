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
    return <CloudLightning className="w-5 h-5 text-amber-500" />;
  }
  if (f.includes('rain') || f.includes('shower')) {
    return <CloudRain className="w-5 h-5 text-sky-500" />;
  }
  if (f.includes('cloud') || f.includes('overcast')) {
    return <CloudSun className="w-5 h-5 text-blue-400" />;
  }
  if (f.includes('fair') || f.includes('sunny') || f.includes('clear')) {
    return <Sun className="w-5 h-5 text-amber-500" />;
  }
  return <Cloud className="w-5 h-5 text-slate-400" />;
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
      className={`backdrop-blur rounded-2xl p-4 shadow-xl flex flex-col gap-2.5 border transition-colors ${
        isDay ? 'bg-white/95 border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDay ? 'border-slate-200' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <h2
            className={`text-xs font-bold uppercase tracking-wider ${
              isDay ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            Singapore 2-Hour Weather
          </h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50 ${
            isDay ? 'text-slate-500 hover:text-sky-600' : 'text-slate-400 hover:text-sky-300'
          }`}
          title="Refresh 2-hour forecast"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
            isDay
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>Live 2-hour weather forecast temporarily unavailable.</span>
        </div>
      ) : weather ? (
        <div
          className={`rounded-xl p-3 flex flex-col gap-2 border transition-colors ${
            isDay
              ? 'bg-gradient-to-br from-sky-50/50 to-white border-sky-100'
              : 'bg-gradient-to-br from-slate-950 to-slate-900 border-slate-800/80'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl border ${
                  isDay
                    ? 'bg-sky-100/70 border-sky-200'
                    : 'bg-sky-500/10 border-sky-500/20'
                }`}
              >
                {getWeatherIcon(weather.forecast)}
              </div>
              <div>
                <div
                  className={`text-sm font-bold flex items-center gap-1.5 ${
                    isDay ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  <span>{weather.forecast}</span>
                </div>
                <div
                  className={`text-[11px] flex items-center gap-1 mt-0.5 ${
                    isDay ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-sky-500" />
                  <span className={`font-medium ${isDay ? 'text-slate-700' : 'text-slate-200'}`}>
                    {weather.area} Area
                  </span>
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isDay
                  ? 'bg-sky-100 text-sky-800 border-sky-200'
                  : 'bg-sky-950 text-sky-300 border-sky-800/50'
              }`}
            >
              2-Hour Window
            </span>
          </div>

          <div
            className={`border-t pt-2 flex items-center justify-between text-[11px] ${
              isDay ? 'border-slate-200 text-slate-500' : 'border-slate-800/60 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                Valid:{' '}
                <strong className={isDay ? 'text-slate-800' : 'text-slate-300'}>
                  {weather.forecastPeriod}
                </strong>
              </span>
            </div>
            {weather.updateTime && (
              <span className={`text-[10px] ${isDay ? 'text-slate-400' : 'text-slate-500'}`}>
                Updated:{' '}
                {new Date(weather.updateTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`text-center py-4 text-xs ${
            isDay ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Select or search a location to inspect its live 2-hour weather.
        </div>
      )}

      <div
        className={`text-[10px] text-center tracking-tight ${
          isDay ? 'text-slate-400' : 'text-slate-400'
        }`}
      >
        Powered by data.gov.sg real-time 2-hr nowcast API
      </div>
    </div>
  );
};
