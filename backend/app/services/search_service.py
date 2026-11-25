"""Multi-Source Research Engine (Tavily, Wikipedia, DuckDuckGo, OpenAlex, arXiv, PDFs, Knowledge Base)."""

from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Iterable, Optional

import httpx
from bs4 import BeautifulSoup

from app import database
from app.config import get_settings
from app.schemas import SearchExecutionLog, SourceItem, SourceType, SubQuestion
from app.services.pdf_service import search_uploaded_pdfs

logger = logging.getLogger(__name__)

CURRENT_YEAR = 2026
STOPWORDS = {
    "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "what",
    "which", "when", "where", "how", "why", "who", "into", "about", "advantages",
    "disadvantages", "benefits", "risks", "impact", "effects", "role", "use", "using",
}


def _query_terms(text: str) -> list[str]:
    return [
        t for t in re.findall(r"\b[a-zA-Z0-9]{3,}\b", text.lower())
        if t not in STOPWORDS
    ]


def _normalize_url(url: str) -> str:
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url.strip())
    clean_query = urllib.parse.urlencode(
        [(k, v) for k, v in urllib.parse.parse_qsl(parsed.query) if not k.startswith("utm_")]
    )
    netloc = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/")
    return f"{netloc}{path}?{clean_query}" if clean_query else f"{netloc}{path}"


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", title.lower())[:90]


def _parse_year(date_str: str) -> Optional[int]:
    m = re.search(r"\b(19\d{2}|20\d{2})\b", date_str or "")
    return int(m.group(1)) if m else None


def _compute_recency(year: Optional[int]) -> float:
    if not year:
        return 60.0
    diff = max(0, CURRENT_YEAR - year)
    if diff <= 1:
        return 96.0
    if diff <= 2:
        return 86.0
    if diff <= 4:
        return 74.0
    if diff <= 7:
        return 58.0
    return 42.0


def _compute_web_credibility(url: str, author_or_pub: str) -> float:
    low_url = (url or "").lower()
    score = 68.0
    if any(dom in low_url for dom in (".gov", ".edu", "who.int", "unesco.org", "oecd.org", "nih.gov", "nature.com", "science.org", "ieee.org", "acm.org")):
        score = 91.0
    elif "wikipedia.org" in low_url:
        score = 79.0
    elif any(dom in low_url for dom in ("reuters.com", "bbc.", "nytimes.com", "economist.com", "hbr.org", "mit.edu", "stanford.edu", "brookings.edu", "pewresearch.org")):
        score = 84.0
    elif author_or_pub and author_or_pub != "Unknown":
        score = 73.0
    return score


def _compute_relevance(text: str, query_terms: list[str]) -> float:
    if not query_terms:
        return 70.0
    low = (text or "").lower()
    hits = sum(1 for t in set(query_terms) if t in low)
    ratio = hits / max(1, min(len(set(query_terms)), 8))
    return round(min(98.0, 48.0 + ratio * 50.0), 1)


def _reconstruct_openalex_abstract(inverted_index: Optional[dict]) -> str:
    if not inverted_index:
        return ""
    pos_map: dict[int, str] = {}
    for word, positions in inverted_index.items():
        for p in positions:
            pos_map[p] = word
    words = [pos_map[i] for i in sorted(pos_map.keys())]
    return " ".join(words)


# ---------------------------------------------------------------------------
# Individual Source Providers
# ---------------------------------------------------------------------------

