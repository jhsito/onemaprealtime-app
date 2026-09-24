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
  MapPin,
} from 'lucide-react';
import { LocationItem, RouteData, TravelMode } from '../types.ts';
import { formatDistance, formatDuration } from '../utils/polyline.ts';

interface DirectionsPanelProps {
  startLocation: LocationItem | null;
  destination: LocationItem | null;
  travelMode: TravelMode;
  currentRoute: RouteData | null;
  isLoading: boolean;
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
  onSetStart,
  onSetDestination,
  onSetTravelMode,
  onGetDirections,
  onSwapEndpoints,
  onClearRoute,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);

  const travelModes: { id: TravelMode; label: string; icon: React.ReactNode }[] = [
    { id: 'walk', label: 'Walk', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'drive', label: 'Drive', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'cycle', label: 'Cycle', icon: <Bike className="w-3.5 h-3.5" /> },
    { id: 'pt', label: 'Transit', icon: <Bus className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Directions</h2>
        </div>
        {currentRoute && (
          <button
            onClick={onClearRoute}
            className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
            title="Clear Route"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Start and End input row */}
      <div className="relative flex flex-col gap-2">
        {/* Start Point */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-semibold text-slate-400">From</div>
            <div className="text-xs text-slate-200 truncate font-medium">
              {startLocation ? startLocation.name : 'Select or search start point...'}
            </div>
          </div>
          {startLocation && (
            <button
              onClick={() => onSetStart(null)}
              className="text-slate-500 hover:text-slate-300 text-xs px-1 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        {/* Swap Button */}
        <button
          onClick={onSwapEndpoints}
          className="absolute right-3 top-[34px] z-10 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shadow flex items-center justify-center transition hover:scale-105 active:scale-95 cursor-pointer"
          title="Swap Start & Destination"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>

        {/* Destination Point */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            B
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-semibold text-slate-400">To</div>
            <div className="text-xs text-slate-200 truncate font-medium">
              {destination ? destination.name : 'Select or search destination...'}
            </div>
          </div>
          {destination && (
            <button
              onClick={() => onSetDestination(null)}
              className="text-slate-500 hover:text-slate-300 text-xs px-1 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Travel Mode Pills */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/50 rounded-xl border border-slate-800">
        {travelModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSetTravelMode(mode.id)}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              travelMode === mode.id
                ? 'bg-blue-600 text-white shadow-sm'
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
        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
        <div className="mt-1 bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold text-sm text-white">
                {formatDuration(currentRoute.route_summary?.total_time)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Milestone className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold text-sm text-white">
                {formatDistance(currentRoute.route_summary?.total_distance)}
              </span>
            </div>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {currentRoute.travel_mode}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900 pt-2">
            <span>
              Route: <span className="text-slate-300 font-medium">{currentRoute.start_location?.name}</span> →{' '}
              <span className="text-slate-300 font-medium">{currentRoute.destination?.name}</span>
            </span>
          </div>

          {currentRoute.route_instructions && currentRoute.route_instructions.length > 0 && (
            <div className="border-t border-slate-900 pt-1">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between text-[11px] text-blue-400 hover:text-blue-300 py-1 transition cursor-pointer font-medium"
              >
                <span>Turn-by-turn guidance ({currentRoute.route_instructions.length} steps)</span>
                {showInstructions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showInstructions && (
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-slate-300">
                  {currentRoute.route_instructions.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">{idx + 1}.</span>
                      <span className="text-slate-300">{step}</span>
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
