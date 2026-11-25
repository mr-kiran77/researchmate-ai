import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Flame,
  Globe,
  Image as ImageIcon,
  ListChecks,
  Paperclip,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

const TRENDING_TOPICS = [
  'Space Exploration',
  'Artificial Intelligence',
  'Modern Architecture',
  'Nature',
];

const EXAMPLE_PROMPTS = [
  'What are the advantages and disadvantages of Artificial Intelligence in education?',
  'Compare solid-state batteries vs lithium-ion for EV adoption',
  'How effective are GLP-1 receptor agonists beyond diabetes treatment?',
  'What does empirical evidence say about hybrid vs remote work productivity?',
];

const AUDIENCE_OPTIONS = [
  { id: 'student', label: 'College Student' },
  { id: 'academic', label: 'Academic Researcher' },
  { id: 'developer', label: 'Project Developer' },
  { id: 'educator', label: 'Educator' },
  { id: 'professional', label: 'Professional' },
];

const DEPTH_OPTIONS = [
  { id: 'quick', label: 'Quick Scan (3 sub-Q)' },
  { id: 'standard', label: 'Standard (4 sub-Q)' },
  { id: 'deep', label: 'Deep Synthesis (5 sub-Q)' },
];

const SOURCE_OPTIONS = [
  { id: 'web', label: 'Web Search', icon: Globe },
  { id: 'academic_paper', label: 'Research Papers', icon: BookOpen },
  { id: 'uploaded_pdf', label: 'Uploaded PDFs', icon: FileText },
  { id: 'knowledge_base', label: 'Knowledge Base', icon: Database },
];

