"""Feature 6: Context-aware AI Research Chat connected to the current report and uploaded PDFs."""

from __future__ import annotations

import re

from app import database
from app.schemas import ChatMessageModel, ResearchReport
from app.services.llm_service import LLMService


def _extract_cited_ids(text: str, valid_ids: set[str]) -> list[str]:
    found = re.findall(r"\[(S\d+)\]", text)
    out: list[str] = []
    for sid in found:
        if sid in valid_ids and sid not in out:
            out.append(sid)
    return out


def _build_report_context(report: ResearchReport) -> str:
    findings_txt = "\n".join(
        f"- {f.id} ({f.title}) [{f.verification_status}, {f.confidence}%]: {f.summary} (Sources: {', '.join(f.cited_source_ids)})"
        for f in report.key_findings
    )
    conflicts_txt = "\n".join(
        f"- {c.conflict_id} ({c.topic}): {c.source_a_id} claims '{c.claim_a}' VS {c.source_b_id} claims '{c.claim_b}'. Uncertainty: {c.what_remains_uncertain}"
        for c in report.conflicting_information.conflicts
    ) or "None."
    sources_txt = "\n".join(
        f"[{s.source_id}] {s.title} | Type: {s.source_type} | Provider: {s.provider} | Date: {s.publication_date} | Credibility: {s.credibility_score}% | Relevance: {s.relevance_score}%\nSummary: {s.relevant_information[:420]}"
        for s in report.sources
    )
    limitations_txt = "\n".join(f"- {l}" for l in report.limitations_of_research)
    return (
        f"TITLE: {report.research_title}\n"
        f"QUESTION: {report.question}\n"
        f"EXECUTIVE SUMMARY: {report.executive_summary}\n\n"
        f"KEY FINDINGS:\n{findings_txt}\n\n"
        f"CONFLICTING INFORMATION:\n{conflicts_txt}\n\n"
        f"LIMITATIONS:\n{limitations_txt}\n\n"
        f"CONCLUSION: {report.conclusion}\n\n"
        f"SOURCES:\n{sources_txt}"
    )


