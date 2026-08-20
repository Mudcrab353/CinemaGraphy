/** Fetch-based HTTP client compatible with axios-like .get used by providers/utils. */
export function createFetchHttpClient(fetcher = fetch) {
    return {
        async get(url, config = {}) {
            const timeout = Number(config.timeout) || 15_000
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), timeout)
            try {
                const res = await fetcher(url, {
                    method: 'GET',
                    headers: config.headers || {},
                    signal: ctrl.signal,
                    redirect: 'follow',
                })
                const ct = res.headers.get('content-type') || ''
                let data
                if (ct.includes('application/json')) {
                    data = await res.json()
                } else {
                    data = await res.text()
                }
                const headers = {}
                res.headers.forEach((v, k) => {
                    headers[k] = v
                    headers[k.toLowerCase()] = v
                })
                if (config.validateStatus) {
                    if (!config.validateStatus(res.status)) {
                        const err = new Error(`Request failed with status ${res.status}`)
                        err.response = {status: res.status, data, headers}
                        throw err
                    }
                } else if (res.status >= 400) {
                    const err = new Error(`Request failed with status ${res.status}`)
                    err.response = {status: res.status, data, headers}
                    throw err
                }
                return {data, status: res.status, headers, statusText: res.statusText}
            } finally {
                clearTimeout(timer)
            }
        },
    }
}
