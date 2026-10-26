import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Movie } from '../types'

interface Props {
  movies: Movie[]
  /** cinemas showing each movie on the selected date */
  cinemaCount: Map<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Pills stagger in once the intro has finished */
  revealed: boolean
}

const row = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.6 } } }
const pill = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
}

/** Slim bottom strip: poster thumbnail + title pills. Clicking one filters the map. */
export default function NowShowing({ movies, cinemaCount, selectedId, onSelect, revealed }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.75, behavior: 'smooth' })

  return (
    <section className="glass pointer-events-auto flex h-16 items-center gap-2 rounded-2xl pr-2 pl-4" aria-label="Now showing">
      <h2 className="hidden shrink-0 pr-2 font-display text-lg leading-none tracking-[0.12em] text-neutral-300 sm:block">
        Now <span className="text-gold-gradient">Showing</span>
      </h2>
      <button type="button" onClick={() => scroll(-1)} className="strip-arrow hidden sm:grid" aria-label="Scroll left">
        <ChevronLeft className="size-4" />
      </button>

      <motion.div
        ref={scroller}
        variants={row}
        initial="hidden"
        animate={revealed ? 'show' : 'hidden'}
        className="no-scrollbar flex min-w-0 flex-1 snap-x items-center gap-2 overflow-x-auto scroll-smooth py-2 [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-24px),transparent)]"
      >
        {movies.map((m) => {
          const selected = m.id === selectedId
          const count = cinemaCount.get(m.id) ?? 0
          return (
            <motion.button
              key={m.id}
              type="button"
              variants={pill}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(selected ? null : m.id)}
              aria-pressed={selected}
              title={`${m.title} — ${count ? `${count} ${count === 1 ? 'cinema' : 'cinemas'}` : 'not on this day'}`}
              className={`group flex h-12 shrink-0 snap-start items-center gap-2.5 rounded-xl border py-1 pr-3.5 pl-1 text-left transition-all duration-200 ${
                selected
                  ? 'border-gold-400/60 bg-gold-400/15 shadow-[0_0_24px_-6px_rgb(245_194_107/0.6)]'
                  : 'border-white/[0.06] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.07]'
              } ${count === 0 ? 'opacity-45' : ''}`}
            >
              <img src={m.poster} alt="" loading="lazy" draggable={false} className="h-10 w-[27px] shrink-0 rounded-md object-cover ring-1 ring-white/10" />
              <span className="min-w-0">
                <span className={`block max-w-[140px] truncate text-xs font-bold ${selected ? 'text-gold-100' : 'text-neutral-100'}`}>{m.title}</span>
                <span className="block text-[10px] font-medium text-neutral-500">
                  {m.rating} · {count ? `${count} ${count === 1 ? 'cinema' : 'cinemas'}` : 'Not today'}
                </span>
              </span>
            </motion.button>
          )
        })}
      </motion.div>

      <button type="button" onClick={() => scroll(1)} className="strip-arrow hidden sm:grid" aria-label="Scroll right">
        <ChevronRight className="size-4" />
      </button>
    </section>
  )
}
