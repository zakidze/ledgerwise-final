import { SavedCompany } from './types';

export const STORAGE_KEYS = {
  MODEL: 'bazaarlink_selected_model',
  LEADS: 'ledgerwise_saved_leads',
  SAVED_COMPANIES: 'ledgerwise_saved_companies',
  SELECTED_COMPANY: 'ledgerwise_selected_company',
  PAYLOAD: 'ledgerwise_current_prospect_payload',
  PROMPT: 'ledgerwise_custom_prompt',
  DRAFTS: 'ledgerwise_email_drafts',
  COMPANY_INTEL: 'ledgerwise_company_intel_store',
  THREAD: 'ledgerwise_dual_thread',
  COMPANY_THREADS: 'ledgerwise_threads_by_company',
  AUTOPILOT: 'ledgerwise_autopilot_setting',
  AUDIT: 'ledgerwise_audit_log',
  CALENDAR: 'ledgerwise_active_calendar_meeting',
  CALENDAR_SCHEDULE: 'ledgerwise_calendar_schedule',
} as const;

export const DEFAULT_MODEL = 'qwen/qwen3.7-flash:free';

export const NICHES = [
  'Food Industry',
  'Coffee & Tea',
  'Sustainable Apparel & Fashion',
  'Footwear & Sneaker Brands',
  'Clean Beauty, Skincare & Cosmetics',
  'Health, Wellness & Supplements',
  'Pet Care, Nutrition & Accessories',
  'Home Living, Furniture & Decor',
  'Kitchenware & Cookware',
  'Fitness Gear & Activewear',
  'Outdoor & Sporting Goods',
  'Consumer Electronics & Audio',
  'Baby, Kids & Maternity Essentials',
  'Jewelry, Watches & Accessories',
  'Toys, Games & Hobbies',
  'Automotive & Motorcycle Gear',
];

export const STANDARD_WORKING_HOURS = [
  '09:00 AM EST',
  '11:00 AM EST',
  '02:00 PM EST',
  '04:00 PM EST',
];

export const SAMPLE_BALA_COMPANY: SavedCompany = {
  id: 'comp_bala_sample',
  company_name: 'Bala',
  domain: 'shopbala.com',
  website_url: 'https://shopbala.com',
  us_state: 'California (CA)',
  founded_year: 2018,
  est_revenue_and_size: '$5M–$10M ARR / 20 employees',
  target_person_name: 'Natalie Holloway',
  target_person_title: 'Co-Founder / COO',
  trigger_reason: "Expanding retail footprint into major big-box stores (Target/Dick's Sporting Goods).",
  verified_source_link: 'https://shopbala.com/blogs/news',
  verified_quote: 'Find Bala at a Target store near you.',
  icp_score: 'High',
  score_justification: 'Rapid multi-channel expansion creates severe inventory and COGS reconciliation bottlenecks.',
  status: 'SAVED',
  saved_at: '2026-11-14T10:00:00.000Z',
  channels: ['DTC', 'Retail', 'Target', "Dick's Sporting Goods"],
  notes: 'Met retail expansion criteria. Needs inventory and wholesale reconciliation.',
};

