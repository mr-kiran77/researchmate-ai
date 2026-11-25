"""Topic-aware Related Images retrieval service.

Architecture & Extensibility:
- Out of the box, queries free, keyless public endpoints in parallel:
  1. English Wikipedia PageImages (encyclopedic photographs & topic visuals)
  2. Wikimedia Commons Media Search (high-res real photos with attribution)
  3. Openverse Creative Commons API (CC-licensed photography)
- Optional commercial API keys:
  Drop `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` into `backend/.env` and they
  are automatically prioritized first with proper attribution links.
- Guaranteed zero-broken-link fallback:
  If external APIs return fewer than 4 images (e.g., offline environments or
  ultra-niche topics), deterministic topic-matched SVG artwork cards are generated
  so the UI always renders crisp, valid visuals with topic labels.
"""

from __future__ import annotations

import asyncio
import html
import logging
import re
import urllib.parse
from typing import Optional

import httpx

from app.config import get_settings
from app.schemas import QuickTopicSearchResponse, RelatedImage, SourceItem
from app.services.search_service import (
    WIKI_HEADERS,
    _search_ddg_instant,
    _search_knowledge_base,
    _search_openalex,
    _search_wikipedia,
)

logger = logging.getLogger(__name__)

# Stopwords stripped when condensing long natural-language questions into concise visual queries
_IMAGE_QUERY_STOPWORDS = {
    "what", "are", "the", "advantages", "and", "disadvantages", "of", "in", "on", "for",
    "how", "effective", "beyond", "why", "does", "empirical", "evidence", "say", "about",
    "compare", "vs", "versus", "between", "impact", "effects", "role", "with", "from",
    "is", "it", "should", "can", "could", "would", "which", "when", "where", "who",
    "study", "analysis", "report", "explain", "describe", "overview",
}

_SAFE_RASTER_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

_INSTAGRAM_PALETTES = [
    ("#f58529", "#dd2a7b", "#515bd4"),
    ("#fd5949", "#d6249f", "#285AEB"),
    ("#f97316", "#ec4899", "#8134af"),
    ("#fb7185", "#a855f7", "#3b82f6"),
    ("#f59e0b", "#ef4444", "#8b5cf6"),
    ("#ec4899", "#8134af", "#1e3a8a"),
]


def _extract_visual_keywords(raw_query: str) -> tuple[str, list[str]]:
    """Turn a long research question into a crisp visual search phrase + core terms."""
    cleaned = re.sub(r"[^\w\s-]", " ", (raw_query or "").strip())
    words = [w for w in cleaned.split() if len(w) >= 2]
    filtered = [w for w in words if w.lower() not in _IMAGE_QUERY_STOPWORDS]
    if not filtered:
        filtered = words[:4] or ["Research"]
    # Keep up to 4 most expressive topic words for photographic image search
    phrase = " ".join(filtered[:4])
    return phrase, filtered[:6]


def _strip_html(text: str) -> str:
    if not text:
        return ""
    no_tags = re.sub(r"<[^>]+>", " ", text)
    unescaped = html.unescape(no_tags)
    return re.sub(r"\s+", " ", unescaped).strip()


def _is_usable_photo_url(url: str) -> bool:
    if not url or not url.startswith(("https://", "http://")):
        return False
    low = url.lower().split("?")[0]
    # Avoid tiny icons, SVGs of flags/maps unless needed, or raw PDFs/TIFFs
    if low.endswith((".svg", ".pdf", ".tif", ".tiff", ".ogv", ".webm", ".djvu")):
        return False
    if "wiki-commons-logo" in low or "commons-logo" in low or "question_book" in low:
        return False
    return True


