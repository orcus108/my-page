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
| preview site (same as production layout) | http://localhost:4321/preview-c/index.html |

the dashboard writes to `content/` and `images/cards/`, rebuilds `preview-c/` on save, and serves those files locally. no separate dev server.

## if the port is already in use

another dashboard process may still be running:

```bash
kill $(lsof -ti:4321)
npm run dashboard
```

## rebuild without the dashboard

if you only edited markdown or `scripts/preview-c.mjs` by hand:

```bash
npm run build
```

then open `preview-c/index.html` in a browser, or start the dashboard and use the preview url above.

## stop

in the terminal where `npm run dashboard` is running, press `Ctrl+C`.

## deploy

production is `preview-c/` on Vercel (`vercel.json`). commit, push, and Vercel runs `npm run build` on deploy.
