/**
 * Namakade / Negahestan — Iranian-only (series, movies, optional live).
 * Isolated: ENABLE_NAMAKADE or NAMAKADE_BASEURL. No impact when off.
 */

export const NAMAKADE_PREFIX = 'namakade:'
export const DEFAULT_NAMAKADE_BASEURL = 'https://namakade.com'

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** CDN hosts allowed through /api/media-proxy (pages filtered in IR; media often is not). */
export const NAMAKADE_MEDIA_HOSTS = [
    'media.negahestan.com',
    'media.iranproud2.net',
    'media.iranproud.com',
    'namakade.com',
    'www.namakade.com',
    'mobile.namakade.com',
]

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export function isNamakadeEnabled(env = {}) {
    return flagOn(env.ENABLE_NAMAKADE) || Boolean(String(env.NAMAKADE_BASEURL || '').trim())
}

export function namakadeBase(env = {}) {
    const raw = String(env.NAMAKADE_BASEURL || DEFAULT_NAMAKADE_BASEURL).trim() || DEFAULT_NAMAKADE_BASEURL
    return raw.replace(/\/+$/, '')
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

/** Reject Turkish / foreign / non-Iranian catalog noise. */
export function isIranianContent(pathOrUrl, title = '') {
    const s = `${pathOrUrl || ''} ${title || ''}`.toLowerCase()
    if (!s.trim()) return false
    if (
        /foreign|turkish|turkce|\u062a\u0631\u06a9\u06cc|\u062a\u0631\u06a9\u06cc\u0647|korean|\u06a9\u0631\u0647|bollywood|hindi|c-?drama|j-?drama|latin\s*american/i.test(
            s,
        )
    ) {
        return false
    }
    if (/\/series\/category\/(turkish|foreign)/i.test(s)) return false
    if (/\/iran-1-movies\/[^"' ]*foreign/i.test(s)) return false
    if (/\/iran-1-movies\//i.test(s)) return !/foreign/i.test(s)
    if (/\/shows?\//i.test(s)) {
        if (/\/shows\/category\//i.test(s) && !/reality/i.test(s)) return false
        return true
    }
    if (/\/series\//i.test(s)) return true
    if (/\/livetv|\/live\b/i.test(s)) return true
    return true
}

function isIranianMoviePath(path) {
    const s = String(path || '').toLowerCase()
    if (!s.includes('/iran-1-movies/')) return false
    if (s.includes('foreign')) return false
    return true
}

async function fetchHtml(url, httpClient, timeout = 14_000) {
    if (httpClient && typeof httpClient.get === 'function') {
        try {
            const res = await httpClient.get(url, {
                timeout,
                maxRedirects: 8,
                headers: {
                    'User-Agent': UA,
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.5',
                },
                responseType: 'text',
                validateStatus: (st) => st >= 200 && st < 400,
            })
            return String(res.data || '')
        } catch {
            /* fall through */
        }
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': UA,
                Accept: 'text/html,application/xhtml+xml',
                'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.5',
            },
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return await res.text()
    } finally {
        clearTimeout(timer)
    }
}

function extractCards(html, linkRe) {
    const out = []
    const seen = new Set()
    const blob = String(html || '')
    let m
    while ((m = linkRe.exec(blob))) {
        const href = decodeEntities(m[1])
        if (!href || seen.has(href)) continue
        seen.add(href)
        const window = blob.slice(Math.max(0, m.index - 120), m.index + 500)
        const img = window.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)
        let title = ''
        const alt = window.match(/alt=["']([^"']{2,100})["']/i)
        const txt = window.match(
            /<(?:div|span|p|h\d)[^>]*class=["'][^"']*(?:Titr|title|name|Txt|Caption)[^"']*["'][^>]*>([^<]{2,100})</i,
        )
        if (alt) title = alt[1]
        else if (txt) title = txt[1]
        else {
            const slug = href.split('?')[0].split('/').filter(Boolean).pop() || ''
            title = slug.replace(/[-_+]+/g, ' ')
        }
        title = decodeEntities(title).replace(/\s+/g, ' ').trim()
        out.push({href, title, poster: img ? decodeEntities(img[1]) : null})
        if (out.length >= 100) break
    }
    return out
}

function slugFromPath(path) {
    const parts = String(path || '').split('?')[0].split('/').filter(Boolean)
    return parts[parts.length - 1] || path
}

function titleFromSlug(slug) {
    return String(slug || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function encodeNamakadeId(kind, path) {
    const clean = String(path || '')
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .replace(/^serieses\//, 'series/')
    const b64 = Buffer.from(clean, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return NAMAKADE_PREFIX + kind + ':' + b64
}

export function parseNamakadeId(id) {
    const s = String(id || '')
    if (!s.startsWith(NAMAKADE_PREFIX)) return null
    const rest = s.slice(NAMAKADE_PREFIX.length)
    const m = rest.match(/^(series|show|movie|episode|live):(.+)$/i)
    if (!m) return null
    const kind = m[1].toLowerCase()
    let path
    try {
        const b64 = m[2].replace(/-/g, '+').replace(/_/g, '/')
        const pad = (4 - (b64.length % 4)) % 4
        path = Buffer.from(b64 + '='.repeat(pad), 'base64').toString('utf8')
    } catch {
        path = decodeURIComponent(m[2])
    }
    return {kind, path}
}

export function proxyNamakadeMediaUrl(url, publicBase) {
    if (!url || !publicBase) return url
    try {
        const u = new URL(url)
        if (!NAMAKADE_MEDIA_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) {
            return url
        }
        const b64 = Buffer.from(url, 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        return String(publicBase).replace(/\/+$/, '') + '/api/media-proxy/' + b64
    } catch {
        return url
    }
}

export function rewriteNamakadeMediaUrls(value, publicBase, seen = new WeakSet()) {
    if (!publicBase || value == null) return value
    if (typeof value === 'string') {
        if (/^https?:\/\/(media\.(negahestan|iranproud2?)\.com|([^/]*\.)?namakade\.com)/i.test(value)) {
            return proxyNamakadeMediaUrl(value, publicBase)
        }
        return value
    }
    if (typeof value !== 'object') return value
    if (seen.has(value)) return value
    seen.add(value)
    if (Array.isArray(value)) return value.map((v) => rewriteNamakadeMediaUrls(v, publicBase, seen))
    const out = {}
    for (const [k, child] of Object.entries(value)) {
        out[k] = rewriteNamakadeMediaUrls(child, publicBase, seen)
    }
    return out
}

export function decodeMediaProxyToken(token) {
    try {
        const b64 = String(token || '').replace(/-/g, '+').replace(/_/g, '/')
        const pad = (4 - (b64.length % 4)) % 4
        const url = Buffer.from(b64 + '='.repeat(pad), 'base64').toString('utf8')
        const u = new URL(url)
        if (!NAMAKADE_MEDIA_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) {
            return null
        }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
        return u.href
    } catch {
        return null
    }
}

function withPosterProxy(meta, publicBase) {
    if (!meta || !publicBase) return meta
    return rewriteNamakadeMediaUrls(meta, publicBase)
}

async function loadExclusionSlugs(base, httpClient) {
    const blocked = new Set()
    for (const cat of ['TURKISH+SERIES', 'FOREIGN', 'TURKISH%20SERIES']) {
        try {
            const html = await fetchHtml(base + '/series/category/' + cat, httpClient, 10_000)
            const re = /href=["'][^"']*\/series\/([^"'/?#]+)["']/gi
            let m
            while ((m = re.exec(html))) blocked.add(m[1].toLowerCase())
        } catch {
            /* ignore */
        }
    }
    return blocked
}

export async function namakadeListCatalog(catalogId, search, env, httpClient, publicBase = null) {
    const base = namakadeBase(env)
    const q = String(search || '').trim()
    const id = String(catalogId || '')

    if (q) {
        const url = base + '/search?page=livesearch&searchField=' + encodeURIComponent(q)
        const html = await fetchHtml(url, httpClient)
        const cards = extractCards(
            html,
            /href=["']((?:https?:\/\/[^"']+)?\/(?:series|shows|iran-1-movies|livetv)[^"']+)["']/gi,
        )
        const metas = []
        for (const c of cards) {
            let path = c.href.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/serieses\//, '/series/')
            if (!isIranianContent(path, c.title)) continue
            if (/\/series\//i.test(path) && id.includes('series')) {
                metas.push({
                    id: encodeNamakadeId('series', path),
                    type: 'series',
                    name: c.title || titleFromSlug(slugFromPath(path)),
                    poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                    posterShape: 'poster',
                })
            } else if (/\/shows?\//i.test(path) && id.includes('series')) {
                metas.push({
                    id: encodeNamakadeId('show', path),
                    type: 'series',
                    name: c.title || titleFromSlug(slugFromPath(path)),
                    poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                    posterShape: 'poster',
                })
            } else if (isIranianMoviePath(path) && id.includes('movie')) {
                metas.push({
                    id: encodeNamakadeId('movie', path),
                    type: 'movie',
                    name: c.title || titleFromSlug(slugFromPath(path)),
                    poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                    posterShape: 'poster',
                })
            } else if (/livetv|\/live/i.test(path) && id.includes('live')) {
                metas.push({
                    id: encodeNamakadeId('live', path),
                    type: 'tv',
                    name: c.title || titleFromSlug(slugFromPath(path)),
                    poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                    posterShape: 'square',
                })
            }
        }
        return {metas}
    }

    if (id.includes('live')) {
        try {
            const html = await fetchHtml(base + '/livetvs', httpClient, 12_000)
            let cards = extractCards(html, /href=["']((?:https?:\/\/[^"']+)?\/(?:livetv|live)[^"'?#]*)["']/gi)
            if (!cards.length) {
                cards = extractCards(html, /href=["']((?:https?:\/\/[^"']+)?\/[^"'?#]*live[^"'?#]*)["']/gi).filter((c) =>
                    /live/i.test(c.href),
                )
            }
            return {
                metas: cards.slice(0, 60).map((c) => {
                    const path = c.href.replace(/^https?:\/\/[^/]+/i, '')
                    return {
                        id: encodeNamakadeId('live', path),
                        type: 'tv',
                        name: c.title || titleFromSlug(slugFromPath(path)),
                        poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                        posterShape: 'square',
                    }
                }),
            }
        } catch {
            return {metas: []}
        }
    }

    if (id.includes('movie')) {
        const html = await fetchHtml(base + '/best-movies', httpClient)
        const cards = extractCards(
            html,
            /href=["']((?:https?:\/\/[^"']+)?\/iran-1-movies\/[^"'?#]+)["']/gi,
        ).filter((c) => isIranianMoviePath(c.href) && isIranianContent(c.href, c.title))
        return {
            metas: cards.map((c) => {
                const path = c.href.replace(/^https?:\/\/[^/]+/i, '')
                return {
                    id: encodeNamakadeId('movie', path),
                    type: 'movie',
                    name: c.title || titleFromSlug(slugFromPath(path)),
                    poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
                    posterShape: 'poster',
                }
            }),
        }
    }

    // series + home shows — one catalog; exclude TURKISH + FOREIGN category members
    const blocked = await loadExclusionSlugs(base, httpClient)
    const seriesHtml = await fetchHtml(base + '/best-serial', httpClient)
    let showHtml = ''
    try {
        showHtml = await fetchHtml(base + '/show', httpClient)
    } catch {
        showHtml = ''
    }

    const seriesCards = extractCards(
        seriesHtml,
        /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'?#]+)["']/gi,
    ).filter((c) => {
        const slug = slugFromPath(c.href).toLowerCase()
        if (blocked.has(slug)) return false
        if (/\/series\/category\//i.test(c.href)) return false
        return isIranianContent(c.href, c.title)
    })

    const showCards = extractCards(
        showHtml,
        /href=["']((?:https?:\/\/[^"']+)?\/shows\/[^"'?#]+)["']/gi,
    ).filter((c) => !/\/shows\/category\//i.test(c.href) && isIranianContent(c.href, c.title))

    const metas = []
    for (const c of seriesCards) {
        const path = c.href.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/serieses\//, '/series/')
        metas.push({
            id: encodeNamakadeId('series', path),
            type: 'series',
            name: c.title || titleFromSlug(slugFromPath(path)),
            poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
            posterShape: 'poster',
        })
    }
    for (const c of showCards) {
        const path = c.href.replace(/^https?:\/\/[^/]+/i, '')
        metas.push({
            id: encodeNamakadeId('show', path),
            type: 'series',
            name: c.title || titleFromSlug(slugFromPath(path)),
            poster: proxyNamakadeMediaUrl(c.poster, publicBase) || c.poster || undefined,
            posterShape: 'poster',
        })
    }
    return {metas}
}

function extractMp4s(html) {
    const urls = []
    const seen = new Set()
    const push = (u) => {
        const x = decodeEntities(u).split('#')[0]
        if (!x || seen.has(x)) return
        if (!/\.(mp4|m3u8)(\?|$)/i.test(x)) return
        seen.add(x)
        urls.push(x)
    }
    const htmlS = String(html || '')
    let m
    const reAttr = /(?:videosrc|src)=["'](https?:\/\/[^"']+\.(?:mp4|m3u8)[^"']*)["']/gi
    while ((m = reAttr.exec(htmlS))) push(m[1])
    const reBare = /https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*/gi
    while ((m = reBare.exec(htmlS))) push(m[0])
    return urls
}

function extractEpisodes(html) {
    const eps = []
    const seen = new Set()
    const blob = String(html || '')
    const re =
        /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"']+\/episodes\/[^"'?#]+)["'][^>]*>[\s\S]{0,220}?src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi
    let m
    while ((m = re.exec(blob))) {
        const href = decodeEntities(m[1]).replace(/^https?:\/\/[^/]+/i, '')
        if (seen.has(href)) continue
        seen.add(href)
        const thumb = decodeEntities(m[2])
        const thumbName = (thumb.split('/').pop() || '').replace(/\.[a-z]+$/i, '')
        const se = thumbName.match(/S(\d+)_?E(\d+)/i)
        let season = 1
        let episode = eps.length + 1
        if (se) {
            season = Number(se[1]) || 1
            episode = Number(se[2]) || episode
        }
        eps.push({
            href,
            thumbnail: thumb,
            season,
            episode,
            name: 'قسمت ' + episode,
            nameEn: 'Episode ' + episode,
        })
        if (eps.length >= 200) break
    }
    if (!eps.length) {
        const re2 = /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"']+\/episodes\/[^"'?#]+)["']/gi
        while ((m = re2.exec(blob))) {
            const href = decodeEntities(m[1]).replace(/^https?:\/\/[^/]+/i, '')
            if (seen.has(href)) continue
            seen.add(href)
            const n = eps.length + 1
            eps.push({href, thumbnail: null, season: 1, episode: n, name: 'قسمت ' + n, nameEn: 'Episode ' + n})
            if (eps.length >= 80) break
        }
    }
    return eps
}

function extractTitle(html, fallback) {
    const og =
        String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || String(html || '').match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
        || String(html || '').match(/<title>([^<]+)</i)
    if (og) {
        return decodeEntities(og[1])
            .replace(/\s*[|\-–].*Negahestan.*$/i, '')
            .replace(/\s*[|\-–].*namakade.*$/i, '')
            .trim()
    }
    return fallback
}

function extractPoster(html) {
    const m =
        String(html || '').match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || String(html || '').match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return m ? decodeEntities(m[1]) : null
}

function extractGenreBlob(html) {
    const m = String(html || '').match(/Genre:\s*([^<\n]{2,80})/i)
    return m ? decodeEntities(m[1]).trim() : ''
}

export async function namakadeGetMeta(id, env, httpClient, publicBase = null, lang = 'fa') {
    const parsed = parseNamakadeId(id)
    if (!parsed) return null
    const base = namakadeBase(env)
    const fa = String(lang || 'fa').toLowerCase() !== 'en'
    let path = parsed.path.startsWith('/') ? parsed.path : '/' + parsed.path
    path = path.replace(/^\/serieses\//, '/series/')

    if (parsed.kind === 'live') {
        return {
            meta: withPosterProxy(
                {
                    id,
                    type: 'tv',
                    name: titleFromSlug(slugFromPath(path)),
                    description: fa ? 'نمکده — پخش زنده' : 'Namakade — Live TV',
                },
                publicBase,
            ),
        }
    }

    if (parsed.kind === 'episode' || parsed.kind === 'movie') {
        if (parsed.kind === 'movie' && !isIranianMoviePath(path) && !isIranianContent(path)) {
            return {meta: null}
        }
        const html = await fetchHtml(base + path, httpClient)
        const genre = extractGenreBlob(html)
        if (genre && /foreign|turkish/i.test(genre) && parsed.kind === 'movie') return {meta: null}
        const name = extractTitle(html, titleFromSlug(slugFromPath(path)))
        const poster = extractPoster(html)
        return {
            meta: withPosterProxy(
                {
                    id,
                    type: 'movie',
                    name,
                    poster: poster || undefined,
                    background: poster || undefined,
                    description: fa
                        ? parsed.kind === 'movie'
                            ? 'نمکده — فیلم ایرانی'
                            : 'نمکده'
                        : parsed.kind === 'movie'
                          ? 'Namakade — Iranian movie'
                          : 'Namakade',
                    genres: genre
                        ? genre
                              .split(/[-,|،]/)
                              .map((x) => x.trim())
                              .filter(Boolean)
                        : undefined,
                },
                publicBase,
            ),
        }
    }

    if (parsed.kind === 'show') {
        path = path.replace(/^\/show\//, '/shows/')
        if (!path.startsWith('/shows/')) path = '/shows/' + slugFromPath(path)
    } else if (!path.startsWith('/series/')) {
        path = '/series/' + slugFromPath(path)
    }

    const html = await fetchHtml(base + path, httpClient)
    const genre = extractGenreBlob(html)
    if (genre && /turkish|foreign/i.test(genre) && parsed.kind !== 'show') return {meta: null}
    const name = extractTitle(html, titleFromSlug(slugFromPath(path)))
    const poster = extractPoster(html)
    const episodes = extractEpisodes(html)
    const videos = episodes.map((ep, i) => ({
        id: encodeNamakadeId('episode', ep.href),
        title: fa ? ep.name || 'قسمت ' + (ep.episode || i + 1) : ep.nameEn || 'Episode ' + (ep.episode || i + 1),
        season: ep.season || 1,
        episode: ep.episode || i + 1,
        thumbnail: ep.thumbnail
            ? proxyNamakadeMediaUrl(ep.thumbnail, publicBase) || ep.thumbnail
            : poster || undefined,
        available: true,
    }))

    return {
        meta: withPosterProxy(
            {
                id,
                type: 'series',
                name,
                poster: poster || undefined,
                background: poster || undefined,
                description: fa
                    ? parsed.kind === 'show'
                        ? 'نمکده — نمایش خانگی'
                        : 'نمکده — سریال ایرانی'
                    : parsed.kind === 'show'
                      ? 'Namakade — Home show'
                      : 'Namakade — Iranian series',
                genres: genre
                    ? genre
                          .split(/[-,|،]/)
                          .map((x) => x.trim())
                          .filter(Boolean)
                    : undefined,
                videos: videos.length ? videos : undefined,
            },
            publicBase,
        ),
    }
}

export async function namakadeGetStreams(id, env, httpClient) {
    const parsed = parseNamakadeId(id)
    if (!parsed) return {streams: []}
    if (parsed.kind === 'series' || parsed.kind === 'show') return {streams: []}

    const base = namakadeBase(env)
    let path = parsed.path.startsWith('/') ? parsed.path : '/' + parsed.path
    path = path.replace(/^\/serieses\//, '/series/')

    const html = await fetchHtml(base + path, httpClient)
    const mp4s = extractMp4s(html)
    return {
        streams: mp4s.map((url, i) => ({
            name: i === 0 ? 'نمکده' : 'نمکده ' + (i + 1),
            title: 'نمکده\n' + (/\.m3u8/i.test(url) ? 'HLS' : 'MP4'),
            url,
            behaviorHints: {bingeGroup: 'namakade', notWebReady: false},
        })),
    }
}

/** Exactly 3 catalogs — FA/EN. */
export function namakadeManifestCatalogs(env, lang = 'fa') {
    if (!isNamakadeEnabled(env)) return []
    const fa = String(lang || 'fa').toLowerCase() !== 'en'
    return [
        {
            id: 'namakade_series',
            type: 'series',
            name: fa ? 'نمکده — سریال و نمایش' : 'Namakade — Series & shows',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_movies',
            type: 'movie',
            name: fa ? 'نمکده — فیلم ایرانی' : 'Namakade — Iranian movies',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_live',
            type: 'tv',
            name: fa ? 'نمکده — پخش زنده' : 'Namakade — Live TV',
            extra: [{name: 'search', isRequired: false}],
        },
    ]
}