def _build_topic_fallback_svg(
    *,
    topic: str,
    subtitle: str,
    badge: str,
    palette_idx: int,
    variant: int,
) -> str:
    """Create a crisp, topic-branded inline SVG visual card so niche/offline queries never break."""
    c1, c2, c3 = _INSTAGRAM_PALETTES[palette_idx % len(_INSTAGRAM_PALETTES)]
    safe_topic = html.escape((topic or "Topic Overview")[:42])
    safe_sub = html.escape((subtitle or "Visual Knowledge Card")[:58])
    safe_badge = html.escape((badge or "Visual Summary")[:24])

    # Vary subtle geometric motifs per card variant for visual diversity
    motif_shapes = [
        f'<circle cx="620" cy="110" r="140" fill="{c2}" opacity="0.28"/><circle cx="140" cy="420" r="160" fill="{c3}" opacity="0.22"/><path d="M90 300 Q360 120 710 290" stroke="white" stroke-opacity="0.28" stroke-width="3" fill="none"/>',
        f'<rect x="460" y="60" width="260" height="260" rx="48" transform="rotate(14 590 190)" fill="{c3}" opacity="0.24"/><circle cx="170" cy="130" r="110" fill="{c1}" opacity="0.32"/>',
        f'<polygon points="620,60 760,340 480,340" fill="{c2}" opacity="0.22"/><circle cx="200" cy="360" r="150" fill="{c1}" opacity="0.25"/>',
        f'<circle cx="400" cy="240" r="190" stroke="white" stroke-opacity="0.18" stroke-width="2" fill="none"/><circle cx="400" cy="240" r="120" stroke="white" stroke-opacity="0.24" stroke-width="2" fill="none"/>',
    ]
    motif = motif_shapes[variant % len(motif_shapes)]

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">'
        "<defs>"
        f'<linearGradient id="g{variant}" x1="0%" y1="0%" x2="100%" y2="100%">'
        f'<stop offset="0%" stop-color="{c1}"/>'
        f'<stop offset="52%" stop-color="{c2}"/>'
        f'<stop offset="100%" stop-color="{c3}"/>'
        "</linearGradient>"
        "</defs>"
        f'<rect width="800" height="500" fill="url(#g{variant})"/>'
        f"{motif}"
        '<rect x="44" y="44" width="712" height="412" rx="28" fill="#0f172a" fill-opacity="0.36" stroke="white" stroke-opacity="0.26" stroke-width="1.5"/>'
        f'<rect x="76" y="78" width="188" height="34" rx="17" fill="white" fill-opacity="0.22"/>'
        f'<text x="94" y="100" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15" font-weight="700" fill="#ffffff">{safe_badge}</text>'
        f'<text x="76" y="245" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="38" font-weight="800" fill="#ffffff">{safe_topic}</text>'
        f'<text x="76" y="294" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="21" font-weight="500" fill="#f8fafc" fill-opacity="0.9">{safe_sub}</text>'
        '<text x="76" y="408" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15" font-weight="600" fill="#e2e8f0" fill-opacity="0.82">ResearchMate AI · Topic Visual Card</text>'
        "</svg>"
    )
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def generate_fallback_images(query: str, count: int = 6, start_index: int = 1) -> list[RelatedImage]:
    """Generate clean topic-relevant visual cards when remote photos are unavailable."""
    phrase, terms = _extract_visual_keywords(query)
    focus = phrase.title()
    aspect_templates = [
        ("Concept Overview", f"Core concepts & principles of {focus}"),
        ("Key Applications", f"Real-world use cases across {focus}"),
        ("Systems & Structure", f"Architecture & mechanisms behind {focus}"),
        ("Benefits & Impact", f"Measurable outcomes in {focus}"),
        ("Challenges & Ethics", f"Open debates & limitations in {focus}"),
        ("Future Trajectory", f"Emerging trends shaping {focus}"),
    ]
    cards: list[RelatedImage] = []
    for i in range(count):
        idx = start_index + i
        badge, subtitle = aspect_templates[(idx - 1) % len(aspect_templates)]
        kw = terms[(idx - 1) % len(terms)].title() if terms else focus
        data_uri = _build_topic_fallback_svg(
            topic=f"{focus}" if i % 2 == 0 else f"{kw}: {badge}",
            subtitle=subtitle,
            badge=badge,
            palette_idx=idx - 1,
            variant=idx - 1,
        )
        cards.append(
            RelatedImage(
                id=f"fallback-img-{idx}",
                title=f"{focus} — {badge}",
                caption=subtitle,
                image_url=data_uri,
                thumbnail_url=data_uri,
                source_page_url="",
                photographer_or_source="ResearchMate Visual Engine",
                provider="topic_fallback",
                is_fallback=True,
            )
        )
    return cards


