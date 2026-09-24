import React, { useState } from 'react';
import {
  ArrowUpDown,
  Footprints,
  Car,
  Bike,
  Bus,
  Clock,
  Milestone,
  Route as RouteIcon,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { LocationItem, RouteData, TravelMode, ThemeMode } from '../types.ts';
import { formatDistance, formatDuration } from '../utils/polyline.ts';

interface DirectionsPanelProps {
  startLocation: LocationItem | null;
  destination: LocationItem | null;
  travelMode: TravelMode;
  currentRoute: RouteData | null;
  isLoading: boolean;
  theme?: ThemeMode;
  onSetStart: (loc: LocationItem | null) => void;
  onSetDestination: (loc: LocationItem | null) => void;
  onSetTravelMode: (mode: TravelMode) => void;
  onGetDirections: () => void;
  onSwapEndpoints: () => void;
  onClearRoute: () => void;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  startLocation,
  destination,
  travelMode,
  currentRoute,
  isLoading,
  theme = 'night',
  onSetStart,
  onSetDestination,
  onSetTravelMode,
  onGetDirections,
  onSwapEndpoints,
  onClearRoute,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const isDay = theme === 'day';

  const travelModes: { id: TravelMode; label: string; icon: React.ReactNode }[] = [
    { id: 'walk', label: 'Walk', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'drive', label: 'Drive', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'cycle', label: 'Cycle', icon: <Bike className="w-3.5 h-3.5" /> },
    { id: 'pt', label: 'Transit', icon: <Bus className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className={`backdrop-blur rounded-2xl p-4 shadow-xl flex flex-col gap-3.5 border transition-colors ${
        isDay ? 'bg-white/95 border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDay ? 'border-slate-200' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-blue-500" />
          <h2
            className={`text-xs font-bold uppercase tracking-wider ${
              isDay ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            Directions
          </h2>
        </div>
        {currentRoute && (
          <button
            onClick={onClearRoute}
            className={`text-[11px] flex items-center gap-1 transition cursor-pointer ${
              isDay ? 'text-slate-500 hover:text-rose-600' : 'text-slate-400 hover:text-rose-400'
            }`}
            title="Clear Route"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Start and End input row */}
      <div className="relative flex flex-col gap-2">
        {/* Start Point */}
        <div
          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
            isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[10px] uppercase font-semibold ${
                isDay ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              From
            </div>
            <div
              className={`text-xs truncate font-medium ${
                isDay ? 'text-slate-800' : 'text-slate-200'
              }`}
            >
              {startLocation ? startLocation.name : 'Select or search start point...'}
            </div>
          </div>
          {startLocation && (
            <button
              onClick={() => onSetStart(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        {/* Swap Button */}
        <button
          onClick={onSwapEndpoints}
          className={`absolute right-3 top-[34px] z-10 w-7 h-7 rounded-full shadow flex items-center justify-center transition hover:scale-105 active:scale-95 cursor-pointer border ${
            isDay
              ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Swap Start & Destination"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>

        {/* Destination Point */}
        <div
          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
            isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            B
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[10px] uppercase font-semibold ${
                isDay ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              To
            </div>
            <div
              className={`text-xs truncate font-medium ${
                isDay ? 'text-slate-800' : 'text-slate-200'
              }`}
            >
              {destination ? destination.name : 'Select or search destination...'}
            </div>
          </div>
          {destination && (
            <button
              onClick={() => onSetDestination(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Travel Mode Pills */}
      <div
        className={`grid grid-cols-4 gap-1.5 p-1 rounded-xl border transition-colors ${
          isDay ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/50 border-slate-800'
        }`}
      >
        {travelModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSetTravelMode(mode.id)}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              travelMode === mode.id
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : isDay
                ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {mode.icon}
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Get Directions CTA */}
      <button
        onClick={onGetDirections}
        disabled={isLoading || !startLocation || !destination}
        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Calculating Route...</span>
          </>
        ) : (
          <>
            <RouteIcon className="w-4 h-4" />
            <span>Get Directions</span>
          </>
        )}
      </button>

      {/* Route Results Box */}
      {currentRoute && (
        <div
          className={`rounded-xl p-3 flex flex-col gap-2.5 border transition-colors ${
            isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/90'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span
                className={`font-bold text-sm ${isDay ? 'text-slate-900' : 'text-white'}`}
              >
                {formatDuration(currentRoute.route_summary?.total_time)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Milestone className="w-3.5 h-3.5 text-indigo-500" />
              <span
                className={`font-bold text-sm ${isDay ? 'text-slate-900' : 'text-white'}`}
              >
                {formatDistance(currentRoute.route_summary?.total_distance)}
              </span>
            </div>
            <span
              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
                isDay
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {currentRoute.travel_mode}
            </span>
          </div>

          <div
            className={`text-[11px] flex items-center justify-between border-t pt-2 ${
              isDay ? 'border-slate-200 text-slate-600' : 'border-slate-900 text-slate-400'
            }`}
          >
            <span>
              Route:{' '}
              <span className={`font-medium ${isDay ? 'text-slate-900' : 'text-slate-300'}`}>
                {currentRoute.start_location?.name}
              </span>{' '}
              →{' '}
              <span className={`font-medium ${isDay ? 'text-slate-900' : 'text-slate-300'}`}>
                {currentRoute.destination?.name}
              </span>
            </span>
          </div>

          {currentRoute.route_instructions && currentRoute.route_instructions.length > 0 && (
            <div
              className={`border-t pt-1 ${
                isDay ? 'border-slate-200' : 'border-slate-900'
              }`}
            >
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between text-[11px] text-blue-600 hover:text-blue-700 py-1 transition cursor-pointer font-medium"
              >
                <span>Turn-by-turn guidance ({currentRoute.route_instructions.length} steps)</span>
                {showInstructions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showInstructions && (
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {currentRoute.route_instructions.map((step, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-1.5 rounded border ${
                        isDay
                          ? 'bg-white border-slate-200 text-slate-700'
                          : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 mt-0.5">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