async def _search_tavily(client: httpx.AsyncClient, query: str, sub_q_id: str, max_results: int = 4) -> list[SourceItem]:
    settings = get_settings()
    key = settings.effective_tavily_key
    if not key:
        return []
    try:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": key,
                "query": query,
                "search_depth": "advanced",
                "max_results": max_results,
                "include_raw_content": False,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        items: list[SourceItem] = []
        terms = _query_terms(query)
        for r in data.get("results", []):
            url = r.get("url", "")
            title = r.get("title") or url
            content = (r.get("content") or "").strip()
            pub_date = r.get("published_date") or "Recent Web Source"
            year = _parse_year(pub_date) or _parse_year(content)
            domain = urllib.parse.urlparse(url).netloc.removeprefix("www.") or "Web Publisher"
            rel = _compute_relevance(f"{title} {content}", terms)
            cred = _compute_web_credibility(url, domain)
            rec = _compute_recency(year)
            comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)
            items.append(
                SourceItem(
                    source_id="",
                    title=title,
                    author_or_publisher=domain,
                    publication_date=pub_date[:10] if len(pub_date) >= 10 else pub_date,
                    publication_year=year,
                    url=url,
                    source_type="web",
                    provider="Tavily Web Search",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=comp,
                    relevant_information=content[:1400],
                    snippets=[content[:600]] if content else [],
                )
            )
        return items
    except Exception as exc:
        logger.warning("Tavily search failed for '%s': %s", query, exc)
        return []


WIKI_HEADERS = {
    "User-Agent": "ResearchMateAI/1.0 (https://researchmate.local; dev@researchmate.local) python-httpx/0.28"
}


async def _search_wikipedia(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 2) -> list[SourceItem]:
    try:
        terms = _query_terms(query)
        concise_q = " ".join(terms[:5]) or query[:80]
        resp = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": concise_q,
                "srlimit": limit,
                "format": "json",
                "utf8": 1,
            },
            headers=WIKI_HEADERS,
            timeout=10.0,
        )
        resp.raise_for_status()
        hits = resp.json().get("query", {}).get("search", [])
        if not hits:
            return []

        items: list[SourceItem] = []
        for h in hits[:limit]:
            title = h.get("title", "")
            page_slug = urllib.parse.quote(title.replace(" ", "_"))
            summary_text = BeautifulSoup(h.get("snippet", ""), "html.parser").get_text(" ", strip=True)
            timestamp = (h.get("timestamp") or "")[:10] or "2026"
            try:
                sum_resp = await client.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_slug}",
                    headers=WIKI_HEADERS,
                    timeout=8.0,
                )
                if sum_resp.status_code == 200:
                    sdata = sum_resp.json()
                    if sdata.get("extract"):
                        summary_text = sdata["extract"]
                    if sdata.get("timestamp"):
                        timestamp = sdata["timestamp"][:10]
            except Exception:
                pass

            year = _parse_year(timestamp)
            rel = _compute_relevance(f"{title} {summary_text}", terms)
            cred = 80.0
            rec = _compute_recency(year)
            comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)
            items.append(
                SourceItem(
                    source_id="",
                    title=f"{title} — Wikipedia Reference",
                    author_or_publisher="Wikipedia Contributors",
                    publication_date=timestamp,
                    publication_year=year,
                    url=f"https://en.wikipedia.org/wiki/{page_slug}",
                    source_type="web",
                    provider="Wikipedia",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=comp,
                    relevant_information=summary_text[:1400],
                    snippets=[summary_text[:600]] if summary_text else [],
                )
            )
        return items
    except Exception as exc:
        logger.warning("Wikipedia search failed for '%s': %s", query, exc)
        return []


