import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { List, X, ChevronsLeft, ChevronsRight, Navigation } from 'lucide-react'
import type { Area, Cinema, CinemaData, Filters as FilterState, LatLng } from './types'
import { useCinemaData } from './hooks/useCinemaData'
import { useGeolocation } from './hooks/useGeolocation'
import { useIsDesktop } from './hooks/useMediaQuery'
import { useNow } from './hooks/useNow'
import { dateOptions, formatTime, hasActiveFilters, isPastShow, querySchedule, toISODate, toMinutes } from './lib/schedule'
import { distanceKm } from './lib/geo'
import CinemaMap, { type MapHandle, type MapPadding } from './components/Map'
import CinemaPanel from './components/CinemaPanel'
import MoviePanel from './components/MoviePanel'
import CinemaList, { type NextShow } from './components/CinemaList'
import SearchBar, { type SearchMode } from './components/SearchBar'
import { DateChip, FiltersButton } from './components/Filters'
import NowShowing from './components/NowShowing'
import NearMeButton from './components/NearMeButton'
import ChatBot, { ChatLauncher } from './components/ChatBot'
import Intro from './components/Intro'
import Toast, { type ToastData } from './components/Toast'

const ease = [0.22, 1, 0.36, 1] as const

/* Layout constants (8px grid). Desktop = ≥1024px. */
const G = 16 // outer gutter
const BAR_H = 56
const LIST_W = 344
const PANEL_W = 440
const STRIP_H = 64
const FAB = 56

type Origin = LatLng & { label: string }

