CF stream stability 3.0.0

Changes in cloudflare/worker.js:
1) In-memory stream cache 90s (same isolate, like Vercel 45s+)
2) Cloudflare Cache API for stream JSON 90s — second open is fast
3) Series provider budget 20s (was 12s; Vercel uses 22s)
4) Movie provider budget 12s (was 9s)

Deploy:
  replace cloudflare/worker.js
  npx wrangler deploy

Optional env: PROVIDER_TIMEOUT_MS=22000

Vercel does not need this file; keep using Express app.js there.
