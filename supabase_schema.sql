-- ============================================================================
-- ResearchMate AI — Supabase PostgreSQL Production Schema
-- Compatible with Supabase SQL Editor and automated database initialization
-- ============================================================================

-- 1. User Accounts (Multi-factor authentication: Gmail, Phone, Password)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    gmail TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    country_code TEXT NOT NULL DEFAULT '+1',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 2. User Profiles & Social Workspace Preferences
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    followers_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    private_account INTEGER NOT NULL DEFAULT 0,
    notify_research_complete INTEGER NOT NULL DEFAULT 1,
    notify_conflicts INTEGER NOT NULL DEFAULT 1,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- 3. Global User Preferences (Audience, Depth, Sources, Citation Style)
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_audience TEXT NOT NULL DEFAULT 'academic',
    default_depth TEXT NOT NULL DEFAULT 'standard',
    enabled_sources_json TEXT NOT NULL DEFAULT '["web","academic_paper","uploaded_pdf","knowledge_base"]',
    citation_style TEXT NOT NULL DEFAULT 'numbered',
    updated_at TEXT NOT NULL
);

-- Seed default preferences row
INSERT INTO user_preferences (id, default_audience, default_depth, enabled_sources_json, citation_style, updated_at)
VALUES (1, 'academic', 'standard', '["web","academic_paper","uploaded_pdf","knowledge_base"]', 'numbered', NOW()::TEXT)
ON CONFLICT (id) DO NOTHING;

-- 4. Autonomous Research Reports & 14-Section Syntheses
CREATE TABLE IF NOT EXISTS research_reports (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    title TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'academic',
    depth TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'completed',
    is_starred INTEGER NOT NULL DEFAULT 0,
    llm_mode TEXT NOT NULL DEFAULT 'extractive_fallback',
    source_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    plan_json TEXT NOT NULL,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_reports_created ON research_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reports_starred ON research_reports (is_starred);

-- 5. Grounded Follow-up AI Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    cited_source_ids_json TEXT NOT NULL DEFAULT '[]',
    interaction_id TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_report ON chat_messages (report_id, created_at ASC);

-- 6. Uploaded PDF Research Documents (PyMuPDF Extracted Content & Page Cache)
CREATE TABLE IF NOT EXISTS uploaded_pdfs (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    full_text TEXT NOT NULL,
    pages_json TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 7. Curated Knowledge Base Research Briefs
CREATE TABLE IF NOT EXISTS knowledge_base_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    author_or_publisher TEXT NOT NULL,
    publication_date TEXT NOT NULL,
    content TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 8. User Profile Research Notes & Published Posts
CREATE TABLE IF NOT EXISTS profile_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Research Note',
    gradient TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_posts_user ON profile_posts (user_id, created_at DESC);

-- 9. Universal Item Reactions (Likes & Bookmarks for Reports & Posts)
CREATE TABLE IF NOT EXISTS item_reactions (
    item_id TEXT PRIMARY KEY,
    likes_count INTEGER NOT NULL DEFAULT 0,
    is_liked INTEGER NOT NULL DEFAULT 0,
    is_saved INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- 10. Scheduled Research & Publications
CREATE TABLE IF NOT EXISTS scheduled_content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    category TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    gradient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_content_user ON scheduled_content (user_id, scheduled_for ASC);

-- 11. Problem Reports & Diagnostic Support Feedback
CREATE TABLE IF NOT EXISTS problem_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    screenshot_filename TEXT,
    screenshot_path TEXT,
    created_at TEXT NOT NULL
);

-- 12. Daily Research Activity Analytics (Minutes & Sessions Tracking)
CREATE TABLE IF NOT EXISTS activity_daily_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date TEXT NOT NULL,
    seconds_spent INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_usage_user ON activity_daily_usage (user_id, usage_date);

-- 13. Saved Multimedia & Image Gallery Bookmarks
CREATE TABLE IF NOT EXISTS saved_images (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_key TEXT NOT NULL,
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL DEFAULT '',
    source_page_url TEXT NOT NULL DEFAULT '',
    photographer_or_source TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (user_id, image_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_images_user ON saved_images (user_id);
