import axios from 'axios'

export const REQUEST_TIMEOUT_MS = 15_000

export function logAxiosError(error, logger = console, context = 'HTTP request failed') {
    const details = axios.isAxiosError(error)
        ? {
            message: error.message,
            code: error.code,
            status: error.response?.status,
        }
        : {message: error?.message ?? String(error)}

    logger.error(context, details)
}

export async function getCinemeta(type, imdbId, httpClient = axios) {
    if (!imdbId) {
        return null
    }

    try {
        const response = await httpClient.get(
            `https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(imdbId)}.json`,
            {timeout: REQUEST_TIMEOUT_MS},
        )
        return response.data ?? null
    } catch (error) {
        logAxiosError(error, console, 'Unable to get Cinemeta metadata')
        return null
    }
}

export async function searchAndGetTMDB(
    title,
    type,
    httpClient = axios,
    logger = console,
    apiKey = process.env.TMDB_API_KEY,
) {
    if (!apiKey || !title) {
        logger.warn('TMDB_API_KEY is required to resolve IMDb IDs')
        return null
    }

    try {
        const searchResponse = await httpClient.get('https://api.themoviedb.org/3/search/multi', {
            params: {api_key: apiKey, query: title},
            timeout: REQUEST_TIMEOUT_MS,
        })
        const expectedMediaType = type === 'series' ? 'tv' : type
        const results = Array.isArray(searchResponse.data?.results) ? searchResponse.data.results : []
        const item = results.find((result) => result.media_type === expectedMediaType)
        if (!item?.id || !['movie', 'tv'].includes(item.media_type)) {
            return null
        }

        const detailsResponse = await httpClient.get(
            `https://api.themoviedb.org/3/${item.media_type}/${item.id}`,
            {
                params: {api_key: apiKey, append_to_response: 'external_ids'},
                timeout: REQUEST_TIMEOUT_MS,
            },
        )
        return detailsResponse.data ?? null
    } catch (error) {
        logAxiosError(error, logger, 'Unable to resolve IMDb ID through TMDB')
        return null
    }
}

export async function getSubtitle(type, imdbId, httpClient = axios) {
    if (!imdbId) {
        return {subtitles: []}
    }

    try {
        const response = await httpClient.get(
            `https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(imdbId)}.json`,
            {timeout: REQUEST_TIMEOUT_MS},
        )
        return response.data ?? {subtitles: []}
    } catch (error) {
        logAxiosError(error, console, 'Unable to get subtitles')
        return {subtitles: []}
    }
}

const TMDB_GENRE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000 // 24h
const tmdbGenreCache = new Map() // `${type}` -> {timestamp, genres: Map(id -> name)}

async function getTMDBGenreMap(type, httpClient, apiKey, logger) {
    const cached = tmdbGenreCache.get(type)
    if (cached && Date.now() - cached.timestamp < TMDB_GENRE_CACHE_TTL_MS) {
        return cached.genres
    }
    try {
        const response = await httpClient.get(
            `https://api.themoviedb.org/3/genre/${type === 'series' ? 'tv' : 'movie'}/list`,
            {params: {api_key: apiKey, language: 'fa-IR'}, timeout: REQUEST_TIMEOUT_MS},
        )
        const genres = new Map((response.data?.genres ?? []).map((g) => [g.id, g.name]))
        tmdbGenreCache.set(type, {timestamp: Date.now(), genres})
        return genres
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get TMDB genre list')
        return cached?.genres ?? new Map()
    }
}

/**
 * Persian (fa-IR) metadata for a piece of IMDb-id'd content — poster,
 * backdrop, overview, and genre names all localized via TMDB, so Iranian
 * posters/covers and Persian descriptions show up in the catalog instead of
 * the English Cinemeta defaults. Requires TMDB_API_KEY; returns null (so the
 * caller can fall back to Cinemeta) if unavailable or nothing is found.
 */
export async function getTMDBMetaFa(type, imdbId, httpClient = axios, apiKey, logger = console) {
    if (!apiKey || !imdbId) {
        return null
    }

    try {
        const findResponse = await httpClient.get(
            `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}`,
            {
                params: {api_key: apiKey, external_source: 'imdb_id', language: 'fa-IR'},
                timeout: REQUEST_TIMEOUT_MS,
            },
        )
        const resultsKey = type === 'series' ? 'tv_results' : 'movie_results'
        const item = findResponse.data?.[resultsKey]?.[0]
        if (!item) {
            return null
        }

        const genreMap = await getTMDBGenreMap(type, httpClient, apiKey, logger)
        const genres = (item.genre_ids ?? []).map((id) => genreMap.get(id)).filter(Boolean)
        const year = (item.release_date || item.first_air_date || '').slice(0, 4) || null

        return {
            id: imdbId,
            type,
            name: item.title || item.name || null,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
            description: item.overview || null,
            releaseInfo: year,
            imdbRating: item.vote_average ? String(Math.round(item.vote_average * 10) / 10) : null,
            genres: genres.length ? genres : undefined,
        }
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get TMDB Persian metadata')
        return null
    }
}

