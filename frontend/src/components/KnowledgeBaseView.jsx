import React, { useState } from 'react';
import { BookMarked, Database, Plus, Trash2 } from 'lucide-react';

export default function KnowledgeBaseView({ docs, onCreateDoc, onDeleteDoc }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Academic Brief');
  const [author, setAuthor] = useState('ResearchMate User');
  const [pubDate, setPubDate] = useState('2026-01-15');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (title.trim().length < 3 || content.trim().length < 20) {
      setError('Provide a title (3+ chars) and content (20+ chars).');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onCreateDoc({
        title: title.trim(),
        category: category.trim() || 'General',
        author_or_publisher: author.trim() || 'Knowledge Base',
        publication_date: pubDate,
        content: content.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setTitle('');
      setContent('');
      setTags('');
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900">Knowledge Base Documents</h2>
            <p className="text-xs text-slate-500">
              Curated domain briefs and saved notes automatically searched alongside web, academic papers, and PDFs
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'Add Knowledge Document'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Document Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Internal Benchmark Notes on AI Tutoring"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Author / Publisher</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Tags (comma separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ai, education, benchmark"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Evidence / Content</label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste curated notes, empirical observations, or reference facts..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>
          {error && <div className="text-xs font-semibold text-rose-600">{error}</div>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Document'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {docs.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  {doc.category}
                </span>
                <span className="font-mono text-[11px] text-slate-400">{doc.publication_date}</span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteDoc(doc.id)}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="Delete document"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <h3 className="mt-2 text-sm font-bold text-slate-900">{doc.title}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{doc.author_or_publisher}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{doc.content}</p>
            {doc.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {doc.tags.map((t, i) => (
                  <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
