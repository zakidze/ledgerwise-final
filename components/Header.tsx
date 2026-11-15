'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSavedCompanies, useLeads, useCalendar } from '@/lib/hooks';
import { getStoredModel, saveStoredModel } from '@/lib/storage';

export default function Header() {
  const pathname = usePathname();
  const { savedCompanies, activeCompany, setActiveCompany } = useSavedCompanies();
  const { leads } = useLeads();
  const { schedule } = useCalendar();

  const [selectedModel, setSelectedModel] = useState<string>('qwen/qwen3.7-flash:free');
  const [customModel, setCustomModel] = useState<string>('');
  const [showCustomModelInput, setShowCustomModelInput] = useState<boolean>(false);

  useEffect(() => {
    const model = getStoredModel();
    if (['qwen/qwen3.7-flash:free', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-chat'].includes(model)) {
      setSelectedModel(model);
      setShowCustomModelInput(false);
    } else {
      setSelectedModel('custom');
      setCustomModel(model);
      setShowCustomModelInput(true);
    }
  }, []);

  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    if (val === 'custom') {
      setShowCustomModelInput(true);
    } else {
      setShowCustomModelInput(false);
      saveStoredModel(val);
    }
  };

  const handleCustomModelChange = (val: string) => {
    setCustomModel(val);
    saveStoredModel(val);
  };

  const handleCompanyChange = (companyName: string) => {
    const found = savedCompanies.find((c) => c.company_name === companyName);
    if (found) {
      setActiveCompany(found);
    }
  };

  // Calculate calendar available slots count
  let availableSlotsCount = 0;
  Object.values(schedule).forEach((slots) => {
    slots.forEach((s) => {
      if (s.status === 'AVAILABLE') availableSlotsCount++;
    });
  });

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#151d30] border-b border-[#263554] shadow-lg">
      {/* Brand Section */}
      <Link href="/find-lead" className="flex items-center gap-3 no-underline">
        <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#10b981] to-[#0284c7] flex items-center justify-center text-white font-extrabold text-lg shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
          LW
        </div>
        <div>
          <h1 className="text-[1.1rem] font-bold text-white tracking-tight flex items-center gap-2">
            Ledgerwise{' '}
            <span className="text-[0.68rem] bg-[rgba(16,185,129,0.2)] text-[#10b981] px-1.5 py-0.5 rounded font-bold tracking-wider border border-[rgba(16,185,129,0.3)]">
              OUTBOUND SUITE
            </span>
          </h1>
          <p className="text-[0.72rem] text-[#94a3b8]">B2B Bookkeeping Outbound Engine & Autonomous SDR</p>
        </div>
      </Link>

      {/* Main Navigation Stepper */}
      <nav className="flex items-center bg-[#090e18] border border-[#263554] rounded-[10px] p-1 gap-1">
        <Link
          href="/find-lead"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[7px] text-[0.82rem] font-semibold transition-all whitespace-nowrap ${
            pathname.startsWith('/find-lead')
              ? 'bg-[#1c2742] text-[#38bdf8] border border-[rgba(56,189,248,0.4)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🔍 1. Find Leads</span>
          <span className="bg-[#10b981] text-[#0b0f19] text-[0.7rem] px-1.5 py-0.2 rounded-full font-bold">
            {leads.length}
          </span>
        </Link>

        <Link
          href="/save-company"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[7px] text-[0.82rem] font-semibold transition-all whitespace-nowrap ${
            pathname.startsWith('/save-company') || pathname.startsWith('/company')
              ? 'bg-[#1c2742] text-[#f59e0b] border border-[rgba(245,158,11,0.4)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>⭐ 2. Saved Companies</span>
          <span className="bg-[#10b981] text-[#0b0f19] text-[0.7rem] px-1.5 py-0.2 rounded-full font-bold">
            {savedCompanies.length}
          </span>
        </Link>

        <Link
          href="/draft-email"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[7px] text-[0.82rem] font-semibold transition-all whitespace-nowrap ${
            pathname.startsWith('/draft-email')
              ? 'bg-[#1c2742] text-[#10b981] border border-[rgba(16,185,129,0.4)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>✍️ 3. Draft Email</span>
        </Link>

        <Link
          href="/chat"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[7px] text-[0.82rem] font-semibold transition-all whitespace-nowrap ${
            pathname.startsWith('/chat')
              ? 'bg-[#1c2742] text-[#a78bfa] border border-[rgba(167,139,250,0.4)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>💬 4 & 5. Chat & Simulate</span>
          <span className="bg-[#10b981] text-[#0b0f19] text-[0.7rem] px-1.5 py-0.2 rounded-full font-bold">
            Active
          </span>
        </Link>

        <Link
          href="/calendar"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[7px] text-[0.82rem] font-semibold transition-all whitespace-nowrap ${
            pathname.startsWith('/calendar') || pathname.startsWith('/calandar')
              ? 'bg-[#1c2742] text-[#34d399] border border-[rgba(52,211,153,0.4)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📅 5. Real Calendar</span>
          <span className="bg-[#10b981] text-[#0b0f19] text-[0.7rem] px-1.5 py-0.2 rounded-full font-bold">
            {availableSlotsCount} Open
          </span>
        </Link>
      </nav>

      {/* Target Company Switcher & Global Config */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] px-3 py-1 rounded-[8px] text-[0.8rem]">
          <span className="text-[#94a3b8] text-[0.72rem] uppercase font-bold tracking-wider">🎯 Target:</span>
          <select
            value={activeCompany?.company_name || ''}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="bg-[#090e18] border border-[#263554] text-[#10b981] font-semibold text-[0.82rem] px-2 py-1 rounded-[6px] outline-none cursor-pointer max-w-[170px]"
          >
            {savedCompanies.length === 0 ? (
              <option value="">No companies saved</option>
            ) : (
              savedCompanies.map((c) => (
                <option key={c.company_name} value={c.company_name}>
                  {c.company_name} ({c.domain || 'e-commerce'})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center bg-[#090e18] border border-[#263554] rounded-[8px] px-2 py-1 gap-1.5">
          <label className="text-[0.72rem] text-[#94a3b8] font-semibold uppercase tracking-wider">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="bg-transparent border-none text-[#f1f5f9] text-[0.82rem] outline-none cursor-pointer"
          >
            <option value="qwen/qwen3.7-flash:free">qwen3.7-flash</option>
            <option value="google/gemini-2.0-flash-001">gemini-2.0-flash</option>
            <option value="deepseek/deepseek-chat">deepseek-chat</option>
            <option value="custom">Custom...</option>
          </select>
          {showCustomModelInput && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => handleCustomModelChange(e.target.value)}
              placeholder="model/name"
              className="w-[100px] bg-transparent border border-[#263554] text-[#f1f5f9] text-[0.82rem] px-1 py-0.5 rounded outline-none"
            />
          )}
        </div>

        {/* API Key from Env Status Indicator */}
        <div className="flex items-center bg-[#090e18] border border-[#263554] rounded-[8px] px-2.5 py-1.5 gap-2">
          <span className="text-[0.72rem] text-[#94a3b8] font-semibold uppercase tracking-wider">API:</span>
          <span className="flex items-center gap-1.5 text-[0.75rem] text-[#10b981] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
            Env Configured
          </span>
        </div>
      </div>
    </header>
  );
}
