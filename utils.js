import axios from 'axios'
import {cleanSize, detectSize} from './size-helpers.js'

export const REQUEST_TIMEOUT_MS = 15_000
export const EXTERNAL_CATALOG_TIMEOUT_MS = 30_000

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

/** True if string contains Persian/Arabic letters. */
export function hasPersianScript(text) {
    return /[\u0600-\u06FF]/.test(String(text || ''))
}

/**
 * Prefer Persian TMDB text; if missing or not localized, use English — never
 * fall back to original_title (Korean/Japanese/etc.) for display names.
 */
export function preferFaThenEn(faVal, enVal) {
    const fa = String(faVal || '').trim()
    const en = String(enVal || '').trim()
    if (fa && hasPersianScript(fa)) return fa
    if (en) return en
    if (fa) return fa
    return null
}

/** Prefer Persian genre labels; if TMDB fa list is still Latin, use English list. */
export function pickFaOrEnGenres(genresFa, genresEn) {
    const fa = (genresFa || []).filter(Boolean)
    const en = (genresEn || []).filter(Boolean)
    if (fa.some((g) => hasPersianScript(g))) return fa
    if (en.length) return en
    return fa.length ? fa : undefined
}


async function fetchTmdbDetailLang(kind, tmdbId, lang, httpClient, apiKey) {
    const response = await httpClient.get(`https://api.themoviedb.org/3/${kind}/${tmdbId}`, {
        params: {
            api_key: apiKey,
            language: lang,
            append_to_response: 'external_ids',
        },
        timeout: REQUEST_TIMEOUT_MS,
    })
    return response.data ?? {}
}

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
        if (!item?.id) {
            return null
        }

        const kind = type === 'series' ? 'tv' : 'movie'
        let detailFa = item
        let detailEn = null
        try {
            const [faRes, enRes] = await Promise.all([
                fetchTmdbDetailLang(kind, item.id, 'fa-IR', httpClient, apiKey),
                fetchTmdbDetailLang(kind, item.id, 'en-US', httpClient, apiKey),
            ])
            if (faRes) detailFa = faRes
            detailEn = enRes
        } catch {
            try {
                detailFa = await fetchTmdbDetailLang(kind, item.id, 'fa-IR', httpClient, apiKey)
            } catch { /* keep find payload */ }
        }

        const genreMap = await getTMDBGenreMap(type, httpClient, apiKey, logger)
        const genresFa = (detailFa.genres ?? []).map((g) => g.name).filter(Boolean)
        const genresEn = (detailEn?.genres ?? []).map((g) => g.name).filter(Boolean)
        const genresFallback = (item.genre_ids ?? []).map((id) => genreMap.get(id)).filter(Boolean)
        const genres = pickFaOrEnGenres(genresFa, genresEn) || (genresFallback.length ? genresFallback : undefined)
        const year = (
            detailFa.release_date || detailFa.first_air_date
            || detailEn?.release_date || detailEn?.first_air_date
            || item.release_date || item.first_air_date || ''
        ).slice(0, 4) || null
        const vote = detailFa.vote_average ?? detailEn?.vote_average ?? item.vote_average

        const name = preferFaThenEn(
            detailFa.title || detailFa.name,
            detailEn?.title || detailEn?.name,
        )
        const description = preferFaThenEn(detailFa.overview, detailEn?.overview)
        const posterPath = detailFa.poster_path || detailEn?.poster_path || item.poster_path
        const backdropPath = detailFa.backdrop_path || detailEn?.backdrop_path || item.backdrop_path

        return {
            id: imdbId,
            type,
            name,
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
            background: backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : null,
            description,
            releaseInfo: year,
            imdbRating: vote ? String(Math.round(vote * 10) / 10) : null,
            genres: genres.length ? genres : undefined,
        }
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get TMDB Persian metadata')
        return null
    }
}

export function extractImdbIdFromMeta(meta, fallbackId = '') {
    if (!meta || typeof meta !== 'object') {
        const m = String(fallbackId || '').match(/^(tt\d+)/)
        return m ? m[1] : null
    }
    for (const key of ['imdb_id', 'imdbId', 'imdb']) {
        const v = meta[key]
        if (typeof v === 'string' && /^tt\d+/.test(v)) return v.split(/[^a-z0-9]/i)[0]
    }
    const id = String(meta.id || fallbackId || '')
    if (/^tt\d+/.test(id)) return id.split(/[^a-z0-9]/i)[0]
    const m = id.match(/(tt\d{5,})/)
    return m ? m[1] : null
}

export async function enrichMetaWithFaTmdb(
    meta,
    type,
    httpClient = axios,
    apiKey,
    logger = console,
    fallbackId = '',
) {
    if (!meta || typeof meta !== 'object' || !apiKey) {
        return meta
    }
    // Skip pure live/tv channel style ids without imdb
    const imdbId = extractImdbIdFromMeta(meta, fallbackId)
    if (!imdbId) {
        return meta
    }
    try {
        const fa = await getTMDBMetaFa(type, imdbId, httpClient, apiKey, logger)
        if (!fa) return meta
        const out = {...meta}
        if (fa.name) out.name = fa.name
        if (fa.description) out.description = fa.description
        if (Array.isArray(fa.genres) && fa.genres.length) out.genres = fa.genres
        if (fa.releaseInfo && !out.releaseInfo) out.releaseInfo = fa.releaseInfo
        if (fa.imdbRating && !out.imdbRating) out.imdbRating = fa.imdbRating
        // Poster: keep RPDB/addon (ratings baked into image). Only fill if missing.
        if (!out.poster && fa.poster) out.poster = fa.poster
        // Background: prefer clean TMDB backdrop (no rating badges)
        if (fa.background) out.background = fa.background
        return out
    } catch (error) {
        logAxiosError(error, logger, 'enrichMetaWithFaTmdb failed')
        return meta
    }
}

function isRpdbPosterUrl(url) {
    return /ratingposterdb|\brpdb\b/i.test(String(url || ''))
}

/** Short-lived cache for catalog-list TMDB enrich (avoid N identical finds). */
const catalogFaCache = new Map()
const CATALOG_FA_CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2h — protect shared TMDB key

function catalogFaCacheGet(key) {
    const row = catalogFaCache.get(key)
    if (!row) return null
    if (Date.now() - row.at > CATALOG_FA_CACHE_TTL_MS) {
        catalogFaCache.delete(key)
        return null
    }
    return row.value
}

function catalogFaCacheSet(key, value) {
    catalogFaCache.set(key, {at: Date.now(), value})
    if (catalogFaCache.size > 800) {
        const first = catalogFaCache.keys().next().value
        catalogFaCache.delete(first)
    }
}

/**
 * For catalog grids (e.g. 101 without RPDB): if a meta has no RPDB poster,
 * fill poster/name/description/genres from TMDB fa-IR using the user's key.
 * Items that already have RPDB posters are left untouched (ratings stay).
 */
export async function enrichCatalogMetasWithoutRpdb(
    metas,
    type,
    httpClient = axios,
    apiKey,
    logger = console,
    {concurrency = 4} = {},
) {
    if (!apiKey || !Array.isArray(metas) || !metas.length) {
        return metas
    }

    const work = metas.map((meta, index) => ({meta, index}))
    const out = metas.map((m) => (m && typeof m === 'object' ? {...m} : m))

    let cursor = 0
    async function worker() {
        while (cursor < work.length) {
            const my = cursor++
            const {meta, index} = work[my]
            if (!meta || typeof meta !== 'object') continue
            const keepRpdbPoster = isRpdbPosterUrl(meta.poster)

            const imdbId = extractImdbIdFromMeta(meta, meta.id)
            let tmdbNumeric = null
            const idStr = String(meta.id || '')
            if (idStr.startsWith('tmdb:')) {
                tmdbNumeric = idStr.split(':')[1]
            } else if (meta.tmdb_id || meta.tmdbId) {
                tmdbNumeric = String(meta.tmdb_id || meta.tmdbId)
            }

            const cacheKey = imdbId
                ? `imdb:${type}:${imdbId}`
                : (tmdbNumeric ? `tmdb:${type}:${tmdbNumeric}` : null)
            if (!cacheKey) continue

            try {
                let fa = catalogFaCacheGet(cacheKey)
                if (!fa) {
                    if (imdbId) {
                        fa = await getTMDBMetaFa(type, imdbId, httpClient, apiKey, logger)
                    } else if (tmdbNumeric) {
                        fa = await getTMDBMetaByTmdbId(type, tmdbNumeric, httpClient, apiKey, logger, null)
                    }
                    if (fa) catalogFaCacheSet(cacheKey, fa)
                }
                if (!fa) continue

                const row = out[index]
                // RPDB poster (ratings) stays; otherwise TMDB poster
                if (!keepRpdbPoster && fa.poster) row.poster = fa.poster
                if (fa.background) row.background = fa.background
                if (fa.name) row.name = fa.name
                if (fa.description) row.description = fa.description
                if (Array.isArray(fa.genres) && fa.genres.length) row.genres = fa.genres
                if (fa.releaseInfo && !row.releaseInfo) row.releaseInfo = fa.releaseInfo
            } catch (error) {
                logAxiosError(error, logger, 'catalog TMDB fa enrich failed')
            }
        }
    }

    const n = Math.min(concurrency, work.length)
    await Promise.all(Array.from({length: n}, () => worker()))
    return out
}




