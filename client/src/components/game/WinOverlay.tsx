import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

interface WinOverlayProps {
  show: boolean;
  winnerName: string;
  shareCode: string;
  onClose: () => void;
}

// Simple confetti particle system
function useConfetti(active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#FFD700", "#e63946", "#1db954", "#ff6b35", "#4ecdc4", "#fff"];
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
    }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 - 100,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let animId: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.rotation += p.rotationSpeed;
        p.vx *= 0.99;

        if (p.y < canvas.height + 50) alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      if (alive) {
        animId = requestAnimationFrame(animate);
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [active]);

  return canvasRef;
}

export default function WinOverlay({ show, winnerName, shareCode, onClose }: WinOverlayProps) {
  const [, navigate] = useLocation();
  const canvasRef = useConfetti(show);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#/game/${shareCode}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, [shareCode]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
            className="relative z-10 text-center space-y-6 px-6"
          >
            {/* Close button (top-right) */}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors p-2"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5l10 10"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <h2 className="text-5xl font-bold text-yellow-400 drop-shadow-lg">
              ПОБЕДА!
            </h2>
            <p className="text-2xl font-semibold text-white">
              {winnerName}
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={() => navigate("/")}
                size="lg"
                className="min-h-[44px]"
              >
                Новая игра
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                size="lg"
                className="min-h-[44px] bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Поделиться
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                size="lg"
                className="min-h-[44px] text-white/70 hover:text-white hover:bg-white/10"
              >
                Смотреть историю
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
