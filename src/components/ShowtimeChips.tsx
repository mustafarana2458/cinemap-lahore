import { motion } from 'framer-motion'
import { formatTime, isPastShow, toISODate } from '../lib/schedule'

interface Props {
  date: string
  times: string[]
  now: Date
  /** Times outside the active time-of-day filter are shown muted */
  highlight?: (time: string) => boolean
  onSelect?: (time: string) => void
  size?: 'sm' | 'md'
}

export default function ShowtimeChips({ date, times, now, highlight, onSelect, size = 'md' }: Props) {
  const nextIdx = times.findIndex((t) => !isPastShow(date, t, now))

  return (
    <div className="flex flex-wrap gap-1.5">
      {times.map((t, i) => {
        const past = isPastShow(date, t, now)
        const muted = !past && highlight && !highlight(t)
        const isNext = i === nextIdx && date === toISODate(now)
        return (
          <motion.button
            key={t}
            type="button"
            disabled={past}
            onClick={() => onSelect?.(t)}
            whileHover={past ? undefined : { y: -2 }}
            whileTap={past ? undefined : { scale: 0.94 }}
            title={past ? 'This show has started' : `Select ${formatTime(t)}`}
            className={[
              'relative rounded-lg font-semibold tabular-nums transition-colors duration-200',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              past
                ? 'cursor-not-allowed bg-white/[0.02] text-neutral-600 line-through decoration-neutral-700'
                : muted
                  ? 'border border-white/5 bg-white/[0.03] text-neutral-400 hover:text-neutral-200'
                  : 'border border-gold-400/25 bg-gold-400/[0.08] text-gold-200 hover:border-gold-400/70 hover:bg-gold-400/20 hover:text-white hover:shadow-glow',
            ].join(' ')}
          >
            {isNext && (
              <span className="absolute -top-1 -right-1 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember-500 opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-ember-500" />
              </span>
            )}
            {formatTime(t)}
          </motion.button>
        )
      })}
    </div>
  )
}

