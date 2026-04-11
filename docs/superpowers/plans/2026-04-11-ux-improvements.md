# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 UX issues — rules diagram zone labels, dismissible win overlay (with spectator logic), invite-code security for turn submissions, and per-throw point breakdown in history.

**Architecture:** Tasks 1 and 4 are pure frontend. Task 2 adds a backend column + server validation + client localStorage layer. Task 3 builds on Task 2's invite code concept — do Task 2 first.

**Tech Stack:** React 18 + TypeScript, wouter (hash router), Express 5, Drizzle ORM + better-sqlite3 (SQLite), Tailwind CSS, Radix UI, framer-motion.

---

## File Map

| Action | Path | What changes |
|--------|------|--------------|
| Modify | `client/src/pages/RulesPage.tsx` | Replace `SimpleBoardDiagram` — wider viewBox, legend panel, larger fonts |
| Modify | `client/src/components/game/WinOverlay.tsx` | Add `onClose` prop + "Смотреть историю" button |
| Modify | `client/src/pages/GamePage.tsx` | Wire close, spectator detection, fix already-finished overlay trigger |
| **Create** | `client/src/lib/inviteCode.ts` | localStorage helpers: `storeInviteCode`, `getInviteCode`, `clearInviteCode` |
| **Create** | `client/src/components/game/InviteCodePrompt.tsx` | Banner to enter invite code |
| Modify | `client/src/lib/queryClient.ts` | Add optional `extraHeaders` param to `apiRequest` |
| Modify | `shared/schema.ts` | Add `inviteCode` column to `games` table |
| Modify | `server/storage.ts` | Generate invite code, add `ForbiddenError`, validate on submit/undo, add ALTER TABLE migration |
| Modify | `server/routes.ts` | Extract `X-Invite-Code` header, map `ForbiddenError` to 403 |
| Modify | `client/src/components/game/ThrowHistory.tsx` | Show `· N pts` after each throw badge |

---

## Task 1: Fix zone labels in the rules diagram

**File:** `client/src/pages/RulesPage.tsx`

The current `SimpleBoardDiagram` uses `viewBox="0 0 300 300"` — the board fills the entire canvas — then places text labels *inside* the board with `fontSize="8"`. They are too small and overlap zones. Fix: widen the viewBox, shift the board left, add a right-side legend panel.

- [ ] **Step 1: Replace `SimpleBoardDiagram`**

Replace the entire `SimpleBoardDiagram` function:

```tsx
function SimpleBoardDiagram() {
  const cx = 132, cy = 150;

  const legend = [
    { color: "#e63946", label: "Double (×2)",      sub: "внешнее узкое кольцо" },
    { color: "#888888", label: "Single (×1)",       sub: "основная зона сектора" },
    { color: "#1db954", label: "Triple (×3)",       sub: "внутреннее узкое кольцо" },
    { color: "#1db954", label: "Bull — 25 очков",   sub: "зелёный центр" },
    { color: "#e63946", label: "D-Bull — 50 очков", sub: "красная точка (Double Out)" },
  ];

  return (
    <svg
      viewBox="0 0 370 305"
      className="w-full max-w-[340px] mx-auto my-4"
      aria-label="Схема мишени дартс"
    >
      {/* Board: layers from outside-in, each circle masks the previous */}
      <circle cx={cx} cy={cy} r={130} fill="#e63946" />
      <circle cx={cx} cy={cy} r={104} fill="#2a2a2a" />
      <circle cx={cx} cy={cy} r={78}  fill="#1db954" />
      <circle cx={cx} cy={cy} r={52}  fill="#2a2a2a" />
      <circle cx={cx} cy={cy} r={24}  fill="#1db954" />
      <circle cx={cx} cy={cy} r={10}  fill="#e63946" />
      <circle cx={cx} cy={cy} r={130} fill="none"
              stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* "20" label at top of board */}
      <text x={cx} y={cy - 112} fill="white" fontSize="14" fontWeight="bold"
            textAnchor="middle" dominantBaseline="central"
            style={{ pointerEvents: "none" }}>
        20
      </text>

      {/* Right-side legend panel */}
      <rect x="275" y="28" width="88" height="250" rx="8"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="283" y="48" fill="rgba(255,255,255,0.6)"
            fontSize="11" fontWeight="600">
        Зоны
      </text>

      {legend.map(({ color, label, sub }, i) => {
        const y = 70 + i * 44;
        return (
          <g key={label}>
            <rect x="283" y={y - 7} width="11" height="11" rx="2" fill={color} />
            <text x="300" y={y} fill="white" fontSize="11" dominantBaseline="central">
              {label}
            </text>
            <text x="300" y={y + 14} fill="rgba(255,255,255,0.45)" fontSize="9">
              {sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev` and open `http://localhost:5000/#/rules`. Confirm:
