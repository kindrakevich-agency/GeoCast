// Single source of truth for "what question types does GeoCast ask?".
//
// Consumed by:
//   /admin            — roadmap dashboard ("live" cards show recent rounds,
//                       "planned" cards are greyed-out stubs)
//   /                 — landing page Resolution Sources cards + typewriter
//                       examples + the FAQ list
//
// Adding a planned template = append one row.
// Implementing the PHP resolver = flip status to "live".

export type TemplateStatus = "live" | "planned";

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
  // ---- LIVE (resolver class exists, rounds being produced) ----
  {
    code: "openmeteo.hottest-capital",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the hottest world capital be in the next 24 hours?",
    status: "live",
    blurb:
      "Daily forecast + observed archive across 244 candidates (195 UN capitals + 49 top metros). Two-stage tie-break: daily aggregate → hourly archive peak.",
  },
  {
    code: "openmeteo.coldest-capital",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the coldest world capital be in the next 24 hours?",
    status: "live",
    blurb:
      "Mirror image of hottest. Same 244-city dataset, ranked by daily temperature_2m_min ascending — Yakutsk, Reykjavik, Ulaanbaatar are regulars.",
  },
  {
    code: "usgs.next-m5-earthquake",
    source: "USGS Earthquakes",
    sourceUrl: "https://earthquake.usgs.gov/",
    question: "Where will the next M5+ earthquake strike in the next 24 hours?",
    status: "live",
    blurb:
      "Real-time FDSN feed of M5+ events globally. ~4 M5+ per day worldwide; falls back to M4.5+ on quiet 24h windows (22% of random windows have zero M5+).",
  },
  {
    code: "nasa-eonet.largest-wildfire",
    source: "NASA EONET",
    sourceUrl: "https://eonet.gsfc.nasa.gov/",
    question: "Where will the largest active wildfire be in the next 24 hours?",
    status: "live",
    blurb:
      "Earth Observatory Natural Event Tracker — pre-clustered wildfire events worldwide. Ranked by magnitudeValue (acres), falls back to most-recent update on size-less entries.",
  },

  // ---- PLANNED (Open-Meteo, same plumbing) ----
  {
    code: "openmeteo.heaviest-rainfall",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the heaviest rainfall fall in the next 24 hours?",
    status: "planned",
    blurb:
      "Same 244-city dataset, ranked by 24h precipitation_sum instead of temperature.",
  },
  {
    code: "openmeteo.strongest-wind-gust",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question:
      "Where will the strongest wind gust hit a coastal city in the next 24 hours?",
    status: "planned",
    blurb:
      "Coastal subset (~85 cities flagged in WorldCapitals). Ranked by wind_gusts_10m_max over the 24h window.",
  },
  {
    code: "openmeteo.biggest-temp-swing",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question:
      "Which capital will have the biggest day-night temperature swing in the next 24 hours?",
    status: "planned",
    blurb:
      "Rank by (temperature_2m_max − temperature_2m_min) over the 24h window. Desert capitals (Riyadh, Doha) dominate dry seasons.",
  },
  {
    code: "openmeteo.highest-uv-index",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question: "Where will the highest UV index reading land in the next 24 hours?",
    status: "planned",
    blurb:
      "Rank by uv_index_max — equatorial + high-altitude cities (Quito, La Paz) lead consistently.",
  },
  {
    code: "openmeteo.clearest-stargazing",
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    question:
      "Which dark-sky site will have the clearest skies in the next 24 hours?",
    status: "planned",
    blurb:
      "30-site curated dark-sky list (Atacama, La Palma, Mauna Kea, …). Rank by cloud_cover_mean ascending.",
  },

  // ---- PLANNED (other sources) ----
  {
    code: "noaa.next-tropical-storm",
    source: "NOAA NHC",
    sourceUrl: "https://www.nhc.noaa.gov/",
    question:
      "Where will the next named-storm landfall happen in the next 24 hours?",
    status: "planned",
    blurb:
      "National Hurricane Center cone forecasts. Restricted to active basins (Atlantic / E-Pacific / W-Pacific via JMA + JTWC mirrors).",
  },
  {
    code: "gdelt.biggest-news-event",
    source: "GDELT Project",
    sourceUrl: "https://www.gdeltproject.org/",
    question:
      "Where will the biggest geo-tagged news event happen in the next 24 hours?",
    status: "planned",
    blurb:
      "Realtime geo-tagged news, 24h window. Rank by event Goldstein scale + mention count.",
  },
];

/** Just the live ones — used by the typewriter on the landing page. */
export const LIVE_QUESTIONS: string[] = QUESTION_TEMPLATES.filter(
  (t) => t.status === "live",
).map((t) => t.question);

/** Live + planned — used when "every question we ask" is the right framing. */
export const ALL_QUESTIONS: string[] = QUESTION_TEMPLATES.map((t) => t.question);
