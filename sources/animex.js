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

function numberFromText(value) {
    const normalized = String(value ?? '')
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
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

// Every download button links to `/?animex_go=<base64 JSON>.<signature>` — the
// base64 payload is plain (unencrypted) JSON containing the real target URL
// plus quality/group labels, so we can read it directly without ever hitting
// that redirect endpoint.
function decodeAnimexGoToken(href) {
    try {
        const url = new URL(href, 'https://animex.click/')
        const raw = url.searchParams.get('animex_go')
        if (!raw) {
            return null
        }
        const [payload] = raw.split('.')
        const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4)
        const json = Buffer.from(padded, 'base64').toString('utf-8')
        return JSON.parse(json)
    } catch {
        return null
    }
}

function isDirectVideoUrl(url) {
    return /\.(mkv|mp4|avi)(\?|$)/i.test(String(url ?? ''))
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
            const $ = await this.fetchDocument('/', {
                params: {
                    s: query,
                    'customset[]': ['movie', 'serial', 'anime', 'korean', 'turkey'],
                },
            })
            if (!$) {
                return []
            }

            const results = []
            // Normalize query for anime titles like "Grand Blue" vs "GrandBlue Season 1"
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
                if (!matched) {
                    return
                }

                const type = pathType(path)
                const poster = $(anchor).find('img').attr('src')
                    ?? $(anchor).closest('article, .item, li').find('img').first().attr('src')
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

    // A season/quality "download" button points at a directory-listing page
    // rather than a single file. Fetch it and read each episode's own name +
    // size directly from the file list.
    async fetchDirectoryFiles(directoryUrl, groupLabel) {
        try {
            const response = await this.httpClient.get(directoryUrl, this.requestConfig())
            const html = typeof response.data === 'string' ? response.data : ''
            const {load} = await import('cheerio')
            const $ = load(html)

            const files = []
            $('li[data-type="file"]').each((_, item) => {
                const name = $(item).attr('data-name') ?? ''
                const url = $(item).find('a[href]').first().attr('href')
                if (!url || !isHttpUrl(url)) {
                    return
                }
                const size = normalizeText($(item).find('.file-size').first().text()) || null
                const seasonEpisode = name.match(/S(\d+)\s*-\s*(\d+)/i) ?? name.match(/S(\d+)E(\d+)/i)
                const season = seasonEpisode ? Number(seasonEpisode[1]) : null
                const episode = seasonEpisode ? Number(seasonEpisode[2]) : null
                files.push({url, season, episode, quality: groupLabel || null, size, title: name})
            })
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

            const downloadTokens = []
            $('a[href*="animex_go="]').each((_, anchor) => {
                // Only "download" actions — skip the separate "پخش آنلاین" (watch
                // online / stream) buttons, which point at a different service.
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
            for (const token of downloadTokens) {
                const groupLabel = [token.group_title, token.quality].filter(Boolean).join(' ')
                if (isDirectVideoUrl(token.target)) {
                    links.push({url: token.target, quality: groupLabel || null, title: groupLabel})
                    continue
                }
                if (resolvedType === 'series') {
                    // Cap how many season/quality directory pages we hit so a
                    // single series detail cannot burn the whole serverless
                    // budget (each page used to run serially with a 15s timeout).
                    if (directoryJobs.length < 4) {
                        directoryJobs.push(this.fetchDirectoryFiles(token.target, groupLabel))
                    }
                }
            }
            if (directoryJobs.length) {
                const settled = await Promise.allSettled(directoryJobs)
                for (const result of settled) {
                    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                        links.push(...result.value)
                    }
                }
            }

            return {path, title, imdbId, isSeries: resolvedType === 'series', links: uniqueLinks(links)}
        } catch (error) {
            logAxiosError(error, this.logger, 'Animex detail request failed')
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
        if (!Number.isInteger(season) || !Number.isInteger(episode)) {
            return []
        }
        return this.getMovieLinks(movieData)
            .filter((item) => item.season === season && item.episode === episode)
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