async def _search_ddg_instant(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 2) -> list[SourceItem]:
    try:
        terms = _query_terms(query)
        concise_q = " ".join(terms[:5]) or query[:80]
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": concise_q, "format": "json", "no_html": 1, "skip_disambig": 1},
            headers=WIKI_HEADERS,
            timeout=10.0,
        )
        if resp.status_code not in (200, 202):
            return []
        data = resp.json()
        items: list[SourceItem] = []

        abstract = (data.get("AbstractText") or data.get("Abstract") or "").strip()
        abs_url = (data.get("AbstractURL") or "").strip()
        heading = (data.get("Heading") or concise_q).strip()
        if abstract and abs_url:
            domain = urllib.parse.urlparse(abs_url).netloc.removeprefix("www.") or "DuckDuckGo"
            rel = _compute_relevance(f"{heading} {abstract}", terms)
            cred = _compute_web_credibility(abs_url, domain)
            rec = 84.0
            items.append(
                SourceItem(
                    source_id="",
                    title=f"{heading} ({data.get('AbstractSource') or domain})",
                    author_or_publisher=data.get("AbstractSource") or domain,
                    publication_date="2026",
                    publication_year=2026,
                    url=abs_url,
                    source_type="web",
                    provider="DuckDuckGo Web",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1),
                    relevant_information=abstract[:1200],
                    snippets=[abstract[:600]],
                )
            )

        for topic in data.get("RelatedTopics", []):
            if len(items) >= limit:
                break
            if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                txt = topic["Text"].strip()
                turl = topic["FirstURL"].strip()
                rel = _compute_relevance(txt, terms)
                items.append(
                    SourceItem(
                        source_id="",
                        title=txt[:95],
                        author_or_publisher="DuckDuckGo Reference",
                        publication_date="2026",
                        publication_year=2026,
                        url=turl,
                        source_type="web",
                        provider="DuckDuckGo Web",
                        sub_questions_matched=[sub_q_id],
                        relevance_score=rel,
                        credibility_score=74.0,
                        recency_score=80.0,
                        composite_score=round(0.45 * rel + 0.35 * 74.0 + 0.20 * 80.0, 1),
                        relevant_information=txt[:1000],
                        snippets=[txt[:500]],
                    )
                )
        return items[:limit]
    except Exception as exc:
        logger.warning("DuckDuckGo Instant failed for '%s': %s", query, exc)
        return []


async def _search_crossref(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 2) -> list[SourceItem]:
    try:
        terms = _query_terms(query)
        concise_q = " ".join(terms[:5]) or query[:80]
        resp = await client.get(
            "https://api.crossref.org/works",
            params={"query": concise_q, "rows": limit + 2},
            headers=WIKI_HEADERS,
            timeout=10.0,
        )
        resp.raise_for_status()
        works = resp.json().get("message", {}).get("items", [])
        items: list[SourceItem] = []
        for w in works:
            titles = w.get("title") or []
            title = titles[0].strip() if titles else ""
            raw_abs = BeautifulSoup(w.get("abstract") or "", "html.parser").get_text(" ", strip=True)
            if not title or len(raw_abs) < 40:
                continue
            authors_raw = w.get("author") or []
            authors = ", ".join(
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in authors_raw[:3]
                if a.get("family")
            )
            if len(authors_raw) > 3:
                authors += " et al."
            venue = (w.get("container-title") or ["Crossref Journal"])[0]
            date_parts = ((w.get("published") or w.get("created") or {}).get("date-parts") or [[None]])[0]
            year = date_parts[0] if date_parts and isinstance(date_parts[0], int) else None
            pub_date = "-".join(str(p) for p in date_parts if p is not None) if year else "Unknown"
            url = w.get("URL") or (f"https://doi.org/{w['DOI']}" if w.get("DOI") else "")
            rel = _compute_relevance(f"{title} {raw_abs}", terms)
            cred = 88.0
            rec = _compute_recency(year)
            items.append(
                SourceItem(
                    source_id="",
                    title=title,
                    author_or_publisher=f"{authors} ({venue})" if authors else venue,
                    publication_date=pub_date,
                    publication_year=year,
                    url=url,
                    source_type="academic_paper",
                    provider="Crossref Academic",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1),
                    relevant_information=raw_abs[:1250],
                    snippets=[raw_abs[:600]],
                )
            )
            if len(items) >= limit:
                break
        return items
    except Exception as exc:
        logger.warning("Crossref search failed for '%s': %s", query, exc)
        return []


