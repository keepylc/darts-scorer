export type GameState = {
  game: {
    id: number;
    shareCode: string;
    mode: number;
    status: string;
    winnerId: number | null;
    createdAt: number;
    updatedAt: number;
  };
  players: {
    id: number;
    name: string;
    orderIndex: number;
    score: number;
    dartsThrown: number;
    totalPoints: number;
    isCurrentTurn: boolean;
    averagePerDart: number;
    averagePerTurn: number;
    suggestedFinish: FinishSuggestion | null;
  }[];
  recentHistory: {
    turnId: number;
    playerName: string;
    scoreBefore: number;
    scoreAfter: number;
    pointsScored: number;
    isBust: boolean;
    isWin: boolean;
    dartsInTurn: number;
    throws: {
      sector: number;
      multiplier: number;
      points: number;
    }[];
  }[];
  updatedAt: number;
};

export type FinishSuggestion = {
  darts: number;
  path: string[];
};

export type DartThrow = {
  sector: number;
  multiplier: number;
};