# ---------------------------------------------------------------------------
# External Image API Providers (Optional API Key Providers + Free Keyless APIs)
# ---------------------------------------------------------------------------

async def _search_unsplash(
    client: httpx.AsyncClient,
    query: str,
    api_key: str,
    limit: int = 6,
) -> list[RelatedImage]:
    """Fetch high-resolution stock photography via Unsplash when UNSPLASH_ACCESS_KEY is configured."""
    if not api_key:
        return []
    try:
        resp = await client.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": limit, "content_filter": "high"},
            headers={"Authorization": f"Client-ID {api_key}", "Accept-Version": "v1"},
            timeout=6.0,
        )
        resp.raise_for_status()
        results: list[RelatedImage] = []
        for idx, item in enumerate(resp.json().get("results", []), start=1):
            urls = item.get("urls") or {}
            full_url = urls.get("regular") or urls.get("full") or ""
            thumb_url = urls.get("small") or urls.get("thumb") or full_url
            if not _is_usable_photo_url(full_url):
                continue
            user = (item.get("user") or {}).get("name") or "Unsplash Photographer"
            desc = (item.get("description") or item.get("alt_description") or query).strip()
            results.append(
                RelatedImage(
                    id=f"unsplash-{item.get('id', idx)}",
                    title=desc[:80].capitalize(),
                    caption=desc[:160],
                    image_url=full_url,
                    thumbnail_url=thumb_url,
                    source_page_url=(item.get("links") or {}).get("html") or "",
                    photographer_or_source=f"{user} · Unsplash",
                    provider="unsplash",
                    is_fallback=False,
                )
            )
        return results
    except Exception as exc:
        logger.warning("Unsplash image search failed for '%s': %s", query, exc)
        return []


async def _search_pexels(
    client: httpx.AsyncClient,
    query: str,
    api_key: str,
    limit: int = 6,
) -> list[RelatedImage]:
    """Fetch stock photography via Pexels when PEXELS_API_KEY is configured."""
    if not api_key:
        return []
    try:
        resp = await client.get(
            "https://api.pexels.com/v1/search",
            params={"query": query, "per_page": limit},
            headers={"Authorization": api_key},
            timeout=6.0,
        )
        resp.raise_for_status()
        results: list[RelatedImage] = []
        for idx, photo in enumerate(resp.json().get("photos", []), start=1):
            src = photo.get("src") or {}
            full_url = src.get("large2x") or src.get("large") or ""
            thumb_url = src.get("medium") or src.get("small") or full_url
            if not _is_usable_photo_url(full_url):
                continue
            photographer = photo.get("photographer") or "Pexels Photographer"
            alt = (photo.get("alt") or f"{query} visual").strip()
            results.append(
                RelatedImage(
                    id=f"pexels-{photo.get('id', idx)}",
                    title=alt[:80],
                    caption=alt[:160],
                    image_url=full_url,
                    thumbnail_url=thumb_url,
                    source_page_url=photo.get("url") or "",
                    photographer_or_source=f"{photographer} · Pexels",
                    provider="pexels",
                    is_fallback=False,
                )
            )
        return results
    except Exception as exc:
        logger.warning("Pexels image search failed for '%s': %s", query, exc)
        return []


