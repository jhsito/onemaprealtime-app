import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, X, AlertCircle } from 'lucide-react';
import { ForecastArea, ThemeMode } from '../types.ts';

interface SearchHeaderProps {
  availableAreas: ForecastArea[];
  selectedArea: string | null;
  onSelectArea: (areaName: string) => void;
  theme?: ThemeMode;
  isLoading?: boolean;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  availableAreas,
  selectedArea,
  onSelectArea,
  theme = 'night',
  isLoading = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDay = theme === 'day';

  // Synchronize input display when selectedArea changes
  useEffect(() => {
    if (selectedArea) {
      setQuery(selectedArea);
    }
  }, [selectedArea]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching areas dynamically from live API available areas
  const matchingAreas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableAreas.slice(0, 8);

    return availableAreas.filter((a) => {
      const name = a.name.toLowerCase();
      // Match direct name or partial words
      return name.includes(q) || q.includes(name);
    });
  }, [query, availableAreas]);

  const hasNoMatch = query.trim().length > 0 && matchingAreas.length === 0;

  const handleSelect = (areaName: string) => {
    setQuery(areaName);
    setIsOpen(false);
    onSelectArea(areaName);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingAreas.length > 0) {
        handleSelect(matchingAreas[0].name);
      }
    }
  };

  // Derive popular quick picks dynamically from live availableAreas
  const quickPicks = useMemo(() => {
    const popularNames = ['Bedok', 'Tampines', 'Jurong West', 'Jurong East', 'Orchard', 'Changi', 'Woodlands', 'City'];
    return popularNames.filter((name) =>
      availableAreas.some((a) => a.name.toLowerCase() === name.toLowerCase())
    );
  }, [availableAreas]);

  return (
    <div className="relative w-full z-30" ref={containerRef}>
      {/* Search Input Box */}
      <div
        className={`flex items-center gap-2 p-2 rounded-2xl border shadow-xl transition-all duration-200 ${
          isDay
            ? 'bg-white border-slate-300 shadow-slate-200/50'
            : 'bg-slate-900 border-slate-700/80 shadow-2xl'
        }`}
      >
        <div className="flex-1 relative flex items-center">
          <Search
            className={`absolute left-3.5 w-4 h-4 pointer-events-none ${
              isDay ? 'text-slate-400' : 'text-slate-400'
            }`}
          />
          <input
            type="text"
            className={`w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
              isDay
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                : 'bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500'
            }`}
            placeholder="Search Singapore forecast area (e.g. Bedok, Jurong, Tampines, Orchard)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={handleClear}
              className={`absolute right-3 p-1 rounded-md transition ${
                isDay ? 'hover:bg-slate-200 text-slate-400' : 'hover:bg-slate-800 text-slate-400'
              }`}
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Picks Pills */}
      {quickPicks.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          <span className={`text-[11px] font-semibold shrink-0 uppercase tracking-wider ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
            Quick Areas:
          </span>
          {quickPicks.map((areaName) => {
            const isSelected = selectedArea?.toLowerCase() === areaName.toLowerCase();
            return (
              <button
                key={areaName}
                onClick={() => handleSelect(areaName)}
                disabled={isLoading}
                className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 font-medium ${
                  isSelected
                    ? 'bg-sky-500 border-sky-400 text-white shadow-sm font-semibold'
                    : isDay
                    ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                {areaName}
              </button>
            );
          })}
        </div>
      )}

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden max-h-80 overflow-y-auto transition-colors z-40 ${
            isDay ? 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60' : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black'
          }`}
        >
          {hasNoMatch ? (
            <div className="p-4 space-y-3">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isDay
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold">No matching 2-hour forecast area was found.</div>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    Singapore weather forecasts are provided exclusively for official NEA forecast areas. Please select from the available forecast areas below:
                  </div>
                </div>
              </div>

              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDay ? 'text-slate-400' : 'text-slate-500'}`}>
                  Available Forecast Areas:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {availableAreas.slice(0, 15).map((a) => (
                    <button
                      key={a.name}
                      onClick={() => handleSelect(a.name)}
                      className={`text-left px-2.5 py-1.5 rounded-lg border text-xs truncate transition cursor-pointer ${
                        isDay
                          ? 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-700'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <div
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex justify-between items-center ${
                  isDay ? 'border-slate-100 text-slate-400 bg-slate-50/50' : 'border-slate-800/60 text-slate-400 bg-slate-950/40'
                }`}
              >
                <span>Live Singapore Forecast Areas</span>
                <span className="font-mono text-sky-500">{matchingAreas.length} found</span>
              </div>
              {matchingAreas.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleSelect(item.name)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition cursor-pointer border-b last:border-b-0 ${
                    isDay
                      ? 'hover:bg-sky-50/70 border-slate-100 text-slate-800'
                      : 'hover:bg-slate-800/80 border-slate-800/40 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="text-sm font-semibold truncate">{item.name}</span>
                  </div>
                  {item.forecast && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border shrink-0 font-medium ${
                        item.forecast.toLowerCase().includes('rain') || item.forecast.toLowerCase().includes('shower')
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : item.forecast.toLowerCase().includes('cloud')
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {item.forecast}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
