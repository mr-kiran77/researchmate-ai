import React, { useState } from 'react';
import { Clock, Search, Star, Trash2, X } from 'lucide-react';

export default function HistorySidebar({
  open,
  onClose,
  reports,
  activeReportId,
  onSelectReport,
  onDeleteReport,
}) {
  const [search, setSearch] = useState('');

  if (!open) return null;

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">Saved Research History</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search past research reports..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No saved reports found. Run a research query to automatically save it to SQLite history.
            </div>
          ) : (
            filtered.map((rep) => (
              <div
                key={rep.id}
                onClick={() => {
                  onSelectReport(rep.id);
                  onClose();
                }}
                className={`cursor-pointer rounded-xl border p-3.5 transition ${
                  activeReportId === rep.id
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {rep.is_starred && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                      <span className="truncate text-sm font-bold text-slate-900">{rep.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{rep.question}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500">
                      <span>{rep.created_at.slice(0, 10)}</span>
                      <span>&middot; {rep.source_count} sources</span>
                      <span>&middot; {rep.conflict_count} conflicts</span>
                      <span>&middot; {rep.audience}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteReport(rep.id);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete report"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
