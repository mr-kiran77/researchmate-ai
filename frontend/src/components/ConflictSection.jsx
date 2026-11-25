import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Filter, HelpCircle, Scale } from 'lucide-react';

export default function ConflictSection({ data, onInspectSource }) {
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'high' | 'medium'
  const conflicts = data?.conflicts || [];

  const filteredConflicts =
    severityFilter === 'all'
      ? conflicts
      : conflicts.filter((c) => c.severity === severityFilter);

  return (
    <section
      id="section-9"
      className="scroll-mt-24 rounded-3xl border border-rose-200/80 bg-gradient-to-b from-rose-50/40 to-white p-6 shadow-sm dark:border-rose-900/30 dark:from-rose-950/20 dark:to-slate-900/80"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              9. Conflicting Information &amp; Scientific Debates
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  conflicts.length > 0
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                }`}
              >
                {conflicts.length} Conflict{conflicts.length === 1 ? '' : 's'} Flagged
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preserving contradictory empirical findings, competing methodologies, and unresolved tensions across sources
            </p>
          </div>
        </div>

        {/* Severity filter buttons */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-rose-200/60 bg-white/70 p-1 text-xs dark:border-white/10 dark:bg-white/5">
            <Filter className="h-3.5 w-3.5 ml-1 text-slate-400" />
            <button
              type="button"
              onClick={() => setSeverityFilter('all')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                severityFilter === 'all'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              All ({conflicts.length})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('high')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                severityFilter === 'high'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              High Tension
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('medium')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                severityFilter === 'medium'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Medium
            </button>
          </div>
        )}
      </div>

      <p className="mt-3.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{data?.summary}</p>

      {conflicts.length === 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            No direct empirical contradictions were detected between the retrieved sources. Scope limitations,
            single-source statements, and ongoing uncertainties are preserved in Sections 10 and 11.
          </span>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {filteredConflicts.map((cf) => (
            <div
              key={cf.conflict_id}
              className="rounded-2xl border border-rose-200/80 bg-white/80 p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400">
                    {cf.conflict_id}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cf.topic}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    cf.severity === 'high'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                      : cf.severity === 'medium'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {cf.severity} tension
                </span>
              </div>

              {/* Side-by-side Comparative Dispute Grid */}
              <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-slate-800/50">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Perspective / Claim A
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectSource?.(cf.source_a_id)}
                      className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      [{cf.source_a_id}]
                    </button>
                  </div>
                  <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {cf.source_a_title}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                    &ldquo;{cf.claim_a}&rdquo;
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-slate-800/50">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Perspective / Claim B
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectSource?.(cf.source_b_id)}
                      className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      [{cf.source_b_id}]
                    </button>
                  </div>
                  <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {cf.source_b_title}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                    &ldquo;{cf.claim_b}&rdquo;
                  </p>
                </div>
              </div>

              {/* Underlying Reasons & Synthesis */}
              <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="rounded-xl bg-amber-50/70 p-3.5 text-xs text-slate-700 dark:bg-amber-950/20 dark:text-slate-300 border border-amber-200/50 dark:border-amber-900/30">
                  <div className="mb-1 font-bold text-amber-900 dark:text-amber-300">
                    Root Drivers of Disagreement
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-400">
                    {(cf.possible_reasons || []).map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-100/80 p-3.5 text-xs text-slate-700 dark:bg-slate-800/70 dark:text-slate-300 border border-slate-200/50 dark:border-white/5">
                  <div className="mb-1 flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                    <HelpCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Neutral Synthesis &amp; Remaining Ambiguity
                  </div>
                  <p className="mb-1 text-slate-600 dark:text-slate-400">{cf.neutral_explanation}</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{cf.what_remains_uncertain}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
