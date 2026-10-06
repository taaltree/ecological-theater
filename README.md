# The Ecological Theater

An animated, narrated review of core ecological theory for graduate comprehensive exams in ecology and wildlife science (42:09, 128 numbered lexicon terms).

**Watch:** https://taaltree.github.io/ecological-theater/
**Download the video:** [Releases](https://github.com/taaltree/ecological-theater/releases/latest)
**Study guide:** [HTML](https://taaltree.github.io/ecological-theater/The_Ecological_Theater_Study_Guide.html) · [PDF](https://taaltree.github.io/ecological-theater/The_Ecological_Theater_Study_Guide.pdf)

| | Chapter | Starts | Scenes |
|---|---|---|---|
| I | [Population Dynamics](https://taaltree.github.io/ecological-theater/#ch1) | 0:44 | Exponential & geometric growth · Logistic growth & density dependence · Time lags, cycles & chaos · Life tables & matrix models · Stochasticity, viability & life history |
| II | [Niche Theory](https://taaltree.github.io/ecological-theater/#ch2) | 7:04 | Three ideas of the niche · Fundamental & realized niches · Partitioning & limiting similarity · The modern niche |
| III | [Competition](https://taaltree.github.io/ecological-theater/#ch3) | 12:01 | Kinds of competition · Lotka–Volterra competition · Resource competition & R* · Modern coexistence theory |
| IV | [Predation](https://taaltree.github.io/ecological-theater/#ch4) | 18:10 | Predator–prey cycles · Functional & numerical responses · Optimal foraging · Enrichment & stability · Keystones, cascades & fear |
| V | [Island Biogeography](https://taaltree.github.io/ecological-theater/#ch5) | 24:25 | The species–area relationship · The equilibrium theory · Experiments & refinements · Habitat islands & conservation |
| VI | [Metapopulations](https://taaltree.github.io/ecological-theater/#ch6) | 28:57 | The Levins model · Habitat loss & the extinction threshold · Kinds of spatial populations · Spatially realistic metapopulations |
| VII | [Metacommunities](https://taaltree.github.io/ecological-theater/#ch7) | 33:00 | Scale & diversity · Four paradigms · Dispersal & diagnosis |
| VIII | [Neutral Theory](https://taaltree.github.io/ecological-theater/#ch8) | 36:22 | Ecological equivalence · θ, m & abundance distributions · Tests & legacy |
| IX | [Synthesis](https://taaltree.github.io/ecological-theater/#ch9) | 40:01 | Four high-level processes · Exam rehearsal |

## What is here

- `index.html`: the interactive player (chapters, captions, playback speed, searchable lexicon). Keyboard: space to play, ←/→ to skip 5 s, [ and ] to change chapter, c for captions.
- `soundtrack.m4a`: narration (synthesized voice) mixed with a generated ambient score.
- `The_Ecological_Theater_Study_Guide.*`: equations, landmark studies, lexicon with timestamps, exam prompts, references.
- `The_Ecological_Theater_captions.*`: WebVTT and SRT captions.
- `source/`: the deterministic canvas engine, chapter scripts, and build tools.

## Rebuilding

Requires macOS (`say` for narration), Node 22+, ffmpeg, and Google Chrome.

```bash
cd source
node tools/build_audio.mjs --voice Samantha --rate 165   # narration + timing + captions
node tools/build_music.mjs                               # score mixed under narration
node tools/stills.mjs <scene-id>                         # preview frames of any scene
node tools/render_video.mjs                              # 1080p MP4 (add --captions for burned-in captions)
node tools/assemble.mjs && node tools/build_site.mjs     # player, study guide, this site
```

Figures marked "stylized" or "illustrative" show qualitative patterns, not reproduced data.
