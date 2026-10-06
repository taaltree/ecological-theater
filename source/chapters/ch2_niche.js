/* Chapter II — Niche theory. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.ochre;
const { rgba, mix, smooth } = U;
const TAU = Math.PI * 2;

// Small shared helpers ---------------------------------------------------------
const label = (g, s, x, y, a = 1, col = PAL.ink3, align = 'left') => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a, align });
// visibility envelope: fade in at beat k0, fade out at beat k1 (optional, with delay)
const vis = (S, k0, k1, d = 0.8, outDelay = 0) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6, outDelay));
// keyframed scalar: keys = [[t, v], ...] with eased segments
const keyed = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let k = 1; k < keys.length; k++) if (t <= keys[k][0]) { const [t0, v0] = keys[k - 1], [t1, v1] = keys[k]; return lerp(v0, v1, ease.inOut((t - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
};
const gaussPdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2);

// California thrasher (Toxostoma redivivum): long decurved bill, long tail. Origin at the feet, faces right; s ≈ body scale in px.
function thrasher(g, x, y, s, o = {}) {
  const ctx = g.ctx; const col = o.color || PAL.sand; const belly = o.belly || mix(PAL.ochre, PAL.sand, 0.45);
  if ((o.alpha ?? 1) <= 0) return;
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); if (o.flip) ctx.scale(-1, 1); ctx.scale(s, s);
  if (o.peck) { ctx.translate(0.05, -0.3); ctx.rotate(o.peck); ctx.translate(-0.05, 0.3); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = 0.04;
  ctx.beginPath(); ctx.moveTo(-0.02, -0.3); ctx.lineTo(-0.05, 0); ctx.moveTo(0.09, -0.3); ctx.lineTo(0.11, 0); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-0.16, -0.52); ctx.lineTo(-0.94, -0.8); ctx.lineTo(-0.98, -0.67); ctx.lineTo(-0.2, -0.38); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.02, -0.47, 0.34, 0.2, -0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0.07, -0.38, 0.22, 0.09, -0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0.32, -0.65, 0.13, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.41, -0.72); ctx.quadraticCurveTo(0.68, -0.72, 0.8, -0.48); ctx.quadraticCurveTo(0.64, -0.63, 0.41, -0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.bg; ctx.beginPath(); ctx.arc(0.35, -0.68, 0.03, 0, TAU); ctx.fill();
  ctx.restore();
}

// Soaring raptor seen from below (broad wings, fanned tail).
function hawk(g, x, y, s, col, o = {}) {
  const ctx = g.ctx; const fl = o.flap ?? 0;
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 2, 8, 24, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -22, 7.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(-13, 46); ctx.quadraticCurveTo(0, 52, 13, 46); ctx.lineTo(6, 22); ctx.closePath(); ctx.fill();
  for (const sd of [-1, 1]) {
    const tipY = -14 + fl * 10;
    ctx.beginPath(); ctx.moveTo(sd * 5, -10); ctx.quadraticCurveTo(sd * 30, -26 + fl * 6, sd * 50, tipY); ctx.lineTo(sd * 46, tipY + 8); ctx.lineTo(sd * 52, tipY + 12); ctx.lineTo(sd * 44, tipY + 16); ctx.quadraticCurveTo(sd * 26, 6, sd * 5, 8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// Chaparral shrub (manzanita-like: red stems, dense rounded canopy). Drawn once into an offscreen canvas.
function shrub(c, x, y, w, h, seed) {
  const r = rng(seed); const stem = mix(PAL.coral, PAL.bg, 0.42);
  for (let k = 0; k < 5; k++) { const bx = x + (r() - 0.5) * w * 0.3; c.poly([[bx, y + 2], [bx + (r() - 0.5) * w * 0.3, y - h * 0.3], [x + (r() - 0.5) * w * 0.7, y - h * 0.62]], { color: stem, w: 3.2 }); }
  const dark = mix(PAL.moss, PAL.bg, 0.66), mid = mix(PAL.moss, PAL.bg, 0.5), lite = mix(PAL.moss, PAL.bg, 0.3);
  const blobs = [];
  for (let k = 0; k < 8; k++) blobs.push([x + (r() - 0.5) * w * 0.72, y - h * (0.42 + 0.36 * r()), w * (0.16 + 0.1 * r()), h * (0.2 + 0.1 * r())]);
  blobs.forEach(([bx, by, rx, ry]) => c.ellipse(bx, by, rx, ry, { fill: dark }));
  blobs.forEach(([bx, by, rx, ry]) => c.ellipse(bx - rx * 0.1, by - ry * 0.2, rx * 0.78, ry * 0.7, { fill: mid }));
  blobs.forEach(([bx, by, rx, ry]) => c.ellipse(bx - rx * 0.25, by - ry * 0.42, rx * 0.38, ry * 0.3, { fill: lite, alpha: 0.55 }));
  for (let k = 0; k < 26; k++) { const [bx, by, rx, ry] = blobs[k % blobs.length]; c.circle(bx + (r() - 0.5) * rx * 1.4, by + (r() - 0.5) * ry * 1.2, 1.6, { fill: lite, alpha: 0.7 }); }
}

// Orthographic camera: yaw th about the vertical axis, then pitch ph (looking down). Returns projector.
function camera(th, ph, ox, oy, L) {
  const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
  // right-handed: x right, y up, z toward the viewer at th = ph = 0
  const R = [[ct, 0, -st], [-st * sp, cp, -ct * sp], [-st * cp, -sp, -ct * cp]];
  const P = (x, y, z) => [ox + L * (R[0][0] * x + R[0][2] * z), oy - L * (R[1][0] * x + R[1][1] * y + R[1][2] * z), R[2][0] * x + R[2][1] * y + R[2][2] * z];
  const depth = (x, y, z) => R[2][0] * x + R[2][1] * y + R[2][2] * z;
  return { R, P, depth, L, ox, oy, ct, st, cp, sp };
}
// Silhouette of an axis-aligned ellipsoid (centre c, semi-axes a,b,cz) under camera C, as screen points.
function ellipsoidOutline(C, cx, cy, cz, a, b, c, n = 72) {
  const [X0, Y0] = C.P(cx, cy, cz); const R = C.R;
  const A = [[R[0][0] * a, R[0][1] * b, R[0][2] * c], [R[1][0] * a, R[1][1] * b, R[1][2] * c]];
  const m11 = A[0][0] ** 2 + A[0][1] ** 2 + A[0][2] ** 2, m12 = A[0][0] * A[1][0] + A[0][1] * A[1][1] + A[0][2] * A[1][2], m22 = A[1][0] ** 2 + A[1][1] ** 2 + A[1][2] ** 2;
  const l11 = Math.sqrt(m11), l21 = m12 / l11, l22 = Math.sqrt(Math.max(1e-9, m22 - l21 * l21));
  const pts = []; for (let k = 0; k <= n; k++) { const u = k / n * TAU, cu = Math.cos(u), su = Math.sin(u); pts.push([X0 + C.L * l11 * cu, Y0 - C.L * (l21 * cu + l22 * su)]); }
  return pts;
}
// Wireframe rings on the ellipsoid, front segments bright and back segments faint.
function ellipsoidWire(g, C, cx, cy, cz, a, b, c, col, aF, aB, nLat = 6, nLon = 6) {
  const ctx = g.ctx; const front = new Path2D(), back = new Path2D(); const N = 56;
  const ring = (fn) => {
    let prev = null;
    for (let k = 0; k <= N; k++) {
      const [px, py, pz, nx, ny, nz] = fn(k / N * TAU); const q = C.P(px, py, pz);
      if (prev) { const vis = C.depth(nx + prev[2], ny + prev[3], nz + prev[4]) < 0; const path = vis ? front : back; path.moveTo(prev[0], prev[1]); path.lineTo(q[0], q[1]); }
      prev = [q[0], q[1], nx, ny, nz];
    }
  };
  for (let i = 1; i <= nLat; i++) { const v = -Math.PI / 2 + Math.PI * i / (nLat + 1), cv = Math.cos(v), sv = Math.sin(v); ring((u) => [cx + a * cv * Math.cos(u), cy + b * sv, cz + c * cv * Math.sin(u), cv * Math.cos(u) / a, sv / b, cv * Math.sin(u) / c]); }
  for (let i = 0; i < nLon; i++) { const u = Math.PI * i / nLon, cu = Math.cos(u), su = Math.sin(u); ring((w) => [cx + a * Math.cos(w) * cu, cy + b * Math.sin(w), cz + c * Math.cos(w) * su, Math.cos(w) * cu / a, Math.sin(w) / b, Math.cos(w) * su / c]); }
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.globalAlpha = aB; ctx.stroke(back); ctx.lineWidth = 1.8; ctx.globalAlpha = aF; ctx.stroke(front); ctx.restore();
}
// Camera whose view of the point `ctr` lands on screen (sx, sy).
function cameraAt(th, ph, sx, sy, L, ctr = [0.5, 0.5, 0.5]) {
  const C0 = camera(th, ph, 0, 0, L); const q = C0.P(...ctr); return camera(th, ph, sx - q[0], sy - q[1], L);
}
// Hutchinson's niche: axes with tolerance intervals, the region where the species persists, extruded into 3D by e.
function drawHypervolume(g, C, t, D, e, o) {
  const col = PAL.heather; const ext = Math.max(0.002, e);
  const cx = 0.5, cy = 0.5, cz = 0.5, a = 0.32, b = 0.24, c = 0.2 * ext;
  const iv = [[0.18, 0.82], [0.26, 0.74], [0.3, 0.7]];
  const reg = o.region ?? 1, per = o.persist ?? 0;
  if (!o.mini) {
    const O = C.P(0, 0, 0); const ends = [[1.12, 0, 0], [0, 0.98, 0], [0, 0, 1.12]];
    // box from the tolerance intervals (dashed), and drop lines in the flat view
    const zl = cz - c, zh = cz + c;
    const corners = []; for (const X of iv[0]) for (const Y of iv[1]) for (const Z of [zl, zh]) corners.push(C.P(X, Y, Z));
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const aBox = reg * 0.5;
    edges.forEach(([i, j]) => g.line(corners[i][0], corners[i][1], corners[j][0], corners[j][1], { color: PAL.ink3, w: 1.3, dash: [5, 6], alpha: aBox }));
    const drop = reg * (1 - e) * 0.6;
    if (drop > 0) {
      iv[0].forEach((X) => { const p = C.P(X, 0, 0.5), q = C.P(X, iv[1][0], 0.5); g.line(p[0], p[1], q[0], q[1], { color: PAL.ink3, w: 1.2, dash: [4, 6], alpha: drop }); });
      iv[1].forEach((Y) => { const p = C.P(0, Y, 0.5), q = C.P(iv[0][0], Y, 0.5); g.line(p[0], p[1], q[0], q[1], { color: PAL.ink3, w: 1.2, dash: [4, 6], alpha: drop }); });
    }
    ends.forEach((p, k) => { if (o.ax[k] > 0.01) { const q = C.P(...p); g.arrow(O[0], O[1], q[0], q[1], { color: PAL.ink2, w: 2.2, head: 13, progress: o.ax[k] }); } });
    iv.forEach(([v0, v1], k) => {
      const ak = o.lab[k] > 0.01 ? ease.out(o.lab[k]) : 0; if (ak <= 0) return;
      const P0 = C.P(...[0, 1, 2].map((j) => (j === k ? v0 : 0))), P1 = C.P(...[0, 1, 2].map((j) => (j === k ? v1 : 0)));
      g.line(P0[0], P0[1], lerp(P0[0], P1[0], ak), lerp(P0[1], P1[1], ak), { color: col, w: 7, alpha: 0.85 });
    });
    if (o.labels) {
      const q0 = C.P(1.12, 0, 0), q1 = C.P(0, 0.98, 0), q2 = C.P(0, 0, 1.12);
      g.text('temperature', q0[0] + 18, q0[1] + 8, { size: 22, color: PAL.ink2, alpha: o.lab[0] });
      g.text('moisture', q1[0] - 18, q1[1] + 8, { size: 22, color: PAL.ink2, align: 'right', alpha: o.lab[1] });
      g.text('food size', q2[0] - 14, q2[1] + 8, { size: 22, color: PAL.ink2, align: 'right', alpha: o.lab[2] });
      const m = C.P(0.5, 0, 0);
      g.text('tolerance limits', m[0], m[1] + 36, { size: 21, color: col, align: 'center', alpha: o.lab[0] * (1 - e) });
    }
  }
  if (reg <= 0) return;
  const out = ellipsoidOutline(C, cx, cy, cz, a, b, c);
  const ctr = C.P(cx, cy, cz);
  g.glow(ctr[0], ctr[1], C.L * 0.45, col, (0.1 + 0.18 * per) * reg);
  g.poly(out, { fill: rgba(mix(PAL.bg, col, 0.22), 0.88), color: null, w: 0, alpha: reg * clamp(e * 3), close: true });
  g.poly(out, { fill: rgba(col, 0.1 + 0.1 * per), color: col, w: 2.6, alpha: reg, close: true });
  if (e > 0.02) ellipsoidWire(g, C, cx, cy, cz, a, b, c, col, 0.5 * e * reg, 0.13 * e * reg);
  if (per > 0) D.ball.forEach(([u, v, w], k) => {
    const d = C.depth(u * a, v * b, w * c); const q = C.P(cx + a * u, cy + b * v, cz + c * w);
    const tw = 0.75 + 0.25 * Math.sin(t * 2 + k * 1.7);
    g.dot(q[0], q[1], o.mini ? 2.2 : 3, mix(col, PAL.ink, 0.55), per * reg * tw * (d < 0 ? 0.95 : 0.4), 2.2);
  });
  return { out, ctr };
}
// Barnacle in profile: base on the rock at (x, y), opening along the outward normal (nx, ny); w = basal width.
function barnacle(g, x, y, nx, ny, w, col, o = {}) {
  const ctx = g.ctx; const a = o.alpha ?? 1; if (a <= 0) return; const h = w * 0.62;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(Math.atan2(nx, -ny));
  if (o.feed > 0.02) {
    ctx.save(); ctx.globalAlpha *= o.feed; ctx.strokeStyle = mix(col, PAL.ink, 0.35); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { const s = Math.sin(o.phase + k); ctx.beginPath(); ctx.moveTo(k * w * 0.05, -h); ctx.quadraticCurveTo(k * w * 0.16 + s * w * 0.12, -h - w * 0.32, k * w * 0.3 + s * w * 0.22, -h - w * 0.2); ctx.stroke(); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-w / 2, 3); ctx.lineTo(-w * 0.2, -h); ctx.lineTo(w * 0.2, -h); ctx.lineTo(w / 2, 3); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = PAL.bg; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = rgba(PAL.bg, 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-w * 0.07, -h); ctx.lineTo(-w * 0.2, 2); ctx.moveTo(w * 0.07, -h); ctx.lineTo(w * 0.2, 2); ctx.stroke();
  ctx.restore();
}
// Classical architectural niche (arched alcove). (x, yb) = bottom centre.
function alcove(g, x, yb, w, h, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return; const r = w / 2; const ctx = g.ctx;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.moveTo(x - r, yb); ctx.lineTo(x - r, yb - h + r); ctx.arc(x, yb - h + r, r, Math.PI, 0); ctx.lineTo(x + r, yb); ctx.closePath();
  const gr = ctx.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = o.color || PAL.ink2; ctx.lineWidth = o.w || 2.4; ctx.setLineDash(o.dash || []); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(x, yb - h + r, r - 10, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
  g.rect(x - r - 14, yb, w + 28, 12, { fill: rgba(PAL.ink, 0.1), stroke: o.color || PAL.ink2, w: 1.5, alpha: a });
}

Theater.chapter({
  id: 'niche', roman: 'II', title: 'Niche Theory', color: COL,
  question: 'Where can a species live, and what does it do there?',
  intro: { t: 'Chapter two. Niche theory: what a species needs, and what it does.' },
  motif(g, t) {
    // three resource-utilization curves along one niche axis
    const A = { X: (v) => 1120 + v * 66, Y: (v) => 340 - v * 190 };
    g.line(1100, 340, 1800, 340, { color: PAL.ink, w: 1.5, alpha: 0.22 * ease.inOut((t - 0.3) / 1.5) });
    [[2.9, PAL.lagoon], [5.1, COL], [7.3, PAL.rose]].forEach(([m, col], k) => {
      const p = ease.inOut((t - 0.6 - k * 0.45) / 2.2);
      g.plot(A, (x) => Math.exp(-((x - m) ** 2) / 1.5), { from: m - 2.9, to: m + 2.9, color: col, w: 2.5, alpha: 0.34, progress: p });
    });
  },
  scenes: [
    {
      id: 'niche-concepts', title: 'Three ideas of the niche',
      beats: [
        { t: 'The niche is ecology’s most used, and most argued-over, concept. Joseph Grinnell, in 1917, framed it as a species’ habitat requirements: the conditions where it can live. The niche of his California thrasher was the chaparral that met its needs for food, cover, and nesting.',
          s: 'The niche is ecology’s most used, and most argued over, concept. Joseph Grin-nell, in 1917, framed it as a species’ habitat requirements: the conditions where it can live. The niche of his California thrasher was the chaparral that met its needs for food, cover, and nesting.' },
        { t: 'Charles Elton, in 1927, emphasized function instead: a species’ place in the biotic environment, its relations to food and enemies. As Eugene Odum later put it, habitat is a species’ address, and the niche is its profession.' },
        { t: 'G. Evelyn Hutchinson, in 1957, made the niche quantitative. Treat each environmental factor, such as temperature, moisture, or food size, as an axis. The set of conditions under which a species can persist forms an n-dimensional hypervolume: the Hutchinsonian niche.',
          s: 'G. Evelyn Hutchinson, in 1957, made the niche quantitative. Treat each environmental factor, such as temperature, moisture, or food size, as an axis. The set of conditions under which a species can persist forms an n dimensional hypervolume: the Hutchinsonian niche.' },
        { t: 'Notice the shift. Grinnell and Elton described niches as places or roles in the environment and the community, waiting to be filled. Hutchinson made the niche a property of the species itself.',
          s: 'Notice the shift. Grin-nell and Elton described niches as places or roles in the environment and the community, waiting to be filled. Hutchinson made the niche a property of the species itself.' },
      ],
      terms: [
        { beat: 0.35, term: 'Grinnellian niche', def: 'The habitat and environmental conditions a species requires; the basis of distribution modeling.' },
        { beat: 1.2, term: 'Eltonian niche', def: 'A species’ functional role: what it eats, what eats it, and its effects on the community.' },
        { beat: 2.5, term: 'Hutchinsonian niche', def: 'The n-dimensional hypervolume of conditions and resources permitting a species to persist.' },
      ],
      init() {
        // Chaparral hillside, pre-rendered once (local frame 1150 × 430).
        const LW = 1150, LH = 430;
        const ground = (x) => 380 - 235 * Math.pow(smooth(x / LW), 1.15) + 8 * U.noise1(x / 70, 3);
        const img = Theater.makeCanvas(LW, LH); const ctx = img.getContext('2d'); const c = Theater.makeG(ctx);
        const far = []; for (let x = 0; x <= LW; x += 8) far.push([x, 205 - 135 * smooth(x / LW) + 20 * U.noise1(x / 110, 9) + 7 * U.noise1(x / 37, 4)]);
        let gr = ctx.createLinearGradient(0, 60, 0, LH); gr.addColorStop(0, rgba(PAL.ink, 0.045)); gr.addColorStop(1, rgba(PAL.ink, 0));
        c.poly([...far, [LW, LH], [0, LH]], { fill: gr, color: null, w: 0 });
        c.poly(far, { color: rgba(PAL.ink, 0.14), w: 1.6 });
        const r = rng(17);
        for (let k = 0; k < 46; k++) { const x = r() * LW; const fy = far[Math.round(x / 8)][1]; c.ellipse(x, fy + 5, 9 + r() * 13, 5 + r() * 4, { fill: mix(PAL.moss, PAL.bg, 0.8) }); }
        const hill = []; for (let x = 0; x <= LW; x += 5) hill.push([x, ground(x)]);
        gr = ctx.createLinearGradient(0, 140, 0, LH); gr.addColorStop(0, rgba(PAL.moss, 0.17)); gr.addColorStop(1, rgba(PAL.moss, 0.0));
        c.poly([...hill, [LW, LH], [0, LH]], { fill: gr, color: null, w: 0 });
        c.poly(hill, { color: rgba(PAL.moss, 0.55), w: 2.4 });
        for (let x = 6; x < LW; x += 11 + r() * 16) { const y = ground(x); const h = 6 + r() * 12; c.line(x, y, x - 3 + r() * 6, y - h, { color: rgba(PAL.sand, 0.45), w: 1.4 }); c.line(x + 3, y, x + 6 + r() * 4, y - h * 0.7, { color: rgba(PAL.sand, 0.35), w: 1.2 }); }
        for (let k = 0; k < 90; k++) { const x = r() * LW; c.circle(x, ground(x) + 3 + r() * 10, 1.4 + r() * 1.4, { fill: rgba(PAL.sand, 0.3) }); }
        const shrubs = [[40, 120, 95], [612, 125, 100], [735, 160, 122], [872, 112, 92], [985, 165, 132], [1102, 120, 100], [540, 72, 56], [215, 165, 128], [452, 180, 142]];
        shrubs.forEach(([x, w, h], k) => shrub(c, x, ground(x) + 4, w, h, 31 + k * 7));
        // soft left/right edges
        ctx.globalCompositeOperation = 'destination-out';
        gr = ctx.createLinearGradient(0, 0, LW, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.05, 'rgba(0,0,0,0)'); gr.addColorStop(0.86, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, LW, LH); ctx.globalCompositeOperation = 'source-over';
        // points inside the unit ball, for the hypervolume
        const rb = rng(5), ball = [];
        while (ball.length < 34) { const p = [rb() * 2 - 1, rb() * 2 - 1, rb() * 2 - 1]; if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 < 0.8) ball.push(p); }
        return { img, ground, LW, LH, ball };
      },
      draw(g, t, S, D) {
        const LX = 130, LY = 470, ctx = g.ctx;
        const P = (kf, d = 0.8) => S.p(kf, d); // reveal at a fractional beat position (robust to re-timed audio)
        const outAB = 1 - S.p(2, 0.7, 0.9); // Grinnell + Elton panels leave as Hutchinson arrives
        // ---------------- beat 0: the word, then Grinnell's habitat niche
        const aW = S.p(0, 0.9, 0.1) * (1 - P(0.24, 0.7));
        g.text('niche', 705, 380, { size: 120, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: aW });
        g.text('ecology’s most used, and most argued-over, concept', 705, 436, { size: 26, color: PAL.ink2, align: 'center', alpha: aW * S.p(0, 0.9, 1.2) });
        const aG = P(0.265, 0.9) * outAB;
        g.withAlpha(aG, () => {
          label(g, 'Grinnell · 1917', 130, 262, 1, PAL.moss);
          g.text('Habitat requirements', 130, 318, { size: 46, role: 'display', color: PAL.ink });
          g.text('the conditions where a species can live', 130, 358, { size: 24, color: PAL.ink2, alpha: P(0.56) });
          g.text('“The niche-relationships of the California thrasher”', 130, 394, { size: 21, italic: true, color: PAL.ink3, alpha: P(0.74) });
        });
        // sun over the chaparral (beat 0 only)
        const aSun = S.p(0, 1.5, 2) * (1 - S.p(1, 0.8));
        g.glow(1150, 360, 150, PAL.ochre, 0.22 * aSun); g.circle(1150, 360, 26, { fill: PAL.ochre, alpha: 0.45 * aSun });
        // landscape, wiped narrower when Elton's panel arrives
        const reveal = S.io(0, 3.2, 0.3), wipe = lerp(D.LW, 560, S.io(1, 1.4, 0.1));
        const clipW = Math.min(reveal * D.LW, wipe);
        const aL = S.p(0, 0.6, 0.3) * outAB;
        if (aL > 0 && clipW > 1) g.withAlpha(aL, () => g.clip(LX, LY - 30, clipW, 460, () => {
          ctx.drawImage(D.img, LX, LY);
          const gx = (x) => LX + x, gy = (x) => LY + D.ground(x);
          // insects in the leaf litter
          for (let k = 0; k < 3; k++) { const x = 372 + 22 * k + 16 * Math.sin(t * (0.7 + 0.2 * k) + k * 2.1); g.icon('bug', gx(x), gy(x) - 5, 15, PAL.ochre, { rot: Math.PI / 2 * (Math.cos(t * (0.7 + 0.2 * k) + k * 2.1) > 0 ? 1 : -1), alpha: 0.9 }); }
          // nest with eggs in the big shrub
          const nx = gx(455), ny = gy(455) - 58;
          g.withAlpha(P(0.86), () => {
            g.ellipse(nx, ny, 26, 13, { fill: mix(PAL.sand, PAL.bg, 0.45) });
            [-9, 1, 10].forEach((dx, k) => g.ellipse(nx + dx, ny - 6 - (k === 1 ? 2 : 0), 6.5, 8.5, { fill: mix(PAL.lagoon, PAL.ink, 0.45) }));
            ctx.save(); ctx.beginPath(); ctx.ellipse(nx, ny + 2, 27, 11, 0, 0, Math.PI); ctx.fillStyle = mix(PAL.sand, PAL.bg, 0.3); ctx.fill(); ctx.restore();
          });
          // the thrasher: hops in when named, rakes the litter with its bill, moves between shrubs
          const t0 = S.b(0.755), t1 = S.b(1);
          const tk = [[t0, -70], [t0 + 2, 330], [t1 + 1.6, 330], [t1 + 2.7, 268], [t1 + 6.6, 268], [t1 + 7.9, 392], [t1 + 11.6, 392], [t1 + 12.8, 335], [t1 + 30, 335]];
          const bx = keyed(tk, t), vx = keyed(tk, t + 0.05) - bx; const moving = Math.abs(vx) > 0.05;
          const hop = moving ? -Math.abs(Math.sin(t * Math.PI * 4.2)) * 11 : 0;
          const peck = moving ? 0 : 0.55 * Math.pow(Math.max(0, Math.sin(t * 3.4)), 6);
          thrasher(g, gx(bx), gy(bx) + hop, 68, { flip: vx < -0.05, peck });
          // needs: food, cover, nest sites
          const call = (txt, px, py, tx, ty, kf) => { const a = P(kf, 0.6); if (a <= 0) return; g.line(gx(px), LY + py + 16, tx, ty, { color: PAL.ochre, w: 1.6, alpha: a * 0.8 }); g.circle(tx, ty, 4, { fill: PAL.ochre, alpha: a }); g.pill(txt, gx(px), LY + py, { color: PAL.ochre, size: 22, align: 'center', alpha: a }); };
          call('food', 372, 238, gx(392), gy(392) - 10, 0.895);
          call('cover', 196, 188, gx(222), gy(222) - 92, 0.925);
          call('nest sites', 488, 184, nx + 6, ny - 12, 0.955);
          g.text('California thrasher', gx(28), LY + 132, { size: 23, color: PAL.sand, alpha: P(0.75) });
          g.text('Toxostoma redivivum', gx(28), LY + 160, { size: 21, italic: true, color: PAL.ink3, alpha: P(0.78) });
        }));
        // ---------------- beat 1: Elton's functional niche (food web)
        const aE = S.p(1, 0.9, 0.8) * outAB;
        g.withAlpha(aE, () => {
          label(g, 'Elton · 1927', 720, 262, 1, PAL.coral);
          g.text('Functional role', 720, 318, { size: 46, role: 'display', color: PAL.ink, alpha: P(1.15) });
          g.text('its relations to food and enemies', 720, 358, { size: 24, color: PAL.ink2, alpha: P(1.5) });
          g.text('Animal Ecology', 720, 394, { size: 21, italic: true, color: PAL.ink3, alpha: P(1.08) });
          const F = [1000, 672], RF = 58;
          const foods = [[835, 812, 'beetles', 'bug'], [1000, 830, 'spiders', 'spider'], [1165, 812, 'berries', 'berry']];
          const foes = [[865, 548, 'Cooper’s hawk', 'hawk'], [1140, 548, 'gopher snake', 'snake']];
          const node = (x, y, r, col, a) => g.circle(x, y, r, { fill: rgba(PAL.panel, 0.95), stroke: col, w: 2.2, alpha: a });
          const glyph = (kind, x, y, col, a) => {
            if (kind === 'bug') g.icon('bug', x, y, 40, col, { alpha: a });
            else if (kind === 'spider') g.withAlpha(a, () => { g.circle(x, y + 3, 9, { fill: col }); g.circle(x, y - 9, 6, { fill: col }); for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 4; k++) { const yy = y - 4 + k * 4; g.poly([[x + s * 6, yy], [x + s * 16, yy - 9 + k * 3], [x + s * 22, yy + 4 + k * 3]], { color: col, w: 2 }); } });
            else if (kind === 'berry') g.withAlpha(a, () => { g.line(x - 2, y - 20, x + 6, y - 6, { color: PAL.moss, w: 2.5 }); [[-8, 2], [6, 0], [-1, 12], [10, 13], [-11, 15]].forEach(([dx, dy]) => g.circle(x + dx, y + dy, 7, { fill: PAL.rose })); });
            else if (kind === 'hawk') hawk(g, x, y + 2, 60, col, { alpha: a, flap: 0.5 + 0.5 * Math.sin(t * 1.3) });
            else if (kind === 'snake') { const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([x - 25 + 46 * u, y + 4 + 8 * Math.sin(u * 8.5 - t * 1.6) * (0.25 + 0.75 * (1 - u))]); } g.poly(pts, { color: col, w: 5.5, alpha: a }); const hd = pts[24]; g.ellipse(hd[0] + 4, hd[1] - 1, 8, 5.5, { fill: col, alpha: a }); g.circle(hd[0] + 6, hd[1] - 2.5, 1.4, { fill: PAL.bg, alpha: a }); g.line(hd[0] + 11, hd[1], hd[0] + 17, hd[1] + 1, { color: PAL.rose, w: 1.4, alpha: a }); }
          };
          const edge = (x1, y1, r1, x2, y2, r2, col, a, ph) => {
            const ang = Math.atan2(y2 - y1, x2 - x1); const sx = x1 + Math.cos(ang) * (r1 + 6), sy = y1 + Math.sin(ang) * (r1 + 6), ex = x2 - Math.cos(ang) * (r2 + 8), ey = y2 - Math.sin(ang) * (r2 + 8);
            g.arrow(sx, sy, ex, ey, { color: col, w: 2.2, head: 13, alpha: a * 0.85, progress: a });
            for (let k = 0; k < 3; k++) { const f = ((t * 0.45 + k / 3 + ph) % 1); g.dot(lerp(sx, ex, f), lerp(sy, ey, f), 3, col, a * Math.sin(Math.PI * f), 2.4); }
          };
          const aF = P(1.1);
          foods.forEach(([x, y, nm, kind], k) => { const a = P(1.49 + k * 0.018, 0.7); edge(x, y, 38, F[0], F[1], RF, PAL.moss, a, k * 0.31); node(x, y, 38, PAL.moss, a); glyph(kind, x, y, PAL.ochre, a); g.text(nm, x, y + 62, { size: 21, color: PAL.ink2, align: 'center', alpha: a }); });
          foes.forEach(([x, y, nm, kind], k) => { const a = P(1.56 + k * 0.02, 0.7); edge(F[0], F[1], RF, x, y, 40, PAL.coral, a, k * 0.5); node(x, y, 40, PAL.coral, a); glyph(kind, x, y, PAL.coral, a); g.text(nm, x, y - 54, { size: 21, color: PAL.ink2, align: 'center', alpha: a }); });
          node(F[0], F[1], RF, PAL.sand, aF); thrasher(g, F[0] - 6, F[1] + 26, 46, { alpha: aF });
          g.text('arrows:', 1092, 666, { size: 21, color: PAL.ink3, alpha: P(1.64) });
          g.text('energy flow', 1092, 692, { size: 21, color: PAL.ink3, alpha: P(1.64) });
        });
        // Odum: address vs profession
        const aAd = P(1.79) * outAB, aPr = P(1.93) * outAB;
        g.text('= its address', 130, 446, { size: 38, role: 'display', italic: true, color: PAL.moss, alpha: aAd });
        const wP = g.text('= its profession', 720, 446, { size: 38, role: 'display', italic: true, color: PAL.coral, alpha: aPr });
        g.text('E. P. Odum', 720 + wP + 18, 446, { size: 21, color: PAL.ink3, alpha: aPr });
        // ---------------- beat 2: Hutchinson's n-dimensional hypervolume
        const aH = S.p(2, 0.9, 0.6) * (1 - S.p(3, 0.6, 0.5));
        if (aH > 0) g.withAlpha(aH, () => {
          label(g, 'Hutchinson · 1957', 130, 262, 1, PAL.heather);
          g.text('The niche, made quantitative', 130, 318, { size: 46, role: 'display', color: PAL.ink });
          g.text('“Concluding remarks”, CSH Symposia', 950, 410, { size: 21, italic: true, color: PAL.ink3, alpha: S.p(2, 0.8, 1.6) });
          const tF = S.b(2.495); // "food size"
          const e = ease.inOut((t - tF) / 2.4);
          const th = 0.4 * e + 0.13 * Math.sin(0.33 * (t - tF - 2.4)) * ease.inOut((t - tF - 2.4) / 3);
          const C = camera(th, 0.3 * e, lerp(290, 420, e), lerp(790, 725, e), 365);
          const hv = drawHypervolume(g, C, t, D, e, {
            ax: [S.p(2, 1.4, 2.4), S.p(2, 1.4, 2.6), P(2.495, 1.0) * e],
            lab: [P(2.42), P(2.445), P(2.495) * e],
            region: P(2.46, 1.0), persist: P(2.68, 1.2), labels: true,
          });
          if (hv) { const right = Math.max(...hv.out.map((p) => p[0])); const ap = P(2.74);
            g.text('the species', right + 24, hv.ctr[1] - 14, { size: 22, color: PAL.ink, alpha: ap });
            g.text('persists here', right + 24, hv.ctr[1] + 14, { size: 22, color: PAL.ink, alpha: ap });
            g.math('r \\ge 0', right + 24, hv.ctr[1] + 52, { size: 28, color: PAL.heather, alpha: ap }); }
          // axis list
          const items = [['x_{1}', 'temperature', 2.42], ['x_{2}', 'moisture', 2.445], ['x_{3}', 'food size', 2.495]];
          items.forEach(([m, s, kf], k) => { const a = P(kf, 0.7); g.math(m, 950, 466 + k * 54, { size: 34, color: PAL.heather, alpha: a }); g.text(s, 1010, 466 + k * 54, { size: 25, color: PAL.ink, alpha: a }); });
          const aN = P(2.585, 0.7);
          g.text('⋮', 968, 612, { size: 30, color: PAL.ink2, alpha: aN, align: 'center' });
          g.math('x_{n}', 950, 668, { size: 34, color: PAL.heather, alpha: aN }); g.text('…any factor that matters', 1010, 668, { size: 23, color: PAL.ink2, alpha: aN });
          g.text('n-dimensional', 950, 760, { size: 40, role: 'display', italic: true, color: PAL.heather, alpha: P(2.86, 0.9) });
          g.text('hypervolume', 950, 804, { size: 40, role: 'display', italic: true, color: PAL.heather, alpha: P(2.87, 0.9) });
          g.text('= the Hutchinsonian niche', 950, 852, { size: 26, color: PAL.ink, alpha: P(2.93, 0.9) });
        });
        // ---------------- beat 3: where does the niche live?
        const a3 = S.p(3, 0.8, 0.7);
        if (a3 > 0) g.withAlpha(a3, () => {
          g.line(705, 250, 705, 880, { color: PAL.rule, w: 1.5, alpha: S.p(3, 1, 0.9) });
          label(g, 'Grinnell · Elton', 130, 262, 1, PAL.moss);
          label(g, 'Hutchinson', 760, 262, 1, PAL.heather);
          g.text('A property of the environment', 130, 314, { size: 38, role: 'display', color: PAL.ink, alpha: P(3.12) });
          g.text('places or roles, waiting to be filled', 130, 352, { size: 24, color: PAL.ink2, alpha: P(3.3) });
          // a wall of alcoves = niches in the community
          const ap = P(3.14, 1.0);
          g.rect(140, 430, 540, 380, { fill: rgba(PAL.ink, 0.035), stroke: PAL.rule, w: 1.2, alpha: ap, r: 4 });
          for (let k = 1; k < 7; k++) g.line(140, 430 + k * 54, 680, 430 + k * 54, { color: PAL.faint, w: 1, alpha: ap });
          const hv = P(3.57);
          const bays = [[235, 'ground forager'], [410, 'foliage gleaner'], [585, 'vacant niche']];
          bays.forEach(([x, nm], k) => {
            const pk = P(3.16 + k * 0.03); const vac = k === 2; const h = vac ? hv : 0;
            alcove(g, x, 760, 128, 250, { alpha: pk, color: vac ? mix(PAL.ink2, PAL.coral, h) : PAL.ink2, dash: vac && h > 0 ? [8, 6] : null });
            g.text(nm, x, 800, { size: 21, color: vac ? PAL.coral : PAL.ink2, align: 'center', alpha: vac ? h : P(3.31 + k * 0.03) });
          });
          thrasher(g, 245, 752, 52, { alpha: P(3.31) });
          g.icon('songbird', 410, 712, 58, PAL.ochre, { alpha: P(3.34) });
          g.glow(585, 650, 90, PAL.coral, 0.25 * hv * (0.75 + 0.25 * Math.sin(t * 3)));
          g.text('?', 585, 680, { size: 64, role: 'display', italic: true, color: PAL.coral, align: 'center', alpha: hv * 0.85 });
          // the species carries its own niche wherever it goes
          const ar = P(3.7);
          g.withAlpha(ar, () => {
            g.text('A property of the species', 760, 314, { size: 38, role: 'display', color: PAL.ink });
            g.text('set by its own tolerances and needs', 760, 352, { size: 24, color: PAL.ink2 });
            const mv = ease.inOut((t - S.b(3.74)) / 2.6);
            const sx = lerp(900, 1110, mv), hop = mv > 0 && mv < 1 ? -Math.abs(Math.sin(t * Math.PI * 4)) * 10 : 0;
            const C = cameraAt(0.4 + 0.2 * Math.sin(t * 0.5), 0.3, sx + 10, 530 + hop * 0.6, 300);
            drawHypervolume(g, C, t, D, 1, { region: 1, persist: 1, labels: false, mini: true });
            g.line(sx + 4, 625 + hop * 0.6, sx + 4, 752 + hop, { color: PAL.heather, w: 2, dash: [5, 6], alpha: 0.8 });
            thrasher(g, sx - 12, 828 + hop, 70, {});
            g.text('the niche travels with the species;', 760, 870, { size: 22, color: PAL.ink2 });
            g.text('it cannot sit “vacant”', 760, 900, { size: 22, color: PAL.ink2 });
          });
        });
      },
    },
    {
      id: 'niche-realized', title: 'Fundamental & realized niches',
      beats: [
        { t: 'Hutchinson distinguished the fundamental niche, the full range of conditions where a species could persist on its physiological tolerances alone, from the realized niche, the narrower range it actually occupies once competitors, predators, and pathogens are present.' },
        { t: 'Joseph Connell’s experiments on the Isle of Cumbrae, in Scotland, published in 1961, made this vivid. Two barnacles share the rocky shore. Chthamalus lives high in the intertidal zone, and Balanus, now called Semibalanus, lives below it.',
          s: 'Joseph Connell’s experiments on the Isle of Cumbray, in Scotland, published in 1961, made this vivid. Two barnacles share the rocky shore. Thamalus lives high in the intertidal zone, and Balanus, now called Semmy-balanus, lives below it.' },
        { t: 'When Connell removed Balanus, Chthamalus survived and thrived far lower on the shore. Its fundamental niche extended deep, but there the faster-growing Balanus smothered, undercut, and crushed it. Meanwhile, desiccation at low tide set the upper limit of Balanus.',
          s: 'When Connell removed Balanus, Thamalus survived and thrived far lower on the shore. Its fundamental niche extended deep, but there the faster growing Balanus smothered, undercut, and crushed it. Meanwhile, desiccation at low tide set the upper limit of Balanus.' },
        { t: 'This yields a widely observed rule. Physical stress tends to set a species’ range limit on the harsh side of a gradient, while biotic interactions set the limit on the benign side.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.25, term: 'Fundamental niche', def: 'Conditions under which a species can persist given abiotic tolerances alone, without enemies or competitors.' },
        { beat: 0.6, term: 'Realized niche', def: 'The portion of the fundamental niche a species actually occupies, given biotic interactions.' },
      ],
      init() {
        // Barnacles along the rock face (shore height h: 0 = MLWS, 1 = MHWS).
        const r = rng(23), chth = [], bal = [];
        for (let k = 0; k <= 20; k++) chth.push({ h: 1.07 - k * 0.037 + (r() - 0.5) * 0.01, w: 19 + r() * 5, d: r() });
        for (let k = 0; k <= 13; k++) bal.push({ h: 0.79 - k * 0.064 + (r() - 0.5) * 0.012, w: 32 + r() * 8, d: r() });
        return { chth, bal };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx; const P = (kf, d = 0.8) => S.p(kf, d);
        const FOC = PAL.moss, CMP = PAL.coral;
        // ---------------- beat 0: fundamental vs realized niche in niche space
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          label(g, 'Niche space', 150, 262);
          const A = g.axes({ x: 190, y: 300, w: 600, h: 520, xmax: 1, ymax: 1, xlab: 'temperature', ylab: 'moisture', progress: S.p(0, 1.0, 0.2), labSize: 22 });
          const ell = (cx, cy, rx, ry, rot) => { const p = new Path2D(); p.ellipse(A.X(cx), A.Y(cy), rx * A.w, ry * A.h, rot, 0, TAU); return p; };
          const F = ell(0.47, 0.5, 0.36, 0.34, -0.35);
          const sl = ease.inOut((t - S.b(0.57)) / 2.4);
          const cX = lerp(1.2, 0.8, sl), cY = lerp(0.98, 0.74, sl);
          const C = ell(cX, cY, 0.21, 0.2, 0.4);
          const er = ease.inOut((t - S.b(0.6)) / 2.4);
          const E = ell(0.1, 0.12, 0.27 * er + 0.001, 0.24 * er + 0.001, 0);
          const pf = P(0.07, 1.6), pr = clamp(sl * 1.2);
          const outside = (path) => { const q = new Path2D(); q.rect(0, 0, g.W, g.H); q.addPath(path); ctx.clip(q, 'evenodd'); };
          ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y - 20, A.w + 20, A.h + 20); ctx.clip();
          // realized niche: fundamental minus the regions taken by competitors and enemies
          ctx.save(); ctx.globalAlpha *= pf; outside(C); outside(E); ctx.fillStyle = rgba(FOC, lerp(0.1, 0.3, pr)); ctx.fill(F); ctx.restore();
          // lost portions, hatched
          const hatch = (path, col, a) => { if (a <= 0) return; ctx.save(); ctx.clip(F); ctx.clip(path); ctx.globalAlpha *= a; ctx.fillStyle = rgba(col, 0.12); ctx.fillRect(A.x, A.y, A.w, A.h); ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 2; ctx.beginPath(); for (let k = -A.h; k < A.w; k += 14) { ctx.moveTo(A.x + k, A.y + A.h); ctx.lineTo(A.x + k + A.h, A.y); } ctx.stroke(); ctx.restore(); };
          hatch(C, CMP, pr); hatch(E, PAL.heather, clamp(er * 1.2));
          // outlines
          ctx.save(); ctx.globalAlpha *= sl; ctx.strokeStyle = CMP; ctx.lineWidth = 2.6; ctx.stroke(C); ctx.restore();
          ctx.save(); ctx.globalAlpha *= er; ctx.strokeStyle = PAL.heather; ctx.lineWidth = 2.4; ctx.setLineDash([3, 6]); ctx.stroke(E); ctx.restore();
          ctx.restore();
          // fundamental niche outline traces in
          const fpts = []; for (let k = 0; k <= 120; k++) { const u = k / 120 * TAU, x = 0.36 * A.w * Math.cos(u), y = 0.34 * A.h * Math.sin(u), c = Math.cos(-0.35), s = Math.sin(-0.35); fpts.push([A.X(0.47) + x * c - y * s, A.Y(0.5) + x * s + y * c]); }
          g.poly(fpts, { color: FOC, w: 3, dash: [10, 7], progress: pf });
          g.text('fundamental', A.X(0.2), A.Y(0.9), { size: 24, color: FOC, weight: 600, alpha: P(0.1) });
          g.text('realized', A.X(0.42), A.Y(0.47), { size: 26, color: PAL.ink, weight: 600, align: 'center', alpha: P(0.6) });
          g.text('competitor', A.X(cX), A.Y(cY) - 0.205 * A.h - 14, { size: 22, color: CMP, align: 'center', alpha: P(0.8) });
          g.text('predators,', A.X(0.12), A.Y(0.14) + 4, { size: 21, color: PAL.heather, align: 'center', alpha: P(0.83) });
          g.text('pathogens', A.X(0.12), A.Y(0.14) + 28, { size: 21, color: PAL.heather, align: 'center', alpha: P(0.87) });
          // definitions
          const dx = 860;
          label(g, 'Fundamental niche', dx, 360, P(0.07), FOC);
          g.wrap('The full range of conditions where the species could persist, given its physiological tolerances alone.', dx, 398, 440, { size: 23, color: PAL.ink2, alpha: P(0.15), lh: 1.4 });
          label(g, 'Realized niche', dx, 580, P(0.57), PAL.ink);
          g.wrap('The narrower range it actually occupies once competitors, predators, and pathogens are present.', dx, 618, 440, { size: 23, color: PAL.ink2, alpha: P(0.62), lh: 1.4 });
        });
        // ---------------- beats 1–3: Connell's barnacles
        const v1 = S.p(1, 0.9, 0.2);
        if (v1 <= 0) return;
        const Y = (h) => 845 - h * 450;
        const xs = (h) => 236 + (1.2 - h) * 200 + 16 * Math.sin(h * 8.5) + 7 * U.noise1(h * 9, 4);
        const normal = (h) => { const dh = 0.01, tx = xs(h - dh) - xs(h + dh), ty = Y(h - dh) - Y(h + dh), L = Math.hypot(tx, ty); return [ty / L, -tx / L]; }; // outward (seaward) normal
        const tLow = S.b(2.81), per = 8.5;
        const hw = 0.47 - 0.55 * Math.cos(TAU * (t - tLow) / per);
        const out3 = 1 - S.p(3, 0.8);
        g.withAlpha(v1, () => {
          label(g, 'Connell 1961 · Isle of Cumbrae, Scotland', 130, 262, P(1.02), COL);
          const pR = P(1.04, 1.6);
          // tide levels
          const lv = [['MHWS', 1], ['MHWN', 0.75], ['MTL', 0.5], ['MLWN', 0.25], ['MLWS', 0]];
          lv.forEach(([nm, h], k) => { const a = P(1.2 + k * 0.03); g.line(196, Y(h), 880, Y(h), { color: PAL.ink3, w: 1, dash: [3, 7], alpha: a * 0.55 }); g.text(nm, 128, Y(h) + 7, { size: 21, role: 'mono', color: PAL.ink3, alpha: a }); });
          g.text('MHWS … MLWS: mean high / low water, spring / neap tides', 128, 906, { size: 21, color: PAL.ink3, alpha: P(1.3) });
          // the rock
          const surf = []; for (let h = 1.2; h >= -0.08; h -= 0.02) surf.push([xs(h), Y(h)]);
          const rockPoly = [[196, Y(1.2)], ...surf, [196, Y(-0.08)]];
          g.withAlpha(pR, () => {
            const gr = ctx.createLinearGradient(196, 0, 420, 0); gr.addColorStop(0, rgba(mix(PAL.sand, PAL.bg, 0.78), 0)); gr.addColorStop(0.35, rgba(mix(PAL.sand, PAL.bg, 0.78), 0.9)); gr.addColorStop(1, mix(PAL.sand, PAL.bg, 0.7));
            g.poly(rockPoly, { fill: gr, color: null, w: 0, close: true });
            ctx.save(); ctx.beginPath(); rockPoly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.clip();
            for (let k = 0; k < 12; k++) g.line(150, 300 + k * 56, 560, 230 + k * 56 + 120, { color: rgba(PAL.ink, 0.05), w: 2 });
            ctx.restore();
            g.poly(surf, { color: mix(PAL.sand, PAL.bg, 0.25), w: 3 });
          });
          // the sea, rising and falling
          const wy = Y(hw); const waterTop = []; for (let x = xs(hw); x <= 580; x += 6) waterTop.push([x, wy + 3.5 * Math.sin(x / 26 + t * 2.2)]);
          const below = surf.filter(([x, y]) => y > wy);
          const water = [...waterTop, [580, Y(-0.08)], ...below.slice().reverse()];
          g.withAlpha(pR, () => {
            const gw = ctx.createLinearGradient(300, 0, 580, 0); gw.addColorStop(0, rgba(PAL.lagoon, 0.26)); gw.addColorStop(0.75, rgba(PAL.lagoon, 0.14)); gw.addColorStop(1, rgba(PAL.lagoon, 0));
            g.poly(water, { fill: gw, color: null, w: 0, close: true });
            const gl = ctx.createLinearGradient(300, 0, 580, 0); gl.addColorStop(0, PAL.lagoon); gl.addColorStop(0.8, rgba(PAL.lagoon, 0.6)); gl.addColorStop(1, rgba(PAL.lagoon, 0));
            g.poly(waterTop, { color: gl, w: 2.4 });
          });
          g.arrow(560, Y(0.12) + 30, 560, Y(0.12) - 30, { color: PAL.lagoon, w: 2, head: 10, both: true, alpha: pR * 0.7 });
          g.text('tide', 576, Y(0.12) + 8, { size: 21, color: PAL.lagoon, alpha: pR * 0.8 });
          // removal plot (beat 2): a marked quadrat hugging the rock face
          const plot = [0.36, 0.6];
          const pPl = P(2.03, 0.6) * out3;
          const brk = []; for (let h = plot[1]; h >= plot[0] - 0.001; h -= 0.02) { const [nx, ny] = normal(h); brk.push([xs(h) + nx * 40, Y(h) + ny * 40]); }
          const [n1x, n1y] = normal(plot[1]), [n0x, n0y] = normal(plot[0]);
          g.poly([[xs(plot[1]) - n1x * 4, Y(plot[1]) - n1y * 4], ...brk, [xs(plot[0]) - n0x * 4, Y(plot[0]) - n0y * 4]], { color: PAL.ink, w: 2, dash: [6, 5], alpha: pPl });
          const lp = brk[Math.floor(brk.length / 2)];
          g.text('Balanus', lp[0] + 14, lp[1] - 4, { size: 21, italic: true, color: PAL.ink, alpha: pPl });
          g.text('removed', lp[0] + 14, lp[1] + 20, { size: 21, color: PAL.ink, alpha: pPl });
          const inPlot = (h) => h > plot[0] && h < plot[1];
          // barnacles (base on the rock, opening toward the sea; cirri sweep when submerged)
          const bn = (b, col, a, lift = 0) => {
            if (a <= 0) return; const [nx, ny] = normal(b.h); const x = xs(b.h) + nx * lift, y = Y(b.h) + ny * lift;
            const feed = clamp((hw - b.h) * 8) * 0.9;
            barnacle(g, x, y, nx, ny, b.w, col, { alpha: a, feed, phase: t * 5 + b.d * 6 });
          };
          D.bal.forEach((b) => {
            let a = P(1.8 + 0.08 * b.d, 0.5), lift = 0;
            if (inPlot(b.h)) { const q = P(2.04 + 0.05 * b.d, 0.7); a *= 1 - q; lift = 30 * q; }
            bn(b, CMP, a, lift);
          });
          D.chth.forEach((b) => {
            let a;
            if (b.h >= 0.74) a = P(1.61 + 0.1 * b.d, 0.5);
            else if (inPlot(b.h)) a = P(2.1 + 0.14 * b.d, 0.6);
            else if (b.h > 0.6) a = P(2.0 + 0.03 * b.d, 0.5) * (1 - P(2.57 + 0.1 * b.d, 0.6)); // settlers outside the plot, overgrown by Balanus
            else a = 0;
            bn(b, FOC, a);
          });
          // smothered, undercut, crushed
          const pc = P(2.55) * out3;
          g.text('smothered,', xs(0.67) + 46, Y(0.67) - 4, { size: 21, color: CMP, alpha: pc });
          g.text('undercut, crushed', xs(0.67) + 46, Y(0.67) + 20, { size: 21, color: CMP, alpha: pc });
          // desiccation at low tide
          const pd = P(2.77) * out3;
          g.glow(520, 330, 110, PAL.ochre, 0.32 * pd); g.circle(520, 330, 17, { fill: PAL.ochre, alpha: 0.55 * pd });
          // ---- range bars
          const bx = { bF: 652, bR: 706, cF: 806, cR: 860 }, bw = 24;
          g.text('Chthamalus', 833, 300, { size: 24, italic: true, color: FOC, align: 'center', alpha: P(1.48) });
          g.text('Balanus', 679, 300, { size: 24, italic: true, color: CMP, align: 'center', alpha: P(1.52) });
          g.text('(now Semibalanus)', 679, 326, { size: 21, italic: true, color: PAL.ink3, align: 'center', alpha: P(1.84) });
          const bar = (x, h0, h1, col, filled, p) => { if (p <= 0) return; const yt = Y(h1), yb = Y(h0); if (filled) g.rect(x - bw / 2, yt, bw, (yb - yt) * p, { fill: col, alpha: 0.8, r: 4 }); else g.rect(x - bw / 2, yt, bw, (yb - yt) * p, { fill: rgba(col, 0.12), stroke: col, w: 2.6, dash: [7, 5], r: 4 }); };
          bar(bx.cR, 0.74, 1.08, FOC, true, P(1.63, 1.2));
          bar(bx.bR, -0.08, 0.8, CMP, true, P(1.82, 1.2));
          bar(bx.bF, -0.08, 0.8, CMP, false, P(2.8, 1.2));
          bar(bx.cF, 0.3, 1.08, FOC, false, P(2.34, 1.6));
          const pe = P(2.38) * out3;
          g.text('fundamental', bx.cF, Y(0.3) + 32, { size: 21, color: FOC, align: 'center', alpha: pe });
          g.text('extends deep', bx.cF, Y(0.3) + 56, { size: 21, color: FOC, align: 'center', alpha: pe });
          // key
          const pk = P(1.66), pkF = P(2.34), kx = 924;
          g.rect(kx, 290, 22, 30, { fill: PAL.ink2, r: 3, alpha: pk * 0.8 }); g.text('realized', kx + 34, 313, { size: 21, color: PAL.ink2, alpha: pk });
          g.rect(kx, 334, 22, 30, { fill: rgba(PAL.ink2, 0.12), stroke: PAL.ink2, w: 2, dash: [5, 3], r: 3, alpha: pkF }); g.text('fundamental', kx + 34, 357, { size: 21, color: PAL.ink2, alpha: pkF });
          // limits
          const pcm = P(2.6), pds = P(2.82);
          g.line(bx.cR + bw / 2 + 6, Y(0.74), kx - 6, Y(0.74) + 30, { color: CMP, w: 1.6, alpha: pcm }); g.circle(bx.cR + bw / 2 + 4, Y(0.74), 4, { fill: CMP, alpha: pcm });
          g.text('competition', kx, Y(0.74) + 38, { size: 23, weight: 600, color: CMP, alpha: pcm });
          g.text('lower limit of Chthamalus', kx, Y(0.74) + 66, { size: 21, color: PAL.ink3, alpha: pcm * out3 });
          g.line(bx.bF - bw / 2 - 6, Y(0.8), 628, Y(0.8) - 10, { color: PAL.ochre, w: 1.6, alpha: pds }); g.circle(bx.bF - bw / 2 - 4, Y(0.8), 4, { fill: PAL.ochre, alpha: pds });
          g.text('desiccation', 622, Y(0.8) - 2, { size: 23, weight: 600, color: PAL.ochre, align: 'right', alpha: pds });
          g.text('upper limit of Balanus', 622, Y(0.8) - 32, { size: 21, color: PAL.ink3, align: 'right', alpha: pds * out3 });
          // ---- beat 3: the general rule
          const p3 = P(3.05, 1.0);
          if (p3 > 0) g.withAlpha(p3, () => {
            const ax = 1094, y0 = Y(1.08), y1 = Y(-0.08);
            const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, PAL.ochre); gr.addColorStop(1, PAL.lagoon);
            ctx.save(); ctx.fillStyle = gr; ctx.fillRect(ax - 4, y0 + 14, 8, (y1 - y0 - 28) * P(3.1, 1.6)); ctx.restore();
            g.arrowHead(ax, y0, -Math.PI / 2, 22, PAL.ochre); g.arrowHead(ax, y1, Math.PI / 2, 22, PAL.lagoon);
            label(g, 'harsh side', ax + 20, y0 + 10, P(3.58), PAL.ochre);
            g.text('physical stress', ax + 20, y0 + 48, { size: 23, color: PAL.ink, alpha: P(3.22) });
            g.text('sets the limit', ax + 20, y0 + 76, { size: 23, color: PAL.ink, alpha: P(3.22) });
            g.text('(desiccation, heat)', ax + 20, y0 + 104, { size: 21, color: PAL.ink3, alpha: P(3.3) });
            label(g, 'benign side', ax + 20, y1 + 4, P(3.92), PAL.lagoon);
            g.text('biotic interactions', ax + 20, y1 - 92, { size: 22, color: PAL.ink, alpha: P(3.73) });
            g.text('set the limit', ax + 20, y1 - 64, { size: 23, color: PAL.ink, alpha: P(3.73) });
            g.text('competition, predation', ax + 20, y1 - 36, { size: 21, color: PAL.ink3, alpha: P(3.8) });
            // tick the harsh (upper) and benign (lower) end of each realized range
            const tick = (x, h, col, a) => g.rect(x - bw / 2 - 6, Y(h) - 3.5, bw + 12, 7, { fill: col, r: 2, alpha: a });
            tick(bx.cR, 1.08, PAL.ochre, P(3.3)); tick(bx.bR, 0.8, PAL.ochre, P(3.34));
            tick(bx.cR, 0.74, CMP, P(3.76)); tick(bx.bR, -0.08, CMP, P(3.8));
          });
        });
      },
    },
    {
      id: 'niche-partition', title: 'Partitioning & limiting similarity',
      beats: [
        { t: 'Hutchinson’s 1959 essay, Homage to Santa Rosalia, asked why there are so many kinds of animals. One answer is niche partitioning. In 1958, Robert MacArthur showed that five species of warbler coexist in the same spruce forests by foraging in different parts of the trees, in different ways.' },
        { t: 'Picture each species as a resource utilization curve along an axis such as prey size. Each curve has a width, w, and neighboring curves are separated by a distance, d. The overlap between curves measures the potential for competition.' },
        { t: 'MacArthur and Levins argued in 1967 for limiting similarity: a maximum overlap compatible with coexistence, reached roughly when d falls below w. Hutchinson had noticed that coexisting congeners often differ in body or bill size by a ratio of about 1.3, though that pattern proved weaker than first thought.',
          s: 'MacArthur and Levvins argued in 1967 for limiting similarity: a maximum overlap compatible with coexistence, reached roughly when d falls below w. Hutchinson had noticed that coexisting congeners often differ in body or bill size by a ratio of about one point three, though that pattern proved weaker than first thought.' },
        { t: 'Where competitors meet, natural selection can push their traits apart: character displacement. In the Galápagos, the ground finches Geospiza fortis and G. fuliginosa have distinct beak depths where they co-occur, but converge on intermediate beaks on islands where each lives alone.',
          s: 'Where competitors meet, natural selection can push their traits apart: character displacement. In the Galápagos, the ground finches Jee-oh-spiza fortis and Jee-oh-spiza fooli-jih-no-sa have distinct beak depths where they co-occur, but converge on intermediate beaks on islands where each lives alone.', pause: 0.8 },
        { t: 'Present-day partitioning may therefore be the ghost of competition past, Connell’s phrase for patterns shaped by competition that no longer operates. A lack of competition today does not mean competition never mattered.' },
      ],
      terms: [
        { beat: 0.45, term: 'Niche partitioning', def: 'Division of resources, space, or time among coexisting species, reducing competition.' },
        { beat: 1.7, term: 'Niche overlap', def: 'Shared use of resources by two species, measured as overlap of utilization curves.' },
        { beat: 2.15, term: 'Limiting similarity', def: 'The maximum similarity in resource use compatible with stable coexistence (MacArthur & Levins 1967).' },
        { beat: 3.25, term: 'Character displacement', def: 'Evolutionary divergence of traits where competing species co-occur (sympatry) but not apart (allopatry).' },
        { beat: 4.1, term: 'Ghost of competition past', def: 'Connell (1980): present niche differences produced by past competition, now no longer observable.' },
      ],
      init() {
        // White spruce, pre-rendered (canvas 560 × 680; apex at (280, 12), crown base y = 580, ground y = 642).
        const TW = 560, TH = 680, cx = 280, top = 12, base = 580;
        const Rw = (y) => 222 * Math.pow(clamp((y - top) / (base - top)), 0.92);
        const img = Theater.makeCanvas(TW, TH); const ctx = img.getContext('2d'); const c = Theater.makeG(ctx);
        const r = rng(41); const tiers = []; const nT = 17;
        for (let i = 0; i < nT; i++) {
          const y = top + 18 + (base - top - 10) * Math.pow(i / (nT - 1), 1.05); const w = Rw(y + 26) * (0.94 + 0.12 * r());
          tiers.push([[cx, y - 14], [cx + w * 0.55, y + 4], [cx + w, y + 26 + 6 * r()], [cx + w * 0.7, y + 22], [cx, y + 16], [cx - w * 0.7, y + 22], [cx - w, y + 26 + 6 * r()], [cx - w * 0.55, y + 4]]);
        }
        c.rect(cx - 7, base - 20, 14, 642 - base + 20, { fill: mix(PAL.sand, PAL.bg, 0.55) });
        const dark = mix(PAL.moss, PAL.bg, 0.7), mid = mix(PAL.moss, PAL.bg, 0.55), lite = mix(PAL.moss, PAL.bg, 0.35);
        tiers.forEach((p, i) => {
          c.poly(p, { fill: dark, color: null, w: 0, close: true });
          c.poly([p[7], p[0], p[1], p[2]], { color: mid, w: 3 }); c.poly([p[1], p[0], p[7], p[6]], { color: mid, w: 3 });
          for (let k = 0; k < 14; k++) { const u = r() * 2 - 1, xx = cx + u * (p[2][0] - cx) * 0.95, yy = lerp(p[0][1] + 6, p[2][1] - 4, Math.abs(u)) + r() * 8; c.line(xx, yy, xx + (u > 0 ? 5 : -5), yy + 5, { color: lite, w: 1.6, alpha: 0.7 }); }
        });
        c.line(0, 642, TW, 642, { color: rgba(PAL.sand, 0.4), w: 2 });
        for (let x = 6; x < TW; x += 9 + r() * 10) { const h = 4 + r() * 9; c.line(x, 642, x + r() * 4 - 2, 642 - h, { color: rgba(PAL.moss, 0.4), w: 1.3 }); }
        // silhouette path (local coords) for clipping the foraging zones
        const sil = new Path2D(); tiers.forEach((p) => { sil.moveTo(p[0][0], p[0][1]); p.slice(1).forEach(([x, y]) => sil.lineTo(x, y)); sil.closePath(); });
        return { img, Rw, sil, TW, TH, cx, top, base };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx; const P = (kf, d = 0.8) => S.p(kf, d);
        // ---------------- beat 0: Santa Rosalia, and MacArthur's warblers
        const v0 = vis(S, 0, 1);
        const OX = 110, OY = 250; // tree canvas origin on screen
        const W5 = [
          ['Cape May', 'upper crown, outer tips', PAL.lagoon, [0.6, 0.86, 0.36, 1]],
          ['Blackburnian', 'treetop', PAL.ochre, [0.84, 1, 0, 1]],
          ['Black-throated green', 'mid–upper crown, outer', PAL.mint, [0.38, 0.6, 0.42, 1]],
          ['Bay-breasted', 'mid-crown, near the trunk', PAL.coral, [0.28, 0.58, 0, 0.4]],
          ['Yellow-rumped (myrtle)', 'low branches & ground', PAL.heather, [-0.12, 0.27, 0, 1]],
        ];
        if (v0 > 0) g.withAlpha(v0, () => {
          // the essay
          label(g, 'Hutchinson · 1959', 720, 262, 1, COL);
          g.text('Homage to Santa Rosalia', 720, 318, { size: 44, role: 'display', italic: true, color: PAL.ink, alpha: S.p(0, 0.9, 0.4) });
          g.text('or, Why are there so many kinds of animals?', 720, 356, { size: 24, color: PAL.ink2, alpha: P(0.16) });
          const pNP = P(0.37);
          g.text('One answer:', 720, 418, { size: 24, color: PAL.ink2, alpha: pNP });
          g.text('niche partitioning', 862, 418, { size: 34, role: 'display', italic: true, color: COL, alpha: pNP });
          // the spruce
          const pt = P(0.02, 2.2);
          g.clip(0, OY + D.TH * (1 - pt) - 10, 720, D.TH * pt + 20, () => ctx.drawImage(D.img, OX, OY));
          label(g, 'MacArthur · 1958', 720, 486, P(0.54), PAL.ink3);
          // foraging zones (in tree-local coords)
          const Yh = (h) => D.base - h * (D.base - D.top); // h: 0 crown base, 1 apex
          const zone = (z) => {
            const [h0, h1, r0, r1] = z; const L = [], R = [];
            for (let k = 0; k <= 24; k++) { const y = lerp(Yh(Math.min(1, h1)), Yh(Math.max(0, h0)), k / 24); const w = D.Rw(y + 20) * 1.05; L.push([D.cx - r1 * w, y]); R.push([D.cx + r0 * w, y]); }
            const right = [...R, ...R.map(([x, y]) => [D.cx + (r1 / Math.max(r0, 1e-3)) * (x - D.cx) * (r0 > 0 ? 1 : 0) + (r0 > 0 ? 0 : r1 * D.Rw(y + 20) * 1.05), y]).reverse()];
            return { L, R, right };
          };
          ctx.save(); ctx.translate(OX, OY);
          W5.forEach(([nm, ds, col, z], k) => {
            const a = P(0.79 + k * 0.025, 0.7); if (a <= 0) return;
            const [h0, h1, r0, r1] = z;
            const band = (sgn) => { const pts = []; for (let i = 0; i <= 24; i++) { const y = lerp(Yh(Math.min(1, h1)), Yh(Math.max(0, h0)), i / 24); const w = D.Rw(y + 20) * 1.08; pts.push([D.cx + sgn * r0 * w, y]); } for (let i = 24; i >= 0; i--) { const y = lerp(Yh(Math.min(1, h1)), Yh(Math.max(0, h0)), i / 24); const w = D.Rw(y + 20) * 1.08; pts.push([D.cx + sgn * r1 * w, y]); } return pts; };
            ctx.save(); ctx.clip(D.sil);
            [1, -1].forEach((sgn) => g.poly(band(sgn), { fill: rgba(col, 0.6 * a), color: col, w: 2, alpha: 0.95 * a, close: true }));
            ctx.restore();
            if (h0 < 0) g.rect(D.cx - 230, 626, 460, 22, { fill: rgba(col, 0.42 * a), stroke: col, w: 1.6, r: 6, alpha: 0.9 }); // ground
          });
          ctx.restore();
          // warblers flitting within their zones
          W5.forEach(([nm, ds, col, z], k) => {
            const a = P(0.6 + k * 0.012, 0.6); if (a <= 0) return;
            const [h0, h1, r0, r1] = z; const ph = t * (0.55 + 0.07 * k) + k * 1.9;
            const hh = lerp(Math.max(0.02, h0), Math.min(0.97, h1), 0.5 + 0.32 * Math.sin(ph * 0.7));
            const yL = Yh(hh); const side = Math.sin(ph * 0.45 + k) > 0 ? 1 : -1; const rr = lerp(r0, r1, 0.35 + 0.3 * Math.sin(ph * 1.3));
            let x = OX + D.cx + side * rr * D.Rw(yL + 20), y = OY + yL - 6;
            if (k === 4 && Math.sin(ph * 0.5) > 0.3) { x = OX + D.cx + 150 * Math.sin(ph * 0.8); y = OY + 630; }
            g.icon('songbird', x, y + Math.sin(t * 9 + k) * 1.5, 30, col, { flip: Math.cos(ph * 1.3) < 0, alpha: a });
          });
          // legend
          W5.forEach(([nm, ds, col], k) => {
            const y = 540 + k * 66; const a = P(0.79 + k * 0.025, 0.7) * 0.85 + P(0.6 + k * 0.012) * 0.15;
            g.icon('songbird', 742, y - 8, 34, col, { alpha: a });
            g.text(nm, 786, y - 4, { size: 24, color: PAL.ink, alpha: a });
            g.text(ds, 786, y + 24, { size: 21, color: col, alpha: P(0.79 + k * 0.025, 0.7) });
          });
          g.text('…and in different ways: gleaning, hovering, flycatching', 720, 878, { size: 21, italic: true, color: PAL.ink3, alpha: P(0.9) });
        });
        // ---------------- beats 1–2: utilization curves & limiting similarity
        const v12 = vis(S, 1, 3);
        const w = 0.85;
        const d = S.at(2) ? keyed([[S.b(2) + 0.5, 2.6 * w], [S.b(2.47), 0.82 * w]], t) : 2.6 * w;
        const dw = d / w, alpha = Math.exp(-(dw * dw) / 4);
        if (v12 > 0) g.withAlpha(v12, () => {
          label(g, 'Resource utilization along one niche axis', 150, 262);
          const A = g.axes({ x: 180, y: 330, w: 1080, h: 330, xmax: 10, ymax: 1.22, xlab: 'prey size', ylab: 'resource use', labSize: 22, progress: S.p(1, 1.0, 0.1) });
          // prey of increasing size under the axis
          for (let k = 0; k < 8; k++) { const x = 0.6 + k * 1.05, sz = 12 + k * 3.4; g.icon('bug', A.X(x), A.y0 + 34, sz, PAL.sand, { rot: Math.PI / 2, alpha: P(1.3 + k * 0.01) * 0.75 }); }
          const cols = [PAL.lagoon, COL, PAL.rose];
          const mus = [5 - d, 5, 5 + d];
          const excl = S.at(2) ? clamp((1 - dw) / 0.15) * P(2.45, 1.2) : 0; // middle species squeezed out below the threshold
          const f = (m, x) => Math.exp(-((x - m) ** 2) / (2 * w * w));
          // overlaps
          const pO = P(1.78, 1.0);
          if (pO > 0) for (let j = 0; j < 2; j++) {
            const m1 = mus[j], m2 = mus[j + 1], xa = Math.max(0, m1 - 3.2 * w), xb = Math.min(10, m2 + 3.2 * w); const pts = []; for (let k = 0; k <= 90; k++) { const x = lerp(xa, xb, k / 90); pts.push([A.X(x), A.Y(Math.min(f(m1, x), f(m2, x)))]); }
            g.poly([[A.X(xa), A.Y(0)], ...pts, [A.X(xb), A.Y(0)]], { fill: rgba(PAL.ink, 0.2 * pO * (1 - 0.5 * excl)), color: null, w: 0, close: true });
          }
          cols.forEach((col, k) => {
            const pk = k === 1 ? P(1.1, 1.4) : P(1.39 + 0.02 * k, 1.2); if (pk <= 0) return;
            const m = mus[k]; const fade = k === 1 ? 1 - 0.65 * excl : 1;
            g.plot(A, (x) => f(m, x), { from: Math.max(0, m - 3.6 * w), to: Math.min(10, m + 3.6 * w), color: col, w: 4, progress: pk, alpha: fade, dash: k === 1 && excl > 0.5 ? [10, 8] : null, fillTo: 0, fillColor: rgba(col, 0.08) });
            g.icon('songbird', A.X(m), A.Y(1) - 34, 30, col, { alpha: pk * fade });
          });
          // w and d annotations
          const pw = P(1.44) * (1 - S.p(2, 0.6, 0.3));
          const hy = A.Y(Math.exp(-0.5));
          g.arrow(A.X(5), hy, A.X(5 + w), hy, { color: PAL.ink, w: 2, head: 11, both: true, alpha: pw });
          g.math('w', A.X(5 + w / 2), hy - 12, { size: 34, color: PAL.ink, align: 'center', alpha: pw });
          const pn = P(1.46) * (1 - S.p(2, 0.6));
          g.text('w: width (standard deviation) of a species’ resource use', 180, 790, { size: 22, color: PAL.ink2, alpha: pn });
          g.text('d: distance between the means of neighboring species', 180, 826, { size: 22, color: PAL.ink2, alpha: P(1.66) * (1 - S.p(2, 0.6)) });
          const pd = P(1.64);
          const dy = A.Y(1) - 70;
          g.line(A.X(5), A.Y(1) - 50, A.X(5), dy - 10, { color: PAL.ink3, w: 1.2, dash: [3, 4], alpha: pd });
          g.line(A.X(5 + d), A.Y(1) - 50, A.X(5 + d), dy - 10, { color: PAL.ink3, w: 1.2, dash: [3, 4], alpha: pd });
          g.arrow(A.X(5) + 4, dy, A.X(5 + d) - 4, dy, { color: PAL.ink, w: 2, head: 11, both: true, alpha: pd });
          g.math('d', A.X(5 + d / 2), dy - 12, { size: 34, color: PAL.ink, align: 'center', alpha: pd });
          // overlap → competition coefficient
          const pa = P(1.86);
          g.text('overlap ⇒ competition', 1260, 372, { size: 22, color: PAL.ink2, align: 'right', alpha: pa });
          g.math('α = e^{−d^{2}/4w^{2}}', 1260, 420, { size: 34, color: PAL.ink, align: 'right', alpha: pa });
          // live readout + limiting-similarity scale (beat 2)
          const p2 = P(2.03);
          g.text(`d/w = ${dw.toFixed(2)}`, 1260, 466, { size: 23, role: 'mono', color: dw < 1 ? PAL.coral : PAL.ink2, align: 'right', alpha: p2 });
          g.text(`α = ${alpha.toFixed(2)}`, 1260, 496, { size: 23, role: 'mono', color: PAL.ink2, align: 'right', alpha: p2 });
          const pL = P(2.16);
          if (pL > 0) g.withAlpha(pL, () => {
            const x0 = 180, x1 = 700, yN = 800, X = (v) => lerp(x0, x1, v / 3);
            label(g, 'limiting similarity', x0, 740, 1, PAL.ink);
            g.rect(X(0), yN - 7, X(1) - X(0), 14, { fill: rgba(PAL.coral, 0.55), r: 4 });
            g.rect(X(1), yN - 7, X(3) - X(1), 14, { fill: rgba(PAL.moss, 0.45), r: 4 });
            g.line(X(1), yN - 20, X(1), yN + 20, { color: PAL.ink, w: 2.4 });
            g.math('d/w ≈ 1', X(1), yN - 28, { size: 28, color: PAL.ink, align: 'center' });
            g.text('exclusion', X(0.5), yN + 40, { size: 21, color: PAL.coral, align: 'center', alpha: P(2.34) });
            g.text('coexistence', X(2), yN + 40, { size: 21, color: PAL.moss, align: 'center', alpha: P(2.25) });
            const px = X(clamp(dw, 0, 3)); g.dot(px, yN, 8, PAL.ink, 1, 2.4);
            g.text('d/w', X(3) + 14, yN + 7, { size: 21, role: 'math', italic: true, color: PAL.ink3 });
          });
          g.text('middle species squeezed out', 1260, 536, { size: 21, color: PAL.coral, align: 'right', alpha: excl });
          // Hutchinson's ratio
          const pH = P(2.57);
          if (pH > 0) g.withAlpha(pH, () => {
            const hx = 820; label(g, 'Hutchinson’s ratio', hx, 752, 1, COL);
            const bill = (x, y, L, col) => { g.circle(x, y, 22, { fill: col }); g.poly([[x + 16, y - 9], [x + 16 + L, y + 2], [x + 16, y + 9]], { fill: col, color: null, w: 0, close: true }); g.circle(x + 6, y - 6, 3, { fill: PAL.bg }); };
            bill(hx + 30, 812, 52, PAL.lagoon); bill(hx + 170, 812, 68, PAL.rose);
            g.math('\\frac{L_{2}}{L_{1}} ≈ 1.3', hx + 290, 826, { size: 36, color: PAL.ink, alpha: P(2.76) });
            g.text('body or bill size of coexisting congeners', hx, 872, { size: 21, color: PAL.ink2, alpha: P(2.68) });
            g.text('weaker than thought (Simberloff & Boecklen 1981)', hx, 902, { size: 21, italic: true, color: PAL.ink3, alpha: P(2.9) });
          });
        });
        // ---------------- beat 3: character displacement in Darwin's ground finches
        const v3 = vis(S, 3, 4, 0.8, 0.7);
        const X3 = (mm) => 200 + (mm - 6) * 80;
        const finch = (x, y, depth, col, a, flip) => { // head with a beak of given depth (mm)
          if (a <= 0) return; const bd = depth * 2.6; ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
          g.circle(0, 0, 22, { fill: col }); g.circle(-14, 18, 18, { fill: col });
          g.poly([[16, -bd / 2], [16 + bd * 0.9, 2], [16, bd / 2]], { fill: mix(col, PAL.ink, 0.4), color: null, w: 0, close: true });
          g.circle(8, -7, 3.2, { fill: PAL.bg }); ctx.restore();
        };
        if (v3 > 0) g.withAlpha(v3, () => {
          label(g, 'Character displacement · Galápagos ground finches', 150, 262, 1, COL);
          const rows = [
            { y: 480, name: 'Santa Cruz', sp: 'both species', tag: 'sympatry', dists: [[8.3, 0.6, PAL.lagoon, 3.55], [12.4, 0.95, COL, 3.48]], kf: 3.05 },
            { y: 668, name: 'Daphne Major', sp: 'G. fortis alone', tag: 'allopatry', dists: [[10.5, 0.65, COL, 3.79]], kf: 3.78 },
            { y: 850, name: 'Los Hermanos', sp: 'G. fuliginosa alone', tag: 'allopatry', dists: [[9.6, 0.55, PAL.lagoon, 3.86]], kf: 3.85 },
          ];
          const pAx = S.p(3, 1.0, 0.3);
          rows.forEach((rw, i) => {
            const ra = i === 0 ? pAx : P(rw.kf);
            g.line(X3(6), rw.y, X3(16), rw.y, { color: PAL.ink2, w: 2, alpha: ra });
            for (let mm = 6; mm <= 16; mm += 2) g.line(X3(mm), rw.y, X3(mm), rw.y + 7, { color: PAL.ink2, w: 1.5, alpha: ra });
            g.text(rw.name, 1110, rw.y - 76, { size: 30, role: 'display', color: PAL.ink, alpha: ra });
            g.text(rw.sp, 1110, rw.y - 46, { size: 21, italic: i > 0, color: PAL.ink2, alpha: ra });
            label(g, rw.tag, 1110, rw.y - 16, ra * (i === 0 ? P(3.68) : 1), i === 0 ? PAL.coral : PAL.ink3);
            rw.dists.forEach(([m, sd, col, kf]) => {
              const pb = P(kf, 1.0); if (pb <= 0) return;
              for (let b = 6; b < 16; b += 0.5) { const v = gaussPdf(b + 0.25, m, sd); if (v < 0.03) continue; const hgt = 118 * v * ease.out(clamp(pb * 1.6 - Math.abs(b + 0.25 - m) * 0.12)); g.rect(X3(b) + 2, rw.y - hgt, 36, hgt, { fill: col, alpha: 0.78, r: 2 }); }
              finch(X3(m) + (m < 10 ? -86 : 86), rw.y - 110, m, col, pb, m < 10);
            });
          });
          for (let mm = 6; mm <= 16; mm += 2) g.text(String(mm), X3(mm), 878, { size: 21, color: PAL.ink3, align: 'center', alpha: P(3.85) });
          g.text('beak depth (mm)', X3(16) + 16, 908, { size: 22, color: PAL.ink2, align: 'right', alpha: P(3.85) });
          // species key
          const kA = P(3.48);
          g.text('G. fortis', 1110, 300, { size: 22, italic: true, color: COL, alpha: kA });
          g.text('G. fuliginosa', 1110, 328, { size: 22, italic: true, color: PAL.lagoon, alpha: P(3.55) });
          // the push apart, in sympatry: outlines start overlapping, then diverge
          const pu = ease.inOut((t - S.b(3.18)) / 2.4), po = S.p(3, 0.9, 0.6) * (1 - 0.6 * P(3.5, 1.2));
          [[lerp(9.7, 8.3, pu), 0.6, PAL.lagoon], [lerp(10.6, 12.4, pu), 0.95, COL]].forEach(([m, sd, col]) => {
            const pts = []; for (let mm = 6; mm <= 16; mm += 0.1) pts.push([X3(mm), 480 - 118 * gaussPdf(mm, m, sd)]);
            g.poly(pts, { color: col, w: 3, dash: [8, 6], alpha: po });
          });
          g.text('schematic, after Lack (1947) and Grant (1986)', 200, 908, { size: 21, italic: true, color: PAL.ink3, alpha: P(3.86) });
          const pp = P(3.19, 1.2);
          g.arrow(X3(9.6), 336, X3(8.3), 336, { color: PAL.lagoon, w: 2.5, head: 13, alpha: pp, progress: pp });
          g.arrow(X3(11.0), 336, X3(12.4), 336, { color: COL, w: 2.5, head: 13, alpha: pp, progress: pp });
          g.text('selection pushes traits apart', X3(10.3), 312, { size: 22, color: PAL.ink, align: 'center', alpha: P(3.19) });
          // convergence on intermediate beaks in allopatry
          const pc = P(3.86, 1.0);
          g.line(X3(10.05), 518, X3(10.05), 856, { color: PAL.ink, w: 1.6, dash: [6, 6], alpha: pc * 0.8 });
          g.text('intermediate', X3(10.05), 510, { size: 21, color: PAL.ink, align: 'center', alpha: pc });
        });
        // ---------------- beat 4: the ghost of competition past
        const v4 = S.p(4, 0.9, 0.7);
        if (v4 > 0) g.withAlpha(v4, () => {
          label(g, 'The ghost of competition past · Connell 1980', 150, 262, 1, COL);
          const A = g.axes({ x: 180, y: 360, w: 1080, h: 360, xmax: 10, ymax: 1.45, xlab: 'resource axis', ylab: 'resource use', labSize: 22, progress: S.p(4, 0.8, 0.2) });
          const m = ease.inOut((t - S.b(4.14)) / 3.4);
          const ws = 0.95;
          const pastM = [4.3, 5.7], nowM = [2.9, 7.1];
          const f = (mu, x) => Math.exp(-((x - mu) ** 2) / (2 * ws * ws));
          // ghost (past): faint, dashed, drifting upward as it fades
          const gh = 1 - 0.7 * m, lift = -60 * m;
          [0, 1].forEach((k) => {
            const col = k ? COL : PAL.lagoon;
            g.with(() => { ctx.translate(0, lift); g.plot(A, (x) => f(pastM[k], x), { from: Math.max(0, pastM[k] - 3.5), to: Math.min(10, pastM[k] + 3.5), color: mix(col, PAL.ink, 0.6), w: 2.5, dash: [8, 7], alpha: 0.65 * gh, progress: S.p(4, 1.2, 0.5) }); });
          });
          const xa = pastM[0] - 3.3 * ws, xb = pastM[1] + 3.3 * ws;
          const ovp = []; for (let k = 0; k <= 80; k++) { const x = lerp(xa, xb, k / 80); ovp.push([A.X(x), A.Y(Math.min(f(pastM[0], x), f(pastM[1], x))) + lift]); }
          g.poly([[A.X(xa), A.Y(0) + lift], ...ovp, [A.X(xb), A.Y(0) + lift]], { fill: rgba(PAL.ink, 0.16 * gh * S.p(4, 0.8, 1.2)), color: null, w: 0, close: true });
          // a small ghost rising from the old overlap
          const gx = A.X(5) + 14 * Math.sin(t * 0.9), gyy = A.Y(0.62) + lift * 1.8 - 30 * m;
          g.withAlpha(0.75 * S.p(4, 1, 1.4) * (1 - m * 0.5), () => {
            ctx.save(); ctx.translate(gx, gyy); ctx.scale(1.5, 1.5); ctx.beginPath(); ctx.arc(0, -10, 22, Math.PI, 0); ctx.lineTo(22, 22); for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(22 - 11 * k - 5.5, 30 + 4 * Math.sin(t * 4 + k), 22 - 11 * (k + 1), 22); ctx.closePath();
            ctx.fillStyle = rgba(PAL.ink, 0.35); ctx.fill(); ctx.fillStyle = PAL.bg; ctx.beginPath(); ctx.arc(-8, -10, 3.5, 0, TAU); ctx.arc(8, -10, 3.5, 0, TAU); ctx.fill(); ctx.restore();
          });
          const lg = S.p(4, 0.8, 1.2);
          g.line(220, 392, 270, 392, { color: PAL.ink2, w: 2.5, dash: [8, 7], alpha: lg * (0.4 + 0.6 * gh) });
          g.text('past: strong overlap, competition', 284, 399, { size: 22, color: PAL.ink2, alpha: lg * (0.4 + 0.6 * gh) });
          g.line(220, 430, 270, 430, { color: PAL.ink, w: 4, alpha: P(4.3) });
          g.text('present: separated, little overlap', 284, 437, { size: 22, color: PAL.ink, alpha: P(4.3) });
          // present: separated, solid
          [0, 1].forEach((k) => {
            const col = k ? COL : PAL.lagoon; const mu = lerp(pastM[k], nowM[k], m);
            g.plot(A, (x) => f(mu, x), { from: Math.max(0, mu - 3.5), to: Math.min(10, mu + 3.5), color: col, w: 4, alpha: m, fillTo: 0, fillColor: rgba(col, 0.1) });
          });
          g.text('no competition today ≠ competition never mattered', 720, 820, { size: 34, role: 'display', italic: true, color: PAL.ink, align: 'center', alpha: P(4.72, 1.0) });
        });
      },
    },
    {
      id: 'niche-modern', title: 'The modern niche',
      beats: [
        { t: 'In 2003, Jonathan Chase and Mathew Leibold reunited the Grinnellian and Eltonian traditions. A species’ niche has two halves: its requirements, the conditions under which its per-capita growth rate is at least zero, and its impacts, the effects it has on those conditions.',
          s: 'In 2003, Jonathan Chase and Mathew Lie-bold reunited the Grinnellian and Eltonian traditions. A species’ niche has two halves: its requirements, the conditions under which its per-capita growth rate is at least zero, and its impacts, the effects it has on those conditions.' },
        { t: 'On a graph of two resources, requirements become a zero net growth isocline, or ZNGI. Above the line the population grows; below it, it shrinks. Impacts become consumption vectors, showing how the species depletes each resource. Tilman’s resource competition theory, coming next, is built from exactly these pieces.',
          s: 'On a graph of two resources, requirements become a zero net growth isocline, or Z-N-G-I. Above the line the population grows; below it, it shrinks. Impacts become consumption vectors, showing how the species depletes each resource. Tilman’s resource competition theory, coming next, is built from exactly these pieces.' },
        { t: 'The Grinnellian niche lives on in species distribution models, which relate occurrences to environmental layers to map suitable habitat. Soberón and Peterson’s BAM diagram clarifies what such models estimate: a species occurs where suitable abiotic conditions, favorable biotic interactions, and access through movement all overlap.',
          s: 'The Grinnellian niche lives on in species distribution models, which relate occurrences to environmental layers to map suitable habitat. Soberon and Peterson’s B A M diagram clarifies what such models estimate: a species occurs where suitable abiotic conditions, favorable biotic interactions, and access through movement all overlap.' },
        { t: 'Finally, organisms reshape their own environments. Beavers flood valleys; earthworms remake soils. This niche construction can alter natural selection on the constructors and on everyone around them.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.5, term: 'Requirement & impact niches', def: 'Chase & Leibold (2003): conditions allowing zero or positive growth, and the species’ per-capita effects on them.' },
        { beat: 1.2, term: 'ZNGI', def: 'Zero net growth isocline: resource levels at which a population’s growth exactly balances its losses.' },
        { beat: 2.15, term: 'Species distribution model', def: 'Statistical model relating occurrences to environmental predictors to map habitat suitability.' },
        { beat: 2.55, term: 'BAM diagram', def: 'Soberón & Peterson: occupied area = overlap of Abiotic suitability, Biotic interactions, and Movement.' },
        { beat: 3.3, term: 'Niche construction', def: 'Modification of the environment by organisms, altering selection on themselves and others.' },
      ],
      init() {
        // Environmental rasters for the SDM vignette (96 × 64 cells, 4 px each).
        const NX = 96, NY = 64, CS = 4;
        const field = (seed, sc, bias) => { const f = []; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) f.push(clamp(0.5 + 0.75 * U.fbm2(i * sc, j * sc, seed, 4) + bias(i / NX, j / NY))); return f; };
        const T = field(11, 0.05, (u, v) => 0.35 * (u - 0.5) - 0.2 * (v - 0.5));
        const Pp = field(29, 0.06, (u, v) => -0.3 * (u - 0.5) + 0.15 * (v - 0.5));
        const Cn = field(53, 0.09, () => 0);
        const suit = T.map((tv, k) => Math.exp(-(((tv - 0.58) / 0.2) ** 2)) * Math.exp(-(((Pp[k] - 0.52) / 0.24) ** 2)) * (0.25 + 0.75 * smooth((Cn[k] - 0.3) / 0.5)));
        const smax = Math.max(...suit); for (let k = 0; k < suit.length; k++) suit[k] /= smax;
        const paint = (vals, ramp) => { const cv = Theater.makeCanvas(NX * CS, NY * CS); const c = cv.getContext('2d'); for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { c.fillStyle = ramp(vals[j * NX + i]); c.fillRect(i * CS, j * CS, CS, CS); } return cv; };
        const rasters = [
          paint(T, (v) => mix(mix(PAL.lagoon, PAL.bg, 0.35), mix(PAL.coral, PAL.bg, 0.1), v)),
          paint(Pp, (v) => mix(mix(PAL.sand, PAL.bg, 0.55), PAL.lagoon, v)),
          paint(Cn, (v) => mix('#1d2a24', PAL.moss, v)),
        ];
        const suitImg = paint(suit, (v) => (v < 0.5 ? mix('#16242a', PAL.heather, v * 2) : mix(PAL.heather, PAL.ochre, (v - 0.5) * 2)));
        // occurrence records: thinned from suitable cells
        const r = rng(77), occ = [];
        for (let tries = 0; occ.length < 16 && tries < 6000; tries++) { const i = Math.floor(r() * NX), j = Math.floor(r() * NY); if (suit[j * NX + i] > 0.62 && r() < suit[j * NX + i] ** 3 && occ.every(([a, b]) => Math.hypot(a - i, b - j) > 7)) occ.push([i + 0.5, j + 0.5]); }
        // beaver valley: trees on both banks
        const trees = []; const rt = rng(91);
        for (let k = 0; k < 70; k++) { const s = rt(), side = rt() < 0.5 ? -1 : 1, off = 50 + rt() * 190; trees.push({ s, off: side * off, r: 9 + rt() * 7 }); }
        return { NX, NY, CS, rasters, suitImg, occ, trees };
      },
      draw(g, t, S, D) {
        const ctx = g.ctx; const P = (kf, d = 0.8) => S.p(kf, d);
        const REQ = PAL.moss, IMP = PAL.coral;
        // ---------------- beat 0: requirements and impacts
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => g.with(() => {
          ctx.translate(40, 0);
          // two traditions flow together
          const pG = P(0.23), pE = P(0.29), pM = P(0.32, 1.4);
          g.text('Grinnellian', 200, 300, { size: 30, role: 'display', italic: true, color: REQ, alpha: pG });
          g.text('what a species needs', 200, 330, { size: 21, color: PAL.ink3, alpha: pG });
          g.text('Eltonian', 1250, 300, { size: 30, role: 'display', italic: true, color: IMP, align: 'right', alpha: pE });
          g.text('what a species does', 1250, 330, { size: 21, color: PAL.ink3, align: 'right', alpha: pE });
          g.carrow(420, 300, 618, 372, -0.22, { color: REQ, w: 3, head: 14, progress: pM, alpha: 0.9 });
          g.carrow(1030, 300, 822, 372, 0.22, { color: IMP, w: 3, head: 14, progress: pM, alpha: 0.9 });
          g.text('Chase & Leibold 2003', 720, 412, { size: 34, role: 'display', color: PAL.ink, align: 'center', alpha: S.p(0, 0.8, 0.8) });
          g.text('Ecological Niches: Linking Classical and Contemporary Approaches', 720, 446, { size: 21, italic: true, color: PAL.ink3, align: 'center', alpha: P(0.1) * (1 - P(0.43, 0.5)) });
          g.text('the niche has two halves', 720, 446, { size: 22, color: PAL.ink2, align: 'center', alpha: P(0.46) });
          // environment ⇄ population
          const pB = P(0.47, 1.0);
          g.rect(190, 520, 330, 300, { fill: rgba(PAL.ink, 0.04), stroke: PAL.rule, w: 1.5, r: 14, alpha: pB });
          label(g, 'Environment', 214, 556, pB, PAL.ink2);
          g.text('resources & conditions', 214, 586, { size: 21, color: PAL.ink3, alpha: pB });
          g.withAlpha(pB, () => {
            g.glow(270, 660, 46, PAL.ochre, 0.5); g.circle(270, 660, 16, { fill: PAL.ochre, alpha: 0.85 });
            for (let k = 0; k < 3; k++) { const x = 350 + k * 34, y = 650 + 10 * Math.sin(t * 1.4 + k); g.ellipse(x, y, 9, 13, { fill: PAL.lagoon, alpha: 0.85 }); }
            for (let k = 0; k < 12; k++) { const x = 230 + (k % 6) * 46 + 6 * Math.sin(t * 0.8 + k), y = 740 + Math.floor(k / 6) * 34; g.dot(x, y, 4.5, PAL.sand, 0.85, 2); }
            g.math('R_{1}', 470, 670, { size: 28, color: PAL.ink2 }); g.math('R_{2}', 470, 765, { size: 28, color: PAL.ink2 });
          });
          const pop = [1005, 670];
          g.circle(pop[0], pop[1], 118, { fill: rgba(PAL.ink, 0.04), stroke: PAL.rule, w: 1.5, alpha: pB });
          label(g, 'Population', pop[0], 530, pB, PAL.ink2, 'center');
          for (let k = 0; k < 34; k++) { const a = k * 2.39996, rr = 92 * Math.sqrt((k + 0.5) / 34); g.dot(pop[0] + rr * Math.cos(a) + 3 * Math.sin(t * 1.7 + k), pop[1] + rr * Math.sin(a) + 3 * Math.cos(t * 1.3 + k * 1.3), 4.5, PAL.mint, pB * 0.9, 2.2); }
          // requirements: environment → population
          const pR = P(0.52, 1.2);
          g.carrow(530, 590, 880, 600, -0.22, { color: REQ, w: 4, head: 17, progress: pR });
          g.text('requirements', 705, 528, { size: 32, role: 'display', color: REQ, align: 'center', alpha: P(0.53) });
          g.text('conditions where', 705, 640, { size: 21, color: PAL.ink2, align: 'center', alpha: P(0.62) });
          g.math('\\frac{1}{N}\\frac{dN}{dt} \\ge 0', 705, 700, { size: 32, color: REQ, align: 'center', alpha: P(0.66) });
          // impacts: population → environment
          const pI = P(0.84, 1.2);
          g.carrow(880, 750, 530, 760, -0.22, { color: IMP, w: 4, head: 17, progress: pI });
          g.text('impacts', 705, 866, { size: 32, role: 'display', color: IMP, align: 'center', alpha: P(0.84) });
          g.text('per-capita effects on those conditions', 705, 900, { size: 21, color: PAL.ink2, align: 'center', alpha: P(0.87) });
        }));
        // ---------------- beat 1: the R1–R2 plane (ZNGI and consumption vector)
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => {
          label(g, 'Two essential resources', 150, 262);
          const A = g.axes({ x: 200, y: 300, w: 560, h: 540, xmax: 10, ymax: 10, xlab: 'R_{1}', ylab: 'R_{2}', progress: S.p(1, 1.0, 0.3) });
          const r1 = 4, r2 = 3.6; const cx = A.X(r1), cy = A.Y(r2);
          // growth / decline regions
          const pg = P(1.37), pd = P(1.44);
          g.rect(cx, A.y, A.x + A.w - cx, cy - A.y, { fill: rgba(REQ, 0.13 * pg) });
          ctx.save(); ctx.globalAlpha *= pd; ctx.fillStyle = rgba(IMP, 0.08); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(cx, A.y); ctx.lineTo(cx, cy); ctx.lineTo(A.x + A.w, cy); ctx.lineTo(A.x + A.w, A.y + A.h); ctx.lineTo(A.x, A.y + A.h); ctx.closePath(); ctx.fill(); ctx.restore();
          g.text('growth', A.X(7.2), A.Y(8.8), { size: 32, role: 'display', italic: true, color: REQ, align: 'center', alpha: pg });
          g.math('dN/dt > 0', A.X(7.2), A.Y(8.8) + 40, { size: 28, color: REQ, align: 'center', alpha: pg });
          g.text('decline', A.X(2), A.Y(8.8), { size: 32, role: 'display', italic: true, color: IMP, align: 'center', alpha: pd });
          g.math('dN/dt < 0', A.X(2), A.Y(8.8) + 40, { size: 28, color: IMP, align: 'center', alpha: pd });
          g.text('decline', A.X(7.2), A.Y(1.6), { size: 26, role: 'display', italic: true, color: IMP, align: 'center', alpha: pd * 0.8 });
          // ZNGI
          const pz = P(1.16, 1.6);
          g.poly([[cx, A.Y(10)], [cx, cy], [A.X(10), cy]], { color: REQ, w: 5, progress: pz });
          g.text('ZNGI', A.X(9.9), cy - 16, { size: 26, weight: 600, color: REQ, align: 'right', alpha: P(1.26) });
          g.text('zero net growth isocline', A.X(9.9), cy + 30, { size: 21, color: PAL.ink2, align: 'right', alpha: P(1.26) });
          g.math('R_{1}^{*}', cx, A.Y(0) + 36, { size: 26, color: REQ, align: 'center', alpha: P(1.24) });
          g.math('R_{2}^{*}', A.x - 12, cy + 9, { size: 26, color: REQ, align: 'right', alpha: P(1.24) });
          // consumption vector at the corner, and a resource state being drawn down along it
          const pc = P(1.53, 1.0);
          const cvx = -1.7, cvy = -1.25;
          g.arrow(cx, cy, A.X(r1 + cvx), A.Y(r2 + cvy), { color: IMP, w: 4.5, head: 18, progress: pc });
          g.dot(cx, cy, 7, REQ, P(1.2), 2.6);
          g.text('consumption vector', A.X(r1 + cvx) + 4, A.Y(r2 + cvy) + 44, { size: 22, color: IMP, alpha: P(1.56) });
          const pt = clamp((t - S.b(1.62)) / 4.0);
          if (pt > 0) {
            const s0 = [8.6, 6.4];
            // path from S toward the ZNGI, parallel to the consumption vector
            const k = (s0[1] - r2) / (-cvy); const end = [s0[0] + cvx * k, r2]; const q = ease.inOut(pt);
            const px = lerp(s0[0], end[0], q), py = lerp(s0[1], end[1], q);
            g.line(A.X(s0[0]), A.Y(s0[1]), A.X(px), A.Y(py), { color: IMP, w: 2, dash: [6, 6], alpha: 0.8 });
            g.dot(A.X(s0[0]), A.Y(s0[1]), 6, PAL.ochre, P(1.62), 2.4);
            g.dot(A.X(px), A.Y(py), 6.5, PAL.ink, 1, 2.6);
            g.text('consumption draws R down', A.X(s0[0]) - 40, A.Y(s0[1]) - 20, { size: 21, color: PAL.ink2, align: 'center', alpha: P(1.64) });
          }
          // what maps to what
          const rx = 840;
          label(g, 'Requirement niche', rx, 380, P(1.2), REQ);
          g.text('the ZNGI: where births', rx, 414, { size: 22, color: PAL.ink2, alpha: P(1.22) });
          g.text('exactly balance losses', rx, 442, { size: 22, color: PAL.ink2, alpha: P(1.22) });
          label(g, 'Impact niche', rx, 520, P(1.53), IMP);
          g.text('consumption vector: how the', rx, 554, { size: 22, color: PAL.ink2, alpha: P(1.55) });
          g.text('species depletes each resource', rx, 582, { size: 22, color: PAL.ink2, alpha: P(1.6) });
          const pT = P(1.75);
          g.rect(rx, 660, 450, 150, { fill: rgba(COL, 0.07), stroke: rgba(COL, 0.5), w: 1.5, r: 10, alpha: pT });
          label(g, 'Coming next', rx + 24, 698, pT, COL);
          g.text('Tilman’s resource competition', rx + 24, 734, { size: 24, color: PAL.ink, alpha: pT });
          g.text('theory: ZNGIs + impact vectors', rx + 24, 764, { size: 22, color: PAL.ink2, alpha: P(1.84) });
          g.text('+ supply points', rx + 24, 792, { size: 22, color: PAL.ink2, alpha: P(1.9) });
        });
        // ---------------- beat 2: species distribution models and the BAM diagram
        const v2 = vis(S, 2, 3, 0.8, 0.5);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Species distribution model', 150, 262, 1, REQ);
          const W = D.NX * D.CS, H = D.NY * D.CS;
          const layer = (img, FLx, FLy, a) => { if (a <= 0) return; const BL = [FLx + 120, FLy - 60]; ctx.save(); ctx.globalAlpha *= a; ctx.transform(290 / W, 50 / W, -120 / H, 60 / H, BL[0], BL[1]); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0); ctx.strokeStyle = rgba(PAL.ink, 0.5); ctx.lineWidth = 3; ctx.strokeRect(0, 0, W, H); ctx.restore(); };
          const onLayer = (FLx, FLy, u, v) => [FLx + 120 + u * 290 / D.NX - 120 * v / D.NY, FLy - 60 + u * 50 / D.NX + 60 * v / D.NY];
          const names = [['temperature'], ['precipitation'], ['canopy height', '(lidar)']];
          const base = [[150, 520], [150, 445], [150, 370]]; // bottom → top: canopy, precipitation, temperature
          [2, 1, 0].forEach((k, i) => {
            const [fx, fy] = base[i]; const a = P(2.05 + 0.04 * (2 - k), 0.8); layer(D.rasters[k], fx, fy, a);
            names[k].forEach((nm, j) => g.text(nm, fx + 420, fy - 26 + j * 26, { size: 22, color: PAL.ink2, alpha: a }));
          });
          // occurrences drop onto the stack; values extracted through the layers
          const po = P(2.18, 1.0);
          D.occ.forEach(([u, v], k) => {
            const pk = clamp((t - S.b(2.18) - k * 0.06) / 0.7); if (pk <= 0) return;
            const [x, y] = onLayer(150, 370, u, v);
            g.line(x, y, x, y + 150, { color: PAL.ink, w: 1, dash: [3, 4], alpha: 0.5 * P(2.25) });
            g.dot(x, y - 60 * (1 - ease.out(pk)), 4.2, PAL.ink, pk, 2.4);
          });
          g.text('occurrences', 150, 300, { size: 22, color: PAL.ink, alpha: po });
          const pm = P(2.31, 1.0);
          g.arrow(360, 600, 360, 680, { color: PAL.ink2, w: 2.5, head: 13, alpha: pm, progress: pm });
          g.text('fit & project', 378, 648, { size: 21, color: PAL.ink3, alpha: pm });
          layer(D.suitImg, 150, 790, pm);
          D.occ.forEach(([u, v]) => { const [x, y] = onLayer(150, 790, u, v); g.circle(x, y, 3.2, { fill: PAL.ink, alpha: pm * 0.9 }); });
          g.text('suitable habitat', 570, 770, { size: 22, color: PAL.ochre, alpha: pm });
          // BAM
          const pb = P(2.45);
          label(g, 'BAM · Soberón & Peterson 2005', 790, 262, pb, COL);
          const CA = [935, 495], CB = [1135, 495], CM = [1035, 668], RR = 142;
          const circ = (c) => { const p = new Path2D(); p.arc(c[0], c[1], RR, 0, TAU); return p; };
          const cA = circ(CA), cB = circ(CB), cM = circ(CM);
          const aA = P(2.71), aB = P(2.78), aM = P(2.86), aO = P(2.91, 1.0);
          const draw = (path, col, a) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = rgba(col, 0.12); ctx.fill(path); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(path); ctx.restore(); };
          draw(cA, PAL.ochre, aA); draw(cB, REQ, aB); draw(cM, PAL.lagoon, aM);
          if (aO > 0) {
            ctx.save(); ctx.clip(cA); ctx.clip(cB);
            ctx.save(); const q = new Path2D(); q.rect(0, 0, g.W, g.H); q.addPath(cM); ctx.clip(q, 'evenodd'); ctx.globalAlpha *= aO * 0.6; ctx.strokeStyle = rgba(PAL.ink, 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 700; k < 1400; k += 12) { ctx.moveTo(k, 300); ctx.lineTo(k - 300, 600); } ctx.stroke(); ctx.restore();
            ctx.clip(cM); ctx.globalAlpha *= aO; ctx.fillStyle = rgba(PAL.ochre, 0.55 + 0.15 * Math.sin(t * 3)); ctx.fillRect(800, 350, 500, 500); ctx.restore();
          }
          g.text('A', 875, 480, { size: 44, role: 'display', italic: true, color: PAL.ochre, align: 'center', alpha: aA });
          g.text('B', 1195, 480, { size: 44, role: 'display', italic: true, color: REQ, align: 'center', alpha: aB });
          g.text('M', 1035, 748, { size: 44, role: 'display', italic: true, color: PAL.lagoon, align: 'center', alpha: aM });
          g.text('abiotic conditions', 935, 332, { size: 22, color: PAL.ochre, align: 'center', alpha: aA });
          g.text('biotic interactions', 1135, 332, { size: 22, color: REQ, align: 'center', alpha: aB });
          g.text('movement (access)', 1035, 840, { size: 22, color: PAL.lagoon, align: 'center', alpha: aM });
          g.math('G_{O}', 1035, 578, { size: 30, color: PAL.bg, align: 'center', alpha: aO });
          g.math('G_{I}', 1035, 422, { size: 26, color: PAL.ink, align: 'center', alpha: aO });
          g.text('occupied = A ∩ B ∩ M', 1035, 874, { size: 22, weight: 600, color: PAL.ochre, align: 'center', alpha: aO });
          g.text('hatched: suitable but unreached', 1035, 902, { size: 21, color: PAL.ink3, align: 'center', alpha: aO });
        });
        // ---------------- beat 3: niche construction
        const v3 = S.p(3, 0.9, 0.5);
        if (v3 > 0) g.withAlpha(v3, () => {
          label(g, 'Niche construction', 150, 262, 1, COL);
          // valley (plan view), stream, dam and spreading pond
          const s0 = [170, 300], s1 = [800, 880]; const vd = [s1[0] - s0[0], s1[1] - s0[1]]; const L = Math.hypot(vd[0], vd[1]); const ux = vd[0] / L, uy = vd[1] / L, nx = -uy, ny = ux;
          const at = (s, off) => { const w = 26 * Math.sin(s * 9) + 12 * Math.sin(s * 23 + 1); return [s0[0] + vd[0] * s + nx * (w + off), s0[1] + vd[1] * s + ny * (w + off)]; };
          g.clip(130, 285, 700, 620, () => {
            for (let k = -3; k <= 3; k++) { if (!k) continue; const pts = []; for (let s = -0.1; s <= 1.1; s += 0.02) pts.push(at(s, k * 70 + 18 * Math.sin(s * 5 + k))); g.poly(pts, { color: rgba(PAL.sand, 0.12 + 0.03 * Math.abs(k)), w: 1.3 }); }
            const sd = 0.56; const dam = at(sd, 0);
            const grow = ease.inOut((t - S.b(3.22)) / 6.5);
            // the pond follows the valley upstream of the dam: widest near the dam, tapering upstream
            const Lp = 30 + 360 * grow, Wm = 46 + 64 * grow;
            const hwid = (a) => { const f = a / Lp; return f >= 1 ? 0 : lerp(46, Wm, smooth(f / 0.35)) * Math.sqrt(1 - f * f) * (1 + 0.1 * Math.sin(a / 23 + 1)); };
            const inPond = (s, off) => { const a = (sd - s) * L; return a >= 0 && a <= Lp && Math.abs(off) < hwid(a) - 4; };
            // stream
            const st = []; for (let s = -0.1; s <= 1.1; s += 0.01) st.push(at(s, 0));
            g.poly(st, { color: PAL.lagoon, w: 6, alpha: 0.8 });
            const lb = [], rb = []; for (let i = 0; i <= 60; i++) { const a = Lp * i / 60, s = sd - a / L, h = hwid(a); lb.push(at(s, h)); rb.push(at(s, -h)); }
            const pond = [...lb, ...rb.reverse()];
            const pa = clamp(grow * 5);
            g.poly(pond, { fill: rgba(PAL.lagoon, 0.3), color: PAL.lagoon, w: 2, close: true, alpha: pa });
            for (let k = 1; k <= 2; k++) { const ring = []; for (let i = 0; i <= 40; i++) { const a = Lp * (0.08 + 0.8 * i / 40) * (1 - k * 0.12), s = sd - a / L, h = hwid(a) * (1 - k * 0.3); ring.push(at(s, h)); } for (let i = 40; i >= 0; i--) { const a = Lp * (0.08 + 0.8 * i / 40) * (1 - k * 0.12), s = sd - a / L, h = hwid(a) * (1 - k * 0.3); ring.push(at(s, -h)); } g.poly(ring, { color: rgba(PAL.lagoon, 0.25), w: 1.2, close: true, alpha: pa }); }
            // trees; drowned ones become grey snags
            D.trees.forEach((tr) => { const [x, y] = at(tr.s, tr.off); if (x < 150 || x > 805 || y < 305 || y > 885) return; const wet = inPond(tr.s, tr.off); if (wet) { g.circle(x, y, 3.5, { fill: PAL.ink3 }); g.line(x - 6, y - 4, x + 6, y + 4, { color: PAL.ink3, w: 1.6 }); g.line(x - 5, y + 5, x + 5, y - 5, { color: PAL.ink3, w: 1.6 }); } else { g.circle(x, y, tr.r, { fill: mix(PAL.moss, PAL.bg, 0.55) }); g.circle(x - tr.r * 0.25, y - tr.r * 0.25, tr.r * 0.55, { fill: mix(PAL.moss, PAL.bg, 0.35) }); } });
            // the dam
            const dmp = []; for (let k = -1; k <= 1.001; k += 0.1) dmp.push([dam[0] + nx * k * 46 + ux * 8 * (1 - k * k), dam[1] + ny * k * 46 + uy * 8 * (1 - k * k)]);
            g.poly(dmp, { color: mix(PAL.sand, PAL.coral, 0.35), w: 11, progress: P(3.02, 1.2) });
            for (let k = 0; k < 7; k++) { const q = dmp[2 + k * 2]; g.line(q[0] - nx * 5 - ux * 6, q[1] - ny * 5 - uy * 6, q[0] + nx * 5 + ux * 6, q[1] + ny * 5 + uy * 6, { color: mix(PAL.sand, PAL.bg, 0.3), w: 2.5, alpha: P(3.02, 1.2) }); }
            // the beaver swims a loop in the pond
            if (P(3.02) > 0) {
              const th = t * 0.5; const ac = Lp * 0.42, ar = Lp * 0.26; const pos = (q) => { const a = ac + ar * Math.cos(q), s = sd - a / L; return at(s, hwid(a) * 0.5 * Math.sin(q)); };
              const [bx, by] = pos(th), [qx, qy] = pos(th + 0.05); const ang = Math.atan2(qy - by, qx - bx);
              ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.globalAlpha *= P(3.02);
              g.line(-14, 0, -60, -18, { color: rgba(PAL.ink, 0.35), w: 1.5 }); g.line(-14, 0, -60, 18, { color: rgba(PAL.ink, 0.35), w: 1.5 });
              g.ellipse(-20, 0, 9, 6, { fill: mix(PAL.sand, PAL.bg, 0.5) }); g.ellipse(0, 0, 15, 9, { fill: mix(PAL.sand, PAL.coral, 0.3) }); g.circle(14, 0, 6, { fill: mix(PAL.sand, PAL.coral, 0.3) });
              ctx.restore();
            }
          });
          { const sd = 0.56, w = 26 * Math.sin(sd * 9) + 12 * Math.sin(sd * 23 + 1), L = Math.hypot(630, 580); const dx = 170 + 630 * sd - (580 / L) * w, dy = 300 + 580 * sd + (630 / L) * w; g.text('beaver dam', dx + 44, dy + 40, { size: 22, color: PAL.ink2, alpha: P(3.1) }); }
          // feedback loop
          const O = [1080, 380], E = [1080, 650], RN = 56;
          const pf = P(3.0, 1.0);
          g.circle(O[0], O[1], RN, { fill: rgba(PAL.panel, 0.9), stroke: PAL.sand, w: 2.2, alpha: pf });
          g.withAlpha(pf, () => { g.ellipse(O[0] - 18, O[1] + 8, 14, 8, { fill: mix(PAL.sand, PAL.bg, 0.45) }); g.ellipse(O[0] + 2, O[1] + 2, 22, 15, { fill: mix(PAL.sand, PAL.coral, 0.3) }); g.circle(O[0] + 22, O[1] - 6, 9, { fill: mix(PAL.sand, PAL.coral, 0.3) }); g.circle(O[0] + 25, O[1] - 9, 1.6, { fill: PAL.bg }); });
          g.text('organism', O[0], O[1] - RN - 14, { size: 22, color: PAL.ink, align: 'center', alpha: pf });
          g.circle(E[0], E[1], RN, { fill: rgba(PAL.lagoon, 0.12), stroke: PAL.lagoon, w: 2.2, alpha: pf });
          g.withAlpha(pf, () => { for (let k = 0; k < 3; k++) g.poly(Array.from({ length: 13 }, (_, i) => [E[0] - 30 + i * 5, E[1] - 12 + k * 12 + 3 * Math.sin(i * 0.9 + t * 2 + k)]), { color: PAL.lagoon, w: 2 }); });
          g.text('environment', E[0], E[1] + RN + 30, { size: 22, color: PAL.ink, align: 'center', alpha: pf });
          const pa1 = P(3.29, 1.2), pa2 = P(3.68, 1.2);
          g.carrow(O[0] - RN - 6, O[1] + 20, E[0] - RN - 6, E[1] - 20, 0.45, { color: PAL.sand, w: 3.5, head: 15, progress: pa1 });
          g.carrow(E[0] + RN + 6, E[1] - 20, O[0] + RN + 6, O[1] + 20, 0.45, { color: COL, w: 3.5, head: 15, progress: pa2 });
          g.text('reshapes', O[0] - 150, 520, { size: 23, color: PAL.sand, align: 'right', alpha: pa1 });
          g.text('alters', O[0] + 150, 506, { size: 23, color: COL, alpha: pa2 });
          g.text('selection', O[0] + 150, 534, { size: 23, color: COL, alpha: pa2 });
          // ...and on everyone around them
          const pe = P(3.91, 0.7);
          [['fish', E[0] - 175, E[1] + 165, PAL.lagoon], ['bird', E[0], E[1] + 196, PAL.ink2], ['plant', E[0] + 175, E[1] + 160, REQ]].forEach(([kind, x, y, col], k) => {
            const a = clamp(pe * 1.4 - k * 0.2); const dx = x - E[0], dy = y - E[1], dl = Math.hypot(dx, dy);
            g.line(E[0] + dx / dl * (RN + 62), E[1] + dy / dl * (RN + 62), x - dx / dl * 34, y - dy / dl * 34, { color: COL, w: 1.6, dash: [4, 5], alpha: a });
            g.icon(kind, x, y, 50, col, { alpha: a, flap: 0.5 + 0.4 * Math.sin(t * 6) });
          });
          g.text('…and on everyone around them', E[0], 906, { size: 22, color: COL, align: 'center', alpha: P(3.93) });
          // earthworms remake soils (inset)
          const pw = P(3.41) * (1 - P(3.88));
          if (pw > 0) g.withAlpha(pw, () => {
            const ix = 860, iy = 796, iw = 440, ih = 100;
            g.rect(ix, iy, iw, ih, { fill: mix(PAL.sand, PAL.bg, 0.82), stroke: PAL.rule, w: 1.2, r: 8 });
            g.rect(ix, iy, iw, 38, { fill: mix(PAL.coral, PAL.bg, 0.78), r: 8 });
            for (let k = 0; k < 6; k++) { const x0 = ix + 30 + k * 72; const bp = []; for (let i = 0; i <= 12; i++) { const u = i / 12; bp.push([x0 + 14 * Math.sin(u * 5 + k), iy + 8 + u * (ih - 16)]); } g.poly(bp, { color: rgba(PAL.bg, 0.55), w: 5 }); g.ellipse(x0, iy - 3, 9, 4, { fill: mix(PAL.coral, PAL.bg, 0.6) }); }
            const wp = []; for (let k = 0; k <= 20; k++) { const u = k / 20; wp.push([ix + 230 + u * 90, iy + 70 + 8 * Math.sin(u * 10 - t * 4)]); }
            g.poly(wp, { color: PAL.rose, w: 7 });
            g.text('earthworms remake soils', ix + 14, iy - 12, { size: 21, color: PAL.ink2 });
          });
        });
      },
    },
  ],
});
})();
