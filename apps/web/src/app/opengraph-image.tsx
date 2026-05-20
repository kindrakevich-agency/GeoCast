import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GeoCast — Drop a pin. Predict the world.";

async function loadFont(weight: 400 | 600 | 700): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@${weight}&display=swap`,
      { headers: { "user-agent": "Mozilla/5.0" } },
    );
    const css = await res.text();
    const url = css.match(/src: url\((https:\/\/[^)]+)\) format/)?.[1];
    if (!url) return null;
    const font = await fetch(url);
    return await font.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OG() {
  const [w400, w700] = await Promise.all([loadFont(400), loadFont(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          background: "#0a0e1a",
          backgroundImage:
            "radial-gradient(circle at 80% 30%, rgba(0, 212, 255, 0.18) 0%, transparent 55%), radial-gradient(circle at 15% 90%, rgba(255, 0, 110, 0.14) 0%, transparent 50%)",
          color: "#f0f4f8",
          fontFamily: "Space Grotesk",
          position: "relative",
        }}
      >
        {/* Top row: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <PinGlyph size={56} />
          <span
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            GeoCast
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              color: "#f0f4f8",
            }}
          >
            Drop a pin.
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              background: "linear-gradient(90deg, #00d4ff 0%, #ff006e 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Predict the world.
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 56,
            paddingTop: 28,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: "#8892a6",
              letterSpacing: "0.02em",
            }}
          >
            Daily geo-prediction game
          </span>
          <span
            style={{
              fontSize: 22,
              color: "#00d4ff",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            geocast.games
          </span>
        </div>

        {/* Decorative big pin in upper right */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 60,
            right: 80,
            opacity: 0.95,
          }}
        >
          <PinGlyph size={240} glow />
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

function PinGlyph({ size, glow = false }: { size: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={glow ? { filter: "drop-shadow(0 0 20px rgba(0, 212, 255, 0.7))" } : undefined}
    >
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
