/* ──────────────────────────────────────────────────────────────
   Domain model. These shapes mirror src/data/*.json exactly, so an
   API or admin panel only has to return the same JSON.
   ────────────────────────────────────────────────────────────── */

export interface Cinema {
  id: string
  name: string
  address: string
  city: string
  /** Neighbourhood, e.g. "Gulberg". Used for search + chatbot answers. */
  area: string
  lat: number
  lng: number
  image: string
  /** 0–5 */
  rating: number
  /** May be empty when no public number is known */
  phone: string
  screens?: number
  /** Location + operating status confirmed — see VERIFY_CINEMAS.md */
  verified: boolean
  features?: string[]
}

export interface Movie {
  id: string
  title: string
  poster: string
  genre: string[]
  /** Minutes */
  duration: number
  language: string
  /** Age rating, e.g. "U", "PG", "PG-13", "15+", "18+" */
  rating: string
  synopsis: string
  director: string
  cast: string[]
  releaseYear: number
  /** Optional — the Watch Trailer button hides when missing */
  trailerUrl?: string
}

/**
 * `date` is either an ISO date ("2026-10-26") or a relative offset from today
 * ("+0" = today, "+1" = tomorrow …). Relative dates keep demo data evergreen.
 * `times` are 24h "HH:mm" strings.
 */
export interface RawShowtime {
  cinemaId: string
  movieId: string
  date: string
  times: string[]
}

/** A showtime after normalisation — `date` is always ISO. */
export type Showtime = RawShowtime

/** A searchable Lahore neighbourhood — used by "Search by location". */
export interface Area {
  id: string
  name: string
  aliases: string[]
  lat: number
  lng: number
}

export interface RawCinemaData {
  cinemas: Cinema[]
  movies: Movie[]
  showtimes: RawShowtime[]
  areas: Area[]
}

export interface CinemaData {
  cinemas: Cinema[]
  movies: Movie[]
  showtimes: Showtime[]
  areas: Area[]
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Filters {
  /** ISO date */
  date: string
  /** Free-text search across movie titles */
  query: string
  movieId: string | null
  genre: string | null
  cinemaId: string | null
  timesOfDay: TimeOfDay[]
}

export interface LatLng {
  lat: number
  lng: number
}

export interface MovieShowing {
  movie: Movie
  times: string[]
}

export interface CinemaSchedule {
  cinema: Cinema
  showings: MovieShowing[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