/**
 * Build Stremio meta for a tmdb: id (used by 101 Catalogs popular/trending).
 * Keeps meta.id as tmdb:<id> so the client requests streams with the same id.
 * When an IMDb id is available, episode lists come from Cinemeta for series.
 */
export async function getTMDBMetaByTmdbId(
    type,
    tmdbId,
    httpClient = axios,
    apiKey,
    logger = console,
    getCinemetaFn = null,
) {
    if (!apiKey || !tmdbId) {
        return null
    }
    const kind = type === 'series' ? 'tv' : 'movie'
    try {
        let data = {}
        let dataEn = null
        try {
            const [faRes, enRes] = await Promise.all([
                fetchTmdbDetailLang(kind, tmdbId, 'fa-IR', httpClient, apiKey),
                fetchTmdbDetailLang(kind, tmdbId, 'en-US', httpClient, apiKey),
            ])
            data = faRes || {}
            dataEn = enRes
        } catch {
            data = await fetchTmdbDetailLang(kind, tmdbId, 'fa-IR', httpClient, apiKey)
        }
        const imdbId = data.external_ids?.imdb_id || data.imdb_id || dataEn?.external_ids?.imdb_id || null
        const validImdb = imdbId && /^tt\d+$/.test(imdbId) ? imdbId : null
        // Never prefer original_title (ko/ja/…) when fa missing — use English
        const name = preferFaThenEn(
            data.title || data.name,
            dataEn?.title || dataEn?.name,
        )
        const description = preferFaThenEn(data.overview, dataEn?.overview)
        const year = (data.release_date || data.first_air_date || dataEn?.release_date || dataEn?.first_air_date || '').slice(0, 4) || null
        const genreMap = await getTMDBGenreMap(type, httpClient, apiKey, logger)
        const genresFa = (data.genres ?? []).map((g) => g.name || genreMap.get(g.id)).filter(Boolean)
        const genresEn = (dataEn?.genres ?? []).map((g) => g.name || genreMap.get(g.id)).filter(Boolean)
        const genres = pickFaOrEnGenres(genresFa, genresEn)
        const posterPath = data.poster_path || dataEn?.poster_path
        const backdropPath = data.backdrop_path || dataEn?.backdrop_path
        const vote = data.vote_average ?? dataEn?.vote_average

        const meta = {
            id: `tmdb:${tmdbId}`,
            type,
            name,
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
            background: backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : null,
            description,
            releaseInfo: year,
            imdbRating: vote != null ? String(Math.round(vote * 10) / 10) : null,
            genres: genres.length ? genres : undefined,
            imdb_id: validImdb || undefined,
        }

        if (type === 'series' && validImdb && typeof getCinemetaFn === 'function') {
            try {
                const cin = await getCinemetaFn(type, validImdb)
                const videos = cin?.meta?.videos
                if (Array.isArray(videos) && videos.length) {
                    meta.videos = videos
                        .filter((v) => v && (v.season != null || v.episode != null || v.id))
                        .map((v) => {
                            const season = v.season
                            const episode = v.episode
                            let vid = v.id
                            if (Number.isInteger(season) && Number.isInteger(episode)) {
                                vid = `tmdb:${tmdbId}:${season}:${episode}`
                            } else if (typeof vid === 'string' && validImdb && vid.startsWith(validImdb)) {
                                vid = vid.replace(validImdb, `tmdb:${tmdbId}`)
                            }
                            return {...v, id: vid, season, episode}
                        })
                }
            } catch (error) {
                logAxiosError(error, logger, 'Cinemeta videos for TMDB series failed')
            }
        }

        if (type === 'movie') {
            meta.behaviorHints = {defaultVideoId: meta.id}
        }

        return meta
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get TMDB meta by tmdb id')
        return null
    }
}

// ---------------------------------------------------------------------------
// Persian catalog-name translation for external aggregated catalogs
// Natural Iranian movie-site tone; never emit "سریال - سریال" style clones.
// ---------------------------------------------------------------------------

const CATALOG_BRAND_STRIP_RE = /\b(myanimelist|anidb|anilist|anisearch|livechart(\.me)?|notify\.moe|kitsu|rpdb|101catalogs?|mdblist|imdb|tmdb)\b/gi