def _deterministic_chat_fallback(user_msg: str, report: ResearchReport) -> tuple[str, list[str]]:
    """Context-grounded conversational response when no LLM key is configured."""
    low = user_msg.lower()
    valid_ids = {s.source_id for s in report.sources}

    if any(k in low for k in ("second finding", "2nd finding", "finding 2", "f2")):
        if len(report.key_findings) >= 2:
            f = report.key_findings[1]
            cites = " ".join(f"[{s}]" for s in f.cited_source_ids)
            return (
                f"In simple terms, the **second finding** (**{f.title}**) means:\n\n"
                f"{f.summary}\n\n"
                f"**Verification status:** {f.verification_status} ({f.confidence}% confidence) backed by {cites}.",
                f.cited_source_ids,
            )

    if any(k in low for k in ("first finding", "1st finding", "finding 1", "f1")):
        if report.key_findings:
            f = report.key_findings[0]
            cites = " ".join(f"[{s}]" for s in f.cited_source_ids)
            return (
                f"In plain English, the **first finding** (**{f.title}**) shows:\n\n{f.summary}\n\n"
                f"**Verification:** {f.verification_status} ({f.confidence}%) {cites}.",
                f.cited_source_ids,
            )

    if any(k in low for k in ("reliable", "trustworthy", "best source", "credible")):
        ranked = sorted(report.sources, key=lambda s: (s.credibility_score, s.composite_score), reverse=True)
        top = ranked[:3]
        lines = [
            f"- **[{s.source_id}] {s.title}** — Credibility: **{s.credibility_score:.0f}%**, Type: `{s.source_type}` ({s.provider}), Date: {s.publication_date}"
            for s in top
        ]
        return (
            "Based on the source credibility and peer-review weighting, the most reliable sources in this report are:\n\n"
            + "\n".join(lines)
            + "\n\nPeer-reviewed academic papers and uploaded primary PDFs generally carry higher methodological reliability than unattributed general web pages.",
            [s.source_id for s in top],
        )

    if any(k in low for k in ("five points", "5 points", "summarize", "summary", "tldr")):
        pts = [
            f"{idx}. **{f.title}** ({f.verification_status}) — {f.summary[:180]} {' '.join(f'[{s}]' for s in f.cited_source_ids)}"
            for idx, f in enumerate(report.key_findings[:5], start=1)
        ]
        while len(pts) < 5:
            if len(pts) == 3 and report.conflicting_information.conflicts:
                c = report.conflicting_information.conflicts[0]
                pts.append(f"{len(pts)+1}. **Key Conflict ({c.topic})** — [{c.source_a_id}] vs [{c.source_b_id}]: {c.neutral_explanation}")
            else:
                pts.append(f"{len(pts)+1}. **Conclusion & Caveats** — {report.conclusion[:180]}")
        return "Here is a five-point summary of the research:\n\n" + "\n".join(pts[:5]), _extract_cited_ids("\n".join(pts), valid_ids)

    if any(k in low for k in ("beginner", "simple", "eli5", "easy")):
        top_cites = [s.source_id for s in report.sources[:2]]
        return (
            f"### Beginner Explanation: {report.research_title}\n\n"
            f"**What we investigated:** {report.question}\n\n"
            f"**The big picture:** {report.executive_summary}\n\n"
            f"**Main takeaway:** {report.conclusion} "
            + (f"(Grounded in {', '.join(f'[{c}]' for c in top_cites)})." if top_cites else ""),
            top_cites,
        )

    if any(k in low for k in ("limitation", "gap", "caveat", "missing", "open question")):
        lims = "\n".join(f"- {l}" for l in report.limitations_of_research)
        oqs = "\n".join(f"- {q}" for q in report.open_questions)
        return (
            f"**Research Limitations:**\n{lims}\n\n**Open Questions Remaining:**\n{oqs}",
            [],
        )

    if any(k in low for k in ("conflict", "disagree", "compare", "contradict")):
        if report.conflicting_information.conflicts:
            blocks = [
                f"- **{c.conflict_id} — {c.topic}**: [{c.source_a_id}] states *\"{c.claim_a[:130]}\"*, whereas [{c.source_b_id}] reports *\"{c.claim_b[:130]}\"*. Uncertainty: {c.what_remains_uncertain}"
                for c in report.conflicting_information.conflicts
            ]
            cites = [c.source_a_id for c in report.conflicting_information.conflicts] + [c.source_b_id for c in report.conflicting_information.conflicts]
            return "**Comparison & Conflicting Findings:**\n\n" + "\n".join(blocks), list(dict.fromkeys(cites))
        return f"**Source Comparison:**\n{report.source_comparison.narrative}", [s.source_id for s in report.sources[:3]]

    # Generic keyword match over evidence & sources ("Give me more evidence", etc.)
    q_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", low))
    scored_sources = sorted(
        report.sources,
        key=lambda s: sum(1 for w in q_words if w in (s.title + " " + s.relevant_information).lower()) + s.composite_score / 100.0,
        reverse=True,
    )[:3]
    evidence_lines = [
        f"- **[{s.source_id}] {s.title}** ({s.publication_date}, {s.provider}): \"{s.relevant_information[:240]}...\""
        for s in scored_sources
    ]
    return (
        f"Based on the current report (**{report.research_title}**), here is the closest supporting evidence:\n\n"
        + "\n".join(evidence_lines)
        + f"\n\n**Synthesis note:** {report.conclusion[:260]}",
        [s.source_id for s in scored_sources],
    )


async def answer_followup_question(
    report: ResearchReport,
    user_message: str,
    llm_service: LLMService,
) -> tuple[ChatMessageModel, ChatMessageModel]:
    """Process a user follow-up chat message with full report context and persistence."""
    history_models = database.list_chat_messages(report.id)
    prev_interaction_id = database.get_last_interaction_id(report.id)

    user_msg_saved = database.save_chat_message(
        report_id=report.id,
        role="user",
        content=user_message,
        cited_source_ids=[],
    )

    history_dicts = [{"role": m.role, "content": m.content} for m in history_models]
    valid_ids = {s.source_id for s in report.sources}
    report_ctx = _build_report_context(report)

    system_instruction = (
        "You are ResearchMate AI's contextual research assistant. Answer follow-up questions strictly using "
        "the current research report, retrieved sources, conflict analysis, and limitations provided below. "
        "Cite specific sources inline using [S1], [S2] notation. Never fabricate claims or cite non-existent sources; "
        "if evidence in the report is insufficient for a question, explicitly state that gap.\n\n"
        f"CURRENT REPORT CONTEXT:\n{report_ctx}"
    )

    reply_text, new_interaction_id, _ = await llm_service.generate_chat_reply(
        system_instruction=system_instruction,
        prompt=user_message,
        history=history_dicts,
        previous_interaction_id=prev_interaction_id,
    )

    if reply_text:
        cited = _extract_cited_ids(reply_text, valid_ids)
    else:
        reply_text, cited = _deterministic_chat_fallback(user_message, report)

    assistant_msg_saved = database.save_chat_message(
        report_id=report.id,
        role="assistant",
        content=reply_text,
        cited_source_ids=cited,
        interaction_id=new_interaction_id,
    )
    return user_msg_saved, assistant_msg_saved
