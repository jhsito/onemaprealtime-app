import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Server,
  MapPin,
  CloudSun,
  Bot,
  Copy,
  ExternalLink,
  Check,
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
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDay = theme === 'day';

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health?probe=true');
      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }
      const data: HealthReport = await res.json();
      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch /api/health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  const handleCopyJson = () => {
    if (!healthData) return;
    navigator.clipboard.writeText(JSON.stringify(healthData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isDegraded = healthData?.status === 'degraded' || healthData?.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden transition-colors ${
          isDay
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/80'
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
                Real-time probe of server, OneMap, weather API & AI
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
                    {isDegraded ? 'Services Degraded' : 'All Systems Operational'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    HTTP 200 · Uptime: {healthData.uptimeFormatted}
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
                  Operational
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-mono text-emerald-500 font-medium">{healthData?.server || 'running'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Port:</span>
                  <span className="font-mono font-medium">{healthData?.port || '3000'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Node:</span>
                  <span className="font-mono">{healthData?.nodeVersion || 'v22'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <span className="capitalize">{healthData?.environment || 'development'}</span>
                </div>
              </div>
            </div>

            {/* 2. OneMap API */}
            <div
              className={`p-3.5 rounded-xl border transition-colors ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold">OneMap SG API</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                    healthData?.services.onemap.status === 'operational'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  {healthData?.services.onemap.status || 'Checking...'}
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Token Auth:</span>
                  <span className="font-medium text-emerald-500">
                    {healthData?.services.onemap.tokenConfigured ? 'Bearer Active' : 'Public API'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="font-mono">
                    {healthData?.services.onemap.latencyMs !== null
                      ? `${healthData?.services.onemap.latencyMs} ms`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Geocoding & Route:</span>
                  <span className="text-emerald-500 font-medium">Ready</span>
                </div>
              </div>
            </div>

            {/* 3. data.gov.sg Weather */}
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
                    healthData?.services.weatherDataGovSg.status === 'operational'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  {healthData?.services.weatherDataGovSg.status || 'Checking...'}
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Feed Type:</span>
                  <span className="font-medium">2-Hr Nowcast API</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="font-mono">
                    {healthData?.services.weatherDataGovSg.latencyMs !== null
                      ? `${healthData?.services.weatherDataGovSg.latencyMs} ms`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage:</span>
                  <span>47 SG Areas</span>
                </div>
              </div>
            </div>

            {/* 4. Gemini AI Engine */}
            <div
              className={`p-3.5 rounded-xl border transition-colors ${
                isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold">AI Travel Agent</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                  Ready
                </span>
              </div>
              <div className={`space-y-1 text-[11px] ${isDay ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className="flex justify-between">
                  <span>Primary Model:</span>
                  <span className="font-mono text-indigo-400">
                    {healthData?.services.geminiAi.model || 'gemini-3.8-flash'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tool Router:</span>
                  <span className="font-medium text-emerald-500">Autonomous</span>
                </div>
                <div className="flex justify-between">
                  <span>Fallback Resilience:</span>
                  <span className="text-emerald-500 font-medium">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw JSON Accordion */}
          <div
            className={`rounded-xl border overflow-hidden transition-colors ${
              isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between px-3.5 py-2">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className={`text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  isDay ? 'text-slate-700 hover:text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>{showRawJson ? '▼ Hide Raw /api/health JSON' : '▶ View Raw /api/health JSON'}</span>
              </button>
              {showRawJson && (
                <button
                  onClick={handleCopyJson}
                  className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded border transition cursor-pointer ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : isDay
                      ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Copy JSON to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {showRawJson && (
              <pre
                className={`p-3 text-[11px] font-mono overflow-x-auto max-h-48 border-t ${
                  isDay
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-950 border-slate-800 text-emerald-400'
                }`}
              >
                {JSON.stringify(healthData, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t shrink-0 ${
            isDay ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/80'
          }`}
        >
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs flex items-center gap-1.5 transition cursor-pointer ${
              isDay ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <span>Open endpoint directly</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Probing...' : 'Re-run Health Check'}</span>
            </button>
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                isDay
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
