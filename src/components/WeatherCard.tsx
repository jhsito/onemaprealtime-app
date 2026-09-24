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
import { WeatherData } from '../types.ts';

interface WeatherCardProps {
  weather: WeatherData | null;
  isLoading: boolean;
  onRefresh: () => void;
  error?: string | null;
}

function getWeatherIcon(forecast: string) {
  const f = (forecast || '').toLowerCase();
  if (f.includes('thunder') || f.includes('thundery')) {
    return <CloudLightning className="w-5 h-5 text-amber-400" />;
  }
  if (f.includes('rain') || f.includes('shower')) {
    return <CloudRain className="w-5 h-5 text-sky-400" />;
  }
  if (f.includes('cloud') || f.includes('overcast')) {
    return <CloudSun className="w-5 h-5 text-blue-300" />;
  }
  if (f.includes('fair') || f.includes('sunny') || f.includes('clear')) {
    return <Sun className="w-5 h-5 text-amber-400" />;
  }
  return <Cloud className="w-5 h-5 text-slate-300" />;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  weather,
  isLoading,
  onRefresh,
  error,
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Singapore 2-Hour Weather
          </h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
          title="Refresh 2-hour forecast"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <div className="bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Live 2-hour weather forecast temporarily unavailable.</span>
        </div>
      ) : weather ? (
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                {getWeatherIcon(weather.forecast)}
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{weather.forecast}</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  <span className="text-slate-200 font-medium">{weather.area} Area</span>
                </div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800/50">
              2-Hour Window
            </span>
          </div>

          <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Valid: <strong className="text-slate-300">{weather.forecastPeriod}</strong></span>
            </div>
            {weather.updateTime && (
              <span className="text-[10px] text-slate-500">
                Updated: {new Date(weather.updateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-slate-500">
          Select or search a location to inspect its live 2-hour weather.
        </div>
      )}

      <div className="text-[10px] text-slate-400 text-center tracking-tight">
        Powered by data.gov.sg real-time 2-hr nowcast API
      </div>
    </div>
  );
};