export const DEFAULT_PROMPT = `You are an elite B2B outbound copywriter writing on behalf of Ledgerwise, a specialized US monthly bookkeeping firm built exclusively for e-commerce brands ($1M–$10M revenue, 5–50 employees).

Your task is to write a short, high-converting, peer-to-peer cold email to a decision-maker at a qualified e-commerce brand using ONLY the verified research data provided in the user prompt.

### HARD COMPLIANCE RULES (ZERO EXCEPTIONS)
1. NEVER QUOTE A PRICE: Do not mention dollar amounts for Ledgerwise's services, retainers, hourly rates, discounts, or tiers. Pricing is strictly discussed on a call.
2. ZERO HALLUCINATIONS: Every single fact, channel, hiring detail, or milestone mentioned about the prospect's company MUST come directly from the provided \`verified_evidence\` JSON. Do not invent tools they use (e.g., do not guess they use NetSuite or QuickBooks unless stated), do not invent past achievements, and do not extrapolate beyond the quote.
3. NO ROBOTIC SALES-SPEAK: Avoid cliché openers ("I hope this email finds you well", "My name is...", "I came across your profile", "Game-changer", "Synergy"). Write like a sharp financial operator talking to a fellow founder or COO.
4. BREVITY: Keep the email body under 110 words (3–4 short paragraphs max). Busy founders read emails on their phones.

### EMAIL STRUCTURE
- **Subject Line:** 3–5 words, lowercase or sentence case, referencing their specific trigger or channel growth (no clickbait, no punctuation gimmicks).
- **Hook (Line 1):** Reference the exact \`trigger_reason\` / \`quote\` naturally to show you did real homework.
- **Value Bridge (Lines 2–3):** Connect that specific trigger (e.g., retail/wholesale expansion, hiring finance ops, or post-funding scale) to the exact bookkeeping bottleneck it creates (e.g., COGS/inventory reconciliation across channels, wholesale invoicing vs. DTC payouts, clean monthly closes without hiring a full-time controller yet).
- **Low-Friction CTA (Line 4):** Ask a simple, low-pressure question about whether they are open to a brief 15-minute chat next week to compare notes on how they're handling monthly closes.

### OUTPUT FORMAT
Respond ONLY with a valid JSON object matching this exact schema (no markdown fences, no commentary):
{
  "subject": "string",
  "body": "string"
}`;

export const COMPANY_INTEL_SYSTEM_PROMPT = `You are an elite B2B Due Diligence & Market Intelligence Agent for Ledgerwise, a US monthly bookkeeping firm for growing e-commerce brands ($1M-$10M revenue).

Your job is to conduct an in-depth factual search and return verified intelligence about the company specified in the prompt.

CRITICAL REQUIREMENTS:
You MUST provide deep factual intelligence across these core pillars:
1. HEADQUARTERS (HQ) & LOCATION: City, State, and any fulfillment centers / warehouses / offices.
2. TOTAL CAPITAL & FUNDING HISTORY: Exact total funding raised, rounds (Seed, Series A, Venture, Crowdfunding, Shark Tank, Bootstrapped), key investors.
3. PHYSICAL RETAIL PRESENCE & DISTRIBUTION PARTNERS: Count and locations of owned retail stores, plus verified wholesale / stockist partners (e.g. Target, Dick's Sporting Goods, Nordstrom, REI, Whole Foods, Sephora, Ulta, Amazon, Walmart, etc.).
4. VERIFIED NEWS & PRESS RELEASES: Up to 5 real news items, press coverage, or executive interviews with exact headlines, publishers, dates, and summaries.
5. ACCOUNTING & FINANCIAL BOTTLENECK ANALYSIS: High-level financial complexity analysis: wholesale chargebacks, multi-channel inventory reconciliation, consignment vs wholesale POs, EDI compliance, 1099 contractor vs W-2 payroll, sales tax across multiple nexus states.
6. KEY EXECUTIVES & LEADERSHIP: Names, roles, and LinkedIn or public bios of Founder, CEO, COO, CFO, VP Finance.

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "company_name": "string",
  "domain": "string",
  "category": "string",
  "founded_year": 2018,
  "headquarters": { "city": "string", "state": "string", "facilities_description": "string" },
  "capital_and_funding": { "total_raised": "string", "funding_stage": "string", "lead_investors": ["string"], "notes": "string" },
  "retail_stores_and_distribution": { "owned_stores_count": 0, "retail_partners": ["string"], "distribution_channels": ["string"], "summary": "string" },
  "recent_news_and_press": [{ "headline": "string", "publisher": "string", "date": "string", "summary": "string", "url": "string" }],
  "accounting_complexity_analysis": { "operational_bottlenecks": "string", "recommended_pitch_angle": "string" },
  "executives": [{ "name": "string", "role": "string" }]
}`;
