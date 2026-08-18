import axios from 'axios'

import HtmlSource, {decodePagePath, isHttpUrl, normalizeText} from './html-source.js'
import {logAxiosError, searchAndGetTMDB} from '../utils.js'

const PERSIAN_SEASONS = new Map([
    ['اول', 1],
    ['دوم', 2],
    ['سوم', 3],
    ['چهارم', 4],
    ['پنجم', 5],
    ['ششم', 6],
    ['هفتم', 7],
    ['هشتم', 8],
    ['نهم', 9],
    ['دهم', 10],
])

function uniqueLinks(items, keyFor = (item) => item.url) {
    const seen = new Set()
    return items.filter((item) => {
        const key = keyFor(item)
        if (!item.url || seen.has(key)) {
            return false
        }
        seen.add(key)
        return true
    })
}

function numberFromText(value) {
    const normalized = String(value ?? '')
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    const match = normalized.match(/\d+/)
    return match ? Number(match[0]) : null
}

function seasonFromText(value, fallback) {
    const text = normalizeText(value)
    const numeric = numberFromText(text.match(/فصل\s*[۰-۹٠-٩\d]+/)?.[0])
    if (numeric != null) {
        return numeric
    }
    for (const [word, season] of PERSIAN_SEASONS) {
        if (text.includes(`فصل ${word}`)) {
            return season
        }
    }
    return fallback
}

