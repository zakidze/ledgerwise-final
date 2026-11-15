import { STANDARD_WORKING_HOURS } from './constants';
import { CalendarSchedule, CalendarSlot, ActiveMeeting, CalendarSearchResult, SavedCompany } from './types';
import {
  getStoredCalendarSchedule,
  saveStoredCalendarSchedule,
  getStoredActiveMeeting,
  saveStoredActiveMeeting,
  addAuditLog,
  getStoredSavedCompanies,
  saveStoredSavedCompanies,
} from './storage';

export function formatDateKey(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatHumanDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatHumanDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function generateInitialSchedule(): CalendarSchedule {
  const schedule: CalendarSchedule = {};

  // Pre-generate slots for November and December 2026
  for (let m = 10; m <= 11; m++) {
    const daysInMonth = new Date(2026, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(2026, m, d);
      const dateStr = formatDateKey(dateObj);
      const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        schedule[dateStr] = [
          { id: `slot_${dateStr}_weekend`, time: 'Weekend Off', status: 'BLOCKED' },
        ];
      } else {
        schedule[dateStr] = STANDARD_WORKING_HOURS.map((timeStr, idx) => {
          // Pre-seed Tuesday, Nov 17, 2026 at 09:00 AM EST as BLOCKED/CLOSED (for instant chat-calendar sync testing)
          if (dateStr === '2026-11-17' && timeStr === '09:00 AM EST') {
            return {
              id: `slot_${dateStr}_${idx}`,
              time: timeStr,
              status: 'BLOCKED',
            };
          }

          // Pre-seed Bala meeting on Tuesday, Nov 17, 2026 at 2:00 PM EST
          if (dateStr === '2026-11-17' && timeStr === '02:00 PM EST') {
            return {
              id: `slot_${dateStr}_${idx}`,
              time: timeStr,
              status: 'BOOKED',
              meetingId: 'LW-CAL-101',
              companyName: 'Bala',
              domain: 'shopbala.com',
              prospectName: 'Natalie Holloway',
              prospectTitle: 'Co-Founder / COO',
              link: 'https://meet.google.com/lw-scope-call',
              bookedAt: '2026-11-14T02:00:00Z',
            };
          }

          return {
            id: `slot_${dateStr}_${idx}`,
            time: timeStr,
            status: 'AVAILABLE',
          };
        });
      }
    }
  }

  return schedule;
}

export function getOrInitCalendarSchedule(): CalendarSchedule {
  const stored = getStoredCalendarSchedule();
  if (stored && Object.keys(stored).length > 0) {
    return stored;
  }
  const initial = generateInitialSchedule();
  saveStoredCalendarSchedule(initial);
  return initial;
}

export function getSlotsForDate(dateStr: string, currentSchedule?: CalendarSchedule): CalendarSlot[] {
  const schedule = currentSchedule || getOrInitCalendarSchedule();
  if (!schedule[dateStr]) {
    const parts = dateStr.split('-');
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      schedule[dateStr] = [{ id: `slot_${dateStr}_weekend`, time: 'Weekend Off', status: 'BLOCKED' }];
    } else {
      schedule[dateStr] = STANDARD_WORKING_HOURS.map((t, idx) => ({
        id: `slot_${dateStr}_${idx}`,
        time: t,
        status: 'AVAILABLE',
      }));
    }
    saveStoredCalendarSchedule(schedule);
  }
  return schedule[dateStr];
}

