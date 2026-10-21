/**
 * Sorts a piece of text (a headline, a trending search) into one problem category.
 * Rules are plain keyword patterns so they are easy to read, test and tune; the category
 * with the most matching patterns wins, ties go to the earlier category in the list.
 */
export type CategoryId = "water" | "power" | "transport" | "education" | "jobs" | "grants" | "cost" | "health" | "safety" | "trending"
  | "good" | "sport" | "politics" | "business" | "weather" | "entertainment" | "general";

export type Category = { id: CategoryId; label: string; color: string; patterns: RegExp[]; phrase: string };

const w = (s: string) => new RegExp(`\\b(?:${s})\\b`, "i");

export const CATEGORIES: Category[] = [
  { id: "water", label: "Water", color: "#F59E0B", phrase: "Water problems",
    patterns: [w("water (?:outage|outages|cuts?|interruptions?|shortages?|supply|crisis|restrictions?|tankers?)"), w("no water|dry taps?|without water|taps run dry"), w("burst (?:pipe|main)s?"), w("reservoirs?|Rand Water|Umgeni Water|Joburg Water|uMngeni-uThukela"), w("sewage|sewer spills?")] },
  { id: "power", label: "Power", color: "#38BDF8", phrase: "Power problems",
    patterns: [w("load[- ]?shedding|load[- ]?reduction"), w("power (?:outage|outages|cuts?|failure|supply)"), w("blackouts?|electricity (?:supply|outage|tariffs?|cuts?)"), w("Eskom|City Power|substations?"), w("stage [1-8]")] },
  { id: "transport", label: "Transport", color: "#A78BFA", phrase: "Transport trouble",
    patterns: [w("taxi (?:strike|violence|fares?|rank|industry|association|operators?|drivers?|owners?|route|permits?)s?"), w("SANTACO|minibus taxis?|e-hailing|Uber|Bolt drivers?"), w("Metrorail|PRASA|trains? (?:delays?|cancelled|services?)"), w("road (?:closures?|closed)|N[1-9]{1,2} (?:closed|closure|crash)"), w("Golden Arrow|Putco|bus (?:strike|services?)"), w("potholes?")] },
  { id: "education", label: "Education", color: "#2DD4BF", phrase: "Students struggling",
    patterns: [w("NSFAS|bursar(?:y|ies)|student funding"), w("matric|NSC exams?|exam (?:papers?|results?)"), w("universit(?:y|ies)|TVET|college registrations?|CAO"), w("school (?:fees|placements?|admissions?|closures?)|learners?")] },
  { id: "jobs", label: "Jobs", color: "#F472B6", phrase: "Job hunting",
    patterns: [w("unemployment|unemployed"), w("retrench(?:ment|ments|ed)?|job (?:cuts|losses)|layoffs?"), w("vacanc(?:y|ies)|learnerships?|internships?|job seekers?|now hiring|is hiring|recruit(?:ing|ment)|apply now|job opportunit(?:y|ies)|new jobs?|jobs? created"), w("Z83|DPSA|public service jobs?")] },
  { id: "grants", label: "Grants", color: "#FB923C", phrase: "Grant payments",
    patterns: [w("SASSA|social grants?|SRD grant|R370|child support grant|old age grant|pension payments?"), w("grant (?:payments?|delays?|dates?)")] },
  { id: "cost", label: "Cost of living", color: "#FACC15", phrase: "Money pressure",
    patterns: [w("(?:fuel|petrol|diesel|paraffin) (?:price|prices|hike|increase|decrease|cut|drop|relief)"), w("petrol|diesel"), w("food prices|cost of living|grocery prices"), w("interest rates?|repo rate|prime rate"), w("tariff (?:hike|increase)s?|price hikes?")] },
  { id: "health", label: "Health", color: "#4ADE80", phrase: "Health concerns",
    patterns: [w("hospitals?|clinics?"), w("outbreak|cholera|measles|mpox|listeria"), w("medicine shortages?|ambulances?")] },
  { id: "safety", label: "Safety", color: "#F87171", phrase: "Safety worries",
    patterns: [w("protests?|service delivery|shutdown|march(?:es)? to"), w("shootings?|murders?|hijack(?:ing|ings)?|robber(?:y|ies)|kidnapp(?:ing|ed)"), w("on strike|strike action|(?:workers|wage|national) strikes?|national shutdown|go(?:es|ing)? on strike")] },
];

