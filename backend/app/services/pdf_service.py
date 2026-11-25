"""PyMuPDF document processing, analysis, search, and PDF report export."""

from __future__ import annotations

import html
import io
import re
from collections import Counter
from typing import Iterable, Optional

import fitz  # PyMuPDF

from app.schemas import PdfAnalysisData, ResearchReport, SourceItem
from app.services.llm_service import LLMService

STOPWORDS = {
    "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "have",
    "has", "had", "not", "but", "what", "which", "when", "where", "how", "why", "who",
    "can", "could", "would", "should", "into", "about", "than", "then", "also", "such",
    "more", "most", "some", "many", "these", "those", "their", "there", "been", "being",
    "between", "among", "during", "through", "while", "using", "based", "study", "paper",
    "research", "results", "analysis", "data", "however", "therefore", "both", "each",
}


def _clean_text(text: str) -> str:
    text = re.sub(r"-\s*\n\s*", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_bytes(pdf_bytes: bytes, fallback_filename: str) -> dict:
    """Extract metadata, page-level text, and word count using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        meta = doc.metadata or {}
        pages: list[dict] = []
        all_parts: list[str] = []
        for idx, page in enumerate(doc):
            raw = page.get_text("text") or ""
            cleaned = _clean_text(raw)
            pages.append({"page_number": idx + 1, "text": cleaned})
            if cleaned:
                all_parts.append(f"[Page {idx + 1}]\n{cleaned}")

        full_text = "\n\n".join(all_parts).strip()
        raw_title = (meta.get("title") or "").strip()
        if not raw_title or raw_title.lower() in {"untitled", "document"}:
            # Infer title from first non-empty line on page 1
            first_lines = [ln.strip() for ln in (pages[0]["text"].splitlines() if pages else []) if len(ln.strip()) > 6]
            raw_title = first_lines[0][:140] if first_lines else fallback_filename.rsplit(".", 1)[0]

        author = (meta.get("author") or "").strip() or "Uploaded Document Author"
        word_count = len(re.findall(r"\b\w+\b", full_text))
        return {
            "title": raw_title,
            "author": author,
            "page_count": len(doc),
            "word_count": word_count,
            "full_text": full_text,
            "pages": pages,
        }
    finally:
        doc.close()


def _extract_sentences(text: str) -> list[str]:
    clean = re.sub(r"\[Page \d+\]\s*", "", text)
    clean = re.sub(r"\s+", " ", clean)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", clean)
    return [s.strip() for s in parts if 35 <= len(s.strip()) <= 420]


def _top_keywords(text: str, limit: int = 8) -> list[str]:
    tokens = re.findall(r"\b[a-zA-Z][a-zA-Z0-9\-]{3,}\b", text.lower())
    filtered = [t for t in tokens if t not in STOPWORDS]
    counts = Counter(filtered)
    return [word for word, _ in counts.most_common(limit)]


def _extractive_pdf_analysis(title: str, pages: list[dict], full_text: str) -> PdfAnalysisData:
    """Deterministic fallback summary & findings grounded directly in PDF page text."""
    if not full_text.strip():
        return PdfAnalysisData(
            summary="No machine-readable text was detected in this PDF (it may be a scanned image-only PDF without OCR).",
            important_findings=["Text extraction returned 0 characters; consider running OCR before analysis."],
            methodology_or_approach="N/A — scanned or empty PDF stream.",
            limitations_noted=["No selectable text layer available in PDF."],
            key_topics=[],
        )

    keywords = _top_keywords(full_text, limit=12)
    kw_set = set(keywords[:8])

    scored_findings: list[tuple[float, int, str]] = []
    method_candidates: list[tuple[int, str]] = []
    limitation_candidates: list[tuple[int, str]] = []
    summary_sents: list[str] = []

    for p in pages:
        pnum = p["page_number"]
        for sent in _extract_sentences(p["text"]):
            low = sent.lower()
            if pnum <= 2 and len(summary_sents) < 4:
                summary_sents.append(sent)

            score = sum(2.0 for kw in kw_set if kw in low)
            if re.search(r"\b\d+(?:\.\d+)?%|\bp\s*[<=>]\s*0\.\d+|\b\d{4}\b", low):
                score += 3.5
            if any(cue in low for cue in ("found that", "results show", "demonstrat", "conclude", "increase", "decrease", "significant", "evidence", "finding")):
                score += 3.0
            scored_findings.append((score, pnum, sent))

            if any(cue in low for cue in ("method", "dataset", "participants", "survey", "experiment", "trial", "sample", "model", "evaluated")):
                method_candidates.append((pnum, sent))
            if any(cue in low for cue in ("limitation", "caveat", "bias", "future work", "however", "uncertain", "small sample", "constraint")):
                limitation_candidates.append((pnum, sent))

    scored_findings.sort(key=lambda item: item[0], reverse=True)
    seen = set()
    important_findings: list[str] = []
    for _, pnum, sent in scored_findings:
        norm = sent[:60].lower()
        if norm not in seen:
            seen.add(norm)
            important_findings.append(f"{sent} [p. {pnum}]")
        if len(important_findings) >= 5:
            break

    if not summary_sents:
        summary_sents = [item[2] for item in scored_findings[:3]]
    summary = (
        f"Document '{title}' ({len(pages)} pages) examines {', '.join(keywords[:5]) or 'its core subject'}. "
        + " ".join(summary_sents[:3])
    )

    methodology = (
        " ".join(f"{s} [p. {p}]" for p, s in method_candidates[:2])
        if method_candidates
        else "Methodology details were not explicitly isolated in a dedicated section; extracted findings reflect the primary body text."
    )
    limitations = [f"{s} [p. {p}]" for p, s in limitation_candidates[:3]]
    if not limitations:
        limitations = ["Explicit study limitations were not prominently stated in the extracted text."]

    return PdfAnalysisData(
        summary=summary[:1200],
        important_findings=important_findings,
        methodology_or_approach=methodology[:700],
        limitations_noted=limitations,
        key_topics=keywords[:6],
    )


async def analyze_pdf_document(
    title: str,
    pages: list[dict],
    full_text: str,
    llm_service: LLMService,
) -> PdfAnalysisData:
    """Analyze an extracted PDF using Gemini/OpenAI or extractive fallback."""
    if not full_text.strip():
        return _extractive_pdf_analysis(title, pages, full_text)

    # Build compact page-tagged excerpt up to ~18k chars
    excerpt_chunks: list[str] = []
    char_budget = 18000
    used = 0
    for p in pages:
        block = f"--- PAGE {p['page_number']} ---\n{p['text'][:2500]}\n"
        if used + len(block) > char_budget:
            break
        excerpt_chunks.append(block)
        used += len(block)

    prompt = (
        f"Analyze the following PDF document titled '{title}'.\n"
        "Extract ONLY facts directly supported by the text below. Cite page numbers like [p. 2] inside findings and limitations.\n\n"
        + "\n".join(excerpt_chunks)
    )
    parsed, _ = await llm_service.generate_structured(
        system_instruction=(
            "You are an academic document analyst. Summarize the uploaded PDF accurately, "
            "extract 4-6 key findings with [p. X] page citations, note its methodology and limitations, "
            "and list up to 6 key topics. Never invent statistics or claims absent from the text."
        ),
        prompt=prompt,
        schema_model=PdfAnalysisData,
        thinking_level="low",
    )
    if parsed:
        return parsed
    return _extractive_pdf_analysis(title, pages, full_text)


def search_uploaded_pdfs(
    query: str,
    sub_question_id: str,
    pdf_records: Iterable[dict],
    max_hits: int = 3,
) -> list[SourceItem]:
    """Search uploaded PDF documents by chunking pages and ranking against the query."""
    tokens = [
        t for t in re.findall(r"\b[a-zA-Z0-9]{3,}\b", query.lower())
        if t not in STOPWORDS
    ]
    results: list[SourceItem] = []

    for pdf in pdf_records:
        pages: list[dict] = pdf["pages"]
        best_chunks: list[tuple[float, int, str]] = []
        for p in pages:
            pnum = p["page_number"]
            text = p["text"]
            if not text.strip():
                continue
            paragraphs = [blk.strip() for blk in re.split(r"\n\s*\n", text) if len(blk.strip()) > 40]
            if not paragraphs:
                paragraphs = [text[:1200]]
            for para in paragraphs:
                low = para.lower()
                hits = sum(1 for t in tokens if t in low)
                # Always allow attached PDFs to contribute top overview passages even if wording differs
                bonus = 1.5 if pnum == 1 else 0.0
                score = hits * 3.0 + bonus
                if score > 0 or len(best_chunks) < 2:
                    best_chunks.append((score, pnum, para[:750]))

        if not best_chunks:
            continue
        best_chunks.sort(key=lambda x: x[0], reverse=True)
        top = best_chunks[:3]
        matched_pages = sorted({c[1] for c in top})
        snippets = [f"[p. {c[1]}] {c[2]}" for c in top]
        max_hit = top[0][0]
        rel = min(98.0, 58.0 + max_hit * 4.5)
        cred = 88.0
        rec = 82.0
        comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)

        results.append(
            SourceItem(
                source_id="",
                title=f"{pdf['title']} (Uploaded PDF: {pdf['filename']})",
                author_or_publisher=pdf.get("author") or "Uploaded Document",
                publication_date=pdf["created_at"][:10],
                publication_year=int(pdf["created_at"][:4]) if pdf.get("created_at") else None,
                url=f"pdf://{pdf['id']}",
                source_type="uploaded_pdf",
                provider="PyMuPDF Upload",
                sub_questions_matched=[sub_question_id],
                relevance_score=round(rel, 1),
                credibility_score=cred,
                recency_score=rec,
                composite_score=comp,
                relevant_information=" ".join(snippets)[:1600],
                snippets=snippets,
                pdf_id=pdf["id"],
                page_numbers=matched_pages,
            )
        )

    results.sort(key=lambda s: s.composite_score, reverse=True)
    return results[:max_hits]


# ---------------------------------------------------------------------------
# Publication-grade PDF Report Export using PyMuPDF Story
# ---------------------------------------------------------------------------

def _esc(val: str) -> str:
    return html.escape(val or "", quote=True)


def generate_report_pdf(report: ResearchReport) -> bytes:
    """Render a complete 14-section ResearchReport to a clean multi-page PDF via PyMuPDF Story."""
    findings_html = "".join(
        f"""
        <div class="card">
          <div class="card-title">{_esc(f.id)}: {_esc(f.title)}
            <span class="badge">{_esc(f.verification_status)} ({f.confidence}%)</span>
          </div>
          <p>{_esc(f.summary)} <span class="cites">{_esc(' '.join(f'[{s}]' for s in f.cited_source_ids))}</span></p>
        </div>
        """
        for f in report.key_findings
    )

    subq_html = "".join(
        f"""
        <li><strong>{_esc(sq.id)}:</strong> {_esc(sq.question)}<br/>
        <span class="muted">Needed Evidence: {_esc(sq.information_needed)} | Sources: {_esc(', '.join(sq.target_sources))}</span></li>
        """
        for sq in report.research_questions.sub_questions
    )

    analysis_html = "".join(
        f"""
        <h3>{_esc(sec.sub_question_id)} — {_esc(sec.heading)}</h3>
        <p>{_esc(sec.content)} <span class="cites">{_esc(' '.join(f'[{s}]' for s in sec.cited_source_ids))}</span></p>
        """
        for sec in report.detailed_analysis
    )

    comparison_rows_html = "".join(
        f"""
        <tr>
          <td><strong>{_esc(row.source_id)}</strong></td>
          <td>{_esc(row.title[:70])}</td>
          <td>{_esc(row.source_type)}</td>
          <td>{_esc(row.publication_date)}</td>
          <td>{int(row.credibility_score)}%</td>
          <td>{_esc(row.key_contribution[:110])}</td>
        </tr>
        """
        for row in report.source_comparison.comparison_rows
    )

    conflicts_html = (
        "".join(
            f"""
            <div class="conflict-card">
              <div class="card-title">{_esc(c.conflict_id)}: {_esc(c.topic)} <span class="badge-warn">{_esc(c.severity.upper())}</span></div>
              <p><strong>Claim A ({_esc(c.source_a_id)} — {_esc(c.source_a_title[:60])}):</strong> {_esc(c.claim_a)}</p>
              <p><strong>Claim B ({_esc(c.source_b_id)} — {_esc(c.source_b_title[:60])}):</strong> {_esc(c.claim_b)}</p>
              <p><strong>Possible Reasons:</strong> {_esc('; '.join(c.possible_reasons))}</p>
              <p><strong>What Remains Uncertain:</strong> {_esc(c.what_remains_uncertain)}</p>
            </div>
            """
            for c in report.conflicting_information.conflicts
        )
        or "<p>No major contradictions were identified across retrieved sources, though evidence boundaries are noted below.</p>"
    )

    claims_html = "".join(
        f"""
        <tr>
          <td><strong>{_esc(cl.claim_id)}</strong></td>
          <td>{_esc(cl.claim_text)}</td>
          <td>{_esc(cl.verification_status)} ({cl.confidence_score}%)</td>
          <td>{_esc(', '.join(cl.supporting_source_ids) or 'None')}</td>
          <td>{_esc(cl.distinction_note)}</td>
        </tr>
        """
        for cl in report.evidence_and_citations
    )

    limitations_html = "".join(f"<li>{_esc(item)}</li>" for item in report.limitations_of_research)
    open_q_html = "".join(f"<li>{_esc(item)}</li>" for item in report.open_questions)
    refs_html = "".join(
        f"<li><strong>[{_esc(ref.source_id)}]</strong> {_esc(ref.citation_text)}</li>"
        for ref in report.references
    )

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: sans-serif; font-size: 9.5pt; line-height: 1.48; color: #1e293b; }}
        .header-bar {{ border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 14px; }}
        .brand {{ font-size: 8.5pt; color: #1e40af; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }}
        h1 {{ font-size: 17pt; color: #0f172a; margin: 4px 0 6px 0; line-height: 1.25; }}
        .meta {{ font-size: 8pt; color: #475569; }}
        h2 {{ font-size: 11.5pt; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-top: 16px; margin-bottom: 6px; }}
        h3 {{ font-size: 10pt; color: #0f172a; margin-top: 10px; margin-bottom: 4px; }}
        p {{ margin: 4px 0 8px 0; }}
        ul, ol {{ margin: 4px 0 8px 16px; padding: 0; }}
        li {{ margin-bottom: 4px; }}
        .muted {{ color: #64748b; font-size: 8.5pt; }}
        .cites {{ color: #1d4ed8; font-weight: bold; font-size: 8.5pt; }}
        .exec-box {{ background-color: #f1f5f9; border-left: 3px solid #2563eb; padding: 8px 10px; margin: 8px 0; }}
        .card {{ border: 1px solid #e2e8f0; padding: 7px 9px; margin-bottom: 7px; background-color: #ffffff; }}
        .conflict-card {{ border: 1px solid #fecaca; border-left: 3px solid #dc2626; background-color: #fff5f5; padding: 7px 9px; margin-bottom: 8px; }}
        .card-title {{ font-weight: bold; color: #0f172a; margin-bottom: 3px; }}
        .badge {{ background-color: #dbeafe; color: #1e40af; font-size: 7.5pt; padding: 1px 5px; font-weight: bold; }}
        .badge-warn {{ background-color: #fee2e2; color: #b91c1c; font-size: 7.5pt; padding: 1px 5px; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin: 6px 0 10px 0; font-size: 8pt; }}
        th {{ background-color: #1e3a8a; color: #ffffff; text-align: left; padding: 4px 5px; }}
        td {{ border: 1px solid #cbd5e1; padding: 4px 5px; vertical-align: top; }}
      </style>
    </head>
    <body>
      <div class="header-bar">
        <div class="brand">ResearchMate AI — Research Smarter. Discover Faster. Make Better Decisions.</div>
        <h1>1. {_esc(report.research_title)}</h1>
        <div class="meta">
          Original Query: {_esc(report.question)}<br/>
          Generated: {_esc(report.created_at[:10])} | Audience: {_esc(report.audience.title())} |
          Depth: {_esc(report.depth.title())} | Engine: {_esc(report.methodology_and_sources.llm_engine_used)} |
          Sources: {len(report.sources)} | Conflicts: {len(report.conflicting_information.conflicts)}
        </div>
      </div>

      <h2>2. Executive Summary</h2>
      <div class="exec-box">{_esc(report.executive_summary)}</div>

      <h2>3. Research Objective</h2>
      <p>{_esc(report.research_objective)}</p>

      <h2>4. Research Questions</h2>
      <p><strong>Primary Question:</strong> {_esc(report.research_questions.main_question)}</p>
      <ol>{subq_html}</ol>

      <h2>5. Methodology and Sources Searched</h2>
      <p>{_esc(report.methodology_and_sources.overview)}</p>
      <p><strong>Source Types Queried:</strong> {_esc(', '.join(report.methodology_and_sources.source_types_searched))}</p>
      <p><strong>Deduplication &amp; Ranking:</strong> {_esc(report.methodology_and_sources.deduplication_and_ranking_notes)}</p>
      <p><strong>Verification Protocol:</strong> {_esc(report.methodology_and_sources.verification_protocol)}</p>

      <h2>6. Key Findings</h2>
      {findings_html}

      <h2>7. Detailed Analysis</h2>
      {analysis_html}

      <h2>8. Source Comparison</h2>
      <p>{_esc(report.source_comparison.narrative)}</p>
      {f"<p><strong>PDF vs. Web Comparison:</strong> {_esc(report.source_comparison.pdf_vs_web_summary)}</p>" if report.source_comparison.pdf_vs_web_summary else ""}
      <table>
        <thead>
          <tr><th>ID</th><th>Title</th><th>Type</th><th>Date</th><th>Credibility</th><th>Key Contribution</th></tr>
        </thead>
        <tbody>{comparison_rows_html}</tbody>
      </table>

      <h2>9. Conflicting Information</h2>
      <p>{_esc(report.conflicting_information.summary)}</p>
      {conflicts_html}

      <h2>10. Evidence and Citations (Verification Ledger)</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Claim</th><th>Status</th><th>Supporting</th><th>Verification Note</th></tr>
        </thead>
        <tbody>{claims_html}</tbody>
      </table>

      <h2>11. Limitations of the Research</h2>
      <ul>{limitations_html}</ul>

      <h2>12. Open Questions</h2>
      <ul>{open_q_html}</ul>

      <h2>13. Conclusion</h2>
      <p>{_esc(report.conclusion)}</p>

      <h2>14. References</h2>
      <ol>{refs_html}</ol>
    </body>
    </html>
    """

    story = fitz.Story(html=html_content)
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (36, 42, -36, -42)

    bio = io.BytesIO()
    writer = fitz.DocumentWriter(bio)
    more = True
    while more:
        dev = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(dev, None)
        writer.end_page()
    writer.close()

    out_doc = fitz.open(stream=bio.getvalue(), filetype="pdf")
    try:
        total_pages = len(out_doc)
        for idx, page in enumerate(out_doc):
            footer_rect = fitz.Rect(36, mediabox.height - 28, mediabox.width - 36, mediabox.height - 10)
            page.insert_textbox(
                footer_rect,
                f"ResearchMate AI Report  |  Page {idx + 1} of {total_pages}",
                fontsize=7.5,
                color=(0.45, 0.5, 0.58),
                align=fitz.TEXT_ALIGN_RIGHT,
            )
        return out_doc.tobytes(garbage=3, deflate=True)
    finally:
        out_doc.close()
