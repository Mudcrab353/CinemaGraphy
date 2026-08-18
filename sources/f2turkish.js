/**
 * F2Media Turkish TV catalog — isolated (ENABLE_F2_TURKISH=1).
 * Lists via WordPress REST (category turkish-tv-series). Catalog ids use
 * F2Media provider format so meta/stream reuse existing handlers.
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'
import {encodePagePath} from './html-source.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
/** Known category id on film2med; refreshed from slug if needed. */
const FALLBACK_CATEGORY_ID = 233905
const LIST_TTL_MS = 15 * 60 * 1000
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
        poster,
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

    // REST is stable and lighter than full HTML pages
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

    // HTML fallback if REST empty
    if (!items.length) {
        try {
            const htmlUrl = `${base}/category/turkish-tv-series/`
            let html = ''
            if (httpClient?.get) {
                const res = await httpClient.get(htmlUrl, {
                    timeout: 14_000,
                    headers: {
                        Accept: 'text/html',
                        'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
                    },
                    validateStatus: (s) => s >= 200 && s < 400,
                })
                html = typeof res.data === 'string' ? res.data : ''
            }
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
                    poster: null,
                    path: norm,
                })
            }
        } catch {
            /* isolated soft-fail */
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
        items = items.filter((it) => it.name.toLowerCase().includes(q))
    }

    return {
        metas: items.map((it) => ({
            id: it.id,
            type: 'series',
            name: it.name,
            poster: it.poster || null,
            posterShape: 'poster',
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
