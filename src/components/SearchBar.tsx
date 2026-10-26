import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, Film, MapPin, Clapperboard, Navigation } from 'lucide-react'
import type { Area, Cinema, Movie } from '../types'

export type SearchMode = 'movie' | 'location'

interface Props {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  value: string
  onChange: (text: string) => void
  movies: Movie[]
  cinemas: Cinema[]
  areas: Area[]
  /** In movie mode, a picked movie locks the suggestions closed until the text changes */
  pickedMovieId: string | null
  onPickMovie: (id: string) => void
  onPickArea: (area: Area) => void
  onPickCinema: (id: string) => void
  onClear: () => void
  onFocusChange?: (focused: boolean) => void
}

type Suggestion =
  | { kind: 'movie'; id: string; label: string; sub: string }
  | { kind: 'area'; id: string; label: string; sub: string; area: Area }
  | { kind: 'cinema'; id: string; label: string; sub: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '')

export default function SearchBar(props: Props) {
  const { mode, onModeChange, value, onChange, movies, cinemas, areas, pickedMovieId, onPickMovie, onPickArea, onPickCinema, onClear, onFocusChange } = props
  const [focused, setFocused] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = norm(value.trim())
  const suggestions = useMemo<Suggestion[]>(() => {
    if (mode === 'movie') {
      if (pickedMovieId) return []
      return movies
        .filter((m) => !q || norm(m.title).includes(q) || m.genre.some((g) => norm(g).startsWith(q)))
        .slice(0, 6)
        .map((m) => ({ kind: 'movie', id: m.id, label: m.title, sub: `${m.genre.join(' · ')} · ${m.language}` }))
    }
    const areaHits = areas
      .filter((a) => !q || [a.name, ...a.aliases].some((n) => norm(n).includes(q)))
      .slice(0, q ? 5 : 6)
      .map((a): Suggestion => ({ kind: 'area', id: a.id, label: a.name, sub: 'Area · show nearby cinemas', area: a }))
    const cinemaHits = q
      ? cinemas
          .filter((c) => norm(c.name).includes(q) || norm(c.area).includes(q) || norm(c.address).includes(q))
          .slice(0, 4)
          .map((c): Suggestion => ({ kind: 'cinema', id: c.id, label: c.name, sub: `${c.area} · ${c.address}` }))
      : []
    return [...areaHits, ...cinemaHits]
  }, [mode, q, pickedMovieId, movies, areas, cinemas])

  const pick = (s: Suggestion) => {
    if (s.kind === 'movie') onPickMovie(s.id)
    else if (s.kind === 'area') onPickArea(s.area)
    else onPickCinema(s.id)
    inputRef.current?.blur()
  }

  const open = focused && suggestions.length > 0
  const placeholder = mode === 'movie' ? 'Search a movie…' : 'Search an area or cinema — Gulberg, DHA…'

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        {/* Mode toggle */}
        <div className="relative flex shrink-0 rounded-xl bg-white/[0.04] p-0.5" role="radiogroup" aria-label="Search mode">
          {(['movie', 'location'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
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
          aria-autocomplete="list"
        />
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              type="button"
              onClick={onClear}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-neutral-300 hover:bg-white/15 hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.ul
            id="search-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass absolute top-[calc(100%+16px)] -left-2 z-50 max-h-[60dvh] w-[calc(100%+16px)] min-w-[280px] overflow-y-auto rounded-2xl p-2"
          >
            {!q && (
              <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                {mode === 'movie' ? 'Now showing' : 'Popular areas'}
              </li>
            )}
            {suggestions.map((s, i) => (
              <li key={`${s.kind}-${s.id}`} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === cursor ? 'bg-white/8' : ''}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                      s.kind === 'movie' ? 'bg-gold-400/15 text-gold-300' : s.kind === 'area' ? 'bg-sky-300/10 text-sky-300' : 'bg-white/8 text-neutral-300'
                    }`}
                  >
                    {s.kind === 'movie' ? <Film className="size-4" /> : s.kind === 'area' ? <Navigation className="size-4" /> : <MapPin className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{s.label}</span>
                    <span className="block truncate text-xs text-neutral-500">{s.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
