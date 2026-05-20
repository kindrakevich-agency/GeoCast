import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 40%, #1a2440 0%, #0a0e1a 70%)",
          borderRadius: 36,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="glow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
              <stop offset="100%" stopColor="#0099cc" stopOpacity="1" />
            </radialGradient>
          </defs>
          <path
            d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"
            fill="url(#glow)"
            stroke="#7fe9ff"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9" r="2.4" fill="#0a0e1a" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
