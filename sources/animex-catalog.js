/**
 * کاتالوگ «انیمه - انیمکس» / «Anime - Animex»
 * متا: انیمکس → Kitsu → TMDB (fa سپس en)
 * استریم: ipanimex___…
 */

import {encodePagePath} from './html-source.js'

export const ANIMEX_CATALOG_ID = 'animex_anime_catalog'
export const ANIMEX_CATALOG_NAME_FA = 'انیمه - انیمکس'
export const ANIMEX_CATALOG_NAME_EN = 'Anime - Animex'

const LIST_TTL_MS = 12 * 60 * 1000
const listCache = new Map()
const detailCache = new Map()
const tmdbCache = new Map()
const kitsuCache = new Map()

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
    return (
        String(env.ANIMEX_BASEURL || 'https://animex.click')
            .trim()
            .replace(/\/+$/, '') || 'https://animex.click'
    )
}

export function animexCatalogDisplayName(lang = 'fa') {
    return String(lang || 'fa').toLowerCase().startsWith('en')
        ? ANIMEX_CATALOG_NAME_EN
        : ANIMEX_CATALOG_NAME_FA
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
    return decodeEntities(raw)
        .replace(/<[^>]+>/g, '')
        .replace(/^دانلود\s+(انیمه|سریال|فیلم)\s+/i, '')
        .replace(/\s*بدون\s+سانسور.*$/i, '')
        .replace(/\s*با\s+زیرنویس.*$/i, '')
        .replace(/\s*دوبله\s+فارسی.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function latinQuery(title, slug) {
    const t = String(title || '')
    for (const p of t.split(/\s*\/\s*/)) {
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

async function httpGet(url, httpClient, timeout = 18_000, asJson = false) {
    const headers = {
        Accept: asJson
            ? 'application/vnd.api+json, application/json'
            : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
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
            ...(asJson ? {} : {responseType: 'text', transformResponse: [(d) => d]}),
        })
        return res.data
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {signal: ctrl.signal, headers})
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return asJson ? res.json() : res.text()
    } finally {
        clearTimeout(timer)
    }
}

async function scrapeAnimexDetail(base, path, httpClient) {
    const key = 'd:' + path
    if (detailCache.has(key)) return detailCache.get(key)
    try {
        const html = await httpGet(base + path, httpClient, 16_000)
        if (!html || typeof html !== 'string') {
            detailCache.set(key, null)
            return null
        }
        const {load} = await import('cheerio')
        const $ = load(html)
        const title =
            cleanTitle($('h1').first().text()) ||
            cleanTitle($('meta[property="og:title"]').attr('content')) ||
            cleanTitle($('title').first().text())
        const description =
            cleanTitle($('meta[property="og:description"]').attr('content')) ||
            cleanTitle($('meta[name="description"]').attr('content')) ||
            cleanTitle($('.entry-content p, .synopsis, .plot, .description').first().text()) ||
            ''
        let poster =
            $('meta[property="og:image"]').attr('content') ||
            $('.poster img, .post-thumbnail img, img.wp-post-image').first().attr('src') ||
            null
        if (poster) {
            try {
                poster = new URL(poster, base).toString()
            } catch (e) {}
        }
        const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') || ''
        const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] || null
        const out = {title, description, poster, imdbId}
        detailCache.set(key, out)
        return out
    } catch (e) {
        detailCache.set(key, null)
        return null
    }
}

