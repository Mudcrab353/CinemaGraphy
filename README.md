<div align="center">
  <img src="./logo.png" alt="Cinemagraphy Logo" width="120" height="120" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p>افزونه‌ی استریمیو من برای فیلم، سریال، انیمه و تلویزیون زنده — چند تا سایت ایرانی و چند تا کاتالوگ خارجی، همه با هم تو یه افزونه.</p>

  <p>
    <img src="https://img.shields.io/badge/version-1.3.0-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/node-%3E%3D24.18.0-green.svg" alt="Node >=24.18.0" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Cloudflare Workers" />
    <img src="https://img.shields.io/badge/docker-ready-2496ED.svg" alt="Docker Ready" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="License ISC" />
  </p>
</div>

---

## 🙏 این پروژه از کجا اومد

**سینماگرافی** فورک شخصی‌سازی‌شده‌ی [**stremio-ir-providers**](https://github.com/MrMohebi/stremio-ir-providers) هست، کار **آقای محبی (MrMohebi)**. معماری اصلی، ایده‌ی پروایدرها، همه‌ش کار ایشونه — من روش کلی چیز اضافه کردم.

چیزهایی که روی نسخه‌ی اصلی اضافه/تغییر دادم: نمایش کامل‌تر اطلاعات هر استریم (کیفیت، حجم، صدا با ایموجی)، پروایدر DigiMovie با حل خودکار سوال امنیتی، ادغام دو تا کاتالوگ خارجی (101Catalogs و Anime Catalogs) با اسم‌های فارسی‌شده، متادیتای فارسی از TMDB، تلویزیون زنده با M3U دلخواه به‌جای یه لیست ثابت، و یه سری باگ‌فیکس تو نسخه‌ی Workers.

مجوز همون [ISC](https://opensource.org/licenses/ISC) نسخه‌ی اصلیه — آزاد برای استفاده و تغییر، فقط یادداشت کپی‌رایت رو نگه دار.

---

## ✨ ویژگی‌ها / Features

| ویژگی | توضیح |
|---|---|
| 🔍 جستجوی همزمان | جستجو در همه‌ی پروایدرها با یک بار تایپ |
| 🎬 فیلم و سریال | پشتیبانی کامل فصل/قسمت |
| 📊 اطلاعات دقیق استریم | منبع، کیفیت (4K/1080p/...)، HDR/10bit/کدک، نوع صدا، حجم — با ایموجی و خوانای فارسی |
| 🗣️ تفکیک صدا از زیرنویس | تشخیص واضح «دوبله فارسی» در برابر «زیرنویس فارسی» |
| 📺 تلویزیون زنده | کانال‌های IPTV صداوسیما/تلوبیون |
| ☁️ سه روش دیپلوی | Cloudflare Workers، Docker، یا هر VPS |
| 🎛️ روشن/خاموش کردن پروایدرها | با متغیرهای محیطی، بدون نیاز به تغییر کد |
| 🧩 ادغام کاتالوگ‌های خارجی | کاتالوگ‌های [101Catalogs](https://config.101catalogs.xyz/) و Anime Catalogs داخل همین یک افزونه، بدون نصب جدا |
| 🇮🇷 متادیتای فارسی (TMDB) | پوستر، توضیحات و ژانر به فارسی برای فیلم/سریال‌ها (نیاز به `TMDB_API_KEY`) |
| 📡 M3U دلخواه | به‌جای یه لیست پیش‌فرض، لینک M3U و اسم دلخواه خودت رو بده |
| 💬 زیرنویس SubSource | لینک شخصی‌سازی‌شده‌ی خودتو بده، اولویت با زیرنویس فارسی |
| 🌐 پروکسی تصویر داخلی | برای دور زدن محدودیت دسترسی به متادیتا |

---

## 🎯 پروایدرهای پشتیبانی‌شده / Supported Providers

| پروایدر | نوع | سانسور محتوا | یادداشت |
|---|---|---|---|
| **F2Media** | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | لینک مستقیم دانلود |
| **Cinamatic** | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | چند کیفیت و انکودر |
| **AslMoviez** | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | رتبه‌بندی IMDb |
| **SerialBlog** | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | آینه‌ی AslMoviez |
| **PeepBoxTV** | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | نیاز به اکانت و کلید API شخصی |
| **DigiMovie** 🎁 بونوس | 🎬 فیلم و 📺 سریال | ✅ سانسور نشده | نیاز به اکانت شخصی؛ پشت محافظت Cloudflare — رو Workers ممکنه ناپایدار باشه، رو VPS/Docker پایدارتره |
| **ZardFilm** | 🎬 فیلم و 📺 سریال | ⚠️ سانسور شده | فقط با IP ایران محتوای درست میده — رو VPS ایرانی جواب میده، رو Cloudflare Workers (IP خارج) نه |
| **IPTV (M3U دلخواه)** | 📺 تلویزیون زنده | بستگی به لیست خودت داره | پیش‌فرض کاملاً خاموشه؛ لینک M3U و اسم دلخواه خودت رو بده تا فعال بشه |
| **Anime Catalogs** 🧩 | 🎬 انیمه (کاتالوگ) | — | فقط مرور/پوستر — پخش هنوز وصل نیست (پایین توضیح داده شده) |

> وضعیت سانسور هر پروایدر، آخرین خط توضیحات هر استریم هم داخل خود اپ Stremio نشون داده میشه.

> **Anime Catalogs:** با آیدی داخلی `kitsu:` کار می‌کنه (حتی اگه از تنظیماتش MyAnimeList رو انتخاب کرده باشی — خود این افزونه همه‌چی رو به Kitsu نگاشت می‌کنه). عنوان انیمه از Kitsu گرفته میشه و تو پروایدرهای خودمون سرچ میشه؛ اسم کاتالوگ‌ها هم کامل فارسیه.

---

## 🔧 نصب / Installation

سینماگرافی رو می‌شه به سه روش اجرا کرد. هرکدوم رو که می‌خوای انتخاب کن:

### روش ۱ — Cloudflare Workers (رایگان، بدون سرور)

```sh
git clone https://github.com/<YOUR_USERNAME>/cinemagraphy.git
cd cinemagraphy
corepack enable
pnpm install

npx wrangler login
cp .dev.vars.example .dev.vars
# مقادیر .dev.vars رو طبق جدول «متغیرهای محیطی» پایین پر کن

pnpm worker:deploy
```
آدرس نهایی: `https://cinemagraphy.<your-subdomain>.workers.dev/manifest.json`

> **نکته:** اگه از Git integration کلادفلر استفاده می‌کنی (بدون خط‌فرمان)، فقط کافیه ریپازیتوری رو به Workers & Pages وصل کنی و متغیرها رو تو داشبورد (Settings → Variables and secrets) وارد کنی.

### روش ۲ — Docker

```sh
docker compose up -d
```
پیش از اجرا، فایل `.env` رو طبق `.env.example` پر کن. سرویس رو پورت `7000` بالا میاد.

### روش ۳ — روی هر VPS (بدون Docker)

```sh
git clone https://github.com/<YOUR_USERNAME>/cinemagraphy.git
cd cinemagraphy
corepack enable
pnpm install
cp .env.example .env
# مقادیر رو پر کن
pnpm start
```

> 💡 روی VPS، پروایدرهایی مثل DigiMovie که پشت محافظت ضدربات هستن، معمولاً پایدارتر از Cloudflare Workers کار می‌کنن — چون IP دیتاسنترهای عمومی کمتر به چشم این سیستم‌ها مشکوک میاد.

---

## ⚙️ متغیرهای محیطی / Environment Variables

| متغیر | لازم؟ | توضیح |
|---|---|---|
| `F2MEDIA_BASEURL` | فقط اگه F2Media می‌خوای | آدرس فعلی سایت F2Media |
| `ASLMOVIEZ_BASEURL` | فقط اگه AslMoviez می‌خوای | آدرس فعلی سایت AslMoviez |
| `SERIALBLOG_BASEURL` | فقط اگه SerialBlog می‌خوای | آدرس فعلی سایت SerialBlog |
| `CINAMATIC_BASEURL` | فقط اگه Cinamatic می‌خوای | آدرس فعلی سایت Cinamatic |
| `PEEPBOXTV_BASEURL` | فقط اگه PeepBoxTV می‌خوای | آدرس API پیپ‌باکس |
| `PEEPBOXTV_USER_ID` | همراه PeepBoxTV | شناسه اکانت شخصی |
| `PEEPBOXTV_ANDROID_ID` | همراه PeepBoxTV | شناسه دستگاه |
| `PEEPBOXTV_API_KEY` | همراه PeepBoxTV | کلید API شخصی (Secret) |
| `DIGIMOVIE_BASEURL` | فقط اگه DigiMovie می‌خوای | معمولاً `https://digimoviez.com` |
| `DIGIMOVIE_USERNAME` | همراه DigiMovie | یوزرنیم اکانت شخصی (Secret) |
| `DIGIMOVIE_PASSWORD` | همراه DigiMovie | پسورد اکانت شخصی (Secret) |
| `ZARDFILM_BASEURL` | فقط اگه ZardFilm می‌خوای | معمولاً `https://zardfilm.in` (نیاز به IP ایران) |
| `IPTV_M3U_URL` | اختیاری | لینک M3U دلخواه خودت — اگه خالی باشه، این پروایدر کلاً غیرفعاله |
| `IPTV_NAME` | اختیاری | اسم کاتالوگ تلویزیون زنده (پیش‌فرض: `IPTV`) |
| `CATALOG101_MANIFEST_URL` | اختیاری | لینک منیفست شخصی‌سازی‌شده‌ت از [101Catalogs](https://config.101catalogs.xyz/) |
| `CATALOG_ANIME_MANIFEST_URL` | اختیاری | لینک منیفست شخصی‌سازی‌شده‌ت از [Anime Catalogs](https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/configure) |
| `SUBSOURCE_MANIFEST_URL` | اختیاری | لینک منیفست شخصی‌سازی‌شده‌ت از [SubSource](https://subsource.net/) — اگه خالی باشه، زیرنویس از OpenSubtitles میاد |
| `TMDB_API_KEY` | اختیاری | بهبود تشخیص IMDb ID + پوستر/توضیحات/ژانر فارسی برای فیلم و سریال (Secret) |
| `PROXY_ENABLE` | اختیاری | `true`/`false` — فقط لازم اگه سرور خودت داخل ایرانه |
| `LOG_LEVEL` | اختیاری | `error` / `warn` / `info` / `debug` |
| `DEV_MODE` | اختیاری | `true`/`false` |

**روشن/خاموش‌کردن پروایدرها:** هر پروایدری که `BASEURL`ش رو خالی بذاری، خودکار از سرچ و لیست استریم‌ها حذف میشه — نیازی به تغییر کد نیست.

هر متغیری که مقدارش رمز/حساسه (پسورد، API Key، Username) رو حتماً به‌صورت **Secret** ثبت کن، نه Plaintext.

---

## 🛠️ توسعه / Development

```sh
pnpm install        # نصب پکیج‌ها
pnpm test           # اجرای تست‌ها
pnpm dev            # اجرای لوکال با ری‌استارت خودکار
pnpm worker:dev      # اجرای لوکال به‌شکل Cloudflare Worker
pnpm worker:deploy   # دیپلوی روی Cloudflare Workers
```

### ساختار پروژه

```
cinemagraphy/
├── app.js                  # نسخه‌ی Express (سرور/Docker/VPS)
├── cloudflare/              # نسخه‌ی Cloudflare Workers
│   ├── worker.js
│   └── http-client.js
├── sources/                  # هر پروایدر یک فایل
│   ├── digimovie.js          # پروایدر DigiMovie (حل خودکار سوال امنیتی)
│   └── ...
├── utils.js                  # فرمت‌بندی استریم (کیفیت/حجم/صدا/ایموجی)
├── docs/                     # مستندات فنی (اضافه‌کردن پروایدر جدید و ...)
└── wrangler.jsonc            # تنظیمات Cloudflare Workers
```

راهنمای اضافه‌کردن پروایدر جدید: [`docs/ADDING-A-PROVIDER.md`](docs/ADDING-A-PROVIDER.md)

---

## 📝 تغییرات نسبت به نسخه‌ی اصلی / Changes from Upstream

- بازنویسی کامل نمایش اطلاعات استریم: منبع، کیفیت (رزولوشن/HDR/10bit/کدک/BluRay-WEB-DL)، نوع صدا (دوبله/زیرنویس)، حجم، و وضعیت سانسور — با ایموجی، خوانا و بدون به‌هم‌ریختگی راست‌به‌چپ/چپ‌به‌راست
- اضافه‌شدن کامل پروایدر DigiMovie، شامل حل خودکار سوال امنیتی متنی فارسی هنگام لاگین
- اضافه‌شدن پروایدر ZardFilm
- ادغام کاتالوگ‌های [101Catalogs](https://config.101catalogs.xyz/) و Anime Catalogs داخل همین یک افزونه
- متادیتای فارسی (پوستر/توضیحات/ژانر) از TMDB برای فیلم و سریال
- تبدیل تلویزیون زنده به یه فیچر M3U کاملاً دلخواه (بدون هیچ برندی پیش‌فرض، پیش‌فرض خاموش)
- رفع باگ نمایش نادرست حجم فایل تو AslMoviez/SerialBlog و کامل‌تر شدن اطلاعات PeepBoxTV
- رفع باگی در نسخه‌ی Workers که کوکی‌های چندگانه‌ی پاسخ سرور رو نادرست ادغام می‌کرد
- کش‌کردن نشست لاگین بین درخواست‌ها برای کاهش لاگین‌های تکراری
- ریبرندینگ کامل (اسم، شناسه، مستندات)

**نسخه‌ی ۱.۲:**
- اسم کاتالوگ‌های ۱۰۱Catalogs و Anime Catalogs فارسی‌سازی شد
- پخش (stream) برای انیمه‌های کاتالوگ Anime Catalogs وصل شد (تشخیص عنوان از Kitsu + سرچ تو پروایدرهای خودمون)
- تشخیص کیفیت/صدا برای F2Media از رو اسم واقعی فایل هم انجام میشه (نه فقط برچسب کوتاه صفحه)، و چند تا الگوی جاافتاده (WEB.DL با نقطه، SoftSub چسبیده) اضافه شد
- فایل‌های صوتیِ تنها (بدون تصویر) حالا برچسب جدا و بدون ابهام دارن

**نسخه‌ی ۱.۳:**
- اسم کاتالوگ‌های خارجی حالا کامل فارسیه (نه نصفه-نیمه) — هم بخش توصیفی هم نوع محتوا (فیلم/سریال) به فارسی
- ادغام افزونه‌ی زیرنویس [SubSource](https://subsource.net/) با لینک شخصی‌سازی‌شده‌ی هرکس (اولویت با فارسی)
- تشخیص کیفیت/انکد حالا از رو اسم واقعی فایل تو URL هم انجام میشه (برای همه‌ی پروایدرها، نه فقط یکی)
- خط کیفیت به دو خط جدا («کیفیت» و «انکد») تقسیم شد تا رو گوشی بهم نریزه
- منیفست حالا در برابر خطای موقت یه کاتالوگ خارجی مقاومه — یه سرویس قطع باشه، بقیه‌چیز درست کار می‌کنه

---

## ⚠️ سلب مسئولیت / Disclaimer

این پروژه صرفاً برای **مقاصد آموزشی** منتشر شده. افزونه محتوایی رو میزبانی، ذخیره یا توزیع نمی‌کنه —
فقط به منابع عمومی موجود در وب لینک میده. مسئولیت رعایت قوانین محلی و شرایط استفاده‌ی هر منبع، با کاربره.

This project is for **educational purposes only**. The addon does not host, store, or distribute any
content — it only links to publicly available third-party sources. Users are responsible for complying
with applicable laws and each source's terms of service.

---

## 📄 مجوز / License

منتشر شده تحت [مجوز ISC](https://opensource.org/licenses/ISC)، همون مجوز پروژه‌ی اصلی.

Copyright © original work by MrMohebi ([stremio-ir-providers](https://github.com/MrMohebi/stremio-ir-providers)).
Modifications and Cinemagraphy branding © their respective author.

---

<div align="center">
  <sub>یه فورک شخصی‌سازی‌شده، با احترام به کار اصلی آقای محبی. 🎬</sub>
</div>