export default function App() {
  const state = useCinemaData()
  /** Flips when the intro video or title card finishes: the map flies in and the UI enters */
  const [revealed, setRevealed] = useState(false)
  const onIntroFinish = useCallback(() => setRevealed(true), [])
  return (
    <>
      <Intro onFinish={onIntroFinish} />
      <div className="grain" aria-hidden />
      {state.status === 'ready' ? (
        <MapExperience data={state.data} revealed={revealed} />
      ) : state.status === 'error' ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="font-display text-4xl tracking-wide text-white">Projector jammed</p>
            <p className="mt-2 text-sm text-neutral-400">{state.error}</p>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MapExperience({ data, revealed }: { data: CinemaData; revealed: boolean }) {
  const now = useNow()
  const today = toISODate(now)
  const isDesktop = useIsDesktop()
  const geo = useGeolocation()
  const mapRef = useRef<MapHandle>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const initialFilters: FilterState = { date: today, query: '', movieId: null, genre: null, cinemaId: null, timesOfDay: [] }
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [searchMode, setSearchMode] = useState<SearchMode>('movie')
  const [locationText, setLocationText] = useState('')
  const [origin, setOrigin] = useState<Origin | null>(null)
  /** Highlighted on the map immediately… */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** …panel opens once the camera arrives */
  const [panelId, setPanelId] = useState<string | null>(null)
  /** Movie Detail panel */
  const [moviePanelId, setMoviePanelId] = useState<string | null>(null)
  /** Set when a cinema was opened from the Movie panel, so it can offer "Back to movie" */
  const [backToMovieId, setBackToMovieId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [listOpen, setListOpen] = useState(true) // desktop sidebar
  const [sheetOpen, setSheetOpen] = useState(false) // mobile results sheet
  const [barFocused, setBarFocused] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)

  const patch = useCallback((p: Partial<FilterState>) => setFilters((f) => ({ ...f, ...p })), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // Roll the date forward if the app is left open past midnight
  useEffect(() => {
    setFilters((f) => (f.date < today ? { ...f, date: today } : f))
  }, [today])

  // ── derived data ────────────────────────────────────────────
  const dates = useMemo(() => dateOptions(today), [today])
  const filtering = hasActiveFilters(filters)
  const matches = useMemo(() => querySchedule(data, filters), [data, filters])
  const genres = useMemo(() => [...new Set(data.movies.flatMap((m) => m.genre))].sort(), [data])
  const byId = useMemo(() => new Map(data.cinemas.map((c) => [c.id, c])), [data])
  const movieTitle = useMemo(() => new Map(data.movies.map((m) => [m.id, m.title])), [data])

  const { cinemaCount, nextShow } = useMemo(() => {
    const cinemaCount = new Map<string, number>()
    const nextShow = new Map<string, NextShow>()
    for (const s of data.showtimes) {
      if (s.date !== filters.date) continue
      cinemaCount.set(s.movieId, (cinemaCount.get(s.movieId) ?? 0) + 1)
      const t = s.times.find((x) => !isPastShow(s.date, x, now))
      const prev = nextShow.get(s.cinemaId)
      if (t && (!prev || toMinutes(t) < toMinutes(prev.time))) nextShow.set(s.cinemaId, { time: t, title: movieTitle.get(s.movieId) ?? '' })
    }
    return { cinemaCount, nextShow }
  }, [data, filters.date, now, movieTitle])

  /** Every movie, most widely showing (on the selected date) first */
  const moviesByReach = useMemo(
    () => [...data.movies].sort((a, b) => (cinemaCount.get(b.id) ?? 0) - (cinemaCount.get(a.id) ?? 0) || a.title.localeCompare(b.title)),
    [data, cinemaCount],
  )
  const nowShowing = useMemo(() => {
    const playing = new Set(data.showtimes.map((s) => s.movieId))
    return moviesByReach.filter((m) => playing.has(m.id))
  }, [data, moviesByReach])

  const upcoming = useCallback((times: string[]) => times.filter((t) => !isPastShow(filters.date, t, now)), [filters.date, now])

  const panelCinema = (panelId && byId.get(panelId)) || null
  const panelMovie = data.movies.find((m) => m.id === moviePanelId) ?? null
  const backMovie = data.movies.find((m) => m.id === backToMovieId) ?? null
  const anyPanel = !!panelId || !!moviePanelId
  const panelOpen = isDesktop && (!!panelCinema || !!panelMovie)
  const showTimes = Boolean(filters.movieId || filters.query.trim())
  const distanceFrom: LatLng | null = origin ?? geo.location
  const pickedMovie = data.movies.find((m) => m.id === filters.movieId) ?? null

  // ── layout: what each UI layer covers, so the camera keeps targets visible ──
  const rightInset = panelOpen ? PANEL_W + G * 2 : G
  const paddingFor = useCallback(
    (panel: boolean): MapPadding =>
      isDesktop
        ? { top: G + BAR_H, bottom: STRIP_H + G, left: listOpen ? LIST_W + G * 2 : G, right: panel ? PANEL_W + G * 2 : FAB + G * 2 }
        : { top: 112, bottom: panel ? Math.round(window.innerHeight * 0.6) : STRIP_H + 24, left: 0, right: 0 },
    [isDesktop, listOpen],
  )
  // On mobile the results sheet covers the lower ~60% just like the detail panel does
  const mapPadding = useMemo(() => paddingFor(anyPanel || (!isDesktop && sheetOpen)), [paddingFor, anyPanel, isDesktop, sheetOpen])

  // Frame the matching cinemas whenever the filtered set changes
  const matchKey = matches.map((m) => m.cinema.id).sort().join(',')
  useEffect(() => {
    if (!filtering || selectedId || !matches.length) return
    mapRef.current?.fitPoints(matches.map((m) => m.cinema))
    // Deliberately keyed on the set of ids, not the array identity
  }, [matchKey, filtering])

  // Frame the user + the three nearest cinemas once a location fix arrives
  useEffect(() => {
    if (!geo.location) return
    const loc = geo.location
    const nearest = [...data.cinemas].sort((a, b) => distanceKm(loc, a) - distanceKm(loc, b)).slice(0, 3)
    mapRef.current?.fitPoints([loc, ...nearest])
    setOrigin(null)
  }, [geo.location, data.cinemas])

  // Esc closes the top-most panel: the cinema first, then the movie
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (panelId || selectedId) {
        setPanelId(null)
        setSelectedId(null)
        setBackToMovieId(null)
      } else setMoviePanelId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelId, selectedId])

  // ── actions ─────────────────────────────────────────────────
  const selectCinema = (id: string, fromMovieId: string | null = null) => {
    const cinema = byId.get(id)
    if (!cinema) return
    setSheetOpen(false)
    setMoviePanelId(null)
    setBackToMovieId(fromMovieId)
    setSelectedId(id)
    setPanelId(null)
    mapRef.current?.flyToCinema(cinema, () => setPanelId(id), paddingFor(true))
  }
  const closePanel = () => {
    setPanelId(null)
    setSelectedId(null)
    setBackToMovieId(null)
  }

  /** Movie search + open its detail panel (dropdown, Now Showing strip, posters in the cinema panel) */
  const pickMovie = (id: string | null) => {
    const movie = data.movies.find((m) => m.id === id)
    setSearchMode('movie')
    setLocationText('')
    patch({ movieId: movie?.id ?? null, query: movie?.title ?? '' })
    closePanel()
    setSheetOpen(false)
    setMoviePanelId(movie?.id ?? null)
  }

  const backToMovie = () => {
    if (!backToMovieId) return
    const id = backToMovieId
    closePanel()
    setMoviePanelId(id)
    if (filters.movieId !== id) patch({ movieId: id, query: data.movies.find((m) => m.id === id)?.title ?? '' })
    // The match set hasn't changed, so the auto-framing effect won't fire — frame it here
    setTimeout(() => mapRef.current?.fitPoints(matches.map((m) => m.cinema)), 50)
  }

  const pickArea = (area: Area) => {
    setLocationText(area.name)
    setOrigin({ lat: area.lat, lng: area.lng, label: area.name })
    closePanel()
    setMoviePanelId(null)
    mapRef.current?.flyToPoint(area, 14)
    if (!isDesktop) setTimeout(() => setSheetOpen(true), 900)
  }

  const changeMode = (mode: SearchMode) => {
    if (mode === searchMode) return
    setSearchMode(mode)
    setMoviePanelId(null)
    if (mode === 'location') patch({ query: '', movieId: null })
    else {
      setLocationText('')
      setOrigin(null)
    }
  }

  const clearSearch = () => {
    setMoviePanelId(null)
    if (searchMode === 'movie') patch({ query: '', movieId: null })
    else {
      setLocationText('')
      setOrigin(null)
    }
  }

  const reset = () => {
    setFilters((f) => ({ ...initialFilters, date: f.date }))
    setOrigin(null)
    setLocationText('')
  }

  const onSelectTime = (cinema: Cinema, movieId: string, time: string) => {
    const day = dates.find((d) => d.iso === filters.date)
    setToast({
      id: Date.now(),
      title: `${movieTitle.get(movieId)} · ${formatTime(time)}`,
      subtitle: `${cinema.name} · ${day?.label === day?.weekday ? `${day?.weekday} ${day?.day} ${day?.month}` : day?.label}`,
      phone: cinema.phone || undefined,
    })
  }

  const listCount = filtering ? matches.length : data.cinemas.length
  const listTitle = pickedMovie ? pickedMovie.title : origin ? `Near ${origin.label}` : 'Cinemas'
  const listHint = pickedMovie ? 'Showtimes by cinema' : distanceFrom ? 'Nearest first' : 'Top rated'

  const list = (
    <CinemaList
      cinemas={data.cinemas}
      matches={matches}
      filtering={filtering}
      nextShow={nextShow}
      upcoming={upcoming}
      distanceFrom={distanceFrom}
      selectedId={selectedId}
      onSelect={selectCinema}
    />
  )

  const originChip = origin && (
    <button
      type="button"
      onClick={() => {
        setOrigin(null)
        setLocationText('')
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-300/10 px-2 py-1 text-[10px] font-bold text-sky-200 transition hover:bg-sky-300/20"
      aria-label={`Stop sorting by distance from ${origin.label}`}
    >
      <Navigation className="size-3" /> {origin.label} <X className="size-3" />
    </button>
  )

  const dateAndFilters = (
    <>
      <DateChip dates={dates} value={filters.date} onChange={(date) => patch({ date })} />
      <FiltersButton filters={filters} genres={genres} cinemas={data.cinemas} resultCount={matches.length} onChange={patch} onReset={reset} />
    </>
  )

  const listHeader = (size: 'md' | 'lg') => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className={`truncate font-display leading-none tracking-wider text-white ${size === 'lg' ? 'text-[28px]' : 'text-2xl'}`}>
          {listTitle} <span className="text-gold-400">{listCount}</span>
        </h2>
        {!origin && <p className="mt-1 text-[11px] font-medium text-neutral-500">{listHint}</p>}
      </div>
      {originChip}
    </div>
  )

  return (
    <div className="relative h-full overflow-hidden">
      <CinemaMap
        ref={mapRef}
        cinemas={data.cinemas}
        matches={matches}
        filtering={filtering}
        showTimes={showTimes}
        upcoming={upcoming}
        selectedId={selectedId}
        onSelect={selectCinema}
        userLocation={geo.location}
        origin={origin}
        padding={mapPadding}
        startIntro={revealed}
        controlsRight={isDesktop ? rightInset : 12}
      />
      <div className="vignette" aria-hidden />

      {/* ── Command bar ─────────────────────────────────────── */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={revealed ? { y: 0, opacity: 1 } : { y: -24, opacity: 0 }}
        transition={{ delay: 0.35, duration: 0.7, ease }}
        className="pointer-events-none fixed top-3 right-3 left-3 z-30 lg:top-4 lg:left-4"
        style={isDesktop ? { right: rightInset, transition: 'right 0.5s cubic-bezier(0.22,1,0.36,1)' } : undefined}
      >
        <div
          ref={barRef}
          className={`glass pointer-events-auto flex h-14 w-full items-center gap-2 rounded-2xl p-2 transition-shadow duration-300 lg:max-w-[880px] ${
            barFocused ? 'shadow-[var(--shadow-panel),0_0_0_1px_rgb(245_194_107/0.35),0_0_32px_-8px_rgb(245_194_107/0.45)]' : ''
          }`}
        >
          <Logo />
          <SearchBar
            mode={searchMode}
            onModeChange={changeMode}
            value={searchMode === 'movie' ? filters.query : locationText}
            onChange={(text) => (searchMode === 'movie' ? patch({ query: text, movieId: null }) : setLocationText(text))}
            movies={moviesByReach}
            cinemaCount={cinemaCount}
            cinemas={data.cinemas}
            areas={data.areas}
            anchorRef={barRef}
            pickedMovieId={filters.movieId}
            onPickMovie={pickMovie}
            onPickArea={pickArea}
            onPickCinema={selectCinema}
            onClear={clearSearch}
            onFocusChange={setBarFocused}
          />
          {isDesktop && (
            <>
              <span className="mx-1 h-6 w-px shrink-0 bg-white/[0.08]" aria-hidden />
              <div className="flex shrink-0 items-center gap-2">{dateAndFilters}</div>
            </>
          )}
          <NearMeButton status={geo.status} onLocate={geo.locate} onClear={geo.clear} />
        </div>

        {!isDesktop && (
          <div className="pointer-events-auto mt-2 flex items-center gap-2">
            {dateAndFilters}
            <button type="button" onClick={() => setSheetOpen(true)} className="chip ml-auto glass" aria-label="Show cinema list">
              <List className="size-3.5" />
              <span>{listCount}</span>
            </button>
          </div>
        )}

        <AnimatePresence>
          {geo.error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto mt-2 inline-block rounded-lg bg-ember-500/15 px-3 py-1.5 text-xs font-medium text-ember-400">
              {geo.error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── Desktop results list ─────────────────────────────── */}
      {isDesktop && (
        <motion.aside
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: listOpen ? 0 : -(LIST_W + G), opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.5, ease, opacity: { delay: 0.5 } }}
          className="glass fixed z-20 flex flex-col rounded-2xl"
          style={{ top: G + BAR_H + G, bottom: G, left: G, width: LIST_W }}
        >
          <div className="border-b border-white/[0.06] px-5 pt-4 pb-3">{listHeader('md')}</div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{list}</div>
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="glass absolute top-1/2 -right-3 grid h-12 w-6 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition hover:text-gold-300"
            style={{ right: listOpen ? -12 : -28 }}
            aria-label={listOpen ? 'Hide cinema list' : 'Show cinema list'}
          >
            {listOpen ? <ChevronsLeft className="size-3.5" /> : <ChevronsRight className="size-3.5" />}
          </button>
        </motion.aside>
      )}

      {/* ── Now Showing strip + chat launcher ───────────────── */}
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={revealed ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.45, duration: 0.7, ease }}
        className="pointer-events-none fixed z-30"
        style={
          isDesktop
            ? { bottom: G, left: listOpen ? LIST_W + G * 2 : G, right: rightInset + FAB + G, transition: 'left 0.5s cubic-bezier(0.22,1,0.36,1), right 0.5s cubic-bezier(0.22,1,0.36,1)' }
            : { bottom: 'max(12px, env(safe-area-inset-bottom))', left: 12, right: 12 + 48 + 8 }
        }
      >
        <NowShowing revealed={revealed} movies={nowShowing} cinemaCount={cinemaCount} selectedId={filters.movieId} onSelect={pickMovie} />
      </motion.div>
      <div
        className="fixed z-30"
        style={
          isDesktop
            ? { bottom: G + (STRIP_H - FAB) / 2, right: rightInset, transition: 'right 0.5s cubic-bezier(0.22,1,0.36,1)' }
            : { bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 8px)', right: 12 }
        }
      >
        <ChatLauncher revealed={revealed} open={chatOpen} onClick={() => setChatOpen((o) => !o)} />
      </div>

      {/* ── Mobile results sheet ────────────────────────────── */}
      <AnimatePresence>
        {!isDesktop && sheetOpen && (
          <>
            <motion.div key="list-scrim" className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheetOpen(false)} />
            <motion.div
              key="list-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && setSheetOpen(false)}
              className="glass fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex justify-center pt-2">
                <span className="h-1 w-10 rounded-full bg-white/25" />
              </div>
              <div className="flex items-start gap-3 px-5 pt-3 pb-3">
                <div className="min-w-0 flex-1">{listHeader('lg')}</div>
                <button type="button" onClick={() => setSheetOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-neutral-300" aria-label="Close list">
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06]" onPointerDownCapture={(e) => e.stopPropagation()}>
                {list}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CinemaPanel
        cinema={panelCinema}
        data={data}
        filters={filters}
        now={now}
        isDesktop={isDesktop}
        userLocation={distanceFrom}
        onDateChange={(date) => patch({ date })}
        onClose={closePanel}
        onSelectTime={onSelectTime}
        onMovieFilter={pickMovie}
        back={backMovie ? { label: backMovie.title, onBack: backToMovie } : null}
      />

      <MoviePanel
        movie={panelMovie}
        data={data}
        date={filters.date}
        now={now}
        isDesktop={isDesktop}
        distanceFrom={distanceFrom}
        onDateChange={(date) => patch({ date })}
        onClose={() => setMoviePanelId(null)}
        onSelectCinema={(id) => selectCinema(id, moviePanelId)}
        onSelectTime={onSelectTime}
      />

      <ChatBot open={chatOpen} onClose={() => setChatOpen(false)} userLocation={geo.location} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

function Logo() {
  return (
    <a href="/" className="group flex shrink-0 items-center gap-2 pr-1" aria-label="FilmUp home">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] ring-1 ring-gold-400/25">
        <svg viewBox="0 0 24 24" className="size-5 text-gold-400 transition-transform duration-700 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="7.5" r="1.7" fill="currentColor" />
          <circle cx="12" cy="16.5" r="1.7" fill="currentColor" />
          <circle cx="7.5" cy="12" r="1.7" fill="currentColor" />
          <circle cx="16.5" cy="12" r="1.7" fill="currentColor" />
          <circle cx="12" cy="12" r="1" className="fill-ember-500 stroke-none" />
        </svg>
      </span>
      <span className="wordmark hidden text-[22px] lg:block">FilmUp</span>
    </a>
  )
}
