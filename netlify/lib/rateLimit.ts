/* Basic per-IP sliding-window rate limiter.

   State lives in module memory, so it is per warm function instance:
   it stops bursts and casual abuse, but parallel instances don't share
   counts. For hard guarantees, back this with Netlify Blobs or Upstash Redis
   (same interface: check(key) → { ok, retryAfter }). */

interface Rule {
  limit: number
  windowMs: number
}

export function createRateLimiter(rules: Rule[], maxKeys = 5000) {
  const hits = new Map<string, number[]>()
  const longest = Math.max(...rules.map((r) => r.windowMs))

  return {
    check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < longest)

      for (const rule of rules) {
        const inWindow = recent.filter((t) => now - t < rule.windowMs)
        if (inWindow.length >= rule.limit) {
          hits.set(key, recent)
          return { ok: false, retryAfter: Math.ceil((inWindow[0] + rule.windowMs - now) / 1000) }
        }
      }

      recent.push(now)
      hits.set(key, recent)
      if (hits.size > maxKeys) {
        // Drop the oldest-inserted keys so memory stays bounded
        for (const k of [...hits.keys()].slice(0, hits.size - maxKeys)) hits.delete(k)
      }
      return { ok: true }
    },
  }
}

export function clientIp(req: Request, contextIp?: string): string {
  return (
    contextIp ||
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  )
}
