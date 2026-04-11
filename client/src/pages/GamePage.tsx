import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { useGamePolling } from "@/hooks/useGamePolling";
import { apiRequest } from "@/lib/queryClient";
import { getInviteCode, clearInviteCode } from "@/lib/inviteCode";
import { useToast } from "@/hooks/use-toast";
import { playSound } from "@/lib/sounds";
import {
  isBustPreview,
  isWinPreview,
  throwPoints,
  getRunningScore,
} from "@/lib/dartUtils";
import type { DartThrow } from "@/lib/types";

import DartboardSVG from "@/components/game/DartboardSVG";
import PlayerScoreboard from "@/components/game/PlayerScoreboard";
import CurrentTurnPanel from "@/components/game/CurrentTurnPanel";
import ThrowHistory from "@/components/game/ThrowHistory";
import BustOverlay from "@/components/game/BustOverlay";
import WinOverlay from "@/components/game/WinOverlay";
import InviteCodePrompt from "@/components/game/InviteCodePrompt";
import { Button } from "@/components/ui/button";
import { Share2, Loader2, Copy } from "lucide-react";

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const shareCode = params.code || "";
  const { gameState, isLoading, error, invalidate } = useGamePolling(shareCode);
  const { toast } = useToast();

  const [currentThrows, setCurrentThrows] = useState<DartThrow[]>([]);
  const [showBust, setShowBust] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const storedCode = getInviteCode(shareCode);
  const [isParticipant, setIsParticipant] = useState(!!storedCode);
  const [showInvitePrompt, setShowInvitePrompt] = useState(!storedCode);
  const bustTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const confirmTurnRef = useRef<(throws?: DartThrow[]) => void>();
  const prevStatusRef = useRef<string | null>(null);

  // Detect win from server state
  useEffect(() => {
    const prev = prevStatusRef.current;
    const current = gameState?.game.status ?? null;
    prevStatusRef.current = current;

    // Only show overlay when:
    // 1. Status JUST transitioned active → finished (not loaded already-finished)
    // 2. This user is a participant (has the invite code)
    if (prev === "active" && current === "finished" && isParticipant) {
      setShowWin(true);
      playSound("win");
    }
  }, [gameState?.game.status, isParticipant]);

  // Get current player info
  const currentPlayer = gameState?.players.find((p) => p.isCurrentTurn);
  const scoreBefore = currentPlayer?.score ?? 0;

  const inviteHeaders = useCallback((): Record<string, string> => {
    const code = getInviteCode(shareCode);
    return code ? { "X-Invite-Code": code } : {};
  }, [shareCode]);

  // Confirm turn (send to server)
  const confirmTurn = useCallback(
    async (throws?: DartThrow[]) => {
      const throwsToSend = throws || currentThrows;
      if (!currentPlayer || throwsToSend.length === 0 || isSending) return;

      setIsSending(true);
      try {
        const res = await apiRequest(
          "POST",
          `/api/games/${shareCode}/turns`,
          {
            playerId: currentPlayer.id,
            throws: throwsToSend.map((t) => ({
              sector: t.sector,
              multiplier: t.multiplier,
            })),
          },
          inviteHeaders(),
        );
        const data = await res.json();

        // Check if the turn was a bust
        const lastTurn = data.recentHistory?.[0];
        if (lastTurn?.isBust) {
          setShowBust(true);
          clearTimeout(bustTimeoutRef.current);
          bustTimeoutRef.current = setTimeout(() => setShowBust(false), 2000);
        }

        setCurrentThrows([]);
        invalidate();
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("403:")) {
          clearInviteCode(shareCode);
          setIsParticipant(false);
          setShowInvitePrompt(true);
          toast({ title: "Неверный код приглашения", variant: "destructive" });
          return;
        }
        toast({
          title: "Ошибка",
          description:
            err instanceof Error ? err.message : "Не удалось отправить ход",
          variant: "destructive",
        });
      } finally {
        setIsSending(false);
      }
    },
    [currentPlayer, currentThrows, shareCode, invalidate, toast, isSending, inviteHeaders]
  );

  // I3 fix: keep ref always in sync so setTimeout closures use latest version
  confirmTurnRef.current = confirmTurn;

  // Handle dart throw
  const onThrow = useCallback(
    (sector: number, multiplier: number) => {
      if (!gameState || gameState.game.status === "finished") return;
      if (currentThrows.length >= 3) return;
      if (isSending) return;

      const newThrows = [...currentThrows, { sector, multiplier }];

      // Play sound
      if (sector === 0 && multiplier === 0) {
        // miss - no special sound
      } else if (sector === 25) {
        playSound("bull");
      } else if (multiplier === 3) {
        playSound("triple");
      } else if (multiplier === 2) {
        playSound("double");
      } else {
        playSound("hit");
      }

      // Check bust preview
      const bust = isBustPreview(scoreBefore, newThrows);
      const win = isWinPreview(scoreBefore, newThrows);

      setCurrentThrows(newThrows);

      // Auto-confirm on bust
      if (bust) {
        playSound("bust");
        setTimeout(() => {
          confirmTurnRef.current?.(newThrows);
        }, 300);
        return;
      }

      // Auto-confirm on win
      if (win) {
        setTimeout(() => {
          confirmTurnRef.current?.(newThrows);
        }, 300);
        return;
      }

      // Auto-confirm on 3 throws
      if (newThrows.length === 3) {
        setTimeout(() => {
          confirmTurnRef.current?.(newThrows);
        }, 500);
      }
    },
    [currentThrows, gameState, scoreBefore, isSending]
  );

  // Undo last throw (UI only)
  const onUndoThrow = useCallback(() => {
    setCurrentThrows((prev) => prev.slice(0, -1));
  }, []);

  // Undo last completed turn (server)
  const onUndoTurn = useCallback(async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await apiRequest("POST", `/api/games/${shareCode}/undo`, undefined, inviteHeaders());
      setCurrentThrows([]);
      setShowWin(false);
      invalidate();
      toast({ title: "Ход отменён" });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("403:")) {
        clearInviteCode(shareCode);
        setIsParticipant(false);
        setShowInvitePrompt(true);
        toast({ title: "Неверный код приглашения", variant: "destructive" });
        return;
      }
      toast({
        title: "Ошибка",
        description:
          err instanceof Error ? err.message : "Не удалось отменить ход",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [shareCode, invalidate, toast, isSending, inviteHeaders]);

  // Share button
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#/game/${shareCode}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Ссылка скопирована!" }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  }, [shareCode, toast]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(bustTimeoutRef.current);
    };
  }, []);

  // Loading state
  if (isLoading && !gameState) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error && !gameState) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Игра не найдена</p>
        <p className="text-sm text-muted-foreground mt-1">
          Проверьте ссылку и попробуйте снова
        </p>
      </div>
    );
  }

  if (!gameState) return null;

  const isFinished = gameState.game.status === "finished";
  const isBust = currentThrows.length > 0 && isBustPreview(scoreBefore, currentThrows);
  const lastThrow = currentThrows.length > 0 ? currentThrows[currentThrows.length - 1] : undefined;
  const winnerPlayer = gameState.players.find(
    (p) => p.id === gameState.game.winnerId
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header with share code */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">{gameState.game.mode} — Игра</h1>
          <p className="text-xs text-muted-foreground">Код: {shareCode}</p>
          {isParticipant && storedCode && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              onClick={() =>
                navigator.clipboard.writeText(storedCode).then(
                  () => toast({ title: "Код скопирован" }),
                  () => {}
                )
              }
            >
              <span className="font-mono tracking-widest">{storedCode}</span>
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="min-h-[36px]"
        >
          <Share2 className="h-4 w-4 mr-1.5" />
          Поделиться
        </Button>
      </div>

      {/* Main layout: 2 columns desktop, 1 column mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mobile: dartboard first */}
        <div className="lg:order-2">
          {showInvitePrompt && !isFinished && (
            <InviteCodePrompt
              shareCode={shareCode}
              onJoined={() => { setIsParticipant(true); setShowInvitePrompt(false); }}
              onSkip={() => setShowInvitePrompt(false)}
            />
          )}
          <DartboardSVG
            onThrow={onThrow}
            disabled={isFinished || isSending || !isParticipant}
            lastThrow={lastThrow}
          />
        </div>

        {/* Scoreboard + Controls */}
        <div className="lg:order-1 space-y-3">
          <PlayerScoreboard players={gameState.players} />

          {!isFinished && isParticipant && (
            <CurrentTurnPanel
              throws={currentThrows}
              scoreBefore={scoreBefore}
              onConfirmTurn={() => confirmTurn()}
              onUndoThrow={onUndoThrow}
              onUndoTurn={onUndoTurn}
              isBust={isBust}
              hasHistory={gameState.recentHistory.length > 0}
              disabled={isSending}
            />
          )}
        </div>

        {/* History (below dartboard on mobile, right side on desktop) */}
        <div className="lg:order-3 lg:col-span-2">
          <div className="text-sm font-medium mb-2">История ходов</div>
          <ThrowHistory history={gameState.recentHistory} />
        </div>
      </div>

      {/* Overlays */}
      <BustOverlay show={showBust} />
      <WinOverlay
        show={showWin && isFinished}
        winnerName={winnerPlayer?.name || ""}
        shareCode={shareCode}
        onClose={() => setShowWin(false)}
      />
    </motion.div>
  );
}
