"""Persistence layer for ResearchMate AI supporting both Supabase PostgreSQL and local SQLite."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

from app.config import get_settings
from app.schemas import (
    ActivityDailyBar,
    AuthUserResponse,
    ChatMessageModel,
    KnowledgeBaseCreate,
    KnowledgeBaseDoc,
    PdfAnalysisData,
    PdfDocumentResponse,
    ProblemReportResponse,
    ProfileActivityData,
    ProfileFeedItem,
    ProfileOverviewResponse,
    ProfilePostCreate,
    ProfileSettingsModel,
    ProfileUpdateRequest,
    ReportListItem,
    ResearchReport,
    SavedImageItem,
    SavedImageToggleRequest,
    ScheduledPostCreate,
    ScheduledPostItem,
    UserPreferences,
)

logger = logging.getLogger("researchmate.db")


def _convert_placeholders_to_pg(query: str) -> str:
    """Convert unquoted SQLite '?' placeholders to PostgreSQL '%s'."""
    in_single = False
    in_double = False
    out = []
    for ch in query:
        if ch == "'" and not in_double:
            in_single = not in_single
            out.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            out.append(ch)
        elif ch == '?' and not in_single and not in_double:
            out.append('%s')
        else:
            out.append(ch)
    return "".join(out)


class PGCursorWrapper:
    """Wraps a psycopg cursor for compatibility with sqlite3 row access."""

    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()

    def fetchmany(self, size: Optional[int] = None) -> list[Any]:
        return self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def __iter__(self) -> Iterator[Any]:
        return iter(self._cursor)


class PGConnectionWrapper:
    """Wraps psycopg connection to execute queries with SQLite-compatible method signatures."""

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def execute(self, query: str, params: tuple | list | None = None) -> PGCursorWrapper:
        converted = _convert_placeholders_to_pg(query)
        if params is not None:
            cur = self._conn.execute(converted, params)
        else:
            cur = self._conn.execute(converted)
        return PGCursorWrapper(cur)

    def executemany(self, query: str, seq_of_params: list | tuple) -> PGCursorWrapper:
        converted = _convert_placeholders_to_pg(query)
        cur = self._conn.cursor()
        cur.executemany(converted, seq_of_params)
        return PGCursorWrapper(cur)

    def executescript(self, script: str) -> None:
        cur = self._conn.cursor()
        for statement in script.split(";"):
            stmt = statement.strip()
            if stmt:
                cur.execute(stmt)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dirs() -> Path:
    settings = get_settings()
    db_path = settings.resolved_database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    settings.resolved_upload_dir.mkdir(parents=True, exist_ok=True)
    return db_path


@contextmanager
def get_conn() -> Iterator[Any]:
    """Yield a database connection (Supabase PostgreSQL when DATABASE_URL is set, otherwise SQLite)."""
    settings = get_settings()
    if settings.is_postgres:
        if not psycopg or not dict_row:
            raise RuntimeError(
                "DATABASE_URL is set for Supabase PostgreSQL, but 'psycopg' is not installed. "
                "Install with 'pip install psycopg[binary]'."
            )
        conn_str = settings.database_url.strip()
        if conn_str.startswith("postgres://"):
            conn_str = "postgresql://" + conn_str[len("postgres://"):]
        raw_conn = psycopg.connect(conn_str, row_factory=dict_row)
        wrapper = PGConnectionWrapper(raw_conn)
        try:
            yield wrapper
            wrapper.commit()
        except Exception:
            wrapper.rollback()
            raise
        finally:
            wrapper.close()
    else:
        db_path = _ensure_dirs()
        conn = sqlite3.connect(str(db_path), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            yield conn
            conn.commit()
        finally:
            conn.close()


SEED_KB_DOCS = [
    {
        "id": "kb-ai-edu-2025",
        "title": "AI in Higher Education: Empirical Synthesis of Learning Gains and Academic Integrity Risks",
        "category": "Education Technology",
        "author_or_publisher": "ResearchMate Curated Synthesis Brief",
        "publication_date": "2025-09-15",
        "tags": ["artificial intelligence", "education", "tutoring", "academic integrity", "pedagogy"],
        "content": (
            "Empirical classroom trials between 2023 and 2025 show that adaptive AI tutoring systems improve "
            "formative problem-solving speed and personalized scaffolding, especially in STEM and introductory writing "
            "courses, when paired with structured instructor oversight. Controlled studies in Harvard and university "
            "introductory physics settings reported substantially higher learning gains per hour with scaffolded AI "
            "tutors compared to static active-learning handouts. However, multi-institution surveys also document "
            "significant risks: unguided generative AI usage correlates with skill atrophy ('cognitive offloading'), "
            "higher rates of fabricated citations (hallucinations), uneven access across socioeconomic groups, and "
            "unreliable AI-detection tools that produce false positives against non-native English writers. "
            "Educators emphasize assessment redesign—oral defenses, process portfolios, and scaffolded critique—rather "
            "than purely punitive detection."
        ),
    },
    {
        "id": "kb-energy-storage-2025",
        "title": "Solid-State vs. Lithium-Ion Batteries: Commercial Readiness and Cost Curves (2024–2026)",
        "category": "Energy & Materials",
        "author_or_publisher": "ResearchMate Energy Briefing",
        "publication_date": "2025-11-10",
        "tags": ["batteries", "solid-state", "lithium-ion", "ev", "energy storage"],
        "content": (
            "Conventional lithium-ion chemistries (NMC and LFP) continue to dominate EV manufacturing due to "
            "mature gigafactory supply chains and rapidly falling pack prices below $100–$115/kWh at volume. "
            "Solid-state batteries replace flammable liquid electrolytes with ceramic, sulfide, or polymer solids, "
            "offering higher theoretical energy density (350–500 Wh/kg) and improved thermal stability. However, "
            "independent manufacturing analyses highlight persistent bottlenecks: dendrite propagation at high charge "
            "rates, interfacial resistance between solid electrodes, cold-weather conductivity drops, and fabrication "
            "costs 3x–5x higher than LFP cells. Semi-solid (gel/hybrid) cells are entering niche premium vehicles first, "
            "while true mass-market all-solid-state automotive parity remains contested between optimistic OEM timelines "
            "(2027–2028) and conservative supply-chain forecasts (2030+)."
        ),
    },
    {
        "id": "kb-glp1-outcomes-2025",
        "title": "GLP-1 Receptor Agonists Beyond Glycemic Control: Cardiovascular, Renal, and Discontinuation Evidence",
        "category": "Biomedical & Public Health",
        "author_or_publisher": "ResearchMate Clinical Literature Brief",
        "publication_date": "2025-08-20",
        "tags": ["glp-1", "semaglutide", "tirzepatide", "cardiovascular", "clinical trials"],
        "content": (
            "Large randomized controlled trials (such as SELECT and FLOW) demonstrated statistically significant "
            "reductions in major adverse cardiovascular events (~20% relative risk reduction in adults with pre-existing "
            "cardiovascular disease and obesity without diabetes) and slowed chronic kidney disease progression among "
            "patients treated with semaglutide. Emerging observational and early-phase studies also explore potential "
            "benefits in MASH (metabolic dysfunction-associated steatohepatitis), sleep apnea, and addiction craving "
            "modulation, though several non-metabolic indications remain investigational. Real-world claims analyses "
            "reveal a critical contrast with clinical trials: 1-year persistence and adherence drop markedly outside "
            "trial settings due to gastrointestinal side effects, supply constraints, out-of-pocket costs, and weight "
            "regain following discontinuation, alongside lean-mass loss concerns requiring resistance training and "
            "adequate protein intake."
        ),
    },
    {
        "id": "kb-remote-work-2025",
        "title": "Remote vs. Hybrid vs. In-Office Work: Productivity, Innovation, and Retention Meta-Findings",
        "category": "Economics & Organizational Science",
        "author_or_publisher": "ResearchMate Workplace Policy Brief",
        "publication_date": "2025-06-05",
        "tags": ["remote work", "hybrid work", "productivity", "rto", "collaboration"],
        "content": (
            "Randomized controlled trials and large-scale payroll studies show nuanced effects of remote work depending "
            "on modality. Structured hybrid schedules (typically 2–3 days in-office) consistently exhibit zero measurable "
            "productivity penalty while reducing voluntary employee attrition by roughly 30–35% in large randomized "
            "trials (e.g., Trip.com engineering/staff RCT). Conversely, fully remote arrangements in data-entry or "
            "junior onboarding cohorts sometimes measured 10–18% lower output when self-selected or poorly coordinated, "
            "and Microsoft/GitHub communication-graph analyses noted weaker cross-team 'weak ties' and slower knowledge "
            "transfer for new hires. Strict 5-day Return-To-Office (RTO) mandates frequently increase senior talent "
            "turnover without uniformly improving firm financial performance."
        ),
    },
    {
        "id": "kb-evidence-methodology",
        "title": "Standards for Multi-Source Evidence Verification and Conflict Resolution",
        "category": "Research Methodology",
        "author_or_publisher": "ResearchMate Methodology Core",
        "publication_date": "2026-01-12",
        "tags": ["verification", "fact checking", "methodology", "citations", "research"],
        "content": (
            "Rigorous evidence synthesis separates primary empirical data (randomized trials, official statistics, "
            "peer-reviewed meta-analyses) from secondary commentary, vendor marketing, and unverified preprints. "
            "A factual claim should only be marked as multi-source verified when corroborated by at least two "
            "independent primary or reputable secondary sources with non-circular provenance. When sources report "
            "divergent numbers or conclusions, conflicts typically arise from four mechanisms: temporal lag "
            "(2021 data vs. 2025 benchmarks), population or sample bias (clinical trial vs. real-world adherence), "
            "definitional mismatch (semi-solid vs. all-solid-state), or stakeholder incentives."
        ),
    },
]


def init_db() -> None:
    """Create tables and seed default preferences & knowledge base documents.
    Automatically initializes Supabase PostgreSQL when DATABASE_URL is set,
    or local SQLite when running locally.
    """
    settings = get_settings()
    with get_conn() as conn:
        if settings.is_postgres:
            logger.info("Initializing Supabase PostgreSQL database tables...")
            schema_file = Path(__file__).resolve().parent.parent / "supabase_schema.sql"
            if not schema_file.exists():
                schema_file = Path(__file__).resolve().parent.parent.parent / "supabase_schema.sql"
            
            if schema_file.exists():
                schema_sql = schema_file.read_text(encoding="utf-8")
                conn.executescript(schema_sql)
            else:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT NOT NULL UNIQUE,
                        gmail TEXT NOT NULL UNIQUE,
                        phone TEXT NOT NULL UNIQUE,
                        country_code TEXT NOT NULL DEFAULT '+1',
                        password_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
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
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        default_audience TEXT NOT NULL DEFAULT 'academic',
                        default_depth TEXT NOT NULL DEFAULT 'standard',
                        enabled_sources_json TEXT NOT NULL DEFAULT '["web","academic_paper","uploaded_pdf","knowledge_base"]',
                        citation_style TEXT NOT NULL DEFAULT 'numbered',
                        updated_at TEXT NOT NULL
                    );
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
                    CREATE TABLE IF NOT EXISTS chat_messages (
                        id TEXT PRIMARY KEY,
                        report_id TEXT NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        cited_source_ids_json TEXT NOT NULL DEFAULT '[]',
                        interaction_id TEXT,
                        created_at TEXT NOT NULL
                    );
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
                    CREATE TABLE IF NOT EXISTS profile_posts (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        caption TEXT NOT NULL,
                        category TEXT NOT NULL DEFAULT 'Research Note',
                        gradient TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS item_reactions (
                        item_id TEXT PRIMARY KEY,
                        likes_count INTEGER NOT NULL DEFAULT 0,
                        is_liked INTEGER NOT NULL DEFAULT 0,
                        is_saved INTEGER NOT NULL DEFAULT 0,
                        updated_at TEXT NOT NULL
                    );
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
                    CREATE TABLE IF NOT EXISTS problem_reports (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        description TEXT NOT NULL,
                        screenshot_filename TEXT,
                        screenshot_path TEXT,
                        created_at TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS activity_daily_usage (
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        usage_date TEXT NOT NULL,
                        seconds_spent INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY (user_id, usage_date)
                    );
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
                        UNIQUE(user_id, image_key)
                    );
                    """
                )
        else:
            conn.executescript(
                """
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

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    report_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    cited_source_ids_json TEXT NOT NULL DEFAULT '[]',
                    interaction_id TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (report_id) REFERENCES research_reports(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    default_audience TEXT NOT NULL DEFAULT 'academic',
                    default_depth TEXT NOT NULL DEFAULT 'standard',
                    enabled_sources_json TEXT NOT NULL DEFAULT '["web","academic_paper","uploaded_pdf","knowledge_base"]',
                    citation_style TEXT NOT NULL DEFAULT 'numbered',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    gmail TEXT NOT NULL UNIQUE,
                    phone TEXT NOT NULL UNIQUE,
                    country_code TEXT NOT NULL DEFAULT '+1',
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
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

                CREATE TABLE IF NOT EXISTS profile_posts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    caption TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'Research Note',
                    gradient TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS item_reactions (
                    item_id TEXT PRIMARY KEY,
                    likes_count INTEGER NOT NULL DEFAULT 0,
                    is_liked INTEGER NOT NULL DEFAULT 0,
                    is_saved INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS scheduled_content (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    caption TEXT NOT NULL,
                    category TEXT NOT NULL,
                    scheduled_for TEXT NOT NULL,
                    gradient TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS problem_reports (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    description TEXT NOT NULL,
                    screenshot_filename TEXT,
                    screenshot_path TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS activity_daily_usage (
                    user_id TEXT NOT NULL,
                    usage_date TEXT NOT NULL,
                    seconds_spent INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, usage_date)
                );

                CREATE TABLE IF NOT EXISTS saved_images (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    image_key TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    title TEXT NOT NULL,
                    caption TEXT NOT NULL,
                    image_url TEXT NOT NULL,
                    thumbnail_url TEXT NOT NULL DEFAULT '',
                    source_page_url TEXT NOT NULL DEFAULT '',
                    photographer_or_source TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    UNIQUE(user_id, image_key)
                );
                """
            )

        # Ensure default preferences row
        pref_exists = conn.execute("SELECT 1 FROM user_preferences WHERE id = 1").fetchone()
        if not pref_exists:
            conn.execute(
                """
                INSERT INTO user_preferences (id, default_audience, default_depth, enabled_sources_json, citation_style, updated_at)
                VALUES (1, 'academic', 'standard', ?, 'numbered', ?)
                """,
                (json.dumps(["web", "academic_paper", "uploaded_pdf", "knowledge_base"]), utc_now_iso()),
            )

        # Seed Knowledge Base if empty
        kb_count = conn.execute("SELECT COUNT(*) AS cnt FROM knowledge_base_docs").fetchone()["cnt"]
        if kb_count == 0:
            now = utc_now_iso()
            for doc in SEED_KB_DOCS:
                conn.execute(
                    """
                    INSERT INTO knowledge_base_docs
                    (id, title, category, author_or_publisher, publication_date, content, tags_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        doc["id"],
                        doc["title"],
                        doc["category"],
                        doc["author_or_publisher"],
                        doc["publication_date"],
                        doc["content"],
                        json.dumps(doc["tags"]),
                        now,
                    ),
                )


# ---------------------------------------------------------------------------
# Reports CRUD
# ---------------------------------------------------------------------------

def save_report(report: ResearchReport) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO research_reports (
                id, question, title, audience, depth, status, is_starred,
                llm_mode, source_count, conflict_count, plan_json, report_json,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                audience = excluded.audience,
                depth = excluded.depth,
                is_starred = excluded.is_starred,
                llm_mode = excluded.llm_mode,
                source_count = excluded.source_count,
                conflict_count = excluded.conflict_count,
                plan_json = excluded.plan_json,
                report_json = excluded.report_json,
                updated_at = excluded.updated_at
            """,
            (
                report.id,
                report.question,
                report.research_title,
                report.audience,
                report.depth,
                1 if report.is_starred else 0,
                report.llm_mode,
                len(report.sources),
                len(report.conflicting_information.conflicts),
                report.plan.model_dump_json(),
                report.model_dump_json(),
                report.created_at,
                report.updated_at,
            ),
        )


