Project: Odds
What it is
A play-money prediction market platform exclusively for IIT Madras students. Users bet "OC" (play currency) on the outcome of campus-relevant events — academic results, sports, insti life, etc.

Live demo: playodds.vercel.app

Access
Restricted to @smail.iitm.ac.in Google OAuth accounts only. New users get 10,000 OC on signup.

Market types

Binary — Yes/No markets (e.g. "Will X happen?")
Multi-choice — multiple options, each with its own pool (e.g. "Who will win?"), with per-option color coding
Market categories

Standard: Acads, Insti Life, Sports — shown as individual cards on the home page
Special (any other category) — shown as a collection link
Trading mechanics

Shares are 1:1 with OC spent (no AMM/LMSR — simple parimutuel)
Payout formula: (user's amount in winning pool / total winning pool) × total pool
Markets have a close date; trades are blocked after it
All trades and resolutions are atomic Postgres transactions (RPC functions)
Resolution

Admins resolve markets by picking the winning outcome
On resolution, payouts are calculated and distributed automatically via resolve_market / resolve_multi_market RPC functions
Admin access enforced entirely by RLS (not app code)
Tech stack

Next.js 16.2.1 (App Router, Server Components, Server Actions)
Supabase — Postgres, Auth (Google OAuth), Row Level Security
Tailwind CSS v4
Vercel (deployed), with Vercel Analytics
ISR: home page revalidates every 60s, market detail every 30s
Pages
Home, Market detail (with trade panel + recent trades), Leaderboard, Profile (trade history + payouts), Admin dashboard (create/manage/resolve markets), Login, Onboarding

Key engineering decisions

Middleware renamed to proxy.ts (Next.js 16 breaking change) — handles auth redirects, onboarding flow, admin gating
All mutations go through Server Actions → Supabase RPC (no raw SQL in components)
Security: CSP headers, input validation, auth checks in server actions
Repo activity (rough timeline)

Initial app built in one shot (auth, markets, trading, leaderboard, admin, Supabase integration)
Security hardening pass
Multi-choice markets added
Mobile UX improvements
Polish: per-option colors, markdown resolution criteria, sorting, back navigation