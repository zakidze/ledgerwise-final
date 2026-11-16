"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lead,
  SavedCompany,
  EmailDraft,
  ThreadMessage,
  AuditEvent,
  CalendarSchedule,
  ActiveMeeting,
} from "./types";
import {
  STORAGE_SYNC_EVENT,
  getStoredLeads,
  saveStoredLeads,
  getStoredSavedCompanies,
  saveStoredSavedCompanies,
  getStoredActiveCompanyName,
  saveStoredActiveCompanyName,
  getActiveSavedCompany,
  getStoredDrafts,
  saveStoredDrafts,
  getThreadForCompany,
  saveThreadForCompany,
  getStoredAutopilot,
  saveStoredAutopilot,
  getStoredAuditLog,
  addAuditLog,
  clearStoredAuditLog,
  getStoredActiveMeeting,
  saveStoredCalendarSchedule,
} from "./storage";
import {
  getOrInitCalendarSchedule,
  bookRealCalendarSlot,
  rescheduleRealCalendarMeeting,
  cancelRealCalendarMeeting,
  getSlotsForDate,
} from "./calendar";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);

  const refresh = useCallback(() => {
    setLeads(getStoredLeads());
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const addLeads = useCallback((newLeads: Lead[]) => {
    const current = getStoredLeads();
    const cleanNames = new Set(
      current.map((l) => l.company_name.toLowerCase().trim()),
    );
    const toAdd = newLeads.filter(
      (l) => !cleanNames.has(l.company_name.toLowerCase().trim()),
    );
    const updated = [...toAdd, ...current];
    saveStoredLeads(updated);
    setLeads(updated);
    return toAdd.length;
  }, []);

  const removeLead = useCallback((companyName: string) => {
    const current = getStoredLeads();
    const updated = current.filter(
      (l) =>
        l.company_name.toLowerCase().trim() !==
        companyName.toLowerCase().trim(),
    );
    saveStoredLeads(updated);
    setLeads(updated);
  }, []);

  const clearLeads = useCallback(() => {
    saveStoredLeads([]);
    setLeads([]);
  }, []);

  return { leads, addLeads, removeLead, clearLeads, refresh };
}

export function useSavedCompanies() {
  const [savedCompanies, setSavedCompanies] = useState<SavedCompany[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<SavedCompany | null>(
    null,
  );

  const refresh = useCallback(() => {
    const list = getStoredSavedCompanies();
    setSavedCompanies(list);
    const active = getActiveSavedCompany();
    setActiveCompanyState(active);
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const setActiveCompany = useCallback((company: SavedCompany) => {
    saveStoredActiveCompanyName(company.company_name);
    setActiveCompanyState(company);
  }, []);

  const addCompany = useCallback(
    (company: SavedCompany) => {
      const list = getStoredSavedCompanies();
      const exists = list.some(
        (c) =>
          c.company_name.toLowerCase().trim() ===
          company.company_name.toLowerCase().trim(),
      );
      if (exists) return false;
      const updated = [company, ...list];
      saveStoredSavedCompanies(updated);
      setSavedCompanies(updated);
      setActiveCompany(company);
      return true;
    },
    [setActiveCompany],
  );

  const updateCompanyStatus = useCallback(
    (companyName: string, status: SavedCompany["status"]) => {
      const list = getStoredSavedCompanies();
      const c = list.find(
        (item) =>
          item.company_name.toLowerCase().trim() ===
          companyName.toLowerCase().trim(),
      );
      if (c) {
        c.status = status;
        saveStoredSavedCompanies(list);
        setSavedCompanies([...list]);
        addAuditLog(
          "STATUS_CHANGE",
          `Company ${companyName} moved to ${status}`,
        );
      }
    },
    [],
  );

  const removeCompany = useCallback(
    (companyName: string) => {
      const list = getStoredSavedCompanies();
      const updated = list.filter(
        (c) =>
          c.company_name.toLowerCase().trim() !==
          companyName.toLowerCase().trim(),
      );
      saveStoredSavedCompanies(updated);
      setSavedCompanies(updated);
      if (
        activeCompany &&
        activeCompany.company_name.toLowerCase().trim() ===
          companyName.toLowerCase().trim()
      ) {
        if (updated.length > 0) {
          setActiveCompany(updated[0]);
        }
      }
    },
    [activeCompany, setActiveCompany],
  );

  return {
    savedCompanies,
    activeCompany,
    setActiveCompany,
    addCompany,
    updateCompanyStatus,
    removeCompany,
    refresh,
  };
}

export function useCalendar() {
  const [schedule, setSchedule] = useState<CalendarSchedule>({});
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeeting | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-17");

  const refresh = useCallback(() => {
    setSchedule(getOrInitCalendarSchedule());
    setActiveMeeting(getStoredActiveMeeting());
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const bookSlot = useCallback(
    (dateStr: string, slotTime: string, company: Partial<SavedCompany>) => {
      const success = bookRealCalendarSlot(dateStr, slotTime, company);
      refresh();
      return success;
    },
    [refresh],
  );

  const rescheduleSlot = useCallback(
    (dateStr: string, slotTime: string, company?: Partial<SavedCompany>) => {
      const success = rescheduleRealCalendarMeeting(dateStr, slotTime, company);
      refresh();
      return success;
    },
    [refresh],
  );

  const cancelMeeting = useCallback(() => {
    const success = cancelRealCalendarMeeting();
    refresh();
    return success;
  }, [refresh]);

  const blockSlot = useCallback(
    (dateStr: string, slotId: string) => {
      const sched = getOrInitCalendarSchedule();
      const slots = getSlotsForDate(dateStr, sched);
      const slot = slots.find((s) => s.id === slotId);
      if (slot && slot.status !== "BOOKED") {
        slot.status = "BLOCKED";
        sched[dateStr] = slots;
        saveStoredCalendarSchedule(sched);
        addAuditLog("CALENDAR_BLOCKED", `Blocked ${slot.time} on ${dateStr}.`);
        refresh();
      }
    },
    [refresh],
  );

  const unblockSlot = useCallback(
    (dateStr: string, slotId: string) => {
      const sched = getOrInitCalendarSchedule();
      const slots = getSlotsForDate(dateStr, sched);
      const slot = slots.find((s) => s.id === slotId);
      if (slot) {
        slot.status = "AVAILABLE";
        sched[dateStr] = slots;
        saveStoredCalendarSchedule(sched);
        addAuditLog(
          "CALENDAR_UNBLOCKED",
          `Unblocked ${slot.time} on ${dateStr}.`,
        );
        refresh();
      }
    },
    [refresh],
  );

  const toggleBlockDay = useCallback(
    (dateStr: string, shouldBlock: boolean) => {
      const sched = getOrInitCalendarSchedule();
      const slots = getSlotsForDate(dateStr, sched);
      slots.forEach((s) => {
        if (s.status !== "BOOKED") {
          s.status = shouldBlock ? "BLOCKED" : "AVAILABLE";
        }
      });
      sched[dateStr] = slots;
      saveStoredCalendarSchedule(sched);
      addAuditLog(
        "CALENDAR_DAY_TOGGLE",
        `${shouldBlock ? "Blocked" : "Opened"} all slots on ${dateStr}.`,
      );
      refresh();
    },
    [refresh],
  );

  const addCustomSlot = useCallback(
    (dateStr: string, time: string) => {
      const sched = getOrInitCalendarSchedule();
      const slots = getSlotsForDate(dateStr, sched);
      const formatted = time.includes("EST") ? time : `${time} EST`;
      slots.push({
        id: `slot_${dateStr}_${Date.now()}`,
        time: formatted,
        status: "AVAILABLE",
      });
      sched[dateStr] = slots;
      saveStoredCalendarSchedule(sched);
      refresh();
    },
    [refresh],
  );

  const deleteSlot = useCallback(
    (dateStr: string, slotId: string) => {
      const sched = getOrInitCalendarSchedule();
      const slots = getSlotsForDate(dateStr, sched);
      sched[dateStr] = slots.filter((s) => s.id !== slotId);
      saveStoredCalendarSchedule(sched);
      refresh();
    },
    [refresh],
  );

  return {
    schedule,
    activeMeeting,
    selectedDate,
    setSelectedDate,
    bookSlot,
    rescheduleSlot,
    cancelMeeting,
    blockSlot,
    unblockSlot,
    toggleBlockDay,
    addCustomSlot,
    deleteSlot,
    refresh,
  };
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  const refresh = useCallback(() => {
    setDrafts(getStoredDrafts());
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const addDraft = useCallback(
    (companyName: string, subject: string, body: string) => {
      const current = getStoredDrafts();
      const draft: EmailDraft = {
        id: "draft_" + Date.now(),
        companyName,
        subject,
        body,
        date: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const updated = [draft, ...current].slice(0, 20);
      saveStoredDrafts(updated);
      setDrafts(updated);
    },
    [],
  );

  const clearDrafts = useCallback(() => {
    saveStoredDrafts([]);
    setDrafts([]);
  }, []);

  return { drafts, addDraft, clearDrafts, refresh };
}

export function useChatThread(
  companyName?: string,
  domain?: string,
  targetName?: string,
) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [autopilot, setAutopilotState] = useState<boolean>(true);

  const activeName = companyName || getStoredActiveCompanyName() || "Bala";

  const refresh = useCallback(() => {
    setMessages(getThreadForCompany(activeName, domain, targetName));
    setAutopilotState(getStoredAutopilot());
  }, [activeName, domain, targetName]);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const addMessage = useCallback(
    (msg: Omit<ThreadMessage, "id" | "time">) => {
      const current = getThreadForCompany(activeName, domain, targetName);
      const newMsg: ThreadMessage = {
        ...msg,
        id: "msg_" + Date.now(),
        time: "Just now",
      };
      const updated = [...current, newMsg];
      saveThreadForCompany(activeName, updated);
      setMessages(updated);
      return newMsg;
    },
    [activeName, domain, targetName],
  );

  const resetThread = useCallback(() => {
    saveThreadForCompany(activeName, []);
    setMessages([]);
  }, [activeName]);

  const setAutopilot = useCallback((enabled: boolean) => {
    saveStoredAutopilot(enabled);
    setAutopilotState(enabled);
    addAuditLog(
      "AUTOPILOT",
      enabled ? "AI Autopilot enabled." : "AI Autopilot paused.",
    );
  }, []);

  return {
    messages,
    addMessage,
    resetThread,
    autopilot,
    setAutopilot,
    refresh,
  };
}

export function useAuditLog() {
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  const refresh = useCallback(() => {
    setAuditLog(getStoredAuditLog());
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = () => refresh();
    window.addEventListener(STORAGE_SYNC_EVENT, handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refresh]);

  const logAction = useCallback(
    (type: string, text: string) => {
      addAuditLog(type, text);
      refresh();
    },
    [refresh],
  );

  const clearLog = useCallback(() => {
    clearStoredAuditLog();
    setAuditLog([]);
  }, []);

  return { auditLog, logAction, clearLog, refresh };
}
