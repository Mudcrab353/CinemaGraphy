# CinemaGraphy 2.1.74 — Deploy

## Vercel
1. Upload / connect this repo
2. Env: TMDB_API_KEY, ENABLE_F2_TURKISH=1, F2MEDIA_BASEURL, catalog URLs, …
3. Root: app.js (Express)

## Cloudflare Worker
1. `npx wrangler deploy` (main = cloudflare_worker.js)
2. Secrets: `wrangler secret put TMDB_API_KEY`
3. Vars: ENABLE_F2_TURKISH=1, F2MEDIA_BASEURL=https://www.film2med.top
4. Note: Worker tracks core routes + Turkish catalog; full configure UI is on Express/Vercel landing.

## VPS / Local
```bash
npm i
node app.js
# or: npx vercel dev
```

Includes: F2Media film2med fixes, Turkish catalog (TMDB display + F2 streams),
Namakade (Express), TMDB image proxy (Express), catalog order, dual FA/EN.
