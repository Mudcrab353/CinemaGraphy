/**
 * کاتالوگ ثابت: «انیمه - انیمکس» / «Anime - Animex»
 * لیست و متای کارت: اول از خود سایت انیمکس (سریع)
 * اختیاری: Kitsu سپس TMDB برای توضیح/پوستر بهتر (شکست = بدون خطا)
 * استریم: پروایدر Animex با id = ipanimex___…
 *
 * MAL رسمی API کلید می‌خواهد؛ Jikan/Kitsu عمومی‌اند. اینجا Kitsu اختیاری است.
 */

import {encodePagePath} from './html-source.js'

export const ANIMEX_CATALOG_ID = 'animex_anime_catalog'
export const ANIMEX_CATALOG_NAME_FA = 'انیمه - انیمکس'
export const ANIMEX_CATALOG_NAME_EN = 'Anime - Animex'

const LIST_TTL_MS = 10 * 60 * 1000
const listCache = new Map()
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

async function httpGet(url, httpClient, timeout = 16_000, asJson = false) {
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

/** Optional Kitsu (no API key). Failures ignored. */
async function kitsuSearch(query, httpClient) {
    if (!query) return null
    const cacheKey = 'k:' + query
    if (kitsuCache.has(cacheKey)) return kitsuCache.get(cacheKey)
    try {
        const url =
            'https://kitsu.io/api/edge/anime?filter[text]=' +
            encodeURIComponent(query) +
            '&page[limit]=1'
        const data = await httpGet(url, httpClient, 8_000, true)
        const a = data?.data?.[0]?.attributes
        if (!a) {
            kitsuCache.set(cacheKey, null)
            return null
        }
        const name =
            a.titles?.en_jp || a.canonicalTitle || a.titles?.en || a.titles?.ja_jp || query
        const description = String(a.synopsis || '')
            .replace(/\r\n/g, '\n')
            .trim()
            .slice(0, 1200)
        const poster =
            a.posterImage?.large || a.posterImage?.medium || a.posterImage?.original || null
        const background = a.coverImage?.large || a.coverImage?.original || null
        const year = (a.startDate || '').slice(0, 4) || null
        const out = {name, description, poster, background, year}
        kitsuCache.set(cacheKey, out)
        return out
    } catch {
        kitsuCache.set(cacheKey, null)
        return null
    }
}

async function tmdbSearch(query, apiKey, httpClient) {
    if (!query || !apiKey) return null
    try {
        const q = new URLSearchParams({
            api_key: apiKey,
            query,
            language: 'fa-IR',
            include_adult: 'false',
        })
        const url = 'https://api.themoviedb.org/3/search/tv?' + q
        let data
        if (httpClient?.get) {
            data = (await httpClient.get(url, {timeout: 8_000})).data
        } else {
            data = await httpGet(url, null, 8_000, true)
        }
        const hit = data?.results?.[0]
        if (!hit?.id) return null
        const [fa, en] = await Promise.all([
            (async () => {
                const u =
                    'https://api.themoviedb.org/3/tv/' +
                    hit.id +
                    '?api_key=' +
                    apiKey +
                    '&language=fa-IR'
                if (httpClient?.get) return (await httpClient.get(u, {timeout: 8_000})).data
                return httpGet(u, null, 8_000, true)
            })().catch(() => null),
            (async () => {
                const u =
                    'https://api.themoviedb.org/3/tv/' +
                    hit.id +
                    '?api_key=' +
                    apiKey +
                    '&language=en-US'
                if (httpClient?.get) return (await httpClient.get(u, {timeout: 8_000})).data
                return httpGet(u, null, 8_000, true)
            })().catch(() => null),
        ])
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
        return {
            name,
            description,
            poster: posterPath ? 'https://image.tmdb.org/t/p/w500' + posterPath : null,
            background: bgPath ? 'https://image.tmdb.org/t/p/w1280' + bgPath : null,
            year: (fa?.first_air_date || en?.first_air_date || hit.first_air_date || '').slice(
                0,
                4,
            ) || null,
        }
    } catch {
        return null
    }
}

/**
 * فقط HTML لیست انیمکس — بدون detail per-item (برای جلوگیری از timeout خالی شدن کاتالوگ).
 */
async function scrapeAnimexList(env, httpClient) {
    const base = animexCatalogBase(env)
    const cacheKey = 'list3:' + base
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const {load} = await import('cheerio')
    const items = []
    const seen = new Set()

    for (let page = 1; page <= 5; page++) {
        const url = page === 1 ? base + '/anime/' : base + '/anime/page/' + page + '/'
        try {
            const html = await httpGet(url, httpClient, 16_000)
            if (!html || typeof html !== 'string' || html.length < 200) break
            const $ = load(html)
            let added = 0

            // کارت‌های رایج وردپرس / پوستر لینک‌دار
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
                if (!slug || ['page', 'feed', 'category', 'tag', 'genre'].includes(slug)) return
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
                    $(a).find('img').attr('data-original') ||
                    $(a)
                        .closest('article, .post, .item, li, .card, .movie-item, .col')
                        .find('img')
                        .first()
                        .attr('src') ||
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
                    id: 'ipanimex___' + pageId,
                    rawName: name,
                    name,
                    query: latinQuery(name, slug),
                    slug,
                    poster: absPoster,
                    path: idPath,
                    description: '',
                    year: null,
                    background: null,
                })
                added++
            })
            if (added === 0 && page > 1) break
        } catch {
            break
        }
    }

    // غنی‌سازی سبک و موازی — حداکثر ۱۲ مورد اول؛ شکست کل لیست را خالی نمی‌کند
    const apiKey = String(env.TMDB_API_KEY || '').trim()
    const enrichN = Math.min(items.length, 12)
    await Promise.all(
        items.slice(0, enrichN).map(async (it) => {
            const q = it.query || latinQuery(it.rawName, it.slug)
            try {
                const kitsu = await kitsuSearch(q, httpClient)
                if (kitsu) {
                    if (kitsu.description) it.description = kitsu.description
                    if (kitsu.poster) it.poster = kitsu.poster
                    if (kitsu.background) it.background = kitsu.background
                    if (kitsu.year) it.year = kitsu.year
                    // نام از سایت انیمکس اولویت دارد مگر خیلی کوتاه باشد
                    if (kitsu.name && (!it.name || it.name.length < 4)) it.name = kitsu.name
                }
            } catch {
                /* ignore */
            }
            if (apiKey) {
                try {
                    const tm = await tmdbSearch(q, apiKey, httpClient)
                    if (tm) {
                        if (tm.description && !it.description) it.description = tm.description
                        if (tm.poster) it.poster = tm.poster
                        if (tm.background) it.background = tm.background
                        if (tm.year) it.year = tm.year
                        if (tm.name && tm.description) it.name = tm.name
                    }
                } catch {
                    /* ignore */
                }
            }
        }),
    )

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
            // فقط همین رشته — بدون پیشوند Series در فیلد name
            name: animexCatalogDisplayName(lang),
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
