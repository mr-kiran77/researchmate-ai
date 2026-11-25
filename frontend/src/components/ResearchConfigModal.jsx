import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  Globe,
  Layers,
  Paperclip,
  Settings2,
  Sliders,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react';

export const AUDIENCE_CONFIG = [
  {
    id: 'academic',
    label: 'Academic Researcher',
    badge: 'Rigorous',
    desc: 'Formal academic tone, methodological critique, peer-reviewed paper references, and citation density.',
    icon: BookOpen,
  },
  {
    id: 'student',
    label: 'College Student',
    badge: 'Educational',
    desc: 'Clear foundational explanations, conceptual breakdowns, intuitive analogies, and study takeaways.',
    icon: User,
  },
  {
    id: 'developer',
    label: 'Project Developer',
    badge: 'Technical',
    desc: 'Architectural trade-offs, engineering constraints, implementation details, and technical synthesis.',
    icon: Layers,
  },
  {
    id: 'educator',
    label: 'Educator',
    badge: 'Pedagogical',
    desc: 'Curricular relevance, balanced educational perspectives, lesson integration, and student comprehension.',
    icon: Sparkles,
  },
  {
    id: 'professional',
    label: 'Professional / Executive',
    badge: 'Strategic',
    desc: 'Executive summaries, strategic industry implications, market dynamics, and actionable recommendations.',
    icon: Settings2,
  },
];

export const DEPTH_CONFIG = [
  {
    id: 'quick',
    label: 'Quick Scan',
    subQuestions: '3 Sub-Questions',
    timeEst: '~15-20s',
    desc: 'Fast initial assessment across top sources. Ideal for quick factual checks and high-level overviews.',
  },
  {
    id: 'standard',
    label: 'Standard Synthesis',
    subQuestions: '4 Sub-Questions',
    timeEst: '~30-45s',
    desc: 'Balanced multi-source inquiry with structured cross-referencing, fact extraction, and balanced coverage.',
  },
  {
    id: 'deep',
    label: 'Deep Investigation',
    subQuestions: '5 Sub-Questions',
    timeEst: '~50-70s',
    desc: 'Exhaustive decomposition, deep cross-corroboration, contradiction detection, and comprehensive synthesis.',
  },
];

export const SOURCE_CONFIG = [
  {
    id: 'web',
    label: 'Live Web Search',
    provider: 'DuckDuckGo / Tavily',
    desc: 'Current real-time web content, reputable news outlets, official documentation, and organizational reports.',
    icon: Globe,
  },
  {
    id: 'academic_paper',
    label: 'Research Papers',
    provider: 'OpenAlex & arXiv',
    desc: 'Over 250M peer-reviewed scientific articles, preprints, citation metrics, and scholarly publications.',
    icon: BookOpen,
  },
  {
    id: 'uploaded_pdf',
    label: 'Uploaded PDFs',
    provider: 'PyMuPDF Engine',
    desc: 'Deep extraction across user-uploaded research papers, whitepapers, monographs, and internal documentation.',
    icon: FileText,
  },
  {
    id: 'knowledge_base',
    label: 'Knowledge Base',
    provider: 'Local Verified Store',
    desc: 'User-curated research briefs, domain glossaries, and synthesized facts stored in your local repository.',
    icon: Database,
  },
];

