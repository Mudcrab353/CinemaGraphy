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
    <img src="https://img.shields.io/badge/version-2.1.44-blue.svg" alt="2.1.44" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Workers" />
    <img src="https://img.shields.io/badge/Nuvio-compatible-7eb6ff.svg" alt="Nuvio" />
    <img src="https://img.shields.io/badge/FA%20%7C%20EN-supported-5dcea0.svg" alt="FA EN" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="ISC" />
  </p>
</div>

---

## 🇮🇷 نصب سریع

1. [Stremio](https://www.stremio.com/downloads) یا **[Nuvio](https://nuvio.tv)** را نصب کنید  
2. منیفست عمومی:

```text
https://cinemagraphy.vercel.app/manifest.json
```

3. از خود سایت:

| | |
|---|---|
| 🏠 | [صفحه اصلی](https://cinemagraphy.vercel.app/) |
| ⚙️ | [شخصی‌سازی / Configure](https://cinemagraphy.vercel.app/configure) |
| 📖 | [راهنما](https://cinemagraphy.vercel.app/guide) |

بعد از نصب در **استریمیو**، کنار Install دکمهٔ **Configure** هم می‌آید و صفحهٔ شخصی‌سازی را باز می‌کند.

## 🇬🇧 Quick install

```text
https://cinemagraphy.vercel.app/manifest.json
```

[Site](https://cinemagraphy.vercel.app/) · [Configure](https://cinemagraphy.vercel.app/configure) · [Guide](https://cinemagraphy.vercel.app/guide)

In Stremio the addon list shows **Configure** next to Install (opens the same configure page).

---

## این پروژه چیست؟

**سینماگرافی** چند منبع ایرانی فیلم و سریال را در یک افزونه جمع می‌کند؛ با متای فارسی، کاتالوگ خارجی اختیاری، تورنت اختیاری و زیرنویس.

روی **Stremio** و **Nuvio** کار می‌کند. برای پایداری بیشتر **Nuvio** را پیشنهاد می‌کنیم.

---

## امکانات

| | |
|---|---|
| 🇮🇷 | منابع ایرانی موازی (جستجو + استریم) |
| 🖼️ | پروکسی تصویر TMDB — پوستر بدون VPN در ایران |
| 📝 | متای فارسی + fallback انگلیسی |
| 🌐 | زبان افزونه و برچسب استریم: **فارسی / English** |
| 📚 | کاتالوگ ۱۰۱ / AIO / انیمه / IPTV از env |
| 🌱 | تورنت اختیاری |
| 💬 | زیرنویس |
| ⚙️ | `/configure` → منیفست `/c/{cfg}/manifest.json` |
| 🎛️ | حالت **فقط استریم** (بدون متا/کاتالوگ) برای کنار AIOMetadata |
| ☁️ | Vercel · Cloudflare Workers · VPS / لوکال |

---

## شخصی‌سازی (Configure)

آدرس:

```text
https://cinemagraphy.vercel.app/configure
```

یا از لیست افزونه‌های استریمیو → **Configure**.

می‌توانید:

- پروایدرها را انتخاب کنید (F2Media، Cinamatic، Animex، …)
- **فقط استریم** روشن کنید (متا و کاتالوگ خاموش)
- زبان متادیتا (TMDB): فارسی یا انگلیسی
- زبان نام افزونه در لیست: سینماگرافی / CinemaGraphy
- کلید TMDB، لینک AIO / ۱۰۱ / انیمه، تورنت و …
- لینک قبلی `/c/...` را بارگذاری کنید تا بدون وارد کردن دوبارهٔ کلیدها ویرایش شود

منیفست **پیش‌فرض عمومی** روی صفحهٔ اصلی می‌ماند؛ صفحهٔ configure همیشه لینک **اختصاصی** می‌سازد.

---

## متغیرهای محیطی مهم

| متغیر | نقش |
|--------|------|
| `TMDB_API_KEY` | متا و پوستر |
| `F2MEDIA_BASEURL` و بقیهٔ `*_BASEURL` | پروایدرها |
| `TORRENT_METEOR_MANIFEST_URL` | تورنت |
| `CATALOG101_MANIFEST_URL` | کاتالوگ ۱۰۱ |
| `CATALOG_AIO_MANIFEST_URL` | AIOCatalogs |
| `CATALOG_ANIME_MANIFEST_URL` | کاتالوگ انیمه |
| `CATALOG_IPTVBRIDGE_MANIFEST_URL` | IPTV |
| `PROVIDER_TIMEOUT_MS` | مهلت هر پروایدر |
| `PUBLIC_BASE_URL` | آدرس عمومی (پروکسی تصویر) |

---

## نسخه ۲.۱.۴۴

از ۲.۱.۳۶ تا اینجا (خلاصه):

| نسخه | موضوع |
|------|--------|
| ۲.۱.۳۷ | برچسب نصب «نوویو و استریمیو» |
| ۲.۱.۳۸ | Configure پیشرفته + فقط‌استریم + بارگذاری تنظیمات |
| ۲.۱.۳۹ | زبان FA/EN صفحه + زبان متا + زبان افزونه |
| ۲.۱.۴۰–۴۱ | نمایش استریم بدون تکرار؛ برچسب‌های انگلیسی کامل |
| ۲.۱.۴۲ | لندینگ: عنوان/پوستر با سوییچ FA/EN |
| ۲.۱.۴۳ | Animex: لیست پوشه + تشخیص قسمت |
| **۲.۱.۴۴** | دکمهٔ **Configure** در لیست استریمیو (`behaviorHints.configurable`) |

---

## دیپلوی

- **Vercel:** پوشهٔ پروژه را به root وصل کنید (`vercel.json` موجود است)
- **Cloudflare Worker:** اسکریپت‌های `worker` / `wrangler` در `package.json`
- **VPS / لوکال:** `npm i && node` (یا اسکریپت start)

منیفست خصوصی تست (Cloudflare) را عمومی نکنید؛ نسخهٔ عمومی: `cinemagraphy.vercel.app`.

---

## کانال و پشتیبانی

- کانال: [t.me/cinemmagraphy](https://t.me/cinemmagraphy)
- پشتیبانی: [t.me/nerdcow](https://t.me/nerdcow)
- گیت‌هاب: [TheNerdCow/CinemaGraphy](https://github.com/TheNerdCow/CinemaGraphy)

با احترام به پروژهٔ پایهٔ استریمیو ایرانی (محبّی / ir-stremio) که این فورک از آن گسترش یافته است.

---

## License

ISC
