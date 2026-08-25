---
title: Nobody Cares How It Works
slug: nobody-cares-how-it-works
date: 2026-07-27
read_time: 6 min read
summary: A simple framework for explaining products
---

Every product can be explained through three questions:

1. What problem does it solve?
2. How does it solve that problem?
3. What does the user's life look like after?

I doubt this is a new framework. It is just the clearest way I have found to think about product communication.

Builders usually spend most of their time on the second question.

This makes sense. Once you pick a problem, most of the work goes into the solution: architecture, features, integrations, edge cases, and design decisions. When it is finally time to talk about the product, that is what is on your mind. So that is what you talk about.

The problem is that users do not care. Not at first. They want to know whether you understand a problem they actually have, and whether your product will make their life better. The mechanism becomes interesting only after they care about the problem and believe the outcome is worth having.

The sequence matters:

*Why should I care?*

*What changes for me?*

*Okay, now tell me how it works.*

Skip the first two and you are giving people answers before they have a reason to ask the question.

---

I understood this more clearly at an OpenAI Codex hackathon.

I almost did not go. The brief mentioned agentic coding, evals, observability, and security. I had little experience with most of it, and I was convinced everyone there would know more than me.

I went anyway.

The problem statement turned out to be open-ended. There were three tracks, six hours to build, and a two-minute pitch for solo participants.

For the first ninety minutes, I had no idea what to make. I walked around, talked to people, and watched what others were doing. Most people were in teams. I was alone.

Eventually I sat down and started from a problem I actually had.

Building software has become easy. I can spend a weekend on a project, deploy it, put it on GitHub, and call it shipped. Getting anyone to use it is still hard.

I have built a lot of side projects. Many of them work. Some are useful. Most have no users, no distribution, and no revenue. They exist on localhost, as a GitHub repo, or as a demo video that gets a few hundred views and disappears.

The standard advice is "build in public." Share what you are making. Talk about what you learned. Build an audience around your work.

In practice, this becomes another job. Every day you have to decide whether you did anything worth sharing, what the post should say, and how it should be framed. You do this for months while the early posts get eight impressions and zero likes.

Most developers do not want to become content strategists just to get someone to notice what they built.

So I made WorkPrint. It looks at the work you are already doing and finds moments worth sharing. Instead of opening a blank text box every day, you get suggested posts based on your actual progress.

I could explain how it reads GitHub commits and pull requests. That would miss the point.

The point is that a developer can go from building in silence to sharing their work consistently, without posting becoming another job.

That's the transformation. Everything else is implementation detail.

---

Solo participants got two minutes to pitch. Teams got three.

Two minutes is almost nothing. I watched some of the other pitches before mine. Most followed the same pattern: dense slides, long feature lists, and careful explanations of how things worked. The teams had spent the day building these systems and wanted to show what they had done. That is natural.

But many of the pitches were hard to care about. The audience was getting answers before it had a reason to ask the question.

I decided to spend most of my two minutes on the problem and the outcome.

I opened by talking about how building has gotten easier while getting users has not. People spend hours, months, sometimes years building things nobody uses. The only guaranteed outcome of shipping a side project is that you have increased Anthropic's revenue. Then I corrected myself and said OpenAI's revenue, since this was an OpenAI event.

The joke was scripted to sound spontaneous. Once a room laughs, people listen.

After that came the pain, a quick demo, and what changes after using the product. The demo took thirty seconds. If the product removes friction, understanding it should not require a five-minute tutorial.

The slides had forty-three words across eight slides. I did not want people reading while I was talking. I wanted them listening.

The tagline went through the same filter. Early suggestions described what the product did, such as "turns code activity into social posts" and "helps developers build in public." They were accurate, but still focused on the product.

The one I landed on was: *Your work should speak for itself. Now it can.*

It does not explain the technology. It barely explains the product. It speaks directly to the frustration of doing good work that nobody sees.

---

The presentation went well. People laughed, the judges liked the story, and several participants told me afterward it was one of the strongest pitches of the day. I came third, and was the only solo participant in the top five.

Several people said they remembered the presentation more vividly than the product itself. That is both a compliment and a warning. Good storytelling should make the product clearer. It should not distract people from what you built.

The experience made one thing obvious. My product was not the most technically complex thing in the room. I did not win people over by explaining everything under the hood.

I found a problem people recognised, built a simple solution around it, and explained it in the order the audience cared about.

Builders talk about the part they worked hardest on. Users care about the part that changes their life.

Good product communication closes that gap.
