import React from 'react';
import {
  Award,
  CheckCircle2,
  FileText,
  Globe,
  GraduationCap,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function ResearchInfographicBanner({ report }) {
  if (!report) return null;

  const totalClaims = report.evidence_and_citations?.length || 0;
  const verifiedClaims = (report.evidence_and_citations || []).filter((c) => c.is_verified_fact).length;
  const consensusPercentage = totalClaims > 0 ? Math.round((verifiedClaims / totalClaims) * 100) : 0;

  const sources = report.sources || [];
  const webCount = sources.filter((s) => s.source_type === 'web').length;
  const academicCount = sources.filter((s) => s.source_type === 'academic' || s.source_type === 'arxiv').length;
  const pdfCount = sources.filter((s) => s.source_type === 'uploaded_pdf' || s.source_type === 'pdf').length;
  const kbCount = sources.filter((s) => s.source_type === 'knowledge_base').length;

  const conflictsCount = (report.conflicting_information?.conflicts || []).length;

  // Determine overall verdict status
  let verdictTitle = 'Strong Multi-Source Consensus';
  let verdictColor = 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  let verdictDesc = 'Core findings are corroborated across multiple independent academic and web sources.';

  if (conflictsCount > 1) {
    verdictTitle = 'Active Debate / Divergent Findings';
    verdictColor = 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
    verdictDesc = 'Multiple sources present differing evidence or interpretations requiring nuanced context.';
  } else if (consensusPercentage < 50 && totalClaims > 0) {
    verdictTitle = 'Preliminary / Single-Source Heavy';
    verdictColor = 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/30';
    verdictDesc = 'Evidence is still emerging or primarily derived from isolated references.';
  }

  // Top 3 key findings as quick takeaway cards
  const topFindings = (report.key_findings || []).slice(0, 3);

  return (
    <div className="mb-6 overflow-hidden rounded-3xl ig-glass p-6 shadow-sm border border-slate-200/90 dark:border-white/10">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Executive Research Synthesis &amp; Evidence Infographic
              <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                Multimodal AI
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Corroboration index, multi-source distribution, and high-impact takeaways
            </p>
          </div>
        </div>

        {/* Verdict Badge */}
        <div className={`flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-semibold ${verdictColor}`}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{verdictTitle}</span>
        </div>
      </div>

      {/* Main Infographic Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Consensus Meter (Col 1-4) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 lg:col-span-4 dark:border-white/10 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Corroboration Score
              </span>
              <span className="font-mono text-xs font-extrabold text-pink-700 dark:text-pink-400">
                {verifiedClaims}/{totalClaims} Facts Verified
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {consensusPercentage}%
              </span>
              <span className="text-xs text-slate-500">Multi-Source Agreement</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 transition-all duration-700"
                style={{ width: `${Math.max(8, consensusPercentage)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {verdictDesc}
            </p>
          </div>

          {/* Source Distribution Pills */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Retrieved Corpus Diversity
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50/80 px-2 py-1 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300">
                <Globe className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold">{webCount} Web Sources</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50/80 px-2 py-1 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                <span className="font-semibold">{academicCount} Papers</span>
              </div>
              {pdfCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50/80 px-2 py-1 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold">{pdfCount} PDFs</span>
                </div>
              )}
              {kbCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-purple-50/80 px-2 py-1 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300">
                  <Award className="h-3.5 w-3.5 text-purple-600" />
                  <span className="font-semibold">{kbCount} KB Notes</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Takeaways Cards (Col 5-12) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
              Core Scientific Takeaways
            </span>
            <span className="text-[11px] text-slate-400">
              Derived from {report.key_findings?.length || 0} Key Findings
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topFindings.map((finding, idx) => (
              <div
                key={finding.id || idx}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 transition-all hover:border-pink-300/80 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-pink-500/30"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {finding.id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {finding.confidence}% Conf.
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 dark:text-white">
                    {finding.title}
                  </h4>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 line-clamp-3 dark:text-slate-400">
                    {finding.summary}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400">
                  <span>{finding.cited_source_ids?.length || 0} citations</span>
                  <a
                    href="#section-6"
                    className="font-semibold text-pink-700 hover:underline dark:text-pink-400"
                  >
                    View in Findings &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Action Navigation Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/70 p-2.5 text-xs dark:bg-white/5 border border-slate-100 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              Direct Links to Deep-Dive Analysis:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <a
                href="#section-7"
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
              >
                7. Detailed Analysis
              </a>
              <a
                href="#section-8"
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
              >
                8. Source Comparison
              </a>
              <a
                href="#section-9"
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 shadow-sm border border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300"
              >
                9. Conflicts ({conflictsCount})
              </a>
              <a
                href="#section-10"
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm border border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300"
              >
                10. Evidence Ledger ({totalClaims})
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