def list_reports(search: str = "") -> list[ReportListItem]:
    with get_conn() as conn:
        if search.strip():
            like = f"%{search.strip()}%"
            rows = conn.execute(
                """
                SELECT id, question, title, audience, depth, llm_mode, source_count, conflict_count, is_starred, created_at
                FROM research_reports
                WHERE question LIKE ? OR title LIKE ?
                ORDER BY is_starred DESC, created_at DESC
                """,
                (like, like),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, question, title, audience, depth, llm_mode, source_count, conflict_count, is_starred, created_at
                FROM research_reports
                ORDER BY is_starred DESC, created_at DESC
                """
            ).fetchall()
    return [
        ReportListItem(
            id=r["id"],
            question=r["question"],
            title=r["title"],
            audience=r["audience"],
            depth=r["depth"],
            llm_mode=r["llm_mode"],
            source_count=r["source_count"],
            conflict_count=r["conflict_count"],
            is_starred=bool(r["is_starred"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


def get_report(report_id: str) -> Optional[ResearchReport]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT report_json, is_starred FROM research_reports WHERE id = ?", (report_id,)
        ).fetchone()
    if not row:
        return None
    report = ResearchReport.model_validate_json(row["report_json"])
    report.is_starred = bool(row["is_starred"])
    return report


def toggle_star_report(report_id: str) -> Optional[bool]:
    with get_conn() as conn:
        row = conn.execute("SELECT is_starred FROM research_reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            return None
        new_val = 0 if row["is_starred"] else 1
        conn.execute(
            "UPDATE research_reports SET is_starred = ?, updated_at = ? WHERE id = ?",
            (new_val, utc_now_iso(), report_id),
        )
        return bool(new_val)


def delete_report(report_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM research_reports WHERE id = ?", (report_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# PDFs CRUD
# ---------------------------------------------------------------------------

def save_pdf_record(
    pdf_id: str,
    filename: str,
    file_path: str,
    title: str,
    author: str,
    page_count: int,
    word_count: int,
    full_text: str,
    pages: list[dict],
    analysis: PdfAnalysisData,
) -> PdfDocumentResponse:
    now = utc_now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO uploaded_pdfs (
                id, filename, file_path, title, author, page_count, word_count,
                full_text, pages_json, summary_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pdf_id,
                filename,
                file_path,
                title,
                author,
                page_count,
                word_count,
                full_text,
                json.dumps(pages),
                analysis.model_dump_json(),
                now,
            ),
        )
    return PdfDocumentResponse(
        id=pdf_id,
        filename=filename,
        title=title,
        author=author,
        page_count=page_count,
        word_count=word_count,
        preview_text=full_text[:1400],
        analysis=analysis,
        created_at=now,
    )


def list_pdfs() -> list[PdfDocumentResponse]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM uploaded_pdfs ORDER BY created_at DESC").fetchall()
    return [
        PdfDocumentResponse(
            id=r["id"],
            filename=r["filename"],
            title=r["title"],
            author=r["author"],
            page_count=r["page_count"],
            word_count=r["word_count"],
            preview_text=r["full_text"][:1400],
            analysis=PdfAnalysisData.model_validate_json(r["summary_json"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


def get_pdf_raw(pdf_id: str) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM uploaded_pdfs WHERE id = ?", (pdf_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "filename": row["filename"],
        "file_path": row["file_path"],
        "title": row["title"],
        "author": row["author"],
        "page_count": row["page_count"],
        "word_count": row["word_count"],
        "full_text": row["full_text"],
        "pages": json.loads(row["pages_json"]),
        "analysis": PdfAnalysisData.model_validate_json(row["summary_json"]),
        "created_at": row["created_at"],
    }


def update_pdf_analysis(pdf_id: str, analysis: PdfAnalysisData) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE uploaded_pdfs SET summary_json = ? WHERE id = ?",
            (analysis.model_dump_json(), pdf_id),
        )


def delete_pdf(pdf_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT file_path FROM uploaded_pdfs WHERE id = ?", (pdf_id,)).fetchone()
        if not row:
            return False
        file_path = Path(row["file_path"])
        conn.execute("DELETE FROM uploaded_pdfs WHERE id = ?", (pdf_id,))
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass
    return True


# ---------------------------------------------------------------------------
# Knowledge Base CRUD
# ---------------------------------------------------------------------------

def list_kb_docs() -> list[KnowledgeBaseDoc]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM knowledge_base_docs ORDER BY created_at DESC").fetchall()
    return [
        KnowledgeBaseDoc(
            id=r["id"],
            title=r["title"],
            category=r["category"],
            author_or_publisher=r["author_or_publisher"],
            publication_date=r["publication_date"],
            content=r["content"],
            tags=json.loads(r["tags_json"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


def create_kb_doc(payload: KnowledgeBaseCreate) -> KnowledgeBaseDoc:
    doc_id = f"kb-{uuid.uuid4().hex[:10]}"
    now = utc_now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO knowledge_base_docs
            (id, title, category, author_or_publisher, publication_date, content, tags_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                payload.title,
                payload.category,
                payload.author_or_publisher,
                payload.publication_date,
                payload.content,
                json.dumps(payload.tags),
                now,
            ),
        )
    return KnowledgeBaseDoc(
        id=doc_id,
        title=payload.title,
        category=payload.category,
        author_or_publisher=payload.author_or_publisher,
        publication_date=payload.publication_date,
        content=payload.content,
        tags=payload.tags,
        created_at=now,
    )


def delete_kb_doc(doc_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM knowledge_base_docs WHERE id = ?", (doc_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Chat CRUD
# ---------------------------------------------------------------------------

def list_chat_messages(report_id: str) -> list[ChatMessageModel]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE report_id = ? ORDER BY created_at ASC",
            (report_id,),
        ).fetchall()
    return [
        ChatMessageModel(
            id=r["id"],
            report_id=r["report_id"],
            role=r["role"],
            content=r["content"],
            cited_source_ids=json.loads(r["cited_source_ids_json"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]


def get_last_interaction_id(report_id: str) -> Optional[str]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT interaction_id FROM chat_messages
            WHERE report_id = ? AND interaction_id IS NOT NULL AND interaction_id != ''
            ORDER BY created_at DESC LIMIT 1
            """,
            (report_id,),
        ).fetchone()
    return row["interaction_id"] if row else None


