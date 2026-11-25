import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bookmark,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Grid3X3,
  Heart,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api/client';

/** Formats active seconds into a human-friendly duration like "14m 20s" or "1h 12m". */
function formatDuration(totalSeconds = 0) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const rem = secs % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${rem}s`;
  return `${rem}s`;
}

/**
 * ProfilePage — Instagram-inspired User Profile powered 100% by real SQLite data.
 */
export default function ProfilePage({
  currentUser,
  theme = 'light',
  onToggleTheme,
  onLogout,
  onOpenResearch,
  onOpenReport,
  onOpenPdfs,
  onRunTopic,
  onUserProfileUpdated,
  onRefreshHistory,
  onRefreshSavedImages,
  controlledGridTab,
  onGridTabChange,
  externalModalSignal,
}) {
  const userId = currentUser?.id || 'guest-demo';
  const usernameHint = currentUser?.username || 'guest_researcher';

  // ---------------- Real Backend State ----------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profileData, setProfileData] = useState(null);

  // ---------------- Content Grid & Tabs ----------------
  const [internalGridTab, setInternalGridTab] = useState('posts'); // 'posts' | 'scheduled' | 'saved'
  const activeGridTab = controlledGridTab || internalGridTab;
  const setActiveGridTab = (nextTab) => {
    setInternalGridTab(nextTab);
    onGridTabChange?.(nextTab);
  };
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedSavedImage, setSelectedSavedImage] = useState(null);

  // ---------------- Hamburger Menu Drawer & Modals ----------------
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reportProblemOpen, setReportProblemOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Edit Profile draft form state
  const [draftProfile, setDraftProfile] = useState({
    username: usernameHint,
    full_name: '',
    bio: '',
    avatar_url: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');
  const avatarInputRef = useRef(null);
  const modalAvatarInputRef = useRef(null);

  // New Post modal state
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('Research Note');
  const [newPostError, setNewPostError] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);

  // Settings modal state
  const [settingsState, setSettingsState] = useState({
    private_account: false,
    notify_research_complete: true,
    notify_conflicts: true,
    two_factor_enabled: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Schedule Content modal state
  const [schedTitle, setSchedTitle] = useState('');
  const [schedCaption, setSchedCaption] = useState('');
  const [schedDate, setSchedDate] = useState('2026-12-01');
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedError, setSchedError] = useState('');
  const [savingSched, setSavingSched] = useState(false);

  // Report a Problem modal state
  const [problemText, setProblemText] = useState('');
  const [problemScreenshot, setProblemScreenshot] = useState(null);
  const [problemPreview, setProblemPreview] = useState('');
  const [problemError, setProblemError] = useState('');
  const [submittingProblem, setSubmittingProblem] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3400);
  };

  const fetchProfile = useCallback(async () => {
    setLoadError('');
    try {
      const data = await api.getProfile(userId, usernameHint);
      setProfileData(data);
      setSettingsState(data.settings);
      setDraftProfile({
        username: data.username,
        full_name: data.full_name,
        bio: data.bio,
        avatar_url: data.avatar_url || '',
      });
    } catch (err) {
      setLoadError(err.message || 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [userId, usernameHint]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Open specific modals when triggered from the global LeftSidebar
  useEffect(() => {
    if (!externalModalSignal?.type) return;
    setDrawerOpen(false);
    if (externalModalSignal.type === 'activity') {
      fetchProfile();
      setActivityOpen(true);
    } else if (externalModalSignal.type === 'schedule') {
      setScheduleOpen(true);
    } else if (externalModalSignal.type === 'settings') {
      setSettingsOpen(true);
    } else if (externalModalSignal.type === 'report_problem') {
      setReportProblemOpen(true);
    }
  }, [externalModalSignal?.nonce, externalModalSignal?.type, fetchProfile]);

  /** Uploads a circular profile image to SQLite (`user_profiles.avatar_url`) */
  const handleAvatarUpload = (file, target = 'profile') => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (target === 'draft') {
        setDraftProfile((prev) => ({ ...prev, avatar_url: dataUrl }));
      } else if (profileData) {
        try {
          const updated = await api.updateProfile(userId, {
            username: profileData.username,
            full_name: profileData.full_name,
            bio: profileData.bio,
            avatar_url: dataUrl,
          });
          setProfileData(updated);
          showToast('Profile photo saved.');
        } catch (err) {
          showToast(err.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const openEditProfile = () => {
    if (!profileData) return;
    setEditError('');
    setDraftProfile({
      username: profileData.username,
      full_name: profileData.full_name,
      bio: profileData.bio,
      avatar_url: profileData.avatar_url || '',
    });
    setEditModalOpen(true);
  };

  const saveEditProfile = async (e) => {
    e.preventDefault();
    const cleanedUsername = draftProfile.username.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-zA-Z0-9._]{3,24}$/.test(cleanedUsername)) {
      setEditError('Username must be 3–24 characters (letters, numbers, . or _).');
      return;
    }
    if (!draftProfile.full_name.trim()) {
      setEditError('Full name is required.');
      return;
    }
    setEditError('');
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile(userId, {
        username: cleanedUsername,
        full_name: draftProfile.full_name.trim(),
        bio: draftProfile.bio.trim(),
        avatar_url: draftProfile.avatar_url || '',
      });
      setProfileData(updated);
      onUserProfileUpdated?.({ username: updated.username });
      setEditModalOpen(false);
      showToast('Profile saved to database.');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (newPostTitle.trim().length < 2 || newPostCaption.trim().length < 4) {
      setNewPostError('Please enter a title and summary note.');
      return;
    }
    setNewPostError('');
    setCreatingPost(true);
    try {
      await api.createProfilePost(userId, {
        title: newPostTitle.trim(),
        caption: newPostCaption.trim(),
        category: newPostCategory.trim() || 'Research Note',
      });
      setNewPostTitle('');
      setNewPostCaption('');
      setNewPostOpen(false);
      await fetchProfile();
      showToast('Research note published to your profile.');
    } catch (err) {
      setNewPostError(err.message);
    } finally {
      setCreatingPost(false);
    }
  };

  const toggleSaveItem = async (item) => {
    try {
      const res = await api.toggleProfileItemSave(item.id, item.kind);
      setProfileData((prev) => {
        if (!prev) return prev;
        const nextPosts = prev.posts.map((p) => (p.id === item.id ? { ...p, saved: res.saved } : p));
        return {
          ...prev,
          posts: nextPosts,
          activity: {
            ...prev.activity,
            saved_count: nextPosts.filter((p) => p.saved).length,
          },
        };
      });
      if (selectedPost?.id === item.id) {
        setSelectedPost((prev) => (prev ? { ...prev, saved: res.saved } : null));
      }
      if (item.kind === 'report') {
        onRefreshHistory?.();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const toggleLikeItem = async (item) => {
    try {
      const res = await api.toggleProfileItemLike(item.id);
      setProfileData((prev) => {
        if (!prev) return prev;
        const nextPosts = prev.posts.map((p) =>
          p.id === item.id ? { ...p, liked: res.liked, likes: res.likes } : p
        );
        return {
          ...prev,
          posts: nextPosts,
          activity: {
            ...prev.activity,
            likes_given: nextPosts.filter((p) => p.liked).length,
          },
        };
      });
      if (selectedPost?.id === item.id) {
        setSelectedPost((prev) => (prev ? { ...prev, liked: res.liked, likes: res.likes } : null));
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const saved = await api.updateProfileSettings(userId, settingsState);
      setProfileData((prev) => (prev ? { ...prev, settings: saved } : prev));
      setSettingsOpen(false);
      showToast('Account settings saved.');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedDate || !schedTime) {
      setSchedError('Please enter a topic title, date, and time.');
      return;
    }
    setSchedError('');
    setSavingSched(true);
    try {
      await api.createScheduledPost(userId, {
        title: schedTitle.trim(),
        caption: schedCaption.trim() || 'Queued research topic ready to run.',
        category: 'Scheduled Research',
        scheduled_for: `${schedDate}T${schedTime}`,
      });
      setSchedTitle('');
      setSchedCaption('');
      setScheduleOpen(false);
      setActiveGridTab('scheduled');
      await fetchProfile();
      showToast(`Scheduled for ${schedDate} at ${schedTime}.`);
    } catch (err) {
      setSchedError(err.message);
    } finally {
      setSavingSched(false);
    }
  };

  const handleDeleteScheduled = async (schedId) => {
    try {
      await api.deleteScheduledPost(schedId);
      await fetchProfile();
      showToast('Scheduled item removed.');
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleProblemSubmit = async (e) => {
    e.preventDefault();
    if (problemText.trim().length < 10) {
      setProblemError('Please describe the issue (at least 10 characters).');
      return;
    }
    setProblemError('');
    setSubmittingProblem(true);
    try {
      await api.submitProblemReport(userId, problemText.trim(), problemScreenshot);
      setProblemText('');
      setProblemScreenshot(null);
      setProblemPreview('');
      setReportProblemOpen(false);
      await fetchProfile();
      showToast('Problem report saved to backend.');
    } catch (err) {
      setProblemError(err.message);
    } finally {
      setSubmittingProblem(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-24">
        <div className="flex items-center gap-3 rounded-2xl ig-glass px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-pink-600" />
          <span>Loading your real ResearchMate AI profile...</span>
        </div>
      </div>
    );
  }

  if (loadError || !profileData) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-800">
        <p className="font-bold">{loadError || 'Unable to load profile.'}</p>
        <button
          type="button"
          onClick={fetchProfile}
          className="mt-3 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const posts = profileData.posts || [];
  const scheduledPosts = profileData.scheduled || [];
  const savedPosts = posts.filter((p) => p.saved);
  const savedImages = profileData.saved_images || [];
  const totalSavedCount = savedPosts.length + savedImages.length;
  const activity = profileData.activity;

  const handleRemoveSavedImage = async (img) => {
    try {
      await api.deleteSavedImage(img.id);
      setProfileData((prev) => {
        if (!prev) return prev;
        const nextImgs = (prev.saved_images || []).filter((i) => i.id !== img.id);
        return {
          ...prev,
          saved_images: nextImgs,
          activity: {
            ...prev.activity,
            saved_count: (prev.posts || []).filter((p) => p.saved).length + nextImgs.length,
          },
        };
      });
      if (selectedSavedImage?.id === img.id) setSelectedSavedImage(null);
      onRefreshSavedImages?.();
      showToast('Removed image from Saved collection.');
    } catch (err) {
      showToast(err.message);
    }
  };
  const maxBarMinutes = Math.max(5, ...activity.daily_bars.map((b) => b.minutes));

  const avatarInitials = (profileData.full_name || profileData.username || 'R')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl pb-10">
      {/* Feedback Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl ig-btn-primary px-4 py-3 text-xs font-bold shadow-xl">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. PROFILE HEADER CARD (Real SQLite User Info + Stats + Hamburger)   */}
      {/* ==================================================================== */}
      <section className="ig-glass relative overflow-hidden rounded-3xl p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-indigo-500/15 px-3 py-1 text-xs font-bold text-pink-600 dark:text-pink-300">
              <Sparkles className="h-3.5 w-3.5" />
              @{profileData.username}
            </span>
            {settingsState.private_account && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenResearch && (
              <button
                type="button"
                onClick={onOpenResearch}
                className="hidden items-center gap-1.5 rounded-xl ig-btn-primary px-3.5 py-2 text-xs font-bold shadow-sm sm:inline-flex"
              >
                <Search className="h-3.5 w-3.5" />
                New Research
              </button>
            )}

            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-800 shadow-sm transition hover:scale-105 hover:border-pink-300 dark:bg-slate-800/80 dark:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="relative shrink-0">
            <div className="ig-avatar-ring h-28 w-28 rounded-full shadow-lg sm:h-32 sm:w-32">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-slate-100 dark:border-slate-900 dark:bg-slate-800">
                {profileData.avatar_url ? (
                  <img
                    src={profileData.avatar_url}
                    alt={profileData.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-600 text-2xl font-extrabold text-white sm:text-3xl">
                    {avatarInitials}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Change profile photo"
              aria-label="Change profile photo"
              className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white ig-btn-primary shadow-md dark:border-slate-900"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarUpload(e.target.files?.[0], 'profile')}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {profileData.full_name}
              </h1>
              <span className="text-sm font-semibold ig-text-gradient">@{profileData.username}</span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 sm:justify-start sm:gap-8">
              <div>
                <span className="block text-lg font-extrabold text-slate-900">
                  {profileData.posts_count}
                </span>
                <span className="text-xs font-medium text-slate-500">Posts</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />
              <div>
                <span className="block text-lg font-extrabold text-slate-900">
                  {profileData.followers_count.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500">Followers</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />
              <div>
                <span className="block text-lg font-extrabold text-slate-900">
                  {profileData.following_count.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500">Following</span>
              </div>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-700">{profileData.bio}</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <button
                type="button"
                onClick={openEditProfile}
                className="inline-flex items-center gap-2 rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold shadow-sm"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Profile
              </button>

              <button
                type="button"
                onClick={() => setNewPostOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-pink-300"
              >
                <Plus className="h-3.5 w-3.5 text-pink-600" />
                New Note Post
              </button>

              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-pink-300"
              >
                <CalendarClock className="h-3.5 w-3.5 text-purple-600" />
                Schedule Content
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. CONTENT TABS ("Posts", "Scheduled", "Saved") & 3-COLUMN GRID      */}
      {/* ==================================================================== */}
      <section className="mt-6">
        <div className="flex items-center justify-center gap-2 border-b border-slate-200 pb-0.5 sm:gap-6">
          {[
            { id: 'posts', label: `Posts (${posts.length})`, icon: Grid3X3 },
            { id: 'scheduled', label: `Scheduled (${scheduledPosts.length})`, icon: CalendarClock },
            { id: 'saved', label: `Saved (${totalSavedCount})`, icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeGridTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveGridTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition sm:text-sm ${
                  active ? 'ig-text-gradient' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-pink-600 dark:text-pink-400' : ''}`} />
                <span>{tab.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundImage: 'var(--ig-gradient)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* POSTS GRID */}
        {activeGridTab === 'posts' && (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {posts.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No research posts yet. Run a research topic, upload a PDF, or create a note post!
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenResearch}
                    className="rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold"
                  >
                    Start First Research
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPostOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  >
                    Create Note Post
                  </button>
                </div>
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-slate-200 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${post.gradient} p-5 text-white`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                        {post.category}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveItem(post);
                        }}
                        aria-label="Toggle bookmark"
                        className="rounded-full bg-black/25 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/45"
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${post.saved ? 'fill-white' : ''}`} />
                      </button>
                    </div>

                    <div>
                      <h3 className="line-clamp-2 font-serif text-lg font-bold leading-snug drop-shadow-sm">
                        {post.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/90">
                        {post.caption}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-white/90">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLikeItem(post);
                          }}
                          className="inline-flex items-center gap-1 transition hover:scale-110"
                        >
                          <Heart className={`h-3.5 w-3.5 ${post.liked ? 'fill-white' : ''}`} />
                          {post.likes}
                        </button>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {post.comments}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-85">{post.date_label}</span>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                    <span className="rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow">
                      {post.kind === 'report' ? 'Inspect Report' : post.kind === 'pdf' ? 'Inspect PDF' : 'View Post'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SCHEDULED GRID */}
        {activeGridTab === 'scheduled' && (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {scheduledPosts.map((item) => (
              <div
                key={item.id}
                className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`h-2 w-full rounded-full bg-gradient-to-r ${item.gradient}`} />
                <div className="mt-3 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-pink-600">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {item.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteScheduled(item.id)}
                      title="Delete scheduled item"
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-serif text-lg font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
                    {item.caption}
                  </p>
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-700">
                      {item.scheduled_for.replace('T', ' · ')}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      {item.status}
                    </span>
                  </div>
                  {onRunTopic && (
                    <button
                      type="button"
                      onClick={() => onRunTopic(item.title)}
                      className="w-full rounded-xl ig-btn-primary py-1.5 text-[11px] font-bold"
                    >
                      Run Research Now
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-6 text-slate-500 transition hover:border-pink-400 hover:text-pink-600"
            >
              <Plus className="h-8 w-8" />
              <span className="text-xs font-bold">Schedule New Content</span>
            </button>
          </div>
        )}

        {/* SAVED GRID */}
        {activeGridTab === 'saved' && (
          <div className="mt-5 space-y-6">
            {totalSavedCount === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No saved items yet. Click the bookmark icon on any topic image, research report, PDF, or post to save it here.
              </div>
            ) : (
              <>
                {savedImages.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                      Saved Topic Images ({savedImages.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {savedImages.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setSelectedSavedImage(img)}
                          className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                        >
                          <img
                            src={img.thumbnail_url || img.image_url}
                            alt={img.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                          <div className="absolute left-3 top-3 rounded-full bg-slate-950/65 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            {img.topic || 'Visual'}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSavedImage(img);
                            }}
                            title="Remove saved image"
                            className="absolute right-3 top-3 rounded-full bg-slate-950/65 p-1.5 text-white transition hover:bg-rose-600"
                          >
                            <Bookmark className="h-3.5 w-3.5 fill-white" />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                            <p className="truncate font-serif text-sm font-bold">{img.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-200">
                              {img.photographer_or_source || img.caption}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {savedPosts.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                      Saved Research Items ({savedPosts.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {savedPosts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-slate-200 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                        >
                          <div
                            className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${post.gradient} p-5 text-white`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                Saved · {post.category}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSaveItem(post);
                                }}
                                className="rounded-full bg-black/25 p-1.5 text-white hover:bg-black/45"
                              >
                                <Bookmark className="h-3.5 w-3.5 fill-white" />
                              </button>
                            </div>
                            <div>
                              <h3 className="line-clamp-2 font-serif text-lg font-bold">{post.title}</h3>
                              <p className="mt-1.5 line-clamp-3 text-xs text-white/90">{post.caption}</p>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1">
                                  <Heart className={`h-3.5 w-3.5 ${post.liked ? 'fill-white' : ''}`} /> {post.likes}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MessageCircle className="h-3.5 w-3.5" /> {post.comments}
                                </span>
                              </div>
                              <span className="text-[11px] opacity-85">{post.date_label}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 3. INSTAGRAM-STYLE SLIDE-OUT MENU DRAWER                             */}
      {/* ==================================================================== */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[2px]"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="ig-glass flex h-full w-full max-w-sm flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Profile Menu</h3>
                <p className="text-[11px] text-slate-500">@{profileData.username}</p>
              </div>
              <button
                type="button"
                aria-label="Close profile menu"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto p-4">
              {/* 1. Settings */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Settings className="h-4 w-4" />
                </span>
                <div>
                  <div>Settings</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    Privacy, notifications &amp; security
                  </div>
                </div>
              </button>

              {/* 2. Your Activity */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  fetchProfile();
                  setActivityOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <div>Your Activity</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {formatDuration(activity.seconds_today)} today · {activity.likes_given} likes · {activity.comments_posted} chats
                  </div>
                </div>
              </button>

              {/* 3. Saved */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setActiveGridTab('saved');
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Bookmark className="h-4 w-4" />
                </span>
                <div>
                  <div>Saved</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {totalSavedCount} saved items
                  </div>
                </div>
              </button>

              {/* 4. Switch Appearance */}
              <div className="flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </span>
                  <div>
                    <div>Switch Appearance</div>
                    <div className="text-[11px] font-normal text-slate-500">
                      {theme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label="Switch Appearance between Light Mode and Dark Mode"
                  onClick={onToggleTheme}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                    theme === 'dark' ? 'bg-pink-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-300 ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  >
                    {theme === 'dark' ? (
                      <Moon className="h-3 w-3 text-purple-700" />
                    ) : (
                      <Sun className="h-3 w-3 text-amber-500" />
                    )}
                  </span>
                </button>
              </div>

              {/* 5. Schedule Content */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setScheduleOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <div>Schedule Content</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {scheduledPosts.length} queued topic(s)
                  </div>
                </div>
              </button>

              {/* 6. Report a Problem */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setReportProblemOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div>
                  <div>Report a Problem</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {profileData.problem_reports_count} submitted report(s)
                  </div>
                </div>
              </button>
            </div>

            {/* 7. Log Out */}
            <div className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL A: EDIT PROFILE                                                */}
      {/* ==================================================================== */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEditProfile}
            className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-slate-900">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="ig-avatar-ring h-16 w-16 rounded-full">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100">
                  {draftProfile.avatar_url ? (
                    <img src={draftProfile.avatar_url} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-pink-500 to-indigo-600 font-bold text-white">
                      {avatarInitials}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => modalAvatarInputRef.current?.click()}
                  className="rounded-xl ig-btn-primary px-3 py-1.5 text-xs font-bold"
                >
                  Change Photo
                </button>
                <input
                  ref={modalAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0], 'draft')}
                />
                {draftProfile.avatar_url && (
                  <button
                    type="button"
                    onClick={() => setDraftProfile((p) => ({ ...p, avatar_url: '' }))}
                    className="ml-2 text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Full Name</label>
              <input
                value={draftProfile.full_name}
                onChange={(e) => setDraftProfile((p) => ({ ...p, full_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Username</label>
              <input
                value={draftProfile.username}
                onChange={(e) => setDraftProfile((p) => ({ ...p, username: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Bio</label>
              <textarea
                rows={3}
                value={draftProfile.bio}
                onChange={(e) => setDraftProfile((p) => ({ ...p, bio: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            {editError && <p className="text-xs font-semibold text-rose-600">{editError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold disabled:opacity-60"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL A2: CREATE NEW RESEARCH NOTE POST                              */}
      {/* ==================================================================== */}
      {newPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreatePost}
            className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-slate-900">Publish Research Note</h3>
              <button type="button" onClick={() => setNewPostOpen(false)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Title</label>
              <input
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="e.g., Key Takeaway on AI Grading Accuracy"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Category</label>
              <input
                value={newPostCategory}
                onChange={(e) => setNewPostCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Summary / Caption</label>
              <textarea
                rows={3}
                value={newPostCaption}
                onChange={(e) => setNewPostCaption(e.target.value)}
                placeholder="Share a verified finding or summary note..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>
            {newPostError && <p className="text-xs font-semibold text-rose-600">{newPostError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPostOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingPost}
                className="rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold disabled:opacity-60"
              >
                {creatingPost ? 'Publishing...' : 'Publish Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL B: SETTINGS                                                    */}
      {/* ==================================================================== */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-pink-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">Account Settings</h3>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  key: 'private_account',
                  icon: Lock,
                  title: 'Private Account',
                  desc: 'Only approved followers can see your research posts.',
                },
                {
                  key: 'notify_research_complete',
                  icon: Bell,
                  title: 'Research Report Notifications',
                  desc: 'Notify when multi-source synthesis finishes.',
                },
                {
                  key: 'notify_conflicts',
                  icon: AlertTriangle,
                  title: 'Conflict Detection Alerts',
                  desc: 'Alert immediately when sources contradict.',
                },
                {
                  key: 'two_factor_enabled',
                  icon: Shield,
                  title: 'Two-Factor Authentication (2FA)',
                  desc: 'Extra verification step on unrecognized devices.',
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const enabled = settingsState[opt.key];
                return (
                  <div
                    key={opt.key}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-3"
                  >
                    <div className="flex items-start gap-2.5 pr-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pink-600" />
                      <div>
                        <div className="font-bold text-slate-900">{opt.title}</div>
                        <div className="text-[11px] text-slate-500">{opt.desc}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsState((s) => ({ ...s, [opt.key]: !s[opt.key] }))}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        enabled ? 'bg-pink-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={savingSettings}
                onClick={saveSettings}
                className="inline-flex items-center gap-1.5 rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL C: YOUR ACTIVITY                                               */}
      {/* ==================================================================== */}
      {activityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-pink-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">Your Activity</h3>
              </div>
              <button onClick={() => setActivityOpen(false)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <Clock className="mx-auto h-4 w-4 text-purple-600" />
                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {formatDuration(activity.seconds_today)}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Time Today</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <Heart className="mx-auto h-4 w-4 text-pink-600" />
                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {activity.likes_given}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Likes Given</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <MessageCircle className="mx-auto h-4 w-4 text-orange-500" />
                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {activity.comments_posted}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">AI Chats</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-2.5">
                <span className="font-extrabold text-slate-900">{activity.reports_count}</span>{' '}
                <span className="text-slate-500">Research Reports</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-2.5">
                <span className="font-extrabold text-slate-900">{activity.pdfs_count}</span>{' '}
                <span className="text-slate-500">PDFs Analyzed</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Real 7-Day App Usage</span>
                <span className="font-semibold ig-text-gradient">
                  Avg {activity.weekly_avg_minutes}m / day
                </span>
              </div>
              <div className="flex h-28 items-end justify-between gap-2">
                {activity.daily_bars.map((bar) => {
                  const pct = bar.minutes > 0 ? Math.max(12, Math.round((bar.minutes / maxBarMinutes) * 100)) : 4;
                  return (
                    <div
                      key={bar.date}
                      title={`${bar.date}: ${bar.minutes}m active, ${bar.actions} action(s)`}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t-lg transition-all"
                        style={{
                          height: `${pct}%`,
                          backgroundImage: bar.minutes > 0 ? 'var(--ig-gradient)' : undefined,
                          backgroundColor: bar.minutes === 0 ? 'rgba(148,163,184,0.3)' : undefined,
                        }}
                      />
                      <span className="text-[10px] font-semibold text-slate-500">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL D: SCHEDULE CONTENT                                            */}
      {/* ==================================================================== */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleScheduleSubmit}
            className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-pink-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">Schedule Content</h3>
              </div>
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Research Topic / Post Title</label>
              <input
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                placeholder="e.g., Quantum Computing Error Correction 2026"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Notes / Caption</label>
              <textarea
                rows={3}
                value={schedCaption}
                onChange={(e) => setSchedCaption(e.target.value)}
                placeholder="Sub-questions or key angle to cover..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Publish Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-pink-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Publish Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>

            {schedError && <p className="text-xs font-semibold text-rose-600">{schedError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSched}
                className="rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold disabled:opacity-60"
              >
                {savingSched ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL E: REPORT A PROBLEM                                            */}
      {/* ==================================================================== */}
      {reportProblemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleProblemSubmit}
            className="ig-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">Report a Problem</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportProblemOpen(false)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                Describe what went wrong
              </label>
              <textarea
                rows={4}
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                placeholder="Tell us what happened and what you expected..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                Attach Screenshot (Optional)
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-3 text-xs font-semibold text-slate-600 transition hover:border-pink-400">
                <Upload className="h-4 w-4 text-pink-600" />
                <span>{problemScreenshot ? problemScreenshot.name : 'Upload PNG or JPG screenshot'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setProblemScreenshot(file);
                    const reader = new FileReader();
                    reader.onload = () => setProblemPreview(String(reader.result || ''));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {problemPreview && (
                <img
                  src={problemPreview}
                  alt="Screenshot preview"
                  className="mt-2 max-h-32 w-full rounded-xl border border-slate-200 object-cover"
                />
              )}
            </div>

            {problemError && <p className="text-xs font-semibold text-rose-600">{problemError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportProblemOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingProblem}
                className="inline-flex items-center gap-1.5 rounded-xl ig-btn-primary px-5 py-2 text-xs font-bold disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {submittingProblem ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL F: POST / REPORT / PDF DETAIL LIGHTBOX                         */}
      {/* ==================================================================== */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPost(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ig-glass w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className={`bg-gradient-to-br ${selectedPost.gradient} p-6 text-white`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold uppercase">
                  {selectedPost.category}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="rounded-full bg-black/25 p-1.5 hover:bg-black/45"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-bold">{selectedPost.title}</h3>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm leading-relaxed text-slate-700">{selectedPost.caption}</p>

              {selectedPost.kind === 'report' && onOpenReport && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedPost.id;
                    setSelectedPost(null);
                    onOpenReport(id);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Full 14-Section Report
                </button>
              )}
              {selectedPost.kind === 'pdf' && onOpenPdfs && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPost(null);
                    onOpenPdfs();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open in PDF Analyzer
                </button>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => toggleLikeItem(selectedPost)}
                    className="inline-flex items-center gap-1.5 font-bold text-pink-600"
                  >
                    <Heart className={`h-4 w-4 ${selectedPost.liked ? 'fill-pink-600' : ''}`} />
                    {selectedPost.likes} Likes
                  </button>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                    <MessageCircle className="h-4 w-4" />
                    {selectedPost.comments} Comments
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSaveItem(selectedPost)}
                  className="inline-flex items-center gap-1.5 font-bold text-slate-800"
                >
                  <Bookmark
                    className={`h-4 w-4 ${selectedPost.saved ? 'fill-pink-600 text-pink-600' : ''}`}
                  />
                  {selectedPost.saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL F2: SAVED IMAGE LIGHTBOX                                      */}
      {selectedSavedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          onClick={() => setSelectedSavedImage(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ig-glass w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div className="min-w-0 pr-4">
                <p className="text-[11px] font-bold uppercase tracking-wider ig-text-gradient">
                  Saved Visual · {selectedSavedImage.topic || 'Topic'}
                </p>
                <h3 className="truncate font-serif text-lg font-bold text-slate-900">
                  {selectedSavedImage.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSavedImage(null)}
                className="rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-950 p-4">
              <img
                src={selectedSavedImage.image_url}
                alt={selectedSavedImage.title}
                className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-800">{selectedSavedImage.caption}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedSavedImage.photographer_or_source}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onRunTopic && selectedSavedImage.topic && (
                  <button
                    type="button"
                    onClick={() => {
                      const topic = selectedSavedImage.topic;
                      setSelectedSavedImage(null);
                      onRunTopic(topic);
                    }}
                    className="rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold"
                  >
                    Explore Topic
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveSavedImage(selectedSavedImage)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700"
                >
                  Remove Saved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
