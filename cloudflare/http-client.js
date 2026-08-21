/** Fetch-based HTTP client compatible with axios-like .get used by providers/utils.
 *  Critical: axios serializes `config.params` into the query string. Without this,
 *  TMDB calls miss api_key and landing/meta return empty arrays on Cloudflare.
 */
export function createFetchHttpClient(fetcher = fetch) {
    return {
        async get(url, config = {}) {
            const timeout = Number(config.timeout) || 15_000
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), timeout)
            try {
                let finalUrl = String(url || '')
                if (config.params && typeof config.params === 'object') {
                    try {
                        const u = new URL(finalUrl)
                        for (const [k, v] of Object.entries(config.params)) {
                            if (v === undefined || v === null) continue
                            u.searchParams.set(k, String(v))
                        }
                        finalUrl = u.toString()
                    } catch {
                        const qs = Object.entries(config.params)
                            .filter(([, v]) => v !== undefined && v !== null)
                            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                            .join('&')
                        if (qs) {
                            finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs
                        }
                    }
                }

                const headers = {...(config.headers || {})}
                const wantBuffer = config.responseType === 'arraybuffer' || config.responseType === 'blob'

                const res = await fetcher(finalUrl, {
                    method: 'GET',
                    headers,
                    signal: ctrl.signal,
                    redirect: 'follow',
                })

                const ct = res.headers.get('content-type') || ''
                let data
                if (wantBuffer) {
                    data = await res.arrayBuffer()
                } else if (ct.includes('application/json')) {
                    data = await res.json()
                } else {
                    data = await res.text()
                }

                const outHeaders = {}
                res.headers.forEach((v, k) => {
                    outHeaders[k] = v
                    outHeaders[k.toLowerCase()] = v
                })

                if (config.validateStatus) {
                    if (!config.validateStatus(res.status)) {
                        const err = new Error(`Request failed with status ${res.status}`)
                        err.response = {status: res.status, data, headers: outHeaders}
                        throw err
                    }
                } else if (res.status >= 400) {
                    const err = new Error(`Request failed with status ${res.status}`)
                    err.response = {status: res.status, data, headers: outHeaders}
                    throw err
                }

                return {data, status: res.status, headers: outHeaders, statusText: res.statusText}
            } finally {
                clearTimeout(timer)
            }
        },
    }
}
