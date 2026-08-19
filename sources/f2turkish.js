/**
 * F2Media Turkish TV catalog — isolated (ENABLE_F2_TURKISH=1).
 * Full category list (WP REST, up to all pages) + posters from embed/media/TMDB.
 * Stream ids: F2Media provider format.
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

function titleCaseWords(s) {
    return String(s || '')
        .split(/\s+/)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
}

async function httpGet(url, httpClient, timeout = 14_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'application/json, text/html;q=0.8',
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
        const ct = res.headers.get('content-type') || ''
        const data = ct.includes('json') ? await res.json() : await res.text()
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

    const name = cleanTitle(row.title?.rendered || row.slug || '')
    if (!name) return null

    let poster = null
    const embedded = row._embedded?.['wp:featuredmedia']
    if (Array.isArray(embedded) && embedded[0]) {
        poster =
            embedded[0].source_url ||
            embedded[0].media_details?.sizes?.medium_large?.source_url ||
            embedded[0].media_details?.sizes?.large?.source_url ||
            embedded[0].media_details?.sizes?.medium?.source_url ||
            null
    }

    const mediaId = Number(row.featured_media) || 0
    let year = null
    if (row.date) year = String(row.date).slice(0, 4)

    return {
        id: `ipf2media___${pageId}`,
        name,
        nameEn: englishHint(name),
        poster,
        mediaId: mediaId > 0 ? mediaId : null,
        year,
        path: norm,
    }
}

/** Batch-resolve WP media IDs → source_url */
async function fillPostersFromMedia(base, items, httpClient) {
    const need = items.filter((it) => !it.poster && it.mediaId)
    if (!need.length) return
    const ids = [...new Set(need.map((it) => it.mediaId))]
    // WP allow include= up to ~100
    for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50)
        try {
            const {data} = await httpGet(
                `${base}/wp-json/wp/v2/media?include=${chunk.join(',')}&per_page=${chunk.length}`,
                httpClient,
                12_000,
            )
            if (!Array.isArray(data)) continue
            const map = new Map()
            for (const m of data) {
                const url =
                    m.source_url ||
                    m.media_details?.sizes?.medium_large?.source_url ||
                    m.media_details?.sizes?.medium?.source_url
                if (m.id && url) map.set(Number(m.id), url)
            }
            for (const it of need) {
                if (!it.poster && it.mediaId && map.has(it.mediaId)) {
                    it.poster = map.get(it.mediaId)
                }
            }
        } catch {
            /* continue */
        }
    }
}

async function tmdbPoster(query, apiKey, httpClient) {
    if (!apiKey || !query) return null
    const key = String(query).trim().toLowerCase()
    if (tmdbCache.has(key)) return tmdbCache.get(key)
    try {
        const {data} = await httpGet(
            `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}` +
                `&query=${encodeURIComponent(query)}&language=en-US`,
            httpClient,
            7_000,
        )
        const row = data?.results?.[0]
        const poster = row?.poster_path ? `https://image.tmdb.org/t/p/w500${row.poster_path}` : null
        const year = row?.first_air_date ? String(row.first_air_date).slice(0, 4) : null
        const name = row?.name || null
        const out = poster || year || name ? {poster, year, name} : null
        tmdbCache.set(key, out)
        return out
    } catch {
        tmdbCache.set(key, null)
        return null
    }
}

/** Only for items still missing poster — limited concurrency. */
async function fillPostersFromTmdb(items, apiKey, httpClient) {
    if (!apiKey) return
    const need = items.filter((it) => !it.poster)
    if (!need.length) return
    const concurrency = 4
    for (let i = 0; i < need.length; i += concurrency) {
        const slice = need.slice(i, i + concurrency)
        await Promise.all(
            slice.map(async (it) => {
                const tmdb = await tmdbPoster(it.nameEn || it.name, apiKey, httpClient)
                if (!tmdb) return
                if (tmdb.poster) it.poster = tmdb.poster
                if (tmdb.year && !it.year) it.year = tmdb.year
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

    // per_page=100 → fewer round-trips for full category (~50–100 titles)
    let totalPages = 1
    for (let page = 1; page <= totalPages; page++) {
        const url =
            `${base}/wp-json/wp/v2/series?categories=${catId}` +
            `&per_page=100&page=${page}&_embed=wp:featuredmedia&orderby=date&order=desc`
        try {
            const {data: rows, headers} = await httpGet(url, httpClient, 16_000)
            if (page === 1) {
                const tp = Number(
                    headers['x-wp-totalpages'] || headers['X-WP-TotalPages'] || 0,
                )
                if (Number.isFinite(tp) && tp > 0) totalPages = Math.min(tp, 20)
                const total = Number(headers['x-wp-total'] || headers['X-WP-Total'] || 0)
                if (total > 0 && totalPages === 1 && total > 100) {
                    totalPages = Math.min(Math.ceil(total / 100), 20)
                }
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

    // HTML fallback — all pages if REST empty
    if (!items.length) {
        for (let page = 1; page <= 15; page++) {
            const htmlUrl =
                page === 1
                    ? `${base}/category/turkish-tv-series/`
                    : `${base}/category/turkish-tv-series/page/${page}/`
            try {
                const {data} = await httpGet(htmlUrl, httpClient, 14_000)
                const html = typeof data === 'string' ? data : ''
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
                    const label = titleCaseWords(slug.replace(/-/g, ' '))
                    items.push({
                        id: `ipf2media___${pageId}`,
                        name: label,
                        nameEn: label,
                        poster: null,
                        mediaId: null,
                        path: norm,
                    })
                    added++
                }
                if (added === 0 && page > 1) break
            } catch {
                break
            }
        }
    }

    // Posters: WP media batch, then TMDB only for leftovers
    await fillPostersFromMedia(base, items, httpClient)
    const apiKey = String(env.TMDB_API_KEY || '').trim()
    await fillPostersFromTmdb(items, apiKey, httpClient)

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
