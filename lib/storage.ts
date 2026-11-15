import { STORAGE_KEYS, SAMPLE_BALA_COMPANY } from './constants';
import { Lead, SavedCompany, EmailDraft, ThreadMessage, AuditEvent, ActiveMeeting, CalendarSchedule, CompanyIntel, IcpScore } from './types';

// Custom event name for intra-window sync
export const STORAGE_SYNC_EVENT = 'ledgerwise-storage-sync';

export function notifyStorageChange(key: string, value?: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key, value } }));
}

export function normalizeIcpScore(raw: unknown): IcpScore {
  if (raw === null || raw === undefined) return 'Medium';
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    raw = obj.score || obj.rating || obj.val || obj.value || obj.level || 'Medium';
  }
  if (typeof raw === 'number') {
    if (raw >= 80 || (raw <= 10 && raw >= 7.5)) return 'High';
    if (raw >= 60 || (raw <= 10 && raw >= 5.5)) return 'Medium-High';
    return 'Medium';
  }
  const str = String(raw).trim();
  const lower = str.toLowerCase();
  if (lower.includes('medium-high') || lower.includes('med-high') || lower.includes('medium high') || lower.includes('medium_high')) {
    return 'Medium-High';
  }
  if (lower.includes('high')) {
    return 'High';
  }
  if (lower.includes('medium') || lower.includes('med') || lower.includes('low')) {
    return 'Medium';
  }
  const match = lower.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (num >= 80 || (num <= 10 && num >= 7.5)) return 'High';
    if (num >= 60 || (num <= 10 && num >= 5.5)) return 'Medium-High';
    return 'Medium';
  }
  return 'High';
}

export function normalizeLead(raw: unknown, fallbackState = 'US'): Lead | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawName = r.company_name || r.name || r.brand || r.company;
  if (!rawName) return null;
  const companyName = String(rawName).trim();
  if (!companyName) return null;

  let domain = String(r.domain || '').trim().toLowerCase();
  let websiteUrl = String(r.website_url || r.url || r.website || '').trim();

  if (!domain && websiteUrl) {
    domain = websiteUrl.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].toLowerCase();
  }
  if (!domain) {
    domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  }
  if (!websiteUrl) {
    websiteUrl = 'https://' + domain;
  } else if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
    websiteUrl = 'https://' + websiteUrl;
  }

  const usState = String(r.us_state || r.state || r.location || (fallbackState !== 'ANY' ? fallbackState : 'US')).trim();
  const foundedYear = r.founded_year ? String(r.founded_year).trim() : 'N/A';
  const estRevenue = String(r.est_revenue_and_size || r.revenue || r.size || '$1M–$10M ARR / 15-40 staff').trim();
  const personName = String(r.target_person_name || r.founder || r.contact_name || 'Founder / CEO').trim();
  const personTitle = String(r.target_person_title || r.title || r.role || 'Co-Founder & CEO').trim();
  const triggerReason = String(r.trigger_reason || r.trigger || r.growth_trigger || 'Expanding retail and wholesale distribution channels').trim();
  const verifiedSourceLink = String(r.verified_source_link || r.source_url || r.source || websiteUrl).trim();
  const verifiedQuote = String(r.verified_quote || r.quote || r.evidence || '').trim();
  const icpScore = normalizeIcpScore(r.icp_score || r.score || r.fit);
  const scoreJustification = String(r.score_justification || r.justification || r.reason || 'Matches Ledgerwise ICP bookkeeping bottlenecks.').trim();

  return {
    company_name: companyName,
    domain,
    website_url: websiteUrl,
    us_state: usState,
    founded_year: foundedYear,
    est_revenue_and_size: estRevenue,
    target_person_name: personName,
    target_person_title: personTitle,
    trigger_reason: triggerReason,
    verified_source_link: verifiedSourceLink,
    verified_quote: verifiedQuote,
    icp_score: icpScore,
    score_justification: scoreJustification,
  };
}

// Leads
export function getStoredLeads(): Lead[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeLead(item)).filter((x): x is Lead => x !== null);
  } catch {
    return [];
  }
}

export function saveStoredLeads(leads: Lead[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  notifyStorageChange(STORAGE_KEYS.LEADS, leads);
}

// Saved Companies
export function getStoredSavedCompanies(): SavedCompany[] {
  if (typeof window === 'undefined') return [SAMPLE_BALA_COMPANY];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_COMPANIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SAVED_COMPANIES, JSON.stringify([SAMPLE_BALA_COMPANY]));
      return [SAMPLE_BALA_COMPANY];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.SAVED_COMPANIES, JSON.stringify([SAMPLE_BALA_COMPANY]));
      return [SAMPLE_BALA_COMPANY];
    }
    return parsed.map((c) => {
      const normalized = normalizeLead(c);
      if (!normalized) return null;
      return {
        ...normalized,
        id: c.id || 'comp_' + Math.random().toString(36).substring(2, 9),
        status: c.status || 'SAVED',
        saved_at: c.saved_at || new Date().toISOString(),
        channels: c.channels || ['DTC', 'Retail'],
        notes: c.notes || '',
      };
    }).filter((x): x is SavedCompany => x !== null);
  } catch {
    return [SAMPLE_BALA_COMPANY];
  }
}

export function saveStoredSavedCompanies(companies: SavedCompany[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SAVED_COMPANIES, JSON.stringify(companies));
  notifyStorageChange(STORAGE_KEYS.SAVED_COMPANIES, companies);
}

