/* Chapter V — Island biogeography. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.lagoon;

// Small shared helpers ---------------------------------------------------------
const TAU = Math.PI * 2;
const label = (g, s, x, y, a = 1, col = PAL.ink3) => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a });
// visibility envelope: fade in at beat k0, fade out at beat k1 (optional)
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
const SEA_HI = '#0F3C44', SEA_LO = '#0A272D';
const LAND = '#2E5338', LAND_C = ['#3E6A45', '#4D7C4E', '#284A33', '#5A8A55'];

// Irregular island outline: polar radius r(a) from looped fBm noise, squashed in y for a map look.
function makeIsland(r, seed, o = {}) {
  const n = o.n || 120, rough = o.rough ?? 0.36, sq = o.squash ?? 0.86, el = o.elong ?? 0.1, phi = o.phi ?? seed * 1.7;
  const rad = new Float32Array(n), pts = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const f = 1 + rough * U.fbm2(5 + 1.15 * ca, 5 + 1.15 * sa, seed, 5) + 0.07 * U.noise2(9 + 4 * ca, 9 + 4 * sa, seed + 3) + el * Math.cos(2 * (a - phi)) + 0.06 * Math.cos(3 * (a - phi * 1.3));
    rad[k] = r * Math.max(0.4, f); pts.push([ca * rad[k], sa * rad[k] * sq]);
  }
  const radAt = (a) => { const u = (((a / TAU) % 1) + 1) % 1 * n; const i = Math.floor(u), f = u - i; return lerp(rad[i % n], rad[(i + 1) % n], f); };
  const inside = (x, y, frac = 1) => { const yy = y / sq; return Math.hypot(x, yy) < radAt(Math.atan2(yy, x)) * frac; };
  return { r, n, pts, sq, radAt, inside };
}
const scaled = (pts, s, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + x * s, cy + y * s]);
function pathOf(c, pts) { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
// Well-spaced points inside an island (best-candidate sampling).
function scatter(shape, n, seed, frac = 0.72) {
  const r = rng(seed), out = [];
  for (let k = 0; k < n; k++) {
    let best = null, bd = -1;
    for (let m = 0; m < 30; m++) {
      const x = (r() * 2 - 1) * shape.r * 1.4, y = (r() * 2 - 1) * shape.r * 1.4 * shape.sq;
      if (!shape.inside(x, y, frac)) continue;
      let d = 1e9; for (const p of out) d = Math.min(d, Math.hypot(p[0] - x, p[1] - y));
      if (d > bd) { bd = d; best = [x, y]; }
    }
    out.push(best || [0, 0]);
  }
  return out;
}
// Paint one island (shallows, beach, vegetated interior, contours) onto a 2D context.
function paintIsland(c, cx, cy, sh, seed, o = {}) {
  const P = (s) => scaled(sh.pts, s, cx, cy);
  c.save();
  c.fillStyle = 'rgba(95,192,210,0.08)'; pathOf(c, P(1.3)); c.fill();
  c.fillStyle = 'rgba(95,192,210,0.13)'; pathOf(c, P(1.13)); c.fill();
  pathOf(c, P(1)); c.fillStyle = o.land || LAND; c.fill();
  if (sh.r > 34) { c.fillStyle = 'rgba(120,160,95,0.16)'; pathOf(c, P(0.64)); c.fill(); }
  if (sh.r > 60) { c.fillStyle = 'rgba(140,175,110,0.16)'; pathOf(c, P(0.38)); c.fill(); }
  c.save(); pathOf(c, P(1)); c.clip();
  const r = rng(seed * 31 + 7), N = Math.round(sh.r * sh.r * 0.11);
  for (let k = 0; k < N; k++) {
    const x = cx + (r() * 2 - 1) * sh.r * 1.4, y = cy + (r() * 2 - 1) * sh.r * 1.4 * sh.sq;
    c.globalAlpha = 0.3 + 0.35 * r(); c.fillStyle = LAND_C[k % 4]; c.beginPath(); c.arc(x, y, 1.4 + r() * 3.2, 0, TAU); c.fill();
  }
  c.restore();
  c.strokeStyle = 'rgba(238,231,215,0.13)'; c.lineWidth = 1;
  for (const s of (sh.r > 60 ? [0.66, 0.4] : sh.r > 34 ? [0.55] : [])) { pathOf(c, P(s)); c.stroke(); }
  c.strokeStyle = o.beach || 'rgba(216,196,155,0.75)'; c.lineWidth = sh.r > 40 ? 3.2 : 2.4; pathOf(c, P(1)); c.stroke();
  c.restore();
}
// Sea panel: gradient, union-filled shelves around islands, wave glints, frame.
function paintSea(c, w, h, isles, seed) {
  const gr = c.createLinearGradient(0, 0, w * 0.35, h); gr.addColorStop(0, SEA_HI); gr.addColorStop(1, SEA_LO);
  c.fillStyle = gr; c.beginPath(); c.roundRect(0, 0, w, h, 8); c.fill();
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 8); c.clip();
  for (const [s, a] of [[2.1, 0.05], [1.55, 0.06]]) {
    const tmp = Theater.makeCanvas(w, h), tc = tmp.getContext('2d'); tc.fillStyle = '#5FC0D2';
    for (const d of isles) { pathOf(tc, scaled(d.shape.pts, s, d.x, d.y)); tc.fill(); }
    c.globalAlpha = a; c.drawImage(tmp, 0, 0); c.globalAlpha = 1;
  }
  const r = rng(seed); c.strokeStyle = 'rgba(238,231,215,0.05)'; c.lineWidth = 1.2;
  for (let k = 0; k < Math.round(w * h / 4200); k++) { const x = r() * w, y = r() * h, L = 8 + r() * 16; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + L / 2, y - 3, x + L, y); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(238,231,215,0.16)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(0.75, 0.75, w - 1.5, h - 1.5, 8); c.stroke();
}
// Least-squares fit of log10 S on log10 A.
function fitLog(A, Sv) {
  const x = A.map(Math.log10), y = Sv.map(Math.log10), n = x.length;
  const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const z = sxy / sxx; return { z, c: Math.pow(10, my - z * mx), mx, my };
}
const quad = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];

// MacArthur–Wilson rates for a pool of P species (per second of scene time).
// Immigration falls and extinction rises with S; both are concave up.
const POOL = 32;
const Irate = (S, I0) => { const s = S / POOL; return I0 * (1 - s) * (1 - 0.55 * s); };
const Erate = (S, E1) => { const s = S / POOL; return E1 * s * (0.35 + 0.65 * s); };
const Shat = (I0, E1) => { let lo = 0, hi = POOL; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (Irate(m, I0) > Erate(m, E1)) lo = m; else hi = m; } return lo; };
// Stochastic colonization/extinction (Gillespie) with the rates above. Colonists are drawn by
// dispersal ability (species 0 = best disperser); victims at random. Returns events and presence intervals.
function islandSim(seed, I0, E1, S0, t0, t1) {
  const r = rng(seed), w = Array.from({ length: POOL }, (_, i) => Math.exp(-2.2 * i / POOL));
  const pres = new Array(POOL).fill(false), on = Array.from({ length: POOL }, () => []), ev = [];
  const pick = () => { let tot = 0; for (let i = 0; i < POOL; i++) if (!pres[i]) tot += w[i]; let u = r() * tot, sp = -1; for (let i = 0; i < POOL; i++) if (!pres[i]) { u -= w[i]; sp = i; if (u <= 0) break; } return sp; };
  for (let k = 0; k < S0; k++) { const sp = pick(); pres[sp] = true; on[sp].push([t0 - 50, Infinity]); }
  let t = t0, S = S0;
  for (;;) {
    const a = Irate(S, I0), b = Erate(S, E1); t += -Math.log(1 - r()) / (a + b); if (t > t1) break;
    if (r() * (a + b) < a) { const sp = pick(); pres[sp] = true; S++; on[sp].push([t, Infinity]); ev.push({ t, k: 1, sp, S }); }
    else { const L = []; for (let i = 0; i < POOL; i++) if (pres[i]) L.push(i); const sp = L[Math.floor(r() * L.length)]; pres[sp] = false; S--; on[sp][on[sp].length - 1][1] = t; ev.push({ t, k: -1, sp, S }); }
  }
  return { ev, on, S0, countAt: (tt) => { let s = S0; for (const e of ev) { if (e.t > tt) break; s = e.S; } return s; } };
}

Theater.chapter({
  id: 'isl', roman: 'V', title: 'Island Biogeography', color: COL,
  question: 'Why do islands hold the species they do?',
  intro: { t: 'Chapter five. Island biogeography: species richness as a balance of arrivals and losses.' },
  // MacArthur–Wilson rate curves crossing at Ŝ.
  motif(g, t) {
    const p = ease.inOut((t - 0.6) / 3), q = ease.out((t - 3.2) / 1);
    const X = (s) => 1130 + s * 640, Y = (r) => 345 - r * 220;
    const Ic = (s) => (1 - s) * (1 - 0.55 * s), Ec = (s) => 1.5 * s * (0.35 + 0.65 * s);
    g.line(X(0), Y(0), X(1.03), Y(0), { color: PAL.ink2, w: 1.5, alpha: 0.3 * p });
    g.plot({ X, Y }, Ic, { from: 0, to: 1, color: COL, w: 2.5, alpha: 0.38, progress: p });
    g.plot({ X, Y }, (s) => Ec(s) * 0.66, { from: 0, to: 1, color: PAL.coral, w: 2.5, alpha: 0.32, progress: p });
    let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (Ic(m) > Ec(m) * 0.66) lo = m; else hi = m; }
    g.line(X(lo), Y(Ic(lo)), X(lo), Y(0), { color: PAL.ink2, w: 1.5, dash: [5, 6], alpha: 0.3 * q });
    g.dot(X(lo), Y(Ic(lo)), 5, PAL.ink, 0.35 * q, 3);
  },
  scenes: [
    {
      id: 'isl-sar', title: 'The species–area relationship',
      beats: [
        { t: 'Islands are natural experiments: replicated, bounded, and easy to count. One of ecology’s oldest generalizations comes from them, the species–area relationship. Larger areas hold more species.',
          s: 'Islands are natural experiments: replicated, bounded, and easy to count. One of ecology’s oldest generalizations comes from them, the species area relationship. Larger areas hold more species.' },
        { t: 'It is usually written as a power law, S = cA^z. On log–log axes this becomes a straight line, log S = log c + z log A, with slope z.',
          s: 'It is usually written as a power law: S equals c times A to the z. On log log axes this becomes a straight line, log S equals log c plus z log A, with slope z.' },
        { t: 'For true islands, z usually falls between about 0.2 and 0.35. For nested samples of a contiguous mainland it is lower, roughly 0.12 to 0.17, because small mainland samples include transient species spilling over from the surrounding habitat.',
          s: 'For true islands, z usually falls between about zero point two and zero point three five. For nested samples of a contiguous mainland it is lower, roughly zero point one two to zero point one seven, because small mainland samples include transient species spilling over from the surrounding habitat.' },
        { t: 'With z near 0.3, a tenfold loss of area roughly halves the number of species, a rule of thumb attributed to Philip Darlington. The same arithmetic, run in reverse, underlies many estimates of extinction from habitat loss.',
          s: 'With z near zero point three, a tenfold loss of area roughly halves the number of species, a rule of thumb attributed to Philip Darlington. The same arithmetic, run in reverse, underlies many estimates of extinction from habitat loss.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.6, term: 'Species–area relationship', def: 'S = cA^z: species richness increases as a power function of area.' },
        { beat: 2.2, term: 'z-value', def: 'Slope of log S vs. log A; ~0.2–0.35 for islands, ~0.12–0.17 for mainland samples.' },
      ],
      init() {
        // Stylized archipelago: island areas (km²) and species counts follow S ≈ 4·A^0.30.
        const isl = [
          { A: 1.5, S: 5, x: 1238, y: 312, lab: [0, 1] }, { A: 6, S: 6, x: 556, y: 590, lab: [0, 1] },
          { A: 20, S: 10, x: 948, y: 812, lab: [1, 0] }, { A: 45, S: 12, x: 468, y: 800, lab: [1, 0] },
          { A: 130, S: 18, x: 218, y: 772, lab: [0, -1] }, { A: 400, S: 23, x: 742, y: 392, lab: [0, 1] },
          { A: 1100, S: 35, x: 706, y: 708, lab: [0, 1] }, { A: 3500, S: 45, x: 368, y: 452, lab: [0, 1] },
          { A: 12000, S: 70, x: 1070, y: 548, lab: [0, 1] },
        ];
        isl.forEach((d, i) => {
          d.r = 22 * Math.pow(d.A, 0.19);
          d.shape = makeIsland(d.r, 4 + i * 9, { rough: 0.34, elong: 0.12 + 0.04 * (i % 3) });
          d.pts = scatter(d.shape, d.S, 100 + i, 0.7);
        });
        const MW = 1210, MH = 650, map = Theater.makeCanvas(MW, MH), c = map.getContext('2d');
        const rel = isl.map((d) => ({ shape: d.shape, x: d.x - 100, y: d.y - 240 }));
        paintSea(c, MW, MH, rel, 3);
        isl.forEach((d, i) => paintIsland(c, d.x - 100, d.y - 240, d.shape, 20 + i));
        const fI = fitLog(isl.map((d) => d.A), isl.map((d) => d.S));
        const main = { A: [1, 4, 16, 64, 256, 1024, 4096, 16384], S: [19, 23, 29, 35, 42, 54, 65, 80] };
        const fM = fitLog(main.A, main.S);
        // Comparison vignette (beat 2): equal areas, continuous habitat vs. sea.
        const V = 230, forest = Theater.makeCanvas(V, V), fc = forest.getContext('2d');
        fc.fillStyle = LAND; fc.beginPath(); fc.roundRect(0, 0, V, V, 6); fc.fill();
        fc.save(); fc.beginPath(); fc.roundRect(0, 0, V, V, 6); fc.clip();
        const rf = rng(77); for (let k = 0; k < 900; k++) { fc.globalAlpha = 0.3 + 0.4 * rf(); fc.fillStyle = LAND_C[k % 4]; fc.beginPath(); fc.arc(rf() * V, rf() * V, 2 + rf() * 5, 0, TAU); fc.fill(); }
        fc.restore(); fc.strokeStyle = 'rgba(238,231,215,0.16)'; fc.lineWidth = 1.5; fc.beginPath(); fc.roundRect(0.75, 0.75, V - 1.5, V - 1.5, 6); fc.stroke();
        const lone = makeIsland(76, 61, { rough: 0.22, elong: 0.06, squash: 1 });
        const sea = Theater.makeCanvas(V, V), sc2 = sea.getContext('2d');
        paintSea(sc2, V, V, [{ shape: lone, x: V / 2, y: V / 2 }], 8); paintIsland(sc2, V / 2, V / 2, lone, 5);
        const res = scatter(lone, 5, 9, 0.62);
        const trans = [[-0.9, 0.25, 1, 0.12], [1.1, -0.35, -1, 0.2], [0.2, -1.1, 0.15, 1], [-0.3, 1.1, -0.1, -1]];
        // Darlington vignette (beat 3)
        const dar = makeIsland(108, 17, { rough: 0.26, elong: 0.1, squash: 0.92 });
        const darPts = scatter(dar, 20, 23, 0.72);
        return { isl, map, fI, fM, main, forest, sea, lone, res, trans, dar, darPts };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx, { fI, fM } = D;
        // ---------------- archipelago map (beat 0), shrinking to an inset (beat 1)
        const sh = S.io(1, 1.4, 0.1), ms = lerp(1, 0.38, sh), mx = lerp(100, 122, sh), my = lerp(240, 612, sh);
        const T = (x, y) => [mx + (x - 100) * ms, my + (y - 240) * ms];
        const mapA = S.p(0, 1.2) * (1 - S.p(2, 0.8));
        const labA = 1 - S.p(1, 0.5);
        g.withAlpha(mapA, () => {
          ctx.drawImage(D.map, mx, my, 1210 * ms, 650 * ms);
          D.isl.forEach((d, i) => {
            const t0 = 2.3 + i * 0.42, dur = 0.5 + d.S * 0.016;
            const [cx, cy] = T(d.x, d.y);
            let shown = 0;
            d.pts.forEach(([px, py], k) => {
              const a = clamp((t - t0 - dur * k / d.S) / 0.25); if (a <= 0) return; shown++;
              g.dot(cx + px * ms, cy + py * ms, lerp(4.2, 2.2, sh) * (1 + 0.6 * (1 - a)), g.SPECIES[(k * 3 + i) % 8], a, 2.2);
            });
            if (labA <= 0) return;
            // labels: count S, then area A
            const ext = d.r * 1.32, [lx, ly] = d.lab;
            const X = d.x + lx * (ext + 14), Y = d.y + ly * (ext * 0.86 + (ly > 0 ? 30 : 46)) + (lx ? -4 : 0);
            const al = lx ? 'left' : 'center';
            const pulse = clamp(1 - Math.abs(t - (S.b(0) + 10.9 + i * 0.2)) / 0.5);
            g.withAlpha(labA * S.p(0, 0.5, t0 - 1.1), () => {
              g.math('S = ' + shown, X, Y, { size: 27, color: U.mix(PAL.ink, COL, pulse), align: al });
              g.text(d.A.toLocaleString('en-US') + ' km²', X, Y + 26, { size: 21, color: PAL.ink3, align: al, alpha: S.p(0, 0.8, 7.9 + i * 0.12) });
            });
          });
          g.text('island sizes schematic', 1292, 874, { size: 21, italic: true, color: PAL.ink3, align: 'right', alpha: labA * S.p(0, 1, 9) });
        });
        // ---------------- plot: linear axes morphing to log–log (beat 1)
        const PX = 720, PY = 300, PW = 560, PH = 490;
        const m = S.io(1, 2.4, 4.9);
        const fxL = (A) => A / 14000, fxG = (A) => Math.log10(A) / Math.log10(20000);
        const fyL = (s) => s / 80, fyG = (s) => (Math.log10(s) - Math.log10(2)) / (Math.log10(100) - Math.log10(2));
        const X = (A) => PX + PW * lerp(fxL(A), fxG(A), m), Y = (s) => PY + PH - PH * lerp(fyL(s), fyG(s), m);
        const pA = S.p(1, 1, 1.1);
        if (pA > 0) {
          g.axes({ x: PX, y: PY, w: PW, h: PH, progress: pA });
          g.withAlpha(pA, () => {
            g.text('area, A (km²)', PX + PW / 2, PY + PH + 74, { size: 23, color: PAL.ink2, align: 'center' });
            g.with(() => { ctx.translate(PX - 78, PY + PH / 2); ctx.rotate(-Math.PI / 2); g.text('number of species, S', 0, 0, { size: 23, color: PAL.ink2, align: 'center' }); });
            const aL = 1 - clamp(m * 3), aG = clamp(m * 3 - 2);
            const tick = (x, y, s, a, vert) => {
              if (a <= 0) return;
              if (vert) { g.line(x, PY + PH, x, PY + PH + 8, { color: PAL.ink2, w: 1.6, alpha: a }); g.text(s, x, PY + PH + 34, { size: 20, color: PAL.ink3, align: 'center', alpha: a }); }
              else { g.line(PX - 8, y, PX, y, { color: PAL.ink2, w: 1.6, alpha: a }); g.text(s, PX - 14, y + 7, { size: 20, color: PAL.ink3, align: 'right', alpha: a }); }
            };
            [[5000, '5,000'], [10000, '10,000']].forEach(([v, s]) => tick(X(v), 0, s, aL, true));
            [20, 40, 60, 80].forEach((v) => tick(0, Y(v), String(v), aL, false));
            [[1, '1'], [10, '10'], [100, '100'], [1000, '1,000'], [10000, '10,000']].forEach(([v, s]) => { tick(X(v), 0, s, aG, true); g.line(X(v), PY, X(v), PY + PH, { color: PAL.faint, w: 1, alpha: aG }); });
            [[2, '2'], [5, '5'], [10, '10'], [20, '20'], [50, '50'], [100, '100']].forEach(([v, s]) => { tick(0, Y(v), s, aG, false); g.line(PX, Y(v), PX + PW, Y(v), { color: PAL.faint, w: 1, alpha: aG }); });
            g.text(m < 0.5 ? 'arithmetic axes' : 'log–log axes', PX + PW, PY - 22, { size: 21, color: PAL.ink3, align: 'right', alpha: S.p(1, 0.6, 1.2) * clamp(Math.abs(1 - 2 * m) * 2) });
          });
        }
        // fitted island curve (power law → straight line)
        g.clip(PX + 1, PY - 12, PW + 14, PH + 12, () => {
          // beat 2: range of island slopes, mainland nested samples
          const w2 = vis(S, 2, 3) * 0.9 + S.at(3) * 0.1;
          if (w2 > 0 && m >= 1) {
            const lg = (z, la) => fI.my + z * (la - fI.mx), fan = [];
            for (let la = 0; la <= 4.31; la += 0.1) fan.push([X(10 ** la), Y(10 ** lg(0.2, la))]);
            for (let la = 4.31; la >= 0; la -= 0.1) fan.push([X(10 ** la), Y(10 ** lg(0.35, la))]);
            g.poly(fan, { fill: U.rgba(COL, 0.13), color: null, w: 0, close: true, alpha: S.p(2, 1, 0.6) * w2 });
          }
          const pr = S.lin(1, 1.8, 2.7);
          g.plot({ X, Y }, (A) => fI.c * Math.pow(A, fI.z), { from: 0.02, to: 20000, steps: 260, color: COL, w: 4, progress: pr });
          const pm = S.p(2, 1.4, 8.2);
          if (pm > 0) g.plot({ X, Y }, (A) => fM.c * Math.pow(A, fM.z), { from: 1, to: 20000, color: PAL.moss, w: 3.5, progress: pm, alpha: 1 - 0.8 * S.p(3, 0.8) });
        });
        if (S.at(2)) {
          const aM = 1 - 0.8 * S.p(3, 0.8);
          D.main.A.forEach((A, k) => { const p = S.p(2, 0.5, 7.0 + k * 0.18) * aM; g.rect(X(A) - 7, Y(D.main.S[k]) - 7, 14, 14, { fill: PAL.moss, alpha: p, r: 2 }); });
          g.withAlpha(aM * S.p(2, 0.8, 8.5), () => {
            g.text('mainland, nested samples', PX + 18, PY + 52, { size: 23, weight: 600, color: PAL.moss });
            g.math('z ≈ 0.12–0.17', PX + 18, PY + 92, { size: 30, color: PAL.moss });
          });
          g.withAlpha(S.p(2, 0.8, 1.5) * (1 - 0.6 * S.p(3, 0.8)), () => {
            g.text('true islands', PX + PW - 10, PY + PH - 96, { size: 23, weight: 600, color: COL, align: 'right' });
            g.math('z ≈ 0.20–0.35', PX + PW - 10, PY + PH - 56, { size: 30, color: COL, align: 'right' });
          });
        }
        // island data points: fly in from the inset map
        D.isl.forEach((d, i) => {
          const td = S.b(1) + 1.25 + i * 0.13, u = ease.inOut((t - td) / 1.1); if (u <= 0) return;
          const p0 = T(d.x, d.y), p2 = [X(d.A), Y(d.S)], p1 = [(p0[0] + p2[0]) / 2, Math.min(p0[1], p2[1]) - 160];
          const [x, y] = u < 1 ? quad(p0, p1, p2, u) : p2;
          g.dot(x, y, 7, PAL.ink, 1, 2.6); g.circle(x, y, 7, { stroke: COL, w: 2 });
        });
        // slope triangle
        const st = vis(S, 1, 2) * S.p(1, 0.8, 9.6);
        if (st > 0) {
          const y10 = Y(fI.c * 10 ** fI.z), y100 = Y(fI.c * 100 ** fI.z);
          g.withAlpha(st, () => {
            g.line(X(10), y10, X(100), y10, { color: PAL.ochre, w: 2.2 }); g.line(X(100), y10, X(100), y100, { color: PAL.ochre, w: 2.2 });
            g.math('Δ\\log\\,A = 1', (X(10) + X(100)) / 2, y10 + 34, { size: 25, color: PAL.ochre, align: 'center' });
            g.math('Δ\\log\\,S = z', X(100) + 12, (y10 + y100) / 2 + 9, { size: 25, color: PAL.ochre });
          });
        }
        // Darlington's rule (beat 3)
        const d3 = S.p(3, 0.8, 0.4);
        if (d3 > 0) {
          const S1 = fI.c * 1000 ** fI.z, S2 = fI.c * 100 ** fI.z;
          const xa = X(1000), xb = X(100), ya = Y(S1), yb = Y(S2);
          g.withAlpha(d3, () => {
            g.dot(xa, ya, 9, PAL.ochre, 1, 3);
            g.arrow(xa - 12, ya, xb + 4, ya, { color: PAL.ochre, w: 3, head: 15, progress: S.p(3, 1.2, 1.2) });
            g.text('area ÷ 10', (xa + xb) / 2, ya - 18, { size: 23, weight: 600, color: PAL.ochre, align: 'center', alpha: S.p(3, 0.6, 2.0) });
            g.arrow(xb, ya + 4, xb, yb - 4, { color: PAL.ochre, w: 3, head: 15, progress: S.p(3, 1, 2.6) });
            g.dot(xb, yb, 9, PAL.ochre, S.p(3, 0.5, 3.4), 3);
            g.text('species × ½', xb - 16, (ya + yb) / 2 + 8, { size: 23, weight: 600, color: PAL.ochre, align: 'right', alpha: S.p(3, 0.6, 3.4) });
          });
        }
        // ---------------- left column: equations
        const eA = S.p(1, 0.9, 2.6) * (1 - S.p(3, 0.7, 8.0));
        g.withAlpha(eA, () => {
          label(g, 'A power law', 122, 262);
          g.math('S = cA^{z}', 122, 350, { size: 56 });
          g.math('\\log\\,S = \\log\\,c + z\\,\\log\\,A', 122, 432, { size: 40, alpha: S.p(1, 1, 7.0) });
        });
        g.withAlpha(vis(S, 1, 2) * S.p(1, 0.8, 9.8), () => {
          g.text('z  slope: how fast richness scales with area', 122, 488, { size: 21, color: COL });
          g.text('c  intercept: species expected at A = 1', 122, 520, { size: 21, color: PAL.ink2 });
        });
        g.withAlpha(vis(S, 1, 2) * S.p(1, 0.8, 1.6), () => label(g, 'The archipelago, as data', 122, 596));
        // reverse arithmetic (beat 3, second sentence)
        g.withAlpha(S.p(3, 0.9, 8.2), () => {
          label(g, 'Run in reverse: habitat loss', 122, 262);
          g.math('\\frac{S_{\\text{new}}}{S_{\\text{old}}} = (\\frac{A_{\\text{new}}}{A_{\\text{old}}})^{z}', 122, 372, { size: 46 });
          g.text('lose 90% of the area  →  lose ≈ 50% of species', 122, 470, { size: 22, color: PAL.ink2, alpha: S.p(3, 0.8, 10) });
        });
        // ---------------- left lower: mainland sample vs island (beat 2)
        const b2 = vis(S, 2, 3);
        g.withAlpha(b2, () => {
          label(g, 'Same area, different settings', 122, 596);
          const V = 230, ax = 122, bx = 382, vy = 618;
          ctx.drawImage(D.forest, ax, vy); ctx.drawImage(D.sea, bx, vy);
          const s0 = 136, sx0 = ax + (V - s0) / 2, sy0 = vy + (V - s0) / 2;
          g.rect(sx0, sy0, s0, s0, { stroke: PAL.ink, w: 2, dash: [7, 6] });
          const res = [[0.3, 0.3], [0.7, 0.24], [0.5, 0.55], [0.22, 0.75], [0.76, 0.72]];
          const RC = [PAL.lagoon, PAL.rose, PAL.heather, PAL.mint, PAL.sand];
          res.forEach(([u, v], k) => g.dot(sx0 + u * s0, sy0 + v * s0, 5, RC[k], 1, 2.2));
          D.res.forEach(([px, py], k) => g.dot(bx + V / 2 + px, vy + V / 2 + py, 5, RC[k], 1, 2.2));
          // transients drifting through the mainland sample
          D.trans.forEach(([x0, y0, vx, vy2], k) => {
            const ph = ((t * 0.09 + k * 0.27) % 1);
            const x = ax + V / 2 + (x0 + vx * ph * 1.9) * V * 0.5 * 0.92, y = vy + V / 2 + (y0 + vy2 * ph * 1.9) * V * 0.5 * 0.92;
            const fade = Math.sin(ph * Math.PI) * S.p(2, 0.8, 11.5), sp = V * 0.5 * 0.92 * 1.9 * 0.06;
            g.line(x - vx * sp, y - vy2 * sp, x, y, { color: PAL.ochre, w: 2, alpha: 0.5 * fade });
            g.dot(x, y, 5, PAL.ochre, fade, 2.4);
          });
          g.text('mainland sample', ax + V / 2, vy + V + 34, { size: 22, weight: 600, color: PAL.ink, align: 'center' });
          g.text('residents + transients', ax + V / 2, vy + V + 60, { size: 21, color: PAL.ochre, align: 'center', alpha: S.p(2, 0.8, 11.5) });
          g.text('island', bx + V / 2, vy + V + 34, { size: 22, weight: 600, color: PAL.ink, align: 'center' });
          g.text('residents only', bx + V / 2, vy + V + 60, { size: 21, color: PAL.ink2, align: 'center', alpha: S.p(2, 0.8, 11.5) });
        });
        // ---------------- left lower: Darlington's island (beat 3)
        const b3 = S.p(3, 0.8);
        g.withAlpha(b3, () => {
          label(g, 'Darlington’s rule', 122, 596);
          const cx = 250, cy = 760, k = ease.inOut(S.lin(3, 1.6, 1.4)), sc = lerp(1, Math.sqrt(0.1), k);
          g.with(() => {
            ctx.translate(cx, cy); ctx.scale(sc, sc);
            pathOf(ctx, scaled(D.dar.pts, 1.12)); ctx.fillStyle = U.rgba(COL, 0.14); ctx.fill();
            pathOf(ctx, D.dar.pts); ctx.fillStyle = LAND; ctx.fill(); ctx.strokeStyle = 'rgba(238,231,215,0.45)'; ctx.lineWidth = 1.4 / sc; ctx.stroke();
          });
          g.poly(scaled(D.dar.pts, 1, cx, cy), { color: PAL.ink3, w: 1.3, dash: [5, 6], close: true, alpha: k });
          D.darPts.forEach(([px, py], j) => {
            const gone = j % 2 === 1, a = gone ? 1 - clamp((t - S.b(3) - 2.2 - j * 0.06) / 0.4) : 1;
            if (a <= 0) return; g.dot(cx + px * sc, cy + py * sc, 4.6, g.SPECIES[j % 8], a, 2.2);
          });
          const n = 20 - D.darPts.filter((_, j) => j % 2 === 1 && t > S.b(3) + 2.2 + j * 0.06 + 0.2).length;
          g.math('A \\to A/10', 410, 690, { size: 36, color: PAL.ink, alpha: S.p(3, 0.6, 1.4) });
          g.math('S = 20 \\to ' + n, 410, 748, { size: 36, color: PAL.ochre, alpha: S.p(3, 0.6, 2.2) });
          g.math('10^{\\text{−0.3}} ≈ 0.50', 410, 818, { size: 36, color: PAL.ink2, alpha: S.p(3, 0.6, 4.5) });
        });
      },
    },
    {
      id: 'isl-equil', title: 'The equilibrium theory',
      beats: [
        { t: 'In 1963 and 1967, Robert MacArthur and E. O. Wilson proposed the equilibrium theory of island biogeography. The number of species on an island reflects a dynamic balance between two rates: the immigration of new species and the extinction of resident ones.' },
        { t: 'The immigration rate falls as an island fills, reaching zero when all P species of the mainland source pool are present. The extinction rate rises with richness, because more species means smaller populations and more species to lose. Both curves bend: the best dispersers arrive first, and competition intensifies as species pack in.' },
        { t: 'Where the curves cross lies the equilibrium species richness, Ŝ. The rate at that crossing is the turnover rate: even when richness holds steady, the identity of the species keeps changing.',
          s: 'Where the curves cross lies the equilibrium species richness, S hat. The rate at that crossing is the turnover rate: even when richness holds steady, the identity of the species keeps changing.', pause: 0.5 },
        { t: 'Distance controls immigration: near islands receive more colonists than far ones, the distance effect. Area controls extinction: large islands support larger populations that persist longer, the area effect. So large, near islands hold the most species, and small, far islands the fewest.', pause: 1 },
      ],
      terms: [
        { beat: 0.6, term: 'Equilibrium theory of island biogeography', def: 'MacArthur & Wilson: island richness is a dynamic balance of immigration and extinction.' },
        { beat: 1.35, term: 'Source pool (P)', def: 'The set of species on the mainland available to colonize an island.' },
        { beat: 2.4, term: 'Turnover', def: 'Replacement of species at equilibrium: extinction of residents balanced by new arrivals.' },
        { beat: 3.2, term: 'Distance & area effects', def: 'Isolation lowers immigration; small area raises extinction.' },
      ],
      init() {
        const LX = 80, LY = 290, LW = 580, LH = 590; // left panel, absolute
        const pool = Array.from({ length: POOL }, (_, i) => [130 + (i % 4) * 26, 378 + Math.floor(i / 4) * 62]);
        const coast = []; for (let y = -6; y <= LH + 6; y += 5) coast.push([160 + 16 * U.fbm2(y * 0.011, 2.5, 41, 3) + 5 * U.noise2(y * 0.06, 7.1, 43), y]);
        const mk = (x, y, r, seed, I0, E1, simSeed, S0, t0, t1) => {
          const shape = makeIsland(r, seed, { rough: 0.3, elong: 0.1 });
          return { x, y, r, shape, slots: scatter(shape, POOL, seed + 5, 0.72), sim: islandSim(simSeed, I0, E1, S0, t0, t1), I0, E1 };
        };
        const focal = mk(478, 600, 104, 13, 0.8, 1.2, 679, 0, 2.0, 60);
        const quad4 = [['near', 'large', 365, 458, 64, 1.15, 0.7], ['near', 'small', 352, 752, 35, 1.15, 2.1], ['far', 'large', 570, 458, 64, 0.45, 0.7], ['far', 'small', 580, 752, 35, 0.45, 2.1]]
          .map(([d, a, x, y, r, I0, E1], k) => ({ ...mk(x, y, r, 30 + k * 7, I0, E1, [360, 8, 62, 395][k], Math.round(Shat(I0, E1)), 36, 72), d, a }));
        const paint = (isles) => {
          const cv = Theater.makeCanvas(LW, LH), c = cv.getContext('2d');
          paintSea(c, LW, LH, isles.map((d) => ({ shape: d.shape, x: d.x - LX, y: d.y - LY })), 12);
          c.save(); c.beginPath(); c.roundRect(0, 0, LW, LH, 8); c.clip();
          const line = () => { c.beginPath(); coast.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); };
          c.strokeStyle = 'rgba(95,192,210,0.06)'; c.lineWidth = 60; line(); c.stroke();
          c.strokeStyle = 'rgba(95,192,210,0.1)'; c.lineWidth = 26; line(); c.stroke();
          const poly = [[-10, -10], ...coast, [-10, LH + 10]];
          pathOf(c, poly); c.fillStyle = LAND; c.fill();
          c.save(); pathOf(c, poly); c.clip();
          const r = rng(5); for (let k = 0; k < 1500; k++) { c.globalAlpha = 0.3 + 0.35 * r(); c.fillStyle = LAND_C[k % 4]; c.beginPath(); c.arc(r() * 200, r() * LH, 1.5 + r() * 3.5, 0, TAU); c.fill(); }
          c.restore();
          c.strokeStyle = 'rgba(216,196,155,0.75)'; c.lineWidth = 3.2; line(); c.stroke();
          c.restore();
          isles.forEach((d, k) => paintIsland(c, d.x - LX, d.y - LY, d.shape, 60 + k));
          c.strokeStyle = 'rgba(238,231,215,0.16)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(0.75, 0.75, LW - 1.5, LH - 1.5, 8); c.stroke();
          return cv;
        };
        return { pool, focal, quad4, panA: paint([focal]), panB: paint(quad4) };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx, { pool, focal, quad4 } = D;
        const col = (i) => g.SPECIES[i % 8];
        const a0 = S.p(0, 1), aB = S.p(3, 1.1, 0.3), aA = 1 - aB;
        // ---------------- left panel: mainland source pool and island(s)
        g.withAlpha(a0, () => {
          label(g, 'Mainland source pool → island', 80, 262);
          if (aA > 0) g.withAlpha(aA, () => ctx.drawImage(D.panA, 80, 290));
          if (aB > 0) g.withAlpha(aB, () => ctx.drawImage(D.panB, 80, 290));
          const pP = clamp(1 - Math.abs(t - S.b(1) - 5.0) / 1.2);
          g.text('source pool', 169, 330, { size: 21, color: PAL.ink, align: 'center', weight: 600 });
          g.math('P = ' + POOL, 169, 358, { size: 26, color: U.mix(PAL.ink2, COL, pP), align: 'center' });
          pool.forEach(([x, y], i) => {
            g.dot(x, y, 5.5, col(i), 0.95, 2.2);
            if (aA > 0 && focal.sim.on[i].some(([t0, t1]) => t >= t0 && t <= t1)) g.circle(x, y, 10, { stroke: COL, w: 2, alpha: aA * 0.9 });
          });
        });
        const smoothCount = (sim) => {
          let prev = sim.S0, cur = sim.S0, te = -99;
          for (const e of sim.ev) { if (e.t > t) break; prev = cur; cur = e.S; te = e.t; }
          return lerp(prev, cur, ease.inOut((t - te) / 0.45));
        };
        const drawSet = (isl, a, fl) => {
          if (a <= 0) return;
          const { sim, slots, x: cx, y: cy } = isl;
          sim.on.forEach((ivs, i) => {
            const sx = cx + slots[i][0], sy = cy + slots[i][1];
            for (const [t0, t1] of ivs) {
              if (t < t0) break;
              if (t <= t1) {
                const u = clamp((t - t0) / 0.6);
                g.dot(sx, sy, 5, col(i), a * (0.4 + 0.6 * u), 2.4);
                if (u < 1) g.circle(sx, sy, 5 + 12 * u, { stroke: COL, w: 2, alpha: a * (1 - u) });
              } else if (t - t1 < 1.1) {
                const u = (t - t1) / 1.1;
                g.dot(sx, sy, 5 * (1 - 0.5 * u), col(i), a * (1 - u), 1.8);
                g.circle(sx, sy, 7 + 16 * u, { stroke: PAL.coral, w: 2.6, alpha: a * (1 - u) });
              }
            }
          });
          for (const e of sim.ev) {
            if (e.t - fl > t) break;
            if (e.k < 0 || t > e.t) continue;
            const u = ease.inOut((t - (e.t - fl)) / fl);
            const p0 = pool[e.sp], p2 = [cx + slots[e.sp][0], cy + slots[e.sp][1]], p1 = [(p0[0] + p2[0]) / 2, Math.min(p0[1], p2[1]) - 80];
            const tr = []; for (let k = 0; k <= 14; k++) tr.push(quad(p0, p1, p2, u * k / 14));
            g.poly(tr, { color: col(e.sp), w: 1.5, alpha: a * 0.4, dash: [3, 6] });
            const [bx, by] = tr[14];
            g.icon('bird', bx, by - 6, 26, col(e.sp), { alpha: a, flap: 0.5 + 0.5 * Math.sin(t * 13 + e.sp * 1.7) });
          }
        };
        g.withAlpha(a0, () => {
          drawSet(focal, aA, 1.5);
          quad4.forEach((q) => drawSet(q, aB, q.d === 'near' ? 1.0 : 1.7));
          // focal island count and annotations
          g.withAlpha(aA, () => {
            g.math('S = ' + focal.sim.countAt(t), 478, 470, { size: 30, align: 'center' });
            g.text('immigration', 340, 352, { size: 22, weight: 600, color: COL, align: 'center', alpha: vis(S, 0, 2) * S.p(0, 0.8, 12.6) });
            g.text('extinction', 478, 774, { size: 22, weight: 600, color: PAL.coral, align: 'center', alpha: vis(S, 0, 2) * S.p(0, 0.8, 14.6) });
            const tb = S.b(2) + 4.5, ca = S.p(2, 0.8, 4.5);
            if (ca > 0) {
              const arr = focal.sim.ev.filter((e) => e.t > tb && e.t <= t && e.k > 0).length, los = focal.sim.ev.filter((e) => e.t > tb && e.t <= t && e.k < 0).length;
              g.text(`+${arr} arrivals`, 468, 790, { size: 22, weight: 600, color: COL, align: 'right', alpha: ca });
              g.text(`−${los} extinctions`, 488, 790, { size: 22, weight: 600, color: PAL.coral, alpha: ca });
              g.text('same richness, new identities', 478, 822, { size: 21, color: PAL.ink2, align: 'center', alpha: S.p(2, 0.8, 7.5) });
            }
          });
          // four islands: labels, counts, extremes
          g.withAlpha(aB, () => {
            g.text('near', 360, 330, { size: 22, weight: 600, color: COL, align: 'center', alpha: S.p(3, 0.8, 1.2) });
            g.text('far', 575, 330, { size: 22, weight: 600, color: COL, align: 'center', alpha: S.p(3, 0.8, 1.2) });
            quad4.forEach((q, k) => {
              const top = q.y - q.r * 0.86 * 1.32, hl = k === 0 ? S.p(3, 0.8, 13.4) : k === 3 ? S.p(3, 0.8, 15.4) : 0;
              if (hl > 0) g.glow(q.x, q.y, q.r * 2.1, PAL.ochre, 0.32 * hl);
              g.math('S = ' + q.sim.countAt(t), q.x, top - 10, { size: 25, align: 'center', color: U.mix(PAL.ink, PAL.ochre, hl), alpha: S.p(3, 0.8, 1.6) });
              g.text(q.a, q.x, q.y + q.r * 0.86 * 1.32 + 26, { size: 21, color: PAL.coral, align: 'center', alpha: S.p(3, 0.8, 7.0) });
            });
          });
        });
        // ---------------- right panel: MacArthur–Wilson graph
        const GX = 812, GY = 336, GW = 458, GH = 444, YM = 1.3;
        const X = (s) => GX + s / POOL * GW, Y = (r) => GY + GH - r / YM * GH, A = { X, Y };
        const I0 = focal.I0, E1 = focal.E1, sH = Shat(I0, E1), tH = Irate(sH, I0);
        // equation: centred in beat 0, docked above the graph from beat 1
        const full = '\\frac{dS}{dt} = I(S) − E(S)', es = 54;
        const wF = g.mathW(full, es), wI = g.mathW('\\frac{dS}{dt} = ', es), wE = g.mathW('\\frac{dS}{dt} = I(S) − ', es);
        const dk = S.io(1, 1.2, 0.1), ex = lerp(1045 - wF / 2, GX + 30, dk), ey = lerp(560, 292, dk), esc = lerp(1, 0.76, dk);
        g.withAlpha(S.p(0, 1, 8.6), () => g.with(() => {
          ctx.translate(ex, ey); ctx.scale(esc, esc);
          g.math(full, 0, 0, { size: es });
          g.math('I(S)', wI, 0, { size: es, color: COL }); g.math('E(S)', wE, 0, { size: es, color: PAL.coral });
        }));
        g.withAlpha(vis(S, 0, 1), () => {
          label(g, 'Equilibrium theory', 812, 262);
          g.text('MacArthur & Wilson, 1963 · 1967', 812, 330, { size: 40, role: 'display', italic: true, color: PAL.ink, alpha: S.p(0, 1, 1.4) });
          const xI = 1045 - wF / 2 + wI + g.mathW('I(S)', es) / 2, xE = 1045 - wF / 2 + wE + g.mathW('E(S)', es) / 2;
          const pI = S.p(0, 0.8, 12.4), pE = S.p(0, 0.8, 14.4);
          g.arrow(xI, 652, xI, 600, { color: COL, w: 2, head: 11, alpha: pI }); g.text('immigration of', xI, 686, { size: 22, color: COL, align: 'center', alpha: pI }); g.text('new species', xI, 714, { size: 22, color: COL, align: 'center', alpha: pI });
          g.arrow(xE, 652, xE, 600, { color: PAL.coral, w: 2, head: 11, alpha: pE }); g.text('extinction of', xE, 686, { size: 22, color: PAL.coral, align: 'center', alpha: pE }); g.text('resident species', xE, 714, { size: 22, color: PAL.coral, align: 'center', alpha: pE });
        });
        const pAx = S.p(1, 1, 0.5);
        if (pAx > 0) {
          g.axes({ x: GX, y: GY, w: GW, h: GH, progress: pAx });
          g.withAlpha(pAx, () => {
            g.text('rate', GX - 16, GY + 6, { size: 22, color: PAL.ink2, align: 'right' });
            g.text('number of species on the island, S', GX + GW / 2, GY + GH + 86, { size: 22, color: PAL.ink2, align: 'center' });
            g.text('0', GX, GY + GH + 32, { size: 20, color: PAL.ink3, align: 'center' });
            g.math('P', X(POOL), GY + GH + 36, { size: 28, align: 'center', alpha: S.p(1, 0.8, 4.4) });
            g.line(X(POOL), GY + GH, X(POOL), GY + GH + 8, { color: PAL.ink2, w: 1.6 });
          });
        }
        const kI = S.io(3, 1.6, 0.8), kE = S.io(3, 1.6, 7.0);
        const gp = (fn, o) => g.plot(A, fn, { from: 0, to: POOL, steps: 140, w: 4, ...o });
        const farC = U.mix(COL, PAL.ink3, 0.35), larC = U.mix(PAL.coral, PAL.ink3, 0.35);
        g.clip(GX - 2, GY - 6, GW + 24, GH + 8, () => {
          // straight references show the bend (beat 1, third sentence)
          const ch = S.p(1, 1, 13.6) * (1 - S.p(2, 0.6));
          g.line(X(0), Y(I0), X(POOL), Y(0), { color: COL, w: 2, dash: [6, 8], alpha: 0.55 * ch });
          g.line(X(0), Y(0), X(POOL), Y(E1), { color: PAL.coral, w: 2, dash: [6, 8], alpha: 0.55 * ch });
          if (kI <= 0) gp((s) => Irate(s, I0), { color: COL, progress: S.lin(1, 3.6, 0.8) });
          else { gp((s) => Irate(s, lerp(I0, 1.15, kI)), { color: COL }); gp((s) => Irate(s, lerp(I0, 0.45, kI)), { color: farC }); }
          if (kE <= 0) gp((s) => Erate(s, E1), { color: PAL.coral, progress: S.lin(1, 3.6, 7.2) });
          else { gp((s) => Erate(s, lerp(E1, 2.1, kE)), { color: PAL.coral }); gp((s) => Erate(s, lerp(E1, 0.7, kE)), { color: larC }); }
        });
        // curve labels
        g.withAlpha(1 - S.p(3, 0.6), () => {
          g.text('immigration, I', GX + 22, 452, { size: 22, weight: 600, color: COL, alpha: S.p(1, 0.8, 1.2) });
          g.text('extinction, E', 1222, 344, { size: 22, weight: 600, color: PAL.coral, align: 'right', alpha: S.p(1, 0.8, 7.6) });
          const pb = S.p(1, 0.8, 14.8) * (1 - S.p(2, 0.6));
          g.text('best dispersers arrive first', GX + 22, 480, { size: 21, color: COL, alpha: pb });
          const pc = S.p(1, 0.8, 16.6) * (1 - S.p(2, 0.6));
          g.text('competition intensifies', 1222, 372, { size: 21, color: PAL.coral, align: 'right', alpha: pc }); g.text('as species pack in', 1222, 398, { size: 21, color: PAL.coral, align: 'right', alpha: pc });
        });
        g.withAlpha(S.p(3, 0.8, 1.6), () => {
          g.text('near', GX + 22, Y(1.15) - 16, { size: 22, weight: 600, color: COL });
          g.text('far', GX + 22, Y(0.45) - 16, { size: 22, weight: 600, color: farC });
        });
        g.withAlpha(S.p(3, 0.8, 7.8), () => {
          g.text('small', X(22.6) - 12, GY + 28, { size: 22, weight: 600, color: PAL.coral, align: 'right' });
          g.text('large', X(POOL) - 6, Y(0.7) - 18, { size: 22, weight: 600, color: larC, align: 'right' });
        });
        // the island's current richness tracks along the S axis (beats 1–2)
        const om = S.p(1, 0.8, 1.0) * (1 - S.p(3, 0.6));
        if (om > 0) {
          const sN = smoothCount(focal.sim), xs = X(sN);
          g.withAlpha(om, () => {
            g.line(xs, GY + GH, xs, Y(Math.max(Irate(sN, I0), Erate(sN, E1))), { color: PAL.ink2, w: 1.5, dash: [3, 5] });
            g.dot(xs, Y(Irate(sN, I0)), 6, COL, S.p(1, 0.6, 2), 2.4); g.dot(xs, Y(Erate(sN, E1)), 6, PAL.coral, S.p(1, 0.6, 7.6), 2.4);
            g.poly([[xs, GY + GH + 4], [xs - 8, GY + GH + 18], [xs + 8, GY + GH + 18]], { fill: PAL.ink, color: null, w: 0, close: true, alpha: 1 - S.p(2, 0.5, 1.0) });
          });
        }
        // equilibrium and turnover (beat 2)
        const q2 = S.p(2, 0.8, 0.6) * (1 - S.p(3, 0.6));
        if (q2 > 0) {
          const cx = X(sH), cy = Y(tH);
          g.withAlpha(q2, () => {
            g.line(cx, cy, cx, GY + GH, { color: PAL.ink, w: 2, dash: [7, 6], progress: S.p(2, 0.8, 1.2) });
            g.math('\\hat{S}', cx, GY + GH + 54, { size: 36, align: 'center', alpha: S.p(2, 0.6, 1.6) });
            const ar = S.p(2, 0.8, 2.4);
            g.arrow(X(3), GY + GH - 18, X(sH - 3), GY + GH - 18, { color: PAL.ink2, w: 2.5, head: 12, alpha: ar });
            g.arrow(X(POOL - 3), GY + GH - 18, X(sH + 3), GY + GH - 18, { color: PAL.ink2, w: 2.5, head: 12, alpha: ar });
            g.line(cx, cy, GX, cy, { color: PAL.ink, w: 2, dash: [7, 6], progress: S.p(2, 0.8, 4.8) });
            g.math('T', GX - 14, cy + 11, { size: 34, align: 'right', alpha: S.p(2, 0.6, 5.4) });
            g.text('turnover rate', GX + 12, cy - 12, { size: 21, color: PAL.ink2, alpha: S.p(2, 0.6, 5.6) });
            g.dot(cx, cy, 9, PAL.ink, 1, 3.4);
          });
        }
        // four equilibria (beat 3)
        const q3 = S.p(3, 0.8, 13.2);
        if (q3 > 0) {
          const combos = [[1.15, 0.7], [1.15, 2.1], [0.45, 0.7], [0.45, 2.1]];
          combos.forEach(([a, b], k) => {
            const s = Shat(a, b), r = Irate(s, a), hi = k === 0 || k === 3, d = k === 0 ? 13.4 : k === 3 ? 15.4 : 13.2;
            const p = S.p(3, 0.8, d);
            if (hi) { g.line(X(s), Y(r), X(s), GY + GH, { color: PAL.ochre, w: 2, dash: [6, 6], alpha: p }); g.text(k === 0 ? 'most' : 'fewest', X(s), GY + GH + 32, { size: 21, weight: 600, color: PAL.ochre, align: 'center', alpha: p }); }
            g.dot(X(s), Y(r), hi ? 8 : 6, hi ? PAL.ochre : PAL.ink, p, 3);
          });
          g.pill('large & near: most species', GX + GW + 10, 893, { size: 21, color: PAL.ochre, align: 'right', alpha: S.p(3, 0.8, 13.4) });
          g.pill('small & far: fewest', GX - 24, 893, { size: 21, color: PAL.ochre, alpha: S.p(3, 0.8, 15.4) });
        }
      },
    },
    {
      id: 'isl-tests', title: 'Experiments & refinements',
      beats: [
        { t: 'The theory was tested directly. Daniel Simberloff and E. O. Wilson tented small mangrove islands in the Florida Keys and fumigated them to remove every arthropod. Within about a year, species numbers returned close to their original levels, with the nearest island richest, but the species were often different ones. That is equilibrium with turnover, as predicted.' },
        { t: 'Refinements followed. James Brown and Astrid Kodric-Brown described the rescue effect in 1977: on near islands, immigrants bolster dwindling populations, lowering extinction rates. The target effect works the other way: larger islands intercept more dispersers, raising immigration. Both blur the neat assignment of distance to immigration and area to extinction.',
          s: 'Refinements followed. James Brown and Astrid Kodrick-Brown described the rescue effect in 1977: on near islands, immigrants bolster dwindling populations, lowering extinction rates. The target effect works the other way: larger islands intercept more dispersers, raising immigration. Both blur the neat assignment of distance to immigration and area to extinction.' },
        { t: 'Real islands also add time and evolution. Krakatau, sterilized by its 1883 eruption, has been reassembling ever since. And on the most remote archipelagos, like Hawaiʻi, speciation within the islands, not immigration, becomes the main source of new species.',
          s: 'Real islands also add time and evolution. Krakatow, sterilized by its 1883 eruption, has been reassembling ever since. And on the most remote archipelagos, like Hawaii, speciation within the islands, not immigration, becomes the main source of new species.', pause: 1 },
      ],
      terms: [
        { beat: 0.35, term: 'Defaunation experiment', def: 'Simberloff & Wilson (1969): removing island arthropods to watch recolonization reach equilibrium.' },
        { beat: 1.3, term: 'Rescue effect', def: 'Immigration that bolsters small populations and lowers extinction rates (Brown & Kodric-Brown 1977).' },
        { beat: 1.6, term: 'Target effect', def: 'Larger islands intercept more dispersers, raising immigration rates.' },
        { beat: 2.6, term: 'In situ speciation', def: 'On remote islands, new species arise within the archipelago, adding to richness beyond immigration.' },
      ],
      init() {
        // ---- beat 0: mangrove islets (side view), stylized after Simberloff & Wilson
        const VX = 80, VY = 290, VW = 560, VH = 400, WL = 268; // vignette panel; water line (relative)
        const vig = Theater.makeCanvas(VW, VH), c = vig.getContext('2d');
        const sky = c.createLinearGradient(0, 0, 0, WL); sky.addColorStop(0, '#0E2226'); sky.addColorStop(1, '#16343A');
        c.save(); c.beginPath(); c.roundRect(0, 0, VW, VH, 8); c.clip();
        c.fillStyle = sky; c.fillRect(0, 0, VW, WL);
        const sea = c.createLinearGradient(0, WL, 0, VH); sea.addColorStop(0, '#13505A'); sea.addColorStop(1, '#0A2A31');
        c.fillStyle = sea; c.fillRect(0, WL, VW, VH - WL);
        const r = rng(31); c.strokeStyle = 'rgba(238,231,215,0.07)'; c.lineWidth = 1.2;
        for (let k = 0; k < 90; k++) { const x = r() * VW, y = WL + 8 + Math.pow(r(), 1.6) * (VH - WL - 10), L = 10 + r() * 24; c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y); c.stroke(); }
        const mangrove = (x, w, h, seed, mainland) => {
          const rr = rng(seed), base = WL - h * 0.34;
          c.strokeStyle = 'rgba(176,156,118,0.8)'; c.lineWidth = 2;
          const nr = mainland ? 18 : 11;
          for (let k = 0; k < nr; k++) { const u = (k + 0.5) / nr - 0.5, bx = x + u * w * 0.45, ex = x + u * w + (rr() - 0.5) * 8; c.beginPath(); c.moveTo(bx, base); c.quadraticCurveTo(lerp(bx, ex, 0.5) + u * 22, base - h * 0.04, ex, WL + 3); c.stroke(); }
          c.save(); c.globalAlpha = 0.2; c.fillStyle = '#0A1A1C'; c.beginPath(); c.ellipse(x, WL + h * 0.2, w * 0.55, h * 0.16, 0, 0, TAU); c.fill(); c.restore();
          for (let k = 0; k < (mainland ? 120 : 60); k++) {
            const a = rr() * Math.PI, rad = Math.sqrt(rr());
            const px = x + Math.cos(a) * w * 0.5 * rad, py = base - 4 - Math.sin(a) * h * 0.6 * rad;
            c.fillStyle = LAND_C[k % 4]; c.globalAlpha = 0.88; c.beginPath(); c.arc(px, py, (mainland ? 10 : 7) + rr() * 8, 0, TAU); c.fill();
          }
          c.globalAlpha = 1;
        };
        const isl = [{ name: 'near', x: 222, w: 120, h: 112, pre: 36, eq: 35, tau: 38, os: 0.12 }, { name: 'middle', x: 362, w: 108, h: 102, pre: 26, eq: 25, tau: 60, os: 0 }, { name: 'far', x: 492, w: 96, h: 92, pre: 19, eq: 18, tau: 95, os: 0 }];
        mangrove(22, 160, 170, 3, true);
        isl.forEach((d, k) => mangrove(d.x, d.w, d.h, 10 + k, false));
        c.restore();
        c.strokeStyle = 'rgba(238,231,215,0.16)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(0.75, 0.75, VW - 1.5, VH - 1.5, 8); c.stroke();
        // census data (days since defaunation)
        const rn = rng(57); const days = [20, 40, 60, 90, 120, 160, 200, 250, 300, 365];
        isl.forEach((d, k) => {
          d.f = (t) => d.eq * (1 - Math.exp(-t / d.tau)) * (1 + d.os * Math.exp(-Math.pow((t - 150) / 70, 2)));
          d.cens = [[-75, d.pre + 1], [-40, d.pre - 1], [-8, d.pre], [0, 0], ...days.map((t) => [t, Math.max(0, Math.round(d.f(t) + (rn() - 0.5) * 2.4))])];
          d.slots = Array.from({ length: 44 }, (_, j) => { const a = 0.12 + ((j * 2.39996) % (Math.PI - 0.24)), rad = 0.25 + 0.75 * Math.sqrt((j + 0.5) / 44); return [d.x + Math.cos(a) * d.w * 0.44 * rad, WL - d.h * 0.34 - 8 - Math.sin(a) * d.h * 0.52 * rad]; });
        });
        // recolonizing flights: one per species gained (scene-local seconds come from the draw mapping)
        const turnBefore = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], keep = [0, 3, 4, 8, 10];
        const turnAfter = turnBefore.map((sp, j) => (keep.includes(sp) ? sp : 12 + j));
        // ---- beat 2: the Hawaiian chain (stylized), old Kauaʻi in the northwest to young Hawaiʻi
        const chain = [[205, 46, 9, 0.35, 0.9], [255, 55, 20, 0.04, 0], [320, 80, 16, 0.22, 2.4], [372, 100, 13, 0.55, 0.15], [368, 122, 7, 0.1, 0], [404, 116, 10, 0.1, 0], [427, 122, 14, 0.15, 0.3], [412, 143, 6, 0.3, 0.3], [466, 138, 27, 0.12, 1.0]]
          .map(([x, y, rr, el, phi], k) => ({ x, y, shape: makeIsland(rr, 70 + k * 3, { rough: 0.22, elong: el, phi, squash: 0.9 }) }));
        const haw = Theater.makeCanvas(510, 190), hc = haw.getContext('2d');
        paintSea(hc, 510, 190, chain, 21); chain.forEach((d, k) => paintIsland(hc, d.x, d.y, d.shape, 80 + k));
        return { vig, isl, WL, turnBefore, turnAfter, kroot: buildTree(), haw };
        function buildTree() {
          // ---- beat 2: radiation from one colonist (random binary tree, 12 tips)
          const rt = rng(19); let id = 0;
          const grow = (depth, t0) => {
            const n = { id: id++, t0 }, ts = t0 + 0.1 + rt() * 0.14;
            if (depth > 0 && ts < 0.9 && (depth > 2 || rt() < 0.7)) { n.ts = ts; n.kids = [grow(depth - 1, ts), grow(depth - 1, ts)]; }
            return n;
          };
          const root = grow(4, 0); const tips = [];
          const walk = (n) => { if (n.kids) n.kids.forEach(walk); else tips.push(n); };
          walk(root); tips.forEach((n, k) => (n.ix = k));
          const setx = (n) => { if (n.kids) { n.kids.forEach(setx); n.ix = (n.kids[0].ix + n.kids[1].ix) / 2; } };
          setx(root); return { root, n: tips.length };
        }
      },
      draw(g, t, S, D) {
        const ctx = g.ctx, WL = D.WL + 290;
        // =============== beat 0: defaunation experiment
        const v0 = vis(S, 0, 1);
        // scene-time → days since fumigation
        const tF = S.b(0) + 8.2, tR0 = S.b(0) + 10.3, tR1 = S.b(0) + 15.6;
        const dayAt = (tt) => (tt < tR0 ? -1 : 365 * clamp((tt - tR0) / (tR1 - tR0)));
        const day = dayAt(t);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Defaunating mangrove islets · Florida Keys', 80, 262);
          ctx.drawImage(D.vig, 80, 290);
          g.text('mainland', 112, 320, { size: 21, color: PAL.ink2 });
          D.isl.forEach((d, k) => {
            const x = d.x + 80, wtop = WL - d.h * 1.36;
            // arthropod species present on the islet
            const n = t < tF ? d.pre : day < 0 ? 0 : Math.round(d.f(day));
            const fade = t < tF ? 1 : t < tF + 1.2 ? 1 - (t - tF) / 1.2 : 1;
            for (let j = 0; j < Math.min(n, d.slots.length); j++) { const [sx, sy] = d.slots[j]; g.dot(sx + 80, sy + 290, 2.6, g.SPECIES[(j * 5 + k) % 8], fade, 2.4); }
            // tent: drops on, fills with fumigant, lifts away
            const tin = S.p(0, 0.9, 3.4 + k * 0.5), tout = S.p(0, 1, 9.6 + k * 0.15);
            const ta = tin * (1 - tout); if (ta > 0) {
              const dy = (1 - tin) * -60 - tout * 70, hw = d.w * 0.58;
              const fum = clamp((t - tF + 1.2) / 1.0) * (1 - tout);
              g.with(() => {
                ctx.translate(0, dy);
                ctx.beginPath(); ctx.moveTo(x - hw, WL + 4); ctx.bezierCurveTo(x - hw, wtop - 10, x + hw, wtop - 10, x + hw, WL + 4); ctx.closePath();
                ctx.globalAlpha *= ta; ctx.fillStyle = U.rgba(PAL.sand, 0.22 + 0.25 * fum); ctx.fill();
                ctx.strokeStyle = U.rgba(PAL.sand, 0.9); ctx.lineWidth = 2; ctx.stroke();
                ctx.strokeStyle = U.rgba(PAL.sand, 0.45); ctx.lineWidth = 1.2;
                for (const u of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(x + u * hw, WL + 4); ctx.lineTo(x + u * hw * 0.6, wtop + 8 + Math.abs(u) * 26); ctx.stroke(); }
              });
              if (fum > 0) g.glow(x, WL - d.h * 0.5, d.w * 0.9, PAL.ochre, 0.4 * fum);
            }
            // labels
            g.text(d.name, x, WL + 62, { size: 21, color: PAL.ink2, align: 'center', alpha: S.p(0, 0.8, 1.2) });
            g.math('S = ' + n, x, WL - d.h * 1.2 - 22, { size: 24, align: 'center', alpha: S.p(0, 0.8, 1.6) });
          });
          g.text('tent + methyl bromide fumigation', 360, 680, { size: 21, color: PAL.sand, align: 'center', alpha: S.p(0, 0.8, 5.6) * (1 - S.p(0, 0.6, 10.2)) });
          // recolonizing arthropods fly out from the mainland fringe
          if (day >= 0 && t < tR1 + 1) D.isl.forEach((d, k) => {
            const N = Math.round(d.f(365) * 1.15);
            for (let j = 0; j < N; j++) {
              const ta = tR0 + (tR1 - tR0) * (-d.tau * Math.log(1 - (j + 0.5) / (N + 1))) / 365, fl = 0.7 + k * 0.25;
              if (t < ta - fl || t > ta) continue;
              const u = (t - (ta - fl)) / fl, p0 = [150, WL - 80 - (j % 5) * 12], p2 = [d.x + 80, WL - d.h * 0.62], p1 = [(p0[0] + p2[0]) / 2, WL - 170 - (j % 3) * 20];
              const [bx, by] = quad(p0, p1, p2, u);
              g.icon('butterfly', bx, by, 17, g.SPECIES[(j * 3 + k) % 8], { flap: 0.5 + 0.5 * Math.sin(t * 20 + j) });
            }
          });
          // turnover: same richness, different species (near islet)
          const pt = S.p(0, 0.8, 15.4);
          g.withAlpha(pt, () => {
            label(g, 'Near islet · who came back?', 80, 742);
            const row = (ids, y, lab, isAfter) => {
              g.text(lab, 80, y + 7, { size: 21, color: PAL.ink2 });
              ids.forEach((sp, j) => {
                const x = 232 + j * 34, same = D.turnBefore.includes(sp);
                g.icon('bug', x, y, 22, sp < 12 ? g.SPECIES[sp % 8] : [PAL.mint, PAL.rose, PAL.heather, PAL.sand][sp % 4], { alpha: isAfter ? S.p(0, 0.5, 15.8 + j * 0.06) : 1 });
                if (isAfter && !same) g.circle(x, y, 15, { stroke: PAL.ochre, w: 1.6, alpha: S.p(0, 0.6, 16.6) });
              });
            };
            row(D.turnBefore, 786, 'before', false); row(D.turnAfter, 842, '1 yr later', true);
            g.text('new species ringed', 640, 884, { size: 21, color: PAL.ochre, align: 'right', alpha: S.p(0, 0.6, 16.6) });
          });
        });
        // plot: species vs days
        const PX = 780, PY = 330, PW = 470, PH = 420;
        const X = (d) => PX + (d + 90) / 490 * PW, Y = (s) => PY + PH - s / 45 * PH;
        if (v0 > 0) g.withAlpha(v0, () => {
          const pA = S.p(0, 1, 2.0);
          label(g, 'Arthropod species per islet', 780, 262, pA);
          g.axes({ x: PX, y: PY, w: PW, h: PH, progress: pA, arrows: true });
          g.withAlpha(pA, () => {
            [0, 100, 200, 300, 400].forEach((v) => { g.line(X(v), PY + PH, X(v), PY + PH + 8, { color: PAL.ink2, w: 1.6 }); g.text(String(v), X(v), PY + PH + 32, { size: 20, color: PAL.ink3, align: 'center' }); });
            [10, 20, 30, 40].forEach((v) => { g.line(PX - 8, Y(v), PX, Y(v), { color: PAL.ink2, w: 1.6 }); g.text(String(v), PX - 14, Y(v) + 7, { size: 20, color: PAL.ink3, align: 'right' }); });
            g.text('days since defaunation', PX + PW / 2, PY + PH + 70, { size: 22, color: PAL.ink2, align: 'center' });
            g.text('species, S', PX - 16, PY + 6, { size: 22, color: PAL.ink2, align: 'right' });
            g.text('stylized after Simberloff & Wilson (1969, 1970)', PX + PW, PY + PH + 108, { size: 21, italic: true, color: PAL.ink3, align: 'right' });
          });
          g.line(X(0), PY, X(0), PY + PH, { color: PAL.sand, w: 1.5, dash: [4, 6], alpha: S.p(0, 0.6, 8.0) });
          g.text('fumigation', X(0) + 8, PY + 18, { size: 21, color: PAL.sand, alpha: S.p(0, 0.6, 8.0) });
          const cols = [PAL.lagoon, PAL.mint, PAL.heather];
          D.isl.forEach((d, k) => {
            const c = cols[k], pre = d.cens.slice(0, 3);
            const pp = S.p(0, 1, 3.6 + k * 0.4);
            g.data({ X, Y }, pre, { color: c, w: 3, progress: pp });
            pre.forEach(([u, v]) => g.dot(X(u), Y(v), 4.5, c, pp, 2));
            // reference: original level carried forward
            g.line(X(-8), Y(d.pre), X(400), Y(d.pre), { color: c, w: 1.4, dash: [3, 7], alpha: 0.6 * S.p(0, 0.8, 11.5) });
            if (t > tF) {
              const dr = S.p(0, 0.6, 8.3);
              g.line(X(-8), Y(d.pre), X(-8) + (X(0) - X(-8)) * dr, Y(d.pre * (1 - dr)), { color: c, w: 3 });
              const post = d.cens.slice(3).filter(([u]) => u <= Math.max(0, day));
              if (post.length > 1) g.data({ X, Y }, post, { color: c, w: 3 });
              post.forEach(([u, v]) => g.dot(X(u), Y(v), 4.5, c, 1, 2));
            }
            g.text(d.name, X(400) + 10, Y(d.cens[d.cens.length - 1][1]) + 7, { size: 21, weight: 600, color: c, alpha: S.p(0, 0.6, 13.2 + k * 0.3), maxW: 120 });
          });
          g.pill('nearest islet richest', X(400), Y(44), { size: 21, color: PAL.lagoon, align: 'right', alpha: S.p(0, 0.6, 13.6) * (1 - S.p(0, 0.5, 18.0)) });
          g.pill('equilibrium with turnover', X(400), Y(44), { size: 21, color: PAL.ochre, align: 'right', alpha: S.p(0, 0.6, 18.4) });
        });
        // =============== beat 1: rescue and target effects
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          const graph = (gx, title, fns, d0) => {
            const GW = 430, GH = 300, GY = 330, Xg = (s) => gx + s / POOL * GW, Yg = (r) => GY + GH - r / 1.3 * GH;
            label(g, title, gx - 30, 262);
            g.axes({ x: gx, y: GY, w: GW, h: GH, progress: S.p(1, 1, d0) });
            g.text('rate', gx - 14, GY + 6, { size: 22, color: PAL.ink2, align: 'right', alpha: S.p(1, 1, d0) });
            g.text('species on the island, S', gx + GW / 2, GY + GH + 40, { size: 22, color: PAL.ink2, align: 'center', alpha: S.p(1, 1, d0) });
            g.clip(gx - 2, GY - 6, GW + 20, GH + 8, () => fns.forEach((f) => g.plot({ X: Xg, Y: Yg }, f.fn, { from: 0, to: POOL, steps: 120, color: f.c, w: f.w || 3.5, dash: f.dash, progress: f.p, alpha: f.a })));
            return { Xg, Yg, GY, GH, GW };
          };
          const legend = (lx, ly, rows) => rows.forEach(([c, dash, txt, a], k) => { const y = ly + k * 30; g.line(lx, y - 7, lx + 34, y - 7, { color: c, w: 3, dash, alpha: a }); g.text(txt, lx + 44, y, { size: 21, color: PAL.ink2, alpha: a }); });
          // rescue: near island, extinction lowered
          const kR = S.io(1, 1.6, 8.0);
          const r1 = graph(150, 'Rescue effect · near islands', [
            { fn: (s) => Irate(s, 1.15), c: COL, p: S.p(1, 1.2, 2.2) },
            { fn: (s) => Erate(s, 1.25), c: PAL.coral, dash: [7, 7], w: 2.5, p: S.p(1, 1.2, 2.8), a: 0.7 },
            { fn: (s) => Erate(s, lerp(1.25, 0.6, kR)), c: PAL.coral, a: S.p(1, 0.4, 8.0) },
          ], 1.6);
          g.text('Brown & Kodric-Brown 1977', 150 + 430, 300, { size: 21, italic: true, color: PAL.ink3, align: 'right', alpha: S.p(1, 0.8, 2.6) });
          legend(236, 350, [[COL, null, 'immigration, near island', S.p(1, 0.8, 3)], [PAL.coral, [7, 7], 'extinction, no rescue', S.p(1, 0.8, 3.6)], [PAL.coral, null, 'extinction, rescued', S.p(1, 0.8, 9.0)]]);
          for (const s of [21, 27]) g.arrow(r1.Xg(s), r1.Yg(Erate(s, 1.25)) + 8, r1.Xg(s), r1.Yg(Erate(s, 0.6)) - 8, { color: PAL.coral, w: 2, head: 11, alpha: S.p(1, 0.6, 8.4) * 0.9 });
          const sa = Shat(1.15, 1.25), sb = Shat(1.15, 0.6), sh1 = S.p(1, 0.8, 10.2);
          g.withAlpha(sh1, () => {
            g.line(r1.Xg(sa), r1.Yg(Irate(sa, 1.15)), r1.Xg(sa), r1.GY + r1.GH, { color: PAL.ink3, w: 1.5, dash: [5, 6] });
            g.line(r1.Xg(sb), r1.Yg(Irate(sb, 1.15)), r1.Xg(sb), r1.GY + r1.GH, { color: PAL.ink, w: 1.8, dash: [5, 6] });
            g.arrow(r1.Xg(sa) + 4, r1.GY + r1.GH - 16, r1.Xg(sb) - 4, r1.GY + r1.GH - 16, { color: PAL.ochre, w: 2.5, head: 12 });
            g.dot(r1.Xg(sb), r1.Yg(Irate(sb, 1.15)), 7, PAL.ink, 1, 3);
          });
          // target: large island, immigration raised
          const kT = S.io(1, 1.6, 14.4);
          const r2 = graph(820, 'Target effect · large islands', [
            { fn: (s) => Erate(s, 1.0), c: PAL.coral, p: S.p(1, 1.2, 12.4) },
            { fn: (s) => Irate(s, 0.6), c: COL, dash: [7, 7], w: 2.5, p: S.p(1, 1.2, 12.8), a: 0.7 },
            { fn: (s) => Irate(s, lerp(0.6, 1.15, kT)), c: COL, a: S.p(1, 0.4, 14.4) },
          ], 12.2);
          legend(906, 350, [[PAL.coral, null, 'extinction', S.p(1, 0.8, 12.8)], [COL, [7, 7], 'immigration, small target', S.p(1, 0.8, 13.2)], [COL, null, 'immigration, large target', S.p(1, 0.8, 15.2)]]);
          for (const s of [4, 10]) g.arrow(r2.Xg(s), r2.Yg(Irate(s, 0.6)) - 8, r2.Xg(s), r2.Yg(Irate(s, 1.15)) + 8, { color: COL, w: 2, head: 11, alpha: S.p(1, 0.6, 14.8) * 0.9 });
          const ta2 = Shat(0.6, 1.0), tb2 = Shat(1.15, 1.0), sh2 = S.p(1, 0.8, 16.4);
          g.withAlpha(sh2, () => {
            g.line(r2.Xg(ta2), r2.Yg(Erate(ta2, 1.0)), r2.Xg(ta2), r2.GY + r2.GH, { color: PAL.ink3, w: 1.5, dash: [5, 6] });
            g.line(r2.Xg(tb2), r2.Yg(Erate(tb2, 1.0)), r2.Xg(tb2), r2.GY + r2.GH, { color: PAL.ink, w: 1.8, dash: [5, 6] });
            g.arrow(r2.Xg(ta2) + 4, r2.GY + r2.GH - 16, r2.Xg(tb2) - 4, r2.GY + r2.GH - 16, { color: PAL.ochre, w: 2.5, head: 12 });
            g.dot(r2.Xg(tb2), r2.Yg(Erate(tb2, 1.0)), 7, PAL.ink, 1, 3);
          });
          // what controls what
          const p3 = S.p(1, 0.8, 18.5), p4 = S.p(1, 0.8, 19.6);
          g.withAlpha(p3, () => {
            const xl = 470, xr = 870, y1 = 776, y2 = 862;
            g.text('distance', xl, y1 + 8, { size: 24, weight: 600, color: PAL.ink, align: 'right' }); g.text('area', xl, y2 + 8, { size: 24, weight: 600, color: PAL.ink, align: 'right' });
            g.text('immigration', xr, y1 + 8, { size: 24, weight: 600, color: COL }); g.text('extinction', xr, y2 + 8, { size: 24, weight: 600, color: PAL.coral });
            g.arrow(xl + 16, y1, xr - 16, y1, { color: COL, w: 3, head: 14 }); g.arrow(xl + 16, y2, xr - 16, y2, { color: PAL.coral, w: 3, head: 14 });
            g.arrow(xl + 16, y1 + 8, xr - 16, y2 - 8, { color: PAL.coral, w: 2.4, head: 13, dash: [8, 7], progress: p4 });
            g.arrow(xl + 16, y2 - 8, xr - 16, y1 + 8, { color: COL, w: 2.4, head: 13, dash: [8, 7], progress: p4 });
            g.text('rescue', xl + 70, (y1 + y2) / 2 + 8, { size: 21, color: PAL.coral, alpha: p4 });
            g.text('target', xr - 70, (y1 + y2) / 2 + 8, { size: 21, color: COL, align: 'right', alpha: p4 });
            g.line(1060, y1 - 7, 1100, y1 - 7, { color: PAL.ink2, w: 3 }); g.text('MacArthur–Wilson', 1112, y1, { size: 21, color: PAL.ink2 });
            g.line(1060, y2 - 7, 1100, y2 - 7, { color: PAL.ink2, w: 2.4, dash: [8, 7], alpha: p4 }); g.text('refinements', 1112, y2, { size: 21, color: PAL.ink2, alpha: p4 });
          });
        });
        // =============== beat 2: time and evolution
        const v2 = S.p(2, 0.9);
        if (v2 > 0) g.withAlpha(v2, () => {
          // ---- Krakatau
          label(g, 'Krakatau · reassembly after 1883', 80, 262);
          const kx = 80, ky = 290, kw = 560, kh = 230, wl = ky + 168;
          g.with(() => {
            ctx.beginPath(); ctx.roundRect(kx, ky, kw, kh, 8); ctx.clip();
            const gr = ctx.createLinearGradient(0, ky, 0, ky + kh); gr.addColorStop(0, '#0E2226'); gr.addColorStop(0.73, '#16343A'); gr.addColorStop(0.731, '#13505A'); gr.addColorStop(1, '#0A2A31');
            ctx.fillStyle = gr; ctx.fillRect(kx, ky, kw, kh);
            // eruption plume, then the surviving cone (Rakata) slowly greens
            const er = S.lin(2, 4.0, 2.2), pl = Math.sin(Math.PI * Math.min(1, er * 1.15)) * (1 - S.p(2, 1.2, 6.2));
            const cx0 = kx + 290, prof = (u) => 112 * Math.pow(1 - Math.abs(u), 1.7);
            const cone = []; for (let k = 0; k <= 40; k++) { const u = -1 + k / 40 * 1.42; cone.push([cx0 + u * 150, wl + 3 - prof(u)]); }
            cone.push([cx0 + 0.42 * 150 + 6, wl - 30], [cx0 + 0.42 * 150 + 14, wl + 3]);
            const grn = S.lin(2, 4.5, 4.4);
            g.poly(cone, { fill: U.mix('#55524B', '#355B3C', grn), color: U.rgba(PAL.sand, 0.55), w: 1.6, close: true });
            g.clip(kx, wl - 118 + (1 - grn) * 136, kw, 130, () => { for (let j = 0; j < 30; j++) { const u = -0.95 + ((j * 0.618) % 1) * 1.33, x = cx0 + u * 150; g.icon(j % 3 ? 'tree' : 'conifer', x, wl + 12 - prof(u) - 2, 16 + (j % 4) * 2, LAND_C[j % 4]); } });
            for (let j = 0; j < 34; j++) {
              const ph = (j * 0.137 + er * 1.4) % 1, a = pl * (1 - ph) * 0.9; if (a <= 0.02) continue;
              g.circle(cx0 + Math.sin(j * 2.3) * (8 + ph * 60), wl - 108 - ph * 95, 7 + ph * 22, { fill: j % 4 ? 'rgba(160,150,138,0.55)' : 'rgba(232,115,90,0.5)', alpha: a });
            }
            if (pl > 0) g.glow(cx0, wl - 110, 60, PAL.coral, 0.7 * pl);
            for (let j = 0; j < 4; j++) { const u = clamp((t - S.b(2) - 6.4 - j * 0.6) / 2.2); if (u <= 0 || u >= 1) continue; g.icon('bird', lerp(kx + 20, cx0 - 20 + j * 18, u), wl - 130 - Math.sin(u * Math.PI) * 30 + j * 12, 22, PAL.ink2, { flap: 0.5 + 0.5 * Math.sin(t * 12 + j) }); }
          });
          g.rect(kx, ky, kw, kh, { stroke: 'rgba(238,231,215,0.16)', w: 1.5, r: 8 });
          g.text('1883 eruption', kx + 22, ky + 38, { size: 24, weight: 600, color: PAL.coral, alpha: S.p(2, 0.6, 2.8) });
          g.text('sterilized', kx + 470, wl - 60, { size: 21, color: PAL.ink3, align: 'center', alpha: S.p(2, 0.6, 3.4) * (1 - S.p(2, 0.6, 6.4)) });
          g.text('recolonized', kx + 470, wl - 60, { size: 21, color: PAL.moss, align: 'center', alpha: S.p(2, 0.6, 6.6) });
          const K = { X: (yr) => 150 + (yr - 1883) / 110 * 450, Y: (s) => 820 - s / 120 * 220 };
          const kp = S.p(2, 0.8, 4.0);
          g.axes({ x: 150, y: 600, w: 450, h: 220, progress: kp });
          g.withAlpha(kp, () => {
            [1883, 1920, 1960].forEach((v) => g.text(String(v), K.X(v), 852, { size: 20, color: PAL.ink3, align: 'center' }));
            g.text('species recorded', 150, 586, { size: 22, color: PAL.ink2 });
            g.text('year', 600, 852, { size: 22, color: PAL.ink2, align: 'right' });
          });
          const kr = (yr) => 104 * (1 - Math.exp(-(yr - 1883) / 30));
          g.plot(K, kr, { from: 1883, to: 1990, color: PAL.moss, w: 3.5, progress: S.lin(2, 4.0, 4.6) });
          [1886, 1897, 1908, 1920, 1934, 1951, 1983].forEach((yr, j) => { const p = clamp((S.lin(2, 4.0, 4.6) * 107 - (yr - 1883)) * 0.5); g.dot(K.X(yr), K.Y(kr(yr) + (j % 2 ? 4 : -3)), 4.5, PAL.moss, p, 2); });
          g.text('stylized', 600, 796, { size: 21, italic: true, color: PAL.ink3, align: 'right', alpha: kp });
          // ---- Hawaiʻi: in situ radiation
          const hp = S.p(2, 0.9, 8.8);
          label(g, 'Hawai‘i · speciation in situ', 780, 262, hp);
          g.withAlpha(hp, () => {
            const hx = 780, hy = 290, hw = 510, hh = 190;
            ctx.drawImage(D.haw, hx, hy);
            const ca = S.lin(2, 1.6, 10.2);
            if (ca > 0) { const p0 = [hx - 10, hy + 40], p2 = [hx + 255, hy + 55], p1 = [880, hy + 6]; const tr = []; for (let k = 0; k <= 20; k++) tr.push(quad(p0, p1, p2, ca * k / 20)); g.clip(hx, hy, hw, hh, () => g.poly(tr, { color: PAL.ochre, w: 2, dash: [5, 6] })); if (ca < 1) g.icon('bird', tr[20][0], tr[20][1] - 4, 26, PAL.ochre, { flap: 0.5 + 0.5 * Math.sin(t * 13) }); }
            g.rect(hx, hy, hw, hh, { stroke: 'rgba(238,231,215,0.16)', w: 1.5, r: 8 });
            g.text('one colonist,', hx + 20, hy + 120, { size: 21, color: PAL.ochre, alpha: S.p(2, 0.6, 10.6) });
            g.text('~3,800 km from a continent', hx + 20, hy + 148, { size: 21, color: PAL.ink2, alpha: S.p(2, 0.6, 10.6) });
            g.text('Kaua‘i', hx + 255, hy + 104, { size: 21, color: PAL.ink2, align: 'center' });
            g.text('Hawai‘i', hx + 426, hy + 178, { size: 21, color: PAL.ink2, align: 'right' });
          });
          // radiation tree grows upward from the colonist
          const tp = S.lin(2, 5.4, 10.6), tree = D.kroot, x0 = 830, x1 = 1250, yb = 850, yt = 560;
          const TX = (ix) => lerp(x0, x1, ix / (tree.n - 1)), TY = (tt) => lerp(yb, yt, tt);
          const front = tp * 1.05;
          if (tp > 0) {
            const node = (n) => {
              if (front <= n.t0) return;
              const x = TX(n.ix), end = n.kids ? n.ts : 1;
              g.line(x, TY(n.t0), x, TY(Math.min(end, front)), { color: PAL.heather, w: 2.6 });
              if (n.kids && front >= n.ts) { g.line(TX(n.kids[0].ix), TY(n.ts), TX(n.kids[1].ix), TY(n.ts), { color: PAL.heather, w: 2.6 }); n.kids.forEach(node); }
              if (!n.kids && front >= 1) g.icon('songbird', x, yt - 24, 28, g.SPECIES[(n.ix * 3) % 8], { flip: n.ix % 2 === 1, alpha: clamp((front - 1) * 20) });
            };
            g.dot(TX(tree.root.ix), yb, 6, PAL.ochre, 1, 3);
            node(tree.root);
            g.text('in situ speciation: one colonist → many species', 1040, 896, { size: 21, color: PAL.heather, align: 'center', alpha: S.p(2, 0.8, 13.0) });
          }
        });
      },
    },
    {
      id: 'isl-frag', title: 'Habitat islands & conservation',
      beats: [
        { t: 'The theory’s greatest influence was on conservation, because fragments of habitat behave like islands in a sea of altered land. A newly isolated fragment holds more species than its new, smaller equilibrium, so its richness decays toward that lower level. This decay is called relaxation, or faunal collapse.' },
        { t: 'The species destined to vanish but not yet gone constitute an extinction debt, a debt that will be paid unless habitat is restored or reconnected. William Newmark found in 1987 that western North American national parks had lost mammal species since their establishment, with the smallest parks losing the most.' },
        { t: 'Island theory also sparked the SLOSS debate: for the same total area, is it better to protect a single large reserve or several small ones? A single large reserve supports area-sensitive species and larger populations; several small reserves can capture more habitat variety and spread risk. The answer depends on nestedness, dispersal, and the threats involved, and the question led directly to metapopulation thinking.',
          s: 'Island theory also sparked the SLOSS debate: for the same total area, is it better to protect a single large reserve or several small ones? A single large reserve supports area-sensitive species and larger populations; several small reserves can capture more habitat variety and spread risk. The answer depends on nestedness, dispersal, and the threats involved, and the question led directly to metapopulation thinking.', pause: 1 },
      ],
      terms: [
        { beat: 0.35, term: 'Habitat fragmentation', def: 'Breaking of continuous habitat into smaller, isolated patches within a matrix of altered land.' },
        { beat: 0.8, term: 'Relaxation', def: 'Decline of species richness in a newly isolated fragment toward a lower equilibrium (faunal collapse).' },
        { beat: 1.2, term: 'Extinction debt', def: 'Future extinctions already committed by past habitat loss or isolation.' },
        { beat: 2.3, term: 'SLOSS debate', def: 'Single large or several small reserves of equal total area: which conserves more species?' },
      ],
      init() {
        const LW = 560, LH = 590, NC = 8, NR = 8, cw = LW / NC, chh = LH / NR;
        // continuous forest canopy, seen from above
        const forest = Theater.makeCanvas(LW, LH), fc = forest.getContext('2d');
        fc.fillStyle = '#24452E'; fc.fillRect(0, 0, LW, LH);
        const r = rng(91);
        for (let k = 0; k < 5200; k++) { const x = r() * LW, y = r() * LH, s = 2.5 + r() * 6; fc.globalAlpha = 0.45 + 0.45 * r(); fc.fillStyle = ['#2F5A39', '#3E6A45', '#1E3D29', '#4D7C4E', '#335F3A'][k % 5]; fc.beginPath(); fc.arc(x, y, s, 0, TAU); fc.fill(); }
        fc.globalAlpha = 1;
        // jittered parcel grid; some blocks are never cleared (the fragments)
        const vtx = []; for (let j = 0; j <= NR; j++) { vtx[j] = []; for (let i = 0; i <= NC; i++) { const edge = i === 0 || j === 0 || i === NC || j === NR; vtx[j][i] = [i * cw + (edge ? 0 : (r() - 0.5) * cw * 0.34), j * chh + (edge ? 0 : (r() - 0.5) * chh * 0.34)]; } }
        const keep = new Set(['4,1', '5,1', '6,1', '4,2', '5,2', '6,2', '5,3', '1,4', '2,4', '1,5', '2,5', '6,6', '3,7', '0,1']);
        const focalKeys = ['1,4', '2,4', '1,5', '2,5'];
        const crops = [['#8A7A4E', '#9C8B5A'], ['#6E7B48', '#7E8B55'], ['#6B5843', '#7A6650'], ['#857247', '#93805A']];
        const parcels = [];
        for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
          const pts = [vtx[j][i], vtx[j][i + 1], vtx[j + 1][i + 1], vtx[j + 1][i]], key = i + ',' + j;
          parcels.push({ pts, key, kept: keep.has(key), type: (i * 7 + j * 3 + (i * j) % 3) % 4, tc: 2.3 + 4.2 * clamp((i + 0.5 + 1.4 * U.noise2(i * 0.7, j * 0.7, 5)) / (NC + 0.6)) });
        }
        // fields: crop stripes per parcel, pre-rendered once
        const fields = Theater.makeCanvas(LW, LH), dc = fields.getContext('2d');
        parcels.forEach((p, k) => {
          if (p.kept) return; const [c1, c2] = crops[p.type];
          dc.save(); pathOf(dc, p.pts); dc.fillStyle = c1; dc.fill(); dc.clip();
          const ang = (k % 3) * 0.6 + 0.2, cx = p.pts[0][0] + cw / 2, cy = p.pts[0][1] + chh / 2;
          dc.translate(cx, cy); dc.rotate(ang); dc.strokeStyle = c2; dc.lineWidth = 2.2;
          for (let s = -70; s <= 70; s += 7) { dc.beginPath(); dc.moveTo(-80, s); dc.lineTo(80, s); dc.stroke(); }
          dc.restore();
          dc.strokeStyle = 'rgba(30,26,20,0.5)'; dc.lineWidth = 1.4; pathOf(dc, p.pts); dc.stroke();
        });
        const road = []; for (let i = 0; i <= NC; i++) road.push(vtx[6][i]);
        // focal fragment outline and species inside it
        const fo = [vtx[4][1], vtx[4][2], vtx[4][3], vtx[5][3], vtx[6][3], vtx[6][2], vtx[6][1], vtx[5][1]];
        const inPoly = (x, y, P) => { let c = false; for (let a = 0, b = P.length - 1; a < P.length; b = a++) { if ((P[a][1] > y) !== (P[b][1] > y) && x < (P[b][0] - P[a][0]) * (y - P[a][1]) / (P[b][1] - P[a][1]) + P[a][0]) c = !c; } return c; };
        const rs = rng(4), spp = [];
        while (spp.length < 40) { const x = vtx[4][1][0] + rs() * 2 * cw, y = vtx[4][1][1] + rs() * 2 * chh; if (inPoly(x, y, fo) && inPoly(x + 6, y, fo) && inPoly(x - 6, y, fo) && inPoly(x, y + 6, fo) && inPoly(x, y - 6, fo) && spp.every(([a, b]) => Math.hypot(a - x, b - y) > 13)) spp.push([x, y]); }
        // SLOSS matrix panel (fields only)
        const mat = Theater.makeCanvas(530, 330), mc = mat.getContext('2d'); mc.fillStyle = '#76683F'; mc.fillRect(0, 0, 530, 330);
        mc.drawImage(fields, 0, 0, LW, 349, 0, 0, 530, 330);
        return { forest, fields, parcels, road, fo, spp, mat };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx, LX = 80, LY = 290, LW = 560, LH = 590;
        // ---------------- relaxation model: S(u) after isolation at u = 0
        const S0 = 40, Sh = 22, rel = (u) => (u <= 0 ? S0 : Sh + (S0 - Sh) * Math.exp(-u / 0.28));
        // the fragment's own clock: isolation at tIso, then a playhead runs down the curve to "now"
        const tIso = S.b(0) + 6.7, NOW = 0.22, uAt = (tt) => NOW * ease.inOut((tt - tIso - 1.0) / 4.6);
        const u = uAt(t), dieU = (k) => (k >= Sh && k < S0 ? -0.28 * Math.log((k + 0.5 - Sh) / (S0 - Sh)) : Infinity);
        // ---------------- landscape (beats 0–1)
        const vL = S.p(0, 1) * (1 - S.p(1, 0.8, 7.9));
        if (vL > 0) g.withAlpha(vL, () => {
          label(g, 'Clearing a forest', LX, 262);
          g.with(() => {
            ctx.beginPath(); ctx.roundRect(LX, LY, LW, LH, 8); ctx.clip(); ctx.translate(LX, LY);
            ctx.drawImage(D.forest, 0, 0);
            ctx.save(); ctx.beginPath(); let any = false;
            const trans = [];
            for (const p of D.parcels) { if (p.kept) continue; const a = clamp((t - p.tc) / 0.5); if (a >= 1) { p.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); any = true; } else if (a > 0) trans.push([p, a]); }
            if (any) { ctx.clip(); ctx.drawImage(D.fields, 0, 0); }
            ctx.restore();
            for (const [p, a] of trans) { ctx.save(); pathOf(ctx, p.pts); ctx.clip(); ctx.globalAlpha *= a; ctx.drawImage(D.fields, 0, 0); ctx.restore(); }
            g.poly(D.road, { color: 'rgba(216,196,155,0.85)', w: 4, progress: S.p(0, 1.6, 1.0) });
            // focal fragment and its species
            const fa = S.p(0, 0.8, 7.0);
            g.poly(D.fo, { color: COL, w: 2.5, dash: [8, 6], close: true, alpha: fa });
            const doom = S.p(1, 0.8, 2.4);
            D.spp.forEach(([x, y], k) => {
              const du = dieU(k), col = g.SPECIES[k % 8];
              let td = Infinity; if (du <= NOW) { let lo = tIso, hi = tIso + 7; for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (uAt(m) < du) lo = m; else hi = m; } td = hi; }
              if (t < td) { g.dot(x, y, 4, col, 0.95, 2.2); if (du < Infinity && doom > 0) g.circle(x, y, 7.5, { stroke: PAL.coral, w: 1.8, dash: [3, 3], alpha: doom }); }
              else if (t < td + 1) { const q = t - td; g.circle(x, y, 5 + 12 * q, { stroke: PAL.coral, w: 2, alpha: 1 - q }); g.dot(x, y, 4, col, 1 - q, 1.8); }
            });
          });
          g.rect(LX, LY, LW, LH, { stroke: 'rgba(238,231,215,0.16)', w: 1.5, r: 8 });
          g.pill('agricultural matrix', LX + LW - 16, LY + LH - 30, { size: 21, color: PAL.sand, align: 'right', alpha: S.p(0, 0.8, 5.0), fill: 'rgba(11,22,24,0.72)' });
          const fx = LX + 75, fy = LY + 270, cnt = D.spp.filter((_, k) => dieU(k) > u).length;
          g.pill('fragment', fx, fy, { size: 21, color: COL, alpha: S.p(0, 0.8, 7.2), fill: 'rgba(11,22,24,0.78)' });
          g.pill('S = ' + cnt, fx + 112, fy, { size: 21, color: PAL.ink, alpha: S.p(0, 0.8, 7.6), fill: 'rgba(11,22,24,0.78)' });
          g.pill('ringed: doomed, still present', LX + 16, LY + 30, { size: 21, color: PAL.coral, alpha: S.p(1, 0.8, 2.8), fill: 'rgba(11,22,24,0.78)' });
        });
        // ---------------- Newmark: park area vs mammal losses (beat 1, second sentence)
        const vN = S.p(1, 0.9, 8.1) * (1 - S.p(2, 0.6));
        if (vN > 0) g.withAlpha(vN, () => {
          label(g, 'Western North American parks', LX, 262);
          const NX = 150, NY = 330, NW = 470, NH = 420, Xa = (a) => NX + (Math.log10(a) - 2) / 2.5 * NW, Yb = (v) => NY + NH - v / 8 * NH;
          g.axes({ x: NX, y: NY, w: NW, h: NH, progress: S.p(1, 0.8, 8.3) });
          [[100, '100'], [1000, '1,000'], [10000, '10,000']].forEach(([v, s]) => { g.line(Xa(v), NY + NH, Xa(v), NY + NH + 8, { color: PAL.ink2, w: 1.6 }); g.text(s, Xa(v), NY + NH + 32, { size: 20, color: PAL.ink3, align: 'center' }); });
          [2, 4, 6].forEach((v) => { g.line(NX - 8, Yb(v), NX, Yb(v), { color: PAL.ink2, w: 1.6 }); g.text(String(v), NX - 14, Yb(v) + 7, { size: 20, color: PAL.ink3, align: 'right' }); });
          g.text('park area (km², log scale)', NX + NW / 2, NY + NH + 70, { size: 22, color: PAL.ink2, align: 'center' });
          g.text('mammal species lost', NX + 14, NY - 2, { size: 22, color: PAL.ink2 });
          const parks = [[144, 6], [300, 7], [640, 4], [1000, 5], [2100, 3], [3400, 2], [10300, 1], [20700, 0]];
          parks.forEach(([a, v], k) => {
            const p = S.p(1, 0.7, 9.6 + k * 0.35), hi = k < 2 ? S.p(1, 0.6, 14.6) : 0;
            g.rect(Xa(a) - 11, Yb(v * p), 22, Math.max(0.01, (NY + NH - Yb(v)) * p), { fill: U.mix(PAL.coral, PAL.ochre, hi), r: 3, alpha: 0.85 });
            if (v === 0) g.text('0', Xa(a), NY + NH - 10, { size: 20, color: PAL.ink3, align: 'center', alpha: p });
          });
          g.text('smallest parks lost the most', Xa(144) + 64, Yb(7.2), { size: 22, weight: 600, color: PAL.ochre, alpha: S.p(1, 0.6, 14.6) });
          g.text('stylized after Newmark (1987)', NX + NW, NY + NH + 106, { size: 21, italic: true, color: PAL.ink3, align: 'right' });
        });
        // ---------------- richness of the fragment through time (beats 0–1)
        const vP = S.p(0, 1, 2.0) * (1 - S.p(2, 0.6));
        if (vP > 0) g.withAlpha(vP, () => {
          const PX = 790, PY = 330, PW = 470, PH = 420, U0 = -0.3, U1 = 1.1;
          const X = (uu) => PX + (uu - U0) / (U1 - U0) * PW, Y = (s) => PY + PH - s / 48 * PH, A = { X, Y };
          label(g, 'Species in the fragment', PX, 262);
          g.axes({ x: PX, y: PY, w: PW, h: PH });
          g.text('time', PX + PW, PY + PH + 36, { size: 22, color: PAL.ink2, align: 'right' });
          g.math('S', PX - 14, PY + 8, { size: 30, align: 'right' });
          [20, 40].forEach((v) => { g.line(PX - 8, Y(v), PX, Y(v), { color: PAL.ink2, w: 1.6 }); g.text(String(v), PX - 14, Y(v) + 7, { size: 20, color: PAL.ink3, align: 'right' }); });
          g.plot(A, () => S0, { from: U0, to: 0, color: PAL.moss, w: 4, progress: S.p(0, 1.2, 2.6) });
          g.text('continuous', X(U0) + 8, Y(S0) - 44, { size: 21, color: PAL.moss, alpha: S.p(0, 0.8, 3.0) }); g.text('forest', X(U0) + 8, Y(S0) - 18, { size: 21, color: PAL.moss, alpha: S.p(0, 0.8, 3.0) });
          const ia = S.p(0, 0.6, 6.5);
          g.line(X(0), PY, X(0), PY + PH, { color: PAL.sand, w: 1.5, dash: [4, 6], alpha: ia });
          g.text('isolated', X(0), PY + PH + 36, { size: 21, color: PAL.sand, align: 'center', alpha: ia });
          // new, lower equilibrium
          const ea = S.p(0, 0.8, 10.0);
          g.line(X(0), Y(Sh), X(U1), Y(Sh), { color: PAL.ink2, w: 2, dash: [8, 7], alpha: ea });
          g.math('\\hat{S}_{\\text{new}}', X(U1) + 4, Y(Sh) + 10, { size: 30, alpha: ea });
          // extinction debt (beat 1)
          const now = NOW, da = S.p(1, 0.9, 1.6);
          if (da > 0) {
            const reg = []; for (let k = 0; k <= 60; k++) { const uu = lerp(now, U1, k / 60); reg.push([X(uu), Y(rel(uu))]); }
            reg.push([X(U1), Y(Sh)], [X(now), Y(Sh)]);
            g.poly(reg, { fill: U.rgba(PAL.coral, 0.22), color: null, w: 0, close: true, alpha: da });
          }
          if (t > tIso) g.plot(A, rel, { from: 0, to: Math.max(0.001, u), color: PAL.moss, w: 4 });
          const pj = S.lin(0, 3.0, 10.6);
          if (pj > 0) g.plot(A, rel, { from: NOW, to: lerp(NOW, U1, pj), color: PAL.moss, w: 3, dash: [9, 7] });
          if (t > tIso + 0.6) g.dot(X(u), Y(rel(u)), 7, PAL.ink, 1, 3);
          g.text('projected', X(0.75), Y(rel(0.75)) + 34, { size: 21, color: PAL.moss, align: 'center', alpha: S.p(0, 0.8, 12.6) });
          const na = S.p(1, 0.7, 1.0);
          g.withAlpha(na, () => {
            g.line(X(now), PY + 20, X(now), PY + PH, { color: PAL.ink, w: 1.6 });
            g.text('now', X(now), PY + 10, { size: 21, weight: 600, color: PAL.ink, align: 'center' });
            g.line(X(now) - 10, Y(rel(now)), X(now) - 10, Y(Sh), { color: PAL.coral, w: 3 });
          });
          g.text('extinction debt', X(0.55), Y((rel(0.55) + Sh) / 2 + 6), { size: 22, weight: 600, color: PAL.coral, alpha: S.p(1, 0.8, 2.6) });
          // restore or reconnect: the debt need not be paid
          const ra = S.p(1, 1.2, 5.0);
          if (ra > 0) g.plot(A, (uu) => 34 + (rel(now) - 34) * Math.exp(-(uu - now) / 0.25), { from: now, to: lerp(now, U1, ra), color: PAL.mint, w: 3, dash: [9, 7] });
          g.text('restored / reconnected', X(U1), Y(36.5) - 10, { size: 21, color: PAL.mint, align: 'right', alpha: S.p(1, 0.8, 6.0) });
          // relaxation label (beat 0, last sentence)
          const la = S.p(0, 0.8, 15.4) * (1 - S.p(1, 0.6));
          g.withAlpha(la, () => {
            g.carrow(X(0.3) + 30, Y(40) + 10, X(0.36) + 4, Y(rel(0.36)) - 12, -0.3, { color: PAL.ochre, w: 2, head: 11 });
            g.text('relaxation', X(0.3) + 36, Y(42), { size: 23, weight: 600, color: PAL.ochre });
            g.text('(faunal collapse)', X(0.3) + 36, Y(42) + 27, { size: 21, color: PAL.ochre });
          });
        });
        // ---------------- SLOSS (beat 2)
        const v2 = S.p(2, 0.9);
        if (v2 > 0) g.withAlpha(v2, () => {
          const big = { x: 345, y: 455, r: 128 };
          const small = [[805, 378, 'wet', PAL.lagoon], [1110, 388, 'grass', PAL.sand], [905, 548, 'conifer', PAL.mint], [1135, 552, 'broadleaf', PAL.moss]];
          const pa = S.p(2, 0.8, 0.8), pb = S.p(2, 0.8, 4.4);
          const panel = (x, a, title) => g.withAlpha(a, () => {
            label(g, title, x, 262);
            g.with(() => { ctx.beginPath(); ctx.roundRect(x, 290, 530, 330, 8); ctx.clip(); ctx.globalAlpha *= 0.85; ctx.drawImage(D.mat, x, 290); });
            g.rect(x, 290, 530, 330, { stroke: 'rgba(238,231,215,0.16)', w: 1.5, r: 8 });
          });
          panel(80, pa, 'Single large'); panel(720, pb, 'Several small');
          const reserve = (x, y, rr, fill, a) => g.withAlpha(a, () => {
            g.with(() => { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.clip(); ctx.drawImage(D.forest, x - rr - 40, y - rr - 40); if (fill) { ctx.fillStyle = fill; ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); } });
            g.circle(x, y, rr, { stroke: 'rgba(216,196,155,0.8)', w: 2.2 });
          });
          reserve(big.x, big.y, big.r, null, pa);
          const sw = (k) => 0.5 + 0.5 * Math.sin(t * 1.3 + k);
          g.withAlpha(pa, () => {
            g.icon('wolf', big.x - 52, big.y - 30, 58, PAL.ochre, { flip: true });
            g.icon('lynx', big.x + 50, big.y + 34, 50, PAL.ochre);
            g.icon('deer', big.x - 40, big.y + 62, 46, PAL.sand);
            g.icon('deer', big.x + 62, big.y - 52, 40, PAL.sand, { flip: true });
            [[-90, 10], [10, -90], [88, -4], [-6, 20], [30, 96]].forEach(([dx, dy], k) => g.icon('songbird', big.x + dx, big.y + dy + 3 * Math.sin(t * 2 + k), 22, PAL.ink2, { flip: k % 2 === 1 }));
            g.math('A', big.x + big.r - 4, big.y - big.r + 14, { size: 34, color: PAL.ink });
          });
          // fire hits one small reserve: risk is spread
          const fire = S.p(2, 1.0, 15.2);
          small.forEach(([x, y, kind, c], k) => {
            const burnt = k === 1 ? fire : 0;
            reserve(x, y, big.r / 2, kind === 'wet' ? 'rgba(60,140,160,0.35)' : kind === 'grass' ? 'rgba(170,150,90,0.45)' : kind === 'conifer' ? 'rgba(10,40,25,0.35)' : null, pb);
            g.withAlpha(pb * (1 - 0.75 * burnt), () => {
              const ic = { wet: ['fish', 'plant'], grass: ['hare', 'butterfly'], conifer: ['conifer', 'songbird'], broadleaf: ['tree', 'bug'] }[kind];
              g.icon(ic[0], x - 18, y + 6, 36, c, { flip: k % 2 === 1 });
              g.icon(ic[1], x + 22, y - 12, 26, c, { flap: sw(k) });
            });
            if (burnt > 0) { g.circle(x, y, big.r / 2, { fill: 'rgba(40,30,28,0.7)', alpha: burnt * pb }); g.glow(x, y, 70, PAL.coral, 0.8 * burnt * (1 - S.p(2, 1.5, 17))); }
            g.math('A/4', x + big.r / 2 - 6, y - big.r / 2 + 10, { size: 24, color: PAL.ink2, alpha: pb });
          });
          g.withAlpha(S.p(2, 0.6, 15.8) * (1 - S.p(2, 0.6, 21.5)), () => { g.text('fire hits', 1110, 384, { size: 21, weight: 600, color: PAL.coral, align: 'center' }); g.text('one site', 1110, 410, { size: 21, weight: 600, color: PAL.coral, align: 'center' }); });
          g.math('=', 670, 470, { size: 56, color: PAL.ink2, align: 'center', alpha: pb });
          g.text('same', 670, 515, { size: 21, color: PAL.ink2, align: 'center', alpha: pb }); g.text('total area', 670, 541, { size: 21, color: PAL.ink2, align: 'center', alpha: pb });
          // pros
          const pros = (x, items, c, d0) => items.forEach((s, k) => { const p = S.p(2, 0.7, d0 + k * 1.3); g.text('+', x, 672 + k * 34, { size: 24, weight: 600, color: c, alpha: p }); g.text(s, x + 24, 672 + k * 34, { size: 22, color: PAL.ink, alpha: p }); });
          pros(90, ['area-sensitive, wide-ranging species', 'larger populations, lower extinction risk'], PAL.ochre, 9.0);
          pros(730, ['more habitat variety', 'risk spread across sites'], COL, 12.6);
          // metapopulation link
          const mp = S.p(2, 1.0, 22.4);
          if (mp > 0) {
            const off = -t * 18;
            [[0, 2], [0, 1], [2, 3], [1, 3]].forEach(([a, b]) => { const [x1, y1] = small[a], [x2, y2] = small[b], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, rr = big.r / 2 + 6; g.carrow(x1 + ux * rr, y1 + uy * rr, x2 - ux * rr, y2 - uy * rr, 0.18, { color: COL, w: 2.5, head: 12, dash: [7, 7], dashOffset: off, progress: mp }); });
          }
          // the answer depends on…
          ['nestedness', 'dispersal', 'threats'].forEach((s, k) => g.pill(s, 395 + k * 180, 790, { size: 22, color: PAL.ink, align: 'center', alpha: S.p(2, 0.6, 18.4 + k * 1.0) }));
          g.text('it depends on', 90, 798, { size: 22, color: PAL.ink2, alpha: S.p(2, 0.6, 18.0) });
          g.pill('→ metapopulation thinking (Chapter VI)', 1045, 858, { size: 22, color: COL, align: 'center', alpha: S.p(2, 0.8, 22.6) });
        });
      },
    },
  ],
});
})();
