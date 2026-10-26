/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional REST base URL for cinemas/movies/showtimes. Unset = bundled JSON. */
  readonly VITE_DATA_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
