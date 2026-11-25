import React from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Hash, Sparkles } from 'lucide-react';
import RelatedImagesGallery from './RelatedImagesGallery';

/**
 * Dual Search Results View:
 * 1. Top Section — Topic Overview & Key Information (glassmorphism card with Topic Title,
 *    clear overview explanation, key bullet-point facts, quick tags, and source citations).
 * 2. Bottom Section — Related Images Gallery (responsive 3-to-4 column grid with hover
 *    zoom, gradient border highlight, Save-to-Collection bookmark, & fullscreen Lightbox).
 */
export default function QuickTopicResults({
  result,
  loading,
  query,
  savedImageKeys,
  onToggleSaveImage,
  savingImageKey,
  onSelectTag,
}) {
  if (!loading && !result) return null;

  const activeQuery = result?.query || query;
  const images = result?.related_images || [];
  const tags = result?.tags || [];

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-6" aria-label="Topic Search Results">
      {/* ================================================================== */}
      {/* TOP SECTION: Topic Overview & Key Information                      */}
      {/* ================================================================== */}
      <section className="overflow-hidden rounded-2xl ig-glass shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundImage: 'var(--ig-gradient)' }} />

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl ig-btn-primary text-white shadow-sm">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider ig-text-gradient">
                  Topic Overview &amp; Key Information
                </p>
                <h2 className="font-serif text-xl font-bold text-slate-900 sm:text-2xl">
                  {loading && !result ? `Searching “${activeQuery}”...` : result.summary_title}
                </h2>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-pink-600" />
              Instant Multi-Source Summary
            </span>
          </div>

          {loading && !result ? (
            /* Loading Skeleton Placeholders for Written Topic Info */
            <div className="space-y-4" aria-label="Loading topic overview">
              <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-4">
                <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="h-3 w-36 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overview Paragraph */}
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <p className="text-sm leading-relaxed text-slate-800">{result.summary_text}</p>
              </div>

              {/* Key Bullet-Point Facts & Quick Tags */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {result.key_points?.length > 0 && (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-4 lg:col-span-8">
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      Key Facts &amp; Takeaways
                    </p>
                    <ul className="space-y-2">
                      {result.key_points.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-600" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-4 lg:col-span-4">
                  {/* Quick Tags */}
                  {tags.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-4">
                      <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Quick Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onSelectTag?.(tag)}
                            className="inline-flex items-center gap-1 rounded-full border border-pink-200/80 bg-pink-50/70 px-2.5 py-1 text-[11px] font-semibold text-pink-800 transition hover:border-pink-400 hover:shadow-sm"
                          >
                            <Hash className="h-3 w-3" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compact Citation Links */}
                  {result.sources?.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Reference Sources ({result.sources.length})
                      </p>
                      <div className="space-y-1.5">
                        {result.sources.slice(0, 3).map((src) => (
                          <a
                            key={src.source_id}
                            href={src.url?.startsWith('http') ? src.url : undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-slate-50/60 px-2.5 py-1.5 text-xs transition hover:border-pink-300"
                          >
                            <span className="truncate font-semibold text-slate-800">
                              <span className="mr-1.5 font-mono text-[10px] font-bold text-pink-700">
                                [{src.source_id}]
                              </span>
                              {src.title}
                            </span>
                            {src.url?.startsWith('http') && (
                              <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* BOTTOM SECTION: Related Images 3-to-4 Column Responsive Gallery    */}
      {/* ================================================================== */}
      <section className="rounded-2xl ig-glass p-5 shadow-sm sm:p-6">
        <RelatedImagesGallery
          images={images}
          loading={loading}
          topic={activeQuery}
          columns={4}
          maxItems={8}
          title="Related Images Gallery"
          savedImageKeys={savedImageKeys}
          onToggleSaveImage={onToggleSaveImage}
          savingImageKey={savingImageKey}
        />
      </section>
    </div>
  );
}
