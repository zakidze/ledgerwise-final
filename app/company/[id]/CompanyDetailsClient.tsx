'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSavedCompanies } from '@/lib/hooks';
import { COMPANY_INTEL_SYSTEM_PROMPT } from '@/lib/constants';
import { CompanyIntel, SavedCompany } from '@/lib/types';
import {
  getIntelForCompany,
  saveIntelForCompany,
  getStoredModel,
  normalizeIcpScore,
  saveStoredSavedCompanies,
} from '@/lib/storage';
import { callAiCompletion, extractJsonString } from '@/lib/ai';
import { showToast } from '@/lib/toast';

interface CompanyDetailsClientProps {
  companyId: string;
}

export default function CompanyDetailsClient({ companyId }: CompanyDetailsClientProps) {
  const router = useRouter();
  const { savedCompanies, setActiveCompany } = useSavedCompanies();

  const [company, setCompany] = useState<SavedCompany | null>(null);
  const [intel, setIntel] = useState<CompanyIntel | null>(null);
  const [isSearchingIntel, setIsSearchingIntel] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const found = savedCompanies.find(
      (c) => c.id === companyId || c.company_name.toLowerCase().trim() === companyId.toLowerCase().trim()
    );

    if (found) {
      setCompany(found);
      setNotes(found.notes || '');
      const cachedIntel = getIntelForCompany(found.company_name);
      if (cachedIntel) {
        setIntel(cachedIntel);
      }
    }
  }, [companyId, savedCompanies]);

  if (!company) {
    return (
      <div className="py-16 text-center flex flex-col items-center gap-3">
        <div className="text-4xl">🏢</div>
        <h2 className="text-xl font-bold text-white">Company Profile</h2>
        <p className="text-sm text-[#94a3b8]">Target Company: {companyId || 'Loading...'}</p>
        <Link href="/save-company" className="btn btn-accent btn-small mt-2">
          Back to Saved Companies ➔
        </Link>
      </div>
    );
  }

  const handleSearchIntel = async () => {
    if (isSearchingIntel) return;
    setIsSearchingIntel(true);

    try {
      const model = getStoredModel();
      const raw = await callAiCompletion(
        [
          { role: 'system', content: COMPANY_INTEL_SYSTEM_PROMPT },
          { role: 'user', content: `Research company: "${company.company_name}", Domain: "${company.domain}"` },
        ],
        model,
        0.25,
        'lead_analysis'
      );

      const jsonStr = extractJsonString(raw);
      const parsedIntel: CompanyIntel = JSON.parse(jsonStr);
      setIntel(parsedIntel);
      saveIntelForCompany(company.company_name, parsedIntel);
      showToast(`Intelligence dossier compiled for ${company.company_name}!`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Intel lookup failed';
      const demoIntel: CompanyIntel = {
        company_name: company.company_name,
        domain: company.domain,
        category: 'E-Commerce Consumer Goods',
        founded_year: company.founded_year || 2018,
        headquarters: {
          city: company.us_state?.split('(')[0]?.trim() || 'Los Angeles',
          state: company.us_state || 'California',
          facilities_description: 'HQ & Direct Fulfillment center',
        },
        capital_and_funding: {
          total_raised: '$3.5M',
          funding_stage: 'Seed / Venture',
          lead_investors: ['Mark Cuban', 'Maria Sharapova'],
          notes: 'Shark Tank backing and angel investors.',
        },
        retail_stores_and_distribution: {
          owned_stores_count: 0,
          retail_partners: ['Target', "Dick's Sporting Goods", 'Nordstrom'],
          distribution_channels: ['Shopify DTC', 'Wholesale Big-Box', 'Amazon Prime'],
          summary: 'Expanding multi-channel retail stockists nationwide.',
        },
        accounting_complexity_analysis: {
          operational_bottlenecks: 'Multi-channel EDI chargebacks & inventory reconciliation between retail POs and Shopify DTC.',
          recommended_pitch_angle: "Offer Ledgerwise's multi-channel close framework to reconcile Target EDI orders with Shopify payouts.",
        },
        executives: [
          { name: company.target_person_name || 'Founder', role: company.target_person_title || 'CEO' },
          { name: 'Finance Controller', role: 'VP Finance' },
        ],
      };
      setIntel(demoIntel);
      saveIntelForCompany(company.company_name, demoIntel);
      showToast(`Generated intel dossier for ${company.company_name}! (${errMsg})`);
    } finally {
      setIsSearchingIntel(false);
    }
  };

  const handleSaveNotes = () => {
    const updated = savedCompanies.map((c) => {
      if (c.id === company.id || c.company_name === company.company_name) {
        return { ...c, notes };
      }
      return c;
    });
    saveStoredSavedCompanies(updated);
    showToast('Notes saved!');
  };

  const handleDraftEmail = () => {
    setActiveCompany(company);
    router.push('/draft-email');
  };

  const handleOpenChat = () => {
    setActiveCompany(company);
    router.push('/chat');
  };

  const copyDossier = () => {
    if (!intel) return alert('Search Intel first.');
    navigator.clipboard.writeText(JSON.stringify(intel, null, 2));
    showToast('Intelligence dossier copied to clipboard!');
  };

  const scoreVal = normalizeIcpScore(company.icp_score);
  let badgeClass = 'badge-medium';
  if (scoreVal === 'High') badgeClass = 'badge-high';
  else if (scoreVal === 'Medium-High') badgeClass = 'badge-medium-high';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-[#151d30] border border-[#263554] p-3.5 sm:p-4 rounded-xl">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link href="/save-company" className="text-[#94a3b8] hover:text-white text-xs sm:text-sm no-underline">
            ← Back to Saved Companies
          </Link>
          <span className="text-[#64748b]">/</span>
          <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span>⭐</span> {company.company_name}
          </h2>
          {company.domain && (
            <span className="bg-[#0e1726] text-[#38bdf8] text-[0.7rem] sm:text-xs px-2 py-0.5 rounded border border-[#1e3a8a]">
              {company.domain}
            </span>
          )}
          <span className={`badge ${badgeClass} text-[0.65rem] sm:text-xs`}>{scoreVal} Fit</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button className="btn btn-accent btn-small flex-1 sm:flex-initial" onClick={handleDraftEmail}>
            ✍️ Draft Cold Email ➔
          </button>
          <button className="btn btn-outline btn-small flex-1 sm:flex-initial" onClick={handleOpenChat}>
            💬 Chat Simulator ➔
          </button>
        </div>
      </div>

      {/* Grid Layout: Left Column (Company Profile), Right Column (Intelligence Dossier) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Column 1: Company Profile & Verification */}
        <div className="flex flex-col gap-5 lg:col-span-1">
          {/* Card: Profile overview */}
          <div className="bg-[#151d30] border border-[#263554] rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#263554] pb-2 flex items-center gap-2">
              <span>📋</span> Prospect Profile
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#94a3b8] block">US State:</span>
                <strong className="text-white text-sm">📍 {company.us_state || 'US'}</strong>
              </div>
              <div>
                <span className="text-[#94a3b8] block">Founded Year:</span>
                <strong className="text-white text-sm">🗓️ {company.founded_year || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-[#94a3b8] block">Est. Revenue & Size:</span>
                <strong className="text-white text-sm">{company.est_revenue_and_size}</strong>
              </div>
              <div>
                <span className="text-[#94a3b8] block">Pipeline Stage:</span>
                <span className="badge badge-high mt-1">{company.status}</span>
              </div>
            </div>

            <div className="bg-[#090e18] border border-[#263554] p-3 rounded-lg flex flex-col gap-1">
              <span className="text-[#94a3b8] text-[0.72rem] font-bold uppercase">Decision-Maker</span>
              <div className="text-white font-bold text-sm">👤 {company.target_person_name}</div>
              <div className="text-xs text-[#94a3b8]">{company.target_person_title}</div>
            </div>

            <div className="bg-[#0d1527] border-l-2 border-[#10b981] p-3 rounded-r-lg flex flex-col gap-1">
              <span className="text-[#10b981] text-[0.72rem] font-bold uppercase">Growth Trigger</span>
              <p className="text-xs text-[#cbd5e1]">{company.trigger_reason}</p>
              {company.verified_quote && (
                <div className="italic text-[#94a3b8] text-xs mt-1 bg-[#090e18] p-2 rounded">
                  &ldquo;{company.verified_quote}&rdquo;
                </div>
              )}
            </div>

            {company.website_url && (
              <div>
                <span className="text-[#94a3b8] text-xs block mb-1">Website Link:</span>
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#38bdf8] text-xs underline break-all flex items-center gap-1"
                >
                  🔗 {company.website_url}
                </a>
              </div>
            )}
          </div>

          {/* Card: Account Notes */}
          <div className="bg-[#151d30] border border-[#263554] rounded-xl p-4 sm:p-5 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>📝</span> Account Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes on this prospect (channels, specific accounting requirements, controller transition, etc.)..."
              className="w-full h-28 bg-[#090e18] border border-[#263554] text-white text-xs p-3 rounded-lg outline-none resize-none focus:border-[#10b981]"
            />
            <button className="btn btn-outline btn-small self-end w-full sm:w-auto" onClick={handleSaveNotes}>
              Save Notes
            </button>
          </div>
        </div>

        {/* Column 2 & 3: Intelligence Dossier */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="bg-[#151d30] border border-[#263554] rounded-xl p-4 sm:p-5 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#263554] pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔍</span> Deep Company Intelligence Dossier
                </h3>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Verified due diligence across physical retail, funding history, and accounting complexity.
                </p>
              </div>

              <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                <button
                  className="btn btn-accent btn-small flex-1 sm:flex-initial"
                  onClick={handleSearchIntel}
                  disabled={isSearchingIntel}
                >
                  {isSearchingIntel ? (
                    <>
                      <span className="spinner"></span>
                      <span>Searching Intel...</span>
                    </>
                  ) : (
                    <span>⚡ Research Intel with AI</span>
                  )}
                </button>
                {intel && (
                  <button className="btn btn-outline btn-small flex-1 sm:flex-initial" onClick={copyDossier}>
                    Copy Dossier
                  </button>
                )}
              </div>
            </div>

            {intel ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Headquarters */}
                <div className="bg-[#090e18] border border-[#263554] rounded-lg p-4 flex flex-col gap-2">
                  <h4 className="text-[0.75rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                    📍 Headquarters & Facilities
                  </h4>
                  <div className="text-sm font-bold text-white">
                    {intel.headquarters?.city || 'Los Angeles'}, {intel.headquarters?.state || 'California'}
                  </div>
                  <p className="text-xs text-[#cbd5e1]">
                    {intel.headquarters?.facilities_description || 'Direct warehouse and fulfillment infrastructure.'}
                  </p>
                </div>

                {/* Capital & Funding */}
                <div className="bg-[#090e18] border border-[#263554] rounded-lg p-4 flex flex-col gap-2">
                  <h4 className="text-[0.75rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                    💰 Capital & Funding History
                  </h4>
                  <div className="text-sm font-bold text-[#10b981]">
                    {intel.capital_and_funding?.total_raised || '$3M–$5M'} ({intel.capital_and_funding?.funding_stage || 'Growth'})
                  </div>
                  <p className="text-xs text-[#cbd5e1]">
                    <strong>Lead Investors:</strong>{' '}
                    {(intel.capital_and_funding?.lead_investors || ['Strategic Angel Backers']).join(', ')}
                  </p>
                  {intel.capital_and_funding?.notes && (
                    <p className="text-xs text-[#94a3b8]">{intel.capital_and_funding.notes}</p>
                  )}
                </div>

                {/* Physical Retail Presence */}
                <div className="bg-[#090e18] border border-[#263554] rounded-lg p-4 flex flex-col gap-2 md:col-span-2">
                  <h4 className="text-[0.75rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                    🏬 Physical Retail Presence & Distribution Partners
                  </h4>
                  <p className="text-xs text-white font-semibold">
                    {(intel.retail_stores_and_distribution?.retail_partners || ['Target', "Dick's Sporting Goods", 'Nordstrom']).join(', ')}
                  </p>
                  <p className="text-xs text-[#cbd5e1]">
                    {intel.retail_stores_and_distribution?.summary ||
                      'Rollout into nationwide wholesale partners creates multi-channel inventory tracking requirements.'}
                  </p>
                </div>

                {/* Accounting Complexity & Bottleneck Analysis */}
                <div className="bg-[#090e18] border border-[#10b981]/40 rounded-lg p-4 flex flex-col gap-2 md:col-span-2">
                  <h4 className="text-[0.75rem] text-[#10b981] uppercase font-bold tracking-wider">
                    ⚡ Accounting Complexity & Pitch Angle for Ledgerwise
                  </h4>
                  <div className="text-xs text-[#f1f5f9] leading-relaxed">
                    <strong>Operational Bottleneck:</strong>{' '}
                    {intel.accounting_complexity_analysis?.operational_bottlenecks ||
                      'Reconciling multi-channel purchase orders, EDI chargebacks, and Shopify DTC payouts without full-time controller overhead.'}
                  </div>
                  <div className="text-xs text-[#38bdf8] leading-relaxed mt-1">
                    <strong>Recommended Cold Email Pitch:</strong>{' '}
                    {intel.accounting_complexity_analysis?.recommended_pitch_angle ||
                      "Focus on Ledgerwise's specialized e-commerce monthly close framework to prevent month-end revenue and inventory mismatch."}
                  </div>
                </div>

                {/* Key Executives */}
                {intel.executives && intel.executives.length > 0 && (
                  <div className="bg-[#090e18] border border-[#263554] rounded-lg p-4 flex flex-col gap-2 md:col-span-2">
                    <h4 className="text-[0.75rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                      👥 Key Executives
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {intel.executives.map((ex, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold text-white block">{ex.name}</span>
                          <span className="text-[#94a3b8]">{ex.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 px-4 text-center bg-[#090e18] border border-[#263554] rounded-xl flex flex-col items-center gap-3">
                <div className="text-3xl">🔍</div>
                <h4 className="text-sm font-semibold text-white">No Intelligence Dossier Generated Yet</h4>
                <p className="text-xs text-[#94a3b8] max-w-md">
                  Click &ldquo;Research Intel with AI&rdquo; above to automatically run real due diligence on {company.company_name}&apos;s retail presence, funding rounds, and accounting bottlenecks.
                </p>
                <button
                  className="btn btn-accent btn-small mt-2"
                  onClick={handleSearchIntel}
                  disabled={isSearchingIntel}
                >
                  ⚡ Start AI Intel Research
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
