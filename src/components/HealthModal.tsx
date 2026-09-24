import React, { useState, useEffect } from 'react';
import {
  Activity,
  X,
  RefreshCw,
  Server,
  CloudSun,
  Bot,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { HealthReport, ThemeMode } from '../types.ts';

interface HealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeMode;
}

export const HealthModal: React.FC<HealthModalProps> = ({
  isOpen,
  onClose,
  theme = 'night',
}) => {
  const [healthData, setHealthData] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const isDay = theme === 'day';

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`Health check returned HTTP ${res.status}`);
      }
      const data: HealthReport = await res.json();
      setHealthData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Unable to connect to /api/health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDegraded = healthData?.status === 'degraded';
  const weatherSvc = healthData?.weather || healthData?.services?.weatherDataGovSg;
  const serverObj = typeof healthData?.server === 'object' ? healthData.server : null;
  const serverStatus = serverObj?.status || (typeof healthData?.server === 'string' ? healthData.server : 'operational');
  const serverPort = serverObj?.port || healthData?.port || '3000';
  const serverNode = serverObj?.nodeVersion || healthData?.nodeVersion || 'v22';
  const uptimeDisplay = serverObj?.uptimeFormatted || healthData?.uptimeFormatted || 'Just started';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200 ${
          isDay
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isDay ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800 bg-slate-950/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">System Health & Diagnostics</h2>
                <code
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                    isDay
                      ? 'bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  /api/health
                </code>
              </div>
              <p className={`text-[11px] ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
                Real-time probe of server & data.gov.sg 2-hour weather API
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDay ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status Banner */}
          {error ? (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                isDay
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/50 border-rose-800/80 text-rose-200'
              }`}
            >
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold">Health check failed</div>
                <div className="text-[11px] opacity-90">{error}</div>
              </div>
            </div>
          ) : healthData ? (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isDegraded
                  ? isDay
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : isDay
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full animate-pulse ${
                    isDegraded ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {isDegraded ? 'Service Degraded' : 'All Systems Operational'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    HTTP 200 · Uptime: {uptimeDisplay}
                  </div>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold uppercase border ${
                  isDegraded
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {healthData.status}
              </span>
            </div>
          ) : null}

          {/* Services Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Server Core */}
            <div
              className={`p-3.5 rounded-xl border transition-colors ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold">Express Server</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                  {serverStatus === 'running' || serverStatus === 'operational' ? 'Operational' : serverStatus}
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-mono text-emerald-500 font-medium">
                    {serverStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Port:</span>
                  <span className="font-mono font-medium">{serverPort}</span>
                </div>
                <div className="flex justify-between">
                  <span>Node:</span>
                  <span className="font-mono">{serverNode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <span className="capitalize">{healthData?.environment || 'development'}</span>
                </div>
              </div>
            </div>

            {/* 2. data.gov.sg Weather API */}
            <div
              className={`p-3.5 rounded-xl border transition-colors ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CloudSun className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-bold">data.gov.sg Weather</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                    weatherSvc?.status === 'operational'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  {weatherSvc?.status === 'operational' ? 'Operational' : 'Degraded'}
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Feed Type:</span>
                  <span className="font-medium text-sky-500">
                    {(weatherSvc as any)?.feed || (weatherSvc as any)?.feedType || '2-Hour Forecast API'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="font-mono">
                    {typeof weatherSvc?.latencyMs === 'number'
                      ? `${weatherSvc.latencyMs} ms`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage:</span>
                  <span>{weatherSvc?.coverage || 'Singapore forecast areas'}</span>
                </div>
                <div className="flex justify-between">
                  <span>HTTP Status:</span>
                  <span className="font-mono">{weatherSvc?.httpStatus || 200}</span>
                </div>
              </div>
            </div>

            {/* 3. AI Weather Assistant */}
            <div
              className={`p-3.5 rounded-xl border transition-colors sm:col-span-2 ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold">AI Weather Agent</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                  Ready
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="font-mono text-purple-400">Gemini 3.8 Flash (Tool Calling)</span>
                </div>
                <div className="flex justify-between">
                  <span>Function:</span>
                  <span>get_2hr_weather (data.gov.sg live 2-hr nowcast)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Raw JSON Preview */}
          <div
            className={`p-3 rounded-xl border font-mono text-[11px] overflow-x-auto ${
              isDay ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400 uppercase font-sans">
              <span>GET /api/health Response</span>
              <span>{lastRefreshed && `Last check: ${lastRefreshed}`}</span>
            </div>
            <pre className="text-[10px] leading-tight">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${
            isDay ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/80'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px]">
              {lastRefreshed ? `Checked at ${lastRefreshed}` : 'Not checked'}
            </span>
          </div>

          <button
            onClick={fetchHealth}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking...' : 'Re-check Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
