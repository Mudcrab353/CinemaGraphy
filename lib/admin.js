/**
 * Password-protected admin panel for CinemaGraphy (owner-only).
 * Env:
 *   ADMIN_PASSWORD=...     (required to enable panel)
 *   ADMIN_PATH=/admin      (optional path prefix)
 *
 * Cookie session is HMAC-signed with ADMIN_PASSWORD (no extra deps).
 */

import {createHmac, timingSafeEqual, randomBytes} from 'node:crypto'
import {cacheStats, cacheClearAll} from './cache.js'
import {rateLimitStats} from './rate-limit.js'
import {redactSecrets} from './security.js'

const COOKIE = 'cg_admin'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

function adminPath(env) {
    const p = String(env.ADMIN_PATH || '/admin').trim() || '/admin'
    return p.startsWith('/') ? p.replace(/\/$/, '') || '/admin' : `/${p}`
}

function sign(payload, secret) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = createHmac('sha256', secret).update(body).digest('base64url')
    return `${body}.${sig}`
}

function verify(token, secret) {
    if (!token || !secret) return null
    const i = token.lastIndexOf('.')
    if (i < 1) return null
    const body = token.slice(0, i)
    const sig = token.slice(i + 1)
    const expect = createHmac('sha256', secret).update(body).digest('base64url')
    try {
        const a = Buffer.from(sig)
        const b = Buffer.from(expect)
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null
        const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
        if (!data?.exp || Date.now() > data.exp) return null
        return data
    } catch {
        return null
    }
}

function parseCookies(req) {
    const raw = String(req.headers.cookie || '')
    const out = {}
    for (const part of raw.split(';')) {
        const [k, ...rest] = part.trim().split('=')
        if (k) out[k] = decodeURIComponent(rest.join('=') || '')
    }
    return out
}

function isAuthed(req, secret) {
    const c = parseCookies(req)[COOKIE]
    return Boolean(verify(c, secret))
}