export function getRealAvailableCalendarSlots(limit = 4, selectedDateStr = '2026-11-17'): Array<{ dateStr: string; slotTime: string; formatted: string }> {
  const availableList: Array<{ dateStr: string; slotTime: string; formatted: string }> = [];
  const seenSlotKeys = new Set<string>();
  const todayStr = '2026-11-14';

  const schedule = getOrInitCalendarSchedule();

  // 1. Look at selected date
  if (selectedDateStr && selectedDateStr > todayStr) {
    const activeDaySlots = getSlotsForDate(selectedDateStr, schedule);
    for (const slot of activeDaySlots) {
      if (slot.status === 'AVAILABLE') {
        const humanDate = formatHumanDay(selectedDateStr);
        const key = `${selectedDateStr}_${slot.time}`;
        seenSlotKeys.add(key);
        availableList.push({
          dateStr: selectedDateStr,
          slotTime: slot.time,
          formatted: `${humanDate} at ${slot.time}`,
        });
        if (availableList.length >= limit) return availableList;
      }
    }
  }

  // 2. Look across upcoming 30 days
  for (let i = 1; i <= 30; i++) {
    const nextDate = new Date(2026, 10, 14 + i);
    const dateStr = formatDateKey(nextDate);
    if (dateStr === selectedDateStr) continue;
    const daySlots = getSlotsForDate(dateStr, schedule);

    for (const slot of daySlots) {
      if (slot.status === 'AVAILABLE') {
        const key = `${dateStr}_${slot.time}`;
        if (!seenSlotKeys.has(key)) {
          seenSlotKeys.add(key);
          const humanDate = formatHumanDay(dateStr);
          availableList.push({
            dateStr,
            slotTime: slot.time,
            formatted: `${humanDate} at ${slot.time}`,
          });
          if (availableList.length >= limit) return availableList;
        }
      }
    }
  }

  return availableList;
}

export function getAllAvailableCalendarSlots(sched?: CalendarSchedule, selectedDateStr = '2026-11-17'): Array<{ dateStr: string; time: string; formatted: string }> {
  const allAvailable: Array<{ dateStr: string; time: string; formatted: string }> = [];
  const seenSlotKeys = new Set<string>();
  const s = sched || getOrInitCalendarSchedule();
  const todayStr = '2026-11-14';

  if (selectedDateStr && selectedDateStr > todayStr && s[selectedDateStr]) {
    const activeDaySlots = s[selectedDateStr] || [];
    for (const slot of activeDaySlots) {
      if (slot.status === 'AVAILABLE') {
        const key = `${selectedDateStr}_${slot.time}`;
        seenSlotKeys.add(key);
        allAvailable.push({
          dateStr: selectedDateStr,
          time: slot.time,
          formatted: `${formatHumanDay(selectedDateStr)} at ${slot.time}`,
        });
      }
    }
  }

  const sortedDates = Object.keys(s).sort();
  for (const dKey of sortedDates) {
    if (dKey <= todayStr) continue;
    const slots = s[dKey] || [];
    for (const slot of slots) {
      if (slot.status === 'AVAILABLE') {
        const key = `${dKey}_${slot.time}`;
        if (!seenSlotKeys.has(key)) {
          seenSlotKeys.add(key);
          allAvailable.push({
            dateStr: dKey,
            time: slot.time,
            formatted: `${formatHumanDay(dKey)} at ${slot.time}`,
          });
        }
      }
    }
  }
  return allAvailable;
}

export function getActiveCalendarMeetingProposalText(selectedDateStr = '2026-11-17'): string {
  const avail = getRealAvailableCalendarSlots(4, selectedDateStr);
  if (!avail || avail.length === 0) {
    return 'once our upcoming calendar opens up';
  }
  const days: string[] = [];
  for (const s of avail) {
    const dName = s.formatted.split(',')[0].trim();
    if (!days.includes(dName)) {
      days.push(dName);
    }
    if (days.length >= 2) break;
  }
  if (days.length >= 2) {
    return `next ${days[0]} or ${days[1]}`;
  } else if (days.length === 1) {
    return `next ${days[0]}`;
  }
  return 'next week';
}

