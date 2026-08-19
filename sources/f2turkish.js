/**
 * F2Media Turkish TV catalog — isolated (ENABLE_F2_TURKISH=1).
 * Display (name/poster/year): TMDB — proxied via project image proxy.
 * Streams: F2Media provider ids (ipf2media___…).
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'
import {encodePagePath} from './html-source.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
const FALLBACK_CATEGORY_ID = 233905
const LIST_TTL_MS = 12 * 60 * 1000
const listCache = new Map()
const catIdCache = new Map()
const tmdbCache = new Map()

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export function isF2TurkishEnabled(env = {}) {
    return flagOn(env.ENABLE_F2_TURKISH)
}

export function f2TurkishBase(env = {}) {
    const raw = String(env.F2MEDIA_BASEURL || DEFAULT_F2MEDIA_BASEURL || 'https://www.film2med.top')
        .trim()
        .replace(/\/+$/, '')
    return raw || 'https://www.film2med.top'
}

function decodeEntities(s) {
    return String(s || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function cleanTitle(raw) {
    let t = decodeEntities(raw)
    return t
        .replace(/<[^>]+>/g, '')
        .replace(/^دانلود\s+سریال\s+/i, '')
        .replace(/\s*بدون\s+سانسور.*$/i, '')
        .replace(/\s*با\s+زیرنویس.*$/i, '')
        .replace(/\s*دوبله\s+فارسی.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Best Latin query for TMDB (strip Persian, keep EN/TR latin). */