function loginHtml(base, error = '') {
    const err = error
        ? `<p style="color:#f88;margin:12px 0">${escapeHtml(error)}</p>`
        : ''
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin — سینماگرافی</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.box{background:#1a1d24;border:1px solid #333;border-radius:16px;padding:28px;width:min(360px,92vw)}
h1{font-size:1.2rem;margin:0 0 8px}
p{color:#9aa0a6;font-size:.9rem}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #444;background:#0f1115;color:#fff;margin:12px 0;box-sizing:border-box}
button{width:100%;padding:12px;border:0;border-radius:10px;background:#e8a04a;color:#111;font-weight:700;cursor:pointer}
</style></head><body>
<form class="box" method="POST" action="${base}/login">
<h1>ورود مدیریت</h1>
<p>فقط مالک افزونه — رمز از متغیر ADMIN_PASSWORD</p>
${err}
<input type="password" name="password" placeholder="رمز عبور" autocomplete="current-password" required autofocus/>
<button type="submit">ورود</button>
</form></body></html>`
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]))
}

function dashboardHtml(base, info) {
    const provRows = (info.providers || []).map((p) => {
        const st = p.online ? '🟢' : (p.configured ? '🔴' : '⚪')
        return `<tr><td>${escapeHtml(p.name)}</td><td>${st}</td><td>${p.latencyMs ?? '—'}</td></tr>`
    }).join('')
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>پنل مدیریت — سینماگرافی</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;margin:0;padding:20px}
.wrap{max-width:900px;margin:0 auto}
h1{font-size:1.4rem}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin:16px 0}
.card{background:#1a1d24;border:1px solid #333;border-radius:12px;padding:14px}
.card b{display:block;font-size:1.3rem;color:#e8a04a}
table{width:100%;border-collapse:collapse;background:#1a1d24;border-radius:12px;overflow:hidden}
td,th{padding:10px 12px;border-bottom:1px solid #2a2e36;text-align:right;font-size:.9rem}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
a.btn,button.btn{display:inline-block;padding:10px 16px;border-radius:10px;background:#e8a04a;color:#111;font-weight:700;text-decoration:none;border:0;cursor:pointer}
a.ghost{background:transparent;border:1px solid #555;color:#ccc}
.muted{color:#9aa0a6;font-size:.85rem}
code{background:#000;padding:2px 6px;border-radius:4px}
</style></head><body><div class="wrap">
<h1>پنل مدیریت سینماگرافی</h1>
<p class="muted">نسخه <code>${escapeHtml(info.version)}</code> · فقط شما با رمز دسترسی دارید</p>
<div class="cards">
<div class="card"><span class="muted">وضعیت</span><b>${info.ok ? 'OK' : '؟'}</b></div>
<div class="card"><span class="muted">کش</span><b>${info.cache?.memorySize ?? 0}</b><span class="muted">${escapeHtml(info.cache?.backend || 'memory')}</span></div>
<div class="card"><span class="muted">Rate limit</span><b>${info.rateLimit?.bucketCount ?? 0}</b></div>
<div class="card"><span class="muted">پروایدر آنلاین</span><b>${info.onlineCount}/${info.providerCount}</b></div>
</div>
<div class="actions">
<form method="POST" action="${base}/api/cache-clear" style="margin:0"><button class="btn" type="submit">پاک کردن کش حافظه</button></form>
<form method="POST" action="${base}/logout" style="margin:0"><button class="btn ghost" type="submit">خروج</button></form>
<a class="btn ghost" href="/providers.json" target="_blank">providers.json</a>
<a class="btn ghost" href="/manifest.json" target="_blank">manifest</a>
</div>
<h2>پروایدرها</h2>
<table><thead><tr><th>نام</th><th>وضعیت</th><th>ms</th></tr></thead>
<tbody>${provRows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
<h2>تنظیمات (مخفی‌شده)</h2>
<pre class="muted" style="background:#1a1d24;padding:12px;border-radius:12px;overflow:auto">${escapeHtml(JSON.stringify(info.envPreview, null, 2))}</pre>
<p class="muted">زمان سرور: ${escapeHtml(info.checkedAt)}</p>
</div></body></html>`
}

/**
 * Register /admin routes on the Express app.
 * If ADMIN_PASSWORD is empty, panel returns 404 (disabled).
 */
export function registerAdminRoutes(addon, {
    env = process.env,
    logger = console,
    getProvidersStatus,
    version = '3.2.0',
} = {}) {
    const secret = String(env.ADMIN_PASSWORD || '').trim()
    const base = adminPath(env)

    if (!secret) {
        logger.info?.('Admin panel disabled (set ADMIN_PASSWORD to enable)')
        addon.use(base, (_req, res) => {
            res.status(404).type('text/plain').send('Not found')
        })
        return
    }

    addon.get(base, async (req, res) => {
        if (!isAuthed(req, secret)) {
            res.status(200).type('html').send(loginHtml(base))
            return
        }
        let providers = []
        try {
            if (typeof getProvidersStatus === 'function') {
                const data = await getProvidersStatus(env)
                providers = data?.providers || []
            }
        } catch (e) {
            logger.error?.('admin providers', {message: e?.message})
        }
        const onlineCount = providers.filter((p) => p.online).length
        const envPreview = redactSecrets({
            LOG_LEVEL: env.LOG_LEVEL,
            CACHE_BACKEND: env.CACHE_BACKEND || 'memory',
            RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
            RATE_LIMIT_MAX: env.RATE_LIMIT_MAX,
            F2MEDIA_BASEURL: env.F2MEDIA_BASEURL ? '(set)' : '',
            TMDB_API_KEY: env.TMDB_API_KEY ? '(set)' : '',
            NODE_ENV: env.NODE_ENV,
        })
        res.status(200).type('html').send(dashboardHtml(base, {
            version,
            ok: true,
            checkedAt: new Date().toISOString(),
            cache: cacheStats(),
            rateLimit: rateLimitStats(),
            providers,
            onlineCount,
            providerCount: providers.length,
            envPreview,
        }))
    })

    addon.post(`${base}/login`, expressUrlencoded, (req, res) => {
        const pass = String(req.body?.password || '')
        const a = Buffer.from(pass)
        const b = Buffer.from(secret)
        let ok = a.length === b.length
        try {
            ok = ok && timingSafeEqual(a, b)
        } catch {
            ok = false
        }
        if (!ok) {
            res.status(401).type('html').send(loginHtml(base, 'رمز اشتباه است'))
            return
        }
        const token = sign({exp: Date.now() + SESSION_TTL_MS, n: randomBytes(8).toString('hex')}, secret)
        res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=${base}; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`)
        res.redirect(302, base)
    })

    addon.post(`${base}/logout`, (_req, res) => {
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=${base}; HttpOnly; Max-Age=0`)
        res.redirect(302, base)
    })

    addon.post(`${base}/api/cache-clear`, (req, res) => {
        if (!isAuthed(req, secret)) {
            res.status(401).json({ok: false})
            return
        }
        try {
            cacheClearAll()
            logger.info?.('Admin cleared memory cache')
        } catch (e) {
            logger.error?.('cache clear failed', {message: e?.message})
        }
        res.redirect(302, base)
    })
}

/** Minimal urlencoded parser without body-parser dependency */
function expressUrlencoded(req, res, next) {
    if (req.method !== 'POST') return next()
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        req.body = {}
        for (const part of raw.split('&')) {
            const [k, v] = part.split('=')
            if (k) req.body[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '))
        }
        next()
    })
}
