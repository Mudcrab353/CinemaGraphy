<div align="center">
  <h1>CinemaGraphy · سینماگرافی</h1>
  <p>Stremio / Nuvio addon — Iranian HTML providers, FA meta, optional torrent &amp; IPTV</p>
  <p>
    <img src="https://img.shields.io/badge/version-3.2.7-e8a04a.svg" alt="version" />
    <img src="https://img.shields.io/badge/node-24.x-339933.svg" alt="node" />
    <img src="https://img.shields.io/badge/vercel-ready-000.svg" alt="Vercel" />
    <img src="https://img.shields.io/badge/cloudflare-worker-f38020.svg" alt="Cloudflare" />
    <img src="https://img.shields.io/badge/Nuvio-compatible-7eb6ff.svg" alt="Nuvio" />
    <img src="https://img.shields.io/badge/FA%20%7C%20EN-supported-5dcea0.svg" alt="FA EN" />
  </p>
</div>

---

## Quick install

```text
https://YOUR-DOMAIN/manifest.json
```

| Path | Role |
|------|------|
| `/` | Landing |
| `/configure` | Personal install builder |
| `/guide` | Full guide (FA/EN) |
| `/health` | Health |
| `/providers.json` | Provider status |
| `/admin` | Admin panel (`ADMIN_PASSWORD`) |

In-app help: open **راهنما / Guide** on the landing page.

---

## Features (3.2.x)

- Parallel Iranian providers + TMDB image proxy + Persian meta  
- Catalogs: Turkish (F2), **Animex**, external anime, IPTV (independent), optional Namakade  
- **DigiMovie / AvaMovie** — VIP only via personal `/configure` (session **cookie** preferred)  
- Configure UI FA/EN · modular `lib/` · cache · rate limit · admin (Node/VPS)  
- Deploy: **Vercel** or **Cloudflare Workers**

### Env (short)

```env
TMDB_API_KEY=
F2MEDIA_BASEURL=https://www.film2med.top
ANIMEX_BASEURL=https://animex.click
ENABLE_F2_TURKISH=1
ENABLE_ANIMEX_CATALOG=1
# VIP (prefer cookie; personal installs only)
# DIGIMOVIE_BASEURL=https://www.digimoviez.com
# DIGIMOVIE_COOKIE=
# AVAMOVIE_BASEURL=https://avamovie.shop
# AVAMOVIE_COOKIE=
ADMIN_PASSWORD=
PORT=7000
```

Full list: `.env.example` and `/guide#env`.

---

## Local

```bash
pnpm install   # or: npm install --omit=dev
cp .env.example .env
pnpm start     # or: npm start
```

---

## Cloudflare

**Dashboard:** Compute → Workers & Pages → deploy → **Settings → Variables and Secrets**  
Use **Secret** for API keys and cookies so they survive code updates.

**CLI:** see `docs/CLOUDFLARE.md` (`wrangler login` → `.dev.vars` → `wrangler deploy`).

Worker entry: `cloudflare/worker.js` (keep version in sync with `app.js`).

---

## Vercel

Import repo → Environment Variables → Deploy.  
If the project is paused, use the Cloudflare worker as backup.

---

## Docs

| File | Content |
|------|---------|
| `/guide` | Install, CF, Vercel, env table, VIP cookie |
| `docs/CLOUDFLARE.md` | Wrangler details |
| `docs/ADDING-A-PROVIDER.md` | New provider checklist |
| `.env.example` | All variables |

Support: [t.me/nerdcow](https://t.me/nerdcow) · [channel](https://t.me/cinemmagraphy)

---

## License

ISC