async def _search_wikipedia_pageimages(
    client: httpx.AsyncClient,
    query: str,
    limit: int = 4,
) -> list[RelatedImage]:
    """Query Wikipedia articles matching the topic and extract verified page thumbnails."""
    try:
        resp = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrlimit": max(4, limit * 2),
                "prop": "pageimages|info|extracts",
                "piprop": "thumbnail|original",
                "pithumbsize": 900,
                "inprop": "url",
                "exintro": 1,
                "explaintext": 1,
                "exsentences": 2,
                "format": "json",
            },
            headers=WIKI_HEADERS,
            timeout=6.0,
        )
        resp.raise_for_status()
        pages = (resp.json().get("query") or {}).get("pages") or {}
        ordered = sorted(pages.values(), key=lambda p: p.get("index", 999))
        results: list[RelatedImage] = []
        for page in ordered:
            thumb = (page.get("thumbnail") or {}).get("source") or ""
            orig = (page.get("original") or {}).get("source") or thumb
            chosen = thumb if _is_usable_photo_url(thumb) else orig
            if not _is_usable_photo_url(chosen):
                continue
            full_img = orig if _is_usable_photo_url(orig) else chosen
            title = (page.get("title") or query).strip()
            extract = (page.get("extract") or title).strip()
            results.append(
                RelatedImage(
                    id=f"wiki-img-{page.get('pageid', len(results) + 1)}",
                    title=title[:80],
                    caption=extract[:165],
                    image_url=full_img,
                    thumbnail_url=chosen,
                    source_page_url=page.get("fullurl") or "",
                    photographer_or_source="Wikipedia · CC BY-SA",
                    provider="wikipedia",
                    is_fallback=False,
                )
            )
            if len(results) >= limit:
                break
        return results
    except Exception as exc:
        logger.warning("Wikipedia image search failed for '%s': %s", query, exc)
        return []


async def _search_wikimedia_commons(
    client: httpx.AsyncClient,
    query: str,
    limit: int = 6,
) -> list[RelatedImage]:
    """Query Wikimedia Commons File namespace (namespace 6) for topic-relevant photographs."""
    try:
        resp = await client.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": 6,
                "gsrlimit": max(8, limit * 2),
                "prop": "imageinfo",
                "iiprop": "url|mime|extmetadata",
                "iiurlwidth": 900,
                "format": "json",
            },
            headers=WIKI_HEADERS,
            timeout=6.0,
        )
        resp.raise_for_status()
        pages = (resp.json().get("query") or {}).get("pages") or {}
        ordered = sorted(pages.values(), key=lambda p: p.get("index", 999))
        results: list[RelatedImage] = []
        for page in ordered:
            infos = page.get("imageinfo") or []
            if not infos:
                continue
            info = infos[0]
            mime = (info.get("mime") or "").lower()
            if mime and mime not in _SAFE_RASTER_MIME:
                continue
            thumb_url = info.get("thumburl") or info.get("url") or ""
            full_url = info.get("url") or thumb_url
            if not _is_usable_photo_url(thumb_url):
                continue
            if not _is_usable_photo_url(full_url):
                full_url = thumb_url

            meta = info.get("extmetadata") or {}
            raw_title = (page.get("title") or "").removeprefix("File:")
            clean_title = re.sub(r"\.[a-zA-Z0-9]+$", "", raw_title).replace("_", " ").strip()
            desc = _strip_html((meta.get("ImageDescription") or {}).get("value") or "")
            artist = _strip_html((meta.get("Artist") or {}).get("value") or "") or "Wikimedia Commons"

            results.append(
                RelatedImage(
                    id=f"commons-{page.get('pageid', len(results) + 1)}",
                    title=(clean_title or query)[:80],
                    caption=(desc or clean_title or query)[:165],
                    image_url=full_url,
                    thumbnail_url=thumb_url,
                    source_page_url=info.get("descriptionurl") or "",
                    photographer_or_source=f"{artist[:42]} · Wikimedia Commons",
                    provider="wikimedia",
                    is_fallback=False,
                )
            )
            if len(results) >= limit:
                break
        return results
    except Exception as exc:
        logger.warning("Wikimedia Commons image search failed for '%s': %s", query, exc)
        return []


