/* Chapter VIII — Neutral theory. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.sand;

// Small shared helpers ---------------------------------------------------------
const label = (g, s, x, y, a = 1, col = PAL.ink3) => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a });
// visibility envelope: fade in at beat k0, fade out at beat k1 (optional)
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
// window with delays: in at beat a (+da s), out at beat b (+db s)
const win = (S, a, da, b, db, d = 0.8) => S.p(a, d, da) * (b === undefined ? 1 : 1 - S.p(b, 0.6, db));
// Sentence-anchored timing (robust to re-synthesized narration): local time at fraction f of sentence j in beat k.
const sent = (S, k, j, f = 0) => { const B = S.scene.timing.beats[k]; if (!B) return S.dur; const q = B.sents[Math.min(j, B.sents.length - 1)]; return lerp(q.start, q.end, f); };
const P = (S, k, j, f = 0, d = 0.8) => S.tp(sent(S, k, j, f), d);
// in at absolute local time t0, out at t1
const twin = (t, t0, t1, d = 0.6) => ease.out((t - t0) / d) * (t1 === undefined ? 1 : 1 - ease.inOut((t - t1) / 0.5));
const DARK = 'rgba(9,19,21,0.86)';
// Axis titles placed clear of tick labels.
const xTitle = (g, A, s, a = 1) => g.text(s, A.x + A.w, A.y + A.h + 58, { size: 21, color: PAL.ink2, align: 'right', alpha: a });
const yTitle = (g, A, s, a = 1) => g.text(s, A.x - 14, A.y - 24, { size: 21, color: PAL.ink2, align: 'right', alpha: a });

function hslHex(h, s, l) {
  s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
// Twenty distinguishable pigment hues (golden-angle walk) + a 21st for a brand-new species.
const NS = 20;
const SPC = Array.from({ length: NS }, (_, k) => hslHex((32 + k * 137.508) % 360, [62, 54, 70][k % 3], [66, 76, 58][k % 3]));
SPC.push('#FFF4D8');

// Pre-rendered luminous dot (core + halo) for fast blitting.
function makeSprite(color, r, halo = 2.4) {
  const R = Math.ceil(r * halo) + 1, c = Theater.makeCanvas(2 * R, 2 * R);
  Theater.makeG(c.getContext('2d')).dot(R, R, r, color, 1, halo);
  return { c, R };
}
function blit(ctx, sp, x, y, a, sc = 1) {
  if (a <= 0) return; const b = ctx.globalAlpha; ctx.globalAlpha = b * a;
  if (sc === 1) ctx.drawImage(sp.c, x - sp.R, y - sp.R); else ctx.drawImage(sp.c, x - sp.R * sc, y - sp.R * sc, 2 * sp.R * sc, 2 * sp.R * sc);
  ctx.globalAlpha = b;
}
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function poisson(r, lam) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
// Little four-point sparkle (point speciation).
function sparkle(g, x, y, s, color, a = 1, rot = 0) {
  if (a <= 0) return; const ctx = g.ctx;
  g.glow(x, y, s * 1.6, color, 0.5 * a);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4, rr = k % 2 ? s * 0.22 : s; const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function crossX(g, x, y, s, color, a = 1, w = 3) { g.line(x - s, y - s, x + s, y + s, { color, w, alpha: a }); g.line(x - s, y + s, x + s, y - s, { color, w, alpha: a }); }

/* Zero-sum multinomial: expected species per log2 abundance class (1, 2–3, 4–7, …, 2048–4095) for a local
   community of J = 21,000 with θ = 48, computed from Volkov et al. (2003, Nature) eq. for each m; the first
   row (m = 1) is the Ewens sampling expectation of a log-series metacommunity. Σ = 293 (m = 1), 227 (m = 0.1). */
const ZM = [1, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01, 0.005];
const ZT = [
  [47.89, 39.79, 36.03, 33.97, 32.36, 30.39, 27.26, 22.14, 14.70, 6.56, 1.36, 0.06],
  [27.78, 31.04, 33.44, 33.62, 32.32, 30.33, 27.17, 22.02, 14.59, 6.55, 1.42, 0.08],
  [23.72, 27.04, 30.64, 32.62, 32.21, 30.34, 27.18, 22.03, 14.61, 6.57, 1.42, 0.08],
  [18.59, 21.16, 24.98, 28.85, 30.95, 30.22, 27.21, 22.09, 14.68, 6.63, 1.45, 0.09],
  [15.00, 16.70, 19.73, 23.66, 27.38, 28.98, 27.13, 22.19, 14.82, 6.74, 1.50, 0.09],
  [13.00, 14.17, 16.54, 19.91, 23.74, 26.63, 26.47, 22.26, 15.00, 6.90, 1.56, 0.10],
  [11.69, 12.51, 14.41, 17.24, 20.74, 24.01, 25.14, 22.13, 15.21, 7.10, 1.65, 0.11],
  [9.83, 10.22, 11.44, 13.41, 16.02, 18.97, 21.20, 20.61, 15.51, 7.70, 1.91, 0.14],
  [8.29, 8.37, 9.11, 10.38, 12.13, 14.25, 16.29, 17.08, 14.66, 8.54, 2.51, 0.23],
];
function zsmAt(m) {
  if (m >= ZM[0]) return ZT[0].slice();
  for (let i = 0; i < ZM.length - 1; i++) {
    if (m <= ZM[i] && m >= ZM[i + 1]) { const f = Math.log(m / ZM[i]) / Math.log(ZM[i + 1] / ZM[i]); return ZT[i].map((v, k) => lerp(v, ZT[i + 1][k], f)); }
  }
  return ZT[ZT.length - 1].slice();
}
const OCT_LAB = ['1', '2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048'];

