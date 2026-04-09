import { motion, AnimatePresence } from "framer-motion";

interface BustOverlayProps {
  show: boolean;
}

export default function BustOverlay({ show }: BustOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ pointerEvents: "none" }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="text-center"
          >
            <h2 className="text-6xl font-bold text-destructive drop-shadow-lg">
              BUST!
            </h2>
            <p className="text-lg text-white/80 mt-2">Перебор — ход не засчитан</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
