import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  LayoutGrid,
  Search,
  ShieldCheck,
  Table as TableIcon,
  XCircle,
} from 'lucide-react';

const STATUS_STYLE = {
  verified_fact: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Verified Fact (≥2 src)',
  },
  multi_source_consensus: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Consensus Fact',
  },
  single_source_claim: {
    badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50',
    icon: AlertCircle,
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Single Source',
  },
  interpretation_or_assumption: {
    badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50',
    icon: HelpCircle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Interpretation / Model',
  },
  outdated_information: {
    badge: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700/50',
    icon: Clock,
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'Historical / Outdated',
  },
  contradicted_or_disputed: {
    badge: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/50',
    icon: XCircle,
    iconColor: 'text-rose-600 dark:text-rose-400',
    label: 'Contradicted / Disputed',
  },
  insufficient_evidence: {
    badge: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: HelpCircle,
    iconColor: 'text-slate-500',
    label: 'Insufficient Evidence',
  },
};

export default function VerificationLedger({ claims = [], onInspectSource }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [sortBy, setSortBy] = useState('id'); // 'id' | 'confidence_desc' | 'confidence_asc'
  const [expanded, setExpanded] = useState({});

  const filteredAndSortedClaims = useMemo(() => {
    let result = claims.filter((c) => {
      // Category filter
      if (filter === 'verified' && !c.is_verified_fact) return false;
      if (filter !== 'all' && filter !== 'verified' && c.claim_category !== filter) return false;

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClaim = (c.claim_text || '').toLowerCase().includes(q);
        const matchesNote = (c.distinction_note || '').toLowerCase().includes(q);
        const matchesId = (c.claim_id || '').toLowerCase().includes(q);
        return matchesClaim || matchesNote || matchesId;
      }
      return true;
    });

    // Sort logic
    if (sortBy === 'confidence_desc') {
      result = [...result].sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
    } else if (sortBy === 'confidence_asc') {
      result = [...result].sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0));
    } else {
      result = [...result].sort((a, b) => (a.claim_id || '').localeCompare(b.claim_id || ''));
    }

    return result;
  }, [claims, filter, searchQuery, sortBy]);

  const verifiedCount = claims.filter((c) => c.is_verified_fact).length;
  const singleSourceCount = claims.filter((c) => c.claim_category === 'single_source_claim').length;

  return (
    <section
      id="section-10"
      className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80"
    >
      {/* Header and Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              10. Evidence and Citations (Verification Ledger)
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {verifiedCount}/{claims.length} Verified
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Corroborated facts (&ge;2 independent sources) rigorously distinguished from provisional claims and assumptions
            </p>
          </div>
        </div>

        {/* View mode toggle (Cards vs Structured Table) */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
              viewMode === 'cards'
                ? 'bg-white shadow-sm text-slate-900 dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
              viewMode === 'table'
                ? 'bg-white shadow-sm text-slate-900 dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Table Matrix</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: `All (${claims.length})` },
            { id: 'verified', label: `Verified (${verifiedCount})` },
            { id: 'single_source_claim', label: `Single Source (${singleSourceCount})` },
            { id: 'interpretation_or_assumption', label: 'Interpretations' },
            { id: 'contradicted_or_disputed', label: 'Disputed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === tab.id
                  ? 'ig-btn-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims..."
              className="h-8 rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-pink-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5">
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none dark:text-slate-300"
            >
              <option value="id" className="dark:bg-slate-900">Sort by ID</option>
              <option value="confidence_desc" className="dark:bg-slate-900">Highest Confidence</option>
              <option value="confidence_asc" className="dark:bg-slate-900">Lowest Confidence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Render View Mode: Table or Cards */}
      {viewMode === 'table' ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-white/10">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <th className="px-3.5 py-3 font-bold">ID</th>
                <th className="px-3.5 py-3 font-bold">Status</th>
                <th className="px-3.5 py-3 font-bold">Confidence</th>
                <th className="px-3.5 py-3 font-bold">Claim Statement</th>
                <th className="px-3.5 py-3 font-bold">Supporting Sources</th>
                <th className="px-3.5 py-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredAndSortedClaims.map((cl) => {
                const style = STATUS_STYLE[cl.claim_category] || STATUS_STYLE.insufficient_evidence;
                const Icon = style.icon;
                return (
                  <tr key={cl.claim_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {cl.claim_id}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${style.badge}`}>
                        <Icon className="h-3 w-3" />
                        {cl.verification_status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cl.confidence_score}%
                    </td>
                    <td className="px-3.5 py-3 max-w-[340px]">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {cl.claim_text}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                        {cl.distinction_note}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {cl.supporting_source_ids?.map((sid) => (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => onInspectSource?.(sid)}
                            className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                          >
                            [{sid}]
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      {cl.evidence_excerpts?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [cl.claim_id]: !prev[cl.claim_id] }))}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          {expanded[cl.claim_id] ? 'Hide' : `Quotes (${cl.evidence_excerpts.length})`}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredAndSortedClaims.map((cl) => {
            const style = STATUS_STYLE[cl.claim_category] || STATUS_STYLE.insufficient_evidence;
            const Icon = style.icon;
            const isOpen = !!expanded[cl.claim_id];
            return (
              <div
                key={cl.claim_id}
                className="rounded-2xl border border-slate-200/90 bg-white/70 p-4 transition hover:border-pink-300/70 hover:shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-pink-500/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconColor}`} />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{cl.claim_id}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${style.badge}`}>
                          {cl.verification_status}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          Confidence: {cl.confidence_score}%
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{cl.claim_text}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{cl.distinction_note}</p>

                      {/* Citations row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {cl.supporting_source_ids.length > 0 ? (
                          <>
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              Supporting Sources:
                            </span>
                            {cl.supporting_source_ids.map((sid) => (
                              <button
                                key={sid}
                                type="button"
                                onClick={() => onInspectSource?.(sid)}
                                className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                              >
                                [{sid}]
                              </button>
                            ))}
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500">
                            No corroborating sources retrieved
                          </span>
                        )}

                        {cl.contradicting_source_ids?.length > 0 && (
                          <>
                            <span className="ml-2 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                              Contradicting:
                            </span>
                            {cl.contradicting_source_ids.map((sid) => (
                              <button
                                key={sid}
                                type="button"
                                onClick={() => onInspectSource?.(sid)}
                                className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-800 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              >
                                [{sid}]
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {cl.evidence_excerpts?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [cl.claim_id]: !isOpen }))}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      <span>Quotes ({cl.evidence_excerpts.length})</span>
                      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {isOpen && cl.evidence_excerpts?.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
                    {cl.evidence_excerpts.map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs text-slate-700 dark:border-white/5 dark:bg-slate-800/60 dark:text-slate-300"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => onInspectSource?.(ex.source_id)}
                            className="font-mono font-bold text-blue-700 hover:underline dark:text-blue-400"
                          >
                            [{ex.source_id}]
                          </button>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-white/10 dark:text-slate-300">
                            {ex.stance}
                          </span>
                        </div>
                        <p className="italic text-slate-600 dark:text-slate-300">&ldquo;{ex.quote}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
