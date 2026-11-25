"""FastAPI application entrypoint for ResearchMate AI."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import database
from app.config import get_settings
from app.schemas import (
    AuthLoginRequest,
    AuthSignUpRequest,
    AuthUserResponse,
    ChatMessageModel,
    ChatRequest,
    KnowledgeBaseCreate,
    KnowledgeBaseDoc,
    PdfDocumentResponse,
    PdfWebComparisonRequest,
    PlanRequest,
    ProblemReportResponse,
    ProfileFeedItem,
    ProfileOverviewResponse,
    ProfilePostCreate,
    ProfileSettingsModel,
    ProfileUpdateRequest,
    QuickTopicSearchResponse,
    RelatedImage,
    ReportListItem,
    ResearchPlan,
    ResearchReport,
    RunResearchRequest,
    SavedImageItem,
    SavedImageToggleRequest,
    ScheduledPostCreate,
    ScheduledPostItem,
    UserPreferences,
)
from app.services.chat_service import answer_followup_question
from app.services.image_search_service import execute_quick_topic_search, search_related_images
from app.services.llm_service import LLMService
from app.services.pdf_service import analyze_pdf_document, extract_pdf_bytes, generate_report_pdf
from app.services.research_agent import generate_research_plan, run_research_pipeline_stream


@asynccontextmanager
async def lifespan(_app: FastAPI):
    database.init_db()
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    description=settings.app_tagline,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health & Configuration (Never exposes secret API keys)
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    cfg = get_settings()
    return {
        "status": "ok",
        "app_name": cfg.app_name,
        "tagline": cfg.app_tagline,
        "capabilities": cfg.public_capabilities(),
    }


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------

@app.get("/api/preferences", response_model=UserPreferences)
def get_preferences():
    return database.get_preferences()


@app.put("/api/preferences", response_model=UserPreferences)
def update_preferences(prefs: UserPreferences):
    return database.update_preferences(prefs)


# ---------------------------------------------------------------------------
# Feature 1: Research Question Analyzer & Plan
# ---------------------------------------------------------------------------

@app.post("/api/research/plan", response_model=ResearchPlan)
async def create_plan(payload: PlanRequest):
    llm = LLMService()
    return await generate_research_plan(
        question=payload.question,
        audience=payload.audience,
        depth=payload.depth,
        pdf_ids=payload.pdf_ids,
        llm_service=llm,
    )


@app.get("/api/research/images", response_model=list[RelatedImage])
async def get_related_images(
    q: str = Query(..., min_length=2, max_length=500),
    limit: int = Query(default=8, ge=4, le=12),
):
    """Fetch keyword-matched images (Wikimedia Commons, Wikipedia, Openverse, Unsplash, Pexels, Pixabay)."""
    return await search_related_images(q, limit=limit)


@app.get("/api/research/quick", response_model=QuickTopicSearchResponse)
async def quick_topic_lookup(
    q: str = Query(..., min_length=2, max_length=500),
    limit: int = Query(default=8, ge=4, le=12),
):
    """Fast topic summary + key facts + tags + related images lookup directly from the search bar."""
    return await execute_quick_topic_search(q, image_limit=limit)


# ---------------------------------------------------------------------------
# Feature 2, 3, 4, 5: Agentic Research Execution (SSE Streaming & Sync)
# ---------------------------------------------------------------------------

@app.post("/api/research/run/stream")
async def run_research_stream(payload: RunResearchRequest):
    llm = LLMService()

    async def event_generator():
        try:
            async for ev in run_research_pipeline_stream(
                question=payload.question,
                audience=payload.audience,
                depth=payload.depth,
                enabled_sources=payload.enabled_sources,
                pdf_ids=payload.pdf_ids,
                provided_plan=payload.plan,
                llm_service=llm,
            ):
                event_name = ev["event"]
                data_json = json.dumps(ev["data"])
                yield f"event: {event_name}\ndata: {data_json}\n\n"
        except Exception as exc:
            err_json = json.dumps({"message": str(exc)})
            yield f"event: error\ndata: {err_json}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/research/run", response_model=ResearchReport)
async def run_research_sync(payload: RunResearchRequest):
    llm = LLMService()
    final_report: Optional[dict] = None
    async for ev in run_research_pipeline_stream(
        question=payload.question,
        audience=payload.audience,
        depth=payload.depth,
        enabled_sources=payload.enabled_sources,
        pdf_ids=payload.pdf_ids,
        provided_plan=payload.plan,
        llm_service=llm,
    ):
        if ev["event"] == "complete":
            final_report = ev["data"]
    if not final_report:
        raise HTTPException(status_code=500, detail="Research pipeline did not produce a report.")
    return ResearchReport.model_validate(final_report)


# ---------------------------------------------------------------------------
# Reports CRUD & PDF Export
# ---------------------------------------------------------------------------

@app.get("/api/reports", response_model=list[ReportListItem])
def list_reports(q: str = Query(default="")):
    return database.list_reports(search=q)


@app.get("/api/reports/{report_id}", response_model=ResearchReport)
def get_report(report_id: str):
    rep = database.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    return rep


@app.post("/api/reports/{report_id}/star")
def toggle_star(report_id: str):
    res = database.toggle_star_report(report_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"id": report_id, "is_starred": res}


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: str):
    ok = database.delete_report(report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"deleted": True, "id": report_id}


@app.get("/api/reports/{report_id}/export/pdf")
def export_report_pdf(report_id: str):
    rep = database.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    pdf_bytes = generate_report_pdf(rep)
    safe_slug = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in rep.research_title[:48]).strip("_")
    filename = f"ResearchMate_{safe_slug or report_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Feature 6: AI Research Chat
# ---------------------------------------------------------------------------

@app.get("/api/reports/{report_id}/chat", response_model=list[ChatMessageModel])
def get_report_chat(report_id: str):
    if not database.get_report(report_id):
        raise HTTPException(status_code=404, detail="Report not found.")
    return database.list_chat_messages(report_id)


@app.post("/api/reports/{report_id}/chat")
async def post_report_chat(report_id: str, payload: ChatRequest):
    rep = database.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    llm = LLMService()
    user_msg, assistant_msg = await answer_followup_question(rep, payload.message, llm)
    return {"user_message": user_msg, "assistant_message": assistant_msg}


@app.delete("/api/reports/{report_id}/chat")
def clear_report_chat(report_id: str):
    database.clear_chat_messages(report_id)
    return {"cleared": True}


# ---------------------------------------------------------------------------
# Feature 7: PDF Upload, Extraction, Analysis & Web Comparison
# ---------------------------------------------------------------------------

@app.post("/api/pdfs/upload", response_model=PdfDocumentResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported.")
    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")
    if len(pdf_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF file exceeds 25 MB upload limit.")

    try:
        extracted = extract_pdf_bytes(pdf_bytes, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse PDF with PyMuPDF: {exc}") from exc

    pdf_id = f"pdf-{uuid.uuid4().hex[:10]}"
    upload_dir = get_settings().resolved_upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path = upload_dir / f"{pdf_id}.pdf"
    saved_path.write_bytes(pdf_bytes)

    llm = LLMService()
    analysis = await analyze_pdf_document(
        title=extracted["title"],
        pages=extracted["pages"],
        full_text=extracted["full_text"],
        llm_service=llm,
    )

    return database.save_pdf_record(
        pdf_id=pdf_id,
        filename=file.filename,
        file_path=str(saved_path),
        title=extracted["title"],
        author=extracted["author"],
        page_count=extracted["page_count"],
        word_count=extracted["word_count"],
        full_text=extracted["full_text"],
        pages=extracted["pages"],
        analysis=analysis,
    )


@app.get("/api/pdfs", response_model=list[PdfDocumentResponse])
def list_pdfs():
    return database.list_pdfs()


@app.get("/api/pdfs/{pdf_id}")
def get_pdf_detail(pdf_id: str):
    raw = database.get_pdf_raw(pdf_id)
    if not raw:
        raise HTTPException(status_code=404, detail="PDF document not found.")
    return {
        "id": raw["id"],
        "filename": raw["filename"],
        "title": raw["title"],
        "author": raw["author"],
        "page_count": raw["page_count"],
        "word_count": raw["word_count"],
        "full_text": raw["full_text"],
        "pages": raw["pages"],
        "analysis": raw["analysis"],
        "created_at": raw["created_at"],
    }


@app.post("/api/pdfs/{pdf_id}/compare-web", response_model=ResearchReport)
async def compare_pdf_with_web(pdf_id: str, payload: PdfWebComparisonRequest):
    raw = database.get_pdf_raw(pdf_id)
    if not raw:
        raise HTTPException(status_code=404, detail="PDF document not found.")

    focus = (payload.focus_question or "").strip() or (
        f"Compare the claims and findings in '{raw['title']}' against current web and peer-reviewed academic evidence"
    )
    llm = LLMService()
    final_report: Optional[dict] = None
    async for ev in run_research_pipeline_stream(
        question=focus,
        audience=payload.audience,
        depth=payload.depth,
        enabled_sources=["uploaded_pdf", "web", "academic_paper", "knowledge_base"],
        pdf_ids=[pdf_id],
        provided_plan=None,
        llm_service=llm,
    ):
        if ev["event"] == "complete":
            final_report = ev["data"]
    if not final_report:
        raise HTTPException(status_code=500, detail="PDF vs Web comparison failed.")
    return ResearchReport.model_validate(final_report)


@app.delete("/api/pdfs/{pdf_id}")
def delete_pdf(pdf_id: str):
    ok = database.delete_pdf(pdf_id)
    if not ok:
        raise HTTPException(status_code=404, detail="PDF document not found.")
    return {"deleted": True, "id": pdf_id}


# ---------------------------------------------------------------------------
# Knowledge Base CRUD
# ---------------------------------------------------------------------------

@app.get("/api/knowledge-base", response_model=list[KnowledgeBaseDoc])
def list_kb():
    return database.list_kb_docs()


@app.post("/api/knowledge-base", response_model=KnowledgeBaseDoc)
def create_kb(payload: KnowledgeBaseCreate):
    return database.create_kb_doc(payload)


@app.delete("/api/knowledge-base/{doc_id}")
def delete_kb(doc_id: str):
    ok = database.delete_kb_doc(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Knowledge base document not found.")
    return {"deleted": True, "id": doc_id}


# ---------------------------------------------------------------------------
# Authentication (Sign Up & Log In)
# ---------------------------------------------------------------------------

@app.post("/api/auth/signup", response_model=AuthUserResponse)
def auth_signup(payload: AuthSignUpRequest):
    try:
        return database.create_user(
            country_code=payload.country_code,
            phone_number=payload.phone_number,
            gmail=payload.gmail,
            username=payload.username,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/auth/login", response_model=AuthUserResponse)
def auth_login(payload: AuthLoginRequest):
    try:
        return database.authenticate_user(
            identifier=payload.identifier,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# User Profile, Activity, Posts, Scheduled Content & Problem Reports
# ---------------------------------------------------------------------------

@app.get("/api/profile", response_model=ProfileOverviewResponse)
def get_profile(user_id: str = Query(default="guest-demo"), username: str = Query(default="")):
    return database.get_profile_overview(user_id=user_id, username_hint=username)


@app.put("/api/profile", response_model=ProfileOverviewResponse)
def update_profile(payload: ProfileUpdateRequest, user_id: str = Query(default="guest-demo")):
    try:
        return database.update_profile_details(user_id=user_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.put("/api/profile/settings", response_model=ProfileSettingsModel)
def update_profile_settings(payload: ProfileSettingsModel, user_id: str = Query(default="guest-demo")):
    return database.update_profile_settings(user_id=user_id, payload=payload)


@app.post("/api/profile/posts", response_model=ProfileFeedItem)
def create_profile_post(payload: ProfilePostCreate, user_id: str = Query(default="guest-demo")):
    return database.create_profile_post(user_id=user_id, payload=payload)


@app.post("/api/profile/items/{item_id}/like")
def toggle_profile_item_like(item_id: str):
    return database.toggle_item_like(item_id)


@app.post("/api/profile/items/{item_id}/save")
def toggle_profile_item_save(item_id: str, kind: str = Query(default="post")):
    return database.toggle_item_save(item_id, kind)


@app.get("/api/profile/saved-images", response_model=list[SavedImageItem])
def list_profile_saved_images(user_id: str = Query(default="guest-demo")):
    return database.list_saved_images(user_id=user_id)


@app.post("/api/profile/saved-images/toggle")
def toggle_profile_saved_image(
    payload: SavedImageToggleRequest,
    user_id: str = Query(default="guest-demo"),
):
    return database.toggle_saved_image(user_id=user_id, payload=payload)


@app.delete("/api/profile/saved-images/{image_id}")
def delete_profile_saved_image(image_id: str):
    ok = database.delete_saved_image(image_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Saved image not found.")
    return {"deleted": True, "id": image_id}


@app.post("/api/profile/scheduled", response_model=ScheduledPostItem)
def create_scheduled_post(payload: ScheduledPostCreate, user_id: str = Query(default="guest-demo")):
    return database.create_scheduled_item(user_id=user_id, payload=payload)


@app.delete("/api/profile/scheduled/{sched_id}")
def delete_scheduled_post(sched_id: str):
    ok = database.delete_scheduled_item(sched_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scheduled item not found.")
    return {"deleted": True, "id": sched_id}


@app.post("/api/profile/heartbeat")
def profile_heartbeat(user_id: str = Query(default="guest-demo"), seconds: int = Query(default=15)):
    total_today = database.record_activity_heartbeat(user_id=user_id, seconds=seconds)
    return {"user_id": user_id, "seconds_today": total_today}


@app.post("/api/profile/problem-reports", response_model=ProblemReportResponse)
async def submit_problem_report(
    description: str = Form(..., min_length=10, max_length=3000),
    user_id: str = Form(default="guest-demo"),
    screenshot: Optional[UploadFile] = File(default=None),
):
    saved_filename = None
    saved_path = None
    if screenshot and screenshot.filename:
        raw_bytes = await screenshot.read()
        if len(raw_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Screenshot exceeds 10 MB limit.")
        prob_dir = get_settings().resolved_upload_dir / "problem_reports"
        prob_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex[:8]}_{screenshot.filename.replace(' ', '_')}"
        dest = prob_dir / safe_name
        dest.write_bytes(raw_bytes)
        saved_filename = screenshot.filename
        saved_path = str(dest)

    return database.save_problem_report(
        user_id=user_id,
        description=description,
        screenshot_filename=saved_filename,
        screenshot_path=saved_path,
    )
