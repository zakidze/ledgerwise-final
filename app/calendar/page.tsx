'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendar, useSavedCompanies } from '@/lib/hooks';
import {
  formatDateKey,
  formatHumanDate,
  exportCalendarICS,
  getSlotsForDate,
} from '@/lib/calendar';
import { showToast } from '@/lib/toast';

export default function CalendarPage() {
  const router = useRouter();
  const {
    schedule,
    selectedDate,
    setSelectedDate,
    bookSlot,
    blockSlot,
    unblockSlot,
    toggleBlockDay,
    addCustomSlot,
    deleteSlot,
    cancelMeeting,
  } = useCalendar();
  const { activeCompany } = useSavedCompanies();

  const [calYear, setCalYear] = useState<number>(2026);
  const [calMonth, setCalMonth] = useState<number>(10); // 0-indexed: 10 = November
  const [newSlotTime, setNewSlotTime] = useState('');

  // Month navigation
  const navigateMonth = (delta: number) => {
    let nextM = calMonth + delta;
    let nextY = calYear;
    if (nextM < 0) {
      nextM = 11;
      nextY--;
    } else if (nextM > 11) {
      nextM = 0;
      nextY++;
    }
    setCalMonth(nextM);
    setCalYear(nextY);
  };

  const jumpToToday = () => {
    setCalYear(2026);
    setCalMonth(10);
    setSelectedDate('2026-11-14');
  };

  // Month metrics
  let monthAvailable = 0;
  let monthBooked = 0;
  let monthBlocked = 0;

  for (const dKey in schedule) {
    const parts = dKey.split('-');
    if (parseInt(parts[0], 10) === calYear && parseInt(parts[1], 10) - 1 === calMonth) {
      const slots = schedule[dKey] || [];
      slots.forEach((s) => {
        if (s.status === 'AVAILABLE') monthAvailable++;
        else if (s.status === 'BOOKED') monthBooked++;
        else if (s.status === 'BLOCKED') monthBlocked++;
      });
    }
  }

  // Selected date inspector
  const activeDateSlots = getSlotsForDate(selectedDate, schedule);
  const availCount = activeDateSlots.filter((s) => s.status === 'AVAILABLE').length;
  const bookedCount = activeDateSlots.filter((s) => s.status === 'BOOKED').length;
  const blockedCount = activeDateSlots.filter((s) => s.status === 'BLOCKED').length;

  const handleAddSlot = () => {
    if (!newSlotTime.trim()) return alert('Please enter a time slot (e.g. 01:30 PM EST).');
    addCustomSlot(selectedDate, newSlotTime.trim());
    setNewSlotTime('');
    showToast(`Added slot "${newSlotTime}" to ${selectedDate}!`);
  };

  const handleExportICS = () => {
    const icsContent = exportCalendarICS();
    if (!icsContent) {
      alert('No booked discovery meetings to export. Book a call first.');
      return;
    }
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ledgerwise_meetings.ics';
    link.click();
    showToast('iCalendar (.ics) exported! You can open and import it into Google Calendar or Outlook.');
  };

  // Build grid calendar days
  const firstDayWeekday = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const prevMonthCells = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    const prevDayNum = daysInPrevMonth - firstDayWeekday + i + 1;
    prevMonthCells.push(prevDayNum);
  }

  const nextMonthPadding = (firstDayWeekday + daysInMonth > 35 ? 42 : 35) - (firstDayWeekday + daysInMonth);
  const nextMonthCells = [];
  for (let j = 1; j <= nextMonthPadding; j++) {
    nextMonthCells.push(j);
  }

  const dateObj = new Date(calYear, calMonth, 1);
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(16,185,129,0.15)] text-[#10b981] shrink-0">
            🟢
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider truncate">
              Available ({monthName})
            </h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{monthAvailable}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(234,179,8,0.2)] text-[#eab308] shrink-0">
            🏆
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider truncate">Confirmed Calls</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{monthBooked}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(239,68,68,0.15)] text-[#f87171] shrink-0">
            ⛔
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider truncate">Blocked Slots</h4>
            <div className="text-[1.2rem] sm:text-[1.35rem] text-white font-extrabold">{monthBlocked}</div>
          </div>
        </div>

        <div className="bg-[#151d30] border border-[#263554] rounded-[10px] p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg bg-[rgba(56,189,248,0.15)] text-[#38bdf8] shrink-0">
            📍
          </div>
          <div>
            <h4 className="text-[0.68rem] sm:text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider truncate">Time Zone</h4>
            <div className="text-[0.95rem] sm:text-[1.05rem] text-white font-extrabold pt-1 truncate">EST (New York)</div>
          </div>
        </div>
      </div>

      {/* Main Calendar Suite Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Month Grid Card */}
        <div className="lg:col-span-8 bg-[#151d30] border border-[#263554] rounded-xl p-3.5 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#263554] pb-3">
            <div className="text-[1.1rem] sm:text-[1.25rem] font-extrabold text-white flex items-center gap-2">
              <span>📅</span>
              <span>
                {monthName} {calYear}
              </span>
            </div>

            <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
              <button className="btn btn-outline btn-small text-[0.72rem]" onClick={() => navigateMonth(-1)}>
                ◀ Prev
              </button>
              <button className="btn btn-outline btn-small text-[0.72rem]" onClick={jumpToToday}>
                Today
              </button>
              <button className="btn btn-outline btn-small text-[0.72rem]" onClick={() => navigateMonth(1)}>
                Next ▶
              </button>
              <button className="btn btn-outline btn-small text-[0.72rem]" onClick={handleExportICS} title="Export .ICS">
                📥 Export .ICS
              </button>
            </div>
          </div>

          <div className="text-[0.72rem] sm:text-[0.78rem] text-[#94a3b8] flex gap-2.5 sm:gap-4 flex-wrap">
            <span>🟢 Open</span>
            <span>🏆 Booked</span>
            <span>⛔ Blocked</span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 -mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="text-center text-[0.62rem] sm:text-[0.72rem] font-bold text-[#94a3b8] uppercase py-1 tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Prev month cells */}
            {prevMonthCells.map((dayNum, i) => (
              <div
                key={'prev_' + i}
                className="min-h-[62px] sm:min-h-[94px] bg-[#090e18] border border-[#263554] rounded-lg p-1 sm:p-2 flex flex-col justify-between opacity-30 cursor-not-allowed"
              >
                <span className="text-[0.72rem] sm:text-[0.85rem] font-bold text-[#cbd5e1]">{dayNum}</span>
              </div>
            ))}

            {/* Current month day cells */}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const thisDateObj = new Date(calYear, calMonth, day);
              const dateStr = formatDateKey(thisDateObj);
              const slots = getSlotsForDate(dateStr, schedule);

              const isToday = dateStr === '2026-11-14';
              const isSelected = dateStr === selectedDate;

              const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
              const bookedSlots = slots.filter((s) => s.status === 'BOOKED');
              const blockedCount = slots.filter((s) => s.status === 'BLOCKED').length;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[62px] sm:min-h-[94px] bg-[#090e18] border rounded-lg p-1 sm:p-2 flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#10b981] bg-[rgba(16,185,129,0.08)] shadow-[0_0_0_1px_#10b981]'
                      : 'border-[#263554] hover:border-[#3b5079] hover:bg-[#0f172a]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-[0.75rem] sm:text-[0.85rem] font-bold ${
                        isToday
                          ? 'bg-[#3b82f6] text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 inline-flex items-center justify-center text-[0.65rem] sm:text-[0.75rem]'
                          : 'text-[#cbd5e1]'
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="hidden sm:inline bg-[#3b82f6] text-white text-[0.6rem] px-1 py-0.2 rounded font-bold">
                        TODAY
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                    {bookedSlots.map((bs) => (
                      <span
                        key={bs.id}
                        className="text-[0.6rem] sm:text-[0.68rem] font-bold px-1 py-0.2 sm:py-0.5 rounded flex items-center gap-0.5 sm:gap-1 bg-[rgba(234,179,8,0.2)] text-[#facc15] border border-[rgba(234,179,8,0.4)] truncate"
                      >
                        <span>🏆</span>
                        <span className="hidden sm:inline truncate">{bs.companyName || 'Call'}</span>
                        <span className="sm:hidden font-bold">1</span>
                      </span>
                    ))}
                    {availableCount > 0 && (
                      <span className="text-[0.6rem] sm:text-[0.68rem] font-bold px-1 py-0.2 sm:py-0.5 rounded flex items-center gap-0.5 sm:gap-1 bg-[rgba(16,185,129,0.15)] text-[#10b981]">
                        <span>🟢</span>
                        <span className="hidden sm:inline">{availableCount} Open</span>
                        <span className="sm:hidden font-bold">{availableCount}</span>
                      </span>
                    )}
                    {blockedCount > 0 && availableCount === 0 && bookedSlots.length === 0 && (
                      <span className="text-[0.6rem] sm:text-[0.68rem] font-bold px-1 py-0.2 sm:py-0.5 rounded flex items-center gap-0.5 sm:gap-1 bg-[rgba(239,68,68,0.15)] text-[#f87171]">
                        <span>⛔</span>
                        <span className="hidden sm:inline">Blocked</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Next month padding */}
            {nextMonthCells.map((dayNum, i) => (
              <div
                key={'next_' + i}
                className="min-h-[62px] sm:min-h-[94px] bg-[#090e18] border border-[#263554] rounded-lg p-1 sm:p-2 flex flex-col justify-between opacity-30 cursor-not-allowed"
              >
                <span className="text-[0.72rem] sm:text-[0.85rem] font-bold text-[#cbd5e1]">{dayNum}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Selected Date Slot Inspector & Manager */}
        <div className="lg:col-span-4 bg-[#151d30] border border-[#263554] rounded-xl p-4 sm:p-5 flex flex-col gap-4 relative lg:sticky lg:top-20">
          <div className="border-b border-[#263554] pb-3 flex flex-col gap-1">
            <div className="text-[0.72rem] text-[#94a3b8] uppercase font-bold tracking-wider">
              Selected Date Schedule
            </div>
            <div className="text-[1.1rem] font-extrabold text-white">
              {formatHumanDate(selectedDate)}
            </div>
            <div className="text-[0.78rem] text-[#38bdf8]">
              <span className="text-[#10b981]">{availCount} Available</span> ·{' '}
              <span className="text-[#facc15]">{bookedCount} Booked</span> ·{' '}
              <span className="text-[#f87171]">{blockedCount} Blocked</span>
            </div>
          </div>

          {/* Quick Day Block/Unblock Actions */}
          <div className="flex gap-2">
            <button
              className="btn btn-outline btn-small flex-1"
              onClick={() => toggleBlockDay(selectedDate, true)}
            >
              🚫 Block All Day
            </button>
            <button
              className="btn btn-outline btn-small flex-1"
              onClick={() => toggleBlockDay(selectedDate, false)}
            >
              ✅ Open All Day
            </button>
          </div>

          {/* Slots List Container */}
          <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
            {activeDateSlots.length === 0 ? (
              <div className="text-[#64748b] text-center py-6 text-xs">
                No time slots configured for this date. Add one below.
              </div>
            ) : (
              activeDateSlots.map((slot) => {
                let statusBadge = <span className="badge badge-high">🟢 AVAILABLE</span>;
                let borderLeft = 'border-l-4 border-l-[#10b981]';

                if (slot.status === 'BLOCKED') {
                  statusBadge = <span className="badge badge-danger">⛔ BLOCKED</span>;
                  borderLeft = 'border-l-4 border-l-[#ef4444] bg-[rgba(239,68,68,0.04)]';
                } else if (slot.status === 'BOOKED') {
                  statusBadge = <span className="badge badge-medium">🏆 BOOKED</span>;
                  borderLeft = 'border-l-4 border-l-[#facc15] bg-[rgba(234,179,8,0.04)]';
                }

                return (
                  <div
                    key={slot.id}
                    className={`bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-2 ${borderLeft}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[0.88rem] font-bold text-white flex items-center gap-1.5">
                        🕒 {slot.time}
                      </span>
                      {statusBadge}
                    </div>

                    {slot.status === 'BOOKED' && (
                      <div className="bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.25)] rounded-md p-2 text-xs text-[#cbd5e1] flex flex-col gap-1">
                        <div className="font-bold text-white flex justify-between">
                          <span>👤 {slot.prospectName || 'Prospect'}</span>
                          <span className="badge badge-medium">{slot.meetingId || '#LW-CAL'}</span>
                        </div>
                        <div>
                          🏢 Company: <strong>{slot.companyName || 'Target'}</strong> ({slot.domain || ''})
                        </div>
                        <div>
                          🔗{' '}
                          <a
                            href={slot.link || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#38bdf8] underline"
                          >
                            Join Google Meet
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 border-t border-white/[0.05]">
                      <div className="flex gap-1.5 flex-wrap">
                        {slot.status === 'AVAILABLE' && (
                          <>
                            <button
                              className="btn btn-outline btn-small"
                              onClick={() => blockSlot(selectedDate, slot.id)}
                            >
                              🚫 Block Slot
                            </button>
                            <button
                              className="btn btn-accent btn-small"
                              onClick={() => {
                                const comp = activeCompany || { company_name: 'Bala', target_person_name: 'Natalie Holloway' };
                                bookSlot(selectedDate, slot.time, comp);
                                showToast(`🏆 Booked ${comp.company_name} for ${selectedDate} at ${slot.time}!`);
                              }}
                            >
                              Book Active Company
                            </button>
                          </>
                        )}

                        {slot.status === 'BLOCKED' && (
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => unblockSlot(selectedDate, slot.id)}
                          >
                            ✅ Unblock (Make Available)
                          </button>
                        )}

                        {slot.status === 'BOOKED' && (
                          <>
                            <button
                              className="btn btn-outline btn-small"
                              onClick={() => {
                                if (confirm('Cancel this booked discovery meeting?')) {
                                  cancelMeeting();
                                }
                              }}
                            >
                              Cancel Call
                            </button>
                            <button
                              className="btn btn-accent btn-small"
                              onClick={() => router.push('/chat')}
                            >
                              💬 View in Inbox
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        className="text-[#64748b] hover:text-[#ef4444] p-1 cursor-pointer text-sm"
                        onClick={() => {
                          if (slot.status === 'BOOKED' && !confirm('Slot is booked. Remove anyway?')) return;
                          deleteSlot(selectedDate, slot.id);
                        }}
                        title="Delete slot permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Custom Slot Form */}
          <div className="bg-[#090e18] border border-[#263554] rounded-lg p-3 flex flex-col gap-2">
            <div className="text-[0.75rem] font-bold text-white">+ Add Custom Time Slot</div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. 01:30 PM EST"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="flex-1 bg-[#151d30] border border-[#263554] text-white px-2 py-1.5 rounded-md text-xs outline-none focus:border-[#10b981]"
              />
              <button className="btn btn-accent btn-small" onClick={handleAddSlot}>
                Add
              </button>
            </div>
            <div className="text-[0.7rem] text-[#64748b]">
              Common: 09:30 AM EST, 01:00 PM EST, 03:30 PM EST, 05:00 PM EST
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
