/* ──────────────────────────────────────────────────────────────
   The ONLY module that knows where cinema data comes from.

   Components never import the JSON files directly — they go through
   `useCinemaData()`, which calls `dataSource.load()`. To move to a real
   backend or admin panel, set VITE_DATA_API_URL (see createApiSource) or
   write your own CinemaDataSource and export it as `dataSource`.
   ────────────────────────────────────────────────────────────── */
import type { Area, Cinema, Movie, RawCinemaData, RawShowtime } from '../types'
import cinemasJson from '../data/cinemas.json'
import moviesJson from '../data/movies.json'
import showtimesJson from '../data/showtimes.json'
import areasJson from '../data/areas.json'

export interface CinemaDataSource {
  load(): Promise<RawCinemaData>
}

/** Bundled JSON — the default, zero-config source. */
export const localJsonSource: CinemaDataSource = {
  async load() {
    return {
      cinemas: cinemasJson as Cinema[],
      movies: moviesJson as Movie[],
      showtimes: showtimesJson as RawShowtime[],
      areas: areasJson as Area[],
    }
  },
}

/**
 * REST source. Expects endpoints returning the same shapes as the JSON files:
 * GET {base}/cinemas, {base}/movies, {base}/showtimes. Areas stay bundled
 * (they're geography, not schedule data).
 */
export function createApiSource(baseUrl: string): CinemaDataSource {
  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${path}`)
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
    return res.json() as Promise<T>
  }
  return {
    async load() {
      const [cinemas, movies, showtimes] = await Promise.all([
        get<Cinema[]>('cinemas'),
        get<Movie[]>('movies'),
        get<RawShowtime[]>('showtimes'),
      ])
      return { cinemas, movies, showtimes, areas: areasJson as Area[] }
    },
  }
}

const apiUrl = import.meta.env.VITE_DATA_API_URL as string | undefined

export const dataSource: CinemaDataSource = apiUrl ? createApiSource(apiUrl) : localJsonSource
