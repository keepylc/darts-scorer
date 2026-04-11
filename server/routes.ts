import type { Express } from "express";
import { type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage, NotFoundError, ValidationError, ForbiddenError } from "./storage";
import {
  createGameSchema,
  submitTurnSchema,
  type GameState,
} from "@shared/schema";
import { ZodError } from "zod";

// ── Rate limiters ────────────────────────────────────────────────────

/** Strict limiter for game creation — prevent spam */
const createGameLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many games created, please try again later" },
});

/** General API limiter */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

// ── Share-code format guard ──────────────────────────────────────────

/** shareCode must be exactly 8 lowercase hex chars (matches crypto.randomBytes(4).toString("hex")) */
const SHARE_CODE_RE = /^[0-9a-f]{8}$/;
function isValidShareCode(code: string): boolean {
  return SHARE_CODE_RE.test(code);
}

/** Max concurrent long-poll waiters per game (prevents memory exhaustion) */
const MAX_WAITERS_PER_GAME = 30;

// ── Express augmentation for visitorId ───────────────────────────────

declare global {
  namespace Express {
    interface Request {
      visitorId?: string;
    }
  }
}

// ── Long-poll waiters (in-memory) ────────────────────────────────────

const waiters = new Map<string, Array<(state: GameState) => void>>();

function notifyGameUpdated(shareCode: string, state: GameState): void {
  const list = waiters.get(shareCode);
  if (list) {
    list.forEach((resolve) => resolve(state));
    waiters.delete(shareCode);
  }
}

// ── Route registration ───────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Middleware: extract X-Visitor-Id header + general rate limit
  app.use("/api", apiLimiter, (req, _res, next) => {
    req.visitorId = req.headers["x-visitor-id"] as string | undefined;
    next();
  });

  // ── POST /api/games — create game ──────────────────────────────

  app.post("/api/games", createGameLimiter, (req, res) => {
    try {
      const data = createGameSchema.parse(req.body);
      const result = storage.createGame(data);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ message: err.errors.map((e) => e.message).join("; ") });
      }
      throw err;
    }
  });

  // ── GET /api/games/:shareCode — full game state ────────────────

  app.get("/api/games/:shareCode", (req, res) => {
    if (!isValidShareCode(req.params.shareCode)) {
      return res.status(404).json({ message: "Game not found" });
    }
    const state = storage.getGameState(req.params.shareCode);
    if (!state) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json(state);
  });

  // ── POST /api/games/:shareCode/turns — submit turn ─────────────

  app.post("/api/games/:shareCode/turns", (req, res) => {
    if (!isValidShareCode(req.params.shareCode)) {
      return res.status(404).json({ message: "Game not found" });
    }
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

  // ── POST /api/games/:shareCode/undo — undo last turn ───────────

  app.post("/api/games/:shareCode/undo", (req, res) => {
    if (!isValidShareCode(req.params.shareCode)) {
      return res.status(404).json({ message: "Game not found" });
    }
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

  // ── GET /api/games/:shareCode/poll — long polling (C2/C3 fix) ──

  app.get("/api/games/:shareCode/poll", (req, res) => {
    const { shareCode } = req.params;

    if (!isValidShareCode(shareCode)) {
      return res.status(404).json({ message: "Game not found" });
    }

    const since = parseInt(req.query.since as string) || 0;

    const currentUpdatedAt = storage.getGameUpdatedAt(shareCode);
    if (currentUpdatedAt === undefined) {
      return res.status(404).json({ message: "Game not found" });
    }

    // Immediate return if there are new updates
    if (currentUpdatedAt > since) {
      const state = storage.getGameState(shareCode);
      return res.json(state);
    }

    // Reject if too many concurrent waiters (memory-exhaustion guard)
    if ((waiters.get(shareCode)?.length ?? 0) >= MAX_WAITERS_PER_GAME) {
      return res.status(429).json({ message: "Too many concurrent connections" });
    }

    // Long poll: wait up to 25 seconds for an update
    // TDZ fix (C2): declare resolve first, then removeWaiter, then timeout

    const resolve = (state: GameState) => {
      removeWaiter();
      if (!res.headersSent) {
        res.json(state);
      }
    };

    const removeWaiter = () => {
      const list = waiters.get(shareCode);
      if (list) {
        const idx = list.indexOf(resolve);
        if (idx !== -1) list.splice(idx, 1);
      }
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      removeWaiter();
      if (!res.headersSent) {
        res.json({ noChange: true });
      }
    }, 25_000);

    // Register waiter
    if (!waiters.has(shareCode)) waiters.set(shareCode, []);
    waiters.get(shareCode)!.push(resolve);

    // Clean up if client disconnects
    req.on("close", removeWaiter);
  });

  return httpServer;
}
