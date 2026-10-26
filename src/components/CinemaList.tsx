import { motion } from 'framer-motion'
import { Star, Navigation2, Clock } from 'lucide-react'
import type { Cinema, CinemaSchedule, LatLng } from '../types'
import { distanceKm, formatDistance } from '../lib/geo'
import { formatTime } from '../lib/schedule'

export interface NextShow {
  time: string
  title: string
}

interface Props {
  cinemas: Cinema[]
  matches: CinemaSchedule[]
  filtering: boolean
  /** Next upcoming show per cinema on the selected date (unfiltered) */
  nextShow: Map<string, NextShow>
  upcoming: (times: string[]) => string[]
  /** Sort by distance from here (user location or a searched area) */
  distanceFrom: LatLng | null
  selectedId: string | null
  onSelect: (id: string) => void
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } } }

export default function CinemaList({ cinemas, matches, filtering, nextShow, upcoming, distanceFrom, selectedId, onSelect }: Props) {
  const matchById = new Map(matches.map((m) => [m.cinema.id, m]))
  const rows = cinemas
    .filter((c) => !filtering || matchById.has(c.id))
    .map((c) => ({ cinema: c, km: distanceFrom ? distanceKm(distanceFrom, c) : null }))
    .sort((a, b) => (a.km != null && b.km != null ? a.km - b.km : b.cinema.rating - a.cinema.rating))

  if (!rows.length) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="font-display text-2xl tracking-wide text-white">No matches</p>
        <p className="mt-1 text-sm text-neutral-500">Try another date, time of day or genre.</p>
      </div>
    )
  }

  return (
    <motion.ul key={`${filtering}-${rows.length}-${distanceFrom?.lat}-${distanceFrom?.lng}`} variants={list} initial="hidden" animate="show" className="space-y-1 p-2">
      {rows.map(({ cinema, km }, i) => {
        const match = matchById.get(cinema.id)
        const times = filtering && match ? upcoming([...new Set(match.showings.flatMap((s) => s.times))].sort()) : []
        const next = nextShow.get(cinema.id)
        const active = cinema.id === selectedId
        return (
          <motion.li key={cinema.id} variants={item}>
            <button
              type="button"
              onClick={() => onSelect(cinema.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 active:scale-[0.99] ${
                active ? 'bg-gold-400/[0.09] ring-1 ring-gold-400/35' : 'hover:bg-white/[0.045]'
              }`}
            >
              <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-ink-700 ring-1 ring-white/[0.08]">
                <img src={cinema.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-[13px] font-bold leading-tight ${active ? 'text-gold-100' : 'text-white'}`}>{cinema.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-neutral-400">
                    <Star className="size-3 fill-gold-400 text-gold-400" />
                    {cinema.rating.toFixed(1)}
                  </span>
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="truncate">{cinema.area}</span>
                  {km != null && (
                    <>
                      <span className="text-neutral-700">•</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${i === 0 ? 'text-sky-300' : 'text-neutral-400'}`}>
                        <Navigation2 className="size-2.5 rotate-45" />
                        {formatDistance(km)}
                        {i === 0 && <span className="ml-0.5 text-[9px] font-extrabold uppercase tracking-wider">closest</span>}
                      </span>
                    </>
                  )}
                </p>

                {filtering && match ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {times.length ? (
                      times.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-md bg-gold-400/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gold-200">
                          {formatTime(t)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-medium text-neutral-500">All matching shows have started</span>
                    )}
                    {times.length > 4 && <span className="px-1 text-[10px] font-semibold text-neutral-500">+{times.length - 4}</span>}
                  </div>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                    <Clock className="size-3 shrink-0 text-gold-400/80" />
                    {next ? (
                      <span className="truncate text-neutral-300">
                        <span className="font-bold tabular-nums text-gold-200">{formatTime(next.time)}</span>
                        <span className="text-neutral-500"> · {next.title}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-500">No more shows this day</span>
                    )}
                  </p>
                )}
              </div>
            </button>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