export const PROVIDER_LABELS = {
    f2media: 'F2Media',
    peepboxtv: 'PeepBoxTv',
    cinamatic: 'Cinamatic',
    aslmoviez: 'AslMoviez',
    serialblog: 'SerialBlog',
    digimovie: 'Digimoviez',
    avamovie: 'AvaMovie',
    zardfilm: 'ZardFilm',
}

// Whether each provider is known to censor content (based on the site's own
// stated policy / observed behaviour). Update this as new providers are
// checked. Anything not listed defaults to "uncensored" (unknown === assumed
// fine) — flip a provider to `true` as soon as it's confirmed to censor.
const PROVIDER_CENSORED = {
    zardfilm: true,
}

const PROVIDER_EMOJI = {
    f2media: '📀',
    peepboxtv: '📦',
    cinamatic: '🎞️',
    aslmoviez: '🎬',
    serialblog: '📺',
    digimovie: '🎥',
    avamovie: '🍿',
}

const RESOLUTION_PATTERNS = [
    {re: /2160p|\b4k\b|uhd/i, label: '4K 2160p'},
    {re: /1080p/i, label: '1080p'},
    {re: /720p/i, label: '720p'},
    {re: /576p/i, label: '576p'},
    {re: /480p/i, label: '480p'},
    {re: /360p/i, label: '360p'},
]

function detectResolution(text) {
    for (const {re, label} of RESOLUTION_PATTERNS) {
        if (re.test(text)) {
            return label
        }
    }
    return null
}

function detectExtras(text) {
    const extras = []
    if (/hdr10\+/i.test(text)) {
        extras.push('HDR10+')
    } else if (/hdr10/i.test(text)) {
        extras.push('HDR10')
    } else if (/\bhdr\b/i.test(text)) {
        extras.push('HDR')
    }
    if (/10\s?bit/i.test(text)) {
        extras.push('10bit')
    }
    if (/dolby\s?vision|\bdv\b/i.test(text)) {
        extras.push('Dolby Vision')
    }
    return extras
}

function detectSource(text) {
    if (/blu-?ray|bdrip|brrip/i.test(text)) {
        return 'BluRay'
    }
    if (/web-?dl/i.test(text)) {
        return 'WEB-DL'
    }
    if (/webrip/i.test(text)) {
        return 'WEBRip'
    }
    if (/hdrip/i.test(text)) {
        return 'HDRip'
    }
    if (/hdtv/i.test(text)) {
        return 'HDTV'
    }
    if (/dvdrip/i.test(text)) {
        return 'DVDRip'
    }
    if (/camrip|hdcam|\bcam\b/i.test(text)) {
        return 'CAM'
    }
    return null
}

function detectCodec(text) {
    if (/x265|hevc|h\.?265/i.test(text)) {
        return 'x265/HEVC'
    }
    if (/x264|h\.?264|avc/i.test(text)) {
        return 'x264'
    }
    return null
}

function detectAudio(text, audioTypeHint) {
    const hasDub = /دوبله/i.test(text) || /\bdub(bed)?\b/i.test(text)
    const hasSub = /زیرنویس/i.test(text) || /\bsub(bed|title)?\b/i.test(text)
    const isDual = /dual\s?audio/i.test(text) || (hasDub && hasSub)

    if (audioTypeHint === 'dubbed' || (hasDub && !isDual)) {
        return '🗣️ صدا: دوبله فارسی'
    }
    if (audioTypeHint === 'subtitled' || (hasSub && !isDual)) {
        return '💬 زیرنویس: فارسی'
    }
    if (isDual) {
        return '🗣️💬 صدا: دوبله + زیرنویس فارسی'
    }
    return null
}

/**
 * Builds a rich, multi-line, emoji-annotated stream title (Torrentio-style)
 * from whatever quality/size/audio info a provider already extracted, falling
 * back to regex detection over the raw text for anything missing.
 */
// Wraps LTR content (English/numbers) with Unicode directional isolate marks
// so it renders correctly when embedded inside RTL Persian text.
const LRI = '\u2066' // Left-to-Right Isolate
const PDI = '\u2069' // Pop Directional Isolate

function ltr(text) {
    return text ? `${LRI}${text}${PDI}` : text
}

