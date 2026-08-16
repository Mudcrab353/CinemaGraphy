import axios from 'axios'
import cors from 'cors'
import express from 'express'
import winston from 'winston'

import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {createErrorHandler} from './errorMiddleware.js'
import {landingUrlsFromRequest, renderLandingPage, renderGuidePage, renderConfigurePage} from './landing.js'
import Aslmoviez from './sources/aslmoviez.js'
import Cinamatic from './sources/cinamatic.js'
import Digimovie from './sources/digimovie.js'
import Animex from './sources/animex.js'
import Donyayeserial from './sources/donyayeserial.js'
import F2Media from './sources/f2media.js'
import Peepboxtv from './sources/peepboxtv.js'
import Serialblog from './sources/serialblog.js'
import {ID_SEPARATOR, METADATA_SOURCE} from './sources/source.js'
import {findExternalMetaSource, findExternalStreamSource, formatStreamTitle, getCinemeta, getExternalCatalogSources, getExternalCatalogStatus, invalidateExternalCatalogCache, getKitsuTitle, getSubtitle, getTMDBMetaFa, enrichMetaWithFaTmdb, enrichCatalogMetasWithoutRpdb, getTMDBMetaByTmdbId, getTMDBDetails, getTMDBTitle, getLandingTmdbCatalogs, getTorrentStreams, modifyUrls, proxyExternalCatalog, proxyExternalMeta, proxyExternalStream, proxySubtitles, translateCatalogName} from './utils.js'

export const ADDON_PREFIX = 'ip'
export const ADDON_VERSION = '2.1.21'


const PROVIDER_BASEURL_KEYS = [
    'F2MEDIA_BASEURL',
    'PEEPBOXTV_BASEURL',
    'CINAMATIC_BASEURL',
    'ASLMOVIEZ_BASEURL',
    'SERIALBLOG_BASEURL',
    'DIGIMOVIE_BASEURL',
    'DONYAYESERIAL_BASEURL',
    'ANIMEX_BASEURL',
]

const PROVIDER_KEY_TO_ENV = {
    f2media: 'F2MEDIA_BASEURL',
    peepboxtv: 'PEEPBOXTV_BASEURL',
    cinamatic: 'CINAMATIC_BASEURL',
    aslmoviez: 'ASLMOVIEZ_BASEURL',
    serialblog: 'SERIALBLOG_BASEURL',
    digimovie: 'DIGIMOVIE_BASEURL',
    donyayeserial: 'DONYAYESERIAL_BASEURL',
    animex: 'ANIMEX_BASEURL',
}

const CONFIG_ALLOW = new Set([
    'TMDB_API_KEY',
    'ENABLED_PROVIDERS',
    'TORRENT_METEOR_MANIFEST_URL',
    'EXTERNAL_CATALOG_MANIFEST_URLS',
    'CATALOG_AIO_MANIFEST_URL',
    'CATALOG_AIOCATALOGS_MANIFEST_URL',
    'CATALOG101_MANIFEST_URL',
    'CATALOG_ANIME_MANIFEST_URL',
    'CATALOG_IPTVBRIDGE_MANIFEST_URL',
    'CATALOG_TMDB_MANIFEST_URL',
    'PROVIDER_TIMEOUT_MS',
    'DIGIMOVIE_USERNAME',
    'DIGIMOVIE_PASSWORD',
    'PROXY_ENABLE',
    'PROXY_URL',
    'PROXY_PATH',
    ...PROVIDER_BASEURL_KEYS,
])

export function decodeAddonConfig(encoded) {
    if (!encoded) return null
    try {
        const json = Buffer.from(String(encoded), 'base64url').toString('utf8')
        const obj = JSON.parse(json)
        if (!obj || typeof obj !== 'object') return null
        const out = {}
        for (const [k, v] of Object.entries(obj)) {
            if (!CONFIG_ALLOW.has(k)) continue
            if (v == null) continue
            const s = String(v).trim()
            if (s) out[k] = s
        }
        return Object.keys(out).length ? out : null
    } catch {
        return null
    }
}

/**
 * When a custom /c/<config>/ install is used, provider BASEURLs from the
 * public server env must NOT leak in. Only providers the user selected
 * (ENABLED_PROVIDERS and/or explicit *_BASEURL) stay active.
 */
