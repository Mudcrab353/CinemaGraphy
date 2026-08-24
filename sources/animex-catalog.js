/**
 * Animex anime catalog — ENABLE_ANIMEX_CATALOG (default on if ANIMEX_BASEURL set).
 * Catalog name ONLY: «انیمه - انیمکس» / «Anime - Animex»
 * Display: TMDB fa-IR first, English fallback; poster from TMDB or Animex site.
 * Streams: Animex provider ids (ipanimex___…).
 */

import {encodePagePath} from './html-source.js'

export const ANIMEX_CATALOG_ID = 'animex_anime_catalog'
const LIST_TTL_MS = 12 * 60 * 1000
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

/** Fixed labels — never pass through translateCatalogName mangling */
export function animexCatalogDisplayName(lang = 'fa') {
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return isEn ? 'Anime - Animex' : 'انیمه - انیمکس'
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

async function httpGetHtml(url, httpClient, timeout = 18_000) {
    const headers = {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://animex.click/',
    }
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers,
            validateStatus: (s) => s >= 200 && s < 400,
            responseType: 'text',
            transformResponse: [(d) => d],
        })
        return {data: res.data, headers: res.headers || {}}
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {signal: ctrl.signal, headers})
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return {data: await res.text(), headers: {}}
    } finally {
        clearTimeout(timer)
    }
}

async function tmdbGet(path, params, apiKey, httpClient) {
    const q = new URLSearchParams({api_key: apiKey, ...params})
    const url = `https://api.themoviedb.org/3/${path}?${q}`
    if (httpClient?.get) {
        const res = await httpClient.get(url, {timeout: 12_000, validateStatus: (s) => s < 500})
        return res.data
    }
    const res = await fetch(url)
    return res.json()
}

/**
 * Prefer Persian name/overview; fill gaps from English.
 */
async function tmdbEnrichTv(query, year, apiKey, httpClient) {
    if (!apiKey || !query) return null
    const cacheKey = `tv2:${query}:${year || ''}`
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)

    try {
        const searchParams = {
            query,
            language: 'fa-IR',
            include_adult: 'false',
        }
        if (year) searchParams.first_air_date_year = String(year)
        const search = await tmdbGet('search/tv', searchParams, apiKey, httpClient)
        const hit = Array.isArray(search?.results) ? search.results[0] : null
        if (!hit?.id) {
            tmdbCache.set(cacheKey, null)
            return null
        }

        const [fa, en] = await Promise.all([
            tmdbGet(`tv/${hit.id}`, {language: 'fa-IR'}, apiKey, httpClient).catch(() => null),
            tmdbGet(`tv/${hit.id}`, {language: 'en-US'}, apiKey, httpClient).catch(() => null),
        ])

        const name =
            (fa?.name && String(fa.name).trim()) ||
            (en?.name && String(en.name).trim()) ||
            hit.name ||
            hit.original_name ||
            query

        const description =
            (fa?.overview && String(fa.overview).trim()) ||
            (en?.overview && String(en.overview).trim()) ||
            ''

        const posterPath = fa?.poster_path || en?.poster_path || hit.poster_path
        const bgPath = fa?.backdrop_path || en?.backdrop_path || hit.backdrop_path
        const air = fa?.first_air_date || en?.first_air_date || hit.first_air_date || ''
        const genres = (fa?.genres || en?.genres || [])
            .map((g) => g?.name)
            .filter(Boolean)
            .slice(0, 6)

        const out = {
            tmdbId: hit.id,
            name,
            description,
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
            background: bgPath ? `https://image.tmdb.org/t/p/w1280${bgPath}` : null,
            year: air.slice(0, 4) || null,
            genres,
            imdbRating: fa?.vote_average || en?.vote_average || hit.vote_average || null,
        }
        tmdbCache.set(cacheKey, out)
        return out
    } catch {
        tmdbCache.set(cacheKey, null)
        return null
    }
}

async function enrichWithTmdb(items, apiKey, httpClient) {
    if (!apiKey || !items?.length) return
    const batch = items.slice(0, 48)
    for (let i = 0; i < batch.length; i += 6) {
        const slice = batch.slice(i, i + 6)
        await Promise.all(
            slice.map(async (it) => {
                const q = it.query || tmdbQuery(it.rawName, it.slug)
                const tm = await tmdbEnrichTv(q, it.year, apiKey, httpClient)
                if (tm) {
                    it.name = tm.name
                    it.description = tm.description || ''
                    if (tm.poster) it.poster = tm.poster
                    else if (!it.poster && it.sitePoster) it.poster = it.sitePoster
                    if (tm.background) it.background = tm.background
                    if (tm.year) it.year = tm.year
                    it.genres = tm.genres || []
                    it.imdbRating = tm.imdbRating
                    it.tmdbId = tm.tmdbId
                } else {
                    if (!it.poster && it.sitePoster) it.poster = it.sitePoster
                    if (!it.name) it.name = it.query || it.rawName
                }
            }),
        )
    }
}

async function scrapeAnimexList(env, httpClient) {
    const base = animexCatalogBase(env)
    const cacheKey = `list2:${base}`
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const {load} = await import('cheerio')
    const items = []
    const seen = new Set()

    for (let page = 1; page <= 5; page++) {
        const url = page === 1 ? `${base}/anime/` : `${base}/anime/page/${page}/`
        try {
            const {data: html} = await httpGetHtml(url, httpClient)
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
                const m = path.match(/^\/anime\/([^/]+)\/?$/)
                if (!m) return
                const slug = m[1]
                if (!slug || slug === 'page' || slug === 'feed' || slug === 'category') return
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
                    $(a).find('img').attr('data-lazy-src') ||
                    $(a).closest('article, .post, .item, li, .card, .movie-item').find('img').first().attr('src') ||
                    null

                let absPoster = null
                if (img) {
                    try {
                        absPoster = new URL(img, base).toString()
                    } catch {
                        absPoster = img
                    }
                }

                const pageId = encodePagePath(idPath)
                if (!pageId) return

                items.push({
                    // Same shape as provider search → streams via Animex
                    id: `ipanimex___${pageId}`,
                    rawName: name,
                    name,
                    query: tmdbQuery(name, slug),
                    slug,
                    sitePoster: absPoster,
                    poster: absPoster,
                    year: null,
                    path: idPath,
                    description: '',
                    genres: [],
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
            metas: items.map((it) => {
                const meta = {
                    id: it.id,
                    type: 'series',
                    name: it.name || it.query || it.rawName,
                    poster: it.poster || null,
                    posterShape: 'poster',
                }
                if (it.background) meta.background = it.background
                if (it.year) meta.releaseInfo = String(it.year)
                if (it.description) meta.description = it.description
                if (it.genres?.length) meta.genres = it.genres
                if (it.imdbRating) meta.imdbRating = String(Number(it.imdbRating).toFixed(1))
                return meta
            }),
        }
    } catch {
        return {metas: []}
    }
}

export function animexCatalogManifestCatalogs(env, lang = 'fa') {
    if (!isAnimexCatalogEnabled(env)) return []
    return [
        {
            type: 'series',
            id: ANIMEX_CATALOG_ID,
            // Exact label only — no "Series" / type prefix in the string
            name: animexCatalogDisplayName(lang),
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
