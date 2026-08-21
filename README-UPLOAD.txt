CinemaGraphy 3.0.0 — CF catalog order + mobile landing

1) Copy cloudflare/worker.js over repo cloudflare/worker.js
2) Copy landing.js over repo landing.js  
3) Commit + push to master
4) Cloudflare: npx wrangler deploy
5) Vercel auto-deploys from master

CF fix: external catalogs now use same order as Vercel (داغ first → ماهواره last)
+ soft 6.5s timeout on FA enrich so Worker does not hang on 101 catalogs
