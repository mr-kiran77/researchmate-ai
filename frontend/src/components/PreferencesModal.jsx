import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Laptop,
  Moon,
  Palette,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';

export default function PreferencesModal({
  open,
  onClose,
  preferences,
  capabilities,
  onSavePreferences,
  themeMode = 'system',
  onSelectThemeMode,
  ambientEffects = true,
  onToggleAmbientEffects,
  reportsHistory = [],
  onClearDrafts,
}) {
  const [activeTab, setActiveTab] = useState('research'); // 'research' | 'appearance' | 'engine' | 'data'
  const [audience, setAudience] = useState(preferences?.default_audience || 'academic');
  const [depth, setDepth] = useState(preferences?.default_depth || 'standard');
  const [citationStyle, setCitationStyle] = useState(preferences?.citation_style || 'numbered');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Client-side API key overrides (stored safely in local storage)
  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('researchmate_custom_gemini_key') || '';
    } catch {
      return '';
    }
  });
  const [customOpenaiKey, setCustomOpenaiKey] = useState(() => {
    try {
      return localStorage.getItem('researchmate_custom_openai_key') || '';
    } catch {
      return '';
    }
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  useEffect(() => {
    if (open && preferences) {
      setAudience(preferences.default_audience || 'academic');
      setDepth(preferences.default_depth || 'standard');
      setCitationStyle(preferences.citation_style || 'numbered');
      setSaveSuccess(false);
    }
  }, [open, preferences]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save client-side keys
      try {
        if (customGeminiKey.trim()) {
          localStorage.setItem('researchmate_custom_gemini_key', customGeminiKey.trim());
        } else {
          localStorage.removeItem('researchmate_custom_gemini_key');
        }
        if (customOpenaiKey.trim()) {
          localStorage.setItem('researchmate_custom_openai_key', customOpenaiKey.trim());
        } else {
          localStorage.removeItem('researchmate_custom_openai_key');
        }
      } catch {
        // ignore
      }

      await onSavePreferences?.({
        ...preferences,
        default_audience: audience,
        default_depth: depth,
        citation_style: citationStyle,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const exportResearchJson = () => {
    try {
      const dataStr = JSON.stringify(reportsHistory, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ResearchMate_Archive_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full max-h-[620px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl ig-btn-primary text-white shadow-sm">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Workspace Preferences &amp; System Configuration
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tailor research logic, appearance modes, and AI synthesis engine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex border-b border-slate-100 px-6 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/30">
          {[
            { id: 'research', label: 'Research Logic', icon: SlidersHorizontal },
            { id: 'appearance', label: 'Theme & Display', icon: Palette },
            { id: 'engine', label: 'AI Engine & Keys', icon: KeyRound },
            { id: 'data', label: 'Data & Privacy', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                  isActive
                    ? 'border-pink-500 text-pink-700 dark:text-pink-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* TAB 1: RESEARCH LOGIC */}
          {activeTab === 'research' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                    Default Research Audience
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-pink-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="student">College Student (Intuitive &amp; Structured)</option>
                    <option value="academic">Academic Researcher (Formal &amp; Rigorous)</option>
                    <option value="developer">Project Developer (Technical &amp; Practical)</option>
                    <option value="educator">Teacher / Educator (Pedagogical)</option>
                    <option value="professional">Professional / Executive (Actionable)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Sets the default analytical tone, vocabulary, and executive depth for new prompts.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                    Default Investigation Depth
                  </label>
                  <select
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-pink-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="quick">Quick Scan (Rapid multi-source summary)</option>
                    <option value="standard">Standard (Comprehensive 14-section synthesis)</option>
                    <option value="deep">Deep Synthesis (Exhaustive cross-verification)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Controls sub-question expansion and multi-query concurrency.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  Citation &amp; Reference Formatting Style
                </label>
                <select
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-pink-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <option value="numbered">Numbered Clickable Citations ([S1], [S2])</option>
                  <option value="apa">APA-Style Academic Parenthetical Notes</option>
                  <option value="inline">Inline Source Badges with Hover Cards</option>
                </select>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Autonomous Verification Guardrail Active</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900/80 dark:text-emerald-300/80">
                  ResearchMate enforces a mandatory minimum 2-source corroboration rule. Uncorroborated single-source claims are automatically downgraded to provisional status in the Verification Ledger.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: THEME & DISPLAY */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block font-bold text-slate-700 dark:text-slate-300">
                  Appearance Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      id: 'light',
                      label: 'Light',
                      desc: 'Clean & high-contrast',
                      icon: Sun,
                      activeColor: 'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300',
                    },
                    {
                      id: 'dark',
                      label: 'Dark',
                      desc: 'Deep indigo & focused',
                      icon: Moon,
                      activeColor: 'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300',
                    },
                    {
                      id: 'system',
                      label: 'System Sync',
                      desc: 'Matches OS appearance',
                      icon: Laptop,
                      activeColor: 'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300',
                    },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = themeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSelectThemeMode?.(mode.id)}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition ${
                          isSelected
                            ? mode.activeColor + ' font-bold shadow-sm'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                        }`}
                      >
                        <Icon className="h-5 w-5 mb-1.5" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {mode.label}
                        </span>
                        <span className="mt-0.5 text-[10px] text-slate-400">
                          {mode.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ambient Background Effects Toggle */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-800/40 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Ambient Canvas Background Orbs
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Smooth, continuous GPU-accelerated gradient lighting and scientific dot mesh. Can be turned off for lower-power devices.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={ambientEffects}
                  onClick={() => onToggleAmbientEffects?.(!ambientEffects)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    ambientEffects ? 'bg-pink-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      ambientEffects ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Reduced Motion &amp; Accessibility
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  ResearchMate automatically honors your operating system&apos;s <code>prefers-reduced-motion</code> setting, gently disabling rapid animations while preserving clean visual transitions.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: AI ENGINE & KEYS */}
          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-800/40">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-[10px]">
                    Server-Side AI Provider Status
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Live Backend
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Active Synthesis Engine:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {capabilities?.active_llm_model || 'Extractive Fallback'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Google Gemini API:</span>
                    <span className={`font-bold ${capabilities?.gemini_configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {capabilities?.gemini_configured ? 'Configured in backend' : 'Not Set (using fallback)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">OpenAI API:</span>
                    <span className={`font-bold ${capabilities?.openai_configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {capabilities?.openai_configured ? 'Configured in backend' : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Tavily Web Search:</span>
                    <span className={`font-bold ${capabilities?.tavily_configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {capabilities?.tavily_configured ? 'Configured' : 'Optional (DuckDuckGo & OpenAlex active)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Academic Paper Repositories:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      OpenAlex &amp; arXiv Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Client-Side Key Override Inputs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Client-Side API Key Overrides (Optional)
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    If you prefer to supply your personal API keys directly from the browser, enter them here. Stored locally on this device only.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Custom Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={customGeminiKey}
                      onChange={(e) => setCustomGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 pr-9 text-xs font-mono text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showGeminiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Custom OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={customOpenaiKey}
                      onChange={(e) => setCustomOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 pr-9 text-xs font-mono text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showOpenaiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA & PRIVACY */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Export Complete Research Archive
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Download a structured JSON archive of all your saved research reports, synthesis logs, and verification matrices.
                </p>
                <button
                  type="button"
                  onClick={exportResearchJson}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-pink-600" />
                  <span>Download Archive JSON ({reportsHistory.length} Reports)</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Clear Drafts &amp; Cache
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Reset temporary research drafts and quick search query cache on this device without affecting your saved reports.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClearDrafts?.();
                    alert('Drafts and temporary query cache cleared.');
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Local Cache &amp; Drafts</span>
                </button>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-[11px] text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-blue-900 dark:text-blue-200">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Privacy &amp; Data Isolation Guarantee</span>
                </div>
                Your research queries, uploaded PDFs, and notes are processed through your own local SQLite database and direct API calls. No analytics or telemetry data is sent to external third-party tracking services.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/30">
          <span className="text-[11px] text-slate-400">
            {saveSuccess ? 'Preferences saved successfully!' : 'Changes apply immediately across workspace'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