def save_chat_message(
    report_id: str,
    role: str,
    content: str,
    cited_source_ids: list[str] | None = None,
    interaction_id: Optional[str] = None,
) -> ChatMessageModel:
    msg_id = f"msg-{uuid.uuid4().hex[:10]}"
    now = utc_now_iso()
    cited = cited_source_ids or []
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, report_id, role, content, cited_source_ids_json, interaction_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (msg_id, report_id, role, content, json.dumps(cited), interaction_id, now),
        )
    return ChatMessageModel(
        id=msg_id,
        report_id=report_id,
        role=role,  # type: ignore[arg-type]
        content=content,
        cited_source_ids=cited,
        created_at=now,
    )


def clear_chat_messages(report_id: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM chat_messages WHERE report_id = ?", (report_id,))


# ---------------------------------------------------------------------------
# Preferences CRUD
# ---------------------------------------------------------------------------

def get_preferences() -> UserPreferences:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM user_preferences WHERE id = 1").fetchone()
    return UserPreferences(
        default_audience=row["default_audience"],
        default_depth=row["default_depth"],
        enabled_sources=json.loads(row["enabled_sources_json"]),
        citation_style=row["citation_style"],
    )


def update_preferences(prefs: UserPreferences) -> UserPreferences:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE user_preferences
            SET default_audience = ?, default_depth = ?, enabled_sources_json = ?, citation_style = ?, updated_at = ?
            WHERE id = 1
            """,
            (
                prefs.default_audience,
                prefs.default_depth,
                json.dumps(prefs.enabled_sources),
                prefs.citation_style,
                utc_now_iso(),
            ),
        )
    return prefs


# ---------------------------------------------------------------------------
# User Authentication (PBKDF2-HMAC-SHA256)
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}:{dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, dk_hex = stored_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(dk_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_user(
    *,
    country_code: str,
    phone_number: str,
    gmail: str,
    username: str,
    password: str,
) -> AuthUserResponse:
    user_id = f"usr-{uuid.uuid4().hex[:10]}"
    norm_username = username.strip().lstrip("@").lower()
    norm_gmail = gmail.strip().lower()
    full_phone = f"{country_code.strip()}{phone_number.strip()}"
    now = utc_now_iso()
    pw_hash = _hash_password(password)

    with get_conn() as conn:
        existing = conn.execute(
            """
            SELECT username, gmail, phone FROM users
            WHERE lower(username) = ? OR lower(gmail) = ? OR phone = ?
            """,
            (norm_username, norm_gmail, full_phone),
        ).fetchone()
        if existing:
            if existing["username"].lower() == norm_username:
                raise ValueError("That username is already taken.")
            if existing["gmail"].lower() == norm_gmail:
                raise ValueError("That Gmail address is already registered.")
            raise ValueError("That phone number is already registered.")

        conn.execute(
            """
            INSERT INTO users (id, username, gmail, phone, country_code, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, norm_username, norm_gmail, full_phone, country_code.strip(), pw_hash, now),
        )

    return AuthUserResponse(
        id=user_id,
        username=norm_username,
        gmail=norm_gmail,
        phone=full_phone,
        created_at=now,
    )


