export type IcpScore = 'High' | 'Medium-High' | 'Medium';

export type PipelineStatus = 'SAVED' | 'DRAFTED' | 'SENT' | 'CHATTING' | 'MEETING_BOOKED';

export interface Lead {
  company_name: string;
  domain: string;
  website_url: string;
  us_state: string;
  founded_year: string | number;
  est_revenue_and_size: string;
  target_person_name: string;
  target_person_title: string;
  trigger_reason: string;
  verified_source_link: string;
  verified_quote: string;
  icp_score: IcpScore;
  score_justification: string;
}

export interface SavedCompany extends Lead {
  id: string;
  status: PipelineStatus;
  saved_at: string;
  channels?: string[];
  notes?: string;
}

export interface EmailDraft {
  id: string;
  companyName: string;
  subject: string;
  body: string;
  date: string;
}

export interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  senderName: string;
  subject: string;
  body: string;
  time: string;
}

export interface AuditEvent {
  time: string;
  type: string;
  text: string;
}

export interface CalendarSlot {
  id: string;
  time: string;
  status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED';
  meetingId?: string;
  companyName?: string;
  domain?: string;
  prospectName?: string;
  prospectTitle?: string;
  link?: string;
  bookedAt?: string;
}

export type CalendarSchedule = Record<string, CalendarSlot[]>;

export interface ActiveMeeting {
  id: string;
  timeSlot: string;
  dateStr: string;
  slotTime: string;
  prospectName: string;
  companyName: string;
  status: string;
  createdAt: string;
  rescheduledCount?: number;
}

export interface CompanyIntel {
  company_name: string;
  domain: string;
  category?: string;
  founded_year?: number | string;
  headquarters?: {
    city?: string;
    state?: string;
    facilities_description?: string;
  };
  capital_and_funding?: {
    total_raised?: string;
    funding_stage?: string;
    lead_investors?: string[];
    notes?: string;
  };
  retail_stores_and_distribution?: {
    owned_stores_count?: number;
    retail_partners?: string[];
    distribution_channels?: string[];
    summary?: string;
  };
  recent_news_and_press?: Array<{
    headline: string;
    publisher: string;
    date: string;
    summary: string;
    url?: string;
  }>;
  accounting_complexity_analysis?: {
    operational_bottlenecks?: string;
    recommended_pitch_angle?: string;
  };
  executives?: Array<{
    name: string;
    role: string;
  }>;
}

export interface CalendarSearchResult {
  intent: string;
  should_book_call: boolean;
  rule_applied_note: string;
  message: string;
  targetDate?: string;
  targetSlotTime?: string;
  formattedSlot?: string;
  targetDayLabel?: string;
  targetTime?: string;
  alternativeSlots?: string;
}
