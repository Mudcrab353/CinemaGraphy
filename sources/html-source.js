import {load} from 'cheerio'

import Source from './source.js'
import {REQUEST_TIMEOUT_MS} from '../utils.js'

const MAX_PAGE_PATH_LENGTH = 2_048

export function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function isHttpUrl(value) {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
        return false
    }
}

export function encodePagePath(value) {
    const path = String(value ?? '')
    if (!path.startsWith('/') || path.startsWith('//') || path.length > MAX_PAGE_PATH_LENGTH) {
        return null
    }
    return Buffer.from(path).toString('base64url')
}

export function decodePagePath(value) {
    const id = String(value ?? '')
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
        return null
    }

    try {
        const path = Buffer.from(id, 'base64url').toString()
        return encodePagePath(path) === id ? path : null
    } catch {
        return null
    }
}

export default class HtmlSource extends Source {
    requestConfig() {
        return {
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
            },
            timeout: REQUEST_TIMEOUT_MS,
        }
    }

    pagePath(value) {
        if (!this.baseUrl) {
            return null
        }

        try {
            const url = new URL(value, `${this.baseUrl}/`)
            const base = new URL(this.baseUrl)
            // Accept www / non-www and http/https variants of the same host
            const norm = (host) => String(host || '').replace(/^www\./i, '').toLowerCase()
            if (norm(url.hostname) !== norm(base.hostname)) {
                return null
            }
            return url.pathname
        } catch {
            return null
        }
    }

    pageId(value) {
        return encodePagePath(this.pagePath(value))
    }

    async fetchDocument(path, config = {}) {
        const pagePath = this.pagePath(path)
        if (!pagePath) {
            return null
        }

        const defaults = this.requestConfig()
        const url = new URL(pagePath, `${this.baseUrl}/`).toString()
        const headers = {
            ...defaults.headers,
            ...config.headers,
            'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            Referer: `${this.baseUrl}/`,
        }
        // Series download boxes are large; HTTP/2 from some hosts truncates the body.
        // Prefer a longer timeout and accept partial HTML rather than failing hard.
        const timeout = Math.max(Number(config.timeout) || Number(defaults.timeout) || 20_000, 25_000)
        try {
            const response = await this.httpClient.get(url, {
                ...defaults,
                ...config,
                headers,
                timeout,
                maxContentLength: 8_000_000,
                maxBodyLength: 8_000_000,
                // validateStatus: accept 200 only
                decompress: true,
            })
            return typeof response.data === 'string' ? load(response.data) : null
        } catch (err) {
            // Axios may throw on truncated response but still have partial data
            const partial = err?.response?.data
            if (typeof partial === 'string' && partial.length > 1000) {
                return load(partial)
            }
            throw err
        }
    }
}
