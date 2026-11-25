import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Edit3,
  Play,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';

export default function ResearchPlanView({
  plan,
  editable = false,
  onChangePlan,
  onExecutePlan,
  isRunning = false,
}) {
  const [editingIdx, setEditingIdx] = useState(null);

  if (!plan) return null;

  const updateSubQ = (idx, field, val) => {
    if (!onChangePlan) return;
    const next = {
      ...plan,
      sub_questions: plan.sub_questions.map((sq, i) => (i === idx ? { ...sq, [field]: val } : sq)),
    };
    onChangePlan(next);
  };

  const addSubQ = () => {
    if (!onChangePlan) return;
    const nextId = `SQ${plan.sub_questions.length + 1}`;
    onChangePlan({
      ...plan,
      sub_questions: [
        ...plan.sub_questions,
        {
          id: nextId,
          question: 'New sub-question to investigate...',
          information_needed: 'Empirical evidence and primary source documentation.',
          target_sources: ['web', 'academic_paper'],
          search_query: plan.question,
        },
      ],
    });
    setEditingIdx(plan.sub_questions.length);
  };

  const removeSubQ = (idx) => {
    if (!onChangePlan || plan.sub_questions.length <= 2) return;
    const filtered = plan.sub_questions
      .filter((_, i) => i !== idx)
      .map((sq, i) => ({ ...sq, id: `SQ${i + 1}` }));
    onChangePlan({ ...plan, sub_questions: filtered });
  };

  return (
    <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
              FEATURE 1 · RESEARCH PLAN
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {plan.domain}
            </span>
          </div>
          <h2 className="mt-2 font-serif text-xl font-bold text-slate-900">
            Question Analysis &amp; Investigation Strategy
          </h2>
        </div>

        {editable && onExecutePlan && (
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onExecutePlan(plan)}
            className="inline-flex items-center gap-2 rounded-xl ig-btn-primary px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Executing...' : 'Approve & Execute Research Plan'}
          </button>
        )}
      </div>

      {/* Understanding & Objective */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            1. Understanding the Question
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{plan.question_understanding}</p>
        </div>

        <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-800">
            <Target className="h-3.5 w-3.5" />
            2. Research Objective
          </div>
          <p className="text-sm leading-relaxed text-slate-800">{plan.research_objective}</p>
        </div>
      </div>

      {/* Sub-Questions */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            3. Decomposed Sub-Questions &amp; Evidence Needed ({plan.sub_questions.length})
          </h3>
          {editable && (
            <button
              type="button"
              onClick={addSubQ}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Sub-Question
            </button>
          )}
        </div>

        <div className="space-y-3">
          {plan.sub_questions.map((sq, idx) => {
            const isEditing = editable && editingIdx === idx;
            return (
              <div
                key={sq.id + idx}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800">
                        {sq.id}
                      </span>
                      {(sq.target_sources || []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <input
                          value={sq.question}
                          onChange={(e) => updateSubQ(idx, 'question', e.target.value)}
                          className="w-full rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none"
                        />
                        <input
                          value={sq.information_needed}
                          onChange={(e) => updateSubQ(idx, 'information_needed', e.target.value)}
                          placeholder="Information needed..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 focus:outline-none"
                        />
                        <input
                          value={sq.search_query}
                          onChange={(e) => updateSubQ(idx, 'search_query', e.target.value)}
                          placeholder="Search query..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-1 font-mono text-xs text-slate-600 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">{sq.question}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Information needed:</span>{' '}
                          {sq.information_needed}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          Query: &ldquo;{sq.search_query}&rdquo;
                        </p>
                      </>
                    )}
                  </div>

                  {editable && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingIdx(isEditing ? null : idx)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                        title="Edit sub-question"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {plan.sub_questions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeSubQ(idx)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove sub-question"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Steps & Expected Challenges */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 lg:col-span-2">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            4. Execution Plan Stages
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(plan.plan_steps || []).map((st) => (
              <div key={st.step_number} className="flex items-start gap-2 rounded-lg bg-white p-2.5 border border-slate-100">
                {st.status === 'completed' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {st.step_number}. {st.title}
                  </div>
                  <div className="text-[11px] text-slate-500">{st.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
            <AlertCircle className="h-3.5 w-3.5" />
            Anticipated Challenges
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {(plan.expected_challenges || []).map((ch, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span>{ch}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
