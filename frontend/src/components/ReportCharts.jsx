import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 text-xs">
        <p className="font-bold text-slate-900 dark:text-white mb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2 py-0.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-slate-500 dark:text-slate-400 font-medium">{entry.name}:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {entry.value}
              {entry.name.includes('Score') || entry.name.includes('Credibility') || entry.name.includes('Relevance')
                ? '%'
                : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function ReportCharts({ analytics }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'quality' | 'verification'
  if (!analytics) return null;

  const sourceData = (analytics.source_type_breakdown || []).map((item) => ({
    name: item.name ? item.name.replace('_', ' ') : 'Unknown',
    Sources: item.value,
    Credibility: Math.round(item.secondary || 0),
    Relevance: Math.round(item.tertiary || 0),
  }));

  const verificationData = (analytics.verification_breakdown || []).map((item) => ({
    name: item.name ? item.name.replace(/_/g, ' ') : 'Unknown',
    value: item.value,
  }));

  const timelineData = (analytics.publication_timeline || []).map((item) => ({
    year: String(item.name || 'N/A'),
    Count: item.value,
  }));

  // Calculate score tiers
  const totalSources = sourceData.reduce((acc, curr) => acc + curr.Sources, 0);

  return (
    <div className="mt-6 space-y-4">
      {/* Chart Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quantitative Source Analytics &amp; Credibility Visualizer
            </h4>
            <p className="text-[11px] text-slate-500">
              Corpus distribution, confidence ratings, and temporal publication trends
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-0.5 text-xs font-medium dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-2.5 py-1 transition ${
              activeTab === 'all'
                ? 'bg-white shadow-sm font-bold text-slate-900 dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Charts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quality')}
            className={`rounded-lg px-2.5 py-1 transition ${
              activeTab === 'quality'
                ? 'bg-white shadow-sm font-bold text-slate-900 dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Quality &amp; Relevance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={`rounded-lg px-2.5 py-1 transition ${
              activeTab === 'verification'
                ? 'bg-white shadow-sm font-bold text-slate-900 dark:bg-white/15 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Status &amp; Timeline
          </button>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 ${
          activeTab === 'all'
            ? 'xl:grid-cols-3'
            : activeTab === 'quality'
            ? 'xl:grid-cols-2'
            : 'xl:grid-cols-2'
        }`}
      >
        {/* Chart 1: Source Credibility vs. Relevance */}
        {(activeTab === 'all' || activeTab === 'quality') && (
          <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 transition hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Credibility vs. Relevance
                </h5>
                <p className="text-[11px] text-slate-500">Quality score index by source type (%)</p>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Dual Metric
              </span>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} margin={{ top: 8, right: 10, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="Credibility" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Relevance" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 2: Claim Verification Breakdown Donut Chart */}
        {(activeTab === 'all' || activeTab === 'verification') && (
          <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 transition hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Claim Verification Status
                </h5>
                <p className="text-[11px] text-slate-500">Consensus breakdown across extracted claims</p>
              </div>
              <PieIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verificationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {verificationData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 3: Publication Timeline */}
        {(activeTab === 'all' || activeTab === 'verification' || activeTab === 'quality') && (
          <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 transition hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Source Publication Timeline
                </h5>
                <p className="text-[11px] text-slate-500">Recency distribution across evidence corpus</p>
              </div>
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 8, right: 10, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
