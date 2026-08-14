/**
 * Netflix-style landing for Express / Vercel / Cloudflare Workers.
 */
const LOGO_FALLBACK = 'https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy/refs/heads/master/logo.png'
const PUBLIC_INSTALL = 'https://cinemagraphy.vercel.app/manifest.json'
const PUBLIC_SITE = 'https://cinemagraphy.vercel.app'

export function renderLandingPage({
  manifestUrl = PUBLIC_INSTALL,
  installUrl,
  logoUrl = '/logo.png',
  version = '1.9.0',
} = {}) {
  const m = escapeHtml(manifestUrl || PUBLIC_INSTALL)
  const install = escapeHtml(installUrl || `stremio://${String(manifestUrl || PUBLIC_INSTALL).replace(/^https?:\/\//i, '')}`)
  const logo = escapeHtml(logoUrl || LOGO_FALLBACK)
  const ver = escapeHtml(String(version || '1.9.0'))
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" data-theme="dark">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>سینماگرافی — Cinemagraphy</title>
<link rel="icon" href="${logo}"/>
<style>
:root,[data-theme=dark]{--bg:#0a0a0a;--card:#1a1a1a;--text:#f5f5f5;--muted:#a3a3a3;--accent:#e50914;--ok:#46d369;--border:rgba(255,255,255,.1);--glow:rgba(229,9,20,.35)}
[data-theme=light]{--bg:#f5f5f5;--card:#fff;--text:#141414;--muted:#525252;--border:rgba(0,0,0,.08)}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Vazirmatn,Segoe UI,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6}
.lang-en{display:none}html[lang=en] .lang-fa{display:none}html[lang=en] .lang-en{display:block}html[lang=en] body{direction:ltr}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 6vw;position:sticky;top:0;backdrop-filter:blur(8px);z-index:10}
.brand{display:flex;gap:12px;align-items:center;color:var(--text);text-decoration:none;font-weight:800;font-size:1.2rem}
.brand img{width:42px;height:42px;border-radius:10px;animation:f 3s ease-in-out infinite;box-shadow:0 8px 24px var(--glow)}
@keyframes f{50%{transform:translateY(-6px)}}
.chip{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;padding:8px 14px;cursor:pointer;font-weight:600}
.hero{max-width:1100px;margin:0 auto;padding:40px 6vw;display:grid;grid-template-columns:1.2fr .8fr;gap:32px;align-items:center}
@media(max-width:800px){.hero{grid-template-columns:1fr;text-align:center}.vis{order:-1}}
h1{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:900;line-height:1.2;margin:8px 0 12px}h1 span{color:var(--accent)}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.75rem;background:rgba(229,9,20,.15);color:var(--accent);font-weight:700}
.lead{color:var(--muted);margin-bottom:22px;max-width:32rem}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}@media(max-width:800px){.row{justify-content:center}}
.btn{display:inline-flex;padding:13px 20px;border-radius:8px;font-weight:800;text-decoration:none;border:none;cursor:pointer}
.bp{background:var(--accent);color:#fff}.bg{background:rgba(109,109,110,.35);color:var(--text);border:1px solid var(--border)}
.box{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px}
.box label{font-size:.75rem;color:var(--muted);display:block;margin-bottom:6px}
.box .r{display:flex;gap:8px}.box input{flex:1;background:transparent;border:none;color:var(--text);font-family:monospace;font-size:.78rem;direction:ltr;outline:none}
.copy{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:8px;padding:8px 12px;cursor:pointer}
.vis{display:flex;justify-content:center}.stage{width:min(280px,70vw);animation:f 4s ease-in-out infinite;filter:drop-shadow(0 20px 40px var(--glow))}
.stage img{width:100%;border-radius:24px}
section{max-width:1100px;margin:0 auto;padding:28px 6vw}section h2{margin-bottom:6px}section .sub{color:var(--muted);margin-bottom:16px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.c,.p{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
.c:hover,.p:hover{border-color:rgba(229,9,20,.4)}
.p{text-align:center;text-decoration:none;color:var(--text);font-weight:700}
.pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.pl .c{display:flex;gap:10px;align-items:flex-start}
footer{margin-top:24px;padding:24px 6vw 36px;border-top:1px solid var(--border);text-align:center;color:var(--muted);font-size:.85rem}
footer a{color:var(--accent);text-decoration:none}
</style>
</head>
<body>
<header>
<a class="brand" href="/"><img src="${logo}" alt="Cinemagraphy" onerror="this.src='${LOGO_FALLBACK}'"/><span>سینماگرافی</span></a>
<div style="display:flex;gap:8px"><button class="chip" id="langBtn" type="button">EN</button><button class="chip" id="themeBtn" type="button">☀️</button></div>
</header>
<main>
<div class="hero">
<div>
<span class="badge">v${ver}</span>
<h1 class="lang-fa">سینماگرافی<br/><span>فیلم، سریال، انیمه</span></h1>
<h1 class="lang-en">Cinemagraphy<br/><span>Movies, Series, Anime</span></h1>
<p class="lead lang-fa">افزونه‌ی استریمیو برای منابع ایرانی و بین‌المللی — کیفیت، حجم و سانسور در یک جا.</p>
<p class="lead lang-en">Stremio addon for Iranian &amp; international sources — quality, size and censor status in one place.</p>
<div class="row">
<a class="btn bp" href="${install}"><span class="lang-fa">نصب در Stremio</span><span class="lang-en">Install in Stremio</span></a>
<a class="btn bg" href="${m}" target="_blank" rel="noopener">manifest.json</a>
</div>
<div class="box"><label class="lang-fa">لینک منیفست عمومی</label><label class="lang-en">Public manifest</label>
<div class="r"><input id="manifestUrl" readonly value="${m}"/><button class="copy" id="copyBtn" type="button"><span class="lang-fa">کپی</span><span class="lang-en">Copy</span></button></div></div>
</div>
<div class="vis"><div class="stage"><img src="${logo}" alt="logo" onerror="this.src='${LOGO_FALLBACK}'"/></div></div>
</div>
<section>
<h2 class="lang-fa">دانلود Stremio</h2><h2 class="lang-en">Download Stremio</h2>
<p class="sub lang-fa">اول استریمیو، بعد افزونه.</p><p class="sub lang-en">Install Stremio first, then the addon.</p>
<div class="g">
<a class="p" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Windows</a>
<a class="p" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">macOS</a>
<a class="p" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Linux</a>
<a class="p" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Android</a>
<a class="p" href="https://apps.apple.com/app/stremio/id1297124690" target="_blank" rel="noopener">iOS / tvOS</a>
</div>
</section>
<section>
<h2 class="lang-fa">افزونه‌های پیشنهادی</h2><h2 class="lang-en">Recommended addons</h2>
<div class="pl">
<div class="c"><span>🎬</span><div><b>Torrentio</b><br/><span style="color:var(--muted);font-size:.85rem">Torrent / Debrid</span></div></div>
<div class="c"><span>📡</span><div><b>MediaFusion</b><br/><span style="color:var(--muted);font-size:.85rem">Multi-source</span></div></div>
<div class="c"><span>🗂️</span><div><b>101Catalogs</b><br/><span style="color:var(--muted);font-size:.85rem">Catalogs</span></div></div>
<div class="c"><span>🌸</span><div><b>Anime Catalogs</b><br/><span style="color:var(--muted);font-size:.85rem">Anime</span></div></div>
<div class="c"><span>💬</span><div><b>SubSource</b><br/><span style="color:var(--muted);font-size:.85rem">Subtitles</span></div></div>
<div class="c"><span>📺</span><div><b>IPTV Bridge</b><br/><span style="color:var(--muted);font-size:.85rem">Live TV</span></div></div>
</div>
</section>
</main>
<footer>
<p class="lang-fa">عمومی: <a href="${PUBLIC_SITE}">cinemagraphy.vercel.app</a> · <a href="${PUBLIC_INSTALL}">manifest.json</a></p>
<p class="lang-en">Public: <a href="${PUBLIC_SITE}">cinemagraphy.vercel.app</a> · <a href="${PUBLIC_INSTALL}">manifest.json</a></p>
<p style="margin-top:10px" class="lang-fa">با احترام به <a href="https://github.com/MrMohebi/stremio-ir-providers" target="_blank" rel="noopener">stremio-ir-providers</a> اثر آقای محبی</p>
<p style="margin-top:10px" class="lang-en">With respect to <a href="https://github.com/MrMohebi/stremio-ir-providers" target="_blank" rel="noopener">stremio-ir-providers</a> by MrMohebi</p>
<p style="margin-top:8px"><a href="https://github.com/TheNerdCow/CinemaGraphy">GitHub</a></p>
</footer>
<script>
(function(){
const r=document.documentElement,lb=document.getElementById('langBtn'),tb=document.getElementById('themeBtn');
let L=localStorage.getItem('cg-lang')||'fa',T=localStorage.getItem('cg-theme')||'dark';
function al(l){r.lang=l;r.dir=l==='fa'?'rtl':'ltr';lb.textContent=l==='fa'?'EN':'FA';localStorage.setItem('cg-lang',l)}
function at(t){r.setAttribute('data-theme',t);tb.textContent=t==='dark'?'☀️':'🌙';localStorage.setItem('cg-theme',t)}
al(L);at(T);lb.onclick=()=>al(r.lang==='fa'?'en':'fa');tb.onclick=()=>at(r.getAttribute('data-theme')==='dark'?'light':'dark');
const cb=document.getElementById('copyBtn'),inp=document.getElementById('manifestUrl');
if(cb&&inp)cb.onclick=async()=>{try{await navigator.clipboard.writeText(inp.value);cb.textContent=r.lang==='fa'?'کپی شد':'Copied'}catch{inp.select()}};
})();
</script>
</body></html>`
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

export function landingUrlsFromRequest(requestLike, env = {}) {
  let protocol = 'https', host = ''
  if (typeof requestLike?.get === 'function') {
    protocol = String(requestLike.headers?.['x-forwarded-proto'] || requestLike.protocol || 'https').split(',')[0].trim()
    host = String(requestLike.headers?.['x-forwarded-host'] || requestLike.get('host') || '').split(',')[0].trim()
  } else if (requestLike?.url) {
    const u = new URL(requestLike.url)
    protocol = u.protocol.replace(':','') || 'https'
    host = u.host
  }
  if (!host && env.PUBLIC_BASE_URL) {
    try { const b = new URL(env.PUBLIC_BASE_URL); protocol = b.protocol.replace(':','') || protocol; host = b.host } catch {}
  }
  const origin = host ? `${protocol}://${host}` : PUBLIC_SITE
  return {
    manifestUrl: `${origin}/manifest.json`,
    installUrl: host ? `stremio://${host}/manifest.json` : 'stremio://cinemagraphy.vercel.app/manifest.json',
    logoUrl: `${origin}/logo.png`,
    origin,
  }
}
