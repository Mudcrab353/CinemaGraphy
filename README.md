<div align="center">
  <img src="./logo.png" alt="Cinemagraphy" width="128" height="128" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p><b>افزونه‌ی استریمیو برای فیلم، سریال، انیمه و منابع ایرانی</b><br/>
  Stremio addon for movies, series, anime &amp; Iranian sources</p>
  <p>
    <a href="https://cinemagraphy.vercel.app/"><img src="https://img.shields.io/badge/site-cinemagraphy.vercel.app-e50914?style=for-the-badge" alt="Site" /></a>
    <a href="https://cinemagraphy.vercel.app/manifest.json"><img src="https://img.shields.io/badge/manifest-install-blue?style=for-the-badge" alt="Manifest" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-2.1.36-blue.svg" alt="2.1.36" />
    <img src="https://img.shields.io/badge/vercel-ready-black.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Workers" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="ISC" />
  </p>
</div>

---

### 🇮🇷 نصب سریع
1. [Stremio](https://www.stremio.com/downloads) را نصب کنید  
2. منیفست عمومی: `https://cinemagraphy.vercel.app/manifest.json`  
3. یا از [سایت](https://cinemagraphy.vercel.app/) · [شخصی‌سازی](https://cinemagraphy.vercel.app/configure) · [راهنما](https://cinemagraphy.vercel.app/guide)

### 🇬🇧 Quick install
Add: `https://cinemagraphy.vercel.app/manifest.json`

---


### ✨ ۲.۱.۳۶ (خلاصه از ۲.۱.۲۹)
- پروکسی تصویر TMDB (بدون VPN برای پوستر/تامبنیل در ایران)
- متای فارسی پایدارتر + قسمت‌ها
- فیکس کاتالوگ «داغ — سریال» در استریمیو (`tmdb:` → IMDb)
- پشتیبانی و معرفی **Nuvio** در لندینگ و راهنما
- UI شیشه‌ای یکدست برای خانه / راهنما / شخصی‌سازی

**سینماگرافی** منابع ایرانی، تورنت اختیاری، زیرنویس و متای فارسی را در یک افزونه جمع می‌کند.

| | |
|---|---|
| 🔍 | جستجوی موازی پروایدرها با timeout و کش |
| 📊 | کیفیت، حجم، صدا |
| 🇮🇷 | متای فارسی (TMDB) با fallback انگلیسی |
| 🧩 | کاتالوگ ۱۰۱ / AIO / انیمه / IPTV از env |
| 🌐 | لندینگ liquid-glass + راهنما + configure |
| ⚙️ | `/configure` → منیفست اختصاصی `/c/{cfg}/manifest.json` |
| ☁️ | Vercel · Cloudflare Workers · VPS / لوکال |

---

### احترام به اصل پروژه
فورک و توسعه‌ی شخصی از **[stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)** اثر **آقای محبی (MrMohebi)**.

---

### نسخه ۲.۱.۲۹ — خلاصه
- TMDB Image Proxy برای کاربران ایران (بدون VPN)
- client مرکزی + کش API؛ فارسی‌سازی قبلی حفظ شد

### نسخه ۲.۱.۲۸ — خلاصه
- ترتیب کاتالوگ: ۱۰۱ (داغ → برترین تاریخ → کره‌ای/چینی → استریمینگ) → انیمه → IPTV آخر
- نام کاتالوگ‌ها به فارسی روزمره
- متای FA/EN برای کاتالوگ و لندینگ
- Animex: سریال/انیمه + fallback مرورگر وقتی CDN فقط از IP ایران باز است
- راهنما: مخفی‌کردن ردیف‌های Cinemeta با هشدار امنیتی authKey
- AIO / ۱۰۱ / انیمه از env با کش و fallback

---

### متغیرهای محیطی مهم
| متغیر | توضیح |
|--------|--------|
| `ANIMEX_BASEURL` | پایه انیمکس |
| `DONYAYESERIAL_BASEURL` | پایه دنیای سریال |
| `TMDB_API_KEY` | متای فارسی/انگلیسی |
| `CATALOG101_MANIFEST_URL` | منیفست ۱۰۱ |
| `CATALOG_AIO_MANIFEST_URL` | منیفست AIOCatalogs |
| `CATALOG_ANIME_MANIFEST_URL` | کاتالوگ انیمه |
| `CATALOG_IPTVBRIDGE_MANIFEST_URL` | IPTV Bridge |
| `ENABLED_PROVIDERS` | فیلتر پروایدر (اختیاری) |

جزئیات در `/configure` و `/guide`.

---

### استقرار
- **Vercel:** ریپو + env  
- **Cloudflare Workers:** worker مربوطه  
- **VPS / لوکال:** Node با همان env  

---

### پشتیبانی
- کانال: [t.me/cinemmagraphy](https://t.me/cinemmagraphy)  
- پشتیبانی: [t.me/nerdcow](https://t.me/nerdcow)

---

### License
ISC — با احترام به پروژهٔ اصلی آقای محبی.
