<div align="center">
  <img src="./logo.png" alt="Cinemagraphy" width="128" height="128" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p>
    <b>افزونهٔ رایگان استریمیو برای فیلم، سریال، انیمه و منابع ایرانی</b><br/>
    Free Stremio addon — Iranian sources, Persian metadata, optional torrents &amp; IPTV
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-3.2.1-blue.svg" alt="3.2.1" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-worker-f38020.svg" alt="Cloudflare" />
    <img src="https://img.shields.io/badge/Nuvio-compatible-7eb6ff.svg" alt="Nuvio" />
    <img src="https://img.shields.io/badge/FA%20%7C%20EN-supported-5dcea0.svg" alt="FA EN" />
  </p>
</div>

---

## نصب سریع

منیفست (دامنهٔ خودتان بعد از deploy):

```text
https://YOUR-DOMAIN/manifest.json
```

اگر Vercel فعال باشد: `https://cinemagraphy.vercel.app/manifest.json`

> اگر Vercel روی **Pause** باشد تا Resume سایت و منیفست از آن دامنه کار نمی‌کنند. در این مدت Cloudflare Worker یا اجرای محلی.

| مسیر | توضیح |
|------|--------|
| `/` | لندینگ |
| `/configure` | شخصی‌سازی |
| `/guide` | راهنما |
| `/health` | سلامت |
| `/providers.json` | وضعیت پروایدرها |
| `/admin` | پنل مدیریت (نیاز به `ADMIN_PASSWORD`) |

---

## نسخه ۳.۲.۱

- منابع ایرانی موازی + پروکسی تصویر TMDB + متای فارسی
- کاتالوگ **ترکی (F2)** و **انیمه - انیمکس** (ترتیب: ترکی → انیمکس → انیمه خارجی → ماهواره)
- IPTV مستقل · تورنت اختیاری · Configure با FA/EN
- `lib/` ماژولار · کش · rate limit · پنل ادمین (Node/VPS)
- سازگار با Stremio و Nuvio · Vercel و Cloudflare Worker

### env نمونه

```env
TMDB_API_KEY=
F2MEDIA_BASEURL=
ANIMEX_BASEURL=https://animex.click
ENABLE_F2_TURKISH=1
ENABLE_ANIMEX_CATALOG=1
ADMIN_PASSWORD=
RATE_LIMIT_ENABLED=0
PORT=7000
```

جزئیات کامل در `.env.example`.

---

## اجرای محلی

```bash
npm install --omit=dev
cp .env.example .env
npm start
```

---

## Cloudflare

ببینید `docs/CLOUDFLARE.md`. نسخه Worker در `cloudflare/worker.js` باید **۳.۲.۱** باشد.

---

## ساختار

```text
app.js  index.js  landing.js  utils.js
lib/  sources/  cloudflare/  api/  docs/
```

مجوز: ISC.
