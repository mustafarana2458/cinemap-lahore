import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/** Opening title card: a projector beam sweeps in and the wordmark resolves. */
export default function Intro() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1700)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-ink-950"
          exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
        >
          <motion.div
            className="absolute top-1/2 left-1/2 h-[140vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_160deg,rgb(245_194_107/0.18)_180deg,transparent_200deg)]"
            initial={{ opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: '50% 0%' }}
          />
          <div className="relative text-center">
            <h1 className="flex font-display text-7xl tracking-[0.12em] sm:text-9xl" aria-label="CineMap">
              {'CINEMAP'.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  className={i < 4 ? 'text-white' : 'text-gold-gradient'}
                  initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.div
              className="mx-auto mt-3 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.p
              className="mt-3 text-[11px] font-semibold uppercase tracking-[0.5em] text-neutral-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              Lahore · Now Showing
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
