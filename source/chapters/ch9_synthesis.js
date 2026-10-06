/* Chapter IX — Synthesis. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.ink;

// Shared helpers -------------------------------------------------------------
const label = (g, s, x, y, a = 1, col = PAL.ink3, align = 'left') => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a, align });
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
// Time (scene-local s) at which `phrase` is spoken within beat k, interpolated by character position.
const CUES = new WeakMap();
function cue(S, k, phrase) {
  const sc = S.scene; let m = CUES.get(sc); if (!m) CUES.set(sc, (m = new Map()));
  const key = k + '|' + phrase; let v = m.get(key);
  if (v === undefined) {
    const B = sc.timing.beats[k]; v = B ? B.start : S.dur;
    if (B) for (const s of B.sents) { const i = s.cap.indexOf(phrase); if (i >= 0) { v = s.start + (s.end - s.start) * i / s.cap.length; break; } }
    m.set(key, v);
  }
  return v;
}
const chCol = (id) => { const c = Theater.chapters.find((x) => x.id === id); return (c && c.color) || PAL.ink2; };
// Process colours used throughout the chapter.
const PROC = [
  { nm: 'Selection', gen: 'natural selection', col: PAL.coral },
  { nm: 'Drift', gen: 'genetic drift', col: PAL.heather },
  { nm: 'Dispersal', gen: 'gene flow', col: PAL.lagoon },
  { nm: 'Speciation', gen: 'mutation', col: PAL.moss },
];

// Small animated emblems for each process, centred on (x, y), ~200 × 90 px.
function emblem(g, k, x, y, t, a, D) {
  if (a <= 0) return;
  const col = PROC[k].col;
  g.withAlpha(a, () => {
    if (k === 0) { // selection: deterministic replacement of the less fit species
      const ph = (t * 0.22) % 1, n = 40; const up = [], dn = [];
      for (let i = 0; i <= n; i++) { const u = i / n; const f = 1 / (1 + Math.exp(-(u - 0.45) * 9)); up.push([x - 95 + 190 * u, y + 36 - 72 * f]); dn.push([x - 95 + 190 * u, y - 36 + 72 * f]); }
      g.poly(up, { color: col, w: 3, progress: clamp(ph * 1.4) }); g.poly(dn, { color: PAL.ink3, w: 2.5, progress: clamp(ph * 1.4), dash: [5, 5] });
    } else if (k === 1) { // drift: random walks of relative abundance
      const ph = (t * 0.2) % 1;
      D.walks.forEach((w, i) => g.poly(w.map(([u, v]) => [x - 95 + 190 * u, y + 40 - 80 * v]), { color: i === 0 ? col : U.rgba(col, 0.55), w: i === 0 ? 2.6 : 1.6, progress: clamp(ph * 1.3) }));
    } else if (k === 2) { // dispersal: hops between two patches
      g.circle(x - 70, y + 10, 26, { stroke: PAL.ink3, w: 1.6 }); g.circle(x + 70, y + 10, 26, { stroke: PAL.ink3, w: 1.6 });
      g.poly(Array.from({ length: 21 }, (_, i) => { const u = i / 20; return [lerp(x - 44, x + 44, u), y + 4 - Math.sin(Math.PI * u) * 46]; }), { color: col, w: 1.6, dash: [3, 5], alpha: 0.7 });
      for (let q = 0; q < 3; q++) { const u = (t * 0.45 + q / 3) % 1; g.dot(lerp(x - 44, x + 44, u), y + 4 - Math.sin(Math.PI * u) * 46, 4.5, col, 1, 2.4); }
      for (let q = 0; q < 3; q++) { g.circle(x - 70 + Math.cos(q * 2.1 + t) * 11, y + 10 + Math.sin(q * 2.1 + t) * 11, 4, { fill: col, alpha: 0.85 }); g.circle(x + 70 + Math.cos(q * 2.1 - t) * 11, y + 10 + Math.sin(q * 2.1 - t) * 11, 4, { fill: col, alpha: 0.85 }); }
    } else { // speciation: a growing phylogeny
      const ph = (t * 0.2) % 1;
      const br = (x0, y0, len, ang, d, p0) => {
        const p = clamp((ph * 1.3 - p0) / 0.28); if (p <= 0) return;
        const x1 = x0 + Math.cos(ang) * len * p, y1 = y0 + Math.sin(ang) * len * p;
        g.line(x0, y0, x1, y1, { color: col, w: 3 - d * 0.6 });
        if (p >= 1 && d < 3) { br(x1, y1, len * 0.72, ang - 0.42, d + 1, p0 + 0.26); br(x1, y1, len * 0.72, ang + 0.42, d + 1, p0 + 0.26); }
        else if (p >= 1) g.dot(x1, y1, 3.5, col, 1, 2.2);
      };
      br(x - 92, y, 52, 0, 0, 0);
    }
  });
}

// Tiny answer sketches for the rehearsal cards, drawn in card-local coordinates
// inside the box (X0, Y0)–(X0 + 488, Y0 + 116); p = drawing progress.
function sketch(g, i, p, X0, Y0, t) {
  if (p <= 0) return;
  const ax = (x, y, w, h) => { g.line(x, y + h, x + w, y + h, { color: PAL.ink3, w: 2 }); g.line(x, y + h, x, y, { color: PAL.ink3, w: 2 }); };
  const fpts = (x, y, w, h, f, n = 40) => Array.from({ length: n + 1 }, (_, k) => { const u = k / n; return [x + u * w, y + h - f(u) * h]; });
  const y0 = Y0 + 6, H = 100;
  if (i === 0) { // Type II intake saturates; per-capita risk falls with prey density
    ax(X0 + 20, y0, 190, H); ax(X0 + 280, y0, 190, H);
    g.poly(fpts(X0 + 20, y0, 190, H, (u) => 0.95 * (6 * u) / (1 + 6 * u)), { color: PAL.coral, w: 3, progress: p });
    g.poly(fpts(X0 + 280, y0, 190, H, (u) => 0.95 / (1 + 6 * u)), { color: PAL.coral, w: 3, progress: clamp(p * 1.5 - 0.5) });
    g.math('f(N)', X0 + 30, y0 + 12, { size: 22, color: PAL.ink2, alpha: p });
    g.math('f(N)/N', X0 + 330, y0 + 18, { size: 22, color: PAL.ink2, alpha: clamp(p * 1.5 - 0.5) });
    g.math('N', X0 + 218, y0 + H + 6, { size: 20, color: PAL.ink3 }); g.math('N', X0 + 478, y0 + H + 6, { size: 20, color: PAL.ink3 });
  } else if (i === 1) { // R* drawdown
    ax(X0 + 20, y0, 450, H);
    g.line(X0 + 20, y0 + 40, X0 + 420, y0 + 40, { color: PAL.lagoon, w: 2, dash: [6, 6], alpha: p });
    g.line(X0 + 20, y0 + 78, X0 + 420, y0 + 78, { color: PAL.ochre, w: 2, dash: [6, 6], alpha: p });
    g.poly(fpts(X0 + 20, y0 + 12, 400, H - 12, (u) => 0.25 + 0.75 * Math.exp(-5 * u)), { color: PAL.ink, w: 3, progress: p });
    g.math('R^*_B', X0 + 432, y0 + 47, { size: 22, color: PAL.lagoon, alpha: p }); g.math('R^*_A', X0 + 432, y0 + 85, { size: 22, color: PAL.ochre, alpha: p });
    g.math('R', X0 + 8, y0 + 16, { size: 22, color: PAL.ink2, align: 'right', alpha: p }); g.text('A draws R below B’s needs', X0 + 150, y0 + 30, { size: 20, color: PAL.ochre, alpha: clamp(p * 2 - 1) });
  } else if (i === 2) { // extinction threshold while habitat remains
    ax(X0 + 20, y0, 230, H);
    const th = 0.7;
    g.rect(X0 + 20 + th * 230, y0, 230 * (1 - th), H, { fill: U.rgba(PAL.moss, 0.12), stroke: U.rgba(PAL.moss, 0.5), w: 1.2, dash: [4, 4], alpha: p });
    g.poly([[X0 + 20, y0 + H - th * H], [X0 + 20 + th * 230, y0 + H], [X0 + 250, y0 + H]], { color: PAL.ochre, w: 3, progress: p });
    g.math('p^*', X0 + 30, y0 + 14, { size: 22, color: PAL.ink2, alpha: p }); g.math('D', X0 + 258, y0 + H + 6, { size: 20, color: PAL.ink3 });
    g.math('p^* = 1 − D − e/c', X0 + 280, y0 + 42, { size: 26, color: PAL.ink, alpha: clamp(p * 2 - 0.6) });
    g.text('extinct with patches left', X0 + 280, y0 + 84, { size: 20, color: PAL.ochre, alpha: clamp(p * 2 - 1) });
  } else if (i === 3) { // Chesson's coexistence wedge
    ax(X0 + 20, y0, 230, H);
    const up = [], dn = []; for (let k = 0; k <= 30; k++) { const u = k / 30 * 0.92; const d = Math.log(1 / (1 - u)) * 20; up.push([X0 + 20 + u * 230 / 0.92, y0 + H / 2 - d]); dn.push([X0 + 20 + u * 230 / 0.92, y0 + H / 2 + d]); }
    const cl = (q) => q.map(([x, y]) => [x, clamp(y, y0, y0 + H)]);
    g.poly([...cl(up), ...cl(dn).reverse()], { fill: U.rgba(PAL.moss, 0.22), color: null, w: 0, alpha: p });
    g.poly(cl(up), { color: PAL.moss, w: 2.5, progress: p }); g.poly(cl(dn), { color: PAL.moss, w: 2.5, progress: p });
    g.text('coexistence', X0 + 200, y0 + H / 2 + 7, { size: 19, color: PAL.moss, align: 'center', alpha: clamp(p * 2 - 1) });
    g.math('1 − ρ', X0 + 250, y0 + H + 22, { size: 18, color: PAL.ink3, align: 'right' }); g.math('κ_1/κ_2', X0 + 28, y0 + 10, { size: 18, color: PAL.ink3 });
    g.text('stabilizing: wider wedge', X0 + 272, y0 + 34, { size: 20, color: PAL.ink2, alpha: clamp(p * 2 - 0.8) });
    g.text('equalizing: ratio → 1', X0 + 272, y0 + 72, { size: 20, color: PAL.ink2, alpha: clamp(p * 2 - 1) });
  } else if (i === 4) { // four paradigm icons
    const nm = ['patch dyn.', 'sorting', 'mass eff.', 'neutral'];
    for (let k = 0; k < 4; k++) {
      const a = clamp(p * 4 - k), cx = X0 + 60 + k * 122, cy = y0 + 40;
      g.withAlpha(a, () => {
        const pts = [[cx - 22, cy + 14], [cx + 22, cy + 14], [cx, cy - 20]];
        if (k === 2) pts.forEach(([x1, y1], j) => { const [x2, y2] = pts[(j + 1) % 3]; g.line(x1, y1, x2, y2, { color: PAL.lagoon, w: 5, alpha: 0.5 }); });
        else pts.forEach(([x1, y1], j) => { const [x2, y2] = pts[(j + 1) % 3]; g.line(x1, y1, x2, y2, { color: PAL.lagoon, w: 1.5, dash: [2, 4], alpha: 0.6 }); });
        const env = [PAL.lagoon, PAL.ochre, PAL.moss];
        pts.forEach(([x, y], j) => {
          g.circle(x, y, 13, { fill: k === 1 || k === 2 ? U.rgba(env[j], 0.25) : 'rgba(30,50,52,0.9)', stroke: k === 1 || k === 2 ? env[j] : PAL.ink3, w: 1.5 });
          const dots = k === 0 ? [j === 2 ? PAL.coral : PAL.ochre] : k === 1 ? [env[j], env[j]] : k === 2 ? [env[j], env[(j + 1) % 3]] : [env[(j + Math.floor(t * 0.7)) % 3], PAL.heather];
          dots.forEach((cc, q) => g.circle(x + (q - (dots.length - 1) / 2) * 8, y, 3.6, { fill: cc }));
        });
        g.text(nm[k], cx, y0 + 98, { size: 19, color: PAL.ink2, align: 'center' });
      });
    }
  } else { // fundamental biodiversity number
    g.math('θ = 2J_Mν', X0 + 20, y0 + 64, { size: 50, color: PAL.ink, alpha: p });
    g.math('J_M', X0 + 262, y0 + 38, { size: 22, color: PAL.ink2, alpha: clamp(p * 2 - 0.6) }); g.text('metacommunity size', X0 + 306, y0 + 38, { size: 20, color: PAL.ink2, alpha: clamp(p * 2 - 0.6) });
    g.math('ν', X0 + 266, y0 + 68, { size: 22, color: PAL.ink2, alpha: clamp(p * 2 - 0.8) }); g.text('speciation per birth', X0 + 306, y0 + 68, { size: 20, color: PAL.ink2, alpha: clamp(p * 2 - 0.8) });
    g.text('sets regional diversity', X0 + 262, y0 + 98, { size: 20, color: PAL.heather, alpha: clamp(p * 2 - 1) });
  }
}

Theater.chapter({
  id: 'syn', roman: 'IX', title: 'Synthesis', color: COL,
  question: 'How do the theories fit together?',
  intro: { t: 'Chapter nine. Synthesis: one framework for the whole toolkit.' },
  motif(g, t) {
    const p = ease.inOut((t - 0.5) / 2.6);
    g.withAlpha(0.32, () => {
      g.poly([[1180, 190], [1460, 118], [1740, 190], [1180, 190]], { color: PAL.ink, w: 1.8, progress: p });
      PROC.forEach((pr, k) => {
        const x = 1222 + k * 148, h = 150 * ease.out((t - 0.8 - k * 0.2) / 1.2);
        g.rect(x, 352 - h, 64, h, { stroke: pr.col, w: 1.8 });
        for (let f = 1; f < 4; f++) g.line(x + f * 16, 352 - h + 6, x + f * 16, 346, { color: pr.col, w: 1, alpha: h > 10 ? 0.6 : 0 });
      });
      g.line(1170, 356, 1750, 356, { color: PAL.ink, w: 1.8, progress: p });
    });
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'syn-vellend', title: 'Four high-level processes',
      beats: [
        { t: 'Mark Vellend’s theory of ecological communities, developed in 2010 and 2016, reduces community ecology to four high-level processes, borrowed from population genetics: selection, drift, dispersal, and speciation.' },
        { t: 'Selection means deterministic fitness differences among species: niches, competition, predation, and the stabilizing and equalizing mechanisms of coexistence theory. Drift is demographic chance, decisive in small populations and the engine of neutral theory. Dispersal moves organisms among places, from island colonization to metapopulation rescue to metacommunity mass effects. Speciation adds new species to the regional pool.' },
        { t: 'Every chapter you have seen is a particular blend. Island biogeography is dispersal set against stochastic extinction. Metapopulations are colonization and extinction among patches. Species sorting is selection plus dispersal. Neutral theory is drift, dispersal, and speciation, with selection set to zero.', pause: 1.5 },
      ],
      terms: [
        { beat: 0.5, term: 'Vellend’s four processes', def: 'Selection, ecological drift, dispersal, and speciation: the high-level processes of community dynamics.' },
      ],
      init() {
        const r = rng(19); const walks = [];
        for (let i = 0; i < 5; i++) { let v = 0.5; const w = [[0, v]]; for (let k = 1; k <= 40; k++) { if (v > 0 && v < 1) v = clamp(v + gauss(r) * 0.085); w.push([k / 40, v]); } walks.push(w); }
        return { walks };
      },
      draw(g, t, S, D) {
        const PX = (k) => 135 + k * 300, PW = 240, PY = 332, PH = 528;
        const m = S.io(2, 1.5, 0.1); // pillars → column headers
        const tFour = cue(S, 0, 'four high-level'), tBor = cue(S, 0, 'borrowed from'), tTheory = cue(S, 0, 'theory of ecological');
        const tName = [cue(S, 0, 'selection, drift'), cue(S, 0, 'drift, dispersal'), cue(S, 0, 'dispersal, and speciation'), cue(S, 0, 'and speciation') + 0.6];
        // matrix geometry
        const CX = (k) => 660 + k * 172, HY = 248, RY = (i) => 352 + i * 64;
        // ---------------- opening: one theory, four processes (before the pillars rise)
        const ep = S.p(0, 1.0, 0.4) * (1 - S.tp(tFour - 0.7, 0.5));
        if (ep > 0) g.withAlpha(ep, () => {
          g.text('A theory of ecological communities', 705, 540, { size: 56, role: 'display', italic: true, color: PAL.ink, align: 'center' });
          g.text('Mark Vellend · 2010 paper · 2016 book', 705, 600, { size: 24, color: PAL.ink2, align: 'center', alpha: S.tp(cue(S, 0, 'developed in'), 0.8) });
          g.line(505, 640, 905, 640, { color: PAL.rule, w: 1.5, progress: S.tp(cue(S, 0, 'developed in') + 0.3, 1.0) });
        });
        // ---------------- temple (beats 0–1)
        const vt = 1 - m;
        g.withAlpha(vt, () => {
          label(g, 'Vellend 2010 · The Theory of Ecological Communities 2016', 110, 236, S.tp(tTheory, 0.8));
          const pp = S.tp(tFour + 0.6, 1.2);
          g.poly([[110, 312], [705, 258], [1300, 312]], { color: PAL.ink2, w: 2.2, progress: pp });
          g.line(110, 318, 1300, 318, { color: PAL.ink2, w: 2.2, progress: pp });
          g.text('community dynamics', 705, 304, { size: 26, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: S.tp(tFour + 1.4, 0.8) });
          g.line(100, 878, 1310, 878, { color: PAL.ink2, w: 2.2, progress: S.tp(tTheory, 1.2) });
          g.line(90, 892, 1320, 892, { color: PAL.ink3, w: 1.5, progress: S.tp(tTheory + 0.3, 1.2) });
        });
        PROC.forEach((pr, k) => {
          const rise = ease.out(S.tp(tFour + k * 0.22, 1.1));
          if (rise <= 0) return;
          const nameOn = S.tp(tName[k], 0.6);
          // pillar rectangle, morphing to a header cell
          const x0 = PX(k), h0 = PH * rise, y0 = PY + PH - h0;
          const x = lerp(x0, CX(k) - 80, m), y = lerp(y0, HY, m), w = lerp(PW, 160, m), h = lerp(h0, 52, m);
          // fill level rises as the pillar's ideas are named
          const items = [
            [['niches', 'Selection means'], ['competition', 'competition,'], ['predation', 'predation,'], ['stabilizing & equalizing mechanisms', 'and the stabilizing']],
            [['demographic chance', 'Drift is'], ['strongest in small populations', 'small populations'], ['engine of neutral theory', 'engine of neutral']],
            [['island colonization', 'island colonization'], ['metapopulation rescue', 'metapopulation rescue'], ['metacommunity mass effects', 'mass effects']],
            [['new species enter the regional pool', 'Speciation adds']],
          ][k];
          const shown = items.map(([, ph]) => S.tp(cue(S, 1, ph), 0.7));
          const lvl = shown.reduce((s2, v) => s2 + v, 0) / items.length;
          g.rect(x, y, w, h, { fill: 'rgba(16,32,34,0.86)', stroke: U.mix(PAL.ink3, pr.col, Math.max(nameOn * 0.6, m)), w: 2, r: lerp(3, 8, m) });
          if (lvl > 0 && m < 1) {
            const fh = Math.max(0, h - 124) * lvl, fy = y + h - 4 - fh;
            const gr = g.ctx.createLinearGradient(0, fy, 0, y + h); gr.addColorStop(0, U.rgba(pr.col, 0.2)); gr.addColorStop(1, U.rgba(pr.col, 0.04));
            g.with(() => { g.ctx.globalAlpha *= 1 - m; g.ctx.fillStyle = gr; g.ctx.fillRect(x + 4, fy, w - 8, fh); });
            g.line(x + 6, fy, x + w - 6, fy, { color: pr.col, w: 1.5, alpha: 0.55 * (1 - m) });
          }
          // fluting
          if (m < 1) for (let f = 1; f < 6; f++) g.line(x + f * w / 6, y + 140, x + f * w / 6, y + h - 10, { color: PAL.faint, w: 2, alpha: (1 - m) * clamp(h / 300) });
          // capital
          g.rect(x - 14 * (1 - m), y - 14 * (1 - m), w + 28 * (1 - m), 14, { fill: U.rgba(pr.col, 0.18 + 0.5 * nameOn), alpha: 1 - m });
          // name (moves into the header)
          const nx = x + w / 2, ny = lerp(y + 62, HY + 36, m);
          g.text(pr.nm, nx, ny, { size: lerp(40, 28, m), role: 'display', color: pr.col, align: 'center', alpha: Math.max(nameOn, m) });
          g.withAlpha(1 - m, () => {
            g.text('≈ ' + pr.gen, nx, y + 96, { size: 21, italic: true, color: PAL.ink2, align: 'center', alpha: S.tp(tBor + 0.4 + k * 0.35, 0.8) });
            emblem(g, k, nx, y + 172, t, S.tp(tName[k] + 0.3, 0.8) * clamp(h / 400), D);
            let yy = y + 262;
            items.forEach(([txt], j) => {
              const a = shown[j]; if (a <= 0) { yy += 70; return; }
              g.circle(x + 22, yy - 7, 4, { fill: pr.col, alpha: a });
              const hgt = g.wrap(txt, x + 36, yy, w - 50, { size: 22, color: PAL.ink, alpha: a, lh: 1.18 });
              yy += Math.max(hgt, 26) + 22;
            });
          });
        });
        // ---------------- the blend matrix (beat 2)
        if (m > 0) g.withAlpha(clamp(m * 1.2), () => {
          const rows = [
            ['I', 'Population dynamics', [1, 2, 0, 0], 'pop'],
            ['II', 'Niche theory', [2, 0, 1, 0], 'niche'],
            ['III', 'Competition', [2, 0, 0, 0], 'comp'],
            ['IV', 'Predation', [2, 0, 0, 0], 'pred'],
            ['V', 'Island biogeography', [0, 2, 2, 1], 'isl'],
            ['VI', 'Metapopulations', [0, 2, 2, 0], 'meta'],
            ['VII', 'Species sorting', [2, 0, 2, 0], 'mc'],
            ['VIII', 'Neutral theory', [-1, 2, 2, 2], 'neu'],
          ];
          const tEv = cue(S, 2, 'Every chapter');
          const narr = { 4: cue(S, 2, 'Island biogeography is'), 5: cue(S, 2, 'Metapopulations are'), 6: cue(S, 2, 'Species sorting is'), 7: cue(S, 2, 'Neutral theory is') };
          const cellT = {
            4: [0, cue(S, 2, 'stochastic extinction'), cue(S, 2, 'dispersal set against'), cue(S, 2, 'stochastic extinction') + 1.2],
            5: [0, cue(S, 2, 'extinction among'), cue(S, 2, 'colonization and'), 0],
            6: [cue(S, 2, 'selection plus'), 0, cue(S, 2, 'plus dispersal') + 0.4, 0],
            7: [cue(S, 2, 'with selection set'), cue(S, 2, 'is drift'), cue(S, 2, 'dispersal, and speciation'), cue(S, 2, 'speciation, with')],
          };
          const gloss = { 4: ['', 'stochastic extinction', 'immigration', 'remote archipelagos'], 5: ['', 'local extinction', 'colonization', ''], 6: ['environment', '', 'access', ''], 7: ['set to zero', 'ecological drift', 'immigration m', 'point speciation'] };
          label(g, 'Each theory as a blend of processes', 110, HY + 34, S.tp(tEv, 0.8));
          const nOrder = [4, 5, 6, 7]; let cur = -1; for (const i of nOrder) if (t >= narr[i] - 0.2) cur = i;
          rows.forEach(([rn, nm, v, id], i) => {
            const ra = S.tp(tEv + 0.25 + i * 0.18, 0.6); if (ra <= 0) return;
            const y = RY(i), isN = i >= 4, hl = cur === i ? S.tp(narr[i] - 0.2, 0.5) : 0;
            g.withAlpha(ra, () => {
              if (hl > 0) g.rect(100, y - 31, 1220, 62, { fill: 'rgba(238,231,215,0.06)', stroke: U.rgba(PAL.ink, 0.18), w: 1, r: 6, alpha: hl });
              g.line(110, y + 32, 1310, y + 32, { color: PAL.faint, w: 1 });
              g.text(rn, 150, y + 7, { size: 18, role: 'mono', color: chCol(id), align: 'right' });
              g.text(nm, 172, y + 9, { size: 26, color: isN && t < narr[i] - 0.2 ? PAL.ink2 : PAL.ink });
              v.forEach((val, k) => {
                const at = isN ? (cellT[i][k] || narr[i] + 0.4) : tEv + 0.6 + i * 0.18 + k * 0.08;
                const p = S.tp(at, 0.6); if (p <= 0 || val === 0) return;
                const cx = CX(k), cy = isN && gloss[i][k] ? y - 8 : y;
                if (val === -1) { g.circle(cx, cy, 13, { stroke: PROC[k].col, w: 1.6, dash: [3, 4], alpha: p }); g.math('0', cx, cy + 9, { size: 26, color: PROC[k].col, align: 'center', alpha: p }); }
                else if (val === 2) g.dot(cx, cy, 11 * ease.outBack(p), PROC[k].col, 1, 2.6);
                else g.circle(cx, cy, 9 * p, { stroke: PROC[k].col, w: 3 });
                if (isN && gloss[i][k]) g.text(gloss[i][k], cx, y + 25, { size: 21, color: PROC[k].col, align: 'center', alpha: p * (0.5 + 0.5 * hl) });
              });
            });
          });
          const la = S.tp(tEv + 2.4, 0.8);
          g.dot(700, 900, 8, PAL.ink2, la, 2.2); g.text('central', 716, 907, { size: 21, color: PAL.ink2, alpha: la });
          g.circle(830, 900, 7, { stroke: PAL.ink2, w: 2.5, alpha: la }); g.text('contributing', 846, 907, { size: 21, color: PAL.ink2, alpha: la });
        });
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'syn-review', headerAlpha: (S) => 1 - S.tp(cue(S, 2, 'The ecological theater is vast') - 0.5, 0.9), title: 'Exam rehearsal',
      beats: [
        { t: 'Before your exam, rehearse with questions like these. Why is a Type II functional response destabilizing? Why does the species with the lowest R* win? Why don’t empty patches mean habitat is unimportant?',
          s: 'Before your exam, rehearse with questions like these. Why is a Type two functional response destabilizing? Why does the species with the lowest R star win? Why don’t empty patches mean habitat is unimportant?', pause: 1.5 },
        { t: 'What separates a stabilizing mechanism from an equalizing one? How do the four metacommunity paradigms differ in dispersal and environmental heterogeneity? And what does the fundamental biodiversity number measure?', pause: 1.5 },
        { t: 'If you can sketch the graphs from memory, the isoclines, the immigration and extinction curves, the phase planes, and explain what moves each line, you understand the theory, not just its vocabulary. The ecological theater is vast, but its rules are learnable. Good luck.', pause: 3 },
      ],
      tail: 4,
      init() {
        const cards = [
          { id: 'pred', tag: 'IV · Predation', q: 'Why is a Type II functional response destabilizing?', short: 'Type II response', cue: [0, 'Why is a Type II'] },
          { id: 'comp', tag: 'III · Competition', q: 'Why does the species with the lowest R* win?', short: 'Lowest R* wins', cue: [0, 'Why does the species'] },
          { id: 'meta', tag: 'VI · Metapopulations', q: 'Why don’t empty patches mean habitat is unimportant?', short: 'Empty patches', cue: [0, 'Why don'] },
          { id: 'comp', tag: 'III · Coexistence theory', q: 'What separates a stabilizing mechanism from an equalizing one?', short: 'Stabilizing vs equalizing', cue: [1, 'What separates'] },
          { id: 'mc', tag: 'VII · Metacommunities', q: 'How do the four metacommunity paradigms differ in dispersal and environmental heterogeneity?', short: 'Four paradigms', cue: [1, 'How do the four'] },
          { id: 'neu', tag: 'VIII · Neutral theory', q: 'What does the fundamental biodiversity number measure?', short: 'Biodiversity number', cue: [1, 'And what does'] },
        ];
        const rot = [-1.4, 0.9, -0.7, 1.1, -1.0, 0.6].map((d) => d * Math.PI / 180);
        return { cards, rot };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx;
        const tEnd = cue(S, 2, 'The ecological theater is vast'), tLuck = cue(S, 2, 'Good luck');
        const tC = cue(S, 2, 'If you can sketch'), tIso = cue(S, 2, 'the isoclines'), tIE = cue(S, 2, 'the immigration and'), tPP = cue(S, 2, 'the phase planes'), tMove = cue(S, 2, 'and explain what moves'), tUnd = cue(S, 2, 'you understand');
        const out = 1 - S.tp(tEnd - 0.5, 0.9); // rehearsal material clears for the end card
        const ct = D.cards.map((c) => cue(S, c.cue[0], c.cue[1]));
        // ---------------- deck
        const dealt = ct.filter((x) => t >= x - 0.1).length;
        const dk = S.p(0, 0.8, 0.3) * (1 - S.tp(ct[0] - 0.1, 0.5));
        if (dk > 0) g.withAlpha(dk, () => {
          for (let i = 0; i < 6 - dealt; i++) { const o = (5 - dealt - i) * 7; g.rect(960 - 190 + o, 430 - o, 380, 230, { fill: 'rgba(18,36,38,0.96)', stroke: 'rgba(238,231,215,0.22)', w: 1.5, r: 10 }); }
          if (dealt < 6) g.text('?', 960, 590, { size: 150, role: 'display', italic: true, color: PAL.ink3, align: 'center' });
          label(g, 'six questions to rehearse', 960, 730, 1, PAL.ink3, 'center');
        });
        // ---------------- cards
        const sk = (i, p, X0, Y0) => sketch(g, i, p, X0, Y0, t);
        D.cards.forEach((c, i) => {
          const pd = S.tp(ct[i] - 0.15, 0.75); if (pd <= 0) return;
          const gx = [390, 960, 1530][i % 3], gy = [382, 722][Math.floor(i / 3)];
          const cpt = S.io(2, 1.0, 0.15 + i * 0.1); // settle into the review row
          const rx = 146 + i * 276 + 124, ry = 300, sc0 = lerp(0.62, 1, ease.outBack(pd));
          const cx = lerp(lerp(960, gx, ease.out(pd)), rx, cpt), cy = lerp(lerp(545, gy, ease.out(pd)), ry, cpt);
          const sc = lerp(sc0, 0.46, cpt), rr = lerp(D.rot[i] * ease.out(pd), 0, cpt);
          const col = chCol(c.id);
          g.withAlpha(out * clamp(pd * 3), () => g.with(() => {
            ctx.translate(cx, cy); ctx.rotate(rr); ctx.scale(sc, sc); ctx.translate(-270, -150);
            g.rect(0, 0, 540, 300, { fill: 'rgba(16,32,34,0.95)', stroke: 'rgba(238,231,215,0.22)', w: 1.5, r: 10 });
            g.rect(0, 0, 540, 7, { fill: col, r: 3 });
            g.withAlpha(1 - cpt, () => {
              label(g, c.tag, 26, 44, 1, col);
              g.wrap(c.q, 26, 92, 490, { size: 29, role: 'display', color: PAL.ink, lh: 1.08 });
            });
            g.text(c.short, 26, 112, { size: 48, role: 'display', color: PAL.ink, alpha: cpt, maxW: 490 });
            sk(i, S.tp(ct[i] + 0.6, 2.4), 26, 168);
          }));
        });
        // ---------------- sketch it from memory (beat 2)
        label(g, 'Sketch from memory', 960, 406, S.tp(tC + 0.4, 0.8) * out, PAL.ink2, 'center');
        const pa = S.tp(tIso - 0.4, 0.8) * out;
        if (pa > 0) g.withAlpha(pa, () => {
          const mv = S.tp(tMove, 1.2) * (1 - S.tp(tEnd - 0.6, 0.6)), wob = mv * (0.5 - 0.5 * Math.cos((t - tMove) * 1.6));
          const P0 = [150, 735, 1320], PW = 450;
          // 1. competition isoclines
          g.withAlpha(S.tp(tIso - 0.4, 0.8), () => {
            label(g, 'Isoclines · Lotka–Volterra competition', P0[0], 440, 1);
            const A = g.axes({ x: P0[0] + 50, y: 480, w: 360, h: 300, xmax: 200, ymax: 200, xlab: 'N_1', ylab: 'N_2', progress: S.tp(tIso - 0.3, 0.8) });
            const K1 = 100 + 40 * wob, a12 = 0.6, K2 = 100, a21 = 0.6;
            const pr = S.tp(tIso, 1.0);
            if (mv > 0) g.line(A.X(100), A.Y(0), A.X(0), A.Y(100 / a12), { color: PAL.ochre, w: 2, dash: [5, 6], alpha: 0.5 * mv });
            g.line(A.X(K1), A.Y(0), A.X(0), A.Y(Math.min(200, K1 / a12)), { color: PAL.ochre, w: 3.5, progress: pr });
            g.line(A.X(K2 / a21), A.Y(0), A.X(0), A.Y(K2), { color: PAL.lagoon, w: 3.5, progress: S.tp(tIso + 0.3, 1.0) });
            const ne = (K1 - a12 * K2) / (1 - a12 * a21), pe = (K2 - a21 * K1) / (1 - a12 * a21);
            g.dot(A.X(ne), A.Y(pe), 7, PAL.ink, S.tp(tIso + 1.0, 0.6), 2.6);
            g.math('\\dot{N}_1 = 0', A.X(10), A.Y(180) - 4, { size: 24, color: PAL.ochre, alpha: S.tp(tIso + 0.6, 0.6) });
            g.math('\\dot{N}_2 = 0', A.X(150), A.Y(30) - 8, { size: 24, color: PAL.lagoon, alpha: S.tp(tIso + 0.9, 0.6) });
            g.text('K₁ ↑ moves species 1’s line out', P0[0] + 230, 862, { size: 21, color: PAL.ink2, align: 'center', alpha: mv });
          });
          // 2. immigration & extinction
          g.withAlpha(S.tp(tIE - 0.4, 0.8), () => {
            label(g, 'Immigration & extinction · MacArthur–Wilson', P0[1], 440, 1);
            const A = g.axes({ x: P0[1] + 50, y: 480, w: 360, h: 300, xmax: 1, ymax: 1, xlab: 'S', ylab: 'rate', labSize: 22, progress: S.tp(tIE - 0.3, 0.8) });
            const I0 = 0.95 * (1 - 0.4 * wob);
            const Ifn = (x) => I0 * (1 - x) * (1 - x), Efn = (x) => 0.95 * x * x;
            if (mv > 0) g.plot(A, (x) => 0.95 * (1 - x) * (1 - x), { color: PAL.lagoon, w: 2, dash: [5, 6], alpha: 0.5 * mv });
            g.plot(A, Ifn, { color: PAL.lagoon, w: 3.5, progress: S.tp(tIE, 1.0) });
            g.plot(A, Efn, { color: PAL.coral, w: 3.5, progress: S.tp(tIE + 0.6, 1.0) });
            const r0 = Math.sqrt(I0 / 0.95), Sh = r0 / (1 + r0);
            const ea = S.tp(tIE + 1.4, 0.6);
            g.line(A.X(Sh), A.Y(Efn(Sh)), A.X(Sh), A.Y(0), { color: PAL.ink2, w: 1.5, dash: [4, 5], alpha: ea });
            g.math('\\hat{S}', A.X(Sh), A.Y(0) + 32, { size: 26, align: 'center', alpha: ea });
            g.text('immigration', A.X(0.04), A.Y(0.98) - 6, { size: 21, color: PAL.lagoon, alpha: S.tp(tIE + 0.4, 0.6) });
            g.text('extinction', A.X(0.98), A.Y(0.98) - 6, { size: 21, color: PAL.coral, align: 'right', alpha: S.tp(tIE + 1.0, 0.6) });
            g.text('distance ↑ lowers immigration', P0[1] + 230, 862, { size: 21, color: PAL.ink2, align: 'center', alpha: mv });
          });
          // 3. predator–prey phase plane
          g.withAlpha(S.tp(tPP - 0.4, 0.8), () => {
            label(g, 'Phase plane · Rosenzweig–MacArthur', P0[2], 440, 1);
            const A = g.axes({ x: P0[2] + 50, y: 480, w: 360, h: 300, xmax: 170, ymax: 1.25, xlab: 'N', ylab: 'P', progress: S.tp(tPP - 0.3, 0.8) });
            const K = 100 + 60 * wob, b = 0.05, hump = (n) => Math.max(0, 0.42 * (1 - n / K) * (1 + b * n));
            if (mv > 0) g.plot(A, (n) => Math.max(0, 0.42 * (1 - n / 100) * (1 + b * n)), { from: 0, to: 100, color: PAL.moss, w: 2, dash: [5, 6], alpha: 0.5 * mv });
            g.plot(A, hump, { from: 0, to: K, color: PAL.moss, w: 3.5, progress: S.tp(tPP, 1.0) });
            const Ns = 58; g.line(A.X(Ns), A.Y(0), A.X(Ns), A.Y(1.2), { color: PAL.coral, w: 3.5, progress: S.tp(tPP + 0.5, 0.8) });
            const Ps = hump(Ns), stable = (K * b - 1) / (2 * b) < Ns;
            const sp = []; const n2 = 120, prS = S.tp(tPP + 1.0, 2.0);
            for (let i2 = 0; i2 <= n2 * prS; i2++) { const th = i2 / n2 * Math.PI * 5; const am = stable ? Math.exp(-0.16 * th) : 0.55 + 0.45 * (1 - Math.exp(-0.25 * th)); sp.push([A.X(Ns + 30 * am * Math.cos(th)), A.Y(Ps + 0.2 * am * Math.sin(th))]); }
            if (sp.length > 1) g.poly(sp, { color: PAL.ink, w: 1.8, alpha: 0.75 });
            g.text('prey', A.X(4), A.Y(hump(4)) + 32, { size: 21, color: PAL.moss, alpha: S.tp(tPP + 0.5, 0.6) });
            g.text('predator', A.X(Ns) + 10, A.Y(1.16), { size: 21, color: PAL.coral, alpha: S.tp(tPP + 0.8, 0.6) });
            g.text('enrichment (K ↑) stretches the hump', P0[2] + 230, 862, { size: 21, color: PAL.ink2, align: 'center', alpha: mv });
          });
        });
        // ---------------- end card
        const ea = S.tp(tEnd + 0.2, 1.4) * (1 - ease.inOut((t - (S.dur - 3.4)) / 2.6));
        if (ea > 0) g.withAlpha(ea, () => {
          const chs = Theater.chapters.filter((c) => c.roman);
          chs.forEach((c, k) => { const x = 960 - (chs.length - 1) * 21 + k * 42; g.rect(x - 12, 392, 24, 4, { fill: c.color || PAL.ink2, r: 2, alpha: S.tp(tEnd + 0.4 + k * 0.08, 0.6) }); });
          g.text('The Ecological Theater', 960, 520, { size: 120, role: 'display', color: PAL.ink, align: 'center' });
          g.text('vast, but its rules are learnable', 960, 590, { size: 40, role: 'display', italic: true, color: PAL.ink2, align: 'center', alpha: S.tp(tEnd + 1.6, 1.0) });
          g.text('Good luck.', 960, 680, { size: 46, role: 'display', italic: true, color: PAL.ochre, align: 'center', alpha: S.tp(tLuck - 0.1, 0.8) });
          g.line(760, 740, 1160, 740, { color: PAL.rule, w: 1.5, progress: S.tp(tEnd + 2.4, 1.2) });
          g.text('narration: synthesized voice · companion study guide with the full lexicon', 960, 786, { size: 23, color: PAL.ink3, align: 'center', alpha: S.tp(tEnd + 2.8, 1.0) });
        });
      },
    },
  ],
});
})();
