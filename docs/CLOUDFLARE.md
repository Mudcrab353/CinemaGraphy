# Deploying to Cloudflare Workers

**Vercel** is often faster; **Cloudflare Workers** free tier usually allows more sustained personal use. Same CinemaGraphy codebase.

The Cloudflare entrypoint serves the complete Stremio addon and the image proxy from one Worker.

## Dashboard (no terminal)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Open **Compute** → **Workers & Pages**.
3. Create a Worker or connect the GitHub repo.
4. Worker → **Settings** → **Variables and Secrets** — use full variable names (e.g. `CATALOG_ANIME_MANIFEST_URL`). Mark `TMDB_API_KEY` as **Secret**.
5. External catalog manifests: build URLs on [101](https://config.101catalogs.xyz/) (prefer `meta/off`), [Anime catalogs](https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/configure), [IPTV Bridge](https://iptvbridge.vercel.app/configure), optional [Meteor](https://meteorfortheweebs.midnightignite.me/stremio/configure).
6. Manifest: `https://YOUR-NAME.workers.dev/manifest.json` — then open `/configure` and `/guide`.

See `.env.example` for the recommended live variable set.

---

## Local development

```sh
corepack enable
pnpm install
cp .dev.vars.example .dev.vars
pnpm worker:dev
```

Fill in `.dev.vars` with the provider configuration you use. Wrangler serves the addon at the URL shown in the terminal; append `/manifest.json` to install it in Stremio.

`.dev.vars` is ignored by Git. Do not commit API keys or provider credentials.

## Deploy (CLI)

```sh
pnpm wrangler login
pnpm worker:check
pnpm worker:deploy
```