export function parseQueryDate(lowerText: string): { dateStr: string; dayLabel: string } | null {
  const dayMap: Record<string, string> = {
    sunday: '2026-11-15', sun: '2026-11-15',
    monday: '2026-11-16', mon: '2026-11-16',
    tuesday: '2026-11-17', tue: '2026-11-17', tues: '2026-11-17',
    wednesday: '2026-11-18', wed: '2026-11-18',
    thursday: '2026-11-19', thu: '2026-11-19', thur: '2026-11-19', thurs: '2026-11-19',
    friday: '2026-11-20', fri: '2026-11-20',
    saturday: '2026-11-21', sat: '2026-11-21',
  };

  for (const dayName in dayMap) {
    const reg = new RegExp('\\b' + dayName + '\\b', 'i');
    if (reg.test(lowerText)) {
      const dateStr = dayMap[dayName];
      return { dateStr, dayLabel: formatHumanDay(dateStr) };
    }
  }

  const m = lowerText.match(/\b(?:nov|november)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i) || lowerText.match(/\b11[\/\-](\d{1,2})\b/);
  if (m) {
    const dayNum = parseInt(m[1], 10);
    const dateStr = `2026-11-${String(dayNum).padStart(2, '0')}`;
    return { dateStr, dayLabel: formatHumanDay(dateStr) };
  }

  if (lowerText.includes('tomorrow')) {
    return { dateStr: '2026-11-15', dayLabel: 'Sunday, Nov 15' };
  }
  if (lowerText.includes('today')) {
    return { dateStr: '2026-11-14', dayLabel: 'Saturday, Nov 14' };
  }

  return null;
}

export function parseQueryTime(lowerText: string): string | null {
  if (/\b(?:9:00|9am|9\s*am)\b/i.test(lowerText)) return '09:00 AM EST';
  if (/\b(?:11:00|11am|11\s*am)\b/i.test(lowerText)) return '11:00 AM EST';
  if (/\b(?:2:00|2pm|2\s*pm|14:00)\b/i.test(lowerText)) return '02:00 PM EST';
  if (/\b(?:4:00|4pm|4\s*pm|16:00)\b/i.test(lowerText)) return '04:00 PM EST';
  if (/\b(?:1:00|1pm|1\s*pm)\b/i.test(lowerText)) return '01:00 PM EST';
  if (/\b(?:1:30|1:30pm)\b/i.test(lowerText)) return '01:30 PM EST';
  if (/\b(?:3:00|3pm|3\s*pm)\b/i.test(lowerText)) return '03:00 PM EST';
  if (/\b(?:3:30|3:30pm)\b/i.test(lowerText)) return '03:30 PM EST';
  if (/\b(?:5:00|5pm|5\s*pm)\b/i.test(lowerText)) return '05:00 PM EST';
  return null;
}

