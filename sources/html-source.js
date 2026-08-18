import http from 'http'
import https from 'https'
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
            ...(config.headers || {}),
            'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: `${String(this.baseUrl).replace(/\/+$/, '')}/`,
        }
        const isSeries = /\/series\//i.test(pagePath)
        // Series pages are huge; take partial HTML instead of waiting for a clean close.
        const timeout = Math.max(
            Number(config.timeout) || 0,
            isSeries ? 18_000 : Number(defaults.timeout) || REQUEST_TIMEOUT_MS,
        )

        const html = await this._getHtmlPartial(url, {headers, timeout, isSeries})
        return html ? load(html) : null
    }

    /**
     * HTTP/1.1 read with early resolve once enough media links exist.
     * Avoids hanging/truncated large F2M series pages.
     */
    _getHtmlPartial(url, {headers, timeout, isSeries}) {
        return new Promise((resolve, reject) => {
            let settled = false
            let data = ''
            const lib = String(url).startsWith('https') ? https : http
            const req = lib.get(url, {headers, timeout}, (res) => {
                const status = res.statusCode || 0
                if (status >= 400) {
                    settled = true
                    res.resume()
                    reject(new Error(`HTTP ${status}`))
                    return
                }
                res.setEncoding('utf8')
                res.on('data', (chunk) => {
                    data += chunk
                    if (!isSeries || settled) return
                    const mkv = (data.match(/\.mkv/gi) || []).length
                    if (mkv >= 8 && /download-season|series-downloaditems|S\d{2}E\d{2}/i.test(data)) {
                        settled = true
                        try {
                            res.destroy()
                        } catch {
                            /* ignore */
                        }
                        try {
                            req.destroy()
                        } catch {
                            /* ignore */
                        }
                        resolve(data)
                    }
                })
                res.on('end', () => {
                    if (!settled) {
                        settled = true
                        resolve(data)
                    }
                })
                res.on('error', (err) => {
                    if (!settled) {
                        settled = true
                        if (data.length > 2000) resolve(data)
                        else reject(err)
                    }
                })
            })
            req.on('error', (err) => {
                if (!settled) {
                    settled = true
                    if (data.length > 2000) resolve(data)
                    else reject(err)
                }
            })
            req.on('timeout', () => {
                try {
                    req.destroy()
                } catch {
                    /* ignore */
                }
                if (!settled) {
                    settled = true
                    if (data.length > 2000) resolve(data)
                    else reject(new Error('timeout'))
                }
            })
            setTimeout(() => {
                if (settled) return
                settled = true
                try {
                    req.destroy()
                } catch {
                    /* ignore */
                }
                if (data.length > 2000) resolve(data)
                else reject(new Error('timeout'))
            }, timeout + 500)
        })
    }
}
