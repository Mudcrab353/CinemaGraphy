/**
 * نماکده (Namakade / Negahestan)
 * Only active when ENABLE_NAMAKADE=1 (BASEURL alone does NOT enable — keeps default manifest clean).
 * Domain via NAMAKADE_BASEURL (default https://namakade.com).
 */

export const NAMAKADE_PREFIX = 'namakade:'
export const DEFAULT_NAMAKADE_BASEURL = 'https://namakade.com'

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const NAMAKADE_MEDIA_HOSTS = [
    'media.negahestan.com',
    'media.iranproud2.net',
    'media.iranproud.com',
    'namakade.com',
    'www.namakade.com',
    'mobile.namakade.com',
]

const listCache = new Map()
const LIST_TTL_MS = 5 * 60 * 1000

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Strict: only ENABLE_NAMAKADE — never auto-enable from BASEURL alone. */
export function isNamakadeEnabled(env = {}) {
    return flagOn(env.ENABLE_NAMAKADE)
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

async function fetchHtml(url, httpClient, timeout = 10_000) {
    if (httpClient && typeof httpClient.get === 'function') {
        try {
            const res = await httpClient.get(url, {
                timeout,
                maxRedirects: 8,
                headers: {
                    'User-Agent': UA,
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.6',
                    Referer: namakadeBase({}) + '/',
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
                'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.6',
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
        // skip pure category index links without slug
        if (/\/category\/?$/i.test(href) || /\/category\/[^/]+\/?$/i.test(href) && !/\/(series|shows|iran-1-movies)\//i.test(href)) {
            // category pages themselves are not items — skip if path ends at category name only
        }
        if (/\/(series|shows)\/category\//i.test(href)) continue
        seen.add(href)

        const before = blob.slice(Math.max(0, m.index - 400), m.index)
        const after = blob.slice(m.index, m.index + 500)
        const window = before + after
        let poster = null
        const imgs = [...window.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)]
        for (const im of imgs) {
            const u = decodeEntities(im[1])
            if (/logo|icon|banner|ad\.|adspeed|facebook|favicon/i.test(u)) continue
            if (/media\.(negahestan|iranproud)/i.test(u) || /thumb|poster|series|movies|shows/i.test(u)) {
                poster = u
                break
            }
        }
        if (!poster && imgs.length) {
            const u = decodeEntities(imgs[imgs.length - 1][1])
            if (!/logo|icon|ad\./i.test(u)) poster = u
        }

        let title = ''
        const alt = window.match(/alt=["']([^"']{2,120})["']/i)
        const txt = window.match(
            /<(?:div|span|p|h\d)[^>]*class=["'][^"']*(?:Titr|title|name|Txt|Caption|searchTxt)[^"']*["'][^>]*>([^<]{2,120})</i,
        )
        if (alt && alt[1].length > 1 && !/^image$/i.test(alt[1])) title = alt[1]
        else if (txt) title = txt[1]
        else {
            const slug = href.split('?')[0].split('/').filter(Boolean).pop() || ''
            title = slug.replace(/[-_+]+/g, ' ')
        }
        title = decodeEntities(title).replace(/\s+/g, ' ').trim()
        out.push({href, title, poster})
        if (out.length >= 120) break
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
    let path
    try {
        const b64 = m[2].replace(/-/g, '+').replace(/_/g, '/')
        const pad = (4 - (b64.length % 4)) % 4
        path = Buffer.from(b64 + '='.repeat(pad), 'base64').toString('utf8')
    } catch {
        path = decodeURIComponent(m[2])
    }
    return {kind: m[1].toLowerCase(), path}
}

export function proxyNamakadeMediaUrl(url, publicBase) {
    // Prefer direct CDN — works without VPN for most users; proxy only if PUBLIC forces it
    if (!url) return url
    return url
}

export function decodeMediaProxyToken(token) {
    try {
        const b64 = String(token || '').replace(/-/g, '+').replace(/_/g, '/')
        const pad = (4 - (b64.length % 4)) % 4
        const url = Buffer.from(b64 + '='.repeat(pad), 'base64').toString('utf8')
        const u = new URL(url)
        if (!NAMAKADE_MEDIA_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return null
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
        return u.href
    } catch {
        return null
    }
}

function cacheGet(key) {
    const hit = listCache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > LIST_TTL_MS) {
        listCache.delete(key)
        return null
    }
    return hit.data
}
function cacheSet(key, data) {
    listCache.set(key, {at: Date.now(), data})
    if (listCache.size > 40) {
        const first = listCache.keys().next().value
        listCache.delete(first)
    }
}

function toMeta(card, kind, type, publicBase) {
    let path = card.href.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/serieses\//, '/series/')
    return {
        id: encodeNamakadeId(kind, path),
        type,
        name: card.title || titleFromSlug(slugFromPath(path)),
        poster: card.poster || undefined,
        posterShape: type === 'tv' ? 'square' : 'poster',
    }
}

async function listFromPath(base, listPath, linkRe, kind, type, httpClient) {
    const html = await fetchHtml(base + listPath, httpClient, 10_000)
    return extractCards(html, linkRe).map((c) => toMeta(c, kind, type, null))
}

export async function namakadeListCatalog(catalogId, search, env, httpClient, publicBase = null) {
    const base = namakadeBase(env)
    const q = String(search || '').trim()
    const id = String(catalogId || '')
    const cacheKey = base + '|' + id + '|' + q
    const cached = cacheGet(cacheKey)
    if (cached) return cached

    if (q) {
        const url = base + '/search?page=livesearch&searchField=' + encodeURIComponent(q)
        const html = await fetchHtml(url, httpClient, 8_000)
        const cards = extractCards(
            html,
            /href=["']((?:https?:\/\/[^"']+)?\/(?:series|shows|iran-1-movies|livetv)[^"']+)["']/gi,
        )
        const metas = []
        for (const c of cards) {
            const path = c.href.replace(/^https?:\/\/[^/]+/i, '')
            if (/\/series\//i.test(path) && id.includes('series') && !id.includes('turkish') && !id.includes('foreign')) {
                metas.push(toMeta(c, 'series', 'series'))
            } else if (/\/shows?\//i.test(path) && (id.includes('show') || id.includes('series'))) {
                metas.push(toMeta(c, 'show', 'series'))
            } else if (/\/iran-1-movies\//i.test(path) && id.includes('movie')) {
                metas.push(toMeta(c, 'movie', 'movie'))
            } else if (/livetv|\/live/i.test(path) && id.includes('live')) {
                metas.push(toMeta(c, 'live', 'tv'))
            }
        }
        const out = {metas}
        cacheSet(cacheKey, out)
        return out
    }

    let metas = []
    try {
        if (id.includes('live')) {
            try {
                metas = await listFromPath(
                    base,
                    '/livetvs',
                    /href=["']((?:https?:\/\/[^"']+)?\/(?:livetv|live)[^"'?#]*)["']/gi,
                    'live',
                    'tv',
                    httpClient,
                )
            } catch {
                metas = []
            }
        } else if (id.includes('turkish')) {
            metas = await listFromPath(
                base,
                '/series/category/TURKISH+SERIES',
                /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'?#]+)["']/gi,
                'series',
                'series',
                httpClient,
            )
        } else if (id.includes('foreign') && id.includes('series')) {
            metas = await listFromPath(
                base,
                '/series/category/FOREIGN',
                /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'?#]+)["']/gi,
                'series',
                'series',
                httpClient,
            )
        } else if (id.includes('movie') && id.includes('foreign')) {
            const all = await listFromPath(
                base,
                '/best-movies',
                /href=["']((?:https?:\/\/[^"']+)?\/iran-1-movies\/[^"'?#]+)["']/gi,
                'movie',
                'movie',
                httpClient,
            )
            metas = all.filter((m) => /foreign/i.test(m.id) || /foreign/i.test(m.name))
            // decode path from id for filter — encode is base64; check name/path via parse
            metas = all.filter((m) => {
                try {
                    const p = parseNamakadeId(m.id)
                    return p && /foreign/i.test(p.path)
                } catch {
                    return false
                }
            })
        } else if (id.includes('movie')) {
            // all movies (IR + foreign + etc.)
            metas = await listFromPath(
                base,
                '/best-movies',
                /href=["']((?:https?:\/\/[^"']+)?\/iran-1-movies\/[^"'?#]+)["']/gi,
                'movie',
                'movie',
                httpClient,
            )
        } else if (id.includes('show')) {
            metas = await listFromPath(
                base,
                '/show',
                /href=["']((?:https?:\/\/[^"']+)?\/shows\/[^"'?#]+)["']/gi,
                'show',
                'series',
                httpClient,
            )
        } else {
            // main series catalog — parallel with shows optional merge only on series id without show
            const series = await listFromPath(
                base,
                '/best-serial',
                /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'?#]+)["']/gi,
                'series',
                'series',
                httpClient,
            )
            metas = series
        }
    } catch (e) {
        metas = []
    }

    const out = {metas}
    cacheSet(cacheKey, out)
    return out
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

function guessQualityFromUrl(url) {
    const s = String(url || '').toLowerCase()
    if (/2160|4k|uhd/i.test(s)) return '4K'
    if (/1080/i.test(s)) return '1080p'
    if (/720/i.test(s)) return '720p'
    if (/480/i.test(s)) return '480p'
    if (/360/i.test(s)) return '360p'
    return null
}

function extractEpisodes(html) {
    const eps = []
    const seen = new Set()
    const blob = String(html || '')
    const re =
        /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"']+\/episodes\/[^"'?#]+)["'][^>]*>[\s\S]{0,280}?src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi
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

function extractDescription(html) {
    const m =
        String(html || '').match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
        || String(html || '').match(/name=["']description["'][^>]+content=["']([^"']+)["']/i)
    return m ? decodeEntities(m[1]).trim() : null
}

function extractGenreBlob(html) {
    const m = String(html || '').match(/Genre:\s*([^<\n]{2,100})/i)
    return m ? decodeEntities(m[1]).trim() : ''
}

/** Optional TMDB poster/description by title when site meta is thin. */
async function enrichFromTmdb(name, type, env, httpClient, logger) {
    const key = String(env.TMDB_API_KEY || '').trim()
    if (!key || !name || !httpClient) return null
    try {
        const qType = type === 'movie' ? 'movie' : 'tv'
        const res = await httpClient.get(`https://api.themoviedb.org/3/search/${qType}`, {
            params: {api_key: key, query: name, language: 'fa-IR'},
            timeout: 6_000,
        })
        const hit = res.data?.results?.[0]
        if (!hit) {
            const res2 = await httpClient.get(`https://api.themoviedb.org/3/search/${qType}`, {
                params: {api_key: key, query: name, language: 'en-US'},
                timeout: 6_000,
            })
            const hit2 = res2.data?.results?.[0]
            if (!hit2) return null
            return {
                poster: hit2.poster_path ? `https://image.tmdb.org/t/p/w500${hit2.poster_path}` : null,
                background: hit2.backdrop_path ? `https://image.tmdb.org/t/p/w1280${hit2.backdrop_path}` : null,
                description: hit2.overview || null,
                imdbHint: null,
                tmdbId: hit2.id,
            }
        }
        return {
            poster: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null,
            background: hit.backdrop_path ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}` : null,
            description: hit.overview || null,
            tmdbId: hit.id,
        }
    } catch (e) {
        logger?.debug?.({err: e?.message}, 'namakade tmdb enrich failed')
        return null
    }
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
            meta: {
                id,
                type: 'tv',
                name: titleFromSlug(slugFromPath(path)),
                description: fa ? 'نماکده — پخش زنده' : 'Namakade — Live TV',
            },
        }
    }

    if (parsed.kind === 'episode' || parsed.kind === 'movie') {
        const html = await fetchHtml(base + path, httpClient)
        const name = extractTitle(html, titleFromSlug(slugFromPath(path)))
        let poster = extractPoster(html)
        let description = extractDescription(html)
        const genre = extractGenreBlob(html)
        if (!poster || !description) {
            const tmdb = await enrichFromTmdb(name, parsed.kind === 'movie' ? 'movie' : 'series', env, httpClient)
            if (tmdb) {
                poster = poster || tmdb.poster
                description = description || tmdb.description
            }
        }
        return {
            meta: {
                id,
                type: 'movie',
                name,
                poster: poster || undefined,
                background: poster || undefined,
                description:
                    description ||
                    (fa
                        ? parsed.kind === 'movie'
                            ? 'نماکده — فیلم'
                            : 'نماکده'
                        : parsed.kind === 'movie'
                          ? 'Namakade — Movie'
                          : 'Namakade'),
                genres: genre
                    ? genre
                          .split(/[-,|،]/)
                          .map((x) => x.trim())
                          .filter(Boolean)
                    : undefined,
            },
        }
    }

    if (parsed.kind === 'show') {
        path = path.replace(/^\/show\//, '/shows/')
        if (!path.startsWith('/shows/')) path = '/shows/' + slugFromPath(path)
    } else if (!path.startsWith('/series/')) {
        path = '/series/' + slugFromPath(path)
    }

    const html = await fetchHtml(base + path, httpClient)
    const name = extractTitle(html, titleFromSlug(slugFromPath(path)))
    let poster = extractPoster(html)
    let description = extractDescription(html)
    const genre = extractGenreBlob(html)
    if (!poster || !description) {
        const tmdb = await enrichFromTmdb(name, 'series', env, httpClient)
        if (tmdb) {
            poster = poster || tmdb.poster
            description = description || tmdb.description
        }
    }
    const episodes = extractEpisodes(html)
    const videos = episodes.map((ep, i) => ({
        id: encodeNamakadeId('episode', ep.href),
        title: fa ? ep.name || 'قسمت ' + (ep.episode || i + 1) : ep.nameEn || 'Episode ' + (ep.episode || i + 1),
        season: ep.season || 1,
        episode: ep.episode || i + 1,
        thumbnail: ep.thumbnail || poster || undefined,
        available: true,
    }))

    return {
        meta: {
            id,
            type: 'series',
            name,
            poster: poster || undefined,
            background: poster || undefined,
            description:
                description ||
                (fa
                    ? parsed.kind === 'show'
                        ? 'نماکده — نمایش خانگی'
                        : 'نماکده — سریال'
                    : parsed.kind === 'show'
                      ? 'Namakade — Home show'
                      : 'Namakade — Series'),
            genres: genre
                ? genre
                      .split(/[-,|،]/)
                      .map((x) => x.trim())
                      .filter(Boolean)
                : undefined,
            videos: videos.length ? videos : undefined,
        },
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
        streams: mp4s.map((url, i) => {
            const q = guessQualityFromUrl(url)
            const line2 = [q, /\.m3u8/i.test(url) ? 'HLS' : 'MP4'].filter(Boolean).join(' · ')
            return {
                name: q ? `نماکده ${q}` : i === 0 ? 'نماکده' : `نماکده ${i + 1}`,
                title: `نماکده\n${line2}`,
                url,
                behaviorHints: {bingeGroup: 'namakade', notWebReady: false},
            }
        }),
    }
}

/** Catalog set — FA/EN. Only when ENABLE_NAMAKADE=1. */
export function namakadeManifestCatalogs(env, lang = 'fa') {
    if (!isNamakadeEnabled(env)) return []
    const fa = String(lang || 'fa').toLowerCase() !== 'en'
    return [
        {
            id: 'namakade_series',
            type: 'series',
            name: fa ? 'نماکده — سریال' : 'Namakade — Series',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_shows',
            type: 'series',
            name: fa ? 'نماکده — نمایش خانگی' : 'Namakade — Home shows',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_movies',
            type: 'movie',
            name: fa ? 'نماکده — فیلم' : 'Namakade — Movies',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_turkish',
            type: 'series',
            name: fa ? 'نماکده — سریال ترکی' : 'Namakade — Turkish series',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_foreign_series',
            type: 'series',
            name: fa ? 'نماکده — سریال خارجی' : 'Namakade — Foreign series',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_foreign_movies',
            type: 'movie',
            name: fa ? 'نماکده — فیلم خارجی' : 'Namakade — Foreign movies',
            extra: [{name: 'search', isRequired: false}],
        },
        {
            id: 'namakade_live',
            type: 'tv',
            name: fa ? 'نماکده — پخش زنده' : 'Namakade — Live TV',
            extra: [{name: 'search', isRequired: false}],
        },
    ]
}
