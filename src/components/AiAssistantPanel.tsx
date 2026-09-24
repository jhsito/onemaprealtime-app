import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { ChatMessage, AgentAction, ThemeMode } from '../types.ts';

interface AiAssistantPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  theme?: ThemeMode;
  onSendMessage: (msg: string) => void;
  activeAgentStep?: string | null;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  messages,
  isLoading,
  theme = 'night',
  onSendMessage,
  activeAgentStep,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDay = theme === 'day';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeAgentStep]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const samplePrompts = [
    {
      label: '🌦️ Weather in Bedok',
      prompt: "What's the weather in Bedok?",
      highlight: true,
    },
    {
      label: '🌧️ Will it rain in Jurong?',
      prompt: 'Will it rain in Jurong?',
      highlight: true,
    },
    {
      label: '📍 Forecast for Tampines',
      prompt: 'Show me the 2-hour forecast for Tampines.',
    },
    {
      label: '🏙️ Weather in Orchard',
      prompt: "How's the weather in Orchard?",
    },
    {
      label: '✈️ Weather around Changi',
      prompt: "What's the weather around Changi?",
    },
    {
      label: '🇸🇬 Singapore Overview',
      prompt: "Show me Singapore's current 2-hour forecast.",
    },
    {
      label: '⚡ /api/health Check',
      prompt: 'Check /api/health status.',
    },
  ];

  return (
    <div
      className={`rounded-2xl p-5 shadow-xl flex flex-col h-full border transition-all duration-200 ${
        isDay ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800 shadow-2xl'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between pb-3 mb-3 border-b ${
          isDay ? 'border-slate-200' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2
              className={`text-sm font-bold tracking-tight flex items-center gap-2 ${
                isDay ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              <span>AI Weather Assistant</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  isDay
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-sky-950 text-sky-300 border-sky-800/60'
                }`}
              >
                Live Nowcast
              </span>
            </h2>
            <div className={`text-[11px] ${isDay ? 'text-slate-500' : 'text-slate-400'}`}>
              data.gov.sg official 2-hour forecast agent
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Prompts Pill Deck */}
      <div className="mb-3">
        <div
          className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
            isDay ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          <Zap className="w-3 h-3 text-amber-500" />
          <span>Ask about Singapore weather:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => onSendMessage(p.prompt)}
              className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap transition cursor-pointer font-medium disabled:opacity-50 ${
                p.highlight
                  ? isDay
                    ? 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800 font-semibold'
                    : 'bg-sky-950/60 hover:bg-sky-900/80 border-sky-700/80 text-sky-300 font-semibold'
                  : isDay
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm min-h-[180px] max-h-[380px]">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`flex gap-2 max-w-[92%] ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-sm ${
                    isUser
                      ? 'bg-sky-600 text-white'
                      : isDay
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-sky-400" />}
                </div>

                <div
                  className={`p-3 rounded-2xl border ${
                    isUser
                      ? 'bg-sky-600 text-white border-sky-500 rounded-tr-none'
                      : isDay
                      ? 'bg-slate-50 border-slate-200 text-slate-800 rounded-tl-none'
                      : 'bg-slate-800/90 border-slate-700/80 text-slate-100 rounded-tl-none'
                  }`}
                >
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">{m.content}</p>

                  {/* Actions / Tools Log */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/40 space-y-1">
                      {m.actions.map((act: AgentAction) => (
                        <div
                          key={act.id}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{act.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1.5 text-right ${
                      isUser ? 'text-sky-200' : isDay ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Live Loading / Agent Thinking Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                isDay ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div
              className={`p-3 rounded-2xl rounded-tl-none border flex items-center gap-2 text-xs ${
                isDay ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
              <span>{activeAgentStep || 'Retrieving live 2-hour forecast...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-slate-800/60 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Singapore weather (e.g. Will it rain in Bedok?)..."
          disabled={isLoading}
          className={`flex-1 px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
            isDay
              ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
              : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500'
          }`}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition flex items-center justify-center cursor-pointer shadow-sm"
          title="Send inquiry"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