export function mergeEnv(baseEnv = {}, config) {
    if (!config) return baseEnv
    const e = {...baseEnv, ...config}

    const enabled = String(config.ENABLED_PROVIDERS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

    const explicitBase = PROVIDER_BASEURL_KEYS.filter((k) => String(config[k] || '').trim())

    if (enabled.length || explicitBase.length) {
        for (const k of PROVIDER_BASEURL_KEYS) {
            delete e[k]
        }
        for (const k of explicitBase) {
            e[k] = String(config[k]).trim()
        }
        for (const key of enabled) {
            const envKey = PROVIDER_KEY_TO_ENV[key] || PROVIDER_KEY_TO_ENV[key.replace(/_baseurl$/i, '')]
            if (!envKey) continue
            if (String(config[envKey] || '').trim()) {
                e[envKey] = String(config[envKey]).trim()
            } else if (String(baseEnv[envKey] || '').trim()) {
                e[envKey] = String(baseEnv[envKey]).trim()
            }
        }
        // Optional extras stay from config only when exclusive provider mode
        if (!String(config.TORRENT_METEOR_MANIFEST_URL || '').trim()) {
            // keep server torrent unless user cleared — only strip if they set ENABLED without torrent key
            // User expectation: only selected providers → disable torrent unless explicitly set
            if (!('TORRENT_METEOR_MANIFEST_URL' in config)) {
                delete e.TORRENT_METEOR_MANIFEST_URL
            }
        }
    }

    return e
}


const CATALOGS = [
    {key: 'f2media', name: 'F2Media', catalogType: 'movies'},
    {key: 'peepboxtv', name: 'PeepBoxTv', catalogType: 'movies'},
    {key: 'cinamatic', name: 'Cinamatic', catalogType: 'movies'},
    {key: 'aslmoviez', name: 'AslMoviez', catalogType: 'movies'},
    {key: 'serialblog', name: 'SerialBlog', catalogType: 'movies'},
    {key: 'digimovie', name: 'DigiMovie', catalogType: 'movies'},
    {key: 'donyayeserial', name: 'DonyayeSerial', catalogType: 'movies'},
    {key: 'animex', name: 'Animex', catalogType: 'movies'},
]

export function createLogger(env = process.env) {
    return winston.createLogger({
        level: env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        transports: [new winston.transports.Console()],
    })
}

export function createManifest(env = process.env) {
    const developmentSuffix = env.DEV_MODE === 'true' ? ' - DEV' : ''
    return {
        id: 'com.cinemagraphy.stremio',
        version: ADDON_VERSION,
        contactEmail: 'thenerdcow@gmail.com',
        description: 'سینماگرافی — دانلود و تماشای فیلم و سریال از منابع ایرانی و بین‌المللی.',
        logo: 'https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy/refs/heads/master/logo.png',
        name: `سینماگرافی${developmentSuffix}`,
        catalogs: CATALOGS.filter((cfg) => {
            const envKey = PROVIDER_KEY_TO_ENV[cfg.key]
            return Boolean(envKey && String(env[envKey] || '').trim())
        }).flatMap((cfg) => {
            const types = cfg.catalogType === 'tv' ? ['tv'] : ['movie', 'series']
            return types.map((type) => ({
                name: `${cfg.name}${developmentSuffix}`,
                type,
                id: `${cfg.key}_${cfg.catalogType === 'tv' ? 'tv' : (type === 'movie' ? 'movies' : 'series')}`,
                extra: [{name: 'search', isRequired: true}],
            }))
        }),
        resources: [
            'catalog',
            {name: 'meta', types: ['series', 'movie', 'tv'], idPrefixes: [ADDON_PREFIX, 'tt', 'tmdb:', 'kitsu:']},
            {name: 'stream', types: ['series', 'movie', 'tv'], idPrefixes: [ADDON_PREFIX, 'tt', 'kitsu:', 'tmdb:']},
            {name: 'subtitles', types: ['series', 'movie'], idPrefixes: [ADDON_PREFIX, 'tt', 'kitsu:', 'tmdb:']},
        ],
        types: ['movie', 'series', 'tv'],
        // Torrent streams (infoHash-based) require the addon to explicitly
        // declare P2P content, or clients hide them without warning.
        behaviorHints: {p2p: Boolean(env.TORRENT_METEOR_MANIFEST_URL)},
        stremioAddonsConfig: {
            issuer: 'https://stremio-addons.net',
            signature: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..qYqYdUtntg-bF3wGDjsiww.IBIrE7RSO9aaALvNQROynW-pBh-OQLl3t-nFXqhEAO4AYl2qHvSGJWNP6WTwzU1yD8DjmYbnjDVdgkIDYw75MtInyH_cG0uEYr2VXEIGbHNZVlWlPH-C5go_8UyAMxCc.bM45Z1wp81dep2eCW5dt8A',
        },
    }
}

export function createProviders({env = process.env, logger = console, httpClient} = {}) {
    // Skip providers without a base URL so public instances don't waste time
    // on PeepBoxTV (paid) or any unconfigured source.
    const candidates = [
        new F2Media(env.F2MEDIA_BASEURL, logger, httpClient, env),
        new Peepboxtv(env.PEEPBOXTV_BASEURL, logger, httpClient, env),
        new Cinamatic(env.CINAMATIC_BASEURL, logger, httpClient, env),
        new Aslmoviez(env.ASLMOVIEZ_BASEURL, logger, httpClient, env),
        new Serialblog(env.SERIALBLOG_BASEURL, logger, httpClient, env),
        new Digimovie(env.DIGIMOVIE_BASEURL, logger, httpClient, env),
        new Donyayeserial(env.DONYAYESERIAL_BASEURL, logger, httpClient),
        new Animex(env.ANIMEX_BASEURL, logger, httpClient),
    ]
    return candidates.filter((provider) => {
        const ok = Boolean(provider?.baseUrl)
        if (!ok) {
            logger.info?.(`Provider ${provider?.key ?? '?'} skipped (no BASEURL)`)
        }
        return ok
    })
}


/** Full registry for landing status — includes providers even if BASEURL missing. */
export const PROVIDER_REGISTRY = [
    {key: 'f2media', name: 'F2Media', envKey: 'F2MEDIA_BASEURL'},
    {key: 'peepboxtv', name: 'PeepBoxTv', envKey: 'PEEPBOXTV_BASEURL'},
    {key: 'cinamatic', name: 'Cinamatic', envKey: 'CINAMATIC_BASEURL'},
    {key: 'aslmoviez', name: 'AslMoviez', envKey: 'ASLMOVIEZ_BASEURL'},
    {key: 'serialblog', name: 'SerialBlog', envKey: 'SERIALBLOG_BASEURL'},
    {key: 'digimovie', name: 'DigiMovie', envKey: 'DIGIMOVIE_BASEURL'},
    {key: 'donyayeserial', name: 'DonyayeSerial', envKey: 'DONYAYESERIAL_BASEURL'},
    {key: 'animex', name: 'Animex', envKey: 'ANIMEX_BASEURL'},
]

const PROVIDER_STATUS_TTL_MS = 5 * 60 * 1000
const PROVIDER_PROBE_TIMEOUT_MS = 4_000
let providerStatusCache = null

async function probeProviderUrl(url, httpClient) {
    const started = Date.now()
    try {
        const response = await httpClient.get(url, {
            timeout: PROVIDER_PROBE_TIMEOUT_MS,
            maxRedirects: 5,
            validateStatus: (status) => status > 0 && status < 500,
            headers: {
                'User-Agent': 'Cinemagraphy/2.0 (provider-status)',
                Accept: 'text/html,application/json,*/*',
            },
        })
        return {
            online: Boolean(response),
            latencyMs: Date.now() - started,
        }
    } catch {
        return {online: false, latencyMs: Date.now() - started}
    }
}

/**
 * Cached provider status for the landing page.
 * Never throws — individual probe failures mark that provider offline only.
 */
export async function getProvidersStatus(env = process.env, httpClient = axios) {
    const cacheHit = providerStatusCache && Date.now() - providerStatusCache.at < PROVIDER_STATUS_TTL_MS
    if (cacheHit) {
        // Provider probe cache stays, but always refresh external catalog snapshot
        try {
            // force re-fetch by clearing only external side is internal; call get again
            const externalCatalogs = await (async () => {
                invalidateExternalCatalogCache()
                await getExternalCatalogSources(env, httpClient)
                return getExternalCatalogStatus(env)
            })()
            const externalCatalogEnv = {
                CATALOG101_MANIFEST_URL: Boolean(String(env.CATALOG101_MANIFEST_URL || '').trim()),
                CATALOG_AIO_MANIFEST_URL: Boolean(String(env.CATALOG_AIO_MANIFEST_URL || env.CATALOG_AIOCATALOGS_MANIFEST_URL || '').trim()),
                CATALOG_TMDB_MANIFEST_URL: Boolean(String(env.CATALOG_TMDB_MANIFEST_URL || '').trim()),
                CATALOG_ANIME_MANIFEST_URL: Boolean(String(env.CATALOG_ANIME_MANIFEST_URL || '').trim()),
                CATALOG_IPTVBRIDGE_MANIFEST_URL: Boolean(String(env.CATALOG_IPTVBRIDGE_MANIFEST_URL || '').trim()),
                EXTERNAL_CATALOG_MANIFEST_URLS: Boolean(String(env.EXTERNAL_CATALOG_MANIFEST_URLS || '').trim()),
            }
            return {
                ...providerStatusCache.payload,
                checkedAt: new Date().toISOString(),
                externalCatalogs,
                externalCatalogEnv,
            }
        } catch {
            return providerStatusCache.payload
        }
    }

    const items = await Promise.all(
        PROVIDER_REGISTRY.map(async (entry) => {
            const baseUrl = String(env[entry.envKey] ?? '').trim()
            if (!baseUrl) {
                return {
                    key: entry.key,
                    name: entry.name,
                    configured: false,
                    online: false,
                    latencyMs: null,
                }
            }
            const probe = await probeProviderUrl(baseUrl, httpClient)
            return {
                key: entry.key,
                name: entry.name,
                configured: true,
                online: probe.online,
                latencyMs: probe.latencyMs,
            }
        }),
    )

    // Optional torrent companion (not an Iranian HTML provider)
    const torrentUrl = String(env.TORRENT_METEOR_MANIFEST_URL ?? '').trim()
    if (torrentUrl) {
        const probe = await probeProviderUrl(torrentUrl, httpClient)
        items.push({
            key: 'torrent',
            name: 'Torrent (Meteor)',
            configured: true,
            online: probe.online,
            latencyMs: probe.latencyMs,
        })
    } else {
        items.push({
            key: 'torrent',
            name: 'Torrent (Meteor)',
            configured: false,
            online: false,
            latencyMs: null,
        })
    }

    // Warm external catalog cache so /manifest.json can include AIO/101/anime quickly.
    let externalCatalogs = []
    try {
        invalidateExternalCatalogCache()
        await getExternalCatalogSources(env, httpClient)
        externalCatalogs = getExternalCatalogStatus(env)
    } catch {
        try {
            externalCatalogs = getExternalCatalogStatus(env)
        } catch {
            externalCatalogs = []
        }
    }

    // Which catalog env keys are present (boolean only — never leak URL values)
    const externalCatalogEnv = {
        CATALOG101_MANIFEST_URL: Boolean(String(env.CATALOG101_MANIFEST_URL || '').trim()),
        CATALOG_AIO_MANIFEST_URL: Boolean(String(env.CATALOG_AIO_MANIFEST_URL || env.CATALOG_AIOCATALOGS_MANIFEST_URL || '').trim()),
        CATALOG_TMDB_MANIFEST_URL: Boolean(String(env.CATALOG_TMDB_MANIFEST_URL || '').trim()),
        CATALOG_ANIME_MANIFEST_URL: Boolean(String(env.CATALOG_ANIME_MANIFEST_URL || '').trim()),
        CATALOG_IPTVBRIDGE_MANIFEST_URL: Boolean(String(env.CATALOG_IPTVBRIDGE_MANIFEST_URL || '').trim()),
        EXTERNAL_CATALOG_MANIFEST_URLS: Boolean(String(env.EXTERNAL_CATALOG_MANIFEST_URLS || '').trim()),
    }

    const payload = {
        version: ADDON_VERSION,
        checkedAt: new Date().toISOString(),
        cacheTtlMs: PROVIDER_STATUS_TTL_MS,
        providers: items,
        externalCatalogs,
        externalCatalogEnv,
    }
    providerStatusCache = {at: Date.now(), payload}
    return payload
}

export function parseAddonId(id, providers) {
    const parts = String(id ?? '').split(ID_SEPARATOR)
    const provider = providers.find((item) => parts[0] === `${ADDON_PREFIX}${item.key}`)
    if (!provider || !parts[1]) {
        return null
    }
    return {
        provider,
        providerItemId: parts[1],
        videoId: parts.slice(2).join(ID_SEPARATOR) || null,
    }
}

function findCatalogProvider(catalogId, providers) {
    return providers.find((provider) => {
        const cfg = CATALOGS.find((c) => c.key === provider.key)
        if (cfg?.catalogType === 'tv') {
            return catalogId === `${provider.key}_tv`
        }
        return catalogId === `${provider.key}_movies` || catalogId === `${provider.key}_series`
    })
}

function parseExtraArgs(extraArgs = '') {
    return Object.fromEntries(new URLSearchParams(extraArgs))
}

function proxyPrefix(env) {
    const baseUrl = String(env.PROXY_URL ?? '').replace(/\/$/, '')
    const path = String(env.PROXY_PATH ?? 'proxy').replace(/^\/+|\/+$/g, '')
    return baseUrl && path ? `${baseUrl}/${path}?url=` : null
}

const QUALITY_RANKS = {
    '2160': 7, '4k': 7,
    '1440': 6,
    '1080': 5,
    '720': 4,
    '576': 3,
    '480': 2,
    '360': 1,
    '240': 0,
}

function rankFromTitle(title) {
    const t = String(title ?? '').toLowerCase()
    for (const [key, rank] of Object.entries(QUALITY_RANKS)) {
        if (t.includes(key)) {
            return rank
        }
    }
    return -1
}

function sortByQuality(streams) {
    if (!Array.isArray(streams)) {
        return streams
    }
    return streams
        .map((s) => ({
            ...s,
            title: (s.title ?? '').replace(/انکودر\s*:/gi, '').replace(/encoder\s*:/gi, '').trim(),
        }))
        .sort((a, b) => rankFromTitle(b.title) - rankFromTitle(a.title))
}

function logResourceError(logger, resource, error) {
    logger.error(`${resource} request failed`, {message: error?.message ?? String(error)})
}

function parseImdbId(value) {
    const parts = String(value ?? '').split(':')
    const imdbId = parts[0]
    if (!/^tt\d+$/.test(imdbId)) {
        return null
    }
    return {
        imdbId,
        season: parts[1] ? Number(parts[1]) : null,
        episode: parts[2] ? Number(parts[2]) : null,
    }
}

async function getCinemetaName(type, imdbId, services) {
    const cinemeta = await services.getCinemeta(type, imdbId)
    return cinemeta?.meta?.name ?? null
}

function withTimeout(promise, ms, label = 'operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        }),
    ])
}

