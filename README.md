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
    <img src="https://img.shields.io/badge/version-1.9.0-blue.svg" alt="1.9.0" />
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

یا از [صفحهٔ اصلی](https://cinemagraphy.vercel.app/) دکمهٔ **نصب در Stremio** را بزنید.

### 🇬🇧 Quick install
1. Install [Stremio](https://www.stremio.com/downloads)  
2. Add: `https://cinemagraphy.vercel.app/manifest.json`

---

**سینماگرافی** چند منبع ایرانی (+ کاتالوگ‌های خارجی اختیاری) را در یک افزونه جمع می‌کند.

| | |
|---|---|
| 🔍 | جستجوی همزمان / Parallel search |
| 📊 | کیفیت، حجم، صدا، سانسور |
| 🇮🇷 | متادیتای فارسی (TMDB) |
| ☁️ | Vercel · Workers · Docker · VPS |

---

### احترام به اصل پروژه / Upstream credit
فورک شخصی‌سازی‌شده از **[stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)** اثر **آقای محبی (MrMohebi)**.

---

### نسخه‌ی ۱.۹.۰
- لندینگ نتفلیکسی (تم روشن/تاریک، لوگو متحرک)
- رفع دوبل «حجم» در استریم‌ها
- لینک عمومی نصب روی Vercel
- README دوزبانه

جزئیات: [`RELEASE_NOTES_1.9.0.md`](./RELEASE_NOTES_1.9.0.md)

---

### Self-host
```sh
git clone https://github.com/TheNerdCow/CinemaGraphy.git
cd CinemaGraphy && corepack enable && pnpm install
cp .env.example .env   # fill providers you need
pnpm start             # or Vercel / pnpm worker:deploy
```

---

Educational use only — does not host media.  
[ISC License](https://opensource.org/licenses/ISC) · © upstream MrMohebi · Cinemagraphy branding © author

<div align="center"><sub>با احترام به کار اصلی آقای محبی 🎬</sub></div>