export function formatStreamTitle({providerKey, quality, size, audioType, extraText} = {}) {
    const providerLabel = PROVIDER_LABELS[providerKey] || providerKey || 'Unknown'
    const emoji = PROVIDER_EMOJI[providerKey] || '📡'
    const combinedText = [quality, extraText].filter(Boolean).join(' ')

    const resolution = detectResolution(combinedText)
    const extras = detectExtras(combinedText)
    const source = detectSource(combinedText)
    const codec = detectCodec(combinedText)
    const audio = detectAudio(combinedText, audioType)

    const qualityLine = [resolution, ...extras, source, codec].filter(Boolean).join(' • ')
    const isCensored = PROVIDER_CENSORED[providerKey] === true
    const statusLine = isCensored ? '⚠️ وضعیت: سانسور شده' : '✅ وضعیت: سانسور نشده'

    const lines = [
        `${emoji} منبع: ${ltr(providerLabel)}`,
        qualityLine ? `🎞️ کیفیت: ${ltr(qualityLine)}` : null,
        audio,
        size ? `💾 حجم: ${ltr(size)}` : null,
        statusLine,
    ].filter(Boolean)

    return lines.length ? lines.join('\n') : (extraText || providerLabel)
}

// ---------------------------------------------------------------------------
// External catalog aggregation (e.g. 101Catalogs)
//
// Merges another Stremio addon's catalog list into ours and transparently
// proxies catalog requests to it. These catalogs return standard IMDb
// ("tt"-prefixed) ids, so our existing IMDb-based stream lookup
// (imdbStreamResponse / the main-page flow) already handles playback for
// them automatically — nothing else needs to change for streams to work.
// ---------------------------------------------------------------------------

const EXTERNAL_CATALOGS_TTL_MS = 60 * 60 * 1_000 // 1 hour
let externalCatalogsCache = null // {timestamp, sources}

function externalManifestUrls(env) {
    return [env.CATALOG101_MANIFEST_URL, env.CATALOG_ANIME_MANIFEST_URL].filter(Boolean)
}

export async function getExternalCatalogSources(env = {}, httpClient = axios, logger = console) {
    const manifestUrls = externalManifestUrls(env)
    if (!manifestUrls.length) {
        return []
    }

    const now = Date.now()
    if (externalCatalogsCache && now - externalCatalogsCache.timestamp < EXTERNAL_CATALOGS_TTL_MS) {
        return externalCatalogsCache.sources
    }

    const sources = []
    for (const manifestUrl of manifestUrls) {
        try {
            const response = await httpClient.get(manifestUrl, {timeout: REQUEST_TIMEOUT_MS})
            const manifest = response.data ?? {}
            const baseUrl = manifestUrl.replace(/\/manifest\.json.*$/, '')
            const catalogs = Array.isArray(manifest.catalogs) ? manifest.catalogs : []
            const metaResource = (manifest.resources ?? []).find((r) => (
                r === 'meta' || r?.name === 'meta'
            ))
            sources.push({
                baseUrl,
                catalogIds: new Set(catalogs.map((catalog) => catalog.id)),
                catalogs,
                idPrefixes: manifest.idPrefixes ?? [],
                hasMeta: Boolean(metaResource),
            })
        } catch (error) {
            logAxiosError(error, logger, `External catalog manifest fetch failed (${manifestUrl})`)
        }
    }

    if (sources.length) {
        externalCatalogsCache = {timestamp: now, sources}
        return sources
    }
    return externalCatalogsCache?.sources ?? []
}

export async function proxyExternalCatalog(source, type, id, extraPath, httpClient = axios, logger = console) {
    const suffix = extraPath ? `/${extraPath}` : ''
    const url = `${source.baseUrl}/catalog/${type}/${id}${suffix}.json`
    try {
        const response = await httpClient.get(url, {timeout: REQUEST_TIMEOUT_MS})
        return response.data ?? {metas: []}
    } catch (error) {
        logAxiosError(error, logger, 'External catalog proxy failed')
        return {metas: []}
    }
}

// For external sources whose items use a non-IMDb id (e.g. Anime Catalogs'
// "kitsu:" ids), Cinemeta has no entry, so we pass the meta request straight
// through to that addon's own /meta endpoint instead.
export function findExternalMetaSource(sources, id) {
    return sources.find((source) => (
        source.hasMeta && source.idPrefixes.some((prefix) => id.startsWith(prefix))
    ))
}

export async function proxyExternalMeta(source, type, id, httpClient = axios, logger = console) {
    const url = `${source.baseUrl}/meta/${type}/${id}.json`
    try {
        const response = await httpClient.get(url, {timeout: REQUEST_TIMEOUT_MS})
        return response.data ?? {}
    } catch (error) {
        logAxiosError(error, logger, 'External meta proxy failed')
        return {}
    }
}

export function modifyUrls(value, prepend, seen = new WeakSet()) {
    if (typeof value !== 'object' || value === null) {
        return value
    }
    if (seen.has(value)) {
        return value
    }
    seen.add(value)

    const result = Array.isArray(value) ? [] : {}
    for (const [key, child] of Object.entries(value)) {
        if (typeof child === 'string' && /^https?:\/\//i.test(child)) {
            result[key] = `${prepend}${encodeURIComponent(child)}`
        } else {
            result[key] = modifyUrls(child, prepend, seen)
        }
    }
    return result
}
