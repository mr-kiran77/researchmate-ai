import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  HelpCircle,
  Layers,
  Sparkles,
  Star,
  Type,
} from 'lucide-react';
import { api } from '../api/client';
import { searchTopicImages } from '../services/imageSearchService';
import ConflictSection from './ConflictSection';
import RelatedImagesGallery from './RelatedImagesGallery';
import ReportCharts from './ReportCharts';
import ResearchInfographicBanner from './ResearchInfographicBanner';
import VerificationLedger from './VerificationLedger';

const OUTLINE_ITEMS = [
  { id: 'section-1', label: '1. Research Title' },
  { id: 'section-2', label: '2. Executive Summary' },
  { id: 'section-3', label: '3. Research Objective' },
  { id: 'section-4', label: '4. Research Questions' },
  { id: 'section-5', label: '5. Methodology & Sources' },
  { id: 'section-6', label: '6. Key Findings' },
  { id: 'section-7', label: '7. Detailed Analysis' },
  { id: 'section-8', label: '8. Source Comparison' },
  { id: 'section-9', label: '9. Conflicting Information' },
  { id: 'section-10', label: '10. Evidence & Citations' },
  { id: 'section-11', label: '11. Limitations' },
  { id: 'section-12', label: '12. Open Questions' },
  { id: 'section-13', label: '13. Conclusion' },
  { id: 'section-14', label: '14. References' },
];

