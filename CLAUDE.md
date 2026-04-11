# Darts Scorer

Web app for scoring X01 darts games (301/501/701) with an interactive SVG dartboard.

## Commands

```bash
npm run dev        # Dev server on port 5000 (Express + Vite HMR)
npm run build      # Production build → dist/
npm start          # Run production build (NODE_ENV=production)
npm run check      # TypeScript type check
npm run db:push    # Push schema changes to SQLite (drizzle-kit)
```

## Architecture

Monorepo — single `package.json`, single Express server serves both API and frontend.

```
client/         React + Vite frontend
  src/
    components/game/   Game UI components (DartboardSVG, PlayerScoreboard, …)
    pages/             HomePage, GamePage, RulesPage
    hooks/             useGamePolling (long-poll), use-mobile, use-toast
    lib/               dartUtils, queryClient, sounds, types
server/
  index.ts       Express entry point, port 5000 (dev) / $PORT (prod)
  routes.ts      API routes + long-poll waiters
  storage.ts     DatabaseStorage (synchronous, Drizzle + better-sqlite3)
  gameLogic.ts   Pure bust-check, finish table, player index logic
shared/
  schema.ts      Drizzle schema + Zod DTOs shared between client and server
```

## Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@/` | `client/src/` |
| `@shared` | `shared/` |
| `@assets` | `attached_assets/` |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/games` | Create game (`{ mode, playerNames }`) |
| GET | `/api/games/:shareCode` | Full `GameState` |
| POST | `/api/games/:shareCode/turns` | Submit turn (`{ playerId, throws[] }`) |
| POST | `/api/games/:shareCode/undo` | Undo last turn |
| GET | `/api/games/:shareCode/poll?since=<ts>` | Long-poll for updates (25 s timeout) |

## Database

SQLite via **better-sqlite3** + **Drizzle ORM**. All storage operations are **synchronous** (no async/await in `storage.ts`).

- Default path: `data.db` in project root; override with `DATABASE_PATH` env var
- Docker uses a named volume mounted at `/app/data/darts.db`
- WAL mode enabled on startup
- Tables are auto-created with `CREATE TABLE IF NOT EXISTS` on startup (no migration runner needed)
- `drizzle.config.ts` points to `./shared/schema.ts` and `./migrations/` (for `db:push`)

## Game Logic Gotchas

All game rules live in `server/gameLogic.ts` (pure functions, no DB access):

- **Bust conditions** (in `isBustCheck`):
  - Score goes negative → bust
  - Score lands on exactly `1` → bust (can't finish with a double from 1)
  - Score reaches `0` on a non-double → bust
- **Win condition**: score reaches exactly `0` on a double (including Double Bull)
- **Bust throw**: the bust throw itself is recorded in `validThrows` but `totalPoints = 0` and score reverts
- **Extra throws after bust**: rejected with a `ValidationError` — client must not send them
- **Finish table**: pre-computed at startup for scores 2–170, up to 3 darts, always ending on a double; scores 163, 165, 166, 168, 169 have no finish

## Real-time Updates

Uses **long-polling** (not WebSockets). `GET /api/games/:shareCode/poll?since=<updatedAt>`:
- Returns immediately if `updatedAt > since`
- Otherwise waits up to 25 s for `notifyGameUpdated()` to fire
- Returns `{ noChange: true }` on timeout
- Client hook: `client/src/hooks/useGamePolling.ts`

## Docker

```bash
docker compose up          # Builds and runs on port 3000
PORT=8080 docker compose up  # Custom port
```

Volume `darts-data` persists the SQLite database across container restarts.

## Key Types (`shared/schema.ts`)

- `GameState` — full response shape returned by all mutating API endpoints
- `CreateGameRequest` — `{ mode: 301|501|701, playerNames: string[] }` (2–8 players)
- `SubmitTurnRequest` — `{ playerId, throws: [{ sector, multiplier }] }` (1–3 throws)
- `sector`: `0` (miss), `1–20`, `25` (bull); `multiplier`: `0` (miss), `1`, `2`, `3`
- Triple Bull (`sector=25, multiplier=3`) is invalid — rejected by Zod schema
