---
title: Clippy
slug: clippy
summary: a privacy-first clipboard manager for macOS
date: 2026-04-24
status: In Progress
featured: true
order: 1
---

macOS Tahoe ships clipboard history, but the shortcut is two steps. one too many. Clippy collapses it to one: hit Cmd+Shift+V from any app, a floating panel appears, pick a clip, paste. that's it.

it's privacy-first. nothing leaves your machine, no network calls, no telemetry, no accounts. sensitive stuff like API keys, tokens, and passwords is automatically detected and never saved. password managers are excluded by default.

still building it out, but the core works.

## tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | Swift | Native macOS |
| UI | SwiftUI + AppKit | SwiftUI for list/search; AppKit required for floating panel |
| Persistence | GRDB (SQLite) | In-memory DB for unit tests |
| Global shortcut | KeyboardShortcuts (Sindre Sorhus) via SPM | Best-in-class |
| Paste injection | CGEvent via CoreGraphics | Only viable approach; requires sandbox off |
| Threading | DispatchSourceTimer on background queue | 0.5s polling, avoids RunLoop jitter |
| Tests | XCTest with in-memory GRDB | 4 trim() tests passing |
