import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX, ChevronRight } from 'lucide-react'

/* Opening sequence.

   Plays the video described by /intro/manifest.json (written by `npm run intro`).
   Falls back to the title card if there is no manifest, the video errors,
   autoplay is refused, or playback hasn't started within 4s. */

interface Source {
  src: string
  type: string
}
interface Manifest {
  duration: number
  hasAudio: boolean
  poster: string
  posterMobile: string
  desktop: Source[]
  mobile: Source[]
}

type Phase = 'loading' | 'video' | 'title' | 'done'

const START_TIMEOUT_MS = 4000
const FADE_S = 0.9
const TITLE_MS = 1900

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Intro({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  /** True once frames are actually moving; the slow-start fallback checks this */
  const started = useRef(false)
  const small = useRef(window.matchMedia('(max-width: 640px)').matches).current

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    videoRef.current?.pause()
    setPhase('done') // overlay fades out; the map fly-in starts underneath it
    onFinish()
  }, [onFinish])

  const fallback = useCallback(() => {
    if (finished.current) return
    setPhase((p) => (p === 'title' || p === 'done' ? p : 'title'))
  }, [])

  // Load the manifest; any problem → title card
  useEffect(() => {
    if (reducedMotion()) return void setPhase('title')
    const ctrl = new AbortController()
    fetch('/intro/manifest.json', { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : Promise.reject(new Error(String(r.status)))))
      .then((m) => {
        setManifest(m)
        setPhase((p) => (p === 'loading' ? 'video' : p))
      })
      .catch((e: Error) => e.name !== 'AbortError' && fallback())
    const slow = setTimeout(() => !started.current && fallback(), START_TIMEOUT_MS)
    return () => {
      ctrl.abort()
      clearTimeout(slow)
    }
  }, [fallback])

  // Title card runs for a fixed time
  useEffect(() => {
    if (phase !== 'title') return
    const t = setTimeout(finish, TITLE_MS)
    return () => clearTimeout(t)
  }, [phase, finish])

  // Kick off playback explicitly so a refused autoplay is detected
  useEffect(() => {
    if (phase !== 'video' || !videoRef.current) return
    videoRef.current.play().catch(fallback)
  }, [phase, fallback])

  const toggleSound = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted && v.volume < 0.6) v.volume = 0.8
  }

  const sources = manifest ? (small ? manifest.mobile : manifest.desktop) : []
  const poster = manifest ? (small ? manifest.posterMobile : manifest.poster) : undefined
  const showVideo = phase === 'video'

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[80] overflow-hidden bg-ink-950"
          exit={{ opacity: 0, scale: 1.04, transition: { duration: FADE_S, ease: [0.22, 1, 0.36, 1] } }}
          aria-label="Intro"
        >
          {showVideo && (
            <>
              {/* Portrait backdrop: the landscape logo is shown whole and blends into this */}
              <div className="absolute inset-0 hidden bg-[radial-gradient(90%_55%_at_50%_50%,#121a2c_0%,#070a12_70%)] portrait:block" />
              {/* Poster sits underneath so there's never a black flash before the first frame */}
              {poster && <img src={poster} alt="" aria-hidden className="absolute inset-0 size-full object-cover portrait:object-contain" />}
              <video
                ref={videoRef}
                // Landscape screens: full-bleed cover. Portrait phones: show the whole frame (a landscape
                // logo would otherwise be cropped), slightly enlarged; its band (≈64vw tall) fades into the backdrop top and bottom.
                className={`absolute inset-0 size-full object-cover transition-opacity duration-700 portrait:scale-[1.14] portrait:object-contain portrait:[mask-image:linear-gradient(transparent_calc(50%_-_32vw),#000_calc(50%_-_21vw),#000_calc(50%_+_21vw),transparent_calc(50%_+_32vw))] ${playing ? 'opacity-100' : 'opacity-0'}`}
                poster={poster}
                autoPlay
                muted
                playsInline
                preload="auto"
                disablePictureInPicture
                onPlaying={() => {
                  started.current = true
                  setPlaying(true)
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget
                  if (barRef.current && v.duration) barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`
                }}
                onEnded={finish}
                onError={fallback}
              >
                {sources.map((s, i) => (
                  <source key={s.src} src={s.src} type={s.type} onError={i === sources.length - 1 ? fallback : undefined} />
                ))}
              </video>

              {/* Cinematic framing: soft top/bottom gradients keep the controls legible */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_55%,rgb(0_0_0/0.55))]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: playing ? 1 : 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
              >
                {manifest?.hasAudio ? (
                  <button
                    type="button"
                    onClick={toggleSound}
                    className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:border-gold-400/50 hover:text-white active:scale-95"
                    aria-pressed={!muted}
                  >
                    {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-gold-300" />}
                    {muted ? 'Tap for sound' : 'Sound on'}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex h-10 items-center gap-1 rounded-full border border-white/15 bg-black/35 pr-3 pl-4 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:border-white/35 hover:text-white active:scale-95"
                >
                  Skip intro
                  <ChevronRight className="size-4" />
                </button>
              </motion.div>

              {/* Thin gold progress line */}
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
                <div ref={barRef} className="h-full origin-left scale-x-0 bg-gradient-to-r from-gold-500 to-gold-300" />
              </div>
            </>
          )}

          {phase === 'title' && <TitleCard />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The original title card — used as the fallback. */
function TitleCard() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <motion.div
        className="absolute top-1/2 left-1/2 h-[140vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_160deg,rgb(245_194_107/0.18)_180deg,transparent_200deg)]"
        initial={{ opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: '50% 0%' }}
      />
      <div className="relative text-center">
        <h1 className="wordmark flex text-6xl sm:text-8xl" aria-label="FilmUp">
          {'FilmUp'.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="wordmark-letter"
              initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.div
          className="mx-auto mt-3 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.p
          className="mt-3 text-[11px] font-semibold uppercase tracking-[0.5em] text-neutral-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Lahore · Now Showing
        </motion.p>
      </div>
    </div>
  )
}
