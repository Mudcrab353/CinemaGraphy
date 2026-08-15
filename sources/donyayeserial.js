import axios from 'axios'

import HtmlSource, {decodePagePath, isHttpUrl, normalizeText} from './html-source.js'
import {logAxiosError} from '../utils.js'

function numberFromText(value) {
    const normalized = String(value ?? '')
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    const match = normalized.match(/\d+/)
    return match ? Number(match[0]) : null
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

function filenameFromUrl(url) {
    try {
        const {pathname} = new URL(url)
        const raw = decodeURIComponent(pathname.split('/').pop() ?? '')
        return raw.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ')
    } catch {
        return ''
    }
}

function audioTypeFromText(text) {
    if (/دوبله/.test(text)) {
        return 'dubbed'
    }
    if (/ساب|زیرنویس/.test(text)) {
        return 'subtitled'
    }
    return null
}

// -----------------------------------------------------------------
// Movies: a single "#content-downloads .download_box" holds several
// <p> sections. Section headers (no <a> inside) announce the audio
// version ("نسخه سافت ساب فارسی" / "نسخه دوبله فارسی"); every <p><a>
// after a header is one download link until the next header.
//
// Link text is self-describing, e.g.:
//   "دانلود با کیفیت 1080p Web-DL x265 10bit ریلیز PSA (حجم: 1.47 GB)"
// -----------------------------------------------------------------

function parseMovieLinks($) {
    const links = []
    let audioType = null

    $('#content-downloads .download_box p').each((_, p) => {
        const $p = $(p)
        const anchor = $p.find('a[href]').first()
        if (!anchor.length) {
            const headerType = audioTypeFromText($p.text())
            if (headerType) {
                audioType = headerType
            }
            return
        }

        const url = anchor.attr('href')
        if (!isHttpUrl(url)) {
            return
        }
        const linkText = normalizeText(anchor.text())
        const quality = normalizeText(linkText.match(/کیفیت\s+(.+?)\s+ریلیز/)?.[1] ?? '') || null
        const size = linkText.match(/حجم:\s*([\d.,]+\s*(?:GB|MB))/i)?.[1] ?? null

        links.push({url, quality, size, audioType, title: linkText})
    })

    return uniqueLinks(links)
}

// -----------------------------------------------------------------
// Series: same download_box, but each release is announced by a
// header line like:
//   "فصل: 1 / کیفیت: 1080p Web-DL / میانگین حجم: 915.09 MB / ورژن: سافت ساب فارسی / قسمت ها: 8"
// followed by a <p> containing one <a>قسمت N</a> per episode.
// -----------------------------------------------------------------

const SEASON_HEADER_RE = /فصل:\s*(\d+)\s*\/\s*کیفیت:\s*(.+?)\s*\/\s*میانگین\s*حجم:\s*(.+?)\s*\/\s*ورژن:\s*(.+?)\s*\/\s*قسمت/

function parseSeriesLinks($) {
    const links = []
    let current = null

    $('#content-downloads .download_box p').each((_, p) => {
        const $p = $(p)
        const text = normalizeText($p.text())
        const header = text.match(SEASON_HEADER_RE)
        if (header) {
            const [, seasonText, quality, sizeText, versionText] = header
            const size = /^[-—]+$/.test(normalizeText(sizeText)) ? null : normalizeText(sizeText)
            current = {
                season: Number(seasonText),
                quality: normalizeText(quality),
                size,
                audioType: audioTypeFromText(versionText),
            }
            return
        }
        if (!current) {
            return
        }

        $p.find('a[href]').each((__, a) => {
            const $a = $(a)
            const url = $a.attr('href')
            if (!isHttpUrl(url)) {
                return
            }
            const episode = numberFromText($a.text())
            if (!episode) {
                return
            }
            const titleParts = [
                `S${current.season}E${String(episode).padStart(2, '0')}`,
                current.quality,
                filenameFromUrl(url),
            ].filter(Boolean)
            links.push({
                season: current.season,
                episode,
                quality: current.quality || null,
                size: current.size,
                audioType: current.audioType,
                url,
                title: titleParts.join(' - '),
            })
        })
    })

    return uniqueLinks(links, (item) => `${item.season}:${item.episode}:${item.audioType}:${item.url}`)
}

function parseMovieDetail($, path) {
    const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1').first().text()).replace(/^فیلم\s+/, '')
    return {path, title, imdbId, isSeries: false, links: parseMovieLinks($)}
}

function parseSeriesDetail($, path) {
    const imdbHref = $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1').first().text()).replace(/^سریال\s+/, '')
    return {path, title, imdbId, isSeries: true, links: parseSeriesLinks($)}
}

function isDetailPath(type, path) {
    if (type === 'series') {
        return /^\/series\/[^/]+\/?$/.test(path)
    }
    if (type === 'movie') {
        const reserved = /^\/(series|category|tag|actors|director|news|page|wp-)/
        return /^\/[^/]+\/?$/.test(path) && !reserved.test(path)
    }
    return false
}

export default class Donyayeserial extends HtmlSource {
    key = 'donyayeserial'

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
            const $ = await this.fetchDocument('/', {params: {s: query}})
            if (!$) {
                return []
            }

            const results = []
            // WordPress ?s= already ranks relevance. Titles are often Persian-only
            // while Stremio searches with English — do not require Latin tokens in name.
            $('article.postItems').each((_, article) => {
                const anchor = $(article).find('.post-title h2 a[href]').first()
                const href = anchor.attr('href')
                const path = this.pagePath(href)
                if (!path) {
                    return
                }

                const type = path.startsWith('/series/') ? 'series' : 'movie'
                if (!isDetailPath(type, path)) {
                    return
                }

                const id = this.pageId(path)
                const name = normalizeText(anchor.text())
                if (!id || !name) {
                    return
                }

                const poster = $(article).find('.imgWrapper img').first().attr('src') ?? null
                results.push({id, name, poster, type, genres: []})
            })

            return results.slice(0, 12)
        } catch (error) {
            logAxiosError(error, this.logger, 'DonyayeSerial search failed')
            return []
        }
    }

    async getMovieData(type, id) {
        const path = decodePagePath(id)
        if (!this.baseUrl || !path || !isDetailPath(type, path)) {
            return null
        }

        try {
            const $ = await this.fetchDocument(path)
            if (!$) {
                return null
            }
            return type === 'series' ? parseSeriesDetail($, path) : parseMovieDetail($, path)
        } catch (error) {
            logAxiosError(error, this.logger, 'DonyayeSerial detail request failed')
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
        if (!Number.isInteger(season) || !Number.isInteger(episode) || episode < 1) {
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

    async imdbID(movieData) {
        return movieData?.imdbId ?? null
    }
}
