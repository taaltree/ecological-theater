/* Chapter VII — Metacommunities. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.rose;
const SP = Theater.SPECIES; // moss, ochre, lagoon, coral, heather, rose, sand, mint

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
const P = (S, k, phrase, d = 0.8, off = 0) => S.tp(cue(S, k, phrase) + off, d);
const bez = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
// Curved link between two circles: returns {a, c, b} (start, control, end).
function link(p, q, bend = 0.14, gap = 1.06) {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const a = [p.x + ux * p.r * gap, p.y + uy * p.r * gap], b = [q.x - ux * q.r * gap, q.y - uy * q.r * gap];
  return { a, b, c: [(a[0] + b[0]) / 2 - uy * L * bend, (a[1] + b[1]) / 2 + ux * L * bend] };
}
const curvePts = (L, n = 24) => Array.from({ length: n + 1 }, (_, k) => bez(L.a, L.c, L.b, k / n));
// Organic patch outline (closed, smooth).
function blob(cx, cy, r, ph, amp = 0.1, n = 44) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const th = k / n * Math.PI * 2;
    const rr = r * (1 + amp * (0.6 * Math.sin(2 * th + ph[0]) + 0.35 * Math.sin(3 * th + ph[1]) + 0.2 * Math.sin(5 * th + ph[2])));
    pts.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th)]);
  }
  pts.push(pts[0]); return pts;
}
function sunflower(n, R) { const o = []; for (let i = 0; i < n; i++) { const rr = R * Math.sqrt((i + 0.5) / n), th = i * 2.39996; o.push([rr * Math.cos(th), rr * Math.sin(th)]); } return o; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const PATCH_FILL = 'rgba(20,40,42,0.82)';

Theater.chapter({
  id: 'mc', roman: 'VII', title: 'Metacommunities', color: COL,
  question: 'How do local communities connect across a region?',
  intro: { t: 'Chapter seven. Metacommunities: linking local communities across a region.' },
  motif(g, t) {
    const p = ease.inOut((t - 0.5) / 2.6);
    const N = [[1180, 250, 34], [1330, 170, 26], [1460, 280, 40], [1610, 175, 30], [1720, 300, 34], [1330, 330, 22]];
    const E = [[0, 1], [1, 2], [0, 5], [2, 3], [3, 4], [2, 4], [5, 2]];
    g.withAlpha(0.34 * p, () => {
      E.forEach(([i, j]) => { const L = link({ x: N[i][0], y: N[i][1], r: N[i][2] }, { x: N[j][0], y: N[j][1], r: N[j][2] }, 0.16); g.poly(curvePts(L, 16), { color: PAL.lagoon, w: 1.6, dash: [3, 7] }); });
      N.forEach(([x, y, r], i) => {
        g.circle(x, y, r, { stroke: COL, w: 1.6 });
        for (let k = 0; k < 3; k++) { const a = i * 1.7 + k * 2.1; g.circle(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 3.5, { fill: SP[(i + k * 3) % 8] }); }
      });
    });
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'mc-scale', title: 'Scale & diversity',
      beats: [
        { t: 'A metacommunity, as defined by Mathew Leibold and colleagues in 2004, is a set of local communities linked by the dispersal of multiple, potentially interacting species. It is the community-level counterpart of the metapopulation.',
          s: 'A metacommunity, as defined by Mathew Lie-bold and colleagues in 2004, is a set of local communities linked by the dispersal of multiple, potentially interacting species. It is the community-level counterpart of the metapopulation.' },
        { t: 'Its diversity is partitioned across scales. Alpha diversity is local richness; gamma diversity is the regional total; and beta diversity, the variation in composition among sites, links them. In Whittaker’s multiplicative form, γ = α × β.',
          s: 'Its diversity is partitioned across scales. Alpha diversity is local richness; gamma diversity is the regional total; and beta diversity, the variation in composition among sites, links them. In Whittaker’s multiplicative form, gamma equals alpha times beta.', pause: 0.5 },
        { t: 'Beta diversity itself has two components: turnover, as species replace one another along gradients, and nestedness, as species-poor sites hold subsets of the species found at richer sites.', pause: 0.5 },
        { t: 'Community assembly is often pictured as a series of filters acting on a regional species pool. Dispersal determines who arrives, environmental filtering determines who can tolerate local conditions, and biotic interactions determine who remains. Kraft and colleagues cautioned in 2015 that competition can produce patterns easily mistaken for environmental filtering.', pause: 1 },
      ],
      terms: [
        { beat: 0.3, term: 'Metacommunity', def: 'A set of local communities linked by dispersal of multiple potentially interacting species (Leibold et al. 2004).' },
        { beat: 1.3, term: 'Alpha, beta & gamma diversity', def: 'Local richness, among-site compositional variation, and regional richness; γ = α × β (Whittaker).' },
        { beat: 2.2, term: 'Turnover vs nestedness', def: 'Beta diversity from species replacement versus from poorer sites holding subsets of richer ones.' },
        { beat: 3.4, term: 'Environmental filtering', def: 'Exclusion of species unable to tolerate local abiotic conditions during community assembly.' },
      ],
      init(S0) {
        const r = rng(71);
        // Landscape of local communities (beat 0). Patches 0, 2, 6 become sites A, B, C (beat 1).
        const P = [
          { x: 240, y: 440, r: 100, sp: [0, 1, 2, 3, 4] },
          { x: 530, y: 345, r: 72, sp: [1, 3, 6] },
          { x: 800, y: 470, r: 108, sp: [2, 3, 4, 5] },
          { x: 1110, y: 352, r: 86, sp: [4, 5, 7] },
          { x: 420, y: 690, r: 92, sp: [0, 2, 6] },
          { x: 770, y: 732, r: 76, sp: [1, 5, 7] },
          { x: 1118, y: 655, r: 102, sp: [5, 6, 7] },
        ];
        P.forEach((p) => { p.ph = [r() * 6.28, r() * 6.28, r() * 6.28]; });
        const links = [[0, 1], [0, 4], [1, 2], [2, 3], [2, 5], [4, 5], [5, 6], [3, 6], [2, 6]].map(([i, j], k) => ({ i, j, L: link(P[i], P[j], k % 2 ? 0.12 : -0.12) }));
        links.forEach((l) => { l.pts = curvePts(l.L); });
        const SITES = [{ x: 250, y: 420, r: 112, src: 0 }, { x: 590, y: 420, r: 112, src: 2 }, { x: 930, y: 420, r: 112, src: 6 }];
        const slot = (n, k) => { const R = n === 3 ? 46 : n === 4 ? 50 : 56; const a = -Math.PI / 2 + k * Math.PI * 2 / n; return [Math.cos(a) * R, Math.sin(a) * R]; };
        const inds = [];
        P.forEach((p, i) => {
          const si = SITES.findIndex((s) => s.src === i);
          p.sp.forEach((s, sk) => {
            const n = 2 + (r() < 0.55 ? 1 : 0);
            for (let k = 0; k < n; k++) {
              let dx, dy; do { dx = r() * 2 - 1; dy = r() * 2 - 1; } while (dx * dx + dy * dy > 1);
              const o = { p: i, s, dx: dx * p.r * 0.66, dy: dy * p.r * 0.66, ph: r() * 50, pop: r(), lead: k === 0, site: si };
              if (si >= 0) { const [sx, sy] = slot(p.sp.length, sk); o.tx = SITES[si].x + sx; o.ty = SITES[si].y + sy; }
              inds.push(o);
            }
          });
        });
        // interaction web: a few nearby pairs of different species within each patch
        const web = [];
        P.forEach((p, i) => {
          const mine = inds.filter((o) => o.p === i); let c = 0;
          for (let a = 0; a < mine.length && c < 5; a++) for (let b = a + 1; b < mine.length && c < 5; b++) {
            const A = mine[a], B = mine[b]; if (A.s !== B.s && Math.hypot(A.dx - B.dx, A.dy - B.dy) < p.r * 0.75) { web.push([inds.indexOf(A), inds.indexOf(B)]); c++; }
          }
        });
        // dispersers travelling along links (species from the source patch)
        const parts = [];
        links.forEach((l, li) => { for (let k = 0; k < 3; k++) { const dir = k % 2; const src = P[dir ? l.j : l.i]; parts.push({ li, dir, s: src.sp[Math.floor(r() * src.sp.length)], ph: r(), sp: 0.22 + r() * 0.12 }); } });
        // ---- assembly filters (beat 3): propagules leave the pool and meet three filters.
        // Arrival times are tied to when each filter is named, so the stops happen on cue.
        const FX = [478, 738, 998], POOL = { x: 215, y: 548, r: 118 }, LOC = { x: 1212, y: 548, r: 92 }, v = 150;
        const fate = [3, 3, 3, 2, 1, 1, 0, 0]; // filter that stops each species (3 = reaches the local community)
        const Tf = [cue(S0, 3, 'Dispersal determines'), cue(S0, 3, 'environmental filtering determines'), cue(S0, 3, 'biotic interactions')];
        const pool = sunflower(40, POOL.r * 0.84).map(([x, y], i) => ({ x: POOL.x + x, y: POOL.y + y, s: i % 8, ph: r() * 40 }));
        const dots = []; const lpos = sunflower(15, LOC.r * 0.72); const cnt = [0, 0, 0, 0];
        const order = shuffle(Array.from({ length: 40 }, (_, i) => i), r);
        order.forEach((i) => {
          const s = i % 8, f = fate[s], q = cnt[f]++; const src = pool[i];
          const lanes = [0, 1, 2].map(() => 430 + r() * 236);
          const pts = [[src.x, src.y]];
          for (let k = 0; k < 3 && k <= f; k++) pts.push([FX[k] - 15, lanes[k]]);
          const d = { s, f, ph: r() * 40 };
          if (f === 3) { const lp = lpos[q]; pts.push([LOC.x + lp[0], LOC.y + lp[1]]); }
          else d.pile = [FX[f] + ((q % 5) - 2) * 15, 742 - Math.floor(q / 5) * 14];
          d.pts = pts; d.cum = [0]; for (let k = 1; k < pts.length; k++) d.cum.push(d.cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
          const L = d.cum[d.cum.length - 1];
          const arrive = f === 3 ? Tf[0] + 2.2 + q * 0.5 : Tf[f] + 0.35 + q * (f === 2 ? 0.55 : 0.42) + r() * 0.1;
          d.launch = arrive - L / v;
          dots.push(d);
        });
        return { P, links, SITES, inds, web, parts, FX, POOL, LOC, dots, pool, v };
      },
      draw(g, t, S, D) {
        const m = S.io(1, 1.8, 0.1); // landscape → three sites
        // ================= beats 0–1: landscape morphing into three sites
        const vL = vis(S, 0, 2);
        if (vL > 0) g.withAlpha(vL, () => {
          label(g, 'A metacommunity · Leibold et al. 2004', 110, 262, S.p(0, 0.8, 1.2) * (1 - m));
          const tLoc = cue(S, 0, 'a set of local'), tLink = cue(S, 0, 'linked by'), tWeb = cue(S, 0, 'potentially');
          const lp = S.tp(tLink, 1.4) * (1 - m);
          // dispersal links + travelling dispersers
          D.links.forEach((l, k) => {
            g.poly(l.pts, { color: PAL.lagoon, w: 2.2, dash: [3, 9], dashOffset: -t * 14, alpha: 0.55 * (1 - m), progress: S.tp(tLink + k * 0.12, 1.0) });
          });
          if (lp > 0) D.parts.forEach((q) => {
            const L = D.links[q.li].L; let u = (t * q.sp + q.ph) % 1; if (q.dir) u = 1 - u;
            const [x, y] = bez(L.a, L.c, L.b, u); g.dot(x, y, 4.5, SP[q.s], lp * Math.sin(Math.PI * clamp(u)) ** 0.5, 2.6);
          });
          if (lp > 0) {
            const l = D.links[3]; const [x, y] = bez(l.L.a, l.L.c, l.L.b, 0.5);
            g.text('dispersal', x + 6, y - 22, { size: 22, color: PAL.lagoon, align: 'center', alpha: S.tp(tLink + 0.6, 0.8) * (1 - m) });
          }
          // patches
          D.P.forEach((p, i) => {
            const si = D.SITES.findIndex((s) => s.src === i); const st = si >= 0 ? D.SITES[si] : null;
            const ap = S.tp(1.4 + i * 0.32, 1.0) * (st ? 1 : 1 - m);
            if (ap <= 0) return;
            const cx = st ? lerp(p.x, st.x, m) : p.x, cy = st ? lerp(p.y, st.y, m) : p.y, rr = st ? lerp(p.r, st.r, m) : p.r;
            g.poly(blob(cx, cy, rr * lerp(0.92, 1, ap), p.ph, 0.1 * (1 - m)), { fill: PATCH_FILL, color: st ? U.mix(PAL.ink3, PAL.ink2, m) : PAL.ink3, w: 2, alpha: ap });
          });
          // interaction web (faint lines between neighbours of different species)
          const wa = S.tp(tWeb, 1.0) * (1 - S.p(1, 0.5)) * 0.5;
          if (wa > 0) D.web.forEach(([a, b]) => {
            const A = D.inds[a], B = D.inds[b], p = D.P[A.p];
            g.line(p.x + A.dx, p.y + A.dy, p.x + B.dx, p.y + B.dy, { color: PAL.ink2, w: 1.2, alpha: wa, dash: [2, 4] });
          });
          // individuals
          D.inds.forEach((o) => {
            const p = D.P[o.p]; const st = o.site >= 0;
            const ai = S.tp(tLoc + 0.3 + o.pop * 1.4, 0.5) * (st ? (o.lead ? 1 : 1 - ease.in(m)) : 1 - m);
            if (ai <= 0) return;
            const jx = 3.5 * Math.sin(t * 0.9 + o.ph), jy = 3.5 * Math.cos(t * 0.7 + o.ph * 1.3);
            let x = p.x + o.dx + jx, y = p.y + o.dy + jy, rad = 6.5;
            if (st) { x = lerp(x, o.tx, m); y = lerp(y, o.ty, m); rad = lerp(6.5, 13, m); }
            g.dot(x, y, rad, SP[o.s], ai, 2.4);
          });
          // local community callout
          const ca = S.tp(tLoc, 0.8) * (1 - m);
          if (ca > 0) {
            g.line(D.P[5].x + 58, D.P[5].y + 44, D.P[5].x + 96, D.P[5].y + 66, { color: PAL.ink2, w: 1.5, alpha: ca });
            g.text('local community', D.P[5].x + 104, D.P[5].y + 74, { size: 22, color: PAL.ink2, alpha: ca });
          }
          // counterpart of the metapopulation
          const cp = S.tp(cue(S, 0, 'It is the community'), 0.9) * (1 - S.p(1, 0.5));
          if (cp > 0) g.withAlpha(cp, () => {
            const mini = (x0, multi) => {
              const N = [[x0, 884], [x0 + 40, 868], [x0 + 80, 886]];
              g.line(N[0][0], N[0][1], N[1][0], N[1][1], { color: PAL.lagoon, w: 1.5, dash: [2, 4] }); g.line(N[1][0], N[1][1], N[2][0], N[2][1], { color: PAL.lagoon, w: 1.5, dash: [2, 4] });
              N.forEach(([x, y], k) => { g.circle(x, y, 14, { fill: PATCH_FILL, stroke: PAL.ink3, w: 1.5 }); if (multi) { for (let q = 0; q < 3; q++) g.circle(x + Math.cos(q * 2.1 + k) * 6, y + Math.sin(q * 2.1 + k) * 6, 3.2, { fill: SP[(k * 3 + q * 2) % 8] }); } else if (k !== 1) g.circle(x, y, 4, { fill: PAL.moss }); });
            };
            mini(130, false);
            g.text('metapopulation: one species, many patches', 240, 886, { size: 22, color: PAL.ink2 });
            g.text('→', 712, 886, { size: 26, color: PAL.ink3, align: 'center' });
            mini(752, true);
            g.text('metacommunity: many species, many patches', 862, 886, { size: 22, color: PAL.ink });
          });
        });
        // ================= beat 1: α, β, γ
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          const SITES = D.SITES, names = ['A', 'B', 'C'], sets = SITES.map((s) => D.P[s.src].sp);
          const tA = cue(S, 1, 'Alpha diversity'), tG = cue(S, 1, 'gamma diversity'), tB = cue(S, 1, 'and beta'), tW = cue(S, 1, 'In Whittaker');
          SITES.forEach((s, k) => label(g, 'Site ' + names[k], s.x, s.y - s.r - 26, S.p(1, 0.8, 1.6 + k * 0.2), PAL.ink2, 'center'));
          // region frame
          const rg = S.tp(tG, 0.9);
          g.rect(118, 262, 944, 378, { stroke: PAL.lagoon, w: 1.8, dash: [10, 8], r: 18, alpha: 0.6 * rg });
          label(g, 'Region', 140, 628, rg, PAL.lagoon);
          // alpha: count species in each site
          SITES.forEach((s, k) => {
            const n = sets[k].length; const t0 = tA + 0.3 + k * 1.1;
            const cnt = Math.min(n, Math.floor(clamp((t - t0) / 0.18, 0, n)));
            sets[k].forEach((sp, j) => {
              const pk = clamp((t - t0 - j * 0.18) / 0.45);
              if (pk > 0 && pk < 1) { const o = D.inds.find((q) => q.site === k && q.s === sp && q.lead); g.circle(o.tx, o.ty, 13 + 16 * pk, { stroke: PAL.ochre, w: 2.5, alpha: 1 - pk }); }
            });
            g.math('α = ' + cnt, s.x, s.y + s.r + 56, { size: 40, color: PAL.ochre, align: 'center', alpha: S.tp(t0 - 0.1, 0.4) });
          });
          // gamma: union of species flies down into the regional list
          const first = []; for (let sp = 0; sp < 8; sp++) first[sp] = sets.findIndex((st) => st.includes(sp));
          let gcount = 0;
          for (let sp = 0; sp < 8; sp++) {
            const k = first[sp]; const o = D.inds.find((q) => q.site === k && q.s === sp && q.lead);
            const pf = S.tp(tG + 0.5 + sp * 0.22, 0.9); if (pf <= 0) continue;
            const X = 250 + sp * 97, Y = 712; if (pf >= 1) gcount++;
            g.dot(lerp(o.tx, X, pf), lerp(o.ty, Y, pf) - Math.sin(Math.PI * pf) * 30, 12, SP[sp], 1, 2.4);
          }
          g.math('γ = ' + gcount, 1010, 726, { size: 44, color: PAL.lagoon, alpha: S.tp(tG + 0.4, 0.5) });
          g.text('regional species list', 250, 768, { size: 21, color: PAL.ink3, alpha: S.tp(tG + 1.5, 0.8) });
          // beta: compositional overlap between sites, then the arithmetic
          const ba = S.tp(tB, 0.9);
          if (ba > 0) {
            const shared = [[0, 1, [2, 3, 4]], [1, 2, [5]]];
            shared.forEach(([a, b, list]) => list.forEach((sp, j) => {
              const A = D.inds.find((q) => q.site === a && q.s === sp && q.lead), B = D.inds.find((q) => q.site === b && q.s === sp && q.lead);
              g.carrow(A.tx + 15, A.ty, B.tx - 15, B.ty, -0.18, { color: SP[sp], w: 1.6, head: 0.01, alpha: 0.55 * S.tp(tB + 0.3 + j * 0.3, 0.8), dash: [4, 6] });
            }));
            g.text('shared species', 420, 300, { size: 21, color: PAL.ink3, align: 'center', alpha: S.tp(tB + 1.2, 0.8) });
          }
          g.math('\\bar{α} = \\frac{5 + 4 + 3}{3} = 4', 1096, 450, { size: 36, color: PAL.ochre, alpha: S.tp(tB + 1.6, 0.8) });
          g.math('β = \\frac{γ}{\\bar{α}} = \\frac{8}{4} = 2', 1096, 580, { size: 36, color: COL, alpha: S.tp(tB + 3.4, 0.8) });
          g.text('mean local richness', 1100, 380, { size: 21, color: PAL.ink3, alpha: S.tp(tB + 1.9, 0.8) });
          g.text('effective number of distinct sites', 1100, 650, { size: 21, color: PAL.ink3, alpha: S.tp(tB + 3.8, 0.8), maxW: 228 });
          // Whittaker's multiplicative form
          const wp = S.tp(tW + 1.2, 1.0);
          label(g, 'Whittaker’s multiplicative partition', 640, 812, S.tp(tW + 0.4, 0.8), PAL.ink3, 'center');
          g.math('γ = \\bar{α} × β', 590, 880, { size: 62, color: PAL.ink, align: 'center', alpha: wp });
          g.math('8 = 4 × 2', 800, 880, { size: 42, color: PAL.ink2, alpha: S.tp(tW + 2.4, 0.8) });
        });
        // ================= beat 2: turnover vs nestedness
        const v2 = vis(S, 2, 3);
        if (v2 > 0) g.withAlpha(v2, () => {
          const cs = 50, nr = 6, nc = 8, rich = [8, 6, 5, 3, 2, 1];
          const tT = cue(S, 2, 'turnover'), tN = cue(S, 2, 'nestedness');
          const panels = [
            { x0: 210, y0: 372, nm: 'Turnover', sym: 'β_{SIM}', sub: 'species replace one another along a gradient', on: tT, has: (i, j) => j >= i && j <= i + 2, rich: () => 3 },
            { x0: 818, y0: 372, nm: 'Nestedness', sym: 'β_{NES}', sub: 'poor sites hold subsets of richer sites', on: tN, has: (i, j) => j < rich[i], rich: (i) => rich[i] },
          ];
          g.text('Site × species incidence matrices', 140, 262, { size: 17, weight: 600, color: PAL.ink3, ls: 2.6, alpha: S.p(2, 0.8) });
          panels.forEach((pn, pi) => {
            const a0 = S.tp(pn.on - 0.6, 0.8);
            const W = nc * cs, H = nr * cs, X0 = pn.x0, Y0 = pn.y0;
            g.withAlpha(0.35 + 0.65 * a0, () => {
              g.text(pn.nm, X0, 318, { size: 36, role: 'display', color: PAL.ink, alpha: S.p(2, 0.8, 0.3 + pi * 0.4) });
              g.math(pn.sym, X0 + W, 318, { size: 30, color: COL, align: 'right', alpha: a0 });
              for (let j = 0; j < nc; j++) g.circle(X0 + j * cs + cs / 2, Y0 - 16, 7, { fill: SP[j], alpha: S.p(2, 0.8, 0.5) });
              for (let i = 0; i < nr; i++) {
                g.text(String(i + 1), X0 - 14, Y0 + i * cs + cs / 2 + 7, { size: 19, role: 'mono', color: PAL.ink3, align: 'right', alpha: S.p(2, 0.8, 0.5) });
                const pr = S.tp(pn.on + 0.2 + i * 0.32, 0.5);
                for (let j = 0; j < nc; j++) {
                  g.rect(X0 + j * cs + 3, Y0 + i * cs + 3, cs - 6, cs - 6, { stroke: PAL.rule, w: 1, r: 4, alpha: S.p(2, 0.8, 0.5) });
                  if (pn.has(i, j) && pr > 0) g.rect(X0 + j * cs + 5, Y0 + i * cs + 5, cs - 10, cs - 10, { fill: SP[j], r: 4, alpha: 0.85 * pr });
                }
                g.text(String(pn.rich(i)), X0 + W + 30, Y0 + i * cs + cs / 2 + 8, { size: 22, role: 'mono', color: pi ? PAL.ochre : PAL.ink2, align: 'center', alpha: pr });
              }
              g.math('S', X0 + W + 30, Y0 - 8, { size: 28, color: PAL.ink2, align: 'center', alpha: a0 });
              g.text('species', X0 + W / 2, Y0 - 40, { size: 19, color: PAL.ink3, align: 'center', alpha: S.p(2, 0.8, 0.5) });
              g.text('site', X0 - 10, Y0 - 10, { size: 19, color: PAL.ink3, align: 'right', alpha: S.p(2, 0.8, 0.5) });
              // boundary of the occupied region
              const bp = S.tp(pn.on + 2.4, 1.6);
              if (pi === 0) {
                g.line(X0, Y0, X0 + nr * cs, Y0 + H, { color: PAL.ink, w: 2.5, progress: bp, alpha: 0.8 });
                g.line(X0 + 3 * cs, Y0, X0 + 3 * cs + nr * cs - cs, Y0 + H - cs, { color: PAL.ink, w: 2.5, progress: bp, alpha: 0.8 });
                g.arrow(X0 - 76, Y0 + 6, X0 - 76, Y0 + H - 6, { color: PAL.ochre, w: 2.5, head: 13, alpha: a0 });
                g.with(() => { g.ctx.translate(X0 - 90, Y0 + H / 2); g.ctx.rotate(-Math.PI / 2); g.text('environmental gradient', 0, 0, { size: 19, color: PAL.ochre, align: 'center', alpha: a0 }); });
              } else {
                const st = [[X0, Y0]]; for (let i = 0; i < nr; i++) { st.push([X0 + rich[i] * cs, Y0 + i * cs]); st.push([X0 + rich[i] * cs, Y0 + (i + 1) * cs]); } st.push([X0, Y0 + H]);
                g.poly(st.slice(1), { color: PAL.ink, w: 2.5, progress: bp, alpha: 0.8 });
                // a poor site's set sits inside every richer site
                const hp = S.tp(pn.on + 3.0, 0.8);
                if (hp > 0) {
                  const ph = (t - pn.on - 3.0) / 1.1, k = Math.floor(ph) % 5, fr = ph - Math.floor(ph), row = 5 - k, w = rich[row] * cs;
                  const a = hp * Math.min(1, fr / 0.15, (1 - fr) / 0.15);
                  g.rect(X0 + 1, Y0 + row * cs + 1, w - 2, cs - 2, { stroke: PAL.ink, w: 3, r: 5, alpha: a });
                  g.rect(X0 + 1, Y0 + (row - 1) * cs + 1, w - 2, cs - 2, { stroke: PAL.ink, w: 2, r: 5, dash: [5, 5], alpha: a * clamp((fr - 0.2) / 0.2) });
                }
              }
              g.text(pn.sub, X0 + W / 2, Y0 + H + 52, { size: 22, color: PAL.ink2, align: 'center', alpha: a0 });
            });
          });
          g.math('β_{SOR} = β_{SIM} + β_{NES}', 640, 852, { size: 40, color: PAL.ink, align: 'center', alpha: S.tp(tN + 2.2, 1) });
          g.text('Sørensen dissimilarity = turnover + nestedness-resultant (Baselga 2010)', 640, 892, { size: 21, color: PAL.ink3, align: 'center', alpha: S.tp(tN + 2.8, 1) });
        });
        // ================= beat 3: assembly filters
        const v3 = S.p(3, 0.9);
        if (v3 > 0) g.withAlpha(v3, () => {
          const { FX, POOL, LOC } = D;
          const tPool = cue(S, 3, 'regional species pool');
          const fcol = [PAL.lagoon, PAL.ochre, PAL.coral];
          const fname = ['Dispersal', 'Environment', 'Biotic interactions'], fsub = ['who arrives', 'who tolerates local conditions', 'who remains'];
          const ft = [cue(S, 3, 'Dispersal determines'), cue(S, 3, 'environmental filtering determines'), cue(S, 3, 'biotic interactions')];
          // pool and local community
          label(g, 'Regional pool', POOL.x, 398, S.p(3, 0.8, 0.3), PAL.ink2, 'center');
          g.circle(POOL.x, POOL.y, POOL.r, { fill: PATCH_FILL, stroke: PAL.ink3, w: 2 });
          label(g, 'Local community', LOC.x, 398, S.p(3, 0.8, 0.6), PAL.ink2, 'center');
          g.circle(LOC.x, LOC.y, LOC.r, { fill: PATCH_FILL, stroke: PAL.ink2, w: 2, alpha: S.p(3, 0.8, 0.6) });
          g.line(POOL.x + POOL.r + 8, 830, LOC.x - LOC.r, 830, { color: PAL.rule, w: 1.5, alpha: 0 });
          // filters
          FX.forEach((x, f) => {
            const on = S.tp(ft[f] - 0.2, 0.8), dim = S.p(3, 0.8, 1.2 + f * 0.4);
            const c = U.mix(PAL.ink3, fcol[f], on);
            for (let k = 0; k < 10; k++) g.line(x, 412 + k * 28, x, 412 + k * 28 + 19, { color: c, w: 5, alpha: dim });
            g.glow(x, 545, 120, fcol[f], 0.18 * on);
            g.text(fname[f], x, 330, { size: 30, role: 'display', color: fcol[f], align: 'center', alpha: on });
            g.text(fsub[f], x, 362, { size: 21, color: PAL.ink2, align: 'center', alpha: on, maxW: 250 });
            g.text(['1', '2', '3'][f], x, 398, { size: 17, role: 'mono', color: PAL.ink3, align: 'center', alpha: dim * (1 - on) });
          });
          // the pool persists; propagules leave it and meet the filters
          const pa = S.tp(tPool - 0.4, 0.8);
          for (const q of D.pool) g.dot(q.x + 2.5 * Math.sin(t * 1.3 + q.ph), q.y + 2.5 * Math.cos(t * 1.1 + q.ph), 6, SP[q.s], pa * 0.9, 2.2);
          const v = D.v;
          for (const d of D.dots) {
            const tl = t - d.launch; if (tl <= 0) continue;
            const dist = tl * v, Ltot = d.cum[d.cum.length - 1];
            if (dist < Ltot) {
              let k = 1; while (d.cum[k] < dist) k++;
              const f = (dist - d.cum[k - 1]) / (d.cum[k] - d.cum[k - 1]);
              g.dot(lerp(d.pts[k - 1][0], d.pts[k][0], f), lerp(d.pts[k - 1][1], d.pts[k][1], f), 6.5, SP[d.s], clamp(tl / 0.3), 2.6);
            } else if (d.f === 3) {
              const e = d.pts[d.pts.length - 1]; g.dot(e[0] + 2.5 * Math.sin(t * 1.3 + d.ph), e[1] + 2.5 * Math.cos(t * 1.1 + d.ph), 6.5, SP[d.s], 1, 2.6);
            } else {
              const tf = (dist - Ltot) / v, e = d.pts[d.pts.length - 1];
              if (tf < 0.45) g.glow(e[0] + 12, e[1], 34, fcol[d.f], 0.8 * (1 - tf / 0.45));
              const b = ease.out(tf / 0.35), fl = ease.inOut((tf - 0.3) / 0.8);
              g.circle(lerp(e[0] - 22 * b, d.pile[0], fl), lerp(e[1], d.pile[1], fl), 6, { fill: SP[d.s], alpha: lerp(1, 0.6, fl) });
            }
          }
          ['never arrived', 'intolerant', 'outcompeted'].forEach((s, f) => g.text(s, FX[f], 790, { size: 21, color: PAL.ink3, align: 'center', alpha: S.tp(ft[f] + 1.4, 0.8) }));
          // Kraft et al. caution: the outcomes of competition masquerade as environmental filtering
          const kt = cue(S, 3, 'Kraft');
          const kp = S.tp(kt + 0.5, 1.2);
          if (kp > 0) {
            g.carrow(FX[2] - 40, 818, FX[1] + 40, 818, 0.2, { color: PAL.coral, w: 2.2, head: 13, dash: [6, 6], progress: kp });
            g.text('?', (FX[1] + FX[2]) / 2, 790, { size: 30, role: 'display', color: PAL.coral, align: 'center', alpha: S.tp(kt + 1.4, 0.6) });
            const ka = S.tp(kt + 2.0, 0.9);
            g.rect(140, 862, 1120, 52, { fill: 'rgba(232,115,90,0.08)', stroke: U.rgba(PAL.coral, 0.4), w: 1.2, r: 6, alpha: ka });
            g.text('Kraft et al. 2015: species excluded by competitors can look just like species excluded by the environment', 700, 896, { size: 21, color: PAL.ink, align: 'center', alpha: ka, maxW: 1090 });
          }
        });
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'mc-paradigms', title: 'Four paradigms',
      beats: [
        { t: 'Leibold and colleagues described four paradigms. In patch dynamics, patches are identical, and species coexist regionally through a competition–colonization trade-off: superior competitors are poor dispersers, so fugitive species persist by reaching empty patches first.',
          s: 'Lie-bold and colleagues described four paradigms. In patch dynamics, patches are identical, and species coexist regionally through a competition colonization trade-off: superior competitors are poor dispersers, so fugitive species persist by reaching empty patches first.' },
        { t: 'In species sorting, patches differ in environmental conditions, and each species does best in different ones. Dispersal is sufficient for species to reach suitable patches, so local composition tracks the environment. This is classic niche theory, set in space.' },
        { t: 'In mass effects, dispersal is so high that it overrides local fitness. Immigrants spill from patches where a species thrives into patches where it cannot persist alone, a community-wide source–sink dynamic that inflates local diversity. At extreme dispersal, the region homogenizes and diversity falls.',
          s: 'In mass effects, dispersal is so high that it overrides local fitness. Immigrants spill from patches where a species thrives into patches where it cannot persist alone, a community-wide source sink dynamic that inflates local diversity. At extreme dispersal, the region homogenizes and diversity falls.' },
        { t: 'And in the neutral paradigm, species are demographically equivalent, and composition drifts through chance births, deaths, and dispersal. We will return to it in the next chapter.', pause: 1 },
      ],
      terms: [
        { beat: 0.35, term: 'Patch dynamics', def: 'Paradigm of identical patches where coexistence arises from a competition–colonization trade-off.' },
        { beat: 0.65, term: 'Competition–colonization trade-off', def: 'Better competitors are poorer colonizers, allowing fugitive species to persist regionally.' },
        { beat: 1.3, term: 'Species sorting', def: 'Paradigm in which environmental heterogeneity and niche differences determine local composition.' },
        { beat: 2.3, term: 'Mass effects', def: 'Paradigm in which high dispersal sustains species in sink patches, decoupling composition from environment.' },
      ],
      init(S0) {
        const r = rng(404), dt = 0.25, N = Math.ceil(S0.dur / dt) + 4;
        const CW = 600, CH = 334;
        const cells = [{ x: 98, y: 224 }, { x: 732, y: 224 }, { x: 98, y: 578 }, { x: 732, y: 578 }];
        const PL = [[96, 190], [288, 182], [478, 190], [190, 284], [382, 288], [548, 280]];
        const E = [[0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5]];
        const others = (p) => E.filter(([a, b]) => a === p || b === p).map(([a, b]) => (a === p ? b : a));
        const slot = [[0, 0]]; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; slot.push([Math.cos(a) * 21, Math.sin(a) * 21]); }
        // --- patch dynamics: 0 empty, 1 fugitive, 2 superior competitor (Levins-type, with displacement).
        // Seeds are screened so the narrated window shows takeovers, local extinctions and fugitive recolonization.
        const w0 = cue(S0, 0, 'In patch dynamics'), w1 = S0.e(0);
        const runPD = (seed) => {
          const q = rng(seed); let st = [2, 1, 0, 1, 2, 0]; const pd = [st.slice()]; const ev = []; const pend = []; let take = 0, ext = 0, fcol = 0;
          for (let k = 1; k < N; k++) {
            const nx = st.slice(); const inW = k * dt > w0 && k * dt < w1 - 1;
            for (let i = pend.length - 1; i >= 0; i--) if (pend[i].land === k) { const e = pend[i]; pend.splice(i, 1); if (e.sp === 2) { if (nx[e.to] === 1 && inW) take++; nx[e.to] = 2; } else if (nx[e.to] === 0) { nx[e.to] = 1; if (inW) fcol++; } }
            for (let p = 0; p < 6; p++) {
              const nC = nx.filter((v) => v === 2).length, nF = nx.filter((v) => v === 1).length;
              if (nx[p] === 2 && nC > 1 && q() < 0.02) { nx[p] = 0; if (inW) ext++; }
              else if (nx[p] === 1 && nF > 1 && q() < 0.035) nx[p] = 0;
            }
            for (let p = 0; p < 6; p++) {
              if (st[p] === 2 && q() < 0.05) { const o = others(p); const to = o[Math.floor(q() * o.length)]; if (st[to] !== 2) { const e = { from: p, to, sp: 2, k, land: k + 6 }; pend.push(e); ev.push(e); } }
              if (st[p] === 1 && q() < 0.13) { const o = others(p); const to = o[Math.floor(q() * o.length)]; const e = { from: p, to, sp: 1, k, land: k + 3 }; pend.push(e); ev.push(e); }
            }
            st = nx; pd.push(st.slice());
          }
          return { pd, ev, ok: take >= 2 && ext >= 1 && fcol >= 3 };
        };
        let PDs; for (let seed = 1; seed < 400; seed++) { PDs = runPD(seed); if (PDs.ok) break; }
        const pd = PDs.pd, pdEv = PDs.ev;
        // --- species sorting / mass effects: environments and occasional dispersers
        const env = [0, 1, 2, 2, 0, 1];
        const ssEv = []; for (let tt = 0; tt < S0.dur; tt += 0.55 + r() * 0.5) { const from = Math.floor(r() * 6); const o = others(from); ssEv.push({ t: tt, from, to: o[Math.floor(r() * o.length)], dur: 1.1 }); }
        const meDel = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => r() * 2.4));
        // --- neutral drift: zero-sum replacement, mostly local births, some immigrants
        let ns = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => Math.floor(r() * 5)));
        const nd = [ns.map((a) => a.slice())]; const ndEv = [];
        for (let k = 1; k < N; k++) {
          ns = ns.map((a) => a.slice());
          for (let q = 0; q < 2; q++) {
            const p = Math.floor(r() * 6), j = Math.floor(r() * 7);
            if (r() < 0.8) ns[p][j] = ns[p][Math.floor(r() * 7)];
            else { const o = others(p); const from = o[Math.floor(r() * o.length)]; ns[p][j] = ns[from][Math.floor(r() * 7)]; ndEv.push({ k, from, to: p, sp: ns[p][j] }); }
          }
          nd.push(ns);
        }
        return { dt, CW, CH, cells, PL, E, slot, pd, pdEv, env, ssEv, meDel, nd, ndEv };
      },
      draw(g, t, S, D) {
        const { dt, CW, CH, cells, PL, E, slot } = D;
        const names = ['Patch dynamics', 'Species sorting', 'Mass effects', 'Neutral'];
        const desc = ['identical patches · competition–colonization trade-off', 'heterogeneous patches · moderate dispersal', 'heterogeneous patches · very high dispersal', 'equivalent species · drift and dispersal'];
        const ENV = [PAL.lagoon, PAL.ochre, PAL.moss], NCOL = [PAL.moss, PAL.ochre, PAL.lagoon, PAL.coral, PAL.heather];
        const t0 = [cue(S, 0, 'In patch dynamics'), cue(S, 1, 'In species sorting'), cue(S, 2, 'In mass effects'), cue(S, 3, 'And in the neutral')];
        const t1 = [S.e(0) + 0.4, S.e(1) + 0.4, S.e(2) + 0.4, S.e(3) + 0.4];
        const tAll = S.e(3) + 0.5;
        const fin = S.tp(tAll, 1.0);
        const ctime = (k) => (t < t0[k] ? t0[k] : t < t1[k] ? t : t1[k] + Math.max(0, t - tAll));
        const arc = (A, B, u, col, a, rad = 4.5, bend = 0.3) => {
          const L = { a: [A[0], A[1]], b: [B[0], B[1]] }; const dx = B[0] - A[0], dy = B[1] - A[1];
          L.c = [(A[0] + B[0]) / 2 - dy * bend, (A[1] + B[1]) / 2 + dx * bend];
          const n = 14, pts = []; for (let i = 0; i <= Math.round(n * u); i++) pts.push(bez(L.a, L.c, L.b, i / n));
          const tip = bez(L.a, L.c, L.b, u); pts.push(tip);
          if (pts.length > 1) g.poly(pts, { color: col, w: 1.6, alpha: 0.35 * a });
          g.dot(tip[0], tip[1], rad, col, a, 2.4);
        };
        cells.forEach((c, k) => {
          const intro = S.p(0, 0.7, 0.3 + k * 0.45);
          if (intro <= 0) return;
          const act = S.tp(t0[k] - 0.3, 0.6) * (1 - S.tp(t1[k] - 0.2, 0.6));
          const bright = Math.max(act, 0.85 * fin);
          const A = intro * (0.34 + 0.66 * bright);
          const tc = ctime(k);
          const P = (i) => [c.x + PL[i][0], c.y + PL[i][1]];
          const halo = bright > 0.5;
          const ind = (x, y, rr, col, a) => { if (halo) g.dot(x, y, rr, col, a, 2.3); else g.circle(x, y, rr, { fill: col, alpha: a }); };
          g.withAlpha(intro, () => {
            g.rect(c.x, c.y, CW, CH, { fill: 'rgba(14,29,31,0.5)', stroke: U.mix('#33413F', COL, act), w: lerp(1.2, 2.2, act), r: 8 });
          });
          g.withAlpha(A, () => {
            g.text(names[k], c.x + 24, c.y + 46, { size: 34, role: 'display', color: PAL.ink });
            g.text(desc[k], c.x + 24, c.y + 78, { size: 21, color: PAL.ink2, maxW: CW - 44 });
            // ---------------------------------------------------------- 1 patch dynamics
            if (k === 0) {
              const kk = Math.min(D.pd.length - 1, Math.floor(tc / dt)), f = clamp((tc - kk * dt) / 0.45);
              const now = D.pd[kk], prev = D.pd[Math.max(0, kk - 1)];
              const same = S.tp(cue(S, 0, 'patches are identical'), 0.6) * (1 - S.tp(cue(S, 0, 'patches are identical') + 2.2, 0.8));
              for (let i = 0; i < 6; i++) { const [x, y] = P(i); g.circle(x, y, 40, { fill: PATCH_FILL, stroke: U.mix(PAL.ink3, PAL.ink, same), w: 1.8 }); }
              for (const e of D.pdEv) {
                const ts = e.k * dt, te = e.land * dt; if (tc < ts || tc > te + 0.1) continue;
                const u = clamp((tc - ts) / (te - ts)); const a = P(e.from), b = P(e.to);
                arc(a, b, u, e.sp === 2 ? PAL.coral : PAL.ochre, act, e.sp === 2 ? 7 : 4.5, 0.32);
              }
              for (let i = 0; i < 6; i++) {
                const [x, y] = P(i);
                const drawState = (sv, a) => {
                  if (a <= 0) return;
                  if (sv === 2) for (let q = 0; q < 3; q++) { const an = q * 2.094 + 0.5; ind(x + Math.cos(an) * 13, y + Math.sin(an) * 13, 9, PAL.coral, a); }
                  if (sv === 1) for (let q = 0; q < 5; q++) { const an = q * 1.2566 + t * 0.6 + i; ind(x + Math.cos(an) * 22, y + Math.sin(an) * 22, 4.8, PAL.ochre, a); }
                };
                const changed = kk > 0 && now[i] !== prev[i];
                if (changed && f < 1) { drawState(prev[i], 1 - f); drawState(now[i], f); } else drawState(now[i], 1);
              }
              const lg = S.tp(cue(S, 0, 'superior competitors'), 0.8), lf = S.tp(cue(S, 0, 'fugitive species'), 0.8);
              g.dot(c.x + 32, c.y + 112, 8, PAL.coral, lg); g.text('superior competitor (slow)', c.x + 48, c.y + 119, { size: 21, color: PAL.coral, alpha: lg });
              g.dot(c.x + 330, c.y + 112, 5, PAL.ochre, lf); g.text('fugitive (fast)', c.x + 344, c.y + 119, { size: 21, color: PAL.ochre, alpha: lf });
            }
            // ---------------------------------------------------------- 2 species sorting
            if (k === 1) {
              const tEnv = cue(S, 1, 'patches differ'), tFit = cue(S, 1, 'each species does best'), tDisp = cue(S, 1, 'Dispersal is sufficient'), tTrack = cue(S, 1, 'local composition tracks');
              const ea = S.tp(tEnv, 1.0), fa = S.tp(tFit, 0.8), da = S.tp(tDisp, 0.8);
              E.forEach(([a, b]) => { const A2 = P(a), B2 = P(b); g.line(A2[0], A2[1], B2[0], B2[1], { color: PAL.lagoon, w: 1.6, dash: [3, 7], alpha: 0.5 * da }); });
              for (let i = 0; i < 6; i++) {
                const [x, y] = P(i), col = ENV[D.env[i]];
                g.circle(x, y, 40, { fill: PATCH_FILL, stroke: U.mix(PAL.ink3, col, ea), w: 2 });
                g.circle(x, y, 40, { fill: U.rgba(col, 0.16), alpha: ea });
                for (let j = 0; j < 7; j++) { const q = clamp((tc - tFit - j * 0.12 - i * 0.08) / 0.4); ind(x + slot[j][0], y + slot[j][1], 6, col, q); }
              }
              if (da > 0) for (const e of D.ssEv) {
                const tt = tDisp + e.t * 0.6 + 0.3; const u = (tc - tt) / e.dur; if (u < 0 || u > 2.6) continue;
                const a = P(e.from), b = P(e.to), col = ENV[D.env[e.from]];
                if (u <= 1) arc(a, b, u, col, act, 4.5, 0.25);
                else if (D.env[e.from] !== D.env[e.to]) { const fa2 = 1 - (u - 1) / 1.6; ind(b[0] + 30, b[1] - 26, 4.5, col, fa2); }
              }
              const la = S.tp(tTrack, 0.8);
              g.text('composition tracks environment', c.x + 24, c.y + 119, { size: 21, color: PAL.ink, alpha: la });
              g.pill('niche theory, in space', c.x + CW - 24, c.y + 40, { size: 19, color: PAL.ink2, align: 'right', alpha: S.tp(cue(S, 1, 'This is classic'), 0.8) });
            }
            // ---------------------------------------------------------- 3 mass effects
            if (k === 2) {
              const tHi = cue(S, 2, 'dispersal is so high'), tSp = cue(S, 2, 'Immigrants spill'), tInf = cue(S, 2, 'inflates'), tHom = cue(S, 2, 'At extreme');
              const fl = S.tp(tHi, 1.5), fl2 = S.tp(tHom, 2.0), on = S.tp(t0[2] - 0.2, 1.0);
              const wv = lerp(2, 7, fl) + 5 * fl2;
              E.forEach(([a, b], ei) => {
                const A2 = P(a), B2 = P(b); g.line(A2[0], A2[1], B2[0], B2[1], { color: PAL.lagoon, w: wv, alpha: 0.22 * Math.max(fl, 0.3) * on });
                const nd = Math.round(2 + 4 * fl + 4 * fl2);
                for (let q = 0; q < nd && fl > 0; q++) {
                  let u = ((tc * (0.35 + 0.25 * fl2)) + q / nd + ei * 0.13) % 1; const dir = q % 2; if (dir) u = 1 - u;
                  const src = dir ? b : a; const sp = fl2 > 0.5 ? 1 : D.env[src];
                  ind(lerp(A2[0], B2[0], u), lerp(A2[1], B2[1], u), 3.8, ENV[sp], fl * Math.sin(Math.PI * u));
                }
              });
              let alphaSum = 0;
              for (let i = 0; i < 6; i++) {
                const [x, y] = P(i), home = D.env[i], col = ENV[home];
                g.circle(x, y, 40, { fill: PATCH_FILL, stroke: U.mix(PAL.ink3, col, on), w: 2 });
                g.circle(x, y, 40, { fill: U.rgba(col, 0.16), alpha: on });
                const present = new Set();
                for (let j = 0; j < 7; j++) {
                  const imm = j >= 4 ? [(home + 1) % 3, (home + 2) % 3, (home + 1) % 3][j - 4] : home;
                  const m1 = j >= 4 ? clamp((tc - tSp - D.meDel[i][j]) / 0.6) : 0;
                  const m2 = clamp((tc - tHom - 0.4 - D.meDel[i][j] * 1.3) / 0.6);
                  let cc = U.mix(ENV[home], ENV[imm], m1); cc = U.mix(cc, ENV[1], m2);
                  present.add(m2 > 0.5 ? 1 : m1 > 0.5 ? imm : home);
                  ind(x + slot[j][0], y + slot[j][1], 6, cc, clamp((tc - t0[2] - 0.6 - j * 0.1 - i * 0.06) / 0.4));
                }
                alphaSum += present.size;
              }
              // source → sink annotation
              const sa = S.tp(tSp + 0.8, 0.8) * (1 - S.tp(tHom, 0.8));
              if (sa > 0) {
                const a = P(0), b = P(3);
                g.text('source', a[0], a[1] - 50, { size: 20, color: PAL.lagoon, align: 'center', alpha: sa });
                g.text('sink', b[0] - 58, b[1] + 6, { size: 20, color: PAL.lagoon, align: 'right', alpha: sa });
              }
              const ra = S.tp(tInf - 0.4, 0.8);
              const aBar = alphaSum / 6;
              g.math('\\bar{α} = ' + aBar.toFixed(1), c.x + CW - 24, c.y + 46, { size: 30, color: PAL.ochre, align: 'right', alpha: ra });
              g.text(fl2 > 0.4 ? 'homogenized: diversity falls' : 'sinks sustained by immigrants', c.x + 24, c.y + 119, { size: 21, color: fl2 > 0.4 ? PAL.coral : PAL.ink, alpha: S.tp(tSp + 1.6, 0.8) });
            }
            // ---------------------------------------------------------- 4 neutral
            if (k === 3) {
              const tEq = cue(S, 3, 'demographically equivalent'), tDr = cue(S, 3, 'composition drifts');
              const kk = Math.min(D.nd.length - 1, Math.floor(tc / dt)), f = clamp((tc - kk * dt) / 0.3);
              const now = D.nd[kk], prev = D.nd[Math.max(0, kk - 1)];
              const ea = S.tp(tEq - 0.6, 0.8);
              E.forEach(([a, b]) => { const A2 = P(a), B2 = P(b); g.line(A2[0], A2[1], B2[0], B2[1], { color: PAL.lagoon, w: 1.6, dash: [3, 7], alpha: 0.45 * ea }); });
              for (const e of D.ndEv) { const ts = e.k * dt - 0.9; if (tc < ts || tc > e.k * dt) continue; arc(P(e.from), P(e.to), (tc - ts) / 0.9, NCOL[e.sp], act * clamp((tc - tDr) / 0.5), 4, 0.25); }
              for (let i = 0; i < 6; i++) {
                const [x, y] = P(i); g.circle(x, y, 40, { fill: PATCH_FILL, stroke: PAL.ink3, w: 1.8 });
                for (let j = 0; j < 7; j++) {
                  const ch = now[i][j] !== prev[i][j] && f < 1;
                  const col = ch ? U.mix(NCOL[prev[i][j]], NCOL[now[i][j]], f) : NCOL[now[i][j]];
                  ind(x + slot[j][0], y + slot[j][1], 6, col, ea);
                  if (ch) g.circle(x + slot[j][0], y + slot[j][1], 6 + 10 * f, { stroke: PAL.ink, w: 1.5, alpha: (1 - f) * act });
                }
              }
              g.text('identical rates of birth, death and dispersal', c.x + 24, c.y + 119, { size: 21, color: PAL.ink, alpha: S.tp(tEq, 0.8) });
              g.pill('→ Chapter VIII', c.x + CW - 24, c.y + 40, { size: 19, color: COL, align: 'right', alpha: S.tp(cue(S, 3, 'We will return'), 0.8) });
            }
          });
        });
      },
    },
    {
      id: 'mc-dispersal', title: 'Dispersal & diagnosis',
      beats: [
        { t: 'Across these paradigms, dispersal rate is a master variable. Theory by Nicolas Mouquet and Michel Loreau predicts that local diversity peaks at intermediate dispersal, while beta diversity declines steadily as dispersal homogenizes the region, and regional diversity eventually falls too.',
          s: 'Across these paradigms, dispersal rate is a master variable. Theory by Nicolas Moo-kay and Michel Lor-oh predicts that local diversity peaks at intermediate dispersal, while beta diversity declines steadily as dispersal homogenizes the region, and regional diversity eventually falls too.', pause: 0.5 },
        { t: 'To diagnose which processes structure a real metacommunity, ecologists often use variation partitioning: how much variation in species composition is explained by environment alone, by spatial structure alone, and by both together. A large environmental fraction suggests species sorting; a large pure spatial fraction suggests dispersal limitation or drift.' },
        { t: 'Treat these fractions as clues, not verdicts. Unmeasured environmental variables that are spatially structured can masquerade as dispersal effects, and very different processes can leave similar statistical fingerprints.', pause: 1 },
      ],
      terms: [
        { beat: 0.5, term: 'Dispersal limitation', def: 'Failure of species to reach all suitable sites, leaving composition spatially structured.' },
        { beat: 1.3, term: 'Variation partitioning', def: 'Dividing explained compositional variation into pure environmental, pure spatial, and shared fractions.' },
      ],
      init() {
        // Mouquet & Loreau (2003)-style schematic: u = log10(dispersal)
        const gam = (u) => 1 + 3 / (1 + Math.exp((u + 1.0) / 0.22));
        const h = (u) => 0.62 / (1 + Math.exp(-(u + 2.4) / 0.3));
        const alp = (u) => 1 + (gam(u) - 1) * h(u);
        const bet = (u) => gam(u) - alp(u); // additive partition (Lande 1996; Loreau 2000)
        let uPk = -4, aPk = 0; for (let u = -4; u <= 0; u += 0.01) if (alp(u) > aPk) { aPk = alp(u); uPk = u; }
        // two maps with the same spatial fingerprint (diagonal bands of composition)
        const r = rng(9); const map = [];
        for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const v = (i + j) / 12 + (r() - 0.5) * 0.16; map.push({ i, j, c: v < 0.36 ? 0 : v < 0.66 ? 1 : 2, jx: (r() - 0.5) * 8, jy: (r() - 0.5) * 8 }); }
        return { gam, h, alp, bet, uPk, aPk, map };
      },
      draw(g, t, S, D) {
        const IC = [PAL.lagoon, PAL.ochre, PAL.moss, PAL.heather];
        // ================= beat 0: dispersal as a master variable
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          const tA = cue(S, 0, 'local diversity peaks'), tB = cue(S, 0, 'while beta'), tG = cue(S, 0, 'and regional diversity'), tTh = cue(S, 0, 'Theory by');
          label(g, 'Diversity across dispersal rates · after Mouquet & Loreau 2003', 140, 262, S.tp(tTh, 0.8));
          const A = g.axes({ x: 200, y: 310, w: 700, h: 420, xmin: 1e-4, xmax: 1, logx: true, ymin: 0, ymax: 4.4, progress: S.p(0, 1.2, 0.2), yticks: [1, 2, 3, 4].map((v) => ({ v, l: String(v) })) });
          g.with(() => { g.ctx.translate(140, 520); g.ctx.rotate(-Math.PI / 2); g.text('species diversity', 0, 0, { size: 22, color: PAL.ink2, align: 'center', alpha: S.p(0, 1, 0.8) }); });
          g.text('dispersal rate (log scale)  →', 550, 856, { size: 22, color: PAL.ink2, align: 'center', alpha: S.p(0, 1, 0.8) });
          g.text('low', A.X(1e-4), 762, { size: 20, color: PAL.ink3, align: 'left', alpha: S.p(0, 1, 0.8) });
          g.text('high', A.X(1), 762, { size: 20, color: PAL.ink3, align: 'right', alpha: S.p(0, 1, 0.8) });
          const swp = clamp((t - (tTh - 0.3)) / Math.max(1, S.e(0) - 0.6 - tTh));
          const us = lerp(-4, 0, lerp(swp, U.smooth(swp), 0.5));
          const past = clamp((us - D.uPk) / 0.25); // scanner has passed the α peak
          const ext = (tc) => Math.min(us, lerp(-4, 0, S.tp(tc, 1.4)));
          const P10 = (u) => Math.pow(10, u);
          // intermediate-dispersal band
          const ba = past * S.tp(tA, 0.8);
          g.rect(A.X(P10(D.uPk - 0.45)), A.y, A.X(P10(D.uPk + 0.45)) - A.X(P10(D.uPk - 0.45)), A.h, { fill: U.rgba(PAL.ochre, 0.07), alpha: ba });
          const curves = [[D.gam, PAL.lagoon, tG, 'regional γ'], [D.bet, COL, tB, 'between-site β'], [D.alp, PAL.ochre, tA, 'local α']];
          curves.forEach(([f, col, tc, nm]) => {
            const e = ext(tc); if (e <= -4) return;
            const pts = []; for (let u = -4; u < e; u += 0.025) pts.push([P10(u), f(u)]); pts.push([P10(e), f(e)]);
            const tip = g.data(A, pts, { color: col, w: 4 });
            if (tip) g.dot(tip[0], tip[1], 6.5, col, 1, 3);
          });
          // curve labels
          g.text('local α', A.X(P10(D.uPk)), A.Y(D.aPk) - 22, { size: 23, weight: 600, color: PAL.ochre, align: 'center', alpha: past * S.tp(tA, 0.8) });
          g.text('between-site β', A.X(P10(-3.75)), A.Y(D.bet(-3.75)) - 16, { size: 23, weight: 600, color: COL, alpha: S.tp(tB + 0.6, 0.8) });
          g.text('regional γ', A.X(P10(-3.75)), A.Y(D.gam(-3.75)) - 16, { size: 23, weight: 600, color: PAL.lagoon, alpha: S.tp(tG + 0.4, 0.8) });
          // scanner
          const sa = S.tp(tTh - 0.4, 0.6) * (1 - S.tp(S.e(0) + 0.3, 0.6));
          g.line(A.X(P10(us)), A.y, A.X(P10(us)), A.y + A.h, { color: PAL.ink, w: 1.5, alpha: 0.5 * sa, dash: [4, 6] });
          // zones
          [[-4, -2.6, 'dispersal-limited'], [D.uPk - 0.45, D.uPk + 0.45, 'mass effects'], [-0.7, 0, 'homogenized']].forEach(([u0, u1, nm], k) => {
            const pk = clamp((us - u0) / 0.35) * S.tp(tA, 0.8);
            g.line(A.X(P10(u0)) + 4, 812, A.X(P10(u1)) - 4, 812, { color: PAL.ink3, w: 1.5, alpha: pk });
            g.text(nm, (A.X(P10(u0)) + A.X(P10(u1))) / 2, 802, { size: 21, color: PAL.ink2, align: 'center', alpha: pk });
          });
          // inset: the metacommunity at the scanner's dispersal rate
          const ia = S.tp(tTh, 0.8);
          g.withAlpha(ia, () => {
            const ux = us, hh = D.h(ux) / 0.62, gg = (D.gam(ux) - 1) / 3;
            const nIm = Math.round(4 * hh), nDom = Math.round(7 * (1 - gg));
            const C = [[1035, 400], [1205, 400], [1035, 565], [1205, 565]];
            label(g, 'at this dispersal rate', 1120, 320, 1, PAL.ink3, 'center');
            const fl = clamp((ux + 4) / 3.4);
            [[0, 1], [2, 3], [0, 2], [1, 3]].forEach(([a, b], ei) => {
              const [x1, y1] = C[a], [x2, y2] = C[b]; g.line(x1, y1, x2, y2, { color: PAL.lagoon, w: 1 + 7 * fl * fl, alpha: 0.25 });
              for (let q = 0; q < Math.round(1 + 5 * fl); q++) { let u = (t * 0.5 + q / (1 + 5 * fl) + ei * 0.3) % 1; if (q % 2) u = 1 - u; g.circle(lerp(x1, x2, u), lerp(y1, y2, u), 3.5, { fill: PAL.lagoon, alpha: 0.8 * Math.sin(Math.PI * u) }); }
            });
            C.forEach(([x, y], i) => {
              g.circle(x, y, 58, { fill: PATCH_FILL, stroke: U.rgba(IC[i], 0.7), w: 2 });
              for (let j = 0; j < 7; j++) {
                const sp = j < nDom ? 1 : j >= 7 - nIm ? (i + 1 + j) % 4 : i;
                const a = j === 0 ? [0, 0] : [Math.cos(j * 1.047 + 0.4) * 30, Math.sin(j * 1.047 + 0.4) * 30];
                g.dot(x + a[0], y + a[1], 8, IC[sp], 1, 2.2);
              }
            });
            const ra = S.tp(tA, 0.8);
            const al = D.alp(ux), be = D.bet(ux), ga = D.gam(ux);
            g.math('α = ' + al.toFixed(1), 990, 700, { size: 32, color: PAL.ochre, alpha: ra });
            g.math('β = ' + be.toFixed(1), 990, 748, { size: 32, color: COL, alpha: S.tp(tB, 0.8) });
            g.math('γ = ' + ga.toFixed(1), 990, 796, { size: 32, color: PAL.lagoon, alpha: S.tp(tG, 0.8) });
            g.text('additive: γ = α + β', 1150, 748, { size: 20, color: PAL.ink3, alpha: S.tp(tB + 0.8, 0.8) });
          });
        });
        // ================= beats 1–2: variation partitioning
        const v1 = S.p(1, 0.9);
        if (v1 > 0) g.withAlpha(v1, () => {
          const ctx = g.ctx;
          const R = { x: 120, y: 300, w: 545, h: 432 }, EC = { x: 325, y: 505, r: 150 }, SC = { x: 465, y: 505, r: 135 };
          const tE = cue(S, 1, 'by environment alone'), tSp = cue(S, 1, 'by spatial structure alone'), tBo = cue(S, 1, 'and by both together'), tLE = cue(S, 1, 'A large environmental'), tLS = cue(S, 1, 'a large pure spatial');
          const tD = S.e(1) - 7.6;
          const tCl = cue(S, 2, 'Treat these'), tUn = cue(S, 2, 'Unmeasured'), tDiff = cue(S, 2, 'and very different');
          const regionPath = (k) => { // 0 a, 1 b, 2 c, 3 d
            const circ = (C) => { ctx.moveTo(C.x + C.r, C.y); ctx.arc(C.x, C.y, C.r, 0, Math.PI * 2); };
            const rectP = () => ctx.rect(R.x, R.y, R.w, R.h);
            if (k === 0) { ctx.beginPath(); circ(EC); ctx.clip(); ctx.beginPath(); rectP(); circ(SC); return 'evenodd'; }
            if (k === 2) { ctx.beginPath(); circ(SC); ctx.clip(); ctx.beginPath(); rectP(); circ(EC); return 'evenodd'; }
            if (k === 1) { ctx.beginPath(); circ(EC); ctx.clip(); ctx.beginPath(); circ(SC); return 'nonzero'; }
            ctx.beginPath(); rectP(); circ(EC); ctx.clip('evenodd'); ctx.beginPath(); rectP(); circ(SC); return 'evenodd';
          };
          const FC = [PAL.moss, PAL.mint, PAL.lagoon, PAL.ink3];
          const fill = (k, a) => { if (a <= 0) return; g.with(() => { const rule = regionPath(k); ctx.globalAlpha *= a; ctx.fillStyle = U.rgba(FC[k], k === 3 ? 0.12 : 0.28); ctx.fill(rule); }); };
          const ft = [tE, tBo, tSp, tD];
          label(g, 'Variation in community composition', R.x, 270, S.p(1, 0.8, 0.3));
          g.rect(R.x, R.y, R.w, R.h, { stroke: PAL.ink3, w: 1.8, r: 6, alpha: S.p(1, 0.8, 0.4) });
          for (let k = 0; k < 4; k++) { const on = S.tp(ft[k], 0.6); const pulse = on * (1 + 0.8 * Math.max(0, 1 - (t - ft[k]) / 1.2)); fill(k, Math.min(1.6, pulse)); }
          g.circle(EC.x, EC.y, EC.r, { stroke: PAL.moss, w: 2.5, alpha: S.p(1, 1, 0.8) });
          g.circle(SC.x, SC.y, SC.r, { stroke: PAL.lagoon, w: 2.5, alpha: S.p(1, 1, 1.4) });
          g.text('Environment', 205, 352, { size: 24, weight: 600, color: PAL.moss, align: 'center', alpha: S.p(1, 0.8, 1.0) });
          g.text('Space', 585, 370, { size: 24, weight: 600, color: PAL.lagoon, align: 'center', alpha: S.p(1, 0.8, 1.6) });
          g.math('X', 205, 384, { size: 26, color: PAL.moss, align: 'center', alpha: S.p(1, 0.8, 1.0) * 0 });
          [['[a]', 245], ['[b]', 395], ['[c]', 548]].forEach(([s2, x], k) => g.text(s2, x, 515, { size: 32, role: 'math', color: PAL.ink, align: 'center', alpha: S.tp([tE, tBo, tSp][k], 0.6) }));
          g.text('[d]', 625, 712, { size: 32, role: 'math', color: PAL.ink, align: 'right', alpha: S.tp(tD, 0.6) });
          g.text('partial RDA · Borcard, Legendre & Drapeau 1992', R.x, 776, { size: 21, italic: true, color: PAL.ink3, alpha: S.p(1, 0.8, 2.5) * (1 - S.tp(cue(S, 2, 'Unmeasured'), 0.6)) });
          // ---- right: stacked bar and legend (beat 1)
          const rb = vis(S, 1, 2);
          g.withAlpha(rb, () => {
            const BX = 760, BW = 560, fr = [0.30, 0.11, 0.13, 0.46];
            label(g, 'Fractions of variation (adjusted R²)', BX, 270, S.p(1, 0.8, 0.6));
            let x = BX;
            fr.forEach((v, k) => {
              const p = S.tp(ft[k], 0.8), w = BW * v;
              g.rect(x, 300, w * p, 50, { fill: U.rgba(FC[k], k === 3 ? 0.25 : 0.75), r: 3 });
              g.text(['[a]', '[b]', '[c]', '[d]'][k], x + w / 2, 333, { size: 22, role: 'math', color: k === 3 ? PAL.ink2 : PAL.bg, align: 'center', alpha: clamp(p * 2 - 1) });
              x += w;
            });
            g.rect(BX, 300, BW, 50, { stroke: PAL.ink3, w: 1.2, r: 3, alpha: S.p(1, 0.8, 0.6) });
            const leg = [['[a]', 'environment alone'], ['[b]', 'shared: spatially structured environment'], ['[c]', 'space alone'], ['[d]', 'unexplained']];
            [0, 2, 1, 3].forEach((k, row) => {
              const a = S.tp(ft[k] + 0.2, 0.7), y = 398 + row * 36;
              g.rect(BX, y - 15, 16, 16, { fill: U.rgba(FC[k], k === 3 ? 0.3 : 0.85), r: 3, alpha: a });
              g.text(leg[k][0] + '  ' + leg[k][1], BX + 28, y, { size: 21, color: PAL.ink2, alpha: a });
            });
            // interpretation rows
            const rows = [[tLE, [0.55, 0.08, 0.04, 0.33], 'species sorting', PAL.moss], [tLS, [0.06, 0.06, 0.42, 0.46], 'dispersal limitation or drift', PAL.lagoon]];
            rows.forEach(([tc, f4, nm, col], k) => {
              const a = S.tp(tc, 0.8), y = 620 + k * 112;
              if (a <= 0) return;
              g.withAlpha(a, () => {
                let xx = BX; f4.forEach((v, j) => { g.rect(xx, y, 220 * v * clamp(S.tp(tc + 0.15 * j, 0.5)), 36, { fill: U.rgba(FC[j], j === 3 ? 0.25 : 0.75), r: 2 }); xx += 220 * v; });
                g.text(k ? 'large [c]' : 'large [a]', BX, y - 14, { size: 21, color: PAL.ink3 });
                g.arrow(BX + 234, y + 18, BX + 282, y + 18, { color: col, w: 2.5, head: 12, progress: S.tp(tc + 0.5, 0.5) });
                g.text(k ? 'dispersal limitation' : 'species sorting', BX + 296, y + (k ? 12 : 27), { size: 27, weight: 600, color: col, alpha: S.tp(tc + 0.8, 0.6) });
                if (k) g.text('or drift', BX + 296, y + 44, { size: 27, weight: 600, color: col, alpha: S.tp(tc + 1.6, 0.6) });
              });
            });
          });
          // ---- beat 2: clues, not verdicts
          const b2 = S.p(2, 0.9);
          g.withAlpha(b2, () => {
            g.text('Clues, not verdicts.', 1040, 318, { size: 46, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: S.tp(tCl, 0.9) });
            // a hidden, spatially structured environmental variable sits inside "space"
            const ua = S.tp(tUn, 1.0);
            g.with(() => { ctx.beginPath(); ctx.ellipse(560, 520, 78, 112, 0.15, 0, Math.PI * 2); ctx.setLineDash([7, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.moss; ctx.globalAlpha *= ua; ctx.stroke(); ctx.fillStyle = U.rgba(PAL.moss, 0.16); ctx.fill(); });
            const ta = S.tp(tUn + 0.6, 0.8);
            g.line(560, 634, 560, 752, { color: PAL.moss, w: 1.5, alpha: ta, dash: [3, 4] });
            g.text('unmeasured, spatially structured environment', R.x, 780, { size: 22, color: PAL.moss, alpha: ta });
            g.text('… is counted as “space”', R.x, 810, { size: 22, italic: true, color: PAL.ink, alpha: S.tp(tUn + 2.2, 0.8) });
            // two processes, one fingerprint
            const da = S.tp(tDiff, 1.0);
            const maps = [[790, 'dispersal limitation'], [1080, 'hidden gradient']];
            maps.forEach(([mx, nm], k) => {
              const a = S.tp(tDiff + k * 0.8, 0.8); if (a <= 0) return;
              g.withAlpha(a, () => {
                const my = 400, sz = 230, cs = sz / 7;
                if (k === 1) { const gr = ctx.createLinearGradient(mx, my, mx + sz, my + sz); gr.addColorStop(0, U.rgba(PAL.lagoon, 0.25)); gr.addColorStop(0.5, U.rgba(PAL.ochre, 0.2)); gr.addColorStop(1, U.rgba(PAL.moss, 0.25)); g.with(() => { ctx.fillStyle = gr; ctx.fillRect(mx, my, sz, sz); }); }
                g.rect(mx, my, sz, sz, { stroke: PAL.ink3, w: 1.5, r: 4 });
                for (const q of D.map) g.circle(mx + (q.i + 0.5) * cs + q.jx, my + (q.j + 0.5) * cs + q.jy, 8, { fill: [PAL.lagoon, PAL.ochre, PAL.moss][q.c] });
                if (k === 0) { const pr = S.tp(tDiff + 0.6, 1.4); [[0.15, 0.45], [0.45, 0.15], [0.3, 0.3]].forEach(([fx, fy]) => g.arrow(mx + 18, my + 18, mx + 18 + sz * fx * 1.2, my + 18 + sz * fy * 1.2, { color: PAL.ink, w: 2.2, head: 11, progress: pr })); }
                g.text(nm, mx + sz / 2, my + sz + 34, { size: 22, color: PAL.ink, align: 'center' });
                g.text(k ? 'environment varies in space' : 'spread from founders', mx + sz / 2, my + sz + 62, { size: 21, color: PAL.ink3, align: 'center' });
              });
            });
            g.text('≈', 1050, 528, { size: 52, color: PAL.ink, align: 'center', alpha: S.tp(tDiff + 1.6, 0.6) });
            g.text('different processes, similar statistical fingerprints', 1050, 780, { size: 23, color: PAL.ochre, align: 'center', alpha: S.tp(tDiff + 2.4, 0.8), maxW: 560 });
          });
        });
      },
    },
  ],
});
})();
