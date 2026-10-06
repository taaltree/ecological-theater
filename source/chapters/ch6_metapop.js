/* Chapter VI — Metapopulations. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.mint;
const TAU = Math.PI * 2;

// Small shared helpers ---------------------------------------------------------
const label = (g, s, x, y, a = 1, col = PAL.ink3) => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a });
// visibility envelope: fade in at beat k0, fade out at beat k1 (optional)
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
// absolute-time envelope (scene-local seconds)
const win = (t, a, b, d = 0.6) => ease.out((t - a) / d) * (b === undefined ? 1 : 1 - ease.inOut((t - b) / d));
const MINT_LT = '#CFF5E4';
// Delay (s, from the start of beat k) of fraction f through sentence j of beat k: syncs reveals to the spoken words.
const sd = (S, k, j, f = 0) => { const b = S.scene.timing.beats[k]; const sn = b.sents[Math.min(j, b.sents.length - 1)]; return sn.start + f * (sn.end - sn.start) - b.start; };

// Irregular patch outline (closed, periodic wobble), as a Path2D in screen coordinates.
function blob(x, y, r, seed, wob = 0.09) {
  const R = rng(seed); const ph = [R() * TAU, R() * TAU, R() * TAU]; const p = new Path2D(); const n = 30;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * TAU; const rr = r * (1 + wob * (0.55 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.15 * Math.sin(5 * a + ph[2])));
    if (k === 0) p.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); else p.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  p.closePath(); return p;
}
// Seeded rejection scatter of n circular patches inside box.
function scatter(seed, n, box, rmin, rmax, gap) {
  const r = rng(seed); const P = []; let tries = 0;
  while (P.length < n && tries < 40000) {
    tries++; const rad = rmin + (rmax - rmin) * Math.pow(r(), 1.6);
    const x = box.x + rad + r() * (box.w - 2 * rad), y = box.y + rad + r() * (box.h - 2 * rad);
    if (P.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + rad + gap)) P.push({ x, y, r: rad });
  }
  return P;
}
// A patch network: positions, outlines, neighbour links, and a pre-rendered base layer.
function makeNet(seed, n, box, rmin, rmax, gap) {
  const P = scatter(seed, n, box, rmin, rmax, gap);
  P.forEach((p, i) => { p.path = blob(p.x, p.y, p.r, seed * 100 + i); p.nInd = 2 + Math.round(p.r / 9); p.ph = i * 7.31; });
  const links = [];
  P.forEach((p, i) => {
    const near = P.map((q, j) => [j, Math.hypot(q.x - p.x, q.y - p.y) - q.r - p.r]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
    near.forEach(([j, d]) => { if (d < 120 && !links.some(([a, b]) => (a === j && b === i))) links.push([i, j]); });
  });
  const pad = 40, bw = box.w + 2 * pad, bh = box.h + 2 * pad;
  const base = Theater.makeCanvas(bw, bh); const c = base.getContext('2d');
  c.translate(pad - box.x, pad - box.y);
  c.strokeStyle = 'rgba(238,231,215,0.075)'; c.lineWidth = 1.4; c.setLineDash([3, 6]); c.beginPath();
  for (const [i, j] of links) { const a = P[i], b = P[j]; c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke(); c.setLineDash([]);
  for (const p of P) { c.fillStyle = 'rgba(16,32,31,0.92)'; c.fill(p.path); c.strokeStyle = 'rgba(174,184,177,0.5)'; c.lineWidth = 1.6; c.stroke(p.path); }
  return { P, links, base, bx: box.x - pad, by: box.y - pad, cx: box.x + box.w / 2, cy: box.y + box.h / 2, box };
}
// Patch state at time t from a toggle list: [occupied?, seconds since last change].
function pstate(sim, i, t) {
  const tg = sim.tog[i]; let on = sim.init[i], last = -1e9;
  for (let k = 0; k < tg.length && tg[k] <= t; k++) { on = !on; last = tg[k]; }
  return [on, t - last];
}
function countAt(sim, t) { let n = 0; for (let i = 0; i < sim.init.length; i++) if (pstate(sim, i, t)[0]) n++; return n; }
// Choose a colonist source among occupied patches, weighted toward near ones.
function pickSource(r, net, sim, j, t, L = 230) {
  const P = net.P; let tot = 0; const w = [];
  for (let i = 0; i < P.length; i++) {
    if (i === j || !pstate(sim, i, t - 1e-6)[0]) { w.push(0); continue; }
    const v = Math.exp(-Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) / L); w.push(v); tot += v;
  }
  if (tot <= 0) return -1; let u = r() * tot;
  for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0 && w[i] > 0) return i; }
  return w.findIndex((v) => v > 0);
}
// Gillespie simulation of the (spatially implicit) Levins model on N patches.
function levinsSim(seed, N, c, e, n0, t0, T) {
  const r = rng(seed); const occ = new Array(N).fill(false); const tog = Array.from({ length: N }, () => []); const ev = [];
  let k = 0; while (k < n0) { const i = Math.floor(r() * N); if (!occ[i]) { occ[i] = true; k++; } }
  const init = occ.slice(); let t = t0;
  for (;;) {
    let n = 0; for (const o of occ) if (o) n++;
    const R = e * n + c * (n / N) * (N - n); if (R <= 0) break;
    t += -Math.log(1 - r()) / R; if (t > T) break;
    if (r() * R < e * n) { const on = []; occ.forEach((o, i) => o && on.push(i)); const i = on[Math.floor(r() * on.length)]; occ[i] = false; tog[i].push(t); ev.push({ t, k: 'x', i }); }
    else { const off = []; occ.forEach((o, i) => !o && off.push(i)); const j = off[Math.floor(r() * off.length)]; occ[j] = true; tog[j].push(t); ev.push({ t, k: 'c', i: j }); }
  }
  return { init, tog, ev };
}
// Assign colonist sources after the fact (needs the network geometry).
function assignSources(seed, net, sim) { const r = rng(seed); for (const v of sim.ev) if (v.k === 'c') v.src = pickSource(r, net, sim, v.i, v.t); }
// First event index with time >= t (events sorted).
function lowerBound(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }

// Choreographed patch dynamics: random turnover at per-patch rate `turn`, plus a restoring pull (kappa)
// toward a target count (an equilibrium or a deterministic trajectory). dSched: [[time, patch], ...] destructions.
function ctrlSim(seed, net, o) {
  const r = rng(seed); const N = net.P.length; const occ = o.init.slice(); const dest = new Array(N).fill(false);
  const tog = Array.from({ length: N }, () => []); const ev = []; const dAt = new Array(N).fill(Infinity);
  const sim = { init: o.init.slice(), tog, ev, dAt }; const dt = 0.02; let di = 0; const ds = o.dSched || [];
  for (let t = o.t0; t < o.t1; t += dt) {
    while (di < ds.length && ds[di][0] <= t) { const [td, i] = ds[di++]; dest[i] = true; dAt[i] = td; if (occ[i]) { occ[i] = false; tog[i].push(td); } }
    let n = 0; const empty = []; for (let i = 0; i < N; i++) { if (occ[i]) n++; else if (!dest[i]) empty.push(i); }
    const T = o.target(t, n, sim); const k = T === null ? 0 : o.kappa;
    const Tn = T === null ? n : T;
    const rx = o.turn * n + k * Math.max(0, n - Tn), rc = n > 0 && empty.length ? o.turn * Math.min(n, Tn) + k * Math.max(0, Tn - n) : 0;
    if (n > 0 && r() < rx * dt) { const on = []; occ.forEach((v, i) => v && on.push(i)); const i = on[Math.floor(r() * on.length)]; occ[i] = false; tog[i].push(t); ev.push({ t, k: 'x', i }); }
    if (rc > 0 && r() < rc * dt) { const j = empty[Math.floor(r() * empty.length)]; const src = pickSource(r, net, sim, j, t); occ[j] = true; tog[j].push(t); ev.push({ t, k: 'c', i: j, src }); }
  }
  return sim;
}

const FLY = 1.0; // seconds a colonist is in flight
// Draw the network at time t: base layer, occupied patches, individuals, and colonization/extinction events.
function drawNet(g, t, net, sim, o = {}) {
  const ctx = g.ctx; const A = o.alpha ?? 1; if (A <= 0) return;
  const P = net.P; const R = o.reveal ?? 1e9; const dAt = sim.dAt;
  ctx.save(); ctx.globalAlpha *= A;
  if (R < 1e8) { ctx.beginPath(); ctx.arc(net.cx, net.cy, Math.max(0.1, R), 0, TAU); ctx.clip(); }
  if (o.base !== false) ctx.drawImage(net.base, net.bx, net.by);
  const dots = []; const a0 = ctx.globalAlpha;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (dAt && t >= dAt[i]) {
      const u = clamp((t - dAt[i]) / 0.5);
      ctx.globalAlpha = a0 * u; ctx.fillStyle = '#26302F'; ctx.fill(p.path);
      ctx.globalAlpha = a0 * 0.75 * u; ctx.strokeStyle = PAL.ink3; ctx.lineWidth = 1.5; ctx.stroke(p.path);
      const s = p.r * 0.42; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s); ctx.stroke();
      if (t - dAt[i] < 0.8) { const v = (t - dAt[i]) / 0.8; ctx.globalAlpha = a0 * (1 - v) * 0.9; ctx.strokeStyle = PAL.coral; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4 + 18 * v, 0, TAU); ctx.stroke(); }
      continue;
    }
    const [on, dt] = pstate(sim, i, t);
    const inten = on ? ease.out(dt / 0.4) : 1 - ease.inOut(dt / 0.8);
    if (inten > 0.003) {
      const sh = 0.82 + 0.18 * U.noise1(t * 0.9 + p.ph, 3);
      const col = on ? COL : U.mix(PAL.coral, COL, inten);
      const ia = o.indAlpha ?? 1;
      ctx.globalAlpha = a0 * inten * lerp(0.5, 0.34 * sh, ia); ctx.fillStyle = col; ctx.fill(p.path);
      ctx.globalAlpha = a0 * inten; ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke(p.path);
      g.glow(p.x, p.y, p.r * 2.3, col, 0.22 * inten * sh);
      if (inten > 0.35 && ia > 0.01) for (let k = 0; k < p.nInd; k++) {
        const ang = p.ph + k * 2.4 + 0.5 * U.noise1(t * 0.35 + k * 3.1 + p.ph, 11);
        const rad = p.r * (0.2 + 0.42 * (0.5 + 0.5 * U.noise1(t * 0.4 + k * 5.7 + p.ph, 17)));
        dots.push(p.x + rad * Math.cos(ang), p.y + rad * Math.sin(ang));
      }
    } else if (o.hiEmpty > 0) {
      // unoccupied but suitable: ochre dashed ring
      const pulse = 0.65 + 0.35 * Math.sin(t * 3 + p.ph);
      ctx.globalAlpha = a0 * o.hiEmpty * pulse; ctx.strokeStyle = PAL.ochre; ctx.lineWidth = 2.4; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (dots.length) { ctx.globalAlpha = a0 * 0.95 * (o.indAlpha ?? 1); ctx.fillStyle = MINT_LT; ctx.beginPath(); for (let k = 0; k < dots.length; k += 2) { ctx.moveTo(dots[k] + 2.6, dots[k + 1]); ctx.arc(dots[k], dots[k + 1], 2.6, 0, TAU); } ctx.fill(); }
  ctx.globalAlpha = a0;
  // events
  const evA = o.evAlpha ?? 1;
  if (evA > 0) {
    const ev = sim.ev; let k = lowerBound(ev, t - 1.0);
    for (; k < ev.length && ev[k].t <= t + FLY; k++) {
      const v = ev[k]; const p = P[v.i];
      if (v.k === 'c' && v.src >= 0) {
        const s = P[v.src];
        if (t < v.t) { // in flight
          const u = 1 - (v.t - t) / FLY; const mx = (s.x + p.x) / 2, my = (s.y + p.y) / 2, dx = p.x - s.x, dy = p.y - s.y;
          const cx = mx - dy * 0.22, cy = my + dx * 0.22; const pts = []; const u0 = Math.max(0, u - 0.45);
          for (let q = 0; q <= 10; q++) { const w = lerp(u0, u, q / 10); pts.push([(1 - w) * (1 - w) * s.x + 2 * (1 - w) * w * cx + w * w * p.x, (1 - w) * (1 - w) * s.y + 2 * (1 - w) * w * cy + w * w * p.y]); }
          g.poly(pts, { color: PAL.lagoon, w: 2.2, alpha: 0.55 * evA * (o.colBoost ?? 1) });
          const tip = pts[pts.length - 1]; g.dot(tip[0], tip[1], 3.6, MINT_LT, evA, 3.2);
        } else if (t - v.t < 0.7) { const u = (t - v.t) / 0.7; g.circle(p.x, p.y, p.r + 3 + 16 * u, { stroke: COL, w: 2.5, alpha: (1 - u) * 0.9 * evA }); }
      } else if (v.k === 'x' && t >= v.t && t - v.t < 0.9) {
        const u = (t - v.t) / 0.9; g.circle(p.x, p.y, p.r + 3 + 20 * u, { stroke: PAL.coral, w: 3, alpha: (1 - u) * 0.95 * evA * (o.extBoost ?? 1) });
      }
    }
  }
  ctx.restore();
}

// Hanski map box, and a stylised Glanville fritillary (orange wings, dark chequered veins, hindwing spot row).
const HMAP = { x: 96, y: 236, w: 690, h: 660 };
function fritillary(g, x, y, s, flap, alpha = 1) {
  if (alpha <= 0) return; const ctx = g.ctx; ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= alpha; ctx.scale(s / 100, s / 100);
  const wing = (sx, fore) => {
    ctx.save(); ctx.scale(sx * lerp(0.25, 1, flap), 1);
    const rx = fore ? 30 : 22, ry = fore ? 21 : 18, cx = fore ? 24 : 19, cy = fore ? -15 : 15, rot = fore ? -0.45 : 0.4;
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fillStyle = '#D9822B'; ctx.fill(); ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(28,16,8,0.9)'; ctx.lineWidth = 2.4;
    for (let q = 1; q <= 3; q++) { ctx.beginPath(); ctx.ellipse(-rx * 0.6, 0, rx * 0.5 * q, ry * 0.42 * q, 0, 0, TAU); ctx.stroke(); }
    for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(rx, q * ry * 0.5); ctx.stroke(); }
    if (!fore) { ctx.fillStyle = '#1C1008'; for (let q = -1; q <= 1; q++) { ctx.beginPath(); ctx.arc(rx * 0.35, q * ry * 0.45, 2.6, 0, TAU); ctx.fill(); } }
    ctx.restore(); ctx.strokeStyle = '#1C1008'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  };
  wing(1, false); wing(-1, false); wing(1, true); wing(-1, true);
  ctx.fillStyle = '#2A1C12'; ctx.beginPath(); ctx.ellipse(0, 2, 4.5, 24, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2A1C12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -20); ctx.quadraticCurveTo(-8, -34, -13, -38); ctx.moveTo(2, -20); ctx.quadraticCurveTo(8, -34, 13, -38); ctx.stroke();
  ctx.restore();
}

// Network box shared by the first two scenes (continuity of the landscape).
const NETBOX = { x: 110, y: 300, w: 640, h: 580 };

Theater.chapter({
  id: 'meta', roman: 'VI', title: 'Metapopulations', color: COL,
  question: 'How does a species persist when every local population winks out?',
  intro: { t: 'Chapter six. Metapopulations: persistence across a network of habitat patches.' },
  motif(g, t) {
    const pts = [[1180, 250, 22], [1270, 170, 14], [1330, 290, 18], [1420, 210, 26], [1520, 300, 15], [1560, 160, 20], [1660, 240, 24], [1740, 150, 12], [1720, 330, 14]];
    const ed = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [6, 7], [6, 8]];
    const p = ease.inOut((t - 0.6) / 2.5);
    ed.forEach(([a, b], k) => g.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], { color: COL, w: 1.4, alpha: 0.18 * p, dash: [3, 6] }));
    pts.forEach(([x, y, r], k) => {
      const on = Math.sin(t * 0.9 + k * 2.1) > -0.2;
      g.circle(x, y, r, { stroke: COL, w: 2, alpha: 0.32 * p, fill: on ? U.rgba(COL, 0.16) : null });
    });
    [[0, 2], [3, 4], [5, 6]].forEach(([a, b], k) => { const u = (t * 0.35 + k * 0.37) % 1; g.dot(lerp(pts[a][0], pts[b][0], u), lerp(pts[a][1], pts[b][1], u), 2.6, COL, 0.4 * p * Math.sin(Math.PI * u), 2.4); });
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'meta-levins', title: 'The Levins model',
      beats: [
        { t: 'A metapopulation is a population of populations: a set of local populations in discrete habitat patches, connected by dispersal, each with its own chance of going extinct. Richard Levins coined the term in 1969, while thinking about the control of agricultural pests.',
          s: 'A metapopulation is a population of populations: a set of local populations in discrete habitat patches, connected by dispersal, each with its own chance of going extinct. Richard Levvins coined the term in 1969, while thinking about the control of agricultural pests.' },
        { t: 'Levins tracked not individuals but the fraction of patches occupied, p. Empty patches are colonized at rate c·p·(1 − p), and occupied patches go extinct at rate e·p. So dp/dt = cp(1 − p) − ep.',
          s: 'Levvins tracked not individuals but the fraction of patches occupied, p. Empty patches are colonized at rate c times p times one minus p, and occupied patches go extinct at rate e times p. So d p d t equals c p times one minus p, minus e p.' },
        { t: 'This has the same form as the logistic equation, and occupancy settles at an equilibrium, p* = 1 − e/c.',
          s: 'This has the same form as the logistic equation, and occupancy settles at an equilibrium: p star equals one minus e over c.', pause: 0.8 },
        { t: 'The deep insight: a metapopulation can persist indefinitely even though every local population eventually blinks out, provided colonization outpaces extinction, that is, provided c > e. Persistence is a property of the network, not of any single patch.',
          s: 'The deep insight: a metapopulation can persist indefinitely even though every local population eventually blinks out, provided colonization outpaces extinction, that is, provided c is greater than e. Persistence is a property of the network, not of any single patch.', pause: 1 },
      ],
      terms: [
        { beat: 0.3, term: 'Metapopulation', def: 'A set of local populations in discrete patches linked by dispersal, with local extinction and recolonization.' },
        { beat: 1.25, term: 'Patch occupancy (p)', def: 'Fraction of habitat patches occupied; the state variable of the Levins model.' },
        { beat: 2.4, term: 'Equilibrium occupancy (p*)', def: 'p* = 1 − e/c in the Levins model; the metapopulation persists only if c > e.' },
      ],
      init(S) {
        const N = 40, c = 0.1875, e = 0.075, n0 = 4, t0 = 1.2;
        const net = makeNet(7, N, NETBOX, 13, 33, 30);
        const sim = levinsSim(202, N, c, e, n0, t0, S.dur + 2); assignSources(9, net, sim);
        // occupancy series
        const series = []; for (let t = 0; t <= S.dur + 0.01; t += 0.2) series.push([t, countAt(sim, t) / N]);
        const ps = 1 - e / c, r = c - e, p0 = n0 / N;
        const det = (t) => (t < t0 ? p0 : ps / (1 + (ps / p0 - 1) * Math.exp(-r * (t - t0))));
        // raster: one row per patch, ordered by first occupation
        const first = sim.init.map((o, i) => (o ? 0 : (sim.tog[i][0] ?? 1e9)));
        const order = first.map((f, i) => i);
        const RW = 900, RH = N * 12; const ras = Theater.makeCanvas(RW, RH); const rc = ras.getContext('2d');
        const X = (t) => (t / S.dur) * RW;
        order.forEach((i, row) => {
          rc.fillStyle = 'rgba(238,231,215,0.06)'; rc.fillRect(0, row * 12 + 3, RW, 6);
          let on = sim.init[i], last = 0;
          for (const tt of [...sim.tog[i], S.dur + 5]) {
            if (on) { rc.fillStyle = COL; rc.fillRect(X(last), row * 12 + 2, X(tt) - X(last), 8); if (tt < S.dur) { rc.fillStyle = PAL.coral; rc.fillRect(X(tt) - 1, row * 12, 4.5, 12); } }
            on = !on; last = tt;
          }
        });
        // a featured local extinction for beat 3
        const bx = S.b(3) + 3.5; const feat = sim.ev.find((v) => v.k === 'x' && v.t > bx && v.t < bx + 6 && net.P[v.i].x > 220 && net.P[v.i].x < 640 && net.P[v.i].y > 380 && net.P[v.i].y < 820) || sim.ev.find((v) => v.k === 'x' && v.t > bx);
        return { N, c, e, net, sim, series, det, ps, ras, feat };
      },
      draw(g, t, S, D) {
        const { net, sim, N } = D; const ctx = g.ctx;
        // ---------------- landscape (all beats)
        const rv = 30 + 760 * ease.inOut(S.lin(0, 2.2, 0.0));
        label(g, 'Habitat patches in a landscape', 110, 262, S.p(0, 0.8, 0.2));
        const ind = 1 - S.p(1, 1.4, sd(S, 1, 0, 0.15));
        drawNet(g, t, net, sim, { reveal: rv, indAlpha: ind, extBoost: 1 + 0.6 * win(t, S.b(1) + sd(S, 1, 1, 0.6), S.b(1) + sd(S, 1, 2)), colBoost: 1 + 0.8 * win(t, S.b(1) + sd(S, 1, 1, 0.1), S.b(1) + sd(S, 1, 1, 0.6)) });
        const n = countAt(sim, t);
        // legend for the binary state variable (beat 1 on)
        const lgA = S.p(1, 0.8, sd(S, 1, 0, 0.55));
        if (lgA > 0) { g.circle(NETBOX.x + 452, 255, 9, { fill: U.rgba(COL, 0.5), stroke: COL, w: 2, alpha: lgA }); g.text('occupied', NETBOX.x + 468, 262, { size: 21, color: PAL.ink2, alpha: lgA }); g.circle(NETBOX.x + 576, 255, 9, { fill: '#10201F', stroke: PAL.ink2, w: 1.6, alpha: lgA }); g.text('empty', NETBOX.x + 592, 262, { size: 21, color: PAL.ink2, alpha: lgA }); }
        // featured local extinction (beat 3)
        if (D.feat) {
          const f = D.feat, p = net.P[f.i]; const a = win(t, f.t - 0.6, f.t + 4.5, 0.5) * S.p(3, 0.5);
          const lx = p.x + (p.x < 430 ? 1 : -1) * (p.r + 40), ly = p.y - p.r - 34;
          g.line(p.x + (p.x < 430 ? 1 : -1) * p.r * 0.75, p.y - p.r * 0.75, lx, ly, { color: PAL.coral, w: 1.5, alpha: a });
          g.pill('local extinction', lx, ly, { size: 21, color: PAL.coral, align: p.x < 430 ? 'left' : 'right', alpha: a, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.coral, 0.6) });
        }
        // the network persists (end of beat 3)
        const na = S.p(3, 1.0, sd(S, 3, 1, 0.05));
        if (na > 0) {
          g.rect(NETBOX.x - 16, NETBOX.y - 16, NETBOX.w + 32, NETBOX.h + 32, { stroke: COL, w: 2, r: 18, dash: [10, 8], alpha: na * 0.75 });
          g.pill('persistence is a property of the network', NETBOX.x + NETBOX.w + 16, NETBOX.y + NETBOX.h + 16, { size: 21, color: COL, align: 'right', alpha: na, fill: 'rgba(11,22,24,0.94)', stroke: U.rgba(COL, 0.7) });
        }

        // ---------------- right panel, beat 0: anatomy of a metapopulation
        const RX = 840;
        const v0 = vis(S, 0, 1);
        g.withAlpha(v0, () => {
          label(g, 'A population of populations', RX, 262, S.p(0, 0.8, 0.4));
          // row 1: local population in a patch
          const a1 = S.p(0, 0.8, sd(S, 0, 0, 0.35));
          g.withAlpha(a1, () => {
            const x = 885, y = 372, r = 44;
            g.glow(x, y, r * 2.2, COL, 0.25);
            g.circle(x, y, r, { fill: U.rgba(COL, 0.3), stroke: COL, w: 2.4 });
            for (let k = 0; k < 9; k++) { const ang = k * 2.4 + 0.6 * U.noise1(t * 0.4 + k * 3, 5); const rr = r * (0.2 + 0.55 * (0.5 + 0.5 * U.noise1(t * 0.5 + k * 7, 9))); g.circle(x + rr * Math.cos(ang), y + rr * Math.sin(ang), 3.4, { fill: MINT_LT }); }
            g.text('local population', 960, 366, { size: 27, color: PAL.ink });
          });
          g.text('in a discrete habitat patch', 960, 400, { size: 22, color: PAL.ink2, alpha: S.p(0, 0.8, sd(S, 0, 0, 0.47)) });
          // row 2: dispersal
          const a2 = S.p(0, 0.8, sd(S, 0, 0, 0.58));
          g.withAlpha(a2, () => {
            const y = 512, xa = 852, xb = 922;
            g.circle(xa, y, 19, { fill: U.rgba(COL, 0.3), stroke: COL, w: 2 }); g.circle(xb, y, 19, { fill: U.rgba(COL, 0.3), stroke: COL, w: 2 });
            g.carrow(xa + 8, y - 20, xb - 8, y - 20, -0.45, { color: PAL.lagoon, w: 2, head: 10 });
            g.carrow(xb - 8, y + 20, xa + 8, y + 20, -0.45, { color: PAL.lagoon, w: 2, head: 10 });
            const u = (t * 0.6) % 1; const w = u; const cx = (xa + xb) / 2, cy = y - 20 - 31;
            const px = (1 - w) * (1 - w) * (xa + 8) + 2 * (1 - w) * w * cx + w * w * (xb - 8), py = (1 - w) * (1 - w) * (y - 20) + 2 * (1 - w) * w * cy + w * w * (y - 20);
            g.dot(px, py, 3.4, MINT_LT, Math.sin(Math.PI * u), 3);
            g.text('linked by dispersal', 960, 506, { size: 27, color: PAL.ink });
            g.text('colonists move between patches', 960, 540, { size: 22, color: PAL.ink2 });
          });
          // row 3: local extinction (looping glyph)
          const a3 = S.p(0, 0.8, sd(S, 0, 0, 0.69));
          g.withAlpha(a3, () => {
            const x = 885, y = 648, r = 32; const ph = ((t - S.b(0) - sd(S, 0, 0, 0.69)) % 4.2 + 4.2) % 4.2;
            const on = ph < 1.6 || ph > 3.6; const f = ph < 1.6 ? 1 : ph < 2.4 ? 1 - (ph - 1.6) / 0.8 : ph > 3.6 ? (ph - 3.6) / 0.6 : 0;
            g.circle(x, y, r, { fill: '#10201F', stroke: PAL.ink3, w: 1.6 });
            g.circle(x, y, r, { fill: U.rgba(COL, 0.3 * f), stroke: COL, w: 2.2, alpha: f });
            if (ph >= 1.6 && ph < 2.6) { const u = (ph - 1.6); g.circle(x, y, r + 4 + 18 * u, { stroke: PAL.coral, w: 3, alpha: 1 - u }); }
            if (on) for (let k = 0; k < 5; k++) g.circle(x + 14 * Math.cos(k * 2.5 + t * 0.3), y + 12 * Math.sin(k * 2.5 + t * 0.4), 3, { fill: MINT_LT, alpha: f });
            g.text('local extinction', 960, 642, { size: 27, color: PAL.ink });
            g.text('each patch can lose its population', 960, 676, { size: 22, color: PAL.ink2 });
          });
          // Levins 1969: pests across a mosaic of fields
          const a4 = S.p(0, 0.9, sd(S, 0, 1, 0.02));
          g.withAlpha(a4, () => {
            g.line(RX, 724, 1290, 724, { color: PAL.rule, w: 1 });
            g.text('Richard Levins, 1969', RX, 772, { size: 30, role: 'display', color: PAL.ink });
            g.text('agricultural pest control', RX, 804, { size: 22, color: PAL.ink2, alpha: S.p(0, 0.8, sd(S, 0, 1, 0.72)) });
            const fields = [[1124, 772], [1190, 772], [1256, 772], [1124, 838], [1190, 838], [1256, 838]];
            fields.forEach(([fx, fy], k) => {
              g.rect(fx - 29, fy - 29, 58, 58, { fill: U.rgba(PAL.moss, 0.1), stroke: U.rgba(PAL.moss, 0.55), w: 1.5, r: 3 });
              for (let s = 0; s < 4; s++) g.line(fx - 22, fy - 17 + s * 11.5, fx + 22, fy - 17 + s * 11.5, { color: PAL.moss, w: 1.4, alpha: 0.35 });
              const inf = Math.sin(t * 0.7 + k * 2.3) > 0.0;
              g.icon('bug', fx + 5 * Math.sin(t + k), fy + 3, 30, PAL.ochre, { alpha: S.p(0, 0.8, sd(S, 0, 1, 0.75)) * (inf ? 1 : 0.0) });
            });
          });
        });

        // ---------------- right panel, beats 1–3
        const A1 = vis(S, 1, 2);
        g.withAlpha(A1, () => {
          label(g, 'The Levins model', RX, 262, S.p(1, 0.8));
          g.text('fraction of patches occupied', RX, 318, { size: 22, color: PAL.ink2, alpha: S.p(1, 0.8, sd(S, 1, 0, 0.3)) });
          const am = S.p(1, 0.8, sd(S, 1, 0, 0.7));
          g.math(`p = \\frac{${n}}{${N}} = ${(n / N).toFixed(2)}`, RX, 392, { size: 42, alpha: am });
          // meter: one cell per patch, occupied cells packed left
          const cw = 450 / N;
          for (let k = 0; k < N; k++) g.rect(RX + k * cw, 426, cw - 2.5, 22, { fill: k < n ? COL : null, stroke: k < n ? null : PAL.ink3, w: 1, alpha: am * (k < n ? 0.9 : 0.6), r: 1.5 });
          // term annotations
          const rows = [['c', 'colonization rate', COL, 6.8], ['1 − p', 'fraction of patches empty', COL, 8.4], ['e', 'extinction rate per patch', PAL.coral, 10.6]];
          rows.forEach(([m, s, col, d], k) => {
            const a = S.p(1, 0.8, d); const y = 728 + k * 46;
            g.math(m, RX + 70, y, { size: 32, color: col, align: 'right', alpha: a });
            g.text(s, RX + 96, y - 2, { size: 22, color: PAL.ink2, alpha: a });
          });
        });
        // the equation: assembled in beat 1, moves up in beat 2, recedes in beat 3
        const mv = S.p(2, 1.1);
        const ey = lerp(570, 336, mv), es = lerp(50, 42, mv);
        const eA = S.p(1, 0.6, sd(S, 1, 1, 0.12)) * (1 - S.p(3, 0.6));
        if (eA > 0) {
          const L = '\\frac{dp}{dt} = ', M1 = 'cp(1 − p)', M2 = '{}− ep';
          const wL = g.mathW(L, es), w1 = g.mathW(M1, es), w2 = g.mathW(M2, es);
          const x0 = RX; const x1 = x0 + wL, x2 = x1 + w1;
          g.math(L, x0, ey, { size: es, alpha: eA * S.p(1, 0.8, sd(S, 1, 2, 0.05)) });
          g.math(M1, x1, ey, { size: es, color: COL, alpha: eA * S.p(1, 0.8, sd(S, 1, 1, 0.14)) });
          g.math(M2, x2, ey, { size: es, color: PAL.coral, alpha: eA * S.p(1, 0.8, sd(S, 1, 1, 0.62)) });
          const bA = (1 - mv);
          const brace = (xa, xb, y, col, txt, a) => {
            g.poly([[xa + 4, y - 8], [xa + 4, y], [xb - 4, y], [xb - 4, y - 8]], { color: col, w: 2, alpha: a });
            g.text(txt, (xa + xb) / 2, y + 32, { size: 22, color: col, align: 'center', alpha: a, weight: 500 });
          };
          brace(x1, x2, ey + 34, COL, 'colonization', eA * bA * S.p(1, 0.8, sd(S, 1, 1, 0.28)));
          brace(x2 + es * 0.4, x2 + w2, ey + 34, PAL.coral, 'extinction', eA * bA * S.p(1, 0.8, sd(S, 1, 1, 0.72)));
        }
        // beat 2: logistic form + p(t)
        const A2 = vis(S, 2, 3);
        g.withAlpha(A2, () => {
          label(g, 'Same form as the logistic', RX, 262, S.p(2, 0.8));
          const a = S.p(2, 0.9, sd(S, 2, 0, 0.12));
          const s1 = '= (c − e)\\,p(1 − \\frac{p}{1 − e/c})';
          g.math(s1, RX + 52, 420, { size: 38, alpha: a });
          const a2 = S.p(2, 0.8, sd(S, 2, 0, 0.36));
          const w0 = g.text('logistic, with', RX + 52, 478, { size: 22, color: PAL.ink2, alpha: a2 });
          g.math('r = c − e,\\quad K = 1 − e/c', RX + 52 + w0 + 14, 480, { size: 30, color: PAL.ochre, alpha: a2 });
        });
        // p(t) plot: beats 2–3 (geometry tightens in beat 3)
        const PA = S.p(2, 0.9, sd(S, 2, 0, 0.08));
        if (PA > 0) {
          const sq = S.p(3, 1.2);
          const py = lerp(530, 312, sq), ph = lerp(300, 150, sq);
          const A = g.axes({ x: RX + 30, y: py, w: 420, h: ph, xmin: 0, xmax: S.dur, ymin: 0, ymax: 1.12, xlab: 't', ylab: 'p', progress: PA, yticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }] });
          // trace: history replays quickly, then runs live
          const tr = Math.min(t, lerp(1.2, t, ease.inOut(S.lin(2, 2.6, sd(S, 2, 0, 0.14)))));
          const pts = []; for (const [tt, pv] of D.series) { if (tt > tr) break; pts.push([A.X(tt), A.Y(pv)]); }
          g.withAlpha(PA, () => {
            g.plot(A, D.det, { from: 0, to: S.dur, color: PAL.ink3, w: 1.6, progress: S.p(2, 1.6, sd(S, 2, 0, 0.5)), alpha: 0.8 });
            if (pts.length > 1) { g.poly(pts, { color: COL, w: 3 }); const q = pts[pts.length - 1]; g.dot(q[0], q[1], 5, COL, 1, 3); }
            const la = S.p(2, 0.8, sd(S, 2, 0, 0.7));
            g.line(A.X(0), A.Y(D.ps), A.X(S.dur), A.Y(D.ps), { color: PAL.ink, w: 2, dash: [8, 7], alpha: la });
            g.math('p^{*} = 1 − e/c', A.X(S.dur), A.Y(D.ps) - 16, { size: 30, align: 'right', alpha: la * (1 - sq) });
            g.math('p^{*}', A.X(S.dur) + 12, A.Y(D.ps) + 9, { size: 26, alpha: la * sq });
          });
          // beat 3: occupancy raster, one row per patch
          const ra = S.p(3, 0.9, sd(S, 3, 0, 0.1));
          if (ra > 0) {
            const ry = 540, rh = 240; const wx = A.X(Math.min(t, S.dur)) - A.X(0);
            g.withAlpha(ra, () => {
              label(g, 'Every patch, through time', RX, 262 + 0 * ra);
              g.clip(A.X(0), ry, wx, rh, () => ctx.drawImage(D.ras, A.X(0), ry, A.w, rh));
              g.line(A.X(0) + wx, ry - 6, A.X(0) + wx, ry + rh + 6, { color: PAL.ink2, w: 1.2, alpha: 0.6 });
              g.text('40 patches', A.X(0) - 12, ry + rh / 2 + 8, { size: 21, color: PAL.ink3, align: 'right', alpha: 0 });
              g.text('each row is one patch: every one blinks out', A.X(0), ry + rh + 34, { size: 21, color: PAL.ink2, alpha: S.p(3, 0.8, sd(S, 3, 0, 0.3)) });
            });
            const ca = S.p(3, 0.8, sd(S, 3, 0, 0.8));
            g.math('p^{*} > 0 \\text{ only if } c > e', RX + 30, 872, { size: 38, color: PAL.ink, alpha: ca });
          }
        }
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'meta-threshold', title: 'Habitat loss & the extinction threshold',
      beats: [
        { t: 'Now destroy a fraction D of the patches. Equilibrium occupancy becomes p* = 1 − D − e/c. Occupancy falls one-for-one with habitat destroyed.',
          s: 'Now destroy a fraction D of the patches. Equilibrium occupancy becomes p star equals one minus D minus e over c. Occupancy falls one for one with habitat destroyed.', pause: 0.5 },
        { t: 'The metapopulation goes extinct when D reaches 1 − e/c, while suitable habitat still remains. This is the extinction threshold: a species can disappear from a landscape that still contains empty, suitable patches.',
          s: 'The metapopulation goes extinct when D reaches one minus e over c, while suitable habitat still remains. This is the extinction threshold: a species can disappear from a landscape that still contains empty, suitable patches.', pause: 1.0 },
        { t: 'Two lessons follow. Empty patches are not evidence that habitat is unimportant; they may be the very patches the network needs for recolonization. And because decline toward a new equilibrium takes time, species that persist after habitat loss may already be committed to extinction. Tilman and colleagues argued in 1994 that the best competitors, often the poorest colonizers, are the first to go.', pause: 1 },
      ],
      terms: [
        { beat: 1.3, term: 'Extinction threshold', def: 'Level of habitat loss at which a metapopulation collapses although suitable habitat remains: D = 1 − e/c.' },
        { beat: 2.12, term: 'Unoccupied suitable habitat', def: 'Empty patches capable of supporting a population; essential to colonization–extinction dynamics.' },
      ],
      init(S) {
        const N = 40, e = 0.075, c = 0.1875, ec = e / c; // e/c = 0.4, threshold D = 0.6
        const net = makeNet(7, N, NETBOX, 13, 33, 30);
        const r = rng(31); const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const idx = Array.from({ length: N }, (_, i) => i);
        // part A: quasi-equilibrium sweep of D (beats 0–1)
        const ramps = [[S.b(0) + sd(S, 0, 0, 0.2), S.b(0) + sd(S, 0, 0, 0.2) + 2.4, 0, 0.2], [S.b(0) + sd(S, 0, 2, 0.05), S.b(0) + sd(S, 0, 2, 0.05) + 3.0, 0.2, 0.4], [S.b(1) + sd(S, 1, 0, 0.1), S.b(1) + sd(S, 1, 0, 0.66), 0.4, 0.6]];
        const permA = shuffle(idx.slice()); const dsA = [];
        for (const [a, b, d0, d1] of ramps) for (let k = Math.round(d0 * N) + 1; k <= Math.round(d1 * N); k++) dsA.push([a + (b - a) * ((k - 0.5) / N - d0) / (d1 - d0), permA[k - 1]]);
        const initA = new Array(N).fill(false); shuffle(idx.slice()).slice(0, 24).forEach((i) => { initA[i] = true; });
        const nDest = (ds, t) => { let k = 0; for (const d of ds) if (d[0] <= t) k++; return k; };
        const simA = ctrlSim(41, net, { t0: 0, t1: S.b(2) + 1.5, init: initA, dSched: dsA, turn: 0.075, kappa: 2.5, target: (t) => Math.max(0, Math.round(N * (1 - ec)) - nDest(dsA, t)) });
        // part B: intact network, then a single loss of D = 0.7 (beyond threshold) and the slow decline
        const w0 = S.b(2) + sd(S, 2, 2) + 0.1, w1 = w0 + 1.4, nD = 26; // D = 0.65 > 1 − e/c
        const initB = new Array(N).fill(false); shuffle(idx.slice()).slice(0, 24).forEach((i) => { initB[i] = true; });
        const aa = 0.5, bb = ec - (1 - nD / N);
        const optB = { t0: S.b(2) - 0.6, t1: S.dur + 1, init: initB, turn: 0.075, kappa: 2.5, target: (t, n, sim) => {
          if (t < w0) return 24; if (t < w1 + 0.4) return null;
          if (sim.p0 === undefined) { sim.p0 = n / N; sim.td = t; }
          const q = Math.exp(-aa * bb * (t - sim.td)); return Math.round(N * bb * sim.p0 * q / (bb + sim.p0 * (1 - q)));
        } };
        // destroy a representative mix: ~65% of the occupied and of the empty patches
        const pre = ctrlSim(47, net, { ...optB, t1: w0 });
        const occW = idx.filter((i) => pstate(pre, i, w0)[0]), empW = idx.filter((i) => !pstate(pre, i, w0)[0]);
        const kO = Math.round(occW.length * nD / N); const pick = shuffle([...shuffle(occW).slice(0, kO), ...shuffle(empW).slice(0, nD - kO)]);
        const dsB = pick.map((i, k) => [w0 + (w1 - w0) * k / (nD - 1), i]);
        const simB = ctrlSim(47, net, { ...optB, dSched: dsB });
        const Dof = (t) => { let d = 0; for (const [a, b, d0, d1] of ramps) if (t >= a) d = t >= b ? d1 : lerp(d0, d1, (t - a) / (b - a)); return d; };
        // Tilman et al. (1994) competition–colonization hierarchy: c_i = m/(1−q)^(2i−1);
        // D_i = habitat destroyed beyond which species i is lost (sequential analytic equilibria).
        const q = 0.2, m = 0.04, ns = 8; const cc = Array.from({ length: ns }, (_, i) => m / Math.pow(1 - q, 2 * (i + 1) - 1));
        const eqm = (Dd) => { const p = []; for (let i = 0; i < ns; i++) { let v = 1 - Dd - m / cc[i]; for (let j = 0; j < i; j++) v -= p[j] * (1 + cc[j] / cc[i]); p.push(Math.max(0, v)); } return p; };
        const Dth = new Array(ns).fill(0); for (let Dd = 0; Dd < 1; Dd += 0.001) eqm(Dd).forEach((v, i) => { if (v > 1e-6) Dth[i] = Dd; });
        // deterministic Levins relaxations after loss (model time units, e = 1, c = 2.5)
        const relaxA = (tt) => 0.1 / (1 - (1 - 0.1 / 0.3) * Math.exp(-0.25 * tt));
        const relaxB = (tt) => { const b = 0.05, p0 = 0.21, x = Math.exp(-2.5 * b * tt); return b * p0 * x / (b + p0 * (1 - x)); };
        return { N, ec, net, simA, simB, dsA, dsB, nDest, Dof, Dth, relaxA, relaxB, w0, w1 };
      },
      draw(g, t, S, D) {
        const { net, N, ec } = D; const ctx = g.ctx; const RX = 840;
        const xf = S.p(2, 1.0, 0.1); // part A → part B landscape
        // ---------------- landscape
        const ma = S.p(0, 0.8);
        label(g, 'Habitat patches', 110, 262, ma);
        g.withAlpha(ma, () => ctx.drawImage(net.base, net.bx, net.by));
        const hiA = S.p(1, 0.8, sd(S, 1, 1, 0.55)) * (1 - xf), hiB = S.p(2, 0.8, sd(S, 2, 1, 0.05)) * (1 - S.p(2, 0.5, sd(S, 2, 2, 0.02)));
        if (xf < 1) drawNet(g, t, net, D.simA, { base: false, alpha: ma * (1 - xf), hiEmpty: hiA, indAlpha: 0 });
        if (xf > 0) drawNet(g, t, net, D.simB, { base: false, alpha: xf, hiEmpty: hiB, colBoost: 1 + hiB, indAlpha: 0 });
        // readouts
        const nd = xf < 0.5 ? D.nDest(D.dsA, t) : D.nDest(D.dsB, t); const sim = xf < 0.5 ? D.simA : D.simB;
        const occ = countAt(sim, t);
        g.text(`D = ${(nd / N).toFixed(2)}    p = ${(occ / N).toFixed(2)}`, NETBOX.x + NETBOX.w, 262, { size: 22, role: 'mono', color: PAL.ink2, align: 'right', alpha: S.p(0, 0.8, 0.6) });
        const pillB = (txt, col, a) => g.pill(txt, NETBOX.x + NETBOX.w / 2, NETBOX.y + NETBOX.h + 14, { size: 21, color: col, align: 'center', alpha: a, fill: 'rgba(11,22,24,0.92)', stroke: U.rgba(col, 0.6) });
        pillB('extinct: 16 suitable patches remain, all empty', PAL.ochre, S.p(1, 0.8, sd(S, 1, 1, 0.62)) * (1 - S.p(2, 0.4)));
        pillB('intact network: empty patches are recolonization targets', PAL.ochre, S.p(2, 0.8, sd(S, 2, 1, 0.2)) * (1 - S.p(2, 0.4, sd(S, 2, 2))));
        pillB('D = 0.65: still occupied, yet p* = 0', PAL.coral, S.p(2, 0.8, sd(S, 2, 2, 0.32)));

        // ---------------- right panel A: p* vs D (beats 0–1, lesson 1)
        const vA = S.p(0, 0.9, 0.5) * (1 - S.p(2, 0.7, sd(S, 2, 2)));
        if (vA > 0) g.withAlpha(vA, () => {
          label(g, 'Equilibrium occupancy vs. habitat destroyed', RX, 262);
          g.math('p^{*} = 1 − D − e/c', RX, 340, { size: 48, alpha: S.p(0, 0.8, sd(S, 0, 1, 0.05)) });
          const A = g.axes({ x: RX + 56, y: 410, w: 390, h: 380, xmin: 0, xmax: 1, ymin: 0, ymax: 1.08, xlab: 'D', ylab: 'p^{*}', progress: S.p(0, 1, 0.5), xticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }], yticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }] });
          const thr = 1 - ec;
          // suitable habitat 1 − D
          const ha = S.p(0, 1, sd(S, 0, 1, 0.3));
          g.line(A.X(0), A.Y(1), A.X(1), A.Y(0), { color: PAL.ink3, w: 2, dash: [7, 7], progress: ha });
          g.with(() => { const ang = Math.atan2(A.Y(0) - A.Y(1), A.X(1) - A.X(0)); ctx.translate(A.X(0.33), A.Y(0.67)); ctx.rotate(ang); g.text('suitable habitat, 1 − D', 0, -10, { size: 21, color: PAL.ink2, align: 'center', alpha: S.p(0, 0.8, sd(S, 0, 1, 0.5)) }); });
          g.math('1 − e/c', A.X(0) - 14, A.Y(thr) + 8, { size: 22, color: COL, align: 'right', alpha: S.p(0, 0.8, sd(S, 0, 1, 0.5)) });
          // lesson 1: the band of suitable-but-empty habitat, width e/c
          const la = S.p(2, 0.8, sd(S, 2, 1, 0.1)) * (1 - S.p(2, 0.5, sd(S, 2, 2)));
          if (la > 0) {
            g.poly([[A.X(0), A.Y(1)], [A.X(thr), A.Y(ec)], [A.X(thr), A.Y(0)], [A.X(0), A.Y(thr)]], { fill: U.rgba(PAL.ochre, 0.2), color: null, w: 0, alpha: la });
            g.arrow(A.X(0.1), A.Y(thr - 0.1) - 3, A.X(0.1), A.Y(0.9) + 3, { color: PAL.ochre, w: 2, head: 11, both: true, alpha: la });
            g.math('e/c', A.X(0.1) + 10, A.Y(0.68) + 9, { size: 28, color: PAL.ochre, alpha: la });
            g.text('at equilibrium a fraction e/c of all patches', RX, 866, { size: 22, color: PAL.ochre, alpha: la });
            g.text('is suitable but empty', RX, 894, { size: 22, color: PAL.ochre, alpha: la });
          }
          // threshold region (beat 1)
          const sa = S.p(1, 0.9, sd(S, 1, 0, 0.75)) * (1 - S.p(2, 0.5, sd(S, 2, 1)));
          if (sa > 0) {
            g.poly([[A.X(thr), A.Y(0)], [A.X(thr), A.Y(ec)], [A.X(1), A.Y(0)]], { fill: U.rgba(PAL.ochre, 0.24), color: null, w: 0, alpha: sa });
            g.text('suitable habitat', A.X(0.8), A.Y(0.56), { size: 21, color: PAL.ochre, align: 'center', alpha: sa });
            g.text('still remains', A.X(0.8), A.Y(0.56) + 26, { size: 21, color: PAL.ochre, align: 'center', alpha: sa });
            g.line(A.X(0.8), A.Y(0.56) + 36, A.X(0.75), A.Y(0.13), { color: PAL.ochre, w: 1.3, alpha: sa });
          }
          const ta = S.p(1, 0.8, sd(S, 1, 0, 0.3));
          g.line(A.X(thr), A.Y(0), A.X(thr), A.Y(1.02), { color: PAL.coral, w: 2, dash: [5, 6], alpha: ta });
          g.text('extinction threshold', A.X(thr), A.Y(1.02) - 12, { size: 21, color: PAL.coral, align: 'center', alpha: ta, weight: 500 });
          g.math('1 − e/c', A.X(thr), A.Y(0) + 40, { size: 24, color: PAL.coral, align: 'center', alpha: ta });
          // p* line
          g.line(A.X(0), A.Y(thr), A.X(thr), A.Y(0), { color: COL, w: 4, progress: S.p(0, 1.4, sd(S, 0, 1, 0.35)) });
          g.line(A.X(thr), A.Y(0), A.X(1), A.Y(0), { color: COL, w: 4, alpha: 0.6 * ta });
          // slope triangle: one-for-one (beat 0, end)
          const st = S.p(0, 0.8, sd(S, 0, 2, 0.12)) * (1 - S.p(1, 0.6));
          if (st > 0) {
            g.poly([[A.X(0.2), A.Y(0.4)], [A.X(0.4), A.Y(0.4)], [A.X(0.4), A.Y(0.2)]], { color: PAL.ink2, w: 1.6, alpha: st });
            g.math('ΔD', A.X(0.3), A.Y(0.4) - 10, { size: 24, color: PAL.ink2, align: 'center', alpha: st });
            g.math('−ΔD', A.X(0.4) + 10, A.Y(0.3) + 8, { size: 24, color: PAL.ink2, alpha: st });
            g.text('slope −1: one-for-one', A.X(0.45), A.Y(0.42) , { size: 21, color: PAL.ink, alpha: st });
          }
          // marker at current D
          const Dc = lerp(D.Dof(t), 0, xf); const pc = Math.max(0, 1 - Dc - ec);
          const mk = S.p(0, 0.6, 1.0);
          g.line(A.X(Dc), A.Y(pc), A.X(Dc), A.Y(0), { color: PAL.ink2, w: 1.2, dash: [3, 5], alpha: mk * 0.8 });
          g.dot(A.X(Dc), A.Y(pc), 7.5, pc > 0 ? COL : PAL.coral, mk, 3.2);
          g.text(pc > 0 ? 'p* = ' + pc.toFixed(2) : 'extinct', A.X(Dc) - 14, A.Y(pc) + (pc > 0 ? 34 : -16), { size: 21, role: 'mono', color: pc > 0 ? PAL.ink : PAL.coral, align: 'right', alpha: mk * (pc > 0.04 || pc === 0 ? 1 : 0) * (1 - st) * (1 - xf) });
        });

        // ---------------- right panel B: after habitat loss (lesson 2)
        const vB = S.p(2, 0.9, sd(S, 2, 2, 0.04)) * (1 - S.p(2, 0.6, sd(S, 2, 3)));
        if (vB > 0) g.withAlpha(vB, () => {
          label(g, 'After habitat loss', RX, 262);
          const T = g.axes({ x: RX + 56, y: 330, w: 390, h: 410, xmin: 0, xmax: 16, ymin: 0, ymax: 0.68, xlab: 't', ylab: 'p', progress: S.p(2, 1, sd(S, 2, 2, 0.04)), yticks: [{ v: 0, l: '0' }, { v: 0.6, l: '0.6' }] });
          const t0 = 1.2;
          g.line(T.X(0), T.Y(0.6), T.X(t0), T.Y(0.6), { color: PAL.ink, w: 3, alpha: S.p(2, 0.6, sd(S, 2, 2, 0.08)) });
          const lo = S.p(2, 0.6, sd(S, 2, 2, 0.14));
          g.line(T.X(t0), T.Y(0), T.X(t0), T.Y(0.66), { color: PAL.ink2, w: 1.5, dash: [4, 5], alpha: lo });
          g.text('habitat loss', T.X(t0) + 10, T.Y(0.66) + 6, { size: 21, color: PAL.ink2, alpha: lo });
          const pa = S.lin(2, 3.2, sd(S, 2, 2, 0.22)), pb = S.lin(2, 3.2, sd(S, 2, 2, 0.58));
          // D = 0.5: relaxes slowly to the new, lower equilibrium p* = 0.1
          g.line(T.X(t0), T.Y(0.1), T.X(16), T.Y(0.1), { color: COL, w: 1.5, dash: [6, 6], alpha: S.p(2, 0.8, sd(S, 2, 2, 0.3)) * 0.8 });
          g.line(T.X(t0), T.Y(0.6), T.X(t0), T.Y(0.3), { color: COL, w: 3, alpha: S.p(2, 0.3, sd(S, 2, 2, 0.22)) });
          g.plot(T, (x) => D.relaxA(x - t0), { from: t0, to: 16, color: COL, w: 3.4, progress: pa });
          // D = 0.65 (> 1 − e/c): still present, but committed to extinction
          if (pb > 0) {
            const pts = [[T.X(t0), T.Y(0)]]; for (let k = 0; k <= 80; k++) { const x = t0 + 14.8 * k / 80 * pb; pts.push([T.X(x), T.Y(D.relaxB(x - t0))]); } pts.push([T.X(t0 + 14.8 * pb), T.Y(0)]);
            g.poly(pts, { fill: U.rgba(PAL.coral, 0.2), color: null, w: 0, close: true });
          }
          g.line(T.X(t0), T.Y(0.6), T.X(t0), T.Y(0.21), { color: PAL.coral, w: 3, alpha: S.p(2, 0.3, sd(S, 2, 2, 0.58)) });
          g.plot(T, (x) => D.relaxB(x - t0), { from: t0, to: 16, color: PAL.coral, w: 3.4, progress: pb });
          // legend
          const lg = (y, col, txt, a) => { g.line(T.X(5.0), y - 7, T.X(6.2), y - 7, { color: col, w: 3.4, alpha: a }); g.text(txt, T.X(6.6), y, { size: 22, color: col, alpha: a }); };
          lg(T.Y(0.6), COL, 'D = 0.5  →  new p* = 0.1', S.p(2, 0.8, sd(S, 2, 2, 0.3)));
          lg(T.Y(0.6) + 36, PAL.coral, 'D = 0.65  →  p* = 0', S.p(2, 0.8, sd(S, 2, 2, 0.6)));
          const da = S.p(2, 0.8, sd(S, 2, 2, 0.8));
          g.text('committed to extinction', T.X(6.0), T.Y(0.33), { size: 22, color: PAL.coral, weight: 600, alpha: da });
          g.text('still present: extinction debt', T.X(6.0), T.Y(0.33) + 28, { size: 21, color: PAL.ink2, alpha: da });
          g.line(T.X(6.0) - 8, T.Y(0.33) - 6, T.X(3.4), T.Y(0.035), { color: PAL.coral, w: 1.3, alpha: da });
        });
        // ---------------- right panel C: Tilman et al. 1994 (lesson 3)
        const vC = S.p(2, 0.9, sd(S, 2, 3, 0.02));
        if (vC > 0) g.withAlpha(vC, () => {
          label(g, 'Tilman et al. 1994 · eight species', RX, 262);
          g.text('habitat loss at which each species is lost', RX, 312, { size: 22, color: PAL.ink2 });
          const B = g.axes({ x: RX + 56, y: 370, w: 390, h: 380, xmin: 0.4, xmax: 8.6, ymin: 0, ymax: 1.04, arrows: false, ylab: 'D', yticks: [{ v: 0, l: '0' }, { v: 0.5, l: '0.5' }, { v: 1, l: '1' }] });
          const sw = 0.74 * ease.inOut(S.lin(2, 4.0, sd(S, 2, 3, 0.35)));
          let lostN = 0;
          D.Dth.forEach((v, i) => {
            const x = B.X(i + 1), bw = 32; const lost = v <= sw; if (lost) lostN++;
            const col = U.mix(PAL.ochre, PAL.lagoon, i / 7); const a = S.p(2, 0.5, sd(S, 2, 3, 0.08) + i * 0.12);
            g.rect(x - bw / 2, B.Y(v), bw, B.Y(0) - B.Y(v), { fill: lost ? '#2E3937' : col, alpha: a * (lost ? 1 : 0.85), r: 2 });
            if (lost) g.text('×', x, B.Y(v) - 10, { size: 30, color: PAL.coral, align: 'center', weight: 600 });
            g.text(String(i + 1), x, B.Y(0) + 26, { size: 19, color: PAL.ink3, align: 'center', alpha: a });
          });
          if (sw > 0.005) {
            g.line(B.X(0.4), B.Y(sw), B.X(8.6), B.Y(sw), { color: PAL.ink, w: 2, dash: [7, 6] });
            g.math('D', B.X(8.6) + 8, B.Y(sw) + 9, { size: 26 });
          }
          const la = S.p(2, 0.8, sd(S, 2, 3, 0.5));
          g.text('best competitor,', B.X(0.4), B.Y(0) + 64, { size: 21, color: PAL.ochre, alpha: la });
          g.text('poorest colonizer', B.X(0.4), B.Y(0) + 90, { size: 21, color: PAL.ochre, alpha: la });
          g.text('best colonizer', B.X(8.6), B.Y(0) + 64, { size: 21, color: PAL.lagoon, align: 'right', alpha: la });
          g.text('rank in competitive ability', B.X(4.5), B.Y(0) + 64, { size: 19, color: PAL.ink3, align: 'center', alpha: 0 });
          const fa = S.p(2, 0.8, sd(S, 2, 3, 0.88)) * (lostN >= 3 ? 1 : 0);
          g.poly([[B.X(0.7), B.Y(0.86)], [B.X(0.7), B.Y(0.9)], [B.X(3.3), B.Y(0.9)], [B.X(3.3), B.Y(0.86)]], { color: PAL.coral, w: 2, alpha: fa });
          g.text('first to go', B.X(2), B.Y(0.9) - 12, { size: 22, color: PAL.coral, align: 'center', weight: 600, alpha: fa });
        });
      },
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'meta-types', title: 'Kinds of spatial populations',
      beats: [
        { t: 'Not every metapopulation looks like Levins’s. In a mainland–island system, one large, effectively permanent population supplies colonists to small, extinction-prone ones. In a patchy population, dispersal is so frequent that the patches behave as a single population. In a nonequilibrium metapopulation, extinctions outpace recolonization, often after fragmentation, and the system is in decline.',
          s: 'Not every metapopulation looks like Levvins’s. In a mainland island system, one large, effectively permanent population supplies colonists to small, extinction-prone ones. In a patchy population, dispersal is so frequent that the patches behave as a single population. In a nonequilibrium metapopulation, extinctions outpace recolonization, often after fragmentation, and the system is in decline.' },
        { t: 'Ronald Pulliam’s 1988 source–sink model adds habitat quality. In source habitats, births exceed deaths, λ > 1, and surplus individuals emigrate. In sink habitats, λ < 1, and populations persist only through immigration.',
          s: 'Ronald Pulliam’s 1988 source sink model adds habitat quality. In source habitats, births exceed deaths, lambda is greater than one, and surplus individuals emigrate. In sink habitats, lambda is less than one, and populations persist only through immigration.' },
        { t: 'A large share of a species can live in sinks, so local abundance can be a misleading guide to habitat quality. Worse is an ecological trap: a sink that animals actively prefer, because cues that once signaled good habitat no longer do, as when grassland birds nest in hayfields mowed before their chicks fledge.', pause: 2 },
      ],
      terms: [
        { beat: 0.2, term: 'Mainland–island metapopulation', def: 'A large persistent population supplies colonists to small, extinction-prone satellite populations.' },
        { beat: 0.55, term: 'Patchy population', def: 'Patches linked by such frequent dispersal that they function as one population.' },
        { beat: 1.3, term: 'Source–sink dynamics', def: 'Pulliam (1988): surplus from habitats with λ > 1 sustains populations in habitats with λ < 1.' },
        { beat: 2.45, term: 'Ecological trap', def: 'Low-quality habitat that animals prefer because once-reliable cues have become decoupled from quality.' },
      ],
      init(S) {
        const b0 = S.b(0), T = S.dur + 2;
        const cells = [{ x: 110, y: 232 }, { x: 724, y: 232 }, { x: 110, y: 578 }, { x: 724, y: 578 }].map((c) => ({ ...c, w: 596, h: 328 }));
        // 0 · classic Levins: similar small patches, two-way dispersal
        const c0 = cells[0]; const P0 = scatter(12, 8, { x: c0.x + 50, y: c0.y + 92, w: 500, h: 215 }, 19, 19, 52);
        const L0 = []; P0.forEach((p, i) => P0.map((q, j) => [j, Math.hypot(q.x - p.x, q.y - p.y)]).filter(([j]) => j > i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j, d]) => { if (d < 200) L0.push([i, j]); }));
        const n0 = { P: P0 }; const s0 = levinsSim(5, 8, 0.55, 0.22, 5, 0, T); assignSources(3, n0, s0);
        // 1 · mainland–island: a permanent mainland feeds small, extinction-prone islands
        const c1 = cells[1]; const main = { x: c1.x + 128, y: c1.y + 200, r: 82 }; main.path = blob(main.x, main.y, main.r, 77, 0.1);
        const P1 = [[c1.x + 330, c1.y + 118, 15], [c1.x + 432, c1.y + 168, 17], [c1.x + 528, c1.y + 112, 13], [c1.x + 500, c1.y + 262, 16], [c1.x + 376, c1.y + 270, 14], [c1.x + 300, c1.y + 196, 12]].map(([x, y, r]) => ({ x, y, r }));
        const s1 = (() => { const r = rng(21); const n = P1.length, init = [true, false, true, false, true, false]; const tog = P1.map(() => []); const ev = [];
          for (let i = 0; i < n; i++) { let tt = b0 + sd(S, 0, 1, 0.8) - 2, on = init[i]; for (;;) { tt += -Math.log(1 - r()) / (on ? 0.3 : 0.32); if (tt > T) break; on = !on; tog[i].push(tt); ev.push({ t: tt, k: on ? 'c' : 'x', i, src: -1 }); } }
          ev.sort((a, b) => a.t - b.t); return { init, tog, ev }; })();
        // 2 · patchy population: patches so linked they act as one
        const c2 = cells[2]; const cx2 = c2.x + 250, cy2 = c2.y + 200;
        const P2 = [[0, 0]].concat(Array.from({ length: 6 }, (_, k) => [Math.cos(k * Math.PI / 3 + 0.3) * 82, Math.sin(k * Math.PI / 3 + 0.3) * 70])).map(([dx, dy], k) => ({ x: cx2 + dx, y: cy2 + dy, r: k ? 20 : 23 }));
        const L2 = []; for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) if (Math.hypot(P2[i].x - P2[j].x, P2[i].y - P2[j].y) < 100) L2.push([i, j]);
        // 3 · nonequilibrium: extinctions outpace recolonization after fragmentation
        const c3 = cells[3]; const P3 = scatter(29, 9, { x: c3.x + 40, y: c3.y + 92, w: 360, h: 215 }, 14, 22, 26);
        const L3 = []; P3.forEach((p, i) => P3.map((q, j) => [j, Math.hypot(q.x - p.x, q.y - p.y)]).filter(([j]) => j > i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j, d]) => { if (d < 170) L3.push([i, j]); }));
        const s3 = (() => { const r = rng(8); const init = P3.map((_, i) => i !== 4); const tog = P3.map(() => []); const ev = [];
          const tA = b0 + sd(S, 0, 3, 0.3), tB = S.b(1) + 0.5; const order = [2, 7, 0, 5, 8, 1, 3]; let tt = tA;
          order.forEach((i, k) => { tt += (tB - tA) / order.length * (0.7 + 0.6 * r()); if (init[i]) { tog[i].push(tt); ev.push({ t: tt, k: 'x', i }); } });
          const tc = tA + (tB - tA) * 0.42; tog[4].push(tc); ev.push({ t: tc, k: 'c', i: 4, src: 6 }); ev.sort((a, b) => a.t - b.t); return { init, tog, ev }; })();
        const occ3 = []; for (let tt = b0 + sd(S, 0, 3); tt <= S.b(1) + 1.5; tt += 0.1) occ3.push([tt, countAt(s3, tt) / P3.length]);
        // source–sink individuals
        const r = rng(4); const ind = Array.from({ length: 60 }, () => ({ a: r() * TAU, rr: Math.sqrt(r()), ph: r() * 100, sp: 0.25 + 0.3 * r() }));
        return { cells, P0, L0, s0, main, P1, s1, P2, L2, P3, L3, s3, occ3, ind };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx;
        // ---------------- beat 0: four kinds of spatial population
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          const head = (c, k, name, desc, a) => {
            g.rect(c.x, c.y, c.w, c.h, { fill: 'rgba(14,29,31,0.55)', stroke: 'rgba(238,231,215,0.12)', w: 1.2, r: 6, alpha: a });
            g.text(name.toUpperCase(), c.x + 24, c.y + 36, { size: 17, weight: 600, color: COL, ls: 2.6, alpha: a });
            g.text(desc, c.x + 24, c.y + 68, { size: 21, color: PAL.ink2, alpha: a });
          };
          const mini = (P, sim, a, o = {}) => {
            if (a <= 0) return;
            g.withAlpha(a, () => {
              P.forEach((p, i) => {
                const [on, dt] = sim ? pstate(sim, i, t) : [true, 99]; const inten = on ? ease.out(dt / 0.4) : 1 - ease.inOut(dt / 0.8);
                g.circle(p.x, p.y, p.r, { fill: '#10201F', stroke: PAL.ink3, w: 1.5 });
                if (inten > 0.01) { const col = on ? COL : U.mix(PAL.coral, COL, inten); g.glow(p.x, p.y, p.r * 2.2, col, 0.2 * inten); g.circle(p.x, p.y, p.r, { fill: U.rgba(col, 0.32 * inten), stroke: col, w: 2.2, alpha: inten }); }
              });
              if (sim) for (const v of sim.ev) {
                if (v.t > t + 0.9) break; if (v.t < t - 1) continue; const p = P[v.i];
                if (v.k === 'c' && t < v.t) { const s = v.src >= 0 ? P[v.src] : o.main; if (!s) continue; const u = 1 - (v.t - t) / 0.9; const sx = s.x + (p.x - s.x) * (s.r / Math.hypot(p.x - s.x, p.y - s.y)), sy = s.y + (p.y - s.y) * (s.r / Math.hypot(p.x - s.x, p.y - s.y)); g.dot(lerp(sx, p.x, u), lerp(sy, p.y, u), 3.4, MINT_LT, 1, 3.2); }
                else if (v.k === 'x' && t >= v.t && t - v.t < 0.9) { const u = (t - v.t) / 0.9; g.circle(p.x, p.y, p.r + 3 + 16 * u, { stroke: PAL.coral, w: 2.5, alpha: 1 - u }); }
                else if (v.k === 'c' && t >= v.t && t - v.t < 0.6) { const u = (t - v.t) / 0.6; g.circle(p.x, p.y, p.r + 3 + 12 * u, { stroke: COL, w: 2.2, alpha: 1 - u }); }
              }
            });
          };
          const shorten = (a, b, ra, rb) => { const d = Math.hypot(b.x - a.x, b.y - a.y); const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; return [a.x + ux * ra, a.y + uy * ra, b.x - ux * rb, b.y - uy * rb]; };
          // 0 · classic Levins
          const a0 = S.p(0, 0.9, 0.2);
          head(D.cells[0], 0, 'Classic Levins', 'similar patches, all extinction-prone', a0);
          D.L0.forEach(([i, j]) => { const [x1, y1, x2, y2] = shorten(D.P0[i], D.P0[j], 24, 24); g.arrow(x1, y1, x2, y2, { color: PAL.lagoon, w: 1.6, head: 9, both: true, alpha: 0.5 * a0 }); });
          mini(D.P0, D.s0, a0);
          // 1 · mainland–island
          const a1 = S.p(0, 0.9, sd(S, 0, 1, 0.05));
          head(D.cells[1], 1, 'Mainland–island', 'a permanent mainland feeds small islands', a1);
          g.withAlpha(a1 * S.p(0, 0.9, sd(S, 0, 1, 0.3)), () => {
            const m = D.main; g.glow(m.x, m.y, m.r * 1.9, COL, 0.3); ctx.save(); ctx.fillStyle = U.rgba(COL, 0.34); ctx.fill(m.path); ctx.strokeStyle = COL; ctx.lineWidth = 2.6; ctx.stroke(m.path); ctx.restore();
            for (let k = 0; k < 22; k++) { const a = k * 2.4 + 0.4 * U.noise1(t * 0.3 + k, 2), rr = m.r * (0.15 + 0.65 * (0.5 + 0.5 * U.noise1(t * 0.35 + k * 5, 4))); g.circle(m.x + rr * Math.cos(a), m.y + rr * Math.sin(a), 2.8, { fill: MINT_LT }); }
            g.text('mainland', m.x, m.y + m.r + 34, { size: 21, color: COL, align: 'center' });
          });
          const aa1 = a1 * S.p(0, 0.9, sd(S, 0, 1, 0.62));
          D.P1.forEach((p) => { const [x1, y1, x2, y2] = shorten(D.main, p, D.main.r + 6, p.r + 6); g.arrow(x1, y1, x2, y2, { color: PAL.lagoon, w: 1.6, head: 10, alpha: 0.5 * aa1 }); });
          mini(D.P1, t > D.s1.ev[0].t - 1 ? D.s1 : null, a1 * S.p(0, 0.9, sd(S, 0, 1, 0.45)), { main: D.main });
          // 2 · patchy population
          const a2 = S.p(0, 0.9, sd(S, 0, 2, 0.05));
          head(D.cells[2], 2, 'Patchy population', 'frequent dispersal: one population', a2);
          if (a2 > 0) {
            const flow = S.p(0, 1.5, sd(S, 0, 2, 0.28));
            g.withAlpha(a2, () => {
              D.L2.forEach(([i, j]) => g.line(D.P2[i].x, D.P2[i].y, D.P2[j].x, D.P2[j].y, { color: PAL.lagoon, w: 1.4, alpha: 0.28 }));
              ctx.save(); ctx.fillStyle = MINT_LT; ctx.globalAlpha *= flow; ctx.beginPath();
              D.L2.forEach(([i, j], k) => { const A = D.P2[i], B = D.P2[j]; for (let q = 0; q < 4; q++) { let u = (t * 0.55 + q / 4 + k * 0.137) % 1; if (q % 2) u = 1 - u; const x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u); ctx.moveTo(x + 2.6, y); ctx.arc(x, y, 2.6, 0, TAU); } });
              ctx.fill(); ctx.restore();
            });
            mini(D.P2, null, a2);
            const oa = a2 * S.p(0, 1, sd(S, 0, 2, 0.7));
            const c = D.cells[2];
            g.ellipse(c.x + 250, c.y + 200, 158, 118, { stroke: COL, w: 2, dash: [8, 7], alpha: oa * 0.8 });
            g.text('acts as one', c.x + 430, c.y + 190, { size: 22, color: COL, alpha: oa });
            g.text('population', c.x + 430, c.y + 218, { size: 22, color: COL, alpha: oa });
          }
          // 3 · nonequilibrium
          const a3 = S.p(0, 0.9, sd(S, 0, 3, 0.05));
          head(D.cells[3], 3, 'Nonequilibrium', 'extinction outpaces recolonization', a3);
          if (a3 > 0) {
            const fr = S.p(0, 1.2, sd(S, 0, 3, 0.55)); const c = D.cells[3];
            g.withAlpha(a3, () => {
              D.L3.forEach(([i, j]) => { const A = D.P3[i], B = D.P3[j]; g.line(A.x, A.y, B.x, B.y, { color: PAL.lagoon, w: 1.4, alpha: 0.3 * (1 - 0.8 * fr), dash: fr > 0.5 ? [3, 9] : null }); });
              // fragmentation: roads cutting the landscape
              const road1 = [[c.x + 30, c.y + 168], [c.x + 160, c.y + 190], [c.x + 280, c.y + 160], [c.x + 420, c.y + 196]];
              const road2 = [[c.x + 236, c.y + 84], [c.x + 214, c.y + 190], [c.x + 252, c.y + 318]];
              g.poly(road1, { color: PAL.sand, w: 5, alpha: 0.5, progress: fr }); g.poly(road2, { color: PAL.sand, w: 5, alpha: 0.5, progress: S.p(0, 1.2, sd(S, 0, 3, 0.6)) });
              g.text('fragmentation', c.x + 300, c.y + 236, { size: 21, color: PAL.sand, alpha: fr * 0.9 });
            });
            mini(D.P3, D.s3, a3);
            // declining occupancy sparkline
            const da = a3 * S.p(0, 0.9, sd(S, 0, 3, 0.75));
            g.withAlpha(da, () => {
              const A = g.axes({ x: c.x + 446, y: c.y + 130, w: 120, h: 120, xmin: D.occ3[0][0], xmax: D.occ3[D.occ3.length - 1][0], ymin: 0, ymax: 1, arrows: false, color: PAL.ink3 });
              const pts = D.occ3.filter(([tt]) => tt <= t); if (pts.length > 1) { g.data(A, pts, { color: PAL.coral, w: 3 }); const q = pts[pts.length - 1]; g.dot(A.X(q[0]), A.Y(q[1]), 4.5, PAL.coral, 1, 3); }
              g.math('p', c.x + 436, c.y + 132, { size: 26, color: PAL.ink2, align: 'right' });
              g.text('in decline', c.x + 446, c.y + 286, { size: 21, color: PAL.coral });
            });
          }
        });

        // ---------------- beats 1–2: source–sink, then the ecological trap
        const v1 = S.p(1, 0.9, 0.1);
        if (v1 <= 0) return;
        const grow = ease.inOut(S.lin(2, 2.6, sd(S, 2, 0, 0.1)));
        const SRC = { x: 372, y: 492, rx: 212, ry: 136 }, SNK = { x: 990, y: 492, rx: lerp(212, 250, grow), ry: lerp(136, 160, grow) };
        const trap = S.p(2, 1.0, sd(S, 2, 1, 0.02));
        g.withAlpha(v1, () => {
          label(g, 'Source–sink dynamics · Pulliam 1988', 110, 262);
          const q = S.p(1, 1.2, sd(S, 1, 0, 0.7)); // habitat quality shading
          // habitats
          const hab = (E, col, a) => { g.glow(E.x, E.y, E.rx * 1.3, col, 0.12 * q); g.ellipse(E.x, E.y, E.rx, E.ry, { fill: U.rgba(col, 0.08 + 0.1 * q), stroke: col, w: 2.4, alpha: a }); };
          hab(SRC, COL, 1); hab(SNK, PAL.coral, 1);
          // hayfield texture (trap)
          if (trap > 0) g.with(() => {
            ctx.beginPath(); ctx.ellipse(SNK.x, SNK.y, SNK.rx - 3, SNK.ry - 3, 0, 0, TAU); ctx.clip();
            const mx = lerp(SNK.x - SNK.rx - 20, SNK.x + SNK.rx + 20, ease.inOut(S.lin(2, 2.4, sd(S, 2, 1, 0.84))));
            for (let k = -14; k <= 14; k++) { const x = SNK.x + k * 18; const cut = x < mx; g.line(x, SNK.y - SNK.ry, x + 10, SNK.y + SNK.ry, { color: cut ? PAL.ink3 : PAL.ochre, w: cut ? 1.4 : 2.2, alpha: trap * (cut ? 0.35 : 0.45) }); }
            if (mx > SNK.x - SNK.rx - 10 && mx < SNK.x + SNK.rx + 10) g.line(mx, SNK.y - SNK.ry, mx, SNK.y + SNK.ry, { color: PAL.sand, w: 4, alpha: 0.9 });
          });
          // individuals
          const nSrc = 24, nSnk = Math.round(lerp(14, 36, grow));
          const dots = (E, n, off) => { ctx.beginPath(); for (let k = 0; k < n; k++) { const d = D.ind[(k + off) % D.ind.length]; const a = d.a + 0.6 * U.noise1(t * d.sp + d.ph, 3), rr = 0.82 * Math.sqrt(0.08 + 0.92 * (0.5 + 0.5 * U.noise1(t * d.sp * 0.8 + d.ph * 2, 5))); const x = E.x + rr * E.rx * Math.cos(a), y = E.y + rr * E.ry * Math.sin(a); ctx.moveTo(x + 3.4, y); ctx.arc(x, y, 3.4, 0, TAU); } ctx.fill(); };
          ctx.save(); ctx.fillStyle = MINT_LT; ctx.globalAlpha *= S.p(1, 0.9, 0.3) * (1 - 0.5 * trap); dots(SRC, nSrc, 0); dots(SNK, nSnk, 24); ctx.restore();
          // titles
          const sA = S.p(1, 0.8, sd(S, 1, 1, 0.02)), kA = S.p(1, 0.8, sd(S, 1, 2, 0.02));
          g.text('Source', SRC.x - 30, 318, { size: 44, role: 'display', color: COL, align: 'right', alpha: sA });
          g.math('λ > 1', SRC.x - 6, 318, { size: 38, alpha: S.p(1, 0.8, sd(S, 1, 1, 0.45)) });
          g.text('Sink', SNK.x - 30, 318, { size: 44, role: 'display', color: PAL.coral, align: 'right', alpha: kA });
          g.math('λ < 1', SNK.x - 6, 318, { size: 38, alpha: S.p(1, 0.8, sd(S, 1, 2, 0.22)) });
          g.text('native prairie', SRC.x, SRC.y + SRC.ry + 36, { size: 22, color: COL, align: 'center', alpha: trap });
          g.text('hayfield', SNK.x, SNK.y + SNK.ry + 36, { size: 22, color: PAL.ochre, align: 'center', alpha: trap });
          // emigrant flow source → sink
          const fA = S.p(1, 0.9, sd(S, 1, 1, 0.72));
          if (fA > 0) {
            const x1 = SRC.x + SRC.rx - 10, x2 = SNK.x - SNK.rx + 10, y0 = 470, cy = 380;
            const bz = (u) => [(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * ((x1 + x2) / 2) + u * u * x2, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y0];
            g.carrow(x1, y0, x2, y0, -(y0 - cy) / (x2 - x1), { color: PAL.lagoon, w: 2.5, head: 16, alpha: 0.75 * fA });
            for (let k = 0; k < 6; k++) { const u = (t * 0.32 + k / 6) % 1; const [x, y] = bz(u * 0.94); g.dot(x, y, 3.8, MINT_LT, fA * Math.sin(Math.PI * u), 3); }
            g.text('surplus emigrants', (x1 + x2) / 2, cy + 6, { size: 22, color: PAL.lagoon, align: 'center', alpha: fA * (1 - trap) });
          }
          // BIDE budgets (beat 1)
          const bA = 1 - S.p(2, 0.6, 0.1);
          const budget = (E, rows, a, note) => {
            if (a <= 0) return; const x0 = E.x - 190, sc = 6.2;
            rows.forEach(([lab, segs], k) => {
              const y = 690 + k * 50; let x = x0;
              g.text(lab, x0 - 14, y + 8, { size: 21, color: PAL.ink3, align: 'right', alpha: a });
              segs.forEach(([nm, v, col]) => { const w = v * sc; g.rect(x, y - 16, w - 3, 32, { fill: U.rgba(col, 0.85), r: 3, alpha: a }); g.text(nm, x + 9, y + 7, { size: 21, color: PAL.bg, weight: 600, alpha: a }); x += w; });
            });
            g.text(note, x0, 812, { size: 21, color: PAL.ink2, alpha: a });
          };
          budget(SRC, [['in', [['births', 60, PAL.moss]]], ['out', [['deaths', 40, PAL.sand], ['emigrants', 20, PAL.lagoon]]]], bA * S.p(1, 0.8, sd(S, 1, 1, 0.25)), 'births = deaths + emigrants');
          budget(SNK, [['in', [['births', 15, PAL.moss], ['immigrants', 20, PAL.lagoon]]], ['out', [['deaths', 35, PAL.sand]]]], bA * S.p(1, 0.8, sd(S, 1, 2, 0.35)), 'births + immigrants = deaths');
          // beat 2: where the individuals are
          const shA = S.p(2, 0.8, sd(S, 2, 0, 0.3)) * (1 - S.p(2, 0.6, sd(S, 2, 1, 0.0)));
          if (shA > 0) {
            const x0 = 190, x1 = 1190, fs = nSrc / (nSrc + nSnk); const xm = lerp(x0, x1, fs);
            g.text('where the individuals live', x0, 676, { size: 21, color: PAL.ink3, alpha: shA });
            g.rect(x0, 694, xm - x0 - 3, 34, { fill: U.rgba(COL, 0.85), r: 3, alpha: shA }); g.rect(xm, 694, x1 - xm, 34, { fill: U.rgba(PAL.coral, 0.85), r: 3, alpha: shA });
            g.text(`source ${Math.round(fs * 100)}%`, x0 + 12, 718, { size: 21, color: PAL.bg, weight: 600, alpha: shA });
            g.text(`sink ${Math.round((1 - fs) * 100)}%`, x1 - 12, 718, { size: 21, color: PAL.bg, weight: 600, align: 'right', alpha: shA });
            g.text('local abundance is a poor guide to habitat quality', x0, 786, { size: 26, role: 'display', italic: true, color: PAL.ochre, alpha: shA * S.p(2, 0.8, sd(S, 2, 0, 0.62)) });
          }
          // beat 2: the ecological trap
          if (trap > 0) {
            g.pill('ecological trap', SNK.x, 372, { size: 22, color: PAL.ochre, align: 'center', alpha: trap, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.ochre, 0.7) });
            // settling birds: most choose the hayfield
            const tgt = [[SNK.x - 120, SNK.y + 10], [SNK.x - 40, SNK.y - 60], [SNK.x + 50, SNK.y + 40], [SNK.x + 140, SNK.y - 30], [SNK.x - 10, SNK.y + 100], [SRC.x - 60, SRC.y + 20], [SRC.x + 80, SRC.y - 40]];
            const mowX = lerp(SNK.x - SNK.rx - 20, SNK.x + SNK.rx + 20, ease.inOut(S.lin(2, 2.4, sd(S, 2, 1, 0.84))));
            tgt.forEach(([x, y], k) => {
              const t0 = S.b(2) + sd(S, 2, 1, 0.24) + k * 0.28; const u = ease.inOut((t - t0) / 1.5); if (u <= 0) return;
              const sx = 300 + k * 130, sy = 236; const inHay = k < 5; const mown = inHay && mowX > x;
              const fly = mown ? ease.inOut((t - (S.b(2) + sd(S, 2, 1, 0.84)) - (x - (SNK.x - SNK.rx)) / (2 * SNK.rx) * 2.4) / 1.0) : 0;
              const bx = lerp(sx, x, u) + fly * 60, by = lerp(sy, y, u) - 26 * Math.sin(Math.PI * u) - fly * 120;
              const na = S.p(2, 0.6, sd(S, 2, 1, 0.72)) * (inHay ? 1 : 1);
              if (na > 0) { g.ellipse(x, y + 16, 15, 7, { fill: '#4A3B22', stroke: PAL.sand, w: 1.5, alpha: na }); for (let e = -1; e <= 1; e++) g.circle(x + e * 6, y + 13, 3.4, { fill: PAL.sand, alpha: na * (mown ? 0.3 : 1) }); if (mown) g.text('×', x, y + 26, { size: 30, color: PAL.coral, align: 'center', weight: 700 }); }
              g.icon('songbird', bx, by, 40, PAL.ink, { alpha: 1 - fly, flip: false });
            });
            g.text('preferred: 5 of 7 birds settle here', SNK.x, SNK.y + SNK.ry + 64, { size: 21, color: PAL.ochre, align: 'center', alpha: S.p(2, 0.8, sd(S, 2, 1, 0.42)) * (1 - S.p(2, 0.5, sd(S, 2, 1, 0.64))) });
            // cue vs. outcome, and the calendar
            const cA = S.p(2, 0.8, sd(S, 2, 1, 0.38));
            g.text('cue: tall, dense grass, like prairie', 190, 712, { size: 22, color: PAL.ochre, alpha: cA });
            g.text('outcome: λ < 1', 190, 744, { size: 22, color: PAL.coral, alpha: S.p(2, 0.8, sd(S, 2, 1, 0.55)) });
            const tA = S.p(2, 0.8, sd(S, 2, 1, 0.66));
            if (tA > 0) g.withAlpha(tA, () => {
              const x0 = 640, x1 = 1190, y = 760; g.line(x0, y, x1, y, { color: PAL.ink3, w: 2 });
              const tick = (x, s, col, a) => { g.line(x, y - 9, x, y + 9, { color: col, w: 2.5, alpha: a }); g.text(s, x, y - 20, { size: 21, color: col, align: 'center', alpha: a }); };
              tick(x0 + 40, 'eggs laid', PAL.ink2, 1); tick(x0 + 290, 'mowing', PAL.coral, S.p(2, 0.6, sd(S, 2, 1, 0.84))); tick(x1 - 50, 'fledging', PAL.ink3, 1);
              g.line(x1 - 80, y - 34, x1 - 20, y - 14, { color: PAL.coral, w: 2, alpha: S.p(2, 0.6, sd(S, 2, 1, 0.95)) });
              g.text('nesting season', x0, y + 34, { size: 19, color: PAL.ink3 });
            });
          }
        });
      },
    },
    /* ------------------------------------------------------------------ 4 */
    {
      id: 'meta-hanski', title: 'Spatially realistic metapopulations',
      beats: [
        { t: 'Ilkka Hanski made the theory spatially realistic. His incidence function model predicts each patch’s probability of occupancy from its area, which sets extinction risk, and its connectivity, a sum of contributions from occupied patches weighted by their distance.',
          s: 'Ilka Hanski made the theory spatially realistic. His incidence function model predicts each patch’s probability of occupancy from its area, which sets extinction risk, and its connectivity, a sum of contributions from occupied patches weighted by their distance.' },
        { t: 'His test case became the flagship of the field: the Glanville fritillary butterfly, living as a metapopulation across some four thousand dry meadows in Finland’s Åland Islands, where local populations wink out and reappear every year.',
          s: 'His test case became the flagship of the field: the Glanville fritillary butterfly, living as a metapopulation across some four thousand dry meadows in Finland’s Oland Islands, where local populations wink out and reappear every year.' },
        { t: 'Two more forces shape persistence. Dispersal provides rescue, but it can also synchronize local dynamics, and so can shared weather, the Moran effect. When patches fluctuate in synchrony they crash together, and the spreading of risk that lets a metapopulation persist is lost.', pause: 1 },
      ],
      terms: [
        { beat: 0.45, term: 'Incidence function model', def: 'Hanski (1994): patch occupancy probability as a function of patch area and connectivity.' },
        { beat: 0.8, term: 'Connectivity', def: 'Distance-weighted influence of the surrounding occupied patches, scaled by their areas (Hanski\u2019s Sᵢ).' },
        { beat: 2.35, term: 'Spatial synchrony', def: 'Correlated fluctuations among local populations, raising the risk of simultaneous extinction.' },
        { beat: 2.55, term: 'Moran effect', def: 'Synchrony among populations induced by correlated environmental variation such as shared weather.' },
      ],
      init(S) {
        const MB = HMAP; const r = rng(5);
        // Åland-like archipelago: a large main island with ragged coast, plus a scattered eastern archipelago
        const landF = (u, v) => {
          const n1 = U.fbm2(u * 4.2, v * 4.2, 11, 4), n2 = U.fbm2(u * 13, v * 13, 23, 3);
          const m = 1 - ((u - 0.37) / 0.4) ** 2 - ((v - 0.5) / 0.47) ** 2, a = 1 - ((u - 0.8) / 0.3) ** 2 - ((v - 0.55) / 0.5) ** 2;
          const edge = U.smooth((u - 0.9) / 0.1) + U.smooth((0.08 - u) / 0.08) + U.smooth((v - 0.92) / 0.08) + U.smooth((0.08 - v) / 0.08);
          return Math.max(0.85 * m + 0.5 * n1 + 0.22 * n2 - 0.3, a > 0 ? 0.55 * n2 + 0.3 * n1 + 0.35 * a - 0.2 : -1) - 0.8 * edge;
        };
        const gw = 345, gh = 332; const F = new Float32Array(gw * gh);
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) F[j * gw + i] = landF((i + 0.5) / gw, (j + 0.5) / gh);
        const img = Theater.makeCanvas(gw, gh); const ic = img.getContext('2d'); const id = ic.createImageData(gw, gh);
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
          const k = j * gw + i; if (F[k] <= 0) continue;
          const coast = (i > 0 && F[k - 1] <= 0) || (i < gw - 1 && F[k + 1] <= 0) || (j > 0 && F[k - gw] <= 0) || (j < gh - 1 && F[k + gw] <= 0);
          const o = k * 4; if (coast) { id.data[o] = 200; id.data[o + 1] = 205; id.data[o + 2] = 190; id.data[o + 3] = 120; } else { id.data[o] = 120; id.data[o + 1] = 150; id.data[o + 2] = 110; id.data[o + 3] = 34; }
        }
        ic.putImageData(id, 0, 0);
        // meadows on land, sizes spanning two orders of magnitude in area
        const P = []; let tries = 0;
        while (P.length < 150 && tries < 60000) {
          tries++; const u = 0.04 + 0.92 * r(), v = 0.04 + 0.92 * r(); if (landF(u, v) < 0.06) continue;
          const rad = 3 + 10 * Math.pow(r(), 2.4); const x = MB.x + u * MB.w, y = MB.y + v * MB.h;
          if (P.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + rad + 5)) P.push({ x, y, r: rad, A: (rad / 6) ** 2 });
        }
        const n = P.length; const alpha = 1 / 38, b = 0.5, xE = 1, mu = 0.2, y0 = 2.5;
        const W = P.map((p) => P.map((q) => (p === q ? 0 : Math.exp(-alpha * Math.hypot(p.x - q.x, p.y - q.y)) * Math.pow(q.A, b))));
        const Sof = (occ) => P.map((_, i) => W[i].reduce((s, w, j) => s + w * occ[j], 0));
        // yearly stochastic patch occupancy model (Hanski's SPOM): E = μ/A^x, C = S²/(S² + y²)
        let occ = P.map(() => (r() < 0.5 ? 1 : 0)); const years = []; const cnt = new Float64Array(n);
        for (let yr = 0; yr < 260; yr++) {
          const Sx = Sof(occ); let col = 0, ext = 0;
          occ = occ.map((o, i) => { if (o) { if (r() < Math.min(1, mu / Math.pow(P[i].A, xE))) { ext++; return 0; } return 1; } if (r() < Sx[i] * Sx[i] / (Sx[i] * Sx[i] + y0 * y0)) { col++; return 1; } return 0; });
          if (yr >= 60) occ.forEach((o, i) => { cnt[i] += o; });
          if (yr >= 236) years.push({ occ: occ.slice(), col, ext, p: occ.reduce((a, v) => a + v, 0) / n });
        }
        // incidence J_i from the IFM, with connectivity from long-run occupancy; e′ fitted to the mean
        const pbar = Array.from(cnt, (c) => c / 200); const Sb = Sof(pbar); const target = pbar.reduce((a, v) => a + v, 0) / n;
        let lo = 1e-3, hi = 1e3; let J = [];
        for (let it = 0; it < 50; it++) { const e1 = Math.sqrt(lo * hi); J = P.map((q, i) => 1 / (1 + e1 / (Sb[i] * Sb[i] * Math.pow(q.A, xE) + 1e-9))); const m = J.reduce((a, v) => a + v, 0) / n; if (m > target) lo = e1; else hi = e1; }
        const eFit = Math.sqrt(lo * hi); const sortedS = Sb.slice().sort((a, c) => a - c); const sHi = sortedS[Math.floor(n * 0.9)], sLo = sortedS[Math.floor(n * 0.3)];
        // base layer: land, coast and meadow outlines
        const base = Theater.makeCanvas(MB.w + 40, MB.h + 40); const c = base.getContext('2d');
        c.imageSmoothingEnabled = true; c.drawImage(img, 20, 20, MB.w, MB.h);
        c.translate(20 - MB.x, 20 - MB.y);
        for (const p of P) { c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fillStyle = 'rgba(16,32,31,0.95)'; c.fill(); c.strokeStyle = 'rgba(174,184,177,0.55)'; c.lineWidth = 1.2; c.stroke(); }
        // focal patch for connectivity: a mid-sized meadow in a well-populated neighbourhood
        let foc = 0, best = -1; P.forEach((p, i) => { const u = (p.x - MB.x) / MB.w, v = (p.y - MB.y) / MB.h; if (u > 0.25 && u < 0.6 && v > 0.3 && v < 0.7 && p.r > 4 && p.r < 8 && Sb[i] > best) { best = Sb[i]; foc = i; } });
        const links = P.map((q, j) => [j, pbar[j] * W[foc][j]]).filter(([j, w]) => j !== foc && w > 0.002).sort((a2, b2) => b2[1] - a2[1]).slice(0, 30);
        const wMax = links.length ? links[0][1] : 1;
        // rescue: a small patch with occupied neighbours
        let res = 0, rb = -1; P.forEach((p, i) => { const u = (p.x - MB.x) / MB.w; if (u > 0.15 && u < 0.5 && p.r < 6 && Sb[i] > rb && i !== foc) { rb = Sb[i]; res = i; } });
        const resSrc = P.map((q, j) => [j, Math.hypot(q.x - P[res].x, q.y - P[res].y)]).filter(([j]) => j !== res).sort((a2, b2) => a2[1] - b2[1]).slice(0, 3).map(([j]) => j);
        // Moran crash: which occupied patches crash out as the shared weather passes
        const crash = P.map(() => r() < 0.7);
        return { P, base, years, J, Sb, eFit, sHi, sLo, xE, foc, links, wMax, res, resSrc, crash };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx; const MB = HMAP; const RX = 840; const P = D.P;
        const tY0 = S.b(1) + 0.3, YD = 0.85, tF0 = S.b(2) + sd(S, 2, 1, 0.66), tF1 = tF0 + 3.6;
        const fx = (tt) => lerp(MB.x - 160, MB.x + MB.w + 160, clamp((tt - tF0) / (tF1 - tF0)));
        // ---------------- map
        const ma = S.p(0, 1, 0.1);
        label(g, 'Åland Islands · meadow network (schematic)', MB.x + 10, 262, ma);
        g.withAlpha(ma, () => ctx.drawImage(D.base, MB.x - 20, MB.y - 20));
        // compass + scale
        g.withAlpha(ma * 0.8, () => { const x = MB.x + 160, y = MB.y + MB.h - 52; g.arrow(x, y + 26, x, y - 18, { color: PAL.ink3, w: 2, head: 11 }); g.text('N', x + 16, y + 10, { size: 19, color: PAL.ink3, weight: 600 }); g.line(MB.x + 20, MB.y + MB.h - 8, MB.x + 120, MB.y + MB.h - 8, { color: PAL.ink3, w: 2.5 }); g.text('10 km', MB.x + 70, MB.y + MB.h - 18, { size: 19, color: PAL.ink3, align: 'center' }); });
        const yi = Math.max(0, Math.min(D.years.length - 1, Math.floor((Math.min(t, tF0) - tY0) / YD)));
        const yPrev = Math.max(0, yi - 1); const yFrac = (Math.min(t, tF0) - tY0) / YD - yi;
        const jA = S.p(0, 1.2, sd(S, 0, 1, 0.22)); const modeY = S.p(1, 0.8, 0.1);
        const crashed = (i) => t > tF0 && D.crash[i] ? ease.inOut((t - (tF0 + (P[i].x - MB.x + 160) / (MB.w + 320) * (tF1 - tF0))) / 0.9) : 0;
        // patch intensities, drawn in alpha buckets (one path each)
        const NB = 12; const buckets = Array.from({ length: NB }, () => []); const rings = [];
        for (let i = 0; i < P.length; i++) {
          let a = D.J[i] * jA * (1 - modeY);
          if (modeY > 0 && t >= tY0) {
            const now = D.years[yi].occ[i], was = D.years[yPrev].occ[i]; const u = yi === 0 ? 1 : ease.inOut(yFrac / 0.35);
            let o = was + (now - was) * u; if (now !== was && yi > 0 && yFrac < 0.6 && t < tF0) rings.push([i, now, yFrac / 0.6]);
            o *= 1 - crashed(i); a = lerp(a, o, modeY);
          } else if (modeY > 0) a = lerp(a, D.years[0].occ[i], modeY);
          if (a > 0.02) buckets[Math.min(NB - 1, Math.round(a * (NB - 1)))].push(i);
        }
        ctx.save();
        buckets.forEach((list, k) => {
          if (!list.length || k === 0) return; const a = k / (NB - 1); ctx.beginPath();
          for (const i of list) { const p = P[i]; ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, TAU); }
          ctx.globalAlpha = ma * (0.15 + 0.75 * a); ctx.fillStyle = COL; ctx.fill();
          ctx.globalAlpha = ma * a; ctx.strokeStyle = MINT_LT; ctx.lineWidth = 1; ctx.stroke();
        });
        ctx.restore();
        for (const [i, on, u] of rings) g.circle(P[i].x, P[i].y, P[i].r + 2 + 10 * u, { stroke: on ? COL : PAL.coral, w: 2, alpha: (1 - u) * 0.9 });
        // connectivity of a focal patch (beat 0)
        const cA = S.p(0, 0.8, sd(S, 0, 1, 0.56)) * (1 - S.p(1, 0.6));
        if (cA > 0) {
          const f = P[D.foc]; const lp = S.p(0, 2.0, sd(S, 0, 1, 0.68));
          D.links.forEach(([j, w], k) => { const q = P[j]; const s = w / D.wMax; g.line(q.x, q.y, f.x, f.y, { color: PAL.ochre, w: 1.4 + 4.5 * s, alpha: cA * (0.45 + 0.55 * s), progress: clamp(lp * 1.6 - k * 0.025) }); });
          g.circle(f.x, f.y, f.r + 8, { stroke: PAL.ochre, w: 2.5, alpha: cA });
          g.pill('connectivity Sᵢ', f.x, f.y - f.r - 32, { size: 21, color: PAL.ochre, align: 'center', alpha: cA, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.ochre, 0.6) });
        }
        // year counter (beat 1–2)
        const yA = modeY * S.p(1, 0.6, 0.3);
        g.text(`year ${yi + 1}`, MB.x + MB.w - 10, MB.y + MB.h - 10, { size: 26, role: 'mono', color: PAL.ink, align: 'right', alpha: yA });
        // the butterfly crosses the network (beat 1)
        const bfT = S.since(1) - sd(S, 1, 0, 0.18);
        if (bfT > 0 && bfT < 6) {
          const u = bfT / 6; const x = lerp(MB.x + 60, MB.x + MB.w - 80, u), y = MB.y + MB.h * (0.62 - 0.3 * u) + 40 * Math.sin(u * 9);
          fritillary(g, x, y, 46, 0.5 + 0.5 * Math.sin(bfT * 15), Math.min(1, bfT * 2, (6 - bfT) * 2));
        }
        // rescue (beat 2)
        const rA = S.p(2, 0.6, sd(S, 2, 1, 0.05)) * (1 - S.p(2, 0.6, sd(S, 2, 1, 0.6)));
        if (rA > 0) {
          const p = P[D.res];
          D.resSrc.forEach((j, k) => { const q = P[j]; const u = ((S.since(2) - sd(S, 2, 1, 0.05)) * 0.7 + k / 3) % 1; g.carrow(q.x, q.y, p.x, p.y, 0.3, { color: PAL.lagoon, w: 2, head: 9, alpha: rA * 0.7 }); const mx = (q.x + p.x) / 2 - (p.y - q.y) * 0.3, my = (q.y + p.y) / 2 + (p.x - q.x) * 0.3; const x = (1 - u) * (1 - u) * q.x + 2 * (1 - u) * u * mx + u * u * p.x, y = (1 - u) * (1 - u) * q.y + 2 * (1 - u) * u * my + u * u * p.y; g.dot(x, y, 3.2, MINT_LT, rA, 3); });
          g.circle(p.x, p.y, p.r + 7, { stroke: PAL.lagoon, w: 2.5, alpha: rA });
          g.pill('rescue effect', p.x, p.y + p.r + 30, { size: 21, color: PAL.lagoon, align: 'center', alpha: rA, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.lagoon, 0.6) });
        }
        // the Moran effect: a shared weather front sweeps the whole network
        if (t > tF0 - 0.3 && t < tF1 + 1.2) {
          const x = fx(t); const a = Math.min(1, (t - tF0 + 0.3) * 2, (tF1 + 1.2 - t) * 1.5);
          g.clip(MB.x - 20, 282, MB.w + 40, MB.y + MB.h + 10 - 282, () => {
            const gr = ctx.createLinearGradient(x - 170, 0, x + 40, 0); gr.addColorStop(0, U.rgba(PAL.heather, 0)); gr.addColorStop(0.75, U.rgba(PAL.heather, 0.22)); gr.addColorStop(1, U.rgba(PAL.heather, 0));
            ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = gr; ctx.fillRect(x - 170, MB.y - 20, 210, MB.h + 40);
            ctx.strokeStyle = U.rgba(PAL.heather, 0.5); ctx.lineWidth = 1.5; ctx.beginPath();
            for (let k = 0; k < 40; k++) { const yy = MB.y + ((k * 97 + t * 260) % (MB.h + 40)) - 20, xx = x - 150 + ((k * 53) % 170); ctx.moveTo(xx, yy); ctx.lineTo(xx - 6, yy + 18); }
            ctx.stroke(); ctx.restore();
          });
        }
        const mA = S.p(2, 0.8, sd(S, 2, 1, 0.78)) * (1 - S.p(2, 0.6, sd(S, 2, 2, 0.6)));
        g.pill('shared weather: the Moran effect', MB.x + MB.w / 2, MB.y + 74, { size: 21, color: PAL.heather, align: 'center', alpha: mA, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.heather, 0.6) });
        const kA = S.p(2, 0.8, sd(S, 2, 2, 0.35));
        g.pill('local populations crash together', MB.x + MB.w / 2, MB.y + 74, { size: 21, color: PAL.coral, align: 'center', alpha: kA, fill: 'rgba(11,22,24,0.9)', stroke: U.rgba(PAL.coral, 0.6) });

        // ---------------- right panel, beat 0: the incidence function model
        const hA = S.p(0, 0.8, 0.3) * (1 - S.p(0, 0.6, sd(S, 0, 1, 0.12)));
        g.text('Ilkka Hanski', RX, 470, { size: 52, role: 'display', color: PAL.ink, alpha: hA });
        g.text('1953–2016', RX, 512, { size: 24, color: PAL.ink2, alpha: hA });
        g.text('metapopulations in real, fragmented landscapes', RX, 556, { size: 22, color: COL, alpha: hA * S.p(0, 0.8, 1.2) });
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Incidence function model · Hanski 1994', RX, 262, S.p(0, 0.8, sd(S, 0, 1, 0.02)));
          g.math('J_i = \\frac{1}{1 + e′/(S_i^{2} A_i^{x})}', RX, 336, { size: 40, alpha: S.p(0, 0.8, sd(S, 0, 1, 0.2)) });
          g.text('probability that patch i is occupied', RX, 394, { size: 21, color: PAL.ink2, alpha: S.p(0, 0.8, sd(S, 0, 1, 0.26)) });
          const eA = S.p(0, 0.8, sd(S, 0, 1, 0.44));
          g.math('E_i = μ/A_i^{x}', RX, 440, { size: 34, color: PAL.coral, alpha: eA });
          g.text('extinction risk falls with area', RX + 200, 436, { size: 21, color: PAL.ink2, alpha: eA });
          const sA = S.p(0, 0.8, sd(S, 0, 1, 0.62));
          g.math('S_i = \\sum_{j≠i} p_j\\, e^{−\\!α d_{ij}} A_j^{b}', RX, 512, { size: 38, color: PAL.ochre, alpha: sA });
          g.text('occupied neighbours, discounted by distance', RX, 556, { size: 21, color: PAL.ink2, alpha: S.p(0, 0.8, sd(S, 0, 1, 0.84)) });
          // incidence curves: J vs area for well-connected and isolated patches
          const pA = S.p(0, 1, sd(S, 0, 1, 0.32));
          const A = g.axes({ x: RX + 56, y: 630, w: 390, h: 196, xmin: 0.2, xmax: 5, ymin: 0, ymax: 1.08, logx: true, xlab: 'patch area (log)', labSize: 22, progress: pA, yticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }] });
          g.math('J_i', RX + 42, 624, { size: 28, align: 'right', alpha: pA });
          const Jc = (s) => (a) => 1 / (1 + D.eFit / (s * s * Math.pow(a, D.xE)));
          g.plot(A, Jc(D.sHi), { color: PAL.lagoon, w: 3.4, progress: S.p(0, 1.4, sd(S, 0, 1, 0.36)) });
          g.plot(A, Jc(D.sLo), { color: PAL.ink2, w: 3, dash: [8, 6], progress: S.p(0, 1.4, sd(S, 0, 1, 0.62)) });
          const da = S.p(0, 1, sd(S, 0, 1, 0.4));
          if (da > 0) { ctx.save(); ctx.globalAlpha *= da * 0.8; ctx.fillStyle = COL; ctx.beginPath(); P.forEach((p, i) => { if (p.A < 0.2 || p.A > 5) return; const x = A.X(p.A), y = A.Y(D.J[i]); ctx.moveTo(x + 3, y); ctx.arc(x, y, 3, 0, TAU); }); ctx.fill(); ctx.restore(); }
          const l1 = S.p(0, 0.8, sd(S, 0, 1, 0.4)), l2 = S.p(0, 0.8, sd(S, 0, 1, 0.66));
          g.line(RX, 598, RX + 34, 598, { color: PAL.lagoon, w: 3.4, alpha: l1 }); g.text('well connected', RX + 44, 605, { size: 21, color: PAL.lagoon, alpha: l1 });
          g.line(RX + 230, 598, RX + 264, 598, { color: PAL.ink2, w: 3, dash: [8, 6], alpha: l2 }); g.text('isolated', RX + 274, 605, { size: 21, color: PAL.ink2, alpha: l2 });
        });
        // ---------------- right panel, beat 1: the Glanville fritillary
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          label(g, 'The flagship system', RX, 262);
          const bA = S.p(1, 1, sd(S, 1, 0, 0.18));
          fritillary(g, RX + 120, 380, 170, 0.62 + 0.38 * Math.sin(t * 3.2), bA);
          g.text('Glanville fritillary', RX + 250, 370, { size: 34, role: 'display', color: PAL.ink, alpha: bA });
          g.text('Melitaea cinxia', RX + 250, 404, { size: 23, role: 'display', italic: true, color: PAL.ochre, alpha: bA });
          const mA = S.p(1, 0.8, sd(S, 1, 0, 0.45));
          g.text('≈ 4,000 dry meadows', RX, 520, { size: 34, role: 'display', color: PAL.ink, alpha: mA });
          g.text('Åland Islands, Finland', RX, 556, { size: 22, color: PAL.ink2, alpha: S.p(1, 0.8, sd(S, 1, 0, 0.66)) });
          // yearly turnover: regional occupancy stays put while local populations blink
          const tA = S.p(1, 0.8, sd(S, 1, 0, 0.74));
          if (tA > 0) g.withAlpha(tA, () => {
            const ny = D.years.length; const A = g.axes({ x: RX + 56, y: 616, w: 390, h: 110, xmin: 0, xmax: ny, ymin: 0, ymax: 1, arrows: false, yticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }] });
            g.math('p', RX + 34, 640, { size: 26, align: 'right' });
            const upto = Math.min(yi, ny - 1); const pts = []; for (let k = 0; k <= upto; k++) pts.push([k + 0.5, D.years[k].p]);
            if (pts.length > 1) g.data(A, pts, { color: COL, w: 3 });
            const by = 800; g.line(A.X(0), by, A.X(ny), by, { color: PAL.ink3, w: 1 });
            for (let k = 0; k <= upto; k++) { const yv = D.years[k]; const x = A.X(k + 0.5); g.rect(x - 5.5, by - yv.col * 1.3, 5, yv.col * 1.3, { fill: COL, alpha: 0.85 }); g.rect(x + 0.5, by, 5, yv.ext * 1.3, { fill: PAL.coral, alpha: 0.85 }); }
            g.text('regional occupancy', RX + 64, 606, { size: 21, color: COL });
            g.rect(RX + 56, 878, 12, 12, { fill: COL }); g.text('colonizations per year', RX + 76, 890, { size: 21, color: COL });
            g.rect(RX + 300, 878, 12, 12, { fill: PAL.coral }); g.text('extinctions', RX + 320, 890, { size: 21, color: PAL.coral });
          });
        });
        // ---------------- right panel, beat 2: synchrony
        const v2 = S.p(2, 0.9, 0.2);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Synchrony & the Moran effect', RX, 262);
          const series = (A, ph, col, pr, jit) => g.plot(A, (x) => clamp(0.52 + 0.36 * Math.sin(x * 1.25 + ph) + 0.07 * Math.sin(x * 3.1 + jit), 0, 1), { color: col, w: 3, progress: pr });
          // out of phase
          const p1 = S.lin(2, 4, sd(S, 2, 1, 0.3));
          g.text('out of phase: risk is spread', RX, 304, { size: 22, color: PAL.ink, alpha: S.p(2, 0.8, sd(S, 2, 1, 0.3)) });
          const A1 = g.axes({ x: RX + 56, y: 350, w: 390, h: 150, xmin: 0, xmax: 12, ymin: 0, ymax: 1.05, xlab: 't', ylab: 'N', progress: S.p(2, 0.8, sd(S, 2, 1, 0.3)) });
          series(A1, 0, PAL.lagoon, p1, 0); series(A1, Math.PI, PAL.ochre, p1, 2);
          g.plot(A1, (x) => 0.52 + 0.035 * (Math.sin(x * 3.1) + Math.sin(x * 3.1 + 2)), { color: PAL.ink, w: 2, dash: [6, 6], progress: p1, alpha: 0.8 });
          g.line(RX + 330, 297, RX + 360, 297, { color: PAL.ink, w: 2, dash: [6, 5], alpha: p1 > 0.6 ? 0.8 : 0 }); g.text('regional total', RX + 368, 304, { size: 19, color: PAL.ink2, alpha: p1 > 0.6 ? 1 : 0 });
          // in phase
          const p2 = S.lin(2, 4, sd(S, 2, 2, 0.05));
          g.text('in phase: they crash together', RX, 584, { size: 22, color: PAL.ink, alpha: S.p(2, 0.8, sd(S, 2, 2, 0.05)) });
          const A2 = g.axes({ x: RX + 56, y: 628, w: 390, h: 150, xmin: 0, xmax: 12, ymin: 0, ymax: 1.05, xlab: 't', ylab: 'N', progress: S.p(2, 0.8, sd(S, 2, 2, 0.05)) });
          const f2 = (ph, jit) => (x) => clamp(0.48 + 0.42 * Math.sin(x * 1.25 + ph) + 0.05 * Math.sin(x * 3.1 + jit) - (x > 8.2 ? 0.6 * (x - 8.2) : 0), 0, 1);
          g.line(A2.X(0), A2.Y(0.06), A2.X(12), A2.Y(0.06), { color: PAL.coral, w: 1.4, dash: [4, 5], alpha: p2 > 0 ? 0.8 : 0 });
          g.plot(A2, f2(0, 0), { color: PAL.lagoon, w: 3, progress: p2 }); g.plot(A2, f2(0.18, 2), { color: PAL.ochre, w: 3, progress: p2 });
          const xa = S.p(2, 0.6, sd(S, 2, 2, 0.05) + 3.6);
          g.text('×', A2.X(9.1), A2.Y(0) - 8, { size: 34, color: PAL.coral, align: 'center', weight: 700, alpha: xa });
          g.text('both lost at once', A2.X(9.1) + 22, A2.Y(0.3), { size: 21, color: PAL.coral, alpha: xa });
          const nA = S.p(2, 0.8, sd(S, 2, 2, 0.6));
          g.text('synchrony raises the risk of', RX, 850, { size: 24, role: 'display', italic: true, color: PAL.coral, alpha: nA });
          g.text('regional extinction', RX, 880, { size: 24, role: 'display', italic: true, color: PAL.coral, alpha: nA });
        });
      },
    },
  ],
});
})();
