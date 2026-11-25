import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';
import { buildKeywordSvgDataUri } from '../services/imageSearchService';

/** Compute a deterministic key for identifying bookmarked images across searches. */
export function getImageBookmarkKey(img = {}) {
  if (img.is_fallback && img.title) {
    return `fallback:${img.title.toLowerCase().slice(0, 120)}`;
  }
  const url = String(img.image_url || img.thumbnail_url || '').trim();
  if (url && !url.startsWith('data:')) {
    return url.slice(0, 240);
  }
  return img.id || img.title || 'unknown-image';
}

/**
 * Reusable Related Images gallery with:
 * - Responsive 3-to-4 column grid (or 2-column compact mode for report panels)
 * - Smooth hover zoom, gradient highlight border, and hover title/caption overlay
 * - Quick Save/Bookmark to Collection + Expand Fullscreen action buttons
 * - Shimmering skeleton placeholders during fetch & broken-image recovery (`onError`)
 * - Fullscreen Lightbox modal with Prev/Next arrows, Escape support & "Save to Collection"
 */
export default function RelatedImagesGallery({
  images = [],
  loading = false,
  topic = '',
  columns = 4,
  maxItems = 8,
  title = 'Related Images',
  savedImageKeys,
  onToggleSaveImage,
  savingImageKey = '',
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [brokenIds, setBrokenIds] = useState({});

  const displayImages = images.slice(0, maxItems);
  const activeImage =
    selectedIndex !== null && displayImages[selectedIndex] ? displayImages[selectedIndex] : null;

  useEffect(() => {
    setBrokenIds({});
    setSelectedIndex(null);
  }, [images]);

  // Keyboard navigation inside fullscreen Lightbox modal
  useEffect(() => {
    if (selectedIndex === null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev + 1) % displayImages.length
        );
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev - 1 + displayImages.length) % displayImages.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIndex, displayImages.length]);

  const getResolvedSrc = (img, idx, full = false) => {
    const key = `${img.id || idx}-${full ? 'full' : 'thumb'}`;
    if (brokenIds[key]) {
      return buildKeywordSvgDataUri(
        img.title || topic || 'Topic Visual',
        img.caption || 'Curated fallback illustration',
        undefined,
        idx
      );
    }
    return (
      (full ? img.image_url : img.thumbnail_url) ||
      img.image_url ||
      buildKeywordSvgDataUri(topic || 'Visual', 'Curated topic artwork', undefined, idx)
    );
  };

  const markBroken = (img, idx, full = false) => {
    const key = `${img.id || idx}-${full ? 'full' : 'thumb'}`;
    setBrokenIds((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const isSaved = (img) => {
    if (!savedImageKeys) return false;
    const key = getImageBookmarkKey(img);
    return savedImageKeys instanceof Set ? savedImageKeys.has(key) : Boolean(savedImageKeys[key]);
  };

  const gridColsClass =
    columns === 2
      ? 'grid grid-cols-2 gap-3'
      : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const skeletonCount = columns === 2 ? 4 : 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl ig-btn-primary shadow-sm">
            <ImageIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">{title}</h3>
            {topic && (
              <p className="line-clamp-1 text-xs text-slate-500">
                Curated visuals for <span className="font-semibold text-slate-700">&ldquo;{topic}&rdquo;</span>
              </p>
            )}
          </div>
        </div>
        {!loading && displayImages.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200/80 bg-pink-50/70 px-3 py-1 text-[11px] font-semibold text-pink-700">
            <Sparkles className="h-3 w-3" />
            {displayImages.length} visuals · Click to inspect fullscreen
          </span>
        )}
      </div>

      {/* Skeleton Placeholders while Loading */}
      {loading && displayImages.length === 0 ? (
        <div className={gridColsClass} aria-label="Loading related images">
          {Array.from({ length: skeletonCount }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm"
            >
              <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-gradient-to-br from-orange-100 via-pink-100 to-indigo-100" />
              <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className={gridColsClass}>
          {displayImages.map((img, idx) => {
            const thumbSrc = getResolvedSrc(img, idx, false);
            const bookmarked = isSaved(img);
            const imgKey = getImageBookmarkKey(img);

            return (
              /* Gradient border wrapper highlights smoothly on hover */
              <div
                key={img.id || `rel-img-${idx}`}
                className="group relative rounded-2xl bg-slate-200/80 p-[1.5px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-gradient-to-tr hover:from-[#f58529] hover:via-[#dd2a7b] hover:to-[#515bd4] hover:shadow-xl"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(idx);
                    }
                  }}
                  className="flex h-full cursor-pointer flex-col overflow-hidden rounded-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <img
                      src={thumbSrc}
                      alt={img.title || topic || `Related visual ${idx + 1}`}
                      loading="lazy"
                      onError={() => markBroken(img, idx, false)}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />

                    {/* Provider tag */}
                    <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-slate-950/65 px-2.5 py-0.5 text-[10px] font-semibold capitalize text-white backdrop-blur-sm">
                      {img.is_fallback ? 'Curated' : img.provider}
                    </span>

                    {/* Quick Action Icons: Save/Bookmark + Expand Fullscreen */}
                    <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
                      {onToggleSaveImage && (
                        <button
                          type="button"
                          disabled={savingImageKey === imgKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveImage(img);
                          }}
                          aria-label={bookmarked ? 'Remove from Saved collection' : 'Save image to collection'}
                          title={bookmarked ? 'Saved to Collection' : 'Save to Collection'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition hover:scale-105 ${
                            bookmarked
                              ? 'ig-btn-primary text-white shadow-md'
                              : 'bg-slate-950/60 text-white hover:bg-slate-950/85'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-white' : ''}`} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIndex(idx);
                        }}
                        aria-label="Expand image fullscreen"
                        title="Expand Fullscreen"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/60 text-white backdrop-blur-md transition hover:scale-105 hover:bg-slate-950/85"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Hover Overlay with Title & Caption */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <p className="line-clamp-1 text-xs font-bold text-white">
                        {img.title || 'Related Visual'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-200">
                        {img.caption || img.photographer_or_source}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {img.title || 'Related Visual'}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {img.photographer_or_source || 'Verified Visual'}
                      </p>
                    </div>
                    {bookmarked && (
                      <span className="shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700">
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sleek Fullscreen Lightbox Modal Popup */}
      {activeImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.title || 'Fullscreen Image Preview'}
          onClick={() => setSelectedIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ig-glass relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/25 bg-white shadow-2xl"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3.5">
              <div className="min-w-0 pr-4">
                <p className="text-[11px] font-bold uppercase tracking-wider ig-text-gradient">
                  Lightbox Preview · {selectedIndex + 1} of {displayImages.length}
                </p>
                <h4 className="truncate font-serif text-lg font-bold text-slate-900">
                  {activeImage.title}
                </h4>
              </div>
              <button
                type="button"
                aria-label="Close fullscreen preview"
                onClick={() => setSelectedIndex(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* High-Resolution Image Viewer + Prev/Next Controls */}
            <div className="relative flex min-h-[280px] flex-1 items-center justify-center bg-slate-950 p-3 sm:p-6">
              <img
                src={getResolvedSrc(activeImage, selectedIndex, true)}
                alt={activeImage.title}
                onError={() => markBroken(activeImage, selectedIndex, true)}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />

              {displayImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() =>
                      setSelectedIndex(
                        (selectedIndex - 1 + displayImages.length) % displayImages.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-900 shadow-lg transition hover:scale-105"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setSelectedIndex((selectedIndex + 1) % displayImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-900 shadow-lg transition hover:scale-105"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Description, Source Attribution & Action Buttons */}
            <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-slate-800">{activeImage.caption}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Source Attribution: {activeImage.photographer_or_source}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {onToggleSaveImage && (
                  <button
                    type="button"
                    disabled={savingImageKey === getImageBookmarkKey(activeImage)}
                    onClick={() => onToggleSaveImage(activeImage)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      isSaved(activeImage)
                        ? 'ig-btn-primary text-white shadow-md'
                        : 'border border-pink-300 bg-pink-50 text-pink-800 hover:bg-pink-100'
                    }`}
                  >
                    <Bookmark
                      className={`h-3.5 w-3.5 ${isSaved(activeImage) ? 'fill-white' : ''}`}
                    />
                    {isSaved(activeImage) ? 'Saved in Collection' : 'Save to Collection'}
                  </button>
                )}

                {activeImage.source_page_url && (
                  <a
                    href={activeImage.source_page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-pink-300"
                  >
                    Open Source
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