async def _search_openverse(
    client: httpx.AsyncClient,
    query: str,
    limit: int = 6,
) -> list[RelatedImage]:
    """Query Openverse open Creative Commons image catalog (keyless public endpoint)."""
    try:
        resp = await client.get(
            "https://api.openverse.org/v1/images/",
            params={"q": query, "page_size": max(6, limit), "mature": "false"},
            headers={"User-Agent": WIKI_HEADERS["User-Agent"], "Accept": "application/json"},
            timeout=6.0,
        )
        resp.raise_for_status()
        results: list[RelatedImage] = []
        for idx, item in enumerate(resp.json().get("results", []), start=1):
            full_url = item.get("url") or ""
            thumb_url = item.get("thumbnail") or full_url
            if not _is_usable_photo_url(thumb_url):
                continue
            if not _is_usable_photo_url(full_url):
                full_url = thumb_url
            title = (item.get("title") or f"{query} visual").strip()
            creator = (item.get("creator") or "Openverse Contributor").strip()
            lic = (item.get("license") or "CC").upper()
            results.append(
                RelatedImage(
                    id=f"openverse-{item.get('id', idx)}",
                    title=title[:80],
                    caption=f"{title[:120]} ({lic})",
                    image_url=full_url,
                    thumbnail_url=thumb_url,
                    source_page_url=item.get("foreign_landing_url") or "",
                    photographer_or_source=f"{creator[:36]} · Openverse",
                    provider="openverse",
                    is_fallback=False,
                )
            )
            if len(results) >= limit:
                break
        return results
    except Exception as exc:
        logger.warning("Openverse image search failed for '%s': %s", query, exc)
        return []


async def _search_pixabay(
    client: httpx.AsyncClient,
    query: str,
    api_key: str,
    limit: int = 8,
) -> list[RelatedImage]:
    """Fetch Creative Commons / editorial photography via Pixabay when PIXABAY_API_KEY is configured."""
    if not api_key:
        return []
    try:
        resp = await client.get(
            "https://pixabay.com/api/",
            params={"key": api_key, "q": query, "image_type": "photo", "safesearch": "true", "per_page": max(6, limit)},
            timeout=6.0,
        )
        resp.raise_for_status()
        results: list[RelatedImage] = []
        for idx, hit in enumerate(resp.json().get("hits", []), start=1):
            full_url = hit.get("largeImageURL") or hit.get("webformatURL") or ""
            thumb_url = hit.get("webformatURL") or hit.get("previewURL") or full_url
            if not _is_usable_photo_url(full_url):
                continue
            tags_str = (hit.get("tags") or f"{query} photography").strip()
            user = (hit.get("user") or "Pixabay Contributor").strip()
            results.append(
                RelatedImage(
                    id=f"pixabay-{hit.get('id', idx)}",
                    title=tags_str.title()[:80],
                    caption=f"{tags_str.capitalize()} — High-resolution visual",
                    image_url=full_url,
                    thumbnail_url=thumb_url,
                    source_page_url=hit.get("pageURL") or "",
                    photographer_or_source=f"{user} · Pixabay",
                    provider="pixabay",
                    is_fallback=False,
                )
            )
        return results
    except Exception as exc:
        logger.warning("Pixabay image search failed for '%s': %s", query, exc)
        return []


async def search_related_images(query: str, limit: int = 8) -> list[RelatedImage]:
    """Retrieve deduplicated, topic-relevant images with resilient visual fallbacks.

    Never raises or returns broken links; always pads short or failed responses
    with topic-matched SVG artwork cards up to the requested limit.
    """
    target_limit = max(4, min(limit, 12))
    clean_phrase, _ = _extract_visual_keywords(query)
    settings = get_settings()

    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [
            _search_wikipedia_pageimages(client, clean_phrase, limit=target_limit),
            _search_wikimedia_commons(client, clean_phrase, limit=target_limit),
            _search_openverse(client, clean_phrase, limit=target_limit),
        ]
        # Automatically enable Unsplash/Pexels/Pixabay at highest priority if API keys are configured
        if settings.effective_unsplash_key:
            tasks.insert(0, _search_unsplash(client, clean_phrase, settings.effective_unsplash_key, limit=target_limit))
        if settings.effective_pexels_key:
            tasks.insert(0, _search_pexels(client, clean_phrase, settings.effective_pexels_key, limit=target_limit))
        if settings.effective_pixabay_key:
            tasks.insert(0, _search_pixabay(client, clean_phrase, settings.effective_pixabay_key, limit=target_limit))

        batches = await asyncio.gather(*tasks, return_exceptions=True)

    # Deduplicate by normalized image URL while preserving priority order
    deduped: list[RelatedImage] = []
    seen_urls: set[str] = set()
    for batch in batches:
        if isinstance(batch, Exception) or not batch:
            continue
        for img in batch:
            norm = img.thumbnail_url.split("?")[0].lower()
            if norm in seen_urls:
                continue
            seen_urls.add(norm)
            deduped.append(img)
            if len(deduped) >= target_limit:
                break
        if len(deduped) >= target_limit:
            break

    # Guarantee 4-6 crisp visuals even for obscure topics or offline testing
    if len(deduped) < target_limit:
        needed = target_limit - len(deduped)
        deduped.extend(generate_fallback_images(query, count=needed, start_index=len(deduped) + 1))

    return deduped[:target_limit]


