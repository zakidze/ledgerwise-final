"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function FlowBanner() {
  const rawPath = usePathname();
  const pathname = rawPath || "";
  const router = useRouter();

  const isLeads = pathname.startsWith("/find-lead");
  const isSaved =
    pathname.startsWith("/save-company") || pathname.startsWith("/company");
  const isCrafter = pathname.startsWith("/draft-email");
  const isInbox = pathname.startsWith("/chat");
  const isCalendar =
    pathname.startsWith("/calendar") || pathname.startsWith("/calandar");

  let currentStep = 1;
  let nextActionText = "Go to Saved Companies ➔";
  let nextActionHref = "/save-company";

  if (isLeads) {
    currentStep = 1;
    nextActionText = "Step 2: Saved Companies ➔";
    nextActionHref = "/save-company";
  } else if (isSaved) {
    currentStep = 2;
    nextActionText = "Step 3: Draft Email for Target ➔";
    nextActionHref = "/draft-email";
  } else if (isCrafter) {
    currentStep = 3;
    nextActionText = "Step 4 & 5: Dispatch to Chat Simulator ➔";
    nextActionHref = "/chat";
  } else if (isInbox) {
    currentStep = 5;
    nextActionText = "Step 5: Open Real Calendar ➔";
    nextActionHref = "/calendar";
  } else if (isCalendar) {
    currentStep = 6;
    nextActionText = "Back to Prospect Pipeline ➔";
    nextActionHref = "/save-company";
  }

  return (
    <div className="bg-[#090e18] border-b border-[#263554] px-3 sm:px-5 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-[0.78rem]">
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        <Link
          href="/find-lead"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline shrink-0 ${
            currentStep === 1
              ? "text-white font-bold bg-[#1c2742] border border-[#263554]"
              : "text-[#94a3b8] hover:text-white hover:bg-white/5"
          }`}
        >
          <span
            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold ${
              currentStep === 1 ? "bg-[#10b981] text-[#0b0f19]" : "bg-[#263554]"
            }`}
          >
            1
          </span>
          <span>Find Lead</span>
        </Link>
        <span className="text-[#64748b] text-[0.8rem] shrink-0">➔</span>

        <Link
          href="/save-company"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline shrink-0 ${
            currentStep === 2
              ? "text-white font-bold bg-[#1c2742] border border-[#263554]"
              : "text-[#94a3b8] hover:text-white hover:bg-white/5"
          }`}
        >
          <span
            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold ${
              currentStep === 2 ? "bg-[#10b981] text-[#0b0f19]" : "bg-[#263554]"
            }`}
          >
            2
          </span>
          <span>Save Company</span>
        </Link>
        <span className="text-[#64748b] text-[0.8rem] shrink-0">➔</span>

        <Link
          href="/draft-email"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline shrink-0 ${
            currentStep === 3
              ? "text-white font-bold bg-[#1c2742] border border-[#263554]"
              : "text-[#94a3b8] hover:text-white hover:bg-white/5"
          }`}
        >
          <span
            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold ${
              currentStep === 3 ? "bg-[#10b981] text-[#0b0f19]" : "bg-[#263554]"
            }`}
          >
            3
          </span>
          <span>Draft Email</span>
        </Link>
        <span className="text-[#64748b] text-[0.8rem] shrink-0">➔</span>

        <Link
          href="/draft-email"
          className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline text-[#94a3b8] hover:text-white hover:bg-white/5 shrink-0"
        >
          <span className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold bg-[#263554]">
            4
          </span>
          <span>Send Email</span>
        </Link>
        <span className="text-[#64748b] text-[0.8rem] shrink-0">➔</span>

        <Link
          href="/chat"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline shrink-0 ${
            currentStep === 5
              ? "text-white font-bold bg-[#1c2742] border border-[#263554]"
              : "text-[#94a3b8] hover:text-white hover:bg-white/5"
          }`}
        >
          <span
            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold ${
              currentStep === 5 ? "bg-[#10b981] text-[#0b0f19]" : "bg-[#263554]"
            }`}
          >
            5
          </span>
          <span>Chat & Book</span>
        </Link>
        <span className="text-[#64748b] text-[0.8rem] shrink-0">➔</span>

        <Link
          href="/calendar"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] transition-all no-underline shrink-0 ${
            currentStep === 6
              ? "text-white font-bold bg-[#1c2742] border border-[#263554]"
              : "text-[#94a3b8] hover:text-white hover:bg-white/5"
          }`}
        >
          <span
            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.68rem] font-bold ${
              currentStep === 6 ? "bg-[#10b981] text-[#0b0f19]" : "bg-[#263554]"
            }`}
          >
            📅
          </span>
          <span>Manage Calendar</span>
        </Link>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={() => router.push(nextActionHref)}
          className="btn btn-outline btn-small text-[0.75rem] sm:text-[0.78rem] w-full sm:w-auto"
        >
          {nextActionText}
        </button>
      </div>
    </div>
  );
}