async function kitsuSearch(query, httpClient) {
    if (!query) return null
    const cacheKey = 'k:' + query
    if (kitsuCache.has(cacheKey)) return kitsuCache.get(cacheKey)
    try {
        const url =
            'https://kitsu.io/api/edge/anime?filter[text]=' +
            encodeURIComponent(query) +
            '&page[limit]=1'
        const data = await httpGet(url, httpClient, 10_000, true)
        const row = data?.data?.[0]
        const a = row?.attributes
        if (!a) {
            kitsuCache.set(cacheKey, null)
            return null
        }
        const name =
            a.titles?.en_jp || a.canonicalTitle || a.titles?.en || a.titles?.ja_jp || query
        const description = (a.synopsis || '').replace(/\r\n/g, '\n').trim().slice(0, 1200)
        const poster =
            a.posterImage?.large || a.posterImage?.medium || a.posterImage?.original || null
        const background = a.coverImage?.large || a.coverImage?.original || null
        const year = (a.startDate || '').slice(0, 4) || null
        const out = {name, description, poster, background, year, kitsuId: row.id}
        kitsuCache.set(cacheKey, out)
        return out
    } catch (e) {
        kitsuCache.set(cacheKey, null)
        return null
    }
}

async function tmdbSearch(query, apiKey, httpClient) {
    if (!apiKey || !query) return null
    const cacheKey = 't:' + query
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)
    try {
        const q = new URLSearchParams({
            api_key: apiKey,
            query,
            language: 'fa-IR',
            include_adult: 'false',
        })
        let data
        if (httpClient?.get) {
            data = (
                await httpClient.get('https://api.themoviedb.org/3/search/tv?' + q, {
                    timeout: 10_000,
                    validateStatus: (s) => s < 500,
                })
            ).data
        } else {
            data = await (await fetch('https://api.themoviedb.org/3/search/tv?' + q)).json()
        }
        const hit = data?.results?.[0]
        if (!hit?.id) {
            tmdbCache.set(cacheKey, null)
            return null
        }
        const detailUrl = (lang) =>
            'https://api.themoviedb.org/3/tv/' + hit.id + '?api_key=' + apiKey + '&language=' + lang
        let fa = null
        let en = null
        try {
            if (httpClient?.get) {
                const pair = await Promise.all([
                    httpClient.get(detailUrl('fa-IR'), {timeout: 10_000}).then((r) => r.data),
                    httpClient.get(detailUrl('en-US'), {timeout: 10_000}).then((r) => r.data),
                ])
                fa = pair[0]
                en = pair[1]
            }
        } catch (e) {}
        const name =
            (fa?.name && fa.name.trim()) ||
            (en?.name && en.name.trim()) ||
            hit.name ||
            hit.original_name
        const description =
            (fa?.overview && fa.overview.trim()) ||
            (en?.overview && en.overview.trim()) ||
            ''
        const posterPath = fa?.poster_path || en?.poster_path || hit.poster_path
        const bgPath = fa?.backdrop_path || en?.backdrop_path || hit.backdrop_path
        const out = {
            name,
            description,
            poster: posterPath ? 'https://image.tmdb.org/t/p/w500' + posterPath : null,
            background: bgPath ? 'https://image.tmdb.org/t/p/w1280' + bgPath : null,
            year:
                (fa?.first_air_date || en?.first_air_date || hit.first_air_date || '').slice(0, 4) ||
                null,
        }
        tmdbCache.set(cacheKey, out)
        return out
    } catch (e) {
        tmdbCache.set(cacheKey, null)
        return null
    }
}

async function enrichItem(it, env, httpClient, base) {
    const apiKey = String(env.TMDB_API_KEY || '').trim()
    const q = it.query || latinQuery(it.rawName, it.slug)

    const site = await scrapeAnimexDetail(base, it.path, httpClient)
    if (site) {
        if (site.title) it.name = site.title
        if (site.description) it.description = site.description
        if (site.poster) it.poster = site.poster
        if (site.imdbId) it.imdbId = site.imdbId
    }

    const kitsu = await kitsuSearch(q, httpClient)
    if (kitsu) {
        if (!it.description && kitsu.description) it.description = kitsu.description
        if (kitsu.poster && (!it.poster || it.poster === it.sitePoster)) it.poster = kitsu.poster
        if (kitsu.background) it.background = kitsu.background
        if (kitsu.year) it.year = kitsu.year
        if (kitsu.name && (!it.name || it.name === (it.slug || '').replace(/-/g, ' '))) {
            it.name = kitsu.name
        }
    }

    if (apiKey) {
        const tm = await tmdbSearch(q, apiKey, httpClient)
        if (tm) {
            if (tm.name) it.name = tm.name
            if (tm.description) it.description = tm.description
            if (tm.poster) it.poster = tm.poster
            if (tm.background) it.background = tm.background
            if (tm.year) it.year = tm.year
        }
    }

    if (!it.poster && it.sitePoster) it.poster = it.sitePoster
    if (!it.name) it.name = it.query || it.rawName
}