async def execute_quick_topic_search(query: str, image_limit: int = 8) -> QuickTopicSearchResponse:
    """Fetch fast written topic information alongside related images in one parallel call."""
    clean_q = (query or "").strip()
    kb_sources = _search_knowledge_base(clean_q, "QUICK", limit=2)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        wiki_res, ddg_res, oa_res, images = await asyncio.gather(
            _search_wikipedia(client, clean_q, "QUICK", limit=2),
            _search_ddg_instant(client, clean_q, "QUICK"),
            _search_openalex(client, clean_q, "QUICK", limit=2),
            search_related_images(clean_q, limit=image_limit),
            return_exceptions=True,
        )

    sources: list[SourceItem] = []
    for candidate in (wiki_res, ddg_res, oa_res):
        if isinstance(candidate, list):
            sources.extend(candidate)
    sources.extend(kb_sources)

    # Deduplicate & number S1..SN
    seen_titles: set[str] = set()
    unique_sources: list[SourceItem] = []
    for src in sources:
        norm = re.sub(r"[^a-z0-9]+", "", src.title.lower())
        if norm in seen_titles:
            continue
        seen_titles.add(norm)
        src.source_id = f"S{len(unique_sources) + 1}"
        unique_sources.append(src)
        if len(unique_sources) >= 6:
            break

    related_imgs = images if isinstance(images, list) else generate_fallback_images(clean_q, count=image_limit)
    phrase, terms = _extract_visual_keywords(clean_q)

    # Build clean topic tags for quick filtering / pills in UI
    raw_tags: list[str] = []
    for t in terms:
        tag = t.title()
        if tag not in raw_tags:
            raw_tags.append(tag)
    for src in unique_sources[:3]:
        if src.provider and src.provider not in raw_tags:
            raw_tags.append(src.provider)
    tags = raw_tags[:6]

    if unique_sources:
        lead = unique_sources[0]
        summary_title = lead.title if len(lead.title) < 90 else phrase.title()
        excerpts = [s.relevant_information.strip() for s in unique_sources[:2] if s.relevant_information.strip()]
        summary_text = " ".join(excerpts)[:750]
        key_points = [
            f"[{s.source_id}] {s.title} — {(s.relevant_information or '').strip()[:155]}..."
            for s in unique_sources[:4]
        ]
    else:
        summary_title = phrase.title()
        summary_text = (
            f"{summary_title} encompasses the core principles, real-world systems, and ongoing developments related to "
            f"\"{clean_q}\". Review the visual highlights below or launch Autonomous Research above for a verified 14-section dossier."
        )
        key_points = [
            f"Core Focus: Examines foundational ideas and real-world applications around {summary_title}.",
            "Multi-Source Ready: Combine Wikipedia, OpenAlex, arXiv, and uploaded PDFs for deeper verification.",
            "Visual Exploration: Save or bookmark any image card directly into your Profile Saved collection.",
        ]

    return QuickTopicSearchResponse(
        query=clean_q,
        summary_title=summary_title,
        summary_text=summary_text,
        key_points=key_points,
        tags=tags,
        sources=unique_sources,
        related_images=related_imgs,
    )