export default function ResearchConfigModal({
  open,
  onClose,
  audience,
  setAudience,
  depth,
  setDepth,
  enabledSources,
  setEnabledSources,
  pdfs = [],
  selectedPdfIds = [],
  setSelectedPdfIds,
  kbDocs = [],
  selectedKbDocIds = [],
  setSelectedKbDocIds,
  onUploadPdf,
}) {
  const [activeTab, setActiveTab] = useState('audience_depth'); // 'audience_depth' | 'sources' | 'attachments'
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [guardrailNotice, setGuardrailNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const toggleSource = (srcId) => {
    setGuardrailNotice('');
    if (enabledSources.includes(srcId)) {
      if (enabledSources.length <= 2) {
        setGuardrailNotice('At least 2 source types must remain active to ensure multi-source cross-verification.');
        return;
      }
      setEnabledSources(enabledSources.filter((s) => s !== srcId));
    } else {
      setEnabledSources([...enabledSources, srcId]);
    }
  };

  const togglePdf = (pdfId) => {
    if (selectedPdfIds.includes(pdfId)) {
      setSelectedPdfIds?.(selectedPdfIds.filter((id) => id !== pdfId));
    } else {
      setSelectedPdfIds?.([...selectedPdfIds, pdfId]);
      if (!enabledSources.includes('uploaded_pdf')) {
        setEnabledSources([...enabledSources, 'uploaded_pdf']);
      }
    }
  };

  const toggleKbDoc = (docId) => {
    if (!setSelectedKbDocIds) return;
    if (selectedKbDocIds.includes(docId)) {
      setSelectedKbDocIds(selectedKbDocIds.filter((id) => id !== docId));
    } else {
      setSelectedKbDocIds([...selectedKbDocIds, docId]);
      if (!enabledSources.includes('knowledge_base')) {
        setEnabledSources([...enabledSources, 'knowledge_base']);
      }
    }
  };

  const handleFileUpload = async (fileList) => {
    const file = Array.from(fileList || []).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file || !onUploadPdf) return;
    setUploadingPdf(true);
    try {
      const uploaded = await onUploadPdf(file);
      if (uploaded?.id && !selectedPdfIds.includes(uploaded.id)) {
        setSelectedPdfIds?.([...selectedPdfIds, uploaded.id]);
      }
      if (!enabledSources.includes('uploaded_pdf')) {
        setEnabledSources([...enabledSources, 'uploaded_pdf']);
      }
    } finally {
      setUploadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl ig-glass shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-sm">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Research Configuration &amp; Attachments
              </h2>
              <p className="text-xs text-slate-500">
                Tune target audience, research depth, multi-source engines, and custom documents
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/70 bg-slate-50/60 px-6 text-xs font-semibold dark:border-white/10 dark:bg-black/10">
          <button
            type="button"
            onClick={() => setActiveTab('audience_depth')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'audience_depth'
                ? 'border-pink-600 text-pink-700 dark:border-pink-400 dark:text-pink-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Audience &amp; Depth
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'sources'
                ? 'border-pink-600 text-pink-700 dark:border-pink-400 dark:text-pink-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Multi-Source Engines ({enabledSources.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'attachments'
                ? 'border-pink-600 text-pink-700 dark:border-pink-400 dark:text-pink-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Attachments &amp; Library ({selectedPdfIds.length + selectedKbDocIds.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================== */}
          {/* TAB 1: Target Audience & Research Depth                        */}
          {/* ============================================================== */}
          {activeTab === 'audience_depth' && (
            <div className="space-y-6">
              {/* Audience Section */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target Audience
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {AUDIENCE_CONFIG.map((opt) => {
                    const isSelected = audience === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAudience(opt.id)}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50/70 shadow-sm dark:border-pink-500/50 dark:bg-pink-950/30'
                            : 'border-slate-200/80 bg-white/70 hover:border-pink-300 dark:border-white/10 dark:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                              <Icon className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                              {opt.label}
                            </span>
                            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-800 dark:bg-pink-900/40 dark:text-pink-300">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-pink-700 dark:text-pink-400">
                            <Check className="h-3 w-3" />
                            <span>Selected</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Depth Section */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Research Depth &amp; Sub-Question Scope
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {DEPTH_CONFIG.map((opt) => {
                    const isSelected = depth === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDepth(opt.id)}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50/70 shadow-sm dark:border-pink-500/50 dark:bg-pink-950/30'
                            : 'border-slate-200/80 bg-white/70 hover:border-pink-300 dark:border-white/10 dark:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {opt.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {opt.timeEst}
                            </span>
                          </div>
                          <div className="mt-1 inline-block rounded bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300">
                            {opt.subQuestions}
                          </div>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-pink-700 dark:text-pink-400">
                            <Check className="h-3 w-3" />
                            <span>Active</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: Multi-Source Engines                                    */}
          {/* ============================================================== */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Multi-Source Verification Engines
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cross-referencing multiple diverse engines eliminates hallucinations and flags conflicting claims.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {enabledSources.length} Active
                </span>
              </div>

              {guardrailNotice && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{guardrailNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SOURCE_CONFIG.map((src) => {
                  const active = enabledSources.includes(src.id);
                  const Icon = src.icon;
                  return (
                    <div
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={`flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition ${
                        active
                          ? 'border-pink-500 bg-pink-50/70 shadow-sm dark:border-pink-500/50 dark:bg-pink-950/30'
                          : 'border-slate-200/80 bg-white/70 hover:border-slate-300 opacity-60 dark:border-white/10 dark:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                            <Icon className={`h-4 w-4 ${active ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'}`} />
                            {src.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {}}
                            className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500"
                          />
                        </div>
                        <span className="mt-1 inline-block text-[10px] font-semibold text-slate-400">
                          {src.provider}
                        </span>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {src.desc}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold">
                        <span className={active ? 'text-pink-700 dark:text-pink-300' : 'text-slate-400'}>
                          {active ? 'Enabled for Research' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: Attachments & Document Library                          */}
          {/* ============================================================== */}
          {activeTab === 'attachments' && (
            <div className="space-y-6">
              {/* PDF Dropzone */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Upload &amp; Attach New Research PDF
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
                    handleFileUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDragging
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40'
                      : 'border-slate-300 bg-slate-50/70 hover:border-pink-400 hover:bg-pink-50/20 dark:border-white/15 dark:bg-white/5'
                  }`}
                >
                  <Upload className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                  <span className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {uploadingPdf ? 'Extracting PDF text via PyMuPDF...' : 'Drag & drop PDF here or click to browse'}
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    Fast text extraction, table preservation, and automatic citation generation
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </div>
              </div>

              {/* Uploaded PDF Library Picker */}
              {pdfs.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Your Uploaded PDF Library ({selectedPdfIds.length} attached)
                    </label>
                    <span className="text-[11px] text-slate-400">Select to include in research</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {pdfs.map((pdf) => {
                      const isSelected = selectedPdfIds.includes(pdf.id);
                      return (
                        <div
                          key={pdf.id}
                          onClick={() => togglePdf(pdf.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                            isSelected
                              ? 'border-pink-500 bg-pink-50/80 dark:border-pink-500/50 dark:bg-pink-950/40'
                              : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'}`} />
                            <div className="min-w-0">
                              <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {pdf.title || pdf.filename}
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                {pdf.page_count} pages &middot; {Math.round((pdf.file_size_bytes || 0) / 1024)} KB
                              </p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Knowledge Base Documents Picker */}
              {kbDocs.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Knowledge Base Documents ({selectedKbDocIds.length} attached)
                    </label>
                    <span className="text-[11px] text-slate-400">Include local research briefs</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {kbDocs.map((doc) => {
                      const isSelected = selectedKbDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleKbDoc(doc.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                            isSelected
                              ? 'border-pink-500 bg-pink-50/80 dark:border-pink-500/50 dark:bg-pink-950/40'
                              : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Database className={`h-4 w-4 shrink-0 ${isSelected ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'}`} />
                            <div className="min-w-0">
                              <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {doc.title}
                              </h4>
                              <p className="truncate text-[10px] text-slate-400">
                                {doc.topic || 'General'} &middot; {doc.content?.slice(0, 40)}...
                              </p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-6 py-3.5 dark:border-white/10 dark:bg-black/10">
          <div className="text-[11px] text-slate-500">
            {audience} &middot; {depth} &middot; {enabledSources.length} engines &middot;{' '}
            {selectedPdfIds.length + selectedKbDocIds.length} attachments
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Apply &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
