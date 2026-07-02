# legacy site snapshot

this folder preserves the older deployed static site so the deployment can be rolled back without rebuilding the new `site/` design.

to roll back on Vercel, point `outputDirectory` at `legacy-site` and deploy that change.