async def _search_duckduckgo(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 3) -> list[SourceItem]:
    try:
        resp = await client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        items: list[SourceItem] = []
        terms = _query_terms(query)
        for res in soup.select(".result")[:limit * 2]:
            a_tag = res.select_one("a.result__a")
            snip_tag = res.select_one(".result__snippet")
            if not a_tag:
                continue
            href = a_tag.get("href", "")
            # Unwrap DDG redirect uddg=
            if "uddg=" in href:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                href = parsed.get("uddg", [href])[0]
            if not href.startswith("http"):
                continue
            title = a_tag.get_text(" ", strip=True)
            snippet = snip_tag.get_text(" ", strip=True) if snip_tag else ""
            if not snippet:
                continue
            domain = urllib.parse.urlparse(href).netloc.removeprefix("www.") or "Web"
            year = _parse_year(snippet) or _parse_year(title)
            rel = _compute_relevance(f"{title} {snippet}", terms)
            cred = _compute_web_credibility(href, domain)
            rec = _compute_recency(year)
            comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)
            items.append(
                SourceItem(
                    source_id="",
                    title=title,
                    author_or_publisher=domain,
                    publication_date=str(year) if year else "Web Indexed",
                    publication_year=year,
                    url=href,
                    source_type="web",
                    provider="DuckDuckGo Web",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=comp,
                    relevant_information=snippet[:1200],
                    snippets=[snippet[:600]],
                )
            )
            if len(items) >= limit:
                break
        return items
    except Exception as exc:
        logger.warning("DuckDuckGo search failed for '%s': %s", query, exc)
        return []


async def _search_openalex(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 3) -> list[SourceItem]:
    try:
        resp = await client.get(
            "https://api.openalex.org/works",
            params={
                "search": query,
                "per-page": limit + 2,
                "sort": "relevance_score:desc",
                "filter": "has_abstract:true",
            },
            headers={"User-Agent": "ResearchMateAI/1.0 (mailto:researchmate@example.org)"},
            timeout=12.0,
        )
        resp.raise_for_status()
        works = resp.json().get("results", [])
        terms = _query_terms(query)
        items: list[SourceItem] = []
        for w in works:
            title = (w.get("title") or "").strip()
            abstract = _reconstruct_openalex_abstract(w.get("abstract_inverted_index"))
            if not title or len(abstract) < 60:
                continue
            authorships = w.get("authorships") or []
            authors = ", ".join(
                a.get("author", {}).get("display_name", "")
                for a in authorships[:3]
                if a.get("author", {}).get("display_name")
            )
            if len(authorships) > 3:
                authors += " et al."
            venue = (
                ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
                or "Peer-Reviewed Literature"
            )
            author_pub = f"{authors} ({venue})" if authors else venue
            pub_date = w.get("publication_date") or str(w.get("publication_year") or "Unknown")
            year = w.get("publication_year")
            doi = w.get("doi") or ""
            landing = ((w.get("primary_location") or {}).get("landing_page_url")) or doi or w.get("id", "")
            cited_by = w.get("cited_by_count") or 0

            rel = _compute_relevance(f"{title} {abstract}", terms)
            cred = min(97.0, 84.0 + (6.0 if cited_by >= 10 else 2.0) + (3.0 if doi else 0.0))
            rec = _compute_recency(year)
            comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)

            excerpt = f"{abstract[:1250]} (Cited by {cited_by} works)"
            items.append(
                SourceItem(
                    source_id="",
                    title=title,
                    author_or_publisher=author_pub,
                    publication_date=pub_date,
                    publication_year=year,
                    url=landing,
                    source_type="academic_paper",
                    provider="OpenAlex Academic",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=round(cred, 1),
                    recency_score=rec,
                    composite_score=comp,
                    relevant_information=excerpt,
                    snippets=[abstract[:600]],
                )
            )
            if len(items) >= limit:
                break
        return items
    except Exception as exc:
        logger.warning("OpenAlex search failed for '%s': %s", query, exc)
        return []


