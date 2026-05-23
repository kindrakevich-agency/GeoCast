// Single source of truth for "what question does GeoCast ask?".
//
// Consumed by:
//   /admin            — roadmap dashboard (the live template + research roadmap)
//   /                 — landing page hero, sources card, FAQ
//
// GeoCast runs ONE question, forever: "Where will the first M5+ earthquake
// strike in the 24 hours after this round closes?" It is fundamentally
// un-gameable — earthquakes are physically unpredictable, the answer
// hasn't happened yet at commit time, and the data source publishes
// within ~60s of detection. Every other template here is research-track
// — listed for transparency, not active.

export type TemplateStatus = "live" | "research";

export type QuestionTemplate = {
  /** Stable identifier matching the PHP resolver's ResolverInterface::code(). */
  code: string;
  /** Source provider name as shown to users. */
  source: string;
  /** Public URL for the data source. */
  sourceUrl: string;
  /** The exact question text the resolver emits. */
  question: string;
  status: TemplateStatus;
  /** Short description shown on the admin card. */
  blurb: string;
};

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  // ---- LIVE: the only active question ----
  {
    code: "usgs.aftershock",
    source: "USGS Earthquakes",
    sourceUrl: "https://earthquake.usgs.gov/",
    question:
      "Where will the first M5+ earthquake strike in the 24 hours after this round closes?",
    status: "live",
    blurb:
      "Genuinely un-gameable — earthquakes are physically unpredictable, the event hasn't happened at commit time. Cron polls USGS every minute; magnitude floor walks M5 → M4.5 → M4 → M3.5 across the 24h post-close window so resolution is always guaranteed.",
  },

  // ---- RESEARCH: explored, rejected as gameable, kept for transparency ----
  {
    code: "usgs.next-m5-earthquake",
    source: "USGS Earthquakes",
    sourceUrl: "https://earthquake.usgs.gov/",
    question: "Where will the next M5+ earthquake strike in the next 24 hours?",
    status: "research",
    blurb:
      "Predecessor of aftershock — events during the open window were trivially observable via the live USGS feed at hour 23. Replaced by aftershock semantics (look at the window AFTER close).",
  },
  {
    code: "openmeteo.hottest-capital",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the hottest world capital be in the next 24 hours?",
    status: "research",
    blurb:
      "Rejected — Open-Meteo's 24h forecast is ~85% accurate at the city scale. The winner is essentially announced when the round opens. Kept the resolver class for the historical 244-capital dataset.",
  },
  {
    code: "openmeteo.coldest-capital",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the coldest world capital be in the next 24 hours?",
    status: "research",
    blurb:
      "Same forecast-leak problem as hottest-capital — Yakutsk, Reykjavik, Ulaanbaatar are forecast-known winners. Not run live.",
  },
  {
    code: "nasa-eonet.largest-wildfire",
    source: "NASA EONET",
    sourceUrl: "https://eonet.gsfc.nasa.gov/",
    question: "Where will the largest active wildfire be in the next 24 hours?",
    status: "research",
    blurb:
      "Rejected — active wildfires telegraph hours-to-days in advance via fire-detection feeds (MODIS/VIIRS). The biggest fire at hour 0 is usually still the biggest at hour 24.",
  },
  {
    code: "blitzortung.first-lightning",
    source: "Blitzortung / WWLLN",
    sourceUrl: "https://www.blitzortung.org/",
    question:
      "Where will the first lightning strike land in the 24 hours after this round closes?",
    status: "research",
    blurb:
      "Promising — sub-second publish, 50-100 strikes/sec globally. Storm regions are forecast-known but exact strike location is chaotic. Future flagship alongside aftershock.",
  },
];

/** Just the live template's question — used by the typewriter on the landing page. */
export const LIVE_QUESTIONS: string[] = QUESTION_TEMPLATES.filter(
  (t) => t.status === "live",
).map((t) => t.question);

/** All known templates (live + research). */
export const ALL_QUESTIONS: string[] = QUESTION_TEMPLATES.map((t) => t.question);
