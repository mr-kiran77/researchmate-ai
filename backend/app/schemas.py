"""Pydantic data models for ResearchMate AI."""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


SourceType = Literal["web", "academic_paper", "uploaded_pdf", "knowledge_base"]
AudienceType = Literal["student", "academic", "developer", "educator", "professional"]
DepthType = Literal["quick", "standard", "deep"]
ClaimCategory = Literal[
    "verified_fact",
    "multi_source_consensus",
    "single_source_claim",
    "interpretation_or_assumption",
    "outdated_information",
    "contradicted_or_disputed",
    "insufficient_evidence",
]


# ---------------------------------------------------------------------------
# Feature 1: Research Question Analyzer & Plan
# ---------------------------------------------------------------------------

class SubQuestion(BaseModel):
    id: str = Field(..., description="Identifier such as SQ1, SQ2")
    question: str
    information_needed: str
    target_sources: list[SourceType] = Field(default_factory=lambda: ["web", "academic_paper"])
    search_query: str


class PlanStep(BaseModel):
    step_number: int
    title: str
    description: str
    status: Literal["pending", "in_progress", "completed"] = "pending"


class ResearchPlan(BaseModel):
    question: str
    question_understanding: str
    domain: str
    research_objective: str
    sub_questions: list[SubQuestion]
    plan_steps: list[PlanStep]
    expected_challenges: list[str] = Field(default_factory=list)


class PlanRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    audience: AudienceType = "academic"
    depth: DepthType = "standard"
    pdf_ids: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Feature 2: Multi-Source Research Engine
# ---------------------------------------------------------------------------

class SourceItem(BaseModel):
    source_id: str
    title: str
    author_or_publisher: str = "Unknown"
    publication_date: str = "Unknown"
    publication_year: Optional[int] = None
    url: str = ""
    source_type: SourceType
    provider: str
    sub_questions_matched: list[str] = Field(default_factory=list)
    relevance_score: float = 70.0
    credibility_score: float = 70.0
    recency_score: float = 70.0
    composite_score: float = 70.0
    relevant_information: str
    snippets: list[str] = Field(default_factory=list)
    pdf_id: Optional[str] = None
    page_numbers: list[int] = Field(default_factory=list)


class SearchExecutionLog(BaseModel):
    sub_question_id: str
    sub_question: str
    query: str
    providers_queried: list[str]
    raw_results_count: int
    retained_source_ids: list[str]


# ---------------------------------------------------------------------------
# Feature 3: Information Verification
# ---------------------------------------------------------------------------

class EvidenceExcerpt(BaseModel):
    source_id: str
    quote: str
    stance: Literal["supports", "contradicts", "context"] = "supports"


class VerifiedClaim(BaseModel):
    claim_id: str
    claim_text: str
    claim_category: ClaimCategory
    verification_status: str
    confidence_score: int = Field(ge=0, le=100)
    is_verified_fact: bool = False
    supporting_source_ids: list[str] = Field(default_factory=list)
    contradicting_source_ids: list[str] = Field(default_factory=list)
    evidence_excerpts: list[EvidenceExcerpt] = Field(default_factory=list)
    distinction_note: str


# ---------------------------------------------------------------------------
# Feature 4: Conflict Detection System
# ---------------------------------------------------------------------------

class ConflictItem(BaseModel):
    conflict_id: str
    topic: str
    severity: Literal["high", "medium", "low"] = "medium"
    source_a_id: str
    source_a_title: str
    claim_a: str
    source_b_id: str
    source_b_title: str
    claim_b: str
    possible_reasons: list[str] = Field(default_factory=list)
    neutral_explanation: str
    what_remains_uncertain: str


