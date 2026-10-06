/* Prologue: title, framing question, table of contents. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, noise1 } = U;

Theater.chapter({
  id: 'open', title: 'Prologue', color: PAL.sand, card: false,
  scenes: [{
    id: 'open-title', title: 'The Ecological Theater', header: false, lead: 2.2, tail: 2.0,
    beats: [
      { t: 'In 1965, G. Evelyn Hutchinson described nature as the ecological theater: the stage on which the evolutionary play is performed.' },
      { t: 'Every question in ecology asks some version of the same thing. Why are these organisms here, in these numbers, alongside these neighbors?' },
      { t: 'Ecologists answer with theory: a toolkit of models for growth, niches, competition, predation, and movement across landscapes.', pause: 0.6 },
      { t: 'In this program we build that toolkit, from a single population up to whole metacommunities. Watch the lexicon on the right of the screen. Every numbered term is one an examiner may ask you to define.', pause: 1.5 },
    ],
    terms: [{ beat: 3.45, demo: true, term: 'Lexicon', def: 'Key terms appear here as they are introduced. Every one is collected, with equations and citations, in the companion study guide.' }],
    init() {
      const r = rng(11); const P = [];
      for (let k = 0; k < 460; k++) P.push({ sp: k % 6, a: r() * Math.PI * 2, rad: Math.sqrt(r()), s1: r() * 50, s2: r() * 50, size: 1.8 + r() * 2.6, spd: 0.04 + r() * 0.08 });
      return { P };
    },
    draw(g, t, S, D) {
      const ctx = g.ctx; const W = g.W;
      const cols = [PAL.moss, PAL.ochre, PAL.lagoon, PAL.coral, PAL.heather, PAL.rose];
      const archP = ease.inOut((t - 0.2) / 3.2);
      const toc = S.p(3, 1.2);
      // --- proscenium arch ---------------------------------------------------
      const cx = 960, top = 330, rx = 690, ry = 200, floor = 905;
      const arch = [];
      arch.push([cx - rx, floor]);
      for (let k = 0; k <= 60; k++) { const a = Math.PI + (k / 60) * Math.PI; arch.push([cx + rx * Math.cos(a), top + ry * Math.sin(a)]); }
      arch.push([cx + rx, floor]);
      const archA = 1 - 0.55 * toc;
      g.poly(arch, { color: PAL.sand, w: 2, alpha: 0.55 * archA, progress: archP });
      const arch2 = arch.map(([x, y]) => [cx + (x - cx) * 0.965, top + (y - top) * 0.94 + (y > top ? 0 : 6)]);
      g.poly(arch2, { color: PAL.sand, w: 1, alpha: 0.28 * archA, progress: archP });
      g.line(cx - rx - 70, floor, cx + rx + 70, floor, { color: PAL.sand, w: 2, alpha: 0.5 * archA, progress: archP });
      for (let k = -6; k <= 6; k++) g.line(cx + k * 115, floor, cx + k * 165, floor + 60, { color: PAL.sand, w: 1, alpha: 0.12 * archP * archA });
      // curtains: swagged contour lines on each side
      for (const side of [-1, 1]) {
        for (let j = 0; j < 9; j++) {
          const pts = []; const baseX = cx + side * (rx - 18 - j * 15);
          for (let k = 0; k <= 40; k++) {
            const yy = lerp(top - ry * 0.78, floor, k / 40); const sway = 6 * Math.sin(t * 0.6 + j * 0.7 + k * 0.25);
            const gather = Math.pow(k / 40, 2.2) * (70 + j * 9);
            pts.push([baseX + side * gather * 0.9 - side * 30 * Math.sin(k / 40 * Math.PI) + sway, yy]);
          }
          g.poly(pts, { color: PAL.coral, w: 1.4, alpha: 0.32 * archP * archA * (1 - j * 0.07) });
        }
      }
      // --- the cast: luminous individuals in drifting species clusters --------
      const castA = ease.out((t - 1.0) / 2.5) * (1 - 0.6 * toc); const lift = S.p(1, 1.4);
      if (castA > 0) {
        for (const p of D.P) {
          const sp = p.sp;
          const ccx = 960 + 470 * noise1(t * 0.035 + sp * 13.1, 3), ccy = 690 + 110 * noise1(t * 0.03 + sp * 7.7, 5);
          const ang = p.a + t * p.spd * (sp % 2 ? 1 : -1);
          const rr = 40 + p.rad * 150;
          const x = ccx + rr * Math.cos(ang) + 22 * noise1(t * 0.25 + p.s1, 1);
          const y = ccy + rr * 0.6 * Math.sin(ang) + 18 * noise1(t * 0.25 + p.s2, 2);
          // keep inside the arch
          const inside = Math.abs(x - cx) < rx - 120 && y > top - 40 && y < floor - 20;
          if (!inside) continue;
          const textY = toc > 0.5 ? -999 : lerp(560, 600, lift); const floorQ = 1 - 0.75 * S.p(2, 0.8) * (1 - S.p(3, 0.8)) * clamp((y - 780) / 60); const quiet = clamp(Math.abs(y - textY) / 150, 0.18, 1) * floorQ;
          g.dot(x, y, p.size, cols[sp], 0.62 * castA * quiet, 3);
        }
      }
      // --- title ---------------------------------------------------------------
      const tp = ease.out((t - 0.8) / 1.8);
      const ty = lerp(520, 430, lift) - 120 * toc; const tsize = lerp(150, 132, lift) * (1 - 0.35 * toc);
      g.text('The Ecological Theater', cx, ty + (1 - tp) * 18, { size: tsize, role: 'display', color: PAL.ink, align: 'center', alpha: tp });
      g.text('CORE THEORY FOR THE COMPREHENSIVE EXAM  ·  ECOLOGY & WILDLIFE SCIENCE', cx, ty + 66 * (1 - 0.35 * toc), { size: 19, weight: 600, ls: 3.6, color: PAL.sand, align: 'center', alpha: ease.out((t - 1.6) / 1.6) * (1 - toc) });
      g.text('after G. E. Hutchinson, The Ecological Theater and the Evolutionary Play (1965)', cx, ty + 112, { size: 26, role: 'display', italic: true, color: PAL.ink2, align: 'center', alpha: S.p(0, 1.2, 1.5) * (1 - S.p(1)) });
      // --- framing question -------------------------------------------------
      const qa = S.p(1, 1.2, 1.4) * (1 - S.p(2, 0.8));
      g.text('Why are these organisms here,', cx, 590, { size: 50, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: qa });
      g.text('in these numbers, alongside these neighbors?', cx, 650, { size: 50, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: S.p(1, 1.2, 3.0) * (1 - S.p(2, 0.8)) });
      // --- the toolkit: topics on the stage floor ------------------------------
      const topics = ['growth', 'niches', 'competition', 'predation', 'islands', 'patches', 'metacommunities', 'drift'];
      const fa = 1 - S.p(3, 0.8);
      const tw = topics.map((w) => g.measure(w, { size: 36, role: 'display', italic: true }));
      const gap = (1240 - tw.reduce((a, b) => a + b, 0)) / (topics.length - 1); let tx = 340;
      topics.forEach((w, k) => {
        const p = S.p(2, 0.8, 0.5 + k * 0.42) * fa; const x = tx + tw[k] / 2; tx += tw[k] + gap;
        g.text(w, x, 878 + (1 - p) * 14, { size: 36, role: 'display', italic: true, color: cols[k % 6], align: 'center', alpha: p });
      });
      // --- table of contents ---------------------------------------------------
      if (toc > 0) {
        const chs = Theater.chapters.filter((c) => c.roman);
        chs.forEach((c, k) => {
          const col = k < 5 ? 0 : 1, row = k < 5 ? k : k - 5; const x = 170 + col * 590, y = 470 + row * 72;
          const p = S.p(3, 0.9, 0.4 + k * 0.35);
          g.text(c.roman, x + 40, y, { size: 40, role: 'display', italic: true, color: c.color, align: 'right', alpha: p });
          g.text(c.title, x + 66, y, { size: 36, role: 'display', color: PAL.ink, alpha: p });
          g.line(x + 66, y + 18, x + 66 + 420 * p, y + 18, { color: PAL.rule, w: 1, alpha: 0.6 * p });
        });
        g.text('CONTENTS', 170 + 40, 400, { size: 17, weight: 600, ls: 4, color: PAL.sand, alpha: toc, align: 'right' });
      }
    },
  }],
});
})();
