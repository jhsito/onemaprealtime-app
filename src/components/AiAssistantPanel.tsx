import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  ChevronRight,
  Compass,
  Zap,
} from 'lucide-react';
import { ChatMessage, AgentAction } from '../types.ts';

interface AiAssistantPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (msg: string) => void;
  activeAgentStep?: string | null;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  activeAgentStep,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      label: '⭐ Primary Course Demo',
      prompt: 'How do I get from Raffles Place to Marina Bay Sands, and what will the weather be like for the next 2 hours?',
      highlight: true,
    },
    {
      label: '🚴 Orchard to Gardens by the Bay',
      prompt: 'Show me cycling directions from Orchard to Gardens by the Bay.',
    },
    {
      label: '🌦️ Marina Bay 2-Hr Weather',
      prompt: "What's the weather around Marina Bay for the next 2 hours?",
    },
    {
      label: '🚶 Walk Raffles to MBS + Weather',
      prompt: 'Show me walking directions from Raffles Place to Marina Bay Sands and check the weather.',
    },
    {
      label: '🔄 Switch to Cycling',
      prompt: 'Change the current route to cycling.',
    },
    {
      label: '🔀 Swap Endpoints',
      prompt: 'Swap the starting point and destination.',
    },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full min-h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <span>AI Travel Assistant</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 text-[10px] font-mono border border-indigo-800/60">
                Agentic
              </span>
            </h2>
            <div className="text-[10px] text-slate-400">OneMap + data.gov.sg live tool user</div>
          </div>
        </div>
      </div>

      {/* Suggested Prompts Pill Deck */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Demo Prompts (Click to test agent):</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => onSendMessage(p.prompt)}
              className={`shrink-0 text-left px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer border ${
                p.highlight
                  ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border-blue-500/40 font-semibold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`flex items-start gap-2 max-w-[92%] ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-indigo-300 border border-slate-700'
                }`}
              >
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-950/80 text-slate-200 border border-slate-800'
                }`}
              >
                {/* Visual Agent Tool Execution Steps */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mb-2.5 pb-2.5 border-b border-slate-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Compass className="w-3 h-3 text-blue-400" />
                      <span>Live Agent Tool Invocations:</span>
                    </div>
                    {msg.actions.map((act: AgentAction) => (
                      <div
                        key={act.id}
                        className="flex items-start gap-1.5 bg-slate-900/90 px-2 py-1 rounded border border-slate-800 text-[11px]"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200">{act.label}</div>
                          {act.details && (
                            <div className="text-[10px] text-slate-400">{act.details}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div
                  className={`text-[9px] mt-1 ${
                    msg.role === 'user' ? 'text-blue-200/70 text-right' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading / Agent thinking state */}
        {isLoading && (
          <div className="flex items-start gap-2 max-w-[90%]">
            <div className="w-6 h-6 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-300 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-slate-200">
                  {activeAgentStep || 'Agent deciding actions & calling live APIs...'}
                </span>
                <span className="text-[10px] text-slate-400">OneMap geocoding, routing & weather API</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="mt-3 pt-2 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Ask assistant (e.g. 'Directions from Raffles to MBS with 2h weather')..."
          className="flex-1 bg-slate-950/80 text-xs text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
