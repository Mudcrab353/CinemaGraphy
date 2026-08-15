/**
 * Liquid Glass landing — Interstellar-inspired
 * Install + Manifest copy, ranked companion addons, GitHub-only footer
 */
const LOGO_FALLBACK = 'https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy/refs/heads/master/logo.png'
const PUBLIC_INSTALL = 'https://cinemagraphy.vercel.app/manifest.json'
const PUBLIC_SITE = 'https://cinemagraphy.vercel.app'
const GITHUB_URL = 'https://github.com/TheNerdCow/CinemaGraphy'
const TELEGRAM_CHANNEL = 'https://t.me/cinemmagraphy'
const TELEGRAM_SUPPORT = 'https://t.me/nerdcow'

// Popular companions (rough order from stremio-addons.net / community rankings 2026)
const RECOMMENDED = [
  {
    name: 'Torrentio',
    descFa: 'محبوب‌ترین منبع تورنت / Debrid',
    descEn: 'Most popular torrent / Debrid sources',
    href: 'https://torrentio.strem.fun/configure',
    icon: 'https://www.google.com/s2/favicons?domain=torrentio.strem.fun&sz=128',
  },
  {
    name: 'Comet',
    descFa: 'جستجوی سریع تورنت و Debrid',
    descEn: 'Fast torrent & Debrid search',
    href: 'https://comet.elfhosted.com/configure',
    icon: 'https://www.google.com/s2/favicons?domain=comet.elfhosted.com&sz=128',
  },
  {
    name: 'MediaFusion',
    descFa: 'چندمنبعی فیلم، سریال و بیشتر',
    descEn: 'Multi-source movies & series',
    href: 'https://mediafusion.elfhosted.com/configure',
    icon: 'https://www.google.com/s2/favicons?domain=mediafusion.elfhosted.com&sz=128',
  },
  {
    name: 'AIOStreams',
    descFa: 'ادغام چند افزونه در یک لیست',
    descEn: 'Merge multiple addons into one list',
    href: 'https://aiostreams.elfhosted.com/stremio/configure',
    icon: 'https://aiostreams.elfhosted.com/logo.png',
  },
  {
    name: 'OpenSubtitles v3',
    descFa: 'زیرنویس رسمی استریمیو',
    descEn: 'Official-style subtitle addon',
    href: 'https://opensubtitles-v3.strem.io/manifest.json',
    icon: 'https://www.google.com/s2/favicons?domain=opensubtitles.com&sz=128',
  },
  {
    name: 'Anime Kitsu',
    descFa: 'کاتالوگ انیمه (Kitsu)',
    descEn: 'Anime catalogs via Kitsu',
    href: 'https://anime-kitsu.strem.fun/manifest.json',
    icon: 'https://www.google.com/s2/favicons?domain=kitsu.io&sz=128',
  },
]

