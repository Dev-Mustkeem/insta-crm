export type LeadTier = "HOT" | "WARM" | "COLD";

export interface RawLead {
  company?: string;
  contactName?: string;
  title?: string;
  email?: string;
  phone?: string;
  industry?: string;
  employees?: string;
  value?: string;
  source?: string;
  status?: string;
  notes?: string;
  timeline?: string;
  lastContact?: string;
  interactions?: string;
}

export interface ClassificationStep {
  step: number;
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  verdict: "Strong" | "Moderate" | "Weak";
  reason: string;
}

export interface ClassifiedLead extends RawLead {
  id: number;
  score: number;
  tier: LeadTier;
  steps: ClassificationStep[];
}

export const TIER_THRESHOLDS = { hot: 65, warm: 35 };

const DECISION_MAKER = /\b(owner|founder|co-?founder|ceo|cfo|coo|cto|cmo|md|managing director|director|president|partner|proprietor|chairman|vp|vice president|head)\b/i;
const MID_LEVEL = /\b(manager|lead|senior|procurement|purchase|buyer|general manager|gm)\b/i;
const HIGH_INTENT = /\b(interested|demo|quote|quotation|proposal|pricing|price|negotiat|ready to buy|urgent|asap|purchase order|po |requirement|confirmed|meeting|follow[- ]?up|hot|trial|call back)\b/i;
const LOW_INTENT = /\b(not interested|no response|unreachable|wrong number|do not call|dnd|lost|cold|invalid|unsubscribe|closed)\b/i;
const URGENT = /\b(urgent|asap|immediate|this week|this month|today|tomorrow|now|1 month|30 days|next week|q1|within)\b/i;
const SLOW = /\b(next year|later|future|not now|exploring|6 months|12 months|no timeline)\b/i;
const GOOD_SOURCE = /\b(referral|reference|inbound|website|demo request|event|exhibition|trade show|partner|existing customer|repeat|indiamart|justdial)\b/i;
const WEAK_SOURCE = /\b(cold call|bought list|scraped|purchased|bulk|unknown|database)\b/i;

function stepVerdict(score: number): ClassificationStep["verdict"] {
  return score >= 65 ? "Strong" : score >= 35 ? "Moderate" : "Weak";
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseAmount(value?: string): number {
  if (!value) return 0;
  const text = value.toLowerCase().replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l|k|m|million)?/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  switch (match[2]) {
    case "crore":
    case "cr":
      return n * 10_000_000;
    case "lakh":
    case "lac":
    case "l":
      return n * 100_000;
    case "k":
      return n * 1_000;
    case "m":
    case "million":
      return n * 1_000_000;
    default:
      return n;
  }
}

function parseEmployees(value?: string): number {
  if (!value) return 0;
  const nums = value.replace(/,/g, "").match(/\d+/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number));
}

function daysSince(value?: string): number | null {
  if (!value) return null;
  let date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!m) return null;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    date = new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

/**
 * Eight-step depth classification. Each step scores 0-100 and carries a weight;
 * the weighted total decides Hot / Warm / Cold.
 */