async def _search_arxiv(client: httpx.AsyncClient, query: str, sub_q_id: str, limit: int = 2) -> list[SourceItem]:
    try:
        terms = _query_terms(query)[:6]
        arxiv_q = " AND ".join(f"all:{t}" for t in terms) if terms else f"all:{query}"
        resp = await client.get(
            "https://export.arxiv.org/api/query",
            params={"search_query": arxiv_q, "start": 0, "max_results": limit, "sortBy": "relevance"},
            timeout=12.0,
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items: list[SourceItem] = []
        for entry in root.findall("atom:entry", ns):
            title = re.sub(r"\s+", " ", (entry.findtext("atom:title", "", ns) or "")).strip()
            summary = re.sub(r"\s+", " ", (entry.findtext("atom:summary", "", ns) or "")).strip()
            url = (entry.findtext("atom:id", "", ns) or "").strip()
            published = (entry.findtext("atom:published", "", ns) or "")[:10]
            authors_list = [
                a.findtext("atom:name", "", ns)
                for a in entry.findall("atom:author", ns)
                if a.findtext("atom:name", "", ns)
            ]
            author_str = ", ".join(authors_list[:3]) + (" et al." if len(authors_list) > 3 else "")
            if not title or not summary:
                continue
            year = _parse_year(published)
            rel = _compute_relevance(f"{title} {summary}", terms)
            cred = 82.0
            rec = _compute_recency(year)
            comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)
            items.append(
                SourceItem(
                    source_id="",
                    title=title,
                    author_or_publisher=f"{author_str or 'arXiv Authors'} (arXiv Preprint)",
                    publication_date=published or "Preprint",
                    publication_year=year,
                    url=url,
                    source_type="academic_paper",
                    provider="arXiv Preprints",
                    sub_questions_matched=[sub_q_id],
                    relevance_score=rel,
                    credibility_score=cred,
                    recency_score=rec,
                    composite_score=comp,
                    relevant_information=summary[:1300],
                    snippets=[summary[:600]],
                )
            )
        return items
    except Exception as exc:
        logger.warning("arXiv search failed for '%s': %s", query, exc)
        return []


