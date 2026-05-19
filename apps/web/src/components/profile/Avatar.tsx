/**
 * Deterministic SVG identicon from a wallet address.
 *
 * 8×8 grid mirrored left-right (so it looks like a face/sigil), colored
 * from the first 6 hex chars of the wallet. No external deps; renders
 * identically on server and client (no Math.random).
 */
function hexBytes(addr: string): number[] {
  const clean = addr.replace(/^0x/, "").toLowerCase();
  // Take first 64 hex chars (32 bytes) — pad if shorter so any input works
  const padded = (clean + "0".repeat(64)).slice(0, 64);
  const out: number[] = [];
  for (let i = 0; i < padded.length; i += 2) out.push(parseInt(padded.slice(i, i + 2), 16));
  return out;
}

export function Avatar({ wallet, size = 96 }: { wallet: string; size?: number }) {
  const bytes = hexBytes(wallet);
  const r = bytes[0],
    g = bytes[1],
    b = bytes[2];
  // Pick two accent colors that work over dark bg
  const primary = `rgb(${(r % 80) + 80}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 60)})`;
  const accent = `rgb(${Math.min(255, bytes[3] + 120)}, ${bytes[4] % 60 + 40}, ${Math.min(255, bytes[5] + 80)})`;

  // 8x8 grid — only the left half (4 cols) is bit-driven, then mirrored.
  const cells: Array<{ x: number; y: number; on: boolean; accent: boolean }> = [];
  const halfBytes = bytes.slice(6, 6 + 32); // 32 bytes → 256 bits, plenty for 32 cells
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const i = y * 4 + x;
      const byte = halfBytes[i % halfBytes.length];
      const on = ((byte >> (i % 8)) & 1) === 1;
      const isAccent = ((byte >> ((i + 3) % 8)) & 1) === 1;
      cells.push({ x, y, on, accent: isAccent });
      cells.push({ x: 7 - x, y, on, accent: isAccent });
    }
  }

  const cell = size / 8;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        borderRadius: "16px",
        background: "rgba(0, 0, 0, 0.4)",
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(0, 0, 0, 0.5)",
      }}
      aria-label={`Avatar for ${wallet}`}
    >
      {cells.map((c, i) =>
        c.on ? (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={1}
            height={1}
            fill={c.accent ? accent : primary}
          />
        ) : null,
      )}
    </svg>
  );
}