export function searchCalendarAppointments(queryText: string, sched?: CalendarSchedule, selectedDateStr = '2026-11-17'): CalendarSearchResult {
  const lower = queryText.toLowerCase();
  const currentSched = sched || getOrInitCalendarSchedule();
  const allAvailable = getAllAvailableCalendarSlots(currentSched, selectedDateStr);
  const parsedDate = parseQueryDate(lower);
  const parsedTime = parseQueryTime(lower);

  // Scenario 1: Specific Date AND Specific Time requested
  if (parsedDate && parsedTime) {
    const daySlots = currentSched[parsedDate.dateStr] || [];
    const timeCore = parsedTime.slice(0, 5);
    const slot = daySlots.find((s) => s.time.includes(timeCore) || s.time.toLowerCase().replace(/\s/g, '').includes(parsedTime.toLowerCase().replace(/\s/g, '')));

    if (slot) {
      if (slot.status === 'BLOCKED') {
        const altText = allAvailable.slice(0, 2).map((s) => s.formatted).join(' or ');
        return {
          intent: 'SLOT_CLOSED',
          should_book_call: false,
          targetDayLabel: parsedDate.dayLabel,
          targetTime: parsedTime,
          alternativeSlots: altText,
          rule_applied_note: `Calendar Sync: Detected CLOSED/BLOCKED slot on ${parsedDate.dayLabel} at ${parsedTime}. Offered live alternatives.`,
          message: `I checked our live calendar, but ${parsedDate.dayLabel} at ${parsedTime} is currently closed/blocked. ${altText ? `Our nearest open appointments are ${altText}. Would either of those work for you?` : `All our upcoming appointments are currently closed or blocked.`}`,
        };
      }

      if (slot.status === 'BOOKED') {
        const altText = allAvailable.slice(0, 2).map((s) => s.formatted).join(' or ');
        return {
          intent: 'SLOT_BOOKED',
          should_book_call: false,
          targetDayLabel: parsedDate.dayLabel,
          targetTime: parsedTime,
          alternativeSlots: altText,
          rule_applied_note: `Calendar Sync: Detected ALREADY BOOKED slot on ${parsedDate.dayLabel} at ${parsedTime}. Offered live alternatives.`,
          message: `That appointment slot on ${parsedDate.dayLabel} at ${parsedTime} is already booked on our calendar. ${altText ? `However, we have open appointments on ${altText}. Would one of those work instead?` : `All our upcoming appointments are currently closed or blocked.`}`,
        };
      }

      if (slot.status === 'AVAILABLE') {
        return {
          intent: 'BOOK_MEETING',
          should_book_call: true,
          targetDate: parsedDate.dateStr,
          targetSlotTime: slot.time,
          formattedSlot: `${parsedDate.dayLabel} at ${slot.time}`,
          rule_applied_note: `Calendar Sync: Confirmed and booked OPEN slot on ${parsedDate.dayLabel} at ${slot.time}.`,
          message: `Yes! ${parsedDate.dayLabel} at ${slot.time} is open on our calendar. I have locked this in for our 15-minute discovery call and sent over a calendar invite with Google Meet link. Looking forward to speaking then!`,
        };
      }
    } else {
      const openOnDay = daySlots.filter((s) => s.status === 'AVAILABLE').map((s) => s.time);
      const altText = allAvailable.slice(0, 2).map((s) => s.formatted).join(' or ');
      const altMsg = openOnDay.length > 0
        ? `We don't have ${parsedTime} scheduled on ${parsedDate.dayLabel}, but we do have ${openOnDay.join(' and ')} open.`
        : `We don't have ${parsedTime} open on ${parsedDate.dayLabel}. ${altText ? `Our nearest openings are ${altText}.` : `All nearest dates are currently closed or blocked.`}`;
      return {
        intent: 'SLOT_NOT_FOUND',
        should_book_call: false,
        rule_applied_note: `Calendar Sync: Slot ${parsedTime} not found on ${parsedDate.dayLabel}. Offered alternatives.`,
        message: `${altMsg} ${altText ? 'Would one of those work for you?' : ''}`,
      };
    }
  }

  // Scenario 2: Specific Date requested
  if (parsedDate && !parsedTime) {
    const daySlots = currentSched[parsedDate.dateStr] || [];
    const openDaySlots = daySlots.filter((s) => s.status === 'AVAILABLE');

    if (openDaySlots.length > 0) {
      const timesList = openDaySlots.map((s) => s.time).join(', ');
      return {
        intent: 'DAY_SLOTS_OPEN',
        should_book_call: false,
        rule_applied_note: `Calendar Sync: Returned ${openDaySlots.length} open slots for ${parsedDate.dayLabel}.`,
        message: `I checked our calendar for ${parsedDate.dayLabel}. We currently have open appointment slots at: ${timesList}. Which of those works best for your schedule?`,
      };
    } else {
      const altText = allAvailable.slice(0, 2).map((s) => s.formatted).join(' or ');
      return {
        intent: 'DAY_FULLY_CLOSED',
        should_book_call: false,
        rule_applied_note: `Calendar Sync: Detected FULLY CLOSED/BLOCKED day for ${parsedDate.dayLabel}. Offered live alternatives.`,
        message: `I checked our calendar for ${parsedDate.dayLabel}, but our team is fully booked/closed for that entire day. ${altText ? `However, we have open appointments on ${altText}. Would either of those work?` : `All nearest dates are currently closed or blocked.`}`,
      };
    }
  }

  // Scenario 3: Specific Time requested
  if (!parsedDate && parsedTime) {
    const matches = allAvailable.filter((s) => s.time.includes(parsedTime.slice(0, 5)));
    if (matches.length > 0) {
      return {
        intent: 'TIME_SLOTS_OPEN',
        should_book_call: false,
        rule_applied_note: `Calendar Sync: Found ${matches.length} dates with open ${parsedTime} slots.`,
        message: `We have ${parsedTime} open on ${matches.slice(0, 2).map((s) => s.formatted).join(' and ')}. Would either of those dates work for you?`,
      };
    } else {
      const altText = allAvailable.slice(0, 2).map((s) => s.formatted).join(' or ');
      return {
        intent: 'TIME_UNAVAILABLE',
        should_book_call: false,
        rule_applied_note: `Calendar Sync: ${parsedTime} unavailable across nearest dates. Offered alternatives.`,
        message: `${parsedTime} is currently unavailable on our nearest calendar schedule. ${altText ? `Our open slots are ${altText}. Would one of those work instead?` : `All upcoming slots are currently closed or blocked.`}`,
      };
    }
  }

  // Scenario 4: General appointment search
  const altText = allAvailable.slice(0, 3).map((s) => s.formatted).join(', ');
  return {
    intent: 'GENERAL_OPEN_SLOTS',
    should_book_call: false,
    rule_applied_note: `Calendar Sync: Provided next ${Math.min(3, allAvailable.length)} verified open calendar slots.`,
    message: allAvailable.length > 0
      ? `Here are our next verified open appointment slots directly from our calendar: ${altText}. Would one of those work for a brief 15-minute sync?`
      : `Our calendar is currently fully committed and all upcoming slots are blocked. Would you like me to flag the next available opening once our schedule opens up?`,
  };
}

