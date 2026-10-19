/**
 * Sorts a piece of text (a headline, a trending search) into one problem category.
 * Rules are plain keyword patterns so they are easy to read, test and tune; the category
 * with the most matching patterns wins, ties go to the earlier category in the list.
 */
export type CategoryId = "water" | "power" | "transport" | "education" | "jobs" | "grants" | "cost" | "health" | "safety" | "trending";

export type Category = { id: CategoryId; label: string; color: string; patterns: RegExp[]; phrase: string };

const w = (s: string) => new RegExp(`\\b(?:${s})\\b`, "i");

export const CATEGORIES: Category[] = [
  { id: "water", label: "Water", color: "#F59E0B", phrase: "Water problems",
    patterns: [w("water (?:outage|outages|cuts?|interruptions?|shortages?|supply|crisis|restrictions?|tankers?)"), w("no water|dry taps?|without water|taps run dry"), w("burst (?:pipe|main)s?"), w("reservoirs?|Rand Water|Umgeni Water|Joburg Water|uMngeni-uThukela"), w("sewage|sewer spills?")] },
  { id: "power", label: "Power", color: "#38BDF8", phrase: "Power problems",
    patterns: [w("load[- ]?shedding|load[- ]?reduction"), w("power (?:outage|outages|cuts?|failure|supply)"), w("blackouts?|electricity (?:supply|outage|tariffs?|cuts?)"), w("Eskom|City Power|substations?"), w("stage [1-8]")] },
  { id: "transport", label: "Transport", color: "#A78BFA", phrase: "Transport trouble",
    patterns: [w("taxi (?:strike|violence|fares?|rank)s?"), w("Metrorail|PRASA|trains? (?:delays?|cancelled|services?)"), w("road (?:closures?|closed)|N[1-9]{1,2} (?:closed|closure|crash)"), w("Golden Arrow|Putco|bus (?:strike|services?)"), w("potholes?")] },
  { id: "education", label: "Education", color: "#2DD4BF", phrase: "Students struggling",
    patterns: [w("NSFAS|bursar(?:y|ies)|student funding"), w("matric|NSC exams?|exam (?:papers?|results?)"), w("universit(?:y|ies)|TVET|college registrations?|CAO"), w("school (?:fees|placements?|admissions?|closures?)|learners?")] },
  { id: "jobs", label: "Jobs", color: "#F472B6", phrase: "Job hunting",
    patterns: [w("unemployment|unemployed"), w("retrench(?:ment|ments|ed)?|job (?:cuts|losses)|layoffs?"), w("vacanc(?:y|ies)|learnerships?|internships?|job seekers?"), w("Z83|DPSA|public service jobs?")] },
  { id: "grants", label: "Grants", color: "#FB923C", phrase: "Grant payments",
    patterns: [w("SASSA|social grants?|SRD grant|R370|child support grant|old age grant|pension payments?"), w("grant (?:payments?|delays?|dates?)")] },
  { id: "cost", label: "Cost of living", color: "#FACC15", phrase: "Money pressure",
    patterns: [w("(?:fuel|petrol|diesel) (?:price|prices|hike|increase)"), w("food prices|cost of living|grocery prices"), w("interest rates?|repo rate|prime rate"), w("tariff (?:hike|increase)s?|price hikes?")] },
  { id: "health", label: "Health", color: "#4ADE80", phrase: "Health concerns",
    patterns: [w("hospitals?|clinics?"), w("outbreak|cholera|measles|mpox|listeria"), w("medicine shortages?|ambulances?")] },
  { id: "safety", label: "Safety", color: "#F87171", phrase: "Safety worries",
    patterns: [w("protests?|service delivery|shutdown|march(?:es)? to"), w("shootings?|murders?|hijack(?:ing|ings)?|robber(?:y|ies)|kidnapp(?:ing|ed)"), w("on strike|strike action|(?:workers|wage|national) strikes?|national shutdown|go(?:es|ing)? on strike")] },
];

export const TRENDING: Category = { id: "trending", label: "Trending", color: "#EAF2F7", phrase: "Trending searches", patterns: [] };
export const CATEGORY_BY_ID = new Map<CategoryId, Category>([...CATEGORIES, TRENDING].map((c) => [c.id, c]));

/** The best category for the text, or null when nothing matches. */
export function classify(text: string): CategoryId | null {
  let best: Category | null = null;
  let bestScore = 0;
  for (const c of CATEGORIES) {
    const score = c.patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best?.id ?? null;
}
