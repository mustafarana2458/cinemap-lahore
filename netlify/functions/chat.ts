/* ──────────────────────────────────────────────────────────────
   POST /.netlify/functions/chat
   Server-side AI proxy. The API key is read from the environment and
   never reaches the browser. Switch providers with AI_PROVIDER.

   Env:
     AI_PROVIDER  anthropic | openai | gemini   (default: anthropic)
     AI_API_KEY   provider secret key            (required)
     AI_MODEL     optional model override
   ────────────────────────────────────────────────────────────── */
import type { Context } from '@netlify/functions'
import type { ChatMessage, LatLng, RawCinemaData } from '../../src/types'
import { clientIp, createRateLimiter } from '../lib/rateLimit'
import { dateOptions, formatTime, normalizeData } from '../../src/lib/schedule'
import { distanceKm, formatDistance } from '../../src/lib/geo'
import cinemas from '../../src/data/cinemas.json'
import movies from '../../src/data/movies.json'
import showtimes from '../../src/data/showtimes.json'
import areas from '../../src/data/areas.json'

type Provider = 'anthropic' | 'openai' | 'gemini'

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-flash',
}

const MAX_MESSAGES = 12
/** Max length of a user message — matches the textarea's maxLength in ChatBot.tsx */
const MAX_MESSAGE_CHARS = 500
/** Earlier assistant replies are trimmed to this before being resent */
const MAX_HISTORY_CHARS = 2000
const MAX_BODY_BYTES = 32_000
const TIMEZONE = 'Asia/Karachi'

// 6 requests / minute and 40 / hour per IP
const limiter = createRateLimiter([
  { limit: 6, windowMs: 60_000 },
  { limit: 40, windowMs: 60 * 60_000 },
])

interface Body {
  messages?: unknown
  client?: { today?: unknown; time?: unknown; location?: unknown }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request, context?: Context): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const rate = limiter.check(clientIp(req, context?.ip))
  if (!rate.ok) {
    return new Response(JSON.stringify({ error: `You're sending messages quickly — try again in ${rate.retryAfter}s.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfter) },
    })
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json(413, { error: 'Request too large.' })

  const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase() as Provider
  const apiKey = process.env.AI_API_KEY
  if (!(provider in DEFAULT_MODELS)) return json(500, { error: `Unknown AI_PROVIDER "${provider}".` })
  if (!apiKey) return json(500, { error: 'The concierge is not configured yet (AI_API_KEY is missing).' })
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider]

  let body: Body
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large.' })
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  const messages = sanitizeMessages(body.messages)
  if (!messages) return json(400, { error: 'Please send a message.' })
  if (messages[messages.length - 1].content.length > MAX_MESSAGE_CHARS) {
    return json(413, { error: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.` })
  }

  const system = buildSystemPrompt(body.client)

  try {
    const reply = await callProvider(provider, { apiKey, model, system, messages })
    return json(200, { reply })
  } catch (err) {
    console.error('[chat] provider error:', err)
    const message = err instanceof ProviderError && err.status === 429
      ? 'The concierge is busy right now — try again in a moment.'
      : 'The concierge is unavailable right now. Please try again.'
    return json(502, { error: message })
  }
}

// ── input validation ──────────────────────────────────────────

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw
    .filter((m): m is ChatMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .slice(-MAX_MESSAGES)
    // The latest user message is length-checked by the caller; older turns are just trimmed
    .map((m, i, all) => ({ role: m.role, content: i === all.length - 1 ? m.content : m.content.slice(0, MAX_HISTORY_CHARS) }))
  // Conversations must start with the user and end with the user
  while (out.length && out[0].role !== 'user') out.shift()
  if (!out.length || out[out.length - 1].role !== 'user') return null
  return out
}

function lahoreNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { today: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour').replace('24', '00')}:${get('minute')}` }
}

function readClient(client: Body['client']) {
  const fallback = lahoreNow()
  const today = typeof client?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(client.today) ? client.today : fallback.today
  const time = typeof client?.time === 'string' && /^\d{2}:\d{2}$/.test(client.time) ? client.time : fallback.time
  const loc = client?.location as LatLng | null | undefined
  const location =
    loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180
      ? { lat: Number(loc.lat), lng: Number(loc.lng) }
      : null
  return { today, time, location }
}

// ── system prompt: the full schedule as compact text ──────────

