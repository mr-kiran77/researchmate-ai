"""Agentic 6-stage Research Pipeline: Planning, Multi-Source Search, Verification, Conflict Detection, Synthesis."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from collections import Counter, defaultdict
from typing import AsyncIterator, Optional

from pydantic import BaseModel, Field

from app import database
from app.schemas import (
    AnalysisSection,
    AudienceType,
    ChartSeriesItem,
    ConflictItem,
    ConflictSectionData,
    DepthType,
    EvidenceExcerpt,
    KeyFinding,
    MethodologySection,
    PlanStep,
    ReferenceEntry,
    RelatedImage,
    ReportAnalytics,
    ResearchPlan,
    ResearchQuestionsSection,
    ResearchReport,
    SourceComparisonRow,
    SourceComparisonSection,
    SourceItem,
    SourceType,
    SubQuestion,
    VerifiedClaim,
)
from app.services.image_search_service import search_related_images
from app.services.llm_service import LLMService
from app.services.search_service import execute_multi_source_search

STOPWORDS = {
    "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "have",
    "has", "had", "not", "but", "what", "which", "when", "where", "how", "why", "who",
    "into", "about", "than", "then", "also", "such", "more", "most", "some", "many",
    "these", "those", "their", "there", "been", "being", "between", "among", "during",
    "through", "while", "using", "based", "could", "would", "should", "can", "will",
}

POSITIVE_CUES = {
    "advantage", "advantages", "benefit", "benefits", "improve", "improves", "improved",
    "effective", "efficiency", "gain", "gains", "increase", "increases", "faster",
    "higher", "positive", "success", "reduce", "reduced", "better", "growth", "support",
}
NEGATIVE_CUES = {
    "disadvantage", "disadvantages", "risk", "risks", "harm", "harms", "concern",
    "concerns", "limitation", "limitations", "challenge", "challenges", "fail",
    "failure", "bias", "unreliable", "drop", "regain", "loss", "cost", "costs",
    "negative", "decline", "worse", "problem", "problems", "atrophy", "false",
    "plagiarism", "hallucination", "bottleneck", "deficit", "turnover",
}
HEDGING_CUES = {
    "may", "might", "could", "suggests", "potentially", "likely", "appears",
    "estimated", "forecast", "projected", "hypothesized", "speculated", "argues",
}


# ---------------------------------------------------------------------------
# Structured LLM Intermediate Payloads
# ---------------------------------------------------------------------------

class _VerificationBundle(BaseModel):
    claims: list[VerifiedClaim]
    conflicts: list[ConflictItem] = Field(default_factory=list)
    conflict_summary: str


class _SourceContribution(BaseModel):
    source_id: str
    contribution: str


class _ReportSynthesisBundle(BaseModel):
    research_title: str
    executive_summary: str
    key_findings: list[KeyFinding]
    detailed_analysis: list[AnalysisSection]
    source_comparison_narrative: str
    source_contributions: list[_SourceContribution] = Field(default_factory=list)
    pdf_vs_web_summary: Optional[str] = None
    limitations_of_research: list[str]
    open_questions: list[str]
    conclusion: str


# ---------------------------------------------------------------------------
# Feature 1: Question Analyzer & Research Plan
# ---------------------------------------------------------------------------

def _clean_topic_phrase(question: str) -> str:
    q = question.strip().rstrip("?!.")
    q = re.sub(
        r"^(what are the|what is the|how does|how do|why is|compare|explain|analyze|evaluate)\s+",
        "",
        q,
        flags=re.IGNORECASE,
    )
    return q[:120].strip() or question.strip()[:120]


def _deterministic_plan(
    question: str,
    audience: AudienceType,
    depth: DepthType,
    pdf_ids: list[str],
) -> ResearchPlan:
    topic = _clean_topic_phrase(question)
    low = question.lower()

    pdf_titles: list[str] = []
    for pid in pdf_ids:
        rec = database.get_pdf_raw(pid)
        if rec:
            pdf_titles.append(rec["title"])

    is_pros_cons = any(k in low for k in ("advantage", "disadvantage", "pros", "cons", "benefit", "risk", "impact"))
    is_compare = any(k in low for k in (" vs ", "versus", "compare", "comparison", "difference between"))

    sub_questions: list[SubQuestion] = []
    if is_pros_cons:
        sub_questions = [
            SubQuestion(
                id="SQ1",
                question=f"What are the primary documented advantages, mechanisms, and measurable benefits regarding {topic}?",
                information_needed="Empirical studies, adoption metrics, efficiency/performance improvements, and institutional reports.",
                target_sources=["academic_paper", "web", "knowledge_base"],
                search_query=f"{topic} benefits empirical evidence outcomes",
            ),
            SubQuestion(
                id="SQ2",
                question=f"What are the major disadvantages, empirical risks, failure modes, and unintended consequences of {topic}?",
                information_needed="Peer-reviewed critiques, failure rates, equity/bias concerns, cost barriers, and longitudinal drawbacks.",
                target_sources=["academic_paper", "web", "knowledge_base"],
                search_query=f"{topic} risks limitations challenges critiques",
            ),
            SubQuestion(
                id="SQ3",
                question=f"Where do recent studies and policy frameworks disagree on {topic}, and what conditions govern success vs. failure?",
                information_needed="Comparative meta-analyses, recent 2024–2026 benchmarks, governance policies, and contradictory findings.",
                target_sources=["academic_paper", "web", "knowledge_base"],
                search_query=f"{topic} policy framework meta analysis conflicting evidence",
            ),
        ]
    elif is_compare:
        sub_questions = [
            SubQuestion(
                id="SQ1",
                question=f"How do the core technical/operational mechanisms compare in: {topic}?",
                information_needed="Benchmark metrics, performance specifications, and primary definitions.",
                target_sources=["academic_paper", "web", "knowledge_base"],
                search_query=f"{topic} technical benchmark comparison",
            ),
            SubQuestion(
                id="SQ2",
                question=f"What are the cost, scalability, and real-world adoption trade-offs in {topic}?",
                information_needed="Economic analyses, deployment timelines, and independent industry/academic evaluations.",
                target_sources=["web", "academic_paper", "knowledge_base"],
                search_query=f"{topic} cost scalability adoption tradeoffs",
            ),
            SubQuestion(
                id="SQ3",
                question=f"Which claims about {topic} remain contested or lack long-term empirical consensus?",
                information_needed="Conflicting forecasts, vendor vs. independent study gaps, and limitations.",
                target_sources=["academic_paper", "web"],
                search_query=f"{topic} limitations challenges forecast disagreement",
            ),
        ]
    else:
        sub_questions = [
            SubQuestion(
                id="SQ1",
                question=f"What is the foundational context, definition, and current state of evidence on {topic}?",
                information_needed="Authoritative definitions, baseline context, and recent 2024–2026 overview data.",
                target_sources=["web", "knowledge_base", "academic_paper"],
                search_query=f"{topic} overview evidence definition",
            ),
            SubQuestion(
                id="SQ2",
                question=f"What do empirical and peer-reviewed studies establish about outcomes and effectiveness for {topic}?",
                information_needed="Quantitative findings, trial/study metrics, and causal or correlational evidence.",
                target_sources=["academic_paper", "knowledge_base"],
                search_query=f"{topic} empirical study findings research paper",
            ),
            SubQuestion(
                id="SQ3",
                question=f"What are the key limitations, controversies, and open questions surrounding {topic}?",
                information_needed="Counter-evidence, methodological caveats, contradictory claims, and regulatory/ethical gaps.",
                target_sources=["web", "academic_paper"],
                search_query=f"{topic} limitations controversies challenges",
            ),
        ]

    if depth == "deep" and len(sub_questions) < 4:
        sub_questions.append(
            SubQuestion(
                id=f"SQ{len(sub_questions) + 1}",
                question=f"What are the emerging trends (2025–2026) and practical implications of {topic} for {audience}s?",
                information_needed="Recent policy guidance, applied case studies, and forward-looking recommendations.",
                target_sources=["web", "academic_paper", "knowledge_base"],
                search_query=f"{topic} 2025 2026 trends implications recommendations",
            )
        )

    if pdf_titles:
        sub_questions.append(
            SubQuestion(
                id=f"SQ{len(sub_questions) + 1}",
                question=f"How do the findings in uploaded PDF document(s) ({', '.join(t[:45] for t in pdf_titles)}) align or conflict with external web and academic evidence?",
                information_needed="Direct page-level quotes from uploaded PDFs cross-referenced against external web and peer-reviewed findings.",
                target_sources=["uploaded_pdf", "web", "academic_paper"],
                search_query=f"{topic} {' '.join(pdf_titles[0].split()[:5])}",
            )
        )

    return ResearchPlan(
        question=question,
        question_understanding=(
            f"The inquiry asks for a structured, evidence-backed evaluation of '{topic}', tailored for a {audience} audience "
            f"at {depth} depth. Answering rigorously requires separating verified empirical outcomes from speculative claims and "
            f"surfacing contradictions across source types."
        ),
        domain="Interdisciplinary Evidence Synthesis",
        research_objective=(
            f"Systematically investigate '{question}' by decomposing the topic into {len(sub_questions)} independent sub-questions, "
            f"gathering evidence across multiple independent source types, verifying claims, and surfacing source conflicts."
        ),
        sub_questions=sub_questions,
        plan_steps=[
            PlanStep(step_number=1, title="Question Analysis & Decomposition", description="Break the primary research question into targeted sub-questions and evidence criteria.", status="completed"),
            PlanStep(step_number=2, title="Multi-Source Retrieval", description="Query web sources, academic paper indexes, knowledge base briefs, and uploaded PDFs independently per sub-question.", status="pending"),
            PlanStep(step_number=3, title="Deduplication & Credibility Scoring", description="Remove duplicate URLs/titles and score sources by relevance, authority, and recency.", status="pending"),
            PlanStep(step_number=4, title="Fact Verification & Conflict Detection", description="Cross-check claims across independent sources, separate verified facts from assumptions, and isolate contradictions.", status="pending"),
            PlanStep(step_number=5, title="14-Section Report Synthesis", description="Compile structured findings with clickable source citations, limitations, open questions, and analytics.", status="pending"),
        ],
        expected_challenges=[
            "Balancing recent industry/news developments against slower peer-reviewed publication cycles.",
            "Separating controlled-study findings from broad commercial or promotional claims.",
            "Ensuring contradictory metrics or study scopes are preserved transparently rather than smoothed over.",
        ],
    )


async def generate_research_plan(
    question: str,
    audience: AudienceType,
    depth: DepthType,
    pdf_ids: list[str],
    llm_service: LLMService,
) -> ResearchPlan:
    """Feature 1: Analyze the research question and construct an actionable research plan."""
    pdf_notes = []
    for pid in pdf_ids:
        rec = database.get_pdf_raw(pid)
        if rec:
            pdf_notes.append(f"- Uploaded PDF '{rec['title']}' ({rec['page_count']} pages): {rec['analysis'].summary[:240]}")

    sub_q_target = "3" if depth == "quick" else "4" if depth == "standard" else "5"
    prompt = (
        f"Research Question: {question}\n"
        f"Target Audience: {audience}\n"
        f"Research Depth: {depth}\n"
        f"Attached PDFs:\n{chr(10).join(pdf_notes) if pdf_notes else 'None'}\n\n"
        f"Create a structured research plan with {sub_q_target} focused sub-questions (IDs SQ1..SQ{sub_q_target}). "
        "Each sub-question must specify `information_needed`, `target_sources` (choose from web, academic_paper, uploaded_pdf, knowledge_base), "
        "and a concise `search_query` optimized for search APIs. Include 5 `plan_steps` and 2-4 `expected_challenges`."
    )
    parsed, _ = await llm_service.generate_structured(
        system_instruction=(
            "You are an autonomous research strategist. Understand the user's question, identify the core "
            "research objective, decompose it into mutually distinct sub-questions, and plan evidence collection."
        ),
        prompt=prompt,
        schema_model=ResearchPlan,
        thinking_level="low",
    )
    if parsed and parsed.sub_questions:
        parsed.question = question
        for idx, sq in enumerate(parsed.sub_questions, start=1):
            sq.id = f"SQ{idx}"
        if pdf_ids:
            # Ensure uploaded_pdf is included in target_sources
            for sq in parsed.sub_questions:
                if "uploaded_pdf" not in sq.target_sources:
                    sq.target_sources.append("uploaded_pdf")
        if parsed.plan_steps:
            parsed.plan_steps[0].status = "completed"
        return parsed

    return _deterministic_plan(question, audience, depth, pdf_ids)


# ---------------------------------------------------------------------------
# Feature 3 & 4: Verification Integrity + Conflict Detection
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> set[str]:
    return {
        t for t in re.findall(r"\b[a-zA-Z0-9]{3,}\b", text.lower())
        if t not in STOPWORDS
    }


def _split_sentences(text: str) -> list[str]:
    clean = re.sub(r"\s+", " ", text or "").strip()
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"])", clean)
    return [s.strip() for s in sents if 40 <= len(s.strip()) <= 360]


def _enforce_verification_integrity(
    claims: list[VerifiedClaim],
    conflicts: list[ConflictItem],
    sources: list[SourceItem],
) -> tuple[list[VerifiedClaim], list[ConflictItem]]:
    """Hard structural guardrail: never allow AI to mark uncorroborated or single-source claims as verified facts."""
    source_map = {s.source_id: s for s in sources}
    valid_ids = set(source_map.keys())

    cleaned_claims: list[VerifiedClaim] = []
    for idx, cl in enumerate(claims, start=1):
        cl.claim_id = f"C{idx}"
        supp = []
        for sid in cl.supporting_source_ids:
            if sid in valid_ids and sid not in supp:
                supp.append(sid)
        contra = []
        for sid in cl.contradicting_source_ids:
            if sid in valid_ids and sid not in contra and sid not in supp:
                contra.append(sid)

        cl.supporting_source_ids = supp
        cl.contradicting_source_ids = contra
        cl.evidence_excerpts = [ex for ex in cl.evidence_excerpts if ex.source_id in valid_ids]

        if len(supp) == 0:
            cl.is_verified_fact = False
            if cl.claim_category != "interpretation_or_assumption":
                cl.claim_category = "insufficient_evidence"
                cl.verification_status = "Insufficient Evidence"
            else:
                cl.verification_status = "Interpretation / Assumption (Uncorroborated)"
            cl.confidence_score = min(cl.confidence_score, 35)
            if "insufficient" not in cl.distinction_note.lower() and "unverified" not in cl.distinction_note.lower():
                cl.distinction_note = (
                    f"{cl.distinction_note} Evidence is insufficient because zero retrieved sources directly corroborate this claim."
                ).strip()
        elif len(contra) > 0:
            cl.is_verified_fact = False
            cl.claim_category = "contradicted_or_disputed"
            cl.verification_status = "Disputed / Contradictory"
            cl.confidence_score = min(cl.confidence_score, 65)
        elif cl.claim_category == "interpretation_or_assumption":
            cl.is_verified_fact = False
            cl.verification_status = "Interpretation / Assumption"
            cl.confidence_score = min(cl.confidence_score, 74)
        elif len(supp) == 1:
            cl.is_verified_fact = False
            cl.claim_category = "single_source_claim"
            cl.verification_status = "Supported (Single Source)"
            cl.confidence_score = min(cl.confidence_score, 74)
            if "single source" not in cl.distinction_note.lower() and "corroboration" not in cl.distinction_note.lower():
                cl.distinction_note = (
                    f"{cl.distinction_note} Supported by only one retrieved source ({supp[0]}); treated as provisional pending independent corroboration."
                ).strip()
        else:
            # 2+ independent sources support it! Check recency for potentially outdated data
            years = [source_map[s].publication_year for s in supp if source_map[s].publication_year]
            if years and max(years) <= 2021:
                cl.is_verified_fact = False
                cl.claim_category = "outdated_information"
                cl.verification_status = "Potentially Outdated"
                cl.confidence_score = min(cl.confidence_score, 62)
                cl.distinction_note = (
                    f"{cl.distinction_note} All supporting sources date from {max(years)} or earlier and may not reflect current developments."
                ).strip()
            else:
                cl.is_verified_fact = True
                if cl.claim_category not in ("verified_fact", "multi_source_consensus"):
                    cl.claim_category = "verified_fact"
                cl.verification_status = "Verified (Multi-Source)"
                cl.confidence_score = max(78, min(96, cl.confidence_score))

        cleaned_claims.append(cl)

    cleaned_conflicts: list[ConflictItem] = []
    for idx, cf in enumerate(conflicts, start=1):
        if cf.source_a_id not in valid_ids or cf.source_b_id not in valid_ids or cf.source_a_id == cf.source_b_id:
            continue
        cf.conflict_id = f"CF{idx}"
        cf.source_a_title = source_map[cf.source_a_id].title
        cf.source_b_title = source_map[cf.source_b_id].title
        if not cf.possible_reasons:
            cf.possible_reasons = ["Differences in study scope, time horizon, or measurement methodology."]
        cleaned_conflicts.append(cf)

    return cleaned_claims, cleaned_conflicts


def _deterministic_verify_and_detect_conflicts(
    question: str,
    sources: list[SourceItem],
) -> _VerificationBundle:
    """Extractive cross-source fact verification and contradiction detection (used when LLM unavailable)."""
    if not sources:
        return _VerificationBundle(
            claims=[
                VerifiedClaim(
                    claim_id="C1",
                    claim_text=f"Insufficient retrieved evidence to verify factual claims for: {question}",
                    claim_category="insufficient_evidence",
                    verification_status="Insufficient Evidence",
                    confidence_score=15,
                    is_verified_fact=False,
                    supporting_source_ids=[],
                    contradicting_source_ids=[],
                    evidence_excerpts=[],
                    distinction_note="No verifiable external or document sources were retrieved; uncertainty is explicitly reported.",
                )
            ],
            conflicts=[],
            conflict_summary="No sources were retrieved to compare for contradictions.",
        )

    q_terms = _tokenize(question)
    # Gather candidate sentences from each source
    candidates: list[tuple[SourceItem, str, set[str]]] = []
    for src in sources:
        sents = _split_sentences(src.relevant_information)
        if not sents and src.relevant_information:
            sents = [src.relevant_information[:300]]
        for sent in sents[:4]:
            toks = _tokenize(sent)
            if len(toks) >= 4:
                candidates.append((src, sent, toks))

    # Build claims by clustering similar sentences across distinct sources
    claims: list[VerifiedClaim] = []
    used_sents: set[int] = set()

    # Rank candidates by overlap with question + source composite score
    indexed = sorted(
        enumerate(candidates),
        key=lambda item: (len(item[1][2] & q_terms) * 4 + item[1][0].composite_score / 25.0),
        reverse=True,
    )

    for idx, (src_a, sent_a, toks_a) in indexed:
        if idx in used_sents:
            continue
        supporting_ids = [src_a.source_id]
        excerpts = [EvidenceExcerpt(source_id=src_a.source_id, quote=sent_a[:260], stance="supports")]
        used_sents.add(idx)

        # Look for corroboration in OTHER sources
        for jdx, (src_b, sent_b, toks_b) in indexed:
            if jdx in used_sents or src_b.source_id in supporting_ids:
                continue
            overlap = len(toks_a & toks_b)
            union = len(toks_a | toks_b)
            jaccard = overlap / union if union else 0.0
            if overlap >= 4 or jaccard >= 0.22:
                supporting_ids.append(src_b.source_id)
                excerpts.append(EvidenceExcerpt(source_id=src_b.source_id, quote=sent_b[:260], stance="supports"))
                used_sents.add(jdx)
            if len(supporting_ids) >= 3:
                break

        low_sent = sent_a.lower()
        is_hedged = any(re.search(rf"\b{h}\b", low_sent) for h in HEDGING_CUES)
        is_old = bool(src_a.publication_year and src_a.publication_year <= 2021 and len(supporting_ids) == 1)

        if is_hedged and len(supporting_ids) < 2:
            cat = "interpretation_or_assumption"
            status = "Interpretation / Assumption"
            conf = 62
            note = "Phrased as an interpretation, projection, or hedged observation rather than an established empirical measurement."
        elif is_old:
            cat = "outdated_information"
            status = "Potentially Outdated"
            conf = 55
            note = f"Originated from {src_a.publication_year}; newer data may supersede this figure."
        elif len(supporting_ids) >= 2:
            cat = "verified_fact"
            status = "Verified (Multi-Source)"
            conf = min(92, 74 + len(supporting_ids) * 6)
            note = f"Corroborated across {len(supporting_ids)} independent retrieved sources ({', '.join(supporting_ids)})."
        else:
            cat = "single_source_claim"
            status = "Supported (Single Source)"
            conf = 68
            note = f"Found in source {src_a.source_id} ({src_a.provider}); requires an additional independent source for multi-source verification."

        claims.append(
            VerifiedClaim(
                claim_id=f"C{len(claims) + 1}",
                claim_text=sent_a,
                claim_category=cat,  # type: ignore[arg-type]
                verification_status=status,
                confidence_score=conf,
                is_verified_fact=(cat == "verified_fact"),
                supporting_source_ids=supporting_ids,
                contradicting_source_ids=[],
                evidence_excerpts=excerpts,
                distinction_note=note,
            )
        )
        if len(claims) >= 8:
            break

    # Add an explicit insufficient-evidence claim if fewer than 2 multi-source facts found
    if len([c for c in claims if c.is_verified_fact]) == 0:
        claims.append(
            VerifiedClaim(
                claim_id=f"C{len(claims) + 1}",
                claim_text="Cross-source empirical consensus remains limited across the currently retrieved excerpts for narrower sub-aspects of this query.",
                claim_category="insufficient_evidence",
                verification_status="Insufficient Evidence",
                confidence_score=30,
                is_verified_fact=False,
                supporting_source_ids=[],
                contradicting_source_ids=[],
                evidence_excerpts=[],
                distinction_note="Explicitly flags uncertainty where independent multi-source overlap is thin.",
            )
        )

    # Conflict Detection: compare source pairs for polarity tension, numeric discrepancy, or timeframe conflict
    conflicts: list[ConflictItem] = []
    seen_pairs: set[tuple[str, str]] = set()
    for i, (src_a, sent_a, toks_a) in enumerate(candidates):
        pos_a = len(toks_a & POSITIVE_CUES)
        neg_a = len(toks_a & NEGATIVE_CUES)
        nums_a = set(re.findall(r"\b\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?", sent_a))
        for j, (src_b, sent_b, toks_b) in enumerate(candidates):
            if j <= i or src_a.source_id == src_b.source_id:
                continue
            pair_key = tuple(sorted((src_a.source_id, src_b.source_id)))
            if pair_key in seen_pairs:
                continue
            shared = toks_a & toks_b - POSITIVE_CUES - NEGATIVE_CUES
            if len(shared) < 2:
                continue
            pos_b = len(toks_b & POSITIVE_CUES)
            neg_b = len(toks_b & NEGATIVE_CUES)
            nums_b = set(re.findall(r"\b\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?", sent_b))

            polarity_conflict = (pos_a > neg_a and neg_b > pos_b) or (neg_a > pos_a and pos_b > neg_b)
            numeric_conflict = bool(nums_a and nums_b and nums_a != nums_b and len(shared) >= 3)

            if polarity_conflict or numeric_conflict:
                seen_pairs.add(pair_key)
                reasons = []
                if src_a.source_type != src_b.source_type:
                    reasons.append(f"Source type divergence ({src_a.source_type.replace('_', ' ')} vs. {src_b.source_type.replace('_', ' ')}).")
                if src_a.publication_year and src_b.publication_year and abs(src_a.publication_year - src_b.publication_year) >= 2:
                    reasons.append(f"Temporal gap between publications ({src_a.publication_year} vs. {src_b.publication_year}).")
                if numeric_conflict:
                    reasons.append("Different quantitative benchmarks, sample populations, or metric definitions.")
                if not reasons:
                    reasons.append("Differing emphasis between controlled empirical outcomes and broader real-world implementation risks.")

                topic_label = ", ".join(sorted(shared)[:3]).title()
                conflicts.append(
                    ConflictItem(
                        conflict_id=f"CF{len(conflicts) + 1}",
                        topic=f"Divergent Findings on {topic_label}",
                        severity="medium" if polarity_conflict else "low",
                        source_a_id=src_a.source_id,
                        source_a_title=src_a.title,
                        claim_a=sent_a,
                        source_b_id=src_b.source_id,
                        source_b_title=src_b.title,
                        claim_b=sent_b,
                        possible_reasons=reasons,
                        neutral_explanation=(
                            f"{src_a.source_id} highlights {'favorable/positive' if pos_a >= neg_a else 'critical/risk'} evidence, "
                            f"whereas {src_b.source_id} emphasizes {'countervailing risks or limitations' if neg_b >= pos_b else 'differing figures'}."
                        ),
                        what_remains_uncertain=(
                            "Without standardized sample definitions and longitudinal multi-site controls, the exact net magnitude "
                            "across differing deployment contexts remains context-dependent."
                        ),
                    )
                )
                if len(conflicts) >= 4:
                    break
        if len(conflicts) >= 4:
            break

    summary = (
        f"Detected {len(conflicts)} substantive tension(s) or discrepancy point(s) across retrieved sources that are preserved below without omission."
        if conflicts
        else "Retrieved excerpts did not exhibit direct head-to-head contradictions, though differences in source scope, publication year, and evidence strength are documented."
    )
    return _VerificationBundle(claims=claims, conflicts=conflicts, conflict_summary=summary)


# ---------------------------------------------------------------------------
# Feature 5: 14-Section Synthesis + Analytics
# ---------------------------------------------------------------------------

def _build_analytics(
    sources: list[SourceItem],
    claims: list[VerifiedClaim],
    sub_questions: list[SubQuestion],
) -> ReportAnalytics:
    # 1. Source type breakdown + average credibility/relevance
    by_type: dict[str, list[SourceItem]] = defaultdict(list)
    for s in sources:
        by_type[s.source_type].append(s)

    label_map = {
        "web": "Web Search",
        "academic_paper": "Academic Papers",
        "uploaded_pdf": "Uploaded PDFs",
        "knowledge_base": "Knowledge Base",
    }
    source_type_breakdown = []
    for stype in ("web", "academic_paper", "uploaded_pdf", "knowledge_base"):
        grp = by_type.get(stype, [])
        if grp:
            avg_cred = round(sum(x.credibility_score for x in grp) / len(grp), 1)
            avg_rel = round(sum(x.relevance_score for x in grp) / len(grp), 1)
            source_type_breakdown.append(
                ChartSeriesItem(name=label_map[stype], value=float(len(grp)), secondary=avg_cred, tertiary=avg_rel)
            )

    # 2. Verification breakdown
    ver_counts = Counter(cl.verification_status for cl in claims)
    verification_breakdown = [
        ChartSeriesItem(name=status, value=float(cnt))
        for status, cnt in ver_counts.items()
    ]

    # 3. Publication timeline
    year_counts = Counter(str(s.publication_year) if s.publication_year else "Undated" for s in sources)
    ordered_years = sorted(year_counts.keys(), key=lambda y: (y == "Undated", y))
    publication_timeline = [
        ChartSeriesItem(name=yr, value=float(year_counts[yr])) for yr in ordered_years
    ]

    # 4. Sub-question coverage
    sub_question_coverage = []
    for sq in sub_questions:
        cnt = sum(1 for s in sources if sq.id in s.sub_questions_matched)
        sub_question_coverage.append(ChartSeriesItem(name=sq.id, value=float(cnt)))

    return ReportAnalytics(
        source_type_breakdown=source_type_breakdown,
        verification_breakdown=verification_breakdown,
        publication_timeline=publication_timeline,
        sub_question_coverage=sub_question_coverage,
    )


def _deterministic_synthesis(
    plan: ResearchPlan,
    sources: list[SourceItem],
    verification: _VerificationBundle,
    has_pdfs: bool,
) -> _ReportSynthesisBundle:
    topic = _clean_topic_phrase(plan.question)
    verified_count = sum(1 for c in verification.claims if c.is_verified_fact)
    conflict_count = len(verification.conflicts)

    # Key findings from top verified/supported claims
    key_findings: list[KeyFinding] = []
    for idx, cl in enumerate(verification.claims[:5], start=1):
        cites = cl.supporting_source_ids or ([sources[0].source_id] if sources else [])
        key_findings.append(
            KeyFinding(
                id=f"F{idx}",
                title=f"Finding {idx}: {cl.claim_text[:72].rstrip('.,;:')}{'...' if len(cl.claim_text) > 72 else ''}",
                summary=f"{cl.claim_text} {cl.distinction_note}",
                cited_source_ids=cites,
                verification_status=cl.verification_status,
                confidence=cl.confidence_score,
            )
        )

    # Detailed analysis per sub-question
    detailed_analysis: list[AnalysisSection] = []
    for sq in plan.sub_questions:
        matched = [s for s in sources if sq.id in s.sub_questions_matched] or sources[:3]
        paragraphs = []
        cited_ids = []
        for src in matched[:4]:
            cited_ids.append(src.source_id)
            sents = _split_sentences(src.relevant_information)
            excerpt = " ".join(sents[:2]) if sents else src.relevant_information[:320]
            paragraphs.append(f"According to {src.title} [{src.source_id}], {excerpt}")

        body = (
            " ".join(paragraphs)
            if paragraphs
            else f"No direct evidence snippets were retrieved specifically for {sq.id}; further targeted primary research is needed."
        )
        detailed_analysis.append(
            AnalysisSection(
                sub_question_id=sq.id,
                heading=sq.question,
                content=body,
                cited_source_ids=cited_ids,
            )
        )

    # Source contributions
    source_contributions: list[_SourceContribution] = []
    for s in sources:
        sents = _split_sentences(s.relevant_information)
        source_contributions.append(
            _SourceContribution(
                source_id=s.source_id,
                contribution=(sents[0][:140] if sents else s.relevant_information[:140]),
            )
        )

    pdf_vs_web = None
    if has_pdfs:
        pdf_srcs = [s for s in sources if s.source_type == "uploaded_pdf"]
        ext_srcs = [s for s in sources if s.source_type in ("web", "academic_paper")]
        if pdf_srcs and ext_srcs:
            pdf_vs_web = (
                f"Uploaded PDF evidence ({', '.join(s.source_id for s in pdf_srcs)}) provides document-specific "
                f"claims and page-level depth, which were cross-checked against {len(ext_srcs)} external web and "
                f"academic sources ({', '.join(s.source_id for s in ext_srcs[:4])}). "
                f"{'Specific tensions are detailed in Section 9 (Conflicting Information).' if conflict_count else 'Core themes largely align, while external literature adds broader context.'}"
            )

    exec_summary = (
        f"This report synthesizes evidence across {len(sources)} deduplicated sources spanning "
        f"{len({s.source_type for s in sources})} distinct source types to answer: \"{plan.question}\". "
        f"Cross-source verification identified {verified_count} multi-source verified claim(s) alongside "
        f"{len(verification.claims) - verified_count} single-source, interpretive, or uncertain claim(s), "
        f"and flagged {conflict_count} conflicting point(s) across sources."
    )

    limitations = [
        "Synthesis relied on retrieved abstracts, web extracts, knowledge base entries, and uploaded PDF text rather than behind-paywall full-text journal databases.",
        "Publication dates vary across sources; older baselines may lag rapid 2025–2026 developments.",
        "Where independent sources lacked multi-source overlap, claims were explicitly downgraded to single-source or insufficient evidence.",
    ]
    open_questions = [
        f"What long-term longitudinal outcomes emerge for {topic} over 3–5 year real-world cohorts?",
        "Which methodological differences explain remaining variance between controlled studies and field deployments?",
        "How will evolving standards and governance policies alter current cost-benefit trade-offs?",
    ]
    conclusion = (
        f"Available evidence demonstrates that addressing '{plan.question}' requires balancing documented benefits against "
        f"validated operational risks and unresolved uncertainties. Decisions should prioritize findings corroborated by "
        f"multiple independent sources while accounting for the {conflict_count} conflict area(s) documented in Section 9."
    )

    return _ReportSynthesisBundle(
        research_title=f"Evidence Synthesis: {topic}",
        executive_summary=exec_summary,
        key_findings=key_findings,
        detailed_analysis=detailed_analysis,
        source_comparison_narrative=(
            f"The {len(sources)} retained sources were scored on relevance (45%), source credibility (35%), and recency (20%). "
            "Peer-reviewed academic papers and uploaded primary PDFs generally provide stronger methodological grounding, "
            "whereas web sources contribute timely policy and market context."
        ),
        source_contributions=source_contributions,
        pdf_vs_web_summary=pdf_vs_web,
        limitations_of_research=limitations,
        open_questions=open_questions,
        conclusion=conclusion,
    )


def _format_sources_for_prompt(sources: list[SourceItem]) -> str:
    blocks = []
    for s in sources:
        blocks.append(
            f"[{s.source_id}] ({s.source_type} | {s.provider} | Date: {s.publication_date} | Credibility: {s.credibility_score}% | SubQ: {','.join(s.sub_questions_matched)})\n"
            f"Title: {s.title}\n"
            f"Author/Publisher: {s.author_or_publisher}\n"
            f"URL: {s.url}\n"
            f"Content: {s.relevant_information[:950]}\n"
        )
    return "\n---\n".join(blocks)


def _assemble_report(
    *,
    report_id: str,
    plan: ResearchPlan,
    sources: list[SourceItem],
    logs: list,
    verification: _VerificationBundle,
    synthesis: _ReportSynthesisBundle,
    audience: AudienceType,
    depth: DepthType,
    llm_mode: str,
    pdf_ids: list[str],
    now: str,
    related_images: Optional[list[RelatedImage]] = None,
) -> ResearchReport:
    valid_ids = {s.source_id for s in sources}
    source_map = {s.source_id: s for s in sources}

    # Ensure cited_source_ids on findings and analysis only contain valid IDs
    for kf in synthesis.key_findings:
        kf.cited_source_ids = [sid for sid in kf.cited_source_ids if sid in valid_ids]
        if not kf.cited_source_ids and sources:
            kf.cited_source_ids = [sources[0].source_id]
    for sec in synthesis.detailed_analysis:
        sec.cited_source_ids = [sid for sid in sec.cited_source_ids if sid in valid_ids]

    contrib_map = {sc.source_id: sc.contribution for sc in synthesis.source_contributions}
    comparison_rows = [
        SourceComparisonRow(
            source_id=s.source_id,
            title=s.title,
            source_type=s.source_type,
            provider=s.provider,
            author_or_publisher=s.author_or_publisher,
            publication_date=s.publication_date,
            relevance_score=s.relevance_score,
            credibility_score=s.credibility_score,
            recency_score=s.recency_score,
            key_contribution=contrib_map.get(s.source_id, s.relevant_information[:130]),
        )
        for s in sources
    ]

    references = [
        ReferenceEntry(
            source_id=s.source_id,
            citation_text=f"{s.author_or_publisher} ({s.publication_date}). {s.title}. [{s.provider}] {s.url}",
            title=s.title,
            author_or_publisher=s.author_or_publisher,
            publication_date=s.publication_date,
            url=s.url,
            source_type=s.source_type,
        )
        for s in sources
    ]

    for step in plan.plan_steps:
        step.status = "completed"

    analytics = _build_analytics(sources, verification.claims, plan.sub_questions)

    return ResearchReport(
        id=report_id,
        question=plan.question,
        audience=audience,
        depth=depth,
        llm_mode=llm_mode,
        created_at=now,
        updated_at=now,
        is_starred=False,
        attached_pdf_ids=pdf_ids,
        research_title=synthesis.research_title,
        executive_summary=synthesis.executive_summary,
        research_objective=plan.research_objective,
        research_questions=ResearchQuestionsSection(
            main_question=plan.question,
            research_objective=plan.research_objective,
            sub_questions=plan.sub_questions,
        ),
        methodology_and_sources=MethodologySection(
            overview=(
                f"ResearchMate AI decomposed the primary inquiry into {len(plan.sub_questions)} independent sub-questions, "
                f"queried {len({s.provider for s in sources})} retrieval providers across {len({s.source_type for s in sources})} source types, "
                f"and ran automated cross-source verification and contradiction detection."
            ),
            llm_engine_used=llm_mode,
            source_types_searched=sorted({s.source_type for s in sources}),
            search_logs=logs,
            deduplication_and_ranking_notes=(
                "Duplicate URLs and normalized titles were merged across sub-questions. Remaining sources were ranked "
                "using a weighted composite score: 45% query relevance, 35% publisher/peer-review credibility, and 20% recency."
            ),
            verification_protocol=(
                "Claims are never marked verified on AI authority alone. A claim receives 'Verified (Multi-Source)' status "
                "only when corroborated by >=2 independent retrieved sources with no direct contradictions."
            ),
        ),
        key_findings=synthesis.key_findings,
        detailed_analysis=synthesis.detailed_analysis,
        source_comparison=SourceComparisonSection(
            narrative=synthesis.source_comparison_narrative,
            comparison_rows=comparison_rows,
            pdf_vs_web_summary=synthesis.pdf_vs_web_summary,
        ),
        conflicting_information=ConflictSectionData(
            summary=verification.conflict_summary,
            conflicts=verification.conflicts,
        ),
        evidence_and_citations=verification.claims,
        limitations_of_research=synthesis.limitations_of_research,
        open_questions=synthesis.open_questions,
        conclusion=synthesis.conclusion,
        references=references,
        plan=plan,
        sources=sources,
        analytics=analytics,
        related_images=related_images or [],
    )


async def run_research_pipeline_stream(
    *,
    question: str,
    audience: AudienceType,
    depth: DepthType,
    enabled_sources: list[SourceType],
    pdf_ids: list[str],
    provided_plan: Optional[ResearchPlan],
    llm_service: LLMService,
) -> AsyncIterator[dict]:
    """Execute the full research agent workflow and yield SSE progress events."""
    report_id = f"rep-{uuid.uuid4().hex[:12]}"
    now = database.utc_now_iso()

    # Stage 1: Question Analyzer & Plan
    yield {
        "event": "progress",
        "data": {"stage": "planning", "percent": 12, "message": "Analyzing research question and generating sub-questions..."},
    }
    plan = provided_plan or await generate_research_plan(question, audience, depth, pdf_ids, llm_service)
    yield {"event": "plan", "data": plan.model_dump()}

    # Stage 2: Multi-Source Search per Sub-Question
    yield {
        "event": "progress",
        "data": {
            "stage": "searching",
            "percent": 34,
            "message": f"Searching {', '.join(enabled_sources)} independently across {len(plan.sub_questions)} sub-questions...",
        },
    }
    (sources, logs), related_images = await asyncio.gather(
        execute_multi_source_search(
            main_question=plan.question,
            sub_questions=plan.sub_questions,
            enabled_sources=enabled_sources,
            pdf_ids=pdf_ids,
            depth=depth,
        ),
        search_related_images(plan.question, limit=6),
    )
    yield {
        "event": "sources_found",
        "data": {
            "count": len(sources),
            "source_types": sorted({s.source_type for s in sources}),
            "sources": [s.model_dump() for s in sources],
            "logs": [l.model_dump() for l in logs],
        },
    }
    yield {
        "event": "images_found",
        "data": [img.model_dump() for img in related_images],
    }

    # Stage 3 & 4: Verification & Conflict Detection
    yield {
        "event": "progress",
        "data": {"stage": "verifying", "percent": 62, "message": "Cross-checking claims across sources and detecting contradictions..."},
    }
    sources_context = _format_sources_for_prompt(sources)
    ver_prompt = (
        f"Main Research Question: {plan.question}\n\n"
        f"Retrieved Sources:\n{sources_context}\n\n"
        "Tasks:\n"
        "1. Extract 6-9 key claims strictly grounded in the retrieved sources above. Cite exact source IDs (`S1`, `S2`, ...). "
        "Include supporting_source_ids, contradicting_source_ids, short exact evidence_excerpts, and `distinction_note` "
        "explaining whether each claim is a multi-source verified fact, single-source claim, interpretation/assumption, outdated info, or insufficient evidence.\n"
        "2. Identify all meaningful contradictions, differing figures, or opposing perspectives in `conflicts` (Source A vs Source B, possible reasons, neutral explanation, what remains uncertain). Never omit disagreements."
    )
    ver_parsed, engine_used = await llm_service.generate_structured(
        system_instruction=(
            "You are a strict fact-checking and conflict-detection auditor. NEVER claim a fact is verified unless "
            "at least 2 independent retrieved sources directly support it. Explicitly label uncertainty and preserve all source conflicts."
        ),
        prompt=ver_prompt,
        schema_model=_VerificationBundle,
        thinking_level="medium",
    )
    if ver_parsed and ver_parsed.claims:
        verification = ver_parsed
    else:
        verification = _deterministic_verify_and_detect_conflicts(plan.question, sources)

    # Hard code-level verification guardrail
    verification.claims, verification.conflicts = _enforce_verification_integrity(
        verification.claims, verification.conflicts, sources
    )

    yield {
        "event": "verification",
        "data": {
            "claims_count": len(verification.claims),
            "verified_count": sum(1 for c in verification.claims if c.is_verified_fact),
            "conflicts_count": len(verification.conflicts),
        },
    }

    # Stage 5: 14-Section Report Synthesis
    yield {
        "event": "progress",
        "data": {"stage": "synthesizing", "percent": 84, "message": "Synthesizing 14-section structured research report with citations..."},
    }
    has_pdfs = any(s.source_type == "uploaded_pdf" for s in sources)
    subq_text = "\n".join(f"- {sq.id}: {sq.question} (Needed: {sq.information_needed})" for sq in plan.sub_questions)
    claims_text = "\n".join(
        f"- {c.claim_id} [{c.verification_status}]: {c.claim_text} (Supported by: {c.supporting_source_ids})"
        for c in verification.claims
    )
    conflicts_text = "\n".join(
        f"- {cf.conflict_id} ({cf.topic}): {cf.source_a_id} says '{cf.claim_a}' vs {cf.source_b_id} says '{cf.claim_b}'"
        for cf in verification.conflicts
    ) or "None detected."

    synth_prompt = (
        f"Research Question: {plan.question}\n"
        f"Target Audience: {audience}\n"
        f"Sub-questions:\n{subq_text}\n\n"
        f"Verified Claims:\n{claims_text}\n\n"
        f"Detected Conflicts:\n{conflicts_text}\n\n"
        f"Sources:\n{sources_context}\n\n"
        "Generate a rigorous, well-written synthesis payload with:\n"
        "- `research_title`, `executive_summary`, `key_findings` (4-6 findings with exact `cited_source_ids` like ['S1','S2']),\n"
        "- `detailed_analysis` (one section per sub-question ID SQ1..SQN with thorough analysis and `cited_source_ids`),\n"
        "- `source_comparison_narrative`, `source_contributions` (list of {source_id, contribution} with a 1-sentence contribution per source),\n"
        f"- {'`pdf_vs_web_summary` comparing uploaded PDF(s) with web/academic sources,' if has_pdfs else '`pdf_vs_web_summary`: null,'}\n"
        "- `limitations_of_research` (3-5 items), `open_questions` (3-5 items), and `conclusion`.\n"
        "Cite sources inline using [S1], [S2] notation where making factual claims."
    )
    synth_parsed, engine_final = await llm_service.generate_structured(
        system_instruction=(
            f"You are ResearchMate AI synthesizing an authoritative research report for a {audience} reader. "
            "Ground every factual statement in the provided sources using [S#] citations, preserve uncertainty and conflicts honestly, "
            "and never fabricate citations or external URLs."
        ),
        prompt=synth_prompt,
        schema_model=_ReportSynthesisBundle,
        thinking_level="medium",
    )
    synthesis = synth_parsed if (synth_parsed and synth_parsed.key_findings) else _deterministic_synthesis(
        plan, sources, verification, has_pdfs
    )
    llm_mode = engine_final if synth_parsed else engine_used

    report = _assemble_report(
        report_id=report_id,
        plan=plan,
        sources=sources,
        logs=logs,
        verification=verification,
        synthesis=synthesis,
        audience=audience,
        depth=depth,
        llm_mode=llm_mode,
        pdf_ids=pdf_ids,
        now=now,
        related_images=related_images,
    )
    database.save_report(report)

    yield {
        "event": "complete",
        "data": report.model_dump(),
    }
