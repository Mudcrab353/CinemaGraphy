/**
 * F2Media Turkish TV catalog — isolated (ENABLE_F2_TURKISH=1).
 * List via WP REST; posters/titles enriched with TMDB when key is set.
 * Stream ids stay F2Media provider format (playback unchanged).
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'
import {encodePagePath} from './html-source.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
const FALLBACK_CATEGORY_ID = 233905
const LIST_TTL_MS = 15 * 60 * 1000
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

/** Latin/English part for TMDB search. */
function englishHint(title) {
    const t = String(title || '')
    const parts = t.split(/\s*\/\s*/)
    for (const p of parts) {
        const latin = p.replace(/[^\p{L}\p{N}\s:.'!&-]/gu, ' ').replace(/\s+/g, ' ').trim()
        if ((latin.match(/[A-Za-z]/g) || []).length >= 3) return latin
    }
    const m = t.match(/[A-Za-z][A-Za-z0-9 .':!&-]{2,80}/)
    return m ? m[0].trim() : t
}

async function httpGetJson(url, httpClient, timeout = 12_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
            },
            validateStatus: (s) => s >= 200 && s < 400,
        })
        return res.data
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {Accept: 'application/json', 'User-Agent': 'Mozilla/5.0'},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
    } finally {
        clearTimeout(timer)
    }
}

async function resolveCategoryId(base, httpClient) {
    const key = `cat:${base}`
    if (catIdCache.has(key)) return catIdCache.get(key)
    try {
        const rows = await httpGetJson(
            `${base}/wp-json/wp/v2/categories?slug=turkish-tv-series`,
            httpClient,
            10_000,
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
    if (!row || row.type !== 'series') return null
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

    const name = cleanTitle(row.title?.rendered || row.slug || '')
    if (!name) return null

    let poster = null
    const embedded = row._embedded?.['wp:featuredmedia']
    if (Array.isArray(embedded) && embedded[0]) {
        poster =
            embedded[0].source_url ||
            embedded[0].media_details?.sizes?.medium_large?.source_url ||
            embedded[0].media_details?.sizes?.medium?.source_url ||
            null
    }

    return {
        id: `ipf2media___${pageId}`,
        name,
        nameEn: englishHint(name),
        poster,
        path: norm,
    }
}

async function tmdbTvLookup(query, apiKey, httpClient) {
    if (!apiKey || !query) return null
    const q = String(query).trim()
    if (q.length < 2) return null
    const cacheKey = q.toLowerCase()
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)

    try {
        const url =
            `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}` +
            `&query=${encodeURIComponent(q)}&language=en-US`
        const data = await httpGetJson(url, httpClient, 8_000)
        const row = data?.results?.[0]
        if (!row?.id) {
            tmdbCache.set(cacheKey, null)
            return null
        }
        let imdbId = null
        try {
            const ext = await httpGetJson(
                `https://api.themoviedb.org/3/tv/${row.id}/external_ids?api_key=${encodeURIComponent(apiKey)}`,
                httpClient,
                6_000,
            )
            if (ext?.imdb_id && /^tt\d+/i.test(ext.imdb_id)) imdbId = ext.imdb_id
        } catch {
            /* optional */
        }
        const poster = row.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : null
        const out = {
            poster,
            name: row.name || q,
            year: (row.first_air_date || '').slice(0, 4) || null,
            imdbId,
            tmdbId: row.id,
            overview: row.overview || '',
        }
        tmdbCache.set(cacheKey, out)
        return out
    } catch {
        tmdbCache.set(cacheKey, null)
        return null
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

    for (let page = 1; page <= 5; page++) {
        const url =
            `${base}/wp-json/wp/v2/series?categories=${catId}` +
            `&per_page=20&page=${page}&_embed=1&orderby=date&order=desc`
        try {
            const rows = await httpGetJson(url, httpClient, 14_000)
            if (!Array.isArray(rows) || rows.length === 0) break
            for (const row of rows) {
                const it = itemFromRest(row, base)
                if (!it || seen.has(it.path)) continue
                seen.add(it.path)
                items.push(it)
            }
            if (rows.length < 20) break
        } catch {
            break
        }
    }

    if (!items.length) {
        try {
            const htmlUrl = `${base}/category/turkish-tv-series/`
            if (httpClient?.get) {
                const res = await httpClient.get(htmlUrl, {
                    timeout: 14_000,
                    headers: {
                        Accept: 'text/html',
                        'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
                    },
                    validateStatus: (s) => s >= 200 && s < 400,
                })
                const html = typeof res.data === 'string' ? res.data : ''
                const re = /\/series\/([a-z0-9][a-z0-9-]*)\//gi
                let m
                while ((m = re.exec(html))) {
                    const slug = m[1]
                    if (!slug || seen.has(slug)) continue
                    const norm = `/series/${slug}/`
                    const pageId = encodePagePath(norm)
                    if (!pageId) continue
                    seen.add(slug)
                    items.push({
                        id: `ipf2media___${pageId}`,
                        name: slug.replace(/-/g, ' '),
                        nameEn: slug.replace(/-/g, ' '),
                        poster: null,
                        path: norm,
                    })
                }
            }
        } catch {
            /* soft-fail */
        }
    }

    // TMDB posters (prefer TMDB quality; keep F2 id for streams)
    const apiKey = String(env.TMDB_API_KEY || '').trim()
    if (apiKey && items.length) {
        const concurrency = 5
        for (let i = 0; i < items.length; i += concurrency) {
            const slice = items.slice(i, i + concurrency)
            await Promise.all(
                slice.map(async (it) => {
                    const tmdb = await tmdbTvLookup(it.nameEn || it.name, apiKey, httpClient)
                    if (!tmdb) return
                    if (tmdb.poster) it.poster = tmdb.poster
                    if (tmdb.year) it.year = tmdb.year
                    if (tmdb.imdbId) it.imdbId = tmdb.imdbId
                }),
            )
        }
    }

    listCache.set(cacheKey, {at: Date.now(), items})
    return items
}

export async function f2turkishListCatalog(catalogId, search, env, httpClient) {
    if (!isF2TurkishEnabled(env)) return {metas: []}
    if (String(catalogId) !== F2TURKISH_CATALOG_ID) return {metas: []}

    let items = await scrapeTurkishList(env, httpClient)
    const q = String(search || '')
        .trim()
        .toLowerCase()
    if (q) {
        items = items.filter(
            (it) =>
                it.name.toLowerCase().includes(q) ||
                String(it.nameEn || '')
                    .toLowerCase()
                    .includes(q),
        )
    }

    return {
        metas: items.map((it) => ({
            id: it.id,
            type: 'series',
            name: it.name,
            poster: it.poster || null,
            posterShape: 'poster',
            releaseInfo: it.year || undefined,
        })),
    }
}

export function f2turkishManifestCatalogs(env, lang = 'fa') {
    if (!isF2TurkishEnabled(env)) return []
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return [
        {
            type: 'series',
            id: F2TURKISH_CATALOG_ID,
            name: isEn ? 'Turkish Series' : 'سریال - ترکی',
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