export function bookRealCalendarSlot(dateStr: string, slotTime: string, companyObj: Partial<SavedCompany>): boolean {
  const schedule = getOrInitCalendarSchedule();
  const slots = getSlotsForDate(dateStr, schedule);
  let targetSlot = slots.find((s) => s.time.toLowerCase().trim() === slotTime.toLowerCase().trim());

  if (targetSlot && targetSlot.status === 'BLOCKED') {
    addAuditLog('CALENDAR_BOOKING_REJECTED', `Attempted booking on BLOCKED slot: ${dateStr} at ${slotTime}. Rejected.`);
    return false;
  }

  if (!targetSlot || targetSlot.status !== 'AVAILABLE') {
    targetSlot = slots.find((s) => s.status === 'AVAILABLE');
  }

  if (!targetSlot) {
    addAuditLog('CALENDAR_BOOKING_REJECTED', `Attempted booking on ${dateStr} but date is fully blocked/booked.`);
    return false;
  }

  targetSlot.status = 'BOOKED';
  targetSlot.meetingId = 'LW-CAL-' + Math.floor(100 + Math.random() * 900);
  targetSlot.companyName = companyObj.company_name || 'Bala';
  targetSlot.domain = companyObj.domain || 'shopbala.com';
  targetSlot.prospectName = companyObj.target_person_name || 'Prospect';
  targetSlot.prospectTitle = companyObj.target_person_title || 'Executive';
  targetSlot.link = 'https://meet.google.com/lw-scope-call';
  targetSlot.bookedAt = new Date().toISOString();

  const meeting: ActiveMeeting = {
    id: targetSlot.meetingId,
    timeSlot: `${formatHumanDate(dateStr)} at ${targetSlot.time}`,
    dateStr,
    slotTime: targetSlot.time,
    prospectName: targetSlot.prospectName,
    companyName: targetSlot.companyName,
    status: 'CONFIRMED',
    createdAt: targetSlot.bookedAt,
    rescheduledCount: 0,
  };

  saveStoredActiveMeeting(meeting);
  saveStoredCalendarSchedule(schedule);

  // Update company status to MEETING_BOOKED
  if (companyObj.company_name) {
    const saved = getStoredSavedCompanies();
    const c = saved.find((item) => item.company_name.toLowerCase().trim() === companyObj.company_name!.toLowerCase().trim());
    if (c) {
      c.status = 'MEETING_BOOKED';
      saveStoredSavedCompanies(saved);
    }
  }

  addAuditLog('CALENDAR_BOOKED', `Confirmed call on real calendar: ${meeting.timeSlot} with ${targetSlot.prospectName} (${targetSlot.companyName}). Meeting #${targetSlot.meetingId}`);
  return true;
}

