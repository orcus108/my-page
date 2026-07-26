---
title: Nobody Cares How It Works
slug: nobody-cares-how-it-works
date: 2026-07-27
read_time: 6 min read
summary: A simple framework for explaining products
---

There's a simple framework for communicating a product. Three questions:

1. What problem does it solve?
2. How does it solve that problem?
3. What does the user's life look like after?

This is probably not a new framework. It is likely some combination of things I have read and heard over the years. But it is the clearest way I have found to think about product communication.

Builders spend most of their time on the second question.

This makes sense. Once you've picked a problem, most of the actual work goes into the solution: weeks of thinking about architecture, features, integrations, edge cases, clever design decisions. When it's finally time to talk about the product, that's what's on your mind. So that's what you talk about.

The problem is users don't care. Not initially. What they care about is whether you understand a problem they actually have, and whether your product will make their life meaningfully better. The mechanism only becomes interesting after you've made them care about the problem and convinced them the outcome is valuable.

The sequence matters:

*Why should I care?*

*What changes for me?*

*Okay, now tell me how it works.*

Skip the first two and you're giving people answers before they have a reason to ask the question.

---

I understood this more clearly at an OpenAI Codex hackathon I attended recently.

I almost didn't go. The brief mentioned agentic coding, evals, observability, security, most of which I had no experience in and didn't find particularly interesting. I was convinced I'd get there, realize everyone knew more than me, and embarrass myself.

I went anyway.

The problem statement turned out to be completely open-ended. Three tracks: security, observability, virality. Six hours to build, then a two-or-three-minute pitch.

For the first ninety minutes, I had no idea what to make. I walked around, talked to people, watched what others were doing. Most people were working in teams. I was alone.

Eventually I sat down and started from a problem I actually had.

Building software has become easy. I can spend a weekend on a project, deploy it, put it on GitHub and call it shipped. Getting anyone to use it is still brutally hard.

I've built a lot of side projects. Many of them work. Some are actually useful. But most have no users, no distribution, no revenue. They just exist, on localhost, or as a GitHub repo, or as a demo video that gets a few hundred views and disappears.

The standard advice for this is "build in public." Share what you're making. Talk about what you learned. Slowly build an audience around your work.

In practice, this becomes another job. Every day you have to figure out whether you did anything worth sharing. Then what the post should be about. Then the hook, the framing, the tone, the call to action. And you have to do this for months while your early posts get eight impressions and zero likes.

Most developers don't want to become content strategists just to get someone to notice what they built.

So I made something called WorkPrint. The idea was simple: it looks at the work you're already doing and finds the moments worth sharing. Instead of a blank text box every day, you get suggested posts based on your actual progress.

I could spend time explaining how it reads GitHub commits and pull requests. But that would miss the point entirely.

The important thing isn't how WorkPrint processes your activity. The important thing is that a developer can go from building in silence to sharing their work consistently, without posting becoming another job.

That's the transformation. Everything else is implementation detail.

---

Solo participants got two minutes to pitch. Teams got three.

Two minutes is almost nothing. I watched some of the other pitches before mine. Most followed the same pattern: dense slides, long feature lists, careful explanations of how things worked. The teams had spent the day building these systems and wanted to show what they'd done. That's completely natural.

But the result was that a lot of pitches were hard to care about. The audience was being given answers before they had a reason to ask the question.

I decided to spend most of my two minutes on the problem and the outcome.

I opened by talking about how building has gotten easier but getting users hasn't. That people spend hours, months, sometimes years building things nobody uses. And that the only guaranteed outcome of shipping a side project is that you've increased Anthropic's revenue. Then I corrected myself and said OpenAI's revenue, since this was an OpenAI event.

The joke was scripted to look spontaneous. Once a room laughs, people are listening.

After that: the pain, a quick demo, what changes after using the product. The demo took thirty seconds. If the whole point of the product is removing friction, it can't require a five-minute tutorial to understand.

The slides had forty-three words total across eight slides. I didn't want people reading while I was talking. I wanted them listening.

The tagline went through the same filter. Early suggestions described what the product did, things like "turns code activity into social posts" or "helps developers build in public." Accurate, but still product-focused.

The one I landed on was: *Your work should speak for itself. Now it can.*

It doesn't explain the technology. It barely explains the product. It just speaks directly to the frustration of doing good work that nobody sees.

---

The presentation went well. People laughed, the judges liked the story, and several participants told me afterward it was one of the strongest pitches of the day. I came third, the only solo participant in the top five.

A few people said they remembered the presentation more vividly than the product itself, which is both a compliment and a warning. Good storytelling should make the product clearer. It shouldn't become a magic trick that distracts people from what you built.

But here's what the experience made obvious: my product was not the most technically complex thing in the room. I didn't win people over by explaining everything that happened under the hood.

I found a problem people immediately recognized, built a simple solution around it, and communicated it in the order the audience cared about.

Builders talk about the part they worked hardest on. Users care about the part that changes their life.

Good product communication is mostly about closing that gap.
