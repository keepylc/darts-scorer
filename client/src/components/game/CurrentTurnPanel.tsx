import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatThrow, throwPoints } from "@/lib/dartUtils";
import type { DartThrow } from "@/lib/types";
import { Undo2, Check, RotateCcw } from "lucide-react";

interface CurrentTurnPanelProps {
  throws: DartThrow[];
  scoreBefore: number;
  onConfirmTurn: () => void;
  onUndoThrow: () => void;
  onUndoTurn: () => void;
  isBust: boolean;
  hasHistory: boolean;
  disabled: boolean;
}

export default function CurrentTurnPanel({
  throws,
  scoreBefore,
  onConfirmTurn,
  onUndoThrow,
  onUndoTurn,
  isBust,
  hasHistory,
  disabled,
}: CurrentTurnPanelProps) {
  const totalThrown = throws.reduce((sum, t) => sum + throwPoints(t.sector, t.multiplier), 0);
  const runningScore = scoreBefore - totalThrown;

  // 3 throw slots
  const slots = [0, 1, 2];

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Running score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Текущий счёт</span>
          <span
            className={`text-lg font-bold tabular-nums ${
              isBust ? "text-destructive" : ""
            }`}
          >
            {runningScore}
          </span>
        </div>

        {/* Throw slots */}
        <div className="flex gap-2">
          {slots.map((i) => {
            const t = throws[i];
            return (
              <div
                key={i}
                className={`flex-1 h-12 rounded-lg border-2 border-dashed flex items-center justify-center
                  text-sm font-semibold transition-all
                  ${
                    t
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                  }`}
              >
                {t ? (
                  <span>
                    {formatThrow(t.sector, t.multiplier)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({throwPoints(t.sector, t.multiplier)})
                    </span>
                  </span>
                ) : (
                  <span className="text-xs">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bust warning */}
        {isBust && throws.length > 0 && (
          <p className="text-xs text-destructive font-medium text-center">
            Перебор! Ход не засчитан.
          </p>
        )}

        {/* Score sum */}
        {throws.length > 0 && !isBust && (
          <p className="text-xs text-muted-foreground text-center">
            Набрано за ход: {totalThrown}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndoThrow}
            disabled={throws.length === 0 || disabled}
            className="flex-1 min-h-[44px]"
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Убрать
          </Button>
          <Button
            size="sm"
            onClick={onConfirmTurn}
            disabled={throws.length === 0 || disabled}
            className="flex-1 min-h-[44px]"
          >
            <Check className="h-4 w-4 mr-1" />
            Подтвердить
          </Button>
        </div>

        {/* Undo last completed turn */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndoTurn}
          disabled={!hasHistory || disabled}
          className="w-full text-xs text-muted-foreground min-h-[36px]"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Отменить последний ход
        </Button>
      </CardContent>
    </Card>
  );
}
