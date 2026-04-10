---
title: Sakhi
slug: sakhi
summary: ai for india’s frontline health workers
date: 2026-04-7
status: In progress
featured: true
order: 1
repo: https://github.com/orcus108/sakhi
demo: https://sakhi-asha.vercel.app
---

across India, ASHA workers are the backbone of community healthcare. they support families through pregnancy, childhood illnesses, chronic conditions, immunizations, and public health outreach. for many villages, she is the first — and sometimes only — link to the healthcare system.

yet her work is burdened by paper registers, complex protocols, manual newborn visit scheduling, and opaque incentive (salary) claim processes. she tracks households across multiple notebooks, memorizes evolving guidelines, and escalates doubts to seniors when immediate clarity isn’t available. the administrative load is heavy, especially in low-connectivity settings.

**sakhi** (hindi for "female friend") is a multilingual, voice-first, offline AI companion built to support ASHA workers in the field. it digitizes registers through guided voice interaction, automates visit scheduling, provides real-time protocol guidance, and tracks incentive claims transparently. powered by MedGemma’s medical text capabilities, sakhi can offer grounded general medical guidance when needed. using multimodal understanding, it can also analyze images, such as visible symptoms or medical documents, and generate preliminary structured insights to assist frontline decision-making.

sakhi isn't here to replace ASHA workers, it's here to assist her in doing what she does best.

---

i started building this for [The MedGemma Impact Challenge](https://www.kaggle.com/competitions/med-gemma-impact-challenge). 

*12-2-2026*

this project is a work in progress. currently I've built the first minimum viable product (mvp). this includes the website and app for both android and iOS with some basic functionalities.

a screenshot of the first version of sakhi:
![a screenshot of sakhi v1](images/sakhi-v1.png)

---

*27-3-2026*

here's the updated product ([live demo](https://sakhi-asha.vercel.app) also available) — a major improvement from that first version i showed on top. check out the repo for more details.

![sakhi-top-row](images/sakhi-top-row.png)

![sakhi-middle-row](images/sakhi-middle-row.png)

![sakhi-bottom-row](images/sakhi-bottom-row.png)

<br>

## tech stack

| Layer            | Technology                                                                 |
|------------------|----------------------------------------------------------------------------|
| *Frontend*     | React + Vite + Tailwind CSS                                                |
| *Mobile*       | Capacitor (Android APK / Play Store)                                       |
| *Backend*      | FastAPI (Python)                                                           |
| *AI Inference* | Ollama (GGUF / llama.cpp) on Hugging Face Spaces                           |
| *Vector DB*    | ChromaDB                                                                   |
| *Embeddings*   | sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2)              |
| *i18n*         | i18next (English + Hindi)                                                  |
| *State Mgmt*   | React Context + localStorage                                               |
| *Deployment*   | Vercel (Frontend) + Hugging Face Spaces (Backend + Model)                  |

<br> 

## hacks

i had a strict zero budget so had to get real creative with a lot of things. 

the model hosting for example, i set it up on a huggingface space but the free one goes offline if it stays inactive for 10 minutes so i set up a bot that pings the space every 5 minutes, that way the space is always active and hence model always responds. 

also maxed out on three kaggle accounts' gpus.

---

## what next

they three key features i wanted to keep were: <br>
1. offline (since villages won't have good internet connectivity) <br>
2. voice first (since ASHA's will find speaking easier than typing) <br>
3. multi-lingual (to have real large scale impact, it'll have to be able to speak a lot of languages)

i've achieved all of them to a reasonable extent but i can still make a lot more improvements, which is what i'm doing right now.

also, major update: google released the new Gemma 4 models which has a 2B variant that is natively multi-modal (text, image and audio), can think, runs locally on edge devices and multi-lingual (over 140 languages according to them) which seems like a perfect fit for sakhi.
i'm currently running medical benchmarks specific to maternal and newborns to check its capabilities, after which i'll fine tune and do some RL optmization (DPO) followed by quantization.
google has also revamped LiteRT-LM which is like a super fast and efficient inference engine for language models on phone. plan to incorporate this too.
but for all this i'll have to first convert the codebase from react to kotlin and properly set up the database etc. working on that right now.

i've also reached out to a bunch of NGO's and govt orgs who deal with ASHA workers to get a first hand account of what problems they face. enough building in isolation from those whose problems i'm trying to solve.

exciting times ahead.