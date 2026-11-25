import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Send, Trash2, User } from 'lucide-react';
import { api } from '../api/client';

const QUICK_PROMPTS = [
  'Explain the second finding in simple English',
  'Which source is more reliable?',
  'Give me more evidence',
  'Summarize the research in five points',
  'Explain this topic for a beginner',
  'Compare the findings',
  'What are the research limitations?',
];

export default function ResearchChat({ report, onInspectSource }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!report?.id) return;
    let active = true;
    api
      .getChatMessages(report.id)
      .then((rows) => {
        if (active) setMessages(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [report?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendPrompt = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || !report?.id || sending) return;
    setError('');
    if (text === undefined) setInput('');

    const optimisticUser = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: msg,
      cited_source_ids: [],
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const res = await api.sendChatMessage(report.id, msg);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        res.user_message,
        res.assistant_message,
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!report?.id) return;
    await api.clearChatMessages(report.id);
    setMessages([]);
  };

  const renderMessageContent = (content) => {
    const parts = String(content).split(/(\[S\d+\])/g);
    return parts.map((p, idx) => {
      const m = p.match(/^\[(S\d+)\]$/);
      if (m) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onInspectSource?.(m[1])}
            className="mx-0.5 inline-flex rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800 hover:bg-blue-200"
          >
            [{m[1]}]
          </button>
        );
      }
      return <React.Fragment key={idx}>{p}</React.Fragment>;
    });
  };

  return (
    <aside className="flex h-[calc(100vh-3rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm sticky top-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Research Chat</h3>
            <p className="text-[11px] text-slate-500">Grounded in current report &amp; sources</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            title="Clear conversation"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Suggested Follow-Ups
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => sendPrompt(q)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-500">
            Ask any follow-up question about <strong>{report.research_title}</strong>. Context from all{' '}
            {report.sources.length} sources, conflicts, and findings is loaded automatically.
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-blue-700 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {isUser ? m.content : renderMessageContent(m.content)}
              </div>
              {isUser && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            <span>Synthesizing answer from report context...</span>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt();
        }}
        className="border-t border-slate-200 p-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about findings, reliability, or evidence..."
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-xl ig-btn-primary disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