function buildSystemPrompt(client: Body['client']): string {
  const { today, time, location } = readClient(client)
  const data = normalizeData({ cinemas, movies, showtimes, areas } as RawCinemaData, today)
  const days = dateOptions(today)
  const movieTitle = new Map(data.movies.map((m) => [m.id, m.title]))

  const cinemaLines = data.cinemas.map((c) => {
    const dist = location ? ` | ${formatDistance(distanceKm(location, c))} from user` : ''
    return `- ${c.name} | ${c.address}, ${c.area}, ${c.city} | rating ${c.rating}/5 | phone ${c.phone || 'not listed'}${c.screens ? ` | ${c.screens} screens` : ''} | ${(c.features ?? []).join(', ')}${c.verified ? '' : ' | listing unverified, suggest calling ahead'}${dist}`
  })

  const movieLines = data.movies.map(
    (m) => `- ${m.title} | ${m.genre.join('/')} | ${m.duration} min | ${m.language} | age rating ${m.rating} | ${m.synopsis}`,
  )

  const scheduleLines = days.flatMap((d) => {
    const label = d.label === d.weekday ? d.weekday : `${d.label}, ${d.weekday}`
    const lines = [`${d.iso} (${label}):`]
    for (const c of data.cinemas) {
      const shows = data.showtimes
        .filter((s) => s.date === d.iso && s.cinemaId === c.id)
        .map((s) => `${movieTitle.get(s.movieId)} ${s.times.map(formatTime).join(', ')}`)
      if (shows.length) lines.push(`  ${c.name}: ${shows.join('; ')}`)
    }
    return lines
  })

  return `You are the CineMap concierge, a warm and concise movie-night assistant for cinemas in Lahore, Pakistan.

Current local date and time for the user: ${today} ${formatTime(time)} (${TIMEZONE}). "Tonight" means shows from 5 PM onward today. Shows that already started today are no longer available — never suggest them.
${location ? 'The user shared their location; distances are listed per cinema. Prefer closer cinemas when relevant.' : 'The user has not shared a location. If they ask what is near them, suggest the "Near me" button or ask for their area.'}

Answer ONLY from the data below. If something is not in the data (ticket prices, seat availability, bookings, films not listed), say you don't have that and suggest calling the cinema. Never invent cinemas, films or showtimes.

Style: short and scannable. Use **bold** for film and cinema names and "- " bullet lists for multiple options, with times like 6:00 PM. No headings, no tables. At most ~120 words unless the user asks for a full list. Respond in the user's language (English, Urdu or Roman Urdu).

## Cinemas
${cinemaLines.join('\n')}

## Films
${movieLines.join('\n')}

## Showtimes (next 7 days)
${scheduleLines.join('\n')}`
}

// ── providers ─────────────────────────────────────────────────

class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

interface CallArgs {
  apiKey: string
  model: string
  system: string
  messages: ChatMessage[]
}

async function callProvider(provider: Provider, args: CallArgs): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return callAnthropic(args)
    case 'openai':
      return callOpenAI(args)
    case 'gemini':
      return callGemini(args)
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new ProviderError(res.status, `${res.status} ${await res.text().catch(() => '')}`.slice(0, 500))
  return res.json()
}

// Server-side refusal fallback exists for these models only (not Haiku)
const SUPPORTS_FALLBACK = /^claude-(fable-5|opus-5|sonnet-5-5)/

async function callAnthropic({ apiKey, model, system, messages }: CallArgs): Promise<string> {
  const fallback = SUPPORTS_FALLBACK.test(model)
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Retries on a fallback model if a safety classifier declines the request
      ...(fallback && { 'anthropic-beta': 'server-side-fallback-2026-07-01' }),
    },
    {
      model,
      max_tokens: 2048,
      system,
      messages,
      output_config: { effort: 'low' },
      ...(fallback && { fallbacks: 'default' }),
    },
  )
  if (data.stop_reason === 'refusal') return "Sorry, I can't help with that one. Ask me about films, cinemas or showtimes."
  const text = (data.content as { type: string; text?: string }[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  if (!text) throw new ProviderError(502, 'Empty response from Anthropic')
  return text
}

async function callOpenAI({ apiKey, model, system, messages }: CallArgs): Promise<string> {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    { model, max_tokens: 800, temperature: 0.4, messages: [{ role: 'system', content: system }, ...messages] },
  )
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new ProviderError(502, 'Empty response from OpenAI')
  return text
}

async function callGemini({ apiKey, model, system, messages }: CallArgs): Promise<string> {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
    },
  )
  const text = (data.candidates?.[0]?.content?.parts as { text?: string }[] | undefined)
    ?.map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new ProviderError(502, 'Empty response from Gemini')
  return text
}
