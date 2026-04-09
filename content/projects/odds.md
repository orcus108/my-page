---
title: Odds
slug: odds
summary: polymarket for IIT Madras
date: 2026-03-24
status: In progress
featured: true
order: 2
repo: https://github.com/orcus108/odds
demo: https://playodds.vercel.app/
---

polymarket but for iit madras students. students can start their own markets. <br>
learned about backend (supabase) and authorisation (oAuth) <br>
couldnt publicise because prediction markets are a gray area in india :/

## tech stack
| Layer              | Technology                                                                 |
|--------------------|----------------------------------------------------------------------------|
| **Framework**      | Next.js 16.2.1 (App Router, Server Components, Server Actions)            |
| **Backend / DB**   | Supabase — Postgres, Auth (Google OAuth), Row Level Security              |
| **Styling**        | Tailwind CSS v4                                                           |
| **Deployment**     | Vercel (with Vercel Analytics)                                            |
| **Rendering**      | ISR — Home: revalidate every 60s; Market Detail: every 30s                |