// Active / Selected Company
export function getStoredActiveCompanyName(): string {
  if (typeof window === 'undefined') return SAMPLE_BALA_COMPANY.company_name;
  return localStorage.getItem(STORAGE_KEYS.SELECTED_COMPANY) || SAMPLE_BALA_COMPANY.company_name;
}

export function saveStoredActiveCompanyName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, name);
  notifyStorageChange(STORAGE_KEYS.SELECTED_COMPANY, name);
}

export function getActiveSavedCompany(): SavedCompany {
  const companies = getStoredSavedCompanies();
  const name = getStoredActiveCompanyName();
  const found = companies.find((c) => c.company_name.toLowerCase().trim() === name.toLowerCase().trim());
  return found || companies[0] || SAMPLE_BALA_COMPANY;
}

// Model
export function getStoredModel(): string {
  if (typeof window === 'undefined') return 'qwen/qwen3.7-flash:free';
  return localStorage.getItem(STORAGE_KEYS.MODEL) || 'qwen/qwen3.7-flash:free';
}

export function saveStoredModel(model: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.MODEL, model);
  notifyStorageChange(STORAGE_KEYS.MODEL, model);
}

// Drafts
export function getStoredDrafts(): EmailDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredDrafts(drafts: EmailDraft[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
  notifyStorageChange(STORAGE_KEYS.DRAFTS, drafts);
}

// Threads by company
export function getStoredCompanyThreads(): Record<string, ThreadMessage[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY_THREADS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getThreadForCompany(companyName: string, domain = 'shopbala.com', personName = 'there'): ThreadMessage[] {
  const threads = getStoredCompanyThreads();
  const key = companyName.toLowerCase().trim();
  if (threads[key] && threads[key].length > 0) {
    return threads[key];
  }
  // Initial message
  const initMsg: ThreadMessage = {
    id: 'msg_init_' + key,
    from: 'alex@ledgerwise.com',
    to: `coo@${domain}`,
    senderName: 'Alex at Ledgerwise',
    subject: `${companyName}'s retail expansion & inventory accounting`,
    body: `Hey ${personName},\n\nSaw ${companyName}'s recent retail push into Target and big-box distribution—huge milestone.\n\nExpanding into retail usually creates serious inventory and COGS reconciliation bottlenecks, especially keeping track of wholesale chargebacks alongside Shopify DTC payouts. Ledgerwise handles monthly closes exclusively for high-growth e-commerce brands navigating that exact shift.\n\nOpen to a brief 15-minute chat next week to compare notes on how your finance team is managing the multi-channel close?\n\nBest,\nAlex | Ledgerwise`,
    time: 'Yesterday, 2:15 PM',
  };
  return [initMsg];
}

export function saveThreadForCompany(companyName: string, messages: ThreadMessage[]) {
  if (typeof window === 'undefined') return;
  const threads = getStoredCompanyThreads();
  const key = companyName.toLowerCase().trim();
  threads[key] = messages;
  localStorage.setItem(STORAGE_KEYS.COMPANY_THREADS, JSON.stringify(threads));
  localStorage.setItem(STORAGE_KEYS.THREAD, JSON.stringify(messages));
  notifyStorageChange(STORAGE_KEYS.COMPANY_THREADS, threads);
}

// Company Intel
export function getStoredCompanyIntelStore(): Record<string, CompanyIntel> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY_INTEL);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getIntelForCompany(companyName: string): CompanyIntel | null {
  const store = getStoredCompanyIntelStore();
  const key = companyName.toLowerCase().trim();
  return store[key] || null;
}

export function saveIntelForCompany(companyName: string, intel: CompanyIntel) {
  if (typeof window === 'undefined') return;
  const store = getStoredCompanyIntelStore();
  const key = companyName.toLowerCase().trim();
  store[key] = intel;
  localStorage.setItem(STORAGE_KEYS.COMPANY_INTEL, JSON.stringify(store));
  notifyStorageChange(STORAGE_KEYS.COMPANY_INTEL, store);
}

// Autopilot
export function getStoredAutopilot(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(STORAGE_KEYS.AUTOPILOT);
  return raw !== null ? raw === 'true' : true;
}

export function saveStoredAutopilot(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTOPILOT, String(enabled));
  notifyStorageChange(STORAGE_KEYS.AUTOPILOT, enabled);
}

// Audit Log
export function getStoredAuditLog(): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(type: string, text: string) {
  if (typeof window === 'undefined') return;
  const list = getStoredAuditLog();
  const entry: AuditEvent = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type,
    text,
  };
  list.unshift(entry);
  if (list.length > 50) list.pop();
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(list));
  notifyStorageChange(STORAGE_KEYS.AUDIT, list);
}

export function clearStoredAuditLog() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify([]));
  notifyStorageChange(STORAGE_KEYS.AUDIT, []);
}

// Active Meeting
export function getStoredActiveMeeting(): ActiveMeeting | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDAR);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredActiveMeeting(meeting: ActiveMeeting | null) {
  if (typeof window === 'undefined') return;
  if (!meeting) {
    localStorage.removeItem(STORAGE_KEYS.CALENDAR);
  } else {
    localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(meeting));
  }
  notifyStorageChange(STORAGE_KEYS.CALENDAR, meeting);
}

// Calendar Schedule
export function getStoredCalendarSchedule(): CalendarSchedule | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDAR_SCHEDULE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredCalendarSchedule(schedule: CalendarSchedule) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CALENDAR_SCHEDULE, JSON.stringify(schedule));
  notifyStorageChange(STORAGE_KEYS.CALENDAR_SCHEDULE, schedule);
}
