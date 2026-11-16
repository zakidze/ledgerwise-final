'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSavedCompanies, useChatThread, useCalendar, useAuditLog } from '@/lib/hooks';
import {
  getRealAvailableCalendarSlots,
  searchCalendarAppointments,
  parseQueryDate,
  getSlotsForDate,
} from '@/lib/calendar';
import { getStoredModel } from '@/lib/storage';
import { callAiCompletion, extractJsonString } from '@/lib/ai';
import { showToast } from '@/lib/toast';
import CalendarModal from '@/components/CalendarModal';

export default function ChatPage() {
  const router = useRouter();
  const { savedCompanies, activeCompany, setActiveCompany } = useSavedCompanies();
  const { schedule, activeMeeting, bookSlot, rescheduleSlot, cancelMeeting } = useCalendar();
  const { auditLog, clearLog } = useAuditLog();

  const company = activeCompany || savedCompanies[0];
  const { messages, addMessage, resetThread, autopilot, setAutopilot } = useChatThread(
    company?.company_name,
    company?.domain,
    company?.target_person_name
  );

  const [viewMode, setViewMode] = useState<'split' | 'prospect' | 'ledger'>('split');
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [prospectInput, setProspectInput] = useState('');
  const [ledgerInput, setLedgerInput] = useState('');
  const [aiActionMessage, setAiActionMessage] = useState<string | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);

  // Calendar metrics across next 14 days
  let openSlotsCount = 0;
  let blockedSlotsCount = 0;
  let bookedSlotsCount = 0;

  for (let i = 1; i <= 14; i++) {
    const nextDate = new Date(2026, 10, 14 + i);
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    const d = String(nextDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const daySlots = schedule[dateStr] || [];
    daySlots.forEach((s) => {
      if (s.status === 'AVAILABLE') openSlotsCount++;
      else if (s.status === 'BOOKED') bookedSlotsCount++;
      else if (s.status === 'BLOCKED') blockedSlotsCount++;
    });
  }

  const nextAvailableSlots = getRealAvailableCalendarSlots(3);

  // Incoming prospect reply logic
  const handleIncomingProspectReply = async (replyText: string) => {
    if (!replyText.trim() || !company) return;

    const pName = company.target_person_name || 'Prospect';
    const domain = company.domain || 'shopbala.com';

    addMessage({
      from: `${pName.toLowerCase().replace(/[^a-z]/g, '')}@${domain}`,
      to: 'alex@ledgerwise.com',
      senderName: `${pName} (${company.company_name})`,
      subject: `Re: ${messages[0]?.subject || 'Bookkeeping close'}`,
      body: replyText,
    });

    if (autopilot) {
      setAiActionMessage('AI reading real calendar availability & drafting compliant reply...');
      await new Promise((r) => setTimeout(r, 800));
      await handleAutonomousSdrResponse(replyText);
    } else {
      setAiActionMessage('Autopilot paused. AI drafted reply loaded into manual operator box.');
      const draft = await generateSdrDraft(replyText);
      setLedgerInput(draft.body);
    }
  };

  const handleAutonomousSdrResponse = async (prospectText: string) => {
    const draft = await generateSdrDraft(prospectText);

    // Real calendar execution
    if (draft.should_book_call) {
      const calRes = searchCalendarAppointments(prospectText, schedule);
      if (calRes.intent === 'SLOT_CLOSED' || calRes.intent === 'DAY_FULLY_CLOSED' || calRes.intent === 'SLOT_BOOKED') {
        draft.should_book_call = false;
        draft.body = calRes.message;
      } else {
        let targetDate = draft.targetDate || (calRes.intent === 'BOOK_MEETING' ? calRes.targetDate : null);
        let targetTime = draft.targetSlotTime || (calRes.intent === 'BOOK_MEETING' ? calRes.targetSlotTime : null);

        if (!targetDate || !targetTime) {
          const avail = getRealAvailableCalendarSlots(1);
          if (avail.length > 0) {
            targetDate = avail[0].dateStr;
            targetTime = avail[0].slotTime;
          }
        }

        if (targetDate && targetTime) {
          if (draft.intent_detected === 'RESCHEDULE_MEETING' || draft.is_reschedule) {
            rescheduleSlot(targetDate, targetTime, company);
          } else {
            bookSlot(targetDate, targetTime, company);
          }
        }
      }
    } else if (draft.intent_detected === 'CANCEL_MEETING') {
      cancelMeeting();
    }

    addMessage({
      from: 'alex@ledgerwise.com',
      to: `${company.target_person_name}@${company.domain}`,
      senderName: 'Alex at Ledgerwise',
      subject: draft.subject || `Re: ${messages[0]?.subject || 'Monthly close'}`,
      body: draft.body,
    });

    setAiActionMessage(`✓ ${draft.rule_applied_note || 'Calendar & Compliance Rule Applied'}`);
  };

  // Generate SDR Draft
  const generateSdrDraft = async (prospectReplyText: string) => {
    const parsedDate = parseQueryDate(prospectReplyText.toLowerCase());
    const realSlots = getRealAvailableCalendarSlots(8, parsedDate ? parsedDate.dateStr : '2026-11-17');
    const slotStrings = realSlots.map((s) => s.formatted);
    const calSearchResult = searchCalendarAppointments(prospectReplyText, schedule);
    const pName = company?.target_person_name || 'there';

    // 1. If prospect requested a blocked or already booked slot
    if (calSearchResult.intent === 'SLOT_CLOSED' || calSearchResult.intent === 'DAY_FULLY_CLOSED' || calSearchResult.intent === 'SLOT_BOOKED') {
      return {
        rule_applied_note: calSearchResult.rule_applied_note,
        intent_detected: calSearchResult.intent,
        subject: `Re: ${messages[0]?.subject || 'Meeting availability'}`,
        body: `Hey ${pName},\n\n${calSearchResult.message}\n\nBest,\nAlex | Ledgerwise`,
        should_book_call: false,
      };
    }

    // 2. If prospect confirmed a verified open slot
    if (calSearchResult.intent === 'BOOK_MEETING') {
      return {
        rule_applied_note: calSearchResult.rule_applied_note,
        intent_detected: 'BOOK_MEETING',
        targetDate: calSearchResult.targetDate,
        targetSlotTime: calSearchResult.targetSlotTime,
        subject: `Re: ${messages[0]?.subject || 'Confirmed: Discovery call'}`,
        body: `Hey ${pName},\n\n${calSearchResult.message}\n\nBest,\nAlex | Ledgerwise`,
        should_book_call: true,
      };
    }

    // 3. If prospect asked about availability on a specific date (e.g. "how about Thursday, Nov 26, 2026")
    if (calSearchResult.intent === 'DAY_SLOTS_OPEN') {
      return {
        rule_applied_note: calSearchResult.rule_applied_note,
        intent_detected: 'DAY_SLOTS_OPEN',
        targetDate: calSearchResult.targetDate,
        subject: `Re: ${messages[0]?.subject || 'Availability on ' + (calSearchResult.targetDayLabel || 'our calendar')}`,
        body: `Hey ${pName},\n\n${calSearchResult.message}\n\nBest,\nAlex | Ledgerwise`,
        should_book_call: false,
      };
    }

    // Prepare requested date context for AI model
    let requestedDateStatus = 'None specifically requested in query.';
    if (parsedDate) {
      const daySlots = getSlotsForDate(parsedDate.dateStr, schedule);
      const openTimes = daySlots.filter((s) => s.status === 'AVAILABLE').map((s) => s.time);
      const closedTimes = daySlots.filter((s) => s.status !== 'AVAILABLE').map((s) => `${s.time} (${s.status})`);
      requestedDateStatus = `${parsedDate.dayLabel} (${parsedDate.dateStr}) -> OPEN SLOTS: [${openTimes.join(', ') || 'None'}], BLOCKED/BOOKED: [${closedTimes.join(', ') || 'None'}]`;
    }

    // Try AI completion
    try {
      const model = getStoredModel();
      const formattedHistory = messages
        .map((m) => `${m.from === 'alex@ledgerwise.com' ? 'Ledgerwise' : 'Prospect'}: ${m.body}`)
        .join('\n\n');

      const systemPrompt = `You are the Ledgerwise Outbound AI Assistant handling replies from e-commerce founders ($1M–$10M ARR).

PROSPECT: ${JSON.stringify(company, null, 2)}
CALENDAR MEETING: ${activeMeeting ? JSON.stringify(activeMeeting) : 'None currently booked'}
REQUESTED DATE LIVE STATUS: ${requestedDateStatus}
CALENDAR SEARCH RESULT FOR THIS QUERY: ${JSON.stringify(calSearchResult)}
ACTUAL VERIFIED AVAILABLE CALENDAR SLOTS: ${slotStrings.join(', ')}

RULES:
1. TRUTH IN SCHEDULING: Always adhere to the CALENDAR SEARCH RESULT and REQUESTED DATE LIVE STATUS above.
   - If the prospect asked about a date and that date has OPEN slots, offer or confirm those open slots!
   - NEVER claim a date is closed or unavailable when the CALENDAR SEARCH RESULT or REQUESTED DATE LIVE STATUS indicates it has open slots.
   - ONLY inform them a date/slot is closed if the search result explicitly reports SLOT_CLOSED, SLOT_BOOKED, or DAY_FULLY_CLOSED.
2. If prospect confirms a slot that is available, return intent_detected: "BOOK_MEETING", should_book_call: true, targetDate: "YYYY-MM-DD", targetSlotTime: "time EST".
3. If prospect requests reschedule, pick next available slot, return intent_detected: "RESCHEDULE_MEETING", should_book_call: true, targetDate: "YYYY-MM-DD", targetSlotTime: "time EST".
4. Never quote pricing tiers. Deflect to a 15-min discovery call.
5. Honest about AI assistant if asked.
6. Brevity: under 75 words. Clean operator tone.

Return JSON schema: {"rule_applied_note":"string","intent_detected":"string","subject":"string","body":"string","should_book_call":boolean,"targetDate":"string","targetSlotTime":"string"}`;

      const raw = await callAiCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Prospect replied: "${prospectReplyText}".\n\nThread:\n${formattedHistory}` },
        ],
        model,
        0.2,
        'chat_email'
      );

      const parsed = JSON.parse(extractJsonString(raw));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}

    // Fallback rule-based generator
    const lower = prospectReplyText.toLowerCase();
    const compName = company?.company_name || 'your company';
    const firstSlot = realSlots.length > 0 ? realSlots[0].formatted : null;
    const secondSlot = realSlots.length > 1 ? realSlots[1].formatted : null;

    if (lower.includes('unsubscribe') || lower.includes('stop') || lower.includes('remove me')) {
      return {
        intent_detected: 'UNSUBSCRIBE',
        rule_applied_note: 'Compliance: Unsubscribe request honored.',
        subject: `Re: ${messages[0]?.subject || 'Monthly close'}`,
        body: `Understood completely, ${pName}. You've been removed from all future outreach. Wishing you continued growth with ${compName}.\n\nBest,\nAlex`,
        should_book_call: false,
      };
    }

    if (lower.includes('pricing') || lower.includes('cost') || lower.includes('rate') || lower.includes('fee')) {
      const slotsProposal = firstSlot && secondSlot
        ? `on ${firstSlot} or ${secondSlot}`
        : firstSlot
        ? `on ${firstSlot}`
        : `once our upcoming schedule opens up`;
      return {
        intent_detected: 'PRICING',
        rule_applied_note: 'Strategy: Deflected pricing to 15-min discovery call.',
        subject: `Re: ${messages[0]?.subject || 'Monthly close'}`,
        body: `Hey ${pName},\n\nOur monthly retainers depend on transaction volume, order channels (Shopify + Target EDI), and inventory reconciliation complexity rather than flat tiers.\n\nOpen to a brief 15-minute sync ${slotsProposal} to scope your current close and share an exact quote?\n\nBest,\nAlex`,
        should_book_call: false,
      };
    }

    if (lower.includes('ai') || lower.includes('bot') || lower.includes('who is this') || lower.includes('real person')) {
      const slotsProposal = firstSlot
        ? `Would you be open to a quick 15-minute sync on ${firstSlot} to discuss ${compName}'s retail inventory accounting?`
        : `Would you be open to connecting once our upcoming calendar opens up to discuss ${compName}'s retail inventory accounting?`;
      return {
        intent_detected: 'BOT_QUERY',
        rule_applied_note: 'Compliance: Honest AI disclosure bridged back to monthly close.',
        subject: `Re: ${messages[0]?.subject || 'Monthly close'}`,
        body: `Yes, I'm an AI assistant helping Alex and the Ledgerwise team manage outbound scheduling. Alex and our CPAs lead all discovery and accounting onboarding.\n\n${slotsProposal}\n\nBest,\nAlex`,
        should_book_call: false,
      };
    }

    if (lower.includes('cancel') && (lower.includes('call') || lower.includes('meeting') || activeMeeting)) {
      return {
        intent_detected: 'CANCEL_MEETING',
        rule_applied_note: 'Calendar Sync: Cancelled discovery call and freed slot on real calendar.',
        subject: `Re: ${messages[0]?.subject || 'Discovery call'}`,
        body: `Understood completely, ${pName}. I have cancelled our discovery call on our calendar and freed the appointment slot. If your schedule opens up in the future, please feel free to reach back out.\n\nBest,\nAlex | Ledgerwise`,
        should_book_call: false,
      };
    }

    if (lower.includes('reschedule') || (activeMeeting && lower.includes('instead'))) {
      if (realSlots.length > 0) {
        const nextSlot = realSlots[0];
        return {
          intent_detected: 'RESCHEDULE_MEETING',
          is_reschedule: true,
          targetDate: nextSlot.dateStr,
          targetSlotTime: nextSlot.slotTime,
          rule_applied_note: `Calendar Sync: Rescheduled to next verified open slot (${nextSlot.formatted}).`,
          subject: `Re: ${messages[0]?.subject || 'Rescheduled: Discovery call'}`,
          body: `Hey ${pName},\n\nI have checked our real calendar and updated our invitation to ${nextSlot.formatted}—all meeting details remain unchanged.\n\nLooking forward to speaking then!\n\nBest,\nAlex | Ledgerwise`,
          should_book_call: true,
        };
      }
    }

    return {
      intent_detected: 'GENERAL',
      rule_applied_note: 'Rule: General peer-to-peer reply.',
      subject: `Re: ${messages[0]?.subject || 'Monthly close'}`,
      body: firstSlot
        ? `Hey ${pName},\n\nThanks for getting back to me. Would ${firstSlot} work for a brief 15-minute intro call to see if our bookkeeping framework is a good fit for ${compName}?\n\nBest,\nAlex`
        : `Hey ${pName},\n\nThanks for getting back to me. Our team is currently fully committed, but I'd be glad to reconnect as soon as our calendar opens up for ${compName}.\n\nBest,\nAlex`,
      should_book_call: false,
    };
  };

  const handleSendLedgerManual = () => {
    if (!ledgerInput.trim() || !company) return;
    addMessage({
      from: 'alex@ledgerwise.com',
      to: `${company.target_person_name}@${company.domain}`,
      senderName: 'Alex at Ledgerwise',
      subject: `Re: ${messages[0]?.subject || 'Monthly close'}`,
      body: ledgerInput.trim(),
    });
    setLedgerInput('');
  };

  const handleGenerateManualAiDraft = async () => {
    setIsGeneratingAiDraft(true);
    const lastProspectMsg = [...messages].reverse().find((m) => m.from !== 'alex@ledgerwise.com');
    const text = lastProspectMsg ? lastProspectMsg.body : 'Interested in monthly bookkeeping.';
    const draft = await generateSdrDraft(text);
    setLedgerInput(draft.body);
    setIsGeneratingAiDraft(false);
    showToast('AI draft loaded into operator draft box.');
  };

  const sendQuickReply = (type: string) => {
    let replyText = '';
    const firstSlot = nextAvailableSlots.length > 0 ? nextAvailableSlots[0].formatted : 'Tuesday, Nov 17 at 11:00 AM EST';

    if (type === 'search_open') {
      replyText = 'What appointment times do you currently have open on your calendar this week?';
    } else if (type === 'test_closed') {
      replyText = 'Can we meet Tuesday at 9:00 AM EST?';
    } else if (type === 'search_wed') {
      replyText = 'What appointment times are open on Wednesday?';
    } else if (type === 'confirm_open') {
      replyText = `${firstSlot} works great for me, let's lock it in.`;
    } else if (type === 'reschedule') {
      replyText = 'Something came up for our call. Can we reschedule to Wednesday at 2:00 PM EST?';
    } else if (type === 'cancel') {
      replyText = 'Please cancel our scheduled discovery call.';
    } else if (type === 'pricing') {
      replyText = 'What does your monthly bookkeeping cost? Can you share pricing tiers?';
    } else if (type === 'who') {
      replyText = 'Who is this, and is this an AI or a real person? How did you get my email?';
    } else if (type === 'unsubscribe') {
      replyText = 'Not interested. Please remove me from your list and unsubscribe.';
    }

    handleIncomingProspectReply(replyText);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Controls */}
      <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-lg">💬</span>
            <span className="font-bold text-white text-xs sm:text-sm shrink-0">Company:</span>
            <select
              value={company?.company_name || ''}
              onChange={(e) => {
                const found = savedCompanies.find((c) => c.company_name === e.target.value);
                if (found) setActiveCompany(found);
              }}
              className="bg-[#090e18] border border-[#263554] text-[#10b981] font-semibold text-xs px-2.5 py-1.5 rounded-[6px] outline-none cursor-pointer flex-1 sm:flex-initial max-w-[220px]"
            >
              {savedCompanies.map((c) => (
                <option key={c.company_name} value={c.company_name}>
                  {c.company_name} ({c.domain || 'e-commerce'})
                </option>
              ))}
            </select>
          </div>

          {/* View mode switcher */}
          <div className="flex bg-[#090e18] border border-[#263554] rounded-lg p-0.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setViewMode('split')}
              className={`btn btn-small flex-1 sm:flex-initial text-[0.72rem] sm:text-[0.75rem] ${viewMode === 'split' ? 'bg-[#1c2742] text-white' : 'text-[#94a3b8]'}`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('prospect')}
              className={`btn btn-small flex-1 sm:flex-initial text-[0.72rem] sm:text-[0.75rem] ${viewMode === 'prospect' ? 'bg-[#1c2742] text-white' : 'text-[#94a3b8]'}`}
            >
              Prospect View
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`btn btn-small flex-1 sm:flex-initial text-[0.72rem] sm:text-[0.75rem] ${viewMode === 'ledger' ? 'bg-[#1c2742] text-white' : 'text-[#94a3b8]'}`}
            >
              Ledgerwise View
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
          {/* Autopilot toggle */}
          <div className="flex items-center gap-2 bg-[#090e18] border border-[#263554] px-2.5 py-1 rounded-lg">
            <label className="text-[0.7rem] sm:text-[0.75rem] text-[#94a3b8] font-bold">AUTOPILOT</label>
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              className="cursor-pointer"
            />
            <span className={`badge ${autopilot ? 'badge-high' : 'badge-medium'} text-[0.65rem]`}>
              {autopilot ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              className="btn btn-outline btn-small text-[0.72rem]"
              onClick={() => setShowAuditDrawer(!showAuditDrawer)}
            >
              Audit ({auditLog.length})
            </button>
            <button
              className="btn btn-outline btn-small text-[0.72rem]"
              onClick={() => {
                if (confirm(`Reset message thread for ${company?.company_name || 'this company'}?`)) {
                  resetThread();
                  showToast('Conversation thread reset.');
                }
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Live Calendar Appointment Sync Bar */}
      <div className="bg-[#090e18] border border-[#263554] rounded-lg p-2.5 sm:p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className="pulse-dot"
              style={{ backgroundColor: activeMeeting || openSlotsCount > 0 ? '#10b981' : '#ef4444' }}
            ></div>
            <span className="font-bold text-white text-xs">Calendar Synced</span>
          </div>

          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="badge bg-[rgba(16,185,129,0.15)] text-[#34d399] border border-[rgba(16,185,129,0.3)] text-[0.7rem] sm:text-[0.72rem] py-0.5 px-2">
              🟢 <strong>{openSlotsCount}</strong> Open
            </span>
            <span className="badge bg-[rgba(239,68,68,0.15)] text-[#f87171] border border-[rgba(239,68,68,0.3)] text-[0.7rem] sm:text-[0.72rem] py-0.5 px-2">
              ⛔ <strong>{blockedSlotsCount}</strong> Blocked
            </span>
            <span className="badge bg-[rgba(234,179,8,0.15)] text-[#facc15] border border-[rgba(234,179,8,0.3)] text-[0.7rem] sm:text-[0.72rem] py-0.5 px-2">
              🏆 <strong>{bookedSlotsCount}</strong> Booked
            </span>
          </div>

          <div className="text-[#94a3b8] text-[0.75rem] sm:text-[0.78rem] w-full lg:w-auto">
            {activeMeeting ? (
              <span className="truncate block">
                🟢 Confirmed: <strong className="text-white">{activeMeeting.timeSlot}</strong> ({activeMeeting.prospectName})
              </span>
            ) : (
              'No Discovery Call Scheduled'
            )}
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap justify-between lg:justify-end">
          {/* Quick slot test pills */}
          <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {nextAvailableSlots.map((s) => (
              <button
                key={s.formatted}
                onClick={() => {
                  setProspectInput(`Does ${s.formatted} work for our 15-minute discovery call?`);
                  showToast(`Loaded "${s.formatted}" into Prospect Simulator! Hit Send to test.`);
                }}
                className="quick-reply-btn border-[rgba(52,211,153,0.4)] text-[#34d399] text-[0.68rem] sm:text-[0.7rem] py-0.5 px-2 shrink-0"
                title="Click to test this open slot in chat"
              >
                📅 {s.formatted}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 items-center w-full sm:w-auto justify-end">
            <button className="btn btn-accent btn-small flex-1 sm:flex-initial text-[0.72rem]" onClick={() => router.push('/calendar')}>
              📅 Calendar ➔
            </button>
            <button className="btn btn-outline btn-small flex-1 sm:flex-initial text-[0.72rem]" onClick={() => setIsCalendarModalOpen(true)}>
              Quick Slot
            </button>
          </div>
        </div>
      </div>

      {/* Audit Drawer (Collapsible) */}
      {showAuditDrawer && (
        <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 max-h-52 overflow-y-auto flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-white">Real-Time Compliance & Activity Audit Trail</span>
            <button className="btn btn-outline btn-small py-0.5 px-2 text-[0.7rem]" onClick={clearLog}>
              Clear
            </button>
          </div>
          {auditLog.length === 0 ? (
            <div className="text-[#64748b] p-1">No audit events recorded yet.</div>
          ) : (
            auditLog.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 p-1 rounded bg-white/[0.02]">
                <span className="text-[#64748b] font-mono text-[0.7rem] min-w-[65px]">{item.time}</span>
                <span className="badge badge-high text-[0.65rem] py-0 px-1.5">{item.type}</span>
                <span className="text-[#cbd5e1]">{item.text}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Dual Split Panes */}
      <div
        className={`grid gap-4 ${
          viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* Side 1: Prospect Perspective */}
        {(viewMode === 'split' || viewMode === 'prospect') && (
          <div className="bg-[#151d30] border border-[#263554] rounded-xl flex flex-col overflow-hidden min-h-[500px] h-[540px] md:h-[680px]">
            <div className="p-3 bg-[#1c2742] border-b border-[#263554] border-t-4 border-t-[#3b82f6] flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>👤</span>
                <span>
                  {company?.target_person_name || 'Prospect'} ({company?.target_person_title || 'Executive'} at {company?.company_name || 'Bala'})
                </span>
              </h3>
              <span className="badge bg-[rgba(59,130,246,0.2)] text-[#3b82f6]">Prospect Perspective</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#090e18]">
              {messages.map((m) => {
                const isFromLedger = m.from === 'alex@ledgerwise.com';
                return (
                  <div
                    key={m.id}
                    className={`bg-[#151d30] border border-[#263554] rounded-lg p-3.5 flex flex-col gap-2 text-xs shadow-md ${
                      isFromLedger ? 'border-l-4 border-l-[#10b981]' : 'border-l-4 border-l-[#3b82f6]'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[0.75rem] text-[#94a3b8]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.senderName}</span>
                        <span
                          className={`badge ${
                            isFromLedger
                              ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981]'
                              : 'bg-[rgba(59,130,246,0.2)] text-[#3b82f6]'
                          }`}
                        >
                          {isFromLedger ? 'LEDGERWISE OUTBOUND' : 'PROSPECT REPLY'}
                        </span>
                      </div>
                      <span>{m.time}</span>
                    </div>
                    <div className="font-semibold text-white text-xs">Subject: {m.subject}</div>
                    <div className="text-[#f1f5f9] leading-relaxed whitespace-pre-wrap">{m.body}</div>
                  </div>
                );
              })}
            </div>

            {/* Simulation controls */}
            <div className="p-3 bg-[#1c2742] border-t border-[#263554] flex flex-col gap-2">
              <div className="text-[0.72rem] text-[#94a3b8] font-bold uppercase">
                Simulate Prospect Reply:
              </div>

              <div className="flex flex-wrap gap-1.5 mb-1">
                <button className="quick-reply-btn" onClick={() => sendQuickReply('search_open')}>
                  🔎 Search Open Slots
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('test_closed')}>
                  ⛔ Test Closed Slot (Tue 9 AM)
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('search_wed')}>
                  📅 Search Day Slots (Wed)
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('confirm_open')}>
                  ✅ Confirm Open Slot
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('reschedule')}>
                  🔄 Reschedule Call
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('cancel')}>
                  ❌ Cancel Meeting
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('pricing')}>
                  💰 Pricing
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('who')}>
                  🤔 Who is this?
                </button>
                <button className="quick-reply-btn" onClick={() => sendQuickReply('unsubscribe')}>
                  🚫 Unsubscribe
                </button>
              </div>

              <div className="flex gap-2">
                <textarea
                  value={prospectInput}
                  onChange={(e) => setProspectInput(e.target.value)}
                  placeholder="Type custom reply as prospect..."
                  className="w-full h-16 bg-[#090e18] border border-[#263554] rounded-md text-white text-xs p-2 resize-none outline-none focus:border-[#3b82f6]"
                />
                <button
                  className="btn btn-primary self-end px-3.5 py-2.5"
                  onClick={() => {
                    handleIncomingProspectReply(prospectInput);
                    setProspectInput('');
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Side 2: Ledgerwise SDR Perspective */}
        {(viewMode === 'split' || viewMode === 'ledger') && (
          <div className="bg-[#151d30] border border-[#263554] rounded-xl flex flex-col overflow-hidden min-h-[500px] h-[540px] md:h-[680px]">
            <div className="p-3 bg-[#1c2742] border-b border-[#263554] border-t-4 border-t-[#10b981] flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>⚡</span>
                <span>Ledgerwise: Alex (Autonomous SDR Agent)</span>
              </h3>
              <span className={`badge ${autopilot ? 'badge-high' : 'badge-medium'}`}>
                {autopilot ? 'AUTOPILOT READY' : 'MANUAL MODE'}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#090e18]">
              {messages.map((m) => {
                const isFromLedger = m.from === 'alex@ledgerwise.com';
                return (
                  <div
                    key={m.id}
                    className={`bg-[#151d30] border border-[#263554] rounded-lg p-3.5 flex flex-col gap-2 text-xs shadow-md ${
                      isFromLedger ? 'border-l-4 border-l-[#10b981]' : 'border-l-4 border-l-[#3b82f6]'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[0.75rem] text-[#94a3b8]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.senderName}</span>
                        <span
                          className={`badge ${
                            isFromLedger
                              ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981]'
                              : 'bg-[rgba(59,130,246,0.2)] text-[#3b82f6]'
                          }`}
                        >
                          {isFromLedger ? 'LEDGERWISE OUTBOUND' : 'PROSPECT REPLY'}
                        </span>
                      </div>
                      <span>{m.time}</span>
                    </div>
                    <div className="font-semibold text-white text-xs">Subject: {m.subject}</div>
                    <div className="text-[#f1f5f9] leading-relaxed whitespace-pre-wrap">{m.body}</div>
                  </div>
                );
              })}
            </div>

            {/* Operator controls */}
            <div className="p-3 bg-[#1c2742] border-t border-[#263554] flex flex-col gap-2.5">
              {aiActionMessage && (
                <div className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] px-3 py-2 rounded-lg text-xs text-[#34d399] flex items-center justify-between">
                  <span>{aiActionMessage}</span>
                  <button className="text-xs cursor-pointer ml-2" onClick={() => setAiActionMessage(null)}>
                    ✕
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={ledgerInput}
                  onChange={(e) => setLedgerInput(e.target.value)}
                  placeholder="Ledgerwise SDR reply draft (AI prepares draft or edit manually)..."
                  className="w-full h-16 bg-[#090e18] border border-[#263554] rounded-md text-white text-xs p-2 resize-none outline-none focus:border-[#10b981]"
                />
                <div className="flex flex-col gap-1.5">
                  <button className="btn btn-accent btn-small flex-1" onClick={handleSendLedgerManual}>
                    Send
                  </button>
                  <button
                    className="btn btn-outline btn-small flex-1"
                    onClick={handleGenerateManualAiDraft}
                    disabled={isGeneratingAiDraft}
                  >
                    {isGeneratingAiDraft ? 'Drafting...' : 'AI Draft'}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => {
                    setAutopilot(false);
                    showToast('🛑 Human operator took over this thread. Bot paused.');
                  }}
                >
                  🛑 Take Over (Human Mode)
                </button>
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => setIsCalendarModalOpen(true)}
                >
                  📅 Book / Reschedule Call
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Modal */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
      />
    </div>
  );
}
