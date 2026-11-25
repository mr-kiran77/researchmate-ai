import React from 'react';
import { CheckCircle2, Loader2, ShieldAlert, Search, Sparkles, FileCheck } from 'lucide-react';

const STAGES = [
  { id: 'planning', label: 'Question Analyzer & Plan', icon: Sparkles },
  { id: 'searching', label: 'Multi-Source Search', icon: Search },
  { id: 'verifying', label: 'Fact Verification & Conflicts', icon: ShieldAlert },
  { id: 'synthesizing', label: '14-Section Report Synthesis', icon: FileCheck },
];

export default function AgentProgressBar({ progress, liveStats }) {
  if (!progress) return null;

  const activeIdx = Math.max(
    0,
    STAGES.findIndex((s) => s.id === progress.stage)
  );

  return (
    <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-5 w-5 animate-spin text-blue-700" />
          <div>
            <div className="text-sm font-bold text-slate-900">ResearchMate Agent Executing Workflow</div>
            <div className="text-xs text-slate-600">{progress.message}</div>
          </div>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 font-mono text-xs font-bold text-blue-800">
          {progress.percent || 15}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress.percent || 15}%`, backgroundImage: 'var(--ig-gradient)' }}
        />
      </div>

      {/* Stage Pills */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((st, idx) => {
          const Icon = st.icon;
          const done = idx < activeIdx;
          const current = idx === activeIdx;
          return (
            <div
              key={st.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : current
                  ? 'border-blue-300 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white/70 text-slate-400'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Icon className={`h-4 w-4 shrink-0 ${current ? 'text-blue-600' : 'text-slate-300'}`} />
              )}
              <span className="truncate">{st.label}</span>
            </div>
          );
        })}
      </div>

      {/* Live Metrics */}
      {liveStats && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          {typeof liveStats.sourcesCount === 'number' && (
            <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 font-medium">
              Sources Retrieved: <strong>{liveStats.sourcesCount}</strong>
            </span>
          )}
          {liveStats.sourceTypes?.length > 0 && (
            <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 font-medium">
              Source Types: <strong>{liveStats.sourceTypes.join(', ')}</strong>
            </span>
          )}
          {typeof liveStats.verifiedCount === 'number' && (
            <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 font-medium">
              Verified Facts: <strong>{liveStats.verifiedCount}</strong> / {liveStats.claimsCount}
            </span>
          )}
          {typeof liveStats.conflictsCount === 'number' && (
            <span className="rounded-md bg-white px-2.5 py-1 border border-slate-200 font-medium">
              Conflicts Flagged: <strong>{liveStats.conflictsCount}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
