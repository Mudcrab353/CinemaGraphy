/**
 * Config / secret safety helpers for CinemaGraphy.
 * Custom /c/{base64}/ URLs can embed TMDB keys and provider credentials —
 * these helpers redact, warn, and prepare for token-based config storage.
 */

/** Keys that must never appear in logs or public status endpoints */
export const SENSITIVE_CONFIG_KEYS = new Set([
    'TMDB_API_KEY',
    'DIGIMOVIE_USERNAME',
    'DIGIMOVIE_PASSWORD',
    'PROXY_URL',
    'NAMAKADE_BASEURL',
    'F2MEDIA_BASEURL',
    'PEEPBOXTV_BASEURL',
    'CINAMATIC_BASEURL',
    'ASLMOVIEZ_BASEURL',
    'SERIALBLOG_BASEURL',
    'DIGIMOVIE_BASEURL',
    'DONYAYESERIAL_BASEURL',
    'ANIMEX_BASEURL',
])

/**
 * Redact sensitive values for logging / public JSON.
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>}
 */
export function redactSecrets(obj) {
    if (!obj || typeof obj !== 'object') return obj
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
        if (SENSITIVE_CONFIG_KEYS.has(k) && v != null && String(v).trim()) {
            const s = String(v)
            out[k] = s.length <= 8 ? '***' : `${s.slice(0, 4)}…***`
        } else {
            out[k] = v
        }
    }
    return out
}

/**
 * True if encoded config likely contains sensitive keys (for UI warning).
 * @param {Record<string, any>|null} config
 */
export function configHasSecrets(config) {
    if (!config || typeof config !== 'object') return false
    return Object.keys(config).some((k) => SENSITIVE_CONFIG_KEYS.has(k) && String(config[k] || '').trim())
}

/**
 * Build a short public warning string (FA/EN) for configure / landing.
 */
export function configShareWarning(lang = 'fa') {
    if (String(lang).toLowerCase().startsWith('en')) {
        return 'Warning: Your custom install link may contain API keys and provider passwords. Do not share it publicly. Prefer server env vars for secrets.'
    }
    return 'هشدار: لینک نصب اختصاصی ممکن است شامل کلید API و رمز پروایدرها باشد. آن را عمومی منتشر نکنید. برای اطلاعات حساس از متغیرهای محیطی سرور استفاده کنید.'
}

/**
 * Future: map short opaque token → full config stored in KV/Redis.
 * Stub keeps API stable for next phase without breaking current URL configs.
 */
export async function resolveConfigToken(token, cacheGetFn) {
    if (!token || typeof cacheGetFn !== 'function') return null
    try {
        return await cacheGetFn(`cfg:${token}`)
    } catch {
        return null
    }
}

export async function storeConfigToken(token, config, cacheSetFn, ttlMs = 30 * 24 * 60 * 60 * 1000) {
    if (!token || !config || typeof cacheSetFn !== 'function') return false
    try {
        await cacheSetFn(`cfg:${token}`, config, ttlMs)
        return true
    } catch {
        return false
    }
}
