# سینماگرافی ۳.۱.۰ — تغییرات برای تست

**هیچ‌چیز روی سرور لایو (Vercel) اعمال نشده.** این بسته فقط برای بررسی و تست محلی / پیش‌نمایش است.

## خلاصه کارها (طبق برنامه)

| # | موضوع | وضعیت |
|---|--------|--------|
| 1 | بک‌آپ کامل master | انجام شد (baseline ZIP) |
| 2 | اسکیل `cinemagraphy-dev` | انجام شد |
| 3 | ماژولار کردن کد | انجام شد (مرحله ۱+۲) |
| 4 | امنیت کانفیگ | انجام شد (هشدار UI + redaction + helperها) |
| 5 | کش پایدار | انجام شد (لایه cache با memory؛ آماده Redis) |
| 6 | UI لندینگ/Configure | هشدار امنیتی در صفحه Configure + نسخه ۳.۱.۰ |
| 7 | سلامت پروایدرها | وضعیت قبلی حفظ + نمایش cache در `/providers.json` |
| 8 | تست / observability | syntax-check + smoke test ماژول‌ها |
| 9 | دیتابیس اختیاری | طراحی برای فاز بعد (watchlist) — عمداً فعلاً پیاده نشد تا لایو ساده بماند |

## فایل‌های جدید

```
lib/config.js          — decode/merge کانفیگ /c/
lib/stream-format.js   — عنوان استریم و مرتب‌سازی کیفیت
lib/http.js            — timeout و log خطا
lib/cache.js           — کش memory (+ اختیاری Redis)
lib/security.js        — redaction اسرار و هشدار اشتراک‌گذاری
```

## نسخه

- `ADDON_VERSION` → **3.1.0**
- رفتار پخش / متا / کاتالوگ با ۳.۰.۰ یکسان نگه داشته شده

## متغیرهای محیطی جدید (اختیاری)

```env
CACHE_BACKEND=memory
# CACHE_BACKEND=redis
# REDIS_URL=redis://127.0.0.1:6379
# CACHE_PREFIX=cg:
# CACHE_MEMORY_MAX=2000
```

برای Redis باید بسته `ioredis` جدا نصب شود؛ بدون آن به‌صورت خودکار memory استفاده می‌شود.

## چطور تست کنی (بدون برنامه‌نویسی)

### روش ساده — لوکال

1. این ZIP را از حالت فشرده خارج کن.
2. روی کامپیوتر Node.js نسخه ۲۴ نصب باشد.
3. در پوشه پروژه:
   - `npm install` یا `pnpm install`
   - فایل `.env` از روی `.env.example` بساز و کلیدها را پر کن (مثل قبل).
   - `npm start` یا `pnpm start`
4. در مرورگر باز کن: `http://localhost:7000`
5. صفحه Configure را باز کن و هشدار امنیتی را ببین.
6. `/providers.json` را باز کن — باید `version: 3.1.0` و بخش `cache` را ببینی.
7. در استریمیو/Nuvio منیفست `http://localhost:7000/manifest.json` را نصب و یک فیلم تست کن.

### روش امن روی Vercel (پیش‌نمایش)

1. یک **branch جدید** از master بساز (مثلاً `release/3.1.0`).
2. فایل‌های این بسته را جایگزین کن و push کن.
3. از Preview URL تست کن — **Production را عوض نکن** تا وقتی مطمئن نشدی.

## اگر مشکلی دیدی

- بک‌آپ اصلی: `CinemaGraphy-master-baseline-2026-08-22.zip`
- Commit امن قبلی: `b0789d6e2a9ebba560ff6fd6ff0821dd91e002e7`

## فازهای بعدی (وقتی ۳.۱.۰ پایدار شد)

- استخراج کامل‌تر `utils.js` (tmdb / catalog)
- ذخیره کانفیگ با توکن کوتاه به‌جای base64 در URL
- اتصال واقعی Redis/KV روی production
- دیتابیس برای watchlist / آمار
