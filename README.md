<div align="center">
  <img src="./logo.png" alt="Cinemagraphy Logo" width="120" height="120" />
  <h1>سینماگرافی — Cinemagraphy</h1>
  <p>افزونه‌ی استریمیو برای دانلود و تماشای فیلم، سریال و تلویزیون زنده از منابع ایرانی و بین‌المللی.</p>
  <p><em>A Stremio addon that aggregates Iranian and international streaming sources.</em></p>

  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/node-%3E%3D24.18.0-green.svg" alt="Node >=24.18.0" />
    <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Cloudflare Workers" />
    <img src="https://img.shields.io/badge/docker-ready-2496ED.svg" alt="Docker Ready" />
    <img src="https://img.shields.io/badge/license-ISC-lightgrey.svg" alt="License ISC" />
  </p>
</div>

---

## 🙏 اصالت پروژه / Project Origin

**سینماگرافی** یک فورک شخصی‌سازی‌شده از پروژه‌ی متن‌باز
[**stremio-ir-providers**](https://github.com/MrMohebi/stremio-ir-providers) نوشته‌ی
**آقای محبی (MrMohebi)** است. تمام ساختار پایه، معماری پروایدرها، و ایده‌ی اصلی متعلق به ایشونه.

روی این پایه، تغییرات گسترده‌ای اعمال شده: بازطراحی کامل نمایش اطلاعات استریم (کیفیت/حجم/صدا با ایموجی)،
اضافه‌شدن پروایدر DigiMovie (شامل حل خودکار سوال امنیتی لاگین)، رفع چند باگ زیرساختی در نسخه‌ی
Cloudflare Workers، ریبرندینگ کامل، و مستندسازی از نو.

**Cinemagraphy** is a personalized fork of the open-source
[**stremio-ir-providers**](https://github.com/MrMohebi/stremio-ir-providers) project by
**MrMohebi**. The core architecture and provider framework are his original work. This fork adds
extensive customizations on top of it — see [Changes from Upstream](#-تغییرات-نسبت-به-نسخه‌ی-اصلی--changes-from-upstream).

این پروژه طبق [مجوز ISC](https://opensource.org/licenses/ISC) منتشر شده (همون مجوز نسخه‌ی اصلی) —
یعنی آزادانه قابل استفاده، تغییر و توزیعه، به شرط حفظ یادداشت کپی‌رایت.

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
| 🧩 ادغام کاتالوگ‌های خارجی | کاتالوگ‌های [101Catalogs](https://config.101catalogs.xyz/) داخل همین یک افزونه، بدون نصب جدا |
| 🌐 پروکسی تصویر داخلی | برای دور زدن محدودیت دسترسی به متادیتا |

---

## 🎯 پروایدرهای پشتیبانی‌شده / Supported Providers

| پروایدر | نوع | سانسور محتوا | یادداشت |
|---|---|---|---|
| **F2Media** | 🎬 فیلم و 📺 سریال | ✅ دارد (طبق اعلام خود سایت) | لینک مستقیم دانلود |
| **Cinamatic** | 🎬 فیلم و 📺 سریال | 🔍 در حال بررسی | چند کیفیت و انکودر |
| **AslMoviez** | 🎬 فیلم و 📺 سریال | 🔍 در حال بررسی | رتبه‌بندی IMDb |
| **SerialBlog** | 🎬 فیلم و 📺 سریال | 🔍 در حال بررسی | آینه‌ی AslMoviez |
| **PeepBoxTV** | 🎬 فیلم و 📺 سریال | 🔍 در حال بررسی | نیاز به اکانت و کلید API شخصی |
| **DigiMovie** 🎁 بونوس | 🎬 فیلم و 📺 سریال | ✅ دارد | نیاز به اکانت شخصی؛ پشت محافظت Cloudflare — رو Workers ممکنه ناپایدار باشه، رو VPS/Docker پایدارتره |
| **ZardFilm** | 🎬 فیلم و 📺 سریال | ⚠️ سانسور شده | فقط با IP ایران محتوای درست میده — رو VPS ایرانی جواب میده، رو Cloudflare Workers (IP خارج) نه |
| **Seda va Sima - Telewebion** | 📺 تلویزیون زنده | — | پلی‌لیست رسمی M3U |

> وضعیت سانسور هر پروایدر، آخرین خط توضیحات هر استریم هم داخل خود اپ Stremio نشون داده میشه (✅ سانسور نشده / ⚠️ سانسور شده).

> ردیف‌های «در حال بررسی» به‌مرور تکمیل میشن.

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
| `CATALOG101_MANIFEST_URL` | اختیاری | لینک منیفست شخصی‌سازی‌شده‌ت از [101Catalogs](https://config.101catalogs.xyz/) |
| `TMDB_API_KEY` | اختیاری | بهبود تشخیص IMDb ID (Secret) |
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
- ادغام کاتالوگ‌های [101Catalogs](https://config.101catalogs.xyz/) داخل همین یک افزونه
- رفع باگی در نسخه‌ی Workers که کوکی‌های چندگانه‌ی پاسخ سرور رو نادرست ادغام می‌کرد
- کش‌کردن نشست لاگین بین درخواست‌ها برای کاهش لاگین‌های تکراری
- ریبرندینگ کامل (اسم، شناسه، مستندات)

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