def authenticate_user(*, identifier: str, password: str) -> AuthUserResponse:
    ident = identifier.strip()
    ident_low = ident.lstrip("@").lower()
    digits = "".join(ch for ch in ident if ch.isdigit())

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT * FROM users
            WHERE lower(username) = ?
               OR lower(gmail) = ?
               OR phone = ?
               OR (? != '' AND substr(phone, -10) = ?)
            LIMIT 1
            """,
            (ident_low, ident.lower(), ident, digits[-10:] if len(digits) >= 10 else "", digits[-10:] if len(digits) >= 10 else ""),
        ).fetchone()

    if not row or not _verify_password(password, row["password_hash"]):
        raise ValueError("Invalid credentials. Please check your username/phone/Gmail and password.")

    return AuthUserResponse(
        id=row["id"],
        username=row["username"],
        gmail=row["gmail"],
        phone=row["phone"],
        created_at=row["created_at"],
    )


# ---------------------------------------------------------------------------
# User Profile, Real Activity, Posts, Scheduled Content & Problem Reports
# ---------------------------------------------------------------------------

PROFILE_GRADIENTS = [
    "from-amber-400 via-pink-500 to-purple-600",
    "from-indigo-500 via-purple-600 to-pink-500",
    "from-rose-500 via-orange-400 to-amber-300",
    "from-fuchsia-600 via-pink-500 to-orange-400",
    "from-blue-600 via-indigo-600 to-purple-600",
    "from-orange-500 via-rose-500 to-indigo-600",
]


def _pick_gradient(key: str) -> str:
    idx = sum(ord(ch) for ch in (key or "r")) % len(PROFILE_GRADIENTS)
    return PROFILE_GRADIENTS[idx]


def _ensure_profile_row(conn: sqlite3.Connection, user_id: str, username_hint: str = "") -> sqlite3.Row:
    row = conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return row

    user_row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    uname = (user_row["username"] if user_row else username_hint or "guest_researcher").strip().lstrip("@").lower()
    display_name = " ".join(part.capitalize() for part in uname.replace(".", " ").replace("_", " ").split()) or "Researcher"
    bio = f"Researching evidence-backed topics on ResearchMate AI as @{uname}."
    now = utc_now_iso()
    conn.execute(
        """
        INSERT INTO user_profiles (
            user_id, username, full_name, bio, avatar_url,
            followers_count, following_count, private_account,
            notify_research_complete, notify_conflicts, two_factor_enabled, updated_at
        )
        VALUES (?, ?, ?, ?, '', 0, 0, 0, 1, 1, 0, ?)
        """,
        (user_id, uname, display_name, bio, now),
    )
    return conn.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()


def get_profile_overview(user_id: str, username_hint: str = "") -> ProfileOverviewResponse:
    with get_conn() as conn:
        prof = _ensure_profile_row(conn, user_id, username_hint)

        # Reactions map (likes & saved state for PDFs/posts/reports)
        rx_rows = conn.execute("SELECT * FROM item_reactions").fetchall()
        reactions = {r["item_id"]: r for r in rx_rows}

        # Real chat comment counts per report
        chat_counts_rows = conn.execute(
            "SELECT report_id, COUNT(*) AS cnt FROM chat_messages GROUP BY report_id"
        ).fetchall()
        chat_counts = {r["report_id"]: r["cnt"] for r in chat_counts_rows}

        user_chat_msgs = conn.execute(
            "SELECT COUNT(*) AS cnt FROM chat_messages WHERE role = 'user'"
        ).fetchone()["cnt"]

        # 1. Real Research Reports -> Feed items
        rep_rows = conn.execute(
            """
            SELECT id, question, title, source_count, conflict_count, is_starred, created_at
            FROM research_reports ORDER BY created_at DESC
            """
        ).fetchall()

        posts: list[ProfileFeedItem] = []
        for r in rep_rows:
            rx = reactions.get(r["id"])
            posts.append(
                ProfileFeedItem(
                    id=r["id"],
                    kind="report",
                    title=r["title"],
                    caption=f"Query: {r['question']} · {r['source_count']} sources · {r['conflict_count']} conflict(s)",
                    category="Research Report",
                    date_label=r["created_at"][:10],
                    created_at=r["created_at"],
                    gradient=_pick_gradient(r["id"]),
                    likes=rx["likes_count"] if rx else 0,
                    liked=bool(rx["is_liked"]) if rx else False,
                    comments=chat_counts.get(r["id"], 0),
                    saved=bool(r["is_starred"]),
                    meta_badge=f"{r['source_count']} sources",
                )
            )

        # 2. Real Uploaded PDFs -> Feed items
        pdf_rows = conn.execute(
            "SELECT id, filename, title, page_count, word_count, summary_json, created_at FROM uploaded_pdfs ORDER BY created_at DESC"
        ).fetchall()
        for p in pdf_rows:
            rx = reactions.get(p["id"])
            summary_obj = json.loads(p["summary_json"])
            summary_txt = summary_obj.get("summary") or f"Extracted PDF ({p['page_count']} pages, {p['word_count']} words)."
            posts.append(
                ProfileFeedItem(
                    id=p["id"],
                    kind="pdf",
                    title=p["title"] or p["filename"],
                    caption=summary_txt[:220],
                    category="Uploaded PDF",
                    date_label=p["created_at"][:10],
                    created_at=p["created_at"],
                    gradient=_pick_gradient(p["id"]),
                    likes=rx["likes_count"] if rx else 0,
                    liked=bool(rx["is_liked"]) if rx else False,
                    comments=0,
                    saved=bool(rx["is_saved"]) if rx else False,
                    meta_badge=f"{p['page_count']} pages",
                )
            )

        # 3. Real User-Created Profile Posts -> Feed items
        custom_rows = conn.execute(
            "SELECT * FROM profile_posts WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        for cp in custom_rows:
            rx = reactions.get(cp["id"])
            posts.append(
                ProfileFeedItem(
                    id=cp["id"],
                    kind="post",
                    title=cp["title"],
                    caption=cp["caption"],
                    category=cp["category"],
                    date_label=cp["created_at"][:10],
                    created_at=cp["created_at"],
                    gradient=cp["gradient"],
                    likes=rx["likes_count"] if rx else 0,
                    liked=bool(rx["is_liked"]) if rx else False,
                    comments=0,
                    saved=bool(rx["is_saved"]) if rx else False,
                    meta_badge="Note",
                )
            )

        posts.sort(key=lambda item: item.created_at, reverse=True)

        # Real Scheduled Content
        sched_rows = conn.execute(
            "SELECT * FROM scheduled_content WHERE user_id = ? ORDER BY scheduled_for ASC",
            (user_id,),
        ).fetchall()
        scheduled = [
            ScheduledPostItem(
                id=s["id"],
                title=s["title"],
                caption=s["caption"],
                category=s["category"],
                scheduled_for=s["scheduled_for"],
                gradient=s["gradient"],
                status=s["status"],
                created_at=s["created_at"],
            )
            for s in sched_rows
        ]

        # Real Activity Metrics (last 7 days)
        today_dt = datetime.now(timezone.utc).date()
        today_str = today_dt.isoformat()
        usage_rows = conn.execute(
            "SELECT usage_date, seconds_spent FROM activity_daily_usage WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        usage_by_day = {u["usage_date"]: u["seconds_spent"] for u in usage_rows}
        seconds_today = usage_by_day.get(today_str, 0)

        # Count real actions per date across reports, pdfs, chats, custom posts
        action_dates: dict[str, int] = {}
        for row in rep_rows:
            d = row["created_at"][:10]
            action_dates[d] = action_dates.get(d, 0) + 1
        for row in pdf_rows:
            d = row["created_at"][:10]
            action_dates[d] = action_dates.get(d, 0) + 1
        for row in custom_rows:
            d = row["created_at"][:10]
            action_dates[d] = action_dates.get(d, 0) + 1
        for row in conn.execute("SELECT created_at FROM chat_messages WHERE role = 'user'").fetchall():
            d = row["created_at"][:10]
            action_dates[d] = action_dates.get(d, 0) + 1

        daily_bars: list[ActivityDailyBar] = []
        total_week_secs = 0
        for offset in range(6, -1, -1):
            day_dt = today_dt - timedelta(days=offset)
            d_str = day_dt.isoformat()
            secs = usage_by_day.get(d_str, 0)
            total_week_secs += secs
            daily_bars.append(
                ActivityDailyBar(
                    date=d_str,
                    label=day_dt.strftime("%a"),
                    minutes=round(secs / 60.0, 1),
                    actions=action_dates.get(d_str, 0),
                )
            )

        # Real Saved Related Images Collection
        saved_img_rows = conn.execute(
            "SELECT * FROM saved_images WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        saved_images = [
            SavedImageItem(
                id=si["id"],
                image_key=si["image_key"],
                topic=si["topic"],
                title=si["title"],
                caption=si["caption"],
                image_url=si["image_url"],
                thumbnail_url=si["thumbnail_url"],
                source_page_url=si["source_page_url"],
                photographer_or_source=si["photographer_or_source"],
                created_at=si["created_at"],
            )
            for si in saved_img_rows
        ]

        likes_given = sum(1 for r in rx_rows if r["is_liked"])
        saved_count = sum(1 for item in posts if item.saved) + len(saved_images)
        prob_cnt = conn.execute(
            "SELECT COUNT(*) AS cnt FROM problem_reports WHERE user_id = ?",
            (user_id,),
        ).fetchone()["cnt"]

    return ProfileOverviewResponse(
        user_id=prof["user_id"],
        username=prof["username"],
        full_name=prof["full_name"],
        bio=prof["bio"],
        avatar_url=prof["avatar_url"],
        followers_count=prof["followers_count"],
        following_count=prof["following_count"],
        posts_count=len(posts),
        settings=ProfileSettingsModel(
            private_account=bool(prof["private_account"]),
            notify_research_complete=bool(prof["notify_research_complete"]),
            notify_conflicts=bool(prof["notify_conflicts"]),
            two_factor_enabled=bool(prof["two_factor_enabled"]),
        ),
        posts=posts,
        scheduled=scheduled,
        saved_images=saved_images,
        activity=ProfileActivityData(
            seconds_today=seconds_today,
            weekly_avg_minutes=round((total_week_secs / 60.0) / 7.0, 1),
            likes_given=likes_given,
            comments_posted=user_chat_msgs,
            reports_count=len(rep_rows),
            pdfs_count=len(pdf_rows),
            saved_count=saved_count,
            scheduled_count=len(scheduled),
            daily_bars=daily_bars,
        ),
        problem_reports_count=prob_cnt,
    )


def update_profile_details(user_id: str, payload: ProfileUpdateRequest) -> ProfileOverviewResponse:
    norm_username = payload.username.strip().lstrip("@").lower()
    with get_conn() as conn:
        _ensure_profile_row(conn, user_id, norm_username)
        # If this is a real registered user in `users`, verify username uniqueness and sync it
        user_row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if user_row:
            conflict = conn.execute(
                "SELECT id FROM users WHERE lower(username) = ? AND id != ?",
                (norm_username, user_id),
            ).fetchone()
            if conflict:
                raise ValueError("That username is already taken.")
            conn.execute("UPDATE users SET username = ? WHERE id = ?", (norm_username, user_id))

        conn.execute(
            """
            UPDATE user_profiles
            SET username = ?, full_name = ?, bio = ?, avatar_url = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (norm_username, payload.full_name.strip(), payload.bio.strip(), payload.avatar_url, utc_now_iso(), user_id),
        )
    return get_profile_overview(user_id, norm_username)