class ConflictSectionData(BaseModel):
    summary: str
    conflicts: list[ConflictItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Feature 5: 14-Section Structured Research Report & Analytics
# ---------------------------------------------------------------------------

class ResearchQuestionsSection(BaseModel):
    main_question: str
    research_objective: str
    sub_questions: list[SubQuestion]


class MethodologySection(BaseModel):
    overview: str
    llm_engine_used: str
    source_types_searched: list[str]
    search_logs: list[SearchExecutionLog]
    deduplication_and_ranking_notes: str
    verification_protocol: str


class KeyFinding(BaseModel):
    id: str
    title: str
    summary: str
    cited_source_ids: list[str] = Field(default_factory=list)
    verification_status: str
    confidence: int = Field(ge=0, le=100)


class AnalysisSection(BaseModel):
    sub_question_id: str
    heading: str
    content: str
    cited_source_ids: list[str] = Field(default_factory=list)


class SourceComparisonRow(BaseModel):
    source_id: str
    title: str
    source_type: SourceType
    provider: str
    author_or_publisher: str
    publication_date: str
    relevance_score: float
    credibility_score: float
    recency_score: float
    key_contribution: str


class SourceComparisonSection(BaseModel):
    narrative: str
    comparison_rows: list[SourceComparisonRow] = Field(default_factory=list)
    pdf_vs_web_summary: Optional[str] = None


class ReferenceEntry(BaseModel):
    source_id: str
    citation_text: str
    title: str
    author_or_publisher: str
    publication_date: str
    url: str
    source_type: SourceType


class ChartSeriesItem(BaseModel):
    name: str
    value: float
    secondary: Optional[float] = None
    tertiary: Optional[float] = None


class RelatedImage(BaseModel):
    """Metadata for a topic-related image displayed alongside written search results."""
    id: str
    title: str
    caption: str
    image_url: str
    thumbnail_url: str
    source_page_url: str = ""
    photographer_or_source: str = "Wikimedia Commons"
    provider: str = "wikimedia"
    is_fallback: bool = False


class QuickTopicSearchResponse(BaseModel):
    """Fast combined text + image search payload for instant topic lookups."""
    query: str
    summary_title: str
    summary_text: str
    key_points: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sources: list[SourceItem] = Field(default_factory=list)
    related_images: list[RelatedImage] = Field(default_factory=list)


class ReportAnalytics(BaseModel):
    source_type_breakdown: list[ChartSeriesItem] = Field(default_factory=list)
    verification_breakdown: list[ChartSeriesItem] = Field(default_factory=list)
    publication_timeline: list[ChartSeriesItem] = Field(default_factory=list)
    sub_question_coverage: list[ChartSeriesItem] = Field(default_factory=list)


class ResearchReport(BaseModel):
    id: str
    question: str
    audience: AudienceType = "academic"
    depth: DepthType = "standard"
    llm_mode: str = "extractive_fallback"
    created_at: str
    updated_at: str
    is_starred: bool = False
    attached_pdf_ids: list[str] = Field(default_factory=list)

    # 14 Required Sections
    research_title: str                           # 1. Research title
    executive_summary: str                        # 2. Executive summary
    research_objective: str                       # 3. Research objective
    research_questions: ResearchQuestionsSection  # 4. Research questions
    methodology_and_sources: MethodologySection   # 5. Methodology and sources searched
    key_findings: list[KeyFinding]                # 6. Key findings
    detailed_analysis: list[AnalysisSection]      # 7. Detailed analysis
    source_comparison: SourceComparisonSection    # 8. Source comparison
    conflicting_information: ConflictSectionData  # 9. Conflicting information
    evidence_and_citations: list[VerifiedClaim]   # 10. Evidence and citations
    limitations_of_research: list[str]            # 11. Limitations of the research
    open_questions: list[str]                     # 12. Open questions
    conclusion: str                               # 13. Conclusion
    references: list[ReferenceEntry]              # 14. References

    # Full supporting objects for interactive UI
    plan: ResearchPlan
    sources: list[SourceItem]
    analytics: ReportAnalytics
    related_images: list[RelatedImage] = Field(default_factory=list)


class RunResearchRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    audience: AudienceType = "academic"
    depth: DepthType = "standard"
    enabled_sources: list[SourceType] = Field(
        default_factory=lambda: ["web", "academic_paper", "uploaded_pdf", "knowledge_base"]
    )
    pdf_ids: list[str] = Field(default_factory=list)
    plan: Optional[ResearchPlan] = None


class ReportListItem(BaseModel):
    id: str
    question: str
    title: str
    audience: str
    depth: str
    llm_mode: str
    source_count: int
    conflict_count: int
    is_starred: bool
    created_at: str


# ---------------------------------------------------------------------------
# Feature 6: AI Research Chat
# ---------------------------------------------------------------------------

class ChatMessageModel(BaseModel):
    id: str
    report_id: str
    role: Literal["user", "assistant"]
    content: str
    cited_source_ids: list[str] = Field(default_factory=list)
    created_at: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


# ---------------------------------------------------------------------------
# Feature 7: PDF Upload & Analysis
# ---------------------------------------------------------------------------

class PdfPageSnippet(BaseModel):
    page_number: int
    text: str


class PdfAnalysisData(BaseModel):
    summary: str
    important_findings: list[str] = Field(default_factory=list)
    methodology_or_approach: str = ""
    limitations_noted: list[str] = Field(default_factory=list)
    key_topics: list[str] = Field(default_factory=list)


class PdfDocumentResponse(BaseModel):
    id: str
    filename: str
    title: str
    author: str
    page_count: int
    word_count: int
    preview_text: str
    analysis: PdfAnalysisData
    created_at: str


class PdfWebComparisonRequest(BaseModel):
    focus_question: Optional[str] = None
    audience: AudienceType = "academic"
    depth: DepthType = "standard"


# ---------------------------------------------------------------------------
# Knowledge Base & Preferences
# ---------------------------------------------------------------------------

class KnowledgeBaseDoc(BaseModel):
    id: str
    title: str
    category: str
    author_or_publisher: str
    publication_date: str
    content: str
    tags: list[str] = Field(default_factory=list)
    created_at: str


class KnowledgeBaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=250)
    category: str = "General Research"
    author_or_publisher: str = "User Knowledge Base"
    publication_date: str = "2026-01-01"
    content: str = Field(..., min_length=20)
    tags: list[str] = Field(default_factory=list)


