workprint is a private story inbox for builders. it reconstructs a timeline from real work artifacts, finds the moments worth sharing, asks the builder for the perspective only they can provide, and produces one evidence-grounded story.

i built the demo-ready MVP for the OpenAI Build Week Community Hackathon in Hyderabad.

the interface begins with detected moments, not a blank prompt. add a Git log, Codex export, work notes, and optional screenshots. workprint reconstructs the chronology, finds exactly three narrative moments, and explains why each one matters. the builder chooses one, answers two specific questions, and gets one editable build-in-public story.

material claims remain connected to the commit, session excerpt, screenshot, or note that supports them. the model can infer that an event is interesting, but it cannot invent what the builder felt or learned.

## product loop

1. add real work artifacts
2. reconstruct the timeline
3. find three moments worth sharing
4. choose one and add the human perspective
5. write one editable story
6. inspect the evidence behind every material claim

## model and architecture

workprint uses the OpenAI Responses API with GPT-5.6, structured outputs, explicit reasoning effort, and optional low-detail image inputs. all product state stays in the browser for the MVP. there is no database, account system, background collector, or autonomous publishing.

[view the repository](https://github.com/orcus108/openai-buildweek-hyd-workprint)
