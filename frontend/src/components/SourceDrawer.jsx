import React from 'react';
import { BookOpen, Calendar, Database, ExternalLink, FileText, Globe, Shield, X } from 'lucide-react';

const TYPE_META = {
  web: { label: 'Web Source', icon: Globe, badge: 'bg-sky-100 text-sky-800' },
  academic_paper: { label: 'Research Paper', icon: BookOpen, badge: 'bg-indigo-100 text-indigo-800' },
  uploaded_pdf: { label: 'Uploaded PDF', icon: FileText, badge: 'bg-emerald-100 text-emerald-800' },
  knowledge_base: { label: 'Knowledge Base', icon: Database, badge: 'bg-amber-100 text-amber-800' },
};

export default function SourceDrawer({ source, onClose }) {
  if (!source) return null;
  const meta = TYPE_META[source.source_type] || TYPE_META.web;
  const Icon = meta.icon;
  const isHttp = source.url && source.url.startsWith('http');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                {source.source_id}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
                <Icon className="h-3 w-3" />
                {meta.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {source.provider}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-900">{source.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div>
              <span className="block font-semibold text-slate-500">Author / Publisher</span>
              <span className="font-medium text-slate-900">{source.author_or_publisher}</span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500">Publication Date</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                <Calendar className="h-3 w-3 text-slate-400" />
                {source.publication_date}
              </span>
            </div>
            <div className="col-span-2">
              <span className="block font-semibold text-slate-500">Sub-Questions Matched</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(source.sub_questions_matched || []).map((sq) => (
                  <span key={sq} className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-800">
                    {sq}
                  </span>
                ))}
                {source.page_numbers?.length > 0 && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                    Pages: {source.page_numbers.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Relevance', val: source.relevance_score, color: 'text-teal-700 bg-teal-50 border-teal-200' },
              { label: 'Credibility', val: source.credibility_score, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { label: 'Recency', val: source.recency_score, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl border p-3 text-center ${m.color}`}>
                <div className="text-[11px] font-semibold uppercase opacity-80">{m.label}</div>
                <div className="mt-0.5 font-mono text-lg font-extrabold">{Math.round(m.val)}%</div>
              </div>
            ))}
          </div>

          {/* Link */}
          {isHttp && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
            >
              <span className="truncate pr-3">{source.url}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          )}

          {/* Extracted Snippets */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              Extracted Evidence
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">
              {source.relevant_information}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