class UserPreferences(BaseModel):
    default_audience: AudienceType = "academic"
    default_depth: DepthType = "standard"
    enabled_sources: list[SourceType] = Field(
        default_factory=lambda: ["web", "academic_paper", "uploaded_pdf", "knowledge_base"]
    )
    citation_style: Literal["numbered", "apa", "inline"] = "numbered"


# ---------------------------------------------------------------------------
# Authentication (Front Page Log In / Sign Up)
# ---------------------------------------------------------------------------

class AuthSignUpRequest(BaseModel):
    country_code: str = "+1"
    phone_number: str = Field(..., pattern=r"^\d{10}$")
    gmail: str = Field(..., pattern=r"^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@gmail\.com$")
    username: str = Field(..., pattern=r"^[a-zA-Z0-9._]{3,24}$")
    password: str = Field(..., min_length=8, max_length=128)


class AuthLoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=120)
    password: str = Field(..., min_length=1, max_length=128)


class AuthUserResponse(BaseModel):
    id: str
    username: str
    gmail: str
    phone: str
    created_at: str


# ---------------------------------------------------------------------------
# User Profile, Activity, Scheduled Content & Problem Reports (Real Data)
# ---------------------------------------------------------------------------

class ProfileUpdateRequest(BaseModel):
    username: str = Field(..., pattern=r"^[a-zA-Z0-9._]{3,24}$")
    full_name: str = Field(..., min_length=1, max_length=100)
    bio: str = Field(default="", max_length=500)
    avatar_url: str = Field(default="", max_length=2_000_000)


class ProfileSettingsModel(BaseModel):
    private_account: bool = False
    notify_research_complete: bool = True
    notify_conflicts: bool = True
    two_factor_enabled: bool = False


class ProfileFeedItem(BaseModel):
    id: str
    kind: Literal["report", "pdf", "post"]
    title: str
    caption: str
    category: str
    date_label: str
    created_at: str
    gradient: str
    likes: int = 0
    liked: bool = False
    comments: int = 0
    saved: bool = False
    meta_badge: Optional[str] = None


class ProfilePostCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    caption: str = Field(..., min_length=4, max_length=1000)
    category: str = "Research Note"


class ScheduledPostCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    caption: str = Field(default="", max_length=1000)
    category: str = "Scheduled Research"
    scheduled_for: str = Field(..., min_length=10, max_length=40)


class ScheduledPostItem(BaseModel):
    id: str
    title: str
    caption: str
    category: str
    scheduled_for: str
    gradient: str
    status: str
    created_at: str


class ActivityDailyBar(BaseModel):
    date: str
    label: str
    minutes: float
    actions: int


class ProfileActivityData(BaseModel):
    seconds_today: int
    weekly_avg_minutes: float
    likes_given: int
    comments_posted: int
    reports_count: int
    pdfs_count: int
    saved_count: int
    scheduled_count: int
    daily_bars: list[ActivityDailyBar]


class ProblemReportResponse(BaseModel):
    id: str
    description: str
    screenshot_filename: Optional[str] = None
    created_at: str


class SavedImageItem(BaseModel):
    """Bookmarked image saved from Related Images Search Results into Profile Saved Collection."""
    id: str
    image_key: str
    topic: str
    title: str
    caption: str
    image_url: str
    thumbnail_url: str = ""
    source_page_url: str = ""
    photographer_or_source: str = ""
    created_at: str


class SavedImageToggleRequest(BaseModel):
    image_key: str = Field(..., min_length=1, max_length=250)
    topic: str = Field(default="", max_length=300)
    title: str = Field(..., min_length=1, max_length=200)
    caption: str = Field(default="", max_length=500)
    image_url: str = Field(..., min_length=5, max_length=50_000)
    thumbnail_url: str = Field(default="", max_length=50_000)
    source_page_url: str = Field(default="", max_length=2000)
    photographer_or_source: str = Field(default="", max_length=200)


class ProfileOverviewResponse(BaseModel):
    user_id: str
    username: str
    full_name: str
    bio: str
    avatar_url: str
    followers_count: int
    following_count: int
    posts_count: int
    settings: ProfileSettingsModel
    posts: list[ProfileFeedItem]
    scheduled: list[ScheduledPostItem]
    saved_images: list[SavedImageItem] = Field(default_factory=list)
    activity: ProfileActivityData
    problem_reports_count: int
