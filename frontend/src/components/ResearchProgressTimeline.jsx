import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  ListChecks,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const TIMELINE_STAGES = [
  {
    id: 'planning',
    title: 'Question Decomposition & Plan',
    desc: 'Analyzes nuance, formulates 3-5 targeted sub-questions, and assigns source engine targets.',
    icon: Sparkles,
  },
  {
    id: 'searching',
    title: 'Multi-Source Evidence Retrieval',
    desc: 'Independently queries web, academic literature (OpenAlex/arXiv), PDFs, and knowledge base.',
    icon: Search,
  },
  {
    id: 'verifying',
    title: 'Cross-Source Verification & Conflicts',
    desc: 'Corroborates claims across multiple independent sources, flags contradictions, and calculates credibility.',
    icon: ShieldCheck,
  },
  {
    id: 'synthesizing',
    title: '14-Section Report Synthesis',
    desc: 'Structures findings, drafts executive summary, binds inline citations, and calculates confidence score.',
    icon: FileCheck2,
  },
];

export default function ResearchProgressTimeline({
  progress = {},
  liveStats = {},
  plan = null,
  onInspectSource,
}) {
  const currentStage = progress?.stage || 'planning';
  const percent = progress?.percent || 15;
  const message = progress?.message || 'Executing autonomous research workflow...';

  const activeIdx = Math.max(
    0,
    TIMELINE_STAGES.findIndex((s) => s.id === currentStage)
  );

  const sourcesList = liveStats?.sources || [];
  const sourceTypes = liveStats?.sourceTypes || [];
  const subQuestions = plan?.sub_questions || [];

  return (
    <div className="space-y-6">
      {/* Top Workflow Status & Progress Bar Card */}
      <div className="rounded-3xl ig-glass p-5 sm:p-6 shadow-sm border border-slate-200/90 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-md">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ResearchMate AI Autonomous Engine
                </h3>
                <span className="rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300">
                  Live Agent
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-xl font-black text-pink-700 dark:text-pink-400">
              {percent}%
            </span>
          </div>
        </div>

        {/* Continuous Gradient Progress Bar */}
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent}%`, backgroundImage: 'var(--ig-gradient)' }}
          />
        </div>

        {/* Live Metrics Grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sources Discovered
            </div>
            <div className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
              {liveStats?.sourcesCount ?? sourcesList.length ?? 0}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sub-Questions
            </div>
            <div className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
              {subQuestions.length > 0 ? `${subQuestions.length} Active` : 'Generating...'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Verified Claims
            </div>
            <div className="mt-1 text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {typeof liveStats?.verifiedCount === 'number' ? liveStats.verifiedCount : 'Auditing...'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Conflicts Flagged
            </div>
            <div className="mt-1 text-base font-extrabold text-amber-600 dark:text-amber-400">
              {typeof liveStats?.conflictsCount === 'number' ? liveStats.conflictsCount : 'Cross-checking...'}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="rounded-3xl ig-glass p-5 sm:p-6 shadow-sm border border-slate-200/90 dark:border-white/10">
        <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Autonomous Research Lifecycle
        </h4>

        <div className="space-y-4">
          {TIMELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isDone = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <div
                key={stage.id}
                className={`relative flex items-start gap-3.5 rounded-2xl border p-3.5 transition-all ${
                  isDone
                    ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                    : isCurrent
                    ? 'border-pink-400 bg-pink-50/70 shadow-sm dark:border-pink-500/50 dark:bg-pink-950/30'
                    : 'border-slate-200/60 bg-white/40 opacity-60 dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'ig-btn-primary text-white animate-pulse'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs">{idx + 1}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {stage.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDone
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isCurrent
                          ? 'text-pink-700 dark:text-pink-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {isDone ? 'Completed' : isCurrent ? 'Active Now' : 'Queued'}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {stage.desc}
                  </p>

                  {/* Sub-questions Preview in Planning stage */}
                  {isCurrent && stage.id === 'planning' && subQuestions.length > 0 && (
                    <div className="mt-2.5 rounded-xl border border-pink-200 bg-white/80 p-2.5 dark:border-white/10 dark:bg-slate-900/60">
                      <span className="block text-[10px] font-bold text-pink-700 dark:text-pink-300 mb-1">
                        Formulated Sub-Questions:
                      </span>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        {subQuestions.map((sq) => (
                          <li key={sq.id} className="flex items-start gap-1.5">
                            <span className="font-mono text-[10px] text-pink-600 dark:text-pink-400">
                              {sq.id}:
                            </span>
                            <span className="truncate">{sq.question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Engines active in Searching stage */}
                  {isCurrent && stage.id === 'searching' && sourceTypes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sourceTypes.map((st) => (
                        <span
                          key={st}
                          className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Discovered Sources Grid */}
      {sourcesList.length > 0 && (
        <div className="rounded-3xl ig-glass p-5 sm:p-6 shadow-sm border border-slate-200/90 dark:border-white/10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Discovered Sources ({sourcesList.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Live retrieval across active engines
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sourcesList.slice(0, 8).map((src) => {
              const isPdf = src.source_type === 'uploaded_pdf';
              const isAcademic = src.source_type === 'academic_paper';
              const isKb = src.source_type === 'knowledge_base';

              return (
                <div
                  key={src.source_id}
                  onClick={() => onInspectSource?.(src.source_id)}
                  className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm transition hover:border-pink-400 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-pink-700 dark:text-pink-400">
                        [{src.source_id}]
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                            isAcademic
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                              : isPdf
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : isKb
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}
                        >
                          {src.source_type}
                        </span>
                      </span>

                      {src.composite_score && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {Math.round(src.composite_score)}% Score
                        </span>
                      )}
                    </div>

                    <h5 className="mt-1.5 text-xs font-bold text-slate-900 line-clamp-2 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                      {src.title}
                    </h5>

                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                      {src.author_or_publisher} {src.publication_year ? `(${src.publication_year})` : ''}
                    </p>

                    {src.snippets?.[0] && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 border-l-2 border-pink-400 pl-2">
                        "{src.snippets[0]}"
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] font-semibold text-pink-700 dark:text-pink-400">
                    <span>Inspect Evidence</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
