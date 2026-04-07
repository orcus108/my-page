Project: Sakhi
Full name: Sakhi (सखी) — AI Clinical Companion for ASHA Workers

Context: Built for the Google MedGemma Impact Challenge on Kaggle (February 2026)

The Problem
India's maternal mortality ratio is 97 per 100,000 live births, concentrated in rural areas. ~1 million ASHA workers make life-critical referral decisions alone in the field without clinical support. They can take BP, check fetal heart rates, and observe newborns — but have no tool to tell them when a reading warrants emergency referral vs. routine follow-up.

What It Does
Mobile-first, offline-capable PWA (also Android APK via Capacitor) that gives ASHA workers AI-powered clinical decision support for:

ANC (Antenatal) visits — risk stratification from vitals (BP, weight, fundal height, Hb) + symptoms
Newborn visits — age-specific postnatal assessment (Day 1 through 6 weeks)
Ask Sakhi — free-form Q&A chat with optional patient context injection
Outputs a green / yellow / red risk level with: what Sakhi noticed, what to tell the patient, next action, and a follow-up date.

Languages: English and Hindi (Devanagari) — full UI and AI responses

The AI Stack
Primary model: Custom QLoRA fine-tuned MedGemma 1.5 4B IT, trained on ~6,800 maternal/neonatal examples filtered from two HuggingFace medical datasets. Fine-tuned to improve two specific gaps: (1) recognition of Indian clinical risk factors (severe anaemia, eclampsia patterns common in Rajasthan) and (2) JSON schema compliance for production reliability.

Fine-tuning pipeline (3 Kaggle notebooks):

QLoRA fine-tune → docvm/sakhi-medgemma-1.5-4b-maternal (LoRA adapter on HF Hub)
Merge LoRA into base weights (bfloat16) → convert to GGUF → Q4_K_M quantization → docvm/sakhi-medgemma-1.5-4b-maternal-GGUF (~2.5 GB)
Serve via Ollama on a Hugging Face Space
Training specs: LoRA rank 16, paged_adamw_8bit, cosine LR schedule, Kaggle 2×T4, ~4.2 hrs, 38.5M / 4.34B trainable params (0.89%), final loss 2.13

Evaluation: 75 labelled MOHFW/WHO-aligned maternal triage cases; primary safety metric is False Negative Rate for HIGH RISK (missing high-risk cases is the most dangerous failure mode)

Model cascade (auto-fallback): Fine-tuned MedGemma → Gemma 3n E4B IT (OpenRouter) → Gemini 2.5 Flash Lite → Llama 3.1 8B (Groq). Missing keys are skipped automatically, no config needed.

RAG: 10 WHO/MOHFW clinical guideline PDFs indexed into ChromaDB with paraphrase-multilingual-MiniLM-L12-v2 embeddings. Top-3 relevant chunks injected into every assessment and chat prompt.

Offline-First Architecture
Critical design constraint: ASHA workers often have no signal.

App shell cached by Workbox service worker (vite-plugin-pwa) — opens with no connectivity
Patient data persists to localStorage, namespaced by ASHA ID
Offline triage — localAssessment.js implements MOHFW rule-based triage locally (BP ≥ 140/90 → red, Hb < 7 → red, weight < 1.5kg → red, etc.), returns identical response shape as the AI endpoint plus _offline: true
Sync queue — pending submissions queued in localStorage, auto-replayed on window.online. AI result replaces the local one in-place.
Tech Stack
Layer	Tech
Frontend	React + Vite + Tailwind CSS
Mobile	Capacitor (Android APK / Play Store)
Backend	FastAPI (Python)
AI inference	Ollama (GGUF/llama.cpp) on HF Spaces
Vector DB	ChromaDB
Embeddings	sentence-transformers paraphrase-multilingual-MiniLM-L12-v2
i18n	i18next (en + hi)
State	React Context + localStorage
Deployment	Vercel (frontend) + Hugging Face Spaces (backend + model)
Key Technical Decisions / Interesting Details
Model abstraction: backend/model.py is the only file that calls any AI model — clean separation enforced as a project rule
Offline parity: The local rule-based fallback returns the exact same JSON shape as the AI endpoint — no special-casing in the UI
Why MedGemma: Open-weight (patient data stays on your infrastructure), domain pre-trained, safety-aligned, edge-viable at 4B params on CPU. The Q4_K_M GGUF is ~2.5 GB and runs without GPU.
ABHA integration: OTP-based Ayushman Bharat Health Account verification proxied server-side (credentials never reach the frontend)
UptimeRobot heartbeat: HF Space cold-starts are slow, so /health is pinged every 5 min to keep it warm
Demo data: 45 synthetic MOHFW-aligned patients across 3 ASHA workers (3 villages). Follow-up dates are computed dynamically relative to today so the schedule always looks realistic.
Temperature 0.2 across all providers — low variance for clinical consistency

Links
Live demo: https://sakhi-asha.vercel.app
Backend API: https://docvm-sakhi-api.hf.space/health
Fine-tuned model: https://huggingface.co/docvm/sakhi-medgemma-1.5-4b-maternal-GGUF
LoRA adapter: https://huggingface.co/docvm/sakhi-medgemma-1.5-4b-maternal
Write up: https://www.kaggle.com/competitions/med-gemma-impact-challenge/writeups/new-writeup-1771944147349
YouTube video: https://www.youtube.com/watch?v=2yPCEbAqwoI&t=1s

Screens (8 total)
Onboarding → Home (patient list with risk strips) → Patient/Newborn Profile → New Checkup Picker → Checkup Form (ANC vitals + symptoms, 2-step) / Newborn Form → Assessment (AI output) → Ask Sakhi (chat) → Schedule (follow-up calendar)