import axios from 'axios'

import HtmlSource, {decodePagePath, isHttpUrl, normalizeText} from './html-source.js'
import {logAxiosError} from '../utils.js'

const TYPE_PATH_PREFIXES = ['movie', 'serial', 'anime', 'korean', 'turkey']

function pathType(path) {
    const segment = String(path ?? '').split('/').filter(Boolean)[0]
    if (!TYPE_PATH_PREFIXES.includes(segment)) {
        return null
    }
    return segment === 'movie' ? 'movie' : 'series'
}

function isDetailPath(path) {
    return /^\/(movie|serial|anime|korean|turkey)\/[^/]+\/?$/.test(String(path ?? ''))
}

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

// Every download button links to `/?animex_go=<base64 JSON>.<signature>` —
// the base64 payload is plain JSON with the real target URL.
function decodeAnimexGoToken(href) {
    try {
        const url = new URL(href, 'https://animex.click/')
        const raw = url.searchParams.get('animex_go')
        if (!raw) {
            return null
        }
        const [payload] = raw.split('.')
        let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const pad = (4 - (b64.length % 4)) % 4
        if (pad) b64 += '='.repeat(pad)
        const json = Buffer.from(b64, 'base64').toString('utf-8')
        return JSON.parse(json)
    } catch {
        return null
    }
}

function isDirectVideoUrl(url) {
    return /\.(mkv|mp4|avi|m4v|mov)(\?|$)/i.test(String(url ?? ''))
}

function isDirectoryUrl(url) {
    const s = String(url ?? '')
    return /[?&]dir=/i.test(s)
        || /hollowofthealley\.space/i.test(s)
        || /\/\?dir=/i.test(s)
}

/** فصل سوم / Season 3 / S03 → number */
function extractSeasonNumber(...texts) {
    const blob = texts.filter(Boolean).join(' ')
    const en = blob.match(/(?:season|s)\s*([0-9]{1,2})\b/i)
    if (en) return Number(en[1])
    const faDigits = blob
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .match(/فصل\s*([0-9]{1,2})/)
    if (faDigits) return Number(faDigits[1])
    const words = {
        اول: 1, یک: 1, دوم: 2, دو: 2, سوم: 3, سه: 3, چهارم: 4, چهار: 4,
        پنجم: 5, پنج: 5, ششم: 6, شش: 6, هفتم: 7, هفت: 7, هشتم: 8, هشت: 8,
        نهم: 9, نه: 9, دهم: 10, ده: 10,
    }
    const faWord = blob.match(/فصل\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)/)
    if (faWord && words[faWord[1]]) return words[faWord[1]]
    return null
}

