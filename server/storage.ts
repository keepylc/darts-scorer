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

// ── Synchronous storage interface (C1 fix — no Promise/async) ────────

export interface IStorage {
  createGame(data: CreateGameRequest): { shareCode: string };
  getGameState(shareCode: string): GameState | undefined;
  submitTurn(shareCode: string, data: SubmitTurnRequest): GameState;
  undoLastTurn(shareCode: string): GameState;
  getGameUpdatedAt(shareCode: string): number | undefined;
}

// ── DatabaseStorage implementation ───────────────────────────────────

export class DatabaseStorage implements IStorage {
  // ── Create game ──────────────────────────────────────────────────

  createGame(data: CreateGameRequest): { shareCode: string } {
    const shareCode = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    const now = Date.now();

    // Run inside a transaction for atomicity
    db.transaction((tx) => {
      const game = tx
        .insert(games)
        .values({
          shareCode,
          mode: data.mode,
          status: "active",
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

    return { shareCode };
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

  submitTurn(shareCode: string, data: SubmitTurnRequest): GameState {
    return db.transaction((tx) => {
      const game = tx
        .select()
        .from(games)
        .where(eq(games.shareCode, shareCode))
        .get();
      if (!game) throw new NotFoundError("Game not found");
      if (game.status === "finished")
        throw new ValidationError("Game is finished");

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

      // Compute throw points and check bust iteratively (C4 fix)
      const throwInputs = data.throws.map((t) => ({
        sector: t.sector,
        multiplier: t.multiplier,
      }));

      const result = isBustCheck(currentPlayer.score, throwInputs);

      // Reject extra throws after bust (throws that came after bust point)
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

      // Return fresh state (use db, not tx, for buildGameState which uses db internally)
      const updatedGame = tx
        .select()
        .from(games)
        .where(eq(games.id, game.id))
        .get()!;
      return this.buildGameState(updatedGame);
    });
  }

  // ── Undo last turn ───────────────────────────────────────────────

  undoLastTurn(shareCode: string): GameState {
    return db.transaction((tx) => {
      const game = tx
        .select()
        .from(games)
        .where(eq(games.shareCode, shareCode))
        .get();
      if (!game) throw new NotFoundError("Game not found");

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

      // Return fresh state
      const updatedGame = tx
        .select()
        .from(games)
        .where(eq(games.id, game.id))
        .get()!;
      return this.buildGameState(updatedGame);
    });
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

// ── Singleton ────────────────────────────────────────────────────────

export const storage = new DatabaseStorage();
