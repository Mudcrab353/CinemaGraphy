/**
 * F2Media — Turkish TV series catalog (isolated).
 * ENABLE_F2_TURKISH=1 only. Does not change stream/search providers.
 * Lists /category/turkish-tv-series/ and maps to IMDb/TMDB ids when possible
 * so existing meta + stream pipelines stay untouched.
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
const LIST_TTL_MS = 15 * 60 * 1000
const listCache = new Map()

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Strict opt-in — zero impact on default manifest. */
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
}

function cleanTitle(raw) {
    let t = decodeEntities(raw)
    t = t
        .replace(/^دانلود\s+سریال\s+/i, '')
        .replace(/\s*بدون\s+سانسور.*$/i, '')
        .replace(/\s*با\s+زیرنویس.*$/i, '')
        .replace(/\s*دوبله\s+فارسی.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    return t
}

/** Prefer Latin / English segment for TMDB match. */
function englishHint(title) {
    const t = String(title || '')
    // "فارسی English Name" or "Name/Other"
    const parts = t.split(/\s*\/\s*/)
    for (const p of parts) {
        const latin = p.replace(/[^\p{L}\p{N}\s:.'!-]/gu, ' ').replace(/\s+/g, ' ').trim()
        const letters = latin.replace(/[^a-zA-Z]/g, '')
        if (letters.length >= 3) return latin
    }
    const m = t.match(/[A-Za-z][A-Za-z0-9 .':!&-]{2,}/)
    return m ? m[0].trim() : t
}

async function fetchText(url, httpClient, timeout = 12_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
                'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            },
            validateStatus: (s) => s >= 200 && s < 400,
        })
        return typeof res.data === 'string' ? res.data : ''
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                Accept: 'text/html',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
            },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.text()
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Parse category listing cards from F2Media HTML.
 */
function parseCategoryHtml(html, base) {
    const out = []
    const seen = new Set()
    const blob = String(html || '')
    // series detail paths: /series/slug/
    const re = /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'/#?]+\/?)["']/gi
    let m
    while ((m = re.exec(blob))) {
        let href = decodeEntities(m[1])
        if (href.startsWith('/')) href = `${base}${href}`
        let path
        try {
            path = new URL(href).pathname
        } catch {
            continue
        }
        if (!/^\/series\/[^/]+\/?$/i.test(path)) continue
        const norm = path.replace(/\/+$/, '') + '/'
        if (seen.has(norm)) continue
        seen.add(norm)

        const win = blob.slice(Math.max(0, m.index - 200), m.index + 700)
        let name = ''
        const titleM =
            win.match(/entry-title[^>]*>([^<]+)/i) ||
            win.match(/<h2[^>]*>([^<]+)/i) ||
            win.match(/title=["']([^"']+)["']/i) ||
            win.match(/دانلود\s+سریال\s+([^<"]{3,120})/i)
        if (titleM) name = cleanTitle(titleM[1])
        if (!name || name.length < 2) continue

        let poster = null
        const imgs = [...win.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)]
        for (const im of imgs) {
            const u = decodeEntities(im[1])
            if (/logo|icon|banner|avatar|favicon|wp-include|emoji/i.test(u)) continue
            poster = u
            break
        }

        out.push({
            path: norm,
            name,
            nameEn: englishHint(name),
            poster,
        })
    }
    return out
}

async function scrapeTurkishList(env, httpClient) {
    const base = f2TurkishBase(env)
    const cacheKey = `tr:${base}`
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const items = []
    const seenPath = new Set()
    // 3 pages is enough for current archive; soft-fail per page
    for (let page = 1; page <= 3; page++) {
        const url =
            page === 1
                ? `${base}/category/turkish-tv-series/`
                : `${base}/category/turkish-tv-series/page/${page}/`
        try {
            const html = await fetchText(url, httpClient, 12_000)
            const batch = parseCategoryHtml(html, base)
            for (const it of batch) {
                if (seenPath.has(it.path)) continue
                seenPath.add(it.path)
                items.push(it)
            }
            if (batch.length === 0 && page > 1) break
        } catch {
            // isolated: one page fail must not break catalog
            break
        }
    }

    listCache.set(cacheKey, {at: Date.now(), items})
    return items
}

async function tmdbFindSeries(query, apiKey, httpClient) {
    if (!apiKey || !query) return null
    try {
        const url = `https://api.themoviedb.org/3/search/tv?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&language=en-US`
        let data
        if (httpClient?.get) {
            const res = await httpClient.get(url, {timeout: 8_000})
            data = res.data
        } else {
            const res = await fetch(url)
            data = await res.json()
        }
        const row = data?.results?.[0]
        if (!row?.id) return null
        // external imdb
        let imdbId = null
        try {
            const extUrl = `https://api.themoviedb.org/3/tv/${row.id}/external_ids?api_key=${encodeURIComponent(apiKey)}`
            let ext
            if (httpClient?.get) {
                ext = (await httpClient.get(extUrl, {timeout: 6_000})).data
            } else {
                ext = await (await fetch(extUrl)).json()
            }
            if (ext?.imdb_id && /^tt\d+$/i.test(ext.imdb_id)) imdbId = ext.imdb_id
        } catch {
            /* optional */
        }
        const poster = row.poster_path
            ? `https://image.tmdb.org/t/p/w500${row.poster_path}`
            : null
        return {
            imdbId,
            tmdbId: row.id,
            name: row.name || query,
            poster,
            overview: row.overview || '',
            year: (row.first_air_date || '').slice(0, 4) || null,
        }
    } catch {
        return null
    }
}

/**
 * Build catalog metas. Prefer tt: ids so Cinemeta/TMDB/stream paths stay unchanged.
 */
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

    const apiKey = String(env.TMDB_API_KEY || '').trim()
    const metas = []
    // Limit concurrent TMDB lookups
    const concurrency = 4
    for (let i = 0; i < items.length; i += concurrency) {
        const slice = items.slice(i, i + concurrency)
        const part = await Promise.all(
            slice.map(async (it) => {
                const tmdb = apiKey ? await tmdbFindSeries(it.nameEn || it.name, apiKey, httpClient) : null
                const id = tmdb?.imdbId || (tmdb?.tmdbId ? `tmdb:${tmdb.tmdbId}` : null)
                // Without a stable external id, skip — avoids broken series meta/episodes
                // and keeps stream path identical to the rest of the addon.
                if (!id) {
                    // still show with tmdb-less poster if we invent nothing that breaks stream
                    // Use name-only meta is risky for series episodes — omit rather than break UX
                    return null
                }
                return {
                    id,
                    type: 'series',
                    name: it.name,
                    poster: tmdb?.poster || it.poster || null,
                    posterShape: 'poster',
                    releaseInfo: tmdb?.year || undefined,
                }
            }),
        )
        for (const m of part) {
            if (m) metas.push(m)
        }
    }

    return {metas}
}

export function f2turkishManifestCatalogs(env, lang = 'fa') {
    if (!isF2TurkishEnabled(env)) return []
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return [
        {
            type: 'series',
            id: F2TURKISH_CATALOG_ID,
            name: isEn ? 'Turkish Series' : 'سریال - ترکی',
            extra: [{name: 'search', isRequired: false}, {name: 'skip', isRequired: false}],
        },
    ]
}
