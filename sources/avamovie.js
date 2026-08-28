/**
 * AvaMovie (avamovie.shop) — VIP / account-backed HTML provider.
 *
 * Auth priority (less load on addon host):
 *   1) AVAMOVIE_COOKIE  — paste browser Cookie header after login+VIP
 *   2) username+password — best-effort (site uses captcha; often fails on CF)
 *
 * Only intended for personal /c/{config}/ installs. Users supply their own
 * VIP account; session expiry is on AvaMovie's side (often hours–daily).
 */

import axios from 'axios'
import HtmlSource, {decodePagePath, encodePagePath, isHttpUrl, normalizeText} from './html-source.js'
import {logAxiosError, REQUEST_TIMEOUT_MS} from '../utils.js'

const DEFAULT_BASE = 'https://avamovie.shop'

function normalizeDigits(text) {
    return String(text ?? '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

function collectSetCookies(response) {
    const raw = response?.headers?.['set-cookie'] ?? response?.headers?.get?.('set-cookie')
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
}

function mergeCookies(existingCookieHeader, setCookieHeaders) {
    const jar = new Map()
    for (const part of String(existingCookieHeader || '').split(';')) {
        const i = part.indexOf('=')
        if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
    }
    for (const header of setCookieHeaders) {
        const first = String(header).split(';')[0]
        const i = first.indexOf('=')
        if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim())
    }
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

function isSeriesPath(path) {
    return /^\/series\/[^/]+\/?$/i.test(path)
}

/** Movies may be /movies/slug/ or root /slug/ */
function isMoviePath(path) {
    if (/^\/movies\/[^/]+\/?$/i.test(path)) return true
    if (isSeriesPath(path)) return false
    const reserved =
        /^\/(series|movies|movie-dub|series-dub|account|sign-in|sign-up|search|genre|category|tag|page|wp-|buy-subscription|profile|peoples|app|streams|animation|anime|doc|oscar|list|collections|boxoffice|250|country|east-asian|contact|faq|forget)/i
    return /^\/[^/]+\/?$/.test(path) && !reserved.test(path)
}

function qualityFromText(...parts) {
    const blob = parts.filter(Boolean).join(' ')
    const m = blob.match(/\b(2160p|1080p|720p|480p|360p|4k)\b/i)
    if (m) return /4k/i.test(m[1]) ? '2160p' : m[1].toLowerCase()
    return normalizeText(blob).slice(0, 80) || null
}

function parseImdb($) {
    const href =
        $('a[href*="imdb.com/title/tt"]').first().attr('href')
        || ''
    return href.match(/\/title\/(tt\d+)/)?.[1] ?? null
}

function parseTitle($, type) {
    let t = normalizeText($('h1').first().text() || $('title').first().text() || '')
    t = t
        .replace(/^دانلود\s+(انیمیشن|انیمه|سریال(?:\s+کره‌ای)?|فیلم)\s+/i, '')
        .replace(/\s*-\s*آوا\s*مووی.*$/i, '')
        .trim()
    return t
}

function parseSeriesDetail($, path) {
    const imdbId = parseImdb($)
    const title = parseTitle($, 'series')
    const links = []

    $('.dl-item').each((_, seasonBlock) => {
        const seasonLabel = normalizeText($(seasonBlock).find('.season, .item-header .text').first().text())
        const season = Number(normalizeDigits(seasonLabel).match(/\d+/)?.[0]) || 1

        $(seasonBlock).find('.card').each((__, card) => {
            const qText = normalizeText(
                $(card).find('.title, .card-header .text').first().text(),
            )
            const size = normalizeText($(card).find('.size').first().text()).replace(/^حجم:\s*/i, '') || null
            const quality = qualityFromText(qText)

            $(card).find('.series-dl-links a.main[href], .series-dl-links a[href*="http"]').each((episodeIndex, anchor) => {
                let url = $(anchor).attr('href')
                if (!url || !isHttpUrl(url)) return
                url = url.replace(/&amp;/g, '&')
                if (/buy-subscription/i.test(url)) return

                const t = normalizeText($(anchor).attr('title') || $(anchor).text())
                const episode =
                    Number(normalizeDigits(t).match(/\d+/)?.[0])
                    || Number(String(url).match(/[Ss]\d+[Ee](\d+)/)?.[1])
                    || episodeIndex + 1

                links.push({
                    url,
                    season,
                    episode,
                    quality,
                    size,
                    title: quality || t || '',
                    audioType: /softsub|زیرنویس/i.test(qText + t) ? 'sub' : null,
                })
            })
        })
    })

    // Fallback: any CDN episode links on page
    if (!links.length) {
        $('a[href*=".mkv"], a[href*=".mp4"]').each((_, anchor) => {
            let url = $(anchor).attr('href')
            if (!url || !isHttpUrl(url) || /buy-subscription/i.test(url)) return
            url = url.replace(/&amp;/g, '&')
            const file = url.split('?')[0]
            const se = file.match(/[Ss](\d+)[Ee](\d+)/)
            const quality = qualityFromText(file, $(anchor).attr('title'), $(anchor).text())
            links.push({
                url,
                season: se ? Number(se[1]) : 1,
                episode: se ? Number(se[2]) : 1,
                quality,
                size: null,
                title: quality || '',
            })
        })
    }

    return {path, title, imdbId, isSeries: true, links}
}

function parseMovieDetail($, path) {
    const imdbId = parseImdb($)
    const title = parseTitle($, 'movie')
    const links = []

    $('.movie-dl-links a.link-main[href], .movie-dl-links a[href*="http"]').each((_, anchor) => {
        let url = $(anchor).attr('href')
        if (!url || !isHttpUrl(url) || /buy-subscription/i.test(url)) return
        url = url.replace(/&amp;/g, '&')
        const cardText = normalizeText($(anchor).closest('.card, .dl-row').find('.title, .card-header').text())
        const quality = qualityFromText(url, cardText, $(anchor).attr('title'))
        const size = normalizeText($(anchor).closest('.dl-row, .card').find('.size').first().text()) || null
        links.push({
            url,
            quality,
            size,
            title: quality || normalizeText($(anchor).text()) || '',
            audioType: /softsub|زیرنویس/i.test(cardText) ? 'sub' : null,
        })
    })

    if (!links.length) {
        $('a[href*=".mkv"], a[href*=".mp4"]').each((_, anchor) => {
            let url = $(anchor).attr('href')
            if (!url || !isHttpUrl(url) || /buy-subscription/i.test(url)) return
            url = url.replace(/&amp;/g, '&')
            const quality = qualityFromText(url, $(anchor).attr('title'))
            links.push({url, quality, size: null, title: quality || ''})
        })
    }

    return {path, title, imdbId, isSeries: false, links}
}

export default class Avamovie extends HtmlSource {
    key = 'avamovie'

    constructor(baseUrl, logger = console, httpClient = axios, env = process.env) {
        const resolved =
            String(baseUrl || env.AVAMOVIE_BASEURL || '').trim()
            || (String(env.AVAMOVIE_COOKIE || env.AVAMOVIE_USERNAME || '').trim() ? DEFAULT_BASE : '')
        super(resolved, logger, httpClient)
        this.providerID = `${this.key}${this.idSeparator}`
        this.username = String(env.AVAMOVIE_USERNAME || '').trim()
        this.password = String(env.AVAMOVIE_PASSWORD || '').trim()
        /** Prefer explicit session cookie from personal config — avoids captcha on every request. */
        this.sessionCookie = String(env.AVAMOVIE_COOKIE || '').trim()
    }

    get cookie() {
        return this.sessionCookie
    }

    set cookie(value) {
        this.sessionCookie = String(value || '').trim()
    }

    requestConfig() {
        const config = super.requestConfig()
        if (this.cookie) {
            config.headers = {...config.headers, Cookie: this.cookie}
        }
        return config
    }

    /** Soft check: VIP pages still show account/ when logged in. */
    async isLogin() {
        if (!this.baseUrl || !this.cookie) return false
        try {
            const response = await this.httpClient.get(this.endpoint('/account/'), {
                ...this.requestConfig(),
                maxRedirects: 0,
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: (status) => status >= 200 && status < 400,
            })
            const html = typeof response.data === 'string' ? response.data : ''
            if (/sign-in|ورود به پنل/i.test(html) && !/داشبورد|خروج/i.test(html)) return false
            return true
        } catch {
            return false
        }
    }

    /**
     * Captcha-based login is unreliable on Workers. Prefer AVAMOVIE_COOKIE.
     * This attempts form post without solving captcha only if fields allow
     * empty captcha (usually fails) — kept as last resort for self-hosted Node.
     */
    async login() {
        if (!this.baseUrl) return false
        if (this.cookie && (await this.isLogin())) return true
        if (!this.username || !this.password) {
            this.logger.warn?.('Avamovie: no COOKIE and no USERNAME/PASSWORD')
            return false
        }

        try {
            const loginPage = await this.httpClient.get(this.endpoint('/sign-in/'), {
                ...this.requestConfig(),
                timeout: REQUEST_TIMEOUT_MS,
            })
            this.cookie = mergeCookies(this.cookie, collectSetCookies(loginPage))
            const html = typeof loginPage.data === 'string' ? loginPage.data : ''
            const security =
                html.match(/name="security_sign"\s+value="([^"]+)"/)?.[1]
                || html.match(/id="security_sign"[^>]*value="([^"]+)"/)?.[1]
            if (!security) {
                this.logger.warn?.('Avamovie login: security_sign missing — use AVAMOVIE_COOKIE')
                return false
            }
            if (/name="captcha"/i.test(html)) {
                this.logger.warn?.(
                    'Avamovie login requires captcha — paste AVAMOVIE_COOKIE from browser instead',
                )
                return false
            }

            const body = new URLSearchParams({
                user: this.username,
                password: this.password,
                target: 'sign-in',
                security_sign: security,
                _wp_http_referer: '/sign-in/',
            })
            const res = await this.httpClient.post(this.endpoint('/sign-in/'), body.toString(), {
                ...this.requestConfig(),
                headers: {
                    ...this.requestConfig().headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                maxRedirects: 0,
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: (s) => s >= 200 && s < 400,
            })
            this.cookie = mergeCookies(this.cookie, collectSetCookies(res))
            const ok = await this.isLogin()
            if (!ok) this.logger.warn?.('Avamovie login failed — use session cookie')
            return ok
        } catch (error) {
            logAxiosError(error, this.logger, 'Avamovie login failed')
            return false
        }
    }

    async ensureSession() {
        if (this.cookie) {
            if (await this.isLogin()) return true
            // cookie may still work on detail pages even if /account/ check is flaky
            return true
        }
        return this.login()
    }

    async search(text) {
        const query = normalizeText(text)
        if (!this.baseUrl || !query) return []

        try {
            // Site search: /search/?s= or /?s=
            let $ = await this.fetchDocument('/search/', {params: {s: query}})
            if (!$) $ = await this.fetchDocument('/', {params: {s: query}})
            if (!$) return []

            const results = []
            const seen = new Set()
            const lc = query.toLowerCase()

            $('a[href]').each((_, anchor) => {
                const href = $(anchor).attr('href')
                const path = this.pagePath(href)
                if (!path) return
                const type = isSeriesPath(path) ? 'series' : isMoviePath(path) ? 'movie' : null
                if (!type) return
                const id = encodePagePath(path)
                if (!id || seen.has(id)) return

                const name = normalizeText(
                    $(anchor).attr('title')
                        || $(anchor).find('img').attr('alt')
                        || $(anchor).text()
                        || '',
                )
                    .replace(/^دانلود\s+(انیمیشن|انیمه|سریال(?:\s+کره‌ای)?|فیلم)\s+/i, '')
                    .replace(/\s*-\s*آوا\s*مووی.*$/i, '')
                if (!name || name.length < 2) return
                // loose match: all query tokens
                const tokens = lc.split(/\s+/).filter((t) => t.length > 1)
                if (tokens.length && !tokens.every((t) => name.toLowerCase().includes(t))) {
                    // still allow if path slug matches
                    if (!path.toLowerCase().includes(tokens[0])) return
                }

                seen.add(id)
                const poster =
                    $(anchor).find('img').attr('src')
                    || $(anchor).closest('article, .item, li, .post').find('img').first().attr('src')
                    || null
                results.push({id, name, poster, type, genres: []})
            })

            return results.slice(0, 40)
        } catch (error) {
            logAxiosError(error, this.logger, 'Avamovie search failed')
            return []
        }
    }

    async getMovieData(type, id) {
        const path = decodePagePath(id)
        if (!this.baseUrl || !path) return null
        if (type === 'series' && !isSeriesPath(path)) return null
        if (type === 'movie' && !isMoviePath(path) && !isSeriesPath(path)) return null

        if (!(await this.ensureSession())) {
            this.logger.warn?.('Avamovie: not authenticated (need VIP session cookie)')
            return null
        }

        try {
            const $ = await this.fetchDocument(path)
            if (!$) return null

            // VIP paywall still in HTML
            const html = $.root().html() || ''
            if (/need-vip|برای فعال شدن لینک‌های دانلود باید/i.test(html)
                && !/\.mkv|\.mp4/i.test(html)) {
                this.logger.warn?.('Avamovie: page has no direct links (VIP required or expired session)')
                return null
            }

            return type === 'series' || isSeriesPath(path)
                ? parseSeriesDetail($, path)
                : parseMovieDetail($, path)
        } catch (error) {
            logAxiosError(error, this.logger, 'Avamovie detail failed')
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
        if (!Number.isInteger(season) || !Number.isInteger(episode) || episode < 1) return []
        return this.getMovieLinks(movieData).filter(
            (item) => item.season === season && item.episode === episode,
        )
    }

    getLinks(type, videoId, movieData) {
        if (type === 'movie') return this.getMovieLinks(movieData)
        if (type === 'series') return this.getSeriesLinks(movieData, videoId)
        return []
    }

    async imdbID(movieData) {
        return movieData?.imdbId ?? null
    }
}