function tmdbQuery(title, slug) {
    const t = String(title || '')
    const parts = t.split(/\s*\/\s*/)
    for (const p of parts) {
        const latin = p
            .replace(/[\u0600-\u06FF]+/g, ' ')
            .replace(/[^\p{L}\p{N}\s:.'!&-]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        if ((latin.match(/[A-Za-z]/g) || []).length >= 3) return latin
    }
    const m = t.match(/[A-Za-z][A-Za-z0-9 .':!&-]{2,80}/)
    if (m) return m[0].trim()
    if (slug) return String(slug).replace(/-/g, ' ')
    return t.replace(/[\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function httpGet(url, httpClient, timeout = 14_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
            },
            validateStatus: (s) => s >= 200 && s < 400,
        })
        return {data: res.data, headers: res.headers || {}}
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {Accept: 'application/json', 'User-Agent': 'Mozilla/5.0'},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const headers = {}
        res.headers.forEach((v, k) => {
            headers[k.toLowerCase()] = v
        })
        return {data, headers}
    } finally {
        clearTimeout(timer)
    }
}

async function resolveCategoryId(base, httpClient) {
    const key = `cat:${base}`
    if (catIdCache.has(key)) return catIdCache.get(key)
    try {
        const {data: rows} = await httpGet(
            `${base}/wp-json/wp/v2/categories?slug=turkish-tv-series`,
            httpClient,
            8_000,
        )
        const id = Array.isArray(rows) && rows[0]?.id ? Number(rows[0].id) : FALLBACK_CATEGORY_ID
        catIdCache.set(key, id)
        return id
    } catch {
        catIdCache.set(key, FALLBACK_CATEGORY_ID)
        return FALLBACK_CATEGORY_ID
    }
}

function itemFromRest(row, base) {
    if (!row) return null
    if (row.type && row.type !== 'series') return null
    let path
    try {
        path = new URL(row.link, base).pathname
    } catch {
        if (row.slug) path = `/series/${row.slug}/`
        else return null
    }
    if (!/^\/series\/[^/]+\/?$/i.test(path)) return null
    const norm = path.replace(/\/+$/, '') + '/'
    const pageId = encodePagePath(norm)
    if (!pageId) return null

    const rawName = cleanTitle(row.title?.rendered || row.slug || '')
    if (!rawName) return null
    const slug = row.slug || norm.split('/').filter(Boolean).pop()

    return {
        id: `ipf2media___${pageId}`,
        rawName,
        query: tmdbQuery(rawName, slug),
        path: norm,
        slug,
    }
}

async function tmdbLookup(query, apiKey, httpClient) {
    if (!apiKey || !query || query.length < 2) return null
    const cacheKey = query.toLowerCase()
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)
    try {
        const {data} = await httpGet(
            `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}` +
                `&query=${encodeURIComponent(query)}&language=en-US`,
            httpClient,
            8_000,
        )
        let row = data?.results?.[0] || null
        // Retry with shortened query if no hit (drop year / extra words)
        if (!row && query.split(/\s+/).length > 3) {
            const short = query.split(/\s+/).slice(0, 3).join(' ')
            const {data: d2} = await httpGet(
                `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}` +
                    `&query=${encodeURIComponent(short)}&language=en-US`,
                httpClient,
                8_000,
            )
            row = d2?.results?.[0] || null
        }
        if (!row?.id) {
            tmdbCache.set(cacheKey, null)
            return null
        }
        const poster = row.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : null
        const background = row.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${row.backdrop_path}`
            : null
        const out = {
            name: row.name || query,
            poster,
            background,
            year: (row.first_air_date || '').slice(0, 4) || null,
            tmdbId: row.id,
        }
        tmdbCache.set(cacheKey, out)
        return out
    } catch {
        tmdbCache.set(cacheKey, null)
        return null
    }
}

async function enrichWithTmdb(items, apiKey, httpClient) {
    if (!apiKey || !items.length) return
    const concurrency = 5
    for (let i = 0; i < items.length; i += concurrency) {
        const slice = items.slice(i, i + concurrency)
        await Promise.all(
            slice.map(async (it) => {
                const tmdb = await tmdbLookup(it.query || it.rawName, apiKey, httpClient)
                if (!tmdb) {
                    // fallback: latin-only raw name, no mixed FA
                    it.name = it.query || it.rawName
                    return
                }
                it.name = tmdb.name
                it.poster = tmdb.poster
                it.background = tmdb.background
                it.year = tmdb.year
            }),
        )
    }
}

async function scrapeTurkishList(env, httpClient) {
    const base = f2TurkishBase(env)
    const cacheKey = `tr:${base}`
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const items = []
    const seen = new Set()
    const catId = await resolveCategoryId(base, httpClient)

    let totalPages = 1
    for (let page = 1; page <= totalPages; page++) {
        // List only — no _embed (faster); display comes from TMDB
        const url =
            `${base}/wp-json/wp/v2/series?categories=${catId}` +
            `&per_page=100&page=${page}&orderby=date&order=desc`
        try {
            const {data: rows, headers} = await httpGet(url, httpClient, 16_000)
            if (page === 1) {
                const tp = Number(headers['x-wp-totalpages'] || headers['X-WP-TotalPages'] || 0)
                if (Number.isFinite(tp) && tp > 0) totalPages = Math.min(tp, 20)
            }
            if (!Array.isArray(rows) || !rows.length) break
            for (const row of rows) {
                const it = itemFromRest(row, base)
                if (!it || seen.has(it.path)) continue
                seen.add(it.path)
                items.push(it)
            }
            if (rows.length < 100) break
        } catch {
            if (page === 1) break
        }
    }

    // HTML fallback for paths only
    if (!items.length) {
        for (let page = 1; page <= 10; page++) {
            const htmlUrl =
                page === 1
                    ? `${base}/category/turkish-tv-series/`
                    : `${base}/category/turkish-tv-series/page/${page}/`
            try {
                const res = await httpGet(htmlUrl, httpClient, 14_000)
                const html = typeof res.data === 'string' ? res.data : ''
                if (!html) break
                const re = /\/series\/([a-z0-9][a-z0-9-]*)\//gi
                let m
                let added = 0
                while ((m = re.exec(html))) {
                    const slug = m[1]
                    if (!slug || seen.has(slug)) continue
                    const norm = `/series/${slug}/`
                    const pageId = encodePagePath(norm)
                    if (!pageId) continue
                    seen.add(slug)
                    const label = slug.replace(/-/g, ' ')
                    items.push({
                        id: `ipf2media___${pageId}`,
                        rawName: label,
                        query: label,
                        path: norm,
                        slug,
                    })
                    added++
                }
                if (added === 0 && page > 1) break
            } catch {
                break
            }
        }
    }

    const apiKey = String(env.TMDB_API_KEY || '').trim()
    await enrichWithTmdb(items, apiKey, httpClient)

    listCache.set(cacheKey, {at: Date.now(), items})
    return items
}

export async function f2turkishListCatalog(catalogId, search, env, httpClient) {
    if (!isF2TurkishEnabled(env)) return {metas: []}
    if (String(catalogId) !== F2TURKISH_CATALOG_ID) return {metas: []}

    try {
        let items = await scrapeTurkishList(env, httpClient)
        const q = String(search || '')
            .trim()
            .toLowerCase()
        if (q) {
            items = items.filter(
                (it) =>
                    String(it.name || '')
                        .toLowerCase()
                        .includes(q) ||
                    String(it.query || '')
                        .toLowerCase()
                        .includes(q),
            )
        }

        // Always return cards: id (F2 stream) + TMDB display fields
        return {
            metas: items.map((it) => ({
                id: it.id,
                type: 'series',
                name: it.name || it.query || it.rawName,
                poster: it.poster || null,
                background: it.background || undefined,
                posterShape: 'poster',
                releaseInfo: it.year || undefined,
            })),
        }
    } catch {
        return {metas: []}
    }
}

export function f2turkishManifestCatalogs(env, lang = 'fa') {
    if (!isF2TurkishEnabled(env)) return []
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return [
        {
            type: 'series',
            id: F2TURKISH_CATALOG_ID,
            name: isEn ? 'Turkish' : 'ترکی',
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
