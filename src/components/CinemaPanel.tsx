import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import { Navigation, Phone, Star, X, MapPin, Clapperboard, MonitorPlay, ShieldAlert } from 'lucide-react'
import type { Cinema, CinemaData, Filters, LatLng } from '../types'
import { cinemaDay, dateOptions, timeOfDay, toISODate } from '../lib/schedule'
import { directionsUrl, distanceKm, formatDistance } from '../lib/geo'
import DateSelector from './DateSelector'
import MovieCard from './MovieCard'

interface Props {
  cinema: Cinema | null
  data: CinemaData
  filters: Filters
  now: Date
  isDesktop: boolean
  userLocation: LatLng | null
  onDateChange: (iso: string) => void
  onClose: () => void
  onSelectTime: (cinema: Cinema, movieId: string, time: string) => void
  onMovieFilter: (movieId: string) => void
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }

export default function CinemaPanel(props: Props) {
  const { cinema, isDesktop, onClose } = props
  const drag = useDragControls()

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 600) onClose()
  }

  return (
    <AnimatePresence>
      {cinema &&
        (isDesktop ? (
          <motion.aside
            key="panel"
            initial={{ x: '110%', opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '110%', opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            className="glass fixed top-4 right-4 bottom-4 z-40 flex w-[440px] flex-col overflow-hidden rounded-3xl"
            aria-label={`${cinema.name} details`}
          >
            <PanelBody {...props} cinema={cinema} />
          </motion.aside>
        ) : (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
              className="glass fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] pb-[env(safe-area-inset-bottom)]"
              aria-label={`${cinema.name} details`}
            >
              <div
                onPointerDown={(e) => drag.start(e)}
                className="absolute inset-x-0 top-0 z-20 flex h-7 cursor-grab touch-none justify-center pt-2.5 active:cursor-grabbing"
              >
                <span className="h-1.5 w-11 rounded-full bg-white/30" />
              </div>
              <PanelBody {...props} cinema={cinema} onHeroPointerDown={(e) => drag.start(e)} />
            </motion.aside>
          </>
        ))}
    </AnimatePresence>
  )
}

function PanelBody({
  cinema,
  data,
  filters,
  now,
  userLocation,
  onDateChange,
  onClose,
  onSelectTime,
  onMovieFilter,
  onHeroPointerDown,
}: Props & { cinema: Cinema; onHeroPointerDown?: (e: React.PointerEvent) => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const days = useMemo(() => dateOptions(toISODate(now)), [now])
  const showings = useMemo(() => {
    const all = cinemaDay(data, cinema.id, filters.date)
    // Pin the searched movie to the top
    return filters.movieId ? [...all].sort((a, b) => Number(b.movie.id === filters.movieId) - Number(a.movie.id === filters.movieId)) : all
  }, [data, cinema.id, filters.date, filters.movieId])

  const distance = userLocation ? formatDistance(distanceKm(userLocation, cinema)) : null
  const q = filters.query.trim().toLowerCase()
  const isMatch = (title: string, id: string, genres: string[]) =>
    (filters.movieId ? id === filters.movieId : q ? title.toLowerCase().includes(q) : false) ||
    (!!filters.genre && !filters.movieId && !q && genres.includes(filters.genre))
  const timeHighlight = filters.timesOfDay.length ? (t: string) => filters.timesOfDay.includes(timeOfDay(t)) : undefined

  return (
    <>
      {/* Hero */}
      <div className="relative h-52 shrink-0 overflow-hidden sm:h-56" onPointerDown={onHeroPointerDown} style={{ touchAction: onHeroPointerDown ? 'none' : undefined }}>
        <motion.img
          key={cinema.id}
          src={cinema.image}
          alt=""
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: imgLoaded ? 1 : 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/50 to-ink-900/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/60 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:rotate-90 hover:bg-black/70"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <motion.div
          key={`${cinema.id}-title`}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-5 bottom-4"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-gold-200 ring-1 ring-gold-400/30">
              <Star className="size-3 fill-gold-400 text-gold-400" /> {cinema.rating.toFixed(1)}
            </span>
            {cinema.area}
            {distance && <span className="text-neutral-400">· {distance}</span>}
          </div>
          <h2 className="font-display text-[44px] leading-[0.9] tracking-wide text-white drop-shadow-lg">{cinema.name}</h2>
        </motion.div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Info + actions */}
        <div className="space-y-4 px-5 pt-4">
          <p className="flex items-start gap-2 text-sm text-neutral-400">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" />
            {cinema.address}, {cinema.city}
          </p>
          <div className="flex gap-2">
            <a
              href={directionsUrl(cinema)}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-3 text-sm font-bold text-ink-950 shadow-glow transition hover:brightness-110 active:scale-[0.98]"
            >
              <Navigation className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              Get Directions
            </a>
            {cinema.phone && (
              <a
                href={`tel:${cinema.phone.replace(/\s/g, '')}`}
                className="glass-soft inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Phone className="size-4" />
                <span className="hidden sm:inline">Call</span>
              </a>
            )}
          </div>
          {!cinema.verified && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200/90">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              Listing not fully verified — call ahead before you go.
            </p>
          )}
          {!!cinema.features?.length && (
            <div className="flex flex-wrap gap-1.5">
              {cinema.features.map((f) => (
                <span key={f} className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-medium text-neutral-400">
                  {f}
                </span>
              ))}
              {cinema.screens && !cinema.features.some((f) => /screen/i.test(f)) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-medium text-neutral-400">
                  <MonitorPlay className="size-3" /> {cinema.screens} {cinema.screens === 1 ? 'screen' : 'screens'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date selector — sticky so it stays reachable while scrolling */}
        <div className="sticky top-0 z-10 mt-5 border-y border-white/5 bg-ink-900/85 px-4 py-2 backdrop-blur-xl">
          <DateSelector options={days} value={filters.date} onChange={onDateChange} layoutId="panel-date" />
        </div>

        {/* Movies */}
        <div className="px-4 pt-4 pb-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h3 className="font-display text-2xl tracking-wider text-white">Playing</h3>
            <span className="text-xs font-medium text-neutral-500">
              {showings.length} {showings.length === 1 ? 'film' : 'films'}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={`${cinema.id}-${filters.date}`} variants={list} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="space-y-3">
              {showings.length ? (
                showings.map(({ movie, times }) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    times={times}
                    date={filters.date}
                    now={now}
                    highlighted={isMatch(movie.title, movie.id, movie.genre)}
                    highlightTime={timeHighlight}
                    onSelectTime={(t) => onSelectTime(cinema, movie.id, t)}
                    onMovieClick={() => onMovieFilter(movie.id)}
                  />
                ))
              ) : (
                <div className="glass-soft flex flex-col items-center rounded-2xl px-6 py-10 text-center">
                  <Clapperboard className="mb-3 size-8 text-neutral-600" />
                  <p className="font-semibold text-neutral-300">No shows scheduled</p>
                  <p className="mt-1 text-sm text-neutral-500">Try another date for {cinema.name}.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
