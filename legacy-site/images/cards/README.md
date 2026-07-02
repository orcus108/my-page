# card images

drop a card image here named after the project/blog **slug** and it shows up
on that item's card in the hero/home page automatically. no code changes needed.

examples:
  images/cards/clippy.png          -> Clippy project card
  images/cards/ai-in-healthcare.png -> "ai in healthcare" blog card

supported: .png .jpg .jpeg .webp  (cards are shown 4:3, so ~1200x900 looks best)

priority order if multiple exist:
  1. frontmatter `image: <path>` in the .md file (custom path override)
  2. images/cards/<slug>.<ext>   <- the easy default, just drop the file
  3. first image used in the post/project body
  4. a generated gradient (if none of the above exist)
