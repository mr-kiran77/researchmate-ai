import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  FileCheck2,
  FileDown,
  FileText,
  Flame,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Mic,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import QuickTopicResults from './QuickTopicResults';
import RelatedImagesGallery from './RelatedImagesGallery';
import ResearchConfigModal from './ResearchConfigModal';
import ResearchPlanView from './ResearchPlanView';
import ResearchProgressTimeline from './ResearchProgressTimeline';
import VoiceInputButton from './VoiceInputButton';

const SUGGESTED_CARDS = [
  {
    category: 'Artificial Intelligence',
    title: 'Generative AI in Higher Education',
    prompt: 'Evaluate the pedagogical benefits, cognitive risks, and policy frameworks of generative AI adoption in university education.',
    icon: Sparkles,
  },
  {
    category: 'Clean Energy & Storage',
    title: 'Solid-State vs. Lithium-Ion Batteries',
    prompt: 'Compare solid-state battery breakthroughs vs current lithium-ion technology for EV range, safety, and commercial scaling by 2028.',
    icon: Layers,
  },
  {
    category: 'Biomedicine & Therapeutics',
    title: 'GLP-1 Receptor Agonists Efficacy',
    prompt: 'Investigate empirical clinical evidence on GLP-1 receptor agonists beyond diabetes: cardiovascular, neurological, and off-target effects.',
    icon: BookOpen,
  },
  {
    category: 'Organizational Science',
    title: 'Hybrid vs. Remote Work Productivity',
    prompt: 'What does peer-reviewed empirical evidence say about hybrid vs fully remote work models regarding team productivity and employee retention?',
    icon: Database,
  },
];

