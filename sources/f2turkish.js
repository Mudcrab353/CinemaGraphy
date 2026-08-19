/**
 * F2Media Turkish TV catalog — isolated (ENABLE_F2_TURKISH=1).
 * Fast multi-page WP REST list (no heavy TMDB on critical path).
 * Stream ids: F2Media provider format.
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'
import {encodePagePath} from './html-source.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
const FALLBACK_CATEGORY_ID = 233905
const LIST_TTL_MS = 10 * 60 * 1000
const listCache = new Map()
const catIdCache = new Map()

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

function titleCaseWords(s) {
    return String(s || '')
        .split(/\s+/)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
}

async function httpGet(url, httpClient, timeout = 12_000) {
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
            embedded[0].media_details?.sizes?.medium?.source_url ||
            null
    }

    let year = null
    const d = row.date || row.modified
    if (d) year = String(d).slice(0, 4)

    return {
        id: `ipf2media___${pageId}`,
        name,
        poster,
        year,
        path: norm,
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

    // Page 1 first (gets total pages), then rest in parallel
    let totalPages = 3
    try {
        const url1 =
            `${base}/wp-json/wp/v2/series?categories=${catId}` +
            `&per_page=20&page=1&_embed=1&orderby=date&order=desc`
        const {data: rows1, headers} = await httpGet(url1, httpClient, 12_000)
        const tp = Number(headers['x-wp-totalpages'] || headers['X-WP-TotalPages'] || 0)
        if (Number.isFinite(tp) && tp > 0) totalPages = Math.min(tp, 10)
        if (Array.isArray(rows1)) {
            for (const row of rows1) {
                const it = itemFromRest(row, base)
                if (!it || seen.has(it.path)) continue
                seen.add(it.path)
                items.push(it)
            }
        }
    } catch {
        /* try more pages / html */
    }

    if (totalPages > 1) {
        const jobs = []
        for (let page = 2; page <= totalPages; page++) {
            const url =
                `${base}/wp-json/wp/v2/series?categories=${catId}` +
                `&per_page=20&page=${page}&_embed=1&orderby=date&order=desc`
            jobs.push(
                httpGet(url, httpClient, 12_000)
                    .then(({data: rows}) => {
                        if (!Array.isArray(rows)) return
                        for (const row of rows) {
                            const it = itemFromRest(row, base)
                            if (!it || seen.has(it.path)) continue
                            seen.add(it.path)
                            items.push(it)
                        }
                    })
                    .catch(() => {}),
            )
        }
        await Promise.all(jobs)
    }

    // HTML fallback only if REST totally empty
    if (!items.length) {
        for (let page = 1; page <= 5; page++) {
            const htmlUrl =
                page === 1
                    ? `${base}/category/turkish-tv-series/`
                    : `${base}/category/turkish-tv-series/page/${page}/`
            try {
                const {data} = await httpGet(htmlUrl, httpClient, 12_000)
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
                    items.push({
                        id: `ipf2media___${pageId}`,
                        name: titleCaseWords(slug.replace(/-/g, ' ')),
                        poster: null,
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
            items = items.filter((it) => it.name.toLowerCase().includes(q))
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
