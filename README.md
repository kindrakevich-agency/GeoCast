# GeoCast

> **Drop a pin. Predict the world.**
> Live demo: **[geocast.kindrakevich.com](https://geocast.kindrakevich.com)**

A daily geo-prediction game built as a portfolio piece. Every round,
players see one question — _"Where will the next M5+ earthquake occur
in the next 48 hours?"_ — and drop a single pin on a world map. After
the round closes, the truth is revealed and players are ranked by
haversine distance.

A full-screen MapLibre canvas is the entire UI; glassmorphic panels
float on top. Cyberpunk-meets-cartography aesthetic, neon palette,
real-time presence dots, cinematic resolution choreography.

---

## Why this exists

This is a deliberate showcase of the full senior full-stack surface:

- **Real-time gameplay** — Pusher channels for pin placement, presence,
  and leaderboard updates pushed to thousands of connected clients.
- **Geo at scale** — MariaDB `SPATIAL POINT` columns with SRID 4326,
  `ST_Distance_Sphere` for haversine ranking, MapLibre vector tiles
  for a cinematic canvas with zero API-token dependency.
- **Web3 auth** — SIWE (EIP-4361) flow built from primitives:
  `kornrunner/secp256k1` for signature recovery, Redis-backed nonces,
  JWT exchange. No third-party auth provider, no smart contracts.
- **Visual polish that ships** — glassmorphism with `backdrop-filter`,
  Framer Motion choreography (pin drop → ripple → flyTo → distance
  line), and a typography stack that respects the brand.
- **Honest architecture** — Symfony 7 + API Platform on one side,
  Next.js 15 App Router on the other. Dockerised end-to-end. Single
  `docker compose up -d` boots the whole thing.

---

## Stack

| Layer        | Tooling                                                                          |
|--------------|----------------------------------------------------------------------------------|
| Frontend     | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 4 · MapLibre · Framer Motion |
| Web3         | wagmi v2 · viem · RainbowKit · SIWE                                              |
| Backend      | Symfony 7.4 LTS · API Platform 4 · Doctrine ORM · MariaDB 10.11 (SPATIAL POINT)  |
| Realtime     | Pusher Channels (`round-{id}`, `presence-round-{id}`, `leaderboard`)             |
| Caching      | Redis 7 (ZSET leaderboards + SIWE nonces)                                        |
| Infra        | Docker Compose · nginx → php-fpm · Cloudflare in front · Hetzner VPS deploy      |

---

## The screens

| Screen          | Highlight                                                                       |
|-----------------|---------------------------------------------------------------------------------|
| Landing         | Pulsing pins on a dark world map · glassmorphic auth card                       |
| Active round    | Crosshair cursor · drop animation · presence dots · heatmap reveal              |
| Resolution      | Camera flyTo · distance line draw · leaderboard slide-in                        |
| Profile         | Career heatmap (every pin you ever dropped) · stats grid                        |
| Leaderboard     | Slide-in modal with today / week / all-time tabs                                |

The active-round screen is the centrepiece — the place to spend the
most polish budget. Open `localhost:3000/rounds/demo` after starting
the dev server to see it.

---

## Quick start

The repo currently runs UI-first against mocked data. Backend
endpoints are scaffolded but unimplemented.

```bash
git clone https://github.com/kindrakevich-agency/GeoCast.git
cd GeoCast

# install
pnpm install            # at repo root — pnpm workspaces resolve apps/web

# dev
pnpm dev                # Next.js on http://localhost:3000
# → open http://localhost:3000/rounds/demo for the active-round canvas
```

Once the backend lands, `docker compose up -d` will boot the entire
stack — web on `:3000`, API behind nginx on `:8080`, MariaDB on
`:3306`, Redis on `:6379`.

```bash
cp .env.example .env       # then fill in real values
docker compose up -d
```

Database migrations and seed data run automatically on first start.

---

## Scoring

For a prediction at haversine distance `d` (km) from the answer:

```
raw_score = 1 / (1 + d)
payout    = floor(pool_credits × raw_score / Σ raw_scores)
```

This makes the closest pin the biggest winner while still rewarding
the long tail — even far-off predictions get a sliver of the pool,
which keeps casual play engaging. The user's `total_score` is the
sum of `raw_score` across all rounds, indexed in a Redis ZSET for
the all-time leaderboard.

---

## Project structure

```
.
├── apps/
│   ├── web/                Next.js 15 + Tailwind 4 + MapLibre
│   │   └── src/
│   │       ├── app/        App Router routes (landing, /rounds/[id])
│   │       ├── components/ map · round · ui primitives
│   │       ├── hooks/      useCountdown, etc.
│   │       └── lib/        mock data, helpers
│   └── api/                Symfony 7.4 + API Platform 4 (scaffold)
├── infra/
│   └── nginx/api.conf      php-fpm reverse proxy for the API service
├── docker-compose.yml
├── docker-compose.override.yml   dev overrides (bind mounts, dev servers)
└── Makefile                shortcuts: make web-dev, make up, make nuke
```

---

## Roadmap

- [x] Monorepo skeleton + Docker compose
- [x] Tailwind 4 design tokens locked in (neon palette, glassmorphism)
- [x] Active round screen — map · question card · pin drop · ripple · confirm modal · presence dots · heatmap reveal · side panel
- [x] Landing page with ambient drifting world map + 50 pulsing pins
- [x] Resolution choreography — answer pin · flyTo · great-circle line · distance badge · leaderboard slide-in · confetti for top-10
- [x] Profile (`/me`) + Leaderboard (`/leaderboard`) pages
- [x] Production deploy → [geocast.kindrakevich.com](https://geocast.kindrakevich.com) (Hetzner + Cloudflare + GitHub Actions auto-deploy)
- [x] Symfony 7.4 API foundation — `/api/health`
- [x] SIWE auth — `POST /api/auth/nonce` (Redis nonce, 5min TTL) and `POST /api/auth/verify` (signature recovery → JWT)
- [ ] `/api/me` (JWT-gated current user)
- [ ] `/api/rounds/current` + `POST /api/rounds/:id/predictions`
- [ ] Pusher wiring on both sides
- [ ] Admin tools (round CRUD + geocoded resolution)

## Auth flow

```
1. Wallet → POST /api/auth/nonce  { address }
                                  → { nonce, address, expiresIn }

2. Wallet signs EIP-4361 SIWE message containing the nonce.

3. Wallet → POST /api/auth/verify { message, signature }
                                  → { token, user }

4. Subsequent requests carry `Authorization: Bearer <token>`.
```

The nonce is single-use, Redis-backed with a 5-minute TTL, and namespaced
`geocast:siwe:nonce:<address>` so it can never collide with other apps
sharing the same Redis instance.

---

## Author

Built by [Vitalii Kindrakevych](https://github.com/kindrakevich-agency).
MIT licensed.
