/**
 * Durable cache abstraction for CinemaGraphy.
 * Default: in-memory (serverless-friendly, TTL-based).
 * Optional: plug Redis / Cloudflare KV / Vercel KV via env later.
 *
 * Env:
 *   CACHE_BACKEND=memory (default) | redis
 *   REDIS_URL=redis://... (when backend=redis)
 *   CACHE_PREFIX=cg: (optional key prefix)
 */

const PREFIX = String(process.env.CACHE_PREFIX || 'cg:').trim() || 'cg:'

/** @type {Map<string, {at:number, ttl:number, value:any}>} */
const memory = new Map()
const MEMORY_MAX = Number(process.env.CACHE_MEMORY_MAX || 2000)

function fullKey(key) {
    return `${PREFIX}${key}`
}

function memoryGet(key) {
    const row = memory.get(key)
    if (!row) return null
    if (Date.now() - row.at > row.ttl) {
        memory.delete(key)
        return null
    }
    return row.value
}

function memorySet(key, value, ttlMs) {
    memory.set(key, {at: Date.now(), ttl: ttlMs, value})
    if (memory.size > MEMORY_MAX) {
        // drop oldest ~10%
        const n = Math.max(1, Math.floor(MEMORY_MAX * 0.1))
        const keys = memory.keys()
        for (let i = 0; i < n; i++) {
            const k = keys.next().value
            if (k != null) memory.delete(k)
        }
    }
}

function memoryDel(key) {
    memory.delete(key)
}

/** Simple Redis REST-less client via optional global fetch + Redis URL (ioredis not required). */
let redisClient = null
async function getRedis() {
    if (redisClient) return redisClient
    const url = String(process.env.REDIS_URL || '').trim()
    if (!url || process.env.CACHE_BACKEND !== 'redis') return null
    try {
        // Dynamic import only when configured — keeps default install light
        const {default: Redis} = await import('ioredis').catch(() => ({default: null}))
        if (!Redis) {
            console.warn?.('[cache] ioredis not installed; falling back to memory')
            return null
        }
        redisClient = new Redis(url, {maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true})
        await redisClient.connect().catch(() => null)
        return redisClient
    } catch (err) {
        console.warn?.('[cache] redis init failed', err?.message)
        return null
    }
}

/**
 * Get cached value. Returns null on miss / error.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
    const k = fullKey(key)
    const backend = String(process.env.CACHE_BACKEND || 'memory').toLowerCase()
    if (backend === 'redis') {
        try {
            const r = await getRedis()
            if (r) {
                const raw = await r.get(k)
                if (raw != null) return JSON.parse(raw)
            }
        } catch {
            /* fall through to memory */
        }
    }
    return memoryGet(k)
}

/**
 * Set cached value with TTL in milliseconds.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 */
export async function cacheSet(key, value, ttlMs = 60_000) {
    const k = fullKey(key)
    const ttl = Math.max(1000, Number(ttlMs) || 60_000)
    const backend = String(process.env.CACHE_BACKEND || 'memory').toLowerCase()
    memorySet(k, value, ttl)
    if (backend === 'redis') {
        try {
            const r = await getRedis()
            if (r) {
                await r.set(k, JSON.stringify(value), 'PX', ttl)
            }
        } catch {
            /* memory already set */
        }
    }
}

/**
 * Delete a key.
 * @param {string} key
 */
export async function cacheDel(key) {
    const k = fullKey(key)
    memoryDel(k)
    if (String(process.env.CACHE_BACKEND || '').toLowerCase() === 'redis') {
        try {
            const r = await getRedis()
            if (r) await r.del(k)
        } catch { /* ignore */ }
    }
}

/** Stats for /providers.json or health diagnostics */
export function cacheStats() {
    return {
        backend: String(process.env.CACHE_BACKEND || 'memory').toLowerCase(),
        memorySize: memory.size,
        memoryMax: MEMORY_MAX,
        prefix: PREFIX,
    }
}

/** Clear in-memory cache (admin panel). Redis keys are not bulk-deleted here. */
export function cacheClearAll() {
    memory.clear()
    return {ok: true, backend: String(process.env.CACHE_BACKEND || 'memory').toLowerCase()}
}