export function rescheduleRealCalendarMeeting(newDateStr: string, newSlotTime: string, companyObj?: Partial<SavedCompany>): boolean {
  const schedule = getOrInitCalendarSchedule();
  const slots = getSlotsForDate(newDateStr, schedule);
  const targetSlot = slots.find((s) => s.time.toLowerCase().trim() === newSlotTime.toLowerCase().trim() && s.status === 'AVAILABLE');
  if (!targetSlot) {
    addAuditLog('CALENDAR_RESCHEDULE_REJECTED', `Attempted reschedule to ${newDateStr} at ${newSlotTime} but slot is blocked or unavailable.`);
    return false;
  }

  const currentMeeting = getStoredActiveMeeting();

  // 1. Free old slot
  for (const dKey in schedule) {
    const daySlots = schedule[dKey];
    daySlots.forEach((s) => {
      if (s.status === 'BOOKED' && s.meetingId === (currentMeeting ? currentMeeting.id : 'LW-CAL-101')) {
        s.status = 'AVAILABLE';
        delete s.meetingId;
        delete s.companyName;
        delete s.prospectName;
      }
    });
  }

  // 2. Book new slot
  const comp = companyObj || { company_name: currentMeeting?.companyName || 'Bala', target_person_name: currentMeeting?.prospectName || 'Natalie Holloway' };
  const success = bookRealCalendarSlot(newDateStr, newSlotTime, comp);
  if (!success) return false;

  const updatedMeeting = getStoredActiveMeeting();
  if (updatedMeeting) {
    updatedMeeting.status = 'RESCHEDULED';
    updatedMeeting.rescheduledCount = (currentMeeting?.rescheduledCount || 0) + 1;
    saveStoredActiveMeeting(updatedMeeting);
  }

  addAuditLog('CALENDAR_RESCHEDULED', `Rescheduled existing call to ${formatHumanDate(newDateStr)} at ${newSlotTime}.`);
  return true;
}

export function cancelRealCalendarMeeting(): boolean {
  const activeMeeting = getStoredActiveMeeting();
  if (!activeMeeting) return false;

  const schedule = getOrInitCalendarSchedule();
  const slots = schedule[activeMeeting.dateStr] || [];
  const slot = slots.find((s) => s.time === activeMeeting.slotTime || s.meetingId === activeMeeting.id);
  if (slot) {
    slot.status = 'AVAILABLE';
    delete slot.meetingId;
    delete slot.companyName;
    delete slot.prospectName;
    delete slot.domain;
  }

  saveStoredActiveMeeting(null);
  saveStoredCalendarSchedule(schedule);

  // Update company status if it was MEETING_BOOKED
  const saved = getStoredSavedCompanies();
  const c = saved.find((item) => item.company_name.toLowerCase().trim() === activeMeeting.companyName.toLowerCase().trim());
  if (c && c.status === 'MEETING_BOOKED') {
    c.status = 'CHATTING';
    saveStoredSavedCompanies(saved);
  }

  addAuditLog('CALENDAR_CANCELLED', `Cancelled discovery meeting #${activeMeeting.id} with ${activeMeeting.prospectName} (${activeMeeting.companyName}). Freed slot: ${activeMeeting.timeSlot}`);
  return true;
}

export function exportCalendarICS(): string | null {
  const schedule = getOrInitCalendarSchedule();
  const icsEvents: string[] = [];

  for (const dKey in schedule) {
    const slots = schedule[dKey];
    slots.forEach((s) => {
      if (s.status === 'BOOKED') {
        const dateClean = dKey.replace(/-/g, '');
        icsEvents.push([
          'BEGIN:VEVENT',
          `UID:${s.meetingId || Date.now()}@ledgerwise.com`,
          `DTSTAMP:${dateClean}T140000Z`,
          `DTSTART:${dateClean}T140000Z`,
          `DTEND:${dateClean}T143000Z`,
          `SUMMARY:Ledgerwise Discovery Call with ${s.prospectName || 'Prospect'} (${s.companyName || 'Company'})`,
          `DESCRIPTION:Monthly bookkeeping discovery call & retail EDI reconciliation scope. Link: ${s.link || 'https://meet.google.com/lw-scope-call'}`,
          `LOCATION:${s.link || 'Google Meet'}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n'));
      }
    });
  }

  if (icsEvents.length === 0) return null;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ledgerwise//B2B Outbound Suite//EN',
    'CALSCALE:GREGORIAN',
    ...icsEvents,
    'END:VCALENDAR',
  ].join('\r\n');
}
