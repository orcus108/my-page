---
title: llm from scratch
slug: llm-from-scratch
summary: building an llm from scratch
date: 2026-02-03
status: In progress
repo: https://github.com/orcus108/llm-from-scratch
---
building every single component of an LLM from scratch using PyTorch.

the goal is to understand how llms actually work from first principles.

---

covered so far:
<br> <br>
**1. data & tokenization pipeline**
- text cleaning and normalization  
- tokenization pipeline for autoregressive training  
- dataset integration using hugging face corpora  

**2. positional encoding strategies**
- learned (linear) positional embeddings  
- rotary positional embeddings (rope)  

**3. attention mechanisms**
- scaled dot-product attention  
- multi-head attention  
- advanced attention variants:  
  - grouped query attention (gqa)  
  - multi-head latent attention (mla)  
  - sliding window attention (swa)  

**4. transformer architecture design**
- complete transformer block implementation  
  - layer normalization  
  - mlp / feed-forward networks  
  - residual connections  

**5. scaling & efficiency techniques**
- mixture-of-experts (moe) routing  
- kv caching for optimized inference  

**6. training & adaptation**
- autoregressive pretraining on large-scale corpora  
- classification fine-tuning  
- supervised instruction fine-tuning  
