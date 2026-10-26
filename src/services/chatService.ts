import type { ChatMessage, LatLng } from '../types'
import { toISODate } from '../lib/schedule'

const ENDPOINT = '/.netlify/functions/chat'

export class ChatError extends Error {}

/** Sends the conversation to the server-side proxy. No API keys live here. */
export async function sendChat(messages: ChatMessage[], location: LatLng | null, signal?: AbortSignal) {
  const now = new Date()
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        messages: messages.slice(-12),
        client: {
          today: toISODate(now),
          time: now.toTimeString().slice(0, 5),
          location,
        },
      }),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ChatError("Can't reach the concierge right now. Check your connection and try again.")
  }

  const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null
  if (!res.ok || !data?.reply) {
    if (res.status === 404) {
      throw new ChatError('The chat service is not running. Use `netlify dev` locally, or deploy to Netlify.')
    }
    throw new ChatError(data?.error ?? 'Something went wrong. Please try again.')
  }
  return data.reply
}
