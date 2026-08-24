/**
 * Animex anime catalog — isolated (ENABLE_ANIMEX_CATALOG=1, default on if ANIMEX_BASEURL set).
 * Display: TMDB meta when possible; poster fallback from Animex page.
 * Streams: existing Animex provider (ipanimex___…).
 */

import {encodePagePath} from './html-source.js'

export const ANIMEX_CATALOG_ID = 'animex_anime_catalog'
const LIST_TTL_MS = 15 * 60 * 1000
const listCache = new Map()
const tmdbCache = new Map()

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

function flagOff(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '0' || s === 'false' || s === 'no' || s === 'off'
}

export function isAnimexCatalogEnabled(env = {}) {
    // Explicit off wins; else on if ENABLE_ANIMEX_CATALOG=1 or ANIMEX_BASEURL present
    if (flagOff(env.ENABLE_ANIMEX_CATALOG)) return false
    if (flagOn(env.ENABLE_ANIMEX_CATALOG)) return true
    return Boolean(String(env.ANIMEX_BASEURL || '').trim())
}

export function animexCatalogBase(env = {}) {
    const raw = String(env.ANIMEX_BASEURL || 'https://animex.click')
        .trim()
        .replace(/\/+$/, '')
    return raw || 'https://animex.click'
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
        .replace(/^دانلود\s+(انیمه|سریال|فیلم)\s+/i, '')
        .replace(/\s*بدون\s+سانسور.*$/i, '')
        .replace(/\s*با\s+زیرنویس.*$/i, '')
        .replace(/\s*دوبله\s+فارسی.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

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

async function httpGet(url, httpClient, timeout = 16_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            },
            validateStatus: (s) => s >= 200 && s < 400,
            responseType: 'text',
            transformResponse: [(d) => d],
        })
        return {data: res.data, headers: res.headers || {}}
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                Accept: 'text/html,application/json',
                'User-Agent': 'Mozilla/5.0',
            },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.text()
        return {data, headers: {}}
    } finally {
        clearTimeout(timer)
    }
}

async function tmdbSearchTv(query, year, apiKey, httpClient) {
    if (!apiKey || !query) return null
    const cacheKey = `tv:${query}:${year || ''}`
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)
    try {
        const params = new URLSearchParams({
            api_key: apiKey,
            query,
            language: 'fa-IR',
            include_adult: 'false',
        })
        if (year) params.set('first_air_date_year', String(year))
        const url = `https://api.themoviedb.org/3/search/tv?${params}`
        let data
        if (httpClient?.get) {
            const res = await httpClient.get(url, {timeout: 10_000, validateStatus: (s) => s < 500})
            data = res.data
        } else {
            const res = await fetch(url)
            data = await res.json()
        }
        const hit = Array.isArray(data?.results) ? data.results[0] : null
        const out = hit
            ? {
                  name: hit.name || hit.original_name,
                  poster: hit.poster_path
                      ? `https://image.tmdb.org/t/p/w500${hit.poster_path}`
                      : null,
                  background: hit.backdrop_path
                      ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`
                      : null,
                  year: (hit.first_air_date || '').slice(0, 4) || null,
              }
            : null
        tmdbCache.set(cacheKey, out)
        return out
    } catch {
        tmdbCache.set(cacheKey, null)
        return null
    }
}

async function enrichWithTmdb(items, apiKey, httpClient) {
    if (!apiKey || !items?.length) return
    const batch = items.slice(0, 40)
    await Promise.all(
        batch.map(async (it) => {
            const q = it.query || tmdbQuery(it.rawName, it.slug)
            const tm = await tmdbSearchTv(q, it.year, apiKey, httpClient)
            if (tm) {
                if (tm.name) it.name = tm.name
                if (tm.poster) it.poster = tm.poster
                else if (!it.poster && it.sitePoster) it.poster = it.sitePoster
                if (tm.background) it.background = tm.background
                if (tm.year) it.year = tm.year
            } else if (!it.poster && it.sitePoster) {
                it.poster = it.sitePoster
            }
        }),
    )
}

/**
 * Scrape https://animex.click/anime/ (+ pages) for detail cards under /anime/{slug}/
 */
async function scrapeAnimexList(env, httpClient) {
    const base = animexCatalogBase(env)
    const cacheKey = `list:${base}`
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const {load} = await import('cheerio')
    const items = []
    const seen = new Set()

    for (let page = 1; page <= 4; page++) {
        const url =
            page === 1 ? `${base}/anime/` : `${base}/anime/page/${page}/`
        try {
            const {data: html} = await httpGet(url, httpClient)
            if (!html || typeof html !== 'string' || html.length < 200) break
            const $ = load(html)
            let added = 0
            $('a[href*="/anime/"]').each((_, a) => {
                const href = $(a).attr('href') || ''
                let path
                try {
                    path = new URL(href, base).pathname
                } catch {
                    return
                }
                // detail only: /anime/slug/  (not /anime/ or /anime/page/N/)
                const m = path.match(/^\/anime\/([^/]+)\/?$/)
                if (!m) return
                const slug = m[1]
                if (!slug || slug === 'page' || slug === 'feed') return
                const idPath = `/anime/${slug}/`
                if (seen.has(idPath)) return
                seen.add(idPath)

                let name = cleanTitle(
                    $(a).attr('title') ||
                        $(a).find('img').attr('alt') ||
                        $(a).text() ||
                        slug.replace(/-/g, ' '),
                )
                if (!name || name.length < 2) name = slug.replace(/-/g, ' ')

                const img =
                    $(a).find('img').attr('src') ||
                    $(a).find('img').attr('data-src') ||
                    $(a).closest('article, .post, .item, li, .card').find('img').first().attr('src') ||
                    null

                let absPoster = null
                if (img) {
                    try {
                        absPoster = new URL(img, base).toString()
                    } catch {
                        absPoster = img
                    }
                }

                items.push({
                    id: `ipanimex___${encodePagePath(idPath)}`,
                    rawName: name,
                    name,
                    query: tmdbQuery(name, slug),
                    slug,
                    sitePoster: absPoster,
                    poster: absPoster,
                    year: null,
                    path: idPath,
                })
                added++
            })
            if (added === 0 && page > 1) break
        } catch {
            break
        }
    }

    const apiKey = String(env.TMDB_API_KEY || '').trim()
    await enrichWithTmdb(items, apiKey, httpClient)

    // Final poster fallback
    for (const it of items) {
        if (!it.poster && it.sitePoster) it.poster = it.sitePoster
    }

    listCache.set(cacheKey, {at: Date.now(), items})
    return items
}

export async function animexCatalogList(catalogId, search, env, httpClient) {
    if (!isAnimexCatalogEnabled(env)) return {metas: []}
    if (String(catalogId) !== ANIMEX_CATALOG_ID) return {metas: []}

    try {
        let items = await scrapeAnimexList(env, httpClient)
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
                        .includes(q) ||
                    String(it.slug || '')
                        .toLowerCase()
                        .includes(q.replace(/\s+/g, '-')),
            )
        }
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

export function animexCatalogManifestCatalogs(env, lang = 'fa') {
    if (!isAnimexCatalogEnabled(env)) return []
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return [
        {
            type: 'series',
            id: ANIMEX_CATALOG_ID,
            name: isEn ? 'Anime - Animex' : 'انیمه - انیمکس',
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