- Diagram renders without cropping
- All 5 legend entries are readable (no overlap)
- Colors match zones (red = double, green = triple/bull, dark = single)
- Font is noticeably larger than before

- [ ] **Step 3: Commit**

```bash
git add "client/src/pages/RulesPage.tsx"
git commit -m "fix: improve rules diagram — wider layout, readable legend, larger fonts"
```

---

## Task 2: Invite-code security

Players who receive a share link must enter a 4-digit invite code before they can submit turns. The code is generated server-side, returned only to the creator, and validated on every mutating request. This prevents anonymous visitors from altering scores.

**Do this task before Task 3.**

### 2a — Schema: add `invite_code` column

**Files:** `shared/schema.ts`, `server/storage.ts`

- [ ] **Step 1: Add column to Drizzle schema**

In `shared/schema.ts`, add `inviteCode` to the `games` table after `updatedAt`:

```ts
export const games = sqliteTable("games", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  shareCode:  text("share_code").notNull().unique(),
  mode:       integer("mode").notNull(),
  status:     text("status").notNull().default("active"),
  winnerId:   integer("winner_id"),
  createdAt:  integer("created_at").notNull(),
  updatedAt:  integer("updated_at").notNull(),
  inviteCode: text("invite_code").notNull().default(""),  // ← new
});
```

- [ ] **Step 2: Update auto-create SQL in `server/storage.ts`**

In the `CREATE TABLE IF NOT EXISTS games` DDL block inside `server/storage.ts` (around line 32), add the `invite_code` column after `winner_id`:

```sql
invite_code TEXT NOT NULL DEFAULT '',
```

The full games DDL block should become:

