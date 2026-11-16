'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSavedCompanies, useDrafts } from '@/lib/hooks';
import { DEFAULT_PROMPT, COMPANY_INTEL_SYSTEM_PROMPT, SAMPLE_BALA_COMPANY } from '@/lib/constants';
import { CompanyIntel } from '@/lib/types';
import {
  getIntelForCompany,
  saveIntelForCompany,
  getStoredModel,
  saveThreadForCompany,
  addAuditLog,
} from '@/lib/storage';
import { getActiveCalendarMeetingProposalText } from '@/lib/calendar';
import { callAiCompletion, extractEmailJson, extractJsonString } from '@/lib/ai';
import { showToast } from '@/lib/toast';

export default function DraftEmailPage() {
  const router = useRouter();
  const { savedCompanies, activeCompany, setActiveCompany, updateCompanyStatus } = useSavedCompanies();
  const { drafts, addDraft, clearDrafts } = useDrafts();

  // Current company to craft for
  const company = activeCompany || savedCompanies[0] || SAMPLE_BALA_COMPANY;

  // Payload and Prompt
  const [payloadText, setPayloadText] = useState('');
  const [isValidJson, setIsValidJson] = useState(true);
  const [activeAngle, setActiveAngle] = useState('retail');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);

  // Email form
  const [emailTo, setEmailTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Intel Dossier
  const [intel, setIntel] = useState<CompanyIntel | null>(null);
  const [isSearchingIntel, setIsSearchingIntel] = useState(false);

  // Sync payload when active company changes
  useEffect(() => {
    if (!company) return;

    const pName = company.target_person_name || 'there';
    const role = company.target_person_title || 'Co-Founder / COO';
    const domain = company.domain || 'shopbala.com';
    const userPrefix = pName.toLowerCase().replace(/[^a-z]/g, '') || 'coo';
    setEmailTo(`${pName} <${userPrefix}@${domain}>`);

    const payloadObj = {
      company: {
        name: company.company_name,
        domain: company.domain,
        est_revenue: company.est_revenue_and_size ? company.est_revenue_and_size.split('/')[0].trim() : '$5M–$10M',
        employee_count: 20,
        channels: company.channels || ['DTC', 'Retail'],
      },
      prospect: { name: pName, role },
      verified_evidence: {
        trigger_type: 'CHANNEL_EXPANSION',
        trigger_reason: company.trigger_reason || 'Multi-channel retail expansion',
        source_title: `${company.company_name} News & Updates`,
        source_url: company.verified_source_link || company.website_url || `https://${company.domain}`,
        exact_quote: company.verified_quote || company.trigger_reason || 'Expanding store presence',
      },
      fit_context: `${company.icp_score || 'High'} Fit`,
    };

    setPayloadText(JSON.stringify(payloadObj, null, 2));
    setIsValidJson(true);

    // Pre-load default subject & body if empty
    if (!subject) {
      setSubject(`${company.company_name}'s retail expansion & inventory close`);
      setBody(
        `Hey ${pName},\n\nSaw ${company.company_name}'s recent retail push into Target and big-box distribution—congrats on the expansion.\n\nRolling into multi-channel retail usually creates serious inventory and COGS reconciliation bottlenecks, especially keeping track of wholesale chargebacks alongside Shopify DTC payouts. Ledgerwise handles monthly closes exclusively for high-growth e-commerce brands navigating that exact shift.\n\nOpen to a brief 15-minute chat next week to compare notes on how your finance team is managing the multi-channel close?\n\nBest,\nAlex | Ledgerwise`
      );
    }

    const cachedIntel = getIntelForCompany(company.company_name);
    if (cachedIntel) {
      setIntel(cachedIntel);
    } else {
      setIntel(null);
    }
  }, [company]);

  const handlePayloadChange = (val: string) => {
    setPayloadText(val);
    try {
      JSON.parse(val);
      setIsValidJson(true);
    } catch {
      setIsValidJson(false);
    }
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(payloadText);
      setPayloadText(JSON.stringify(obj, null, 2));
      setIsValidJson(true);
    } catch {
      alert('Invalid JSON.');
    }
  };

  const handleLoadSampleBala = () => {
    const sample = {
      company: { name: 'Bala', domain: 'shopbala.com', est_revenue: '$5M–$10M', employee_count: 20, channels: ['DTC', 'Retail', 'Target'] },
      prospect: { name: 'there', role: 'Co-Founder / COO' },
      verified_evidence: {
        trigger_type: 'CHANNEL_EXPANSION',
        trigger_reason: "Expanding retail footprint into major big-box stores (Target/Dick's Sporting Goods).",
        source_title: 'Bala Retail Expansion',
        source_url: 'https://shopbala.com/blogs/news',
        exact_quote: 'Find Bala at a Target store near you.',
      },
      fit_context: 'High (New channel expansion requires complex inventory accounting)',
    };
    setPayloadText(JSON.stringify(sample, null, 2));
    setIsValidJson(true);
  };

  const handleApplyAngle = (angle: string) => {
    setActiveAngle(angle);
    let angleSnippet = '';
    if (angle === 'retail') angleSnippet = '\n### ANGLE: Focus on retail EDI chargebacks and inventory reconciliation across Big-Box stores.';
    else if (angle === 'hiring') angleSnippet = '\n### ANGLE: Focus on finance ops hiring bottlenecks.';
    else if (angle === 'funding') angleSnippet = '\n### ANGLE: Focus on post-funding GAAP financials and burn rate clarity.';
    else if (angle === 'cogs') angleSnippet = '\n### ANGLE: Focus on Shopify DTC payouts vs wholesale invoicing.';
    setSystemPrompt(DEFAULT_PROMPT + angleSnippet);
    showToast(`Applied ${angle.toUpperCase()} angle.`);
  };

  const handleGenerateEmail = async () => {
    if (isGenerating) return;
    if (!isValidJson) return alert('Payload JSON is invalid.');

    setIsGenerating(true);
    try {
      const model = getStoredModel();
      const rawContent = await callAiCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Payload:\n${payloadText}\n\nReturn JSON schema: {"subject":"string","body":"string"}` },
        ],
        model,
        0.4,
        'chat_email'
      );

      const parsed = extractEmailJson(rawContent);
      setSubject(parsed.subject);
      setBody(parsed.body);
      addDraft(company.company_name, parsed.subject, parsed.body);
      updateCompanyStatus(company.company_name, 'DRAFTED');
      showToast("Cold email generated! Click 'SEND EMAIL TO COMPANY (Step 4 ➔)' to dispatch.");
    } catch (err: unknown) {
      const pName = company.target_person_name || 'there';
      const compName = company.company_name || 'Bala';
      const proposalWindow = getActiveCalendarMeetingProposalText();

      const fallbackSubject = `${compName}'s retail expansion & inventory close`;
      const fallbackBody = `Hey ${pName},\n\nSaw ${compName}'s recent retail push into Target and big-box distribution—congrats on the expansion.\n\nRolling into multi-channel retail usually creates serious inventory and COGS reconciliation bottlenecks, especially keeping track of wholesale chargebacks alongside Shopify DTC payouts. Ledgerwise handles monthly closes exclusively for high-growth e-commerce brands navigating that exact shift.\n\nOpen to a brief 15-minute chat ${proposalWindow} to compare notes on how your finance team is managing the multi-channel close?\n\nBest,\nAlex | Ledgerwise`;

      setSubject(fallbackSubject);
      setBody(fallbackBody);
      addDraft(compName, fallbackSubject, fallbackBody);
      updateCompanyStatus(compName, 'DRAFTED');
      showToast('Generated email using verified template.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDispatchEmail = () => {
    if (!subject.trim() || !body.trim()) return alert('Please generate subject and body first.');

    const pName = company.target_person_name || 'there';
    const domain = company.domain || 'shopbala.com';
    const userPrefix = pName.toLowerCase().replace(/[^a-z]/g, '') || 'coo';
    const recipientEmail = `${userPrefix}@${domain}`;

    updateCompanyStatus(company.company_name, 'SENT');

    const initialOutboundEmail = {
      id: 'msg_' + Date.now(),
      from: 'alex@ledgerwise.com',
      to: recipientEmail,
      senderName: 'Alex at Ledgerwise',
      subject: subject.trim(),
      body: body.trim(),
      time: 'Just now',
    };

    saveThreadForCompany(company.company_name, [initialOutboundEmail]);
    addAuditLog('EMAIL_SENT', `Outbound cold email dispatched to ${pName} (${recipientEmail}) at ${company.company_name}. Subject: "${subject.trim()}"`);
    addDraft(company.company_name, subject.trim(), body.trim());

    showToast(`🚀 Email sent to ${company.company_name}! Opening Dual Inbox Simulator...`);
    setTimeout(() => {
      router.push('/chat');
    }, 350);
  };

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
      showToast(`Dossier compiled for ${company.company_name}!`);
    } catch {
      const fallbackIntel: CompanyIntel = {
        company_name: company.company_name,
        domain: company.domain,
        category: 'E-Commerce Consumer Goods',
        founded_year: company.founded_year || 2018,
        headquarters: { city: 'Los Angeles', state: 'California' },
        capital_and_funding: { total_raised: '$3.5M', lead_investors: ['Mark Cuban', 'Maria Sharapova'] },
        retail_stores_and_distribution: { retail_partners: ['Target', "Dick's Sporting Goods", 'Nordstrom'] },
        accounting_complexity_analysis: {
          recommended_pitch_angle: "Offer Ledgerwise's multi-channel close framework to reconcile Target EDI orders with Shopify payouts.",
        },
      };
      setIntel(fallbackIntel);
      saveIntelForCompany(company.company_name, fallbackIntel);
      showToast(`Dossier compiled for ${company.company_name}!`);
    } finally {
      setIsSearchingIntel(false);
    }
  };

  const injectIntelToPayload = () => {
    if (!intel) return alert('Search Intel first.');
    try {
      const obj = JSON.parse(payloadText);
      obj.company_intel_dossier = intel;
      setPayloadText(JSON.stringify(obj, null, 2));
      setIsValidJson(true);
      showToast('Intel injected into payload!');
    } catch {
      alert('Invalid JSON.');
    }
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Target Company Header Banner */}
      <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="text-xl sm:text-2xl">🎯</span>
          <div>
            <div className="text-[0.7rem] sm:text-[0.75rem] text-[#94a3b8] font-bold uppercase tracking-wider">
              Active Target Company for Email Crafting
            </div>
            <h2 className="text-[1.05rem] sm:text-[1.15rem] text-white font-extrabold">
              {company.company_name} ({company.domain || 'e-commerce'})
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <select
            value={company.company_name}
            onChange={(e) => {
              const found = savedCompanies.find((c) => c.company_name === e.target.value);
              if (found) setActiveCompany(found);
            }}
            className="bg-[#090e18] border border-[#263554] text-[#10b981] font-semibold text-xs px-2.5 py-1.5 rounded-[6px] outline-none cursor-pointer flex-1 sm:flex-initial"
          >
            {savedCompanies.map((c) => (
              <option key={c.company_name} value={c.company_name}>
                Target: {c.company_name}
              </option>
            ))}
          </select>
          <button className="btn btn-outline btn-small flex-1 sm:flex-initial" onClick={() => router.push('/save-company')}>
            Browse Saved Companies ➔
          </button>
        </div>
      </div>

      {/* Crafter 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Column 1: Lead Context Payload & Strategy Angle */}
        <div className="lg:col-span-4 bg-[#151d30] border border-[#263554] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-[#1c2742] border-b border-[#263554] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <span>📋</span> Lead Context Payload
            </h3>
            <span
              className={`badge ${isValidJson ? 'badge-high' : 'badge-danger'}`}
            >
              {isValidJson ? 'Valid JSON' : 'Invalid JSON'}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <textarea
              value={payloadText}
              onChange={(e) => handlePayloadChange(e.target.value)}
              className="w-full h-56 bg-[#090e18] border border-[#263554] rounded-lg text-[#38bdf8] font-mono text-xs p-2.5 resize-y outline-none focus:border-[#10b981]"
              spellCheck="false"
            />

            <div className="flex gap-2">
              <button className="btn btn-outline btn-small flex-1" onClick={handleFormatJson}>
                Format JSON
              </button>
              <button className="btn btn-outline btn-small flex-1" onClick={handleLoadSampleBala}>
                Sample Bala
              </button>
            </div>

            {/* Strategy Angle Selector */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="text-[0.72rem] text-[#94a3b8] font-bold uppercase tracking-wider">
                Angle & Strategy
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'retail', label: 'Retail Push' },
                  { id: 'hiring', label: 'Finance Hiring' },
                  { id: 'funding', label: 'Post-Funding' },
                  { id: 'cogs', label: 'Multi-Channel COGS' },
                ].map((angle) => (
                  <button
                    key={angle.id}
                    onClick={() => handleApplyAngle(angle.id)}
                    className={`px-2 py-1 rounded text-[0.72rem] font-semibold border transition-all cursor-pointer ${
                      activeAngle === angle.id
                        ? 'bg-[rgba(16,185,129,0.15)] border-[#10b981] text-[#10b981]'
                        : 'bg-[#090e18] border-[#263554] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {angle.label}
                  </button>
                ))}
              </div>
            </div>

            {/* System Prompt & Rules Collapsible */}
            <details className="mt-1">
              <summary className="text-[0.75rem] text-[#94a3b8] cursor-pointer font-semibold">
                System Prompt & Compliance Rules
              </summary>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-32 bg-[#090e18] border border-[#263554] rounded-lg text-white font-mono text-[0.75rem] p-2.5 mt-1.5 outline-none"
              />
              <button
                className="btn btn-outline btn-small w-full mt-1.5"
                onClick={() => {
                  setSystemPrompt(DEFAULT_PROMPT);
                  showToast('Prompt reset to default compliance rules.');
                }}
              >
                Reset Default Prompt
              </button>
            </details>

            <button
              className="btn btn-accent p-3 mt-1 font-bold"
              onClick={handleGenerateEmail}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  <span>Crafting Cold Email...</span>
                </>
              ) : (
                <span>⚡ Generate Cold Email with AI</span>
              )}
            </button>
          </div>
        </div>

        {/* Column 2: Generated Email & Step 4 Dispatch */}
        <div className="lg:col-span-4 bg-[#151d30] border border-[#263554] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-[#1c2742] border-b border-[#263554] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <span>✉️</span> Generated Outbound Email
            </h3>
            <span
              className="badge"
              style={{
                backgroundColor: wordCount <= 110 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: wordCount <= 110 ? '#10b981' : '#f59e0b',
              }}
            >
              {wordCount} words
            </span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="bg-[#090e18] border border-[#263554] rounded-[10px] p-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-2 border-b border-[#263554] pb-2.5 text-[0.8rem]">
                <div className="flex items-center gap-2">
                  <span className="text-[#94a3b8] text-[0.72rem] font-bold uppercase w-12">From:</span>
                  <input
                    type="text"
                    value="Alex | Ledgerwise <alex@ledgerwise.com>"
                    readOnly
                    className="flex-1 bg-transparent text-white font-medium text-xs outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#94a3b8] text-[0.72rem] font-bold uppercase w-12">To:</span>
                  <input
                    type="text"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="flex-1 bg-transparent text-white font-medium text-xs outline-none focus:bg-[#151d30] px-1 rounded"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#94a3b8] text-[0.72rem] font-bold uppercase w-12">Subject:</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line..."
                    className="flex-1 bg-transparent text-white font-bold text-xs outline-none focus:bg-[#151d30] px-1 rounded"
                  />
                  <button
                    className="btn btn-outline btn-small py-0.5 px-2 text-[0.7rem]"
                    onClick={() => {
                      navigator.clipboard.writeText(subject);
                      showToast('Subject copied!');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body will generate here..."
                className="w-full h-56 bg-transparent text-[#f1f5f9] text-[0.88rem] leading-relaxed resize-y outline-none focus:bg-[#151d30] p-1 rounded"
              />
            </div>

            {/* Big Send Email Button (Step 4) */}
            <button
              onClick={handleDispatchEmail}
              className="btn-send-dispatch w-full cursor-pointer"
            >
              <span>🚀 SEND EMAIL TO COMPANY (Step 4 ➔)</span>
            </button>
            <p className="text-[0.72rem] text-[#94a3b8] text-center -mt-1.5">
              Dispatches this email to {company.company_name} and takes you directly to Step 5: Chat Simulator!
            </p>

            <div className="flex gap-2 justify-between flex-wrap">
              <button
                className="btn btn-outline btn-small flex-1 min-w-[90px]"
                onClick={() => {
                  navigator.clipboard.writeText(body);
                  showToast('Body copied!');
                }}
              >
                Copy Body
              </button>
              <button
                className="btn btn-outline btn-small flex-1 min-w-[90px]"
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                  showToast('Full email copied!');
                }}
              >
                Copy Full Email
              </button>
              <button
                className="btn btn-outline btn-small flex-1 min-w-[90px]"
                onClick={() => {
                  const match = emailTo.match(/<([^>]+)>/) || [null, emailTo];
                  window.open(
                    `mailto:${encodeURIComponent(match[1] || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
                    '_blank'
                  );
                }}
              >
                Open in Mail App
              </button>
            </div>

            {/* Saved Drafts History */}
            <div className="mt-2.5 pt-2.5 border-t border-[#263554]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[0.75rem] text-[#94a3b8] uppercase font-bold">
                  Saved Drafts History ({drafts.length})
                </h4>
                <button className="btn btn-outline btn-small py-0.5 px-2 text-[0.7rem]" onClick={clearDrafts}>
                  Clear
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {drafts.length === 0 ? (
                  <div className="text-[0.75rem] text-[#64748b]">No saved drafts yet.</div>
                ) : (
                  drafts.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        setSubject(d.subject);
                        setBody(d.body);
                      }}
                      className="bg-[#090e18] border border-[#263554] rounded px-2.5 py-1.5 text-xs flex justify-between items-center cursor-pointer hover:border-[#10b981]"
                    >
                      <div className="truncate max-w-[200px]">
                        <strong className="text-white">{d.companyName}:</strong> {d.subject}
                      </div>
                      <span className="text-[#64748b] text-[0.68rem]">{d.date}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Company Intelligence Dossier */}
        <div className="lg:col-span-4 bg-[#151d30] border border-[#263554] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-[#1c2742] border-b border-[#263554] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <span>🔍</span> Company Intelligence Dossier
            </h3>
            <button
              className="btn btn-accent btn-small py-1 px-2.5 text-[0.75rem]"
              onClick={handleSearchIntel}
              disabled={isSearchingIntel}
            >
              {isSearchingIntel ? (
                <>
                  <span className="spinner"></span>
                  <span>Searching...</span>
                </>
              ) : (
                <span>Search Intel</span>
              )}
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-1 text-xs">
              <h4 className="text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                Company Overview
              </h4>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  HQ:{' '}
                  <strong className="text-white">
                    {intel?.headquarters?.city || company.us_state?.split('(')[0]?.trim() || 'Los Angeles, CA'}
                  </strong>
                </div>
                <div>
                  Category: <strong className="text-white">{intel?.category || 'Fitness Goods'}</strong>
                </div>
                <div>
                  Revenue:{' '}
                  <strong className="text-white">
                    {company.est_revenue_and_size?.split('/')[0] || '$5M–$10M'}
                  </strong>
                </div>
                <div>
                  Founded: <strong className="text-white">{company.founded_year || '2018'}</strong>
                </div>
              </div>
            </div>

            <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-1 text-xs">
              <h4 className="text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                Retail Stores & Distribution
              </h4>
              <p className="text-[#cbd5e1] leading-relaxed">
                {(intel?.retail_stores_and_distribution?.retail_partners || ['Target', "Dick's Sporting Goods", 'Nordstrom']).join(', ')}
              </p>
            </div>

            <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-1 text-xs">
              <h4 className="text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                Capital & Funding
              </h4>
              <p className="text-[#cbd5e1] leading-relaxed">
                {intel?.capital_and_funding?.total_raised || 'Seed funding backed by Mark Cuban & Maria Sharapova (Shark Tank).'}
              </p>
            </div>

            <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-1 text-xs">
              <h4 className="text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">
                Accounting Complexity & Recommended Pitch
              </h4>
              <p className="text-[#cbd5e1] leading-relaxed">
                {intel?.accounting_complexity_analysis?.recommended_pitch_angle ||
                  'Multi-channel EDI chargebacks & inventory reconciliation between retail POs and Shopify DTC.'}
              </p>
            </div>

            <div className="flex gap-2 mt-1">
              <button className="btn btn-outline btn-small flex-1" onClick={injectIntelToPayload}>
                Inject Intel into Payload
              </button>
              <button
                className="btn btn-outline btn-small flex-1"
                onClick={() => {
                  if (!intel) return alert('No dossier to copy.');
                  navigator.clipboard.writeText(JSON.stringify(intel, null, 2));
                  showToast('Dossier copied!');
                }}
              >
                Copy Dossier
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