export default function QuestionInput({
  question,
  setQuestion,
  audience,
  setAudience,
  depth,
  setDepth,
  enabledSources,
  setEnabledSources,
  pdfs,
  selectedPdfIds,
  setSelectedPdfIds,
  onUploadPdfInline,
  onQuickSearch,
  onClearSearch,
  onPreviewPlan,
  onStartResearch,
  isQuickSearching,
  isPlanning,
  isRunning,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const isFirstRender = useRef(true);
  const skipNextDebounce = useRef(false);

  // Debounced live topic + image search as the user types in the search bar
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return undefined;
    }
    const trimmed = question.trim();
    if (!onQuickSearch || trimmed.length < 3) return undefined;

    const timer = setTimeout(() => {
      onQuickSearch(trimmed);
    }, 520);
    return () => clearTimeout(timer);
    // Intentionally triggers only on question text edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const triggerInstantSearch = (queryOverride) => {
    const target = (typeof queryOverride === 'string' ? queryOverride : question).trim();
    if (!target || !onQuickSearch) return;
    skipNextDebounce.current = true;
    onQuickSearch(target);
  };

  const handleClear = () => {
    skipNextDebounce.current = true;
    setQuestion('');
    onClearSearch?.();
    searchInputRef.current?.focus();
  };

  const toggleSource = (srcId) => {
    if (enabledSources.includes(srcId)) {
      if (enabledSources.length <= 2) return; // Require at least 2 source types
      setEnabledSources(enabledSources.filter((s) => s !== srcId));
    } else {
      setEnabledSources([...enabledSources, srcId]);
    }
  };

  const togglePdf = (pdfId) => {
    if (selectedPdfIds.includes(pdfId)) {
      setSelectedPdfIds(selectedPdfIds.filter((id) => id !== pdfId));
    } else {
      setSelectedPdfIds([...selectedPdfIds, pdfId]);
      if (!enabledSources.includes('uploaded_pdf')) {
        setEnabledSources([...enabledSources, 'uploaded_pdf']);
      }
    }
  };

  const handleFiles = async (fileList) => {
    const file = Array.from(fileList || []).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file || !onUploadPdfInline) return;
    setUploadingPdf(true);
    try {
      const uploaded = await onUploadPdfInline(file);
      if (uploaded?.id && !selectedPdfIds.includes(uploaded.id)) {
        setSelectedPdfIds([...selectedPdfIds, uploaded.id]);
      }
      if (!enabledSources.includes('uploaded_pdf')) {
        setEnabledSources([...enabledSources, 'uploaded_pdf']);
      }
    } finally {
      setUploadingPdf(false);
    }
  };

  const disabled = isPlanning || isRunning || question.trim().length < 3;

  return (
    <section className="mx-auto max-w-5xl">
      {/* Hero Title */}
      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-200/90 bg-white/70 px-4 py-1.5 text-xs font-bold text-pink-700 shadow-sm backdrop-blur-md dark:border-pink-500/30 dark:bg-slate-900/60 dark:text-pink-300">
          <Sparkles className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
          Autonomous Multi-Source Research &amp; Fact-Verification Agent
        </div>
        <h1 className="font-serif text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Ask a complex research question. Get a verified, cited report.
        </h1>
        <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          ResearchMate AI decomposes your question into targeted sub-questions, searches live web, academic papers,
          knowledge base briefs, and your PDFs, verifies claims, flags contradictions, and generates a 14-section report.
        </p>
      </div>

      {/* Main Elevated Frosted Glass Card with Gradient Border Highlight */}
      <div className="frosted-gradient-ring">
        <div className="frosted-glass-card p-6 sm:p-8">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <label htmlFor="research-question-input" className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              RESEARCH QUESTION OR TOPIC
            </label>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
              Auto-searches as you type &middot; Press Enter for instant results
            </span>
          </div>

          {/* Enhanced Frosted Search Bar Container with Search Action & Clear (X) */}
          <div className="frosted-input relative flex items-start rounded-2xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => triggerInstantSearch(question)}
              disabled={isQuickSearching || question.trim().length < 2}
              aria-label="Search topic and related images"
              title="Search topic & related images"
              className="ml-2 mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ig-btn-primary text-white shadow-md transition disabled:opacity-40"
            >
              <Search className="h-4 w-4" />
            </button>

            <textarea
              ref={searchInputRef}
              id="research-question-input"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && question.trim().length >= 2) {
                  e.preventDefault();
                  triggerInstantSearch(question);
                }
              }}
              placeholder="Search any topic (e.g., Space Exploration, Artificial Intelligence, Modern Architecture, Nature)..."
              className="w-full resize-none border-0 bg-transparent px-3 py-2.5 pr-11 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-slate-500"
            />

            {question.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                title="Clear search"
                className="mr-2 mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200/70 text-slate-600 transition hover:bg-rose-100 hover:text-rose-700 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Trending Topic Chips */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Trending:
            </span>
            {TRENDING_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  skipNextDebounce.current = true;
                  setQuestion(topic);
                  triggerInstantSearch(topic);
                }}
                className="rounded-full border border-pink-200/90 bg-white/80 px-3.5 py-1 text-xs font-semibold text-pink-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-pink-400 hover:bg-pink-50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-pink-300 dark:hover:border-pink-400 dark:hover:bg-pink-950/40"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Deep Research Example Chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Deep prompts:</span>
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  skipNextDebounce.current = true;
                  setQuestion(ex);
                  triggerInstantSearch(ex);
                }}
                className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-left text-xs font-medium text-slate-700 transition hover:border-pink-300 hover:bg-pink-50/60 hover:text-pink-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-pink-400 dark:hover:text-pink-200"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* Configuration Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200/70 pt-5 dark:border-white/10 md:grid-cols-3">
            {/* Target Audience */}
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Target Audience
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="frosted-input w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm dark:text-slate-100"
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="dark:bg-slate-900 dark:text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Research Depth */}
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Research Depth
              </label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="frosted-input w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm dark:text-slate-100"
              >
                {DEPTH_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="dark:bg-slate-900 dark:text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick PDF Attach Dropzone */}
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Attach Research PDF (Optional)
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`frosted-input flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isDragging
                    ? 'border-pink-500 bg-pink-50/80 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'
                    : 'text-slate-700 hover:border-pink-400 hover:text-pink-700 dark:text-slate-300 dark:hover:text-pink-300'
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                <span>{uploadingPdf ? 'Extracting PDF...' : 'Drop PDF or Browse'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>
          </div>

          {/* Source Engines Selection */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                MULTI-SOURCE RESEARCH ENGINES (minimum 2 types active)
              </span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                {enabledSources.length} source types enabled
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {SOURCE_OPTIONS.map((src) => {
                const Icon = src.icon;
                const active = enabledSources.includes(src.id);
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => toggleSource(src.id)}
                    className={`flex items-center justify-between rounded-xl p-3 text-xs font-bold transition-all ${
                      active
                        ? 'border-transparent bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-indigo-500/15 text-pink-950 ring-1.5 ring-pink-500/50 shadow-sm backdrop-blur-md dark:from-pink-500/25 dark:via-purple-500/25 dark:to-indigo-500/25 dark:text-pink-200 dark:ring-pink-400/60'
                        : 'frosted-input text-slate-700 hover:border-pink-300 hover:text-pink-800 dark:text-slate-200 dark:hover:text-pink-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 ${active ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'}`} />
                      {src.label}
                    </span>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Uploaded PDF Selection Pills */}
          {pdfs.length > 0 && (
            <div className="frosted-input mt-4 rounded-xl p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Paperclip className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                <span>Attach Uploaded PDFs to Cross-Check Against Web &amp; Academic Sources:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pdfs.map((pdf) => {
                  const selected = selectedPdfIds.includes(pdf.id);
                  return (
                    <button
                      key={pdf.id}
                      type="button"
                      onClick={() => togglePdf(pdf.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        selected
                          ? 'border-pink-600 bg-pink-600 text-white shadow-sm'
                          : 'border-slate-200/80 bg-white/80 text-slate-700 hover:border-pink-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <FileText className="h-3 w-3" />
                      <span className="max-w-[200px] truncate">{pdf.title || pdf.filename}</span>
                      <span className="opacity-75">({pdf.page_count}p)</span>
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {onQuickSearch && (
              <button
                type="button"
                disabled={isQuickSearching || isRunning || question.trim().length < 2}
                onClick={() => onQuickSearch(question)}
                className="frosted-input inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-pink-800 shadow-sm transition hover:bg-pink-50/80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-pink-300 dark:hover:bg-pink-950/40"
              >
                <ImageIcon className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                {isQuickSearching ? 'Searching Topic & Images...' : 'Search Topic + Images'}
              </button>
            )}

            <button
              type="button"
              disabled={disabled}
              onClick={onPreviewPlan}
              className="frosted-input inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-pink-300 hover:text-pink-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:text-pink-200"
            >
              <ListChecks className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {isPlanning ? 'Analyzing Question...' : 'Preview Research Plan First'}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onStartResearch(null)}
              className="inline-flex items-center justify-center gap-2 rounded-xl ig-btn-primary px-5 py-2.5 text-sm font-bold shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {isRunning ? 'Agent Researching...' : 'Start Autonomous Research'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
