/**
 * Simple in-memory rate limiter for Express (VPS-friendly).
 * Env:
 *   RATE_LIMIT_ENABLED=1
 *   RATE_LIMIT_WINDOW_MS=60000
 *   RATE_LIMIT_MAX=120          // general
 *   RATE_LIMIT_SEARCH_MAX=30    // /catalog with search, /stream
 */

const buckets = new Map()

function clientKey(req) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    return xf || req.socket?.remoteAddress || 'unknown'
}

function take(key, max, windowMs) {
    const now = Date.now()
    let b = buckets.get(key)
    if (!b || now - b.start >= windowMs) {
        b = {start: now, count: 0}
        buckets.set(key, b)
    }
    b.count += 1
    return b.count <= max
}

/** Periodic cleanup */
setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
        if (now - b.start > 5 * 60_000) buckets.delete(k)
    }
}, 60_000).unref?.()

export function createRateLimitMiddleware(env = process.env) {
    const enabled = String(env.RATE_LIMIT_ENABLED || '').trim() === '1'
        || String(env.RATE_LIMIT_ENABLED || '').toLowerCase() === 'true'
    const windowMs = Math.max(5_000, Number(env.RATE_LIMIT_WINDOW_MS) || 60_000)
    const maxGeneral = Math.max(10, Number(env.RATE_LIMIT_MAX) || 120)
    const maxSearch = Math.max(5, Number(env.RATE_LIMIT_SEARCH_MAX) || 30)

    return function rateLimitMiddleware(req, res, next) {
        if (!enabled) return next()
        // never rate-limit admin or health
        const p = (req.path || req.url || '').split('?')[0]
        if (p === '/health' || p.startsWith('/admin')) return next()

        const ip = clientKey(req)
        const isHeavy = /\/stream\//i.test(p)
            || /\/catalog\//i.test(p)
            || /search=/i.test(req.url || '')

        const max = isHeavy ? maxSearch : maxGeneral
        const ok = take(`${ip}:${isHeavy ? 'h' : 'g'}`, max, windowMs)
        if (!ok) {
            res.status(429)
                .type('json')
                .set('Retry-After', String(Math.ceil(windowMs / 1000)))
                .json({error: 'Too many requests', retryAfterSec: Math.ceil(windowMs / 1000)})
            return
        }
        next()
    }
}

export function rateLimitStats() {
    return {bucketCount: buckets.size}
}
