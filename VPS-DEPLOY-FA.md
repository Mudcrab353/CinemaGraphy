# راهنمای ساده VPS برای سینماگرافی ۳.۲.۰

لایو Vercel دست نخورده می‌ماند. این راهنما فقط برای سرور جدا است.

## ۱) روی سرور

- Ubuntu 22+ با Node.js 24
- پوشه پروژه را آپلود کن (ZIP نسخه ۳.۲.۰)
- در همان پوشه:

```bash
npm install --omit=dev
cp .env.example .env
nano .env
```

حداقل این‌ها را پر کن:

```env
TMDB_API_KEY=...
F2MEDIA_BASEURL=...
# بقیه BASEURLها مثل قبل

ADMIN_PASSWORD=یک_رمز_قوی_فقط_برای_خودت
RATE_LIMIT_ENABLED=1
RATE_LIMIT_MAX=120
RATE_LIMIT_SEARCH_MAX=30
CACHE_BACKEND=memory
PORT=7000
```

## ۲) اجرا

ساده:

```bash
npm start
```

پایدارتر با PM2:

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## ۳) پنل مدیریت (فقط تو)

بعد از روشن شدن سرور:

```text
http://IP-SERVER:7000/admin
```

- بدون `ADMIN_PASSWORD` → صفحه ۴۰۴ (غیرفعال)
- با رمز درست → داشبورد پروایدر / کش / پاک‌کردن کش
- کوکی HttpOnly؛ بدون رمز هیچ‌کس وارد نمی‌شود

رمز را در چت و گیت نگذار.

## ۴) nginx (اختیاری ولی خوب)

Reverse proxy روی پورت ۸۰/۴۴۳ تا استریمیو با HTTPS کار کند. جزئیات استاندارد nginx + certbot کافی است؛ root به Node روی `127.0.0.1:7000` proxy شود.

## ۵) تست قبل از هزینه زیاد

1. لوکال یا VPS ارزان: `npm start`
2. `/health` → ok
3. `/admin` → ورود با رمز
4. `/providers.json` → پروایدرها
5. منیفست را در استریمیو نصب کن

اگر اوکی بود همان سرور را ارتقا بده.
