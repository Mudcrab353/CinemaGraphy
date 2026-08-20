/** Optional media/stream proxy path for Cloudflare Worker. */
export function createWorkerProxyConfig(env = {}) {
    const path = String(env.PROXY_PATH || 'proxy').replace(/^\/+|\/+$/g, '') || 'proxy'
    return {path, enabled: env.PROXY_ENABLE === '1' || env.PROXY_ENABLE === 'true'}
}

export async function handleProxyRequest(request, env, fetcher = fetch, logger = console) {
    try {
        const url = new URL(request.url)
        const target = url.searchParams.get('url') || url.searchParams.get('u')
        if (!target || !/^https?:\/\//i.test(target)) {
            return new Response(JSON.stringify({error: 'missing url'}), {
                status: 400,
                headers: {'content-type': 'application/json'},
            })
        }
        const upstream = await fetcher(target, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CinemaGraphy/2.1)',
                Accept: '*/*',
            },
            redirect: 'follow',
        })
        const headers = new Headers()
        const ct = upstream.headers.get('content-type')
        if (ct) headers.set('content-type', ct)
        headers.set('cache-control', 'public, max-age=3600')
        headers.set('access-control-allow-origin', '*')
        return new Response(upstream.body, {status: upstream.status, headers})
    } catch (err) {
        logger.error?.('proxy failed', {message: err?.message})
        return new Response(JSON.stringify({error: 'proxy failed'}), {
            status: 502,
            headers: {'content-type': 'application/json'},
        })
    }
}