/** Other kinds of news (not problems). Ties go to the problem categories above. */
export const NEWS_CATEGORIES: Category[] = [
  { id: "good", label: "Good news", color: "#34D399", phrase: "Good news",
    patterns: [w("good news|celebrat(?:e|es|ed|ing|ion)|award(?:s|ed)?|wins?|won|champions?|record[- ]breaking|milestone|first ever|breakthrough"), w("rescued|reunited|donat(?:e|es|ed|ion)|graduat(?:e|es|ed|ion)|top (?:learners?|achievers?|matriculants?)|bursar(?:y|ies) awarded|opens? (?:a )?new|launch(?:es|ed)? (?:a )?new"), w("heroe?s?|inspiring|proud|relief")] },
  { id: "sport", label: "Sport", color: "#60A5FA", phrase: "Sport",
    patterns: [w("Bafana|Banyana|Springboks?|Boks|Proteas|Blitzboks|PSL|Betway Premiership|Kaizer Chiefs|Orlando Pirates|Mamelodi Sundowns|Sundowns|Stormers|Bulls|Sharks|Lions"), w("AFCON|World Cup|Olympics?|Comrades|cricket|rugby|soccer|football|athletics|boxing|marathon"), w("coach|striker|midfielder|goalkeeper|captain|match|fixture|derby|semi-final|final|league|tournament")] },
  { id: "politics", label: "Politics", color: "#C084FC", phrase: "Politics",
    patterns: [w("ANC|DA|EFF|MK [Pp]arty|ActionSA|IFP|PA|GNU|Ramaphosa|Mashatile|Malema|Zuma|Steenhuisen|Hlabisa"), w("parliament|cabinet|minister|premier|mayor|councillors?|municipal council|elections?|by-elections?|IEC|vote|budget speech|State of the Nation|SONA")] },
  { id: "business", label: "Money & business", color: "#FBBF24", phrase: "Money news",
    patterns: [w("rand|JSE|economy|GDP|inflation|CPI|Reserve Bank|SARB|Treasury|Godongwana|SARS|tax(?:es)?|VAT"), w("retail|Shoprite|Pick n Pay|Checkers|Woolworths|Capitec|FNB|Absa|Standard Bank|Nedbank|Vodacom|MTN|Telkom|Takealot"), w("investment|profits?|shares|stock market|business|company|companies|tender")] },
  { id: "weather", label: "Weather", color: "#93C5FD", phrase: "Weather",
    patterns: [w("SAWS|weather|heatwave|heat wave|cold front|snow|storms?|thunderstorms?|hail|floods?|flooding|heavy rain|rainfall|disruptive rain|wildfires?|veld fires?|level [1-9] (?:warning|alert)|orange level|yellow level")] },
  { id: "entertainment", label: "Entertainment", color: "#F9A8D4", phrase: "Mzansi entertainment",
    patterns: [w("celebrit(?:y|ies)|actor|actress|musician|rapper|singer|DJ|amapiano|SAMA|SAFTA|Metro FM awards|Idols SA|Big Brother Mzansi|Skeem Saam|Generations|Uzalo|Gomora|Showmax|Netflix|album|concert|festival|influencer|TikToker|viral video")] },
];
/** Headlines that fit no category: only used when several outlets cover the same story. */
export const GENERAL: Category = { id: "general", label: "News", color: "#E5E7EB", phrase: "Latest news", patterns: [] };
export const PROBLEM_IDS = new Set<CategoryId>(CATEGORIES.map((c) => c.id));

/** Headlines that report a forecast ("expected to", "set to"…): used only as clearly-labelled, sourced predictions. */
export const FORECAST = /\b(?:expected to|set to (?:rise|fall|drop|increase|decrease|go up|come down|change)|forecasts?|predict(?:s|ed|ions?)?|projected|likely to|outlook|could (?:rise|fall|drop|increase|decrease|go up|come down)|early data|mid-month data|what to expect|will (?:rise|fall|drop|increase|decrease|go up|come down))\b/i;

export const TRENDING: Category = { id: "trending", label: "Trending", color: "#EAF2F7", phrase: "Trending searches", patterns: [] };
export const CATEGORY_BY_ID = new Map<CategoryId, Category>([...CATEGORIES, ...NEWS_CATEGORIES, TRENDING, GENERAL].map((c) => [c.id, c]));

/** The best category for the text, or null when nothing matches. `problemsOnly` = only the problem categories (map/feed). */
export function classify(text: string, problemsOnly = false): CategoryId | null {
  let best: Category | null = null;
  let bestScore = 0;
  for (const c of problemsOnly ? CATEGORIES : [...CATEGORIES, ...NEWS_CATEGORIES]) {
    // good news wins a tie ("Soweto learner wins award" is good news, not an education problem)
    const score = c.patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0) * (c.id === "good" ? 1.5 : 1);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best?.id ?? null;
}
