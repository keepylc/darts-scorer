import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { storeInviteCode } from "@/lib/inviteCode";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Play, BookOpen } from "lucide-react";
import { Link } from "wouter";

const MODES = [301, 501, 701] as const;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

export default function HomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<301 | 501 | 701>(501);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>([
    "Игрок 1",
    "Игрок 2",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatePlayerCount = useCallback(
    (delta: number) => {
      const newCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, playerCount + delta));
      setPlayerCount(newCount);
      setPlayerNames((prev) => {
        if (newCount > prev.length) {
          const added = Array.from({ length: newCount - prev.length }, (_, i) =>
            `Игрок ${prev.length + i + 1}`
          );
          return [...prev, ...added];
        }
        return prev.slice(0, newCount);
      });
    },
    [playerCount]
  );

  const updateName = useCallback((index: number, name: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate names
      const names = playerNames.map((n) => n.trim()).map((n, i) => n || `Игрок ${i + 1}`);
      if (names.some((n) => n.length === 0)) {
        toast({ title: "Ошибка", description: "Заполните имена игроков", variant: "destructive" });
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await apiRequest("POST", "/api/games", {
          mode,
          playerNames: names,
        });
        const data = await res.json();
        storeInviteCode(data.shareCode, data.inviteCode);
        toast({
          title: "Игра создана!",
          description: `Код для участников: ${data.inviteCode}`,
          duration: 10000,
        });
        navigate(`/game/${data.shareCode}`);
      } catch (err) {
        toast({
          title: "Ошибка",
          description: err instanceof Error ? err.message : "Не удалось создать игру",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, playerNames, navigate, toast]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">Новая игра</h1>
        <p className="text-sm text-muted-foreground mt-1">Выберите режим и добавьте игроков</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mode selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Режим</label>
              <div className="flex gap-2">
                {MODES.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => setMode(m)}
                    className="flex-1 min-h-[44px] text-lg font-semibold"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            {/* Player count */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Количество игроков
              </label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updatePlayerCount(-1)}
                  disabled={playerCount <= MIN_PLAYERS}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-8 text-center tabular-nums">
                  {playerCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updatePlayerCount(1)}
                  disabled={playerCount >= MAX_PLAYERS}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Player names */}
            <div>
              <label className="text-sm font-medium mb-2 block">Имена игроков</label>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {playerNames.map((name, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Input
                        value={name}
                        onChange={(e) => updateName(i, e.target.value)}
                        placeholder={`Игрок ${i + 1}`}
                        maxLength={32}
                        className="min-h-[44px]"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full min-h-[48px] text-base font-semibold"
              disabled={isSubmitting}
            >
              <Play className="h-5 w-5 mr-2" />
              {isSubmitting ? "Создание..." : "Начать игру"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center mt-4">
        <Link href="/rules">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <BookOpen className="h-4 w-4 mr-1.5" />
            Правила игры
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
