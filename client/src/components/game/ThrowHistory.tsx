import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatThrow } from "@/lib/dartUtils";
import type { GameState } from "@/lib/types";

interface ThrowHistoryProps {
  history: GameState["recentHistory"];
}

export default function ThrowHistory({ history }: ThrowHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        История ходов пуста
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] lg:h-[400px]">
      <div className="space-y-1.5 pr-3">
        <AnimatePresence initial={false}>
          {history.map((entry) => (
            <motion.div
              key={entry.turnId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={`rounded-lg px-3 py-2 text-sm border ${
                  entry.isBust
                    ? "border-destructive/30 bg-destructive/5"
                    : entry.isWin
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{entry.playerName}</span>
                    {entry.isBust && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        BUST
                      </Badge>
                    )}
                    {entry.isWin && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-black hover:bg-yellow-600">
                        ПОБЕДА
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {entry.scoreAfter}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {entry.throws.map((t, i) => (
                      <span
                        key={i}
                        className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                      >
                        {formatThrow(t.sector, t.multiplier)}
                      </span>
                    ))}
                  </div>
                  {!entry.isBust && (
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                      +{entry.pointsScored}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
