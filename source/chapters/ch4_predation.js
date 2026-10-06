/* Chapter IV — Predation. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.coral;
const PREY = PAL.moss, PRED = PAL.coral;

/* ------------------------------------------------------------------ helpers */
const label = (g, s, x, y, a = 1, col = PAL.ink3, align = 'left') => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a, align });
// visibility envelope: fade in at beat k0, out at beat k1 (optional)
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
// window in local seconds: in at a, out at b
const win = (t, a, b, d = 0.6) => ease.out((t - a) / d) * (b === undefined ? 1 : 1 - ease.inOut((t - b) / d));

// Offsets were authored (in seconds into each beat) against reference beat lengths; rescale them to the
// actual narration so the visuals stay in sync if the audio is re-synthesized.
function scaled(S, ref) {
  const r = (k) => { const i = Math.floor(k); return ref[i] ? (S.e(i) - S.b(i)) / ref[i] : 1; };
  const at = (k, d = 0) => S.b(k) + d * r(k);
  return { ...S, r, at,
    p: (k, d = 0.9, delay = 0) => ease.out((S.t - at(k, delay)) / d),
    io: (k, d = 0.9, delay = 0) => ease.inOut((S.t - at(k, delay)) / d),
    lin: (k, d = 1, delay = 0) => clamp((S.t - at(k, delay)) / (d * r(k))),
  };
}

function rk4(f, y, dt) {
  const k1 = f(y[0], y[1]);
  const k2 = f(y[0] + dt / 2 * k1[0], y[1] + dt / 2 * k1[1]);
  const k3 = f(y[0] + dt / 2 * k2[0], y[1] + dt / 2 * k2[1]);
  const k4 = f(y[0] + dt * k3[0], y[1] + dt * k3[1]);
  return [y[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
}
// Equation built from coloured parts [[expr, colour, alpha, gapEm]]; returns [[x0, x1], ...].
function eqRow(g, parts, x, y, size, alpha = 1) {
  let X = x; const pos = [];
  for (const [e, col = PAL.ink, a = 1, gap = 0] of parts) {
    X += gap * size; const w = g.mathW(e, size);
    g.math(e, X, y, { size, color: col, alpha: a * alpha }); pos.push([X, X + w]); X += w;
  }
  return pos;
}
const placed = (g, x, y, s, fn) => g.with(() => { g.ctx.translate(x, y); g.ctx.scale(s, s); fn(); });

// --- small custom glyphs (100-unit box like engine icons)
function glyph(g, kind, x, y, s, color, o = {}) {
  const c = g.ctx; const a = o.alpha ?? 1; if (a <= 0) return;
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.flip) c.scale(-1, 1); c.scale(s / 100, s / 100);
  c.globalAlpha *= a; c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
  const E = (cx, cy, rx, ry, r = 0) => { c.beginPath(); c.ellipse(cx, cy, rx, ry, r, 0, Math.PI * 2); c.fill(); };
  switch (kind) {
    case 'caterpillar': {
      for (let k = 0; k < 7; k++) E(-42 + k * 13, 6 * Math.sin(k * 0.9 + (o.wig || 0)), 9, 10);
      E(46, -6, 11, 11); c.lineWidth = 3; c.beginPath(); c.moveTo(48, -16); c.lineTo(52, -28); c.moveTo(42, -16); c.lineTo(40, -28); c.stroke();
      c.fillStyle = PAL.bg; E(50, -8, 2.4, 2.4); break;
    }
    case 'wasp': {
      E(-18, 4, 22, 11, 0.1); E(10, 0, 9, 8); E(26, -4, 9, 8);
      c.fillStyle = PAL.ink; c.globalAlpha *= 0.4; E(0, -18, 18, 8, -0.6); E(10, -16, 14, 6, -0.9); c.globalAlpha /= 0.4; c.fillStyle = color;
      c.lineWidth = 3; c.beginPath(); c.moveTo(32, -10); c.lineTo(44, -26); c.moveTo(-40, 6); c.lineTo(-50, 10); c.stroke();
      c.strokeStyle = PAL.bg; c.lineWidth = 3; c.beginPath(); c.moveTo(-24, -6); c.lineTo(-26, 14); c.moveTo(-12, -6); c.lineTo(-14, 14); c.stroke(); break;
    }
    case 'orca': {
      const body = () => { c.beginPath(); c.moveTo(-58, 0); c.bezierCurveTo(-30, -22, 25, -24, 54, -4); c.bezierCurveTo(60, 0, 58, 8, 48, 11); c.bezierCurveTo(15, 20, -30, 14, -58, 0); c.closePath(); };
      c.fillStyle = '#0F1B1E'; c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-10, -18); c.quadraticCurveTo(-4, -40, 2, -58); c.quadraticCurveTo(6, -32, 16, -20); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-54, -1); c.quadraticCurveTo(-70, -8, -86, -5); c.quadraticCurveTo(-76, 0, -84, 6); c.quadraticCurveTo(-68, 5, -54, 3); c.closePath(); c.fill(); c.stroke();
      body(); c.fill(); c.stroke();
      c.fillStyle = PAL.ink; E(34, -8, 9, 3.6, -0.12); E(22, 10, 26, 4.2, 0.04);
      c.fillStyle = PAL.ink3; E(-14, -15, 11, 3, 0.15);
      c.fillStyle = '#0F1B1E'; E(16, 15, 10, 4, 0.6); break;
    }
    case 'cat': {
      E(-6, 10, 30, 16); c.fillRect(-28, 14, 7, 30); c.fillRect(-14, 16, 7, 28); c.fillRect(6, 16, 7, 28); c.fillRect(18, 14, 7, 30);
      E(30, -10, 15, 14);
      for (const ex of [22, 38]) { c.beginPath(); c.moveTo(ex - 7, -18); c.lineTo(ex, -36); c.lineTo(ex + 7, -18); c.fill(); }
      c.lineWidth = 7; c.beginPath(); c.moveTo(-34, 6); c.quadraticCurveTo(-58, 0, -50, -30); c.stroke();
      c.fillStyle = PAL.bg; E(35, -12, 2.4, 2.4); break;
    }
    case 'speaker': {
      c.fillRect(-40, -16, 22, 32); c.beginPath(); c.moveTo(-18, -16); c.lineTo(10, -38); c.lineTo(10, 38); c.lineTo(-18, 16); c.closePath(); c.fill();
      c.lineWidth = 6; for (const r of [24, 42]) { c.beginPath(); c.arc(14, 0, r, -0.7, 0.7); c.stroke(); } break;
    }
    case 'eye': {
      c.lineWidth = 6; c.beginPath(); c.moveTo(-46, 0); c.quadraticCurveTo(0, -46, 46, 0); c.quadraticCurveTo(0, 46, -46, 0); c.stroke();
      E(0, 0, 15, 15); c.fillStyle = PAL.bg; E(4, -4, 5, 5); break;
    }
    case 'rock': {
      c.beginPath(); c.moveTo(-50, 30); c.quadraticCurveTo(-46, -30, 0, -34); c.quadraticCurveTo(46, -30, 50, 30); c.lineTo(22, 30); c.quadraticCurveTo(20, 0, 0, 0); c.quadraticCurveTo(-20, 0, -22, 30); c.closePath(); c.fill(); break;
    }
    default: E(0, 0, 30, 30);
  }
  c.restore();
}

// Lotka–Volterra parameters (equilibrium N* = m/(ca) = 40, P* = r/a = 20)
const LV = { r: 1, a: 0.05, c: 0.4, m: 0.8 };

