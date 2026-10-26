import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

/** The floating chat button. Kept separate from ChatBot so the chat window can be lazy-loaded. */
export default function ChatLauncher({ open, onClick, revealed = true }: { open: boolean; onClick: () => void; revealed?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onPointerEnter={() => void import('./ChatBot')} // warm the chat chunk before the click
      initial={{ scale: 0, rotate: -30 }}
      animate={revealed ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -30 }}
      transition={{ delay: revealed ? 0.9 : 0, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="pointer-events-auto relative grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-600 text-ink-950 shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_10px_40px_-6px_rgb(245_194_107/0.7)] lg:size-14"
      aria-label={open ? 'Close chat' : 'Ask the FilmUp concierge'}
    >
      {!open && <span className="absolute inset-0 animate-ping rounded-full bg-gold-400/30 [animation-duration:2.5s]" />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={open ? 'x' : 's'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
          {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
