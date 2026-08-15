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
    <img src="https://img.shields.io/badge/version-2.1.8-blue.svg" alt="2.1.8" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Workers" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="ISC" />
  </p>
</div>

---

### 🇮🇷 نصب سریع
1. [Stremio](https://www.stremio.com/downloads) را نصب کنید  
2. منیفست: `https://cinemagraphy.vercel.app/manifest.json`  
3. یا از [سایت](https://cinemagraphy.vercel.app/) / [شخصی‌سازی](https://cinemagraphy.vercel.app/configure) / [راهنما](https://cinemagraphy.vercel.app/guide)

### 🇬🇧 Quick install
Add: `https://cinemagraphy.vercel.app/manifest.json`

---

**سینماگرافی** منابع ایرانی (+ کاتالوگ خارجی اختیاری) را در یک افزونه جمع می‌کند.

| | |
|---|---|
| 🔍 | جستجوی موازی با timeout و کش |
| 📊 | کیفیت، حجم، صدا، وضعیت سانسور |
| 🇮🇷 | متای فارسی (TMDB) برای `tt` و `tmdb:` |
| 🧩 | کاتالوگ ۱۰۱ / انیمه / IPTV از env |
| 🌐 | لندینگ + وضعیت منابع + ویترین TMDB |
| ⚙️ | `/configure` → منیفست اختصاصی `/c/.../manifest.json` |
| ☁️ | Vercel · Cloudflare Workers · VPS |

---

### احترام به اصل پروژه
فورک شخصی‌سازی‌شده از **[stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)** اثر **آقای محبی (MrMohebi)**.

---

### نسخه ۲.۱.۷ (وضعیت فعلی)
- لندینگ Liquid Glass، ریل TMDB، تریلر، وضعیت پروایدر
- `/guide` و `/configure` (چک‌باکس پروایدر، Digi/Peep قفل به‌زودی)
- منیفست کاستوم با `ENABLED_PROVIDERS` بدون نشت env سرور
- کاتالوگ خارجی: `CATALOG101` / `CATALOG_ANIME` / `CATALOG_IPTVBRIDGE` / `EXTERNAL_CATALOG_MANIFEST_URLS`
- کاتالوگ انیمه کند: تایم‌اوت جدا (۳۵s) + کش پس‌زمینه تا منیفست را بلوکه نکند
- بهبود match دنیای‌سریال / عنوان فارسی؛ `DONYAYESERIAL_BASEURL` از env (دامنه را در Vercel به‌روز نگه دارید)
- Claim منیفست، لینک کارت‌ها به `web.stremio.com`

### متغیرهای مهم
| Env | نقش |
|-----|-----|
| `TMDB_API_KEY` | متای فارسی + ویترین |
| `*_BASEURL` | F2Media، Cinamatic، AslMoviez، SerialBlog، DonyayeSerial، Animex، … |
| `DONYAYESERIAL_BASEURL` | دامنهٔ به‌روز دنیای سریال |
| `CATALOG_AIO_MANIFEST_URL` | منیفست AIOCatalogs (بعد از ۱۰۱، قبل انیمه/ماهواره) |
| `CATALOG_ANIME_MANIFEST_URL` | کاتالوگ انیمه (می‌تواند کند باشد) |
| `CATALOG101_MANIFEST_URL` | کاتالوگ ۱۰۱ / مشابه |
| `CATALOG_IPTVBRIDGE_MANIFEST_URL` | IPTV |
| `TORRENT_METEOR_MANIFEST_URL` | تورنت |
| `PROVIDER_TIMEOUT_MS` | بودجهٔ هر پروایدر (پیش‌فرض ۱۴۰۰۰) |

### Endpoints
- `/manifest.json` — نصب  
- `/configure` — منیفست اختصاصی  
- `/guide` — راهنما  
- `/providers.json` — وضعیت منابع  
- `/tmdb/landing.json` — ویترین سایت  
- `/health` — healthcheck  

---

### Self-host
```sh
git clone https://github.com/TheNerdCow/CinemaGraphy.git
cd CinemaGraphy && corepack enable && pnpm install
cp .env.example .env
pnpm start
```

Educational use only — does not host media.  
[ISC License](https://opensource.org/licenses/ISC) · © upstream MrMohebi · Cinemagraphy branding © author

<div align="center"><sub>با احترام به کار اصلی آقای محبی 🎬</sub></div>
