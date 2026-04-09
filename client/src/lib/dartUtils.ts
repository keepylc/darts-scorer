import type { DartThrow, FinishSuggestion } from "./types";

/** Sector order clockwise from top */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Format a throw to human-readable string */
export function formatThrow(sector: number, multiplier: number): string {
  if (sector === 0 && multiplier === 0) return "Мимо";
  if (sector === 25 && multiplier === 2) return "D-Bull";
  if (sector === 25 && multiplier === 1) return "Bull";
  if (multiplier === 3) return `T${sector}`;
  if (multiplier === 2) return `D${sector}`;
  return `S${sector}`;
}

/** Calculate points for a throw */
export function throwPoints(sector: number, multiplier: number): number {
  return sector * multiplier;
}

/** Check if a throw is a double */
export function isDouble(sector: number, multiplier: number): boolean {
  return (multiplier === 2 && sector >= 1 && sector <= 20) ||
    (sector === 25 && multiplier === 2);
}

/** Client-side bust preview check */
export function isBustPreview(scoreBefore: number, throws: DartThrow[]): boolean {
  let running = scoreBefore;
  for (let i = 0; i < throws.length; i++) {
    running -= throwPoints(throws[i].sector, throws[i].multiplier);
    if (running < 0) return true;
    if (running === 1) return true;
    if (running === 0 && !isDouble(throws[i].sector, throws[i].multiplier)) return true;
  }
  return false;
}

/** Check if current throws result in a win */
export function isWinPreview(scoreBefore: number, throws: DartThrow[]): boolean {
  let running = scoreBefore;
  for (let i = 0; i < throws.length; i++) {
    running -= throwPoints(throws[i].sector, throws[i].multiplier);
  }
  if (running === 0 && throws.length > 0) {
    const last = throws[throws.length - 1];
    return isDouble(last.sector, last.multiplier);
  }
  return false;
}

/** Get running score after throws */
export function getRunningScore(scoreBefore: number, throws: DartThrow[]): number {
  let running = scoreBefore;
  for (const t of throws) {
    running -= throwPoints(t.sector, t.multiplier);
  }
  return running;
}

// ──────────────────────────────────────────────
// Finish suggestions (pre-computed table 2–170)
// ──────────────────────────────────────────────

const FINISH_TABLE: Record<number, FinishSuggestion> = {};

// 1-dart finishes: doubles only
function initFinishTable() {
  // D1..D20
  for (let i = 1; i <= 20; i++) {
    FINISH_TABLE[i * 2] = { darts: 1, path: [`D${i}`] };
  }
  // D-Bull = 50
  FINISH_TABLE[50] = { darts: 1, path: ["D-Bull"] };

  // 2-dart finishes
  const singles: { name: string; points: number }[] = [];
  const doubles: { name: string; points: number }[] = [];
  const triples: { name: string; points: number }[] = [];

  for (let i = 1; i <= 20; i++) {
    singles.push({ name: `S${i}`, points: i });
    doubles.push({ name: `D${i}`, points: i * 2 });
    triples.push({ name: `T${i}`, points: i * 3 });
  }
  singles.push({ name: "Bull", points: 25 });
  doubles.push({ name: "D-Bull", points: 50 });

  const allThrows = [...singles, ...doubles, ...triples];

  // 2-dart: first + double finish
  for (const first of allThrows) {
    for (const finish of doubles) {
      const total = first.points + finish.points;
      if (total >= 2 && total <= 170 && !FINISH_TABLE[total]) {
        FINISH_TABLE[total] = { darts: 2, path: [first.name, finish.name] };
      }
    }
  }

  // 3-dart finishes
  for (const first of allThrows) {
    for (const second of allThrows) {
      for (const finish of doubles) {
        const total = first.points + second.points + finish.points;
        if (total >= 2 && total <= 170 && !FINISH_TABLE[total]) {
          FINISH_TABLE[total] = { darts: 3, path: [first.name, second.name, finish.name] };
        }
      }
    }
  }

  // Override some well-known finishes
  FINISH_TABLE[170] = { darts: 3, path: ["T20", "T20", "D-Bull"] };
  FINISH_TABLE[167] = { darts: 3, path: ["T20", "T19", "D-Bull"] };
  FINISH_TABLE[164] = { darts: 3, path: ["T20", "T18", "D-Bull"] };
  FINISH_TABLE[161] = { darts: 3, path: ["T20", "T17", "D-Bull"] };
  FINISH_TABLE[160] = { darts: 3, path: ["T20", "T20", "D20"] };
  FINISH_TABLE[158] = { darts: 3, path: ["T20", "T20", "D19"] };
  FINISH_TABLE[157] = { darts: 3, path: ["T20", "T19", "D20"] };
  FINISH_TABLE[156] = { darts: 3, path: ["T20", "T20", "D18"] };
  FINISH_TABLE[155] = { darts: 3, path: ["T20", "T19", "D19"] };
  FINISH_TABLE[154] = { darts: 3, path: ["T20", "T18", "D20"] };
  FINISH_TABLE[153] = { darts: 3, path: ["T20", "T19", "D18"] };
  FINISH_TABLE[152] = { darts: 3, path: ["T20", "T20", "D16"] };
  FINISH_TABLE[151] = { darts: 3, path: ["T20", "T17", "D20"] };
  FINISH_TABLE[150] = { darts: 3, path: ["T20", "T18", "D18"] };
  FINISH_TABLE[141] = { darts: 3, path: ["T20", "T19", "D12"] };
  FINISH_TABLE[140] = { darts: 3, path: ["T20", "T20", "D10"] };
  FINISH_TABLE[131] = { darts: 3, path: ["T20", "T13", "D16"] };
  FINISH_TABLE[130] = { darts: 3, path: ["T20", "T18", "D8"] };
  FINISH_TABLE[121] = { darts: 3, path: ["T20", "T11", "D14"] };
  FINISH_TABLE[120] = { darts: 3, path: ["T20", "S20", "D20"] };
  FINISH_TABLE[110] = { darts: 3, path: ["T20", "S18", "D16"] };
  FINISH_TABLE[100] = { darts: 2, path: ["T20", "D20"] };
  FINISH_TABLE[99] = { darts: 3, path: ["T19", "S10", "D16"] };
  FINISH_TABLE[98] = { darts: 2, path: ["T20", "D19"] };
  FINISH_TABLE[97] = { darts: 3, path: ["T19", "S8", "D16"] };
  FINISH_TABLE[96] = { darts: 2, path: ["T20", "D18"] };
  FINISH_TABLE[95] = { darts: 3, path: ["T19", "S6", "D16"] };
  FINISH_TABLE[81] = { darts: 2, path: ["T19", "D12"] };
  FINISH_TABLE[80] = { darts: 2, path: ["T20", "D10"] };
  FINISH_TABLE[61] = { darts: 2, path: ["T15", "D8"] };
  FINISH_TABLE[60] = { darts: 2, path: ["S20", "D20"] };
  FINISH_TABLE[41] = { darts: 2, path: ["S9", "D16"] };
  FINISH_TABLE[36] = { darts: 1, path: ["D18"] };
  FINISH_TABLE[32] = { darts: 1, path: ["D16"] };
  FINISH_TABLE[25] = { darts: 2, path: ["S9", "D8"] };
  FINISH_TABLE[3] = { darts: 2, path: ["S1", "D1"] };
}

initFinishTable();

/** Get suggested finish for a score (2–170) */
export function getSuggestedFinish(score: number): FinishSuggestion | null {
  if (score < 2 || score > 170) return null;
  return FINISH_TABLE[score] || null;
}
