<div align="center">
  <img src="./logo.png" alt="Cinemagraphy" width="128" height="128" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p><b>افزونه‌ی استریمیو برای فیلم، سریال، انیمه و پخش زنده</b><br/>
  Stremio addon for movies, series, anime &amp; live TV</p>
  <p>
    <a href="https://cinemagraphy.vercel.app/"><img src="https://img.shields.io/badge/site-cinemagraphy.vercel.app-e50914?style=for-the-badge" alt="Site" /></a>
    <a href="https://cinemagraphy.vercel.app/manifest.json"><img src="https://img.shields.io/badge/manifest-install-blue?style=for-the-badge" alt="Manifest" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-2.1.0-blue.svg" alt="2.1.0" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Workers" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="ISC" />
  </p>
</div>

---

### 🇮🇷 نصب سریع
1. [Stremio](https://www.stremio.com/downloads) را نصب کنید  
2. منیفست را اضافه کنید:

`https://cinemagraphy.vercel.app/manifest.json`

یا از [صفحهٔ اصلی](https://cinemagraphy.vercel.app/) دکمهٔ **نصب در Stremio** / **لینک منیفست** را بزنید.

### 🇬🇧 Quick install
1. Install [Stremio](https://www.stremio.com/downloads)  
2. Add: `https://cinemagraphy.vercel.app/manifest.json`

---

**سینماگرافی** چند منبع ایرانی (+ کاتالوگ‌های خارجی اختیاری) را در یک افزونه جمع می‌کند.

| | |
|---|---|
| 🔍 | جستجوی موازی با timeout و کش کوتاه |
| 📊 | کیفیت، حجم، صدا، وضعیت سانسور |
| 🇮🇷 | متادیتای فارسی (TMDB) برای `tt` و `tmdb:` |
| 🧩 | کاتالوگ ۱۰۱ / انیمه / IPTV از env |
| 🌐 | لندینگ Liquid Glass + وضعیت منابع + ویترین TMDB |
| ☁️ | Vercel · Cloudflare Workers · VPS / لوکال |

---

### احترام به اصل پروژه / Upstream credit
فورک شخصی‌سازی‌شده از **[stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)** اثر **آقای محبی (MrMohebi)**.

---

### نسخه ۲.۰.۱
- لیست منابع روی لندینگ (`/providers.json`) با Online/Offline
- ویترین TMDB فقط برای سایت (محبوب امروز/هفته، سالن، تریلر) — **بدون** اضافه شدن به منیفست استریمیو
- بهبود match عنوان برای **DonyayeSerial** (عنوان فارسی + اعتماد به نتایج جستجوی سایت)
- ویترین لندینگ: هاور استریمیو/وب، تریلر مستقیم یوتیوب
- Claim افزونه در stremio-addons.net
- فوتر: گیت‌هاب · کانال تلگرام · پشتیبانی
- متای `tmdb:` برای کاتالوگ‌های ۱۰۱
- سرعت و کش استریم (از سری ۱.۹.x)

### متغیرهای مهم
| Env | نقش |
|-----|-----|
| `TMDB_API_KEY` | متای فارسی + ویترین لندینگ |
| `F2MEDIA_BASEURL` و سایر `*_BASEURL` | فعال‌سازی هر پروایدر |
| `DONYAYESERIAL_BASEURL` | دنیای سریال |
| `TORRENT_METEOR_MANIFEST_URL` | تورنت |
| `EXTERNAL_CATALOG_MANIFEST_URLS` | ۱۰۱ و مشابه |
| `PROVIDER_TIMEOUT_MS` | بودجه هر پروایدر (پیش‌فرض ۱۱۰۰۰) |

---

### Self-host
```sh
git clone https://github.com/TheNerdCow/CinemaGraphy.git
cd CinemaGraphy && corepack enable && pnpm install
cp .env.example .env
pnpm start
```

Endpoints:
-  — راهنمای فارسی/انگلیسی
-  section  — شخصی‌سازی self-host
- `/manifest.json` — نصب استریمیو
- `/providers.json` — وضعیت منابع
- `/tmdb/landing.json` — ویترین سایت
- `/health` — healthcheck

---

Educational use only — does not host media.  
[ISC License](https://opensource.org/licenses/ISC) · © upstream MrMohebi · Cinemagraphy branding © author

<div align="center"><sub>با احترام به کار اصلی آقای محبی 🎬</sub></div>