/** Exact / high-priority phrases (first match wins). Everyday Persian. */
const CATALOG_EXACT_PHRASES = [
    [/top[\s-]*airing/i, 'در حال پخش — برترین‌ها'],
    [/currently[\s-]*airing/i, 'در حال پخش'],
    [/top[\s-]*all[\s-]*time/i, 'برترین‌های تاریخ'],
    [/all[\s-]*time[\s-]*top/i, 'برترین‌های تاریخ'],

    [/iptv\s*live\s*channels?/i, 'پخش زنده ماهواره'],
    [/iptv\s*movies?/i, 'فیلم‌های ماهواره'],
    [/iptv\s*series/i, 'سریال‌های ماهواره'],
    [/iptv\s*tv\s*shows?/i, 'سریال‌های ماهواره'],
    [/\biptv\b/i, 'ماهواره'],

    [/rotten\s*tomatoes\s*certified\s*fresh/i, 'تأییدشده راتن تومیتوز'],
    [/rt\s*fresh\s*-\s*action/i, 'تازه‌های راتن — اکشن'],
    [/rt\s*fresh\s*-\s*adventure/i, 'تازه‌های راتن — ماجراجویی'],
    [/rt\s*fresh\s*-\s*animation/i, 'تازه‌های راتن — انیمیشن'],
    [/rt\s*fresh\s*-\s*anime/i, 'تازه‌های راتن — انیمه'],
    [/rt\s*fresh\s*-\s*biography/i, 'تازه‌های راتن — زندگینامه'],
    [/rt\s*fresh/i, 'تازه‌های راتن تومیتوز'],

    [/top\s*seeded\s*-\s*all\s*time/i, 'پرطرفدارترین تورنت‌ها (همه زمان‌ها)'],
    [/top\s*seeded\s*-\s*last\s*month/i, 'پرطرفدارترین تورنت‌ها (ماه قبل)'],
    [/top\s*seeded\s*-\s*last\s*week/i, 'پرطرفدارترین تورنت‌ها (هفته قبل)'],
    [/top\s*seeded\s*-\s*this\s*month/i, 'پرطرفدارترین تورنت‌ها (این ماه)'],
    [/top\s*seeded\s*-\s*this\s*week/i, 'پرطرفدارترین تورنت‌ها (این هفته)'],
    [/top\s*seeded/i, 'پرطرفدارترین تورنت‌ها'],

    [/latest\s*stand[\s-]*up\s*comedy/i, 'جدیدترین استندآپ‌ها'],
    [/all\s*family/i, 'همه آثار خانوادگی'],
    [/family\s*0\s*-\s*5/i, 'کودکانه (۰ تا ۵ سال)'],
    [/family\s*0-5/i, 'کودکانه (۰ تا ۵ سال)'],
    [/hanna\s*barbera/i, 'هانا‌باربرا'],
    [/cartoon\s*network/i, 'کارتون نتورک'],
    [/pixar\s*movies/i, 'فیلم‌های پیکسار'],
    
    [/pixar\s*shorts?/i, 'کوتاه‌های پیکسار'],

    // Regions / languages — full natural titles (before generic word pass)
    [/chinese\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های چینی'],
    [/chinese\s*movies?/i, 'فیلم‌های چینی'],
    [/chinese\s*animation/i, 'انیمیشن چینی'],
    [/\bc-?drama\b/i, 'درام چینی'],
    [/\bchinese\b/i, 'چینی'],

    [/japanese\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های ژاپنی'],
    [/japanese\s*movies?/i, 'فیلم‌های ژاپنی'],
    [/japanese\s*animation/i, 'انیمیشن ژاپنی'],
    [/\bj-?drama\b/i, 'درام ژاپنی'],
    [/\bjapanese\b/i, 'ژاپنی'],

    [/korean\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های کره‌ای'],
    [/korean\s*movies?/i, 'فیلم‌های کره‌ای'],
    [/\bk-?drama\b/i, 'درام کره‌ای'],
    [/\bkorean\b/i, 'کره‌ای'],

    [/indian\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های هندی'],
    [/indian\s*movies?/i, 'فیلم‌های هندی'],
    [/\bbollywood\b/i, 'بالیوود'],
    [/\bindian\b/i, 'هندی'],

    [/turkish\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های ترکی'],
    [/turkish\s*movies?/i, 'فیلم‌های ترکی'],
    [/\bturkish\b/i, 'ترکی'],

    [/arabic\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های عربی'],
    [/arabic\s*movies?/i, 'فیلم‌های عربی'],
    [/\barabic\b/i, 'عربی'],

    [/french\s*(tv\s*)?(series|shows?)/i, 'سریال‌های فرانسوی'],
    [/french\s*movies?/i, 'فیلم‌های فرانسوی'],
    [/\bfrench\b/i, 'فرانسوی'],

    [/spanish\s*(tv\s*)?(series|shows?)/i, 'سریال‌های اسپانیایی'],
    [/spanish\s*movies?/i, 'فیلم‌های اسپانیایی'],
    [/latin\s*american/i, 'آمریکای لاتین'],
    [/\bspanish\b/i, 'اسپانیایی'],

    [/german\s*(tv\s*)?(series|shows?)/i, 'سریال‌های آلمانی'],
    [/german\s*movies?/i, 'فیلم‌های آلمانی'],
    [/\bgerman\b/i, 'آلمانی'],

    [/italian\s*(tv\s*)?(series|shows?)/i, 'سریال‌های ایتالیایی'],
    [/italian\s*movies?/i, 'فیلم‌های ایتالیایی'],
    [/\bitalian\b/i, 'ایتالیایی'],

    [/russian\s*(tv\s*)?(series|shows?)/i, 'سریال‌های روسی'],
    [/russian\s*movies?/i, 'فیلم‌های روسی'],
    [/\brussian\b/i, 'روسی'],

    [/thai\s*(tv\s*)?(series|shows?|dramas?)/i, 'سریال‌های تایلندی'],
    [/thai\s*movies?/i, 'فیلم‌های تایلندی'],
    [/\bthai\b/i, 'تایلندی'],

    [/vietnamese\s*(tv\s*)?(series|shows?)/i, 'سریال‌های ویتنامی'],
    [/vietnamese\s*movies?/i, 'فیلم‌های ویتنامی'],
    [/\bvietnamese\b/i, 'ویتنامی'],

    [/filipino\s*(tv\s*)?(series|shows?)/i, 'سریال‌های فیلیپینی'],
    [/pinoy\s*(tv\s*)?(series|shows?|movies?)/i, 'آثار فیلیپینی'],
    [/\bfilipino\b/i, 'فیلیپینی'],

    [/hong\s*kong\s*movies?/i, 'فیلم‌های هنگ‌کنگ'],
    [/hong\s*kong/i, 'هنگ‌کنگ'],
    [/taiwan(ese)?\s*(tv\s*)?(series|shows?|movies?)/i, 'آثار تایوانی'],
    [/\btaiwan/i, 'تایوان'],
    [/mainland\s*china/i, 'چین'],
    [/\bbritish\b/i, 'بریتانیایی'],
    [/\buk\s*series/i, 'سریال‌های بریتانیایی'],
    [/\buk\s*movies?/i, 'فیلم‌های بریتانیایی'],
    [/nordic/i, 'نوردیک'],
    [/scandinavian/i, 'اسکاندیناوی'],
    [/brazilian/i, 'برزیلی'],
    [/mexican/i, 'مکزیکی'],
    [/european/i, 'اروپایی'],
    [/asian/i, 'آسیایی'],
    [/african/i, 'آفریقایی'],


    [/^movies?$/i, 'فیلم‌ها'],
    [/^series$/i, 'سریال‌ها'],
    [/^tv\s*shows?$/i, 'سریال‌ها'],
    [/^tv$/i, 'تلویزیون'],
    [/^anime$/i, 'انیمه'],
    [/^search$/i, 'جستجو'],

    [/popular\s*movies?/i, 'فیلم‌های محبوب'],
    [/popular\s*(tv\s*)?series/i, 'سریال‌های محبوب'],
    [/popular\s*tv\s*shows?/i, 'سریال‌های محبوب'],
    [/trending\s*movies?/i, 'فیلم‌های داغ'],
    [/trending\s*(tv\s*)?series/i, 'سریال‌های داغ'],
    [/trending\s*tv\s*shows?/i, 'سریال‌های داغ'],
    [/top\s*rated\s*movies?/i, 'فیلم‌های پرامتیاز'],
    [/top\s*rated\s*(tv\s*)?series/i, 'سریال‌های پرامتیاز'],
    [/now\s*playing/i, 'اکران‌های روز'],
    [/on\s*the\s*air/i, 'در حال پخش'],
    [/airing\s*today/i, 'پخش امروز'],

    [/netflix\s*kids/i, 'نتفلیکس کودک'],
    [/netflix/i, 'نتفلیکس'],
    [/disney\+/i, 'دیزنی پلاس'],
    [/hbo\s*max/i, 'اچ‌بی‌او مکس'],
    [/prime\s*video/i, 'پرایم ویدیو'],
    [/apple\s*tv\+/i, 'اپل تی‌وی پلاس'],
    [/paramount\+/i, 'پارامونت پلاس'],
]

/** Word/phrase replacements (applied in order). */
const CATALOG_NAME_PHRASES = [
    [/tv\s*shows?/gi, 'سریال'],
    [/\bmovies?\b/gi, 'فیلم'],
    [/\bseries\b/gi, 'سریال'],
    [/\banime\b/gi, 'انیمه'],
    [/\bshows?\b/gi, 'سریال'],

    [/\bk-?drama\b/gi, 'درام کره‌ای'],
    [/\bkorean\b/gi, 'کره‌ای'],
    [/\bindian\b/gi, 'هندی'],
    [/\bturkish\b/gi, 'ترکی'],
    [/\bbollywood\b/gi, 'بالیوود'],
    [/\banimation\b/gi, 'انیمیشن'],
    [/\bkids?\b/gi, 'کودک'],
    [/\bfamily\b/gi, 'خانوادگی'],
    [/\bdocumentary\b/gi, 'مستند'],
    [/\bcrime\b/gi, 'جنایی'],
    [/\bfantasy\b/gi, 'فانتزی'],
    [/\badventure\b/gi, 'ماجراجویی'],
    [/\bwar\b/gi, 'جنگی'],
    [/\bwestern\b/gi, 'وسترن'],
    [/\bmusical\b/gi, 'موزیکال'],
    [/\bmusic\b/gi, 'موسیقی'],
    [/\bsports?\b/gi, 'ورزشی'],
    [/\bmystery\b/gi, 'معمایی'],
    [/\bbiography\b/gi, 'زندگینامه'],
    [/\bhistory\b/gi, 'تاریخی'],
    [/\bhorror\b/gi, 'ترسناک'],
    [/\bromance\b/gi, 'عاشقانه'],
    [/\bthriller\b/gi, 'هیجانی'],
    [/\baction\b/gi, 'اکشن'],
    [/\bcomedy\b/gi, 'کمدی'],
    [/\bdramas?\b/gi, 'درام'],
    [/\bsci-?fi\b/gi, 'علمی‌تخیلی'],
    [/\bscience\s*fiction\b/gi, 'علمی‌تخیلی'],

    [/\btop\s*rated\b/gi, 'پرامتیاز'],
    [/\btop\b/gi, 'برترین'],
    [/\bbest\b/gi, 'بهترین'],
    [/\bpopular\b/gi, 'محبوب'],
    [/\btrending\b/gi, 'داغ'],
    [/\bnew\b/gi, 'جدید'],
    [/\blatest\b/gi, 'جدیدترین'],
    [/\bupcoming\b/gi, 'به‌زودی'],
    [/\bairing\b/gi, 'در حال پخش'],
    [/\bongoing\b/gi, 'در حال پخش'],
    [/\bcompleted\b/gi, 'تمام‌شده'],
    [/\bclassic\b/gi, 'کلاسیک'],
    [/\brated\b/gi, 'امتیازدار'],
    [/\bratings?\b/gi, 'امتیاز'],

    [/certified\s*fresh/gi, 'تأییدشده'],
    [/stand[\s-]*up/gi, 'استندآپ'],
    [/\btorrent\b/gi, 'تورنت'],
    [/\bseeded\b/gi, 'سیدشده'],
    [/\bstreaming\b/gi, 'پلتفرم‌ها'],
    [/\bhulu\b/gi, 'هولو'],
    [/\bpeacock\b/gi, 'پیکاک'],
    [/\bcrunchyroll\b/gi, 'کرانچی‌رول'],
    [/\bshudder\b/gi, 'شادر'],
    [/\bstarz\b/gi, 'استارز'],
    [/\byear\b/gi, 'سال'],
    [/\bgenre\b/gi, 'ژانر'],
    [/\bsearch\b/gi, 'جستجو'],
]

function cleanupCatalogFaName(working) {
    let s = String(working || '')
        .replace(/\s*[-–—|/]+\s*/g, ' — ')
        .replace(/\s+/g, ' ')
        .trim()

    // Drop leftover long English tokens (keep years, +)
    if (/[a-z]/i.test(s)) {
        s = s
            .replace(/\b(?!\d{4}\b)[a-z][a-z0-9.'+]{2,}/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
    }

    // Region + type word order: "چینی فیلم" → "فیلم‌های چینی"
    const regions = 'چینی|ژاپنی|کره‌ای|هندی|ترکی|عربی|فرانسوی|اسپانیایی|آلمانی|ایتالیایی|روسی|تایلندی|ویتنامی|فیلیپینی|بریتانیایی|برزیلی|مکزیکی|اروپایی|آسیایی|آفریقایی|نوردیک|اسکاندیناوی|هنگ‌کنگ|تایوانی|بالیوود'
    s = s
        .replace(new RegExp(`^(${regions})\\s+فیلم‌ها$`, 'u'), 'فیلم‌های $1')
        .replace(new RegExp(`^(${regions})\\s+سریال‌ها$`, 'u'), 'سریال‌های $1')
        .replace(new RegExp(`^(${regions})\\s+فیلم$`, 'u'), 'فیلم‌های $1')
        .replace(new RegExp(`^(${regions})\\s+سریال$`, 'u'), 'سریال‌های $1')
        .replace(new RegExp(`^فیلم\\s+(${regions})$`, 'u'), 'فیلم‌های $1')
        .replace(new RegExp(`^سریال\\s+(${regions})$`, 'u'), 'سریال‌های $1')

    // Collapse duplicate type words: "سریال — سریال" / "سریال سریال‌ها" / "فیلم فیلم"
    s = s
        .replace(/(فیلم|سریال|انیمه|کانال)\s*[—\-]\s*\1‌ها/gu, '$1‌ها')
        .replace(/(فیلم|سریال|انیمه|کانال)\s+\1‌ها/gu, '$1‌ها')
        .replace(/(فیلم|سریال|انیمه|کانال)‌ها\s*[—\-]?\s*\1‌ها/gu, '$1‌ها')
        .replace(/(فیلم|سریال|انیمه|کانال)\s*[—\-]\s*\1(?!‌)/gu, '$1‌ها')
        .replace(/(فیلم|سریال|انیمه)(\s+\1)+/gu, '$1')
        .replace(/\s+/g, ' ')
        .trim()

    // Bare type → plural natural form
    if (s === 'فیلم') s = 'فیلم‌ها'
    if (s === 'سریال') s = 'سریال‌ها'
    if (s === 'انیمه') s = 'انیمه'
    if (s === 'کانال') s = 'کانال‌ها'

    // Tidy dashes
    s = s.replace(/\s*—\s*$/u, '').replace(/^\s*—\s*/u, '').trim()
    return s
}

export function translateCatalogName(name, type) {
    if (!name) return name

    const original = String(name).trim()
    let working = original.replace(CATALOG_BRAND_STRIP_RE, ' ').replace(/\s+/g, ' ').trim()

    for (const [pattern, replacement] of CATALOG_EXACT_PHRASES) {
        if (pattern.test(working)) {
            return cleanupCatalogFaName(replacement)
        }
    }

    for (const [pattern, replacement] of CATALOG_NAME_PHRASES) {
        working = working.replace(pattern, replacement)
    }

    working = cleanupCatalogFaName(working)

    // Lone region adjective → "فیلم/سریال‌های …"
    const regionOnly = {
        'چینی': 1, 'ژاپنی': 1, 'کره‌ای': 1, 'هندی': 1, 'ترکی': 1, 'عربی': 1,
        'فرانسوی': 1, 'اسپانیایی': 1, 'آلمانی': 1, 'ایتالیایی': 1, 'روسی': 1,
        'تایلندی': 1, 'ویتنامی': 1, 'فیلیپینی': 1, 'بریتانیایی': 1, 'برزیلی': 1,
        'مکزیکی': 1, 'اروپایی': 1, 'آسیایی': 1, 'آفریقایی': 1, 'نوردیک': 1,
        'اسکاندیناوی': 1, 'هنگ‌کنگ': 1, 'تایوان': 1, 'بالیوود': 1,
    }
    if (working && regionOnly[working]) {
        if (type === 'movie') working = `فیلم‌های ${working}`
        else if (type === 'series' || type === 'tv') working = `سریال‌های ${working}`
        else if (type === 'anime') working = `انیمه ${working}`
        else working = `آثار ${working}`
    }

    if (!working) {
        if (type === 'movie') return 'فیلم‌ها'
        if (type === 'series') return 'سریال‌ها'
        if (type === 'tv') return 'تلویزیون'
        if (type === 'anime') return 'انیمه'
        return original
    }

    return cleanupCatalogFaName(working)
}


/**
 * Reorder external catalogs without Patreon:
 * trending / popular / new / top → first
 * streaming platforms (Netflix, Disney+, …) → last
 */
export function classifyExternalCatalogSource(source = {}) {
    const url = `${source.manifestUrl || ''} ${source.resolvedUrl || ''} ${source.baseUrl || ''}`
    if (/iptvbridge|iptv[\s_-]*bridge|\/iptv/i.test(url)) return 'iptv'
    if (/stremio-anime|anime-catalog|animecatalog|myanimelist|kitsu|baby-beamup.*anime/i.test(url)) {
        return 'anime'
    }
    if (/101catalog|api\.101catalogs/i.test(url)) return '101'
    if (/aiocatalog|aio\.pantelx|jqrw92fchz\.workers\.dev/i.test(url)) return 'aio'
    return 'other'
}

function catalogSortScore(cat) {
    const blob = `${cat?.name || ''} ${cat?.id || ''}`
    const platformRe = /\b(netflix|disney\+?|hbo\s*max|\bmax\b|prime\s*video|amazon\s*prime|apple\s*tv|paramount\+?|hulu|peacock|crunchyroll|starz|showtime|sky\s*showtime|discovery\+?|mubi|shudder|britbox|acorn|hayu|iqiyi|viaplay|canal\+|movistar|zee5|sonyliv|hotstar|jiohotstar|bbc\s*iplayer|itvx|channel\s*4|streaming|پلتفرم|نتفلیکس|دیزنی|اچ‌بی‌او|پرایم|اپل\s*تی‌وی|پارامونت|هولو|پیکاک|کرانچی|استارز)\b/i
    const trendRe = /\b(trending|popular|top\s*rated|top\s*seeded|latest|new\b|now\s*playing|on\s*the\s*air|airing|upcoming|certified\s*fresh|rt\s*fresh|داغ|محبوب|پرطرفدار|برترین|جدیدترین|جدید|تازه|اکران)\b/i
    const krCnRe = /\b(korean|k-?drama|chinese|c-?drama|hong\s*kong|taiwan|کره‌|چین|درام\s*کره‌|درام\s*چین|هنگ‌کنگ|تایوان)\b/i

    if (platformRe.test(blob)) return 400
    if (trendRe.test(blob)) return 0
    if (krCnRe.test(blob)) return 50
    return 120
}

/** Sort inside one group (101 / AIO / anime / …). */
export function sortCatalogsWithinGroup(catalogs) {
    if (!Array.isArray(catalogs) || catalogs.length < 2) return catalogs || []
    return [...catalogs].sort((a, b) => {
        const d = catalogSortScore(a) - catalogSortScore(b)
        if (d !== 0) return d
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'fa')
    })
}

/**
 * Full external order:
 * 101 → AIO/other → Anime → IPTV (always last)
 * Inside 101: trend/popular → Korean/Chinese → rest → streaming platforms
 */
export function sortExternalCatalogs(catalogs, sourcesWithCatalogs = null) {
    // Backward-compatible: flat list without source tags — apply within-group score only
    if (!sourcesWithCatalogs) {
        return sortCatalogsWithinGroup(catalogs)
    }
    return catalogs
}

export function buildOrderedExternalCatalogs(externalSources, mapFn) {
    const buckets = {
        '101': [],
        aio: [],
        other: [],
        anime: [],
        iptv: [],
    }
    for (const source of externalSources || []) {
        const group = classifyExternalCatalogSource(source)
        const list = Array.isArray(source.catalogs) ? source.catalogs : []
        for (const catalog of list) {
            const mapped = typeof mapFn === 'function' ? mapFn(catalog, source) : catalog
            if (mapped) buckets[group].push(mapped)
        }
    }
    return [
        ...sortCatalogsWithinGroup(buckets['101']),
        ...sortCatalogsWithinGroup(buckets.aio),
        ...sortCatalogsWithinGroup(buckets.other),
        ...sortCatalogsWithinGroup(buckets.anime),
        ...buckets.iptv, // keep IPTV order; always last block
    ]
}


export async function getTMDBDetails(type, tmdbId, httpClient = axios, apiKey, logger = console) {
    if (!apiKey || !tmdbId) {
        return null
    }
    const kind = type === 'series' ? 'tv' : 'movie'
    try {
        const response = await httpClient.get(`https://api.themoviedb.org/3/${kind}/${tmdbId}`, {
            params: {api_key: apiKey, append_to_response: 'external_ids'},
            timeout: REQUEST_TIMEOUT_MS,
        })
        const data = response.data ?? {}
        const title = data.title || data.name || data.original_title || data.original_name || null
        const imdbId = data.external_ids?.imdb_id
            || data.imdb_id
            || null
        return {
            title,
            imdbId: imdbId && /^tt\d+$/.test(imdbId) ? imdbId : null,
            year: (data.release_date || data.first_air_date || '').slice(0, 4) || null,
        }
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get TMDB details')
        return null
    }
}

export async function getTMDBTitle(type, tmdbId, httpClient = axios, apiKey, logger = console) {
    const details = await getTMDBDetails(type, tmdbId, httpClient, apiKey, logger)
    return details?.title ?? null
}

export async function getKitsuTitle(kitsuId, httpClient = axios, logger = console) {
    const numericId = String(kitsuId ?? '').match(/(\d+)$/)?.[1]
    if (!numericId) {
        return null
    }
    try {
        const response = await httpClient.get(`https://kitsu.io/api/edge/anime/${numericId}`, {
            timeout: REQUEST_TIMEOUT_MS,
        })
        const attrs = response.data?.data?.attributes
        return attrs?.canonicalTitle || attrs?.titles?.en || attrs?.titles?.en_jp || null
    } catch (error) {
        logAxiosError(error, logger, 'Unable to get Kitsu title')
        return null
    }
}

// User-provided SubSource subtitle addon (subsource.net) — each self-hoster
// configures SUBSOURCE_MANIFEST_URL with their own personalized manifest link
// (generated on subsource's own configure page, language preference baked
// into the URL itself), we just proxy /subtitles requests straight through.
export async function proxySubtitles(manifestUrl, type, id, extraPath, httpClient = axios, logger = console) {
    if (!manifestUrl) {
        return null
    }
    const baseUrl = manifestUrl.replace(/\/manifest\.json.*$/, '')
    const suffix = extraPath ? `/${extraPath}` : ''
    const url = `${baseUrl}/subtitles/${type}/${encodeURIComponent(id)}${suffix}.json`
    try {
        const response = await httpClient.get(url, {timeout: REQUEST_TIMEOUT_MS})
        return response.data ?? {subtitles: []}
    } catch (error) {
        logAxiosError(error, logger, 'SubSource subtitle proxy failed')
        return {subtitles: []}
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
    animex: 'Animex',
    donyayeserial: 'DonyayeSerial',
    torrent: 'سینماگرافی [P2P]',
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
    cinamatic: '🎦',
    aslmoviez: '🎬',
    serialblog: '📺',
    digimovie: '🎥',
    avamovie: '🍿',
    donyayeserial: '🌍',
    animex: '⛩️',
    torrent: '🧲',
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
    if (/web[.\-]?dl/i.test(text)) {
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
    const hasSub = /زیرنویس/i.test(text) || /\bsub(bed|title)?\b/i.test(text) || /soft\s?sub|hard\s?sub/i.test(text)
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

// Some providers also offer a standalone dubbed-audio-track download (no
// video at all) meant to be muxed with a copy of the movie you already have.
// These need a distinct, unambiguous label so they don't look like a normal
// video stream.
function isAudioOnlyFile(text) {
    return /فایل\s*صوتی|صوت\s*(جدا|خالی)|audio\s*only|dubbed\s*audio\s*track|\.(mp3|ac3|aac|flac|wav|m4a)(\?|$|\s)/i
        .test(text)
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

// Almost every provider's actual filename (visible in the download URL) carries
// far more detail than the short on-page label — pull it in as extra
// detection text for every provider, universally, not just the ones whose
// scraper happens to capture it explicitly.
function filenameTextFromUrl(url) {
    try {
        const {pathname} = new URL(url)
        const raw = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '')
        return raw.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ')
    } catch {
        return ''
    }
}

export function formatStreamTitle({providerKey, quality, size, audioType, extraText, url, seeders, peers} = {}) {
    const providerLabel = PROVIDER_LABELS[providerKey] || providerKey || 'Unknown'
    const emoji = PROVIDER_EMOJI[providerKey] || '📡'
    const combinedText = [quality, extraText, filenameTextFromUrl(url)].filter(Boolean).join(' ')
    const displaySize = cleanSize(size) || detectSize(combinedText)
    const isCensored = PROVIDER_CENSORED[providerKey] === true
    const statusLine = providerKey === 'torrent'
        ? null
        : (isCensored ? '⚠️ وضعیت: سانسور شده' : '✅ وضعیت: سانسور نشده')
    const healthLine = (seeders != null || peers != null)
        ? ltr([seeders != null ? `🌱 سیدر: ${seeders}` : null, peers != null ? `👤 پیر: ${peers}` : null]
            .filter(Boolean).join(' • '))
        : null

    if (isAudioOnlyFile(combinedText)) {
        const lines = [
            `${emoji} منبع: ${ltr(providerLabel)}`,
            '🎧 فقط فایل صوتی: دوبله فارسی (بدون تصویر)',
            displaySize ? `💾 حجم: ${ltr(displaySize)}` : null,
            healthLine,
            statusLine,
        ].filter(Boolean)
        return lines.join('\n')
    }

    const resolution = detectResolution(combinedText)
    const extras = detectExtras(combinedText)
    const source = detectSource(combinedText)
    const codec = detectCodec(combinedText)
    const audio = detectAudio(combinedText, audioType)

    // Split across two shorter lines instead of one long bullet-joined line —
    // long single lines were wrapping awkwardly mid-way in some Stremio clients.
    const qualityLine = [resolution, source].filter(Boolean).join(' • ')
    const encodeLine = [...extras, codec].filter(Boolean).join(' • ')

    const lines = [
        `${emoji} منبع: ${ltr(providerLabel)}`,
        qualityLine ? `🎞️ کیفیت: ${ltr(qualityLine)}` : null,
        encodeLine ? `⚙️ انکد: ${ltr(encodeLine)}` : null,
        audio,
        displaySize ? `💾 حجم: ${ltr(displaySize)}` : null,
        healthLine,
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

const EXTERNAL_CATALOGS_TTL_MS = 45 * 1_000 // 45s — AIO configs change often
const EXTERNAL_CATALOG_FAST_MS = 20_000
const EXTERNAL_CATALOG_ANIME_MS = 35_000
/** Soft budget on the critical path so a slow anime host does not delay the whole manifest */
const EXTERNAL_CATALOG_SOFT_WAIT_MS = 4_000

/**
 * AIOCatalogs (and similar) put a JSON blob in the path.
 * Vercel env may store it decoded; axios may mangle braces or double-encode %.
 * Decode path segments fully, then encode once.
 */
export function normalizeExternalManifestUrl(raw) {
    let cleaned = String(raw || '').trim()
    if (
        (cleaned.startsWith('"') && cleaned.endsWith('"'))
        || (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
        cleaned = cleaned.slice(1, -1).trim()
    }
    if (!cleaned) return ''
    try {
        const u = new URL(cleaned)
        const parts = u.pathname.split('/').map((seg) => {
            if (!seg) return ''
            let decoded = seg
            for (let i = 0; i < 4; i++) {
                try {
                    const next = decodeURIComponent(decoded)
                    if (next === decoded) break
                    decoded = next
                } catch {
                    break
                }
            }
            // Encode the whole segment (JSON blob, uuid, "manifest.json", …)
            return encodeURIComponent(decoded)
        })
        u.pathname = parts.join('/')
        u.hash = ''
        return u.toString()
    } catch {
        return cleaned
    }
}

/** @type {{timestamp:number, key:string, sources:any[], failed:string[]} | null} */
let externalCatalogsCache = null
/** In-flight anime (or other slow) fetches so concurrent requests share one promise */
const externalInflight = new Map()
/** @type {Map<string, string>} */
const externalCatalogLastError = new Map()

function externalManifestUrls(env) {
    // Order is intentional and must not be reshuffled:
    // 1) 101  2) AIOCatalogs  3) TMDB catalogs  4) Anime  5) IPTV/satellite
    // If 101 is unset, AIO naturally takes the first slot among dedicated URLs.
    const dedicated = [
        env.CATALOG101_MANIFEST_URL,
        env.CATALOG_AIO_MANIFEST_URL || env.CATALOG_AIOCATALOGS_MANIFEST_URL,
        env.CATALOG_TMDB_MANIFEST_URL,
        env.CATALOG_ANIME_MANIFEST_URL,
        env.CATALOG_IPTVBRIDGE_MANIFEST_URL,
    ]
    const extra = String(env.EXTERNAL_CATALOG_MANIFEST_URLS || '')
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    const seen = new Set()
    const out = []
    for (const url of [...dedicated, ...extra]) {
        const cleaned = normalizeExternalManifestUrl(url)
        if (!cleaned || seen.has(cleaned)) continue
        seen.add(cleaned)
        out.push(cleaned)
    }
    return out
}

function isSlowExternalCatalogUrl(manifestUrl, env = {}) {
    // Only the dedicated anime catalog is soft-deferred. AIO / 101 / IPTV stay on the critical path.
    const anime = String(env.CATALOG_ANIME_MANIFEST_URL || '').trim()
    if (anime && manifestUrl === anime) return true
    try {
        const host = new URL(manifestUrl).hostname.toLowerCase()
        if (host.includes('anime-catalog') || host.includes('animecatalog')) return true
    } catch { /* ignore */ }
    // path segment strongly indicates the community anime catalogs addon
    if (/stremio-anime-catalogs|myanimelist_top/i.test(manifestUrl)) return true
    return false
}

function catalogBaseUrl(manifestUrl) {
    try {
        const u = new URL(normalizeExternalManifestUrl(manifestUrl) || manifestUrl)
        u.hash = ''
        u.search = ''
        let path = u.pathname.replace(/\/manifest\.json$/i, '')
        if (path.endsWith('/')) path = path.slice(0, -1)
        u.pathname = path || '/'
        return u.toString().replace(/\/$/, '')
    } catch {
        return String(manifestUrl).replace(/\/manifest\.json.*$/i, '')
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchOneExternalCatalog(manifestUrl, httpClient, logger, timeoutMs) {
    const primary = normalizeExternalManifestUrl(manifestUrl)
    const candidates = [primary]
    // pantelx and workers.dev can diverge; always try both and pick the richer manifest.
    try {
        const u = new URL(primary)
        if (/(^|\.)aio\.pantelx\.com$/i.test(u.hostname)) {
            const alt = new URL(primary)
            alt.hostname = 'aiocatalogs.jqrw92fchz.workers.dev'
            candidates.push(alt.toString())
        } else if (/(^|\.)aiocatalogs\.jqrw92fchz\.workers\.dev$/i.test(u.hostname)) {
            const alt = new URL(primary)
            alt.hostname = 'aio.pantelx.com'
            candidates.push(alt.toString())
        }
    } catch { /* ignore */ }

    async function fetchManifest(url) {
        let fetchUrl = url
        try {
            const bu = new URL(url)
            bu.searchParams.set('_cg', String(Date.now()))
            fetchUrl = bu.toString()
        } catch { /* keep */ }

        if (typeof fetch === 'function') {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), timeoutMs)
            try {
                const response = await fetch(fetchUrl, {
                    signal: ctrl.signal,
                    headers: {
                        Accept: 'application/json,text/plain,*/*',
                        'User-Agent': 'Mozilla/5.0 (compatible; Cinemagraphy/2.1.15; +https://cinemagraphy.vercel.app)',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache',
                    },
                    redirect: 'follow',
                    cache: 'no-store',
                })
                if (!response.ok) {
                    const err = new Error(`HTTP ${response.status}`)
                    err.response = {status: response.status}
                    throw err
                }
                const manifest = await response.json()
                return {url, manifest}
            } finally {
                clearTimeout(timer)
            }
        }

        const response = await httpClient.get(fetchUrl, {
            timeout: timeoutMs,
            headers: {
                Accept: 'application/json,text/plain,*/*',
                'User-Agent': 'Mozilla/5.0 (compatible; Cinemagraphy/2.1.15; +https://cinemagraphy.vercel.app)',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            },
            validateStatus: (s) => s >= 200 && s < 300,
            maxRedirects: 5,
        })
        return {url, manifest: response.data ?? {}}
    }

    const settled = await Promise.all(
        candidates.map(async (url) => {
            try {
                return {ok: true, ...(await fetchManifest(url))}
            } catch (error) {
                logger.warn?.('External catalog candidate failed', {
                    url,
                    message: error?.message,
                    status: error?.response?.status,
                })
                return {ok: false, url, error}
            }
        }),
    )

    const successes = settled.filter((row) => row.ok && row.manifest && typeof row.manifest === 'object')
    if (!successes.length) {
        const last = settled.find((row) => row.error)?.error
        throw last || new Error('External catalog manifest fetch failed')
    }

    // Prefer more catalogs (AIO UI vs stale edge), then prefer primary host match
    successes.sort((a, b) => {
        const na = Array.isArray(a.manifest.catalogs) ? a.manifest.catalogs.length : 0
        const nb = Array.isArray(b.manifest.catalogs) ? b.manifest.catalogs.length : 0
        if (nb !== na) return nb - na
        if (a.url === primary) return -1
        if (b.url === primary) return 1
        return 0
    })

    const best = successes[0]
    const usedUrl = best.url
    const manifest = best.manifest
    const catalogs = Array.isArray(manifest.catalogs) ? manifest.catalogs : []
    if (!catalogs.length) {
        logger.warn?.('External catalog manifest has no catalogs', {manifestUrl: usedUrl})
    } else {
        logger.info?.('External catalog selected', {
            primary,
            usedUrl,
            catalogs: catalogs.length,
            tried: successes.map((s) => ({
                url: s.url,
                n: Array.isArray(s.manifest.catalogs) ? s.manifest.catalogs.length : 0,
            })),
        })
    }
    const metaResource = (manifest.resources ?? []).find((r) => (
        r === 'meta' || r?.name === 'meta'
    ))
    const streamResource = (manifest.resources ?? []).find((r) => (
        r === 'stream' || r?.name === 'stream'
    ))
    return {
        baseUrl: catalogBaseUrl(usedUrl),
        catalogIds: new Set(catalogs.map((catalog) => catalog.id)),
        catalogs,
        idPrefixes: manifest.idPrefixes ?? [],
        hasMeta: Boolean(metaResource),
        hasStream: Boolean(streamResource),
        manifestUrl: primary,
        resolvedUrl: usedUrl,
    }
}


function rememberSource(source) {
    if (!source?.manifestUrl) return
    const key = source.manifestUrl
    if (!externalCatalogsCache) {
        externalCatalogsCache = {
            timestamp: Date.now(),
            key: key,
            sources: [source],
            failed: [],
        }
        externalCatalogLastError.delete(key)
        return
    }
    const sources = [...(externalCatalogsCache.sources || [])]
    const idx = sources.findIndex((s) => s.manifestUrl === key || s.resolvedUrl === source.resolvedUrl)
    if (idx >= 0) sources[idx] = source
    else sources.push(source)
    const failed = (externalCatalogsCache.failed || []).filter((u) => u !== key)
    externalCatalogsCache = {
        ...externalCatalogsCache,
        timestamp: Date.now(),
        sources,
        failed,
    }
    externalCatalogLastError.delete(key)
}

export function invalidateExternalCatalogCache() {
    externalCatalogsCache = null
}

export async function getExternalCatalogSources(env = {}, httpClient = axios, logger = console) {
    const manifestUrls = externalManifestUrls(env)
    if (!manifestUrls.length) {
        return []
    }

    const now = Date.now()
    const cacheKey = manifestUrls.join('|')
    const cacheFresh = (
        externalCatalogsCache
        && externalCatalogsCache.key === cacheKey
        && now - externalCatalogsCache.timestamp < EXTERNAL_CATALOGS_TTL_MS
    )
    const cachedSources = cacheFresh ? (externalCatalogsCache.sources || []) : []
    const cachedByUrl = new Map(cachedSources.map((s) => [s.manifestUrl, s]))

    const fastUrls = []
    const slowUrls = []
    for (const url of manifestUrls) {
        if (cachedByUrl.has(url)) continue
        if (isSlowExternalCatalogUrl(url, env)) slowUrls.push(url)
        else fastUrls.push(url)
    }

    // Fast catalogs — full wait (short timeout)
    if (fastUrls.length) {
        const fastSettled = await Promise.all(
            fastUrls.map(async (manifestUrl) => {
                try {
                    const source = await fetchOneExternalCatalog(
                        manifestUrl, httpClient, logger, EXTERNAL_CATALOG_FAST_MS,
                    )
                    externalCatalogLastError.delete(manifestUrl)
                    return {ok: true, manifestUrl, source}
                } catch (error) {
                    const msg = error?.message || String(error)
                    externalCatalogLastError.set(manifestUrl, msg)
                    logAxiosError(error, logger, `External catalog manifest fetch failed (${manifestUrl})`)
                    return {ok: false, manifestUrl}
                }
            }),
        )
        for (const row of fastSettled) {
            if (row.ok) cachedByUrl.set(row.manifestUrl, row.source)
        }
    }

    // Anime catalog can be slow; wait the full anime timeout (do not soft-drop it).
    for (const manifestUrl of slowUrls) {
        try {
            const source = await fetchOneExternalCatalog(
                manifestUrl, httpClient, logger, EXTERNAL_CATALOG_ANIME_MS,
            )
            externalCatalogLastError.delete(manifestUrl)
            rememberSource(source)
            cachedByUrl.set(manifestUrl, source)
        } catch (error) {
            const msg = error?.message || String(error)
            externalCatalogLastError.set(manifestUrl, msg)
            logAxiosError(error, logger, `External catalog manifest fetch failed (${manifestUrl})`)
        }
    }

    const sources = manifestUrls.map((url) => cachedByUrl.get(url)).filter(Boolean)
    const failed = manifestUrls.filter((url) => !cachedByUrl.has(url) && !externalInflight.has(url))
    externalCatalogsCache = {
        timestamp: now,
        key: cacheKey,
        sources,
        failed,
    }
    return sources
}


/** Safe status snapshot for /providers.json (no secrets, host only). */
export function getExternalCatalogStatus(env = {}) {
    const urls = externalManifestUrls(env)
    const cache = externalCatalogsCache
    const sources = cache?.sources || []
    const byUrl = new Map()
    for (const s of sources) {
        if (s.manifestUrl) byUrl.set(s.manifestUrl, s)
        if (s.resolvedUrl) byUrl.set(s.resolvedUrl, s)
    }
    const failed = new Set(cache?.failed || [])
    return urls.map((url) => {
        let host = url
        try { host = new URL(url).host } catch { /* keep */ }
        const src = byUrl.get(url)
        const err = externalCatalogLastError.get(url)
        let resolvedHost = null
        try {
            if (src?.resolvedUrl) resolvedHost = new URL(src.resolvedUrl).host
        } catch { /* ignore */ }
        return {
            host,
            resolvedHost: resolvedHost && resolvedHost !== host ? resolvedHost : null,
            ok: Boolean(src),
            catalogs: src ? (src.catalogs?.length || 0) : 0,
            pending: externalInflight.has(url),
            failed: (failed.has(url) || Boolean(err)) && !src,
            error: src ? null : (err || null),
        }
    })
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

// Some external catalog addons (e.g. IPTV Bridge) serve their own streams
// directly — there is no equivalent content in our own scraper providers to
// search for (live TV channels, not movies/series). For those, we proxy the
// /stream request straight through, byte-for-byte, so the result is
// identical to installing that addon on its own. Exact same id/type/extra
// path Stremio gave us — nothing added, removed, or rewritten.
export function findExternalStreamSource(sources, id) {
    return sources.find((source) => (
        source.hasStream && source.idPrefixes.some((prefix) => id.startsWith(prefix))
    ))
}

export async function proxyExternalStream(source, type, id, extraPath, httpClient = axios, logger = console) {
    const suffix = extraPath ? `/${extraPath}` : ''
    const url = `${source.baseUrl}/stream/${type}/${encodeURIComponent(id)}${suffix}.json`
    try {
        const response = await httpClient.get(url, {timeout: REQUEST_TIMEOUT_MS})
        return response.data ?? {streams: []}
    } catch (error) {
        logAxiosError(error, logger, 'External stream proxy failed')
        return {streams: []}
    }
}

// ---------------------------------------------------------------------------
// Torrent provider (Meteor for the Weebs, or any similar manifest-based
// torrent/debrid addon) — appended AFTER Iranian provider streams, never
// before. We only touch the display text (title/name); url, infoHash,
// fileIdx, sources, and behaviorHints (all of which Stremio's torrent/debrid
// engine actually needs to play the stream) are passed through untouched.
// ---------------------------------------------------------------------------

const TORRENT_SOURCE_TTL_MS = 60 * 60 * 1_000
let torrentSourceCache = null

async function getTorrentSource(env, httpClient, logger) {
    const manifestUrl = env.TORRENT_METEOR_MANIFEST_URL
    if (!manifestUrl) {
        logger.info('Torrent provider: TORRENT_METEOR_MANIFEST_URL is not set')
        return null
    }

    const now = Date.now()
    if (torrentSourceCache && now - torrentSourceCache.timestamp < TORRENT_SOURCE_TTL_MS) {
        return torrentSourceCache.source
    }

    try {
        const response = await httpClient.get(manifestUrl, {timeout: REQUEST_TIMEOUT_MS})
        const manifest = response.data ?? {}
        const baseUrl = manifestUrl.replace(/\/manifest\.json.*$/, '')

        // idPrefixes can be declared per-resource (on the "stream" entry) or
        // manifest-wide — per-resource takes priority per the Stremio spec.
        // Only filter by prefix if we actually found one; otherwise try every id
        // rather than risk silently skipping valid results with a guessed default.
        const streamResource = (manifest.resources ?? []).find((r) => r?.name === 'stream')
        const idPrefixes = streamResource?.idPrefixes ?? manifest.idPrefixes ?? null

        const source = {baseUrl, idPrefixes: Array.isArray(idPrefixes) ? idPrefixes : []}
        logger.info('Torrent provider manifest resolved', {
            baseUrl,
            idPrefixes: source.idPrefixes,
            resources: manifest.resources,
        })
        torrentSourceCache = {timestamp: now, source}
        return source
    } catch (error) {
        logAxiosError(error, logger, 'Meteor torrent manifest fetch failed')
        return torrentSourceCache?.source ?? null
    }
}

function extractSeeders(text) {
    const match = text.match(/👤\s*(\d+)|🌱\s*(\d+)|seeds?:?\s*(\d+)/i)
    const value = match?.[1] ?? match?.[2] ?? match?.[3]
    return value != null ? Number(value) : null
}

function extractPeers(text) {
    const match = text.match(/👥\s*(\d+)|peers?:?\s*(\d+)|leech(?:ers)?:?\s*(\d+)/i)
    const value = match?.[1] ?? match?.[2] ?? match?.[3]
    return value != null ? Number(value) : null
}

function extractTorrentSize(text) {
    return text.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i)?.[1] ?? null
}

// Fetches Meteor's raw streams for this id and re-renders them with
// CinemaGraphy's own formatting/branding. Resilient by design: any failure
// (bad manifest, timeout, unexpected shape) just yields an empty array —
// the caller appends this to the Iranian providers' results, so a Meteor
// outage never affects anything else.
export async function getTorrentStreams(type, id, env = {}, httpClient = axios, logger = console) {
    const source = await getTorrentSource(env, httpClient, logger)
    if (!source) {
        logger.info('Torrent provider not configured or manifest unreachable')
        return []
    }
    if (source.idPrefixes.length && !source.idPrefixes.some((prefix) => id.startsWith(prefix))) {
        logger.info('Torrent provider skipped id (idPrefixes mismatch)', {id, idPrefixes: source.idPrefixes})
        return []
    }

    try {
        const url = `${source.baseUrl}/stream/${type}/${encodeURIComponent(id)}.json`
        const response = await httpClient.get(url, {timeout: REQUEST_TIMEOUT_MS})
        const streams = Array.isArray(response.data?.streams) ? response.data.streams : []
        logger.info('Torrent provider response', {url, status: response.status, streamCount: streams.length})

        return streams.map((raw) => ({
            ...raw,
            // Light-touch branding only — the original name/description (which
            // Meteor already fills with quality/size/seeders/audio info) are left
            // completely untouched. Earlier attempts to reformat them (adding a
            // separate `title` field alongside Meteor's own name/description)
            // caused Stremio to silently drop these streams in every client.
            name: raw.name ? `سینماگرافی | ${raw.name}` : 'سینماگرافی [P2P]',
        }))
    } catch (error) {
        logAxiosError(error, logger, 'Meteor torrent streams fetch failed')
        return []
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


// ---------------------------------------------------------------------------
// Landing-only TMDB catalogs (NOT added to Stremio manifest)
// ---------------------------------------------------------------------------

const LANDING_TMDB_TTL_MS = 60 * 60 * 1000 // 1 hour
let landingTmdbCache = null

function mapTmdbListItem(item, mediaTypeHint = null, itemEn = null) {
    const mediaType = item.media_type || mediaTypeHint || (item.title ? 'movie' : 'tv')
    const title = preferFaThenEn(
        item.title || item.name,
        itemEn?.title || itemEn?.name,
    )
    const overview = preferFaThenEn(item.overview, itemEn?.overview)
    const original = item.original_title || item.original_name || itemEn?.original_title || itemEn?.original_name || null
    const year = (item.release_date || item.first_air_date || itemEn?.release_date || itemEn?.first_air_date || '').slice(0, 4) || null
    const posterPath = item.poster_path || itemEn?.poster_path
    const backdropPath = item.backdrop_path || itemEn?.backdrop_path
    return {
        id: item.id,
        mediaType: mediaType === 'tv' ? 'tv' : 'movie',
        title,
        originalTitle: original && original !== title ? original : null,
        overview,
        rating: item.vote_average != null ? Math.round(item.vote_average * 10) / 10 : null,
        year,
        poster: posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null,
        backdrop: backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null,
    }
}

async function tmdbListMerged(path, params, httpClient, apiKey) {
    const [faRows, enRows] = await Promise.all([
        tmdbList(path, {...params, language: 'fa-IR'}, httpClient, apiKey).catch(() => []),
        tmdbList(path, {...params, language: 'en-US'}, httpClient, apiKey).catch(() => []),
    ])
    const enById = new Map((enRows || []).map((r) => [r.id, r]))
    return (faRows || []).map((row) => mapTmdbListItem(row, null, enById.get(row.id)))
}

async function tmdbList(path, params, httpClient, apiKey) {
    const response = await httpClient.get(`https://api.themoviedb.org/3/${path}`, {
        params: {api_key: apiKey, language: 'fa-IR', ...params},
        timeout: REQUEST_TIMEOUT_MS,
    })
    return Array.isArray(response.data?.results) ? response.data.results : []
}

async function tmdbVideos(mediaType, id, httpClient, apiKey) {
    try {
        const kind = mediaType === 'tv' ? 'tv' : 'movie'
        const response = await httpClient.get(`https://api.themoviedb.org/3/${kind}/${id}/videos`, {
            params: {api_key: apiKey, language: 'en-US'},
            timeout: REQUEST_TIMEOUT_MS,
        })
        const results = Array.isArray(response.data?.results) ? response.data.results : []
        const trailer = results.find((v) => v.site === 'YouTube' && /trailer/i.test(v.type))
            || results.find((v) => v.site === 'YouTube')
        return trailer ? {key: trailer.key, name: trailer.name, site: trailer.site} : null
    } catch {
        return null
    }
}

/**
 * Cached TMDB showcase data for the landing page only.
 * Never throws a hard failure — returns empty sections on error.
 */
export async function getLandingTmdbCatalogs(httpClient = axios, apiKey = process.env.TMDB_API_KEY, logger = console) {
    if (!apiKey) {
        return {
            ok: false,
            reason: 'TMDB_API_KEY missing',
            checkedAt: new Date().toISOString(),
            trendingDay: [],
            trendingWeek: [],
            nowPlaying: [],
            trailers: [],
        }
    }

    if (landingTmdbCache && Date.now() - landingTmdbCache.at < LANDING_TMDB_TTL_MS) {
        return landingTmdbCache.payload
    }

    try {
        const [trendingDay, trendingWeek, nowPlaying] = await Promise.all([
            tmdbListMerged('trending/all/day', {page: 1}, httpClient, apiKey).then((rows) => rows.slice(0, 12)),
            tmdbListMerged('trending/all/week', {page: 1}, httpClient, apiKey).then((rows) => rows.slice(0, 12)),
            tmdbListMerged('movie/now_playing', {page: 1, region: 'US'}, httpClient, apiKey).then((rows) => (
                rows.slice(0, 12).map((row) => ({...row, mediaType: 'movie'}))
            )),
        ])

        // Trailers from top trending day items (limit concurrent video lookups)
        const trailerSource = trendingDay.slice(0, 8)
        const trailerSettled = await Promise.all(
            trailerSource.map(async (item) => {
                const video = await tmdbVideos(item.mediaType, item.id, httpClient, apiKey)
                if (!video?.key) return null
                return {...item, trailer: video}
            }),
        )
        const trailers = trailerSettled.filter(Boolean).slice(0, 6)

        const payload = {
            ok: true,
            checkedAt: new Date().toISOString(),
            cacheTtlMs: LANDING_TMDB_TTL_MS,
            trendingDay,
            trendingWeek,
            nowPlaying,
            trailers,
        }
        landingTmdbCache = {at: Date.now(), payload}
        return payload
    } catch (error) {
        logAxiosError(error, logger, 'Landing TMDB catalogs failed')
        if (landingTmdbCache?.payload) {
            return {...landingTmdbCache.payload, stale: true}
        }
        return {
            ok: false,
            reason: error?.message ?? 'tmdb error',
            checkedAt: new Date().toISOString(),
            trendingDay: [],
            trendingWeek: [],
            nowPlaying: [],
            trailers: [],
        }
    }
}
