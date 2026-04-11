import crypto from "crypto";
import {
  type CreateGameRequest,
  type SubmitTurnRequest,
  type GameState,
  type Game,
  type Player,
  games,
  players,
  turns,
  throws_,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import {
  throwPoints,
  isBustCheck,
  getCurrentPlayerIndex,
  getSuggestedFinish,
} from "./gameLogic";

// ── Database setup ───────────────────────────────────────────────────

const dbPath = process.env.DATABASE_PATH || "data.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Auto-create tables on startup (C2 fix — fresh Docker containers have empty DB)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_code TEXT NOT NULL UNIQUE,
    mode INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    winner_id INTEGER,
    invite_code TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    score INTEGER NOT NULL,
    darts_thrown INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    turn_number INTEGER NOT NULL,
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    points_scored INTEGER NOT NULL,
    is_bust INTEGER NOT NULL DEFAULT 0,
    is_win INTEGER NOT NULL DEFAULT 0,
    darts_in_turn INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS throws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    throw_index INTEGER NOT NULL,
    sector INTEGER NOT NULL,
    multiplier INTEGER NOT NULL,
    points INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Migration: add invite_code if database pre-dates this column
{
  const cols = sqlite.pragma("table_info(games)") as { name: string }[];
  if (!cols.some((c) => c.name === "invite_code")) {
    sqlite.prepare("ALTER TABLE games ADD COLUMN invite_code TEXT NOT NULL DEFAULT ''").run();
  }
}

// ── Synchronous storage interface (C1 fix — no Promise/async) ────────

export interface IStorage {
  createGame(data: CreateGameRequest): { shareCode: string; inviteCode: string };
  getGameState(shareCode: string): GameState | undefined;
  submitTurn(shareCode: string, data: SubmitTurnRequest, inviteCode?: string): GameState;
  undoLastTurn(shareCode: string, inviteCode?: string): GameState;
  getGameUpdatedAt(shareCode: string): number | undefined;
}

// ── DatabaseStorage implementation ───────────────────────────────────

export class DatabaseStorage implements IStorage {
  // ── Create game ──────────────────────────────────────────────────

  createGame(data: CreateGameRequest): { shareCode: string; inviteCode: string } {
    const shareCode = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    const inviteCode = Math.floor(1000 + Math.random() * 9000).toString();
    const now = Date.now();

    // Run inside a transaction for atomicity
    db.transaction((tx) => {
      const game = tx
        .insert(games)
        .values({
          shareCode,
          mode: data.mode,
          status: "active",
          inviteCode,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      for (let i = 0; i < data.playerNames.length; i++) {
        tx.insert(players)
          .values({
            gameId: game.id,
            name: data.playerNames[i],
            orderIndex: i,
            score: data.mode,
            dartsThrown: 0,
            totalPoints: 0,
          })
          .run();
      }
    });

    return { shareCode, inviteCode };
  }

  // ── Get game state ───────────────────────────────────────────────

  getGameState(shareCode: string): GameState | undefined {
    const game = db
      .select()
      .from(games)
      .where(eq(games.shareCode, shareCode))
      .get();
    if (!game) return undefined;
    return this.buildGameState(game);
  }

  // ── Submit turn ──────────────────────────────────────────────────

  submitTurn(shareCode: string, data: SubmitTurnRequest, inviteCode?: string): GameState {
    // C1 fix: run mutation in transaction, build state after commit
    const gameId = db.transaction((tx) => {
      const game = tx
        .select()
        .from(games)
        .where(eq(games.shareCode, shareCode))
        .get();
      if (!game) throw new NotFoundError("Game not found");
      if (game.status === "finished")
        throw new ValidationError("Game is finished");
      if (!inviteCode || inviteCode !== game.inviteCode) {
        throw new ForbiddenError("Неверный код приглашения");
      }

      // Determine current player
      const gamePlayers = tx
        .select()
        .from(players)
        .where(eq(players.gameId, game.id))
        .orderBy(asc(players.orderIndex))
        .all();

      const turnCount = tx
        .select({ count: sql<number>`count(*)` })
        .from(turns)
        .where(eq(turns.gameId, game.id))
        .get()!.count;

      const currentIndex = getCurrentPlayerIndex(turnCount, gamePlayers.length);
      const currentPlayer = gamePlayers[currentIndex];

      if (data.playerId !== currentPlayer.id) {
        throw new ValidationError("Not this player's turn");
      }

      // Compute throw points and check bust iteratively
      const throwInputs = data.throws.map((t) => ({
        sector: t.sector,
        multiplier: t.multiplier,
      }));

      const result = isBustCheck(currentPlayer.score, throwInputs);

      // Reject extra throws after bust
      if (result.validThrows.length < data.throws.length) {
        throw new ValidationError(
          "Extra throws after bust are not allowed",
        );
      }

      const now = Date.now();
      const isWin = !result.isBust && result.newScore === 0;
      const dartsInTurn = result.validThrows.length;

      // Create turn record
      const turn = tx
        .insert(turns)
        .values({
          gameId: game.id,
          playerId: currentPlayer.id,
          turnNumber: turnCount,
          scoreBefore: currentPlayer.score,
          scoreAfter: result.newScore,
          pointsScored: result.totalPoints,
          isBust: result.isBust,
          isWin,
          dartsInTurn,
          createdAt: now,
        })
        .returning()
        .get();

      // Create throw records
      for (let i = 0; i < result.validThrows.length; i++) {
        const t = result.validThrows[i];
        tx.insert(throws_)
          .values({
            turnId: turn.id,
            throwIndex: i,
            sector: t.sector,
            multiplier: t.multiplier,
            points: throwPoints(t.sector, t.multiplier),
            createdAt: now,
          })
          .run();
      }

      // Update player stats
      tx.update(players)
        .set({
          score: result.newScore,
          dartsThrown: currentPlayer.dartsThrown + dartsInTurn,
          totalPoints: currentPlayer.totalPoints + result.totalPoints,
        })
        .where(eq(players.id, currentPlayer.id))
        .run();

      // Handle win
      if (isWin) {
        tx.update(games)
          .set({
            status: "finished",
            winnerId: currentPlayer.id,
            updatedAt: now,
          })
          .where(eq(games.id, game.id))
          .run();
      } else {
        tx.update(games)
          .set({ updatedAt: now })
          .where(eq(games.id, game.id))
          .run();
      }

      return game.id;
    });

    // Build state after transaction is committed — reads committed data
    const updatedGame = db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .get()!;
    return this.buildGameState(updatedGame);
  }

  // ── Undo last turn ───────────────────────────────────────────────

  undoLastTurn(shareCode: string, inviteCode?: string): GameState {
    // C1 fix: run mutation in transaction, build state after commit
    const gameId = db.transaction((tx) => {
      const game = tx
        .select()
        .from(games)
        .where(eq(games.shareCode, shareCode))
        .get();
      if (!game) throw new NotFoundError("Game not found");
      if (!inviteCode || inviteCode !== game.inviteCode) {
        throw new ForbiddenError("Неверный код приглашения");
      }

      // Find last turn
      const lastTurn = tx
        .select()
        .from(turns)
        .where(eq(turns.gameId, game.id))
        .orderBy(desc(turns.turnNumber))
        .get();
      if (!lastTurn) throw new ValidationError("No turns to undo");

      // Get player
      const player = tx
        .select()
        .from(players)
        .where(eq(players.id, lastTurn.playerId))
        .get()!;

      // Restore player state
      tx.update(players)
        .set({
          score: lastTurn.scoreBefore,
          dartsThrown: player.dartsThrown - lastTurn.dartsInTurn,
          totalPoints: player.totalPoints - lastTurn.pointsScored,
        })
        .where(eq(players.id, player.id))
        .run();

      // If this was a winning turn, revert game status
      const now = Date.now();
      if (lastTurn.isWin) {
        tx.update(games)
          .set({
            status: "active",
            winnerId: null,
            updatedAt: now,
          })
          .where(eq(games.id, game.id))
          .run();
      } else {
        tx.update(games)
          .set({ updatedAt: now })
          .where(eq(games.id, game.id))
          .run();
      }

      // Delete throws, then turn
      tx.delete(throws_).where(eq(throws_.turnId, lastTurn.id)).run();
      tx.delete(turns).where(eq(turns.id, lastTurn.id)).run();

      return game.id;
    });

    // Build state after transaction is committed
    const updatedGame = db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .get()!;
    return this.buildGameState(updatedGame);
  }

  // ── Polling helper ───────────────────────────────────────────────

  getGameUpdatedAt(shareCode: string): number | undefined {
    const row = db
      .select({ updatedAt: games.updatedAt })
      .from(games)
      .where(eq(games.shareCode, shareCode))
      .get();
    return row?.updatedAt;
  }

  // ── Private: build full GameState ────────────────────────────────

  private buildGameState(game: Game): GameState {
    const gamePlayers = db
      .select()
      .from(players)
      .where(eq(players.gameId, game.id))
      .orderBy(asc(players.orderIndex))
      .all();

    // Count total turns to determine current player
    const turnCount = db
      .select({ count: sql<number>`count(*)` })
      .from(turns)
      .where(eq(turns.gameId, game.id))
      .get()!.count;

    const currentIndex =
      game.status === "finished"
        ? -1
        : getCurrentPlayerIndex(turnCount, gamePlayers.length);

    const currentPlayerId =
      currentIndex >= 0 ? gamePlayers[currentIndex].id : null;

    // Build enriched player list
    const enrichedPlayers = gamePlayers.map((p) => {
      const avgPerDart = p.dartsThrown > 0 ? p.totalPoints / p.dartsThrown : 0;

      // Count turns for this player for averagePerTurn
      const playerTurnCount = db
        .select({ count: sql<number>`count(*)` })
        .from(turns)
        .where(and(eq(turns.gameId, game.id), eq(turns.playerId, p.id)))
        .get()!.count;

      const avgPerTurn =
        playerTurnCount > 0 ? p.totalPoints / playerTurnCount : 0;

      return {
        ...p,
        isCurrentTurn: p.id === currentPlayerId,
        averagePerDart: Math.round(avgPerDart * 100) / 100,
        averagePerTurn: Math.round(avgPerTurn * 100) / 100,
        suggestedFinish:
          game.status === "active" ? getSuggestedFinish(p.score) : null,
      };
    });

    // currentTurn info (always empty throws since throws are only stored on submitTurn)
    const currentTurn =
      currentPlayerId !== null
        ? {
            playerId: currentPlayerId,
            turnNumber: turnCount,
            throws: [] as { sector: number; multiplier: number; points: number; throwIndex: number }[],
            runningScore: gamePlayers[currentIndex].score,
          }
        : null;

    // Recent history: last 20 turns with throws
    const recentTurns = db
      .select()
      .from(turns)
      .where(eq(turns.gameId, game.id))
      .orderBy(desc(turns.turnNumber))
      .limit(20)
      .all();

    const recentHistory = recentTurns.map((t) => {
      const player = gamePlayers.find((p) => p.id === t.playerId)!;
      const turnThrows = db
        .select()
        .from(throws_)
        .where(eq(throws_.turnId, t.id))
        .orderBy(asc(throws_.throwIndex))
        .all();

      return {
        turnId: t.id,
        playerName: player.name,
        scoreBefore: t.scoreBefore,
        scoreAfter: t.scoreAfter,
        pointsScored: t.pointsScored,
        isBust: t.isBust,
        isWin: t.isWin,
        throws: turnThrows.map((th) => ({
          sector: th.sector,
          multiplier: th.multiplier,
          points: th.points,
        })),
      };
    });

    return {
      game,
      players: enrichedPlayers,
      currentTurn,
      recentHistory,
      updatedAt: game.updatedAt,
    };
  }
}

// ── Custom error classes ─────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ── Singleton ────────────────────────────────────────────────────────

export const storage = new DatabaseStorage();
