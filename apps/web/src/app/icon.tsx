import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"
            fill="#00d4ff"
            stroke="#00d4ff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9" r="2.4" fill="#0a0e1a" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
