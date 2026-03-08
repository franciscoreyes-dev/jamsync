# Jamsync

> Collaborative playlists, in real time. Guests vote on songs — the most-wanted tracks land directly in the host's Spotify queue.

**[Live Demo](https://jamsync-iota.vercel.app)** · **[Backend API](https://jamsync-backend.railway.app)**

---

## What is this?

Jamsync lets a group of people collaboratively control what plays next at a party, office, or any shared listening session — without everyone needing a Spotify account.

The host logs in with Spotify and creates a room. Guests join instantly via link or QR code (no sign-up required). They search for songs and suggest them. When a track gets enough votes it automatically gets added to the host's Spotify queue. The host has a dashboard to adjust the vote threshold, remove suggestions, and mute spammy users.

Everything updates in real time for everyone in the room.

---

## Features

- **Host room with Spotify OAuth** — Authorization Code Flow, Spotify Premium required (needed for queue control)
- **Guest join with no account** — Guests get a random session ID stored in `localStorage`, no login needed
- **Real-time voting** — Socket.io keeps every client in sync; vote counts update live across all connected devices
- **Auto-approval** — When a track hits the vote threshold it gets pushed directly to Spotify's queue via `POST /me/player/queue`
- **Now Playing card** — A background poller detects what Spotify is playing every 10 seconds and broadcasts it to all guests
- **Recently Played history** — Tracks that move out of the queue get saved to a history list (last 20)
- **Host controls** — Adjust the vote threshold (1–10), remove a suggestion, mute/unmute a user
- **QR code** — Generated client-side for easy mobile joining
- **One room per host** — If a host tries to create another room while one is active, they get redirected to the existing one
- **Rate limiting** — 30 searches/min per IP, 5 rooms/hour per IP, duplicate votes blocked via Redis `SET`
- **Room cleanup** — Rooms older than 6 hours are automatically closed and cleaned up

---

## Tech Stack

### Frontend
| | |
|---|---|
| **Vue 3** | Composition API + `<script setup>` throughout. I picked Vue over React because I wanted to learn it properly and the `<script setup>` syntax is really clean for reactive state. |
| **Pinia** | One store per domain (room, queue, socket, user, toast). The setup-function syntax feels natural coming from Vue's Composition API. |
| **Tailwind CSS v4** | Utility-first styling with a dark theme (`zinc-950` background, `green-500` Spotify accent). |
| **shadcn-vue** | Copied and customised base components (Button, Card, Input, Badge, Slider). They live in `src/components/ui/` and are ours to modify. |
| **Socket.io-client v4** | Connected in the socket store with auto-reconnect logic (up to 3 attempts, 2s delay). |
| **Vue Router 4** | SPA routing with a `beforeEnter` guard on `/host/:id` that checks for a valid JWT. |
| **Vite** | Fast development builds. `vue-tsc` runs type checking before production builds. |

### Backend
| | |
|---|---|
| **Fastify v4** | HTTP framework. I chose it over Express because of its JSON schema validation, better TypeScript support, and the plugin architecture feels clean. |
| **Socket.io v4** | WebSocket server. The room-based broadcasting (`io.to(roomId).emit(...)`) maps perfectly to the domain. |
| **Redis (ioredis)** | All room state lives in Redis with 24-hour TTLs. I used native data structures: `HASH` for room metadata, `LIST` for the queue, `SET` for votes (prevents duplicates), `STRING` for now-playing tracking. |
| **Spotify Web API** | Direct `axios` calls, no SDK. Two separate auth flows: Authorization Code for the host, Client Credentials cached in Redis for guest searches. |
| **jsonwebtoken** | JWT sessions for the host. The token contains `hostId` (a random UUID that maps to the Redis session), never the Spotify token. |
| **TypeScript strict** | `strict: true` everywhere, zero `any`. |

### Infrastructure
| | |
|---|---|
| **Vercel** | Frontend — automatic deploys from `main`, config in `frontend/vercel.json` |
| **Railway** | Backend + Redis — config in `backend/railway.toml` |

---

## Architecture

```
┌─────────────────────────────────┐
│         Vue 3 SPA (Vercel)      │
│  HomeView · HostView · GuestView│
│  Pinia stores · Socket.io-client│
└──────────┬──────────────────────┘
           │ HTTP + WebSocket
┌──────────▼──────────────────────┐
│   Node.js + Fastify (Railway)   │
│  REST API  │  Socket.io server  │
│  /auth     │  join_room         │
│  /rooms    │  suggest_track     │
│  /spotify  │  vote_track        │
└──────┬─────┴────────────────────┘
       │
┌──────▼────────┐   ┌─────────────────┐
│ Redis         │   │ Spotify Web API  │
│ room HASH     │   │ OAuth / search   │
│ queue LIST    │   │ player queue     │
│ votes SET     │   │ currently playing│
│ history LIST  │   └─────────────────┘
└───────────────┘
```

**The two tricky parts I spent the most time on:**

1. **Two Spotify OAuth flows in the same app.** The host needs an Authorization Code flow (scoped access to their player). Guests just need to search, which only requires a Client Credentials token from the app itself — no user login. Keeping those two flows completely separate, with the host token never reaching the frontend, took careful design.

2. **The queue poller.** Spotify doesn't push events to your server when a track finishes. I had to poll `GET /me/player/currently-playing` every 10 seconds, compare the current URI with what I last stored in Redis, and decide: did the track change? Did a queue item get consumed? Is playback paused? Getting all those edge cases right — and writing tests for them — was genuinely hard.

---

## Local Setup

**Prerequisites:** Node.js 20+, a Redis instance, a Spotify Developer app

### 1. Clone

```bash
git clone https://github.com/yourusername/jamsync.git
cd jamsync
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# fill in your values (see Environment Variables below)
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
# create .env.local
echo "VITE_API_URL=http://localhost:3000" > .env.local
echo "VITE_FRONTEND_URL=http://localhost:5173" >> .env.local
npm run dev
```

### 4. Open

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3000

# Spotify Developer App credentials
# Create one at https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Must match exactly what's in your Spotify app's Redirect URIs
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback

# Random string, used to sign JWTs — keep it secret
JWT_SECRET=any_long_random_string

# Redis connection string
REDIS_URL=redis://localhost:6379

# The URL guests use to join (used for CORS and QR code generation)
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:3000
VITE_FRONTEND_URL=http://localhost:5173
```

### Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add `http://localhost:3000/auth/callback` to **Redirect URIs**
4. Add your own Spotify account to **User Management** (apps in Development Mode only allow 25 allowlisted users)
5. Make sure your account has **Spotify Premium** (required for queue control)

---

## Running Tests

```bash
# Backend (104 tests)
cd backend && npm test

# Frontend (131 tests)
cd frontend && npm test
```

Both suites use [Vitest](https://vitest.dev/). I wrote tests before implementation (TDD) for all backend services and socket handlers. Frontend tests use `@vue/test-utils` and mock the socket store.

---

## Project Structure

```
jamsync/
├── backend/
│   ├── src/
│   │   ├── routes/          # HTTP endpoints (auth, rooms, spotify)
│   │   ├── socket/          # Socket.io handlers + middleware
│   │   ├── services/        # Business logic (room, spotify, redis)
│   │   ├── jobs/            # queuePoller (10s) + roomCleanup (1h)
│   │   ├── lib/             # JWT, shared io reference, require-jwt
│   │   └── index.ts         # Server entry point
│   └── railway.toml
│
└── frontend/
    ├── src/
    │   ├── views/           # HomeView, HostView, GuestView, JoinView
    │   ├── stores/          # Pinia: socket, queue, room, user, toast
    │   ├── components/
    │   │   ├── ui/          # shadcn-vue base components
    │   │   ├── queue/       # SuggestionCard, QueueCard, NowPlayingCard, VoteButton
    │   │   ├── room/        # RoomHeader
    │   │   └── host/        # ThresholdSlider
    │   ├── composables/     # useSpotifySearch, useVoting
    │   ├── types/           # TypeScript interfaces for all WS events
    │   └── lib/             # axios instance, utils
    └── vercel.json
```

---

## What I Learned

This was my first project where I had to think seriously about **real-time state synchronisation**. When multiple clients are all looking at the same data and updating it simultaneously, things that seem simple on the surface (like "remove a suggestion when it gets approved") need careful thought — who owns the state, what's the source of truth, what happens if a client misses an event.

Using **Redis as the single source of truth** and only caching derived state on the frontend (in Pinia) made this tractable. Every WebSocket event carries enough data for clients to update themselves, and on reconnect they get the full room state again.

The **Spotify integration** taught me a lot about OAuth. Before this, I'd used libraries that abstracted it away. Implementing both the Authorization Code flow (with refresh tokens, premium verification, and scoped access) and the Client Credentials flow from scratch, keeping the host token server-side at all times, made OAuth actually click for me.

I also got serious about **TypeScript** here. `strict: true` everywhere, typed socket events, no `any`. At first it slowed me down. By the end, the type errors were catching real bugs.

---

## License

MIT
