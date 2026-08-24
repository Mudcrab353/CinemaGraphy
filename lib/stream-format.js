/**
 * Stream title/name formatting, quality ranking, and provider display labels.
 * Extracted from utils.js + app.js — behavior must stay identical for Stremio/Nuvio.
 */

import {cleanSize, detectSize} from '../size-helpers.js'

/** Stream list labels follow addon UI language. */
let _uiLangPref = 'fa'

export function setUiLangPref(lang) {
    const v = String(lang || 'fa').trim().toLowerCase()
    _uiLangPref = v === 'en' || v === 'en-us' || v === 'english' ? 'en' : 'fa'
}

export function getUiLangPref() {
    return _uiLangPref
}

function streamUi() {
    if (_uiLangPref === 'en') {
        return {
            source: 'Source',
            quality: 'Quality',
            encode: 'Encode',
            size: 'Size',
            statusOk: 'Status: Uncensored',
            statusBad: 'Status: Censored',
            audioOnly: 'Audio only: Persian dub (no video)',
            audioDub: 'Audio: Persian dub',
            audioSub: 'Subtitles: Persian',
            audioBoth: 'Audio: Persian dub + subtitles',
            seeders: 'Seeders',
            peers: 'Peers',
            torrentLabel: 'CinemaGraphy [P2P]',
        }
    }
    return {
        source: 'منبع',
        quality: 'کیفیت',
        encode: 'انکد',
        size: 'حجم',
        statusOk: 'وضعیت: سانسور نشده',
        statusBad: 'وضعیت: سانسور شده',
        audioOnly: 'فقط فایل صوتی: دوبله فارسی (بدون تصویر)',
        audioDub: 'صدا: دوبله فارسی',
        audioSub: 'زیرنویس: فارسی',
        audioBoth: 'صدا: دوبله + زیرنویس فارسی',
        seeders: 'سیدر',
        peers: 'پیر',
        torrentLabel: 'سینماگرافی [P2P]',
    }
}

export const PROVIDER_LABELS = {
    f2media: 'F2Media',
    peepboxtv: 'PeepBoxTv',
    cinamatic: 'Cinamatic',
    aslmoviez: 'AslMoviez',
    serialblog: 'SerialBlog',
    digimovie: 'Digimoviez',
    avamovie: 'AvaMovie',
    zardfilm: 'ZardFilm',
    animex: 'Animex',
    donyayeserial: 'DonyayeSerial',
    torrent: 'سینماگرافی [P2P]',
}

// Whether each provider is known to censor content (based on the site's own
// stated policy / observed behaviour). Update this as new providers are
// checked. Anything not listed defaults to "uncensored" (unknown === assumed
// fine) — flip a provider to `true` as soon as it's confirmed to censor.
const PROVIDER_CENSORED = {
    zardfilm: true,
}

const PROVIDER_EMOJI = {
    f2media: '📀',
    peepboxtv: '📦',
    cinamatic: '🎦',
    aslmoviez: '🎬',
    serialblog: '📺',
    digimovie: '🎥',
    avamovie: '🍿',
    donyayeserial: '🌍',
    animex: '⛩️',
    torrent: '🧲',
}

const RESOLUTION_PATTERNS = [
    {re: /2160p|\b4k\b|uhd/i, label: '4K 2160p'},
    {re: /1080p/i, label: '1080p'},
    {re: /720p/i, label: '720p'},
    {re: /576p/i, label: '576p'},
    {re: /480p/i, label: '480p'},
    {re: /360p/i, label: '360p'},
]

function detectResolution(text) {
    for (const {re, label} of RESOLUTION_PATTERNS) {
        if (re.test(text)) {
            return label
        }
    }
    return null
}

function detectExtras(text) {
    const extras = []
    if (/hdr10\+/i.test(text)) {
        extras.push('HDR10+')
    } else if (/hdr10/i.test(text)) {
        extras.push('HDR10')
    } else if (/\bhdr\b/i.test(text)) {
        extras.push('HDR')
    }
    if (/10\s?bit/i.test(text)) {
        extras.push('10bit')
    }
    if (/dolby\s?vision|\bdv\b/i.test(text)) {
        extras.push('Dolby Vision')
    }
    return extras
}

function detectSource(text) {
    if (/blu-?ray|bdrip|brrip/i.test(text)) {
        return 'BluRay'
    }
    if (/web[.\-]?dl/i.test(text)) {
        return 'WEB-DL'
    }
    if (/webrip/i.test(text)) {
        return 'WEBRip'
    }
    if (/hdrip/i.test(text)) {
        return 'HDRip'
    }
    if (/hdtv/i.test(text)) {
        return 'HDTV'
    }
    if (/dvdrip/i.test(text)) {
        return 'DVDRip'
    }
    if (/camrip|hdcam|\bcam\b/i.test(text)) {
        return 'CAM'
    }
    return null
}

function detectCodec(text) {
    if (/x265|hevc|h\.?265/i.test(text)) {
        return 'x265/HEVC'
    }
    if (/x264|h\.?264|avc/i.test(text)) {
        return 'x264'
    }
    return null
}

