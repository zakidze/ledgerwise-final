'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLeads, useSavedCompanies } from '@/lib/hooks';
import { NICHES } from '@/lib/constants';
import { Lead, IcpScore } from '@/lib/types';
import { normalizeLead, normalizeIcpScore, getStoredModel } from '@/lib/storage';
import { callAiCompletion, extractJsonArray } from '@/lib/ai';
import { showToast } from '@/lib/toast';
import JsonModal from '@/components/JsonModal';

export default function FindLeadPage() {
  const router = useRouter();
  const { leads, addLeads, removeLead, clearLeads } = useLeads();
  const { savedCompanies, addCompany, setActiveCompany } = useSavedCompanies();

  // Search criteria state
  const [selectedState, setSelectedState] = useState('ANY');
  const [selectedNiche, setSelectedNiche] = useState('ANY');
  const [selectedYear, setSelectedYear] = useState('ANY');
  const [selectedDomain, setSelectedDomain] = useState('ANY');
  const [selectedTrigger, setSelectedTrigger] = useState('ANY');
  const [batchSize, setBatchSize] = useState(10);

  // Table filtering state
  const [filterText, setFilterText] = useState('');
  const [resultFilterState, setResultFilterState] = useState('ALL');
  const [resultFilterScore, setResultFilterScore] = useState('ALL');

  // Loading & status
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'loading' | 'success' | 'error' } | null>(null);

  // Json modal state
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const handleSearchLeads = async () => {
    if (isSearching) return;

    const activeNiche = selectedNiche !== 'ANY' ? selectedNiche : NICHES[Math.floor(Math.random() * NICHES.length)];
    setIsSearching(true);
    setStatusMessage({
      text: `Researching ${batchSize} verified leads in "${activeNiche}" via AI...`,
      type: 'loading',
    });

    const existingNames = leads.map((l) => l.company_name.toLowerCase().trim()).filter(Boolean);

    const criteriaList: string[] = [];
    if (selectedState !== 'ANY') criteriaList.push(`- US State / Location: Headquartered or operating in ${selectedState}.`);
    else criteriaList.push(`- US State: Real US-headquartered e-commerce brand.`);

    if (selectedYear !== 'ANY') criteriaList.push(`- Founded Year: Matching time window ${selectedYear}.`);
    if (selectedDomain !== 'ANY') criteriaList.push(`- Domain Extension: Prefer ${selectedDomain}.`);
    if (selectedTrigger !== 'ANY') criteriaList.push(`- Trigger Focus: ${selectedTrigger}.`);

    const systemPrompt = `You are an expert B2B Outbound Research Agent for Ledgerwise, a specialized US bookkeeping firm for e-commerce brands ($1M-$10M ARR, 5-50 staff).
Find and qualify real companies matching ICP. Return STRICTLY a valid JSON array of objects.
Every object in the array MUST have the following keys:
- "company_name": string (real e-commerce brand name, e.g. "Chamberlain Coffee")
- "domain": string (e.g. "chamberlaincoffee.com")
- "website_url": string (full URL with https://)
- "us_state": string (e.g. "California (CA)" or US state code)
- "founded_year": number or string (e.g. 2019)
- "est_revenue_and_size": string (e.g. "$5M–$10M ARR / 25 employees")
- "target_person_name": string (founder, CEO, COO, or VP Finance)
- "target_person_title": string (e.g. "Co-Founder & CEO")
- "trigger_reason": string (specific expansion, retail launch, hiring, or funding trigger)
- "verified_source_link": string (credible public link/press release or domain news)
- "verified_quote": string (verifiable sentence or statement about the trigger)
- "icp_score": string (STRICTLY one of: "High", "Medium-High", or "Medium")
- "score_justification": string (why this brand fits Ledgerwise ICP and monthly bookkeeping need)

CRITICAL: Return ONLY raw JSON array (or in a \`\`\`json markdown code block), no introductory conversational text.`;

    const userPrompt = `Find exactly ${batchSize} NEW distinct e-commerce brands matching:
TARGET NICHE: ${activeNiche}
SEARCH CRITERIA:
${criteriaList.join('\n')}
${existingNames.length > 0 ? `EXCLUSIONS: ${JSON.stringify(existingNames.slice(-30))}` : ''}`;

    try {
      const model = getStoredModel();
      const rawContent = await callAiCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model,
        0.7
      );

      const parsedArray = extractJsonArray(rawContent);
      const normalizedList = parsedArray
        .map((item) => normalizeLead(item, selectedState))
        .filter((l): l is Lead => l !== null);

      const added = addLeads(normalizedList);

      if (added > 0) {
        setStatusMessage({ text: `Discovered ${added} qualified leads in "${activeNiche}".`, type: 'success' });
      } else if (normalizedList.length > 0) {
        setStatusMessage({ text: `Found ${normalizedList.length} leads in "${activeNiche}", but all were already in your list.`, type: 'success' });
      } else {
        setStatusMessage({ text: `Search finished, no new companies found. Try another niche or batch.`, type: 'success' });
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Search failed';
      setStatusMessage({ text: `Search failed: ${errMsg}`, type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveCompany = (item: Lead) => {
    const isSaved = savedCompanies.some(
      (c) => c.company_name.toLowerCase().trim() === item.company_name.toLowerCase().trim()
    );
    if (isSaved) {
      showToast(`"${item.company_name}" is already in your Saved Companies list.`, 'View Pipeline ➔', '/save-company');
      return;
    }

    const newCompany = {
      ...item,
      id: 'comp_' + Date.now(),
      status: 'SAVED' as const,
      saved_at: new Date().toISOString(),
      channels: ['DTC', 'Retail'],
    };

    addCompany(newCompany);
    showToast(`⭐ Saved "${newCompany.company_name}" to pipeline!`, 'Draft Email Now ➔', '/draft-email');
  };

  const handleDraftShortcut = (item: Lead) => {
    let company = savedCompanies.find(
      (c) => c.company_name.toLowerCase().trim() === item.company_name.toLowerCase().trim()
    );
    if (!company) {
      const newCompany = {
        ...item,
        id: 'comp_' + Date.now(),
        status: 'SAVED' as const,
        saved_at: new Date().toISOString(),
        channels: ['DTC', 'Retail'],
      };
      addCompany(newCompany);
      company = newCompany;
    }
    setActiveCompany(company);
    router.push('/draft-email');
  };

  const exportCsv = () => {
    if (leads.length === 0) return alert('No leads to export.');
    const headers = ['Company Name', 'Domain', 'Website', 'State', 'Founded', 'Revenue', 'Target Name', 'Target Title', 'Trigger', 'ICP Score'];
    const escapeCsv = (val: unknown) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = leads.map((l) => [
      escapeCsv(l.company_name),
      escapeCsv(l.domain),
      escapeCsv(l.website_url),
      escapeCsv(l.us_state),
      escapeCsv(l.founded_year),
      escapeCsv(l.est_revenue_and_size),
      escapeCsv(l.target_person_name),
      escapeCsv(l.target_person_title),
      escapeCsv(l.trigger_reason),
      escapeCsv(l.icp_score),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerwise_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Filter leads
  const filteredLeads = leads.filter((item) => {
    if (filterText) {
      const pool = [item.company_name, item.domain, item.website_url, item.us_state, item.target_person_name, item.trigger_reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!pool.includes(filterText.toLowerCase())) return false;
    }
    if (resultFilterState !== 'ALL') {
      const st = (item.us_state || '').toUpperCase();
      if (!st.includes(resultFilterState.toUpperCase())) return false;
    }
    if (resultFilterScore !== 'ALL') {
      const sc = normalizeIcpScore(item.icp_score).toLowerCase();
      if (resultFilterScore === 'High' && (!sc.includes('high') || sc.includes('medium-high'))) return false;
      if (resultFilterScore === 'Medium-High' && !sc.includes('medium-high')) return false;
      if (resultFilterScore === 'Medium' && (!sc.includes('medium') || sc.includes('high'))) return false;
    }
    return true;
  });

  const highFitCount = leads.filter((l) => {
    const sc = normalizeIcpScore(l.icp_score).toLowerCase();
    return sc.includes('high') && !sc.includes('medium-high');
  }).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 rounded-lg text-[0.85rem] font-medium flex items-center gap-2.5 ${
            statusMessage.type === 'loading'
              ? 'bg-[rgba(56,189,248,0.1)] border border-[#38bdf8] text-[#38bdf8]'
              : statusMessage.type === 'success'
              ? 'bg-[rgba(16,185,129,0.1)] border border-[#10b981] text-[#34d399]'
              : 'bg-[rgba(239,68,68,0.1)] border border-[#ef4444] text-[#f87171]'
          }`}
        >
          {statusMessage.type === 'loading' && <span className="spinner"></span>}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="bg-[#151d30] border border-[#263554] rounded-xl p-5 flex flex-col gap-4">
        {/* Panel Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-[1.15rem] text-white font-bold">Step 1: B2B Lead Finder & ICP Prospector</h2>
            <p className="text-[0.8rem] text-[#94a3b8] mt-0.5">
              Discover real, verified US e-commerce brands ($1M–$10M revenue, 5–50 staff) with active growth triggers.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-small" onClick={() => setIsJsonModalOpen(true)}>
              View JSON
            </button>
            <button className="btn btn-outline btn-small" onClick={exportCsv}>
              Export CSV
            </button>
            <button
              className="btn btn-outline btn-small"
              onClick={() => {
                if (leads.length === 0) return;
                if (confirm(`Delete all ${leads.length} found leads?`)) {
                  clearLeads();
                  showToast('Leads cleared.');
                }
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search Criteria Card */}
        <div className="bg-[#1c2742] border border-[#263554] rounded-[10px] p-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="criteria-group">
              <label>US State / Location</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="ANY">Any US State (All 50)</option>
                <option value="California (CA)">California (CA)</option>
                <option value="New York (NY)">New York (NY)</option>
                <option value="Texas (TX)">Texas (TX)</option>
                <option value="Florida (FL)">Florida (FL)</option>
                <option value="Illinois (IL)">Illinois (IL)</option>
                <option value="Ohio (OH)">Ohio (OH)</option>
                <option value="Pennsylvania (PA)">Pennsylvania (PA)</option>
                <option value="Georgia (GA)">Georgia (GA)</option>
                <option value="North Carolina (NC)">North Carolina (NC)</option>
                <option value="Washington (WA)">Washington (WA)</option>
                <option value="Colorado (CO)">Colorado (CO)</option>
                <option value="Massachusetts (MA)">Massachusetts (MA)</option>
              </select>
            </div>

            <div className="criteria-group">
              <label>Sub-Niche</label>
              <select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)}>
                <option value="ANY">Any Sub-Niche (Auto-Rotate)</option>
                {NICHES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="criteria-group">
              <label>Founded Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="ANY">Any Year</option>
                <option value="before_1990">Before 1990</option>
                <option value="1990-1995">1990 – 1995</option>
                <option value="1995-2000">1995 – 2000</option>
                <option value="2000-2005">2000 – 2005</option>
                <option value="2005-2010">2005 – 2010</option>
                <option value="2010-2015">2010 – 2015</option>
                <option value="2015-2020">2015 – 2020</option>
                <option value="2020-2026">2020 – 2026</option>
              </select>
            </div>

            <div className="criteria-group">
              <label>Domain Extension</label>
              <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}>
                <option value="ANY">Any Extension</option>
                <option value=".com">.com</option>
                <option value=".co">.co</option>
                <option value=".io">.io</option>
                <option value=".store">.store / .shop</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="criteria-group">
              <label>Growth Trigger Focus</label>
              <select value={selectedTrigger} onChange={(e) => setSelectedTrigger(e.target.value)}>
                <option value="ANY">Any Trigger (Channel, Hiring, Funding)</option>
                <option value="CHANNEL_EXPANSION">Channel Expansion (Target, Dick's, Walmart)</option>
                <option value="HIRING">Finance / Ops Hiring (Controller, Bookkeeper)</option>
                <option value="FUNDING">Venture or Growth Funding</option>
              </select>
            </div>

            <div className="criteria-group">
              <label>Batch Size</label>
              <select value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}>
                <option value={5}>5 Leads</option>
                <option value={10}>10 Leads</option>
                <option value={15}>15 Leads</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-1.5">
            <button
              className="btn btn-accent px-5 py-2.5 font-bold"
              onClick={handleSearchLeads}
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <span className="spinner"></span>
                  <span>Searching Leads...</span>
                </>
              ) : (
                <span>🚀 Search New Leads with AI</span>
              )}
            </button>
          </div>
        </div>

        {/* Filter & Stats Bar */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-3.5 text-[0.85rem]">
            <span>
              Total Leads: <strong className="text-white">{leads.length}</strong>
            </span>
            <span>
              High ICP Fit: <strong className="text-[#10b981]">{highFitCount}</strong>
            </span>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="text"
              placeholder="Filter leads..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-[#090e18] border border-[#263554] text-white px-2.5 py-1.5 rounded-[6px] text-[0.8rem] w-[170px] outline-none"
            />
            <select
              value={resultFilterState}
              onChange={(e) => setResultFilterState(e.target.value)}
              className="bg-[#090e18] border border-[#263554] text-[#94a3b8] px-2 py-1.5 rounded-[6px] text-[0.8rem] outline-none"
            >
              <option value="ALL">All States</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
              <option value="FL">Florida</option>
            </select>
            <select
              value={resultFilterScore}
              onChange={(e) => setResultFilterScore(e.target.value)}
              className="bg-[#090e18] border border-[#263554] text-[#94a3b8] px-2 py-1.5 rounded-[6px] text-[0.8rem] outline-none"
            >
              <option value="ALL">All Scores</option>
              <option value="High">High</option>
              <option value="Medium-High">Medium-High</option>
              <option value="Medium">Medium</option>
            </select>
            <button
              className="btn btn-outline btn-small"
              onClick={() => {
                setFilterText('');
                setResultFilterState('ALL');
                setResultFilterScore('ALL');
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto border border-[#263554] rounded-[10px] bg-[#0b0f19]">
          <table className="w-full border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="bg-[#1c2742] text-[#94a3b8] font-semibold uppercase text-[0.7rem] tracking-wider border-b border-[#263554]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Company & Domain</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Founded</th>
                <th className="py-2.5 px-3">Est. Revenue & Size</th>
                <th className="py-2.5 px-3">Target Persona</th>
                <th className="py-2.5 px-3">Trigger Reason & Evidence</th>
                <th className="py-2.5 px-3">ICP Score</th>
                <th className="py-2.5 px-3">Score Justification</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((item, index) => {
                const isSaved = savedCompanies.some(
                  (c) => c.company_name.toLowerCase().trim() === item.company_name.toLowerCase().trim()
                );
                const scoreVal = normalizeIcpScore(item.icp_score);
                let badgeCls = 'badge-medium';
                if (scoreVal === 'High') badgeCls = 'badge-high';
                else if (scoreVal === 'Medium-High') badgeCls = 'badge-medium-high';

                return (
                  <tr
                    key={item.company_name + index}
                    className="border-b border-[#1a253a] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-3 text-[#94a3b8] text-[0.8rem] font-semibold">{index + 1}</td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-white text-[0.95rem]">{item.company_name}</div>
                      {item.domain && (
                        <span className="inline-block bg-[#0e1726] text-[#38bdf8] text-[0.72rem] px-1.5 py-0.5 rounded border border-[#1e3a8a] mt-1">
                          {item.domain}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="bg-[#1e293b] text-[#94a3b8] px-1.5 py-0.5 rounded text-[0.75rem] font-medium">
                        📍 {item.us_state || 'US'}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="bg-[rgba(139,92,246,0.15)] text-[#c4b5fd] px-1.5 py-0.5 rounded text-[0.75rem] font-semibold">
                        🗓️ {item.founded_year}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top font-medium">{item.est_revenue_and_size}</td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-white">👤 {item.target_person_name}</div>
                      <div className="text-[0.75rem] text-[#94a3b8] mt-0.5">{item.target_person_title}</div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[300px]">
                      <div className="font-medium text-[#f1f5f9]">{item.trigger_reason}</div>
                      {item.verified_quote && (
                        <div className="bg-[#0d1527] border-l-2 border-[#10b981] p-1.5 mt-1 italic text-[#94a3b8] text-[0.75rem] rounded-r">
                          &ldquo;{item.verified_quote}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className={`badge ${badgeCls}`}>{scoreVal}</span>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[240px] text-[0.78rem] text-[#cbd5e1]">
                      {item.score_justification}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex flex-col gap-1.5 items-center">
                        <button
                          onClick={() => handleSaveCompany(item)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[0.75rem] font-semibold transition-all cursor-pointer ${
                            isSaved
                              ? 'bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.4)] text-[#10b981]'
                              : 'bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.35)] text-[#fbbf24] hover:bg-[rgba(245,158,11,0.25)] hover:text-white'
                          }`}
                        >
                          {isSaved ? '⭐ Saved ✓' : '⭐ Save Company'}
                        </button>
                        <button
                          onClick={() => handleDraftShortcut(item)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[0.72rem] font-semibold bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] text-[#34d399] hover:bg-[#10b981] hover:text-[#0b0f19] transition-all cursor-pointer"
                        >
                          ✍️ Draft Email ➔
                        </button>
                        <button
                          onClick={() => removeLead(item.company_name)}
                          className="text-[#64748b] hover:text-[#ef4444] p-1 cursor-pointer"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLeads.length === 0 && (
            <div className="py-12 px-5 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-4xl mb-1">🔍</div>
              <h3 className="text-[1rem] text-white font-semibold">No Leads Found</h3>
              <p className="text-[#94a3b8] text-[0.82rem] max-w-[440px]">
                Click &ldquo;Search New Leads with AI&rdquo; above to extract verified companies matching Ledgerwise&apos;s ideal customer profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Raw JSON Modal */}
      <JsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        data={leads}
        title="Raw Discovered Leads JSON"
      />
    </div>
  );
}
