# The Ecological Theater

An animated, narrated review of core ecological theory for graduate comprehensive exams in ecology and wildlife science (42:15, 128 numbered lexicon terms).

**Watch:** https://taaltree.github.io/ecological-theater/
**Download the video:** [Releases](https://github.com/taaltree/ecological-theater/releases/latest)
**Study guide:** [HTML](https://taaltree.github.io/ecological-theater/The_Ecological_Theater_Study_Guide.html) · [PDF](https://taaltree.github.io/ecological-theater/The_Ecological_Theater_Study_Guide.pdf)

| | Chapter | Starts | Scenes |
|---|---|---|---|
| I | [Population Dynamics](https://taaltree.github.io/ecological-theater/#ch1) | 0:43 | Exponential & geometric growth · Logistic growth & density dependence · Time lags, cycles & chaos · Life tables & matrix models · Stochasticity, viability & life history |
| II | [Niche Theory](https://taaltree.github.io/ecological-theater/#ch2) | 7:10 | Three ideas of the niche · Fundamental & realized niches · Partitioning & limiting similarity · The modern niche |
| III | [Competition](https://taaltree.github.io/ecological-theater/#ch3) | 12:04 | Kinds of competition · Lotka–Volterra competition · Resource competition & R* · Modern coexistence theory |
| IV | [Predation](https://taaltree.github.io/ecological-theater/#ch4) | 18:13 | Predator–prey cycles · Functional & numerical responses · Optimal foraging · Enrichment & stability · Keystones, cascades & fear |
| V | [Island Biogeography](https://taaltree.github.io/ecological-theater/#ch5) | 24:23 | The species–area relationship · The equilibrium theory · Experiments & refinements · Habitat islands & conservation |
| VI | [Metapopulations](https://taaltree.github.io/ecological-theater/#ch6) | 29:01 | The Levins model · Habitat loss & the extinction threshold · Kinds of spatial populations · Spatially realistic metapopulations |
| VII | [Metacommunities](https://taaltree.github.io/ecological-theater/#ch7) | 33:06 | Scale & diversity · Four paradigms · Dispersal & diagnosis |
| VIII | [Neutral Theory](https://taaltree.github.io/ecological-theater/#ch8) | 36:26 | Ecological equivalence · θ, m & abundance distributions · Tests & legacy |
| IX | [Synthesis](https://taaltree.github.io/ecological-theater/#ch9) | 40:08 | Four high-level processes · Exam rehearsal |

## What is here

- `index.html`: the interactive player (chapters, captions, playback speed, searchable lexicon). Keyboard: space to play, ←/→ to skip 5 s, [ and ] to change chapter, c for captions.
- `soundtrack.m4a`: narration (synthesized voice) mixed with a generated ambient score.
- `The_Ecological_Theater_Study_Guide.*`: equations, landmark studies, lexicon with timestamps, exam prompts, references.
- `The_Ecological_Theater_captions.*`: WebVTT and SRT captions.
- `source/`: the deterministic canvas engine, chapter scripts, and build tools.

## Rebuilding

Requires Node 22+, ffmpeg, and Google Chrome. Narration comes from ElevenLabs (one take per scene); a free fallback uses macOS `say`.

```bash
cd source
node tools/el_script.mjs        # per-scene narration texts → build/el/requests.json; synthesize each, save as build/el/<scene>.mp3
node tools/build_audio_el.mjs   # align sentences, lay out timing, narration track + captions
# (fallback) node tools/build_audio.mjs --voice Samantha --rate 165
node tools/build_music.mjs                               # score mixed under narration
node tools/stills.mjs <scene-id>                         # preview frames of any scene
node tools/render_video.mjs                              # 1080p MP4 (add --captions for burned-in captions)
node tools/assemble.mjs && node tools/build_site.mjs     # player, study guide, this site
```

Figures marked "stylized" or "illustrative" show qualitative patterns, not reproduced data.