Theater.chapter({
  id: 'pred', roman: 'IV', title: 'Predation', color: COL,
  question: 'How do consumers and their victims shape each other?',
  intro: { t: 'Chapter four. Predation: the dynamics of eating and being eaten.' },
  motif(g, t) {
    // faint nested Lotka–Volterra orbits (closed form: conserved quantity contours, traced via RK4 once)
    const M = this._motif || (this._motif = (() => {
      const { r, a, c, m } = LV; const f = (N, P) => [r * N - a * N * P, c * a * N * P - m * P];
      return [1.35, 1.8, 2.4, 3.1].map((s) => {
        let y = [s * 40, 20]; const pts = [y]; let turned = 0, prev = 0;
        for (let k = 0; k < 20000; k++) {
          y = rk4(f, y, 0.004); const ang = Math.atan2(y[1] / 20 - 1, y[0] / 40 - 1);
          let d = ang - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turned += d; prev = ang;
          if (k % 4 === 0) pts.push(y); if (turned >= 2 * Math.PI) break;
        }
        pts.push(pts[0]); return pts;
      });
    })());
    const X = (N) => 1180 + N * 4.4, Y = (P) => 352 - P * 4.3;
    M.forEach((pts, k) => g.poly(pts.map(([N, P]) => [X(N), Y(P)]), { color: k % 2 ? PAL.moss : COL, w: 2, alpha: 0.32, progress: ease.inOut((t - 0.6 - k * 0.35) / 2.6) }));
    g.circle(X(40), Y(20), 4, { fill: COL, alpha: 0.35 * ease.out((t - 1) / 1) });
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'pred-lv', title: 'Predator–prey cycles',
      beats: [
        { t: 'Predation is a plus–minus interaction, and the term spans true predators, herbivores, parasitoids, and parasites. Its simplest model, from Lotka and Volterra in the 1920s, gives prey exponential growth in the absence of predators, and lets predators convert captured prey into new predators while dying at a constant rate.',
          s: 'Predation is a plus minus interaction, and the term spans true predators, herbivores, parasitoids, and parasites. Its simplest model, from Lotka and Volterra in the 1920s, gives prey exponential growth in the absence of predators, and lets predators convert captured prey into new predators while dying at a constant rate.' },
        { t: 'The model’s signature is coupled oscillation. Prey increase, then predators increase; prey crash, and predators follow, with predator peaks lagging prey peaks by about a quarter cycle.' },
        { t: 'In the phase plane, the two populations circle their equilibrium in closed loops. These neutral cycles have an amplitude set entirely by the starting conditions, and any disturbance shifts the system onto a new cycle. The model is structurally unstable, better for intuition than for prediction.' },
        { t: 'Yet real cycles exist. Snowshoe hares and Canada lynx, recorded in Hudson’s Bay Company fur returns, cycle roughly every ten years. Experiments by Charles Krebs and colleagues in the Yukon showed that the hare cycle arises from food and predation acting together, with predation risk also causing stress that suppresses hare reproduction.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.6, term: 'Lotka–Volterra predator–prey model', def: 'dN/dt = rN − aNP; dP/dt = caNP − mP: exponential prey, linear functional response.' },
        { beat: 2.35, term: 'Neutral cycles', def: 'Closed orbits whose amplitude depends only on initial conditions; structurally unstable.' },
        { beat: 3.2, term: 'Population cycle', def: 'Regular multi-year oscillation in abundance, e.g., the ~10-year snowshoe hare–lynx cycle.' },
      ],
      init() {
        const { r, a, c, m } = LV; const Ns = m / (c * a), Ps = r / a;
        const f = (N, P) => [r * N - a * N * P, c * a * N * P - m * P];
        const ds = 0.02, sub = 8;
        const orbit = (s) => {
          let y = [s * Ns, Ps]; const pts = [y]; let turned = 0, prev = 0;
          for (let k = 0; k < 100000; k++) {
            for (let j = 0; j < sub; j++) y = rk4(f, y, ds / sub);
            const ang = Math.atan2(y[1] / Ps - 1, y[0] / Ns - 1); let d = ang - prev;
            if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turned += d; prev = ang;
            if (turned >= 2 * Math.PI) break; pts.push(y);
          }
          return { s, pts, ang: pts.map(([N, P]) => Math.atan2(P / Ps - 1, N / Ns - 1)) };
        };
        const orbs = [1.3, 1.65, 2.1, 2.7].map(orbit);
        // time series: start at the prey minimum of a moderate orbit
        const o = orbit(1.55); const n = o.pts.length; let iMin = 0; o.pts.forEach((p, i) => { if (p[0] < o.pts[iMin][0]) iMin = i; });
        const TS = []; for (let k = 0; k * ds <= 20.0001; k++) { const p = o.pts[(iMin + k) % n]; TS.push([k * ds, p[0], p[1]]); }
        const peaks = (j) => { const out = []; for (let k = 1; k < TS.length - 1; k++) if (TS[k][j] > TS[k - 1][j] && TS[k][j] >= TS[k + 1][j]) out.push(k); return out; };
        const troughs = (j) => { const out = []; for (let k = 1; k < TS.length - 1; k++) if (TS[k][j] < TS[k - 1][j] && TS[k][j] <= TS[k + 1][j]) out.push(k); return out; };
        // stylized Hudson's Bay Company series (half-year resolution)
        const T = 9.7, y0 = 1856.5; const sh = (th) => Math.pow((1 + Math.cos(th)) / 2, 2.2); const jr = rng(1914);
        const ampH = [0.82, 0.8, 1.0, 0.72, 0.95, 1.06, 0.85, 0.98, 0.78, 0.92, 1.0], ampL = [0.8, 0.75, 0.95, 0.8, 1.0, 0.88, 0.95, 1.05, 0.82, 0.9, 0.95];
        const ci = (yr, lag) => clamp(Math.floor((yr - y0 - lag + T / 2) / T) + 1, 0, 10);
        const hbc = []; for (let yr = 1850; yr <= 1930; yr += 1) { const j1 = 1 + 0.12 * (jr() - 0.5), j2 = 1 + 0.12 * (jr() - 0.5); hbc.push([yr, (6 + 140 * ampH[ci(yr, 0)] * sh(2 * Math.PI * (yr - y0) / T)) * j1, (3 + 64 * ampL[ci(yr, 1.6)] * sh(2 * Math.PI * (yr - y0 - 1.6) / T)) * j2]); }
        // structural instability: add weak prey self-limitation (K = 400) and the loops become a damped spiral
        const fK = (N, P) => [r * N * (1 - N / 400) - a * N * P, c * a * N * P - m * P];
        const spiral = []; { let y = [2.7 * Ns, Ps]; for (let k = 0; k <= 1800; k++) { if (k % 3 === 0) spiral.push(y); for (let j = 0; j < 4; j++) y = rk4(fK, y, 0.005); } }
        return { Ns, Ps, ds, orbs, TS, spiral, nPk: peaks(1), pPk: peaks(2), nTr: troughs(1), pTr: troughs(2), hbc, T, y0 };
      },
      draw(g, t, S0, D) {
        const S = scaled(S0, [21.2, 11.7, 17.7, 21.2]);
        const ink = PAL.ink;
        /* ---------- beat 0: four guises of a (+, −) interaction */
        const v0 = vis(S, 0, 1);
        g.withAlpha(v0, () => {
          label(g, 'One interaction, many guises', 140, 262, S.p(0, 0.8, 0.2));
          const V = [['true predators', 'lynx', 'hare', 4.4], ['herbivores', 'deer', 'plant', 5.7], ['parasitoids', 'wasp', 'caterpillar', 6.8], ['parasites', 'worm', 'fish', 7.9]];
          V.forEach(([nm, cons, vic, d], k) => {
            const cx = 262 + k * 292, cy = 400;
            const pi = k === 0 ? S.p(0, 0.8, 0.5) : S.p(0, 0.7, d - 0.3);
            const pl = S.p(0, 0.7, d); const bob = Math.sin(t * 2.2 + k) * 2.5;
            g.withAlpha(pi, () => {
              g.rect(cx - 136, cy - 110, 272, 226, { r: 10, fill: 'rgba(18,36,38,0.55)', stroke: PAL.rule, w: 1.2 });
              const xc = cx - 62, xv = cx + 64;
              if (cons === 'lynx') g.icon('lynx', xc - 4, cy + 4, 104, PRED);
              else if (cons === 'deer') g.icon('deer', xc - 4, cy + 4, 100, PRED);
              else if (cons === 'wasp') glyph(g, 'wasp', xc, cy - 4 + bob, 96, PRED);
              else if (cons === 'worm') {
                const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([xc - 42 + 84 * u, cy + 2 + 13 * Math.sin(u * 9 + t * 1.6)]); }
                g.poly(pts, { color: PRED, w: 8 }); g.circle(xc + 42, cy + 2 + 13 * Math.sin(9 + t * 1.6), 7, { fill: PRED });
              }
              if (vic === 'hare') g.icon('hare', xv, cy + 8, 90, PREY, { flip: true });
              else if (vic === 'plant') g.icon('plant', xv, cy + 2, 96, PREY, { flower: PAL.ochre });
              else if (vic === 'caterpillar') glyph(g, 'caterpillar', xv - 4, cy + 12, 90, PREY, { wig: t * 2 });
              else if (vic === 'fish') { g.icon('fish', xv, cy + 2, 96, PREY); g.poly([[xv - 22, cy + 2], [xv - 10, cy - 5], [xv + 2, cy + 7], [xv + 14, cy]], { color: PRED, w: 3.5 }); }
              g.text('+', xc, cy - 66, { size: 42, weight: 600, color: PRED, align: 'center' });
              g.text('−', xv, cy - 66, { size: 42, weight: 600, color: PREY, align: 'center' });
              g.text(nm, cx, cy + 96, { size: 24, color: PAL.ink, align: 'center', alpha: pl });
            });
          });
          // icons beside the equations
          g.icon('hare', 205, 632, 72, PREY, { alpha: S.p(0, 0.8, 13.0), flip: true });
          g.icon('lynx', 205, 800, 78, PRED, { alpha: S.p(0, 0.8, 16.8) });
          g.text('Lotka (1925) · Volterra (1926)', 140, 566, { size: 21, color: PAL.ink3, alpha: S.p(0, 0.8, 10.6) });
          // glossary of terms
          const gl = [['rN', PREY, 'exponential prey growth', 627, 13.4], ['aNP', PRED, 'prey killed: aN per predator', 673, 15.2],
            ['caNP', PRED, 'kills converted into predators', 795, 17.2], ['mP', PAL.heather, 'constant predator death rate', 841, 20.2]];
          gl.forEach(([e, col, s, y, d]) => { const p = S.p(0, 0.7, d); g.math(e, 820, y, { size: 31, color: col, alpha: p }); g.text(s, 920, y - 2, { size: 22, color: PAL.ink2, alpha: p }); });
        });
        /* ---------- the model equations travel through beats 0–2 */
        {
          const u1 = S.io(1, 1.2), u2 = S.io(2, 1.2);
          const P0 = [[300, 655], [300, 822], 1], P1 = [[170, 845], [650, 845], 0.72], P2 = [[930, 352], [930, 432], 0.66];
          const L = (k) => [lerp(lerp(P0[k][0], P1[k][0], u1), P2[k][0], u2), lerp(lerp(P0[k][1], P1[k][1], u1), P2[k][1], u2)];
          const sc = lerp(lerp(P0[2], P1[2], u1), P2[2], u2);
          const A = (d) => S.p(0, 0.8, d);
          const al = 1 - S.p(3, 0.6);
          const [x1, y1] = L(0), [x2, y2] = L(1);
          placed(g, x1, y1, sc, () => eqRow(g, [['\\frac{dN}{dt}', ink, A(10.6)], ['=', ink, A(10.6), 0.3], ['rN', PREY, A(13.2)], ['−', ink, A(15.0), 0.22], ['aNP', PRED, A(15.0)]], 0, 0, 54, al));
          placed(g, x2, y2, sc, () => eqRow(g, [['\\frac{dP}{dt}', ink, A(10.6)], ['=', ink, A(10.6), 0.3], ['caNP', PRED, A(17.0)], ['−', ink, A(20.0), 0.22], ['mP', PAL.heather, A(20.0)]], 0, 0, 54, al));
        }
        /* ---------- beat 1: coupled oscillations in time */
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          label(g, 'Coupled oscillation', 140, 262);
          const A = g.axes({ x: 170, y: 300, w: 1090, h: 410, xmin: 0, xmax: 18.6, ymin: 0, ymax: 72, xlab: 't', ylab: 'abundance', labSize: 22, progress: S.p(1, 1) });
          // legend
          const lp = S.p(1, 0.8, 0.6);
          g.icon('hare', 985, 252, 40, PREY, { alpha: lp, flip: true }); g.text('prey N', 1013, 260, { size: 22, color: PREY, alpha: lp });
          g.icon('lynx', 1140, 252, 42, PRED, { alpha: lp }); g.text('predators P', 1170, 260, { size: 22, color: PRED, alpha: lp });
          const tau = clamp((t - S.at(1, 1.9)) * 2.0 / S.r(1), 0, 18.5); const k = Math.round(tau / D.ds);
          if (k > 0) {
            const seg = D.TS.slice(0, k + 1);
            g.data(A, seg.map((p) => [p[0], p[1]]), { color: PREY, w: 4 });
            g.data(A, seg.map((p) => [p[0], p[2]]), { color: PRED, w: 4 });
            const q = D.TS[k]; g.dot(A.X(q[0]), A.Y(q[1]), 6, PREY, 1, 3); g.dot(A.X(q[0]), A.Y(q[2]), 6, PRED, 1, 3);
          }
          const T = D.TS, ds = D.ds;
          // narrated phases flank the first peaks: prey labels above, predator labels below
          const n0 = D.nPk[0], p0 = D.pPk[0], fadeOut = 1 - S.p(2, 0.5);
          const ap = (i) => clamp((tau - i * ds) / 0.9) * fadeOut;
          const xn = A.X(n0 * ds), yn = A.Y(T[n0][1]) - 26, xp = A.X(p0 * ds), yp = A.Y(T[p0][2]);
          g.text('prey increase', xn - 18, yn, { size: 22, color: PREY, align: 'right', alpha: ap(Math.round(n0 * 0.5)) });
          g.text('prey crash', xn + 18, yn, { size: 22, color: PREY, align: 'left', alpha: ap(Math.round(n0 * 1.35)) });
          g.text('predators increase', xp - 18, A.Y(0) - 18, { size: 22, color: PRED, align: 'right', alpha: ap(Math.round((n0 + p0) / 2)) });
          g.text('predators follow', xp + 18, A.Y(0) - 18, { size: 22, color: PRED, align: 'left', alpha: ap(Math.round(p0 * 1.3)) });
          g.line(xp, yp + 14, xp, A.Y(0) - 44, { color: PRED, w: 1.2, dash: [3, 5], alpha: ap(p0) * 0.8 });
          // lag bracket on the second cycle
          const i1 = D.nPk[1], i2 = D.pPk[1];
          if (i1 && i2) {
            const lp2 = S.p(1, 0.8, 8.6); const xa = A.X(i1 * ds), xb = A.X(i2 * ds), yb = A.Y(69);
            g.line(xa, A.Y(T[i1][1]) - 10, xa, yb, { color: PREY, w: 1.6, dash: [5, 6], alpha: lp2 });
            g.line(xb, A.Y(T[i2][2]) - 10, xb, yb, { color: PRED, w: 1.6, dash: [5, 6], alpha: lp2 });
            g.arrow(xa + 2, yb, xb - 2, yb, { color: ink, w: 2.2, head: 11, both: true, alpha: lp2 });
            g.text('≈ ¼-cycle lag', xb + 16, yb + 7, { size: 22, color: ink, align: 'left', alpha: lp2 });
          }
        });
        /* ---------- beat 2: phase plane with neutral cycles */
        const v2 = vis(S, 2, 3);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Phase plane', 140, 262);
          const A = g.axes({ x: 180, y: 300, w: 600, h: 520, xmin: 0, xmax: 120, ymin: 0, ymax: 56, xlab: 'N', ylab: 'P', progress: S.p(2, 1) });
          g.text('prey', A.X(120) - 30, A.Y(0) + 40, { size: 21, color: PREY, align: 'right', alpha: S.p(2, 1, 0.5) });
          g.text('predators', A.X(0) + 34, A.Y(56) + 4, { size: 21, color: PRED, alpha: S.p(2, 1, 0.5) });
          const Ns = D.Ns, Ps = D.Ps; const ip = S.p(2, 0.9, 2.6);
          // flow field
          const fp = S.p(2, 1.2, 3.0) * 0.55;
          if (fp > 0) for (let N = 12; N <= 112; N += 20) for (let P = 6; P <= 54; P += 8) {
            const dN = LV.r * N - LV.a * N * P, dP = LV.c * LV.a * N * P - LV.m * P;
            const sx = dN * 600 / 120, sy = -dP * 520 / 56; const L = Math.hypot(sx, sy) || 1; const x = A.X(N), y = A.Y(P);
            g.arrow(x - sx / L * 8, y - sy / L * 8, x + sx / L * 8, y + sy / L * 8, { color: PAL.ink3, w: 1.6, head: 7, alpha: fp });
          }
          g.line(A.X(0), A.Y(Ps), A.X(120) + 16, A.Y(Ps), { color: PREY, w: 2, dash: [9, 8], alpha: ip });
          g.line(A.X(Ns), A.Y(0), A.X(Ns), A.Y(56), { color: PRED, w: 2, dash: [9, 8], alpha: ip });
          g.math('\\frac{dN}{dt} = 0', A.X(120) + 26, A.Y(Ps) + 9, { size: 26, color: PREY, alpha: ip });
          g.math('\\frac{dP}{dt} = 0', A.X(Ns) + 12, A.Y(52), { size: 26, color: PRED, alpha: ip });
          // orbits
          const t0 = S.b(2), T2 = (d) => S.at(2, d), when = [3.0, 5.4, 6.4, 7.4];
          const kick = T2(10.2); const after = t >= kick;
          const su = S.p(2, 1.0, 13.6); // structural-instability demo
          D.orbs.forEach((o, k) => {
            const d = when[k]; const pr = ease.inOut((t - T2(d)) / 1.6); if (pr <= 0) return;
            const pts = o.pts.map(([N, P]) => [A.X(N), A.Y(P)]); pts.push(pts[0]);
            const on = (k === 1 && !after) || (k === 2 && after);
            g.poly(pts, { color: on ? COL : PAL.ink2, w: on ? 3.4 : 2.2, alpha: (on ? 1 : 0.6) * (1 - 0.65 * su), progress: pr });
            if (pr >= 1) for (const f of [0.22, 0.72]) { const i = Math.floor(f * o.pts.length); const [xa, ya] = pts[i], [xb, yb] = pts[i + 3]; g.arrowHead(xb, yb, Math.atan2(yb - ya, xb - xa), 13, on ? COL : PAL.ink2); }
            // starting condition marker
            g.circle(A.X(o.s * Ns), A.Y(Ps), 7, { fill: PAL.bg, stroke: PAL.ochre, w: 2.5, alpha: ease.out((t - T2(d) + 0.4) / 0.5) });
          });
          if (su > 0) {
            const sp = D.spiral.map(([N, P]) => [A.X(N), A.Y(P)]);
            g.poly(sp, { color: PAL.ochre, w: 2.6, progress: ease.inOut((t - T2(13.8)) / 3.2), alpha: su });
            g.text('add weak prey self-limitation:', A.X(119), A.Y(54.5), { size: 21, color: PAL.ochre, align: 'right', alpha: su });
            g.text('loops become a damped spiral', A.X(119), A.Y(54.5) + 26, { size: 21, color: PAL.ochre, align: 'right', alpha: su });
          }
          g.text('starting points', A.X(2.7 * Ns) + 4, A.Y(Ps) + 34, { size: 20, color: PAL.ochre, align: 'center', alpha: S.p(2, 0.8, 7.6) });
          g.circle(A.X(Ns), A.Y(Ps), 7, { fill: ink, alpha: ip });
          // the system point: on orbit 1, kicked onto orbit 2 by a disturbance
          const st = T2(3.0); if (t > st) {
            const sp = 1.35; let o, i;
            if (!after) { o = D.orbs[1]; i = Math.floor((t - st) * sp / D.ds) % o.pts.length; }
            else {
              const o1 = D.orbs[1]; const i1 = Math.floor((kick - st) * sp / D.ds) % o1.pts.length; const ang = o1.ang[i1];
              o = D.orbs[2]; let best = 0, bd = 9; o.ang.forEach((a2, j) => { let dd = Math.abs(a2 - ang); if (dd > Math.PI) dd = 2 * Math.PI - dd; if (dd < bd) { bd = dd; best = j; } });
              i = (best + Math.floor((t - kick) * sp / D.ds)) % o.pts.length;
              const [Na, Pa] = o1.pts[i1], [Nb, Pb] = o.pts[best]; const ka = win(t, kick, kick + 3.2, 0.3);
              g.arrow(A.X(Na), A.Y(Pa), A.X(Nb), A.Y(Pb), { color: PAL.ochre, w: 2.5, head: 12, alpha: ka });
              g.glow(A.X(Na), A.Y(Pa), 40, PAL.ochre, 0.6 * win(t, kick, kick + 0.6, 0.15));
              const ox = A.X(Nb) - A.X(Ns), oy = A.Y(Pb) - A.Y(Ps), oL = Math.hypot(ox, oy) || 1;
              g.text('disturbance', A.X(Nb) + ox / oL * 26, A.Y(Pb) + oy / oL * 26 + 8, { size: 22, color: PAL.ochre, align: ox < 0 ? 'right' : 'left', alpha: ka });
            }
            const [N, P] = o.pts[i]; g.dot(A.X(N), A.Y(P), 8, PAL.ink, ease.out((t - st) / 0.5), 3.4);
          }
          // right column: isoclines and lessons
          const rp = (d) => S.p(2, 0.8, d);
          g.math('P^{*} = \\frac{r}{a}', 930, 540, { size: 38, color: PREY, alpha: ip });
          g.text('prey isocline', 1080, 532, { size: 21, color: PAL.ink2, alpha: ip });
          g.math('N^{*} = \\frac{m}{ca}', 930, 620, { size: 38, color: PRED, alpha: ip });
          g.text('predator isocline', 1080, 612, { size: 21, color: PAL.ink2, alpha: ip });
          g.wrap('Neutral cycles: the amplitude is set by the starting point.', 930, 700, 370, { size: 22, color: PAL.ink, alpha: rp(6.0) });
          g.pill('structurally unstable', 930, 790, { color: COL, size: 21, alpha: rp(13.3) });
          g.wrap('Any small change to the equations destroys the closed loops.', 930, 840, 370, { size: 21, color: PAL.ink2, alpha: rp(14.0) });
        });
        /* ---------- beat 3: hares, lynx, and the Kluane experiments */
        const v3 = S.p(3, 0.9);
        if (v3 > 0) g.withAlpha(v3, () => {
          label(g, 'Hudson’s Bay Company fur returns (stylized)', 140, 262);
          const lp = S.p(3, 0.8, 2.4);
          g.icon('hare', 915, 250, 40, PREY, { alpha: lp, flip: true }); g.text('snowshoe hare', 943, 259, { size: 21, color: PREY, alpha: lp });
          g.icon('lynx', 1135, 250, 42, PRED, { alpha: S.p(3, 0.8, 3.0) }); g.text('Canada lynx', 1165, 259, { size: 21, color: PRED, alpha: S.p(3, 0.8, 3.0) });
          const xt = []; for (let y = 1850; y <= 1930; y += 10) xt.push({ v: y, l: String(y) });
          const A = g.axes({ x: 170, y: 300, w: 1090, h: 270, xmin: 1848, xmax: 1932, ymin: 0, ymax: 160, xticks: xt, yticks: [{ v: 0, l: '0' }, { v: 50, l: '50' }, { v: 100, l: '100' }, { v: 150, l: '150' }], progress: S.p(3, 1) });
          g.text('pelts (thousands)', 186, 306, { size: 19, color: PAL.ink2, alpha: S.p(3, 1) });
          const yr = 1850 + 80 * S.lin(3, 6.0, 3.2); const n = Math.floor(yr - 1850), f = yr - 1850 - n;
          if (yr > 1850.01) {
            const seg = D.hbc.slice(0, n + 1); const nx = D.hbc[Math.min(80, n + 1)];
            const tipN = [yr, lerp(seg[n][1], nx[1], f)], tipP = [yr, lerp(seg[n][2], nx[2], f)];
            g.data(A, [...seg.map((p) => [p[0], p[1]]), tipN], { color: PREY, w: 3 });
            g.data(A, [...seg.map((p) => [p[0], p[2]]), tipP], { color: PRED, w: 3 });
            for (const p of seg) { g.circle(A.X(p[0]), A.Y(p[1]), 2.6, { fill: PREY }); g.circle(A.X(p[0]), A.Y(p[2]), 2.6, { fill: PRED }); }
          }
          const pp = S.p(3, 0.8, 8.6); const ya = D.y0 + 3 * D.T, yb2 = D.y0 + 4 * D.T, yl = A.Y(158);
          g.arrow(A.X(ya), yl, A.X(yb2), yl, { color: PAL.ink, w: 2, head: 10, both: true, alpha: pp });
          g.text('≈ 10 years', (A.X(ya) + A.X(yb2)) / 2, yl - 12, { size: 21, color: PAL.ink, align: 'center', alpha: pp });
          // Kluane factorial experiment
          const kp = S.p(3, 0.8, 10.4);
          label(g, 'Kluane, Yukon · Krebs et al. 1995', 140, 676, kp);
          const rows = [['control', 1, PAL.ink3, 11.2], ['+ food', 3, PAL.ochre, 15.4], ['− predators', 2, PRED, 16.2], ['+ food, − predators', 11, PAL.moss, 17.0]];
          rows.forEach(([nm, v, col, d], k) => {
            const p = S.p(3, 0.9, d); const y = 712 + k * 46;
            g.text(nm, 170, y + 8, { size: 21, color: PAL.ink2, alpha: p });
            g.rect(380, y - 12, 34 * v * p, 26, { fill: col, r: 3, alpha: 0.85 * p });
            g.text('×' + v, 390 + 34 * v * p, y + 8, { size: 21, role: 'mono', color: PAL.ink, alpha: p });
          });
          g.text('hare density relative to control', 380, 895, { size: 19, color: PAL.ink3, italic: true, alpha: S.p(3, 0.8, 17.6) });
          // predation risk → stress → reproduction
          const sp = (d) => S.p(3, 0.8, d);
          label(g, 'The cost of fear', 880, 676, sp(18.2));
          g.icon('lynx', 920, 722, 50, PRED, { alpha: sp(18.2) });
          g.text('predation risk', 965, 730, { size: 22, color: PRED, alpha: sp(18.2) });
          g.arrow(920, 752, 920, 784, { color: PAL.ink3, w: 2, head: 9, alpha: sp(19.2) });
          g.text('chronic stress (glucocorticoids ↑)', 965, 790, { size: 22, color: PAL.ink, alpha: sp(19.2) });
          g.arrow(920, 808, 920, 840, { color: PAL.ink3, w: 2, head: 9, alpha: sp(20.0) });
          g.icon('hare', 920, 862, 40, PREY, { alpha: sp(20.0), flip: true });
          g.text('fewer leverets per female', 965, 870, { size: 22, color: PREY, alpha: sp(20.0) });
        });
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'pred-fr', title: 'Functional & numerical responses',
      beats: [
        { t: 'In 1959, C. S. Holling asked how a predator’s feeding rate changes with prey density. The answer is its functional response, and it comes in three types.' },
        { t: 'A Type I response rises linearly until the predator is satiated, typical of filter feeders. A Type II response decelerates, because each capture costs handling time. Holling’s disc equation gives intake as aN / (1 + ahN), where a is the attack rate and h is the handling time. Intake saturates at 1/h.',
          s: 'A Type one response rises linearly until the predator is satiated, typical of filter feeders. A Type two response decelerates, because each capture costs handling time. Holling’s disc equation gives intake as a N over one plus a h N, where a is the attack rate and h is the handling time. Intake saturates at one over h.' },
        { t: 'A Type III response is sigmoid: predators take few prey at low density, then accelerate, through learning a search image, switching between prey types, or because scarce prey find refuges.',
          s: 'A Type three response is sigmoid: predators take few prey at low density, then accelerate, through learning a search image, switching between prey types, or because scarce prey find refuges.' },
        { t: 'The type matters for stability. With Type II, per-capita risk to prey falls as prey become more numerous, an inverse density dependence that is destabilizing. With Type III, risk rises with prey density at low densities, which can regulate prey and stabilize the interaction.',
          s: 'The type matters for stability. With Type two, per-capita risk to prey falls as prey become more numerous, an inverse density dependence that is destabilizing. With Type three, risk rises with prey density at low densities, which can regulate prey and stabilize the interaction.' },
        { t: 'The numerical response is the change in predator numbers, through reproduction or immigration, as prey increase. Multiply the functional and numerical responses to get the total response: the overall predation pressure on the prey population.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.55, term: 'Functional response', def: 'Per-predator consumption rate as a function of prey density (Holling Types I, II, III).' },
        { beat: 1.45, term: 'Handling time (h)', def: 'Time to pursue, subdue, and consume one prey item; caps intake at 1/h in a Type II response.' },
        { beat: 2.4, term: 'Prey switching', def: 'Disproportionate attack on whichever prey type is most common; one cause of Type III responses.' },
        { beat: 4.1, term: 'Numerical response', def: 'Change in predator density with prey density, via reproduction or aggregation.' },
        { beat: 4.6, term: 'Total response', def: 'Functional × numerical response: total prey killed per unit time.' },
      ],
      init() {
        // Holling's searcher in a disc arena: random search, contact capture, fixed handling time.
        const R = rng(1959), AX = 880, AY = 312, AW = 400, AH = 210, nd = 13, dt = 1 / 30;
        const rpos = () => [AX + 18 + R() * (AW - 36), AY + 18 + R() * (AH - 36)];
        const discs = Array.from({ length: nd }, () => ({ p: rpos(), alive: true, back: 0 }));
        let x = AX + AW / 2, y = AY + AH / 2, th = 0.6, hand = 0; const frames = [];
        for (let k = 0; k < 40 * 30; k++) {
          const tt = k * dt;
          for (const d of discs) if (!d.alive && tt >= d.back) { d.alive = true; d.p = rpos(); d.born = tt; }
          if (hand > 0) hand = Math.max(0, hand - dt);
          else {
            th += (R() - 0.5) * 0.7; x += Math.cos(th) * 140 * dt; y += Math.sin(th) * 140 * dt;
            if (x < AX + 10 || x > AX + AW - 10) { th = Math.PI - th; x = clamp(x, AX + 10, AX + AW - 10); }
            if (y < AY + 10 || y > AY + AH - 10) { th = -th; y = clamp(y, AY + 10, AY + AH - 10); }
            for (const d of discs) if (d.alive && Math.hypot(d.p[0] - x, d.p[1] - y) < 20) { d.alive = false; d.back = tt + 2.2; hand = 0.9; x = d.p[0]; y = d.p[1]; break; }
          }
          frames.push({ x, y, hand, d: discs.map((d) => [d.p[0], d.p[1], d.alive ? 1 : 0, d.born || -9]) });
        }
        return { frames, AX, AY, AW, AH };
      },
      draw(g, t, S0, D) {
        const S = scaled(S0, [10.5, 20.7, 12.0, 17.8, 14.5]);
        const aII = 0.4, bIII = 0.08;
        const fI = (N) => Math.min(0.4 * N, 1.1), fII = (N) => aII * N / (1 + aII * N), fIII = (N) => bIII * N * N / (1 + bIII * N * N);
        const nr = (N) => N * N / (16 + N * N); // numerical response (predators per area, relative)
        const C1 = PAL.ochre, C2 = COL, C3 = PAL.heather;
        // main axes travel: big (beats 0–2) → left panel (beat 3) → first of three panels (beat 4)
        const u3 = S.io(3, 1.3), u4 = S.io(4, 1.3);
        const G0 = [180, 330, 600, 450], G3 = [170, 330, 470, 380], G4 = [170, 370, 290, 290];
        const gm = (i) => lerp(lerp(G0[i], G3[i], u3), G4[i], u4);
        const ls = lerp(lerp(24, 22, u3), 20, u4);
        label(g, 'Functional response', 140, 262, S.p(0, 0.8, 0.3) * (1 - S.p(4, 0.6)));
        const A = g.axes({ x: gm(0), y: gm(1), w: gm(2), h: gm(3), xmin: 0, xmax: 10, ymin: 0, ymax: 1.3, xlab: u4 > 0.5 ? 'N' : 'prey density N', ylab: u4 > 0.5 ? 'f' : 'prey eaten per predator', labSize: ls, progress: S.p(0, 1.2, 1.4) });
        // ghost preview of the three types (beat 0)
        const gh = win(t, S.at(0, 9.2), S.at(1, 2.2), 0.8) * 0.5;
        if (gh > 0) {
          [[fI, C1, 'I'], [fII, C2, 'II'], [fIII, C3, 'III']].forEach(([f, col, nm], k) => {
            g.plot(A, f, { color: col, w: 2.2, dash: [6, 8], alpha: gh, progress: ease.inOut((t - S.at(0, 9.2) - k * 0.3) / 0.9) });
            g.text(nm, A.X(10) + 16, A.Y(f(10)) + 8 + [-14, 6, 26][k] * 0.7, { size: 24, role: 'display', italic: true, color: col, alpha: gh * 2 * S.p(0, 0.6, 9.6 + k * 0.3) });
          });
        }
        // Type I
        const fadeI = 1 - S.p(3, 0.8);
        g.plot(A, fI, { color: C1, w: 4, progress: S.io(1, 1.6, 0.4), alpha: fadeI });
        g.text('Type I', A.X(2.1) - 14, A.Y(fI(2.1)) - 10, { size: 23, weight: 600, color: C1, align: 'right', alpha: S.p(1, 0.8, 1.2) * fadeI * (1 - u3) });
        const fp = S.p(1, 0.8, 4.0) * fadeI * (1 - u3);
        g.icon('mussel', A.X(7.6), A.Y(1.1) - 44, 44, C1, { alpha: fp, rot: 1.2 });
        g.text('filter feeders', A.X(7.6) + 34, A.Y(1.1) - 34, { size: 21, color: C1, alpha: fp });
        g.text('satiated', A.X(4.9), A.Y(1.1) - 14, { size: 20, color: PAL.ink3, alpha: S.p(1, 0.8, 3.0) * fadeI * (1 - u3) });
        // Type II
        g.plot(A, fII, { color: C2, w: 4, progress: S.io(1, 1.8, 6.4), alpha: 1 - u4 * 0 });
        g.text('Type II', A.X(7.2), A.Y(fII(7.2)) + 36, { size: 23, weight: 600, color: C2, align: 'center', alpha: S.p(1, 0.8, 7.4) * (1 - u3) });
        // asymptote 1/h
        const hp = S.p(1, 0.8, 18.6) * (1 - S.p(3, 0.8));
        g.line(A.X(0), A.Y(1), A.X(10), A.Y(1), { color: C2, w: 1.8, dash: [8, 7], alpha: hp });
        g.math('1/h', A.X(10) + 12, A.Y(1) + 10, { size: 30, color: C2, alpha: hp });
        // Type III
        g.plot(A, fIII, { color: C3, w: 4, progress: S.io(2, 2.0, 0.4), alpha: 1 - S.p(4, 0.8) });
        g.text('Type III', A.X(4.2) + 16, A.Y(fIII(4.2)) + 30, { size: 23, weight: 600, color: C3, alpha: S.p(2, 0.8, 1.6) * (1 - u3) });
        const el = u3 * (1 - S.p(4, 0.6));
        g.text('II', A.X(10) + 12, A.Y(fII(10)) + 18, { size: 26, role: 'display', italic: true, color: C2, alpha: el });
        g.text('III', A.X(10) + 12, A.Y(fIII(10)) - 2, { size: 26, role: 'display', italic: true, color: C3, alpha: el });
        const lo = S.p(2, 0.8, 3.2) * (1 - S.p(3, 0.6));
        g.text('few prey taken', A.X(2.2), A.Y(0) - 14, { size: 20, color: C3, align: 'left', alpha: lo });
        const acc = S.p(2, 0.8, 5.4) * (1 - S.p(3, 0.6));
        g.arrow(A.X(2.0) + 18, A.Y(fIII(2.0)) + 6, A.X(3.0) + 18, A.Y(fIII(3.0)) + 6, { color: C3, w: 2.2, head: 11, alpha: acc });
        g.text('accelerates', A.X(3.0) + 30, A.Y(fIII(3.0)) + 26, { size: 20, color: C3, alpha: acc * (1 - u3) });

        /* ---- beats 0–1, right column: Holling's searcher, time budget, disc equation */
        const vA = vis(S, 0, 2);
        if (vA > 0) g.withAlpha(vA, () => {
          label(g, 'Search, capture, handle', 870, 262, S.p(0, 0.8, 0.6));
          const ap = S.p(0, 0.9, 0.8);
          g.withAlpha(ap, () => {
            g.rect(D.AX, D.AY, D.AW, D.AH, { r: 12, fill: 'rgba(18,36,38,0.6)', stroke: PAL.rule, w: 1.5 });
            const fi = clamp(Math.floor((t - S.b(0) - 0.5) * 30), 0, D.frames.length - 1); const F = D.frames[fi];
            for (const [dx, dy, al, born] of F.d) if (al) g.circle(dx, dy, 10, { fill: PAL.sand, alpha: 0.85 * clamp((fi / 30 - born) / 0.4) });
            for (let j = Math.max(0, fi - 24); j < fi; j += 2) g.circle(D.frames[j].x, D.frames[j].y, 2.2, { fill: PRED, alpha: 0.12 + 0.3 * (j - fi + 24) / 24 });
            g.dot(F.x, F.y, 8, PRED, 1, 2.6);
            if (F.hand > 0) { g.circle(F.x, F.y, 18, { stroke: PRED, w: 3, a0: -Math.PI / 2, a1: -Math.PI / 2 + 2 * Math.PI * (1 - F.hand / 0.9) }); g.text('handling', F.x, F.y - 26, { size: 18, color: PRED, align: 'center' }); }
          });
          g.text('Holling (1959): a blindfolded searcher', 880, 552, { size: 19, color: PAL.ink3, italic: true, alpha: S.p(0, 0.8, 2.0) });
          g.text('tapping a table for sandpaper discs', 880, 576, { size: 19, color: PAL.ink3, italic: true, alpha: S.p(0, 0.8, 2.0) });
          // time budget tied to a density sweep along the Type II curve
          const bp = S.p(1, 0.8, 7.6);
          const Nsw = lerp(0.4, 9.6, ease.inOut(clamp((t - S.at(1, 8.2)) / (9 * S.r(1)))));
          if (bp > 0) {
            const hf = aII * Nsw / (1 + aII * Nsw); const bx = 880, by = 640, bw = 400;
            g.text('time budget', bx, by - 16, { size: 20, color: PAL.ink2, alpha: bp });
            g.math('T = T_s + T_h', bx + bw, by - 14, { size: 26, color: PAL.ink2, align: 'right', alpha: bp });
            g.rect(bx, by, bw * (1 - hf), 30, { fill: PAL.lagoon, alpha: 0.85 * bp, r: 3 });
            g.rect(bx + bw * (1 - hf), by, bw * hf, 30, { fill: C2, alpha: 0.85 * bp, r: 3 });
            g.text('searching ' + Math.round(100 * (1 - hf)) + '%', bx, by + 58, { size: 20, role: 'mono', color: PAL.lagoon, alpha: bp });
            g.text(Math.round(100 * hf) + '% handling', bx + bw, by + 58, { size: 20, role: 'mono', color: C2, align: 'right', alpha: bp });
            // marker on the curve
            const mx = A.X(Nsw), my = A.Y(fII(Nsw));
            g.withAlpha(bp * (1 - S.p(2, 0.6)), () => { g.line(mx, my, mx, A.Y(0), { color: C2, w: 1.4, dash: [4, 5] }); g.dot(mx, my, 7, C2, 1, 3); });
          }
          // Type I: linear up to satiation, then the disc equation
          const e1 = S.p(1, 0.8, 1.2) * (1 - S.p(1, 0.6, 10.8));
          g.math('f(N) = aN', 880, 790, { size: 46, color: C1, alpha: e1 });
          g.text('up to a satiation ceiling', 880, 846, { size: 21, color: PAL.ink2, alpha: e1 });
          // disc equation
          const ep = S.p(1, 0.9, 11.6);
          g.math('f(N) = \\frac{aN}{1 + ahN}', 880, 790, { size: 46, color: PAL.ink, alpha: ep });
          g.math('a', 890, 856, { size: 30, color: C2, alpha: S.p(1, 0.8, 14.6) }); g.text('attack rate', 920, 854, { size: 21, color: PAL.ink2, alpha: S.p(1, 0.8, 14.6) });
          g.math('h', 1090, 856, { size: 30, color: C2, alpha: S.p(1, 0.8, 16.4) }); g.text('handling time', 1120, 854, { size: 21, color: PAL.ink2, alpha: S.p(1, 0.8, 16.4) });
        });
        /* ---- beat 2, right column: the Type III equation and its causes */
        const vB = vis(S, 2, 3);
        if (vB > 0) g.withAlpha(vB, () => {
          label(g, 'Why sigmoid?', 870, 262);
          g.math('f(N) = \\frac{aN^{2}}{1 + ahN^{2}}', 880, 360, { size: 46, color: C3, alpha: S.p(2, 0.9, 0.8) });
          const rows = [['eye', 'search image', 'predators learn to see common prey', 7.0], ['switch', 'prey switching', 'attacks shift to the commoner prey', 8.1], ['rock', 'prey refuges', 'the few remaining prey can hide', 10.0]];
          rows.forEach(([gk, ttl, sub, d], k) => {
            const p = S.p(2, 0.8, d); const y = 470 + k * 120;
            g.withAlpha(p, () => {
              if (gk === 'eye') glyph(g, 'eye', 920, y, 56, C3);
              else if (gk === 'switch') { g.icon('bug', 900, y, 30, PREY); glyph(g, 'caterpillar', 946, y + 4, 34, PAL.ochre); g.carrow(896, y - 22, 946, y - 20, -0.5, { color: C3, w: 2.2, head: 9 }); }
              else { glyph(g, 'rock', 920, y + 2, 64, PAL.ink3); g.circle(920, y + 14, 7, { fill: PREY }); }
              g.text(ttl, 980, y - 2, { size: 25, weight: 600, color: PAL.ink });
              g.text(sub, 980, y + 28, { size: 21, color: PAL.ink2 });
            });
          });
        });
        /* ---- beat 3: per-capita risk = slope of the chord from the origin */
        const vC = vis(S, 3, 4);
        if (vC > 0) g.withAlpha(vC, () => {
          label(g, 'Per-capita risk to prey', 790, 262);
          const R2 = g.axes({ x: 820, y: 316, w: 440, h: 170, xmin: 0, xmax: 10, ymin: 0, ymax: 0.44, xlab: 'N', progress: S.p(3, 1, 0.6) });
          const R3 = g.axes({ x: 820, y: 600, w: 440, h: 170, xmin: 0, xmax: 10, ymin: 0, ymax: 0.16, xlab: 'N', progress: S.p(3, 1, 0.9) });
          g.math('f(N)/N', 834, 330, { size: 24, color: PAL.ink2, alpha: S.p(3, 1, 0.6) });
          g.math('f(N)/N', 834, 614, { size: 24, color: PAL.ink2, alpha: S.p(3, 1, 0.9) });
          const r2 = (N) => aII / (1 + aII * N), r3 = (N) => bIII * N / (1 + bIII * N * N);
          const nPk = 1 / Math.sqrt(bIII);
          g.plot(R2, r2, { color: C2, w: 4, progress: S.io(3, 1.6, 2.6) });
          g.plot(R3, r3, { color: C3, w: 4, progress: S.io(3, 1.6, 10.8) });
          const sh = S.p(3, 0.9, 12.8);
          g.plot(R3, r3, { from: 0, to: nPk, color: null, w: 0, fillTo: 0, fillColor: U.rgba(PREY, 0.2), alpha: sh, progress: 1 });
          g.text('Type II', 1270, 344, { size: 22, weight: 600, color: C2, align: 'right', alpha: S.p(3, 0.8, 2.6) });
          g.text('falls as prey increase:', 1270, 382, { size: 21, color: PAL.ink, align: 'right', alpha: S.p(3, 0.8, 5.2) });
          g.text('inverse density dependence', 1270, 409, { size: 21, color: PAL.ink2, align: 'right', alpha: S.p(3, 0.8, 6.2) });
          g.pill('destabilizing', 1270, 550, { size: 20, color: C2, align: 'right', alpha: S.p(3, 0.8, 8.2) });
          g.text('Type III', 1270, 628, { size: 22, weight: 600, color: C3, align: 'right', alpha: S.p(3, 0.8, 10.8) });
          g.text('rises with density at low N:', 820, 852, { size: 21, color: PREY, alpha: sh });
          g.text('regulates prey', 820, 880, { size: 21, color: PAL.ink, alpha: S.p(3, 0.8, 14.0) });
          g.pill('stabilizing', 1270, 864, { size: 20, color: PREY, align: 'right', alpha: S.p(3, 0.8, 15.4) });
          // sweeping chords on the left panel and matching points on the right
          const sweep = (d0, f, rf, Rax, col) => {
            const s = clamp((t - S.at(3, d0)) / (6.0 * S.r(3))); if (s <= 0) return;
            const N = lerp(0.35, 9.6, ease.inOut(s)); const al = win(t, S.at(3, d0), S.at(3, d0 + 7.2), 0.4);
            const x = A.X(N), y = A.Y(f(N));
            g.line(A.X(0), A.Y(0), A.X(0) + (x - A.X(0)) * 1.25, A.Y(0) + (y - A.Y(0)) * 1.25, { color: col, w: 2, alpha: 0.8 * al });
            g.dot(x, y, 7, col, al, 3); g.dot(Rax.X(N), Rax.Y(rf(N)), 7, col, al, 3);
            g.text('slope = f(N)/N', A.X(0) + 20, A.Y(1.22), { size: 21, color: col, alpha: al });
          };
          sweep(2.8, fII, r2, R2, C2); sweep(11.0, fIII, r3, R3, C3);
        });
        /* ---- beat 4: functional × numerical = total response */
        const vD = S.p(4, 0.9);
        if (vD > 0) g.withAlpha(vD, () => {
          const top = 370, hh = 290, ww = 290;
          label(g, 'Functional', 170, 330); label(g, 'Numerical', 575, 330, S.p(4, 0.8, 0.4)); label(g, 'Total', 980, 330, S.p(4, 0.8, 7.4));
          const Bn = g.axes({ x: 575, y: top, w: ww, h: hh, xmin: 0, xmax: 10, ymin: 0, ymax: 1.3, xlab: 'N', ylab: 'P', labSize: 20, progress: S.p(4, 1, 0.6) });
          g.plot(Bn, nr, { color: PAL.lagoon, w: 4, progress: S.io(4, 1.8, 1.4) });
          g.text('predators per area', 575, top + hh + 70, { size: 21, color: PAL.ink2, alpha: S.p(4, 0.8, 1.2) });
          const rp = S.p(4, 0.8, 3.8), ip = S.p(4, 0.8, 4.8);
          g.text('reproduction', Bn.X(0.4), Bn.Y(1.18), { size: 20, color: PAL.lagoon, alpha: rp });
          g.text('+ immigration', Bn.X(0.4), Bn.Y(1.18) + 26, { size: 20, color: PAL.lagoon, alpha: ip });
          [[3, 1], [6, 2], [9, 3]].forEach(([N, n], k) => { for (let j = 0; j < n; j++) g.icon('lynx', Bn.X(N) - (n - 1) * 13 + j * 26, Bn.Y(nr(N)) - 28 - j * 0, 24, PRED, { alpha: S.p(4, 0.6, 2.6 + k * 0.6) }); });
          g.text('prey eaten per predator', 170, top + hh + 70, { size: 21, color: PAL.ink2 });
          const op = S.p(4, 0.8, 7.2);
          g.text('×', 518, top + hh / 2 + 20, { size: 64, color: PAL.ink, align: 'center', alpha: op });
          g.text('=', 922, top + hh / 2 + 20, { size: 64, color: PAL.ink, align: 'center', alpha: S.p(4, 0.8, 8.2) });
          const Bt = g.axes({ x: 980, y: top, w: ww, h: hh, xmin: 0, xmax: 10, ymin: 0, ymax: 1.0, xlab: 'N', labSize: 20, progress: S.p(4, 1, 7.6) });
          const sw = clamp((t - S.at(4, 8.6)) / (4.2 * S.r(4))); const Ns = 10 * ease.inOut(sw);
          if (sw > 0) {
            g.plot(Bt, (N) => fII(N) * nr(N), { from: 0, to: Math.max(0.01, Ns), color: PAL.ochre, w: 4.5 });
            const al = 1 - clamp((sw - 0.98) / 0.02);
            [[A, fII(Ns), C2], [Bn, nr(Ns), PAL.lagoon], [Bt, fII(Ns) * nr(Ns), PAL.ochre]].forEach(([Ax, v, col]) => {
              g.line(Ax.X(Ns), Ax.Y(0), Ax.X(Ns), Ax.y, { color: PAL.ink3, w: 1.2, dash: [4, 5], alpha: al });
              g.dot(Ax.X(Ns), Ax.Y(v), 6, col, al, 2.6);
            });
          }
          if (sw >= 1) g.plot(Bt, (N) => fII(N) * nr(N), { color: null, w: 0, fillTo: 0, fillColor: U.rgba(PAL.ochre, 0.14) });
          g.text('prey killed per area per time', 980, top + hh + 70, { size: 21, color: PAL.ink2, alpha: S.p(4, 0.8, 8.0) });
          g.math('\\text{total response} = f(N) \\times P(N)', 720, 860, { size: 40, color: PAL.ink, align: 'center', alpha: S.p(4, 0.9, 9.4) });
          g.text('overall predation pressure on the prey population', 720, 900, { size: 21, color: PAL.ochre, align: 'center', alpha: S.p(4, 0.9, 11.0) });
        });
      },
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'pred-forage', title: 'Optimal foraging',
      beats: [
        { t: 'From the predator’s side, these choices are decisions. Optimal foraging theory assumes that natural selection favors foragers that maximize their net rate of energy intake.' },
        { t: 'In the classic diet model, prey types are ranked by profitability: energy gained per unit of handling time. A forager should always take the most profitable prey, and add lower-ranked prey only when better prey are scarce. Whether to eat a poor item depends on the abundance of good items, not on the abundance of poor ones.' },
        { t: 'For patchy food, Eric Charnov’s marginal value theorem predicts when to leave. Gains within a patch diminish as it is depleted, so a forager should leave when its instantaneous intake rate falls to the average rate for the whole habitat, including travel time. The longer the travel between patches, the longer a forager should stay in each.',
          s: 'For patchy food, Eric Sharnoff’s marginal value theorem predicts when to leave. Gains within a patch diminish as it is depleted, so a forager should leave when its instantaneous intake rate falls to the average rate for the whole habitat, including travel time. The longer the travel between patches, the longer a forager should stay in each.', pause: 1 },
      ],
      terms: [
        { beat: 0.5, term: 'Optimal foraging theory', def: 'Predicts foraging decisions that maximize net energy intake rate.' },
        { beat: 1.3, term: 'Profitability', def: 'Energy gained per unit handling time (E/h) for a prey type; the basis of diet ranking.' },
        { beat: 2.2, term: 'Marginal value theorem', def: 'Charnov (1976): leave a patch when its marginal intake rate falls to the habitat-wide average.' },
      ],
      init() {
        // forager path through a field of prey items (Catmull–Rom spline through waypoints)
        const W = [[190, 610], [330, 430], [520, 575], [700, 395], [870, 610], [1030, 430], [1180, 590], [1265, 420]];
        const path = []; const cr = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
        for (let i = 0; i < W.length - 1; i++) {
          const p0 = W[Math.max(0, i - 1)], p1 = W[i], p2 = W[i + 1], p3 = W[Math.min(W.length - 1, i + 2)];
          for (let k = 0; k < 30; k++) { const u = k / 30; path.push([cr(p0[0], p1[0], p2[0], p3[0], u), cr(p0[1], p1[1], p2[1], p3[1], u)]); }
        }
        path.push(W[W.length - 1]);
        const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
        const R = rng(1976), items = [];
        for (let tries = 0; items.length < 62 && tries < 4000; tries++) {
          const x = 185 + R() * 1090, y = 330 + R() * 360;
          if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 46)) continue;
          const u = R(); const type = u < 0.17 ? 1 : u < 0.4 ? 2 : u < 0.7 ? 3 : 4;
          let best = 1e9, bi = 0; path.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < best) { best = d; bi = i; } });
          items.push({ x, y, type, enc: best < 64 ? cum[bi] : -1, rot: (R() - 0.5) * 1.2, ph: R() * 6.28 });
        }
        // abundance dots for the diet model (up to 64 per prey type)
        const dots = [0, 1, 2, 3].map((k) => { const r2 = rng(40 + k); return Array.from({ length: 64 }, () => [r2(), r2()]); });
        return { path, cum, L: cum[cum.length - 1], items, dots };
      },
      draw(g, t, S0, D) {
        const S = scaled(S0, [9.9, 18.3, 19.4]);
        const TC = [null, PAL.ochre, PAL.mint, PAL.sand, PAL.ink2];
        const preyIcon = (type, x, y, s, a = 1, o = {}) => {
          if (a <= 0) return;
          if (type === 1) g.icon('bug', x, y, s, TC[1], { alpha: a, rot: o.rot || 0 });
          else if (type === 2) glyph(g, 'caterpillar', x, y, s * 1.1, TC[2], { alpha: a, rot: o.rot || 0, wig: o.wig || 0 });
          else if (type === 3) g.icon('seed', x, y, s * 0.8, TC[3], { alpha: a, rot: o.rot || 0 });
          else { for (const [dx, dy] of [[-0.18, 0.1], [0.16, 0.14], [0, -0.16]]) g.circle(x + dx * s, y + dy * s, s * 0.09, { fill: TC[4], alpha: a }); }
        };
        const tick = (x, y, a, ok) => {
          if (a <= 0) return;
          if (ok) g.poly([[x - 9, y], [x - 2, y + 8], [x + 11, y - 9]], { color: PREY, w: 4, alpha: a });
          else { g.line(x - 8, y - 8, x + 8, y + 8, { color: COL, w: 4, alpha: a }); g.line(x - 8, y + 8, x + 8, y - 8, { color: COL, w: 4, alpha: a }); }
        };
        /* ---------- beat 0: a forager in a field of prey */
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'A forager’s decisions', 140, 262, S.p(0, 0.8, 0.2));
          g.rect(160, 300, 1130, 420, { r: 16, fill: 'rgba(18,36,38,0.45)', stroke: PAL.rule, w: 1.4, alpha: S.p(0, 0.8, 0.2) });
          const prog = ease.inOut(clamp((t - S.at(0, 0.8)) / (9.6 * S.r(0))));
          const sNow = prog * D.L;
          let i = 0; while (i < D.cum.length - 2 && D.cum[i + 1] < sNow) i++;
          const f = (sNow - D.cum[i]) / Math.max(1e-6, D.cum[i + 1] - D.cum[i]);
          const fx = lerp(D.path[i][0], D.path[i + 1][0], f), fy = lerp(D.path[i][1], D.path[i + 1][1], f);
          const dir = D.path[i + 1][0] - D.path[i][0];
          // trail
          const tr = []; for (let j = 0; j <= i; j += 2) tr.push(D.path[j]); tr.push([fx, fy]);
          g.poly(tr, { color: COL, w: 2, dash: [3, 9], alpha: 0.45 });
          const ip = S.p(0, 0.8, 0.4);
          for (const it of D.items) {
            const passed = it.enc >= 0 && sNow > it.enc; const eat = it.type <= 2;
            const since = passed ? (sNow - it.enc) / (D.L / (9.6 * S.r(0))) : -1; // seconds since encounter
            const a = ip * (passed && eat ? 1 - clamp(since / 0.35) : 1) * (it.enc >= 0 || !passed ? 1 : 1);
            preyIcon(it.type, it.x, it.y, it.type === 4 ? 54 : 42, a * (it.enc >= 0 ? 1 : 0.8), { rot: it.rot, wig: t * 2 + it.ph });
            if (passed && since < 1.4) tick(it.x, it.y - 34, win(since, 0, 1.0, 0.15), eat);
          }
          g.icon('songbird', fx, fy - 6 + Math.sin(t * 9) * 2, 66, COL, { flip: dir < 0, alpha: S.p(0, 0.6, 0.6) });
          // legend of decisions
          const lp = S.p(0, 0.8, 2.6);
          tick(190, 754, lp, true); g.text('eat', 210, 762, { size: 21, color: PAL.ink2, alpha: lp });
          tick(290, 754, lp, false); g.text('ignore', 310, 762, { size: 21, color: PAL.ink2, alpha: lp });
          g.math('\\text{selection favors maximizing}\\;\\; \\frac{\\text{net energy gained}}{\\text{time spent foraging}}', 720, 852, { size: 38, color: PAL.ink, align: 'center', alpha: S.p(0, 1, 6.0) });
        });
        /* ---------- beat 1: the diet (prey) model */
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          const E = [0, 12, 6, 2.8, 0.9], H = [0, 1.2, 1, 0.8, 0.6];
          const lam = [0, lerp(1.0, 0.1, S.io(1, 3.2, 9.0)), 0.6, 1.0, lerp(1.5, 7.5, S.io(1, 3.0, 13.4))];
          let best = 0, A0 = 0, B0 = 1; for (let k = 1; k <= 4; k++) { A0 += lam[k] * E[k]; B0 += lam[k] * H[k]; best = Math.max(best, A0 / B0); }
          const Rs = best;
          label(g, 'Diet model: rank by profitability', 140, 262);
          const A = g.axes({ x: 200, y: 330, w: 500, h: 370, xmin: 0, xmax: 4.4, ymin: 0, ymax: 11.6, ylab: 'profitability E/h', labSize: 21, progress: S.p(1, 1, 0.2), xticks: [] });
          const order = [3, 1, 4, 2]; const sp = S.io(1, 1.4, 2.6);
          const rl = S.p(1, 0.8, 6.8);
          for (let ty = 1; ty <= 4; ty++) {
            const pf = E[ty] / H[ty]; const slot = lerp(order.indexOf(ty), ty - 1, sp);
            const cx = A.X(0.62 + slot * 1.02); const bp = S.p(1, 0.8, 0.4 + ty * 0.35);
            const inc = rl > 0 ? clamp((pf - Rs) / 0.35 + 0.5) : 1;
            const col = U.mix(PAL.ink3, TC[ty], 0.25 + 0.75 * inc);
            g.rect(cx - 42, A.Y(pf * bp), 84, A.Y(0) - A.Y(pf * bp), { fill: col, alpha: 0.88 * bp, r: 3 });
            g.text(pf.toFixed(1), cx, A.Y(pf * bp) - 12, { size: 20, role: 'mono', color: PAL.ink2, align: 'center', alpha: bp });
            preyIcon(ty, cx, A.Y(0) + 40, ty === 4 ? 52 : 40, bp, { wig: t * 2 });
            g.text(String(ty), cx - 8, A.Y(0) + 84, { size: 20, role: 'mono', color: PAL.ink3, align: 'right', alpha: bp * sp });
            tick(cx + 12, A.Y(0) + 77, rl, inc > 0.5);
          }
          g.text('rank · in diet?', A.X(0) - 14, A.Y(0) + 84, { size: 19, color: PAL.ink3, align: 'right', alpha: sp });
          // R* line
          g.line(A.X(0), A.Y(Rs), A.X(4.4), A.Y(Rs), { color: PAL.ink, w: 2.2, dash: [10, 7], alpha: rl });
          g.math('R^{*}', A.X(4.4) + 12, A.Y(Rs) + 9, { size: 30, color: PAL.ink, alpha: rl });
          g.text('best-diet', A.X(4.4) + 12, A.Y(Rs) + 36, { size: 18, color: PAL.ink2, alpha: rl });
          g.text('intake rate', A.X(4.4) + 12, A.Y(Rs) + 58, { size: 18, color: PAL.ink2, alpha: rl });
          g.pill('always eaten', A.X(0.62) + 50, A.Y(10) + 22, { size: 19, color: TC[1], alpha: S.p(1, 0.8, 7.6) });
          // abundance (encounter rate) as dot clouds
          label(g, 'Abundance · encounter rate', 850, 262, S.p(1, 0.8, 6.8));
          for (let ty = 1; ty <= 4; ty++) {
            const y0 = 300 + (ty - 1) * 102, ap = S.p(1, 0.8, 6.8 + ty * 0.2);
            g.withAlpha(ap, () => {
              g.rect(910, y0, 320, 84, { r: 8, fill: 'rgba(18,36,38,0.5)', stroke: PAL.faint, w: 1 });
              preyIcon(ty, 874, y0 + 42, ty === 4 ? 50 : 38, 1, { wig: t * 2 });
              const n = lam[ty] * 8; const pts = D.dots[ty - 1];
              for (let j = 0; j < Math.min(64, Math.ceil(n)); j++) { const a = clamp(n - j); g.circle(920 + pts[j][0] * 300, y0 + 10 + pts[j][1] * 64, ty === 4 ? 3.2 : 4.5, { fill: TC[ty], alpha: 0.85 * a }); }
              g.math('λ', 1244, y0 + 40, { size: 26, color: PAL.ink3 });
              g.text(lam[ty].toFixed(1), 1244, y0 + 68, { size: 19, role: 'mono', color: PAL.ink2 });
            });
          }
          const d1 = S.p(1, 0.8, 9.0) * (1 - S.p(1, 0.6, 13.0));
          g.text('best prey become scarce → diet broadens', 1070, 736, { size: 21, color: TC[1], align: 'center', alpha: d1 });
          const d4 = S.p(1, 0.8, 14.6);
          g.text('poor prey ×5 → still ignored', 1070, 736, { size: 21, color: COL, align: 'center', alpha: d4 });
          g.math('\\text{add type } j \\text{ only if}\\;\\; \\frac{E_j}{h_j} > \\frac{\\sum_{i<j} λ_i E_i}{1 + \\sum_{i<j} λ_i h_i}', 735, 850, { size: 36, color: PAL.ink, align: 'center', alpha: S.p(1, 0.9, 10.2) });
        });
        /* ---------- beat 2: marginal value theorem */
        const v2 = S.p(2, 0.9);
        if (v2 > 0) g.withAlpha(v2, () => {
          const k = 0.33, G = (x) => 1 - Math.exp(-k * x), dG = (x) => k * Math.exp(-k * x);
          const tstar = (tau) => { let lo = 0.01, hi = 40; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (dG(m) * (m + tau) - G(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; };
          const tauAt = (tt) => lerp(2.5, 6.0, ease.inOut(clamp((tt - S.at(2, 15.2)) / (3.2 * S.r(2)))));
          const tau = tauAt(t), ts = tstar(tau);
          label(g, 'Marginal value theorem · Charnov 1976', 140, 262);
          const x0 = 640, sx = 52, yb = 690, sy = 330;
          const X = (v) => x0 + v * sx, Y = (v) => yb - v * sy;
          const ap = S.p(2, 1, 0.3);
          g.withAlpha(ap, () => {
            g.arrow(X(-8.4), yb, X(12.6), yb, { color: PAL.ink2, w: 2.2, head: 13 });
            g.arrow(x0, yb, x0, Y(1.12), { color: PAL.ink2, w: 2.2, head: 13 });
            g.text('time in patch →', X(12.6), yb + 36, { size: 21, color: PAL.ink2, align: 'right' });
            g.text('← travel time', X(-8.2), yb + 36, { size: 21, color: PAL.ink2 });
            g.text('energy gained', x0 - 14, Y(1.12) + 6, { size: 21, color: PAL.ink2, align: 'right' });
          });
          // gain curve with diminishing returns
          const gp = S.io(2, 1.8, 5.0);
          const A = { X, Y, xmin: 0, xmax: 12.4, ymin: 0, ymax: 1.1 };
          g.plot(A, G, { from: 0, to: 12.4, color: PREY, w: 4, progress: gp });
          g.text('cumulative gain in a patch', X(12.4), Y(G(12.4)) - 18, { size: 21, color: PREY, align: 'right', alpha: S.p(2, 0.8, 6.2) });
          g.text('diminishing returns', X(12.4), Y(G(12.4)) + 58, { size: 20, color: PAL.ink3, align: 'right', alpha: S.p(2, 0.8, 7.6) });
          // instantaneous (marginal) rate sliding along the curve
          const mp = clamp((t - S.at(2, 8.4)) / (2.6 * S.r(2)));
          const mAl = win(t, S.at(2, 8.4), S.at(2, 12.4), 0.4);
          if (mAl > 0) {
            const xm = lerp(0.4, tstar(2.5), ease.inOut(mp)), ym = G(xm), sl = dG(xm);
            g.line(X(xm - 1.6), Y(ym - sl * 1.6), X(xm + 1.6), Y(ym + sl * 1.6), { color: PAL.ochre, w: 3, alpha: mAl });
            g.dot(X(xm), Y(ym), 6, PAL.ochre, mAl, 2.5);
            g.text('instantaneous rate', X(xm) + 18, Y(ym) + 30, { size: 20, color: PAL.ochre, alpha: mAl });
          }
          // average-rate line from (−τ, 0), tangent at t*
          const lp = S.p(2, 1.0, 11.0);
          if (lp > 0) {
            const slope = G(ts) / (ts + tau); const xe = ts + 1.0;
            g.line(X(-tau), yb, X(-tau) + (X(xe) - X(-tau)) * lp, yb - (xe + tau) * slope * sy * lp, { color: COL, w: 3 });
            g.dot(X(-tau), yb, 7, COL, lp, 2.5);
            g.line(X(ts), Y(G(ts)), X(ts), yb, { color: COL, w: 1.6, dash: [5, 6], alpha: lp });
            g.dot(X(ts), Y(G(ts)), 8, COL, lp, 3);
            g.math('t^{*}', X(ts), yb + 40, { size: 30, color: COL, align: 'center', alpha: lp });
            g.math('τ', X(-tau / 2), yb - 14, { size: 30, color: PAL.lagoon, align: 'center', alpha: lp });
            g.arrow(X(-tau) + 4, yb + 16, x0 - 4, yb + 16, { color: PAL.lagoon, w: 2, head: 10, both: true, alpha: lp });
            g.text('leave when the instantaneous rate', X(-8.2), Y(1.02), { size: 21, color: PAL.ink, alpha: S.p(2, 0.8, 12.0) });
            g.text('falls to the habitat-wide average', X(-8.2), Y(1.02) + 28, { size: 21, color: PAL.ink, alpha: S.p(2, 0.8, 12.0) });
            g.text('(slope of the red line)', X(-8.2), Y(1.02) + 56, { size: 19, color: PAL.ink3, alpha: S.p(2, 0.8, 13.0) });
            // ghost of the short-travel solution
            const gs = S.p(2, 0.6, 15.2); const t0s = tstar(2.5);
            if (gs > 0) {
              g.line(X(-2.5), yb, X(t0s + 1.0), yb - (t0s + 1.0 + 2.5) * G(t0s) / (t0s + 2.5) * sy, { color: COL, w: 1.6, dash: [6, 6], alpha: 0.45 * gs });
              g.circle(X(t0s), Y(G(t0s)), 6, { stroke: COL, w: 2, alpha: 0.6 * gs });
              const ga = S.p(2, 0.8, 17.4);
              g.arrow(X(t0s), yb + 64, X(ts), yb + 64, { color: COL, w: 2.2, head: 11, alpha: ga * clamp((ts - t0s) * 2) });
              g.text('longer travel → stay longer', X(ts) + 16, yb + 72, { size: 21, color: COL, alpha: ga });
            }
          }
          // patch-hopping forager strip
          const st = S.at(2, 1.0);
          if (t > st) {
            const sig = 0.33, top = 770, sh = 120;
            g.rect(160, top, 1130, sh, { r: 12, fill: 'rgba(18,36,38,0.45)', stroke: PAL.rule, w: 1.2, alpha: S.p(2, 0.8, 0.6) });
            // build the hop schedule up to now
            const cyc = []; let c0 = st, px = 0;
            while (c0 <= t + 0.001 && cyc.length < 60) { const ta = tauAt(c0), tsa = tstar(ta); const tr = ta * sig, sy2 = tsa * sig; px += ta * 44; cyc.push({ s: c0, tr, st: sy2, x: px }); c0 += tr + sy2; }
            const cur = cyc[cyc.length - 1]; const inT = t - cur.s;
            const prevX = cyc.length > 1 ? cyc[cyc.length - 2].x : 0;
            let fx, hop = 0; if (inT < cur.tr) { const u = inT / cur.tr; fx = lerp(prevX, cur.x, u); hop = Math.sin(Math.PI * u); } else fx = cur.x;
            const cam = fx - 520; const cy = top + 74;
            g.clip(162, top + 2, 1126, sh - 4, () => {
              // patches: visited, current, upcoming (spacing follows the current travel time)
              const pts = cyc.map((c, j) => ({ x: c.x, left: j < cyc.length - 1 ? Math.exp(-k * tstar(tauAt(c.s))) : (inT > cur.tr ? Math.exp(-k * (inT - cur.tr) / sig) : 1) }));
              let nx = cur.x; for (let j = 0; j < 8; j++) { nx += tau * 44; pts.push({ x: nx, left: 1 }); }
              for (let j = 0; j < 8; j++) pts.unshift({ x: -j * 2.5 * 44, left: Math.exp(-k * tstar(2.5)) });
              for (const p of pts) {
                const sxp = p.x - cam + 160; if (sxp < 100 || sxp > 1360) continue;
                g.ellipse(sxp, cy + 16, 40, 13, { fill: U.rgba(PREY, 0.14), stroke: U.rgba(PREY, 0.35), w: 1.5 });
                const nf = Math.round(12 * p.left);
                for (let j = 0; j < 12; j++) { const a = j * 2.39996, r = 6 + 26 * Math.sqrt((j + 0.5) / 12); g.circle(sxp + Math.cos(a) * r, cy + 16 + Math.sin(a) * r * 0.3, 3.4, { fill: PREY, alpha: j < nf ? 0.9 : 0.12 }); }
              }
              g.icon('songbird', fx - cam + 160, cy - 12 - 46 * hop, 46, COL);
            });
            g.text(inT < cur.tr ? 'travelling' : 'foraging', 1278, top + 28, { size: 19, color: inT < cur.tr ? PAL.lagoon : PREY, align: 'right', alpha: S.p(2, 0.8, 1.4) });
          }
        });
      },
    },
    /* ------------------------------------------------------------------ 4 */
    {
      id: 'pred-rm', title: 'Enrichment & stability',
      beats: [
        { t: 'Add two realistic ingredients, prey self-limitation and a Type II functional response, and you have the Rosenzweig–MacArthur model. The prey isocline becomes a hump. The predator isocline is a vertical line at the prey density where predators just replace themselves.',
          s: 'Add two realistic ingredients, prey self-limitation and a Type two functional response, and you have the Rosen-zwyg MacArthur model. The prey isocline becomes a hump. The predator isocline is a vertical line at the prey density where predators just replace themselves.' },
        { t: 'If the predator isocline crosses to the right of the hump, trajectories spiral inward to a stable equilibrium. If it crosses to the left, they spiral outward onto a stable limit cycle.' },
        { t: 'Now enrich the system by raising the prey’s carrying capacity. The hump shifts right, past the predator isocline, and stable coexistence gives way to ever-larger cycles that can drive both species toward extinction. Michael Rosenzweig called this the paradox of enrichment in 1971.',
          s: 'Now enrich the system by raising the prey’s carrying capacity. The hump shifts right, past the predator isocline, and stable coexistence gives way to ever larger cycles that can drive both species toward extinction. Michael Rosen-zwyg called this the paradox of enrichment in 1971.', pause: 0.8 },
        { t: 'Host–parasitoid systems have their own classic, the Nicholson–Bailey model, whose oscillations grow without bound. Persistence returns with aggregated attacks, prey refuges, or spatial structure, echoing Carl Huffaker’s 1958 experiments, in which predatory and herbivorous mites persisted only in a complex, patchy universe of oranges.',
          s: 'Host parasitoid systems have their own classic, the Nicholson Bailey model, whose oscillations grow without bound. Persistence returns with aggregated attacks, prey refuges, or spatial structure, echoing Carl Huffaker’s 1958 experiments, in which predatory and herbivorous mites persisted only in a complex, patchy universe of oranges.', pause: 1 },
      ],
      terms: [
        { beat: 0.55, term: 'Rosenzweig–MacArthur model', def: 'Predator–prey model with logistic prey and a Type II functional response; hump-shaped prey isocline.' },
        { beat: 2.6, term: 'Paradox of enrichment', def: 'Rosenzweig (1971): raising prey carrying capacity destabilizes predator–prey dynamics.' },
        { beat: 3.25, term: 'Nicholson–Bailey model', def: 'Discrete host–parasitoid model with diverging oscillations; stabilized by aggregation or refuges.' },
        { beat: 3.6, term: 'Prey refuge', def: 'Habitat or condition protecting part of the prey population, which tends to stabilize dynamics.' },
      ],
      init() {
        const c = 2, Kb = 6, Nst = 3.0, Ncy = 1.7;
        const mOf = (Ns) => c * Ns / (1 + Ns);
        const mk = (K, m) => (N, P) => { const fr = N / (1 + N); return [N * (1 - N / K) - fr * P, c * fr * P - m * P]; };
        const run = (f, y, T, dt, every) => { const out = [y]; const n = Math.round(T / dt); for (let k = 1; k <= n; k++) { y = rk4(f, y, dt); if (k % every === 0) out.push(y); } return out; };
        const peq = (K, Ns) => (1 - Ns / K) * (1 + Ns);
        const fS = mk(Kb, mOf(Nst)), fC = mk(Kb, mOf(Ncy));
        const spiral = run(fS, [4.6, 2.8], 90, 0.01, 6);
        const inner = run(fC, [Ncy + 0.12, peq(Kb, Ncy)], 110, 0.01, 6);
        const outer = run(fC, [5.8, 0.4], 70, 0.01, 6);
        // one period of a converged orbit (upward crossings of N = N*), or the equilibrium point
        const period = (f, y, Ns, dt) => {
          let prev = y, t0 = -1; const pts = [];
          for (let k = 0; k < 40000; k++) {
            const nx = rk4(f, prev, dt);
            if (prev[0] < Ns && nx[0] >= Ns && nx[1] < 4) { if (t0 < 0) t0 = k; else break; }
            if (t0 >= 0 && (k - t0) % 2 === 0) pts.push(nx);
            prev = nx; if (k > 20000 && t0 < 0) break;
          }
          return pts;
        };
        const cyc = period(fC, inner[inner.length - 1], Ncy, 0.02);
        // attractors along the enrichment gradient (continuation from the previous K)
        const Ks = []; for (let K = 3.2; K <= 7.601; K += 0.05) Ks.push(+K.toFixed(2));
        let y = [Ncy * 1.02, peq(3.2, Ncy)]; const att = [];
        for (const K of Ks) {
          const f = mk(K, mOf(Ncy)); for (let k = 0; k < 6000; k++) y = rk4(f, y, 0.025);
          const amp = Math.abs(y[0] - Ncy) + Math.abs(y[1] - peq(K, Ncy));
          if (K <= 2 * Ncy + 1 + 0.02 || amp < 1e-3) { att.push([[Ncy, peq(K, Ncy)]]); y = [Ncy * 1.01 + 0.02, peq(K, Ncy)]; continue; }
          const pts = period(f, y, Ncy, 0.025); att.push(pts.length > 4 ? pts : [[Ncy, peq(K, Ncy)]]); y = pts[pts.length - 1] || y;
        }
        // Nicholson–Bailey and May's aggregated variant
        const lam = 2, a = 0.05, Hs = lam * Math.log(lam) / ((lam - 1) * a), Ps = Math.log(lam) / a;
        const nb = []; { let H = Hs * 1.08, P = Ps; for (let g2 = 0; g2 <= 21; g2++) { nb.push([g2, H, P]); const e = Math.exp(-a * P); [H, P] = [lam * H * e, H * (1 - e)]; } }
        // Huffaker-style universe of oranges: local boom–bust, regional persistence
        const C = 8, RW = 5, NO = C * RW, R = rng(6); const PS = 0.07, CS = 0.015;
        let st = new Array(NO).fill(0), age = new Array(NO).fill(0), n0 = new Array(NO).fill(0);
        [3, 12, 20, 27, 35, 9, 30].forEach((i) => { st[i] = 1; age[i] = 2; }); st[12] = 2; age[12] = 0; n0[12] = 0.3;
        const nbr = (i) => { const x = i % C, yy = Math.floor(i / C); return [[x - 1, yy], [x + 1, yy], [x, yy - 1], [x, yy + 1], [x - 1, yy - 1], [x + 1, yy + 1], [x - 1, yy + 1], [x + 1, yy - 1]].filter(([u, v]) => u >= 0 && u < C && v >= 0 && v < RW).map(([u, v]) => v * C + u); };
        const preyN = (s, ag, z) => (s === 1 ? Math.min(1, 0.1 * Math.exp(0.45 * ag)) : s === 2 ? z * Math.exp(-0.55 * ag) : 0);
        const predN = (s, ag) => (s === 2 ? Math.min(1, 0.12 * Math.exp(0.5 * ag)) : s === 3 ? Math.max(0, 0.8 * Math.exp(-0.7 * ag)) : 0);
        const huff = [], tot = [];
        for (let s = 0; s < 110; s++) {
          const nPrey = st.filter((v) => v === 1 || v === 2).length;
          const st2 = st.slice(), age2 = age.map((v) => v + 1), n02 = n0.slice();
          for (let i = 0; i < NO; i++) {
            if (st[i] === 0) { if (age[i] > 3 && R() < CS * nPrey) { st2[i] = 1; age2[i] = 0; } }
            else if (st[i] === 1) { const kk = nbr(i).filter((j) => st[j] === 2 || st[j] === 3).length; if (R() < 1 - Math.pow(1 - PS, kk)) { st2[i] = 2; age2[i] = 0; n02[i] = preyN(1, age[i], 0); } }
            else if (st[i] === 2) { if (preyN(2, age[i], n0[i]) < 0.06) { st2[i] = 3; age2[i] = 0; } }
            else if (st[i] === 3) { if (age[i] >= 3) { st2[i] = 0; age2[i] = 0; } }
          }
          st = st2; age = age2; n0 = n02;
          const fr = []; let tn = 0, tp = 0; for (let i = 0; i < NO; i++) { const u = preyN(st[i], age[i], n0[i]), v = predN(st[i], age[i]); fr.push([u, v]); tn += u; tp += v; }
          huff.push(fr); tot.push([s, tn, tp]);
        }
        const R2 = rng(11); const mites = Array.from({ length: 12 }, () => { const a2 = R2() * 6.283, r2 = Math.sqrt(R2()) * 15; return [Math.cos(a2) * r2, Math.sin(a2) * r2]; });
        return { c, Kb, Nst, Ncy, mOf, spiral, inner, outer, cyc, Ks, att, nb, huff, tot, mites, C, RW };
      },
      draw(g, t, S0, D) {
        const S = scaled(S0, [15.4, 10.9, 17.0, 21.4]);
        const ink = PAL.ink, c = D.c;
        const peq = (K, Ns) => (1 - Ns / K) * (1 + Ns);
        // parameters through time: K (carrying capacity) and N* (predator isocline)
        const toCyc = S.io(1, 1.4, 6.6);
        let Ns = lerp(D.Nst, D.Ncy, toCyc);
        const reset = S.io(2, 1.2, 0.3), enrich = S.io(2, 8.4 * S.r(2), 3.6);
        let K = S.at(2) ? lerp(lerp(D.Kb, 3.2, reset), 7.6, enrich) : D.Kb;
        /* ---------------- beats 0–2: the phase plane */
        const vP = 1 - S.p(3, 0.7);
        if (vP > 0) g.withAlpha(vP, () => {
          label(g, 'Phase plane', 140, 262);
          const yM = lerp(4.7, 6.2, S.io(2, 1.4, 0.3));
          const A = g.axes({ x: 180, y: 300, w: 660, h: 520, xmin: 0, xmax: 8, ymin: 0, ymax: yM, xlab: 'N', ylab: 'P', progress: S.p(0, 1.2, 0.2) });
          g.text('prey', A.X(8) + 42, A.Y(0) + 40, { size: 21, color: PREY, alpha: S.p(0, 1, 0.6) });
          g.text('predators', A.X(0) + 34, A.Y(yM) + 4, { size: 21, color: PRED, alpha: S.p(0, 1, 0.6) });
          // prey isocline: P = (r/a)(1 − N/K)(1 + ahN)
          const hp = S.io(0, 1.6, 7.6);
          g.plot(A, (N) => (1 - N / K) * (1 + N), { from: 0, to: K, color: PREY, w: 4, progress: hp });
          const Nh = (K - 1) / 2, Ph = peq(K, Nh);
          const hl = S.p(0, 0.8, 9.0);
          const N1 = Nh + 0.55 * (K - Nh); g.text('prey isocline', A.X(N1) + 14, A.Y((1 - N1 / K) * (1 + N1)) - 4, { size: 21, color: PREY, alpha: hl });
          g.line(A.X(K), A.Y(0), A.X(K), A.Y(0) + 10, { color: PREY, w: 2, alpha: hp });
          g.math('K', A.X(K), A.Y(0) + 36, { size: 26, color: PREY, align: 'center', alpha: hp });
          // predator isocline: vertical at N*
          const ip = S.p(0, 1.0, 10.2);
          g.line(A.X(Ns), A.Y(0), A.X(Ns), A.Y(yM), { color: PRED, w: 3, dash: [10, 8], alpha: ip });
          g.text('predator isocline', A.X(Ns) + 12, A.Y(yM) + 18, { size: 21, color: PRED, alpha: ip });
          g.math('N^{*}', A.X(Ns), A.Y(0) + 36, { size: 26, color: PRED, align: 'center', alpha: ip });
          // arrows of flow off each isocline (where each population grows)
          const fl = S.p(0, 0.8, 12.6) * (1 - S.p(1, 0.6));
          g.text('← predators decline', A.X(Ns) - 12, A.Y(yM) + 52, { size: 19, color: PAL.ink3, align: 'right', alpha: fl });
          g.text('predators grow →', A.X(Ns) + 12, A.Y(yM) + 52, { size: 19, color: PAL.ink3, alpha: fl });
          // ---- beat 1: stable spiral (isocline right of hump), then limit cycle (left of hump)
          const eq = [A.X(Ns), A.Y(peq(K, Ns))];
          g.ctx.save(); g.ctx.beginPath(); g.ctx.rect(A.x - 12, A.y - 4, A.w + 24, A.h + 16); g.ctx.clip();
          const sA = S.p(1, 0.6, 0.2) * (1 - S.p(1, 0.6, 6.4));
          if (sA > 0) {
            const pr = clamp((t - S.at(1, 0.4)) / (5.4 * S.r(1))); const n = Math.max(2, Math.floor(ease.inOut(pr) * (D.spiral.length - 1)));
            const pts = D.spiral.slice(0, n + 1).map(([x, y]) => [A.X(x), A.Y(y)]);
            g.poly(pts, { color: PAL.ink, w: 2.6, alpha: sA * 0.9 });
            const q = pts[pts.length - 1]; g.dot(q[0], q[1], 7, PAL.ink, sA, 3);
            g.circle(A.X(D.spiral[0][0]), A.Y(D.spiral[0][1]), 6, { stroke: PAL.ochre, w: 2.5, fill: PAL.bg, alpha: sA });
          }
          const cA = S.p(1, 0.6, 7.2) * (1 - S.p(2, 0.6, 0.2));
          if (cA > 0) {
            const pr = ease.inOut(clamp((t - S.at(1, 7.4)) / (3.4 * S.r(1))));
            for (const tr of [D.inner, D.outer]) {
              const n = Math.max(2, Math.floor(pr * (tr.length - 1)));
              const pts = tr.slice(0, n + 1).map(([x, y]) => [A.X(x), A.Y(y)]);
              g.poly(pts, { color: PAL.ink2, w: 2.2, alpha: cA * 0.8 });
              const q = pts[pts.length - 1]; g.dot(q[0], q[1], 6, PAL.ink, cA, 3);
              g.circle(A.X(tr[0][0]), A.Y(tr[0][1]), 6, { stroke: PAL.ochre, w: 2.5, fill: PAL.bg, alpha: cA });
            }
            const lc = clamp((pr - 0.75) / 0.25) * cA;
            if (lc > 0) { const pts = D.cyc.map(([x, y]) => [A.X(x), A.Y(y)]); g.poly([...pts, pts[0]], { color: COL, w: 4, alpha: lc }); g.text('stable limit cycle', A.X(5.3), A.Y(3.9), { size: 21, color: COL, alpha: lc }); }
          }
          // ---- beat 2: enrichment — attractor for the current K
          const eA = S.p(2, 0.6, 1.0);
          if (eA > 0) {
            const idx = (KK) => clamp(Math.round((KK - 3.2) / 0.05), 0, D.att.length - 1);
            for (const Kg of [5.0, 6.2, 7.4]) if (K > Kg + 0.05) { const pts = D.att[idx(Kg)].map(([x, y]) => [A.X(x), A.Y(y)]); g.poly([...pts, pts[0]], { color: COL, w: 1.6, alpha: 0.3 * eA }); }
            const at = D.att[idx(K)];
            if (at.length > 4) {
              const pts = at.map(([x, y]) => [A.X(x), A.Y(y)]); g.poly([...pts, pts[0]], { color: COL, w: 3.6, alpha: eA });
              const i = Math.floor(((t * 26) % at.length + at.length) % at.length); g.dot(pts[i][0], pts[i][1], 7, PAL.ink, eA, 3);
            }
          }
          g.ctx.restore();
          // equilibrium marker: filled (stable) or hollow (unstable)
          const stable = Ns > (K - 1) / 2;
          g.circle(eq[0], eq[1], 8, { fill: stable ? PAL.ink : PAL.bg, stroke: PAL.ink, w: 2.5, alpha: ip });
        });
        /* ---------------- right column: model, cases, enrichment */
        const vM = vis(S, 0, 3);
        if (vM > 0) g.withAlpha(vM, () => {
          label(g, 'Rosenzweig & MacArthur (1963)', 930, 262);
          const a1 = S.p(0, 0.8, 0.6), aL = S.p(0, 0.8, 2.6), aT = S.p(0, 0.8, 4.8);
          eqRow(g, [['\\frac{dN}{dt}', ink, a1], ['=', ink, a1, 0.3], ['rN(1 − \\frac{N}{K})', PREY, aL], ['−', ink, aT, 0.22], ['\\frac{aNP}{1 + ahN}', PRED, aT]], 930, 350, 32);
          eqRow(g, [['\\frac{dP}{dt}', ink, a1], ['=', ink, a1, 0.3], ['c\\,\\frac{aNP}{1 + ahN}', PRED, aT], ['−', ink, a1, 0.22], ['mP', PAL.heather, a1]], 930, 440, 32);
          const v0 = vis(S, 0, 1);
          g.withAlpha(v0, () => {
            g.rect(930, 512, 26, 6, { fill: PREY, alpha: aL, r: 3 }); g.text('prey self-limitation (logistic)', 970, 522, { size: 21, color: PAL.ink2, alpha: aL });
            g.rect(930, 552, 26, 6, { fill: PRED, alpha: aT, r: 3 }); g.text('Type II functional response', 970, 562, { size: 21, color: PAL.ink2, alpha: aT });
            g.math('P = \\frac{r}{a}(1 − \\frac{N}{K})(1 + ahN)', 930, 650, { size: 30, color: PREY, alpha: S.p(0, 0.9, 8.0) });
            g.text('prey isocline: a hump', 930, 700, { size: 20, color: PAL.ink2, alpha: S.p(0, 0.9, 8.4) });
            const ip = S.p(0, 0.9, 11.0);
            g.math('N^{*} = \\frac{m}{a(c − mh)}', 930, 785, { size: 34, color: PRED, alpha: ip });
            g.wrap('predator births just balance deaths', 930, 840, 360, { size: 20, color: PAL.ink2, alpha: S.p(0, 0.9, 12.4) });
          });
          const v1 = vis(S, 1, 2);
          g.withAlpha(v1, () => {
            const p1 = S.p(1, 0.8, 0.3), p2 = S.p(1, 0.8, 6.8);
            g.circle(944, 532, 9, { fill: PAL.ink, alpha: p1 });
            g.text('N* right of the hump', 966, 540, { size: 23, weight: 600, color: PAL.ink, alpha: p1 });
            g.text('damped spiral → stable equilibrium', 966, 572, { size: 21, color: PAL.ink2, alpha: p1 });
            g.circle(944, 652, 9, { fill: PAL.bg, stroke: PAL.ink, w: 2.5, alpha: p2 });
            g.text('N* left of the hump', 966, 660, { size: 23, weight: 600, color: COL, alpha: p2 });
            g.text('unstable point → stable limit cycle', 966, 692, { size: 21, color: PAL.ink2, alpha: p2 });
          });
          const v2 = vis(S, 2, 3);
          g.withAlpha(v2, () => {
            // K gauge
            const gx = 930, gy = 540, gw = 340;
            g.text('carrying capacity', gx, gy - 22, { size: 21, color: PAL.ink2 });
            g.rect(gx, gy, gw, 8, { fill: PAL.faint, r: 4 });
            const kx = gx + gw * (K - 3) / 4.8;
            g.rect(gx, gy, kx - gx, 8, { fill: PREY, r: 4 });
            g.circle(kx, gy + 4, 10, { fill: PREY });
            g.math('K = ' + K.toFixed(1), gx + gw, gy - 22, { size: 26, color: PREY, align: 'right' });
            const hx = gx + gw * (2 * D.Ncy + 1 - 3) / 4.8;
            g.line(hx, gy - 6, hx, gy + 18, { color: PRED, w: 2 }); g.text('hump passes N*', hx, gy + 40, { size: 18, color: PRED, align: 'center' });
            // time series on the current attractor
            const idx = clamp(Math.round((K - 3.2) / 0.05), 0, D.att.length - 1); const at = D.att[idx];
            const B = g.axes({ x: 950, y: 620, w: 320, h: 170, xmin: 0, xmax: 1, ymin: 0, ymax: 7.6, xlab: 't', labSize: 20, arrows: true });
            const L = at.length, reps = 2.4, nPts = 160; const ph = (t * 26) % L;
            const ser = (j) => { const out = []; for (let k = 0; k <= nPts; k++) { const q = at[Math.floor(ph + k / nPts * reps * L) % L]; out.push([k / nPts, q[j]]); } return out; };
            g.data(B, ser(0), { color: PREY, w: 2.6 }); g.data(B, ser(1), { color: PRED, w: 2.6 });
            const qe = at[Math.floor(ph + reps * L) % L];
            g.text('N', 1278, B.Y(qe[0]) + 6, { size: 20, role: 'math', italic: true, color: PREY });
            g.text('P', 1278, B.Y(qe[1]) + 6 + (Math.abs(B.Y(qe[1]) - B.Y(qe[0])) < 18 ? 18 : 0), { size: 20, role: 'math', italic: true, color: PRED });
            const ex = S.p(2, 0.8, 10.6);
            g.text('troughs approach zero: extinction risk', 950, 840, { size: 20, color: PAL.coral, alpha: ex });
            g.pill('paradox of enrichment · Rosenzweig 1971', 930, 888, { size: 20, color: PAL.ochre, alpha: S.p(2, 0.9, 13.4) });
          });
        });
        /* ---------------- beat 3: Nicholson–Bailey and Huffaker's oranges */
        const v3 = S.p(3, 0.9, 0.3);
        if (v3 > 0) g.withAlpha(v3, () => {
          label(g, 'Nicholson–Bailey host–parasitoid model', 140, 262);
          g.math('H_{t+1} = λH_t e^{−aP_t}', 170, 330, { size: 32, color: PREY });
          g.math('P_{t+1} = cH_t(1 − e^{−aP_t})', 170, 382, { size: 32, color: PRED });
          const A = g.axes({ x: 180, y: 430, w: 470, h: 290, xmin: 0, xmax: 21, ymin: 0, ymax: 82, xlab: 'generation', labSize: 20, progress: S.p(3, 1, 0.4) });
          const gN = 21 * clamp((t - S.at(3, 1.2)) / (5.0 * S.r(3)));
          const seg = (arr, j) => { const out = []; for (const p of arr) if (p[0] <= gN) out.push([p[0], Math.min(82, p[j])]); return out; };
          const sH = seg(D.nb, 1), sP = seg(D.nb, 2);
          if (sH.length > 1) { g.data(A, sH, { color: PREY, w: 3 }); g.data(A, sP, { color: PRED, w: 3 }); }
          sH.forEach((p) => g.circle(A.X(p[0]), A.Y(p[1]), 3.4, { fill: PREY })); sP.forEach((p) => g.circle(A.X(p[0]), A.Y(p[1]), 3.4, { fill: PRED }));
          const lg = S.p(3, 0.8, 1.6);
          g.circle(204, A.y + 14, 5, { fill: PREY, alpha: lg }); g.text('hosts H', 216, A.y + 21, { size: 20, color: PREY, alpha: lg });
          g.circle(324, A.y + 14, 5, { fill: PRED, alpha: lg }); g.text('parasitoids P', 336, A.y + 21, { size: 20, color: PRED, alpha: lg });
          g.text('oscillations grow without bound', 180, 776, { size: 22, color: PAL.ink, alpha: S.p(3, 0.8, 5.0) });
          g.text('persistence returns with', 180, 816, { size: 20, color: PAL.ink2, alpha: S.p(3, 0.8, 7.4) });
          const pills = [['aggregated attacks', 8.4], ['prey refuges', 9.8], ['spatial structure', 11.0]];
          pills.forEach(([s, d], k) => g.pill(s, 180 + [0, 230, 0][k], 852 + [0, 0, 46][k], { size: 21, color: PAL.ochre, alpha: S.p(3, 0.8, d) }));
          // Huffaker's universe
          const hp = S.p(3, 0.9, 12.4);
          g.withAlpha(hp, () => {
            label(g, 'Huffaker 1958 · a universe of oranges', 770, 262);
            const step = clamp(Math.floor(4 + (t - S.at(3, 12.8)) * 10), 4, D.huff.length - 1);
            const fr = D.huff[step]; const ctx = g.ctx;
            const ox = 812, oy = 336, sp = 60;
            for (let i = 0; i < fr.length; i++) {
              const x = ox + (i % D.C) * sp, y = oy + Math.floor(i / D.C) * sp;
              g.circle(x, y, 24, { fill: U.rgba(PAL.ochre, 0.16), stroke: U.rgba(PAL.ochre, 0.45), w: 1.5 });
            }
            ctx.save(); ctx.fillStyle = PREY; ctx.beginPath();
            for (let i = 0; i < fr.length; i++) { const x = ox + (i % D.C) * sp, y = oy + Math.floor(i / D.C) * sp; const n = Math.round(fr[i][0] * 10); for (let j = 0; j < n; j++) { const m = D.mites[(j + i) % 12]; ctx.moveTo(x + m[0] + 2.6, y + m[1]); ctx.arc(x + m[0], y + m[1], 2.6, 0, 6.283); } }
            ctx.fill(); ctx.fillStyle = PRED; ctx.beginPath();
            for (let i = 0; i < fr.length; i++) { const x = ox + (i % D.C) * sp, y = oy + Math.floor(i / D.C) * sp; const n = Math.round(fr[i][1] * 5); for (let j = 0; j < n; j++) { const m = D.mites[(11 - j + i) % 12]; ctx.moveTo(x + m[0] * 0.8 + 3.6, y + m[1] * 0.8); ctx.arc(x + m[0] * 0.8, y + m[1] * 0.8, 3.6, 0, 6.283); } }
            ctx.fill(); ctx.restore();
            g.circle(820, 652, 4, { fill: PREY }); g.text('herbivorous mites', 832, 659, { size: 19, color: PREY });
            g.circle(1020, 652, 4.5, { fill: PRED }); g.text('predatory mites', 1032, 659, { size: 19, color: PRED });
            const B = g.axes({ x: 800, y: 690, w: 460, h: 150, xmin: 4, xmax: D.huff.length - 1, ymin: 0, ymax: 34, xlab: 't', labSize: 20 });
            const tt = D.tot.filter((p) => p[0] >= 4 && p[0] <= step);
            if (tt.length > 1) { g.data(B, tt.map((p) => [p[0], p[1]]), { color: PREY, w: 2.6 }); g.data(B, tt.map((p) => [p[0], p[2]]), { color: PRED, w: 2.6 }); }
            g.text('locally: boom, crash, extinction', 800, 880, { size: 21, color: PAL.ink2, alpha: S.p(3, 0.8, 15.5) });
            g.text('regionally: both persist', 800, 908, { size: 21, weight: 600, color: PAL.ink, alpha: S.p(3, 0.8, 18.0) });
          });
        });
      },
    },
    /* ------------------------------------------------------------------ 5 */
    {
      id: 'pred-cascade', title: 'Keystones, cascades & fear',
      beats: [
        { t: 'Predators can structure entire communities. In 1966, Robert Paine removed the sea star Pisaster from rocky shores in Washington. Without it, mussels monopolized the space and the community dropped from fifteen species to eight. Paine called such species keystones: their impact is disproportionately large relative to their abundance.',
          s: 'Predators can structure entire communities. In 1966, Robert Paine removed the sea star Pie-sasster from rocky shores in Washington. Without it, mussels monopolized the space and the community dropped from fifteen species to eight. Paine called such species keystones: their impact is disproportionately large relative to their abundance.' },
        { t: 'Effects can cascade down food chains. Hairston, Smith, and Slobodkin’s 1960 green world hypothesis argued that predators hold herbivores in check, keeping the world green. In the Aleutian Islands, sea otters eat sea urchins, which graze kelp. When killer whales began eating otters in the 1990s, urchins boomed and kelp forests collapsed.' },
        { t: 'This alternating pattern of effects down a food chain is a trophic cascade, a form of top-down control, as opposed to bottom-up control by resources and productivity. When top predators disappear, smaller predators can surge: mesopredator release, as when the loss of coyotes from fragmented scrub let foxes and house cats increase, and scrub birds declined.' },
        { t: 'Predators also matter without killing. Prey alter foraging, vigilance, habitat use, and physiology in response to risk. These non-consumptive effects make up the ecology of fear. In a 2011 experiment, Liana Zanette and colleagues found that broadcasting predator calls alone cut song sparrow offspring production by about forty percent. Spatial variation in perceived risk forms a landscape of fear.',
          s: 'Predators also matter without killing. Prey alter foraging, vigilance, habitat use, and physiology in response to risk. These non-consumptive effects make up the ecology of fear. In a 2011 experiment, Liana Zuh-net and colleagues found that broadcasting predator calls alone cut song sparrow offspring production by about forty percent. Spatial variation in perceived risk forms a landscape of fear.', pause: 1 },
      ],
      terms: [
        { beat: 0.75, term: 'Keystone species', def: 'A species whose impact on its community is disproportionately large relative to its abundance (Paine).' },
        { beat: 2.15, term: 'Trophic cascade', def: 'Alternating indirect effects of predators down a food chain, e.g., otters → urchins → kelp.' },
        { beat: 2.35, term: 'Top-down vs bottom-up', def: 'Regulation of populations by consumers above them versus by resources below them.' },
        { beat: 2.6, term: 'Mesopredator release', def: 'Increase in smaller predators after loss of an apex predator (Crooks & Soulé 1999).' },
        { beat: 3.3, term: 'Non-consumptive effects', def: 'Effects of predation risk on prey behavior, physiology, and demography without killing.' },
        { beat: 3.8, term: 'Landscape of fear', def: 'Spatial variation in prey-perceived predation risk that shapes habitat use.' },
      ],
      init() {
        const { fbm2 } = U;
        // ---- Paine's shore: 13 × 10 cells; species 0 = mussel, 1–2 barnacles, 3–14 others
        const CW = 13, CH = 10, R = rng(1966);
        const survivors = [0, 1, 2, 4, 5, 6, 7, 8], losers = [3, 9, 10, 11, 12, 13, 14];
        const cells = [];
        for (let r = 0; r < CH; r++) for (let q = 0; q < CW; q++) {
          let sp; const u = R();
          if (r >= 7 && u < 0.75) sp = 0;
          else if (r >= 5 && u < 0.3) sp = 0;
          else if (r <= 1) sp = u < 0.45 ? 1 : u < 0.6 ? 2 : survivors[3 + Math.floor(R() * 5)];
          else sp = u < 0.3 ? (u < 0.15 ? 1 : 2) : losers[Math.floor(R() * losers.length)];
          const thr = sp === 0 ? -1 : r <= 1 ? 1.2 + R() : clamp((6.5 - r) / 6.5 + (R() - 0.5) * 0.15, 0.02, 0.88);
          cells.push({ q, r, sp, thr, rot: (R() - 0.5) * 0.8, jx: (R() - 0.5) * 14, jy: (R() - 0.5) * 12 });
        }
        // every loser species must appear at least twice in the middle rows; every survivor in the top rows
        losers.forEach((sp, k) => { for (const j of [CW * 3 + k, CW * 4 + 6 + (k % 6)]) { cells[j].sp = sp; cells[j].thr = clamp((6.5 - cells[j].r) / 6.5, 0.05, 0.88); } });
        cells[0].sp = 1; cells[0].thr = 1.5; cells[CW - 1].sp = 2; cells[CW - 1].thr = 1.5;
        survivors.slice(3).forEach((sp, k) => { cells[1 + k * 2].sp = sp; cells[1 + k * 2].thr = 1.5; });
        // rock texture
        const rock = Theater.makeCanvas(160, 124); { const c = rock.getContext('2d'); for (let y = 0; y < 124; y++) for (let x = 0; x < 160; x++) { const v = fbm2(x * 0.05, y * 0.05, 3, 4); const l = 16 + 9 * v; c.fillStyle = `hsl(185, 14%, ${l}%)`; c.fillRect(x, y, 1, 1); } }
        // ---- landscape of fear: risk field, pre-rendered heat map with contours
        const MW = 600, MH = 470, risk = (x, y) => {
          const h1 = Math.exp(-((x - 170) ** 2 + (y - 150) ** 2) / (2 * 95 ** 2)), h2 = Math.exp(-((x - 470) ** 2 + (y - 330) ** 2) / (2 * 110 ** 2));
          const edge = 0.35 * Math.exp(-((y - 470) ** 2) / (2 * 60 ** 2));
          return clamp(0.85 * h1 + 0.95 * h2 + edge + 0.12 * fbm2(x * 0.012, y * 0.012, 9, 3));
        };
        const heat = Theater.makeCanvas(MW, MH); {
          const lo = Theater.makeCanvas(150, 118), lc = lo.getContext('2d');
          for (let j = 0; j < 118; j++) for (let i = 0; i < 150; i++) {
            const v = risk(i * 4, j * 4); const col = U.mix('#173236', '#E8735A', Math.pow(v, 1.2));
            lc.fillStyle = col; lc.globalAlpha = 0.35 + 0.55 * v; lc.fillRect(i, j, 1, 1);
          }
          const hc = heat.getContext('2d'); hc.imageSmoothingEnabled = true; hc.drawImage(lo, 0, 0, MW, MH);
          // contours (marching squares)
          hc.lineWidth = 1.3; const st = 6, nx = Math.floor(MW / st), ny = Math.floor(MH / st);
          const F = []; for (let j = 0; j <= ny; j++) { F[j] = []; for (let i = 0; i <= nx; i++) F[j][i] = risk(i * st, j * st); }
          for (const L of [0.3, 0.5, 0.7]) {
            hc.strokeStyle = `rgba(238,231,215,${L === 0.5 ? 0.32 : 0.2})`; hc.beginPath();
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
              const a0 = F[j][i], b0 = F[j][i + 1], d0 = F[j + 1][i + 1], e0 = F[j + 1][i];
              const code = (a0 > L ? 8 : 0) | (b0 > L ? 4 : 0) | (d0 > L ? 2 : 0) | (e0 > L ? 1 : 0); if (code === 0 || code === 15) continue;
              const x = i * st, y = j * st, iv = (p, q) => (L - p) / (q - p);
              const T = [x + st * iv(a0, b0), y], Rr = [x + st, y + st * iv(b0, d0)], B = [x + st * iv(e0, d0), y + st], Lf = [x, y + st * iv(a0, e0)];
              const segs = { 1: [[Lf, B]], 2: [[B, Rr]], 3: [[Lf, Rr]], 4: [[T, Rr]], 5: [[Lf, T], [B, Rr]], 6: [[T, B]], 7: [[Lf, T]], 8: [[Lf, T]], 9: [[T, B]], 10: [[T, Rr], [Lf, B]], 11: [[T, Rr]], 12: [[Lf, Rr]], 13: [[B, Rr]], 14: [[Lf, B]] }[code];
              for (const [p0, q0] of segs) { hc.moveTo(p0[0], p0[1]); hc.lineTo(q0[0], q0[1]); }
            }
            hc.stroke();
          }
        }
        // prey drift away from risk (Langevin on the risk gradient), sampled at 10 Hz for 26 s
        const RP = rng(2011), prey = [];
        for (let k = 0; k < 34; k++) {
          let x = 30 + RP() * (MW - 60), y = 30 + RP() * (MH - 60); const tr = [];
          for (let s = 0; s < 260; s++) {
            tr.push([x, y]);
            for (let sub = 0; sub < 4; sub++) {
              const e = 3, rr = (u, v) => risk(u, v) + 0.5 * Math.exp(-Math.min(u, v, MW - u, MH - v) / 28);
              const gx = (rr(x + e, y) - rr(x - e, y)) / (2 * e), gy = (rr(x, y + e) - rr(x, y - e)) / (2 * e);
              x += -2700 * gx * 0.025 + gauss(RP) * 1.2; y += -2700 * gy * 0.025 + gauss(RP) * 1.2;
              x = clamp(x, 14, MW - 14); y = clamp(y, 14, MH - 14);
            }
          }
          prey.push(tr);
        }
        return { cells, CW, CH, survivors, losers, rock, heat, MW, MH, prey, risk };
      },
      draw(g, t, S0, D) {
        const S = scaled(S0, [20.3, 21.8, 21.5, 25.0]);
        const SPC = [PAL.heather, PAL.sand, PAL.ink2, PAL.ochre, PAL.rose, PAL.mint, PAL.sand, PAL.rose, PAL.moss, PAL.ochre, PAL.lagoon, PAL.heather, PAL.rose, PAL.ink, PAL.moss];
        const species = (k, x, y, s, a, rot = 0) => {
          if (a <= 0) return; const col = SPC[k];
          switch (k) {
            case 0: g.icon('mussel', x, y, s, col, { alpha: a, rot: rot + 0.6 }); break;
            case 1: g.icon('barnacle', x, y, s * 0.8, col, { alpha: a }); break;
            case 2: g.icon('barnacle', x, y, s * 0.7, col, { alpha: a, rot: rot }); break;
            case 3: g.ellipse(x, y, s * 0.36, s * 0.22, { fill: col, alpha: a, rot }); for (let i = -2; i <= 2; i++) g.line(x + i * s * 0.12, y - s * 0.18, x + i * s * 0.12, y + s * 0.18, { color: PAL.bg, w: 1.5, alpha: a }); break;
            case 4: g.circle(x, y, s * 0.3, { fill: col, alpha: a }); g.circle(x, y, s * 0.17, { stroke: PAL.bg, w: 1.5, alpha: a }); break;
            case 5: g.circle(x, y, s * 0.18, { fill: col, alpha: a }); for (let i = 0; i < 8; i++) { const an = i * 0.785; g.line(x + Math.cos(an) * s * 0.2, y + Math.sin(an) * s * 0.2, x + Math.cos(an) * s * 0.36, y + Math.sin(an) * s * 0.36, { color: col, w: 2, alpha: a }); } break;
            case 6: g.circle(x, y, s * 0.26, { stroke: col, w: 3, alpha: a }); g.circle(x + 2, y, s * 0.12, { fill: col, alpha: a }); break;
            case 7: g.icon('plant', x, y, s * 0.8, col, { alpha: a }); break;
            case 8: g.icon('grass', x, y, s * 0.7, col, { alpha: a }); break;
            case 9: g.ellipse(x, y, s * 0.34, s * 0.26, { fill: col, alpha: a * 0.85, rot }); g.circle(x - 4, y - 2, 2.5, { fill: PAL.bg, alpha: a }); g.circle(x + 5, y + 3, 2, { fill: PAL.bg, alpha: a }); break;
            case 10: g.ellipse(x - 5, y, s * 0.14, s * 0.26, { fill: col, alpha: a }); g.ellipse(x + 6, y + 2, s * 0.13, s * 0.24, { fill: col, alpha: a }); break;
            case 11: g.ellipse(x, y, s * 0.36, s * 0.13, { fill: col, alpha: a, rot }); g.line(x - s * 0.2, y - 6, x - s * 0.1, y - 10, { color: col, w: 2, alpha: a }); break;
            case 12: g.circle(x, y, s * 0.28, { fill: col, alpha: a * 0.6 }); g.circle(x, y, s * 0.28, { stroke: col, w: 2, alpha: a }); break;
            case 13: for (let i = -1; i <= 1; i++) g.line(x + i * 7, y + s * 0.3, x + i * 7 + 3, y - s * 0.3, { color: col, w: 3, alpha: a }); break;
            default: g.icon('kelp', x, y, s * 0.8, col, { alpha: a, sway: Math.sin(t + x) * 0.3 });
          }
        };
        /* ================= beat 0: Paine's rocky shore */
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Mukkaw Bay, Washington · Paine 1966', 140, 262);
          const X0 = 170, Y0 = 310, cs = 48;
          g.rect(X0 - 12, Y0 - 12, D.CW * cs + 24, D.CH * cs + 24, { r: 18, fill: PAL.panel, alpha: 0.9 });
          g.with(() => { g.ctx.globalAlpha *= 0.85; g.ctx.imageSmoothingEnabled = true; g.ctx.drawImage(D.rock, X0 - 12, Y0 - 12, D.CW * cs + 24, D.CH * cs + 24); });
          const takeover = S.io(0, 5.4 * S.r(0), 8.6);
          for (const c of D.cells) {
            const x = X0 + c.q * cs + cs / 2 + c.jx, y = Y0 + c.r * cs + cs / 2 + c.jy;
            const u = c.sp === 0 ? 1 : clamp((takeover - c.thr) / 0.08);
            if (c.sp !== 0) species(c.sp, x, y, 40, 1 - u, c.rot);
            if (u > 0) species(0, x, y, 42 * (c.sp === 0 ? 1 : 0.6 + 0.4 * u), c.sp === 0 ? 1 : u, c.rot);
          }
          // Pisaster on the mussel-bed margin, removed by hand
          const rm = S.io(0, 1.6, 4.4);
          [[2.5, 4.6], [5.4, 4.2], [8.3, 4.7], [11, 4.3]].forEach(([q, r], k) => {
            const x = X0 + q * cs, y = Y0 + r * cs - 120 * ease.in(clamp(rm * 1.1 - k * 0.03));
            g.icon('seastar', x, y, 58, COL, { alpha: S.p(0, 0.6, 0.4) * (1 - rm), rot: 0.3 * k + Math.sin(t * 0.7 + k) * 0.05 });
          });
          g.pill('Pisaster removed', X0 + D.CW * cs / 2, Y0 + 3.4 * cs, { size: 22, color: COL, align: 'center', fill: 'rgba(11,22,24,0.85)', stroke: U.rgba(COL, 0.6), alpha: win(t, S.at(0, 5.2), S.at(0, 9.6)) });
          const lg = S.p(0, 0.8, 1.2), ly = Y0 + D.CH * cs + 48;
          g.withAlpha(lg, () => {
            g.icon('seastar', X0 + 6, ly - 7, 26, COL); g.text('Pisaster sea star', X0 + 26, ly, { size: 20, color: COL });
            g.icon('mussel', X0 + 236, ly - 7, 28, PAL.heather, { rot: 0.6 }); g.text('mussels (top competitor)', X0 + 254, ly, { size: 20, color: PAL.heather });
            g.icon('barnacle', X0 + 500, ly - 8, 24, PAL.sand); g.text('barnacles', X0 + 518, ly, { size: 20, color: PAL.sand });
          });
          g.pill('mussels monopolize the space', X0 + D.CW * cs / 2, Y0 + 5.5 * cs, { size: 22, color: PAL.heather, align: 'center', fill: 'rgba(11,22,24,0.85)', stroke: U.rgba(PAL.heather, 0.6), alpha: win(t, S.at(0, 10.2), S.at(0, 15.4)) });
          // richness meter
          const alive = new Set(); for (const c of D.cells) if (c.sp === 0 || takeover < c.thr) alive.add(c.sp);
          const n = alive.size;
          const rp = S.p(0, 0.8, 1.0);
          g.withAlpha(rp, () => {
            label(g, 'Species richness', 880, 262);
            g.text(String(n), 880, 410, { size: 120, role: 'display', color: n > 8 ? PAL.ink : COL });
            g.text('species', 1010, 410, { size: 24, color: PAL.ink2 });
            for (let k = 0; k < 15; k++) { const on = alive.has(k); const x = 880 + (k % 8) * 48, y = 446 + Math.floor(k / 8) * 48; g.rect(x, y, 40, 40, { r: 6, fill: U.rgba(SPC[k], on ? 0.18 : 0.04), stroke: U.rgba(SPC[k], on ? 0.7 : 0.15), w: 1.4 }); species(k, x + 20, y + 20, 30, on ? 1 : 0.15); }
            g.text('15 → 8 species without Pisaster', 880, 576, { size: 21, color: PAL.ink2, alpha: S.p(0, 0.8, 13.0) });
          });
          // keystone: impact vs abundance (after Power et al. 1996)
          const kp = S.p(0, 0.9, 14.6);
          g.withAlpha(kp, () => {
            const A = g.axes({ x: 900, y: 650, w: 360, h: 200, xmin: 0, xmax: 1, ymin: 0, ymax: 1, xlab: 'abundance', ylab: 'impact', labSize: 20 });
            g.line(A.X(0), A.Y(0), A.X(0.95), A.Y(0.95), { color: PAL.ink3, w: 1.6, dash: [6, 6] });
            [[0.55, 0.5], [0.7, 0.68], [0.82, 0.8], [0.35, 0.3], [0.2, 0.17], [0.88, 0.9]].forEach(([a, b]) => g.circle(A.X(a), A.Y(b), 6, { fill: PAL.ink2, alpha: 0.8 }));
            g.text('impact ∝ abundance', A.X(1.0), A.Y(0.42), { size: 18, color: PAL.ink3, align: 'right' });
            g.icon('seastar', A.X(0.12), A.Y(0.84), 34, COL, { alpha: S.p(0, 0.8, 16.0) });
            g.text('keystone', A.X(0.12) + 26, A.Y(0.84) + 7, { size: 21, weight: 600, color: COL, alpha: S.p(0, 0.8, 16.0) });
            g.text('after Power et al. 1996', 900, 904, { size: 17, color: PAL.ink3, italic: true });
          });
        });
        /* ================= beat 1: a four-level chain in the Aleutians */
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          const al = S.p(1, 0.9, 11.6);            // Aleutian relabeling
          const sh = S.io(1, 4.2 * S.r(1), 17.4);   // the 1990s shift
          label(g, al > 0.5 ? 'Aleutian Islands · Estes et al. 1998' : 'The green world · Hairston, Smith & Slobodkin 1960', 140, 262, Math.abs(al - 0.5) * 2);
          const bands = [[330, 'killer whales', 'orca'], [482, 'predators', 'sea otters'], [626, 'herbivores', 'sea urchins'], [784, 'plants', 'kelp']];
          const bp = [S.p(1, 0.8, 16.2), S.p(1, 0.8, 0.4), S.p(1, 0.8, 1.2), S.p(1, 0.8, 2.0)];
          bands.forEach(([y, a, b], k) => {
            if (bp[k] <= 0) return;
            g.withAlpha(bp[k], () => {
              g.line(150, y + 54, 1290, y + 54, { color: PAL.faint, w: 1 });
              if (k === 0) g.text(a, 150, y + 8, { size: 23, color: PAL.ink });
              else { g.text(a, 150, y + 8, { size: 23, color: PAL.ink, alpha: 1 - al }); g.text(b, 150, y + 8, { size: 23, color: PAL.ink, alpha: al }); }
            });
          });
          // trophic arrows (eats → negative effect)
          for (let k = 1; k < 4; k++) { const p = k === 1 ? bp[0] : S.p(1, 0.8, 1.2 + k * 0.4); const y1 = bands[k - 1][0] + 22, y2 = bands[k][0] - 30; g.arrow(186, y1, 186, y2, { color: PAL.ink3, w: 2.4, head: 12, alpha: p }); g.text('−', 204, (y1 + y2) / 2 + 8, { size: 26, weight: 600, color: COL, alpha: p }); }
          // organisms per band
          const xs = (n, k) => 380 + (k + 0.5) * 620 / n;
          // top band: orcas swim in
          for (let k = 0; k < 2; k++) glyph(g, 'orca', lerp(1100 + k * 120, 560 + k * 230, sh), 330 + Math.sin(t * 1.3 + k) * 4, 104, PAL.ink2, { alpha: bp[0] * (0.25 + 0.75 * sh), flip: true });
          // predators: wolves → otters (6 → 1)
          const nOt = Math.round(lerp(6, 1, sh));
          for (let k = 0; k < 6; k++) {
            const x = xs(6, k), y = 482 + Math.sin(t * 1.1 + k) * 3; const live = k < nOt ? 1 : 0.12 * (1 - sh);
            g.icon('wolf', x, y, 62, PRED, { alpha: bp[1] * (1 - al) * (k < 4 ? 1 : 0) });
            g.icon('otter', x, y + 4, 70, PRED, { alpha: bp[1] * al * live, flip: k % 2 === 1 });
          }
          // herbivores: deer → urchins (4 → 14)
          const nUr = Math.round(lerp(4, 14, sh));
          for (let k = 0; k < 14; k++) {
            const x = 390 + ((k * 0.61803) % 1) * 600, y = 620 + ((k * 0.3819) % 1) * 18;
            if (k < 3) g.icon('deer', xs(3, k), 626, 60, PAL.ochre, { alpha: bp[2] * (1 - al) });
            g.icon('urchin', x, y, 40, PAL.heather, { alpha: bp[2] * al * (k < nUr ? 1 : 0) * (k < 4 ? 1 : clamp(sh * 14 - (k - 4) * 1.0)) });
          }
          // plants: plants → kelp (tall → stubs)
          for (let k = 0; k < 9; k++) {
            const x = xs(9, k); const hgt = lerp(1, 0.18, clamp(sh * 1.4 - k * 0.04));
            g.icon('plant', x, 800, 70, PREY, { alpha: bp[3] * (1 - al), flower: k % 3 ? null : PAL.ochre });
            g.with(() => { g.ctx.translate(x, 836); g.ctx.scale(1, hgt); g.icon('kelp', 0, -50, 100, PREY, { alpha: bp[3] * al, sway: Math.sin(t * 0.9 + k) * 0.6 }); });
          }
          g.text('urchin barren', 1010, 846, { size: 20, color: PAL.ink3, alpha: clamp((sh - 0.6) / 0.3) });
          g.text('Why is the world green?', 380, 350, { size: 40, role: 'display', italic: true, color: PAL.ink2, alpha: S.p(1, 0.9, 3.0) * (1 - al) });
          g.text('predators hold herbivores in check', 380, 392, { size: 21, color: PAL.ink3, alpha: S.p(1, 0.9, 6.0) * (1 - al) });
          g.text('kelp forest', 1290, 726, { size: 22, color: PREY, align: 'right', alpha: al * (1 - S.p(1, 0.6, 17.6)) });
          g.text('the world stays green', 1290, 726, { size: 22, color: PREY, align: 'right', alpha: S.p(1, 0.8, 8.0) * (1 - al) });
          // outcome markers
          const om = S.p(1, 0.8, 18.0);
          const mark = (y, s, col) => g.text(s, 1290, y + 8, { size: 26, weight: 600, color: col, align: 'right', alpha: om });
          mark(330, 'arrive ↑', PAL.ink2); mark(482, 'collapse ↓', PRED); mark(626, 'biomass ×8 ↑', PAL.heather); mark(784, 'density ÷12 ↓', PREY);
          g.text(sh > 0.02 ? String(Math.round(lerp(1990, 1997, sh))) : '', 1290, 262, { size: 26, role: 'mono', color: PAL.ink2, align: 'right', alpha: S.p(1, 0.6, 17.4) });
        });
        /* ================= beat 2: cascades, top-down vs bottom-up, mesopredator release */
        const v2 = vis(S, 2, 3);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Trophic cascade', 140, 262);
          const dx = 250 * (1 - S.io(2, 1.3, 9.4));
          g.with(() => {
            g.ctx.translate(dx, 0);
            const lv = [['top predator', COL, 350], ['herbivore', PAL.heather, 490], ['plant', PREY, 630], ['nutrients · productivity', PAL.ochre, 770]];
            lv.forEach(([nm, col, y], k) => {
              const p = S.p(2, 0.8, 0.4 + k * 0.5);
              g.rect(250, y - 32, 270, 62, { r: 31, fill: U.rgba(col, 0.14), stroke: U.rgba(col, 0.6), w: 1.6, alpha: p });
              g.text(nm, 385, y + 8, { size: 22, color: PAL.ink, align: 'center', alpha: p });
              if (k > 0) {
                g.arrow(385, lv[k - 1][2] + 32, 385, y - 34, { color: k < 3 ? PAL.ink3 : PAL.ochre, w: 2, head: 10, alpha: p, both: false });
                if (k < 3) g.text('−', 402, (lv[k - 1][2] + y) / 2 + 9, { size: 28, weight: 600, color: COL, alpha: S.p(2, 0.8, 1.6) });
              }
            });
            // the indirect, alternating effect
            const ie = S.p(2, 0.9, 2.6);
            g.carrow(526, 360, 526, 622, -0.38, { color: PREY, w: 2.6, dash: [7, 6], head: 13, progress: ie });
            g.text('+', 630, 498, { size: 32, weight: 600, color: PREY, align: 'center', alpha: ie });
            g.text('indirect', 630, 528, { size: 19, color: PREY, align: 'center', alpha: ie });
            const td = S.p(2, 1.0, 5.0), bu = S.p(2, 1.0, 7.0);
            g.arrow(200, 344, 200, 650, { color: COL, w: 6, head: 22, progress: td });
            g.text('top-down', 200, 298, { size: 23, weight: 600, color: COL, align: 'center', alpha: td });
            g.text('by consumers', 200, 324, { size: 19, color: COL, align: 'center', alpha: td });
            g.arrow(700, 800, 700, 480, { color: PAL.ochre, w: 6, head: 22, progress: bu, alpha: 0.9 });
            g.text('bottom-up', 700, 838, { size: 23, weight: 600, color: PAL.ochre, align: 'center', alpha: bu });
            g.text('by resources', 700, 864, { size: 19, color: PAL.ochre, align: 'center', alpha: bu });
          });
          // mesopredator release
          const mp = S.p(2, 0.9, 10.0);
          g.withAlpha(mp, () => {
            label(g, 'Mesopredator release · Crooks & Soulé 1999', 760, 262);
            const loss = S.io(2, 1.0, 15.2), rise = S.io(2, 1.6, 17.0), fall = S.io(2, 1.6, 19.4);
            g.icon('wolf', 1000, 350, 96, COL, { alpha: 1 - 0.75 * loss });
            g.text('coyote', 1070, 360, { size: 22, color: COL, alpha: 1 - 0.5 * loss });
            if (loss > 0) { g.line(950, 310, 1050, 390, { color: PAL.ink, w: 4, alpha: loss }); g.line(1050, 310, 950, 390, { color: PAL.ink, w: 4, alpha: loss }); g.text('lost from small scrub fragments', 1000, 430, { size: 20, color: PAL.ink2, align: 'center', alpha: loss }); }
            const nm = Math.round(lerp(2, 5, rise));
            for (let k = 0; k < 5; k++) { const a = k < 2 ? 1 : clamp(rise * 5 - (k - 1.5)); const x = 780 + k * 104; g.icon('wolf', x, 560, 56, PAL.ochre, { alpha: a * (k % 2 === 0 ? 1 : 0), flip: true }); glyph(g, 'cat', x, 566, 56, PAL.ochre, { alpha: a * (k % 2 === 1 ? 1 : 0) }); }
            g.text('foxes & house cats', 780 - 30, 512, { size: 21, color: PAL.ochre, alpha: 1 });
            g.text(nm > 2 ? '↑' : '', 1280, 574, { size: 34, weight: 600, color: PAL.ochre, align: 'right', alpha: rise });
            const nb = Math.round(lerp(6, 2, fall));
            for (let k = 0; k < 6; k++) { const a = k < 2 ? 1 : 1 - clamp(fall * 6 - (6 - k - 0.5)); g.icon('songbird', 790 + k * 82, 760 + Math.sin(t * 2 + k) * 3, 48, PREY, { alpha: a }); }
            g.text('scrub-breeding birds', 760, 712, { size: 21, color: PREY });
            g.text(nb < 6 ? '↓' : '', 1280, 774, { size: 34, weight: 600, color: PREY, align: 'right', alpha: fall });
            g.arrow(1000, 452, 1000, 500, { color: PAL.ink3, w: 2, head: 10 }); g.text('−', 1018, 486, { size: 26, color: COL });
            g.arrow(1000, 604, 1000, 680, { color: PAL.ink3, w: 2, head: 10 }); g.text('−', 1018, 650, { size: 26, color: COL });
          });
        });
        /* ================= beat 3: the ecology of fear */
        const v3 = S.p(3, 0.9);
        if (v3 > 0) g.withAlpha(v3, () => {
          const mx = 160, my = 300;
          label(g, 'Perceived risk', 140, 262);
          g.with(() => { g.ctx.beginPath(); g.ctx.roundRect(mx, my, D.MW, D.MH, 14); g.ctx.clip(); g.ctx.drawImage(D.heat, mx, my); });
          g.rect(mx, my, D.MW, D.MH, { r: 14, stroke: PAL.rule, w: 1.4 });
          // prowling wolf around the risk hotspot
          const wa = t * 0.35; const wx = mx + 470 + 90 * Math.cos(wa), wy = my + 330 + 60 * Math.sin(wa);
          g.icon('wolf', wx, wy, 54, COL, { flip: Math.sin(wa) > 0 });
          // prey drift toward safe ground
          const tt = clamp((t - S.b(3)) * 10, 0, 258.99); const i = Math.floor(tt), f = tt - i;
          for (const tr of D.prey) { const x = mx + lerp(tr[i][0], tr[i + 1][0], f), y = my + lerp(tr[i][1], tr[i + 1][1], f); g.dot(x, y, 5, PAL.sand, 1, 2.2); }
          // legend
          const grd = g.ctx.createLinearGradient(mx, 0, mx + 220, 0); grd.addColorStop(0, '#173236'); grd.addColorStop(1, '#E8735A');
          g.with(() => { g.ctx.fillStyle = grd; g.ctx.fillRect(mx, my + D.MH + 22, 220, 10); });
          g.text('low risk', mx, my + D.MH + 56, { size: 19, color: PAL.ink3 }); g.text('high risk', mx + 220, my + D.MH + 56, { size: 19, color: PAL.ink3, align: 'right' });
          g.dot(mx + 290, my + D.MH + 27, 5, PAL.sand, 1, 2.2); g.text('prey', mx + 304, my + D.MH + 34, { size: 19, color: PAL.ink2 });
          const lf = S.p(3, 1.0, 21.5);
          g.text('a landscape of fear', mx + D.MW, 268, { size: 34, role: 'display', italic: true, color: PAL.ink, align: 'right', alpha: lf });
          // non-consumptive responses
          const rows = [['foraging', 'less time feeding', 2.8], ['vigilance', 'more time scanning', 3.8], ['habitat use', 'retreat to safer ground', 4.9], ['physiology', 'stress hormones rise', 6.3]];
          label(g, 'Responses to risk', 820, 262, S.p(3, 0.8, 2.4));
          rows.forEach(([a, b, d], k) => { const p = S.p(3, 0.8, d); const y = 330 + k * 56; g.circle(828, y - 7, 5, { fill: PAL.sand, alpha: p }); g.text(a, 846, y, { size: 23, weight: 600, color: PAL.ink, alpha: p }); g.text(b, 1010, y, { size: 21, color: PAL.ink2, alpha: p }); });
          g.pill('non-consumptive effects', 820, 572, { size: 21, color: PAL.ochre, alpha: S.p(3, 0.8, 8.6) });
          g.pill('the ecology of fear', 1090, 572, { size: 21, color: COL, alpha: S.p(3, 0.8, 10.0) });
          // Zanette et al. 2011
          const zp = S.p(3, 0.9, 12.0);
          g.withAlpha(zp, () => {
            label(g, 'Song sparrows · Zanette et al. 2011', 820, 636);
            glyph(g, 'speaker', 850, 690, 44, PAL.ink2); g.icon('songbird', 910, 690, 44, PREY);
            g.text('playbacks alone, no actual predation', 950, 698, { size: 20, color: PAL.ink2 });
            const bars = [['non-predator calls', 1, PAL.ink2], ['predator calls', 0.6, COL]];
            const grow = S.p(3, 1.2, 15.4);
            bars.forEach(([nm, v, col], k) => {
              const y = 748 + k * 62; const w = 300 * (k === 0 ? 1 : lerp(1, v, S.io(3, 1.4, 17.0))) * grow;
              g.text(nm, 820, y + 22, { size: 20, color: PAL.ink2 });
              g.rect(1000, y, w, 32, { r: 4, fill: col, alpha: 0.85 });
            });
            g.text('offspring per year', 1000, 878, { size: 18, color: PAL.ink3 });
            g.text('≈ −40%', 1300, 840, { size: 26, weight: 600, color: COL, align: 'right', alpha: S.p(3, 0.8, 18.4) });
          });
        });
      },
    },
  ],
});
})();
