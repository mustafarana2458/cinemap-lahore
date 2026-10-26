import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl is ~1.1 MB minified (≈290 KB gzip) and already lands in its own chunk
  build: { chunkSizeWarningLimit: 1200 },
})