export function classifyLead(lead: RawLead, id: number): ClassifiedLead {
  const steps: ClassificationStep[] = [];
  const add = (
    key: string,
    label: string,
    weight: number,
    score: number,
    reason: string,
  ) => {
    const s = clamp(score);
    steps.push({ step: steps.length + 1, key, label, score: s, weight, verdict: stepVerdict(s), reason });
  };

  // 1. Contact reachability
  const emailOk = !!lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email);
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  const phoneOk = digits.length >= 10 && digits.length <= 13;
  add(
    "reachability",
    "Contact reachability",
    10,
    (emailOk ? 50 : 0) + (phoneOk ? 50 : 0),
    emailOk && phoneOk
      ? "Valid email and phone available"
      : emailOk
        ? "Only email available"
        : phoneOk
          ? "Only phone available"
          : "No valid email or phone",
  );

  // 2. Company profile completeness
  const profileFields = [lead.company, lead.industry, lead.employees, lead.contactName].filter(Boolean).length;
  add(
    "profile",
    "Company profile",
    10,
    profileFields * 25,
    `${profileFields} of 4 profile fields (company, industry, size, contact) present`,
  );

  // 3. Company size / fit
  const employees = parseEmployees(lead.employees);
  add(
    "size",
    "Company size & fit",
    10,
    employees === 0 ? 30 : employees >= 200 ? 100 : employees >= 50 ? 80 : employees >= 10 ? 60 : 40,
    employees ? `About ${employees} employees` : "Company size not stated",
  );

  // 4. Budget / deal value
  const amount = parseAmount(lead.value);
  add(
    "budget",
    "Budget / deal value",
    15,
    amount === 0 ? 15 : amount >= 1_000_000 ? 100 : amount >= 250_000 ? 80 : amount >= 50_000 ? 60 : amount >= 10_000 ? 40 : 25,
    amount ? `Estimated value ₹${amount.toLocaleString("en-IN")}` : "No budget or deal value stated",
  );

  // 5. Decision-maker authority
  const title = lead.title ?? "";
  add(
    "authority",
    "Decision-maker authority",
    10,
    DECISION_MAKER.test(title) ? 100 : MID_LEVEL.test(title) ? 60 : title ? 35 : 20,
    title ? `Contact role: ${title}` : "Contact role unknown",
  );

  // 6. Buying intent
  const intentText = `${lead.status ?? ""} ${lead.notes ?? ""}`;
  const lowIntent = LOW_INTENT.test(intentText);
  const highIntent = HIGH_INTENT.test(intentText);
  add(
    "intent",
    "Buying intent",
    20,
    lowIntent ? 5 : highIntent ? 90 : intentText.trim() ? 45 : 25,
    lowIntent
      ? "Notes/status signal disinterest"
      : highIntent
        ? "Notes/status show active buying signals"
        : intentText.trim()
          ? "Some notes, no clear buying signal"
          : "No intent information",
  );

  // 7. Timeline urgency & recency
  const days = daysSince(lead.lastContact);
  const timelineText = lead.timeline ?? "";
  let urgency = 30;
  const urgencyParts: string[] = [];
  if (URGENT.test(timelineText)) { urgency = 90; urgencyParts.push("urgent timeline"); }
  else if (SLOW.test(timelineText)) { urgency = 20; urgencyParts.push("long-dated timeline"); }
  else if (timelineText) { urgency = 50; urgencyParts.push(`timeline: ${timelineText}`); }
  if (days !== null) {
    const recency = days <= 7 ? 100 : days <= 30 ? 70 : days <= 90 ? 40 : 10;
    urgency = timelineText ? (urgency + recency) / 2 : recency;
    urgencyParts.push(`last contact ${days} day${days === 1 ? "" : "s"} ago`);
  }
  add("urgency", "Timeline & recency", 15, urgency, urgencyParts.join(", ") || "No timeline or contact date");

  // 8. Source quality & engagement
  const interactions = parseInt((lead.interactions ?? "").replace(/\D/g, ""), 10) || 0;
  const source = lead.source ?? "";
  let sourceScore = source ? (GOOD_SOURCE.test(source) ? 85 : WEAK_SOURCE.test(source) ? 25 : 50) : 30;
  if (interactions >= 3) sourceScore = Math.min(100, sourceScore + 20);
  add(
    "source",
    "Source & engagement",
    10,
    sourceScore,
    `${source ? `Source: ${source}` : "Source unknown"}${interactions ? `, ${interactions} interactions` : ""}`,
  );

  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.round(steps.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight);
  const tier: LeadTier = lowIntent ? "COLD" : score >= TIER_THRESHOLDS.hot ? "HOT" : score >= TIER_THRESHOLDS.warm ? "WARM" : "COLD";

  return { ...lead, id, score, tier, steps };
}
