import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2, Navigation } from 'lucide-react';
import { LocationItem, ThemeMode } from '../types.ts';

interface SearchHeaderProps {
  onSelectLocation: (loc: LocationItem) => void;
  selectedLocation: LocationItem | null;
  theme?: ThemeMode;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  onSelectLocation,
  selectedLocation,
  theme = 'night',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDay = theme === 'day';

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

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      setErrorMsg(null);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/onemap-search?searchVal=${encodeURIComponent(q)}&pageNum=1`);
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        setResults(data.results.slice(0, 7));
        setIsOpen(true);
        if (data.results.length === 0) {
          setErrorMsg(`No locations found for "${q}". Try another Singapore landmark or postal code.`);
        }
      } else {
        setResults([]);
        setErrorMsg('No results returned.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to search OneMap. Please check your connection.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (loc: LocationItem) => {
    setQuery(loc.name);
    setIsOpen(false);
    onSelectLocation(loc);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const quickPicks = [
    'Raffles Place',
    'Marina Bay Sands',
    'Orchard Road',
    'Gardens by the Bay',
    'Changi Airport',
  ];

  return (
    <div className="relative w-full z-30" ref={containerRef}>
      <div
        className={`flex items-center gap-2 p-2 rounded-2xl border shadow-2xl transition-colors duration-200 ${
          isDay
            ? 'bg-white/95 backdrop-blur-md border-slate-300 shadow-slate-300/40'
            : 'bg-slate-900/95 backdrop-blur-md border-slate-700/70 shadow-2xl'
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
            className={`w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
              isDay
                ? 'bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200'
                : 'bg-slate-800/90 text-slate-100 placeholder-slate-400 border-slate-700'
            }`}
            placeholder="Search Singapore location, building, postal code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className={`absolute right-3 p-0.5 rounded transition cursor-pointer ${
                isDay ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => handleSearch(query)}
          disabled={isLoading || !query.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400/40 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Searching</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Picks bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 scrollbar-none text-[11px]">
        <span
          className={`shrink-0 flex items-center gap-1 font-medium ${
            isDay ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          <Navigation className="w-3 h-3 text-blue-500" /> Quick:
        </span>
        {quickPicks.map((pick) => (
          <button
            key={pick}
            onClick={() => {
              setQuery(pick);
              handleSearch(pick);
            }}
            className={`shrink-0 px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
              isDay
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
          >
            {pick}
          </button>
        ))}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto ${
            isDay ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/80'
          }`}
        >
          {results.length > 0 ? (
            <div className={`divide-y ${isDay ? 'divide-slate-100' : 'divide-slate-800'}`}>
              <div
                className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex justify-between ${
                  isDay ? 'bg-slate-100 text-slate-500' : 'bg-slate-950/60 text-slate-400'
                }`}
              >
                <span>OneMap Search Results</span>
                <span>{results.length} found</span>
              </div>
              {results.map((item, idx) => (
                <button
                  key={`${item.lat}-${item.lng}-${idx}`}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3.5 py-2.5 transition flex items-start gap-2.5 cursor-pointer group ${
                    isDay ? 'hover:bg-blue-50/70 text-slate-800' : 'hover:bg-slate-800/80 text-slate-100'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 group-hover:text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isDay ? 'text-slate-900 group-hover:text-blue-600' : 'text-slate-100 group-hover:text-blue-300'
                      }`}
                    >
                      {item.name}
                    </div>
                    <div className={`text-[11px] truncate ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                      {item.address}
                    </div>
                    {item.postal && (
                      <div className={`text-[10px] font-mono ${isDay ? 'text-slate-400' : 'text-slate-500'}`}>
                        Postal: {item.postal}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : errorMsg ? (
            <div
              className={`px-4 py-3 text-xs text-center ${
                isDay ? 'text-amber-700 bg-amber-50' : 'text-amber-300/90'
              }`}
            >
              {errorMsg}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
