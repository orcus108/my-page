---
title: image cartoonification 
slug: cartoonification
summary: pix2pix conditional GAN implementation
date: 2025-02-18
status: Completed
repo: https://github.com/AnshumanMishra21345/Pix2Pix-Implementation
---
as a freshman, my first research-paper implementation (as part of the AI Club of IIT Madras) was **Pix2Pix**, a conditional GAN for image-to-image translation. 

we read the paper [*Image-to-Image Translation with Conditional Adversarial Networks*](https://arxiv.org/abs/1611.07004) by Isola *et al.* and built and trained the full pipeline from scratch (a U-Net generator paired with a PatchGAN discriminator) reproducing the core results from the original work. 

we then extended the model into a practical demo that converts real images into cartoon-style outputs through an interactive application.

**learned:** how to read and implement a research paper, PyTorch, Kaggle, streamlit (for app interface), and that nervous feeling when you watch your model train/learn :)

---

some screenshots from training (on Kaggle P100 GPU)
<br>
![training progress](images/pix2pix-training.png)