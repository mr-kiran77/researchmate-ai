"""Automated integration & unit tests for ResearchMate AI backend."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import fitz
import pytest
from fastapi.testclient import TestClient

# Point tests at an isolated temporary SQLite database & upload folder
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

TEST_DB = BACKEND_ROOT / "data" / "test_researchmate.db"
TEST_UPLOADS = BACKEND_ROOT / "data" / "test_uploads"
os.environ["DATABASE_PATH"] = str(TEST_DB)
os.environ["UPLOAD_DIR"] = str(TEST_UPLOADS)
os.environ["GEMINI_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""

from app.config import get_settings  # noqa: E402
get_settings.cache_clear()

from app import database  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas import SourceItem, VerifiedClaim, ConflictItem  # noqa: E402
from app.services.research_agent import _enforce_verification_integrity  # noqa: E402


def _make_sample_pdf_bytes() -> bytes:
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text(
        (72, 72),
        "Empirical Study on AI Tutoring in Higher Education\n\n"
        "Abstract: Controlled university trials in 2025 found that structured AI tutors improved "
        "student problem-solving speed by 28% compared with static study handouts.\n"
        "Methodology: We evaluated 420 undergraduate students across STEM modules.\n",
    )
    p2 = doc.new_page()
    p2.insert_text(
        (72, 72),
        "Findings and Limitations:\n"
        "However, unguided generative AI usage caused cognitive offloading and citation hallucinations in 24% of drafts. "
        "Limitations include single-semester duration and reliance on self-reported survey adherence.",
    )
    raw = doc.tobytes()
    doc.close()
    return raw


@pytest.fixture(autouse=True)
def reset_test_db():
    if TEST_DB.exists():
        TEST_DB.unlink()
    database.init_db()
    yield


def test_health_never_leaks_secrets():
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["app_name"] == "ResearchMate AI"
        assert "gemini_api_key" not in str(body).lower()
        assert body["capabilities"]["active_llm_provider"] == "extractive_fallback"


def test_verification_guardrail_downgrades_uncorroborated_claims():
    sources = [
        SourceItem(
            source_id="S1",
            title="Source One",
            source_type="academic_paper",
            provider="OpenAlex",
            publication_date="2025-05-01",
            publication_year=2025,
            relevant_information="AI tutors improved formative scores.",
        ),
        SourceItem(
            source_id="S2",
            title="Source Two",
            source_type="web",
            provider="Wikipedia",
            publication_date="2025-06-01",
            publication_year=2025,
            relevant_information="AI tutors improved formative scores and speed.",
        ),
    ]
    claims = [
        VerifiedClaim(
            claim_id="C1",
            claim_text="Unsupported hallucinated claim",
            claim_category="verified_fact",
            verification_status="Verified",
            confidence_score=95,
            is_verified_fact=True,
            supporting_source_ids=["S999"],
            contradicting_source_ids=[],
            evidence_excerpts=[],
            distinction_note="Claimed verified without source.",
        ),
        VerifiedClaim(
            claim_id="C2",
            claim_text="Single source claim",
            claim_category="verified_fact",
            verification_status="Verified",
            confidence_score=92,
            is_verified_fact=True,
            supporting_source_ids=["S1"],
            contradicting_source_ids=[],
            evidence_excerpts=[],
            distinction_note="Only 1 source.",
        ),
        VerifiedClaim(
            claim_id="C3",
            claim_text="Multi-source corroborated claim",
            claim_category="verified_fact",
            verification_status="Verified",
            confidence_score=88,
            is_verified_fact=True,
            supporting_source_ids=["S1", "S2"],
            contradicting_source_ids=[],
            evidence_excerpts=[],
            distinction_note="Corroborated.",
        ),
    ]
    cleaned, _ = _enforce_verification_integrity(claims, [], sources)
    assert cleaned[0].is_verified_fact is False
    assert cleaned[0].claim_category == "insufficient_evidence"
    assert cleaned[0].confidence_score <= 35

    assert cleaned[1].is_verified_fact is False
    assert cleaned[1].claim_category == "single_source_claim"

    assert cleaned[2].is_verified_fact is True
    assert cleaned[2].verification_status == "Verified (Multi-Source)"


def test_plan_pdf_upload_research_chat_and_pdf_export():
    with TestClient(app) as client:
        # 1. Preferences
        pref_res = client.get("/api/preferences")
        assert pref_res.status_code == 200
        assert pref_res.json()["default_audience"] == "academic"

        # 2. PDF Upload & PyMuPDF Analysis
        pdf_bytes = _make_sample_pdf_bytes()
        up_res = client.post(
            "/api/pdfs/upload",
            files={"file": ("ai_tutoring_study.pdf", pdf_bytes, "application/pdf")},
        )
        assert up_res.status_code == 200
        pdf_doc = up_res.json()
        assert pdf_doc["page_count"] == 2
        assert pdf_doc["word_count"] > 40
        assert len(pdf_doc["analysis"]["important_findings"]) >= 1
        pdf_id = pdf_doc["id"]

        # 3. Question Analyzer / Plan
        plan_res = client.post(
            "/api/research/plan",
            json={
                "question": "What are the advantages and disadvantages of Artificial Intelligence in education?",
                "audience": "academic",
                "depth": "standard",
                "pdf_ids": [pdf_id],
            },
        )
        assert plan_res.status_code == 200
        plan = plan_res.json()
        assert len(plan["sub_questions"]) >= 3
        assert plan["research_objective"]

        # 4. Run full multi-source research (Knowledge Base + Uploaded PDF + Web/Academic)
        run_res = client.post(
            "/api/research/run",
            json={
                "question": "What are the advantages and disadvantages of Artificial Intelligence in education?",
                "audience": "academic",
                "depth": "quick",
                "enabled_sources": ["uploaded_pdf", "knowledge_base"],
                "pdf_ids": [pdf_id],
                "plan": plan,
            },
        )
        assert run_res.status_code == 200
        report = run_res.json()
        report_id = report["id"]

        # Verify all 14 required sections are present and populated
        assert report["research_title"]
        assert report["executive_summary"]
        assert report["research_objective"]
        assert len(report["research_questions"]["sub_questions"]) >= 3
        assert len(report["methodology_and_sources"]["source_types_searched"]) >= 2
        assert len(report["key_findings"]) >= 1
        assert len(report["detailed_analysis"]) >= 1
        assert len(report["source_comparison"]["comparison_rows"]) >= 2
        assert "conflicts" in report["conflicting_information"]
        assert len(report["evidence_and_citations"]) >= 1
        assert len(report["limitations_of_research"]) >= 1
        assert len(report["open_questions"]) >= 1
        assert report["conclusion"]
        assert len(report["references"]) >= 2
        assert 4 <= len(report["related_images"]) <= 6
        assert all(img["image_url"] for img in report["related_images"])

        # 5. Export report as PDF via PyMuPDF Story
        pdf_exp = client.get(f"/api/reports/{report_id}/export/pdf")
        assert pdf_exp.status_code == 200
        assert pdf_exp.headers["content-type"] == "application/pdf"
        assert pdf_exp.content.startswith(b"%PDF")

        # 6. Contextual Research Chat
        chat_res = client.post(
            f"/api/reports/{report_id}/chat",
            json={"message": "Explain the second finding in simple English"},
        )
        assert chat_res.status_code == 200
        assert chat_res.json()["assistant_message"]["content"]

        chat_res2 = client.post(
            f"/api/reports/{report_id}/chat",
            json={"message": "Which source is more reliable?"},
        )
        assert chat_res2.status_code == 200
        assert len(chat_res2.json()["assistant_message"]["cited_source_ids"]) >= 1

        # 7. Knowledge Base CRUD & Report History Star
        star_res = client.post(f"/api/reports/{report_id}/star")
        assert star_res.status_code == 200
        assert star_res.json()["is_starred"] is True

        kb_res = client.post(
            "/api/knowledge-base",
            json={
                "title": "Test KB Note",
                "category": "Testing",
                "author_or_publisher": "Pytest",
                "publication_date": "2026-02-01",
                "content": "Structured testing ensures verification rules never trust unverified claims.",
                "tags": ["test"],
            },
        )
        assert kb_res.status_code == 200
        kb_id = kb_res.json()["id"]
        assert client.delete(f"/api/knowledge-base/{kb_id}").status_code == 200


def test_conflict_detection_and_sse_streaming_and_preferences():
    from app.services.research_agent import _deterministic_verify_and_detect_conflicts

    # Conflicting pair on AI tutoring outcomes
    sources = [
        SourceItem(
            source_id="S1",
            title="Controlled Physics Tutoring Trial",
            source_type="academic_paper",
            provider="OpenAlex",
            publication_date="2025-04-01",
            publication_year=2025,
            relevant_information=(
                "Controlled university trials found that adaptive artificial intelligence tutoring systems "
                "significantly improve student learning gains and problem-solving speed by 28%."
            ),
        ),
        SourceItem(
            source_id="S2",
            title="Longitudinal Classroom Risk Audit",
            source_type="web",
            provider="Wikipedia",
            publication_date="2025-09-01",
            publication_year=2025,
            relevant_information=(
                "However, unguided artificial intelligence tutoring systems risk severe cognitive offloading, "
                "skill decline, and citation hallucination failures in student assignments."
            ),
        ),
    ]
    bundle = _deterministic_verify_and_detect_conflicts(
        "What are the advantages and disadvantages of artificial intelligence tutoring systems?",
        sources,
    )
    assert len(bundle.conflicts) >= 1
    cf = bundle.conflicts[0]
    assert cf.source_a_id != cf.source_b_id
    assert cf.possible_reasons
    assert cf.what_remains_uncertain

    with TestClient(app) as client:
        # Update preferences
        upd = client.put(
            "/api/preferences",
            json={
                "default_audience": "student",
                "default_depth": "quick",
                "enabled_sources": ["knowledge_base", "uploaded_pdf"],
                "citation_style": "apa",
            },
        )
        assert upd.status_code == 200
        assert upd.json()["default_audience"] == "student"

        # SSE stream endpoint returns progress + plan + sources_found + verification + complete
        events = []
        with client.stream(
            "POST",
            "/api/research/run/stream",
            json={
                "question": "What are the advantages and disadvantages of Artificial Intelligence in education?",
                "audience": "student",
                "depth": "quick",
                "enabled_sources": ["knowledge_base"],
            },
        ) as stream_resp:
            assert stream_resp.status_code == 200
            for line in stream_resp.iter_lines():
                if line.startswith("event:"):
                    events.append(line[6:].strip())
        assert "plan" in events
        assert "sources_found" in events
        assert "verification" in events
        assert "complete" in events


def test_auth_signup_and_login():
    with TestClient(app) as client:
        # Invalid Gmail rejected (422)
        bad_gmail = client.post(
            "/api/auth/signup",
            json={
                "country_code": "+1",
                "phone_number": "9876543210",
                "gmail": "user@yahoo.com",
                "username": "alex_research",
                "password": "Password123",
            },
        )
        assert bad_gmail.status_code == 422

        # Invalid phone (<10 digits) rejected (422)
        bad_phone = client.post(
            "/api/auth/signup",
            json={
                "country_code": "+1",
                "phone_number": "12345",
                "gmail": "alex.test@gmail.com",
                "username": "alex_research",
                "password": "Password123",
            },
        )
        assert bad_phone.status_code == 422

        # Valid Sign Up succeeds
        ok = client.post(
            "/api/auth/signup",
            json={
                "country_code": "+91",
                "phone_number": "9876543210",
                "gmail": "alex.test@gmail.com",
                "username": "alex_research",
                "password": "Password123",
            },
        )
        assert ok.status_code == 200
        user = ok.json()
        assert user["username"] == "alex_research"
        assert user["gmail"] == "alex.test@gmail.com"
        assert "password" not in str(user).lower()

        # Login with username, Gmail, and 10-digit phone all succeed
        for ident in ("alex_research", "alex.test@gmail.com", "9876543210"):
            login_res = client.post(
                "/api/auth/login",
                json={"identifier": ident, "password": "Password123"},
            )
            assert login_res.status_code == 200
            assert login_res.json()["id"] == user["id"]

        # Wrong password rejected (401)
        wrong = client.post(
            "/api/auth/login",
            json={"identifier": "alex_research", "password": "WrongPassword"},
        )
        assert wrong.status_code == 401


def test_real_profile_data_crud_and_activity():
    with TestClient(app) as client:
        # Create a real user
        su = client.post(
            "/api/auth/signup",
            json={
                "country_code": "+1",
                "phone_number": "9123456789",
                "gmail": "real.user@gmail.com",
                "username": "real_researcher",
                "password": "Password123",
            },
        )
        assert su.status_code == 200
        uid = su.json()["id"]

        # Load real profile (no fake 1248 followers or fake hardcoded posts)
        prof = client.get(f"/api/profile?user_id={uid}")
        assert prof.status_code == 200
        data = prof.json()
        assert data["username"] == "real_researcher"
        assert data["followers_count"] == 0
        assert data["posts_count"] == len(data["posts"])

        # Edit profile persists
        upd = client.put(
            f"/api/profile?user_id={uid}",
            json={
                "username": "real_researcher_v2",
                "full_name": "Dr. Real Researcher",
                "bio": "Studying verified citations.",
                "avatar_url": "",
            },
        )
        assert upd.status_code == 200
        assert upd.json()["full_name"] == "Dr. Real Researcher"
        assert upd.json()["username"] == "real_researcher_v2"

        # Create real post, toggle like & save
        post = client.post(
            f"/api/profile/posts?user_id={uid}",
            json={"title": "Real Finding", "caption": "Verified across 3 papers.", "category": "Note"},
        )
        assert post.status_code == 200
        pid = post.json()["id"]
        assert client.post(f"/api/profile/items/{pid}/like").json()["likes"] == 1
        assert client.post(f"/api/profile/items/{pid}/save?kind=post").json()["saved"] is True

        # Create scheduled item, record heartbeat, submit problem report
        sched = client.post(
            f"/api/profile/scheduled?user_id={uid}",
            json={"title": "AI Governance", "caption": "Check 2026 rules", "scheduled_for": "2026-12-10T09:00"},
        )
        assert sched.status_code == 200
        assert client.post(f"/api/profile/heartbeat?user_id={uid}&seconds=45").json()["seconds_today"] >= 45
        prob = client.post(
            "/api/profile/problem-reports",
            data={"user_id": uid, "description": "Testing real SQLite problem report persistence."},
        )
        assert prob.status_code == 200

        final_prof = client.get(f"/api/profile?user_id={uid}").json()
        assert final_prof["posts_count"] >= 1
        assert len(final_prof["scheduled"]) == 1
        assert final_prof["activity"]["seconds_today"] >= 45
        assert final_prof["activity"]["likes_given"] >= 1
        assert final_prof["problem_reports_count"] == 1


def test_related_images_and_quick_topic_search(monkeypatch):
    """Verify Related Images endpoints & SVG fallback cards work reliably even offline."""
    from app.services import image_search_service

    async def empty_remote(*_args, **_kwargs):
        return []

    # Simulate external image providers returning nothing (niche topic / offline)
    monkeypatch.setattr(image_search_service, "_search_wikipedia_pageimages", empty_remote)
    monkeypatch.setattr(image_search_service, "_search_wikimedia_commons", empty_remote)
    monkeypatch.setattr(image_search_service, "_search_openverse", empty_remote)

    with TestClient(app) as client:
        # 1. Direct Related Images endpoint returns 4-6 safe fallback visuals without broken URLs
        img_res = client.get("/api/research/images", params={"q": "Quantum Computing", "limit": 6})
        assert img_res.status_code == 200
        imgs = img_res.json()
        assert 4 <= len(imgs) <= 6
        assert all(i["is_fallback"] is True for i in imgs)
        assert all(i["image_url"].startswith("data:image/svg+xml;utf8,") for i in imgs)
        assert "Quantum" in imgs[0]["title"]

        # 2. Combined Quick Topic Search returns written info, tags & up to 8 related images
        quick_res = client.get(
            "/api/research/quick",
            params={"q": "Artificial Intelligence education", "limit": 8},
        )
        assert quick_res.status_code == 200
        qbody = quick_res.json()
        assert qbody["summary_title"]
        assert qbody["summary_text"]
        assert len(qbody["tags"]) >= 1
        assert len(qbody["related_images"]) == 8
        assert all(img["image_url"] for img in qbody["related_images"])

        # 3. Saving a topic image connects directly to the user's Saved collection in SQLite
        first_img = qbody["related_images"][0]
        save_res = client.post(
            "/api/profile/saved-images/toggle?user_id=img-user-1",
            json={
                "image_key": f"key-{first_img['id']}",
                "topic": "Artificial Intelligence education",
                "title": first_img["title"],
                "caption": first_img["caption"],
                "image_url": first_img["image_url"],
                "thumbnail_url": first_img["thumbnail_url"],
                "source_page_url": first_img["source_page_url"],
                "photographer_or_source": first_img["photographer_or_source"],
            },
        )
        assert save_res.status_code == 200
        assert save_res.json()["saved"] is True

        prof = client.get("/api/profile?user_id=img-user-1").json()
        assert len(prof["saved_images"]) == 1
        assert prof["activity"]["saved_count"] >= 1