const TRENDING_CHIPS = [
  'Space Exploration',
  'Artificial Intelligence',
  'Modern Architecture',
  'Nature',
  'Quantum Computing',
  'Climate Resilience',
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

const FOLLOW_UP_CHIPS = [
  'Explain the second finding in simple terms',
  'Which source has the highest authority?',
  'What are the strongest counterarguments?',
  'Summarize the key points in 5 takeaways',
  'Explain the research limitations',
];

/**
 * ConversationalResearchView — Modern ChatGPT-style conversational research interface.
 * Handles:
 * - Empty / Welcoming Hero State with intelligent prompt cards & trending chips.
 * - In-Progress State with live agent progress, sub-questions, and discovered sources.
 * - Completed Report State with research synthesis card, fact-verification badges, and follow-up chat.
 * - Centered Bottom-Anchored Composer with auto-expanding input and research configuration pills.
 */
export default function ConversationalResearchView({
  // Research State & Handlers
  question,
  setQuestion,
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
  onQuickSearch,
  onClearSearch,
  onPreviewPlan,
  onStartResearch,
  onOpenReportWorkspace,
  onNewResearch,

  // Execution & Progress State
  isRunning = false,
  isPlanning = false,
  isQuickSearching = false,
  progress = {},
  liveStats = {},
  liveImages = [],
  previewPlan = null,
  setPreviewPlan,
  quickResult = null,

  // Active Report & Follow-up Chat State
  activeReport = null,
  onInspectSource,
  onToggleStar,
  savedImageKeys = new Set(),
  onToggleSaveImage,
  savingImageKey = '',
  currentUser,
}) {
  const [messages, setMessages] = useState([]);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [showConfigPopover, setShowConfigPopover] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isDraggingComposer, setIsDraggingComposer] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isFirstRender = useRef(true);
  const skipNextDebounce = useRef(false);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 44), 160)}px`;
    }
  }, [question]);

  // Load grounded follow-up chat messages whenever an active report changes
  useEffect(() => {
    if (!activeReport?.id) {
      setMessages([]);
      return;
    }
    let active = true;
    api
      .getChatMessages(activeReport.id)
      .then((rows) => {
        if (active) setMessages(rows || []);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [activeReport?.id]);

  // Scroll to bottom when new messages arrive or research completes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRunning, previewPlan, activeReport]);

  // Debounced live topic + image search
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
    if (!onQuickSearch || trimmed.length < 3 || isRunning || activeReport) return undefined;

    const timer = setTimeout(() => {
      onQuickSearch(trimmed);
    }, 520);
    return () => clearTimeout(timer);
  }, [question, onQuickSearch, isRunning, activeReport]);

  const handleSelectSuggestedCard = (promptText) => {
    skipNextDebounce.current = true;
    setQuestion(promptText);
    textareaRef.current?.focus();
  };

  const handleSelectTrendingChip = (chipText) => {
    skipNextDebounce.current = true;
    setQuestion(chipText);
    onQuickSearch?.(chipText);
    textareaRef.current?.focus();
  };

  const toggleSource = (srcId) => {
    if (enabledSources.includes(srcId)) {
      if (enabledSources.length <= 2) return;
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

  const handleFileUpload = async (fileList) => {
    const file = Array.from(fileList || []).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file || !onUploadPdf) return;
    setUploadingPdf(true);
    try {
      const uploaded = await onUploadPdf(file);
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

  const handleSendPrompt = async (overrideText = null) => {
    const text = (overrideText ?? question).trim();
    if (!text || isRunning || sendingFollowUp) return;

    // If an active report is currently displayed, route to grounded follow-up chat
    if (activeReport?.id) {
      setSendingFollowUp(true);
      setFollowUpError('');
      if (overrideText === null) setQuestion('');

      const optimisticUser = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const res = await api.sendChatMessage(activeReport.id, text);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          res.user_message,
          res.assistant_message,
        ]);
      } catch (err) {
        setFollowUpError(err.message || 'Failed to send follow-up message');
      } finally {
        setSendingFollowUp(false);
      }
    } else {
      // Start full autonomous research pipeline
      onStartResearch?.(previewPlan);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const renderCitationText = (content) => {
    const parts = String(content).split(/(\[S\d+\])/g);
    return parts.map((p, idx) => {
      const m = p.match(/^\[(S\d+)\]$/);
      if (m) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onInspectSource?.(m[1])}
            className="mx-0.5 inline-flex items-center rounded bg-blue-100/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
            title={`Inspect Source ${m[1]}`}
          >
            [{m[1]}]
          </button>
        );
      }
      return <React.Fragment key={idx}>{p}</React.Fragment>;
    });
  };

  const hasContent = activeReport || isRunning || previewPlan || quickResult;

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl flex-col justify-between pb-36">
      {/* Top Session Bar (When Report is Active) */}
      {activeReport && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl ig-glass px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl ig-btn-primary text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="max-w-md truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeReport.title || activeReport.question}
                </h2>
                {activeReport.is_starred && (
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {activeReport.source_count || activeReport.sources?.length || 0} sources &middot;{' '}
                {activeReport.audience || 'Academic'} &middot;{' '}
                {activeReport.depth || 'Standard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenReportWorkspace}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Full 14-Section Report</span>
            </button>
            <button
              type="button"
              onClick={() => onNewResearch?.()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>New</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Conversational Feed */}
      <div className="flex-1 space-y-6">
        {/* ================================================================ */}
        {/* STATE 1: Empty / Welcoming Hero State                            */}
        {/* ================================================================ */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-pink-500/10 px-4 py-1.5 text-xs font-bold text-pink-700 shadow-sm dark:border-pink-500/30 dark:text-pink-300">
              <Sparkles className="h-3.5 w-3.5" />
              Autonomous Multi-Source Research &amp; Fact-Verification Agent
            </div>

            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              What would you like to research today?
            </h1>

            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Ask any complex research inquiry. ResearchMate AI autonomously breaks it into targeted
              sub-questions, searches live web, research papers, your PDFs, and knowledge base,
              cross-verifies every claim, and synthesizes a verified report.
            </p>

            {/* Suggested Research Cards */}
            <div className="mt-8 grid w-full grid-cols-1 gap-3.5 text-left sm:grid-cols-2">
              {SUGGESTED_CARDS.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestedCard(card.prompt)}
                    className="group relative flex flex-col justify-between rounded-2xl frosted-glass-card p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-pink-400 hover:shadow-lg dark:hover:border-pink-500/50"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-700 dark:text-pink-400">
                          {card.category}
                        </span>
                        <Icon className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:scale-110 group-hover:text-pink-600 dark:group-hover:text-pink-400" />
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {card.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {card.prompt}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-pink-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-pink-400">
                      <span>Start Research</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trending Topic Chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Trending:
              </span>
              {TRENDING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSelectTrendingChip(chip)}
                  className="rounded-full border border-pink-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-pink-400 hover:text-pink-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-pink-300"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Search & Topic Results (if active) */}
        {(isQuickSearching || quickResult) && (
          <div className="space-y-4">
            <QuickTopicResults
              result={quickResult}
              loading={isQuickSearching}
              query={question}
              savedImageKeys={savedImageKeys}
              onToggleSaveImage={(img) => onToggleSaveImage?.(img, quickResult?.query || question)}
              savingImageKey={savingImageKey}
              onSelectTag={(tag) => {
                setQuestion(tag);
                onQuickSearch?.(tag);
              }}
            />
          </div>
        )}

        {/* Plan Preview View (if user requested Preview Plan) */}
        {previewPlan && !isRunning && !activeReport && (
          <div className="space-y-4">
            <ResearchPlanView
              plan={previewPlan}
              editable={!isRunning}
              onChangePlan={setPreviewPlan}
              onExecutePlan={onStartResearch}
              isRunning={isRunning}
            />
          </div>
        )}

        {/* ================================================================ */}
        {/* STATE 2: In-Progress Research Feed                               */}
        {/* ================================================================ */}
        {isRunning && (
          <div className="space-y-6">
            {/* User Query Bubble */}
            <div className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-3">
                <div className="rounded-3xl ig-btn-primary px-5 py-3.5 text-sm font-medium text-white shadow-md">
                  <p className="leading-relaxed">{question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-white/80">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold uppercase">
                      {audience}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold uppercase">
                      {depth}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold">
                      {enabledSources.length} Sources
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-700 shadow-sm dark:bg-pink-900/40 dark:text-pink-300">
                  <User className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Agent Live Progress & Timeline Bubble */}
            <div className="flex justify-start">
              <div className="flex max-w-[96%] items-start gap-3 sm:max-w-[92%]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-md">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <div className="w-full space-y-4">
                  <ResearchProgressTimeline
                    progress={progress}
                    liveStats={liveStats}
                    plan={previewPlan}
                    onInspectSource={onInspectSource}
                  />

                  {liveImages.length > 0 && (
                    <div className="rounded-3xl ig-glass p-5 shadow-sm border border-slate-200/90 dark:border-white/10">
                      <RelatedImagesGallery
                        images={liveImages}
                        loading={false}
                        topic={question}
                        columns={4}
                        title="Live Discovered Images"
                        savedImageKeys={savedImageKeys}
                        onToggleSaveImage={(img) => onToggleSaveImage?.(img, question)}
                        savingImageKey={savingImageKey}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STATE 3: Completed Report Conversation & Follow-Up Q&A           */}
        {/* ================================================================ */}
        {activeReport && !isRunning && (
          <div className="space-y-6">
            {/* Initial User Turn */}
            <div className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-3">
                <div className="rounded-3xl ig-btn-primary px-5 py-3.5 text-sm font-medium text-white shadow-md">
                  <p className="leading-relaxed">{activeReport.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-white/80">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold uppercase">
                      {activeReport.audience || audience}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold uppercase">
                      {activeReport.depth || depth}
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-700 shadow-sm dark:bg-pink-900/40 dark:text-pink-300">
                  <User className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Initial Agent Turn: Research Synthesis Card */}
            <div className="flex justify-start">
              <div className="flex max-w-[95%] items-start gap-3 sm:max-w-[90%]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-md">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="w-full space-y-4 rounded-3xl ig-glass p-5 sm:p-6 shadow-sm">
                  {/* Synthesis Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-400">
                        Autonomous Multi-Source Synthesis
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeReport.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeReport.confidence_score && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {Math.round(activeReport.confidence_score * 100)}% Confidence
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        {activeReport.source_count || activeReport.sources?.length || 0} Sources
                      </span>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  {activeReport.executive_summary && (
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      <p>{activeReport.executive_summary}</p>
                    </div>
                  )}

                  {/* Key Findings Preview */}
                  {Array.isArray(activeReport.key_findings) && activeReport.key_findings.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Key Corroborated Findings
                      </h4>
                      <ul className="space-y-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                        {activeReport.key_findings.slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-600 dark:bg-pink-400" />
                            <span>
                              {typeof f === 'string' ? renderCitationText(f) : renderCitationText(f.finding || f.claim || '')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onOpenReportWorkspace}
                        className="inline-flex items-center gap-2 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open 14-Section Report Workspace</span>
                      </button>

                      {onToggleStar && (
                        <button
                          type="button"
                          onClick={() => onToggleStar(activeReport.id, !activeReport.is_starred)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${activeReport.is_starred
                              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                            }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${activeReport.is_starred ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
                              }`}
                          />
                          <span>{activeReport.is_starred ? 'Starred' : 'Star'}</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400">
                      ID: {activeReport.id?.slice(0, 8)} &middot; Auto-saved to History
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Follow-up Q&A Turn Stream */}
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id || m.created_at}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-3 ${isUser ? 'max-w-[85%]' : 'max-w-[95%] sm:max-w-[90%]'
                      }`}
                  >
                    {!isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-md">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}

                    <div
                      className={`rounded-3xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${isUser
                          ? 'ig-btn-primary text-white font-medium shadow-md'
                          : 'ig-glass text-slate-800 dark:text-slate-200 shadow-sm'
                        }`}
                    >
                      <div className="whitespace-pre-wrap">
                        {isUser ? m.content : renderCitationText(m.content)}
                      </div>
                    </div>

                    {isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-700 shadow-sm dark:bg-pink-900/40 dark:text-pink-300">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Sending indicator for follow-up */}
            {sendingFollowUp && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ig-btn-primary text-white shadow-md">
                    <Bot className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="rounded-2xl ig-glass px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Loader2 className="inline-block h-3.5 w-3.5 animate-spin mr-2 text-pink-600" />
                    Analyzing report findings &amp; citing sources...
                  </div>
                </div>
              </div>
            )}

            {followUpError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800">
                {followUpError}
              </div>
            )}

            {/* Suggested Follow-Up Prompt Chips */}
            <div className="pt-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Suggested Follow-Up Queries:
              </span>
              <div className="flex flex-wrap gap-2">
                {FOLLOW_UP_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={sendingFollowUp}
                    onClick={() => handleSendPrompt(chip)}
                    className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-800 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-pink-300"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ================================================================ */}
      {/* BOTTOM ANCHORED RESEARCH COMPOSER (ChatGPT-Style)                 */}
      {/* ================================================================ */}
      <div className="fixed bottom-3 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none md:bottom-5 md:pl-20 lg:pl-64">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingComposer(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsDraggingComposer(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingComposer(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          className="pointer-events-auto relative w-full max-w-3xl rounded-3xl frosted-glass-card p-3 sm:p-4 shadow-2xl border border-white/80 dark:border-white/10"
        >
          {/* Drag & Drop Overlay */}
          {isDraggingComposer && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-pink-500/15 backdrop-blur-md border-2 border-dashed border-pink-500 text-center animate-pulse">
              <Upload className="h-8 w-8 text-pink-600 mb-1" />
              <span className="text-xs font-bold text-pink-900 dark:text-pink-200">
                Drop PDF here to attach to research query
              </span>
              <span className="text-[10px] text-pink-700 dark:text-pink-300">
                Auto-extracts text and cross-verifies against other sources
              </span>
            </div>
          )}

          {/* Research Configuration Accessory Bar */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 px-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Audience Pill */}
              <div className="relative">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="frosted-input appearance-none rounded-xl py-1 pl-2.5 pr-6 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-pink-300 focus:outline-none dark:text-slate-200"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="dark:bg-slate-900 dark:text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-slate-400" />
              </div>

              {/* Depth Pill */}
              <div className="relative">
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  className="frosted-input appearance-none rounded-xl py-1 pl-2.5 pr-6 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-pink-300 focus:outline-none dark:text-slate-200"
                >
                  {DEPTH_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="dark:bg-slate-900 dark:text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-slate-400" />
              </div>

              {/* Enhanced Settings & Attachments Modal Trigger */}
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-pink-200/90 bg-pink-50/70 px-2.5 py-1 text-[11px] font-semibold text-pink-800 shadow-sm transition hover:border-pink-400 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-300"
                title="Advanced research settings, source engines & attachments"
              >
                <Sliders className="h-3 w-3 text-pink-600 dark:text-pink-400" />
                <span>
                  Configure ({enabledSources.length} Engines
                  {selectedPdfIds.length + selectedKbDocIds.length > 0
                    ? ` · ${selectedPdfIds.length + selectedKbDocIds.length} Attached`
                    : ''}
                  )
                </span>
              </button>

              {/* Attach PDF Trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPdf}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                title="Attach Research PDF"
              >
                <Paperclip className="h-3 w-3 text-slate-500" />
                <span>{uploadingPdf ? 'Extracting...' : 'Attach PDF'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Mode Indicator / Plan Preview Action */}
            <div className="flex items-center gap-2">
              {!activeReport && (
                <button
                  type="button"
                  disabled={isPlanning || isRunning || question.trim().length < 3}
                  onClick={onPreviewPlan}
                  className="hidden items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-pink-700 disabled:opacity-40 sm:inline-flex dark:text-slate-400 dark:hover:text-pink-300"
                >
                  <ListChecks className="h-3 w-3 text-pink-600" />
                  <span>Preview Plan</span>
                </button>
              )}

              {activeReport && (
                <span className="text-[10px] font-semibold text-slate-400">
                  Follow-up Mode
                </span>
              )}
            </div>
          </div>

          {/* Config Popover (Sources & Attached PDFs) */}
          {showConfigPopover && (
            <div className="mb-2.5 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl dark:border-white/10 dark:bg-slate-900/95">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Multi-Source Engines (minimum 2 active)
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfigPopover(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SOURCE_OPTIONS.map((src) => {
                  const Icon = src.icon;
                  const active = enabledSources.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleSource(src.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${active
                          ? 'border-pink-500 bg-pink-50/70 text-pink-900 dark:border-pink-500/50 dark:bg-pink-950/40 dark:text-pink-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
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

              {/* Uploaded PDF Selector Pills inside popover */}
              {pdfs.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-white/10">
                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Attach From Uploaded PDF Library:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pdfs.map((pdf) => {
                      const selected = selectedPdfIds.includes(pdf.id);
                      return (
                        <button
                          key={pdf.id}
                          type="button"
                          onClick={() => togglePdf(pdf.id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${selected
                              ? 'border-pink-500 bg-pink-500 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-pink-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                            }`}
                        >
                          <FileText className="h-2.5 w-2.5" />
                          <span className="max-w-[150px] truncate">{pdf.title || pdf.filename}</span>
                          {selected && <X className="h-2.5 w-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attached Documents Chips (PDFs & Knowledge Base) */}
          {(selectedPdfIds.length > 0 || selectedKbDocIds.length > 0) && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1.5">
              <span className="text-[10px] font-bold text-slate-500">
                Attached ({selectedPdfIds.length + selectedKbDocIds.length}):
              </span>
              {selectedPdfIds.map((id) => {
                const pdf = pdfs.find((p) => p.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-pink-300 bg-pink-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-pink-800 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-300"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    <span className="max-w-[130px] truncate">{pdf?.title || pdf?.filename || 'PDF'}</span>
                    <button
                      type="button"
                      onClick={() => togglePdf(id)}
                      className="hover:text-rose-600"
                      title="Remove PDF"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                );
              })}
              {selectedKbDocIds.map((id) => {
                const doc = kbDocs.find((d) => d.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    <Database className="h-2.5 w-2.5" />
                    <span className="max-w-[130px] truncate">{doc?.title || 'KB Brief'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKbDocIds?.(selectedKbDocIds.filter((docId) => docId !== id));
                      }}
                      className="hover:text-rose-600"
                      title="Remove KB attachment"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Text Input Row */}
          <div className="frosted-input relative flex items-end gap-2 rounded-2xl p-1.5 shadow-sm transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning || sendingFollowUp}
              placeholder={
                activeReport
                  ? 'Ask a follow-up about this report or explore a specific finding... (Enter to send)'
                  : 'Ask a complex research question or enter a topic to investigate... (Enter to send)'
              }
              className="max-h-40 min-h-[44px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-slate-500"
            />

            <div className="flex shrink-0 items-center gap-1.5 pb-1 pr-1">
              {question.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuestion('');
                    onClearSearch?.();
                  }}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 dark:hover:bg-white/10"
                  title="Clear text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Web Speech API Voice Recognition Controller */}
              <VoiceInputButton
                onTranscript={(spokenText) => {
                  setQuestion(spokenText);
                }}
                onFinalTranscript={(finalText) => {
                  setQuestion(finalText);
                }}
                disabled={isRunning || sendingFollowUp}
              />

              {/* Submit Send Button */}
              <button
                type="button"
                disabled={isRunning || sendingFollowUp || question.trim().length < 2}
                onClick={() => handleSendPrompt()}
                aria-label="Send research prompt"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ig-btn-primary text-white shadow-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunning || sendingFollowUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between px-2 text-[10px] text-slate-400">
            <span>Shift + Enter for new line</span>
            <span>ResearchMate AI cross-verifies all findings with live citations</span>
          </div>
        </div>
      </div>

      {/* Research Settings & Unified Attachments Hub Modal */}
      <ResearchConfigModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        audience={audience}
        setAudience={setAudience}
        depth={depth}
        setDepth={setDepth}
        enabledSources={enabledSources}
        setEnabledSources={setEnabledSources}
        pdfs={pdfs}
        selectedPdfIds={selectedPdfIds}
        setSelectedPdfIds={setSelectedPdfIds}
        kbDocs={kbDocs}
        selectedKbDocIds={selectedKbDocIds}
        setSelectedKbDocIds={setSelectedKbDocIds}
        onUploadPdf={onUploadPdf}
      />
    </div>
  );
}
