/** Shared /c/<config> decode + merge for Cloudflare Worker (parity with Express). */
const PROVIDER_BASEURL_KEYS = [
    'F2MEDIA_BASEURL', 'PEEPBOXTV_BASEURL', 'CINAMATIC_BASEURL', 'ASLMOVIEZ_BASEURL',
    'SERIALBLOG_BASEURL', 'DIGIMOVIE_BASEURL', 'AVAMOVIE_BASEURL', 'DONYAYESERIAL_BASEURL', 'ANIMEX_BASEURL',
]
const PROVIDER_KEY_TO_ENV = {
    f2media: 'F2MEDIA_BASEURL', peepboxtv: 'PEEPBOXTV_BASEURL', cinamatic: 'CINAMATIC_BASEURL',
    aslmoviez: 'ASLMOVIEZ_BASEURL', serialblog: 'SERIALBLOG_BASEURL', digimovie: 'DIGIMOVIE_BASEURL', avamovie: 'AVAMOVIE_BASEURL',
    donyayeserial: 'DONYAYESERIAL_BASEURL', animex: 'ANIMEX_BASEURL',
}
const CONFIG_ALLOW = new Set([
    'TMDB_API_KEY', 'ENABLED_PROVIDERS', 'TORRENT_METEOR_MANIFEST_URL',
    'EXTERNAL_CATALOG_MANIFEST_URLS', 'CATALOG_AIO_MANIFEST_URL', 'CATALOG_AIOCATALOGS_MANIFEST_URL',
    'CATALOG101_MANIFEST_URL', 'CATALOG_ANIME_MANIFEST_URL', 'CATALOG_IPTVBRIDGE_MANIFEST_URL',
    'CATALOG_TMDB_MANIFEST_URL', 'PROVIDER_TIMEOUT_MS', 'DIGIMOVIE_USERNAME', 'DIGIMOVIE_PASSWORD', 'DIGIMOVIE_COOKIE', 'AVAMOVIE_USERNAME', 'AVAMOVIE_PASSWORD', 'AVAMOVIE_COOKIE',
    'PROXY_ENABLE', 'PROXY_URL', 'PROXY_PATH', 'DISABLE_META', 'DISABLE_CATALOG', 'DISABLE_SUBTITLES',
    'STREAMS_ONLY', 'ADDON_NAME_SUFFIX', 'META_LANG', 'ADDON_LANG', 'ENABLE_IPTV', 'ENABLE_NAMAKADE', 'ENABLE_F2_TURKISH', 'ENABLE_ANIMEX_CATALOG',
    'NAMAKADE_BASEURL', ...PROVIDER_BASEURL_KEYS,
])
const DEFAULT_IPTV_BRIDGE_MANIFEST_URL = 'https://iptvbridge.vercel.app/manifest.json'

export function isConfigFlagOn(env, key) {
    const v = String(env?.[key] ?? '').trim().toLowerCase()
    return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function base64UrlToUtf8(encoded) {
    const s = String(encoded || '')
    try {
        if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64url').toString('utf8')
    } catch { /* fall through */ }
    const pad = '='.repeat((4 - (s.length % 4)) % 4)
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    try {
        return decodeURIComponent(Array.from(bin, (c) => '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
    } catch { return bin }
}

export function decodeAddonConfig(encoded) {
    if (!encoded) return null
    try {
        const json = base64UrlToUtf8(decodeURIComponent(String(encoded)))
        const obj = JSON.parse(json)
        if (!obj || typeof obj !== 'object') return null
        const out = {}
        for (const [k, v] of Object.entries(obj)) {
            if (!CONFIG_ALLOW.has(k) || v == null) continue
            const s = String(v).trim()
            if (s) out[k] = s
        }
        return Object.keys(out).length ? out : null
    } catch { return null }
}

export function mergeEnv(baseEnv = {}, config) {
    if (!config) return baseEnv
    const e = {...baseEnv, ...config}
    const enabled = String(config.ENABLED_PROVIDERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    const explicitBase = PROVIDER_BASEURL_KEYS.filter((k) => String(config[k] || '').trim())
    if (enabled.length || explicitBase.length) {
        for (const k of PROVIDER_BASEURL_KEYS) delete e[k]
        for (const k of explicitBase) e[k] = String(config[k]).trim()
        for (const key of enabled) {
            const envKey = PROVIDER_KEY_TO_ENV[key]
            if (!envKey) continue
            if (String(config[envKey] || '').trim()) e[envKey] = String(config[envKey]).trim()
            else if (String(baseEnv[envKey] || '').trim()) e[envKey] = String(baseEnv[envKey]).trim()
        }
    }
    if (Object.prototype.hasOwnProperty.call(config, 'ENABLE_IPTV')
        || Object.prototype.hasOwnProperty.call(config, 'CATALOG_IPTVBRIDGE_MANIFEST_URL')) {
        const iptvOn = isConfigFlagOn(config, 'ENABLE_IPTV')
            || Boolean(String(config.CATALOG_IPTVBRIDGE_MANIFEST_URL || '').trim())
        const customIptv = String(config.CATALOG_IPTVBRIDGE_MANIFEST_URL || '').trim()
        if (!iptvOn) delete e.CATALOG_IPTVBRIDGE_MANIFEST_URL
        else if (customIptv) e.CATALOG_IPTVBRIDGE_MANIFEST_URL = customIptv
        else e.CATALOG_IPTVBRIDGE_MANIFEST_URL = String(baseEnv.CATALOG_IPTVBRIDGE_MANIFEST_URL || '').trim() || DEFAULT_IPTV_BRIDGE_MANIFEST_URL
    }
    if (isConfigFlagOn(config, 'STREAMS_ONLY') || isConfigFlagOn(config, 'DISABLE_CATALOG')) {
        delete e.CATALOG101_MANIFEST_URL
        delete e.CATALOG_AIO_MANIFEST_URL
        delete e.CATALOG_AIOCATALOGS_MANIFEST_URL
        delete e.CATALOG_TMDB_MANIFEST_URL
        delete e.CATALOG_ANIME_MANIFEST_URL
        delete e.EXTERNAL_CATALOG_MANIFEST_URLS
        // personal off switches for built-in rails
        e.ENABLE_F2_TURKISH = '0'
        e.ENABLE_ANIMEX_CATALOG = '0'
    }
    // Explicit 0/1 from /configure must override server env defaults
    if (Object.prototype.hasOwnProperty.call(config, 'ENABLE_F2_TURKISH')) {
        e.ENABLE_F2_TURKISH = isConfigFlagOn(config, 'ENABLE_F2_TURKISH') ? '1' : '0'
    }
    if (Object.prototype.hasOwnProperty.call(config, 'ENABLE_ANIMEX_CATALOG')) {
        e.ENABLE_ANIMEX_CATALOG = isConfigFlagOn(config, 'ENABLE_ANIMEX_CATALOG') ? '1' : '0'
    }
    if (Object.prototype.hasOwnProperty.call(config, 'ENABLE_NAMAKADE')) {
        e.ENABLE_NAMAKADE = isConfigFlagOn(config, 'ENABLE_NAMAKADE') ? '1' : '0'
    }
    return e
}
