# local preview

how to run the content dashboard and preview the site on your machine.

## start

from the repo root:

```bash
npm run dashboard
```

then open:

| what | url |
|---|---|
| content studio (edit posts, save, rebuild) | http://localhost:4321 |
| site (same as production layout) | http://localhost:4321/site/index.html |

the dashboard writes to `content/` and `images/cards/`, rebuilds `site/` on save, and serves those files locally. no separate dev server.

## if the port is already in use

another dashboard process may still be running:

```bash
kill $(lsof -ti:4321)
npm run dashboard
```

## rebuild without the dashboard

if you only edited markdown or `scripts/site.mjs` by hand:

```bash
npm run build
```

then open `site/index.html` in a browser, or start the dashboard and use the preview url above.

## stop

in the terminal where `npm run dashboard` is running, press `Ctrl+C`.

## deploy

production is `site/` on Vercel (`vercel.json`). commit, push, and Vercel runs `npm run build` on deploy. `legacy-site/` is a static snapshot of the older deployed site if you need to roll back.
