import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bookmark,
  BookOpen,
  CalendarClock,
  Compass,
  Database,
  FileText,
  History,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react';

/**
 * LeftSidebar — Fixed vertical navigation sidebar replacing the horizontal top bar.
 *
 * Organized into three logical sections:
 * 1. Top: Brand logo, app name, AI engine status, and active @username.
 * 2. Middle (Main Features): Profile, New Research, Report Workspace, PDF Analyzer,
 *    Knowledge Base, Saved, Your Activity, Schedule Content, and History.
 * 3. Bottom (Utility & System): Switch Appearance (Light/Dark toggle), Research Preferences,
 *    Settings, Report a Problem, and Log Out.
 *
 * Responsive behavior:
 * - Desktop (`lg+`): Full 256px sidebar with icons and text labels.
 * - Tablet (`md` to `lg`): Compact 80px icon-only vertical rail with tooltips.
 * - Mobile (`< md`): Compact top bar + slide-over drawer + fixed bottom quick-nav bar.
 */
export default function LeftSidebar({
  activeTab,
  profileGridTab,
  onSelectTab,
  onOpenSaved,
  onOpenActivity,
  onOpenSchedule,
  onOpenSettings,
  onOpenPreferences,
  onOpenProblemReport,
  onOpenHistory,
  hasActiveReport,
  pdfCount,
  kbCount,
  historyCount,
  capabilities,
  currentUser,
  theme = 'light',
  themeMode = 'system',
  onToggleTheme,
  onLogout,
  reportsHistory = [],
  activeReportId = null,
  onSelectReport,
  onDeleteReport,
  onNewResearch,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const llmMode = capabilities?.active_llm_provider || 'extractive_fallback';
  const engineLabel =
    llmMode === 'gemini'
      ? 'Gemini AI'
      : llmMode === 'openai'
      ? 'OpenAI'
      : 'Extractive';

  // Middle section navigation items
  const mainItems = [
    {
      id: 'research',
      label: 'New Research',
      icon: Compass,
      active: activeTab === 'research',
      onClick: () => onSelectTab('research'),
    },
    {
      id: 'report',
      label: 'Report Workspace',
      icon: FileText,
      active: activeTab === 'report',
      disabled: !hasActiveReport,
      onClick: () => onSelectTab('report'),
    },
    {
      id: 'pdfs',
      label: 'PDF Analyzer',
      icon: BookOpen,
      badge: pdfCount,
      active: activeTab === 'pdfs',
      onClick: () => onSelectTab('pdfs'),
    },
    {
      id: 'kb',
      label: 'Knowledge Base',
      icon: Database,
      badge: kbCount,
      active: activeTab === 'kb',
      onClick: () => onSelectTab('kb'),
    },
    {
      id: 'saved',
      label: 'Saved',
      icon: Bookmark,
      active: activeTab === 'profile' && profileGridTab === 'saved',
      onClick: onOpenSaved,
    },
    {
      id: 'activity',
      label: 'Your Activity',
      icon: Activity,
      active: false,
      onClick: onOpenActivity,
    },
    {
      id: 'schedule',
      label: 'Schedule Content',
      icon: CalendarClock,
      active: activeTab === 'profile' && profileGridTab === 'scheduled',
      onClick: onOpenSchedule,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      badge: historyCount,
      active: false,
      onClick: onOpenHistory,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      active: activeTab === 'profile' && profileGridTab === 'posts',
      onClick: () => onSelectTab('profile'),
    },
  ];

  const handleAction = (fn) => {
    setMobileMenuOpen(false);
    fn?.();
  };

  /** Renders shared sidebar body for Desktop, Tablet rail, and Mobile drawer */
  const renderSidebarContent = (isMobileDrawer = false) => (
    <div className="flex h-full flex-col justify-between">
      {/* ================================================================ */}
      {/* TOP SECTION: App Logo, Brand Name & Engine Pill                  */}
      {/* ================================================================ */}
      <div className="px-3 pt-5 pb-3 lg:px-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleAction(() => onSelectTab('profile'))}
            className="group flex items-center gap-3 text-left focus:outline-none md:justify-center lg:justify-start"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ig-btn-primary shadow-md transition-transform duration-200 group-hover:scale-105">
              <Layers className="h-5 w-5" />
            </div>
            <div className={`${isMobileDrawer ? 'block' : 'md:hidden lg:block'}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  ResearchMate <span className="ig-text-gradient">AI</span>
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  {engineLabel}
                </span>
              </div>
            </div>
          </button>

          {isMobileDrawer && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl p-1.5 text-slate-500 hover:bg-white/50"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Active User Pill (Desktop & Mobile Drawer) */}
        {currentUser && (
          <button
            type="button"
            onClick={() => handleAction(() => onSelectTab('profile'))}
            className={`mt-3 w-full items-center gap-2 rounded-xl border border-pink-200/60 bg-white/60 px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-sm transition hover:border-pink-400 dark:border-white/10 dark:bg-white/5 ${
              isMobileDrawer ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full ig-btn-primary" />
            <span className="truncate">@{currentUser.username}</span>
          </button>
        )}

        {/* Prominent "+ New Research" Action Button (ChatGPT-Style) */}
        <button
          type="button"
          onClick={() => handleAction(onNewResearch)}
          className="group mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl ig-btn-primary px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-pink-500/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] md:justify-center lg:justify-center"
          title="Start a new research conversation"
        >
          <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:rotate-90" />
          <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
            New Research
          </span>
        </button>
      </div>

      {/* ================================================================ */}
      {/* MIDDLE SECTION: Main Features Navigation                         */}
      {/* ================================================================ */}
      <nav aria-label="Primary sidebar navigation" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-2 lg:px-3">
        <div
          className={`px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
            isMobileDrawer ? 'block' : 'md:hidden lg:block'
          }`}
        >
          Workspace
        </div>

        {mainItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              title={item.disabled ? 'Run or open a report first' : item.label}
              onClick={() => handleAction(item.onClick)}
              className={`group relative flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 md:justify-center lg:justify-between ${
                item.active
                  ? 'ig-btn-primary font-bold shadow-md shadow-pink-500/20'
                  : item.disabled
                  ? 'cursor-not-allowed text-slate-400 opacity-55'
                  : 'text-slate-700 hover:bg-white/65 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    item.active
                      ? 'text-white'
                      : 'text-slate-600 group-hover:scale-110 group-hover:text-pink-600 dark:text-slate-300 dark:group-hover:text-pink-400'
                  }`}
                />
                <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
                  {item.label}
                </span>
              </span>

              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isMobileDrawer ? 'inline-block' : 'md:hidden lg:inline-block'
                  } ${
                    item.active
                      ? 'bg-white/25 text-white'
                      : 'bg-pink-500/10 text-pink-700 dark:bg-white/15 dark:text-pink-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Recent Research History (ChatGPT-Style Multi-Chat Sessions) */}
        <div className="pt-3">
          <div
            className={`flex items-center justify-between px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
              isMobileDrawer ? 'flex' : 'md:hidden lg:flex'
            }`}
          >
            <span>Recent Research</span>
            {reportsHistory.length > 0 && (
              <span className="text-[10px] font-normal text-slate-400">
                {reportsHistory.length}
              </span>
            )}
          </div>

          {reportsHistory.length === 0 ? (
            <div
              className={`px-3 py-2 text-[11px] text-slate-400 ${
                isMobileDrawer ? 'block' : 'md:hidden lg:block'
              }`}
            >
              No past research yet
            </div>
          ) : (
            <div className="space-y-1">
              {reportsHistory.slice(0, 10).map((rep) => {
                const isActive = activeReportId === rep.id;
                return (
                  <div
                    key={rep.id}
                    className={`group relative flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                      isActive
                        ? 'border-l-2 border-pink-500 bg-pink-500/15 font-bold text-pink-900 dark:bg-pink-500/20 dark:text-pink-200'
                        : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleAction(() => onSelectReport?.(rep.id))}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={rep.title || rep.question}
                    >
                      <MessageSquare
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'
                        }`}
                      />
                      <span className={`truncate text-xs ${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
                        {rep.title || rep.question}
                      </span>
                    </button>

                    {onDeleteReport && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReport(rep.id);
                        }}
                        className={`rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40 ${
                          isMobileDrawer ? 'inline-block opacity-75' : 'md:hidden lg:inline-block'
                        }`}
                        title="Delete research"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* ================================================================ */}
      {/* BOTTOM SECTION: Utility & System Controls                        */}
      {/* ================================================================ */}
      <div className="border-t border-pink-200/40 px-2.5 py-3 space-y-1 dark:border-white/10 lg:px-3">
        <div
          className={`px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
            isMobileDrawer ? 'block' : 'md:hidden lg:block'
          }`}
        >
          System
        </div>

        {/* Switch Appearance (Light / Dark Mode Toggle) */}
        <button
          type="button"
          role="switch"
          aria-checked={theme === 'dark'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={onToggleTheme}
          className="group flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/65 dark:text-slate-200 dark:hover:bg-white/10 md:justify-center lg:justify-between"
        >
          <span className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-amber-400 transition-transform duration-200 group-hover:scale-110" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-purple-600 transition-transform duration-200 group-hover:scale-110" />
            )}
            <span className={`flex items-center gap-1.5 ${isMobileDrawer ? 'inline-flex' : 'md:hidden lg:inline-flex'}`}>
              <span>Switch Appearance</span>
              {themeMode === 'system' && (
                <span className="rounded-md bg-pink-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pink-700 dark:bg-white/10 dark:text-pink-300">
                  Auto
                </span>
              )}
            </span>
          </span>

          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              isMobileDrawer ? 'inline-block' : 'md:hidden lg:inline-block'
            } ${theme === 'dark' ? 'bg-pink-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        {/* Research Preferences */}
        <button
          type="button"
          title="Research Preferences"
          onClick={() => handleAction(onOpenPreferences)}
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/65 dark:text-slate-200 dark:hover:bg-white/10 md:justify-center lg:justify-start"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 group-hover:scale-110 group-hover:text-pink-600 dark:text-slate-300" />
          <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
            Preferences
          </span>
        </button>

        {/* Account Settings */}
        <button
          type="button"
          title="Account Settings"
          onClick={() => handleAction(onOpenSettings)}
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/65 dark:text-slate-200 dark:hover:bg-white/10 md:justify-center lg:justify-start"
        >
          <Settings className="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 group-hover:scale-110 group-hover:text-pink-600 dark:text-slate-300" />
          <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
            Settings
          </span>
        </button>

        {/* Report a Problem */}
        <button
          type="button"
          title="Report a Problem"
          onClick={() => handleAction(onOpenProblemReport)}
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/65 dark:text-slate-200 dark:hover:bg-white/10 md:justify-center lg:justify-start"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 transition-transform duration-200 group-hover:scale-110" />
          <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
            Report a Problem
          </span>
        </button>

        {/* Log Out */}
        <button
          type="button"
          title="Log Out"
          onClick={() => handleAction(onLogout)}
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-300 md:justify-center lg:justify-start"
        >
          <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          <span className={`${isMobileDrawer ? 'inline' : 'md:hidden lg:inline'}`}>
            Log Out
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Fixed Left Sidebar (`md` icon rail -> `lg` full sidebar) */}
      <aside
        aria-label="Sidebar Navigation"
        className="ig-sidebar-surface fixed inset-y-0 left-0 z-30 hidden md:block md:w-20 lg:w-64"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Top Mini-Header (`< md`) */}
      <header className="ig-sidebar-surface sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ig-btn-primary shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="text-sm font-extrabold text-slate-900">
              ResearchMate <span className="ig-text-gradient">AI</span>
            </span>
            {currentUser && (
              <div className="text-[11px] font-medium text-slate-500">@{currentUser.username}</div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Switch Appearance"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/70 dark:border-white/15 dark:bg-white/10"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-purple-600" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/70 dark:border-white/15 dark:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Full Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="ig-sidebar-surface h-full w-72 shadow-2xl"
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Mobile Bottom Quick-Navigation Bar (`< md`) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="ig-sidebar-surface fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-pink-200/40 px-2 py-1.5 md:hidden dark:border-white/10"
      >
        {[
          { id: 'research', label: 'Research', icon: Compass, active: activeTab === 'research', onClick: () => onSelectTab('research') },
          { id: 'pdfs', label: 'PDFs', icon: BookOpen, active: activeTab === 'pdfs', onClick: () => onSelectTab('pdfs') },
          { id: 'saved', label: 'Saved', icon: Bookmark, active: activeTab === 'profile' && profileGridTab === 'saved', onClick: onOpenSaved },
          { id: 'profile', label: 'Profile', icon: User, active: activeTab === 'profile' && profileGridTab === 'posts', onClick: () => onSelectTab('profile') },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-bold transition ${
                item.active ? 'ig-btn-primary shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
