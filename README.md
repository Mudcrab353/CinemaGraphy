<div align="center">
  <img src="./logo.png" alt="Cinemagraphy" width="128" height="128" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p>
    <b>افزونهٔ رایگان استریمیو برای فیلم، سریال، انیمه و منابع ایرانی</b><br/>
    Free Stremio addon — Iranian sources, Persian metadata, optional torrents
  </p>
  <p>
    <a href="https://cinemagraphy.vercel.app/"><img src="https://img.shields.io/badge/site-cinemagraphy.vercel.app-e50914?style=for-the-badge" alt="Site" /></a>
    <a href="https://cinemagraphy.vercel.app/manifest.json"><img src="https://img.shields.io/badge/manifest-install-blue?style=for-the-badge" alt="Manifest" /></a>
    <a href="https://cinemagraphy.vercel.app/configure"><img src="https://img.shields.io/badge/configure-custom-orange?style=for-the-badge" alt="Configure" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-2.1.36-blue.svg" alt="2.1.36" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Workers" />
    <img src="https://img.shields.io/badge/Nuvio-compatible-7eb6ff.svg" alt="Nuvio" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="ISC" />
  </p>
</div>

---

## 🇮🇷 نصب سریع

1. [Stremio](https://www.stremio.com/downloads) یا **[Nuvio](https://nuvio.tv)** را نصب کنید  
2. منیفست عمومی را اضافه کنید:

```text
https://cinemagraphy.vercel.app/manifest.json
```

3. یا از خود سایت:

| | |
|---|---|
| 🏠 | [صفحه اصلی](https://cinemagraphy.vercel.app/) |
| ⚙️ | [شخصی‌سازی منیفست](https://cinemagraphy.vercel.app/configure) |
| 📖 | [راهنما](https://cinemagraphy.vercel.app/guide) |

## 🇬🇧 Quick install

Add this manifest in Stremio or Nuvio:

```text
https://cinemagraphy.vercel.app/manifest.json
```

Site · [Configure](https://cinemagraphy.vercel.app/configure) · [Guide](https://cinemagraphy.vercel.app/guide)

---

## این پروژه چیست؟

**سینماگرافی** چند منبع ایرانی فیلم و سریال را در یک افزونه استریمیو جمع می‌کند؛ با متای فارسی، کاتالوگ‌های خارجی اختیاری، تورنت اختیاری و زیرنویس.

روی **Stremio** و **Nuvio** (سازگار با منیفست استریمیو) کار می‌کند. Nuvio را برای پایداری و سفارشی‌سازی بیشتر پیشنهاد می‌کنیم.

---

## امکانات

| | |
|---|---|
| 🇮🇷 | منابع ایرانی به‌صورت موازی (جستجو + استریم) |
| 🖼️ | **پروکسی تصویر TMDB** — پوستر و تامبنیل بدون نیاز به VPN در ایران |
| 📝 | متای فارسی (عنوان، توضیح، قسمت‌ها) با fallback انگلیسی |
| 📚 | کاتالوگ ۱۰۱ / AIO / انیمه / IPTV از طریق متغیر محیطی |
| 🌱 | تورنت اختیاری (Meteor و مشابه) |
| 💬 | جستجوی زیرنویس |
| ⚙️ | صفحهٔ `/configure` → منیفست اختصاصی `/c/{cfg}/manifest.json` |
| 🌐 | لندینگ liquid-glass + راهنمای فارسی/انگلیسی |
| ☁️ | Vercel · Cloudflare Workers · VPS / لوکال |

---

## نسخه ۲.۱.۳۶

از مسیر ۲.۱.۲۹ تا اینجا:

- پروکسی و کش تصاویر TMDB (دسترسی پایدار از ایران)
- متای فارسی پایدارتر برای فیلم، سریال و قسمت‌ها
- فیکس کاتالوگ **داغ — سریال** در استریمیو (هم‌ترازی شناسه با IMDb)
- معرفی و پشتیبانی **Nuvio** در سایت و راهنما
- یکدست‌سازی ظاهر خانه، راهنما و شخصی‌سازی

---

## کلاینت‌ها

| کلاینت | توضیح |
|--------|--------|
| **Stremio** | کلاسیک و رایج — [دانلود](https://www.stremio.com/downloads) |
| **Nuvio** *(پیشنهاد ما)* | مدرن‌تر، پایدارتر، چیدمان کاتالوگ دلخواه، دانلود داخل اپ — [nuvio.tv](https://nuvio.tv) |

هر دو همان لینک منیفست را می‌پذیرند.

---

## متغیرهای محیطی مهم

| متغیر | توضیح |
|--------|--------|
| `TMDB_API_KEY` | متای فارسی/انگلیسی و پوستر |
| `ANIMEX_BASEURL` | پایهٔ انیمکس |
| `DONYAYESERIAL_BASEURL` | پایهٔ دنیای سریال |
| `F2MEDIA_BASEURL` / `CINAMATIC_BASEURL` / … | سایر پروایدرها |
| `CATALOG101_MANIFEST_URL` | منیفست کاتالوگ ۱۰۱ |
| `CATALOG_AIO_MANIFEST_URL` | منیفست AIOCatalogs |
| `CATALOG_ANIME_MANIFEST_URL` | کاتالوگ انیمه |
| `CATALOG_IPTVBRIDGE_MANIFEST_URL` | IPTV Bridge |
| `TORRENT_METEOR_MANIFEST_URL` | تورنت اختیاری |
| `ENABLED_PROVIDERS` | فیلتر پروایدر (مثلاً `f2media,animex`) |
| `PUBLIC_BASE_URL` | دامنهٔ عمومی برای پروکسی تصویر (اختیاری) |

جزئیات بیشتر در صفحهٔ [شخصی‌سازی](https://cinemagraphy.vercel.app/configure) و [راهنما](https://cinemagraphy.vercel.app/guide).

---

## استقرار

- **Vercel (پیشنهادی برای نسخهٔ عمومی):** اتصال ریپو + تنظیم env  
- **Cloudflare Workers:** اسکریپت worker پروژه  
- **VPS / لوکال:** `npm install` سپس اجرای اپ با همان متغیرها  

```bash
npm install
npm start
```

---

## احترام به اصل پروژه

این مخزن فورک و توسعهٔ شخصی از  
**[stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)**  
اثر **آقای محبی (MrMohebi)** است. از ایشان بابت بنیان پروژه سپاسگزاریم.

---

## پشتیبانی

- کانال تلگرام سینماگرافی: [t.me/cinemmagraphy](https://t.me/cinemmagraphy)  
- پشتیبانی: [t.me/nerdcow](https://t.me/nerdcow)  
- مخزن: [github.com/TheNerdCow/CinemaGraphy](https://github.com/TheNerdCow/CinemaGraphy)

---

## License

ISC — با احترام به پروژهٔ اصلی محبی.
