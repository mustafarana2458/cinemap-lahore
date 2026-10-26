import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, RotateCcw, Sparkles, X, AlertTriangle } from 'lucide-react'
import type { ChatMessage, LatLng } from '../types'
import { ChatError, sendChat } from '../services/chatService'

const SUGGESTIONS = [
  "What's playing tonight?",
  'Where can I watch Iron Monsoon after 8 PM?',
  "What's on near Gulberg tomorrow?",
  'Any family films this weekend?',
  'Which cinemas are in DHA?',
]

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Assalam-o-alaikum! I'm your CineMap concierge. Ask me what's playing, where, and when — I know every showtime in Lahore this week.",
}

export function ChatLauncher({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 2, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="pointer-events-auto relative grid size-12 shrink-0 place-items-center rounded-full lg:size-14 bg-gradient-to-b from-gold-300 to-gold-600 text-ink-950 shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_10px_40px_-6px_rgb(245_194_107/0.7)]"
      aria-label={open ? 'Close chat' : 'Ask the CineMap concierge'}
    >
      {!open && <span className="absolute inset-0 animate-ping rounded-full bg-gold-400/30 [animation-duration:2.5s]" />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={open ? 'x' : 's'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
          {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  userLocation: LatLng | null
}

export default function ChatBot({ open, onClose, userLocation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, error])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
    else abortRef.current?.abort()
  }, [open])

  const ask = async (history: ChatMessage[]) => {
    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      // The greeting is UI-only — don't send it to the model
      const reply = await sendChat(history.filter((m) => m !== GREETING), userLocation, ctrl.signal)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof ChatError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }

  const send = (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    void ask(next)
  }

  const retry = () => void ask(messages)
  const reset = () => {
    abortRef.current?.abort()
    setMessages([GREETING])
    setError(null)
    setLoading(false)
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(8px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transformOrigin: 'bottom right' }}
          className="glass fixed inset-x-3 top-3 bottom-3 z-[55] flex flex-col overflow-hidden rounded-3xl sm:inset-auto sm:right-4 sm:bottom-[92px] sm:h-[600px] sm:max-h-[calc(100dvh-124px)] sm:w-[400px]"
          role="dialog"
          aria-label="CineMap concierge chat"
        >
          {/* glow */}
          <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-gold-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 size-64 rounded-full bg-ember-500/10 blur-3xl" />

          <header className="relative flex items-center gap-3 border-b border-white/6 px-5 py-4">
            <div className="relative grid size-10 place-items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-600 text-ink-950">
              <Sparkles className="size-5" />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-ink-900 bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-none tracking-wider text-white">Concierge</p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-500">Showtimes · Cinemas · Recommendations</p>
            </div>
            <button type="button" onClick={reset} className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-white/8 hover:text-white" aria-label="New conversation" title="New conversation">
              <RotateCcw className="size-4" />
            </button>
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-white/8 hover:text-white sm:hidden" aria-label="Close chat">
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="relative flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5" aria-live="polite">
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}

            <AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex">
                  <div className="glass-soft flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3.5" aria-label="Concierge is typing">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-1.5 rounded-full bg-gold-300"
                        animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-3.5 text-sm text-ember-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <p className="text-neutral-200">{error}</p>
                  <button type="button" onClick={retry} className="mt-2 text-xs font-bold uppercase tracking-wider text-ember-400 hover:text-white">
                    Try again
                  </button>
                </div>
              </motion.div>
            )}

            {showSuggestions && (
              <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } } }} className="flex flex-wrap gap-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    onClick={() => send(s)}
                    className="rounded-full border border-gold-400/25 bg-gold-400/[0.06] px-3 py-1.5 text-xs font-medium text-gold-200 transition hover:border-gold-400/60 hover:bg-gold-400/15 hover:text-white"
                  >
                    {s}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="relative border-t border-white/6 p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-white/8 bg-ink-950/60 p-1.5 pl-4 transition focus-within:border-gold-400/40">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                maxLength={500}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Ask about any movie or cinema…"
                className="max-h-28 flex-1 resize-none bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-400 text-ink-950 transition hover:bg-gold-300 disabled:bg-white/8 disabled:text-neutral-600"
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${mine ? 'justify-end' : ''}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? 'rounded-br-md bg-gradient-to-b from-gold-300 to-gold-500 font-medium text-ink-950' : 'glass-soft rounded-bl-md text-neutral-200'
        }`}
      >
        {mine ? message.content : <RichText text={message.content} />}
      </div>
    </motion.div>
  )
}

/** Tiny, safe markdown subset: **bold**, bullet lists and line breaks. */
function RichText({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-bold text-gold-200">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    )

  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gold-400" />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const line of text.split('\n')) {
    const m = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (m) {
      bullets.push(m[1])
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`} className="[&:not(:first-child)]:mt-1.5">{inline(line.replace(/^#+\s*/, ''))}</p>)
  }
  flush()
  return <>{blocks}</>
}