function urlFromOnclick(value) {
    const match = String(value ?? '').match(/handleDownloadClick\(\s*(['"])(https?:\/\/.*?)\1/)
    return match?.[2] ?? null
}

function extractQualityFromFilename(url) {
    const s = String(url ?? '')
    // S01E01.720p.WEB-DL... or .../720p/... or _1080p_
    const match = s.match(/(?:^|[._\-\/\s])((?:2160|1080|720|480|360)p)(?:[._\-\/\s]|$)/i)
        || s.match(/\b((?:2160|1080|720|480|360)p)\b/i)
        || s.match(/[._\-](\d{3,4}p)\b/i)
    return match?.[1]?.toLowerCase() ?? null
}

/** Prefer a token that actually names a resolution / source. */
function pickQualityLabel(...candidates) {
    const cleaned = candidates.map((c) => normalizeText(c)).filter(Boolean)
    for (const c of cleaned) {
        if (/(?:2160|1080|720|480|360)\s*p|\b4k\b|blu-?ray|web-?dl|webrip|hdrip|hdtv/i.test(c)) {
            return c
        }
    }
    return cleaned[0] || ''
}

function filenameFromUrl(url) {
    try {
        const {pathname} = new URL(url)
        const raw = decodeURIComponent(pathname.split('/').pop() ?? '')
        // Filenames are dot/underscore-separated (e.g. "S01E01.1080p.WEB.DL.Farsi.Sub.mkv") —
        // turn separators into spaces so the shared quality/audio regexes (which expect
        // word-boundary-separated tokens) can actually match them.
        return raw.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ')
    } catch {
        return ''
    }
}

function mediaUrl($element) {
    const href = $element.attr('href')
    if (isHttpUrl(href)) {
        return href
    }
    const onclickUrl = urlFromOnclick($element.attr('onclick'))
    return isHttpUrl(onclickUrl) ? onclickUrl : null
}

function blockAudioType(blockElement, $) {
    const classAttr = $(blockElement).attr('class') ?? ''
    if (/dub/i.test(classAttr)) {
        return 'dubbed'
    }
    if (/sub/i.test(classAttr)) {
        return 'subtitled'
    }
    return null
}

function labeledFieldValue($, blockElement, labelPattern) {
    let value = ''
    $(blockElement).find('.text-muted').each((_, el) => {
        if (labelPattern.test($(el).text())) {
            const full = normalizeText($(el).parent().text())
            value = normalizeText(full.replace(normalizeText($(el).text()), ''))
        }
    })
    return value && value !== '—' ? value : ''
}

function parseMovieLinks($) {
    const links = []
    $('#downloads .download-list').each((_, block) => {
        const audioType = blockAudioType(block, $)
        const encoder = labeledFieldValue($, block, /انکودر/)

        $(block).find('li').each((__, item) => {
            const rawQ = normalizeText($(item).find('.text[dir="ltr"]').first().text())
            const url = mediaUrl($(item).find('a[download][href], a[onclick*="handleDownloadClick"]').first())
            if (!url) {
                return
            }
            const quality = pickQualityLabel(extractQualityFromFilename(url), rawQ) || rawQ || extractQualityFromFilename(url) || ''
            const titleParts = [quality, encoder, filenameFromUrl(url)].filter(Boolean)
            links.push({url, quality: quality || null, audioType, title: titleParts.join(' - ')})
        })
    })
    return uniqueLinks(links)
}

function parseSeriesLinks($) {
    const links = []
    $('#downloads .download-season').each((seasonIndex, seasonElement) => {
        const season = seasonFromText(
            normalizeText($(seasonElement).children('button').first().text()),
            seasonIndex + 1,
        )

        $(seasonElement).find('.download-list').each((_, block) => {
            const audioType = blockAudioType(block, $)
            const size = labeledFieldValue($, block, /حجم/)
            const encoder = labeledFieldValue($, block, /انکودر/)
            // Quality often lives in a labeled row or the first LTR badge — do not
            // reuse a single wrong page-level token across every quality group.
            const qualityFromLabel = labeledFieldValue($, block, /کیفیت|quality/i)
            const ltrTexts = []
            $(block).find('.text[dir="ltr"]').each((__, el) => {
                const tx = normalizeText($(el).text())
                if (tx) ltrTexts.push(tx)
            })
            const blockQuality = pickQualityLabel(qualityFromLabel, ...ltrTexts)

            $(block).find('.series-downloaditems > .d-flex').each((episodeIndex, episodeElement) => {
                const directLink = $(episodeElement).find('a.btn-default[href]').last()
                const fallbackLink = $(episodeElement).find('a[onclick*="handleDownloadClick"]').first()
                const url = mediaUrl(directLink.length ? directLink : fallbackLink)
                const episode = numberFromText(directLink.text()) ?? episodeIndex + 1
                if (!url) {
                    return
                }
                // Per-row hints (some themes put 720p on the episode row itself)
                const rowText = normalizeText($(episodeElement).text())
                const fromFile = extractQualityFromFilename(url)
                const fromRow = pickQualityLabel(rowText)
                const resolvedQuality = pickQualityLabel(fromFile, fromRow, blockQuality) || fromFile || blockQuality || ''
                const titleParts = [
                    `S${season}E${String(episode).padStart(2, '0')}`,
                    resolvedQuality,
                    encoder,
                    filenameFromUrl(url),
                ].filter(Boolean)
                links.push({
                    season,
                    episode,
                    quality: resolvedQuality || null,
                    size: size || null,
                    audioType,
                    url,
                    title: titleParts.join(' - '),
                })
            })
        })
    })
    return uniqueLinks(links, (item) => `${item.season}:${item.episode}:${item.url}`)
}

function parseF2MediaMovieDetail($, path) {
    const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1.entry-title').first().text())
    const links = parseMovieLinks($)
    return {path, title, imdbId, isSeries: false, links}
}

function parseF2MediaSeriesDetail($, path) {
    const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1.entry-title').first().text())
    const links = parseSeriesLinks($)
    return {path, title, imdbId, isSeries: true, links}
}

function isDetailPath(type, path) {
    if (type === 'series') {
        return /^\/series\/[^/]+\/$/.test(path)
    }
    return type === 'movie' && /^\/\d+\/[^/]+\/$/.test(path)
}

export default class F2Media extends HtmlSource {
    key = 'f2media'

    constructor(baseUrl, logger = console, httpClient = axios, env = process.env) {
        super(baseUrl, logger, httpClient)
        this.providerID = `${this.key}${this.idSeparator}`
        this.tmdbApiKey = env.TMDB_API_KEY
    }

    async isLogin() {
        return true
    }

    async login() {
        return true
    }

    async search(text) {
        const query = normalizeText(text)
        if (!this.baseUrl) {
            this.logger.warn('F2Media search skipped', {reason: 'F2MEDIA_BASEURL is missing'})
            return []
        }
        if (!query) {
            this.logger.debug('F2Media search skipped', {reason: 'empty query'})
            return []
        }

        try {
            this.logger.debug('F2Media search started', {query, baseUrl: this.baseUrl})
            const $ = await this.fetchDocument('/', {params: {s: query}})
            if (!$) {
                return []
            }

            const results = []
            const q = query.toLowerCase()

            $('article.entry a.stretched-link[rel="bookmark"]').each((_, anchor) => {
                const item = $(anchor).closest('article.entry')
                const href = $(anchor).attr('href')
                const path = this.pagePath(href)
                const id = this.pageId(path)
                const name = normalizeText($(anchor).find('.entry-title').text())

                if (!id || !name || !path) {
                    return
                }

                if (!name.toLowerCase().includes(q)) {
                    return
                }

                const type = path.startsWith('/series/') ? 'series' : 'movie'
                if (!isDetailPath(type, path)) {
                    return
                }

                const poster = item.find('figure.entry-cover img').first().attr('src') ?? null

                results.push({
                    id,
                    name,
                    poster,
                    type,
                    genres: [],
                })
            })

            this.logger.debug('F2Media search completed', {query, resultCount: results.length, method: 'html'})
            if (results.length > 0) {
                return results
            }

            this.logger.debug('F2Media search falling back to REST API', {query})
            const restUrl = `${this.baseUrl}/wp-json/wp/v2`
            const lcQuery = query.toLowerCase()
            const fallbackResults = []

            const [postsRes, seriesRes] = await Promise.allSettled([
                this.httpClient.get(`${restUrl}/posts?search=${encodeURIComponent(query)}&per_page=10`, {
                    timeout: 10_000,
                    headers: this.requestConfig().headers,
                }),
                this.httpClient.get(`${restUrl}/series?search=${encodeURIComponent(query)}&per_page=10`, {
                    timeout: 10_000,
                    headers: this.requestConfig().headers,
                }),
            ])

            for (const res of [postsRes, seriesRes]) {
                if (res.status !== 'fulfilled' || !Array.isArray(res.value?.data)) {
                    continue
                }
                for (const item of res.value.data) {
                    const link = item.link ?? ''
                    const path = this.pagePath(link)
                    const id = this.pageId(path)
                    const name = item.title?.rendered
                        ? normalizeText(item.title.rendered).replace(/^(دانلود\s+(فیلم|سریال)\s+)/, '').trim()
                        : ''
                    if (!id || !name || !name.toLowerCase().includes(lcQuery)) {
                        continue
                    }
                    const type = path?.startsWith('/series/') ? 'series' : 'movie'
                    if (!isDetailPath(type, path)) {
                        continue
                    }
                    const imgUrl = item.featured_media_url ?? item.jetpack_featured_media_url ?? null
                    fallbackResults.push({id, name, poster: imgUrl, type, genres: []})
                }
            }

            this.logger.debug('F2Media search completed', {
                query,
                resultCount: fallbackResults.length,
                method: 'rest-api',
            })
            return fallbackResults
        } catch (error) {
            logAxiosError(error, this.logger, 'F2Media search failed')
            return []
        }
    }

    async getMovieData(type, id) {
        const path = decodePagePath(id)
        if (!this.baseUrl || !path || !isDetailPath(type, path)) {
            return null
        }

        try {
            this.logger.debug('F2Media detail started', {type, path})
            const $ = await this.fetchDocument(path)
            const result = $
                ? (type === 'series' ? parseF2MediaSeriesDetail($, path) : parseF2MediaMovieDetail($, path))
                : null
            this.logger.debug('F2Media detail completed', {
                type,
                path,
                linkCount: result?.links.length ?? 0,
                imdbId: result?.imdbId ?? null,
            })
            return result
        } catch (error) {
            logAxiosError(error, this.logger, 'F2Media detail request failed')
            return null
        }
    }

    getMovieLinks(movieData) {
        return Array.isArray(movieData?.links) ? movieData.links : []
    }

    getSeriesLinks(movieData, videoId) {
        const [, seasonText, episodeText] = String(videoId ?? '').split(':')
        const season = Number(seasonText)
        const episode = Number(episodeText)
        if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 0 || episode < 1) {
            return []
        }
        return this.getMovieLinks(movieData)
            .filter((item) => item.season === season && item.episode === episode)
    }

    getLinks(type, videoId, movieData) {
        if (type === 'movie') {
            return this.getMovieLinks(movieData)
        }
        if (type === 'series') {
            return this.getSeriesLinks(movieData, videoId)
        }
        return []
    }

    async imdbID(movieData, type) {
        if (movieData?.imdbId) {
            return movieData.imdbId
        }
        const title = normalizeText(movieData?.title ?? '').replace(/\s+(?:19|20)\d{2}$/, '')
        if (!title) {
            return null
        }
        const tmdbData = await searchAndGetTMDB(title, type, this.httpClient, this.logger, this.tmdbApiKey)
        return tmdbData?.external_ids?.imdb_id ?? null
    }
}
