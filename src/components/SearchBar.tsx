import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, MapPin, Clapperboard, Navigation, Check } from 'lucide-react'
import type { Area, Cinema, Movie } from '../types'
import { formatDuration } from '../lib/schedule'

export type SearchMode = 'movie' | 'location'

interface Props {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  value: string
  onChange: (text: string) => void
  /** All movies, in the order they should be listed */
  movies: Movie[]
  /** Cinemas showing each movie on the selected date */
  cinemaCount: Map<string, number>
  cinemas: Cinema[]
  areas: Area[]
  pickedMovieId: string | null
  onPickMovie: (id: string) => void
  onPickArea: (area: Area) => void
  onPickCinema: (id: string) => void
  onClear: () => void
  onFocusChange?: (focused: boolean) => void
  /** The floating bar — the dropdown aligns to it so it can span the full bar on mobile */
  anchorRef: RefObject<HTMLElement | null>
}

type Suggestion =
  | { kind: 'movie'; id: string; movie: Movie }
  | { kind: 'area'; id: string; area: Area }
  | { kind: 'cinema'; id: string; cinema: Cinema }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '')

export default function SearchBar(props: Props) {
  const { mode, onModeChange, value, onChange, movies, cinemaCount, cinemas, areas, pickedMovieId, onPickMovie, onPickArea, onPickCinema, onClear, onFocusChange, anchorRef } = props
  const [focused, setFocused] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const picked = movies.find((m) => m.id === pickedMovieId)
  // With a movie already picked, the input holds its title — show the full list so it's easy to switch
  const q = picked && value === picked.title ? '' : norm(value.trim())

  const suggestions = useMemo<Suggestion[]>(() => {
    if (mode === 'movie') {
      return movies
        .filter((m) => !q || norm(m.title).includes(q) || m.genre.some((g) => norm(g).startsWith(q)) || norm(m.language).startsWith(q))
        .map((m) => ({ kind: 'movie', id: m.id, movie: m }))
    }
    const areaHits = areas
      .filter((a) => !q || [a.name, ...a.aliases].some((n) => norm(n).includes(q)))
      .map((a): Suggestion => ({ kind: 'area', id: a.id, area: a }))
    const cinemaHits = q
      ? cinemas
          .filter((c) => norm(c.name).includes(q) || norm(c.area).includes(q) || norm(c.address).includes(q))
          .map((c): Suggestion => ({ kind: 'cinema', id: c.id, cinema: c }))
      : []
    return [...cinemaHits, ...areaHits]
  }, [mode, q, movies, areas, cinemas])

  const open = focused && suggestions.length > 0

  // Position the dropdown under the bar: full bar width on small screens, a comfortable column on desktop
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const bar = anchorRef.current?.getBoundingClientRect()
      const own = inputRef.current?.closest('[data-search-root]')?.getBoundingClientRect()
      if (!bar || !own) return
      const desktop = window.innerWidth >= 1024
      const left = desktop ? Math.max(bar.left, own.left - 8) : bar.left
      const width = desktop ? Math.min(Math.max(own.width + 16, 440), 560) : bar.width
      const top = bar.bottom + 8
      setRect({ top, left, width, maxHeight: Math.max(240, Math.min(560, window.innerHeight - top - 96)) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchorRef])

  // Keep the keyboard cursor in view in long lists
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const pick = (s: Suggestion) => {
    if (s.kind === 'movie') onPickMovie(s.id)
    else if (s.kind === 'area') onPickArea(s.area)
    else onPickCinema(s.id)
    inputRef.current?.blur()
  }

  const placeholder = mode === 'movie' ? 'Search a movie…' : 'Search an area or cinema — Gulberg, DHA…'
  const heading = mode === 'movie' ? (q ? `${suggestions.length} ${suggestions.length === 1 ? 'match' : 'matches'}` : `All movies · ${movies.length}`) : q ? null : `Areas · ${areas.length}`

  return (
    <div className="relative min-w-0 flex-1" data-search-root>
      <div className="flex min-w-0 items-center gap-2">
        {/* Mode toggle */}
        <div className="relative flex shrink-0 rounded-xl bg-white/[0.04] p-0.5" role="radiogroup" aria-label="Search mode">
          {(['movie', 'location'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the input so the list stays open
              onClick={() => {
                onModeChange(m)
                setCursor(0)
                inputRef.current?.focus()
              }}
              className={`relative inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-bold transition-colors ${
                mode === m ? 'text-ink-950' : 'text-neutral-400 hover:text-white'
              }`}
              title={m === 'movie' ? 'Search by movie' : 'Search by location'}
            >
              {mode === m && (
                <motion.span layoutId="search-mode" className="absolute inset-0 rounded-[10px] bg-gradient-to-b from-gold-300 to-gold-500" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
              )}
              {m === 'movie' ? <Clapperboard className="relative size-3.5" /> : <MapPin className="relative size-3.5" />}
              <span className="relative hidden md:inline">{m === 'movie' ? 'Movie' : 'Location'}</span>
            </button>
          ))}
        </div>

        <Search className={`size-4 shrink-0 transition-colors ${focused ? 'text-gold-400' : 'text-neutral-500'}`} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setCursor(0)
          }}
          onFocus={() => {
            setFocused(true)
            setCursor(0)
            onFocusChange?.(true)
          }}
          onBlur={() =>
            setTimeout(() => {
              setFocused(false)
              onFocusChange?.(false)
            }, 120)
          }
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') setCursor((c) => (c + 1) % suggestions.length)
            else if (e.key === 'ArrowUp') setCursor((c) => (c - 1 + suggestions.length) % suggestions.length)
            else if (e.key === 'Enter') pick(suggestions[Math.min(cursor, suggestions.length - 1)])
            else if (e.key === 'Escape') inputRef.current?.blur()
            else return
            e.preventDefault()
          }}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder:text-neutral-500 focus:outline-none"
          aria-label={mode === 'movie' ? 'Search by movie' : 'Search by location'}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          aria-activedescendant={open ? `sugg-${cursor}` : undefined}
          aria-autocomplete="list"
        />
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClear}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-neutral-300 hover:bg-white/15 hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.ul
              key={mode}
              ref={listRef}
              id="search-suggestions"
              role="listbox"
              aria-label={mode === 'movie' ? 'Movies' : 'Areas and cinemas'}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight, transformOrigin: 'top left' }}
              className="glass fixed z-[70] overflow-y-auto overscroll-contain rounded-2xl p-2"
              onMouseDown={(e) => e.preventDefault()} // clicks inside shouldn't blur the input
            >
              {heading && <li className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">{heading}</li>}
              {suggestions.map((s, i) => (
                <motion.li
                  key={`${s.kind}-${s.id}`}
                  id={`sugg-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === cursor}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.018, duration: 0.2 }}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => pick(s)}
                    onMouseEnter={() => setCursor(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 ${i === cursor ? 'bg-white/[0.07]' : ''}`}
                  >
                    {s.kind === 'movie' ? <MovieRow movie={s.movie} count={cinemaCount.get(s.id) ?? 0} picked={s.id === pickedMovieId} /> : s.kind === 'area' ? <AreaRow area={s.area} /> : <CinemaRow cinema={s.cinema} />}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function MovieRow({ movie, count, picked }: { movie: Movie; count: number; picked: boolean }) {
  return (
    <>
      <img src={movie.poster} alt="" loading="lazy" draggable={false} className="h-12 w-8 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${picked ? 'text-gold-200' : 'text-white'}`}>{movie.title}</span>
        <span className="block truncate text-xs text-neutral-500">
          {movie.genre.join(' · ')} · {formatDuration(movie.duration)}
        </span>
        <span className={`mt-0.5 block text-[11px] font-semibold ${count ? 'text-gold-300/90' : 'text-neutral-600'}`}>
          {count ? `Showing at ${count} ${count === 1 ? 'cinema' : 'cinemas'}` : 'Not showing on this date'}
        </span>
      </span>
      {picked ? <Check className="size-4 shrink-0 text-gold-400" /> : <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">{movie.rating}</span>}
    </>
  )
}

function AreaRow({ area }: { area: Area }) {
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-300/10 text-sky-300">
        <Navigation className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{area.name}</span>
        <span className="block truncate text-xs text-neutral-500">Area · show nearby cinemas</span>
      </span>
    </>
  )
}

function CinemaRow({ cinema }: { cinema: Cinema }) {
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-400/12 text-gold-300">
        <MapPin className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{cinema.name}</span>
        <span className="block truncate text-xs text-neutral-500">
          Cinema · {cinema.area} · {cinema.address}
        </span>
      </span>
    </>
  )
}