/** Replace [S1], [S2] inline markers with interactive buttons and hover preview cards */
function RichCitedText({ text, sources = [], onInspectSource, className = '' }) {
  const [hoveredSourceId, setHoveredSourceId] = useState(null);
  if (!text) return null;
  const parts = String(text).split(/(\[S\d+\])/g);
  return (
    <span className={className}>
      {parts.map((part, idx) => {
        const m = part.match(/^\[(S\d+)\]$/);
        if (m) {
          const sid = m[1];
          const src = sources.find((s) => s.source_id === sid);
          return (
            <span key={idx} className="relative inline-block">
              <button
                type="button"
                onMouseEnter={() => setHoveredSourceId(sid)}
                onMouseLeave={() => setHoveredSourceId(null)}
                onClick={() => onInspectSource(sid)}
                className="mx-0.5 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                title={src ? `${src.title} (${src.author_or_publisher})` : `Inspect Source ${sid}`}
              >
                [{sid}]
              </button>
              {hoveredSourceId === sid && src && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-2xl ig-glass p-3 text-left shadow-2xl border border-slate-200/90 dark:border-white/10 animate-in fade-in zoom-in-95">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-400">
                    {src.source_type} &middot; {Math.round(src.composite_score || src.credibility_score || 70)}% Score
                  </span>
                  <span className="mt-1 block text-xs font-bold text-slate-900 line-clamp-2 dark:text-white">
                    {src.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {src.author_or_publisher} {src.publication_year ? `(${src.publication_year})` : ''}
                  </span>
                </span>
              )}
            </span>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}

export default function ReportViewer({
  report,
  onInspectSource,
  onToggleStar,
  savedImageKeys,
  onToggleSaveImage,
  savingImageKey,
}) {
  const [fallbackImages, setFallbackImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activeSection, setActiveSection] = useState('section-1');
  const [fontSize, setFontSize] = useState('md'); // 'sm' | 'md' | 'lg'
  const [copiedMd, setCopiedMd] = useState(false);

  const fontClass =
    fontSize === 'lg'
      ? 'text-base leading-relaxed'
      : fontSize === 'sm'
      ? 'text-xs leading-normal'
      : 'text-sm leading-relaxed';

  const totalWordCount = useMemo(() => {
    if (!report) return 0;
    const textCorpus = [
      report.research_title,
      report.executive_summary,
      report.research_objective,
      report.methodology_and_sources?.overview,
      report.conclusion,
      ...(report.key_findings || []).map((f) => `${f.title} ${f.summary}`),
      ...(report.detailed_analysis || []).map((d) => `${d.heading} ${d.content}`),
    ].join(' ');
    return textCorpus.split(/\s+/).filter(Boolean).length;
  }, [report]);

  const readingTimeMinutes = Math.max(1, Math.ceil(totalWordCount / 220));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );

    OUTLINE_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [report?.id]);

  // Backfill related images cleanly when opening legacy saved reports without persisted images
  useEffect(() => {
    if (!report) return undefined;
    if (report.related_images && report.related_images.length > 0) {
      setFallbackImages([]);
      setLoadingImages(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingImages(true);
    searchTopicImages(report.question, 6)
      .then((imgs) => {
        if (!cancelled) setFallbackImages(imgs || []);
      })
      .catch(() => {
        if (!cancelled) setFallbackImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingImages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report?.id, report?.question, report?.related_images?.length]);

  if (!report) return null;

  const displayImages =
    report.related_images && report.related_images.length > 0
      ? report.related_images
      : fallbackImages;

  const buildMarkdownLines = () => [
    `# ${report.research_title}`,
    `> Query: ${report.question}`,
    `> Generated: ${report.created_at.slice(0, 10)} | Sources: ${report.sources.length} | Conflicts: ${report.conflicting_information.conflicts.length}`,
    '',
    '## 2. Executive Summary',
    report.executive_summary,
    '',
    '## 3. Research Objective',
    report.research_objective,
    '',
    '## 4. Research Questions',
    `**Primary Question:** ${report.research_questions.main_question}`,
    ...report.research_questions.sub_questions.map(
      (sq) => `- **${sq.id}**: ${sq.question} *(Needed: ${sq.information_needed})*`
    ),
    '',
    '## 5. Methodology and Sources Searched',
    report.methodology_and_sources.overview,
    '',
    '## 6. Key Findings',
    ...report.key_findings.map(
      (f) => `- **${f.title}** [${f.verification_status}, ${f.confidence}%]: ${f.summary} ${f.cited_source_ids.map((s) => `[${s}]`).join(' ')}`
    ),
    '',
    '## 7. Detailed Analysis',
    ...report.detailed_analysis.flatMap((sec) => [`### ${sec.sub_question_id}: ${sec.heading}`, sec.content, '']),
    '## 8. Source Comparison',
    report.source_comparison.narrative,
    '',
    '## 9. Conflicting Information',
    report.conflicting_information.summary,
    ...report.conflicting_information.conflicts.map(
      (c) => `- **${c.conflict_id} (${c.topic})**: [${c.source_a_id}] "${c.claim_a}" vs [${c.source_b_id}] "${c.claim_b}" — Uncertain: ${c.what_remains_uncertain}`
    ),
    '',
    '## 10. Evidence and Citations',
    ...report.evidence_and_citations.map(
      (cl) => `- **${cl.claim_id} [${cl.verification_status}]**: ${cl.claim_text} (Sources: ${cl.supporting_source_ids.join(', ') || 'None'})`
    ),
    '',
    '## 11. Limitations of the Research',
    ...report.limitations_of_research.map((l) => `- ${l}`),
    '',
    '## 12. Open Questions',
    ...report.open_questions.map((q) => `- ${q}`),
    '',
    '## 13. Conclusion',
    report.conclusion,
    '',
    '## 14. References',
    ...report.references.map((r) => `- **[${r.source_id}]** ${r.citation_text}`),
  ];

  const downloadMarkdown = () => {
    const lines = buildMarkdownLines();
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ResearchMate_${report.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = async () => {
    try {
      const lines = buildMarkdownLines();
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2400);
    } catch {
      downloadMarkdown();
    }
  };

  const verifiedFactsCount = (report.evidence_and_citations || []).filter((c) => c.is_verified_fact).length;
  const conflictsCount = (report.conflicting_information?.conflicts || []).length;

  return (
    <div className="flex gap-6">
      {/* Sticky Section Outline with ScrollSpy (14 Sections) */}
      <aside className="hidden w-60 shrink-0 2xl:block">
        <div className="sticky top-6 rounded-3xl ig-glass p-4 shadow-sm border border-slate-200/90 dark:border-white/10">
          <div className="mb-2.5 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Sections (14)</span>
            <span className="font-mono text-pink-600 dark:text-pink-400">
              {OUTLINE_ITEMS.findIndex((i) => i.id === activeSection) + 1}/14
            </span>
          </div>
          <nav className="space-y-1">
            {OUTLINE_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`block truncate rounded-xl px-2.5 py-1.5 text-xs transition ${
                    isActive
                      ? 'border-l-2 border-pink-500 bg-pink-500/15 font-bold text-pink-900 dark:bg-pink-500/20 dark:text-pink-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main 14-Section Report Column */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Mobile/Tablet Horizontal Section Scrollbar */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none 2xl:hidden">
          {OUTLINE_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? 'ig-btn-primary text-white shadow-sm'
                    : 'border border-slate-200 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Section 1: Research Title & Reading Controls Toolbar */}
        <section
          id="section-1"
          className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  1. RESEARCH REPORT
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Audience: {report.audience}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Engine: {report.methodology_and_sources?.llm_engine_used}
                </span>
              </div>
              <h1 className="mt-2 font-serif text-2xl font-bold leading-snug text-slate-900 sm:text-3xl dark:text-white">
                {report.research_title}
              </h1>
              <p className="mt-1.5 text-xs text-slate-500">
                Original Query: <span className="font-medium text-slate-700 dark:text-slate-300">{report.question}</span> &middot;{' '}
                {report.created_at.slice(0, 10)}
              </p>

              {/* Reading Stats & Font Size Controls */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                  ~{readingTimeMinutes} min read ({totalWordCount.toLocaleString()} words)
                </span>

                <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-0.5 text-xs font-bold dark:border-white/10 dark:bg-white/5">
                  <Type className="h-3.5 w-3.5 ml-1 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setFontSize('sm')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      fontSize === 'sm'
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Small font size"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('md')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      fontSize === 'md'
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Default font size"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('lg')}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      fontSize === 'lg'
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Large font size"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleStar?.(report.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  report.is_starred
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${report.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{report.is_starred ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={copyMarkdown}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                title="Copy Markdown to clipboard"
              >
                {copiedMd ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>{copiedMd ? 'Copied!' : 'Copy MD'}</span>
              </button>

              <button
                type="button"
                onClick={downloadMarkdown}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Markdown</span>
              </button>

              <a
                href={api.getExportPdfUrl(report.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>

          {/* Summary KPI Badges */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Multi-Source Corpus</div>
              <div className="mt-0.5 text-lg font-extrabold text-slate-900">
                {report.sources.length} Sources
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <div className="text-[11px] font-semibold text-emerald-700">Verified Facts (&ge;2 src)</div>
              <div className="mt-0.5 text-lg font-extrabold text-emerald-900">
                {verifiedFactsCount} / {report.evidence_and_citations.length}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
              <div className="text-[11px] font-semibold text-rose-700">Conflicting Findings</div>
              <div className="mt-0.5 text-lg font-extrabold text-rose-900">
                {conflictsCount} Flagged
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
              <div className="text-[11px] font-semibold text-indigo-700">Sub-Questions</div>
              <div className="mt-0.5 text-lg font-extrabold text-indigo-900 dark:text-indigo-300">
                {report.research_questions.sub_questions.length} Investigated
              </div>
            </div>
          </div>
        </section>

        {/* Multimodal Executive Synthesis & Corroboration Infographic */}
        <ResearchInfographicBanner report={report} />

        {/* Section 2: Executive Summary + Related Images Gallery */}
        <section id="section-2" className="scroll-mt-24 rounded-2xl border border-blue-200 bg-blue-50/40 p-6 dark:border-white/10 dark:bg-slate-900/80">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">2. Executive Summary</h2>
              <p className="mt-2.5">
                <RichCitedText
                  text={report.executive_summary}
                  sources={report.sources}
                  onInspectSource={onInspectSource}
                  className={fontClass}
                />
              </p>
            </div>
            <div className="border-t border-blue-200/70 pt-5 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <RelatedImagesGallery
                images={displayImages}
                loading={loadingImages}
                topic={report.question}
                columns={2}
                maxItems={6}
                title="Related Images"
                savedImageKeys={savedImageKeys}
                onToggleSaveImage={(img) => onToggleSaveImage?.(img, report.question)}
                savingImageKey={savingImageKey}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Research Objective */}
        <section id="section-3" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">3. Research Objective</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.research_objective}</p>
        </section>

        {/* Section 4: Research Questions */}
        <section id="section-4" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">4. Research Questions</h2>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Primary Question: {report.research_questions.main_question}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.research_questions.sub_questions.map((sq) => (
              <div key={sq.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                    {sq.id}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {sq.target_sources.join(' · ')}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{sq.question}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  <strong>Needed:</strong> {sq.information_needed}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Methodology and Sources Searched */}
        <section id="section-5" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">5. Methodology and Sources Searched</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.methodology_and_sources.overview}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/50">
              <div className="font-bold text-slate-800 dark:text-slate-200">Deduplication &amp; Prioritization</div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{report.methodology_and_sources.deduplication_and_ranking_notes}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/50">
              <div className="font-bold text-slate-800 dark:text-slate-200">Verification Guardrail Protocol</div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{report.methodology_and_sources.verification_protocol}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <th className="px-3.5 py-2.5 font-bold">Sub-Q</th>
                  <th className="px-3.5 py-2.5 font-bold">Independent Query Executed</th>
                  <th className="px-3.5 py-2.5 font-bold">Providers Queried</th>
                  <th className="px-3.5 py-2.5 font-bold">Retained Sources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(report.methodology_and_sources.search_logs || []).map((log) => (
                  <tr key={log.sub_question_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">{log.sub_question_id}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">{log.query}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">{log.providers_queried.join(', ')}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {log.retained_source_ids.map((sid) => (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => onInspectSource(sid)}
                            className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                          >
                            {sid}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6: Key Findings */}
        <section id="section-6" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">6. Key Findings</h2>
          <div className="mt-4 space-y-3">
            {report.key_findings.map((f) => (
              <div key={f.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-white/20">
                      {f.id}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{f.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {f.verification_status} ({f.confidence}%)
                    </span>
                  </div>
                </div>
                <p className="mt-2">
                  <RichCitedText
                    text={f.summary}
                    sources={report.sources}
                    onInspectSource={onInspectSource}
                    className={fontClass}
                  />
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sources:</span>
                  {f.cited_source_ids.map((sid) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => onInspectSource(sid)}
                      className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      [{sid}]
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Detailed Analysis */}
        <section id="section-7" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">7. Detailed Analysis</h2>
          <div className="mt-4 space-y-5">
            {report.detailed_analysis.map((sec) => (
              <div key={sec.sub_question_id} className="border-l-2 border-pink-500 pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-pink-700 dark:text-pink-400">{sec.sub_question_id}</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{sec.heading}</h3>
                </div>
                <p className="mt-1.5">
                  <RichCitedText
                    text={sec.content}
                    sources={report.sources}
                    onInspectSource={onInspectSource}
                    className={fontClass}
                  />
                </p>
                {sec.cited_source_ids?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sec.cited_source_ids.map((sid) => (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => onInspectSource(sid)}
                        className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-blue-900/40"
                      >
                        [{sid}]
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 8: Source Comparison & Recharts Analytics */}
        <section id="section-8" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">8. Source Comparison &amp; Analytics</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.source_comparison.narrative}</p>

          {report.source_comparison.pdf_vs_web_summary && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                <FileText className="h-3.5 w-3.5" />
                Uploaded PDF vs. Web &amp; Academic Comparison
              </div>
              {report.source_comparison.pdf_vs_web_summary}
            </div>
          )}

          {/* Recharts Analytics */}
          <ReportCharts analytics={report.analytics} />

          {/* Comparison Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <th className="px-3.5 py-3 font-bold">ID</th>
                  <th className="px-3.5 py-3 font-bold">Title &amp; Publisher</th>
                  <th className="px-3.5 py-3 font-bold">Type</th>
                  <th className="px-3.5 py-3 font-bold">Date</th>
                  <th className="px-3.5 py-3 font-bold">Credibility</th>
                  <th className="px-3.5 py-3 font-bold">Relevance</th>
                  <th className="px-3.5 py-3 font-bold">Key Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {report.source_comparison.comparison_rows.map((row) => (
                  <tr key={row.source_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                    <td className="px-3.5 py-3">
                      <button
                        type="button"
                        onClick={() => onInspectSource(row.source_id)}
                        className="rounded bg-blue-100 px-2 py-0.5 font-mono font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        {row.source_id}
                      </button>
                    </td>
                    <td className="px-3.5 py-3 max-w-[230px]">
                      <div className="font-semibold text-slate-900 line-clamp-2 dark:text-white">{row.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.author_or_publisher}</div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {row.source_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-600 dark:text-slate-400">{row.publication_date}</td>
                    <td className="px-3.5 py-3 font-mono font-bold text-blue-700 dark:text-blue-400">{Math.round(row.credibility_score)}%</td>
                    <td className="px-3.5 py-3 font-mono font-bold text-teal-700 dark:text-teal-400">{Math.round(row.relevance_score)}%</td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 max-w-[260px]">{row.key_contribution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 9: Conflicting Information */}
        <ConflictSection data={report.conflicting_information} onInspectSource={onInspectSource} />

        {/* Section 10: Evidence and Citations */}
        <VerificationLedger claims={report.evidence_and_citations} onInspectSource={onInspectSource} />

        {/* Section 11 & 12: Limitations & Open Questions */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section id="section-11" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">11. Limitations of the Research</h2>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {report.limitations_of_research.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </section>

          <section id="section-12" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">12. Open Questions</h2>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {report.open_questions.map((oq, i) => (
                <li key={i}>{oq}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* Section 13: Conclusion */}
        <section id="section-13" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm dark:border-white/10">
          <div className="flex items-center gap-2 text-blue-300">
            <Compass className="h-4 w-4" />
            <h2 className="font-serif text-xl font-bold text-white">13. Conclusion</h2>
          </div>
          <p className="mt-2.5 text-slate-200">
            <RichCitedText
              text={report.conclusion}
              sources={report.sources}
              onInspectSource={onInspectSource}
              className={fontClass}
            />
          </p>
        </section>

        {/* Section 14: References */}
        <section id="section-14" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">14. References</h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {report.references.map((ref) => {
              const isHttp = ref.url && ref.url.startsWith('http');
              return (
                <div
                  key={ref.source_id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs dark:border-white/5 dark:bg-slate-800/50"
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <button
                      type="button"
                      onClick={() => onInspectSource(ref.source_id)}
                      className="rounded bg-blue-700 px-2 py-0.5 font-mono font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      {ref.source_id}
                    </button>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{ref.title}</div>
                      <div className="mt-0.5 text-slate-600 dark:text-slate-400">
                        {ref.author_or_publisher} &middot; {ref.publication_date} &middot;{' '}
                        <span className="uppercase text-slate-500 dark:text-slate-400">{ref.source_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectSource(ref.source_id)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                    >
                      Inspect Snippet
                    </button>
                    {isHttp && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
