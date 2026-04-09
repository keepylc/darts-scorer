import type { FinishSuggestion } from "@shared/schema";

// ── Pure helpers ─────────────────────────────────────────────────────

export function throwPoints(sector: number, multiplier: number): number {
  return sector * multiplier;
}

export function isDouble(sector: number, multiplier: number): boolean {
  if (multiplier !== 2) return false;
  return (sector >= 1 && sector <= 20) || sector === 25;
}

export function formatThrow(sector: number, multiplier: number): string {
  if (sector === 0 && multiplier === 0) return "MISS";
  if (sector === 25) {
    return multiplier === 2 ? "DBull" : "Bull";
  }
  const prefix = multiplier === 3 ? "T" : multiplier === 2 ? "D" : "S";
  return `${prefix}${sector}`;
}

// ── Iterative bust check (C4 fix) ───────────────────────────────────

export interface ThrowInput {
  sector: number;
  multiplier: number;
}

export interface BustCheckResult {
  isBust: boolean;
  validThrows: ThrowInput[];
  totalPoints: number;
  newScore: number;
}

/**
 * Iteratively checks bust after each throw.
 * Stops at first bust — any remaining throws are rejected as invalid.
 */
export function isBustCheck(
  scoreBefore: number,
  inputThrows: ThrowInput[],
): BustCheckResult {
  let running = scoreBefore;
  const validThrows: ThrowInput[] = [];

  for (let i = 0; i < inputThrows.length; i++) {
    const t = inputThrows[i];
    const pts = throwPoints(t.sector, t.multiplier);
    running -= pts;

    if (running < 0 || running === 1) {
      // Bust: score went negative or landed on 1 (can't finish with double)
      return {
        isBust: true,
        validThrows: [...validThrows, t], // include the bust throw itself
        totalPoints: 0,
        newScore: scoreBefore, // score doesn't change on bust
      };
    }

    if (running === 0 && !isDouble(t.sector, t.multiplier)) {
      // Bust: reached 0 but not on a double
      return {
        isBust: true,
        validThrows: [...validThrows, t],
        totalPoints: 0,
        newScore: scoreBefore,
      };
    }

    validThrows.push(t);

    if (running === 0) {
      // Win! Finished on a double. Reject any remaining throws.
      const total = scoreBefore; // all points counted
      return {
        isBust: false,
        validThrows,
        totalPoints: total,
        newScore: 0,
      };
    }
  }

  // Normal turn — no bust, no win
  const totalPoints = scoreBefore - running;
  return {
    isBust: false,
    validThrows,
    totalPoints,
    newScore: running,
  };
}

// ── Current player index ─────────────────────────────────────────────

export function getCurrentPlayerIndex(
  totalTurns: number,
  playerCount: number,
): number {
  return totalTurns % playerCount;
}

// ── Finish suggestions table (2–170) ─────────────────────────────────

function buildFinishTable(): Record<number, FinishSuggestion> {
  const table: Record<number, FinishSuggestion> = {};

  // All possible single dart finishes and their values
  const allDarts: { value: number; label: string; isDouble: boolean }[] = [];

  // Singles 1–20
  for (let s = 1; s <= 20; s++) {
    allDarts.push({ value: s, label: `S${s}`, isDouble: false });
  }
  // Doubles 1–20
  for (let s = 1; s <= 20; s++) {
    allDarts.push({ value: s * 2, label: `D${s}`, isDouble: true });
  }
  // Triples 1–20
  for (let s = 1; s <= 20; s++) {
    allDarts.push({ value: s * 3, label: `T${s}`, isDouble: false });
  }
  // Bull
  allDarts.push({ value: 25, label: "Bull", isDouble: false });
  // Double Bull
  allDarts.push({ value: 50, label: "DBull", isDouble: true });

  const doubles = allDarts.filter((d) => d.isDouble);

  // 1-dart finishes (must be double)
  for (const d of doubles) {
    if (d.value >= 2 && d.value <= 170 && !table[d.value]) {
      table[d.value] = { darts: 1, path: [d.label] };
    }
  }

  // 2-dart finishes
  for (const a of allDarts) {
    for (const b of doubles) {
      const total = a.value + b.value;
      if (total >= 2 && total <= 170 && !table[total]) {
        table[total] = { darts: 2, path: [a.label, b.label] };
      }
    }
  }

  // 3-dart finishes
  for (const a of allDarts) {
    for (const b of allDarts) {
      for (const c of doubles) {
        const total = a.value + b.value + c.value;
        if (total >= 2 && total <= 170 && !table[total]) {
          table[total] = { darts: 3, path: [a.label, b.label, c.label] };
        }
      }
    }
  }

  return table;
}

export const FINISH_TABLE: Record<number, FinishSuggestion> =
  buildFinishTable();

export function getSuggestedFinish(score: number): FinishSuggestion | null {
  if (score < 2 || score > 170) return null;
  return FINISH_TABLE[score] ?? null;
}