def update_profile_settings(user_id: str, payload: ProfileSettingsModel) -> ProfileSettingsModel:
    with get_conn() as conn:
        _ensure_profile_row(conn, user_id)
        conn.execute(
            """
            UPDATE user_profiles
            SET private_account = ?, notify_research_complete = ?, notify_conflicts = ?, two_factor_enabled = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (
                1 if payload.private_account else 0,
                1 if payload.notify_research_complete else 0,
                1 if payload.notify_conflicts else 0,
                1 if payload.two_factor_enabled else 0,
                utc_now_iso(),
                user_id,
            ),
        )
    return payload


def create_profile_post(user_id: str, payload: ProfilePostCreate) -> ProfileFeedItem:
    post_id = f"post-{uuid.uuid4().hex[:10]}"
    now = utc_now_iso()
    grad = _pick_gradient(post_id)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO profile_posts (id, user_id, title, caption, category, gradient, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (post_id, user_id, payload.title.strip(), payload.caption.strip(), payload.category.strip(), grad, now),
        )
    return ProfileFeedItem(
        id=post_id,
        kind="post",
        title=payload.title.strip(),
        caption=payload.caption.strip(),
        category=payload.category.strip(),
        date_label=now[:10],
        created_at=now,
        gradient=grad,
        likes=0,
        liked=False,
        comments=0,
        saved=False,
        meta_badge="Note",
    )


def toggle_item_like(item_id: str) -> dict:
    now = utc_now_iso()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM item_reactions WHERE item_id = ?", (item_id,)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO item_reactions (item_id, likes_count, is_liked, is_saved, updated_at) VALUES (?, 1, 1, 0, ?)",
                (item_id, now),
            )
            return {"item_id": item_id, "liked": True, "likes": 1}
        new_liked = 0 if row["is_liked"] else 1
        new_count = max(0, row["likes_count"] + (1 if new_liked else -1))
        conn.execute(
            "UPDATE item_reactions SET likes_count = ?, is_liked = ?, updated_at = ? WHERE item_id = ?",
            (new_count, new_liked, now, item_id),
        )
        return {"item_id": item_id, "liked": bool(new_liked), "likes": new_count}


def toggle_item_save(item_id: str, kind: str) -> dict:
    if kind == "report":
        res = toggle_star_report(item_id)
        return {"item_id": item_id, "saved": bool(res)}

    now = utc_now_iso()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM item_reactions WHERE item_id = ?", (item_id,)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO item_reactions (item_id, likes_count, is_liked, is_saved, updated_at) VALUES (?, 0, 0, 1, ?)",
                (item_id, now),
            )
            return {"item_id": item_id, "saved": True}
        new_saved = 0 if row["is_saved"] else 1
        conn.execute(
            "UPDATE item_reactions SET is_saved = ?, updated_at = ? WHERE item_id = ?",
            (new_saved, now, item_id),
        )
        return {"item_id": item_id, "saved": bool(new_saved)}


def create_scheduled_item(user_id: str, payload: ScheduledPostCreate) -> ScheduledPostItem:
    sched_id = f"sched-{uuid.uuid4().hex[:10]}"
    now = utc_now_iso()
    grad = _pick_gradient(sched_id)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO scheduled_content (id, user_id, title, caption, category, scheduled_for, gradient, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)
            """,
            (
                sched_id,
                user_id,
                payload.title.strip(),
                payload.caption.strip() or "Queued research topic ready to run.",
                payload.category.strip(),
                payload.scheduled_for.strip(),
                grad,
                now,
            ),
        )
    return ScheduledPostItem(
        id=sched_id,
        title=payload.title.strip(),
        caption=payload.caption.strip() or "Queued research topic ready to run.",
        category=payload.category.strip(),
        scheduled_for=payload.scheduled_for.strip(),
        gradient=grad,
        status="queued",
        created_at=now,
    )


