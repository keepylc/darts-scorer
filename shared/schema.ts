import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Tables ───────────────────────────────────────────────────────────

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shareCode: text("share_code").notNull().unique(),
  mode: integer("mode").notNull(), // 301 | 501 | 701
  status: text("status").notNull().default("active"), // "active" | "finished"
  winnerId: integer("winner_id"), // FK → players.id, NULL while game is active
  createdAt: integer("created_at").notNull(), // Unix timestamp (ms)
  updatedAt: integer("updated_at").notNull(), // updated on every turn
});

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull(), // 0-based turn order
  score: integer("score").notNull(), // remaining score (starts at mode)
  dartsThrown: integer("darts_thrown").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
});

export const turns = sqliteTable("turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  turnNumber: integer("turn_number").notNull(), // global turn counter for the game
  scoreBefore: integer("score_before").notNull(),
  scoreAfter: integer("score_after").notNull(),
  pointsScored: integer("points_scored").notNull(), // 0 on bust
  isBust: integer("is_bust", { mode: "boolean" }).notNull().default(false),
  isWin: integer("is_win", { mode: "boolean" }).notNull().default(false),
  dartsInTurn: integer("darts_in_turn").notNull(), // 1, 2, or 3
  createdAt: integer("created_at").notNull(),
});

export const throws_ = sqliteTable("throws", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  turnId: integer("turn_id")
    .notNull()
    .references(() => turns.id),
  // No gameId/playerId denormalization — JOIN through turns
  throwIndex: integer("throw_index").notNull(), // 0, 1, 2
  sector: integer("sector").notNull(), // 0 (miss), 1–20, 25 (bull)
  multiplier: integer("multiplier").notNull(), // 0 (miss), 1, 2, 3
  points: integer("points").notNull(), // sector × multiplier
  createdAt: integer("created_at").notNull(),
});

// ── Insert schemas ───────────────────────────────────────────────────

export const insertGameSchema = createInsertSchema(games).pick({
  mode: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

export const insertPlayerSchema = createInsertSchema(players).pick({
  gameId: true,
  name: true,
  orderIndex: true,
  score: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export const insertTurnSchema = createInsertSchema(turns).omit({
  id: true,
  createdAt: true,
});
export type InsertTurn = z.infer<typeof insertTurnSchema>;
export type Turn = typeof turns.$inferSelect;

export const insertThrowSchema = createInsertSchema(throws_).omit({
  id: true,
  createdAt: true,
});
export type InsertThrow = z.infer<typeof insertThrowSchema>;
export type Throw = typeof throws_.$inferSelect;

// ── Request DTOs ─────────────────────────────────────────────────────

export const createGameSchema = z.object({
  mode: z.union([z.literal(301), z.literal(501), z.literal(701)]),
  playerNames: z.array(z.string().min(1).max(32)).min(2).max(8),
});
export type CreateGameRequest = z.infer<typeof createGameSchema>;

const throwInputSchema = z
  .object({
    sector: z.number().int().min(0).max(25),
    multiplier: z.number().int().min(0).max(3),
  })
  .refine(
    (t) => !(t.sector === 0 && t.multiplier !== 0),
    "Miss must have multiplier=0",
  )
  .refine(
    (t) => !(t.sector === 25 && t.multiplier === 3),
    "Triple Bull does not exist",
  );

export const submitTurnSchema = z.object({
  playerId: z.number().int().positive(),
  throws: z.array(throwInputSchema).min(1).max(3),
});
export type SubmitTurnRequest = z.infer<typeof submitTurnSchema>;

// ── Response DTOs ────────────────────────────────────────────────────

export type FinishSuggestion = {
  darts: number; // 1, 2, or 3
  path: string[]; // e.g. ["T20", "T19", "D12"]
};

export type GameState = {
  game: Game;
  players: (Player & {
    isCurrentTurn: boolean;
    averagePerDart: number;
    averagePerTurn: number;
    suggestedFinish: FinishSuggestion | null;
  })[];
  currentTurn: {
    playerId: number;
    turnNumber: number;
    throws: Pick<Throw, "sector" | "multiplier" | "points" | "throwIndex">[];
    runningScore: number;
  } | null;
  recentHistory: {
    turnId: number;
    playerName: string;
    scoreBefore: number;
    scoreAfter: number;
    pointsScored: number;
    isBust: boolean;
    isWin: boolean;
    throws: { sector: number; multiplier: number; points: number }[];
  }[];
  updatedAt: number;
};