async function scrapeAnimexList(env, httpClient) {
    const base = animexCatalogBase(env)
    const cacheKey = 'list3:' + base
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const {load} = await import('cheerio')
    const items = []
    const seen = new Set()

    for (let page = 1; page <= 4; page++) {
        const url = page === 1 ? base + '/anime/' : base + '/anime/page/' + page + '/'
        try {
            const html = await httpGet(url, httpClient)
            if (!html || typeof html !== 'string' || html.length < 200) break
            const $ = load(html)
            let added = 0
            $('a[href*="/anime/"]').each((_, a) => {
                const href = $(a).attr('href') || ''
                let path
                try {
                    path = new URL(href, base).pathname
                } catch (e) {
                    return
                }
                const m = path.match(/^\/anime\/([^/]+)\/?$/)
                if (!m) return
                const slug = m[1]
                if (!slug || ['page', 'feed', 'category', 'tag'].includes(slug)) return
                const idPath = '/anime/' + slug + '/'
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
                    null
                let absPoster = null
                if (img) {
                    try {
                        absPoster = new URL(img, base).toString()
                    } catch (e) {
                        absPoster = img
                    }
                }

                const pageId = encodePagePath(idPath)
                if (!pageId) return

                items.push({
                    id: 'ipanimex___' + pageId,
                    rawName: name,
                    name,
                    query: latinQuery(name, slug),
                    slug,
                    sitePoster: absPoster,
                    poster: absPoster,
                    path: idPath,
                    description: '',
                    year: null,
                })
                added++
            })
            if (added === 0 && page > 1) break
        } catch (e) {
            break
        }
    }

    const detailN = Math.min(items.length, 8)
    for (let i = 0; i < detailN; i++) {
        await enrichItem(items[i], env, httpClient, base)
    }
    for (let i = detailN; i < items.length; i++) {
        const it = items[i]
        const q = it.query
        const kitsu = await kitsuSearch(q, httpClient)
        if (kitsu) {
            if (kitsu.name) it.name = kitsu.name
            if (kitsu.description) it.description = kitsu.description
            if (kitsu.poster) it.poster = kitsu.poster
            if (kitsu.background) it.background = kitsu.background
            if (kitsu.year) it.year = kitsu.year
        }
        const apiKey = String(env.TMDB_API_KEY || '').trim()
        if (apiKey) {
            const tm = await tmdbSearch(q, apiKey, httpClient)
            if (tm) {
                if (tm.name) it.name = tm.name
                if (tm.description) it.description = tm.description
                if (tm.poster) it.poster = tm.poster
                if (tm.background) it.background = tm.background
                if (tm.year) it.year = tm.year
            }
        }
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
        const q = String(search || '').trim().toLowerCase()
        if (q) {
            items = items.filter(
                (it) =>
                    String(it.name || '').toLowerCase().includes(q) ||
                    String(it.query || '').toLowerCase().includes(q) ||
                    String(it.slug || '').toLowerCase().includes(q.replace(/\s+/g, '-')),
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
                return meta
            }),
        }
    } catch (e) {
        return {metas: []}
    }
}

export function animexCatalogManifestCatalogs(env, lang = 'fa') {
    if (!isAnimexCatalogEnabled(env)) return []
    return [
        {
            type: 'series',
            id: ANIMEX_CATALOG_ID,
            name: animexCatalogDisplayName(lang),
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