def delete_scheduled_item(sched_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM scheduled_content WHERE id = ?", (sched_id,))
        return cur.rowcount > 0


def list_saved_images(user_id: str) -> list[SavedImageItem]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM saved_images WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [
        SavedImageItem(
            id=r["id"],
            image_key=r["image_key"],
            topic=r["topic"],
            title=r["title"],
            caption=r["caption"],
            image_url=r["image_url"],
            thumbnail_url=r["thumbnail_url"],
            source_page_url=r["source_page_url"],
            photographer_or_source=r["photographer_or_source"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


def toggle_saved_image(user_id: str, payload: SavedImageToggleRequest) -> dict:
    """Bookmark or unbookmark a topic image directly into the user's Saved collection."""
    now = utc_now_iso()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM saved_images WHERE user_id = ? AND image_key = ?",
            (user_id, payload.image_key),
        ).fetchone()
        if existing:
            conn.execute("DELETE FROM saved_images WHERE id = ?", (existing["id"],))
            cnt = conn.execute("SELECT COUNT(*) AS cnt FROM saved_images WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
            return {"saved": False, "image_key": payload.image_key, "id": existing["id"], "saved_images_count": cnt}

        new_id = f"simg-{uuid.uuid4().hex[:10]}"
        conn.execute(
            """
            INSERT INTO saved_images (
                id, user_id, image_key, topic, title, caption, image_url,
                thumbnail_url, source_page_url, photographer_or_source, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id,
                user_id,
                payload.image_key,
                payload.topic.strip(),
                payload.title.strip(),
                payload.caption.strip(),
                payload.image_url,
                payload.thumbnail_url or payload.image_url,
                payload.source_page_url,
                payload.photographer_or_source,
                now,
            ),
        )
        cnt = conn.execute("SELECT COUNT(*) AS cnt FROM saved_images WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
        return {"saved": True, "image_key": payload.image_key, "id": new_id, "saved_images_count": cnt}


def delete_saved_image(image_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM saved_images WHERE id = ?", (image_id,))
        return cur.rowcount > 0


def record_activity_heartbeat(user_id: str, seconds: int = 15) -> int:
    today_str = datetime.now(timezone.utc).date().isoformat()
    clamped = max(1, min(120, seconds))
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO activity_daily_usage (user_id, usage_date, seconds_spent)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, usage_date) DO UPDATE SET
                seconds_spent = seconds_spent + excluded.seconds_spent
            """,
            (user_id, today_str, clamped),
        )
        row = conn.execute(
            "SELECT seconds_spent FROM activity_daily_usage WHERE user_id = ? AND usage_date = ?",
            (user_id, today_str),
        ).fetchone()
    return row["seconds_spent"] if row else clamped


def save_problem_report(
    user_id: str,
    description: str,
    screenshot_filename: Optional[str] = None,
    screenshot_path: Optional[str] = None,
) -> ProblemReportResponse:
    prob_id = f"prob-{uuid.uuid4().hex[:10]}"
    now = utc_now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO problem_reports (id, user_id, description, screenshot_filename, screenshot_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (prob_id, user_id, description.strip(), screenshot_filename, screenshot_path, now),
        )
    return ProblemReportResponse(
        id=prob_id,
        description=description.strip(),
        screenshot_filename=screenshot_filename,
        created_at=now,
    )
