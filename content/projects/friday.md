---
title: Friday
slug: friday
summary: a fully local voice assistant for your Mac
date: 2026-06-13
featured: true
order: 0
---

Models keep getting smarter in labs. For most people, daily life barely changes. Friday is my attempt to close that gap: an assistant that lives on your Mac, sees what you see, and talks back.

Press a hotkey, or say "Hey Friday", and ask about what is on your screen. Friday captures the display, reads it with a local vision model, thinks with a local language model, and answers out loud. No cloud. No API keys. No subscription.

The core loop works today: speech-to-text, screen context, local inference, and text-to-speech in under a couple of seconds. Friday remembers you across sessions, manages its own model servers, and can take action through GitHub, Calendar, Gmail, Notion, and a browser when you ask it to.

I'm building Friday because I want the thing on my desk to feel as capable as the models in the data centre without sending my screen or my life to someone else's server. It is a consumer product, not a research demo.

---

*V1-V3 shipped (June 2026):* voice loop, memory, self-managed runtime, agent tools, wake word, and early browser control. Mac control and proactive briefings are next.

<br>

## tech stack

| Layer | Technology |
|---|---|
| *App* | Swift / SwiftUI (macOS menu bar) |
| *Brain* | Qwen3-8B Q4 via mlx-lm (`:8080`) |
| *Screen* | FastVLM-0.5B via mlx-vlm (`:8082`) + Vision OCR + accessibility tree |
| *Voice in* | Apple Speech (on-device) + Parakeet optional |
| *Voice out* | Kokoro TTS (`:8081`) |
| *Agents* | Tool-calling loop: GitHub, Notion, Gmail, Calendar, Playwright browser |
| *Privacy* | Runtime-local inference; connector auth optional via OAuth or Composio |