function detectAudio(text, audioTypeHint) {
    const ui = streamUi()
    const hasDub = /دوبله/i.test(text) || /\bdub(bed)?\b/i.test(text)
    const hasSub = /زیرنویس/i.test(text) || /\bsub(bed|title)?\b/i.test(text) || /soft\s?sub|hard\s?sub/i.test(text)
    const isDual = /dual\s?audio/i.test(text) || (hasDub && hasSub)

    if (audioTypeHint === 'dubbed' || (hasDub && !isDual)) {
        return `🗣️ ${ui.audioDub}`
    }
    if (audioTypeHint === 'subtitled' || (hasSub && !isDual)) {
        return `💬 ${ui.audioSub}`
    }
    if (isDual) {
        return `🗣️💬 ${ui.audioBoth}`
    }
    return null
}

// Some providers also offer a standalone dubbed-audio-track download (no
// video at all) meant to be muxed with a copy of the movie you already have.
// These need a distinct, unambiguous label so they don't look like a normal
// video stream.
function isAudioOnlyFile(text) {
    return /فایل\s*صوتی|صوت\s*(جدا|خالی)|audio\s*only|dubbed\s*audio\s*track|\.(mp3|ac3|aac|flac|wav|m4a)(\?|$|\s)/i
        .test(text)
}

// Wraps LTR content (English/numbers) with Unicode directional isolate marks
// so it renders correctly when embedded inside RTL Persian text.
const LRI = '\u2066' // Left-to-Right Isolate
const PDI = '\u2069' // Pop Directional Isolate

function ltr(text) {
    return text ? `${LRI}${text}${PDI}` : text
}

// Almost every provider's actual filename (visible in the download URL) carries
// far more detail than the short on-page label — pull it in as extra
// detection text for every provider, universally, not just the ones whose
// scraper happens to capture it explicitly.
function filenameTextFromUrl(url) {
    try {
        const {pathname} = new URL(url)
        const raw = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '')
        return raw.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ')
    } catch {
        return ''
    }
}

function providerDisplayLabel(providerKey) {
    const ui = streamUi()
    if (providerKey === 'torrent') return ui.torrentLabel
    return PROVIDER_LABELS[providerKey] || providerKey || 'Unknown'
}

/** One-line header for Stremio/Nuvio `name` — never multi-line. */
export function formatStreamName({providerKey, quality, size, extraText, url} = {}) {
    const emoji = PROVIDER_EMOJI[providerKey] || '📡'
    const providerLabel = providerDisplayLabel(providerKey)
    const combinedText = [quality, extraText, filenameTextFromUrl(url)].filter(Boolean).join(' ')
    const resolution = detectResolution(combinedText) || (quality ? String(quality).trim() : '')
    const displaySize = cleanSize(size) || detectSize(combinedText)
    const parts = [providerLabel]
    if (resolution) parts.push(resolution)
    if (displaySize) parts.push(displaySize)
    return `${emoji} ${parts.join(' · ')}`
}

export function formatStreamTitle({providerKey, quality, size, audioType, extraText, url, seeders, peers} = {}) {
    const ui = streamUi()
    const providerLabel = providerDisplayLabel(providerKey)
    const emoji = PROVIDER_EMOJI[providerKey] || '📡'
    const combinedText = [quality, extraText, filenameTextFromUrl(url)].filter(Boolean).join(' ')
    const displaySize = cleanSize(size) || detectSize(combinedText)
    const isCensored = PROVIDER_CENSORED[providerKey] === true
    const statusLine = providerKey === 'torrent'
        ? null
        : (isCensored ? `⚠️ ${ui.statusBad}` : `✅ ${ui.statusOk}`)
    const healthLine = (seeders != null || peers != null)
        ? ltr([seeders != null ? `🌱 ${ui.seeders}: ${seeders}` : null, peers != null ? `👤 ${ui.peers}: ${peers}` : null]
            .filter(Boolean).join(' • '))
        : null

    if (isAudioOnlyFile(combinedText)) {
        const lines = [
            `${emoji} ${ui.source}: ${ltr(providerLabel)}`,
            `🎧 ${ui.audioOnly}`,
            displaySize ? `💾 ${ui.size}: ${ltr(displaySize)}` : null,
            healthLine,
            statusLine,
        ].filter(Boolean)
        return lines.join('\n')
    }

    const resolution = detectResolution(combinedText)
    const extras = detectExtras(combinedText)
    const source = detectSource(combinedText)
    const codec = detectCodec(combinedText)
    const audio = detectAudio(combinedText, audioType)

    const qualityLine = [resolution, source].filter(Boolean).join(' • ')
    const encodeLine = [...extras, codec].filter(Boolean).join(' • ')

    const lines = [
        `${emoji} ${ui.source}: ${ltr(providerLabel)}`,
        qualityLine ? `🎞️ ${ui.quality}: ${ltr(qualityLine)}` : null,
        encodeLine ? `⚙️ ${ui.encode}: ${ltr(encodeLine)}` : null,
        audio,
        displaySize ? `💾 ${ui.size}: ${ltr(displaySize)}` : null,
        healthLine,
        statusLine,
    ].filter(Boolean)

    return lines.length ? lines.join('\n') : (extraText || providerLabel)
}

// ---------------------------------------------------------------------------
// Quality ranking (was in app.js)
// ---------------------------------------------------------------------------

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

export function sortByQuality(streams) {
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
