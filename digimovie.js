import axios from 'axios'

import HtmlSource, {decodePagePath, isHttpUrl, normalizeText} from './html-source.js'
import {logAxiosError, REQUEST_TIMEOUT_MS} from '../utils.js'

// ---------------------------------------------------------------------------
// Persian security-question solver
//
// DigiMovie's login form shows a plain-text arithmetic question in Persian
// (e.g. "پانصد بعلاوهٔ چهل" or "چه عددی نصف ۱۰۰ است؟") instead of an image
// captcha. This section turns that sentence into a number.
// ---------------------------------------------------------------------------

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

const ONES = {
    صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
}
const TEENS = {
    ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14,
    پانزده: 15, شانزده: 16, هفده: 17, هجده: 18, نوزده: 19,
}
const TENS = {
    بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
}
const HUNDREDS = {
    صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400,
    پانصد: 500, ششصد: 600, شیشصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
}
const MULTIPLIERS = {هزار: 1_000, میلیون: 1_000_000}

function normalizeDigits(value) {
    return String(value ?? '')
        .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

function wordsToNumber(text) {
    const cleaned = normalizeDigits(text).replace(/[^\wآ-ی۰-۹\s]/g, ' ')
    const directDigits = cleaned.match(/\d+/)
    if (directDigits) {
        return Number(directDigits[0])
    }

    const tokens = cleaned.split(/\s+و\s+|\s+/).map((token) => token.trim()).filter(Boolean)
    if (!tokens.length) {
        return null
    }

    let total = 0
    let current = 0
    let matchedAny = false

    for (const token of tokens) {
        if (token in MULTIPLIERS) {
            current = current || 1
            total += current * MULTIPLIERS[token]
            current = 0
            matchedAny = true
        } else if (token in HUNDREDS) {
            current += HUNDREDS[token]
            matchedAny = true
        } else if (token in TEENS) {
            current += TEENS[token]
            matchedAny = true
        } else if (token in TENS) {
            current += TENS[token]
            matchedAny = true
        } else if (token in ONES) {
            current += ONES[token]
            matchedAny = true
        }
    }

    if (!matchedAny) {
        return null
    }
    return total + current
}

const OPERATORS = [
    {re: /نصف/, apply: (nums) => (nums[0] != null ? Math.floor(nums[0] / 2) : null)},
    {re: /دو\s*برابر/, apply: (nums) => (nums[0] != null ? nums[0] * 2 : null)},
    {re: /سه\s*برابر/, apply: (nums) => (nums[0] != null ? nums[0] * 3 : null)},
    {re: /ضرب\s*در|ضربدر|×|\*/, apply: (nums) => (nums.length >= 2 ? nums[0] * nums[1] : null)},
    {re: /تقسیم\s*بر|÷/, apply: (nums) => (nums.length >= 2 && nums[1] !== 0 ? nums[0] / nums[1] : null)},
    {re: /منهای|تفریق|کم/, apply: (nums) => (nums.length >= 2 ? nums[0] - nums[1] : null)},
    {re: /بعلاوه|به\s*علاوه|جمع|\+/, apply: (nums) => (nums.length >= 2 ? nums[0] + nums[1] : null)},
]

export function solveDigimovieSecurityQuestion(rawQuestion) {
    const question = normalizeText(rawQuestion)
        .replace(/^سوال\s*امنیتی\s*:?\s*/, '')
        .replace(/چه\s*عددی\s*/g, '')
        .replace(/است\s*\??\s*$/, '')
        .replace(/\?+$/, '')
        .trim()

    if (!question) {
        return null
    }

    for (const operator of OPERATORS) {
        if (!operator.re.test(question)) {
            continue
        }
        const [left, right] = question.split(operator.re)
        const nums = [wordsToNumber(left), right != null ? wordsToNumber(right) : null].filter(
            (value) => value != null,
        )
        const result = operator.apply(nums)
        if (Number.isFinite(result)) {
            return Math.round(result)
        }
    }

    // Fallback: no operator matched, just try to read a single number out of the text.
    const fallback = wordsToNumber(question)
    return Number.isFinite(fallback) ? fallback : null
}

// ---------------------------------------------------------------------------
// Cookie handling helpers (DigiMovie uses classic WordPress cookie sessions,
// not a bearer token)
// ---------------------------------------------------------------------------

function collectSetCookies(response) {
    const raw = response?.headers?.['set-cookie'] ?? response?.headers?.get?.('set-cookie')
    if (!raw) {
        return []
    }
    return Array.isArray(raw) ? raw : [raw]
}

function mergeCookies(existingCookieHeader, setCookieHeaders) {
    const jar = new Map()
    for (const pair of String(existingCookieHeader ?? '').split(';')) {
        const [name, ...rest] = pair.trim().split('=')
        if (name) {
            jar.set(name, rest.join('='))
        }
    }
    for (const header of setCookieHeaders) {
        const [pair] = String(header).split(';')
        const [name, ...rest] = pair.trim().split('=')
        if (name) {
            jar.set(name, rest.join('='))
        }
    }
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

// ---------------------------------------------------------------------------
// Page parsing helpers
// ---------------------------------------------------------------------------

function isDetailPath(type, path) {
    if (type === 'series') {
        return /^\/serie\/[^/]+\/?$/.test(path)
    }
    if (type === 'movie') {
        const reserved = /^\/(movies|series|serie|account|dashboard|genre|category|tag|page|wp-|top-250)/
        return /^\/[^/]+\/?$/.test(path) && !reserved.test(path)
    }
    return false
}

function parseMovieDetail($, path) {
    const imdbHref = $('a.imdb_icon_holder[href*="imdb.com/title/tt"]').first().attr('href')
        ?? $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1').first().text()).replace(/^دانلود\s+فیلم\s+/, '')

    const links = []
    $('.btn_row.btn_dl[href]').each((_, anchor) => {
        const url = $(anchor).attr('href')
        if (!isHttpUrl(url)) {
            return
        }
        const container = $(anchor).closest('.item_row, .box_dl, li, div')
        const quality = normalizeText(container.find('input[name="quality"]').attr('value')
            ?? container.find('.head_left_side, .quality_dl').first().text())
        const size = normalizeText(container.find('.size_dl').first().text()) || null
        links.push({url, quality: quality || null, size, title: quality || ''})
    })

    return {path, title, imdbId, isSeries: false, links}
}

function parseSeriesDetail($, path) {
    const imdbHref = $('a.imdb_icon_holder[href*="imdb.com/title/tt"]').first().attr('href')
        ?? $('a[href*="imdb.com/title/tt"]').first().attr('href') ?? ''
    const imdbId = imdbHref.match(/\/title\/(tt\d+)/)?.[1] ?? null
    const title = normalizeText($('h1').first().text()).replace(/^دانلود\s+سریال\s+/, '')

    const links = []
    $('.item_row_series.parent_item, .parent_item').each((_, block) => {
        const seasonText = normalizeText($(block).find('.title_row h3, h3').first().text())
        const season = Number(normalizeDigits(seasonText).match(/\d+/)?.[0])
        const quality = normalizeText($(block).find('.head_left_side').first().text()) || null
        const size = normalizeText($(block).find('.size_dl').first().text()) || null

        $(block).find('a.partlink[href]').each((episodeIndex, anchor) => {
            const url = $(anchor).attr('href')
            if (!isHttpUrl(url) || !Number.isInteger(season)) {
                return
            }
            const episodeText = $(anchor).text()
            const episode = Number(normalizeDigits(episodeText).match(/\d+/)?.[0]) || episodeIndex + 1
            links.push({url, season, episode, quality, size, title: quality || ''})
        })
    })

    return {path, title, imdbId, isSeries: true, links}
}

// ---------------------------------------------------------------------------

export default class Digimovie extends HtmlSource {
    key = 'digimovie'
    cookie = ''

    constructor(baseUrl, logger = console, httpClient = axios, env = process.env) {
        super(baseUrl, logger, httpClient)
        this.providerID = `${this.key}${this.idSeparator}`
        this.username = env.DIGIMOVIE_USERNAME
        this.password = env.DIGIMOVIE_PASSWORD
        this.loginPath = '/account/login/?next_page=/dashboard'
    }

    requestConfig() {
        const config = super.requestConfig()
        if (this.cookie) {
            config.headers.Cookie = this.cookie
        }
        return config
    }

    async isLogin() {
        if (!this.baseUrl || !this.cookie) {
            return false
        }
        try {
            const response = await this.httpClient.get(this.endpoint('dashboard'), {
                ...this.requestConfig(),
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400,
            })
            return typeof response.data === 'string' && response.data.includes('"logged":"1"')
        } catch {
            return false
        }
    }

    async login() {
        if (!this.baseUrl || !this.username || !this.password) {
            return false
        }
        if (await this.isLogin()) {
            return true
        }

        try {
            const loginPageResponse = await this.httpClient.get(this.endpoint(this.loginPath), {
                ...this.requestConfig(),
                timeout: REQUEST_TIMEOUT_MS,
            })
            this.cookie = mergeCookies(this.cookie, collectSetCookies(loginPageResponse))

            const html = typeof loginPageResponse.data === 'string' ? loginPageResponse.data : ''
            const securityStr = html.match(/name="login_security_str"\s+value="([^"]+)"/)?.[1]
            const secureqKey = html.match(/name="secureq_key"\s+value="([^"]+)"/)?.[1]
            const questionText = html.match(/سوال\s*امنیتی[^<]*/)?.[0]

            if (!securityStr || !secureqKey || !questionText) {
                this.logger.warn('Digimovie login skipped', {reason: 'login form fields not found'})
                return false
            }

            const answer = solveDigimovieSecurityQuestion(questionText)
            if (answer == null) {
                this.logger.warn('Digimovie login skipped', {reason: 'could not solve security question', questionText})
                return false
            }

            const body = new URLSearchParams({
                login_security_str: securityStr,
                _wp_http_referer: '/account/login/?next_page=%2Fdashboard',
                username: this.username,
                password: this.password,
                secureq_key: secureqKey,
                secureq_ans: String(answer),
                loginkon: 'ورود به پنل کاربری',
            })

            const loginResponse = await this.httpClient.post(this.endpoint(this.loginPath), body.toString(), {
                ...this.requestConfig(),
                headers: {
                    ...this.requestConfig().headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                maxRedirects: 0,
                timeout: REQUEST_TIMEOUT_MS,
                validateStatus: (status) => status >= 200 && status < 400,
            })

            this.cookie = mergeCookies(this.cookie, collectSetCookies(loginResponse))
            const location = loginResponse.headers?.location ?? loginResponse.headers?.get?.('location') ?? ''
            const success = loginResponse.status === 302 && /dashboard/.test(location)

            if (success) {
                this.logger.info('Digimovie login succeeded')
            } else {
                this.logger.warn('Digimovie login failed', {status: loginResponse.status})
                this.cookie = ''
            }
            return success
        } catch (error) {
            logAxiosError(error, this.logger, 'Digimovie login failed')
            this.cookie = ''
            return false
        }
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
            const seen = new Set()
            const lcQuery = query.toLowerCase()

            $('a[href]').each((_, anchor) => {
                const href = $(anchor).attr('href')
                const path = this.pagePath(href)
                if (!path) {
                    return
                }
                const type = isDetailPath('series', path) ? 'series' : (isDetailPath('movie', path) ? 'movie' : null)
                if (!type) {
                    return
                }

                const id = this.pageId(path)
                if (!id || seen.has(id)) {
                    return
                }

                const name = normalizeText(
                    $(anchor).attr('title')
                        || $(anchor).text()
                        || $(anchor).find('img').attr('alt')
                        || $(anchor).closest('article, .item, li').find('img').first().attr('alt')
                        || '',
                ).replace(/^دانلود\s+(فیلم|سریال)\s+/, '')

                if (!name || !name.toLowerCase().includes(lcQuery)) {
                    return
                }

                seen.add(id)
                const poster = $(anchor).find('img').attr('src')
                    ?? $(anchor).closest('article, .item, li').find('img').first().attr('src')
                    ?? null

                results.push({id, name, poster, type, genres: []})
            })

            return results
        } catch (error) {
            logAxiosError(error, this.logger, 'Digimovie search failed')
            return []
        }
    }

    async getMovieData(type, id) {
        const path = decodePagePath(id)
        if (!this.baseUrl || !path || !isDetailPath(type, path)) {
            return null
        }
        if (!this.cookie && !await this.login()) {
            return null
        }

        try {
            const $ = await this.fetchDocument(path)
            if (!$) {
                return null
            }
            return type === 'series' ? parseSeriesDetail($, path) : parseMovieDetail($, path)
        } catch (error) {
            logAxiosError(error, this.logger, 'Digimovie detail request failed')
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
        return this.getMovieLinks(movieData).filter(
            (item) => item.season === season && item.episode === episode,
        )
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
