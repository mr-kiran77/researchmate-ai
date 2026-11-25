import React, { useEffect, useState } from 'react';
import { AlertCircle, Bot, Info, MessageSquare, Sliders, X } from 'lucide-react';
import { api } from './api/client';
import AgentProgressBar from './components/AgentProgressBar';
import AuthLandingPage from './components/AuthLandingPage';
import ConversationalResearchView from './components/ConversationalResearchView';
import HistorySidebar from './components/HistorySidebar';
import KnowledgeBaseView from './components/KnowledgeBaseView';
import LeftSidebar from './components/LeftSidebar';
import PdfWorkspace from './components/PdfWorkspace';
import PreferencesModal from './components/PreferencesModal';
import ProfilePage from './components/ProfilePage';
import QuestionInput from './components/QuestionInput';
import QuickTopicResults from './components/QuickTopicResults';
import RelatedImagesGallery, { getImageBookmarkKey } from './components/RelatedImagesGallery';
import ReportViewer from './components/ReportViewer';
import { searchTopicImages, searchTopicOverviewAndImages } from './services/imageSearchService';
import ResearchChat from './components/ResearchChat';
import ResearchPlanView from './components/ResearchPlanView';
import SourceDrawer from './components/SourceDrawer';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('researchmate_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('profile');
  const [profileGridTab, setProfileGridTab] = useState('posts');
  const [profileModalSignal, setProfileModalSignal] = useState(null);
  const [researchViewMode, setResearchViewMode] = useState('studio');

  // Theme Modes: 'system' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('researchmate_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      // migrate from legacy key if present
      const legacy = localStorage.getItem('researchmate_theme');
      return legacy === 'dark' ? 'dark' : 'system';
    } catch {
      return 'system';
    }
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Ambient Continuous Animation Orbs toggle
  const [ambientEffects, setAmbientEffects] = useState(() => {
    try {
      return localStorage.getItem('researchmate_ambient_effects') !== 'false';
    } catch {
      return true;
    }
  });

  // Effective computed theme
  const effectiveTheme = themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;
  const theme = effectiveTheme;

  // Listen for operating system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);
    try {
      mediaQuery.addEventListener('change', handler);
    } catch {
      mediaQuery.addListener?.(handler);
    }
    return () => {
      try {
        mediaQuery.removeEventListener('change', handler);
      } catch {
        mediaQuery.removeListener?.(handler);
      }
    };
  }, []);

  // Sync effective theme with <html> classList
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (effectiveTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [effectiveTheme]);

  const handleSelectThemeMode = (mode) => {
    setThemeMode(mode);
    try {
      localStorage.setItem('researchmate_theme_mode', mode);
      localStorage.setItem('researchmate_theme', mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode);
    } catch {
      // ignore
    }
  };

  const handleToggleAmbientEffects = (enable) => {
    setAmbientEffects(enable);
    try {
      localStorage.setItem('researchmate_ambient_effects', String(enable));
    } catch {
      // ignore
    }
  };
  const [capabilities, setCapabilities] = useState(null);
  const [preferences, setPreferences] = useState(null);

  // Research state
  const [question, setQuestion] = useState(
    'What are the advantages and disadvantages of Artificial Intelligence in education?'
  );
  const [audience, setAudience] = useState('academic');
  const [depth, setDepth] = useState('standard');
  const [enabledSources, setEnabledSources] = useState([
    'web',
    'academic_paper',
    'uploaded_pdf',
    'knowledge_base',
  ]);
  const [selectedPdfIds, setSelectedPdfIds] = useState([]);
  const [selectedKbDocIds, setSelectedKbDocIds] = useState([]);

  const [previewPlan, setPreviewPlan] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isQuickSearching, setIsQuickSearching] = useState(false);
  const [quickResult, setQuickResult] = useState(null);
  const [liveImages, setLiveImages] = useState([]);
  const [savedImages, setSavedImages] = useState([]);
  const [savingImageKey, setSavingImageKey] = useState('');
  const [saveToast, setSaveToast] = useState('');
  const [progress, setProgress] = useState(null);
  const [liveStats, setLiveStats] = useState({});
  const [errorBanner, setErrorBanner] = useState('');

  // Data collections
  const [activeReport, setActiveReport] = useState(null);
  const [reportsHistory, setReportsHistory] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [kbDocs, setKbDocs] = useState([]);

  // Drawers / Modals
  const [inspectedSource, setInspectedSource] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const loadInitialData = async () => {
    try {
      const [health, prefs, reps, pdfList, kbList] = await Promise.all([
        api.getHealth(),
        api.getPreferences(),
        api.listReports(),
        api.listPdfs(),
        api.listKbDocs(),
      ]);
      setCapabilities(health.capabilities);
      setPreferences(prefs);
      setAudience(prefs.default_audience || 'academic');
      setDepth(prefs.default_depth || 'standard');
      if (prefs.enabled_sources?.length >= 2) {
        setEnabledSources(prefs.enabled_sources);
      }
      setReportsHistory(reps);
      setPdfs(pdfList);
      setKbDocs(kbList);
    } catch (err) {
      setErrorBanner(`Backend connection error: ${err.message}. Ensure FastAPI server is running on port 8000.`);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load user's saved topic images collection & track real time spent while logged in
  const refreshSavedImages = React.useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const list = await api.listSavedImages(currentUser.id);
      setSavedImages(Array.isArray(list) ? list : []);
    } catch {
      // ignore if profile has no saved images yet
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setSavedImages([]);
      return undefined;
    }
    refreshSavedImages();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        api.sendActivityHeartbeat(currentUser.id, 15).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [currentUser?.id, refreshSavedImages]);

  const savedImageKeys = React.useMemo(
    () => new Set(savedImages.map((item) => item.image_key)),
    [savedImages]
  );

  const handleToggleSaveImage = async (img, topicOverride = '') => {
    const uid = currentUser?.id || 'guest-demo';
    const imageKey = getImageBookmarkKey(img);
    setSavingImageKey(imageKey);
    try {
      const res = await api.toggleSavedImage(uid, {
        image_key: imageKey,
        topic: topicOverride || question || 'Topic Visual',
        title: img.title || topicOverride || 'Related Visual',
        caption: img.caption || '',
        image_url: img.image_url || img.thumbnail_url,
        thumbnail_url: img.thumbnail_url || img.image_url,
        source_page_url: img.source_page_url || '',
        photographer_or_source: img.photographer_or_source || '',
      });
      await refreshSavedImages();
      setSaveToast(
        res.saved ? 'Saved image to your Profile Saved collection!' : 'Removed from Saved collection.'
      );
      setTimeout(() => setSaveToast(''), 2800);
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setSavingImageKey('');
    }
  };

  const handleClearSearch = () => {
    setQuickResult(null);
    setLiveImages([]);
    setPreviewPlan(null);
    setErrorBanner('');
  };

  const handleQuickSearch = async (queryOverride = null) => {
    const q = (typeof queryOverride === 'string' ? queryOverride : question).trim();
    if (q.length < 2) return;
    setErrorBanner('');
    setIsQuickSearching(true);
    try {
      const data = await searchTopicOverviewAndImages(q, 8);
      setQuickResult(data);
      setLiveImages(data?.related_images || []);
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsQuickSearching(false);
    }
  };

  const handlePreviewPlan = async () => {
    setErrorBanner('');
    setIsPlanning(true);
    try {
      const [plan, imgs] = await Promise.all([
        api.createPlan({
          question,
          audience,
          depth,
          pdf_ids: selectedPdfIds,
        }),
        searchTopicImages(question, 8).catch(() => []),
      ]);
      setPreviewPlan(plan);
      if (imgs.length > 0) setLiveImages(imgs);
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleStartResearch = async (planOverride = null) => {
    const activeQuestion = planOverride?.question || question;
    setErrorBanner('');
    setIsRunning(true);
    setLiveImages([]);
    setProgress({ stage: 'planning', percent: 10, message: 'Initializing ResearchMate AI workflow...' });
    setLiveStats({});

    try {
      const finalReport = await api.runResearchStream(
        {
          question: activeQuestion,
          audience,
          depth,
          enabled_sources: enabledSources,
          pdf_ids: selectedPdfIds,
          plan: planOverride,
        },
        {
          onProgress: (p) => setProgress(p),
          onPlan: (p) => setPreviewPlan(p),
          onSourcesFound: (info) =>
            setLiveStats((prev) => ({
              ...prev,
              sourcesCount: info.count,
              sourceTypes: info.source_types,
              sources: info.sources || [],
            })),
          onImagesFound: (imgs) => setLiveImages(imgs || []),
          onVerification: (info) =>
            setLiveStats((prev) => ({
              ...prev,
              claimsCount: info.claims_count,
              verifiedCount: info.verified_count,
              conflictsCount: info.conflicts_count,
            })),
          onComplete: (rep) => {
            setActiveReport(rep);
            setActiveTab('research');
          },
        }
      );
      if (finalReport) {
        const updatedList = await api.listReports();
        setReportsHistory(updatedList);
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  const handleSelectReport = async (reportId, targetTab = 'research') => {
    setErrorBanner('');
    try {
      const rep = await api.getReport(reportId);
      setActiveReport(rep);
      setActiveTab(targetTab);
    } catch (err) {
      setErrorBanner(err.message);
    }
  };

  const handleNewResearch = () => {
    setActiveReport(null);
    setPreviewPlan(null);
    setQuickResult(null);
    setLiveImages([]);
    setQuestion('');
    setSelectedPdfIds([]);
    setSelectedKbDocIds([]);
    setErrorBanner('');
    setResearchViewMode('studio');
    setActiveTab('research');
  };

  const handleToggleStar = async (reportId) => {
    const res = await api.toggleStarReport(reportId);
    setActiveReport((prev) => (prev?.id === reportId ? { ...prev, is_starred: res.is_starred } : prev));
    setReportsHistory((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, is_starred: res.is_starred } : r))
    );
  };

  const handleDeleteReport = async (reportId) => {
    await api.deleteReport(reportId);
    setReportsHistory((prev) => prev.filter((r) => r.id !== reportId));
    if (activeReport?.id === reportId) {
      setActiveReport(null);
      setActiveTab('research');
    }
  };

  const handleUploadPdf = async (file) => {
    const uploaded = await api.uploadPdf(file);
    setPdfs((prev) => [uploaded, ...prev]);
    return uploaded;
  };

  const handleDeletePdf = async (pdfId) => {
    await api.deletePdf(pdfId);
    setPdfs((prev) => prev.filter((p) => p.id !== pdfId));
    setSelectedPdfIds((prev) => prev.filter((id) => id !== pdfId));
  };

  const handleComparePdfWithWeb = async (pdfId, focusQuestion) => {
    setErrorBanner('');
    try {
      const report = await api.comparePdfWithWeb(pdfId, {
        focus_question: focusQuestion || null,
        audience,
        depth,
      });
      setActiveReport(report);
      setActiveTab('report');
      const updatedList = await api.listReports();
      setReportsHistory(updatedList);
    } catch (err) {
      setErrorBanner(err.message);
    }
  };

  const handleUsePdfInResearch = (pdfId) => {
    if (!selectedPdfIds.includes(pdfId)) {
      setSelectedPdfIds([...selectedPdfIds, pdfId]);
    }
    if (!enabledSources.includes('uploaded_pdf')) {
      setEnabledSources([...enabledSources, 'uploaded_pdf']);
    }
    setActiveTab('research');
  };

  const handleCreateKbDoc = async (payload) => {
    const created = await api.createKbDoc(payload);
    setKbDocs((prev) => [created, ...prev]);
  };

  const handleDeleteKbDoc = async (docId) => {
    await api.deleteKbDoc(docId);
    setKbDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleSavePreferences = async (nextPrefs) => {
    const updated = await api.updatePreferences(nextPrefs);
    setPreferences(updated);
    setAudience(updated.default_audience);
    setDepth(updated.default_depth);
  };

  const inspectSourceById = (sourceId) => {
    if (!activeReport?.sources) return;
    const found = activeReport.sources.find((s) => s.source_id === sourceId);
    if (found) setInspectedSource(found);
  };

  const handleAuthenticated = (user) => {
    setCurrentUser(user);
    setActiveTab('profile');
    try {
      sessionStorage.setItem('researchmate_user', JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
  };

  const toggleTheme = () => {
    const next = effectiveTheme === 'dark' ? 'light' : 'dark';
    handleSelectThemeMode(next);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('researchmate_user');
    } catch {
      // ignore
    }
  };

  const triggerProfileSection = (gridTab = 'posts', modalType = null) => {
    setActiveTab('profile');
    setProfileGridTab(gridTab);
    if (modalType) {
      setProfileModalSignal({ type: modalType, nonce: Date.now() });
    }
  };

  // Front Page: Instagram-inspired authentication page until user logs in or signs up
  if (!currentUser) {
    return <AuthLandingPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={`theme-root relative min-h-screen ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
      {/* Ambient Continuous Research Canvas Background Layer */}
      {ambientEffects && (
        <div className="ambient-background-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
          <div className="ambient-orb ambient-orb-4" />
          <div className="ambient-grid-overlay" />
        </div>
      )}

      <div className="relative z-10">
        <LeftSidebar
        activeTab={activeTab}
        profileGridTab={profileGridTab}
        onSelectTab={(tabId) => {
          setActiveTab(tabId);
          if (tabId === 'profile') setProfileGridTab('posts');
        }}
        onOpenSaved={() => triggerProfileSection('saved')}
        onOpenActivity={() => triggerProfileSection(profileGridTab, 'activity')}
        onOpenSchedule={() => triggerProfileSection('scheduled', 'schedule')}
        onOpenSettings={() => triggerProfileSection(profileGridTab, 'settings')}
        onOpenPreferences={() => setPrefsOpen(true)}
        onOpenProblemReport={() => triggerProfileSection(profileGridTab, 'report_problem')}
        onOpenHistory={() => setHistoryOpen(true)}
        hasActiveReport={!!activeReport}
        pdfCount={pdfs.length}
        kbCount={kbDocs.length}
        historyCount={reportsHistory.length}
        capabilities={capabilities}
        currentUser={currentUser}
        theme={effectiveTheme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        reportsHistory={reportsHistory}
        activeReportId={activeReport?.id}
        onSelectReport={(repId) => handleSelectReport(repId, 'research')}
        onDeleteReport={handleDeleteReport}
        onNewResearch={handleNewResearch}
      />

      <div className="min-h-screen pb-24 transition-[padding] duration-200 md:pb-8 md:pl-20 lg:pl-64">
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8">
        {/* Global notices */}
        {errorBanner && (
          <div className="mx-auto mb-5 flex max-w-5xl items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner('')} className="text-rose-500 hover:text-rose-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {capabilities?.active_llm_provider === 'extractive_fallback' && activeTab === 'research' && (
          <div className="mx-auto mb-5 flex max-w-5xl items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <strong>Extractive Multi-Source Mode Active:</strong> Live retrieval across OpenAlex, arXiv, Wikipedia, DuckDuckGo,
              Knowledge Base, and PyMuPDF uploads is enabled. Add <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> or{' '}
              <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code> (plus optional <code className="rounded bg-amber-100 px-1">TAVILY_API_KEY</code>)
              in <code className="rounded bg-amber-100 px-1">backend/.env</code> to enable full Gemini/OpenAI reasoning.
            </div>
          </div>
        )}

        {/* TAB 0: Instagram-Inspired User Profile Page */}
        {activeTab === 'profile' && (
          <ProfilePage
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            onOpenResearch={() => setActiveTab('research')}
            onOpenReport={handleSelectReport}
            onOpenPdfs={() => setActiveTab('pdfs')}
            onRunTopic={(topic) => {
              setQuestion(topic);
              setActiveTab('research');
            }}
            controlledGridTab={profileGridTab}
            onGridTabChange={setProfileGridTab}
            externalModalSignal={profileModalSignal}
            onUserProfileUpdated={(patch) => {
              setCurrentUser((prev) => {
                if (!prev) return prev;
                const next = { ...prev, ...patch };
                try {
                  sessionStorage.setItem('researchmate_user', JSON.stringify(next));
                } catch {
                  // ignore
                }
                return next;
              });
            }}
            onRefreshHistory={() => api.listReports().then(setReportsHistory).catch(() => {})}
            onRefreshSavedImages={refreshSavedImages}
          />
        )}

        {saveToast && activeTab !== 'profile' && (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl ig-btn-primary px-4 py-3 text-xs font-bold text-white shadow-xl">
            {saveToast}
          </div>
        )}

        {/* TAB 1: Autonomous Multi-Source Research Workspace */}
        {activeTab === 'research' && (
          <div className="space-y-6">
            {/* View Switcher Pill: Research Studio Form vs Conversational AI */}
            <div className="flex items-center justify-center">
              <div className="inline-flex rounded-2xl p-1 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setResearchViewMode('studio')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    researchViewMode === 'studio'
                      ? 'ig-btn-primary text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Research Studio Form
                </button>
                <button
                  type="button"
                  onClick={() => setResearchViewMode('conversational')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    researchViewMode === 'conversational'
                      ? 'ig-btn-primary text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Conversational AI
                </button>
              </div>
            </div>

            {researchViewMode === 'studio' ? (
              <div className="space-y-6">
                <QuestionInput
                  question={question}
                  setQuestion={setQuestion}
                  audience={audience}
                  setAudience={setAudience}
                  depth={depth}
                  setDepth={setDepth}
                  enabledSources={enabledSources}
                  setEnabledSources={setEnabledSources}
                  pdfs={pdfs}
                  selectedPdfIds={selectedPdfIds}
                  setSelectedPdfIds={setSelectedPdfIds}
                  onUploadPdfInline={handleUploadPdf}
                  onQuickSearch={handleQuickSearch}
                  onClearSearch={handleClearSearch}
                  onPreviewPlan={handlePreviewPlan}
                  onStartResearch={handleStartResearch}
                  isQuickSearching={isQuickSearching}
                  isPlanning={isPlanning}
                  isRunning={isRunning}
                />

                {(isQuickSearching || quickResult) && (
                  <QuickTopicResults
                    result={quickResult}
                    loading={isQuickSearching}
                    query={question}
                    savedImageKeys={savedImageKeys}
                    onToggleSaveImage={(img) => handleToggleSaveImage(img, quickResult?.query || question)}
                    savingImageKey={savingImageKey}
                    onSelectTag={(tag) => {
                      setQuestion(tag);
                      handleQuickSearch(tag);
                    }}
                  />
                )}

                {previewPlan && !isRunning && !activeReport && (
                  <ResearchPlanView
                    plan={previewPlan}
                    editable={!isRunning}
                    onChangePlan={setPreviewPlan}
                    onExecutePlan={handleStartResearch}
                    isRunning={isRunning}
                  />
                )}

                {isRunning && (
                  <div className="mx-auto max-w-4xl rounded-3xl frosted-glass-card p-6 shadow-xl">
                    <AgentProgressBar progress={progress} liveStats={liveStats} />
                  </div>
                )}
              </div>
            ) : (
              <ConversationalResearchView
                question={question}
                setQuestion={setQuestion}
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
                onUploadPdf={handleUploadPdf}
                onQuickSearch={handleQuickSearch}
                onClearSearch={handleClearSearch}
                onPreviewPlan={handlePreviewPlan}
                onStartResearch={handleStartResearch}
                onOpenReportWorkspace={() => setActiveTab('report')}
                onNewResearch={handleNewResearch}
                isRunning={isRunning}
                isPlanning={isPlanning}
                isQuickSearching={isQuickSearching}
                progress={progress}
                liveStats={liveStats}
                liveImages={liveImages}
                previewPlan={previewPlan}
                setPreviewPlan={setPreviewPlan}
                quickResult={quickResult}
                activeReport={activeReport}
                onInspectSource={inspectSourceById}
                onToggleStar={handleToggleStar}
                savedImageKeys={savedImageKeys}
                onToggleSaveImage={handleToggleSaveImage}
                savingImageKey={savingImageKey}
                currentUser={currentUser}
              />
            )}
          </div>
        )}

        {/* TAB 2: Report Workspace + Persistent AI Research Chat */}
        {activeTab === 'report' && activeReport && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <ReportViewer
                report={activeReport}
                onInspectSource={inspectSourceById}
                onToggleStar={handleToggleStar}
                savedImageKeys={savedImageKeys}
                onToggleSaveImage={handleToggleSaveImage}
                savingImageKey={savingImageKey}
              />
            </div>

            <div className="hidden xl:block xl:col-span-4">
              <ResearchChat report={activeReport} onInspectSource={inspectSourceById} />
            </div>

            {/* Mobile Chat Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileChatOpen(true)}
              className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 text-xs font-bold text-white shadow-lg xl:hidden"
            >
              <MessageSquare className="h-4 w-4" />
              Ask Research AI
            </button>

            {mobileChatOpen && (
              <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 xl:hidden">
                <div className="relative h-full w-full max-w-md bg-white p-3">
                  <button
                    onClick={() => setMobileChatOpen(false)}
                    className="absolute right-5 top-5 z-10 rounded-lg bg-slate-100 p-1.5 text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <ResearchChat report={activeReport} onInspectSource={inspectSourceById} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PDF Library & Analyzer */}
        {activeTab === 'pdfs' && (
          <PdfWorkspace
            pdfs={pdfs}
            onUploadPdf={handleUploadPdf}
            onDeletePdf={handleDeletePdf}
            onCompareWithWeb={handleComparePdfWithWeb}
            onUseInResearch={handleUsePdfInResearch}
            onSaveToKb={handleCreateKbDoc}
          />
        )}

        {/* TAB 4: Knowledge Base */}
        {activeTab === 'kb' && (
          <KnowledgeBaseView
            docs={kbDocs}
            onCreateDoc={handleCreateKbDoc}
            onDeleteDoc={handleDeleteKbDoc}
          />
        )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <SourceDrawer source={inspectedSource} onClose={() => setInspectedSource(null)} />

      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        reports={reportsHistory}
        activeReportId={activeReport?.id}
        onSelectReport={handleSelectReport}
        onDeleteReport={handleDeleteReport}
      />

      <PreferencesModal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        preferences={preferences}
        capabilities={capabilities}
        onSavePreferences={handleSavePreferences}
        themeMode={themeMode}
        onSelectThemeMode={handleSelectThemeMode}
        ambientEffects={ambientEffects}
        onToggleAmbientEffects={handleToggleAmbientEffects}
        reportsHistory={reportsHistory}
        onClearDrafts={handleClearSearch}
      />
      </div>
    </div>
  );
}