// Short in-memory cache: concurrent users / repeated opens of the same title
// skip re-hitting every Iranian site. Instance-local but helps a lot on spikes.
const STREAM_CACHE_TTL_MS = 45_000
const streamTitleCache = new Map()

function streamCacheKey(title, type, season, episode) {
    return `${type}|${season ?? ''}|${episode ?? ''}|${String(title).toLowerCase().trim()}`
}

function normalizeForMatch(value) {
    return String(value ?? '')
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        .replace(/\b(season|series|s)\s*\d+\b/gi, ' ')
        .replace(/\b(episode|ep|e)\s*\d+\b/gi, ' ')
        .replace(/\bs\d{1,2}\s*e\d{1,3}\b/gi, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\b(19|20)\d{2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function titlesMatch(a, b) {
    if (!a || !b) return false
    if (a === b) return true
    if (a.includes(b) || b.includes(a)) return true
    // compact form: "grandblue" vs "grand blue"
    const ca = a.replace(/\s+/g, '')
    const cb = b.replace(/\s+/g, '')
    if (ca.length > 3 && cb.length > 3 && (ca.includes(cb) || cb.includes(ca))) return true
    const ta = a.split(' ').filter((t) => t.length > 2)
    const tb = b.split(' ').filter((t) => t.length > 2)
    if (!ta.length || !tb.length) return false
    const setB = new Set(tb)
    const hits = ta.filter((t) => setB.has(t)).length
    const need = Math.min(2, ta.length, tb.length)
    return hits >= Math.max(1, need === 2 && Math.min(ta.length, tb.length) === 1 ? 1 : need)
}

function searchQueryVariants(title) {
    const raw = String(title ?? '').trim()
    if (!raw) return []
    const variants = [raw]
    // Providers like F2Media filter with name.includes(query) — keep punctuation
    // in the primary query; also try softer forms for sites that strip "&".
    const noAmp = raw.replace(/&/g, ' and ').replace(/\s+/g, ' ').trim()
    if (noAmp !== raw) variants.push(noAmp)
    const stripped = raw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (stripped && !variants.some((v) => v.toLowerCase() === stripped.toLowerCase())) {
        variants.push(stripped)
    }
    // de-dupe case-insensitively, keep order
    const seen = new Set()
    return variants.filter((v) => {
        const k = v.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
    })
}

function bestTitleMatch(results, type, cleanTitle) {
    const list = Array.isArray(results) ? results : []
    const typed = list.filter((r) => !r.type || r.type === type)
    const candidates = typed.filter((r) => titlesMatch(normalizeForMatch(r.name), cleanTitle))
    if (candidates.length) {
        candidates.sort((a, b) => {
            const na = normalizeForMatch(a.name)
            const nb = normalizeForMatch(b.name)
            const score = (n) => {
                if (n === cleanTitle) return 0
                if (n.includes(cleanTitle) || cleanTitle.includes(n)) return 1
                return 2
            }
            return score(na) - score(nb) || na.length - nb.length
        })
        return candidates[0]
    }
    // Iranian sites often return Persian-only titles. normalizeForMatch strips
    // Persian script → empty → token match fails. If the provider's own search
    // returned rows for our query, trust the first same-type hit.
    if (typed.length === 1) return typed[0]
    if (typed.length > 1 && cleanTitle) {
        const latin = cleanTitle.split(' ').filter((t) => t.length > 2)
        const soft = typed.find((r) => {
            const raw = String(r.name ?? '').toLowerCase()
            return latin.some((t) => raw.includes(t))
        })
        if (soft) return soft
        return typed[0]
    }
    return null
}

async function streamsByTitle(title, type, season, episode, providers) {
    const cleanTitle = normalizeForMatch(title)
    const cacheKey = streamCacheKey(cleanTitle, type, season, episode)
    const cached = streamTitleCache.get(cacheKey)
    if (cached && Date.now() - cached.at < STREAM_CACHE_TTL_MS) {
        return cached.streams
    }

    // Enough budget for search + detail (F2Media may also hit REST fallback).
    const PROVIDER_BUDGET_MS = Number(process.env.PROVIDER_TIMEOUT_MS) || 14_000
    const queries = searchQueryVariants(title)

    const settled = await Promise.allSettled(
        providers.map(async (provider) => {
            const work = (async () => {
                let match = null
                for (const q of queries) {
                    const results = await provider.search(q)
                    match = bestTitleMatch(results, type, cleanTitle)
                    if (match) break
                }
                if (!match) {
                    return {key: provider.key, streams: []}
                }

                const movieData = await provider.getMovieData(match.type || type, match.id)
                if (!movieData) {
                    return {key: provider.key, streams: []}
                }

                const videoId = season && episode ? `${match.id}:${season}:${episode}` : null
                const links = provider.getLinks(match.type || type, videoId, movieData)

                return {
                    key: provider.key,
                    streams: (Array.isArray(links) ? links : []).map((link) => ({
                        url: link.url,
                        title: formatStreamTitle({
                            providerKey: provider.key,
                            quality: link.quality,
                            size: link.size,
                            audioType: link.audioType,
                            extraText: link.title,
                            url: link.url,
                        }),
                    })),
                }
            })()
            try {
                return await withTimeout(work, PROVIDER_BUDGET_MS, provider.key)
            } catch {
                return {key: provider.key, streams: []}
            }
        }),
    )

    const streams = sortByQuality(
        settled
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => r.value.streams),
    )
    streamTitleCache.set(cacheKey, {at: Date.now(), streams})
    if (streamTitleCache.size > 200) {
        const oldest = streamTitleCache.keys().next().value
        streamTitleCache.delete(oldest)
    }
    return streams
}

async function imdbStreamResponse(type, id, providers, services, env, httpClient, logger) {
    const torrentPromise = getTorrentStreams(type, id, env, httpClient, logger).catch(() => [])
    const parsed = parseImdbId(id)
    if (!parsed) {
        return {streams: await torrentPromise}
    }

    const title = await getCinemetaName(type, parsed.imdbId, services)
    const streams = title
        ? await streamsByTitle(title, type, parsed.season, parsed.episode, providers)
        : []
    // Iranian providers always come first — torrent results are appended,
    // never prepended, regardless of whether Iranian results exist.
    return {streams: [...streams, ...await torrentPromise]}
}

function parseKitsuId(value) {
    const match = String(value ?? '').match(/^kitsu:(\d+)(?::(\d+))?$/)
    if (!match) {
        return null
    }
    return {kitsuId: `kitsu:${match[1]}`, episode: match[2] ? Number(match[2]) : null}
}

async function kitsuStreamResponse(type, id, providers, env, httpClient, logger) {
    const torrentPromise = getTorrentStreams(type, id, env, httpClient, logger).catch(() => [])
    const parsed = parseKitsuId(id)
    if (!parsed) {
        return {streams: await torrentPromise}
    }

    const title = await getKitsuTitle(parsed.kitsuId, httpClient, logger)
    // Anime catalogs use kitsu: ids. Animex stores anime under /anime/ as type series.
    // Prefer season 1 when only episode is present (common for continuous anime).
    let streams = []
    if (title) {
        const season = parsed.episode ? 1 : null
        const episode = parsed.episode ?? null
        streams = await streamsByTitle(title, 'series', season, episode, providers)
        // Retry without season/episode filter if detail page has flat episode lists
        if (!streams.length && episode) {
            streams = await streamsByTitle(title, 'series', null, null, providers)
        }
    }
    return {streams: [...streams, ...await torrentPromise]}
}

function parseTmdbId(value) {
    const match = String(value ?? '').match(/^tmdb:(\d+)(?::(\d+):(\d+))?$/)
    if (!match) {
        return null
    }
    return {
        tmdbId: match[1],
        season: match[2] ? Number(match[2]) : null,
        episode: match[3] ? Number(match[3]) : null,
    }
}

async function tmdbStreamResponse(type, id, providers, httpClient, apiKey, env, logger) {
    const parsed = parseTmdbId(id)
    if (!parsed) {
        return {streams: await getTorrentStreams(type, id, env, httpClient, logger).catch(() => [])}
    }

    // 101 Catalogs (and similar) use tmdb: ids. Meteor/torrent addons usually
    // only accept tt: IMDb ids — resolve both title and imdb_id via TMDB so
    // Iranian providers + torrent both work for "پرطرفدار / ترند".
    const details = await getTMDBDetails(type, parsed.tmdbId, httpClient, apiKey, logger)
    const title = details?.title ?? null
    const imdbId = details?.imdbId ?? null

    const torrentId = imdbId
        ? (parsed.season != null && parsed.episode != null
            ? `${imdbId}:${parsed.season}:${parsed.episode}`
            : imdbId)
        : id
    const torrentPromise = getTorrentStreams(type, torrentId, env, httpClient, logger).catch(() => [])

    const streams = title
        ? await streamsByTitle(title, type, parsed.season, parsed.episode, providers)
        : []
    return {streams: [...streams, ...await torrentPromise]}
}

async function getProviderMetadata(provider, type, itemId, movieData, services) {
    if (provider.metadataSource === METADATA_SOURCE.PROVIDER) {
        const meta = await provider.getMeta(type, itemId, movieData)
        return meta ? {meta} : null
    }

    const imdbId = await provider.imdbID(movieData, type)
    return imdbId ? services.getCinemeta(type, imdbId) : null
}

export function createAddon({
    env = process.env,
    logger = createLogger(env),
    providers = createProviders({env, logger}),
    services = {getCinemeta, getSubtitle},
} = {}) {
    const addon = express()
    addon.disable('x-powered-by')
    addon.use(cors())
    addon.use((req, _res, next) => {
        try {
            const pathOnly = (req.url || '').split('?')[0]
            const qs = (req.url || '').includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
            const m = pathOnly.match(/^\/c\/([^/]+)(\/.*)?$/)
            if (m) {
                req.addonConfig = decodeAddonConfig(decodeURIComponent(m[1]))
                req.url = (m[2] && m[2].length ? m[2] : '/') + qs
            }
        } catch {
            /* ignore bad config segment */
        }
        next()
    })


    function requestScope(req) {
        const e = mergeEnv(env, req?.addonConfig)
        const p = req?.addonConfig ? createProviders({env: e, logger}) : providers
        return {env: e, providers: p}
    }

    const rootDir = dirname(fileURLToPath(import.meta.url))
    let logoBytes = null
    try {
        logoBytes = readFileSync(join(rootDir, 'logo.png'))
    } catch {
        logoBytes = null
    }

    addon.get('/logo.png', (req, res) => {
        if (!logoBytes) {
            return res.status(404).type('text/plain').send('logo not found')
        }
        res.type('png').set('cache-control', 'public, max-age=86400').send(logoBytes)
    })

    addon.get('/guide', (req, res) => {
        try {
            const urls = landingUrlsFromRequest(req, env)
            const html = renderGuidePage({
                logoUrl: urls.logoUrl,
                version: ADDON_VERSION,
                manifestUrl: urls.manifestUrl,
            })
            res.status(200).type('html').set('cache-control', 'no-store').send(html)
        } catch (error) {
            logger.error('Guide page failed', {message: error?.message ?? String(error)})
            res.status(500).type('text/plain').send('Guide error')
        }
    })

    addon.get('/configure', (req, res) => {
        try {
            const urls = landingUrlsFromRequest(req, env)
            const origin = urls.manifestUrl.replace(/\/manifest.json$/i, '')
            const html = renderConfigurePage({
                logoUrl: urls.logoUrl,
                version: ADDON_VERSION,
                origin: origin || urls.manifestUrl.replace('/manifest.json', ''),
            })
            res.status(200).type('html').set('cache-control', 'no-store').send(html)
        } catch (error) {
            logger.error('Configure page failed', {message: error?.message ?? String(error)})
            res.status(500).type('text/plain').send('Configure error')
        }
    })

    addon.get('/', (req, res) => {
        try {
            const urls = landingUrlsFromRequest(req, env)
            const html = renderLandingPage({
                ...urls,
                version: ADDON_VERSION,
            })
            res.status(200).type('html').set('cache-control', 'no-store').send(html)
        } catch (error) {
            logger.error('Landing page failed', {message: error?.message ?? String(error)})
            res.status(500).type('text/plain').send('Landing page error')
        }
    })

    addon.get('/manifest.json', async (req, res) => {
        const {env: activeEnv} = requestScope(req)
        const manifest = createManifest(activeEnv)
        try {
            if (String(req.query?.refresh || '') === '1') {
                invalidateExternalCatalogCache()
            }
            const externalSources = await getExternalCatalogSources(activeEnv, axios, logger)
            for (const source of externalSources) {
                manifest.catalogs.push(...source.catalogs.map((catalog) => ({
                    ...catalog,
                    name: translateCatalogName(catalog.name, catalog.type),
                })))
                if (source.hasMeta) {
                    const metaResource = manifest.resources.find((r) => r?.name === 'meta')
                    for (const prefix of source.idPrefixes) {
                        if (metaResource && !metaResource.idPrefixes.includes(prefix)) {
                            metaResource.idPrefixes.push(prefix)
                        }
                    }
                }
                if (source.hasStream) {
                    const streamResource = manifest.resources.find((r) => r?.name === 'stream')
                    for (const prefix of source.idPrefixes) {
                        if (streamResource && !streamResource.idPrefixes.includes(prefix)) {
                            streamResource.idPrefixes.push(prefix)
                        }
                    }
                }
            }
        } catch (error) {
            logAxiosError(error, logger, 'External catalogs unavailable, serving own catalogs only')
        }
        res.status(200)
            .type('json')
            .set('cache-control', 'no-store, max-age=0')
            .json(manifest)
    })

    const catalogHandler = async (req, res) => {
        try {
            const {env: activeEnv, providers: activeProviders} = requestScope(req)
            const externalSources = await getExternalCatalogSources(activeEnv, axios, logger)
            const externalSource = externalSources.find((source) => source.catalogIds.has(req.params.id))
            if (externalSource) {
                let data = await proxyExternalCatalog(
                    externalSource, req.params.type, req.params.id, req.params.extraArgs, axios, logger,
                )
                // 101 / external grids without RPDB → TMDB fa poster + text (user TMDB_API_KEY)
                if (activeEnv.TMDB_API_KEY && Array.isArray(data?.metas) && data.metas.length) {
                    try {
                        data = {
                            ...data,
                            metas: await enrichCatalogMetasWithoutRpdb(
                                data.metas,
                                req.params.type,
                                axios,
                                activeEnv.TMDB_API_KEY,
                                logger,
                            ),
                        }
                    } catch (error) {
                        logger.warn?.('Catalog FA enrich skipped', {message: error?.message})
                    }
                }
                return res.json(data)
            }

            const provider = findCatalogProvider(req.params.id, activeProviders)
            if (!provider) {
                return res.json({metas: []})
            }

            const extraArgs = parseExtraArgs(req.params.extraArgs)
            const search = extraArgs.search?.trim()
            if (!search || !['movie', 'series', 'anime', 'tv'].includes(req.params.type)) {
                return res.json({metas: []})
            }

            const results = await provider.search(search)
            const list = Array.isArray(results) ? results : []
            let filtered = list.filter((item) => item?.id != null && item.type === req.params.type)
            // If the catalog type filter wipes everything but the provider did find
            // rows (common when a series query hits a movie page first), keep
            // same-type when possible; otherwise surface provider hits so the
            // user is not stuck with an empty board.
            if (!filtered.length && list.length) {
                filtered = list.filter((item) => item?.id != null)
                logger.info('Catalog type filter empty; returning untyped hits', {
                    provider: provider.key,
                    type: req.params.type,
                    query: search,
                    resultCount: list.length,
                })
            }
            const metas = filtered.map((item) => ({
                ...item,
                type: item.type === 'series' || item.type === 'movie' ? item.type : req.params.type,
                id: `${ADDON_PREFIX}${provider.providerID}${item.id}`,
            }))
            logger.info('Catalog search completed', {
                provider: provider.key,
                type: req.params.type,
                query: search,
                resultCount: list.length,
                metaCount: metas.length,
            })
            return res.json({metas})
        } catch (error) {
            logResourceError(logger, 'Catalog', error)
            return res.json({metas: []})
        }
    }
    addon.get('/catalog/:type/:id/:extraArgs.json', catalogHandler)
    addon.get('/catalog/:type/:id.json', catalogHandler)

    addon.get('/meta/:type/:id.json', async (req, res) => {
        try {
            const {env: activeEnv, providers: activeProviders} = requestScope(req)
            const env = activeEnv
            const providers = activeProviders
            // IMDb ids → Persian TMDB meta (fallback Cinemeta if TMDB misses)
            if (req.params.id.startsWith('tt')) {
                if (env.TMDB_API_KEY) {
                    const tmdbMeta = await getTMDBMetaFa(
                        req.params.type, req.params.id, axios, env.TMDB_API_KEY, logger,
                    )
                    if (tmdbMeta) {
                        return res.json({meta: tmdbMeta})
                    }
                }
                try {
                    const cin = await services.getCinemeta(req.params.type, req.params.id)
                    if (cin?.meta) {
                        return res.json(cin)
                    }
                    if (cin && cin.id) {
                        return res.json({meta: cin})
                    }
                } catch { /* ignore */ }
                return res.json({})
            }

            // 101 Catalogs popular/trending use tmdb:<id> — must return real meta
            // or Stremio shows "no metadata / no streams" even when streams exist.
            if (req.params.id.startsWith('tmdb:') && env.TMDB_API_KEY) {
                const tmdbNumeric = String(req.params.id).split(':')[1]
                const meta = await getTMDBMetaByTmdbId(
                    req.params.type,
                    tmdbNumeric,
                    axios,
                    env.TMDB_API_KEY,
                    logger,
                    services.getCinemeta,
                )
                if (meta) {
                    return res.json({meta})
                }
                return res.json({})
            }

            const externalSources = await getExternalCatalogSources(env, axios, logger)
            const metaSource = findExternalMetaSource(externalSources, req.params.id)
            if (metaSource) {
                const data = await proxyExternalMeta(metaSource, req.params.type, req.params.id, axios, logger)
                if (data?.meta && env.TMDB_API_KEY) {
                    data.meta = await enrichMetaWithFaTmdb(
                        data.meta,
                        req.params.type,
                        axios,
                        env.TMDB_API_KEY,
                        logger,
                        req.params.id,
                    )
                }
                return res.json(data)
            }

            const parsedId = parseAddonId(req.params.id, providers)
            if (!parsedId || !['movie', 'series', 'tv'].includes(req.params.type)) {
                return res.json({})
            }

            const movieData = await parsedId.provider.getMovieData(req.params.type, parsedId.providerItemId)
            if (!movieData) {
                return res.json({})
            }
            const upstreamMeta = await getProviderMetadata(
                parsedId.provider,
                req.params.type,
                parsedId.providerItemId,
                movieData,
                services,
            )
            if (!upstreamMeta?.meta) {
                return res.json({})
            }
            let result = structuredClone(upstreamMeta)

            if (env.PROXY_ENABLE === 'true' || env.PROXY_ENABLE === '1') {
                const prepend = proxyPrefix(env)
                if (prepend) {
                    result = modifyUrls(result, prepend)
                }
            }

            if (env.TMDB_API_KEY && result.meta) {
                result.meta = await enrichMetaWithFaTmdb(
                    result.meta,
                    req.params.type,
                    axios,
                    env.TMDB_API_KEY,
                    logger,
                    result.meta.id,
                )
            }
            if (req.params.type === 'series') {
                const videos = Array.isArray(result.meta.videos) ? result.meta.videos : []
                result.meta.videos = videos
                    .filter((video) => video?.id)
                    .map((video) => ({
                        ...video,
                        id: `${ADDON_PREFIX}${parsedId.provider.providerID}${parsedId.providerItemId}${ID_SEPARATOR}${video.id}`,
                    }))
                result.meta.id = req.params.id
            } else {
                result.meta.id = `${ADDON_PREFIX}${parsedId.provider.providerID}${parsedId.providerItemId}${ID_SEPARATOR}${result.meta.id}`
                result.meta.behaviorHints = {
                    ...(result.meta.behaviorHints ?? {}),
                    defaultVideoId: result.meta.id,
                }
            }
            return res.json(result)
        } catch (error) {
            logResourceError(logger, 'Meta', error)
            return res.json({})
        }
    })

    addon.get('/stream/:type/:id.json', async (req, res) => {
        try {
            const {env: activeEnv, providers: activeProviders} = requestScope(req)
            const env = activeEnv
            const providers = activeProviders
            const {type, id} = req.params
            if (!['movie', 'series', 'tv'].includes(type)) {
                return res.json({streams: []})
            }

            const parsedId = parseAddonId(id, providers)
            if (parsedId) {
                const movieData = await parsedId.provider.getMovieData(type, parsedId.providerItemId)
                let streams = movieData
                    ? parsedId.provider.getLinks(type, parsedId.videoId, movieData)
                    : []
                if (Array.isArray(streams)) {
                    streams = streams.map((link) => ({
                        ...link,
                        title: formatStreamTitle({
                            providerKey: parsedId.provider.key,
                            quality: link.quality,
                            size: link.size,
                            audioType: link.audioType,
                            extraText: link.title,
                        url: link.url,
                        }),
                    }))
                }
                return res.json({streams: sortByQuality(Array.isArray(streams) ? streams : [])})
            }

            if (id.startsWith('tmdb:')) {
                const result = await tmdbStreamResponse(type, id, providers, axios, env.TMDB_API_KEY, env, logger)
                return res.json(result)
            }

            if (id.startsWith('kitsu:')) {
                const result = await kitsuStreamResponse(type, id, providers, env, axios, logger)
                return res.json(result)
            }

            if (/^tt/.test(id)) {
                const result = await imdbStreamResponse(type, id, providers, services, env, axios, logger)
                return res.json(result)
            }

            // Fallback for id schemes we don't otherwise handle (e.g. IPTV Bridge's
            // own channel ids) — tried last, so it never intercepts tt/kitsu/tmdb
            // requests that our own Iranian-providers + torrent pipeline handles.
            const externalSources = await getExternalCatalogSources(env, axios, logger)
            const streamSource = findExternalStreamSource(externalSources, id)
            if (streamSource) {
                const result = await proxyExternalStream(streamSource, type, id, null, axios, logger)
                return res.json(result)
            }

            return res.json({streams: []})
        } catch (error) {
            logResourceError(logger, 'Stream', error)
            return res.json({streams: []})
        }
    })

    const subtitleHandler = async (req, res) => {
        try {
            if (!['movie', 'series'].includes(req.params.type)) {
                return res.json({subtitles: []})
            }

            const isOwnId = req.params.id.startsWith(ADDON_PREFIX)
            if (!isOwnId && env.SUBSOURCE_MANIFEST_URL) {
                const result = await proxySubtitles(
                    env.SUBSOURCE_MANIFEST_URL, req.params.type, req.params.id, req.params.extraArgs, axios, logger,
                )
                if (result) {
                    return res.json(result)
                }
            }

            const parsedId = parseAddonId(req.params.id, providers)
            if (!parsedId || !parsedId.videoId) {
                return res.json({subtitles: []})
            }
            const result = await services.getSubtitle(req.params.type, parsedId.videoId)
            return res.json(result?.subtitles ? result : {subtitles: []})
        } catch (error) {
            logResourceError(logger, 'Subtitle', error)
            return res.json({subtitles: []})
        }
    }
    addon.get('/subtitles/:type/:id/:extraArgs.json', subtitleHandler)
    addon.get('/subtitles/:type/:id.json', subtitleHandler)

    addon.get('/tmdb/landing.json', async (req, res) => {
        try {
            const data = await getLandingTmdbCatalogs(axios, env.TMDB_API_KEY, logger)
            res.status(200)
                .type('json')
                .set('cache-control', 'public, max-age=300, s-maxage=600')
                .json(data)
        } catch (error) {
            logger.error('tmdb/landing.json failed', {message: error?.message ?? String(error)})
            res.status(200).type('json').json({
                ok: false,
                trendingDay: [],
                trendingWeek: [],
                nowPlaying: [],
                trailers: [],
            })
        }
    })

    addon.get('/providers.json', async (req, res) => {
        try {
            const data = await getProvidersStatus(env, axios)
            res.status(200)
                .type('json')
                .set('cache-control', 'public, max-age=60, s-maxage=120')
                .json(data)
        } catch (error) {
            logger.error('providers.json failed', {message: error?.message ?? String(error)})
            res.status(200).type('json').json({
                version: ADDON_VERSION,
                checkedAt: new Date().toISOString(),
                cacheTtlMs: PROVIDER_STATUS_TTL_MS,
                providers: PROVIDER_REGISTRY.map((entry) => ({
                    key: entry.key,
                    name: entry.name,
                    configured: Boolean(String(env[entry.envKey] ?? '').trim()),
                    online: false,
                    latencyMs: null,
                })),
            })
        }
    })

    addon.get('/health', (req, res) => res.type('text/plain').send('ok'))
    addon.use(createErrorHandler(logger))
    return addon
}

// Vercel Express framework expects a default-exported app instance.
// Named exports (createAddon, …) remain for api/index.js, Docker, and Workers.
export default createAddon({env: process.env})
