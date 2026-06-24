---
title: Friday
slug: friday
summary: a fully local voice assistant for your mac
date: 2026-06-13
featured: true
order: 0
---

models keep getting smarter in labs. for most people, daily life barely changes. friday is my attempt to close that gap: an assistant that actually lives on your machine, sees what you see, and talks back.

press a hotkey (or say "hey friday") and ask about what's on your screen. friday captures the display, reads it through a local vision model, thinks with a local language model, and answers out loud. no cloud. no api keys. no subscription.

the core loop works today: speech-to-text → screen context → local inference → text-to-speech, in under a couple of seconds. it remembers you across sessions, manages its own model servers, and can take action through connectors (github, calendar, email, browser) when you ask it to.

i'm building friday because i want the thing on my desk to feel as capable as the models in the data center, without sending my screen or my life to someone else's server. consumer product, not research demo.

---

*v1–v3 shipped (jun 2026):* voice loop, memory, self-managed runtime, agent tools, wake word, browser agency (early). mac control and proactive briefings are next.

<br>

## tech stack

| Layer | Technology |
|---|---|
| *App* | Swift / SwiftUI (macOS menu bar) |
| *Brain* | Qwen3-8B Q4 via mlx-lm (`:8080`) |
| *Screen* | FastVLM-0.5B via mlx-vlm (`:8082`) + Vision OCR + accessibility tree |
| *Voice in* | Apple Speech (on-device) + Parakeet optional |
| *Voice out* | Kokoro TTS (`:8081`) |
| *Agents* | Tool-calling loop — GitHub, Notion, Gmail, Calendar, Playwright browser |
| *Privacy* | Runtime-local inference; connector auth optional via OAuth or Composio |