export function renderLandingPage({
  manifestUrl = PUBLIC_INSTALL,
  installUrl,
  logoUrl = '/logo.png',
  version = '2.1.2',
} = {}) {
  const m = escapeHtml(manifestUrl || PUBLIC_INSTALL)
  const install = escapeHtml(
    installUrl || `stremio://${String(manifestUrl || PUBLIC_INSTALL).replace(/^https?:\/\//i, '')}`,
  )
  const logo = escapeHtml(logoUrl || LOGO_FALLBACK)
  const ver = escapeHtml(String(version || '2.1.2'))

  const addonCards = RECOMMENDED.map(
    (a) => `
<a class="c glass" href="${escapeHtml(a.href)}" target="_blank" rel="noopener">
  <img class="ico-img" src="${escapeHtml(a.icon)}" alt="" width="40" height="40" loading="lazy" onerror="this.style.display='none'"/>
  <div>
    <b>${escapeHtml(a.name)}</b>
    <span class="lang-fa">${escapeHtml(a.descFa)}</span>
    <span class="lang-en">${escapeHtml(a.descEn)}</span>
  </div>
</a>`,
  ).join('')

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>سینماگرافی — Cinemagraphy</title>
<link rel="icon" href="${logo}"/>
<style>
:root{--t:#f4f0ea;--m:#a89f94;--a:#e8a04a;--a2:#7eb6ff;--g:rgba(255,255,255,.07);--gb:rgba(255,255,255,.14);--gl:rgba(232,160,74,.35)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Vazirmatn,Tahoma,Segoe UI,system-ui,sans-serif;color:var(--t);min-height:100vh;line-height:1.65;overflow-x:hidden;
cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='8' cy='8' r='5.5' fill='none' stroke='%23e8a04a' stroke-width='1.8'/%3E%3Ccircle cx='8' cy='8' r='1.6' fill='%23e8a04a'/%3E%3Cpath d='M12.5 12.5L22 22' stroke='%23e8a04a' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") 8 8,auto}
a,button,.chip,.btn,.copy{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='8' cy='8' r='6' fill='rgba(232,160,74,.25)' stroke='%23e8a04a' stroke-width='1.8'/%3E%3Ccircle cx='8' cy='8' r='2' fill='%23e8a04a'/%3E%3C/svg%3E") 8 8,pointer}
.bg{position:fixed;inset:0;z-index:-2;background:
radial-gradient(ellipse 120% 80% at 50% 120%,#1a0a2e 0%,transparent 55%),
radial-gradient(ellipse 60% 50% at 80% 20%,#0d1b3a 0%,transparent 50%),
radial-gradient(ellipse 50% 40% at 15% 30%,#1a1025 0%,transparent 45%),
linear-gradient(180deg,#050508,#0a0612 40%,#12081c)}
.stars{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.7;
background-image:radial-gradient(1.5px 1.5px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 50% 15%,#ffe9c4,transparent),radial-gradient(1px 1px at 70% 40%,#fff,transparent),radial-gradient(1px 1px at 85% 75%,#cde4ff,transparent),radial-gradient(1.5px 1.5px at 20% 80%,#fff,transparent),radial-gradient(1px 1px at 60% 90%,#fff,transparent),radial-gradient(1px 1px at 40% 35%,#ffe9c4,transparent),radial-gradient(1.5px 1.5px at 90% 10%,#fff,transparent),radial-gradient(1px 1px at 5% 50%,#fff,transparent)}
.neb{position:fixed;z-index:-1;pointer-events:none;border-radius:50%;filter:blur(80px);opacity:.28}
.n1{top:-20%;right:-15%;width:70vw;height:70vw;background:radial-gradient(circle,#3d1a6e,transparent 70%)}
.n2{bottom:-25%;left:-20%;width:70vw;height:70vw;background:radial-gradient(circle,#1a3a6e,transparent 70%)}
.glass{background:var(--g);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid var(--gb);border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)}
.lang-en{display:none}html[lang=en] .lang-fa{display:none}html[lang=en] .lang-en{display:block}html[lang=en] body{direction:ltr}
header{position:sticky;top:0;z-index:50;display:flex;justify-content:space-between;align-items:center;padding:14px 5vw;background:rgba(5,5,8,.45);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.brand{display:flex;gap:12px;align-items:center;color:var(--t);text-decoration:none;font-weight:800;font-size:1.15rem}
.brand img{width:40px;height:40px;border-radius:12px;box-shadow:0 0 20px var(--gl)}
.chip{border:1px solid var(--gb);background:var(--g);backdrop-filter:blur(12px);color:var(--t);border-radius:999px;padding:8px 14px;font-weight:600;font-size:.85rem}
.hero{max-width:1080px;margin:0 auto;padding:48px 5vw 32px;display:grid;grid-template-columns:1.15fr .85fr;gap:40px;align-items:center}
@media(max-width:860px){.hero{grid-template-columns:1fr;text-align:center}.vis{order:-1}.row{justify-content:center}.badge{align-self:center!important}}
.badge{display:inline-flex;align-self:flex-start;padding:4px 12px;border-radius:999px;font-size:.72rem;font-weight:700;background:rgba(232,160,74,.15);color:var(--a);border:1px solid rgba(232,160,74,.3)}
h1{font-size:clamp(2rem,5vw,3.2rem);font-weight:900;line-height:1.15;margin:6px 0 10px;letter-spacing:-.03em}
h1 span{background:linear-gradient(135deg,var(--a),#ff6b4a 40%,var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--m);font-size:1.02rem;max-width:28rem;margin-bottom:8px}
@media(max-width:860px){.lead{margin-inline:auto}}
.row{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 14px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:14px;font-weight:800;font-size:.95rem;text-decoration:none;border:none;transition:transform .2s,box-shadow .2s;font-family:inherit}
.btn:hover{transform:translateY(-2px)}
.bp{background:linear-gradient(135deg,#e8a04a,#d4783a);color:#1a0f05;box-shadow:0 8px 28px rgba(232,160,74,.35)}
.bp.ok{background:linear-gradient(135deg,#5dcea0,#3aa87a);color:#06150f;box-shadow:0 8px 28px rgba(93,206,160,.35)}
.box{margin-top:4px;padding:14px 16px}
.box label{font-size:.72rem;color:var(--m);display:block;margin-bottom:8px;font-weight:600}
.box .r{display:flex;gap:8px;align-items:center}
.box input{flex:1;min-width:0;background:rgba(0,0,0,.25);border:1px solid var(--gb);border-radius:10px;color:var(--t);font-family:ui-monospace,monospace;font-size:.75rem;padding:10px 12px;direction:ltr;text-align:left;outline:none}
.copy{border:1px solid var(--gb);background:rgba(255,255,255,.1);color:var(--t);border-radius:10px;padding:10px 14px;font-weight:700;font-size:.8rem;white-space:nowrap}
.copy.ok{color:#7dffb3;border-color:rgba(125,255,179,.4)}
.vis{display:flex;justify-content:center}
.stage{width:min(260px,65vw);animation:f 5s ease-in-out infinite;position:relative}
@keyframes f{50%{transform:translateY(-14px)}}
.stage::before{content:'';position:absolute;inset:-20%;background:radial-gradient(circle,var(--gl),transparent 65%);filter:blur(30px);opacity:.6;z-index:-1}
.stage .gwrap{padding:20px;border-radius:28px}
.stage img{width:100%;border-radius:20px;display:block}
section{max-width:1080px;margin:0 auto;padding:20px 5vw 28px}
section h2{font-size:1.25rem;font-weight:800;margin-bottom:4px}
section .sub{color:var(--m);font-size:.9rem;margin-bottom:16px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.p{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 12px;text-align:center;text-decoration:none;color:var(--t);font-weight:700;font-size:.9rem;border-radius:16px;transition:transform .2s}
.p:hover{transform:translateY(-3px);border-color:rgba(232,160,74,.35)}
.p svg{width:20px;height:20px;opacity:.9;flex-shrink:0}
.pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.pl .c{display:flex;gap:12px;align-items:center;padding:16px;border-radius:16px;transition:transform .2s;text-decoration:none;color:var(--t)}
.pl .c:hover{transform:translateY(-2px);border-color:rgba(232,160,74,.35)}
.pl .ico-img{width:40px;height:40px;border-radius:10px;object-fit:cover;background:rgba(255,255,255,.08);flex-shrink:0}
.pl b{font-size:.92rem;display:block}
.pl span{color:var(--m);font-size:.8rem;display:block}
footer{margin-top:12px;padding:32px 5vw 44px;border-top:1px solid rgba(255,255,255,.06);text-align:center}
.gh{display:inline-flex;align-items:center;gap:10px;color:var(--t);text-decoration:none;font-weight:700;font-size:.95rem;padding:12px 18px;border-radius:14px;transition:transform .2s,border-color .2s}
.gh:hover{transform:translateY(-2px);border-color:rgba(232,160,74,.35)}
.gh svg{width:22px;height:22px;flex-shrink:0}
.gh .label{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.gh .label small{color:var(--m);font-weight:600;font-size:.8rem}

.prov{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.prov .card{display:flex;flex-direction:column;gap:8px;padding:14px 12px;border-radius:16px;transition:transform .2s,border-color .2s}
.prov .card:hover{transform:translateY(-2px)}
.prov .top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.prov .name{font-weight:800;font-size:.9rem}
.prov .dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;box-shadow:0 0 8px currentColor}
.prov .dot.on{background:#5dcea0;color:#5dcea0}
.prov .dot.off{background:#e07070;color:#e07070}
.prov .dot.na{background:#6a6570;color:#6a6570}
.prov .meta{font-size:.72rem;color:var(--m)}
.prov .sk{height:72px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:200% 100%;animation:sh 1.2s ease-in-out infinite}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

.rail{display:flex;gap:12px;overflow-x:auto;padding:6px 2px 10px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
overscroll-behavior-x:contain;scrollbar-width:none!important;-ms-overflow-style:none!important}
.rail::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;background:transparent!important}
.rail::-webkit-scrollbar-thumb{display:none!important;background:transparent!important}
.rail::-webkit-scrollbar-track{display:none!important}
.tile{flex:0 0 120px;scroll-snap-align:start;text-decoration:none;color:var(--t);transition:transform .2s}
.tile:hover{transform:translateY(-3px)}
.tile img{width:120px;height:180px;object-fit:cover;border-radius:12px;background:rgba(255,255,255,.06);display:block}
.tile .cap{margin-top:6px;font-size:.78rem;font-weight:700;line-height:1.3;max-height:2.6em;overflow:hidden}
.tile .sub2{font-size:.7rem;color:var(--m);margin-top:2px}
.tr-tile{flex:0 0 168px;max-width:168px}
.tr-tile .thumb{position:relative;border-radius:12px;overflow:hidden;height:94px;background:#111;display:block}
.tr-tile .thumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:.9}
.tr-tile .play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);font-size:1.25rem;pointer-events:none}
.tr-tile .cap{margin-top:6px;font-size:.72rem;font-weight:700;line-height:1.25;max-height:2.5em;overflow:hidden}
.tr-tile .actions{display:flex;gap:4px;margin-top:4px}
.tr-tile .actions a{flex:1;font-size:.62rem;font-weight:800;padding:5px 4px;border-radius:8px;text-decoration:none;text-align:center}
.tr-tile .actions .s{background:linear-gradient(135deg,#e8a04a,#d4783a);color:#1a0f05}
.tr-tile .actions .y{background:rgba(255,255,255,.12);color:#fff}
.modal{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.75);padding:16px}
.modal.open{display:flex}
.modal .inner{width:min(900px,100%);aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;position:relative}
.modal iframe{width:100%;height:100%;border:0}
.modal .x{position:absolute;top:-36px;inset-inline-end:0;background:transparent;border:0;color:#fff;font-size:1.4rem;font-weight:700}

.tile{position:relative}
.tile .hov{position:absolute;inset:0;border-radius:12px;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.85));opacity:0;transition:opacity .2s;display:flex;flex-direction:column;justify-content:flex-end;padding:8px;gap:4px}
.tile:hover .hov,.tile:focus-within .hov{opacity:1}
.tile .hov a,.tile .hov button{font-size:.65rem;font-weight:700;padding:5px 6px;border-radius:8px;border:0;text-decoration:none;text-align:center;font-family:inherit;cursor:pointer}
.tile .hov .s{background:linear-gradient(135deg,#e8a04a,#d4783a);color:#1a0f05}
.tile .hov .w{background:rgba(255,255,255,.15);color:#fff;backdrop-filter:blur(6px)}
.tile .poster-wrap{position:relative;width:120px;height:180px;border-radius:12px;overflow:hidden}
.tr-tile .hov{opacity:0}
.tr-tile:hover .hov{opacity:1}
.foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
.foot .gh{margin:0}
</style>
</head>
<body>
<div class="bg"></div><div class="stars"></div>
<div class="neb n1"></div><div class="neb n2"></div>
<header>
<a class="brand" href="/"><img src="${logo}" alt="Cinemagraphy" onerror="this.src='${LOGO_FALLBACK}'"/><span>سینماگرافی</span></a>
<div style="display:flex;gap:8px;align-items:center">
<a class="chip" href="/guide" style="text-decoration:none"><span class="lang-fa">راهنما</span><span class="lang-en">Guide</span></a>
<a class="chip" href="/configure" style="text-decoration:none"><span class="lang-fa">شخصی‌سازی</span><span class="lang-en">Configure</span></a>
<button class="chip" id="langBtn" type="button">EN</button>
</div>
</header>
<main>
<div class="hero">
<div>
<span class="badge">v${ver}</span>
<h1 class="lang-fa">سینماگرافی<br/><span>فیلم، سریال، انیمه</span></h1>
<h1 class="lang-en">Cinemagraphy<br/><span>Movies, Series, Anime</span></h1>
<p class="lead lang-fa">افزونه استریمیو برای تماشای فیلم و سریال از منابع ایرانی و بین‌المللی — کیفیت، حجم و وضعیت سانسور در یک نگاه.</p>
<p class="lead lang-en">Stremio addon for Iranian &amp; international sources — quality, size and censor status at a glance.</p>
<div class="row">
<a class="btn bp" href="${install}"><span class="lang-fa">نصب در Stremio</span><span class="lang-en">Install in Stremio</span></a>
<button class="btn bp" id="manifestCopyBtn" type="button"><span class="lang-fa">لینک منیفست</span><span class="lang-en">Manifest link</span></button>
<a class="btn bp" href="/configure" style="background:rgba(255,255,255,.1);color:var(--t);box-shadow:none;border:1px solid var(--gb)"><span class="lang-fa">شخصی‌سازی</span><span class="lang-en">Configure</span></a>
</div>
<input type="hidden" id="manifestUrl" value="${m}"/>
</div>
<div class="vis"><div class="stage"><div class="gwrap glass"><img src="${logo}" alt="logo" onerror="this.src='${LOGO_FALLBACK}'"/></div></div></div>
</div>
<section>
<h2 class="lang-fa">دانلود Stremio</h2><h2 class="lang-en">Download Stremio</h2>
<p class="sub lang-fa">اول استریمیو را نصب کنید، بعد افزونه را اضافه کنید.</p>
<p class="sub lang-en">Install Stremio first, then add the addon.</p>
<div class="g">
<a class="p glass" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Windows</a>
<a class="p glass" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">macOS</a>
<a class="p glass" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Linux</a>
<a class="p glass" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Android</a>
<a class="p glass" href="https://apps.apple.com/app/stremio/id1297124690" target="_blank" rel="noopener">iOS / tvOS</a>
</div>
</section>


<section id="sec-trend-day">
<h2 class="lang-fa">🔥 محبوب امروز</h2><h2 class="lang-en">🔥 Trending today</h2>
<div class="rail" id="railDay"><div class="sk glass" style="min-width:120px;height:180px"></div></div>
</section>
<section id="sec-trend-week">
<h2 class="lang-fa">🔥 محبوب این هفته</h2><h2 class="lang-en">🔥 Trending this week</h2>
<div class="rail" id="railWeek"><div class="sk glass" style="min-width:120px;height:180px"></div></div>
</section>
<section id="sec-now">
<h2 class="lang-fa">🎬 در سالن نمایش</h2><h2 class="lang-en">🎬 Now playing</h2>
<div class="rail" id="railNow"><div class="sk glass" style="min-width:120px;height:180px"></div></div>
</section>
<section id="sec-trailers">
<h2 class="lang-fa">▶️ آخرین تریلرها</h2><h2 class="lang-en">▶️ Latest trailers</h2>
<div class="rail" id="railTrailers"><div class="sk glass" style="min-width:220px;height:124px"></div></div>
</section>
<div class="modal" id="trailerModal" role="dialog" aria-modal="true">
  <div class="inner">
    <button class="x" type="button" id="trailerClose" aria-label="Close">×</button>
    <iframe id="trailerFrame" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
  </div>
</div>
<section>
<h2 class="lang-fa">منابع</h2><h2 class="lang-en">Sources</h2>
<div class="prov" id="providerGrid" aria-live="polite">
<div class="sk glass"></div><div class="sk glass"></div><div class="sk glass"></div><div class="sk glass"></div>
</div>
</section>

<section>
<h2 class="lang-fa">افزونه‌های پیشنهادی</h2><h2 class="lang-en">Recommended addons</h2>
<p class="sub lang-fa">بر اساس محبوبیت جامعه استریمیو.</p>
<p class="sub lang-en">Based on community popularity.</p>
<div class="pl">
${addonCards}
</div>
</section>
</main>
<footer>
<div class="foot">
<a class="gh glass" href="${GITHUB_URL}" target="_blank" rel="noopener" aria-label="GitHub">
<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.28-.01-1.02-.02-2-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z"/></svg>
<span class="label"><span class="lang-fa">گیت‌هاب</span><span class="lang-en">GitHub</span></span>
</a>
<a class="gh glass" href="${TELEGRAM_CHANNEL}" target="_blank" rel="noopener" aria-label="Telegram">
<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 6.46-1.55 7.33c-.12.52-.43.65-.87.4l-2.4-1.77-1.16 1.12c-.13.13-.24.24-.49.24l.17-2.45 4.47-4.04c.19-.17-.04-.27-.3-.1l-5.53 3.48-2.38-.74c-.52-.16-.53-.52.11-.77l9.3-3.58c.43-.16.81.1.67.78z"/></svg>
<span class="label"><span class="lang-fa">کانال</span><span class="lang-en">Channel</span></span>
</a>
<a class="gh glass" href="${TELEGRAM_SUPPORT}" target="_blank" rel="noopener" aria-label="Support">
<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
<span class="label"><span class="lang-fa">پشتیبانی</span><span class="lang-en">Support</span></span>
</a>
</div>
</footer>
<script>
(function(){
const r=document.documentElement,lb=document.getElementById('langBtn');
let L=localStorage.getItem('cg-lang')||'fa';
function al(l){r.lang=l;r.dir=l==='fa'?'rtl':'ltr';lb.textContent=l==='fa'?'EN':'FA';localStorage.setItem('cg-lang',l)}
al(L);lb.onclick=()=>al(r.lang==='fa'?'en':'fa');
const inp=document.getElementById('manifestUrl');
async function copyManifest(btn){
  if(!inp)return;
  const fa=r.lang==='fa';
  const prev=btn.innerHTML;
  try{
    await navigator.clipboard.writeText(inp.value);
    btn.classList.add('ok');
    btn.innerHTML=fa?'کپی شد ✓':'Copied ✓';
    setTimeout(()=>{btn.classList.remove('ok');btn.innerHTML=prev},1800);
  }catch{}
}
const mb=document.getElementById('manifestCopyBtn');
if(mb)mb.onclick=()=>copyManifest(mb);

async function loadProviders(){
  const grid=document.getElementById('providerGrid');
  if(!grid)return;
  const fa=document.documentElement.lang==='fa';
  try{
    const res=await fetch('/providers.json',{credentials:'omit'});
    if(!res.ok)throw new Error('bad status');
    const data=await res.json();
    const list=Array.isArray(data.providers)?data.providers:[];
    if(!list.length){
      grid.innerHTML='<p class="sub">'+(fa?'منبعی پیکربندی نشده.':'No providers configured.')+'</p>';
      return;
    }
    grid.innerHTML=list.map(function(p){
      var status, cls, label;
      if(!p.configured){
        cls='na'; status=fa?'پیکربندی نشده':'Not configured'; label=fa?'غیرفعال':'Off';
      }else if(p.online){
        cls='on'; status=fa?'آنلاین':'Online'; label=fa?'آنلاین':'Online';
      }else{
        cls='off'; status=fa?'آفلاین':'Offline'; label=fa?'آفلاین':'Offline';
      }
      var lat=(p.online && p.latencyMs!=null)?(' · '+p.latencyMs+'ms'):'';
      return '<div class="card glass">'+
        '<div class="top"><span class="name">'+esc(p.name||p.key)+'</span><span class="dot '+cls+'" title="'+esc(status)+'"></span></div>'+
        '<div class="meta">'+esc(label)+lat+'</div>'+
      '</div>';
    }).join('');
  }catch(e){
    grid.innerHTML='<p class="sub">'+(fa?'دریافت وضعیت ممکن نشد.':'Could not load provider status.')+'</p>';
  }
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
loadProviders();

function tileHtml(item){
  var title=esc(item.title||item.originalTitle||'');
  var sub=[item.year,item.rating!=null?('★ '+item.rating):''].filter(Boolean).join(' · ');
  var mt=item.mediaType==='tv'?'series':'movie';
  var stremio='stremio://detail/'+mt+'/tmdb:'+encodeURIComponent(item.id);
  var web=item.mediaType==='tv'
    ?('https://www.themoviedb.org/tv/'+item.id+'?language=fa-IR')
    :('https://www.themoviedb.org/movie/'+item.id+'?language=fa-IR');
  var img=item.poster
    ?('<img src="'+esc(item.poster)+'" alt="" loading="lazy"/>')
    :'<div style="width:100%;height:100%;background:rgba(255,255,255,.06)"></div>';
  var fa=document.documentElement.lang==='fa';
  return '<div class="tile">'+
    '<div class="poster-wrap">'+img+
      '<div class="hov">'+
        '<a class="s" href="'+esc(stremio)+'">'+(fa?'باز کردن در استریمیو':'Open in Stremio')+'</a>'+
        '<a class="w" href="'+esc(web)+'" target="_blank" rel="noopener">'+(fa?'صفحه فیلم (وب)':'Open on web')+'</a>'+
      '</div>'+
    '</div>'+
    '<div class="cap">'+title+'</div>'+(sub?'<div class="sub2">'+esc(sub)+'</div>':'')+
  '</div>';
}
function fillRail(id, items){
  var el=document.getElementById(id);
  if(!el)return;
  if(!items||!items.length){el.innerHTML='<p class="sub">—</p>';return;}
  el.innerHTML=items.map(tileHtml).join('');
}
function fillTrailers(items){
  var el=document.getElementById('railTrailers');
  if(!el)return;
  if(!items||!items.length){el.innerHTML='<p class="sub">—</p>';return;}
  var fa=document.documentElement.lang==='fa';
  el.innerHTML=items.map(function(item){
    var title=esc(item.title||item.originalTitle||'');
    var bg=item.backdrop||item.poster||'';
    var key=item.trailer&&item.trailer.key;
    var yt=key?('https://www.youtube.com/watch?v='+encodeURIComponent(key)):'#';
    var mt=item.mediaType==='tv'?'series':'movie';
    var stremio='stremio://detail/'+mt+'/tmdb:'+encodeURIComponent(item.id);
    return '<div class="tile tr-tile">'+
      '<a class="thumb" href="'+esc(yt)+'" target="_blank" rel="noopener" title="YouTube">'+
        (bg?'<img src="'+esc(bg)+'" alt="" loading="lazy"/>':'')+
        '<div class="play">▶</div>'+
      '</a>'+
      '<div class="cap" title="'+title+'">'+title+'</div>'+
      '<div class="actions">'+
        '<a class="s" href="'+esc(stremio)+'">'+(fa?'استریمیو':'Stremio')+'</a>'+
        '<a class="y" href="'+esc(yt)+'" target="_blank" rel="noopener">YT</a>'+
      '</div>'+
    '</div>';
  }).join('');
}
(function(){
  var modal=document.getElementById('trailerModal');
  var frame=document.getElementById('trailerFrame');
  var close=document.getElementById('trailerClose');
  function shut(){if(modal)modal.classList.remove('open');if(frame)frame.src='';}
  if(close)close.onclick=shut;
  if(modal)modal.addEventListener('click',function(e){if(e.target===modal)shut();});
})();
async function loadTmdb(){
  try{
    var res=await fetch('/tmdb/landing.json',{credentials:'omit'});
    if(!res.ok)throw new Error('bad');
    var data=await res.json();
    fillRail('railDay', data.trendingDay);
    fillRail('railWeek', data.trendingWeek);
    fillRail('railNow', data.nowPlaying);
    fillTrailers(data.trailers);
  }catch(e){
    ['railDay','railWeek','railNow','railTrailers'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.innerHTML='';
    });
  }
}
loadTmdb();

function bindRailWheel(){
  document.querySelectorAll('.rail').forEach(function(rail){
    rail.addEventListener('wheel', function(e){
      if(Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      if(rail.scrollWidth <= rail.clientWidth + 4) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }, {passive:false});
  });
}
bindRailWheel();



})();
</script>
</body></html>`
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function landingUrlsFromRequest(requestLike, env = {}) {
  let protocol = 'https',
    host = ''
  if (typeof requestLike?.get === 'function') {
    protocol = String(requestLike.headers?.['x-forwarded-proto'] || requestLike.protocol || 'https')
      .split(',')[0]
      .trim()
    host = String(requestLike.headers?.['x-forwarded-host'] || requestLike.get('host') || '')
      .split(',')[0]
      .trim()
  } else if (requestLike?.url) {
    const u = new URL(requestLike.url)
    protocol = u.protocol.replace(':', '') || 'https'
    host = u.host
  }
  if (!host && env.PUBLIC_BASE_URL) {
    try {
      const b = new URL(env.PUBLIC_BASE_URL)
      protocol = b.protocol.replace(':', '') || protocol
      host = b.host
    } catch {}
  }
  const origin = host ? `${protocol}://${host}` : PUBLIC_SITE
  const manifestUrl = `${origin}/manifest.json`
  return {
    manifestUrl,
    installUrl: `stremio://${manifestUrl.replace(/^https?:\/\//i, '')}`,
    logoUrl: `${origin}/logo.png`,
  }
}


/** Shared shell styles for /guide and /configure */
function shellStyle() {
  return `:root{--t:#f4f0ea;--m:#a89f94;--a:#e8a04a;--a2:#7eb6ff;--g:rgba(255,255,255,.07);--gb:rgba(255,255,255,.14)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Vazirmatn,Tahoma,Segoe UI,system-ui,sans-serif;color:var(--t);min-height:100vh;line-height:1.65;
background:radial-gradient(ellipse 80% 50% at 50% -20%,#1a0a2e,transparent),linear-gradient(180deg,#050508,#0a0612 50%,#12081c)}
a{color:var(--a2)}.wrap{max-width:880px;margin:0 auto;padding:24px 5vw 48px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.brand{display:flex;gap:10px;align-items:center;color:var(--t);text-decoration:none;font-weight:800}
.brand img{width:36px;height:36px;border-radius:10px}
.chip{border:1px solid var(--gb);background:var(--g);color:var(--t);border-radius:999px;padding:8px 14px;text-decoration:none;font-weight:600;font-size:.85rem;font-family:inherit;cursor:pointer}
h1{font-size:1.75rem;font-weight:900;margin:8px 0}
h2{font-size:1.15rem;margin:26px 0 10px}
.sub{color:var(--m);margin-bottom:14px;font-size:.95rem}
.glass{background:var(--g);backdrop-filter:blur(18px);border:1px solid var(--gb);border-radius:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border-radius:12px;font-weight:800;font-size:.9rem;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
.bp{background:linear-gradient(135deg,#e8a04a,#d4783a);color:#1a0f05}
.bp.ok{background:linear-gradient(135deg,#5dcea0,#3aa87a)}
.ghost{background:rgba(255,255,255,.08);color:var(--t);border:1px solid var(--gb)}
.row{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.lang-en{display:none}html[lang=en] .lang-fa{display:none}html[lang=en] .lang-en{display:block}html[lang=en] body{direction:ltr}
.cfg-item{padding:14px 16px;margin-bottom:10px}
.cfg-item .top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px}
.cfg-item code{direction:ltr;font-size:.78rem;color:var(--a2)}
.diff{font-size:.68rem;font-weight:800;padding:3px 8px;border-radius:999px}
.diff.e{background:rgba(93,206,160,.15);color:#5dcea0}
.diff.m{background:rgba(232,160,74,.15);color:var(--a)}
.diff.h{background:rgba(224,112,112,.15);color:#e07070}
.cfg-item input{width:100%;margin-top:8px;background:rgba(0,0,0,.28);border:1px solid var(--gb);border-radius:10px;color:var(--t);padding:10px 12px;font-family:ui-monospace,monospace;font-size:.78rem;direction:ltr;outline:none}
.cfg-item .hint{font-size:.78rem;color:var(--m)}
.out{margin-top:16px;padding:14px 16px}
.out input{width:100%;background:rgba(0,0,0,.28);border:1px solid var(--gb);border-radius:10px;color:var(--t);padding:10px 12px;font-family:ui-monospace,monospace;font-size:.75rem;direction:ltr}
.feat{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:12px 0}
.feat .c{padding:14px;text-align:center}.feat b{display:block;margin:4px 0}.feat span{font-size:.78rem;color:var(--m)}
.step{padding:14px 16px;margin-bottom:8px}.faq details{padding:12px 16px;margin-bottom:8px}
.faq summary{cursor:pointer;font-weight:700}.faq p{color:var(--m);margin-top:8px;font-size:.9rem}
.call{padding:14px 16px;margin:12px 0;border-color:rgba(232,160,74,.35)!important}`
}

export function renderConfigurePage({
  logoUrl = '/logo.png',
  version = '2.1.2',
  origin = PUBLIC_SITE,
} = {}) {
  const logo = escapeHtml(logoUrl || LOGO_FALLBACK)
  const ver = escapeHtml(String(version || '2.1.2'))
  const base = escapeHtml(String(origin || PUBLIC_SITE).replace(/\/$/, ''))
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Configure — سینماگرافی</title>
<link rel="icon" href="${logo}"/>
<style>${shellStyle()}</style>
</head>
<body>
<div class="wrap">
<header>
<a class="brand" href="/"><img src="${logo}" alt=""/><span>سینماگرافی</span></a>
<div style="display:flex;gap:8px">
<button class="chip" type="button" id="langBtn">EN</button>
<a class="chip" href="/"><span class="lang-fa">خانه</span><span class="lang-en">Home</span></a>
</div>
</header>
<p style="font-size:.75rem;color:var(--a)">v${ver}</p>
<h1 class="lang-fa">🔧 شخصی‌سازی افزونه</h1>
<h1 class="lang-en">🔧 Configure addon</h1>
<p class="sub lang-fa">پروایدرهای موردنظر را تیک بزنید. لینک منیفست فقط همان‌ها را فعال می‌کند (روی همین دامنه Vercel).</p>
<p class="sub lang-en">Fill the variables you need. A custom manifest URL is generated for this deployment.</p>
<p class="sub lang-fa">🟢 آسان · 🟡 متوسط · 🔴 پیشرفته (خالی = پیش‌فرض سرور)</p>
<p class="sub lang-en">🟢 Easy · 🟡 Medium · 🔴 Advanced (empty = server default)</p>
<div id="cfgList"></div>
<div class="out glass">
<label class="lang-fa" style="font-size:.8rem;color:var(--m)">لینک منیفست اختصاصی</label>
<label class="lang-en" style="font-size:.8rem;color:var(--m)">Custom manifest URL</label>
<input id="outUrl" readonly value="${base}/manifest.json"/>
<div class="row">
<button class="btn bp" type="button" id="btnCopy"><span class="lang-fa">کپی لینک</span><span class="lang-en">Copy link</span></button>
<a class="btn bp" id="btnInstall" href="#"><span class="lang-fa">نصب در Stremio</span><span class="lang-en">Install in Stremio</span></a>
<a class="btn ghost" href="${base}/manifest.json" target="_blank" rel="noopener"><span class="lang-fa">منیفست پیش‌فرض</span><span class="lang-en">Default manifest</span></a>
</div>
</div>
</div>
<script>
(function(){
const BASE=${JSON.stringify(String(origin || PUBLIC_SITE).replace(/\/$/, ''))};
const PROVIDERS=[
  {key:'f2media',label:'F2Media'},
  {key:'cinamatic',label:'Cinamatic'},
  {key:'aslmoviez',label:'AslMoviez'},
  {key:'serialblog',label:'SerialBlog'},
  {key:'donyayeserial',label:'DonyayeSerial'},
  {key:'animex',label:'Animex'},
  {key:'peepboxtv',label:'PeepBoxTv',adv:true},
  {key:'digimovie',label:'DigiMovie',adv:true},
];
const EXTRA=[
  {key:'TMDB_API_KEY',d:'e',fa:'کلید TMDB',en:'TMDB API key'},
  {key:'TORRENT_METEOR_MANIFEST_URL',d:'m',fa:'منیفست تورنت Meteor',en:'Meteor torrent manifest'},
  {key:'EXTERNAL_CATALOG_MANIFEST_URLS',d:'m',fa:'کاتالوگ خارجی',en:'External catalogs'},
  {key:'PROVIDER_TIMEOUT_MS',d:'m',fa:'تایم‌اوت (ms)',en:'Timeout (ms)'},
];
const r=document.documentElement,lb=document.getElementById('langBtn');
function al(l){r.lang=l;r.dir=l==='fa'?'rtl':'ltr';lb.textContent=l==='fa'?'EN':'FA';localStorage.setItem('cg-lang',l);draw()}
al(localStorage.getItem('cg-lang')||'fa');
lb.onclick=()=>al(r.lang==='fa'?'en':'fa');
function b64url(obj){
  const s=JSON.stringify(obj);
  const bin=new TextEncoder().encode(s);
  let str=''; bin.forEach(c=>str+=String.fromCharCode(c));
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function collect(){
  const o={};
  const on=[];
  document.querySelectorAll('[data-prov]').forEach(cb=>{ if(cb.checked) on.push(cb.getAttribute('data-prov')); });
  if(on.length) o.ENABLED_PROVIDERS=on.join(',');
  document.querySelectorAll('[data-k]').forEach(inp=>{
    const v=(inp.value||'').trim();
    if(v) o[inp.getAttribute('data-k')]=v;
  });
  return o;
}
function refresh(){
  const o=collect();
  const keys=Object.keys(o);
  let manifest=BASE+'/manifest.json';
  let install='stremio://'+BASE.replace(/^https?:\/\//i,'')+'/manifest.json';
  if(keys.length){
    const cfg=b64url(o);
    manifest=BASE+'/c/'+cfg+'/manifest.json';
    install='stremio://'+BASE.replace(/^https?:\/\//i,'')+'/c/'+cfg+'/manifest.json';
  }
  document.getElementById('outUrl').value=manifest;
  document.getElementById('btnInstall').href=install;
}
function draw(){
  const fa=r.lang==='fa';
  const list=document.getElementById('cfgList');
  const prevProv=new Set();
  document.querySelectorAll('[data-prov]').forEach(cb=>{ if(cb.checked) prevProv.add(cb.getAttribute('data-prov')); });
  const prev={};
  document.querySelectorAll('[data-k]').forEach(inp=>{prev[inp.getAttribute('data-k')]=inp.value});
  let html='<h2 class="lang-fa">پروایدرها</h2><h2 class="lang-en">Providers</h2>';
  html+='<p class="sub lang-fa">فقط موارد تیک‌خورده در منیفست اختصاصی می‌آیند. اگر هیچ‌کدام را نزنید، منیفست پیش‌فرض است.</p>';
  html+='<p class="sub lang-en">Only checked providers appear in the custom manifest.</p>';
  html+='<div class="glass" style="padding:14px;margin-bottom:14px;display:grid;gap:8px">';
  html+=PROVIDERS.map(p=>{
    const checked=prevProv.size? (prevProv.has(p.key)?' checked':''):'';
    const tag=p.adv?' <span class="diff h">'+(fa?'پیشرفته':'Adv')+'</span>':'';
    return '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600">'+
      '<input type="checkbox" data-prov="'+p.key+'"'+checked+'/>'+p.label+tag+'</label>';
  }).join('');
  html+='</div>';
  html+='<h2 class="lang-fa">تنظیمات اختیاری</h2><h2 class="lang-en">Optional settings</h2>';
  html+=EXTRA.map(v=>{
    const diff=v.d==='e'?(fa?'آسان':'Easy'):(fa?'متوسط':'Medium');
    return '<div class="cfg-item glass"><div class="top"><code>'+v.key+'</code><span class="diff '+v.d+'">'+diff+'</span></div>'+
      '<div class="hint">'+(fa?v.fa:v.en)+'</div>'+
      '<input data-k="'+v.key+'" placeholder="…" value="'+(prev[v.key]||'').replace(/"/g,'&quot;')+'"/></div>';
  }).join('');
  list.innerHTML=html;
  list.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',refresh));
  list.querySelectorAll('input').forEach(inp=>inp.addEventListener('change',refresh));
  refresh();
}
document.getElementById('btnCopy').onclick=async function(){
  const inp=document.getElementById('outUrl');
  try{
    await navigator.clipboard.writeText(inp.value);
    const b=this,p=b.innerHTML;b.classList.add('ok');
    b.innerHTML=r.lang==='fa'?'کپی شد ✓':'Copied ✓';
    setTimeout(()=>{b.classList.remove('ok');b.innerHTML=p},1600);
  }catch(e){inp.select()}
};
draw();
</script>
</body></html>`
}

export function renderGuidePage({
  logoUrl = '/logo.png',
  version = '2.1.2',
  manifestUrl = PUBLIC_INSTALL,
} = {}) {
  const logo = escapeHtml(logoUrl || LOGO_FALLBACK)
  const ver = escapeHtml(String(version || '2.1.2'))
  const m = escapeHtml(manifestUrl || PUBLIC_INSTALL)
  const install = escapeHtml('stremio://' + String(manifestUrl || PUBLIC_INSTALL).replace(/^https?:\/\//i, ''))
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>راهنما — سینماگرافی</title>
<link rel="icon" href="${logo}"/>
<style>${shellStyle()}</style>
</head>
<body>
<div class="wrap">
<header>
<a class="brand" href="/"><img src="${logo}" alt=""/><span>سینماگرافی</span></a>
<div style="display:flex;gap:8px">
<button class="chip" type="button" id="langBtn">EN</button>
<a class="chip" href="/configure"><span class="lang-fa">شخصی‌سازی</span><span class="lang-en">Configure</span></a>
<a class="chip" href="/"><span class="lang-fa">خانه</span><span class="lang-en">Home</span></a>
</div>
</header>
<p style="font-size:.75rem;color:var(--a)">v${ver}</p>
<h1 class="lang-fa">📖 راهنما</h1>
<h1 class="lang-en">📖 Guide</h1>
<p class="sub lang-fa">استریمیو یک Media Center است؛ افزونه‌ها منبع و قابلیت اضافه می‌کنند. سینماگرافی منابع ایرانی، تورنت اختیاری، زیرنویس و متای فارسی را یکجا می‌آورد.</p>
<p class="sub lang-en">Stremio is a media center; addons add sources. Cinemagraphy bundles Iranian sources, optional torrents, subs and Persian metadata.</p>
<div class="feat">
<div class="c glass"><div>🎥</div><b class="lang-fa">منابع ایرانی</b><b class="lang-en">Iran sources</b></div>
<div class="c glass"><div>🌱</div><b>Torrent</b></div>
<div class="c glass"><div>📝</div><b class="lang-fa">زیرنویس</b><b class="lang-en">Subs</b></div>
<div class="c glass"><div>🇮🇷</div><b class="lang-fa">متای فارسی</b><b class="lang-en">FA meta</b></div>
<div class="c glass"><div>🆓</div><b class="lang-fa">رایگان</b><b class="lang-en">Free</b></div>
</div>
<h2 class="lang-fa">نصب</h2>
<h2 class="lang-en">Install</h2>
<div class="step glass"><b>1</b> <span class="lang-fa">استریمیو را از stremio.com نصب کنید</span><span class="lang-en">Install Stremio</span></div>
<div class="step glass"><b>2</b> <span class="lang-fa">منیفست را نصب کنید یا از صفحه شخصی‌سازی لینک بسازید</span><span class="lang-en">Install the manifest (or build a custom one)</span></div>
<p class="row"><a class="btn bp" href="${install}"><span class="lang-fa">نصب پیش‌فرض</span><span class="lang-en">Default install</span></a>
<a class="btn ghost" href="/configure"><span class="lang-fa">شخصی‌سازی</span><span class="lang-en">Configure</span></a></p>
<p class="sub" style="direction:ltr">${m}</p>
<h2 class="lang-fa">فارسی‌سازی استریمیو</h2>
<p class="lang-fa">Settings → Interface → Language → فارسی</p>
<p class="lang-en">Settings → Interface → Language</p>
<div class="call glass">
<p class="lang-fa"><b>IP:</b> درخواست به سایت‌های ایرانی از سرور انجام می‌شود؛ IP دیده‌شده معمولاً IP سرور است. جعل هدر انجام نمی‌شود.</p>
<p class="lang-en"><b>IP:</b> Fetches are server-side; sites see the server IP. No header spoofing.</p>
</div>
<h2>FAQ</h2>
<div class="faq">
<details class="glass"><summary class="lang-fa">استریم خالی است؟</summary><summary class="lang-en">No streams?</summary><p class="lang-fa">ممکن است پروایدر آن عنوان را نداشته باشد یا آفلاین باشد.</p><p class="lang-en">Provider may lack the title or be offline.</p></details>
<details class="glass"><summary class="lang-fa">پشتیبانی</summary><summary class="lang-en">Support</summary><p><a href="https://t.me/nerdcow" target="_blank" rel="noopener">t.me/nerdcow</a> · <a href="https://t.me/cinemmagraphy" target="_blank" rel="noopener">channel</a></p></details>
</div>
</div>
<script>
(function(){
const r=document.documentElement,lb=document.getElementById('langBtn');
function al(l){r.lang=l;r.dir=l==='fa'?'rtl':'ltr';lb.textContent=l==='fa'?'EN':'FA';localStorage.setItem('cg-lang',l)}
al(localStorage.getItem('cg-lang')||'fa');
lb.onclick=()=>al(r.lang==='fa'?'en':'fa');
})();
</script>
</body></html>`
}