// Smooth curve through bar-centre points (Catmull–Rom), returned as screen points.
function smoothPts(P, n = 10) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map((d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  out.push(P[P.length - 1]); return out;
}

/* ---------------------------------------------------------- neutral community simulations (scene 1) */
const GC = 32, GR = 22, GJ = GC * GR, CELL = 19, GX = 150, GY = 300;

function runClosed(seed, px, py) {
  const r = rng(seed); const J = GJ;
  const w = []; let tot = 0; for (let k = 0; k < NS; k++) { const v = Math.pow(0.8, k) * (0.7 + 0.6 * r()); w.push(v); tot += v; }
  const st = new Uint8Array(J), ab = new Int32Array(NS + 1);
  for (let i = 0; i < J; i++) { let u = r() * tot, k = 0; while (k < NS - 1 && u > w[k]) { u -= w[k]; k++; } st[i] = k; ab[k]++; }
  const MAX = 900000; const dead = new Uint16Array(MAX), sp = new Uint8Array(MAX);
  const snaps = [], recs = []; let S = 0; for (const a of ab) if (a) S++;
  const slow = [], used = new Set();
  const pickSlow = () => {
    for (let tries = 0; tries < 20000; tries++) {
      const d = (r() * J) | 0, p = (r() * J) | 0;
      const cd = d % GC, rd = (d / GC) | 0, cp = p % GC, rp = (p / GC) | 0;
      if (cd < 2 || cd > GC - 4 || rd < 4 || rd > GR - 3 || cp < 2 || cp > GC - 4 || rp < 4 || rp > GR - 3) continue;
      const dist = Math.hypot(px[d] - px[p], py[d] - py[p]); if (dist < 120 || dist > 260) continue;
      if (st[d] === st[p] || used.has(d) || used.has(p)) continue;
      const mx = (px[d] + px[p]) / 2, my = (py[d] + py[p]) / 2;
      if (slow.some(([d2, p2]) => Math.hypot((px[d2] + px[p2]) / 2 - mx, (py[d2] + py[p2]) / 2 - my) < 150)) continue;
      used.add(d); used.add(p); return [d, p];
    }
    return [0, 1];
  };
  let n = 0;
  while (S > 1 && n < MAX) {
    if ((n & 511) === 0) snaps.push(st.slice());
    if ((n & 63) === 0) recs.push(Uint16Array.from(ab.subarray(0, NS)));
    let d, p;
    if (n < 4) { [d, p] = pickSlow(); slow.push([d, p]); } else { d = (r() * J) | 0; p = (d + 1 + ((r() * (J - 1)) | 0)) % J; }
    const a = st[d], b = st[p]; dead[n] = d; sp[n] = b;
    if (a !== b) { ab[a]--; ab[b]++; if (!ab[a]) S--; st[d] = b; }
    n++;
  }
  if (S > 1) return null;
  if ((n & 511) === 0) snaps.push(st.slice());
  if ((n & 63) === 0) recs.push(Uint16Array.from(ab.subarray(0, NS)));
  return { n, dead, sp, snaps, recs, slow, w, winner: st[0], final: st.slice() };
}
function runOpen(seed, px, py, winner, NO, KS, m, w) {
  const r = rng(seed); const J = GJ;
  let tot = 0; for (const v of w) tot += v;
  const dead = new Uint16Array(NO); for (let e = 0; e < NO; e++) dead[e] = (r() * J) | 0;
  // the speciating individual is one that is not killed again before the scene ends
  const killed = new Uint8Array(J); for (let e = KS + 1; e < NO; e++) killed[dead[e]] = 1;
  let ds = -1, best = 1e9;
  for (let i = 0; i < J; i++) { if (killed[i]) continue; const c = i % GC, rw = (i / GC) | 0; const sc = Math.hypot(c - 9, rw - 9) + r() * 3; if (sc < best) { best = sc; ds = i; } }
  dead[KS] = ds;
  const st = new Uint8Array(J).fill(winner), sp = new Uint8Array(NO), imm = new Uint8Array(NO);
  const ab = new Int32Array(NS + 1); ab[winner] = J; let S = 1; const snaps = [], rich = [];
  for (let e = 0; e < NO; e++) {
    if ((e & 511) === 0) snaps.push(st.slice());
    if ((e & 31) === 0) rich.push(S);
    const d = dead[e]; let b;
    if (e === KS) b = NS;
    else if (r() < m) { let u = r() * tot, k = 0; while (k < NS - 1 && u > w[k]) { u -= w[k]; k++; } b = k; imm[e] = 1; }
    else { const p = (d + 1 + ((r() * (J - 1)) | 0)) % J; b = st[p]; }
    sp[e] = b; const a = st[d];
    if (a !== b) { ab[a]--; if (!ab[a]) S--; if (!ab[b]) S++; ab[b]++; st[d] = b; }
  }
  if ((NO & 511) === 0) snaps.push(st.slice());
  rich.push(S);
  return { n: NO, dead, sp, imm, snaps, rich, ds };
}

/* ---------------------------------------------------------------- chapter */
Theater.chapter({
  id: 'neu', roman: 'VIII', title: 'Neutral Theory', color: COL,
  question: 'What if species differences didn’t matter at all?',
  intro: { t: 'Chapter eight. Neutral theory: what chance and dispersal alone can explain.' },
  motif(g, t) {
    // Drifting relative abundances: some lineages fix, others are lost.
    const r = rng(77); const p = ease.inOut((t - 0.5) / 3.4);
    const X = (k) => 1120 + k * 6.3, Y = (v) => 345 - v * 225;
    g.line(X(0), Y(0), X(105), Y(0), { color: COL, w: 1.2, alpha: 0.16 * p });
    g.line(X(0), Y(1), X(105), Y(1), { color: COL, w: 1.2, alpha: 0.16 * p });
    for (let j = 0; j < 8; j++) {
      let x = 0.5; const pts = [[X(0), Y(x)]];
      for (let k = 1; k <= 105; k++) { if (x > 0 && x < 1) x = clamp(x + gauss(r) * 0.1 * Math.sqrt(x * (1 - x))); pts.push([X(k), Y(x)]); }
      g.poly(pts, { color: COL, w: 2, alpha: 0.3, progress: p });
    }
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'neu-premise', title: 'Ecological equivalence',
      beats: [
        { t: 'Niche theory explains coexistence through differences. In 2001, Stephen Hubbell’s Unified Neutral Theory of Biodiversity and Biogeography asked a provocative question: how much of nature’s pattern could we explain if species had no differences at all?' },
        { t: 'Neutral theory assumes ecological equivalence: every individual of every species has identical per-capita chances of birth, death, dispersal, and speciation. It is a theory built on individuals, not on species traits.' },
        { t: 'Communities are zero-sum: a fixed number of individuals, J, saturates the landscape. Whenever one dies, it is replaced by the offspring of another, chosen at random. Species abundances therefore wander by chance, a process called ecological drift, directly analogous to genetic drift in Motoo Kimura’s neutral theory of molecular evolution.', pause: 0.8 },
        { t: 'In an isolated community, drift alone eventually leads to monodominance: one species takes over. Diversity persists only if it is replenished, by immigration from outside, and, over the longest timescales, by speciation.', pause: 1.5 },
      ],
      terms: [
        { beat: 1.2, term: 'Ecological equivalence', def: 'Identical per-capita rates of birth, death, dispersal, and speciation for all individuals of all species.' },
        { beat: 2.2, term: 'Zero-sum dynamics', def: 'A community of fixed size J in which each death is matched by one birth or immigrant.' },
        { beat: 2.6, term: 'Ecological drift', def: 'Random change in species’ relative abundances due to demographic stochasticity.' },
        { beat: 3.3, term: 'Monodominance', def: 'Fixation of a single species, the inevitable endpoint of drift in a closed neutral community.' },
      ],
      init(S0) {
        const J = GJ, r = rng(808);
        const px = new Float32Array(J), py = new Float32Array(J), ph = new Float32Array(J), rev = new Float32Array(J);
        for (let i = 0; i < J; i++) {
          const c = i % GC, rw = (i / GC) | 0;
          px[i] = GX + (c + 0.5) * CELL + (r() - 0.5) * 5; py[i] = GY + (rw + 0.5) * CELL + (r() - 0.5) * 5;
          ph[i] = r() * 6.283; rev[i] = (c / GC) * 0.55 + r() * 0.45;
        }
        let C = null; for (let seed = 11; seed < 80; seed++) { C = runClosed(seed, px, py); if (C && C.n > 160000 && C.n < 520000) break; }
        // timeline (scene-local seconds)
        const slow0 = sent(S0, 2, 1, 0) + 0.05, ev = clamp((sent(S0, 2, 1, 1) - slow0 + 0.3) / 4, 0.9, 1.3);
        const T = { slow0, ev, nSlow: 4, drift0: Math.max(slow0 + 4 * ev + 0.1, sent(S0, 2, 2, 0)), ff0: S0.b(3) + 0.3, ff1: sent(S0, 3, 0, 0.8), open0: sent(S0, 3, 1, 0.3), spec: sent(S0, 3, 1, 0.9), end: S0.dur };
        const R = 900, T1 = 3;
        const driftS = (tau) => 4 + (tau < T1 ? R * tau * tau / (2 * T1) : R * T1 / 2 + R * (tau - T1));
        const s1 = driftS(T.ff0 - T.drift0), F = C.n, L = Math.log(F / s1);
        const closedS = (t) => {
          if (t < T.slow0) return 0;
          if (t < T.slow0 + T.nSlow * T.ev) return Math.floor((t - T.slow0) / T.ev);
          if (t < T.drift0) return T.nSlow;
          if (t < T.ff0) return driftS(t - T.drift0);
          const x = clamp((t - T.ff0) / (T.ff1 - T.ff0)); if (x >= 1) return F;
          return Math.min(F - 1, s1 * Math.exp(L * (0.25 * x + 0.75 * x * x)));
        };
        const NO = 12000, tauC = 1.3, tauMax = T.end - T.open0 + 0.05;
        const Aop = NO / (1 - Math.exp(-tauMax / tauC));
        const openS = (t) => Math.min(NO, Aop * (1 - Math.exp(-Math.max(0, t - T.open0) / tauC)));
        const KS = Math.floor(openS(T.spec));
        T.specVis = T.open0 - tauC * Math.log(1 - (KS + 1) / Aop);
        const wOpen = C.w.map((v, k) => Math.pow(0.86, k) * (0.8 + 0.4 * ((k * 7919) % 13) / 13));
        const O = runOpen(99, px, py, C.winner, NO, KS, 0.12, wOpen);
        const buf = new Uint8Array(J);
        const stateAt = (sim, s) => {
          s = Math.max(0, Math.min(sim.n, s | 0)); const k = s >> 9; buf.set(sim.snaps[k]);
          for (let e = k << 9; e < s; e++) buf[sim.dead[e]] = sim.sp[e];
          return buf;
        };
        // regional pool for immigrants (a row of dots under the plot)
        const pool = []; { const rp = rng(31); let tot = 0; for (const v of wOpen) tot += v; for (let k = 0; k < 46; k++) { let u = rp() * tot, j = 0; while (j < NS - 1 && u > wOpen[j]) { u -= wOpen[j]; j++; } pool.push([GX + 8 + k * 13.1, 858 + (rp() - 0.5) * 8, j]); } }
        const spr = SPC.map((c) => makeSprite(c, 5.4, 2.3)); const sprInk = makeSprite(PAL.ink2, 5.4, 2.3);
        return { px, py, ph, rev, C, O, T, closedS, openS, stateAt, spr, sprInk, pool, KS, counts: new Int32Array(NS + 1) };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx, T = D.T, J = GJ;
        const open = t >= T.open0;
        const sim = open ? D.O : D.C;
        const sf = open ? D.openS(t) : D.closedS(t), si = Math.floor(sf);
        const rate = ((open ? D.openS(t + 0.05) : D.closedS(t + 0.05)) - sf) / 0.05;
        let slowK = -1, slowF = 0;
        if (!open && t >= T.slow0 && t < T.slow0 + T.nSlow * T.ev) { const u = (t - T.slow0) / T.ev; slowK = Math.floor(u); slowF = u - slowK; }
        const st = D.stateAt(sim, si);
        const counts = D.counts; counts.fill(0); for (let i = 0; i < J; i++) counts[st[i]]++;

        // ---------------- left: the forest plot
        const lA = 1 - S.p(2, 0.6), lB = S.p(2, 0.6) * (1 - S.p(3, 0.6)), lC = S.p(3, 0.6) * (1 - twin(t, T.open0 - 0.6, undefined)), lD = twin(t, T.open0 - 0.3);
        label(g, 'A forest plot', 140, 262, lA * S.p(0, 0.8, 0.2));
        label(g, 'Zero-sum dynamics', 140, 262, lB, COL);
        label(g, 'Isolated community', 140, 262, lC, COL);
        label(g, 'Reopened to immigration', 140, 262, lD, PAL.lagoon);
        g.rect(GX - 8, GY - 8, GC * CELL + 16, GR * CELL + 16, { stroke: PAL.rule, w: 1.4, r: 4, alpha: S.p(0, 1, 0.2) });
        // "built on individuals, not on species traits": colours drain to a single ink, then return as mere labels
        const neu = clamp(P(S, 1, 1, 0.05, 1.1) - S.p(2, 1.0));
        const hide = slowK >= 0 ? D.C.slow[slowK][0] : -1;
        const t0 = S.b(0) + 0.3, base = ctx.globalAlpha;
        for (let i = 0; i < J; i++) {
          if (i === hide) continue;
          const rv = clamp((t - t0 - D.rev[i] * 1.8) / 0.5); if (rv <= 0) continue;
          const a = rv * (0.84 + 0.16 * Math.sin(t * 1.3 + D.ph[i]));
          const sp = D.spr[st[i]], x = D.px[i], y = D.py[i];
          if (neu < 1) { ctx.globalAlpha = base * a * (1 - neu); ctx.drawImage(sp.c, x - sp.R, y - sp.R); }
          if (neu > 0) { ctx.globalAlpha = base * a * neu; ctx.drawImage(D.sprInk.c, x - sp.R, y - sp.R); }
        }
        ctx.globalAlpha = base;
        // fast phases: each death/replacement flashes briefly
        if (rate > 20 && sf > 5) {
          const nF = Math.max(1, Math.min(120, Math.round(rate * 0.12)));
          for (let e = Math.max(0, si - nF); e < si; e++) { const c = sim.dead[e]; g.glow(D.px[c], D.py[c], 15, SPC[sim.sp[e]], 0.55 * (1 - (si - 1 - e) / nF)); }
        }
        // slow, narrated replacement events
        if (slowK >= 0) {
          const [d, p] = D.C.slow[slowK]; const f = slowF;
          const xd = D.px[d], yd = D.py[d], xp = D.px[p], yp = D.py[p];
          const oldC = SPC[st[d]], newC = SPC[st[p]];
          const fa = clamp(1 - f / 0.32), ring = ease.out(f / 0.2) * (1 - ease.inOut((f - 0.75) / 0.25));
          blit(ctx, D.spr[st[d]], xd, yd, fa);
          g.circle(xd, yd, 12, { stroke: PAL.coral, w: 2.5, alpha: ring });
          crossX(g, xd, yd, 6, PAL.coral, ring * clamp(1 - (f - 0.5) / 0.2), 2.5);
          const pa = ease.out((f - 0.22) / 0.2) * (1 - ease.inOut((f - 0.82) / 0.18));
          g.circle(xp, yp, 12, { stroke: COL, w: 2.5, alpha: pa });
          g.carrow(xp, yp, xd, yd, 0.22, { color: COL, w: 2.5, head: 12, progress: clamp((f - 0.28) / 0.34), alpha: pa });
          if (f > 0.6) { const q = ease.outBack((f - 0.6) / 0.28); blit(ctx, D.spr[st[p]], xd, yd, 1, Math.max(0.01, q)); g.glow(xd, yd, 26, newC, 0.6 * (1 - clamp((f - 0.6) / 0.4))); }
          if (slowK < 2) {
            g.pill('death', xd, yd - 30, { color: PAL.coral, size: 21, align: 'center', fill: DARK, stroke: U.rgba(PAL.coral, 0.5), alpha: ring });
            g.pill('offspring of a random individual', xp, yp + 32, { color: COL, size: 21, align: 'center', fill: DARK, stroke: U.rgba(COL, 0.5), alpha: pa });
          }
          void oldC;
        }
        g.text('each dot is a tree; each colour, a species', GX, 772, { size: 22, color: PAL.ink2, alpha: S.p(0, 0.8, 1.6) * (1 - S.p(2, 0.6)) });
        g.text(GJ + ' trees · 20 species', GX + GC * CELL, 262, { size: 18, role: 'mono', color: PAL.ink3, align: 'right', alpha: S.p(0, 0.8, 2.2) * (1 - S.p(2, 0.6)) });
        // J bracket
        const jb = P(S, 2, 0, 0.55, 0.9) * (1 - twin(t, T.open0 - 0.4));
        g.arrow(GX, 742, GX + GC * CELL, 742, { color: COL, w: 2, head: 11, both: true, alpha: jb });
        g.math('J = ' + J, GX + 300, 780, { size: 32, color: COL, align: 'right', alpha: jb });
        g.text('individuals, always', GX + 312, 780, { size: 23, color: PAL.ink2, alpha: jb });
        // Kimura analogy
        const ka = P(S, 2, 2, 0.48) * (1 - S.p(3, 0.6));
        g.text('Ecological drift ≈ genetic drift', GX, 832, { size: 34, role: 'display', italic: true, color: PAL.ink, alpha: ka });
        g.text('KIMURA 1968', GX + GC * CELL, 832, { size: 16, weight: 600, ls: 2.4, color: COL, align: 'right', alpha: P(S, 2, 2, 0.72) * (1 - S.p(3, 0.6)) });
        g.text('species ↔ alleles  ·  individuals ↔ gene copies  ·  J ↔ N', GX, 872, { size: 22, color: PAL.ink2, alpha: P(S, 2, 2, 0.6) * (1 - S.p(3, 0.6)) });
        // beat 3b: regional pool and the rain of immigrants
        const pA = twin(t, T.open0 - 0.2);
        if (pA > 0) {
          g.text('regional species pool', GX + GC * CELL, 832, { size: 21, color: PAL.lagoon, align: 'right', alpha: pA });
          for (const [x, y, k] of D.pool) blit(ctx, D.spr[k], x, y, pA * 0.9, 0.8);
          if (open) {
            const nI = Math.max(1, Math.min(500, Math.round(rate * 0.4))); let drawn = 0;
            for (let e = si - 1; e >= Math.max(0, si - nI) && drawn < 12; e--) {
              if (!sim.imm[e]) continue; drawn++;
              const c = sim.dead[e], age = (si - 1 - e) / nI; const x = D.px[c], y = D.py[c];
              g.line(x, 846, x, y + 10, { color: PAL.lagoon, w: 1.4, alpha: 0.45 * (1 - age) });
              g.circle(x, y, 9, { stroke: PAL.lagoon, w: 2, alpha: 0.9 * (1 - age) });
            }
          }
        }
        // speciation sparkle
        if (t >= T.specVis) {
          const c = D.O.ds, x = D.px[c], y = D.py[c], u = clamp((t - T.specVis) / 1.6);
          for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.3; g.line(x + Math.cos(a) * (8 + 8 * u), y + Math.sin(a) * (8 + 8 * u), x + Math.cos(a) * (12 + 30 * u), y + Math.sin(a) * (12 + 30 * u), { color: SPC[NS], w: 2, alpha: 1 - u }); }
          sparkle(g, x, y, 13 + 3 * Math.sin(t * 4), SPC[NS], 0.9, t * 0.8);
          g.pill('speciation: a new species', x + 22, y - 30, { color: SPC[NS], size: 21, fill: DARK, stroke: U.rgba(SPC[NS], 0.5), alpha: S.tp(T.specVis + 0.1, 0.6) });
        }

        // ---------------- right, beat 0: niche view → neutral view
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          const merge = ease.inOut((t - sent(S, 0, 1, 0.74)) / 2.4);
          label(g, 'Niche view · species differ', 840, 262, S.p(0, 0.8, 0.3) * (1 - merge));
          label(g, 'Neutral view · species identical', 840, 262, merge, COL);
          const A = g.axes({ x: 870, y: 330, w: 400, h: 220, xmax: 1, ymax: 1.25, progress: S.p(0, 1, 0.3), xlab: 'niche axis (e.g., resource size)', labSize: 21 });
          g.text('resource use', 886, 322, { size: 21, color: PAL.ink2, alpha: S.p(0, 1, 0.3) });
          for (let k = 0; k < 5; k++) {
            const c = lerp(0.14 + k * 0.18, 0.5, merge), pr = S.p(0, 1.2, 0.6 + k * 0.3);
            const pts = []; for (let j = 0; j <= 90; j++) { const x = j / 90; pts.push([A.X(x), A.Y(Math.exp(-((x - c) ** 2) / (2 * 0.062 * 0.062)))]); }
            if (pr >= 1) g.poly([[pts[0][0], A.Y(0)], ...pts, [pts[pts.length - 1][0], A.Y(0)]], { fill: U.rgba(SPC[k], 0.1 * (1 - merge * 0.6)), color: null, w: 0 });
            g.poly(pts, { color: SPC[k], w: 3, progress: pr, alpha: 1 - merge });
            g.poly(pts, { color: SPC[k], w: 3.5, dash: [9, 36], dashOffset: k * 9, alpha: merge });
          }
          g.text('five species, five niches', A.X(0.5), A.Y(1.12), { size: 21, color: PAL.ink2, align: 'center', alpha: S.p(0, 0.8, 1.6) * (1 - merge) });
          g.text('one shared niche: no differences', A.X(0.5), A.Y(1.12), { size: 21, color: COL, align: 'center', alpha: merge });
          // the book
          const bp = P(S, 0, 1, 0.08, 0.9);
          g.rect(850, 610, 430, 156, { fill: 'rgba(14,29,31,0.7)', stroke: U.rgba(COL, 0.35), w: 1.4, r: 4, alpha: bp });
          g.rect(850, 610, 10, 156, { fill: COL, alpha: 0.75 * bp });
          g.text('STEPHEN P. HUBBELL · 2001', 882, 646, { size: 16, weight: 600, ls: 2.4, color: COL, alpha: bp });
          g.wrap('The Unified Neutral Theory of Biodiversity and Biogeography', 882, 690, 380, { size: 31, role: 'display', italic: true, color: PAL.ink, lh: 1.15, alpha: bp });
        });

        // ---------------- right, beat 1: the equivalence table
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          label(g, 'Identical per-capita rates', 840, 262, 1, COL);
          const cols = [['birth', PAL.moss, 'b'], ['death', PAL.coral, 'd'], ['dispersal', PAL.lagoon, ''], ['speciation', PAL.heather, 'ν']];
          const cx = [962, 1066, 1170, 1270], delay = [0.66, 0.74, 0.81, 0.9].map((f) => sent(S, 1, 0, f));
          cols.forEach(([nm, c, sym], j) => {
            const hp = 0.3 * S.p(1, 0.8, 0.8) + 0.7 * S.tp(delay[j] - 0.5, 0.7); const x = cx[j], y = 322;
            g.withAlpha(hp, () => {
              if (j === 0) g.icon('plant', x, y, 40, c);
              else if (j === 1) crossX(g, x, y, 11, c, 1, 4);
              else if (j === 2) { g.icon('seed', x - 10, y, 26, c); g.arrow(x + 1, y, x + 28, y, { color: c, w: 2.5, head: 10 }); }
              else sparkle(g, x, y, 16, c, 1, 0.2);
              g.text(nm, x, 374, { size: 20, color: PAL.ink2, align: 'center' });
              if (sym) g.math(sym, x, 404, { size: 26, color: c, align: 'center' });
            });
          });
          for (let k = 0; k < 6; k++) {
            const y = 452 + k * 54, rp = S.p(1, 0.6, 0.6 + k * 0.15);
            g.icon('tree', 852, y - 4, 34, SPC[k], { alpha: rp });
            g.text('sp. ' + (k + 1), 876, y + 4, { size: 21, color: PAL.ink3, alpha: rp });
            cols.forEach(([, c], j) => {
              const bp = S.tp(delay[j] + k * 0.07, 0.5);
              g.rect(cx[j] - 30, y - 7, 60, 12, { stroke: PAL.rule, w: 1, r: 3, alpha: rp });
              g.rect(cx[j] - 30, y - 7, 60 * bp, 12, { fill: c, r: 3, alpha: 0.85 * rp });
            });
          }
          g.text('⋮', 856, 790, { size: 26, color: PAL.ink3, alpha: S.p(1, 0.6, 1.5) });
          g.text('= the same for every individual of every species', 884, 788, { size: 21, color: PAL.ink2, alpha: P(S, 1, 0, 0.97) });
          g.text('Species identity is just a label.', 1060, 850, { size: 31, role: 'display', italic: true, color: COL, align: 'center', alpha: P(S, 1, 1, 0.3, 0.9) });
        });

        // ---------------- right, beats 2–3: rank–abundance and drift traces
        const v2 = S.p(2, 0.9, 0.6);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Rank–abundance (log scale)', 840, 262, 1);
          const A = g.axes({ x: 880, y: 300, w: 390, h: 230, xmin: 0, xmax: 21, ymin: 0.6, ymax: 1200, logy: true, xlab: 'rank', ylab: 'N_i', labSize: 22, progress: S.p(2, 1, 0.6), yticks: [{ v: 1, l: '1' }, { v: 10, l: '10' }, { v: 100, l: '100' }, { v: 1000, l: '1000' }] });
          g.line(A.X(0), A.Y(J), A.X(21), A.Y(J), { color: COL, w: 1.4, dash: [6, 7], alpha: 0.7 });
          g.math('J', A.X(21) + 12, A.Y(J) + 9, { size: 26, color: COL });
          const order = []; for (let k = 0; k <= NS; k++) if (counts[k] > 0) order.push(k);
          order.sort((a, b) => counts[b] - counts[a] || a - b);
          const bw = (A.X(1) - A.X(0)) * 0.72, bp = S.p(2, 1, 1.0);
          order.forEach((k, i) => { const x = A.X(i + 0.5) - bw / 2, y = A.Y(counts[k]); g.rect(x, y, bw, (A.Y(0.6) - y) * bp, { fill: SPC[k], alpha: 0.9 }); });
          g.math('\\sum_{i} N_i = J', 1270, 352, { size: 32, color: COL, align: 'right', alpha: P(S, 2, 0, 0.62) });
          g.text('S = ' + order.length + ' species', 1270, 392, { size: 21, role: 'mono', color: PAL.ink2, align: 'right', alpha: P(S, 2, 0, 0.75) });
          // monodominance callout
          const md = twin(t, T.ff1 - 0.2, T.open0 - 0.4);
          g.pill('monodominance: one species, N = J', 1270, 445, { color: COL, size: 21, align: 'right', fill: DARK, stroke: U.rgba(COL, 0.5), alpha: md });
          // ---- drift traces (beat 2 → fixation)
          const vT = P(S, 2, 2, 0.02, 0.9) * (1 - twin(t, T.open0 - 0.5));
          if (vT > 0) g.withAlpha(vT, () => {
            label(g, 'Relative abundance', 896, 610, 1);
            const gen = Math.max(si / J, 0.1), gmax = Math.max(4, gen * 1.06);
            const C = D.C, nr = Math.min(C.recs.length, Math.floor(si / 64) + 1), M = Math.min(nr, 150);
            let top = 0; for (let k = 0; k < NS; k++) top = Math.max(top, counts[k]); if (!open) for (let j = 0; j < nr; j += Math.max(1, (nr / 300) | 0)) for (let k = 0; k < NS; k++) top = Math.max(top, C.recs[j][k]);
            const ymax = open ? 1 : clamp(Math.ceil(top / J * 1.2 * 20) / 20, 0.3, 1);
            const B = g.axes({ x: 880, y: 640, w: 390, h: 190, xmin: 0, xmax: gmax, ymin: 0, ymax, xlab: 'generations', ylab: 'N_i/J', labSize: 22, progress: P(S, 2, 2, 0.02, 1), yticks: [{ v: 0, l: '0' }, { v: ymax / 2, l: (ymax / 2).toFixed(2).replace(/0$/, '') }] });
            if (nr >= 2) {
              for (let k = 0; k < NS; k++) {
                const pts = [];
                for (let j = 0; j < M; j++) { const idx = Math.round(j * (nr - 1) / Math.max(1, M - 1)); pts.push([B.X(idx * 64 / J), B.Y(C.recs[idx][k] / J)]); }
                pts.push([B.X(si / J), B.Y((open ? 0 : counts[k]) / J)]);
                g.poly(pts, { color: SPC[k], w: 2, alpha: 0.9 });
              }
            }
            g.text('t = ' + Math.round(si / J), 880, 872, { size: 19, role: 'mono', color: PAL.ink2 });
            g.text('fixation', B.X(gmax) - 4, B.Y(1) - 12, { size: 21, color: COL, align: 'right', alpha: twin(t, T.ff1 - 0.2) });
          });
          // ---- richness after reopening
          const vR = twin(t, T.open0 + 0.1);
          if (vR > 0) g.withAlpha(vR, () => {
            label(g, 'Species richness', 896, 610, 1, PAL.lagoon);
            const B = g.axes({ x: 880, y: 640, w: 390, h: 190, xmin: 0, xmax: 18, ymin: 0, ymax: 22, xlab: 'generations with immigration', ylab: 'S', labSize: 22, yticks: [{ v: 1, l: '1' }, { v: 10, l: '10' }, { v: 20, l: '20' }] });
            g.line(B.X(0), B.Y(1), B.X(18), B.Y(1), { color: PAL.ink3, w: 1.4, dash: [6, 7] });
            g.text('closed: S = 1', B.X(18), B.Y(1) - 10, { size: 19, color: PAL.ink3, align: 'right' });
            const O = D.O, n = Math.min(O.rich.length, Math.floor(si / 32) + 1); const pts = [];
            for (let j = 0; j < n; j++) pts.push([B.X(j * 32 / J), B.Y(O.rich[j])]);
            pts.push([B.X(si / J), B.Y(order.length)]);
            g.poly(pts, { color: PAL.lagoon, w: 3 });
            const tip = pts[pts.length - 1]; g.dot(tip[0], tip[1], 5, PAL.lagoon, 1, 2.4);
            if (t >= T.specVis) { const sx = B.X((D.KS + 1) / J), sy = B.Y(O.rich[Math.min(O.rich.length - 1, Math.ceil((D.KS + 1) / 32))]); sparkle(g, sx, sy - 16, 10, SPC[NS], S.tp(T.specVis, 0.5), 0.3); g.text('+1 by speciation', sx - 14, sy - 34, { size: 19, color: SPC[NS], align: 'right', alpha: S.tp(T.specVis + 0.2, 0.6) }); }
          });
        });
        // fast-forward badge
        g.pill('▸▸  fast-forward', GX + GC * CELL, 262 - 6, { color: COL, size: 18, align: 'right', fill: DARK, alpha: twin(t, T.ff0, T.ff1) });
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'neu-theta', title: 'θ, m & abundance distributions',
      beats: [
        { t: 'Hubbell’s model has two scales. In the metacommunity, new species arise by point speciation, at a rate ν per birth. Diversity there is governed by a single number, the fundamental biodiversity number θ = 2J_Mν, twice the metacommunity size times the speciation rate. At equilibrium, metacommunity abundances follow Fisher’s log-series, and θ equals Fisher’s α.',
          s: 'Hubbell’s model has two scales. In the metacommunity, new species arise by point speciation, at a rate nu per birth. Diversity there is governed by a single number, the fundamental biodiversity number, theta, equal to two J M nu, twice the metacommunity size times the speciation rate. At equilibrium, metacommunity abundances follow Fisher’s log series, and theta equals Fisher’s alpha.' },
        { t: 'Local communities draw from the metacommunity. With probability m, a dead individual is replaced by an immigrant from the metacommunity; otherwise, by the offspring of a local individual. The immigration probability m sets how strongly dispersal limitation separates local from regional composition.' },
        { t: 'The theory’s central prediction is the species abundance distribution: how many species are common and how many rare. Frank Preston plotted abundances in doubling classes he called octaves, and found a humped, roughly lognormal shape, with the rarest species hidden behind a veil line of incomplete sampling.' },
        { t: 'Hubbell’s zero-sum multinomial reproduces such humped distributions. Dispersal limitation leaves local communities with fewer rare species than the log-series predicts, because rare regional species seldom arrive.', pause: 1 },
      ],
      terms: [
        { beat: 0.55, term: 'Fundamental biodiversity number (θ)', def: 'θ = 2 × metacommunity size × speciation rate per birth; equals Fisher\u2019s α at equilibrium.' },
        { beat: 1.4, term: 'Immigration probability (m)', def: 'Probability that a local death is replaced by an immigrant from the metacommunity.' },
        { beat: 2.3, term: 'Species abundance distribution', def: 'Frequency distribution of species’ abundances; log-series, lognormal, or zero-sum multinomial forms.' },
        { beat: 2.75, term: 'Preston’s veil line', def: 'Sampling limit that hides the rarest species, truncating the left side of a lognormal SAD.' },
        { beat: 3.2, term: 'Zero-sum multinomial', def: 'Hubbell’s neutral SAD for a dispersal-limited local community.' },
      ],
      init(S0) {
        const r = rng(4242);
        // Metacommunity: an Ewens (Chinese-restaurant) sample with θ = 40 — the neutral equilibrium itself.
        const NM = 1700, TH = 40; const msp = new Int32Array(NM); let nsp = 0;
        for (let i = 0; i < NM; i++) { if (r() < TH / (TH + i)) msp[i] = nsp++; else msp[i] = msp[(r() * i) | 0]; }
        const mcol = Array.from({ length: nsp + 40 }, (_, k) => hslHex((18 + k * 137.508) % 360, [58, 48, 66][k % 3], [64, 74, 57][k % 3]));
        const MX = 430, MY = 575, RX = 278, RY = 248; const mx = new Float32Array(NM), my = new Float32Array(NM);
        for (let i = 0; i < NM; i++) { const rr = Math.sqrt((i + 0.5) / NM), th = i * 2.39996; mx[i] = MX + RX * rr * Math.cos(th) + (r() - 0.5) * 3; my[i] = MY + RY * rr * Math.sin(th) + (r() - 0.5) * 3; }
        const meta = Theater.makeCanvas(620, 560), mg = Theater.makeG(meta.getContext('2d'));
        for (let i = 0; i < NM; i++) mg.dot(mx[i] - 120, my[i] - 295, 2.6, mcol[msp[i]], 0.95, 2.3);
        // the local patch inside the region, and the zoomed local community
        const PX = 618, PY = 470, PR = 44, LX = 1062, LY = 500, LR = 160;
        // speciation sparkles (rate ν per birth)
        const spk = []; let ts = sent(S0, 0, 1, 0.5), kk = 0;
        while (ts < S0.b(2) - 0.6) {
          let i, tries = 0;
          do { i = (r() * NM) | 0; tries++; } while (tries < 200 && (Math.hypot(mx[i] - PX, my[i] - PY) < PR + 16 || (kk === 0 && (mx[i] < 630 || my[i] < 575 || my[i] > 670)) || spk.some((s) => Math.hypot(mx[s.i] - mx[i], my[s.i] - my[i]) < 60)));
          spk.push({ i, t: ts, col: hslHex((kk * 83 + 40) % 360, 85, 76) }); ts += kk === 0 ? 2.4 : 1.6 + 0.5 * r(); kk++;
        }
        // local community: 120 individuals; composition from a dispersal-limited local run
        const NL = 120, lx = new Float32Array(NL), ly = new Float32Array(NL);
        for (let i = 0; i < NL; i++) { const rr = 146 * Math.sqrt((i + 0.5) / NL), th = i * 2.39996 + 0.4; lx[i] = LX + rr * Math.cos(th); ly[i] = LY + rr * Math.sin(th); }
        const localRun = (J, m, steps, seed) => {
          const q = rng(seed); const s = new Int32Array(J); for (let i = 0; i < J; i++) s[i] = msp[(q() * NM) | 0];
          for (let e = 0; e < steps; e++) { const d = (q() * J) | 0; s[d] = q() < m ? msp[(q() * NM) | 0] : s[(d + 1 + ((q() * (J - 1)) | 0)) % J]; }
          return s;
        };
        const lsp0 = localRun(NL, 0.1, NL * 120, 7);
        // narrated replacement events: immigrant (m) or local birth (1 − m)
        const pattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0];
        const ev = []; const cur = Array.from(lsp0); const recent = [];
        const ev0 = sent(S0, 1, 1, 0) + 0.1, evDt = clamp((S0.e(1) - ev0 - 0.9) / pattern.length, 0.7, 1.0);
        pattern.forEach((imm, k) => {
          let d; do { d = (r() * NL) | 0; } while (recent.includes(d) || Math.hypot(lx[d] - LX, ly[d] - LY) > 130);
          recent.push(d); if (recent.length > 5) recent.shift();
          const e = { t: ev0 + k * evDt, d, imm, old: cur[d] };
          if (imm) { let i; do { i = (r() * NM) | 0; } while (mx[i] < 470 || Math.hypot(mx[i] - PX, my[i] - PY) < PR + 10); e.sx = mx[i]; e.sy = my[i]; e.sp = msp[i]; }
          else { let p; do { p = (r() * NL) | 0; } while (p === d || Math.hypot(lx[p] - lx[d], ly[p] - ly[d]) < 45 || Math.hypot(lx[p] - lx[d], ly[p] - ly[d]) > 130); e.sx = lx[p]; e.sy = ly[p]; e.sp = cur[p]; }
          cur[d] = e.sp; ev.push(e);
        });
        // composition: metacommunity vs local runs at high and low m (300 individuals each)
        const mcount = new Int32Array(nsp); for (let i = 0; i < NM; i++) mcount[msp[i]]++;
        const rank = Array.from({ length: nsp }, (_, k) => k).sort((a, b) => mcount[b] - mcount[a]);
        const comp = (arr) => { const c = new Int32Array(nsp); for (const v of arr) c[v]++; return rank.map((k) => [k, c[k] / arr.length]).filter((x) => x[1] > 0); };
        const rows = [comp(msp), comp(localRun(300, 0.5, 300 * 300, 21)), comp(localRun(300, 0.01, 300 * 500, 22))];
        // Preston: hollow arithmetic histogram and lognormal octaves of one community (μ = 5, σ = 2.4 in log2 units, 200 spp.)
        const MU = 5, SG = 2.4, ST = 200;
        const P2 = (n) => Phi((Math.log2(n) - MU) / SG);
        const hollow = []; for (let k = 0; k < 30; k++) hollow.push(ST * (P2(k * 10 + 10) - P2(Math.max(1, k * 10))));
        return { msp, mcol, mx, my, meta, spk, PX, PY, PR, LX, LY, LR, NL, lx, ly, lsp0, ev, rows, hollow, nsp };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx;
        // ================= beats 0–1: the two scales
        const vM = vis(S, 0, 2);
        if (vM > 0) g.withAlpha(vM, () => {
          label(g, 'Metacommunity · regional scale', 140, 262, S.p(0, 0.8, 0.1));
          const pIm = S.p(0, 1.4, 0.2);
          g.ellipse(430, 575, 296, 266, { fill: 'rgba(14,29,31,0.55)', stroke: PAL.rule, w: 1.5, alpha: pIm });
          g.withAlpha(pIm, () => ctx.drawImage(D.meta, 120, 295));
          g.math('J_{M}', 160, 852, { size: 30, color: COL, alpha: P(S, 0, 2, 0.72) });
          g.text('individuals in the metacommunity', 205, 852, { size: 21, color: PAL.ink2, alpha: P(S, 0, 2, 0.72) });
          // point speciation
          D.spk.forEach((s, k) => {
            if (t < s.t) return; const x = D.mx[s.i], y = D.my[s.i], u = (t - s.t) / 1.3;
            g.circle(x, y, 4.2, { fill: PAL.bg });
            g.dot(x, y, 3.4, s.col, 1, 2.6);
            if (u < 1) { g.circle(x, y, 6 + 26 * ease.out(u), { stroke: s.col, w: 2, alpha: 1 - u }); sparkle(g, x, y, 15 * (1 - u) + 4, s.col, 1 - u * 0.7, u * 2); }
            if (k === 0) {
              const la = S.tp(s.t + 0.2, 0.6) * (1 - P(S, 0, 2, 0.92, 0.6));
              g.line(x + 9, y - 9, x + 46, y - 40, { color: s.col, w: 1.5, alpha: la });
              g.pill('point speciation', x + 48, y - 48, { color: s.col, size: 21, fill: DARK, stroke: U.rgba(s.col, 0.5), alpha: la });
              g.text('one individual founds a new species', x + 52, y - 82, { size: 19, color: PAL.ink2, alpha: la });
              g.math('\\text{rate } ν \\text{ per birth}', x + 52, y - 4, { size: 24, color: s.col, alpha: la * P(S, 0, 1, 0.75) });
            }
          });
          // local patch
          const lp = S.p(0, 0.8, 0.9);
          g.circle(D.PX, D.PY, D.PR, { stroke: PAL.ink, w: 2, alpha: lp });
          g.text('local', D.PX, D.PY - D.PR - 12, { size: 21, color: PAL.ink, align: 'center', alpha: lp * (1 - S.p(1, 0.6)) });
        });
        // ---- right, beat 0: θ and the log-series
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Fundamental biodiversity number', 840, 262, P(S, 0, 2, 0.25), COL);
          const ep = P(S, 0, 2, 0.42, 1), x0 = 850, y0 = 352;
          const w1 = g.mathW('θ = 2', 64), wJ = g.mathW('J_{M}', 64), wv = g.mathW('ν', 64);
          g.glow(x0 + 18, y0 - 20, 70, COL, 0.35 * P(S, 0, 2, 0.4) * (1 - P(S, 0, 2, 0.7, 1)));
          g.math('θ = 2', x0, y0, { size: 64, color: COL, alpha: ep });
          g.math('J_{M}', x0 + w1, y0, { size: 64, alpha: ep });
          g.math('ν', x0 + w1 + wJ, y0, { size: 64, alpha: ep });
          const aJ = P(S, 0, 2, 0.74), aV = P(S, 0, 2, 0.9), xJ = x0 + w1 + wJ * 0.45, xV = x0 + w1 + wJ + wv;
          g.line(xJ, y0 + 22, xJ, y0 + 44, { color: PAL.ink2, w: 1.5, alpha: aJ });
          g.text('metacommunity size', xJ, y0 + 70, { size: 21, color: PAL.ink2, align: 'center', alpha: aJ });
          g.line(xV + 6, y0 - 18, xV + 30, y0 - 18, { color: PAL.ink2, w: 1.5, alpha: aV });
          g.text('speciation rate', xV + 38, y0 - 22, { size: 21, color: PAL.ink2, alpha: aV });
          g.text('(per birth)', xV + 38, y0 + 4, { size: 19, color: PAL.ink3, alpha: aV });
          // Fisher's log-series
          const lp = P(S, 0, 3, 0, 1);
          label(g, 'Fisher’s log-series', 840, 486, lp);
          const A = g.axes({ x: 880, y: 520, w: 390, h: 270, xmin: 0, xmax: 21, ymin: 0, ymax: 44, xlab: 'n', ylab: 'S_n', progress: lp, xticks: [{ v: 1, l: '1' }, { v: 5, l: '5' }, { v: 10, l: '10' }, { v: 15, l: '15' }] });
          const bw = (A.X(1) - A.X(0)) * 0.66;
          for (let n = 1; n <= 20; n++) { const v = 40 * Math.pow(0.995, n) / n, p = S.tp(sent(S, 0, 3, 0) + 0.4 + n * 0.08, 0.5); g.rect(A.X(n) - bw / 2, A.Y(v * p), bw, A.Y(0) - A.Y(v * p), { fill: COL, alpha: 0.8 }); }
          g.plot(A, (n) => 40 * Math.pow(0.995, n) / n, { from: 0.95, to: 20.5, color: PAL.ink, w: 2, progress: P(S, 0, 3, 0.25, 1.2), alpha: 0.7 });
          g.math('S_n = θ\\frac{x^{n}}{n}', 1268, 600, { size: 38, align: 'right', alpha: P(S, 0, 3, 0.3) });
          g.math('θ = α', 1268, 672, { size: 38, color: COL, align: 'right', alpha: P(S, 0, 3, 0.72) });
          g.text('Fisher’s α', 1268, 704, { size: 21, color: PAL.ink2, align: 'right', alpha: P(S, 0, 3, 0.78) });
        });
        // ---- right, beat 1: the local community
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          label(g, 'Local community · J individuals', 840, 262, S.p(1, 0.8, 0.2));
          const zp = S.p(1, 1, 0.2);
          g.line(D.PX, D.PY - D.PR, lerp(D.PX, D.LX, zp), lerp(D.PY - D.PR, D.LY - D.LR, zp), { color: PAL.ink3, w: 1.2, dash: [4, 6] });
          g.line(D.PX, D.PY + D.PR, lerp(D.PX, D.LX, zp), lerp(D.PY + D.PR, D.LY + D.LR, zp), { color: PAL.ink3, w: 1.2, dash: [4, 6] });
          g.circle(D.LX, D.LY, D.LR * zp, { fill: 'rgba(14,29,31,0.92)', stroke: PAL.ink, w: 2 });
          // current local composition
          const cur = Array.from(D.lsp0); for (const e of D.ev) if (t >= e.t + 0.62) cur[e.d] = e.sp;
          const active = D.ev.filter((e) => t >= e.t && t < e.t + 1.25);
          for (let i = 0; i < D.NL; i++) {
            if (active.some((e) => e.d === i && t < e.t + 0.62)) continue;
            const rv = clamp((t - S.b(1) - 0.6 - (i / D.NL) * 0.9) / 0.4);
            g.dot(D.lx[i], D.ly[i], 5.6, D.mcol[cur[i]], rv, 2.2);
          }
          for (const e of active) {
            const f = (t - e.t) / 1.25, x = D.lx[e.d], y = D.ly[e.d];
            const c = e.imm ? PAL.lagoon : PAL.moss, nc = D.mcol[e.sp];
            const fa = clamp(1 - f / 0.25), ra = 1 - ease.inOut((f - 0.7) / 0.3);
            g.dot(x, y, 5.6, D.mcol[e.old], fa, 2.2);
            g.circle(x, y, 11, { stroke: PAL.coral, w: 2, alpha: ease.out(f / 0.15) * (1 - clamp((f - 0.45) / 0.2)) });
            const ap = clamp((f - 0.12) / 0.38);
            const bend = e.imm ? -0.22 : 0.3;
            g.carrow(e.sx, e.sy, x, y, bend, { color: c, w: e.imm ? 2.6 : 2.2, head: 11, progress: ap, alpha: ra });
            if (ap > 0 && ap < 1) { const u = ap, mx = (e.sx + x) / 2, my = (e.sy + y) / 2, cx = mx - (y - e.sy) * bend, cy = my + (x - e.sx) * bend; const bx = (1 - u) * (1 - u) * e.sx + 2 * (1 - u) * u * cx + u * u * x, by = (1 - u) * (1 - u) * e.sy + 2 * (1 - u) * u * cy + u * u * y; g.dot(bx, by, 4.5, nc, 1, 2.6); }
            if (f > 0.5) g.dot(x, y, 5.6 * ease.outBack(clamp((f - 0.5) / 0.25)), nc, 1, 2.2);
          }
          // legend → composition
          const lg = P(S, 1, 1, 0) * (1 - S.tp(sent(S, 1, 2, 0) - 0.2, 0.6));
          g.withAlpha(lg, () => {
            g.arrow(840, 712, 900, 712, { color: PAL.lagoon, w: 2.6, head: 11 });
            g.math('m', 914, 721, { size: 30, color: PAL.lagoon });
            g.text('immigrant from the metacommunity', 960, 720, { size: 21, color: PAL.ink2 });
            g.arrow(840, 768, 900, 768, { color: PAL.moss, w: 2.2, head: 11 });
            g.math('1 − m', 914, 777, { size: 30, color: PAL.moss });
            g.text('offspring of a local individual', 1000, 776, { size: 21, color: PAL.ink2 });
          });
          const cp = P(S, 1, 2, 0.03);
          g.withAlpha(cp, () => {
            const labs = ['\\text{metacommunity}', '\\text{local, } m = 0.5', '\\text{local, } m = 0.01'];
            D.rows.forEach((row, j) => {
              const y = 708 + j * 52, x0 = 1010, W = 270; const pj = S.tp(sent(S, 1, 2, 0.05) + j * 0.6, 1.2);
              g.math(labs[j], 990, y + 19, { size: 24, color: j ? PAL.ink : COL, align: 'right' });
              let x = x0; for (const [k, f] of row) { const w = f * W * pj; if (w > 0.2) g.rect(x, y, w, 26, { fill: D.mcol[k] }); x += w; }
              g.rect(x0, y, W, 26, { stroke: PAL.rule, w: 1 });
            });
            g.text('low m: local composition drifts away from regional', 840, 880, { size: 19, color: PAL.ink3, alpha: P(S, 1, 2, 0.6) });
          });
        });
        // ================= beat 2: SADs, Preston's octaves and veil
        const v2 = vis(S, 2, 3);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'How many species are common, how many rare?', 140, 262, S.p(2, 0.8, 0.2));
          const A = g.axes({ x: 170, y: 310, w: 450, h: 430, xmin: 0, xmax: 300, ymin: 0, ymax: 50, labSize: 22, progress: S.p(2, 1, 0.3), xticks: [{ v: 0, l: '0' }, { v: 100, l: '100' }, { v: 200, l: '200' }, { v: 300, l: '300' }] });
          xTitle(g, A, 'abundance (individuals)', S.p(2, 1, 0.3)); yTitle(g, A, 'species', S.p(2, 1, 0.3));
          const bw = A.X(10) - A.X(0) - 3;
          D.hollow.forEach((v, k) => { const p = S.p(2, 0.5, 1.0 + k * 0.05); g.rect(A.X(k * 10) + 1.5, A.Y(v * p), bw, A.Y(0) - A.Y(v * p), { fill: PAL.lagoon, alpha: 0.8 }); });
          g.text('many rare', A.X(42), A.Y(43) + 8, { size: 23, color: PAL.ink, alpha: P(S, 2, 0, 0.9) });
          g.arrow(A.X(38), A.Y(43), A.X(13), A.Y(43), { color: PAL.ink2, w: 2, head: 10, alpha: P(S, 2, 0, 0.9) });
          g.text('few common', A.X(220), A.Y(10), { size: 23, color: PAL.ink, align: 'center', alpha: P(S, 2, 0, 0.72) });
          g.text('the “hollow curve”', A.X(150), A.Y(30), { size: 23, role: 'display', italic: true, color: PAL.ink2, align: 'center', alpha: P(S, 2, 1, 0) });
          // Preston's octaves
          const pp = P(S, 2, 1, 0.02, 1);
          label(g, 'Preston’s octaves (1948)', 780, 262, pp, COL);
          const B = g.axes({ x: 810, y: 310, w: 460, h: 430, xmin: -8.5, xmax: 8.5, ymin: 0, ymax: 44, labSize: 22, progress: pp, xticks: [-8, -4, 0, 4, 8].map((v) => ({ v, l: String(v) })) });
          xTitle(g, B, 'octave R (doubling classes of abundance)', pp); g.math('S(R)', B.x - 14, B.y - 18, { size: 26, align: 'right', alpha: pp });
          const f = (R) => 30 * Math.exp(-0.04 * R * R);
          const veil = lerp(-2.5, -5.5, ease.inOut((t - sent(S, 2, 1, 0.86)) / 1.8));
          const bw2 = (B.X(1) - B.X(0)) * 0.78;
          for (let R = -8; R <= 8; R++) {
            const p = S.tp(sent(S, 2, 1, 0.2) + (R + 8) * 0.08, 0.5), v = f(R) * p, x = B.X(R) - bw2 / 2, hidden = R < veil; if (p <= 0) continue;
            if (hidden) g.rect(x, B.Y(v), bw2, B.Y(0) - B.Y(v), { stroke: COL, w: 1.2, dash: [4, 5], alpha: 0.35 });
            else g.rect(x, B.Y(v), bw2, B.Y(0) - B.Y(v), { fill: COL, alpha: 0.85 });
          }
          const cp = P(S, 2, 1, 0.45, 1.4);
          g.plot(B, f, { from: veil, to: 8.5, color: PAL.ink, w: 3, progress: cp });
          g.plot(B, f, { from: -8.5, to: veil, color: PAL.ink, w: 2, dash: [6, 7], alpha: 0.55 * cp });
          g.math('S(R) = S_0 e^{−(aR)^{2}}', 1268, 338, { size: 32, align: 'right', alpha: P(S, 2, 1, 0.5) });
          g.text('lognormal (Preston 1948)', 1268, 372, { size: 21, color: PAL.ink2, align: 'right', alpha: P(S, 2, 1, 0.5) });
          const va = P(S, 2, 1, 0.8);
          g.line(B.X(veil), B.Y(44), B.X(veil), B.Y(0), { color: PAL.coral, w: 3, alpha: va });
          g.rect(B.X(-8.5), B.Y(44), B.X(veil) - B.X(-8.5), B.Y(0) - B.Y(44), { fill: 'rgba(11,22,24,0.35)', alpha: va });
          g.text('veil line', B.X(veil) + 10, 410, { size: 23, weight: 600, color: PAL.coral, alpha: va });
          const ua = va * (1 - P(S, 2, 1, 0.84, 0.5));
          g.text('unsampled', B.X(veil) - 10, B.Y(19), { size: 19, color: PAL.ink3, align: 'right', alpha: ua });
          g.text('rarities', B.X(veil) - 10, B.Y(19) + 22, { size: 19, color: PAL.ink3, align: 'right', alpha: ua });
          const sa = P(S, 2, 1, 0.88);
          g.text('← larger samples', B.X(veil) + 10, 438, { size: 19, color: PAL.ink2, alpha: sa });
        });
        // ================= beat 3: zero-sum multinomial vs log-series
        const v3 = S.p(3, 0.9);
        if (v3 > 0) g.withAlpha(v3, () => {
          label(g, 'Zero-sum multinomial vs. log-series · J = 21,000, θ = 48', 140, 262, 1);
          const A = g.axes({ x: 190, y: 320, w: 800, h: 460, xmin: 0, xmax: 12, ymin: 0, ymax: 50, labSize: 22, progress: S.p(3, 1), xticks: OCT_LAB.map((l, k) => ({ v: k + 0.5, l })), yticks: [0, 10, 20, 30, 40, 50].map((v) => ({ v, l: String(v) })) });
          xTitle(g, A, 'individuals per species (log₂ classes: 1, 2–3, 4–7, …)', S.p(3, 1)); yTitle(g, A, 'species', S.p(3, 1));
          const msw = ease.inOut((t - sent(S, 3, 1, 0.1)) / 4.6);
          const m = Math.exp(lerp(Math.log(0.1), Math.log(0.01), msw));
          const z = zsmAt(m), lsr = ZT[0];
          const bw = (A.X(1) - A.X(0)) * 0.74;
          const gp = P(S, 3, 1, 0.4, 0.9);
          for (let k = 0; k < 12; k++) {
            const p = S.p(3, 0.6, 0.3 + k * 0.08), v = z[k] * p, x = A.X(k + 0.5) - bw / 2;
            g.rect(x, A.Y(v), bw, A.Y(0) - A.Y(v), { fill: COL, alpha: 0.82 });
            if (lsr[k] > z[k] + 0.5 && k < 5) g.rect(x, A.Y(lsr[k]), bw, A.Y(z[k]) - A.Y(lsr[k]), { fill: U.rgba(PAL.coral, 0.1), stroke: U.rgba(PAL.coral, 0.75), w: 1.6, dash: [5, 5], alpha: gp });
          }
          const lp = P(S, 3, 1, 0, 1.4);
          const pts = lsr.map((v, k) => [A.X(k + 0.5), A.Y(v)]);
          g.poly(smoothPts(pts), { color: PAL.lagoon, w: 3.5, progress: lp });
          pts.forEach(([x, y], k) => g.dot(x, y, 5, PAL.lagoon, clamp(lp * 12 - k)));
          // legend + m readout
          const L = S.p(3, 0.8, 0.6), RX = 1036;
          g.rect(RX, 344, 26, 18, { fill: COL, alpha: L });
          g.text('zero-sum multinomial', RX + 38, 360, { size: 21, color: PAL.ink, alpha: L });
          g.text('local community', RX + 38, 386, { size: 19, color: PAL.ink3, alpha: L });
          g.line(RX - 2, 428, RX + 28, 428, { color: PAL.lagoon, w: 3.5, alpha: lp });
          g.text('log-series (m = 1)', RX + 38, 435, { size: 21, color: PAL.ink, alpha: lp });
          g.text('no dispersal limitation', RX + 38, 461, { size: 19, color: PAL.ink3, alpha: lp });
          g.math('m = ' + m.toFixed(3), RX, 540, { size: 42, color: COL, alpha: S.p(3, 0.8, 0.8) });
          g.text('humped, like Preston’s lognormal', A.X(4.5), A.Y(31) - 22, { size: 21, color: COL, align: 'center', alpha: S.p(3, 0.8, 1.6) * (1 - P(S, 3, 1, 0, 0.6)) });
          g.text('S = ' + z.reduce((a, b) => a + b, 0).toFixed(0) + ' species', RX, 576, { size: 20, role: 'mono', color: PAL.ink2, alpha: S.p(3, 0.8, 1.0) });
          g.pill('fewer rare species', A.X(2.5), A.Y((lsr[2] + z[2]) / 2), { size: 21, weight: 600, color: PAL.coral, align: 'center', fill: DARK, stroke: U.rgba(PAL.coral, 0.5), alpha: gp });
          g.text('Rare regional species', RX, 650, { size: 30, role: 'display', italic: true, color: PAL.ink, alpha: P(S, 3, 1, 0.72, 0.9) });
          g.text('seldom arrive.', RX, 686, { size: 30, role: 'display', italic: true, color: PAL.ink, alpha: P(S, 3, 1, 0.72, 0.9) });
        });
      },
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'neu-tests', title: 'Tests & legacy',
      beats: [
        { t: 'Neutral models fit the species abundance distribution of the fifty-hectare forest plot on Barro Colorado Island remarkably well. They also predict distance decay of similarity, as dispersal limitation makes nearby communities more alike than distant ones.' },
        { t: 'But fitting a pattern is weak evidence for a process. Niche-based models can produce the same abundance distributions, and experiments routinely find stabilizing niche differences and species-specific negative density dependence, even among tropical trees. Strict neutrality is almost certainly false.' },
        { t: 'Its lasting value is as a null model: neutral theory shows what chance and dispersal alone can produce, so that departures from it become informative. It also seeded a synthesis. In Chesson’s terms, neutrality is the special case of zero niche differences and zero fitness differences. And Scheffer and van Nes showed how emergent neutrality can arise, with clumps of similar species coexisting almost neutrally within distinct niches.', pause: 1.2 },
      ],
      terms: [
        { beat: 0.6, term: 'Distance decay of similarity', def: 'Decline in compositional similarity between communities with geographic distance.' },
        { beat: 2.2, term: 'Null model', def: 'A model that excludes the process of interest, providing a baseline for detecting it.' },
        { beat: 2.75, term: 'Emergent neutrality', def: 'Scheffer & van Nes (2006): clusters of similar species coexisting near-neutrally within niches.' },
      ],
      init() {
        const r = rng(2003);
        // A BCI-like community drawn from the neutral SAD (θ = 48, m = 0.1, J ≈ 21,000)
        let ab = [];
        for (let tries = 0; tries < 200; tries++) {
          ab = []; ZT[3].forEach((c, k) => { const n = poisson(r, c); for (let j = 0; j < n; j++) ab.push(Math.floor(Math.pow(2, k + r()))); });
          const tot = ab.reduce((a, b) => a + b, 0); if (Math.abs(tot - 21000) < 900 && Math.abs(ab.length - 225) < 8) break;
        }
        ab.sort((a, b) => b - a);
        const NSP = ab.length, N = ab.reduce((a, b) => a + b, 0);
        const obs = new Array(12).fill(0); for (const n of ab) obs[Math.min(11, Math.floor(Math.log2(n)))]++;
        // Lognormal (niche-apportionment-like) fit to the same octave counts: Gaussian in log2 classes, least squares
        let best = null;
        for (let mu = 2; mu <= 7; mu += 0.05) for (let sg = 1.2; sg <= 4.5; sg += 0.05) {
          const f = obs.map((_, k) => Math.exp(-((k + 0.5 - mu) ** 2) / (2 * sg * sg)));
          const amp = f.reduce((s, v, k) => s + v * obs[k], 0) / f.reduce((s, v) => s + v * v, 0);
          const sse = f.reduce((s, v, k) => s + (amp * v - obs[k]) ** 2, 0);
          if (!best || sse < best.sse) best = { mu, sg, amp, sse };
        }
        // stem map (1000 × 500 m): two-level clustering — species ranges and conspecific clumps (dispersal limitation)
        const xs = new Float32Array(N), ys = new Float32Array(N), sp = new Uint16Array(N); let q = 0;
        const refl = (v, L) => { v = v < 0 ? -v : v; v = v > L ? 2 * L - v : v; return clamp(v, 0, L); };
        ab.forEach((n, s) => {
          const hx = r() * 1000, hy = r() * 500, np = Math.max(1, Math.round(n / 14)), par = [];
          for (let k = 0; k < np; k++) par.push(r() < 0.45 ? [r() * 1000, r() * 500] : [refl(hx + gauss(r) * 200, 1000), refl(hy + gauss(r) * 150, 500)]);
          for (let k = 0; k < n; k++) { const [a, b] = par[(r() * np) | 0]; xs[q] = refl(a + gauss(r) * 20, 1000); ys[q] = refl(b + gauss(r) * 20, 500); sp[q] = s; q++; }
        });
        const SC = 0.54, map = Theater.makeCanvas(542, 272), mc = map.getContext('2d');
        mc.fillStyle = 'rgba(14,29,31,0.9)'; mc.fillRect(0, 0, 542, 272);
        const muted = [PAL.ink3, '#8A8F78', '#7C8F8A', '#8E8270'];
        const HI = [0, 1, 2, 3, 4, 5, 9, 14, 22, 31], hiCol = [PAL.moss, PAL.ochre, PAL.lagoon, PAL.coral, PAL.heather, PAL.rose, PAL.mint, '#F2E27A', '#7FA8F0', '#F0A070'];
        for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
          const s = sp[i], h = HI.indexOf(s); if ((h >= 0) !== (pass === 1)) continue;
          mc.fillStyle = h >= 0 ? hiCol[h] : muted[s % 4]; mc.globalAlpha = h >= 0 ? 0.9 : 0.42;
          const z = h >= 0 ? 1.7 : 1.3; mc.fillRect(1 + xs[i] * SC - z / 2, 1 + ys[i] * SC - z / 2, z, z);
        }
        // 50-m quadrats and Sørensen similarity of pairs
        const QX = 20, QY = 10, pres = new Uint8Array(QX * QY * NSP);
        for (let i = 0; i < N; i++) { const qi = Math.min(QX - 1, Math.floor(xs[i] / 50)) + QX * Math.min(QY - 1, Math.floor(ys[i] / 50)); pres[qi * NSP + sp[i]] = 1; }
        const pairs = [];
        for (let bin = 1; bin < 20; bin++) {
          let got = 0, tries = 0;
          while (got < 3 && tries < 4000) {
            tries++; const a = (r() * QX * QY) | 0, b = (r() * QX * QY) | 0; if (a === b) continue;
            const d = 50 * Math.hypot((a % QX) - (b % QX), ((a / QX) | 0) - ((b / QX) | 0)); if (d < bin * 50 || d >= bin * 50 + 50) continue;
            let A = 0, B = 0, Cc = 0; for (let s = 0; s < NSP; s++) { const u = pres[a * NSP + s], v = pres[b * NSP + s]; if (u && v) A++; else if (u) B++; else if (v) Cc++; }
            pairs.push({ a, b, d, s: 2 * A / (2 * A + B + Cc) }); got++;
          }
        }
        pairs.sort((u, v) => u.d - v.d);
        let fit = null;
        for (let lam = 30; lam <= 900; lam += 10) {
          const xsF = pairs.map((p) => Math.exp(-p.d / lam)); const n = pairs.length;
          const mx = xsF.reduce((a, b) => a + b, 0) / n, my = pairs.reduce((a, p) => a + p.s, 0) / n;
          let sxy = 0, sxx = 0; pairs.forEach((p, k) => { sxy += (xsF[k] - mx) * (p.s - my); sxx += (xsF[k] - mx) ** 2; });
          const a = sxy / sxx, c = my - a * mx; const sse = pairs.reduce((s, p, k) => s + (c + a * xsF[k] - p.s) ** 2, 0);
          if (!fit || sse < fit.sse) fit = { lam, a, c, sse };
        }
        // Scheffer & van Nes (2006): Lotka–Volterra competition along a niche axis, Gaussian kernel
        const n = 100, sig = 0.07; const mu = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
        const K = mu.map((m) => 1 - 0.6 * Math.exp(-Math.min(m, 1 - m) / 0.04));
        const Am = new Float64Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const d = mu[i] - mu[j]; Am[i * n + j] = Math.exp(-d * d / (4 * sig * sig)); }
        const rr = rng(3); let Nv = new Float64Array(n).map(() => (0.9 + 0.2 * rr()) * 0.08);
        const snapT = [0, 30, 100, 300, 1000, 3000, 10000], svn = [Array.from(Nv)]; let tt = 0, si = 1; const N2 = new Float64Array(n);
        while (si < snapT.length) {
          for (let i = 0; i < n; i++) { let s = 0; const row = i * n; for (let j = 0; j < n; j++) s += Am[row + j] * Nv[j]; N2[i] = Math.max(1e-12, Nv[i] * Math.exp(1 - s / K[i])); }
          Nv.set(N2); tt++; if (tt >= snapT[si]) { svn.push(Array.from(Nv)); si++; }
        }
        const fin = svn[svn.length - 1]; const thr = 0.09 * Math.max(...fin.slice(10, 90));
        const clumps = []; let st = -1; for (let i = 0; i <= n; i++) { const on = i < n && fin[i] > thr; if (on && st < 0) st = i; if (!on && st >= 0) { if (i - st >= 2) clumps.push([st, i - 1]); st = -1; } }
        return { ab, obs, N, NSP, best, map, pairs, fit, svn, snapT, clumps, svnMax: Math.max(...fin) };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx;
        // ================= beat 0: BCI stem map and distance decay (held until the niche evidence arrives)
        const v0 = S.p(0, 0.8) * (1 - S.tp(sent(S, 1, 1, 0.4) - 0.4, 0.6));
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Barro Colorado Island · 50-ha plot', 140, 262, S.p(0, 0.8, 0.1), COL);
          const mp = S.io(0, 1.6, 0.3);
          g.clip(150, 296, 542 * mp + 1, 274, () => ctx.drawImage(D.map, 150, 296));
          g.rect(150, 296, 542, 272, { stroke: PAL.rule, w: 1.4, alpha: mp });
          g.text('1000 × 500 m  ·  ≈21,000 trees ≥ 10 cm dbh  ·  ≈225 species', 150, 596, { size: 19, color: PAL.ink3, alpha: S.p(0, 0.8, 2.2) });
          // distance decay
          const dp = P(S, 0, 1, 0, 1);
          label(g, 'Distance decay of similarity', 140, 640, dp);
          const A = g.axes({ x: 190, y: 672, w: 470, h: 168, xmin: 0, xmax: 1000, ymin: 0, ymax: 0.8, labSize: 20, progress: dp, xticks: [0, 250, 500, 750, 1000].map((v) => ({ v, l: String(v) })), yticks: [{ v: 0, l: '0' }, { v: 0.4, l: '0.4' }, { v: 0.8, l: '0.8' }] });
          xTitle(g, A, 'distance between 50-m quadrats (m)', dp); g.text('Sørensen similarity', A.x + 14, A.y + 6, { size: 19, color: PAL.ink2, alpha: dp });
          const np = D.pairs.length, shown = Math.floor(clamp((t - sent(S, 0, 1, 0.1)) / 5.0) * np);
          for (let k = 0; k < shown; k++) { const p = D.pairs[k]; g.circle(A.X(p.d), A.Y(p.s), 3.6, { fill: PAL.lagoon, alpha: 0.85 }); }
          if (shown > 0 && shown < np) {
            const p = D.pairs[shown - 1]; const qx = (i) => 150 + 1 + ((i % 20) * 50) * 0.54, qy = (i) => 296 + 1 + (((i / 20) | 0) * 50) * 0.54, q = 27;
            g.rect(qx(p.a), qy(p.a), q, q, { stroke: PAL.ink, w: 2 }); g.rect(qx(p.b), qy(p.b), q, q, { stroke: PAL.ink, w: 2 });
            g.line(qx(p.a) + q / 2, qy(p.a) + q / 2, qx(p.b) + q / 2, qy(p.b) + q / 2, { color: PAL.ink, w: 1.5, dash: [4, 5] });
            g.dot(A.X(p.d), A.Y(p.s), 5, PAL.ink, 1, 2.6);
          }
          const F = D.fit; g.plot(A, (d) => F.c + F.a * Math.exp(-d / F.lam), { from: 50, to: 1000, color: COL, w: 3.5, progress: P(S, 0, 1, 0.8, 1.6) });
          g.text('nearby quadrats are more alike', A.X(1000), A.Y(0.8) + 4, { size: 19, color: PAL.ink2, align: 'right', alpha: P(S, 0, 1, 0.75) });
        });
        // ================= right, beats 0–2: the SAD and its fits (until the Chesson plane arrives)
        const vS = S.p(0, 0.8) * (1 - S.tp(sent(S, 2, 1, 0) - 0.4, 0.6));
        if (vS > 0) g.withAlpha(vS, () => {
          label(g, 'Species abundance distribution', 780, 262, S.p(0, 0.8, 0.5));
          const A = g.axes({ x: 810, y: 310, w: 460, h: 420, xmin: 0, xmax: 12, ymin: 0, ymax: 46, labSize: 22, progress: S.p(0, 1, 0.6), xticks: OCT_LAB.map((l, k) => ({ v: k + 0.5, l: k % 2 ? '' : l })), yticks: [0, 10, 20, 30, 40].map((v) => ({ v, l: String(v) })) });
          xTitle(g, A, 'individuals per species (log₂ classes)', S.p(0, 1, 0.6)); yTitle(g, A, 'species', S.p(0, 1, 0.6));
          const bw = (A.X(1) - A.X(0)) * 0.74;
          D.obs.forEach((v, k) => { const p = S.p(0, 0.5, 1.6 + k * 0.1); g.rect(A.X(k + 0.5) - bw / 2, A.Y(v * p), bw, A.Y(0) - A.Y(v * p), { fill: PAL.ink2, alpha: 0.5 }); });
          const np = P(S, 0, 0, 0.62, 1.6);
          g.poly(smoothPts(ZT[3].map((v, k) => [A.X(k + 0.5), A.Y(v)])), { color: COL, w: 4, progress: np });
          g.rect(1058, 330, 22, 14, { fill: PAL.ink2, alpha: 0.5 * S.p(0, 0.8, 2.4) });
          g.text('observed (illustrative)', 1090, 344, { size: 20, color: PAL.ink2, alpha: S.p(0, 0.8, 2.4) });
          g.line(1056, 368, 1082, 368, { color: COL, w: 4, alpha: P(S, 0, 0, 0.7) });
          g.text('neutral ZSM', 1090, 375, { size: 20, weight: 600, color: COL, alpha: P(S, 0, 0, 0.7) });
          g.text('θ ≈ 48, m ≈ 0.1', 1090, 399, { size: 19, color: PAL.ink2, alpha: P(S, 0, 0, 0.7) });
          g.text('after Hubbell 2001; Volkov et al. 2003', 1270, 816, { size: 19, italic: true, color: PAL.ink3, align: 'right', alpha: S.p(0, 0.8, 3.0) });
          // beat 1: a niche-based model fits the same pattern
          const B = D.best, nc = P(S, 1, 1, 0.05, 1.6), na = P(S, 1, 1, 0.1);
          g.plot(A, (x) => B.amp * Math.exp(-((x - B.mu) ** 2) / (2 * B.sg * B.sg)), { from: 0.5, to: 11.5, color: PAL.coral, w: 3.5, dash: [11, 8], progress: nc });
          g.line(1056, 430, 1082, 430, { color: PAL.coral, w: 3.5, dash: [8, 5], alpha: na });
          g.text('niche-based model', 1090, 437, { size: 20, weight: 600, color: PAL.coral, alpha: na });
          g.text('(lognormal-like)', 1090, 461, { size: 19, color: PAL.ink2, alpha: na });
          const s1 = S.p(1, 0.9, 0.4) * (1 - P(S, 1, 2, 0, 0.5)), s2 = P(S, 1, 2, 0, 0.9) * (1 - S.p(2, 0.6));
          g.text('Same pattern, different processes.', 1040, 874, { size: 32, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: s1 });
          g.text('Strict neutrality: almost certainly false.', 1040, 874, { size: 32, role: 'display', italic: true, color: PAL.coral, align: 'center', alpha: s2 });
        });
        // ================= left, beat 1: evidence for niche differences
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          const a1 = P(S, 1, 1, 0.42, 0.9);
          label(g, 'Stabilizing niche differences', 140, 262, a1, PAL.moss);
          const A = g.axes({ x: 190, y: 300, w: 450, h: 200, xmin: 0, xmax: 1, ymin: -1, ymax: 1, arrows: false, progress: a1 });
          g.line(A.X(0), A.Y(0), A.X(1), A.Y(0), { color: PAL.ink2, w: 1.6, alpha: a1 });
          g.text('per-capita growth', 190, 290, { size: 20, color: PAL.ink2, alpha: a1 });
          g.text('relative abundance →', A.X(1), A.Y(-1) + 34, { size: 21, color: PAL.ink2, align: 'right', alpha: a1 });
          g.plot(A, () => 0, { color: COL, w: 2.5, dash: [8, 7], progress: P(S, 1, 1, 0.45, 1), alpha: a1 });
          g.plot(A, (x) => 0.8 - 1.6 * x, { color: PAL.moss, w: 4, progress: P(S, 1, 1, 0.47, 1.2) });
          g.text('rare-species advantage', A.X(0.2), A.Y(0.72), { size: 21, color: PAL.moss, alpha: P(S, 1, 1, 0.52) });
          g.text('neutral: none', A.X(1), A.Y(0) - 12, { size: 21, color: COL, align: 'right', alpha: P(S, 1, 1, 0.52) });
          const a2 = P(S, 1, 1, 0.6, 0.9);
          label(g, 'Conspecific negative density dependence', 140, 590, a2, PAL.coral);
          const B = g.axes({ x: 190, y: 625, w: 450, h: 180, xmin: 0, xmax: 1, ymin: 0, ymax: 1, progress: a2, xlab: 'neighbor density', labSize: 21 });
          g.text('seedling survival', 204, 636, { size: 20, color: PAL.ink2, alpha: a2 });
          g.plot(B, () => 0.62, { color: PAL.moss, w: 3.5, progress: P(S, 1, 1, 0.64, 1) });
          g.plot(B, (x) => 0.85 * Math.exp(-1.9 * x) + 0.04, { color: PAL.coral, w: 4, progress: P(S, 1, 1, 0.66, 1.2) });
          g.text('heterospecific', B.X(1), B.Y(0.62) - 12, { size: 21, color: PAL.moss, align: 'right', alpha: P(S, 1, 1, 0.7) });
          g.text('conspecific', B.X(0.75), B.Y(0.32), { size: 21, color: PAL.coral, alpha: P(S, 1, 1, 0.72) });
          g.text('tropical trees on BCI: Harms et al. 2000; Comita et al. 2010', 150, 876, { size: 19, italic: true, color: PAL.ink3, alpha: P(S, 1, 1, 0.8) });
        });
        // ================= left, beat 2: null model → emergent neutrality
        const vN = S.p(2, 0.8) * (1 - S.tp(sent(S, 2, 3, 0) - 0.3, 0.6));
        if (vN > 0) g.withAlpha(vN, () => {
          label(g, 'Neutral theory as a null model', 140, 262, 1, COL);
          const A = g.axes({ x: 190, y: 320, w: 450, h: 420, xmin: 0, xmax: 10, ymin: 0, ymax: 1.25, xlab: 'test statistic', labSize: 22, progress: S.p(2, 1, 0.2) });
          const runs = Math.round(1000 * S.io(2, 3.5, 1.0));
          const bw = (A.X(0.3) - A.X(0)) - 2;
          for (let k = 0; k < 33; k++) {
            const x = k * 0.3, v = Math.exp(-((x + 0.15 - 4) ** 2) / 2) * clamp(runs / 1000 * 1.3 - Math.abs(x - 4) * 0.08);
            g.rect(A.X(x) + 1, A.Y(v), bw, A.Y(0) - A.Y(v), { fill: x + 0.15 > 5.96 ? U.rgba(COL, 0.35) : COL, alpha: 0.8 });
          }
          g.text(runs + ' neutral simulations', A.X(0.2), A.Y(1.2), { size: 19, role: 'mono', color: PAL.ink2, alpha: S.p(2, 0.6, 1.0) });
          g.text('what chance and', A.X(0.15), A.Y(0.76), { size: 21, color: COL, alpha: P(S, 2, 0, 0.35) });
          g.text('dispersal alone', A.X(0.15), A.Y(0.76) + 26, { size: 21, color: COL, alpha: P(S, 2, 0, 0.35) });
          g.text('can produce', A.X(0.15), A.Y(0.76) + 52, { size: 21, color: COL, alpha: P(S, 2, 0, 0.35) });
          const oa = P(S, 2, 0, 0.62);
          g.arrow(A.X(8.3), A.Y(0.62), A.X(8.3), A.Y(0) - 4, { color: PAL.coral, w: 3, head: 14, alpha: oa });
          g.text('observed', A.X(8.3), A.Y(0.62) - 16, { size: 23, weight: 600, color: PAL.coral, align: 'center', alpha: oa });
          g.text('departure → evidence for', A.X(7.6), A.Y(1.0), { size: 21, color: PAL.ink, align: 'center', alpha: P(S, 2, 0, 0.8) });
          g.text('niche processes', A.X(7.6), A.Y(1.0) + 26, { size: 21, color: PAL.ink, align: 'center', alpha: P(S, 2, 0, 0.8) });
        });
        const vE = P(S, 2, 3, 0, 0.9);
        if (vE > 0) g.withAlpha(vE, () => {
          label(g, 'Emergent neutrality · Scheffer & van Nes 2006', 140, 262, 1, COL);
          const A = g.axes({ x: 190, y: 320, w: 450, h: 370, xmin: 0, xmax: 1, ymin: 0, ymax: 1.08, ylab: 'abundance', labSize: 22 });
          xTitle(g, A, 'niche position (trait)');
          const pr = ease.inOut((t - sent(S, 2, 3, 0.06)) / 4.0) * (D.svn.length - 1), i0 = Math.floor(pr), i1 = Math.min(D.svn.length - 1, i0 + 1), f = pr - i0;
          const n = D.svn[0].length, bw = A.w / n - 0.8;
          for (let i = 0; i < n; i++) {
            const v = lerp(D.svn[i0][i], D.svn[i1][i], f) / D.svnMax, c = U.mix(PAL.lagoon, PAL.ochre, i / (n - 1));
            g.rect(A.X((i + 0.5) / n) - bw / 2, A.Y(v), bw, A.Y(0) - A.Y(v), { fill: c, alpha: 0.9 });
          }
          const tv = Math.round(lerp(D.snapT[i0], D.snapT[i1], f));
          g.text('t = ' + tv.toLocaleString('en-US'), A.X(1), A.Y(1.08) - 4, { size: 19, role: 'mono', color: PAL.ink2, align: 'right' });
          const ca = P(S, 2, 3, 0.62);
          for (const [a, b] of D.clumps) {
            const x0 = A.X(a / n) - 1, x1 = A.X((b + 1) / n) + 1, y = A.Y(0) + 14;
            g.line(x0, y, x1, y, { color: PAL.ink, w: 2, alpha: ca }); g.line(x0, y - 6, x0, y, { color: PAL.ink, w: 2, alpha: ca }); g.line(x1, y - 6, x1, y, { color: PAL.ink, w: 2, alpha: ca });
          }
          g.text('clumps of similar species', A.X(0.5), 800, { size: 23, color: PAL.ink, align: 'center', alpha: ca });
          g.text('near-neutral within clumps · distinct niches between', A.X(0.5), 832, { size: 21, color: PAL.ink2, align: 'center', alpha: P(S, 2, 3, 0.78) });
        });
        // ================= right, beat 2: Chesson's plane
        const vC = P(S, 2, 1, 0, 0.9);
        if (vC > 0) g.withAlpha(vC, () => {
          label(g, 'Chesson’s coexistence plane', 780, 262, 1, COL);
          const ap = P(S, 2, 1, 0.05, 1);
          const A = g.axes({ x: 830, y: 312, w: 440, h: 430, xmin: 0, xmax: 1, ymin: 0.25, ymax: 4, logy: true, ylab: 'κ_j/κ_i', labSize: 22, progress: ap, xticks: [{ v: 0, l: '0' }, { v: 0.5, l: '0.5' }, { v: 1, l: '1' }], yticks: [0.25, 0.5, 1, 2].map((v) => ({ v, l: String(v) })) });
          xTitle(g, A, 'niche difference  1 − ρ', ap); g.text('fitness ratio', A.x + 14, A.y + 4, { size: 19, color: PAL.ink2, alpha: ap });
          const wp = P(S, 2, 2, 0, 1.6);
          const up = [], lo = [];
          for (let k = 0; k <= 120; k++) { const x = k / 120 * 0.95; up.push([A.X(x), A.Y(1 / (1 - x))]); lo.push([A.X(x), A.Y(1 - x)]); }
          g.clip(A.x, A.y, A.w, A.h, () => {
            const fu = [], fl = []; for (let k = 0; k <= 60; k++) { const x = k / 60 * 0.999; fu.push([A.X(x), A.Y(Math.min(40, 1 / (1 - x)))]); fl.push([A.X(x), A.Y(Math.max(0.025, 1 - x))]); }
            g.poly([...fu, ...fl.reverse()], { fill: U.rgba(PAL.moss, 0.14 * wp), color: null, w: 0, close: true });
            g.poly(up, { color: PAL.moss, w: 3, progress: wp }); g.poly(lo, { color: PAL.moss, w: 3, progress: wp });
          });
          g.text('coexistence', A.X(0.78), A.Y(1.9), { size: 23, weight: 600, color: PAL.moss, align: 'center', alpha: P(S, 2, 2, 0.12) });
          g.math('ρ < κ_j/κ_i < 1/ρ', A.X(0.78), A.Y(1.9) + 34, { size: 24, color: PAL.ink, align: 'center', alpha: P(S, 2, 2, 0.16) });
          g.text('j excludes i', A.X(0.4), A.Y(3.5), { size: 21, color: PAL.ink2, alpha: P(S, 2, 2, 0.18) });
          g.text('i excludes j', A.X(0.4), A.Y(0.3), { size: 21, color: PAL.ink2, alpha: P(S, 2, 2, 0.18) });
          // neutrality at the apex
          const na = P(S, 2, 2, 0.2), x0 = A.X(0), y0 = A.Y(1);
          g.line(x0, y0, A.X(1), y0, { color: PAL.ink3, w: 1.2, dash: [5, 6], alpha: P(S, 2, 2, 0.85) });
          for (let k = 0; k < 2; k++) { const u = ((t * 0.7 + k * 0.5) % 1); g.circle(x0, y0, 8 + 18 * u, { stroke: COL, w: 2, alpha: na * (1 - u) }); }
          g.dot(x0, y0, 8, COL, na, 3);
          g.line(x0 + 8, y0 - 12, A.X(0.08), A.Y(2.65), { color: COL, w: 1.5, alpha: na });
          g.text('neutrality', A.X(0.09), A.Y(2.9), { size: 30, role: 'display', italic: true, color: COL, alpha: na });
          g.math('1 − ρ = 0', A.X(0.09), A.Y(2.9) + 34, { size: 26, color: PAL.ink, alpha: P(S, 2, 2, 0.62) });
          g.math('κ_j/κ_i = 1', A.X(0.09), A.Y(2.9) + 68, { size: 26, color: PAL.ink, alpha: P(S, 2, 2, 0.85) });
          // species pairs from the clumped community: within clumps ≈ neutral, between clumps stabilized
          const pa = P(S, 2, 3, 0.8), pb = pa * P(S, 2, 3, 0.88);
          [0.008, 0.02, 0.035].forEach((x) => g.dot(A.X(x), y0, 5, PAL.lagoon, pa, 2.4));
          [0.63, 0.86, 0.97].forEach((x) => g.dot(A.X(x), y0, 5, PAL.ochre, pb, 2.4));
          g.text('pairs within a clump', A.X(0.03), y0 + 38, { size: 19, color: PAL.lagoon, alpha: pa });
          g.text('pairs between clumps', A.X(0.98), y0 + 38, { size: 19, color: PAL.ochre, align: 'right', alpha: pb });
        });
      },
    },
  ],
});
})();