/** Attack on Titan S3 - 01 → ep 1; E12; قسمت ۱۲ */
function extractEpisodeNumber(name) {
    const s = String(name ?? '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    let m = s.match(/S\s*\d+\s*[-._\s]*E?\s*(\d{1,3})\b/i)
        || s.match(/S\d+\s*-\s*(\d{1,3})\b/i)
        || s.match(/\bE(?:P)?\s*(\d{1,3})\b/i)
        || s.match(/(?:قسمت|قسمت\s*[:\-]?)\s*(\d{1,3})/i)
        || s.match(/[-_\s](\d{1,3})\s*\[\s*(?:SS|WEB|1080|720|480)/i)
        || s.match(/[-_\s](\d{1,3})\.(?:mkv|mp4)/i)
    return m ? Number(m[1]) : null
}

export default class Animex extends HtmlSource {
    key = 'animex'

    constructor(baseUrl, logger = console, httpClient = axios) {
        super(baseUrl, logger, httpClient)
        this.providerID = `${this.key}${this.idSeparator}`
    }

    async search(text) {
        const query = normalizeText(text)
        if (!this.baseUrl || !query) {
            return []
        }

        try {
            // Prefer pretty search path used by the site, fall back to ?s=
            let $ = await this.fetchDocument(`/search/${encodeURIComponent(query).replace(/%20/g, '+')}/`)
            if (!$) {
                $ = await this.fetchDocument('/', {
                    params: {
                        s: query,
                        'customset[]': ['movie', 'serial', 'anime', 'korean', 'turkey'],
                    },
                })
            }
            if (!$) {
                return []
            }

            const results = []
            const lcQuery = query.toLowerCase().replace(/\s+/g, ' ').trim()
            const compactQuery = lcQuery.replace(/\s+/g, '')
            const queryCore = lcQuery
                .replace(/\b(season|series|s)\s*\d+\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            $('a[href]').each((_, anchor) => {
                const href = $(anchor).attr('href')
                const path = this.pagePath(href)
                if (!path || !isDetailPath(path)) {
                    return
                }

                const id = this.pageId(path)
                const name = normalizeText(
                    $(anchor).attr('title')
                        || $(anchor).text()
                        || $(anchor).find('img').attr('alt')
                        || '',
                )
                if (!id || !name) {
                    return
                }
                const lcName = name.toLowerCase().replace(/\s+/g, ' ').trim()
                const compactName = lcName.replace(/\s+/g, '')
                const nameCore = lcName
                    .replace(/\b(season|series|s)\s*\d+\b/gi, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                const matched = lcName.includes(lcQuery)
                    || compactName.includes(compactQuery)
                    || (queryCore && nameCore.includes(queryCore))
                    || (queryCore && nameCore.replace(/\s+/g, '').includes(queryCore.replace(/\s+/g, '')))
                    || path.toLowerCase().includes(compactQuery)
                    || path.toLowerCase().replace(/-/g, '').includes(compactQuery)
                if (!matched) {
                    return
                }

                const type = pathType(path)
                const poster = $(anchor).find('img').attr('src')
                    ?? $(anchor).closest('article, .item, li, .post').find('img').first().attr('src')
                    ?? null

                results.push({id, name, poster, type, genres: []})
            })

            return uniqueLinks(
                results.map((r) => ({...r, url: r.id})),
                (r) => r.id,
            ).map(({url, ...rest}) => rest)
        } catch (error) {
            logAxiosError(error, this.logger, 'Animex search failed')
            return []
        }
    }

    /**
     * Directory listing (multi-episode). Often only reachable from IR IP.
     * Tries several parsers; returns [] on network block.
     */
    async fetchDirectoryFiles(directoryUrl, groupLabel, defaultSeason = null) {
        try {
            const response = await this.httpClient.get(directoryUrl, {
                ...this.requestConfig(),
                timeout: Math.max(this.requestConfig()?.timeout || 15000, 20000),
                maxRedirects: 5,
                headers: {
                    ...(this.requestConfig()?.headers || {}),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
                },
            })
            const html = typeof response.data === 'string' ? response.data : ''
            if (!html || html.length < 50) {
                return []
            }
            const {load} = await import('cheerio')
            const $ = load(html)

            const files = []
            const pushFile = (name, url, size) => {
                if (!url || !isHttpUrl(url)) return
                if (!isDirectVideoUrl(url) && !/\.(mkv|mp4)/i.test(name)) return
                const absolute = url.startsWith('http') ? url : new URL(url, directoryUrl).toString()
                const episode = extractEpisodeNumber(name)
                const season = extractSeasonNumber(name, groupLabel) ?? defaultSeason
                files.push({
                    url: absolute,
                    season,
                    episode,
                    quality: groupLabel || null,
                    size: size || null,
                    title: name,
                })
            }

            $('li[data-type="file"]').each((_, item) => {
                const name = $(item).attr('data-name') ?? $(item).find('.name-text, .file-name').first().text()
                const href = $(item).find('a[href]').first().attr('href')
                const size = normalizeText($(item).find('.file-size').first().text()) || null
                pushFile(normalizeText(name), href, size)
            })

            // Fallback: any video link in listing
            if (!files.length) {
                $('a[href]').each((_, a) => {
                    const href = $(a).attr('href')
                    const name = normalizeText($(a).attr('data-name') || $(a).text() || href)
                    if (href && isDirectVideoUrl(href)) {
                        pushFile(name, href, null)
                    }
                })
            }

            return files
        } catch (error) {
            logAxiosError(error, this.logger, 'Animex directory listing fetch failed')
            return []
        }
    }

    async getMovieData(type, id) {
        const path = decodePagePath(id)
        if (!this.baseUrl || !path || !isDetailPath(path)) {
            return null
        }

        try {
            const $ = await this.fetchDocument(path)
            if (!$) {
                return null
            }

            const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
            const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
            const title = normalizeText($('h1').first().text())
            const resolvedType = pathType(path) ?? type
            const pageSeason = extractSeasonNumber(title, path)

            const downloadTokens = []
            $('a[href*="animex_go="]').each((_, anchor) => {
                const label = normalizeText($(anchor).text())
                if (/پخش/.test(label)) {
                    return
                }
                const token = decodeAnimexGoToken($(anchor).attr('href'))
                if (token?.action === 'download' && token.target) {
                    downloadTokens.push(token)
                }
            })

            const links = []
            const directoryJobs = []
            const externalFallbacks = []

            for (const token of downloadTokens) {
                const groupLabel = [token.group_title, token.quality].filter(Boolean).join(' ')
                const seasonHint = extractSeasonNumber(token.group_title, token.quality, groupLabel, title)
                    ?? pageSeason

                if (isDirectVideoUrl(token.target)) {
                    links.push({
                        url: token.target,
                        quality: groupLabel || null,
                        title: groupLabel,
                        season: seasonHint,
                        episode: extractEpisodeNumber(token.target) || extractEpisodeNumber(groupLabel),
                    })
                    continue
                }

                // Multi-episode directory (series / anime seasons)
                if (resolvedType === 'series' || isDirectoryUrl(token.target)) {
                    if (directoryJobs.length < 6) {
                        directoryJobs.push(
                            this.fetchDirectoryFiles(token.target, groupLabel, seasonHint)
                                .then((files) => ({files, token, groupLabel, seasonHint})),
                        )
                    }
                }
            }

            if (directoryJobs.length) {
                const settled = await Promise.allSettled(directoryJobs)
                for (const result of settled) {
                    if (result.status !== 'fulfilled') continue
                    const {files, token, groupLabel, seasonHint} = result.value
                    if (files.length) {
                        links.push(...files)
                    } else if (token?.target) {
                        // CDN blocked from non-IR IP — give user a browser open
                        // so they can use their own (often IR) network.
                        externalFallbacks.push({
                            url: token.target,
                            externalUrl: token.target,
                            quality: groupLabel || null,
                            title: `${groupLabel || 'دانلود'} — باز کردن در مرورگر`,
                            season: seasonHint,
                            episode: null,
                            behaviorHints: {notWebReady: true},
                        })
                    }
                }
            }

            // Deduplicate by url
            const merged = uniqueLinks([...links, ...externalFallbacks])

            return {
                path,
                title,
                imdbId,
                isSeries: resolvedType === 'series',
                pageSeason,
                links: merged,
            }
        } catch (error) {
            logAxiosError(error, this.logger, 'Animex detail request failed')
            return null
        }
    }

    getMovieLinks(movieData) {
        return Array.isArray(movieData?.links) ? movieData.links : []
    }

    getSeriesLinks(movieData, videoId) {
        const parts = String(videoId ?? '').split(':')
        // videoId forms: tt123:1:2 or providerId:1:2
        const season = Number(parts[parts.length - 2])
        const episode = Number(parts[parts.length - 1])
        if (!Number.isInteger(season) || !Number.isInteger(episode)) {
            return []
        }
        const links = this.getMovieLinks(movieData)
        const matched = links.filter((item) => {
            if (item.externalUrl && (item.episode == null || item.episode === episode)) {
                // directory fallback — only show on ep 1 to avoid spam, or always
                return item.episode == null || item.episode === episode
            }
            const s = item.season != null ? Number(item.season) : movieData?.pageSeason
            const e = item.episode != null ? Number(item.episode) : null
            if (e == null) return false
            // If season missing on file, accept episode match when page is that season
            if (s == null) return e === episode
            return s === season && e === episode
        })
        // If nothing matched but we only have external directory links, surface them
        if (!matched.length) {
            return links.filter((item) => item.externalUrl)
        }
        return matched
    }

    getLinks(type, videoId, movieData) {
        if (movieData?.isSeries) {
            return this.getSeriesLinks(movieData, videoId)
        }
        return this.getMovieLinks(movieData)
    }

    async imdbID(movieData) {
        return movieData?.imdbId ?? null
    }
}
