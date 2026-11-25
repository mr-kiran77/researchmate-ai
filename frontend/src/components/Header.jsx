import React from 'react';
import {
  BookOpen,
  Compass,
  FileText,
  History,
  Layers,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  User,
  Database,
} from 'lucide-react';

export default function Header({
  activeTab,
  onTabChange,
  hasActiveReport,
  pdfCount,
  kbCount,
  historyCount,
  capabilities,
  currentUser,
  theme = 'light',
  onToggleTheme,
  onLogout,
  onOpenHistory,
  onOpenPreferences,
}) {
  const navItems = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'research', label: 'New Research', icon: Compass },
    { id: 'report', label: 'Report Workspace', icon: FileText, disabled: !hasActiveReport },
    { id: 'pdfs', label: 'PDF Analyzer', icon: BookOpen, badge: pdfCount },
    { id: 'kb', label: 'Knowledge Base', icon: Database, badge: kbCount },
  ];

  const llmMode = capabilities?.active_llm_provider || 'extractive_fallback';
  const engineLabel =
    llmMode === 'gemini'
      ? 'Gemini AI Active'
      : llmMode === 'openai'
      ? 'OpenAI Active'
      : 'Extractive Mode';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 ig-glass">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <button
          onClick={() => onTabChange('profile')}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl ig-btn-primary shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                ResearchMate <span className="ig-text-gradient">AI</span>
              </span>
              <span className="hidden rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-pink-700 dark:text-pink-300 sm:inline-block">
                Agentic Workbench
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Research Smarter. Discover Faster. Make Better Decisions.
            </p>
          </div>
        </button>

        {/* Nav tabs */}
        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'ig-btn-primary shadow-sm'
                    : item.disabled
                    ? 'cursor-not-allowed text-slate-400'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div
            title={capabilities?.active_llm_model || 'AI Synthesizer status'}
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium lg:flex ${
              llmMode === 'extractive_fallback'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{engineLabel}</span>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Switch Appearance"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-pink-300"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-purple-700" />
              )}
            </button>
          )}

          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                {historyCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenPreferences}
            aria-label="Preferences"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Preferences</span>
          </button>

          {currentUser && (
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
              <button
                type="button"
                onClick={() => onTabChange('profile')}
                className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:opacity-80 md:inline-flex"
              >
                <span className="h-2 w-2 rounded-full ig-btn-primary" />
                <span>@{currentUser.username}</span>
              </button>
              <button
                onClick={onLogout}
                title="Log Out"
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
