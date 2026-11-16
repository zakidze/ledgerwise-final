'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSavedCompanies } from '@/lib/hooks';
import { normalizeIcpScore } from '@/lib/storage';
import { PipelineStatus } from '@/lib/types';
import AddCompanyModal from '@/components/AddCompanyModal';

export default function SaveCompanyPage() {
  const router = useRouter();
  const { savedCompanies, activeCompany, setActiveCompany, updateCompanyStatus, removeCompany } = useSavedCompanies();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scoreFilter, setScoreFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Calculate pipeline stats
  const totalSaved = savedCompanies.length;
  const totalDrafted = savedCompanies.filter((c) => c.status === 'DRAFTED').length;
  const totalSent = savedCompanies.filter((c) => c.status === 'SENT').length;
  const totalChatting = savedCompanies.filter((c) => c.status === 'CHATTING').length;
  const totalBooked = savedCompanies.filter((c) => c.status === 'MEETING_BOOKED').length;

  // Filter companies
  const filtered = savedCompanies.filter((comp) => {
    if (searchQuery) {
      const pool = [comp.company_name, comp.domain, comp.target_person_name, comp.trigger_reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!pool.includes(searchQuery.toLowerCase().trim())) return false;
    }
    if (statusFilter !== 'ALL' && comp.status !== statusFilter) return false;
    if (scoreFilter !== 'ALL') {
      const sc = normalizeIcpScore(comp.icp_score).toLowerCase();
      if (scoreFilter === 'High' && (!sc.includes('high') || sc.includes('medium-high'))) return false;
      if (scoreFilter === 'Medium-High' && !sc.includes('medium-high')) return false;
      if (scoreFilter === 'Medium' && (!sc.includes('medium') || sc.includes('high'))) return false;
    }
    return true;
  });

  const exportCsv = () => {
    if (savedCompanies.length === 0) return alert('No saved companies to export.');
    const headers = ['Company Name', 'Domain', 'Status', 'Persona Name', 'Persona Title', 'Trigger', 'ICP Score'];
    const escapeCsv = (val: unknown) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = savedCompanies.map((c) => [
      escapeCsv(c.company_name),
      escapeCsv(c.domain),
      escapeCsv(c.status),
      escapeCsv(c.target_person_name),
      escapeCsv(c.target_person_title),
      escapeCsv(c.trigger_reason),
      escapeCsv(c.icp_score),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerwise_saved_pipeline_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleSelectForDraft = (comp: typeof savedCompanies[0]) => {
    setActiveCompany(comp);
    router.push('/draft-email');
  };

  const handleSelectForChat = (comp: typeof savedCompanies[0]) => {
    setActiveCompany(comp);
    router.push('/chat');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Pipeline Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(245,158,11,0.15)] text-[#f59e0b] shrink-0">
            📌
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">Total Saved</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{totalSaved}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(56,189,248,0.15)] text-[#38bdf8] shrink-0">
            📝
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">Emails Drafted</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{totalDrafted}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(139,92,246,0.15)] text-[#a78bfa] shrink-0">
            🚀
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">Outbound Sent</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{totalSent}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(16,185,129,0.15)] text-[#10b981] shrink-0">
            💬
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">In Discussion</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{totalChatting}</div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(234,179,8,0.2)] text-[#eab308] shrink-0">
            🏆
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">Calls Booked</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{totalBooked}</div>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151d30] border border-[#263554] p-3 sm:p-3.5 rounded-[10px]">
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search saved companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#090e18] border border-[#263554] text-white px-3 py-1.5 rounded-[6px] text-[0.82rem] w-full sm:w-[220px] outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#090e18] border border-[#263554] text-[#94a3b8] px-2.5 py-1.5 rounded-[6px] text-[0.82rem] outline-none cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="ALL">All Pipeline Stages</option>
            <option value="SAVED">Saved</option>
            <option value="DRAFTED">Drafted</option>
            <option value="SENT">Sent</option>
            <option value="CHATTING">Chatting</option>
            <option value="MEETING_BOOKED">Meeting Booked</option>
          </select>

          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="bg-[#090e18] border border-[#263554] text-[#94a3b8] px-2.5 py-1.5 rounded-[6px] text-[0.82rem] outline-none cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="ALL">All ICP Scores</option>
            <option value="High">High Fit</option>
            <option value="Medium-High">Medium-High</option>
            <option value="Medium">Medium</option>
          </select>
        </div>

        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <button className="btn btn-outline btn-small flex-1 sm:flex-initial" onClick={exportCsv}>
            Export Pipeline CSV
          </button>
          <button className="btn btn-accent btn-small flex-1 sm:flex-initial" onClick={() => setIsAddModalOpen(true)}>
            + Add Company Manually
          </button>
        </div>
      </div>

      {/* Saved Companies Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((comp) => {
          const isCurrentActive = activeCompany && activeCompany.company_name === comp.company_name;
          const scoreVal = normalizeIcpScore(comp.icp_score);
          let badgeClass = 'badge-medium';
          if (scoreVal === 'High') badgeClass = 'badge-high';
          else if (scoreVal === 'Medium-High') badgeClass = 'badge-medium-high';

          return (
            <div
              key={comp.id || comp.company_name}
              className={`bg-[#151d30] border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${
                isCurrentActive
                  ? 'border-[#10b981] shadow-[0_0_0_1px_#10b981]'
                  : 'border-[#263554] hover:border-[#3b5079] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
              }`}
            >
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-start gap-2.5">
                  <div>
                    <h3 className="text-[1.05rem] font-bold text-white flex items-center gap-1.5">
                      <span>⭐</span>
                      <span>{comp.company_name}</span>
                      {isCurrentActive && (
                        <span className="badge badge-high text-[0.65rem] py-0.5 px-1.5">
                          ACTIVE TARGET
                        </span>
                      )}
                    </h3>
                    {comp.domain && (
                      <span className="inline-block bg-[#0e1726] text-[#38bdf8] text-[0.72rem] px-1.5 py-0.5 rounded border border-[#1e3a8a] mt-1">
                        {comp.domain}
                      </span>
                    )}
                  </div>

                  <select
                    value={comp.status}
                    onChange={(e) => updateCompanyStatus(comp.company_name, e.target.value as PipelineStatus)}
                    className="bg-[#090e18] border border-[#263554] text-white text-[0.72rem] font-semibold px-2 py-1 rounded-[6px] outline-none cursor-pointer"
                  >
                    <option value="SAVED">🟡 Saved</option>
                    <option value="DRAFTED">🔵 Drafted</option>
                    <option value="SENT">🟣 Sent</option>
                    <option value="CHATTING">🟢 Chatting</option>
                    <option value="MEETING_BOOKED">🏆 Booked</option>
                  </select>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 flex-wrap text-[0.82rem]">
                  <span className="bg-[#1e293b] text-[#94a3b8] px-1.5 py-0.5 rounded text-[0.75rem] font-medium">
                    📍 {comp.us_state || 'US'}
                  </span>
                  <span className="bg-[rgba(139,92,246,0.15)] text-[#c4b5fd] px-1.5 py-0.5 rounded text-[0.75rem] font-semibold">
                    🗓️ {comp.founded_year || 'N/A'}
                  </span>
                  <span className={`badge ${badgeClass}`}>{scoreVal}</span>
                  <span className="text-[0.75rem] text-[#94a3b8]">
                    {comp.est_revenue_and_size || '$5M–$10M'}
                  </span>
                </div>

                {/* Target persona */}
                <div className="bg-[#090e18] border border-[#263554] px-2.5 py-1.5 rounded-[6px] flex items-center justify-between">
                  <div className="font-bold text-white text-[0.82rem]">👤 {comp.target_person_name || 'Founder'}</div>
                  <div className="text-[0.75rem] text-[#94a3b8]">{comp.target_person_title || 'Executive'}</div>
                </div>

                {/* Growth trigger */}
                <div className="bg-[#0d1527] border-l-2 border-[#10b981] px-2 py-1.5 rounded-r-[6px] text-[0.78rem] text-[#cbd5e1]">
                  <div className="font-semibold text-white mb-0.5">⚡ Growth Trigger:</div>
                  <div>{comp.trigger_reason || 'Channel expansion'}</div>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06] flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-accent btn-small"
                    onClick={() => handleSelectForDraft(comp)}
                  >
                    ✍️ Draft Email ➔
                  </button>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => handleSelectForChat(comp)}
                  >
                    💬 Chat / Inbox
                  </button>
                  <Link
                    href={`/company/${encodeURIComponent(comp.id || comp.company_name)}`}
                    className="btn btn-outline btn-small"
                  >
                    🔍 Intel ➔
                  </Link>
                </div>
                <button
                  className="text-[#64748b] hover:text-[#ef4444] p-1.5 cursor-pointer text-sm"
                  onClick={() => {
                    if (confirm(`Remove "${comp.company_name}" from your Saved list?`)) {
                      removeCompany(comp.company_name);
                    }
                  }}
                  title="Delete from saved"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 px-5 text-center flex flex-col items-center justify-center gap-2 bg-[#151d30] border border-[#263554] rounded-xl">
          <div className="text-4xl mb-1">⭐</div>
          <h3 className="text-[1rem] text-white font-semibold">No Companies Saved in Pipeline</h3>
          <p className="text-[#94a3b8] text-[0.82rem] max-w-[440px]">
            Go to{' '}
            <Link href="/find-lead" className="text-[#38bdf8] underline">
              Step 1: Find Leads
            </Link>{' '}
            and click &ldquo;⭐ Save Company&rdquo; on qualified prospects to build your outreach list.
          </p>
        </div>
      )}

      {/* Add Company Manually Modal */}
      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
