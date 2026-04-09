import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GameState } from "@/lib/types";

interface PlayerScoreboardProps {
  players: GameState["players"];
}

export default function PlayerScoreboard({ players }: PlayerScoreboardProps) {
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {players
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((player) => (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className={`transition-all duration-200 ${
                  player.isCurrentTurn
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border"
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate">
                        {player.name}
                      </span>
                      {player.isCurrentTurn && (
                        <Badge variant="default" className="text-xs shrink-0">
                          Бросает
                        </Badge>
                      )}
                    </div>

                    <motion.span
                      key={player.score}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-xl font-bold tabular-nums"
                    >
                      {player.score}
                    </motion.span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>Ср/ход: {player.averagePerTurn.toFixed(1)}</span>
                    <span>Дротиков: {player.dartsThrown}</span>
                  </div>

                  {player.suggestedFinish && player.isCurrentTurn && (
                    <div className="mt-1.5 text-xs text-primary font-medium">
                      Финиш: {player.suggestedFinish.path.join(" → ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
