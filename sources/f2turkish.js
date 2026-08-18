/**
 * F2Media Turkish TV catalog — isolated.
 * ENABLE_F2_TURKISH=1 only. Catalog ids use F2Media provider format so
 * existing meta/stream handlers play without a parallel stream path.
 */

import {DEFAULT_F2MEDIA_BASEURL} from './f2media.js'
import {encodePagePath} from './html-source.js'

export const F2TURKISH_CATALOG_ID = 'f2turkish_series'
const LIST_TTL_MS = 15 * 60 * 1000
const listCache = new Map()

function flagOn(v) {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export function isF2TurkishEnabled(env = {}) {
    return flagOn(env.ENABLE_F2_TURKISH)
}

export function f2TurkishBase(env = {}) {
    const raw = String(env.F2MEDIA_BASEURL || DEFAULT_F2MEDIA_BASEURL || 'https://www.film2med.top')
        .trim()
        .replace(/\/+$/, '')
    return raw || 'https://www.film2med.top'
}

function decodeEntities(s) {
    return String(s || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function cleanTitle(raw) {
    let t = decodeEntities(raw)
    return t
        .replace(/^دانلود\s+سریال\s+/i, '')
        .replace(/\s*بدون\s+سانسور.*$/i, '')
        .replace(/\s*با\s+زیرنویس.*$/i, '')
        .replace(/\s*دوبله\s+فارسی.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

async function fetchText(url, httpClient, timeout = 12_000) {
    if (httpClient?.get) {
        const res = await httpClient.get(url, {
            timeout,
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent': 'Mozilla/5.0 (compatible; StremioIRProviders/2.3)',
                'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            },
            validateStatus: (s) => s >= 200 && s < 400,
        })
        return typeof res.data === 'string' ? res.data : ''
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {Accept: 'text/html', 'User-Agent': 'Mozilla/5.0'},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.text()
    } finally {
        clearTimeout(timer)
    }
}

function parseCategoryHtml(html, base) {
    const out = []
    const seen = new Set()
    const blob = String(html || '')
    const re = /href=["']((?:https?:\/\/[^"']+)?\/series\/[^"'/#?]+\/?)["']/gi
    let m
    while ((m = re.exec(blob))) {
        let href = decodeEntities(m[1])
        if (href.startsWith('/')) href = `${base}${href}`
        let path
        try {
            path = new URL(href).pathname
        } catch {
            continue
        }
        if (!/^\/series\/[^/]+\/?$/i.test(path)) continue
        const norm = path.replace(/\/+$/, '') + '/'
        if (seen.has(norm)) continue
        seen.add(norm)

        const win = blob.slice(Math.max(0, m.index - 250), m.index + 800)
        let name = ''
        const titleM =
            win.match(/entry-title[^>]*>([^<]+)/i) ||
            win.match(/<h2[^>]*>([^<]+)/i) ||
            win.match(/title=["']([^"']+)["']/i) ||
            win.match(/دانلود\s+سریال\s+([^<"]{3,120})/i)
        if (titleM) name = cleanTitle(titleM[1])
        if (!name || name.length < 2) continue

        let poster = null
        const imgs = [...win.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)]
        for (const im of imgs) {
            const u = decodeEntities(im[1])
            if (/logo|icon|banner|avatar|favicon|wp-include|emoji/i.test(u)) continue
            poster = u
            break
        }

        const pageId = encodePagePath(norm)
        if (!pageId) continue

        // Same id shape as F2Media catalog search → meta/stream use existing handlers
        const id = `ipf2media___${pageId}`

        out.push({id, name, poster, path: norm})
    }
    return out
}

async function scrapeTurkishList(env, httpClient) {
    const base = f2TurkishBase(env)
    const cacheKey = `tr:${base}`
    const hit = listCache.get(cacheKey)
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items

    const items = []
    const seenPath = new Set()
    for (let page = 1; page <= 3; page++) {
        const url =
            page === 1
                ? `${base}/category/turkish-tv-series/`
                : `${base}/category/turkish-tv-series/page/${page}/`
        try {
            const html = await fetchText(url, httpClient, 12_000)
            for (const it of parseCategoryHtml(html, base)) {
                if (seenPath.has(it.path)) continue
                seenPath.add(it.path)
                items.push(it)
            }
            if (page > 1 && items.length === 0) break
        } catch {
            break
        }
    }

    listCache.set(cacheKey, {at: Date.now(), items})
    return items
}

export async function f2turkishListCatalog(catalogId, search, env, httpClient) {
    if (!isF2TurkishEnabled(env)) return {metas: []}
    if (String(catalogId) !== F2TURKISH_CATALOG_ID) return {metas: []}

    let items = await scrapeTurkishList(env, httpClient)
    const q = String(search || '')
        .trim()
        .toLowerCase()
    if (q) {
        items = items.filter((it) => it.name.toLowerCase().includes(q))
    }

    return {
        metas: items.map((it) => ({
            id: it.id,
            type: 'series',
            name: it.name,
            poster: it.poster || null,
            posterShape: 'poster',
        })),
    }
}

export function f2turkishManifestCatalogs(env, lang = 'fa') {
    if (!isF2TurkishEnabled(env)) return []
    const isEn = String(lang || 'fa').toLowerCase().startsWith('en')
    return [
        {
            type: 'series',
            id: F2TURKISH_CATALOG_ID,
            name: isEn ? 'Turkish Series' : 'سریال - ترکی',
            extra: [
                {name: 'search', isRequired: false},
                {name: 'skip', isRequired: false},
            ],
        },
    ]
}
