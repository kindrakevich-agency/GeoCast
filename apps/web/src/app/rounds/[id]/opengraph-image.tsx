import { ImageResponse } from "next/og";
import type { ApiRound } from "@/lib/api/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GeoCast round";

export const revalidate = 60;

async function loadFont(weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@${weight}&display=swap`,
      { headers: { "user-agent": "Mozilla/5.0" } },
    );
    const css = await res.text();
    const url = css.match(/src: url\((https:\/\/[^)]+)\) format/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

async function fetchRound(id: string): Promise<ApiRound | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "https://geocast.games/api";
  try {
    const res = await fetch(`${base}/rounds/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as ApiRound;
  } catch {
    return null;
  }
}

function formatTimeLeft(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `closes in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `closes in ${h}h ${m}m`;
  return `closes in ${m}m`;
}

function statusLabel(round: ApiRound): string {
  if (round.status === "resolved") return "resolved";
  if (round.status === "closed") return "awaiting reveal";
  if (round.status === "scheduled") return "opens soon";
  return formatTimeLeft(round.closesAt);
}

function statusColor(round: ApiRound): string {
  if (round.status === "resolved") return "#00ff88";
  if (round.status === "closed") return "#ffb800";
  if (round.status === "scheduled") return "#8892a6";
  const ms = new Date(round.closesAt).getTime() - Date.now();
  if (ms < 5 * 60_000 && ms > 0) return "#ff006e";
  return "#00d4ff";
}

export default async function RoundOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [round, w400, w700] = await Promise.all([fetchRound(id), loadFont(400), loadFont(700)]);

  const question = round?.question ?? "Drop a pin. Predict the world.";
  const number = round?.number ?? null;
  const status = round ? statusLabel(round) : "live now";
  const accent = round ? statusColor(round) : "#00d4ff";
  const participants = round?.totalParticipants ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          background: "#0a0e1a",
          backgroundImage: `radial-gradient(circle at 85% 20%, ${accent}22 0%, transparent 55%), radial-gradient(circle at 10% 100%, rgba(255, 0, 110, 0.12) 0%, transparent 50%)`,
          color: "#f0f4f8",
          fontFamily: "Space Grotesk",
          position: "relative",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PinGlyph size={42} />
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
              GeoCast
            </span>
          </div>
          {number !== null && (
            <span
              style={{
                fontSize: 22,
                color: "#8892a6",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
              }}
            >
              Round #{number}
            </span>
          )}
        </div>

        {/* Question — the centerpiece */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", marginTop: 32 }}>
          <span
            style={{
              fontSize: question.length > 70 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              color: "#f0f4f8",
              maxWidth: 1040,
            }}
          >
            {question}
          </span>
        </div>

        {/* Status pill row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 22px",
              border: `1px solid ${accent}55`,
              background: `${accent}11`,
              borderRadius: 999,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: accent,
              }}
            />
            <span
              style={{
                fontSize: 22,
                color: accent,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              {status}
            </span>
          </div>
          {participants !== null && participants > 0 && (
            <span
              style={{
                fontSize: 22,
                color: "#8892a6",
              }}
            >
              {participants} {participants === 1 ? "explorer" : "explorers"}
            </span>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 36,
            paddingTop: 24,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <span style={{ fontSize: 20, color: "#8892a6" }}>
            Daily geo-prediction · closest pin wins
          </span>
          <span
            style={{
              fontSize: 20,
              color: "#00d4ff",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            geocast.games
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(w400 ? [{ name: "Space Grotesk", data: w400, weight: 400 as const, style: "normal" as const }] : []),
        ...(w700 ? [{ name: "Space Grotesk", data: w700, weight: 700 as const, style: "normal" as const }] : []),
      ],
    },
  );
}

function PinGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"
        fill="#00d4ff"
        stroke="#7fe9ff"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.4" fill="#0a0e1a" />
    </svg>
  );
}