def _search_knowledge_base(query: str, sub_q_id: str, limit: int = 2) -> list[SourceItem]:
    docs = database.list_kb_docs()
    terms = _query_terms(query)
    scored: list[tuple[float, SourceItem]] = []
    for d in docs:
        haystack = f"{d.title} {d.category} {' '.join(d.tags)} {d.content}".lower()
        hits = sum(1 for t in set(terms) if t in haystack)
        title_hits = sum(1 for t in set(terms) if t in d.title.lower() or t in " ".join(d.tags).lower())
        if hits == 0 and title_hits == 0:
            continue
        rel = min(96.0, 50.0 + hits * 8.0 + title_hits * 7.0)
        year = _parse_year(d.publication_date)
        cred = 86.0
        rec = _compute_recency(year)
        comp = round(0.45 * rel + 0.35 * cred + 0.20 * rec, 1)
        item = SourceItem(
            source_id="",
            title=d.title,
            author_or_publisher=d.author_or_publisher,
            publication_date=d.publication_date,
            publication_year=year,
            url=f"kb://{d.id}",
            source_type="knowledge_base",
            provider="Knowledge Base",
            sub_questions_matched=[sub_q_id],
            relevance_score=round(rel, 1),
            credibility_score=cred,
            recency_score=rec,
            composite_score=comp,
            relevant_information=d.content[:1400],
            snippets=[d.content[:600]],
        )
        scored.append((comp, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


# ---------------------------------------------------------------------------
# Orchestrator: Per-Sub-Question Multi-Source Search + Dedup + Diversity
# ---------------------------------------------------------------------------

async def execute_multi_source_search(
    *,
    main_question: str,
    sub_questions: list[SubQuestion],
    enabled_sources: list[SourceType],
    pdf_ids: list[str],
    depth: str = "standard",
) -> tuple[list[SourceItem], list[SearchExecutionLog]]:
    """Run independent searches for every sub-question, deduplicate, score, and rank."""
    max_total = 8 if depth == "quick" else 14 if depth == "standard" else 20

    # Resolve PDFs (explicitly attached, or all uploaded PDFs if uploaded_pdf enabled and none specified)
    pdf_records: list[dict] = []
    if "uploaded_pdf" in enabled_sources:
        if pdf_ids:
            for pid in pdf_ids:
                rec = database.get_pdf_raw(pid)
                if rec:
                    pdf_records.append(rec)
        else:
            for meta in database.list_pdfs()[:3]:
                rec = database.get_pdf_raw(meta.id)
                if rec:
                    pdf_records.append(rec)

    raw_pool: list[SourceItem] = []
    logs: list[SearchExecutionLog] = []

    async with httpx.AsyncClient(follow_redirects=True) as client:
        for sq_idx, sq in enumerate(sub_questions):
            query = (sq.search_query or sq.question).strip()
            tasks = []
            providers_queried: list[str] = []

            if "web" in enabled_sources:
                if get_settings().effective_tavily_key:
                    tasks.append(_search_tavily(client, query, sq.id, max_results=3))
                    providers_queried.append("Tavily Web Search")
                tasks.append(_search_wikipedia(client, query, sq.id, limit=2))
                providers_queried.append("Wikipedia")
                tasks.append(_search_ddg_instant(client, query, sq.id, limit=2))
                tasks.append(_search_duckduckgo(client, query, sq.id, limit=2))
                providers_queried.append("DuckDuckGo Web")

            if "academic_paper" in enabled_sources:
                tasks.append(_search_openalex(client, query, sq.id, limit=3))
                providers_queried.append("OpenAlex Academic")
                tasks.append(_search_crossref(client, query, sq.id, limit=2))
                providers_queried.append("Crossref Academic")
                if sq_idx == 0:
                    tasks.append(_search_arxiv(client, query, sq.id, limit=2))
                    providers_queried.append("arXiv Preprints")

            sq_hits: list[SourceItem] = []
            if tasks:
                nested = await asyncio.gather(*tasks, return_exceptions=True)
                for res in nested:
                    if isinstance(res, list):
                        sq_hits.extend(res)

            if "knowledge_base" in enabled_sources:
                providers_queried.append("Knowledge Base")
                sq_hits.extend(_search_knowledge_base(f"{main_question} {query}", sq.id, limit=2))

            if pdf_records and "uploaded_pdf" in enabled_sources:
                providers_queried.append("PyMuPDF Uploads")
                sq_hits.extend(search_uploaded_pdfs(query, sq.id, pdf_records, max_hits=3))

            raw_pool.extend(sq_hits)
            logs.append(
                SearchExecutionLog(
                    sub_question_id=sq.id,
                    sub_question=sq.question,
                    query=query,
                    providers_queried=providers_queried,
                    raw_results_count=len(sq_hits),
                    retained_source_ids=[],
                )
            )

    # Deduplicate by normalized URL or normalized title
    dedup_by_key: dict[str, SourceItem] = {}
    for item in raw_pool:
        url_key = _normalize_url(item.url)
        title_key = _normalize_title(item.title)
        key = url_key if url_key and not item.url.startswith(("pdf://", "kb://")) else f"{item.source_type}:{title_key}"
        if key not in dedup_by_key:
            dedup_by_key[key] = item
        else:
            existing = dedup_by_key[key]
            for sq_id in item.sub_questions_matched:
                if sq_id not in existing.sub_questions_matched:
                    existing.sub_questions_matched.append(sq_id)
            for snip in item.snippets:
                if snip and snip not in existing.snippets:
                    existing.snippets.append(snip)
            existing.relevance_score = max(existing.relevance_score, item.relevance_score)
            existing.composite_score = round(
                min(99.0, max(existing.composite_score, item.composite_score) + 2.0), 1
            )

    deduped = list(dedup_by_key.values())
    deduped.sort(key=lambda s: s.composite_score, reverse=True)

    # Guarantee multi-source diversity (uploaded_pdf, academic_paper, web, knowledge_base)
    selected: list[SourceItem] = []
    used_keys: set[int] = set()
    for stype in ("uploaded_pdf", "academic_paper", "web", "knowledge_base"):
        type_candidates = [idx for idx, s in enumerate(deduped) if s.source_type == stype]
        quota = 2
        for idx in type_candidates[:quota]:
            if len(selected) < max_total and idx not in used_keys:
                selected.append(deduped[idx])
                used_keys.add(idx)

    for idx, s in enumerate(deduped):
        if len(selected) >= max_total:
            break
        if idx not in used_keys:
            selected.append(s)
            used_keys.add(idx)

    selected.sort(key=lambda s: s.composite_score, reverse=True)
    for i, src in enumerate(selected, start=1):
        src.source_id = f"S{i}"

    # Populate retained source IDs in logs
    for log in logs:
        log.retained_source_ids = [
            s.source_id for s in selected if log.sub_question_id in s.sub_questions_matched
        ]

    return selected, logs