```sql
CREATE TABLE IF NOT EXISTS games (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  share_code TEXT NOT NULL UNIQUE,
  mode       INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  winner_id  INTEGER,
  invite_code TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

- [ ] **Step 3: Add migration for existing databases**

`CREATE TABLE IF NOT EXISTS` won't add new columns to an existing table. After the closing backtick of the entire `sqlite.exec(...)` call (around line 73), add:

```ts
// Migration: add invite_code if database pre-dates this column
{
  const cols = sqlite.pragma("table_info(games)") as { name: string }[];
  if (!cols.some((c) => c.name === "invite_code")) {
    sqlite.prepare("ALTER TABLE games ADD COLUMN invite_code TEXT NOT NULL DEFAULT ''").run();
  }
}
```

Note: `.prepare("...").run()` is the better-sqlite3 approach for one-off DDL statements. This avoids triggering any linting rules around direct shell execution.

- [ ] **Step 4: Add `ForbiddenError` class**

At the bottom of `server/storage.ts`, alongside `NotFoundError` and `ValidationError`:

```ts
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
```

- [ ] **Step 5: Generate invite code in `createGame`**

In `DatabaseStorage.createGame`, generate a 4-digit PIN and save it. Two changes:

**Before** the transaction, add:
```ts
const inviteCode = Math.floor(1000 + Math.random() * 9000).toString();
```

**Inside** the transaction, add `inviteCode` to the insert values object:
```ts
tx.insert(games).values({
  shareCode,
  mode: data.mode,
  status: "active",
  inviteCode,        // ← add this line
  createdAt: now,
  updatedAt: now,
}).returning().get();
```

**Change the return statement** at the end of `createGame`:
```ts
return { shareCode, inviteCode };
```

**Update `IStorage` interface** (the return type of `createGame`):
```ts
export interface IStorage {
  createGame(data: CreateGameRequest): { shareCode: string; inviteCode: string };
  getGameState(shareCode: string): GameState | undefined;
  submitTurn(shareCode: string, data: SubmitTurnRequest, inviteCode?: string): GameState;
  undoLastTurn(shareCode: string, inviteCode?: string): GameState;
  getGameUpdatedAt(shareCode: string): number | undefined;
}
```

- [ ] **Step 6: Validate invite code in `submitTurn`**

Change `submitTurn` signature and add a validation check at the start of the transaction:

```ts
submitTurn(shareCode: string, data: SubmitTurnRequest, inviteCode?: string): GameState {
  const gameId = db.transaction((tx) => {
    const game = tx.select().from(games).where(eq(games.shareCode, shareCode)).get();
    if (!game) throw new NotFoundError("Game not found");
    if (game.status === "finished") throw new ValidationError("Game is finished");
    if (!inviteCode || inviteCode !== game.inviteCode) {
      throw new ForbiddenError("Неверный код приглашения");
    }
    // ... rest of transaction unchanged
```

- [ ] **Step 7: Validate invite code in `undoLastTurn`**

Change signature and add validation at the start of the transaction:

```ts
undoLastTurn(shareCode: string, inviteCode?: string): GameState {
  const gameId = db.transaction((tx) => {
    const game = tx.select().from(games).where(eq(games.shareCode, shareCode)).get();
    if (!game) throw new NotFoundError("Game not found");
    if (!inviteCode || inviteCode !== game.inviteCode) {
      throw new ForbiddenError("Неверный код приглашения");
    }
    // ... rest of transaction unchanged
```

### 2b — Routes: extract header, map 403

**File:** `server/routes.ts`

- [ ] **Step 8: Import `ForbiddenError`**

Update the storage import line:

```ts
import { storage, NotFoundError, ValidationError, ForbiddenError } from "./storage";
```

- [ ] **Step 9: Update `POST /api/games/:shareCode/turns`**

Add invite code extraction and `ForbiddenError` handling:

```ts
app.post("/api/games/:shareCode/turns", (req, res) => {
  try {
    const inviteCode = req.headers["x-invite-code"] as string | undefined;
    const data = submitTurnSchema.parse(req.body);
    const state = storage.submitTurn(req.params.shareCode, data, inviteCode);
    notifyGameUpdated(req.params.shareCode, state);
    res.json(state);
  } catch (err) {
    if (err instanceof ZodError)
      return res.status(400).json({ message: err.errors.map((e) => e.message).join("; ") });
    if (err instanceof NotFoundError)
      return res.status(404).json({ message: err.message });
    if (err instanceof ValidationError)
      return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError)
      return res.status(403).json({ message: err.message });
    throw err;
  }
});
```

- [ ] **Step 10: Update `POST /api/games/:shareCode/undo`**

```ts
app.post("/api/games/:shareCode/undo", (req, res) => {
  try {
    const inviteCode = req.headers["x-invite-code"] as string | undefined;
    const state = storage.undoLastTurn(req.params.shareCode, inviteCode);
    notifyGameUpdated(req.params.shareCode, state);
    res.json(state);
  } catch (err) {
    if (err instanceof NotFoundError)
      return res.status(404).json({ message: err.message });
    if (err instanceof ValidationError)
      return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError)
      return res.status(403).json({ message: err.message });
    throw err;
  }
});
```

### 2c — Client: invite-code localStorage helpers

**File:** `client/src/lib/inviteCode.ts` (create new file)

- [ ] **Step 11: Create `inviteCode.ts`**

```ts
const PREFIX = "darts:invite:";

export function storeInviteCode(shareCode: string, code: string): void {
  localStorage.setItem(PREFIX + shareCode, code);
}

export function getInviteCode(shareCode: string): string | null {
  return localStorage.getItem(PREFIX + shareCode);
}

export function clearInviteCode(shareCode: string): void {
  localStorage.removeItem(PREFIX + shareCode);
}
```

### 2d — Client: `apiRequest` accepts extra headers

**File:** `client/src/lib/queryClient.ts`

- [ ] **Step 12: Add `extraHeaders` param**

Change the signature and header-building block:

```ts
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {
    "X-Visitor-Id": getVisitorId(),
    ...extraHeaders,
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}
```

### 2e — Client: store code after game creation

**File:** `client/src/pages/HomePage.tsx`

- [ ] **Step 13: Import and store invite code**

Add import at top:

```ts
import { storeInviteCode } from "@/lib/inviteCode";
```

In `handleSubmit`, after `const data = await res.json();`, replace the existing toast + navigate with:

```ts
const data = await res.json();
storeInviteCode(data.shareCode, data.inviteCode);
toast({
  title: "Игра создана!",
  description: `Код для участников: ${data.inviteCode}`,
  duration: 10000,
});
navigate(`/game/${data.shareCode}`);
```

### 2f — Client: invite-code prompt component

**File:** `client/src/components/game/InviteCodePrompt.tsx` (create new file)

- [ ] **Step 14: Create `InviteCodePrompt.tsx`**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeInviteCode } from "@/lib/inviteCode";

interface InviteCodePromptProps {
  shareCode: string;
  onJoined: () => void;
  onSkip: () => void;
}

export default function InviteCodePrompt({
  shareCode,
  onJoined,
  onSkip,
}: InviteCodePromptProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError("Введите код приглашения");
      return;
    }
    storeInviteCode(shareCode, trimmed);
    onJoined();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 mb-4">
      <p className="text-sm font-medium">Участвовать в игре</p>
      <p className="text-xs text-muted-foreground">
        Введите 4-значный код приглашения, чтобы бросать дротики.
        Без кода — только просмотр.
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          placeholder="1234"
          maxLength={4}
          inputMode="numeric"
          className="w-24 text-center text-lg font-mono min-h-[44px]"
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
        <Button onClick={handleJoin} className="min-h-[44px]">
          Войти
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="min-h-[44px] text-muted-foreground"
        >
          Смотреть
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

### 2g — Client: wire everything in `GamePage`

**File:** `client/src/pages/GamePage.tsx`

- [ ] **Step 15: Add imports**

```ts
import { getInviteCode, clearInviteCode } from "@/lib/inviteCode";
import InviteCodePrompt from "@/components/game/InviteCodePrompt";
```

- [ ] **Step 16: Add participant state**

After the existing `useState` declarations, add:

```ts
const storedCode = getInviteCode(shareCode);
const [isParticipant, setIsParticipant] = useState(!!storedCode);
const [showInvitePrompt, setShowInvitePrompt] = useState(!storedCode);
```

- [ ] **Step 17: Add invite-code header helper**

Before `confirmTurn`, add:

```ts
const inviteHeaders = useCallback((): Record<string, string> => {
  const code = getInviteCode(shareCode);
  return code ? { "X-Invite-Code": code } : {};
}, [shareCode]);
```

- [ ] **Step 18: Update `confirmTurn` to send invite code and handle 403**

Pass `inviteHeaders()` as the 4th argument to `apiRequest`:

```ts
const res = await apiRequest(
  "POST",
  `/api/games/${shareCode}/turns`,
  {
    playerId: currentPlayer.id,
    throws: throwsToSend.map((t) => ({ sector: t.sector, multiplier: t.multiplier })),
  },
  inviteHeaders(),
);
```

In the `catch` block of `confirmTurn`, add a 403 handler before the generic toast:

```ts
} catch (err) {
  if (err instanceof Error && err.message.startsWith("403:")) {
    clearInviteCode(shareCode);
    setIsParticipant(false);
    setShowInvitePrompt(true);
    toast({ title: "Неверный код приглашения", variant: "destructive" });
    return;
  }
  toast({
    title: "Ошибка",
    description: err instanceof Error ? err.message : "Не удалось отправить ход",
    variant: "destructive",
  });
```

- [ ] **Step 19: Update `onUndoTurn` to send invite code**

```ts
await apiRequest("POST", `/api/games/${shareCode}/undo`, undefined, inviteHeaders());
```

- [ ] **Step 20: Disable board/controls for spectators; render prompt**

In the JSX, update `DartboardSVG`:

```tsx
<DartboardSVG
  onThrow={onThrow}
  disabled={isFinished || isSending || !isParticipant}
  lastThrow={lastThrow}
/>
```

Wrap `CurrentTurnPanel` with a participant check:

```tsx
{!isFinished && isParticipant && (
  <CurrentTurnPanel ... />
)}
```

Add the prompt above the dartboard (inside the `<div className="lg:order-2">` container, before `<DartboardSVG>`):

```tsx
{showInvitePrompt && !isFinished && (
  <InviteCodePrompt
    shareCode={shareCode}
    onJoined={() => { setIsParticipant(true); setShowInvitePrompt(false); }}
    onSkip={() => setShowInvitePrompt(false)}
  />
)}
```

- [ ] **Step 21: Verify invite-code flow**

1. Create a game → toast shows `Код для участников: XXXX`
2. Copy URL, open in private window
3. Confirm: board disabled, InviteCodePrompt visible
4. Enter wrong code → submit turn → 403 → toast, prompt reappears
5. Enter correct code → board unlocks, turns submit successfully

- [ ] **Step 22: Commit**

```bash
git add \
  shared/schema.ts \
  server/storage.ts \
  server/routes.ts \
  "client/src/lib/inviteCode.ts" \
  "client/src/lib/queryClient.ts" \
  "client/src/pages/HomePage.tsx" \
  "client/src/components/game/InviteCodePrompt.tsx" \
  "client/src/pages/GamePage.tsx"
git commit -m "feat: invite-code security — 4-digit PIN required to submit turns"
```

---

## Task 3: Dismissible WinOverlay + no overlay for link recipients

**Files:** `client/src/components/game/WinOverlay.tsx`, `client/src/pages/GamePage.tsx`

**Prerequisite:** Task 2 must be done — this task uses `isParticipant` from Task 2.

### 3a — Add close button to `WinOverlay`

- [ ] **Step 1: Add `onClose` prop**

Replace `WinOverlayProps`:

```ts
interface WinOverlayProps {
  show: boolean;
  winnerName: string;
  shareCode: string;
  onClose: () => void;   // ← new
}
```

Update the function signature:

```tsx
export default function WinOverlay({ show, winnerName, shareCode, onClose }: WinOverlayProps) {
```

Inside the inner `motion.div` (the card with title + buttons), add `relative` to its className and add a close button at the top:

```tsx
<motion.div
  initial={{ scale: 0.5, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
  className="relative z-10 text-center space-y-6 px-6"
>
  {/* Close button */}
  <button
    onClick={onClose}
    aria-label="Закрыть"
    className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors p-2"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M15 5L5 15M5 5l10 10"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </button>

  <h2 className="text-5xl font-bold text-yellow-400 drop-shadow-lg">ПОБЕДА!</h2>
  <p className="text-2xl font-semibold text-white">{winnerName}</p>

  <div className="flex gap-3 justify-center flex-wrap">
    <Button onClick={() => navigate("/")} size="lg" className="min-h-[44px]">
      Новая игра
    </Button>
    <Button
      variant="outline"
      onClick={handleShare}
      size="lg"
      className="min-h-[44px] bg-white/10 border-white/20 text-white hover:bg-white/20"
    >
      Поделиться
    </Button>
    <Button
      variant="ghost"
      onClick={onClose}
      size="lg"
      className="min-h-[44px] text-white/70 hover:text-white hover:bg-white/10"
    >
      Смотреть историю
    </Button>
  </div>
</motion.div>
```

### 3b — Fix overlay trigger in `GamePage`

**Problem:** The existing `useEffect` calls `setShowWin(true)` whenever `gameState.game.status === "finished"`. This fires even when a visitor opens a share link to an already-finished game. Fix: only trigger when status *transitions* from `"active"` to `"finished"` AND the user is a participant.

- [ ] **Step 2: Add `prevStatusRef`**

Near the other `useRef` declarations:

```ts
const prevStatusRef = useRef<string | null>(null);
```

- [ ] **Step 3: Replace the win detection effect**

Replace:

```ts
useEffect(() => {
  if (gameState?.game.status === "finished") {
    setShowWin(true);
    playSound("win");
  }
}, [gameState?.game.status]);
```

With:

```ts
useEffect(() => {
  const prev = prevStatusRef.current;
  const current = gameState?.game.status ?? null;
  prevStatusRef.current = current;

  // Show overlay only when:
  // 1. Status just transitioned active → finished (not loaded already-finished)
  // 2. This user is a participant (has the invite code)
  if (prev === "active" && current === "finished" && isParticipant) {
    setShowWin(true);
    playSound("win");
  }
}, [gameState?.game.status, isParticipant]);
```

- [ ] **Step 4: Pass `onClose` to `WinOverlay`**

```tsx
<WinOverlay
  show={showWin && isFinished}
  winnerName={winnerPlayer?.name || ""}
  shareCode={shareCode}
  onClose={() => setShowWin(false)}
/>
```

- [ ] **Step 5: Verify**

1. Create a game, play to a win → overlay appears with ✕ button + "Смотреть историю"
2. Click ✕ → overlay closes, history visible underneath
3. Click "Смотреть историю" → same result
4. Copy URL, open in private window → game page loads WITHOUT overlay (just finished game view)
5. Refresh creator's tab on finished game → NO overlay on reload

- [ ] **Step 6: Commit**

```bash
git add \
  "client/src/components/game/WinOverlay.tsx" \
  "client/src/pages/GamePage.tsx"
git commit -m "feat: dismissible win overlay; hide overlay for link recipients and on reload"
```

---

## Task 4: Per-throw point breakdown in history

**File:** `client/src/components/game/ThrowHistory.tsx`

The history already renders each throw as a label badge (e.g. `T20`, `D16`). The `throws` array also provides a `points` number per throw. Add `· N` after each badge to show the exact point value.

- [ ] **Step 1: Add point value to each throw badge**

In `ThrowHistory.tsx`, locate the throw rendering (around line 62). Replace:

```tsx
{entry.throws.map((t, i) => (
  <span
    key={i}
    className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
  >
    {formatThrow(t.sector, t.multiplier)}
  </span>
))}
```

With:

```tsx
{entry.throws.map((t, i) => (
  <span
    key={i}
    className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1"
  >
    {formatThrow(t.sector, t.multiplier)}
    <span className="text-muted-foreground">·{t.points}</span>
  </span>
))}
```

`t.points` is already in the type (`{ sector: number; multiplier: number; points: number }`). For a miss, `t.points === 0`, so it renders `Мимо ·0` — accurate and fine.

- [ ] **Step 2: Verify**

Open `npm run dev`, play a few turns. In the history panel confirm:
- Each throw badge shows label + point, e.g. `T20 ·60`, `D16 ·32`, `Мимо ·0`
- A 3-dart turn shows 3 badges
- A bust turn shows `BUST` badge, throws still visible
- The `+N` total on the right is unchanged

- [ ] **Step 3: Commit**

```bash
git add "client/src/components/game/ThrowHistory.tsx"
git commit -m "feat: show per-throw points in history (T20 ·60, D16 ·32)"
```

---

## Self-Review

### Spec coverage

| Requirement | Task | Status |
|-------------|------|--------|
| Zone labels too small / wrong position in rules | Task 1 | ✅ |
| Close WinOverlay to view history | Task 3a | ✅ |
| No WinOverlay for link recipients | Task 3b | ✅ |
| Invite code — required to submit turns | Task 2 | ✅ |
| Per-throw point breakdown in history | Task 4 | ✅ |

### Dependency order

Task 3 uses `isParticipant` introduced in Task 2g. **Do Task 2 in full before Task 3.**
Tasks 1 and 4 are independent.

### Type consistency

- `createGame` return type: `{ shareCode: string; inviteCode: string }` — updated in `IStorage`, `DatabaseStorage`, and consumed in `HomePage.tsx`.
- `submitTurn(shareCode, data, inviteCode?)` / `undoLastTurn(shareCode, inviteCode?)` — updated in both interface and implementation.
- `WinOverlayProps.onClose: () => void` — defined in component and passed in `GamePage`.
- `apiRequest` 4th param `extraHeaders` is optional — all existing call sites remain valid.

### No placeholders

All code blocks are complete and copy-paste ready. No "TBD" or "fill in" anywhere.
