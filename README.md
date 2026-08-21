<div align="center">
  <img src="./logo.png" alt="Cinemagraphy" width="128" height="128" />
  <h1>سینماگرافی — Cinemagraphy 3.0</h1>
  <p>
    <b>افزونهٔ رایگان استریمیو برای فیلم، سریال، انیمه و منابع ایرانی</b><br/>
    Free Stremio addon — Iranian sources, Persian metadata, optional torrents &amp; IPTV
  </p>
  <p>
    <a href="https://cinemagraphy.vercel.app/"><img src="https://img.shields.io/badge/site-cinemagraphy.vercel.app-e50914?style=for-the-badge" alt="Site" /></a>
    <a href="https://cinemagraphy.vercel.app/manifest.json"><img src="https://img.shields.io/badge/manifest-install-blue?style=for-the-badge" alt="Manifest" /></a>
    <a href="https://cinemagraphy.vercel.app/configure"><img src="https://img.shields.io/badge/configure-custom-orange?style=for-the-badge" alt="Configure" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-3.0.0-blue.svg" alt="3.0.0" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-worker-f38020.svg" alt="Cloudflare" />
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

3. از سایت:

| | |
|---|---|
| 🏠 | [صفحه اصلی](https://cinemagraphy.vercel.app/) |
| ⚙️ | [شخصی‌سازی / Configure](https://cinemagraphy.vercel.app/configure) |
| 📖 | [راهنما](https://cinemagraphy.vercel.app/guide) |

در استریمیو کنار Install دکمهٔ **Configure** هم نمایش داده می‌شود.

## 🇬🇧 Quick install

```text
https://cinemagraphy.vercel.app/manifest.json
```

[Site](https://cinemagraphy.vercel.app/) · [Configure](https://cinemagraphy.vercel.app/configure) · [Guide](https://cinemagraphy.vercel.app/guide)

---

## امکانات (نسخه ۳.۰)

| | |
|---|---|
| 🇮🇷 | منابع ایرانی موازی (F2Media، Animex، DonyayeSerial، …) |
| 🖼️ | پروکسی تصویر TMDB — پوستر و تامبنیل بدون VPN در ایران |
| 📝 | متای فارسی (عنوان، توضیح، قسمت‌ها) + fallback انگلیسی |
| 🌐 | زبان افزونه و برچسب‌های کاتالوگ (FA / EN) |
| 📺 | ماهواره / IPTV Bridge — مستقل از حالت «فقط استریم» |
| 📚 | کاتالوگ ۱۰۱ / AIO / انیمه / ترکی (F2) از env |
| 🌱 | تورنت اختیاری (Meteor) |
| ⚙️ | `/configure` → منیفست اختصاصی `/c/{cfg}/manifest.json` |
| 🎛️ | فقط استریم · بدون متا · بدون کاتالوگ فیلم (IPTV جدا می‌ماند) |
| 📱 | سازگار با **Stremio** و **Nuvio** |

---

## شخصی‌سازی

https://cinemagraphy.vercel.app/configure

- پروایدرها، فقط‌استریم، زبان متا، **زبان افزونه (فارسی / English)**
- بارگذاری لینک `/c/...` قبلی بدون وارد کردن دوبارهٔ کلیدها
- ماهواره: تیک جدا + لینک M3U اختیاری
- کاتالوگ‌های خارجی (۱۰۱، AIO، انیمه، IPTV) از متغیرهای محیطی

---

## استقرار

| پلتفرم | توضیح |
|--------|--------|
| **Vercel** | استقرار اصلی عمومی — `vercel.json` آماده است |
| **Cloudflare Worker** | `pnpm worker:deploy` / `wrangler deploy` — همان منطق استریم و متا |
| **VPS / لوکال** | `node index.js` یا `pnpm start` با Node 24 |

متغیرهای مهم: `TMDB_API_KEY`، آدرس پروایدرها، `CATALOG101_MANIFEST_URL` / `CATALOG_AIO_MANIFEST_URL`، `TORRENT_METEOR_MANIFEST_URL`، `ENABLE_F2_TURKISH`.

---

## تاریخچهٔ خلاصه (از ۲.۱.۳۶ تا ۳.۰.۰)

- پروکسی TMDB برای پوستر، بک‌گراند و تامبنیل قسمت‌ها  
- متای فارسی پایدار + نام قسمت‌ها  
- پشتیبانی رسمی Nuvio و برچسب‌های نصب  
- شخصی‌سازی پیشرفته (زبان، فقط استریم، IPTV مستقل)  
- کاتالوگ ۱۰۱ / AIO با غنی‌سازی فارسی و ترتیب منطقی  
- Animex سریال، F2Media کیفیت‌ها، کاتالوگ سریال ترکی  
- نماکده (اختیاری)، ماهواره مستقل  
- Worker کلادفلر هم‌تراز Vercel (timeout استریم، `tt` برای قسمت‌ها)

---

## احترام به پروژهٔ اصلی

فورک و توسعهٔ مستقل بر پایهٔ [stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers) — با تغییرات گسترده در متا، کاتالوگ، لندینگ و استقرار.

---

## پشتیبانی

- کانال تلگرام: [@cinemmagraphy](https://t.me/cinemmagraphy)  
- ارتباط: [@NerdCow](https://t.me/nerdcow)  
- Issues روی همین مخزن  

**حمایت مالی** (ایران / خارج — کریپتو و …) به‌زودی روی سایت فعال می‌شود.

---

## مجوز

ISC
