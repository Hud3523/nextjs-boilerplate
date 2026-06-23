import { AnimatePresence, motion } from "framer-motion";
import type { Toast } from "../lib/store";

const SEV: Record<string, string> = { info: "var(--color-cyan)", warn: "var(--color-amber)", critical: "var(--color-danger)" };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-[90vw] max-w-md">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onDismiss(t.id)}
            className="w-full cursor-pointer rounded-lg border bg-[var(--color-panel)]/95 backdrop-blur px-3 py-2 shadow-lg"
            style={{ borderColor: `${SEV[t.severity] ?? "var(--color-cyan)"}88`, boxShadow: `0 0 18px ${SEV[t.severity] ?? "var(--color-cyan)"}44` }}>
            <div className="text-[12px] text-white/90 font-mono">{t.title}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
