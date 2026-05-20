#!/usr/bin/env node
/**
 * Capture the README screenshots: hero, round-active, resolution, profile.
 *
 * Hits the deployed site by default; pass --base http://localhost:3000
 * to capture from a local dev server instead.
 *
 *     pnpm dlx playwright@latest install chromium
 *     node infra/scripts/capture-screenshots.mjs
 *     node infra/scripts/capture-screenshots.mjs --base http://localhost:3000
 *
 * Output: docs/screenshots/{hero,round-active,resolution,profile}.png
 *
 * Why a script: portfolio screenshots need to stay in sync with the live
 * UI as it evolves. Hand-captured PNGs rot. A one-command refresh keeps
 * the README honest.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const OUT_DIR = resolve(REPO_ROOT, "docs", "screenshots");

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : "https://geocast.games";

const VIEWPORT = { width: 1440, height: 900 };
const TILE_WAIT_MS = 2500; // give MapLibre time to render glyphs + sprites

/** @param {import('playwright').Page} page */
async function settleMap(page) {
  // The map style + sprite + glyph fetches are async; waiting on networkidle
  // alone fires before the canvas finishes drawing. Add a small fixed delay.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(TILE_WAIT_MS);
}

async function capture(name, path) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  console.log(`→ ${name} (${BASE}${path})`);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await settleMap(page);
  await page.screenshot({
    path: resolve(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  await browser.close();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  await capture("hero", "/");
  await capture("round-active", "/play");
  await capture("profile", "/me");
  await capture("leaderboard", "/leaderboard");

  // "Pinned" shot — same round page but with one anonymous pin dropped, so
  // the side panel slides in and the heatmap aggregate becomes visible. The
  // dev-resolve shortcut is gone (admin-only flow now), so we settle for
  // this engagement-state shot instead of a fake resolved view.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  console.log(`→ resolution (active round, pin dropped)`);
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  await settleMap(page);
  await page.locator("canvas.maplibregl-canvas").click({ position: { x: 760, y: 460 } });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /place pin/i }).click().catch(() => {});
  await page.waitForTimeout(2200); // pin drop + ripple animation
  await page.screenshot({
    path: resolve(OUT_DIR, "resolution.png"),
    fullPage: false,
  });
  await browser.close();

  console.log(`\nDone → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
