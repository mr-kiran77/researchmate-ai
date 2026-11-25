import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Globe,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../api/client';

export default function PdfWorkspace({
  pdfs,
  onUploadPdf,
  onDeletePdf,
  onCompareWithWeb,
  onUseInResearch,
  onSaveToKb,
}) {
  const [selectedId, setSelectedId] = useState(pdfs[0]?.id || null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [compareFocus, setCompareFocus] = useState('');
  const [comparing, setComparing] = useState(false);
  const [fullDetail, setFullDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savedKbBanner, setSavedKbBanner] = useState('');
  const inputRef = useRef(null);

  const activePdf = pdfs.find((p) => p.id === selectedId) || pdfs[0] || null;

  const handleFiles = async (files) => {
    const validFiles = Array.from(files || []).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length === 0) {
      setUploadError('Please select a valid .pdf file.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      let lastUploaded = null;
      for (const file of validFiles) {
        lastUploaded = await onUploadPdf(file);
      }
      if (lastUploaded?.id) {
        setSelectedId(lastUploaded.id);
        setFullDetail(null);
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadFullText = async (pdfId) => {
    setLoadingDetail(true);
    try {
      const detail = await api.getPdfDetail(pdfId);
      setFullDetail(detail);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCompare = async () => {
    if (!activePdf || comparing) return;
    setComparing(true);
    try {
      await onCompareWithWeb(activePdf.id, compareFocus);
    } finally {
      setComparing(false);
    }
  };

  const handleSaveKb = async () => {
    if (!activePdf) return;
    await onSaveToKb({
      title: activePdf.title || activePdf.filename,
      category: 'Uploaded Research Paper',
      author_or_publisher: activePdf.author || 'Uploaded PDF',
      publication_date: activePdf.created_at.slice(0, 10),
      content: `${activePdf.analysis.summary}\n\nKey Findings:\n${(activePdf.analysis.important_findings || []).join('\n')}`,
      tags: activePdf.analysis.key_topics || ['pdf'],
    });
    setSavedKbBanner(`Saved "${activePdf.title}" summary to Knowledge Base.`);
    setTimeout(() => setSavedKbBanner(''), 4000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? 'border-blue-600 bg-blue-50'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/70'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        </div>
        <h2 className="mt-3 font-serif text-xl font-bold text-slate-900">
          {uploading ? 'Extracting & Analyzing PDF with PyMuPDF...' : 'Drag & Drop Research Papers or PDF Documents'}
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500">
          ResearchMate AI extracts page-by-page text via PyMuPDF, generates structured summaries and key findings,
          and lets you compare uploaded documents directly against live web &amp; academic sources.
        </p>
        {uploadError && (
          <div className="mx-auto mt-3 max-w-md rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
            {uploadError}
          </div>
        )}
      </div>

      {/* Main Split View: Library + Analysis */}
      {pdfs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No PDFs uploaded yet. Drag and drop a research paper above to inspect its findings and compare it with web sources.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Uploaded PDFs List */}
          <div className="space-y-2 lg:col-span-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Uploaded Documents ({pdfs.length})
            </div>
            {pdfs.map((pdf) => {
              const selected = activePdf?.id === pdf.id;
              return (
                <div
                  key={pdf.id}
                  onClick={() => {
                    setSelectedId(pdf.id);
                    setFullDetail(null);
                  }}
                  className={`cursor-pointer rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-blue-700' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900">{pdf.title}</div>
                        <div className="truncate text-[11px] text-slate-500">{pdf.filename}</div>
                        <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
                          <span>{pdf.page_count} pages</span>
                          <span>{pdf.word_count.toLocaleString()} words</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePdf(pdf.id);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete PDF"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active PDF Analysis & Compare */}
          {activePdf && (
            <div className="space-y-5 lg:col-span-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        PyMuPDF Extracted
                      </span>
                      <span className="text-xs text-slate-500">
                        {activePdf.author} &middot; {activePdf.page_count} pages &middot; {activePdf.word_count.toLocaleString()} words
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-serif text-xl font-bold text-slate-900">{activePdf.title}</h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveKb}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-600" />
                      Save to Knowledge Base
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseInResearch(activePdf.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Attach to New Research
                    </button>
                  </div>
                </div>

                {savedKbBanner && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    {savedKbBanner}
                  </div>
                )}

                {/* Summary */}
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Document Summary
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                    {activePdf.analysis?.summary}
                  </p>
                </div>

                {/* Key Topics */}
                {activePdf.analysis?.key_topics?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activePdf.analysis.key_topics.map((topic, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}

                {/* Important Findings */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Important Findings Extracted
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {(activePdf.analysis?.important_findings || []).map((finding, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-800"
                      >
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Methodology & Limitations */}
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div className="font-bold text-slate-800">Methodology / Approach</div>
                    <p className="mt-1 text-slate-600">{activePdf.analysis?.methodology_or_approach}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs">
                    <div className="flex items-center gap-1 font-bold text-amber-900">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Documented Limitations
                    </div>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                      {(activePdf.analysis?.limitations_noted || []).map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Compare with Web Sources Card */}
                <div className="mt-5 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900">
                    <Globe className="h-4 w-4 text-blue-700" />
                    Compare Uploaded PDF with Live Web &amp; Academic Sources
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Automatically fact-check this paper&apos;s claims against web search and peer-reviewed papers,
                    highlighting corroborations and conflicting findings.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={compareFocus}
                      onChange={(e) => setCompareFocus(e.target.value)}
                      placeholder="Optional focus question (or leave blank for full paper comparison)..."
                      className="flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={comparing}
                      onClick={handleCompare}
                      className="inline-flex items-center justify-center gap-2 rounded-xl ig-btn-primary px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      {comparing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Comparing...
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-3.5 w-3.5" />
                          Compare with Web Sources
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Extracted Text Preview / Full Pages */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Extracted PDF Text
                    </h4>
                    {!fullDetail && (
                      <button
                        type="button"
                        onClick={() => loadFullText(activePdf.id)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {loadingDetail ? 'Loading full text...' : 'Load Page-by-Page Text'}
                      </button>
                    )}
                  </div>

                  {fullDetail?.pages ? (
                    <div className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {fullDetail.pages.map((pg) => (
                        <div key={pg.page_number} className="border-b border-slate-200 pb-3 last:border-none">
                          <div className="mb-1 font-mono text-[11px] font-bold text-blue-700">
                            Page {pg.page_number}
                          </div>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                            {pg.text || '(No text on this page)'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-600">
                      {activePdf.preview_text}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
