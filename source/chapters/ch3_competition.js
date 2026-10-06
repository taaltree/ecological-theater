/* Chapter III — Competition. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.heather;
// Semantic colours used throughout the chapter.
const C1 = PAL.moss, C2 = PAL.rose, RES = PAL.ochre, ENEMY = PAL.coral;

/* ------------------------------------------------------------ helpers */
const label = (g, s, x, y, a = 1, col = PAL.ink3) => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a });
// visibility envelope: in at beat k0, out at beat k1
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));
// window with delays: in at beat k0 + d0, out at beat k1 + d1
const win = (S, k0, d0, k1, d1, d = 0.8) => S.p(k0, d, d0) * (k1 === undefined || k1 === null ? 1 : 1 - S.p(k1, 0.6, d1 || 0));
const frac = (x) => x - Math.floor(x);
const H3 = (i, j, s = 7) => U.hash3(i, j, s);
const note = (g, s, x, y, o = {}) => g.text(s, x, y, { size: 21, color: PAL.ink2, ...o });
const panelBox = (g, x, y, w, h, a = 1, stroke = PAL.rule) => g.rect(x, y, w, h, { r: 8, fill: 'rgba(14,29,31,0.55)', stroke, w: 1.4, alpha: a });

// A simple drawn plant: stem + leaf pairs; wilt in [0,1] droops it.
function sprout(g, x, gy, h, col, a = 1, wilt = 0) {
  if (a <= 0) return;
  const c = g.ctx; const tx = x + wilt * h * 0.55, ty = gy - h * (1 - wilt * 0.45);
  g.withAlpha(a, () => {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(2, h * 0.06); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x, gy - h * 0.55, tx, ty); c.stroke();
    for (let k = 0; k < 3; k++) {
      const f = 0.38 + k * 0.2; const lx = lerp(x, tx, f * f), ly = lerp(gy, ty, f); const s = h * (0.2 - k * 0.03);
      const droop = wilt * 0.9;
      c.beginPath(); c.ellipse(lx - s * 0.6, ly + droop * s * 0.5, s * 0.7, s * 0.26, -0.5 + droop, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(lx + s * 0.6, ly + droop * s * 0.5, s * 0.7, s * 0.26, 0.5 + droop, 0, Math.PI * 2); c.fill();
    }
  });
}
// Hexagon outline
function hexPts(cx, cy, r) { const p = []; for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
// Clash sparks
function sparks(g, x, y, r, col, a, t) {
  if (a <= 0) return;
  for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + 0.3 * Math.sin(t * 9 + k); const r0 = r * 0.35, r1 = r * (0.75 + 0.25 * Math.sin(t * 13 + k * 2)); g.line(x + r0 * Math.cos(ang), y + r0 * Math.sin(ang), x + r1 * Math.cos(ang), y + r1 * Math.sin(ang), { color: col, w: 2.5, alpha: a }); }
}

/* ===================================================== scene 1 helpers */
function signMatrix(g, S) {
  label(g, 'Interaction signs', 140, 262);
  const x0 = 222, y0 = 360, cw = 150, ch = 116, sg = ['+', '0', '−'];
  const nm = { '++': ['mutualism'], '+0': ['commensalism'], '+−': ['predation,', 'parasitism'], '00': ['neutralism'], '0−': ['amensalism'], '−−': ['competition'] };
  const pa = S.p(0, 0.8, 0.2);
  g.text('effect on species 1', x0 + 1.5 * cw, 300, { size: 21, color: PAL.ink2, align: 'center', alpha: pa });
  sg.forEach((s, i) => g.text(s, x0 + (i + 0.5) * cw, 342, { size: 32, role: 'math', align: 'center', alpha: pa }));
  sg.forEach((s, j) => g.text(s, x0 - 24, y0 + (j + 0.5) * ch + 11, { size: 32, role: 'math', align: 'center', alpha: pa }));
  g.with(() => { g.ctx.translate(x0 - 62, y0 + 1.5 * ch); g.ctx.rotate(-Math.PI / 2); g.text('effect on species 2', 0, 0, { size: 21, color: PAL.ink2, align: 'center', alpha: pa }); });
  const hp = S.p(0, 0.9, 2.8);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const p = S.p(0, 0.6, 0.5 + (i + j) * 0.22); if (p <= 0) continue;
    const x = x0 + i * cw, y = y0 + j * ch; const comp = i === 2 && j === 2; const dup = j > i;
    const key = sg[Math.min(i, j)] + sg[Math.max(i, j)];
    const a = p * (dup ? 0.5 : 1) * (comp ? 1 : 1 - 0.35 * hp);
    g.rect(x + 4, y + 4, cw - 8, ch - 8, { r: 6, fill: comp ? U.rgba(COL, 0.06 + 0.2 * hp) : 'rgba(238,231,215,0.04)', stroke: comp ? COL : PAL.rule, w: comp ? 1.2 + 1.6 * hp : 1.2, alpha: a });
    if (comp) g.glow(x + cw / 2, y + ch / 2, 90, COL, 0.35 * hp);
    g.text(`(${sg[i]}, ${sg[j]})`, x + cw / 2, y + 40, { size: 22, role: 'math', color: comp ? COL : PAL.ink3, align: 'center', alpha: a });
    const L = nm[key];
    L.forEach((s, k) => g.text(s, x + cw / 2, y + 74 + k * 23 - (L.length - 1) * 6, { size: L.length > 1 ? 19 : 21, weight: comp ? 600 : 400, color: comp ? PAL.ink : PAL.ink2, align: 'center', alpha: a }));
  }
  const q = S.p(0, 0.9, 4.6);
  g.text('Competition: each lowers the other’s growth,', 140, 776, { size: 22, color: PAL.ink, alpha: q });
  g.text('because both need the same limited resource.', 140, 808, { size: 22, color: PAL.ink2, alpha: q });
}

function crowdBox(g, t, B, cols, n, nVis, seed, a, title, sub, col) {
  if (a <= 0) return;
  g.withAlpha(a, () => {
    panelBox(g, B.x, B.y, B.w, B.h);
    label(g, title, B.x + 20, B.y + 34, 1, col);
    note(g, sub, B.x + 20, B.y + 62, { color: PAL.ink2 });
    // resource specks
    for (let k = 0; k < 12; k++) {
      const x = B.x + 50 + (B.w - 100) * H3(k, 9, seed), y = B.y + 96 + (B.h - 120) * H3(k, 10, seed);
      g.circle(x, y, 3.2, { fill: RES, alpha: 0.55 + 0.25 * Math.sin(t * 2 + k) });
    }
    const pos = [];
    for (let i = 0; i < n; i++) {
      const va = clamp(nVis - i); if (va <= 0) continue;
      const bx = B.x + 52 + (B.w - 104) * H3(i, 1, seed), by = B.y + 104 + (B.h - 150) * H3(i, 2, seed);
      const x = bx + 26 * U.noise1(t * 0.32 + i * 3.1, seed), y = by + 16 * U.noise1(t * 0.27 + i * 5.3, seed + 1);
      pos.push([x, y, cols[i % cols.length], va]);
    }
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
      if (d < 56) g.line(pos[i][0], pos[i][1], pos[j][0], pos[j][1], { color: ENEMY, w: 1.6, alpha: 0.75 * (1 - d / 56) * pos[i][3] * pos[j][3] });
    }
    for (const [x, y, c, va] of pos) g.dot(x, y, 7, c, va, 2.4);
  });
}

function exploitPanel(g, t, S) {
  label(g, 'Exploitative · indirect', 140, 262);
  const lv = lerp(0.92, 0.2, S.io(1, 13, 3.4));
  const px = 312, py = 420, pw = 190, ph = 290, cx = px + pw / 2;
  const top = py + ph * (1 - lv);
  // streams from the pool to each consumer cluster
  const cl = [[196, 560, C1], [616, 560, C2]];
  cl.forEach(([qx, qy, col], side) => {
    for (let k = 0; k < 9; k++) {
      const u = frac(S.since(1) * 0.42 + k / 9 + side * 0.05);
      const sx = cx + (side ? 40 : -40), sy = top + 4; const mx = (sx + qx) / 2, my = Math.min(sy, qy) - 120;
      const x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * qx, y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * qy;
      g.circle(x, y, 4.8, { fill: RES, alpha: Math.sin(Math.PI * u) * clamp(lv * 1.6) * S.p(1, 0.8, 0.8) });
    }
  });
  // basin and fill
  g.clip(px, top, pw, py + ph - top, () => g.rect(px, py, pw, ph, { r: 18, fill: U.rgba(RES, 0.42) }));
  const wave = []; for (let k = 0; k <= 30; k++) { const x = px + 6 + (pw - 12) * k / 30; wave.push([x, top + 3 * Math.sin(k * 0.7 + S.t * 2.4)]); }
  g.poly(wave, { color: RES, w: 2.5, alpha: 0.9 });
  g.rect(px, py, pw, ph, { r: 18, stroke: PAL.ink2, w: 2.5 });
  g.math('R', cx, py + ph + 48, { size: 42, color: RES, align: 'center' });
  g.text('shared resource', cx, py - 20, { size: 22, color: RES, align: 'center' });
  g.text(Math.round(lv * 100) + '%', px + pw + 12, top + 8, { size: 20, role: 'mono', color: RES, alpha: 0.9 });
  // consumers
  cl.forEach(([qx, qy, col], side) => {
    for (let k = 0; k < 8; k++) {
      const ang = k * 0.8 + side, rr = k === 0 ? 0 : 22 + 16 * (k % 2);
      g.dot(qx + rr * Math.cos(ang) + 4 * U.noise1(S.t * 0.6 + k, side + 3), qy + rr * Math.sin(ang) + 4 * U.noise1(S.t * 0.5 + k, side + 9), 8, col, 1, 2.3);
    }
    g.text(side ? 'species 2' : 'species 1', qx, qy + 80, { size: 22, color: col, align: 'center' });
  });
  // the indirect pathway
  const q = S.p(1, 0.8, 4.4);
  g.text('each lowers R for the other', 405, 826, { size: 22, color: PAL.ink, align: 'center', alpha: q });
  g.text('water · nitrogen · prey', 405, 862, { size: 21, color: PAL.ink3, align: 'center', alpha: S.p(1, 0.8, 6.6) });
}

function interferePanel(g, t, S) {
  const a = S.p(1, 0.8, 8.6); if (a <= 0) return;
  g.withAlpha(a, () => {
    label(g, 'Interference · direct', 780, 262);
    const cx = 1035, cy = 530, R = 165;
    g.circle(cx, cy, R, { fill: U.rgba(C1, 0.06), stroke: C1, w: 2, dash: [9, 8] });
    g.text('defended territory', cx, cy - R - 18, { size: 22, color: C1, align: 'center' });
    for (let k = 0; k < 11; k++) { const ang = k * 2.4, rr = 40 + 80 * H3(k, 3); g.circle(cx + rr * Math.cos(ang), cy + 30 + rr * 0.55 * Math.sin(ang), 3.6, { fill: RES, alpha: 0.75 }); }
    const T = 4.4, tt = S.since(1) - 9.1; const cyc = Math.floor(tt / T), u = frac(tt / T);
    const side = cyc % 2 === 0 ? 0 : Math.PI; const ang = side + (H3(cyc, 5) - 0.5) * 0.8;
    const rIn = u < 0.45 ? lerp(245, R + 8, ease.inOut(u / 0.45)) : u < 0.6 ? R + 8 : lerp(R + 8, 255, ease.inOut((u - 0.6) / 0.4));
    const ix = cx + rIn * Math.cos(ang), iy = cy + rIn * Math.sin(ang) * 0.7;
    const lunge = Math.sin(Math.PI * clamp((u - 0.32) / 0.42)) * 0.8;
    const ox = lerp(cx, ix, lunge * (R - 30) / rIn), oy = lerp(cy - 10, iy, lunge * (R - 30) / rIn);
    const fleeing = u >= 0.6;
    g.icon('songbird', ix, iy, 62, C2, { flip: fleeing ? Math.cos(ang) < 0 : Math.cos(ang) > 0 });
    g.icon('songbird', ox, oy, 74, C1, { flip: Math.cos(ang) < 0 });
    sparks(g, (ix + ox) / 2, (iy + oy) / 2 - 6, 40, ENEMY, clamp((u - 0.4) / 0.06) * (1 - clamp((u - 0.62) / 0.08)), S.t);
    g.text('owner', cx, cy + R + 34, { size: 22, color: C1, align: 'center' });
    g.text('intruder', ix, iy - 44, { size: 21, color: C2, align: 'center' });
    note(g, 'the intruder is driven off before it can feed', 1035, 770, { align: 'center' });
    const tags = [['aggression', 14.5], ['territoriality', 15.2], ['chemical means', 16.4]];
    let x = 830; tags.forEach(([s, d]) => { const w = g.pill(s, x, 830, { color: ENEMY, size: 21, alpha: S.p(1, 0.6, d) }); x += w + 16; });
  });
}

/* Schoener's six mechanisms: vignettes drawn in a w×h box at (x,y). */
const VIG = {
  consume(g, x, y, w, h, t) {
    const cx = x + w / 2, cy = y + h / 2 + 6;
    for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 6 + 26 * H3(k, 4); g.circle(cx + r * Math.cos(a), cy + r * Math.sin(a), 3.4, { fill: RES, alpha: 0.85 }); }
    const ends = [[x + 40, cy, C1, 'sp. 1'], [x + w - 40, cy, C2, 'sp. 2']];
    ends.forEach(([ex, ey, col, nm], s) => {
      for (let k = 0; k < 6; k++) { const u = frac(t * 0.55 + k / 6 + s * 0.08); g.circle(lerp(cx + (s ? 22 : -22), ex, u), ey + 26 * Math.sin(Math.PI * u) * (k % 2 ? 1 : -1), 3.6, { fill: RES, alpha: Math.sin(Math.PI * u) }); }
      g.dot(ex, ey, 16, col, 1, 2.2);
      g.text(nm, ex, ey + 50, { size: 20, color: col, align: 'center' });
    });
  },
  preempt(g, x, y, w, h, t) {
    const gy = y + h - 30; g.rect(x, gy, w, 30, { fill: 'rgba(216,196,155,0.16)', r: 4 });
    for (let k = 0; k < 7; k++) g.icon('barnacle', x + 26 + k * (w - 52) / 6, gy - 14, 36, C1);
    const u = frac(t / 3.4); const lx = x + w * 0.56;
    const ly = u < 0.5 ? lerp(y + 6, gy - 52, ease.out(u / 0.5)) : gy - 52 - 70 * ease.inOut((u - 0.5) / 0.5);
    const dx = u < 0.5 ? 0 : 90 * ease.inOut((u - 0.5) / 0.5);
    g.dot(lx + dx, ly, 6, C2, u < 0.92 ? 1 : (1 - u) / 0.08, 2.4);
    g.text('×', lx, gy - 30, { size: 26, color: ENEMY, align: 'center', alpha: clamp((u - 0.45) / 0.05) * (1 - clamp((u - 0.7) / 0.1)) });
    g.text('settler: no space left', x + w, y + 14, { size: 20, color: C2, align: 'right', alpha: 0.9 });
  },
  overgrow(g, x, y, w, h, t, p) {
    const gy = y + h - 12; g.line(x, gy, x + w, gy, { color: PAL.sand, w: 2, alpha: 0.5 });
    const mx = x + w * 0.66; const plW = lerp(70, 250, p); const sx = x + 60, py = y + 74;
    const shade = clamp((sx + plW - (mx - 70)) / 140);
    g.clip(x, y, w, gy - y, () => g.ellipse(mx, gy, 74, 56, { fill: U.mix(C1, '#24312b', 0.6 * shade) }));
    // rays
    for (let k = 0; k < 9; k++) { const rx = x + 20 + k * (w - 40) / 8; const stop = rx > sx - 6 && rx < sx + plW ? py - 8 : gy - 52 * Math.sqrt(Math.max(0, 1 - ((rx - mx) / 74) ** 2)) - 4; g.line(rx, y, rx, Math.min(stop, gy), { color: PAL.sand, w: 1.6, dash: [6, 8], dashOffset: -t * 30, alpha: 0.5 }); }
    // shadow under plate
    g.poly([[sx, py + 8], [sx + plW, py + 8], [sx + plW, gy], [sx, gy]], { fill: 'rgba(0,0,0,0.3)', color: null, w: 0 });
    g.line(sx, gy, sx, py, { color: C2, w: 7 });
    g.ellipse(sx + plW / 2 - 8, py, plW / 2 + 12, 11, { fill: C2 });
    g.text('shaded', mx, gy - 62, { size: 20, color: PAL.ink3, align: 'center', alpha: shade });
  },
  chem(g, x, y, w, h, t, p, S) {
    const gy = y + h - 34; const tx = x + 62;
    g.rect(x, gy, w, 34, { fill: 'rgba(216,196,155,0.12)', r: 4 });
    g.clip(x, gy, w, 34, () => { for (let k = 0; k < 3; k++) { const u = frac(t * 0.28 + k / 3); g.ellipse(tx, gy, 30 + 200 * u, 16 + 40 * u, { stroke: COL, w: 2.4, alpha: 0.75 * (1 - u) }); } });
    g.icon('tree', tx, gy - 62, 128, PAL.ink2);
    for (let k = 0; k < 5; k++) { const px = x + 146 + k * 40; const near = px - tx < 175; g.icon('plant', px + (near ? 6 : 0), gy - 22 + (near ? 4 : 0), 46, near ? PAL.ink3 : C1, { rot: near ? 0.75 : 0 }); }
    g.text('juglone', x + w - 8, gy + 26, { size: 20, color: COL, align: 'right', alpha: S.p(2, 0.6, 14.9) });
    g.text('black walnut', x + w - 8, y + 34, { size: 20, color: PAL.ink2, align: 'right', alpha: S.p(2, 0.6, 16.3) });
    g.text('inhibited', x + 168, y + 66, { size: 20, color: PAL.ink3, align: 'center', alpha: S.p(2, 0.6, 13.4) });
  },
  terr(g, x, y, w, h, t) {
    const cs = [[x + 66, y + 58], [x + 160, y + 112], [x + 254, y + 58]];
    cs.forEach(([cx, cy], k) => { g.poly(hexPts(cx, cy, 54), { color: C1, w: 2, dash: [6, 6], alpha: 0.8 }); g.icon('songbird', cx, cy + 2 * Math.sin(t * 3 + k), 34, C1, { flip: k === 2 }); });
    const u = frac(t / 2.6); const ix = x + w - 30 - 20 * Math.sin(Math.PI * u), iy = y + h - 20;
    g.icon('songbird', ix, iy, 30, C2, { flip: false });
    g.text('floater', ix - 30, iy + 6, { size: 20, color: C2, align: 'right' });
  },
  encounter(g, x, y, w, h, t) {
    const gy = y + h - 10, cx = x + w / 2;
    g.ellipse(cx, gy - 16, 58, 16, { fill: PAL.sand, alpha: 0.75 });
    for (let k = 0; k < 5; k++) g.line(cx - 36 + k * 18, gy - 30, cx - 40 + k * 18, gy - 4, { color: PAL.bg, w: 3 });
    const bob = Math.sin(t * 5) * 4;
    g.icon('wolf', x + 70 + bob, gy - 58, 92, ENEMY, {});
    g.icon('bird', x + w - 96, y + 70 + 10 * Math.sin(t * 2.2), 74, PAL.ink2, { flap: 0.5 + 0.5 * Math.sin(t * 8) });
    sparks(g, cx + 20, gy - 74, 30, PAL.ochre, 0.6 + 0.4 * Math.sin(t * 11), t);
    g.text('wolf', x + 2, gy - 104, { size: 20, color: ENEMY });
    g.text('vulture', x + w - 96, y + 22, { size: 20, color: PAL.ink2, align: 'center' });
  },
};

function schoenerPanel(g, t, S) {
  label(g, 'Schoener (1983) · six mechanisms', 140, 262);
  const tiles = [
    ['Consumptive', 'use of a shared resource', 3.4, 'consume'],
    ['Preemptive', 'occupying space first', 6.2, 'preempt'],
    ['Overgrowth', 'growing over and shading', 8.5, 'overgrow'],
    ['Chemical', 'allelopathy', 12.4, 'chem'],
    ['Territorial', 'defended space', 17.2, 'terr'],
    ['Encounter', 'fights at a carcass', 18.4, 'encounter'],
  ];
  tiles.forEach(([nm, sub, t0, fn], k) => {
    const col = k % 3, row = Math.floor(k / 3);
    const x = 150 + col * 385, y = 286 + row * 312, w = 360, h = 292;
    // empty numbered frames appear as "six mechanisms" is spoken
    const f0 = S.p(2, 0.6, 2.0 + k * 0.12) * (1 - S.p(2, 0.5, t0));
    if (f0 > 0) g.withAlpha(f0, () => { g.rect(x, y, w, h, { r: 8, fill: 'rgba(14,29,31,0.35)', stroke: PAL.rule, w: 1.2, dash: [8, 8] }); g.text(String(k + 1).padStart(2, '0'), x + 20, y + 40, { size: 18, role: 'mono', color: PAL.ink3 }); });
    const p = S.p(2, 0.7, t0); if (p <= 0) return;
    const next = k < 5 ? tiles[k + 1][2] : 99;
    const hl = S.p(2, 0.5, t0) * (1 - S.p(2, 0.6, next));
    g.withAlpha(p, () => {
      g.rect(x, y + (1 - p) * 20, w, h, { r: 8, fill: 'rgba(14,29,31,0.6)', stroke: hl > 0.05 ? U.mix('#5b6664', COL, hl) : PAL.rule, w: 1.4 + 1.4 * hl });
      const oy = y + (1 - p) * 20;
      g.text(String(k + 1).padStart(2, '0'), x + 20, oy + 40, { size: 18, role: 'mono', color: COL });
      g.text(nm, x + 56, oy + 42, { size: 34, role: 'display', color: PAL.ink });
      g.text(sub, x + 20, oy + 72, { size: 20, color: PAL.ink2 });
      g.clip(x + 2, oy + 84, w - 4, h - 88, () => VIG[fn](g, x + 20, oy + 92, w - 40, h - 108, S.t, S.p(2, 7, t0 + 0.4), S));
    });
  });
}

function scramblePanel(g, t, S) {
  const charts = [
    { nm: 'Scramble', desc: 'equal shares: everyone gets too little', y: 286, vals: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], t0: 1.5, tOut: 6.2 },
    { nm: 'Contest', desc: 'winners get enough; losers get nothing', y: 590, vals: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0], t0: 7.3, tOut: 10.8 },
  ];
  charts.forEach((c) => {
    const a = S.p(3, 0.8, c.t0 - 0.5); if (a <= 0) return;
    g.withAlpha(a, () => {
      label(g, c.nm, 140, c.y, 1, RES);
      g.text(c.desc, 140 + g.measure(c.nm.toUpperCase(), { size: 17, weight: 600, ls: 2.6 }) + 20, c.y, { size: 21, color: PAL.ink2 });
      const A = g.axes({ x: 190, y: c.y + 36, w: 440, h: 150, xmin: 0, xmax: 10, ymin: 0, ymax: 1.3, arrows: false });
      g.line(A.X(0), A.Y(1), A.X(10), A.Y(1), { color: PAL.ink2, w: 1.8, dash: [7, 7] });
      g.text('need', A.X(0) - 12, A.Y(1) + 7, { size: 20, color: PAL.ink2, align: 'right' });
      c.vals.forEach((v, i) => {
        const pb = S.p(3, 0.9, c.t0 + 0.6 + i * 0.12);
        const bx = A.X(i + 0.5) - 15, hgt = (A.Y(0) - A.Y(v)) * pb;
        g.rect(bx, A.Y(0) - hgt, 30, hgt, { fill: RES, alpha: 0.85, r: 2 });
        const po = S.p(3, 0.6, c.tOut + i * 0.06); const ok = v >= 1;
        if (ok) g.dot(A.X(i + 0.5), A.Y(0) + 26, 7, C1, po, 2.2);
        else g.text('×', A.X(i + 0.5), A.Y(0) + 35, { size: 28, color: ENEMY, align: 'center', alpha: po });
      });
      const n = c.vals.filter((v) => v >= 1).length;
      g.text(`${n} of 10 reproduce`, 640, c.y + 58, { size: 20, role: 'mono', color: n ? C1 : ENEMY, align: 'right', alpha: S.p(3, 0.6, c.tOut + 0.8) });
    });
  });
  g.text('same total resource in both', 140, 878, { size: 20, color: PAL.ink3, italic: true, alpha: S.p(3, 0.8, 11.2) });
}

// ray/ellipse first-hit parameter (or Infinity)
function rayEll(x0, y0, dx, dy, cx, cy, rx, ry) {
  const ax = (x0 - cx) / rx, ay = (y0 - cy) / ry, bx = dx / rx, by = dy / ry;
  const A = bx * bx + by * by, B = 2 * (ax * bx + ay * by), C = ax * ax + ay * ay - 1; const disc = B * B - 4 * A * C;
  if (disc < 0) return Infinity; const s = (-B - Math.sqrt(disc)) / (2 * A); return s > 0 ? s : Infinity;
}
function lightPanel(g, t, S) {
  const a = S.p(3, 0.9, 12.1); if (a <= 0) return;
  g.withAlpha(a, () => {
    label(g, 'Size-asymmetric competition for light', 780, 262);
    const gy = 770, grow = S.io(3, 7, 12.6);
    const T = { x: 960, h: lerp(250, 330, grow), rx: lerp(96, 120, grow), ry: 30 };
    const Sh = { x: 1110, h: lerp(150, 156, grow), rx: lerp(62, 58, grow), ry: 22 };
    T.cy = gy - T.h; Sh.cy = gy - Sh.h;
    const dl = Math.hypot(0.34, 1), dx = 0.34 / dl, dy = 1 / dl;
    g.glow(806, 318, 120, RES, 0.55); g.circle(806, 318, 22, { fill: RES, alpha: 0.95 });
    let hitT = 0, hitS = 0;
    const shadowA = S.p(3, 1, 18.5);
    for (let k = 0; k < 26; k++) {
      const x0 = 790 + k * 18, y0 = 352;
      const sT = rayEll(x0, y0, dx, dy, T.x, T.cy, T.rx, T.ry), sS = rayEll(x0, y0, dx, dy, Sh.x, Sh.cy, Sh.rx, Sh.ry), sG = (gy - y0) / dy;
      const s = Math.min(sT, sS, sG); if (sT === s) hitT++; else if (sS === s) hitS++;
      const ex = x0 + dx * s, ey = y0 + dy * s;
      if (ex > 1295) continue;
      const hit = s !== sG;
      g.line(x0, y0, ex, ey, { color: RES, w: hit ? 2 : 1.4, dash: [8, 10], dashOffset: -S.t * 40, alpha: hit ? 0.6 : 0.3 });
      if (hit) g.circle(ex, ey, 3, { fill: RES, alpha: 0.8 });
    }
    // shadow of the tall canopy
    const sh = (yy) => [T.x - T.rx + dx / dy * (yy - T.cy), T.x + T.rx + dx / dy * (yy - T.cy)];
    const [l1, r1] = sh(T.cy), [l2, r2] = sh(gy);
    g.poly([[l1, T.cy], [r1, T.cy], [r2, gy], [l2, gy]], { fill: 'rgba(0,0,0,0.34)', color: null, w: 0, alpha: shadowA });
    g.text('shade', (l2 + r2) / 2 - 40, gy - 24, { size: 21, color: PAL.ink3, align: 'center', alpha: shadowA });
    g.line(780, gy, 1295, gy, { color: PAL.sand, w: 2, alpha: 0.6 });
    const plantDraw = (P, col) => {
      g.line(P.x, gy, P.x, P.cy, { color: col, w: 6 });
      for (let k = 0; k < 5; k++) { const f = (k - 2) / 2; g.ellipse(P.x + f * P.rx * 0.62, P.cy + Math.abs(f) * 6 - 4, P.rx * 0.48, P.ry, { fill: U.mix(col, '#0B1618', 0.15 * (k % 2)) }); }
    };
    plantDraw(T, C1); plantDraw(Sh, PAL.mint);
    g.text('taller', T.x - 14, gy - 40, { size: 21, color: C1, align: 'right' });
    g.text('shorter', Sh.x + 14, gy - 40, { size: 21, color: PAL.mint });
    const pa = S.p(3, 0.8, 19.0);
    g.text(`height        ${(T.h / Sh.h).toFixed(1)} : 1`, 800, 822, { size: 22, role: 'mono', color: PAL.ink2, alpha: pa });
    g.text(`light caught  ${(hitT / Math.max(1, hitS)).toFixed(0)} : 1`, 800, 858, { size: 22, role: 'mono', color: RES, alpha: pa });
    g.text('disproportionate', 1290, 858, { size: 22, color: PAL.ink, italic: true, align: 'right', alpha: S.p(3, 0.8, 20.2) });
  });
}

function apparentPanel(g, t, S) {
  label(g, 'Apparent competition · Holt (1977)', 140, 262, S.p(4, 0.8, 3.2));
  const P = [725, 372], N1 = [430, 596], N2 = [1020, 596], R1 = [430, 800], R2 = [1020, 800];
  const sp = S.p(4, 0.8, 0.3);
  // abundance changes: prey 1 up → predator up → prey 2 down
  const u1 = S.io(4, 2.5, 5.4), uP = S.io(4, 2.5, 6.8), u2 = S.io(4, 2.5, 8.0);
  const ab = { n1: lerp(0.45, 0.85, u1), p: lerp(0.4, 0.78, uP), n2: lerp(0.75, 0.3, u2) };
  const flow = (a, b, col, k0, alpha) => { for (let k = 0; k < 4; k++) { const u = frac(S.t * 0.4 + k / 4 + k0); g.circle(lerp(a[0], b[0], u), lerp(a[1], b[1], u), 3.8, { fill: col, alpha: alpha * Math.sin(Math.PI * u) }); } };
  const link = (a, b, off, col, sgn, alpha, fl, side = 1) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const s0 = 62 / L, s1 = 1 - 64 / L;
    const x1 = a[0] + dx * s0 + nx * off, y1 = a[1] + dy * s0 + ny * off, x2 = a[0] + dx * s1 + nx * off, y2 = a[1] + dy * s1 + ny * off;
    g.arrow(x1, y1, x2, y2, { color: col, w: 2.8, head: 15, alpha });
    const lo = (Math.abs(off) + 22) * Math.sign(off || side);
    g.text(sgn, (x1 + x2) / 2 + nx * lo, (y1 + y2) / 2 + ny * lo + 11, { size: 34, role: 'math', weight: 600, color: col, align: 'center', alpha });
    if (fl) flow([x1, y1], [x2, y2], col, 0.13 * off, alpha * 0.8);
  };
  const pr = S.p(4, 0.8, 0.8), pq = S.p(4, 0.8, 1.6);
  link(R1, N1, 0, RES, '+', pr, true, -1); link(R2, N2, 0, RES, '+', pr, true, 1);
  link(N1, P, -14, C1, '+', pq, true); link(P, N1, -14, ENEMY, '−', pq);
  link(N2, P, 14, C2, '+', pq, true); link(P, N2, 14, ENEMY, '−', pq);
  const node = (pt, icon, col, size, name, a, val, flip, lx, ly, al) => {
    g.withAlpha(a, () => {
      g.circle(pt[0], pt[1], 52, { fill: 'rgba(14,29,31,0.9)', stroke: col, w: 2.2 });
      g.icon(icon, pt[0], pt[1] + 4, size, col, { flip });
      g.text(name, pt[0] + lx, pt[1] + ly, { size: 22, color: col, align: al });
      if (val !== undefined) {
        const isP = pt === P; const gx = pt[0] + (lx < 0 && !isP ? -88 : 74), gh = isP ? 84 : 100, gy0 = pt[1] + (isP ? 4 : 50);
        g.rect(gx, gy0 - gh, 14, gh, { stroke: PAL.rule, w: 1.2, r: 3 });
        g.rect(gx + 2, gy0 - gh * val + 2, 10, gh * val - 4, { fill: col, alpha: 0.85, r: 2 });
      }
    });
  };
  node(R1, 'grass', RES, 64, 'resource 1', pr, undefined, false, -72, 8, 'right');
  node(R2, 'plant', RES, 64, 'resource 2', pr, undefined, false, 72, 8, 'left');
  node(N1, 'hare', C1, 68, 'prey 1', sp, ab.n1, false, -104, 8, 'right');
  node(N2, 'songbird', C2, 66, 'prey 2', sp, ab.n2, false, 104, 8, 'left');
  node(P, 'lynx', ENEMY, 74, 'shared predator', S.p(4, 0.8, 1.0), ab.p, true, -72, 8, 'right');
  g.glow(P[0], P[1], 130, ENEMY, 0.4 * S.p(4, 1, 14.0));
  const ch = (x, y, up, a) => g.text(up ? '↑' : '↓', x, y, { size: 34, color: up ? C1 : ENEMY, align: 'center', alpha: a });
  ch(N1[0] - 81, N1[1] - 64, true, S.p(4, 0.6, 5.6)); ch(P[0] + 81, P[1] - 92, true, S.p(4, 0.6, 7.0)); ch(N2[0] + 81, N2[1] - 64, false, S.p(4, 0.6, 8.2));
  const ns = S.p(4, 0.8, 6.2);
  g.text('×', 725, 792, { size: 32, color: PAL.ink3, align: 'center', alpha: ns });
  g.text('no shared resource', 725, 830, { size: 21, color: PAL.ink3, align: 'center', alpha: ns });
  // indirect link
  const il = S.p(4, 1.2, 8.2);
  g.line(N1[0] + 62, N1[1], N2[0] - 62, N2[1], { color: COL, w: 3, dash: [12, 10], progress: il });
  g.text('−', N1[0] + 84, N1[1] + 36, { size: 34, role: 'math', color: COL, align: 'center', alpha: il });
  g.text('−', N2[0] - 84, N2[1] + 36, { size: 34, role: 'math', color: COL, align: 'center', alpha: il });
  g.pill('apparent competition (−, −)', 725, N1[1] - 34, { color: COL, size: 22, align: 'center', alpha: S.p(4, 0.8, 9.4) });
  g.text('Looks like competition in field data, but is mediated by a natural enemy.', 725, 892, { size: 22, color: PAL.ink2, italic: true, align: 'center', alpha: S.p(4, 0.8, 11.2) });
}

/* ===================================================== scene 2 helpers */
// Lotka–Volterra competition. Cases defined by K and α; intercepts x1 = K1, y1 = K1/α12, y2 = K2, x2 = K2/α21.
const mkP = (K1, K2, a12, a21, r1 = 1.0, r2 = 0.75) => ({ K1, K2, a12, a21, r1, r2, x1: K1, y1: K1 / a12, y2: K2, x2: K2 / a21 });
const CASES = { A: mkP(100, 80, 0.9, 1.1), B: mkP(80, 100, 1.1, 0.9), C: mkP(95, 85, 0.8, 0.7), D: mkP(100, 100, 1.4, 1.4) };
const blendP = (P, Q, u) => { const x1 = lerp(P.x1, Q.x1, u), y1 = lerp(P.y1, Q.y1, u), y2 = lerp(P.y2, Q.y2, u), x2 = lerp(P.x2, Q.x2, u); return { K1: x1, K2: y2, a12: x1 / y1, a21: y2 / x2, r1: P.r1, r2: P.r2, x1, y1, y2, x2 }; };
function lvRate(P, a, b) { return [P.r1 * a * (P.K1 - a - P.a12 * b) / P.K1, P.r2 * b * (P.K2 - b - P.a21 * a) / P.K2]; }
function lvRun(P, a, b, T, dt = 0.01, every = 5, dir = 1, stop) {
  const out = [[a, b]]; const n = Math.round(T / dt); const h = dt * dir;
  for (let k = 1; k <= n; k++) {
    const k1 = lvRate(P, a, b), k2 = lvRate(P, a + h / 2 * k1[0], b + h / 2 * k1[1]), k3 = lvRate(P, a + h / 2 * k2[0], b + h / 2 * k2[1]), k4 = lvRate(P, a + h * k3[0], b + h * k3[1]);
    a += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); b += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (k % every === 0) out.push([a, b]);
    if (stop && stop(a, b)) { out.push([a, b]); break; }
  }
  return out;
}
function lvEq(P) {
  const eq = [{ x: 0, y: 0, st: false }, { x: P.K1, y: 0, st: P.x2 < P.K1 }, { x: 0, y: P.K2, st: P.y1 < P.K2 }];
  const det = 1 - P.a12 * P.a21;
  if (Math.abs(det) > 1e-4) { const n1 = (P.K1 - P.a12 * P.K2) / det, n2 = (P.K2 - P.a21 * P.K1) / det; if (n1 > 0.5 && n2 > 0.5) eq.push({ x: n1, y: n2, st: det > 0, interior: true }); }
  return eq;
}
const PP = { x: 790, y: 300, w: 500, h: 500 };
const lvAxes = (g, o = {}) => { const A = g.axes({ x: PP.x, y: PP.y, w: PP.w, h: PP.h, xmax: 130, ymax: 130, ylab: 'N_2', ...o }); g.math('N_1', PP.x + PP.w + 2, PP.y + PP.h - 16, { size: 30, alpha: clamp((o.progress ?? 1) * 2 - 1) }); return A; };
// small 'mini plane' mapping without drawing
const miniMap = (x, y, s) => ({ x, y, w: s, h: s, X: (v) => x + v / 130 * s, Y: (v) => y + s - v / 130 * s });

function drawIsos(g, A, P, o = {}) {
  const w = o.w ?? 4;
  g.clip(A.x - 2, A.y - 4, A.w + 6, A.h + 6, () => {
    g.line(A.X(P.K1), A.Y(0), A.X(0), A.Y(P.y1), { color: C1, w, progress: o.p1 ?? 1, alpha: o.alpha });
    g.line(A.X(0), A.Y(P.K2), A.X(P.x2), A.Y(0), { color: C2, w, progress: o.p2 ?? 1, alpha: o.alpha });
  });
}
function drawEqMarks(g, A, P, a, r = 9) {
  if (a <= 0) return;
  for (const e of lvEq(P)) {
    const x = A.X(e.x), y = A.Y(e.y);
    if (e.st) g.dot(x, y, r, e.interior ? COL : PAL.ink, a, 3);
    else g.circle(x, y, r * 0.85, { fill: PAL.bg, stroke: PAL.ink, w: 2.4, alpha: a });
  }
}
// normalised direction field, batched into two paths
function drawField(g, A, P, alpha) {
  if (alpha <= 0) return; const c = g.ctx;
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = PAL.ink2; c.fillStyle = PAL.ink2; c.lineWidth = 1.5; c.lineCap = 'round';
  const heads = []; c.beginPath();
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    const a = 6.5 + i * 13, b = 6.5 + j * 13; const [d1, d2] = lvRate(P, a, b); const L = Math.hypot(d1, d2); if (L < 1e-3) continue;
    const ux = d1 / L, uy = -d2 / L, x = A.X(a), y = A.Y(b), h = 8;
    c.moveTo(x - ux * h, y - uy * h); c.lineTo(x + ux * h * 0.5, y + uy * h * 0.5); heads.push([x + ux * h, y + uy * h, ux, uy]);
  }
  c.stroke(); c.beginPath();
  for (const [x, y, ux, uy] of heads) { c.moveTo(x, y); c.lineTo(x - ux * 7 - uy * 3.4, y - uy * 7 + ux * 3.4); c.lineTo(x - ux * 7 + uy * 3.4, y - uy * 7 - ux * 3.4); c.closePath(); }
  c.fill(); c.restore();
}
// flowing particles along precomputed trajectories (sampled every 0.05 model-time units)
function drawParticles(g, A, set, t, w) {
  if (w <= 0.01) return; const c = g.ctx; const n = set.length, Lp = 5.6, speed = 1.3, TAIL = 44;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const ph = frac(i * 0.6180339) * Lp, tt = t + ph, age = tt % Lp, cyc = Math.floor(tt / Lp);
    const tr = set[(i + cyc * 23) % n]; const fi = Math.min(tr.length - 1.001, age * speed / 0.05); const idx = Math.floor(fi), f = fi - idx;
    const a = w * Math.min(1, age / 0.5) * Math.min(1, (Lp - age) / 1.1);
    if (a <= 0.01) continue;
    const q0 = tr[idx], q1 = tr[idx + 1]; const hx = A.X(lerp(q0[0], q1[0], f)), hy = A.Y(lerp(q0[1], q1[1], f));
    c.globalAlpha = a * 0.42; c.strokeStyle = PAL.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(hx, hy);
    let L = 0, px = hx, py = hy;
    for (let k = idx; k >= 0 && L < TAIL; k--) { const x = A.X(tr[k][0]), y = A.Y(tr[k][1]); const d = Math.hypot(x - px, y - py); if (L + d > TAIL) { const u = (TAIL - L) / d; c.lineTo(px + (x - px) * u, py + (y - py) * u); break; } c.lineTo(x, y); L += d; px = x; py = y; }
    c.stroke();
    c.globalAlpha = a * 0.95; c.fillStyle = PAL.ink; c.beginPath(); c.arc(hx, hy, 3.2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
// LV equation with highlighted terms. E = [prefix, numerator, denominator, ownTerm, ownPrefix, otherTerm, otherPrefix, alphaTerm]
function lvEquation(g, E, x, y, size, hl, cOwn, cOther) {
  const ns = size * 0.84;
  const preW = g.mathW(E[0], size), aw = g.mathW(E[1], ns), dw = g.mathW(E[2], ns);
  const w = Math.max(aw, dw) + size * 0.2; const nx = x + preW + size * 0.06 + (w - aw) / 2;
  const nb = y - size * 0.37 - ns * 0.372;
  const box = (pre, term, col, a, dash) => {
    if (a <= 0) return null; const x0 = nx + g.mathW(pre, ns), x1 = x0 + g.mathW(term, ns);
    g.rect(x0 - 3, nb - ns * 0.8, x1 - x0 + 6, ns * 1.22, { r: 6, fill: U.rgba(col, 0.14 * a), stroke: col, w: 1.8, alpha: a, dash });
    return [x0, x1];
  };
  const b1 = box(E[4], E[3], cOwn, hl.own || 0);
  const b2 = box(E[6], E[5], cOther, hl.other || 0, [6, 5]);
  g.math(E[0] + '\\frac{' + E[1] + '}{' + E[2] + '}', x, y, { size });
  if (b1) g.math(E[3], b1[0], nb, { size: ns, color: cOwn, alpha: hl.own });
  if (b2) g.math(E[5], b2[0], nb, { size: ns, color: cOther, alpha: hl.other });
  if (hl.alpha > 0) { const x0 = nx + g.mathW(E[6], ns), aw2 = g.mathW(E[7], ns); g.math(E[7], x0, nb, { size: ns, color: COL, alpha: hl.alpha }); g.glow(x0 + aw2 / 2, nb - ns * 0.25, 40, COL, 0.4 * hl.alpha); }
  return { nx, nb, ns };
}
const EQ1 = ['\\frac{dN_1}{dt} = r_1N_1\\,', 'K_1 − N_1 − α_{12}N_2', 'K_1', 'N_1', 'K_1 −', 'α_{12}N_2', 'K_1 − N_1 −', 'α_{12}'];
const EQ2 = ['\\frac{dN_2}{dt} = r_2N_2\\,', 'K_2 − N_2 − α_{21}N_1', 'K_2', 'N_2', 'K_2 −', 'α_{21}N_1', 'K_2 − N_2 −', 'α_{21}'];
const COND = {
  A: ['Species 1 wins', 'K_1 > K_2/α_{21}\\quad\\text{and}\\quad K_1/α_{12} > K_2', C1, 'species 1’s isocline lies entirely outside'],
  B: ['Species 2 wins', 'K_2 > K_1/α_{12}\\quad\\text{and}\\quad K_2/α_{21} > K_1', C2, 'species 2’s isocline lies entirely outside'],
  C: ['Stable coexistence', 'K_2/α_{21} > K_1\\quad\\text{and}\\quad K_1/α_{12} > K_2', COL, 'each species limits itself more than its competitor'],
  D: ['Unstable saddle', 'K_1 > K_2/α_{21}\\quad\\text{and}\\quad K_2 > K_1/α_{12}', PAL.ink, 'each species limits its competitor more than itself'],
};
function lvKeys(S) {
  const b1 = S.b(1), b2 = S.b(2), b3 = S.b(3);
  return [[b1 + 9.4, b1 + 10.2, 'A', 'B'], [b1 + 10.6, b1 + 11.4, 'B', 'C'], [b1 + 11.8, b1 + 12.6, 'C', 'D'], [b1 + 13.6, b1 + 14.5, 'D', 'A'],
    [b2 + 6.0, b2 + 7.2, 'A', 'B'], [b3 + 0.0, b3 + 1.4, 'B', 'C'], [b3 + 9.0, b3 + 10.4, 'C', 'D']];
}
function lvState(S) {
  let cur = 'A';
  for (const [t0, t1, f, to] of lvKeys(S)) {
    if (S.t < t0) break;
    if (S.t < t1) { const u = ease.inOut((S.t - t0) / (t1 - t0)); return { P: blendP(CASES[f], CASES[to], u), w: { [f]: 1 - u, [to]: u }, m: Math.sin(Math.PI * u), key: u < 0.5 ? f : to }; }
    cur = to;
  }
  return { P: CASES[cur], w: { [cur]: 1 }, m: 0, key: cur };
}
function miniPlane(g, M, P, trs, a, prog = 1) {
  g.withAlpha(a, () => {
    g.rect(M.x, M.y, M.w, M.h, { fill: 'rgba(11,22,24,0.6)' });
    g.line(M.x, M.y + M.h, M.x + M.w, M.y + M.h, { color: PAL.ink2, w: 1.6 }); g.line(M.x, M.y + M.h, M.x, M.y, { color: PAL.ink2, w: 1.6 });
    if (trs) trs.forEach((tr) => g.data(M, tr, { color: PAL.ink3, w: 1.4, alpha: 0.85, progress: prog }));
    drawIsos(g, M, P, { w: 3 });
    drawEqMarks(g, M, P, 1, 5.5);
  });
}
function lvTable(g, S, D) {
  label(g, 'The four outcomes', 140, 262);
  const hx = 380, cw = 445, gap = 14, hy = 290, rh = 240, rgap = 12;
  const colX = [hx, hx + cw + gap], rowY = [hy + 52, hy + 52 + rh + rgap];
  const hp = S.p(4, 0.8, 0.2);
  g.math('K_2 < K_1/α_{12}', colX[0] + cw / 2, hy + 30, { size: 30, align: 'center', alpha: hp });
  g.math('K_2 > K_1/α_{12}', colX[1] + cw / 2, hy + 30, { size: 30, align: 'center', alpha: hp });
  g.math('K_1 > K_2/α_{21}', 150, rowY[0] + rh / 2 + 10, { size: 30, alpha: hp });
  g.math('K_1 < K_2/α_{21}', 150, rowY[1] + rh / 2 + 10, { size: 30, alpha: hp });
  const cells = [[0, 0, 'A', 'Species 1 wins', 'its isocline lies outside'], [0, 1, 'D', 'Either wins', 'unstable saddle: priority effect'], [1, 0, 'C', 'Stable coexistence', 'each limits itself more'], [1, 1, 'B', 'Species 2 wins', 'its isocline lies outside']];
  const hc = S.p(4, 0.9, 1.4);
  cells.forEach(([r, c, k, ttl, sub], idx) => {
    const p = S.p(4, 0.7, 0.3 + idx * 0.25); if (p <= 0) return;
    const x = colX[c], y = rowY[r]; const isC = k === 'C';
    g.withAlpha(p, () => {
      g.rect(x, y, cw, rh, { r: 8, fill: isC ? U.rgba(COL, 0.06 + 0.1 * hc) : 'rgba(14,29,31,0.6)', stroke: isC ? U.mix('#5b6664', COL, hc) : PAL.rule, w: isC ? 1.4 + 1.6 * hc : 1.4 });
      if (isC) g.glow(x + cw / 2, y + rh / 2, 260, COL, 0.18 * hc);
      miniPlane(g, miniMap(x + 26, y + 26, 188), CASES[k], D.mini[k], 1, S.p(4, 2.5, 0.5 + idx * 0.25));
      const col = COND[k][2];
      g.text(ttl, x + 240, y + 74, { size: 32, role: 'display', color: col });
      g.wrap(sub, x + 240, y + 112, 190, { size: 21, color: PAL.ink2, lh: 1.3 });
    });
  });
  // the rule
  const rp = S.p(4, 0.9, 3.0); let xx = 150; const ry = 886;
  g.withAlpha(rp, () => {
    xx += g.text('Coexistence needs', xx, ry, { size: 30, role: 'display', italic: true, color: COL }) + 18;
    xx += g.math('α_{12} < K_1/K_2', xx, ry, { size: 32 }) + 14;
    xx += g.text('and', xx, ry, { size: 24, color: PAL.ink2 }) + 14;
    xx += g.math('α_{21} < K_2/K_1', xx, ry, { size: 32 }) + 22;
    g.text('intraspecific > interspecific', xx, ry, { size: 24, weight: 600, color: PAL.ink, alpha: S.p(4, 0.8, 5.2) });
  });
}

/* ===================================================== scene 3 helpers */
// Single resource: Monod uptake, chemostat dilution = mortality m.
const MON = { A: { mu: 1.0, k: 1.0 }, B: { mu: 1.4, k: 3.0 }, m: 0.5, S: 6, Q: 0.05 };
const monod = (sp, R) => sp.mu * R / (sp.k + R);
const rstar = (sp) => sp.k * MON.m / (sp.mu - MON.m); // A: 1.0, B: 1.667
// Two essential resources (Tilman): ZNGI corners, consumption vectors, two-species equilibrium E.
const ZA = [3.6, 1.4], ZB = [1.6, 3.2], CA = [1, 0.45], CB = [0.45, 1], EQ = [ZA[0], ZB[1]];
const REG = {
  none: [[0, 0], [10, 0], [10, 1.4], [3.6, 1.4], [3.6, 3.2], [1.6, 3.2], [1.6, 10], [0, 10]],
  B: [[1.6, 3.2], [3.6, 3.2], [3.6 + 0.45 * 6.8, 10], [1.6, 10]],
  A: [[3.6, 1.4], [10, 1.4], [10, 3.2 + 0.45 * 6.4], [3.6, 3.2]],
  AB: [[3.6, 3.2], [10, 3.2 + 0.45 * 6.4], [10, 10], [3.6 + 0.45 * 6.8, 10]],
};
function tilmanOutcome(s1, s2) {
  const Ap = s1 > ZA[0] && s2 > ZA[1], Bp = s1 > ZB[0] && s2 > ZB[1];
  if (!Ap && !Bp) return 'none'; if (Ap && !Bp) return 'A'; if (Bp && !Ap) return 'B';
  const dx = s1 - EQ[0], dy = s2 - EQ[1];
  if (dx < CB[0] / CB[1] * dy) return 'B';
  if (dy < CA[1] / CA[0] * dx) return 'A';
  return 'AB';
}
// resource state reached from supply point S (consumers deplete along their consumption vectors)
function tilmanEnd(s1, s2, o) {
  if (o === 'AB') return EQ.slice();
  if (o === 'B') { const tt = Math.min((s1 - ZB[0]) / CB[0], (s2 - ZB[1]) / CB[1]); return [s1 - CB[0] * tt, s2 - CB[1] * tt]; }
  if (o === 'A') { const tt = Math.min((s1 - ZA[0]) / CA[0], (s2 - ZA[1]) / CA[1]); return [s1 - CA[0] * tt, s2 - CA[1] * tt]; }
  return [s1, s2];
}
const OUT = { none: ['Neither persists', PAL.ink2, 'supply below both ZNGIs'], A: ['A wins', C1, 'B is excluded'], B: ['B wins', C2, 'A is excluded'], AB: ['Stable coexistence', COL, 'both persist at the crossing'] };
function rPlaneAxes(g, prog) {
  return g.axes({ x: 200, y: 300, w: 540, h: 540, xmax: 10, ymax: 10, xlab: 'R_1', ylab: 'R_2', progress: prog });
}

/* ===================================================== scene 4 helpers */
// Chesson plane: x = niche difference 1 − ρ, y = fitness ratio κ1/κ2 (log). Coexistence: ρ < κ1/κ2 < 1/ρ.
const inZone = (x, y) => y > 1 - x && y < 1 / Math.max(1e-6, 1 - x);
const chAxes = (g, o = {}) => g.axes({ x: 220, y: 330, w: 420, h: 460, xmin: 0, xmax: 1, ymin: 0.25, ymax: 4, logy: true, arrows: false,
  xticks: [{ v: 0, l: '0' }, { v: 0.5, l: '0.5' }, { v: 1, l: '1' }], yticks: [{ v: 0.25, l: '¼' }, { v: 0.5, l: '½' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 4, l: '4' }], ...o });
function pairDot(g, A, x, y, a, big) {
  const ok = inZone(x, y); const X = A.X(x), Y = A.Y(y);
  if (ok) g.dot(X, Y, big ? 9 : 7, COL, a, 2.8);
  else g.circle(X, Y, big ? 8 : 6.5, { fill: PAL.bg, stroke: PAL.ink2, w: 2.4, alpha: a });
}
// a phytoplankton cell of a given morphotype
function phyto(g, type, x, y, s, col, a, rot) {
  if (a <= 0) return; const c = g.ctx;
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.rotate(rot); c.fillStyle = U.rgba(col, 0.35); c.strokeStyle = col; c.lineWidth = 2;
  c.beginPath();
  if (type === 0) { c.arc(0, 0, s, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.fillStyle = col; c.arc(s * 0.2, -s * 0.15, s * 0.35, 0, Math.PI * 2); c.fill(); }
  else if (type === 1) { c.ellipse(0, 0, s * 1.9, s * 0.55, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-s * 1.5, 0); c.lineTo(s * 1.5, 0); c.stroke(); }
  else if (type === 2) { for (let k = 0; k < 4; k++) { c.moveTo((k - 1.5) * s * 1.1 + s * 0.55, 0); c.arc((k - 1.5) * s * 1.1, 0, s * 0.55, 0, Math.PI * 2); } c.fill(); c.stroke(); }
  else if (type === 3) { for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; c.moveTo(0, 0); c.lineTo(Math.cos(an) * s * 1.7, Math.sin(an) * s * 1.7); } c.stroke(); c.beginPath(); c.fillStyle = col; c.arc(0, 0, s * 0.35, 0, Math.PI * 2); c.fill(); }
  else if (type === 4) { c.arc(0, 0, s, -2.2, 2.2); c.arc(s * 0.55, 0, s * 0.75, 2.0, -2.0, true); c.closePath(); c.fill(); c.stroke(); }
  else { c.ellipse(0, 0, s * 1.05, s * 0.9, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, s * 0.35, s, 0); c.stroke(); c.beginPath(); c.moveTo(0, -s * 0.9); c.quadraticCurveTo(s * 0.6, -s * 1.6, s * 0.2, -s * 2.0); c.stroke(); }
  c.restore();
}
function daphnia(g, x, y, s, col, a, rot) {
  if (a <= 0) return; const c = g.ctx;
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.rotate(rot); c.strokeStyle = col; c.fillStyle = U.rgba(col, 0.3); c.lineWidth = 2.4;
  c.beginPath(); c.ellipse(0, 0, s * 0.7, s, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(s * 0.1, s * 0.95); c.lineTo(s * 0.35, s * 1.5); c.stroke();
  c.beginPath(); c.moveTo(-s * 0.3, -s * 0.8); c.quadraticCurveTo(-s * 1.4, -s * 1.3, -s * 1.6, -s * 0.4); c.moveTo(-s * 0.3, -s * 0.8); c.quadraticCurveTo(-s * 1.1, -s * 1.6, -s * 1.8, -s * 1.2); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(-s * 0.15, -s * 0.7, s * 0.18, 0, Math.PI * 2); c.fill();
  c.restore();
}

Theater.chapter({
  id: 'comp', roman: 'III', title: 'Competition', color: COL,
  question: 'What happens when species need the same things?',
  intro: { t: 'Chapter three. Competition: what happens when organisms need the same limited resources.' },
  motif(g, t) {
    // Lotka–Volterra isoclines crossing, with trajectories settling on the stable point.
    const ox = 1180, oy = 352, s = 2.0; const X = (v) => ox + v * s * 1.5, Y = (v) => oy - v * s;
    const p = ease.inOut((t - 0.6) / 2.6);
    g.line(X(0), Y(0), X(0), Y(118), { color: PAL.ink3, w: 1.5, alpha: 0.3 * p });
    g.line(X(0), Y(0), X(128), Y(0), { color: PAL.ink3, w: 1.5, alpha: 0.3 * p });
    g.line(X(95), Y(0), X(0), Y(118.75), { color: C1, w: 2.5, alpha: 0.38, progress: p });
    g.line(X(0), Y(85), X(121.4), Y(0), { color: C2, w: 2.5, alpha: 0.38, progress: p });
    const q = ease.inOut((t - 2.2) / 3);
    [[8, 6], [120, 110], [10, 110], [118, 8]].forEach(([a, b]) => {
      const pts = []; let n1 = a, n2 = b;
      for (let k = 0; k < 400; k++) { pts.push([X(n1), Y(n2)]); const d1 = n1 * (95 - n1 - 0.8 * n2) / 95, d2 = 0.75 * n2 * (85 - n2 - 0.7 * n1) / 85; n1 += 0.03 * d1; n2 += 0.03 * d2; }
      g.poly(pts, { color: COL, w: 1.6, alpha: 0.32, progress: q });
    });
    g.dot(X(61.4), Y(42.0), 4, COL, 0.4 * q, 2.5);
  },
  scenes: [
    {
      id: 'comp-types', title: 'Kinds of competition',
      beats: [
        { t: 'Competition is a mutually negative interaction, minus–minus, between organisms that require the same limited resource. Intraspecific competition occurs among members of one species and drives density dependence. Interspecific competition occurs between species.',
          s: 'Competition is a mutually negative interaction, minus minus, between organisms that require the same limited resource. Intraspecific competition occurs among members of one species and drives density dependence. Interspecific competition occurs between species.' },
        { t: 'By mechanism, exploitative competition is indirect: individuals deplete a shared resource, such as water, nitrogen, or prey. Interference competition is direct: individuals prevent others from using a resource, through aggression, territoriality, or chemical means.' },
        { t: 'Thomas Schoener, in 1983, listed six mechanisms: consumptive competition for resources; preemptive, occupying space first; overgrowth, as when plants or corals shade one another; chemical, or allelopathy, like the juglone released by black walnut; territorial; and encounter, such as fights at a carcass.',
          s: 'Thomas Schoener, in 1983, listed six mechanisms: consumptive competition for resources; preemptive, occupying space first; overgrowth, as when plants or corals shade one another; chemical, or uh-lee-lopathy, like the jug-lone released by black walnut; territorial; and encounter, such as fights at a carcass.' },
        { t: 'A. J. Nicholson contrasted scramble competition, where resources are divided so evenly that every individual gets too little, with contest competition, where winners secure what they need and losers get nothing. Competition is also often asymmetric: in plants, competition for light is size-asymmetric, because taller plants shade shorter ones disproportionately.' },
        { t: 'And beware apparent competition, described by Robert Holt in 1977. Two prey species that never share a resource can still depress each other by sustaining a shared predator. In field data it looks just like competition, but it is mediated by a natural enemy.', pause: 0.8 },
      ],
      terms: [
        { beat: 0.55, term: 'Intra- vs interspecific competition', def: 'Competition within a species (the source of density dependence) versus between species.' },
        { beat: 1.2, term: 'Exploitative vs interference', def: 'Indirect competition through resource depletion versus direct prevention of resource use.' },
        { beat: 2.6, term: 'Allelopathy', def: 'Chemical interference: release of compounds that inhibit competitors (e.g., juglone of black walnut).' },
        { beat: 3.2, term: 'Scramble vs contest', def: 'Even division of resources so all suffer, versus winners taking enough and losers none (Nicholson 1954).' },
        { beat: 3.7, term: 'Asymmetric competition', def: 'Unequal per-capita effects between competitors; e.g., size-asymmetric competition for light.' },
        { beat: 4.2, term: 'Apparent competition', def: 'Indirect negative interaction between prey species mediated by a shared predator (Holt 1977).' },
      ],
      draw(g, t, S) {
        // ---- beat 0: sign matrix + intra/interspecific vignettes
        const v0 = vis(S, 0, 1);
        if (v0 > 0) g.withAlpha(v0, () => {
          signMatrix(g, S);
          const nv = lerp(5, 22, S.io(0, 4.5, 7.6));
          crowdBox(g, t, { x: 780, y: 286, w: 510, h: 280 }, [C1], 22, nv, 3, S.p(0, 0.8, 7.4), 'Intraspecific', 'within one species', C1);
          // per-capita share meter → density dependence
          const ma = S.p(0, 0.8, 11.6);
          g.withAlpha(ma, () => {
            const share = 5 / nv; g.text('share per individual', 1270, 320, { size: 20, color: PAL.ink2, align: 'right' });
            g.rect(1270 - 160, 332, 160, 10, { stroke: PAL.rule, w: 1, r: 3 }); g.rect(1270 - 160, 332, 160 * share, 10, { fill: RES, r: 3 });
            g.text('→ density dependence', 1270, 548, { size: 21, color: C1, align: 'right' });
          });
          crowdBox(g, t, { x: 780, y: 594, w: 510, h: 280 }, [C1, C2], 22, 22, 11, S.p(0, 0.8, 13.0), 'Interspecific', 'between species', C2);
        });
        // ---- beat 1: exploitative vs interference
        const v1 = vis(S, 1, 2);
        if (v1 > 0) g.withAlpha(v1, () => { exploitPanel(g, t, S); interferePanel(g, t, S); });
        // ---- beat 2: Schoener's six mechanisms
        const v2 = vis(S, 2, 3);
        if (v2 > 0) g.withAlpha(v2, () => schoenerPanel(g, t, S));
        // ---- beat 3: scramble vs contest; size-asymmetric light competition
        const v3 = vis(S, 3, 4);
        if (v3 > 0) g.withAlpha(v3, () => { scramblePanel(g, t, S); lightPanel(g, t, S); });
        // ---- beat 4: apparent competition
        const v4 = S.p(4, 0.9);
        if (v4 > 0) g.withAlpha(v4, () => apparentPanel(g, t, S));
      },
    },
    {
      id: 'comp-lv', title: 'Lotka–Volterra competition',
      beats: [
        { t: 'The Lotka–Volterra competition model extends the logistic. Each species’ growth is slowed by its own density and by the density of its competitor, scaled by a competition coefficient. α₁₂ is the per-capita effect of species two on species one, measured relative to the effect of species one on itself.',
          s: 'The Lotka Volterra competition model extends the logistic. Each species’ growth is slowed by its own density and by the density of its competitor, scaled by a competition coefficient. Alpha one two is the per-capita effect of species two on species one, measured relative to the effect of species one on itself.' },
        { t: 'Plot both species in a phase plane. Each species has a zero-growth isocline, a straight line along which its population neither grows nor shrinks. How the two lines sit relative to each other determines the outcome, and there are exactly four possibilities.' },
        { t: 'If species one’s isocline lies entirely outside species two’s, species one always wins. Reverse them, and species two wins. Either way, the loser is excluded. Georgii Gause saw this in his Paramecium cultures in the 1930s, which gave us the competitive exclusion principle: complete competitors cannot coexist.',
          s: 'If species one’s isocline lies entirely outside species two’s, species one always wins. Reverse them, and species two wins. Either way, the loser is excluded. Georgy Gowza saw this in his Para-meesium cultures in the 1930s, which gave us the competitive exclusion principle: complete competitors cannot coexist.', pause: 0.5 },
        { t: 'If the isoclines cross, and each species limits itself more than it limits its competitor, the crossing is a stable equilibrium: coexistence. If instead each limits its competitor more than itself, the crossing is an unstable saddle. One species still wins, but which one depends on who starts ahead, a classic priority effect.', pause: 0.5 },
        { t: 'The rule to remember: stable coexistence requires intraspecific competition to be stronger than interspecific competition. Species must limit themselves more than they limit each other.', pause: 1 },
      ],
      terms: [
        { beat: 0.6, term: 'Competition coefficient (α)', def: 'Per-capita effect of one species on another’s growth, relative to intraspecific effects.' },
        { beat: 1.3, term: 'Zero-growth isocline', def: 'All combinations of densities at which a species’ growth rate is zero.' },
        { beat: 2.6, term: 'Competitive exclusion principle', def: 'Gause: complete competitors cannot coexist indefinitely; one excludes the other.' },
        { beat: 3.7, term: 'Priority effect', def: 'When arrival order or initial abundance determines the outcome of interactions.' },
      ],
      init() {
        const r = rng(31); const starts = [];
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) starts.push([3 + i * 17.5 + r() * 9, 3 + j * 17.5 + r() * 9]);
        const sets = {};
        for (const k of Object.keys(CASES)) sets[k] = starts.map(([a, b]) => lvRun(CASES[k], a, b, 9.5));
        // separatrix = stable manifold of the saddle (case D), by backward integration
        const P = CASES.D; const E = lvEq(P).find((e) => e.interior);
        const J11 = P.r1 * (P.K1 - 2 * E.x - P.a12 * E.y) / P.K1, J12 = -P.r1 * P.a12 * E.x / P.K1, J21 = -P.r2 * P.a21 * E.y / P.K2, J22 = P.r2 * (P.K2 - 2 * E.y - P.a21 * E.x) / P.K2;
        const tr = J11 + J22, det = J11 * J22 - J12 * J21, lam = (tr - Math.sqrt(tr * tr - 4 * det)) / 2;
        let vx = J12, vy = lam - J11; const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
        const out = (a, b) => a < 0.4 || b < 0.4 || a > 150 || b > 150;
        const s1 = lvRun(P, E.x + 0.4 * vx, E.y + 0.4 * vy, 60, 0.01, 3, -1, out), s2 = lvRun(P, E.x - 0.4 * vx, E.y - 0.4 * vy, 60, 0.01, 3, -1, out);
        const sep = [...s1.reverse(), [E.x, E.y], ...s2];
        // priority effect: two nearby starts on either side of the separatrix
        let q = sep[0], qi = 0; sep.forEach((p, i) => { if (Math.abs(p[0] + p[1] - 34) < Math.abs(q[0] + q[1] - 34) && p[0] < E.x) { q = p; qi = i; } });
        const nb = sep[Math.min(sep.length - 1, qi + 1)], tx = nb[0] - q[0], ty = nb[1] - q[1], tl = Math.hypot(tx, ty) || 1; const nx = -ty / tl, ny = tx / tl;
        const pr = [1, -1].map((s) => { const a0 = q[0] + s * 3.2 * nx, b0 = q[1] + s * 3.2 * ny; const tr2 = lvRun(P, a0, b0, 40, 0.01, 5); const end = tr2[tr2.length - 1]; return { tr: tr2, win: end[0] > end[1] ? 1 : 2 }; });
        // mini trajectories for the summary table
        const ms = [[6, 6], [124, 124], [6, 124], [124, 6], [62, 4], [4, 62], [126, 62], [62, 126], [30, 8], [8, 30]];
        const mini = {}; for (const k of Object.keys(CASES)) mini[k] = ms.map(([a, b]) => lvRun(CASES[k], a, b, 14, 0.01, 8));
        // Gause (1934): P. aurelia excludes P. caudatum in mixed culture
        const PG = mkP(100, 80, 0.5, 1.6, 0.8, 0.95);
        const gause = lvRun(PG, 2, 2, 24, 0.01, 10), alone = lvRun(PG, 0, 2, 24, 0.01, 10);
        return { sets, sep, E, pr, mini, gause, alone };
      },
      draw(g, t, S, D) {
        const st = lvState(S); const key = st.key;
        const out4 = 1 - S.p(4, 0.6);
        // ---------------- equations (left column, beats 0–3)
        const lg = S.p(0, 0.8, 0.2) * (1 - S.p(0, 0.6, 3.0));
        g.withAlpha(out4, () => {
          label(g, 'Logistic', 140, 262, lg);
          g.math('\\frac{dN}{dt} = rN\\,\\frac{K − N}{K}', 150, 380, { size: 46, color: PAL.ink, alpha: lg });
          note(g, 'one species, slowed only by its own density', 150, 470, { alpha: lg });
          const ep = S.p(0, 0.9, 3.0);
          label(g, 'Lotka–Volterra competition', 140, 262, ep);
          const off = 1 - S.p(1, 0.8);
          const hl = { own: S.p(0, 0.8, 5.5) * off, other: S.p(0, 0.8, 6.9) * off, alpha: S.p(0, 0.8, 9.1) * (1 - S.p(0, 0.6, 17.6)) };
          g.withAlpha(ep, () => { lvEquation(g, EQ1, 150, 372, 46, hl, C1, C2); lvEquation(g, EQ2, 150, 478, 46, hl, C2, C1); });
        });
        // beat 0 legend + definition of α12
        const b0 = vis(S, 0, 1);
        g.withAlpha(b0, () => {
          const l1 = S.p(0, 0.8, 5.5), l2 = S.p(0, 0.8, 6.9), l3 = S.p(0, 0.8, 9.1);
          g.rect(150, 548, 54, 40, { r: 6, stroke: PAL.ink2, w: 1.8, alpha: l1 }); g.math('N_i', 158, 577, { size: 28, alpha: l1 });
          note(g, 'own density: intraspecific', 222, 576, { alpha: l1, color: PAL.ink });
          g.rect(150, 604, 82, 40, { r: 6, stroke: PAL.ink2, w: 1.8, dash: [6, 5], alpha: l2 }); g.math('α_{ij}N_j', 158, 633, { size: 28, alpha: l2 });
          note(g, 'competitor’s density, scaled by α', 250, 632, { alpha: l2, color: PAL.ink });
          g.text('α: competition coefficient', 150, 690, { size: 22, color: COL, alpha: l3 });
          const d = S.p(0, 0.9, 11.0);
          g.math('α_{12} = \\frac{\\text{per-capita effect of } N_2 \\text{ on } N_1}{\\text{per-capita effect of } N_1 \\text{ on } N_1}', 150, 800, { size: 31, alpha: d });
        });
        // beat 0 right: interaction diagram
        g.withAlpha(b0, () => {
          const n1 = [900, 590], n2 = [1190, 590]; const pa = S.p(0, 0.8, 1.0);
          label(g, 'Who limits whom', 780, 262, pa);
          const sl = S.p(0, 0.9, 5.5), xa = S.p(0, 0.9, 6.9), la = S.p(0, 0.8, 10.9);
          g.carrow(n1[0] - 40, n1[1] - 78, n1[0] + 40, n1[1] - 78, -1.25, { color: C1, w: 3, head: 13, progress: sl });
          g.carrow(n2[0] - 40, n2[1] - 78, n2[0] + 40, n2[1] - 78, -1.25, { color: C2, w: 3, head: 13, progress: sl });
          g.math('α_{11} = 1', n1[0], n1[1] - 178, { size: 28, color: C1, align: 'center', alpha: sl * S.p(0, 0.8, 15.2) });
          g.math('α_{22} = 1', n2[0], n2[1] - 178, { size: 28, color: C2, align: 'center', alpha: sl * S.p(0, 0.8, 15.2) });
          g.carrow(n2[0] - 82, n2[1] - 24, n1[0] + 82, n1[1] - 24, 0.3, { color: C2, w: 3, head: 15, progress: xa });
          g.carrow(n1[0] + 82, n1[1] + 24, n2[0] - 82, n2[1] + 24, 0.3, { color: C1, w: 3, head: 15, progress: xa });
          g.math('α_{12}', (n1[0] + n2[0]) / 2, n1[1] - 70, { size: 34, color: C2, align: 'center', alpha: la });
          g.math('α_{21}', (n1[0] + n2[0]) / 2, n1[1] + 100, { size: 34, color: C1, align: 'center', alpha: la });
          [[n1, C1, '1'], [n2, C2, '2']].forEach(([n, c, s]) => { g.circle(n[0], n[1], 74, { fill: 'rgba(14,29,31,0.92)', stroke: c, w: 2.4, alpha: pa }); g.icon('paramecium', n[0], n[1], 96, c, { alpha: pa, rot: -0.2 }); g.text('species ' + s, n[0], n[1] + 112, { size: 22, color: c, align: 'center', alpha: pa }); });
          note(g, 'each species’ effect on itself is the yardstick', 1045, 840, { align: 'center', alpha: S.p(0, 0.8, 15.6) });
        });
        // ---------------- phase plane (beats 1–3)
        const pv = S.p(1, 0.9) * out4;
        if (pv > 0) g.withAlpha(pv, () => {
          const P = st.P;
          const A = lvAxes(g, { progress: S.p(1, 1.2) });
          label(g, 'Phase plane', 780, 262);
          const pIso1 = S.p(1, 1.2, 3.1), pIso2 = S.p(1, 1.2, 5.0);
          // growth arrows for each species (beat 1)
          const ga = S.p(1, 0.8, 3.8) * (1 - S.p(1, 0.6, 8.8));
          const gb = S.p(1, 0.8, 5.6) * (1 - S.p(1, 0.6, 8.8));
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const a = 16 + i * 32, b = 16 + j * 32; const [d1, d2] = lvRate(P, a, b);
            if (Math.abs(d1) > 0.5) g.arrow(A.X(a) - 15 * Math.sign(d1), A.Y(b) - 6, A.X(a) + 15 * Math.sign(d1), A.Y(b) - 6, { color: C1, w: 2.4, head: 10, alpha: ga * 0.9 });
            if (Math.abs(d2) > 0.5) g.arrow(A.X(a) + 6, A.Y(b) + 15 * Math.sign(d2), A.X(a) + 6, A.Y(b) - 15 * Math.sign(d2), { color: C2, w: 2.4, head: 10, alpha: gb * 0.9 });
          }
          // field + particles (beats 2–3)
          const fv = S.p(2, 1.0);
          drawField(g, A, P, 0.22 * fv);
          const dim = 1 - 0.65 * win(S, 3, 14.4, 4, 0);
          g.clip(A.x, A.y, A.w, A.h, () => { for (const k of Object.keys(st.w)) drawParticles(g, A, D.sets[k], S.t, st.w[k] * fv * dim); });
          drawIsos(g, A, P, { p1: pIso1, p2: pIso2 });
          // intercept labels
          const la = 1 - st.m;
          const i1 = S.p(1, 0.8, 3.6) * la, i2 = S.p(1, 0.8, 5.4) * la;
          g.math('K_1', A.X(P.K1), A.Y(0) + 40, { size: 28, color: C1, align: 'center', alpha: i1 });
          g.math('K_1/α_{12}', A.X(0) - 14, A.Y(P.y1) + 9, { size: 28, color: C1, align: 'right', alpha: i1 });
          g.math('K_2', A.X(0) - 14, A.Y(P.K2) + 9, { size: 28, color: C2, align: 'right', alpha: i2 });
          g.math('K_2/α_{21}', A.X(P.x2), A.Y(0) + 40, { size: 28, color: C2, align: 'center', alpha: i2 });
          // legend
          g.withAlpha(S.p(1, 0.8, 3.2), () => { g.rect(1050, 310, 236, 74, { r: 6, fill: 'rgba(11,22,24,0.82)' }); g.line(1064, 334, 1100, 334, { color: C1, w: 4 }); g.math('\\dot{N}_1 = 0', 1112, 343, { size: 26, color: C1 }); });
          g.withAlpha(S.p(1, 0.8, 5.0), () => { g.line(1064, 366, 1100, 366, { color: C2, w: 4 }); g.math('\\dot{N}_2 = 0', 1112, 375, { size: 26, color: C2 }); });
          // equilibria
          drawEqMarks(g, A, P, S.p(2, 0.8, 0.8) * (1 - st.m));
          // case annotations on the plane
          const ca = (1 - st.m);
          if (key === 'A') g.pill('species 1 wins', A.X(P.K1) - 30, A.Y(0) - 62, { color: C1, size: 22, align: 'center', alpha: ca * S.p(2, 0.8, 4.4) });
          if (key === 'B') g.pill('species 2 wins', A.X(0) + 24, A.Y(P.K2) - 30, { color: C2, size: 22, alpha: ca * S.p(2, 0.8, 7.6) });
          const E = lvEq(P).find((e) => e.interior);
          if (key === 'C' && E) g.pill('stable equilibrium', A.X(E.x) + 20, A.Y(E.y) - 36, { color: COL, size: 22, alpha: ca * S.p(3, 0.8, 6.5) });
          if (key === 'D' && E) {
            const sp = S.p(3, 1.6, 12.8) * ca;
            g.clip(A.x, A.y, A.w, A.h, () => g.data(A, D.sep, { color: COL, w: 2.6, dash: [10, 8], progress: sp }));
            g.pill('unstable saddle', A.X(E.x) + 22, A.Y(E.y) - 30, { color: PAL.ink, size: 22, alpha: ca * S.p(3, 0.8, 13.0) });
            g.text('separatrix', A.X(129), A.Y(96) + 34, { size: 21, color: COL, align: 'right', alpha: sp });
            // priority effect demo
            const pp = S.lin(3, 4.2, 15.0);
            D.pr.forEach((o) => {
              const col = o.win === 1 ? C1 : C2; const s0 = o.tr[0];
              g.dot(A.X(s0[0]), A.Y(s0[1]), 6, col, S.p(3, 0.5, 14.6), 2.4);
              const tip = g.data(A, o.tr, { color: col, w: 3.6, progress: pp });
              if (pp > 0 && tip) g.dot(tip[0], tip[1], 7, col, 1, 3);
            });
            const s1 = D.pr.find((o) => o.win === 1).tr[0], s2 = D.pr.find((o) => o.win === 2).tr[0];
            g.text('1 ahead', A.X(s1[0]) + 14, A.Y(s1[1]) + 26, { size: 20, color: C1, alpha: S.p(3, 0.6, 14.8) });
            g.text('2 ahead', A.X(s2[0]) - 12, A.Y(s2[1]) - 14, { size: 20, color: C2, align: 'right', alpha: S.p(3, 0.6, 14.8) });
          }
        });
        // ---------------- left column content, beat 1: isoclines + four possibilities
        const b1 = vis(S, 1, 2);
        g.withAlpha(b1 * out4, () => {
          g.text('species 1 isocline', 150, 568, { size: 21, color: C1, alpha: S.p(1, 0.8, 3.0) });
          g.math('N_1 + α_{12}N_2 = K_1', 150, 612, { size: 34, alpha: S.p(1, 0.8, 3.2) });
          g.text('species 2 isocline', 420, 568, { size: 21, color: C2, alpha: S.p(1, 0.8, 5.4) });
          g.math('N_2 + α_{21}N_1 = K_2', 420, 612, { size: 34, alpha: S.p(1, 0.8, 5.6) });
          const keys = ['A', 'B', 'C', 'D'], when = [9.0, 10.0, 11.2, 12.4], nm = ['1 wins', '2 wins', 'coexist', 'saddle'];
          keys.forEach((k, i) => {
            const p = S.p(1, 0.6, when[i]); if (p <= 0) return;
            const M = miniMap(150 + i * 130, 676, 108); const on = key === k && st.m < 0.5 && S.since(1) > 9.0 && S.since(1) < 13.8;
            miniPlane(g, M, CASES[k], null, p);
            g.rect(M.x - 6, M.y - 6, M.w + 12, M.h + 12, { r: 6, stroke: on ? COL : PAL.rule, w: on ? 2.4 : 1.2, alpha: p });
            g.text(nm[i], M.x + M.w / 2, M.y + M.h + 36, { size: 21, color: on ? PAL.ink : PAL.ink2, align: 'center', alpha: p });
          });
        });
        // beat 2: exclusion cases + Gause
        const b2 = vis(S, 2, 3);
        g.withAlpha(b2 * out4, () => {
          const k = key === 'B' ? 'B' : 'A'; const c = COND[k]; const ca = 1 - st.m;
          g.withAlpha(ca * S.p(2, 0.8, 0.6), () => {
            g.text(c[0], 150, 584, { size: 40, role: 'display', color: c[2] });
            g.math(c[1], 150, 636, { size: 30 });
          });
          g.text('either way, the loser is excluded', 150, 684, { size: 21, color: PAL.ink2, italic: true, alpha: S.p(2, 0.8, 8.6) });
          const gp = S.p(2, 0.8, 11.0);
          g.withAlpha(gp, () => {
            label(g, 'Gause (1934) · Paramecium', 140, 734);
            const G = g.axes({ x: 190, y: 752, w: 420, h: 112, xmax: 24, ymax: 110, arrows: false });
            g.text('days', 610, 892, { size: 20, color: PAL.ink3, align: 'right' });
            const pr = S.lin(2, 5, 11.4);
            g.data(G, D.alone.map(([a, b]) => [0, b]).map((p, i) => [i * 0.1, p[1]]), { color: C2, w: 2, dash: [6, 6], alpha: 0.6, progress: pr });
            g.data(G, D.gause.map(([a], i) => [i * 0.1, a]), { color: C1, w: 3.2, progress: pr });
            g.data(G, D.gause.map(([, b], i) => [i * 0.1, b]), { color: C2, w: 3.2, progress: pr });
            const lp = S.p(2, 0.8, 15.0);
            g.text('P. aurelia', 620, G.Y(100) + 6, { size: 20, italic: true, color: C1, alpha: lp });
            g.text('P. caudatum alone', 620, G.Y(78) + 22, { size: 20, italic: true, color: C2, alpha: lp * 0.8 });
            g.text('P. caudatum, mixed', 620, G.Y(4) + 2, { size: 20, italic: true, color: C2, alpha: lp });
          });
        });
        // beat 3: crossing isoclines
        const b3 = vis(S, 3, 4);
        g.withAlpha(b3 * out4, () => {
          const c = COND.C, d = COND.D;
          const pc = S.p(3, 0.8, 1.2), pd = S.p(3, 0.8, 9.2);
          g.text(c[0], 150, 584, { size: 38, role: 'display', color: c[2], alpha: pc });
          g.math(c[1], 150, 632, { size: 28, alpha: pc });
          g.text(c[3], 150, 670, { size: 21, color: PAL.ink2, alpha: S.p(3, 0.8, 2.4) });
          g.text(d[0], 150, 738, { size: 38, role: 'display', color: d[2], alpha: pd });
          g.math(d[1], 150, 786, { size: 28, alpha: pd });
          g.text(d[3], 150, 824, { size: 21, color: PAL.ink2, alpha: S.p(3, 0.8, 10.2) });
          g.text('→ who starts ahead wins: a priority effect', 150, 870, { size: 22, color: PAL.ink, alpha: S.p(3, 0.8, 18.0) });
        });
        // ---------------- beat 4: summary table
        const v4 = S.p(4, 0.9, 0.2);
        if (v4 > 0) g.withAlpha(v4, () => lvTable(g, S, D));
      },
    },
    {
      id: 'comp-rstar', title: 'Resource competition & R*',
      beats: [
        { t: 'Lotka–Volterra describes the outcome of competition, but not its mechanism. David Tilman’s resource competition theory makes the mechanism explicit. For a single limiting resource, each species has an R*, the resource level at which its growth exactly balances its losses.',
          s: 'Lotka Volterra describes the outcome of competition, but not its mechanism. David Tilman’s resource competition theory makes the mechanism explicit. For a single limiting resource, each species has an R star, the resource level at which its growth exactly balances its losses.' },
        { t: 'A consumer draws the resource down until it reaches its own R*. So when species compete for one resource, the species with the lowest R* wins: it depresses the resource below the level its competitor needs to persist. This R* rule has held up in experiments with algae, bacteria, and grassland plants.',
          s: 'A consumer draws the resource down until it reaches its own R star. So when species compete for one resource, the species with the lowest R star wins: it depresses the resource below the level its competitor needs to persist. This R star rule has held up in experiments with algae, bacteria, and grassland plants.', pause: 0.5 },
        { t: 'With two essential resources, each species’ zero net growth isocline is L-shaped, and two species’ isoclines can cross. They coexist stably when each species is more limited by a different resource, and each consumes relatively more of the resource that limits it most.' },
        { t: 'Which outcome occurs depends on the supply point, the rates at which the two resources are supplied. That is Tilman’s resource-ratio hypothesis: shifting the ratio of nutrients, by fertilization for instance, can reorder which species win.', pause: 1 },
      ],
      terms: [
        { beat: 0.75, term: 'R*', def: 'Minimum resource level at which a population can persist; with one limiting resource, lowest R* wins.' },
        { beat: 3.2, term: 'Supply point', def: 'Resource availability in the absence of consumers; locates the outcome on the two-resource plane.' },
        { beat: 3.5, term: 'Resource-ratio hypothesis', def: 'Tilman: the ratio of limiting resources supplied determines which species dominate or coexist.' },
      ],
      init() {
        // chemostat: dR/dt = m(S − R) − Q Σ μ_i(R) N_i ; dN_i/dt = N_i (μ_i(R) − m)
        let R = MON.S, NA = 1, NB = 1; const dt = 0.002, ser = [];
        for (let k = 0; k <= 25000; k++) {
          if (k % 50 === 0) ser.push([k * dt, R, NA, NB]);
          const ma = monod(MON.A, R), mb = monod(MON.B, R);
          const dR = MON.m * (MON.S - R) - MON.Q * (ma * NA + mb * NB);
          NA += dt * NA * (ma - MON.m); NB += dt * NB * (mb - MON.m); R += dt * dR;
        }
        return { ser };
      },
      draw(g, t, S, D) {
        const RA = rstar(MON.A), RB = rstar(MON.B);
        // simulation clock for beat 1
        const tau = 50 * S.lin(1, 12, 0.2); const si = Math.min(D.ser.length - 1, Math.round(tau / 0.1)); const cur = D.ser[si];
        // ---------------- left: Monod curves (beats 0–1)
        const vM = S.p(0, 0.9, 8.8) * (1 - S.p(2, 0.6));
        g.withAlpha(vM, () => {
          label(g, 'One limiting resource', 140, 262);
          const M = g.axes({ x: 200, y: 320, w: 440, h: 300, xmax: 6, ymax: 1.15, xlab: 'resource R', progress: S.p(0, 1, 8.8), labSize: 22 });
          g.text('per-capita rate', 190, 304, { size: 21, color: PAL.ink2, alpha: S.p(0, 1, 9.2) });
          g.plot(M, (r) => monod(MON.A, r), { color: C1, w: 4, progress: S.p(0, 1.4, 9.6) });
          g.plot(M, (r) => monod(MON.B, r), { color: C2, w: 4, progress: S.p(0, 1.4, 10.2) });
          g.math('μ_A', M.X(6) + 10, M.Y(monod(MON.A, 6)) + 22, { size: 28, color: C1, alpha: S.p(0, 0.8, 10.6) });
          g.math('μ_B', M.X(6) + 10, M.Y(monod(MON.B, 6)) - 2, { size: 28, color: C2, alpha: S.p(0, 0.8, 11.0) });
          const pm = S.p(0, 1, 11.8);
          g.line(M.X(0), M.Y(MON.m), M.X(6), M.Y(MON.m), { color: PAL.ink2, w: 2.2, dash: [9, 7], progress: pm });
          g.text('loss rate m', M.X(6), M.Y(MON.m) + 30, { size: 21, color: PAL.ink2, align: 'right', alpha: pm });
          [[RA, C1, 'R^{*}_{A}', 12.4], [RB, C2, 'R^{*}_{B}', 12.9]].forEach(([r, c, s, d]) => {
            const p = S.p(0, 0.8, d);
            g.line(M.X(r), M.Y(MON.m), M.X(r), M.Y(0), { color: c, w: 2, dash: [5, 5], alpha: p });
            g.dot(M.X(r), M.Y(MON.m), 7, c, p, 2.8);
            g.math(s, M.X(r), M.Y(0) + 38, { size: 28, color: c, align: 'center', alpha: p });
          });
          g.text('growth = loss', M.X(RB) + 16, M.Y(MON.m) - 16, { size: 21, color: PAL.ink, alpha: S.p(0, 0.8, 14.6) * (1 - S.p(1, 0.6)) });
          // live resource level from the chemostat (beat 1)
          const lv = S.p(1, 0.6, 0.2);
          if (lv > 0) {
            const x = M.X(Math.min(6, cur[1]));
            g.line(x, M.Y(0), x, M.Y(1.12), { color: RES, w: 2.5, alpha: lv });
            g.math('R(t)', x + 8, M.Y(1.06), { size: 24, color: RES, alpha: lv });
            const ga = monod(MON.A, cur[1]) - MON.m, gb = monod(MON.B, cur[1]) - MON.m;
            g.dot(x, M.Y(monod(MON.A, cur[1])), 6, C1, lv, 2.4); g.dot(x, M.Y(monod(MON.B, cur[1])), 6, C2, lv, 2.4);
            g.text(`A ${Math.abs(ga) < 0.004 ? 'holds' : ga > 0 ? 'grows' : 'declines'}`, 640, 566, { size: 21, role: 'mono', color: C1, align: 'right', alpha: lv });
            g.text(`B ${gb >= 0 ? 'grows' : 'declines'}`, 640, 594, { size: 21, role: 'mono', color: gb >= 0 ? C2 : ENEMY, align: 'right', alpha: lv });
          }
          // experiments
          const ex = [['algae', 'Tilman 1977', PAL.mint, 'cell'], ['bacteria', 'Hansen & Hubbell 1980', PAL.lagoon, 'rod'], ['grasses', 'Tilman & Wedin 1991', C1, 'grass']];
          label(g, 'The R* rule in experiments', 140, 716, S.p(1, 0.8, 14.6));
          ex.forEach(([nm, cite, col, ic], i) => {
            const p = S.p(1, 0.7, 15.6 + i * 0.6); const cx = 230 + i * 205, cy = 770;
            g.withAlpha(p, () => {
              if (ic === 'rod') { [[-22, -8, 0.5], [2, 10, -0.3], [22, -10, 1.1], [-4, -18, -1.2]].forEach(([dx, dy, a]) => g.line(cx + dx - 11 * Math.cos(a), cy + dy - 11 * Math.sin(a), cx + dx + 11 * Math.cos(a), cy + dy + 11 * Math.sin(a), { color: col, w: 9 })); }
              else g.icon(ic, cx, cy, ic === 'cell' ? 50 : 56, col);
              g.text(nm, cx, cy + 56, { size: 21, color: col, align: 'center' });
              g.text(cite, cx, cy + 82, { size: 19, color: PAL.ink3, align: 'center' });
            });
          });
        });
        // ---------------- right, beat 0: phenomenological vs mechanistic
        const vC = S.p(0, 0.8, 0.2) * (1 - S.p(1, 0.6));
        g.withAlpha(vC, () => {
          const dx = lerp(-330, 0, S.io(0, 1.1, 8.4));
          const a1 = [890 + dx, 430], b1 = [1190 + dx, 430], r1 = [1040 + dx, 700];
          label(g, 'Outcome vs mechanism', 780 + dx, 262);
          const mech = S.p(0, 1, 4.9);
          g.text('Lotka–Volterra: α summarizes the effect', 1040 + dx, 316, { size: 21, color: PAL.ink2, align: 'center', alpha: 1 - mech * 0.6 });
          g.arrow(b1[0] - 66, b1[1] - 16, a1[0] + 66, a1[1] - 16, { color: C2, w: 2.6, head: 13, alpha: 1 - 0.7 * mech, dash: mech > 0.5 ? [7, 7] : null });
          g.arrow(a1[0] + 66, a1[1] + 16, b1[0] - 66, b1[1] + 16, { color: C1, w: 2.6, head: 13, alpha: 1 - 0.7 * mech, dash: mech > 0.5 ? [7, 7] : null });
          g.math('α', 1040 + dx, a1[1] - 30, { size: 30, color: PAL.ink, align: 'center', alpha: 1 - 0.6 * mech });
          g.text('?', 1040 + dx, a1[1] + 70, { size: 40, role: 'display', color: COL, align: 'center', alpha: S.p(0, 0.6, 3.2) * (1 - mech) });
          // resource node and its links
          g.withAlpha(mech, () => {
            [[a1, C1, -1], [b1, C2, 1]].forEach(([n, c, s]) => {
              const ux = r1[0] - n[0], uy = r1[1] - n[1], L = Math.hypot(ux, uy), nx = -uy / L * 12, ny = ux / L * 12;
              const p0 = [n[0] + ux / L * 64, n[1] + uy / L * 64], p1 = [r1[0] - ux / L * 64, r1[1] - uy / L * 64];
              g.arrow(p0[0] + nx, p0[1] + ny, p1[0] + nx, p1[1] + ny, { color: c, w: 2.6, head: 13 });
              g.arrow(p1[0] - nx, p1[1] - ny, p0[0] - nx, p0[1] - ny, { color: RES, w: 2.6, head: 13 });
              const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
              g.text('−', mx + s * 26 + nx * 0.8, my + ny * 0.8 + 10, { size: 30, role: 'math', color: c, align: 'center' });
              g.text('+', mx - s * 26 - nx * 0.8, my - ny * 0.8 + 10, { size: 30, role: 'math', color: RES, align: 'center' });
              g.text('consumes', mx + s * 62, my + 4, { size: 20, color: c, align: s < 0 ? 'right' : 'left' });
            });
            g.circle(r1[0], r1[1], 60, { fill: 'rgba(14,29,31,0.92)', stroke: RES, w: 2.4 });
            g.math('R', r1[0], r1[1] + 14, { size: 44, color: RES, align: 'center' });
            g.text('shared resource: depleted by both, fuels both', r1[0], r1[1] + 96, { size: 21, color: RES, align: 'center' });
            g.text('Tilman: competition through the resource', 1040 + dx, 862, { size: 22, color: PAL.ink, align: 'center', alpha: S.p(0, 0.8, 6.6) });
          });
          [[a1, C1, 'A'], [b1, C2, 'B']].forEach(([n, c, s]) => { g.circle(n[0], n[1], 60, { fill: 'rgba(14,29,31,0.92)', stroke: c, w: 2.4 }); g.text(s, n[0], n[1] + 16, { size: 46, role: 'display', color: c, align: 'center' }); });
        });
        // ---------------- right, beat 1: chemostat time series
        const vT = S.p(1, 0.8) * (1 - S.p(2, 0.6));
        g.withAlpha(vT, () => {
          label(g, 'Competition in a chemostat', 780, 262);
          const TR = g.axes({ x: 820, y: 310, w: 460, h: 200, xmax: 50, ymax: 6.5, ylab: 'R', progress: S.p(1, 1) });
          const TN = g.axes({ x: 820, y: 590, w: 460, h: 230, xmax: 50, ymax: 120, xlab: 'time', ylab: 'N', progress: S.p(1, 1, 0.3), labSize: 22 });
          const band = S.p(1, 0.8, 8.6);
          g.rect(TR.X(0), TR.Y(RB), TR.w, TR.Y(RA) - TR.Y(RB), { fill: U.rgba(C2, 0.16), alpha: band });
          g.line(TR.X(0), TR.Y(RA), TR.X(50), TR.Y(RA), { color: C1, w: 1.8, dash: [6, 6] });
          g.line(TR.X(0), TR.Y(RB), TR.X(50), TR.Y(RB), { color: C2, w: 1.8, dash: [6, 6] });
          g.math('R^{*}_{A}', TR.X(50) + 12, TR.Y(RA) + 20, { size: 24, color: C1 });
          g.math('R^{*}_{B}', TR.X(50) + 12, TR.Y(RB) - 2, { size: 24, color: C2 });
          g.text('too little for B', TR.X(48), TR.Y(RB) - 10, { size: 20, color: C2, align: 'right', alpha: band });
          const upto = D.ser.slice(0, si + 1);
          if (upto.length > 1) {
            g.data(TR, upto.map((q) => [q[0], q[1]]), { color: RES, w: 3.5 });
            g.data(TN, upto.map((q) => [q[0], q[2]]), { color: C1, w: 3.5 });
            g.data(TN, upto.map((q) => [q[0], q[3]]), { color: C2, w: 3.5 });
            g.dot(TR.X(cur[0]), TR.Y(cur[1]), 6, RES, 1, 2.6);
          }
          const pa = S.p(1, 0.8, 7.4);
          g.text('A: lowest R* wins', TN.X(50), TN.Y(100) - 16, { size: 21, color: C1, align: 'right', alpha: pa });
          g.text('B excluded', TN.X(50), TN.Y(0) - 14, { size: 21, color: C2, align: 'right', alpha: S.p(1, 0.8, 11.2) });
        });
        // ---------------- beats 2–3: two essential resources
        const v2 = S.p(2, 0.9);
        if (v2 > 0) g.withAlpha(v2, () => {
          label(g, 'Two essential resources', 140, 262);
          const A = rPlaneAxes(g, S.p(2, 1));
          // regions (beat 3)
          const rg = S.p(3, 1.2);
          if (rg > 0) {
            const poly = (pts) => pts.map(([a, b]) => [A.X(a), A.Y(b)]);
            g.poly(poly(REG.none), { fill: 'rgba(238,231,215,0.05)', color: null, w: 0, alpha: rg, close: true });
            g.poly(poly(REG.A), { fill: U.rgba(C1, 0.14), color: null, w: 0, alpha: rg, close: true });
            g.poly(poly(REG.B), { fill: U.rgba(C2, 0.14), color: null, w: 0, alpha: rg, close: true });
            g.poly(poly(REG.AB), { fill: U.rgba(COL, 0.18), color: null, w: 0, alpha: rg, close: true });
            const rl = S.p(3, 0.8, 0.5);
            g.text('neither persists', A.X(2.0), A.Y(0.45), { size: 21, color: PAL.ink2, align: 'center', alpha: rl });
            g.text('A wins', A.X(7.2), A.Y(2.15), { size: 24, weight: 600, color: C1, align: 'center', alpha: rl });
            g.text('B wins', A.X(2.6), A.Y(8.8), { size: 24, weight: 600, color: C2, align: 'center', alpha: rl });
            g.text('coexistence', A.X(8.4), A.Y(8.9), { size: 24, weight: 600, color: COL, align: 'center', alpha: rl });
          }
          // ZNGIs
          const za = S.p(2, 1.4, 2.6), zb = S.p(2, 1.4, 3.6);
          g.poly([[A.X(ZA[0]), A.Y(10)], [A.X(ZA[0]), A.Y(ZA[1])], [A.X(10), A.Y(ZA[1])]], { color: C1, w: 4.5, progress: za });
          g.poly([[A.X(ZB[0]), A.Y(10)], [A.X(ZB[0]), A.Y(ZB[1])], [A.X(10), A.Y(ZB[1])]], { color: C2, w: 4.5, progress: zb });
          const tk = S.p(2, 0.8, 4.4);
          g.math('R^{*}_{1B}', A.X(ZB[0]), A.Y(0) + 38, { size: 24, color: C2, align: 'center', alpha: tk });
          g.math('R^{*}_{1A}', A.X(ZA[0]), A.Y(0) + 38, { size: 24, color: C1, align: 'center', alpha: tk });
          g.math('R^{*}_{2A}', A.X(0) - 12, A.Y(ZA[1]) + 8, { size: 24, color: C1, align: 'right', alpha: tk });
          g.math('R^{*}_{2B}', A.X(0) - 12, A.Y(ZB[1]) + 8, { size: 24, color: C2, align: 'right', alpha: tk });
          g.text('A', A.X(ZA[0]) + 14, A.Y(9.6), { size: 30, role: 'display', color: C1, alpha: za });
          g.text('B', A.X(ZB[0]) + 14, A.Y(9.6), { size: 30, role: 'display', color: C2, alpha: zb });
          // crossing point
          const cp = S.p(2, 0.8, 5.6);
          g.glow(A.X(EQ[0]), A.Y(EQ[1]), 46, COL, 0.6 * cp * (1 - 0.5 * S.p(3, 1)));
          // consumption vectors and their extensions
          const cv = S.p(2, 1, 12.6), ext = S.p(2, 1.2, 14.4);
          const ex = A.X(EQ[0]), ey = A.Y(EQ[1]);
          const vec = (c, col, nm) => {
            const L = 1.9 / Math.hypot(c[0], c[1]);
            g.arrow(ex, ey, A.X(EQ[0] - c[0] * L), A.Y(EQ[1] - c[1] * L), { color: col, w: 3.6, head: 15, progress: cv });
            if (nm === 'c_A') g.math(nm, A.X(EQ[0] - c[0] * L) - 12, A.Y(EQ[1] - c[1] * L) - 10, { size: 28, color: col, align: 'right', alpha: cv });
            else g.math(nm, A.X(EQ[0] - c[0] * L) + 10, A.Y(EQ[1] - c[1] * L) + 24, { size: 28, color: col, alpha: cv });
            const T = Math.min((10 - EQ[0]) / c[0], (10 - EQ[1]) / c[1]);
            g.line(ex, ey, A.X(EQ[0] + c[0] * T), A.Y(EQ[1] + c[1] * T), { color: col, w: 2, dash: [8, 7], progress: ext });
          };
          vec(CA, C1, 'c_A'); vec(CB, C2, 'c_B');
          g.dot(ex, ey, 8, COL, cp, 3);
          // supply point (beat 3)
          const sv = S.p(3, 0.8, 1.8);
          const s1 = lerp(4.5, 9.5, S.io(3, 5.0, 8.4)), s2 = 5.5;
          const o = tilmanOutcome(s1, s2);
          if (sv > 0) {
            const sx = A.X(s1), sy = A.Y(s2);
            const pj = S.p(3, 0.8, 2.8);
            g.line(sx, sy, sx, A.Y(0), { color: RES, w: 1.4, dash: [4, 6], alpha: pj * sv });
            g.line(sx, sy, A.X(0), sy, { color: RES, w: 1.4, dash: [4, 6], alpha: pj * sv });
            g.math('S_1', sx, A.Y(0) - 12, { size: 24, color: RES, align: 'center', alpha: pj * sv });
            g.math('S_2', A.X(0) + 10, sy - 10, { size: 24, color: RES, alpha: pj * sv });
            // supply-ratio ray (resource-ratio hypothesis)
            const rr = S.p(3, 1, 6.0);
            g.line(A.X(0), A.Y(0), A.X(10), A.Y(10 * s2 / s1), { color: RES, w: 1.6, dash: [2, 7], alpha: 0.8 * rr });
            // where the resources end up
            const end = tilmanEnd(s1, s2, o); const ep = S.p(3, 0.8, 3.4);
            g.line(sx, sy, A.X(end[0]), A.Y(end[1]), { color: RES, w: 2, dash: [6, 6], alpha: ep * sv });
            g.circle(A.X(end[0]), A.Y(end[1]), 6, { fill: PAL.bg, stroke: RES, w: 2.4, alpha: ep * sv });
            g.glow(sx, sy, 40, RES, 0.7 * sv);
            g.with(() => { g.ctx.translate(sx, sy); g.ctx.rotate(Math.PI / 4); g.rect(-9, -9, 18, 18, { fill: RES, alpha: sv }); });
            g.text('S', sx + 16, sy - 14, { size: 26, role: 'math', italic: true, color: RES, alpha: sv });
            // fertilization arrow
            const fp = S.p(3, 0.8, 9.6);
            g.arrow(A.X(4.6), A.Y(6.25), A.X(7.4), A.Y(6.25), { color: RES, w: 2.8, head: 13, alpha: fp });
            g.text('fertilize: +R₁', A.X(6.0), A.Y(6.25) - 14, { size: 21, color: RES, align: 'center', alpha: fp });
          }
        });
        // right column, beat 2
        const r2 = vis(S, 2, 3);
        g.withAlpha(r2, () => {
          label(g, 'Zero net growth isoclines', 820, 262, S.p(2, 0.8, 2.6));
          g.poly([[830, 290], [830, 330], [880, 330]], { color: C1, w: 4, alpha: S.p(2, 0.8, 2.6) });
          note(g, 'species A', 896, 330, { color: C1, alpha: S.p(2, 0.8, 2.6) });
          g.poly([[1050, 290], [1050, 330], [1100, 330]], { color: C2, w: 4, alpha: S.p(2, 0.8, 3.6) });
          note(g, 'species B', 1116, 330, { color: C2, alpha: S.p(2, 0.8, 3.6) });
          g.wrap('Essential resources: growth is set by whichever is scarcer, so each isocline is an L.', 820, 392, 470, { size: 21, color: PAL.ink2, alpha: S.p(2, 0.8, 4.4) });
          const lp = S.p(2, 0.8, 9.6);
          g.text('At the crossing', 820, 500, { size: 30, role: 'display', color: PAL.ink, alpha: S.p(2, 0.8, 7.8) });
          g.text('A is limited by R₁', 820, 542, { size: 22, color: C1, alpha: lp });
          g.text('B is limited by R₂', 820, 576, { size: 22, color: C2, alpha: lp });
          const cp = S.p(2, 0.8, 12.6);
          g.text('Consumption vectors', 820, 650, { size: 30, role: 'display', color: PAL.ink, alpha: cp });
          g.text('A consumes relatively more R₁', 820, 692, { size: 22, color: C1, alpha: cp });
          g.text('B consumes relatively more R₂', 820, 726, { size: 22, color: C2, alpha: S.p(2, 0.8, 13.2) });
          g.wrap('Each eats most of what limits itself → each limits itself more than the other → stable.', 820, 790, 470, { size: 21, color: COL, alpha: S.p(2, 0.8, 14.6) });
        });
        // right column, beat 3: supply point readout
        const r3 = S.p(3, 0.8, 1.6);
        g.withAlpha(r3, () => {
          const s1 = lerp(4.5, 9.5, S.io(3, 5.0, 8.4)), s2 = 5.5; const o = tilmanOutcome(s1, s2); const [nm, col, sub] = OUT[o];
          label(g, 'Supply point', 820, 262);
          g.math('S = (S_1, S_2)', 820, 330, { size: 34, color: RES });
          note(g, 'resource supply without consumers', 820, 368);
          g.rect(820, 400, 470, 120, { r: 8, fill: U.rgba(col, 0.1), stroke: col, w: 1.6 });
          g.text(nm, 846, 462, { size: 42, role: 'display', color: col });
          note(g, sub, 846, 498, { color: PAL.ink2 });
          const rh = S.p(3, 0.8, 6.0);
          label(g, 'Resource-ratio hypothesis', 820, 590, rh);
          g.text(`supply ratio  S₁ : S₂ = ${(s1 / s2).toFixed(2)}`, 820, 634, { size: 22, role: 'mono', color: RES, alpha: rh });
          g.wrap('Fertilizing with R₁ shifts the ratio and reorders the winners: B → both → A.', 820, 700, 470, { size: 22, color: PAL.ink, alpha: S.p(3, 0.8, 10.4) });
        });
      },
    },
    {
      id: 'comp-chesson', title: 'Modern coexistence theory',
      beats: [
        { t: 'Peter Chesson’s modern coexistence theory, published in 2000, reorganized all of this. Its test for coexistence is mutual invasibility: each species must be able to increase when rare, invading a community dominated by the other.' },
        { t: 'Mechanisms come in two kinds. Stabilizing mechanisms, or niche differences, cause species to limit themselves more than each other, so any species gains an advantage when it becomes rare. Equalizing mechanisms shrink average fitness differences, the inherent competitive advantage of one species over another.' },
        { t: 'Species coexist when niche differences overcome fitness differences. On this plane, the zone of coexistence widens as niche differences grow. Equalizing mechanisms alone can never produce stable coexistence, but they reduce the niche difference required.', pause: 0.5 },
        { t: 'Stabilizing mechanisms include resource partitioning and Janzen–Connell effects, where specialist natural enemies kill seedlings near their parents. Others depend on fluctuations. The storage effect operates when species respond differently to a variable environment and can store gains, in seed banks or long-lived adults, through bad years. Relative nonlinearity operates when species respond nonlinearly to fluctuating resources.' },
        { t: 'Together these ideas resolve Hutchinson’s 1961 paradox of the plankton: how dozens of phytoplankton species coexist on a handful of resources in an apparently well-mixed lake. Variation in time, natural enemies, and hidden spatial structure keep the system from ever reaching exclusion.', pause: 1 },
      ],
      terms: [
        { beat: 0.6, term: 'Mutual invasibility', def: 'Coexistence criterion: each species has a positive growth rate when rare in the other’s presence.' },
        { beat: 1.25, term: 'Stabilizing mechanism', def: 'Niche difference causing stronger intra- than interspecific limitation; favors species when rare.' },
        { beat: 1.7, term: 'Equalizing mechanism', def: 'Reduction in average fitness differences between species; cannot by itself stabilize coexistence.' },
        { beat: 3.15, term: 'Janzen–Connell effect', def: 'Specialist enemies concentrated near parent trees reduce recruitment of conspecifics nearby.' },
        { beat: 3.45, term: 'Storage effect', def: 'Fluctuation-dependent coexistence: species-specific responses to environment plus buffered population growth.' },
        { beat: 4.2, term: 'Paradox of the plankton', def: 'Hutchinson (1961): many phytoplankton coexist on few resources, defying competitive exclusion.' },
      ],
      init() {
        // invasion runs on the stable-coexistence LV parameters
        const P = CASES.C;
        const inv1 = lvRun(P, 0.4, P.K2, 40, 0.01, 10), inv2 = lvRun(P, P.K1, 0.4, 40, 0.01, 10);
        // Janzen–Connell vignette
        const r = rng(77); const seeds = [];
        for (let k = 0; k < 46; k++) { const d = -Math.log(1 - r() * 0.97) * 62 * (r() < 0.5 ? -1 : 1); seeds.push([d, r()]); }
        // storage effect: species-specific good years, long-lived adults buffer
        const good = [1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1];
        const rec = good.map((gd) => [gd === 1 ? 0.75 + 0.25 * r() : 0.05 + 0.1 * r(), gd === 2 ? 0.75 + 0.25 * r() : 0.05 + 0.1 * r()]);
        const ad = [[1, 1]]; rec.forEach(([a, b]) => { const [n1, n2] = ad[ad.length - 1]; ad.push([0.8 * n1 + 0.4 * a, 0.8 * n2 + 0.4 * b]); });
        // plankton
        const cols = [PAL.moss, PAL.lagoon, PAL.rose, PAL.mint, PAL.heather, PAL.sand, PAL.coral, '#8FB8E8', '#C7E07A', '#F2A7C8'];
        const cells = [];
        for (let k = 0; k < 64; k++) cells.push({ x: 200 + 1040 * r(), y: 372 + 440 * r(), type: Math.floor(r() * 6), col: cols[k % cols.length], s: 7 + 7 * r(), vx: (r() - 0.5) * 16, ph: r() * 10, rot: r() * 6.28, spin: (r() - 0.5) * 0.6, era: r() });
        return { inv1, inv2, seeds, good, rec, ad, cells };
      },
      draw(g, t, S, D) {
        // ================= beat 0 =================
        const v0 = vis(S, 0, 1);
        // reorganization: older ideas collapse into one framework
        const pv = S.p(0, 0.6, 0.3) * (1 - S.p(0, 0.6, 6.2));
        g.withAlpha(pv * v0, () => {
          label(g, 'Chesson (2000) · one framework', 140, 262);
          const pills = [['Lotka–Volterra α', 300, 360], ['R* and ZNGIs', 900, 340], ['resource partitioning', 330, 520], ['Janzen–Connell effects', 1000, 500], ['storage effect', 420, 700], ['relative nonlinearity', 960, 700], ['priority effects', 640, 820]];
          const m = S.io(0, 1.6, 3.8);
          pills.forEach(([s, x, y], k) => {
            const p = S.p(0, 0.6, 0.3 + k * 0.28);
            const ang = k * 0.9 + S.t * 0.25, wob = 8 * (1 - m);
            g.pill(s, lerp(x, 715, m) + wob * Math.cos(ang), lerp(y, 560, m) + wob * Math.sin(ang), { color: [C1, RES, PAL.mint, C2, PAL.lagoon, COL, PAL.sand][k], size: 26, alpha: p * (1 - ease.out(m * 1.15)), align: 'center' });
          });
          const bp = S.p(0, 0.8, 4.6);
          g.rect(415, 500, 600, 120, { r: 12, fill: 'rgba(24,30,44,0.92)', stroke: COL, w: 2, alpha: bp });
          g.text('one test for coexistence', 715, 552, { size: 34, role: 'display', color: PAL.ink, align: 'center', alpha: bp });
          g.text('can each species increase when rare?', 715, 592, { size: 22, color: PAL.ink2, align: 'center', alpha: bp });
        });
        // invasion experiments (left)
        g.withAlpha(v0 * S.p(0, 0.8, 8.4), () => {
          label(g, 'Mutual invasibility', 140, 262);
          [[D.inv1, 0, 'species 1 rare, invading species 2', 320], [D.inv2, 1, 'species 2 rare, invading species 1', 600]].forEach(([run, k, ttl, y], j) => {
            const p = S.p(0, 0.8, 8.6 + j * 2.4);
            g.withAlpha(p, () => {
              g.text(ttl, 200, y - 14, { size: 21, color: k ? C2 : C1 });
              const A = g.axes({ x: 200, y, w: 440, h: 200, xmax: 40, ymin: 0.3, ymax: 200, logy: true, xlab: 'time', ylab: 'N', labSize: 22, yticks: [{ v: 1, l: '1' }, { v: 10, l: '10' }, { v: 100, l: '100' }] });
              const pr = S.lin(0, 3.2, 9.0 + j * 2.4);
              g.data(A, run.map((q, i) => [i * 0.1, Math.max(0.3, q[k])]), { color: k ? C2 : C1, w: 4, progress: pr });
              g.data(A, run.map((q, i) => [i * 0.1, Math.max(0.3, q[1 - k])]), { color: k ? C1 : C2, w: 2.2, alpha: 0.6, progress: pr });
              g.text('increases when rare', A.X(17), A.Y(0.75), { size: 20, color: k ? C2 : C1, alpha: S.p(0, 0.6, 10.4 + j * 2.4) });
            });
          });
        });
        // growth-rate-when-rare plot (right) — beats 0–1
        const vF = S.p(0, 0.8, 6.6) * (1 - S.p(2, 0.6));
        g.withAlpha(vF, () => {
          label(g, 'Growth vs. frequency', 780, 262);
          const F = g.axes({ x: 830, y: 320, w: 440, h: 360, xmin: 0, xmax: 1, ymin: -0.75, ymax: 0.85, arrows: false, xticks: [{ v: 0, l: '0' }, { v: 1, l: '1' }] });
          g.text('relative frequency of the focal species', 1050, 736, { size: 22, color: PAL.ink2, align: 'center' });
          g.text('per-capita growth', 822, 304, { size: 21, color: PAL.ink2 });
          g.line(F.X(0), F.Y(0), F.X(1), F.Y(0), { color: PAL.ink2, w: 1.6, dash: [6, 6] });
          g.math('0', F.X(0) - 12, F.Y(0) + 8, { size: 22, color: PAL.ink3, align: 'right' });
          const Sx = lerp(0.6, 1.0, S.io(1, 1.6, 5.8)), dd = lerp(0.3, 0.06, S.io(1, 1.6, 13.0));
          const lp = S.p(0, 1.2, 7.2);
          g.plot(F, (f) => Sx * (0.5 - f) + dd / 2, { color: C1, w: 4, progress: lp });
          g.plot(F, (f) => Sx * (0.5 - f) - dd / 2, { color: C2, w: 4, progress: S.p(0, 1.2, 7.6) });
          g.text('species 1', F.X(0.72), F.Y(Sx * (0.5 - 0.72) + dd / 2) - 16, { size: 21, color: C1, align: 'center', alpha: lp });
          g.text('species 2', F.X(0.72), F.Y(Sx * (0.5 - 0.72) - dd / 2) + 34, { size: 21, color: C2, align: 'center', alpha: lp });
          const ip = S.p(0, 0.8, 8.8);
          g.dot(F.X(0), F.Y(Sx / 2 + dd / 2), 8, C1, ip, 3); g.dot(F.X(0), F.Y(Sx / 2 - dd / 2), 8, C2, ip, 3);
          g.text('both > 0 when rare', F.X(0.06), F.Y(Sx / 2 + dd / 2) - 18, { size: 21, color: PAL.ink, alpha: ip });
          // beat 1 annotations
          g.text('stabilizing: steeper lines, faster growth when rare', 830, 800, { size: 21, color: PAL.ink, alpha: S.p(1, 0.8, 5.6) });
          g.text('equalizing: smaller fitness gap between the lines', 830, 836, { size: 21, color: PAL.ink, alpha: S.p(1, 0.8, 13.0) });
          if (S.at(1)) {
            const ga = S.p(1, 0.8, 13.4); const y1 = F.Y(0.25 + dd / 2), y2 = F.Y(0.25 - dd / 2);
            g.line(F.X(0.25) + 18, y1, F.X(0.25) + 18, y2, { color: PAL.ink2, w: 1.6, alpha: ga });
            g.text('fitness difference', F.X(0.25) + 28, (y1 + y2) / 2 + 7, { size: 20, color: PAL.ink2, alpha: ga });
          }
        });
        // ================= beats 1–2: the Chesson plane =================
        const vP = S.p(1, 0.9, 2.0) * (1 - S.p(3, 0.6));
        g.withAlpha(vP, () => {
          label(g, 'Niche vs. fitness differences', 140, 262);
          const A = chAxes(g, { progress: S.p(1, 1.2, 2.0) });
          g.text('niche difference', 400, 856, { size: 22, color: PAL.ink2, align: 'center', alpha: S.p(1, 0.8, 3.6) });
          g.math('1 − ρ', 512, 857, { size: 26, color: PAL.ink, alpha: S.p(1, 0.8, 3.6) });
          g.math('κ_1/κ_2', 214, 314, { size: 28, align: 'right', alpha: S.p(1, 0.8, 12.6) });
          g.text('fitness ratio (log scale)', 232, 314, { size: 21, color: PAL.ink2, alpha: S.p(1, 0.8, 12.6) });
          // coexistence zone
          const zp = S.p(2, 1.2, 0.2);
          const top = [], bot = [];
          for (let k = 0; k <= 60; k++) { const x = k / 60; top.push([A.X(x), A.Y(Math.min(4, 1 / Math.max(1e-6, 1 - x)))]); bot.push([A.X(x), A.Y(Math.max(0.25, 1 - x))]); }
          g.poly([...top, ...bot.slice().reverse()], { fill: U.rgba(COL, 0.17), color: null, w: 0, alpha: S.p(2, 1, 1.0), close: true });
          g.poly(top, { color: COL, w: 3, progress: zp }); g.poly(bot, { color: COL, w: 3, progress: zp });
          const zl = S.p(2, 0.8, 1.2);
          g.math('κ_1/κ_2 = 1/ρ', A.X(0.75), A.Y(4) - 12, { size: 24, color: COL, align: 'center', alpha: zl });
          g.math('κ_1/κ_2 = ρ', A.X(0.75), A.Y(0.25) + 34, { size: 24, color: COL, align: 'center', alpha: zl });
          g.text('coexistence', A.X(0.78), A.Y(1) + 8, { size: 24, weight: 600, color: COL, align: 'center', alpha: zl });
          g.text('species 1 excludes 2', A.X(0.02), A.Y(3.55), { size: 21, color: C1, alpha: zl });
          g.text('species 2 excludes 1', A.X(0.02), A.Y(0.355), { size: 21, color: C2, alpha: zl });
          // beat 1: mechanism arrows
          const sa = S.p(1, 0.9, 3.6) * (1 - S.p(2, 0.6)), ea = S.p(1, 0.9, 13.0) * (1 - S.p(2, 0.6));
          g.arrow(A.X(0.06), A.Y(1), A.X(0.72), A.Y(1), { color: PAL.ink, w: 4, head: 18, progress: sa });
          g.text('stabilizing', A.X(0.4), A.Y(1) - 18, { size: 24, weight: 600, color: PAL.ink, align: 'center', alpha: sa });
          g.arrow(A.X(0.86), A.Y(3.6), A.X(0.86), A.Y(1.15), { color: PAL.ink, w: 4, head: 18, progress: ea });
          g.arrow(A.X(0.86), A.Y(0.28), A.X(0.86), A.Y(0.87), { color: PAL.ink, w: 4, head: 18, progress: ea });
          g.text('equalizing', A.X(0.84), A.Y(2.0), { size: 24, weight: 600, color: PAL.ink, align: 'right', alpha: ea });
          // beat 2: widening sweep
          const sw = S.io(2, 3.6, 4.6), swa = win(S, 2, 4.4, 2, 8.8);
          if (swa > 0) {
            const x = lerp(0.12, 0.7, sw), yt = Math.min(4, 1 / (1 - x)), yb = Math.max(0.25, 1 - x);
            g.line(A.X(x), A.Y(yt), A.X(x), A.Y(yb), { color: PAL.ink, w: 3, alpha: swa });
            g.line(A.X(x) - 8, A.Y(yt), A.X(x) + 8, A.Y(yt), { color: PAL.ink, w: 3, alpha: swa }); g.line(A.X(x) - 8, A.Y(yb), A.X(x) + 8, A.Y(yb), { color: PAL.ink, w: 3, alpha: swa });
            g.text('zone widens', A.X(x) + 14, A.Y(1) + 34, { size: 21, color: PAL.ink, alpha: swa });
          }
          // species pairs
          const pa = S.p(2, 0.8, 0.8);
          [[0.22, 3.0], [0.55, 0.62], [0.8, 3.0], [0.12, 0.6], [0.42, 1.3], [0.62, 1.8], [0.9, 0.5]].forEach(([x, y]) => pairDot(g, A, x, y, pa * 0.85));
          // stabilizing moves a pair into the zone
          const m1 = S.io(2, 1.8, 1.4); const p1x = lerp(0.14, 0.7, m1), p1y = 2.2;
          g.line(A.X(0.14), A.Y(p1y), A.X(p1x), A.Y(p1y), { color: PAL.ink2, w: 2, dash: [4, 6], alpha: pa });
          pairDot(g, A, p1x, p1y, pa, true);
          // equalizing alone (no niche difference) never reaches the zone
          const eqa = S.p(2, 0.6, 9.0); const m2 = S.io(2, 2.8, 9.2); const q0y = Math.exp(lerp(Math.log(2.8), Math.log(1.05), m2));
          g.withAlpha(eqa, () => {
            g.line(A.X(0.015), A.Y(2.8), A.X(0.015), A.Y(q0y), { color: PAL.ink2, w: 2, dash: [4, 6] });
            pairDot(g, A, 0.015, q0y, 1, true);
            g.text('ρ = 1: neutral at best, never stable', A.X(0.05), A.Y(q0y) + 6, { size: 20, color: PAL.ink, alpha: S.p(2, 0.6, 11.4) * (1 - S.p(2, 0.6, 13.0)) });
          });
          // equalizing lowers the niche difference required
          const qa = S.p(2, 0.6, 12.8); const m3 = S.io(2, 2.0, 13.2); const qy = Math.exp(lerp(Math.log(2.6), Math.log(1.25), m3)), qx = 0.3;
          if (qa > 0) {
            const req = 1 - 1 / qy;
            g.withAlpha(qa, () => {
              g.line(A.X(qx), A.Y(2.6), A.X(qx), A.Y(qy), { color: PAL.ink2, w: 2, dash: [4, 6] });
              g.line(A.X(qx), A.Y(qy), A.X(req), A.Y(qy), { color: RES, w: 2, dash: [3, 5] });
              g.line(A.X(req), A.Y(qy), A.X(req), A.Y(0.25), { color: RES, w: 1.6, dash: [3, 5] });
              g.circle(A.X(req), A.Y(0.25), 6, { fill: RES });
              g.text('required', A.X(req), A.Y(0.25) - 14, { size: 20, color: RES, align: 'center' });
              pairDot(g, A, qx, qy, 1, true);
            });
          }
        });
        // right column, beat 2: the criterion
        const vR = vis(S, 2, 3);
        g.withAlpha(vR, () => {
          label(g, 'Coexistence criterion', 780, 262);
          g.math('ρ < \\frac{κ_1}{κ_2} < \\frac{1}{ρ}', 800, 380, { size: 54, alpha: S.p(2, 0.9, 0.4) });
          const dp = S.p(2, 0.8, 1.6);
          g.math('ρ', 800, 470, { size: 30, color: COL, alpha: dp }); note(g, 'niche overlap;  1 − ρ = niche difference', 840, 470, { alpha: dp, color: PAL.ink });
          g.math('κ_1/κ_2', 800, 514, { size: 30, color: COL, alpha: dp }); note(g, 'average fitness ratio', 900, 514, { alpha: dp, color: PAL.ink });
          g.wrap('Niche differences must overcome fitness differences.', 800, 584, 480, { size: 22, color: PAL.ink2, alpha: S.p(2, 0.8, 2.0) });
          g.wrap('Equalizing alone, with ρ = 1, can at best make species neutral; it never stabilizes.', 800, 690, 480, { size: 22, color: PAL.ink, alpha: S.p(2, 0.8, 10.8) });
          g.wrap('But a smaller fitness gap lowers the niche difference needed.', 800, 790, 480, { size: 22, color: RES, alpha: S.p(2, 0.8, 13.2) });
        });
        // ================= beat 3: mechanisms =================
        const v3 = vis(S, 3, 4);
        g.withAlpha(v3, () => {
          // Janzen–Connell (left)
          const jc = S.p(3, 0.8, 3.0);
          g.withAlpha(jc, () => {
            label(g, 'Janzen–Connell effects', 140, 262);
            const cx = 410, gy = 470, sc = 230;
            g.line(170, gy, 650, gy, { color: PAL.sand, w: 2, alpha: 0.6 });
            g.icon('tree', cx, gy - 70, 140, PAL.ink3);
            D.seeds.forEach(([d, u], k) => { const x = cx + d; if (x < 175 || x > 645) return; g.circle(x, gy - 4 - u * 8, 3.2, { fill: RES, alpha: 0.85 * S.p(3, 0.5, 3.4 + k * 0.02) }); });
            const ea = S.p(3, 0.8, 4.9);
            for (let k = 0; k < 6; k++) { const x = cx + (k < 3 ? -1 : 1) * (26 + (k % 3) * 24) + 5 * Math.sin(S.t * 2 + k), y = gy - 12 - 8 * Math.abs(Math.sin(S.t * 1.6 + k * 1.3)); g.icon('bug', x, y, 20, ENEMY, { alpha: ea, rot: Math.sin(S.t + k) * 0.5 }); }
            g.text('specialist enemies', cx, gy + 34, { size: 20, color: ENEMY, align: 'center', alpha: ea });
            const ka = S.p(3, 0.8, 6.4);
            for (let k = -6; k <= 6; k++) { if (Math.abs(k) < 2) continue; const d = k * 37, x = cx + d; const near = Math.abs(d) < 100; g.icon('plant', x, gy - 18, 34, near ? PAL.ink3 : C1, { alpha: ka, rot: near ? 1.0 * Math.sign(d) : 0 }); if (near) g.text('×', x, gy - 46, { size: 22, color: ENEMY, align: 'center', alpha: ka }); }
            const J = g.axes({ x: 170, y: 560, w: 480, h: 250, xmin: -1, xmax: 1, ymin: 0, ymax: 1.08, arrows: false, progress: S.p(3, 0.8, 3.2) });
            g.text('distance from parent', 410, 852, { size: 22, color: PAL.ink2, align: 'center', alpha: S.p(3, 0.8, 3.2) });
            g.line(J.X(0), J.Y(0), J.X(0), J.Y(1.05), { color: PAL.ink3, w: 1.4, dash: [4, 6] });
            const sd = (d) => Math.exp(-Math.abs(d) / 0.3), sv = (d) => 1 / (1 + Math.exp(-(Math.abs(d) - 0.35) / 0.08)), rc = (d) => sd(d) * sv(d) / 0.1735 * 0.92;
            g.plot(J, sd, { color: RES, w: 3.2, progress: S.p(3, 1.2, 3.6) });
            g.plot(J, sv, { color: C1, w: 3.2, progress: S.p(3, 1.2, 5.4) });
            g.plot(J, rc, { color: COL, w: 4.5, progress: S.p(3, 1.4, 7.0), fillTo: 0, fillColor: U.rgba(COL, 0.12) });
            g.text('seeds', J.X(0.1), J.Y(0.92), { size: 21, color: RES, alpha: S.p(3, 0.8, 4.0) });
            g.text('seedling survival', J.X(0.98), J.Y(1.0) - 10, { size: 21, color: C1, align: 'right', alpha: S.p(3, 0.8, 5.9) });
            g.text('recruitment', J.X(-0.43), J.Y(0.92) - 18, { size: 21, weight: 600, color: COL, align: 'center', alpha: S.p(3, 0.8, 7.8) });
          });
          // resource partitioning (right, early)
          const rp = S.p(3, 0.8, 1.4) * (1 - S.p(3, 0.6, 10.2));
          g.withAlpha(rp, () => {
            label(g, 'Resource partitioning', 780, 262);
            const RP = g.axes({ x: 820, y: 330, w: 450, h: 240, xmin: 0, xmax: 1, ymin: 0, ymax: 1.1, arrows: false, xlab: 'resource axis (e.g., seed size)', labSize: 22 });
            g.text('use', 812, 318, { size: 21, color: PAL.ink2 });
            g.plot(RP, (x) => Math.exp(-((x - 0.34) ** 2) / 0.016), { color: C1, w: 4, fillTo: 0, fillColor: U.rgba(C1, 0.14) });
            g.plot(RP, (x) => Math.exp(-((x - 0.66) ** 2) / 0.016), { color: C2, w: 4, fillTo: 0, fillColor: U.rgba(C2, 0.14) });
            note(g, 'little overlap: each species mainly limits itself', 820, 680, { color: PAL.ink });
          });
          // storage effect (right)
          const se = S.p(3, 0.8, 10.8);
          g.withAlpha(se, () => {
            label(g, 'Storage effect', 780, 262);
            const n = D.good.length, x0 = 860, w = 410, cw = w / n;
            const shown = clamp(S.lin(3, 6.0, 12.6)) * n;
            g.text('good for', 850, 318, { size: 20, color: PAL.ink3, align: 'right' });
            g.text('recruits', 850, 404, { size: 20, color: PAL.ink3, align: 'right' });
            g.text('adults', 850, 560, { size: 20, color: PAL.ink3, align: 'right' });
            for (let k = 0; k < n; k++) {
              const p = clamp(shown - k); if (p <= 0) continue; const x = x0 + k * cw;
              g.rect(x + 2, 300, cw - 4, 24, { r: 3, fill: D.good[k] === 1 ? C1 : C2, alpha: 0.55 * p });
              const [a, b] = D.rec[k];
              g.rect(x + 4, 470 - 110 * a * p, cw / 2 - 5, 110 * a * p, { fill: C1, r: 2, alpha: 0.9 });
              g.rect(x + cw / 2 + 1, 470 - 110 * b * p, cw / 2 - 5, 110 * b * p, { fill: C2, r: 2, alpha: 0.9 });
            }
            g.line(x0, 470, x0 + w, 470, { color: PAL.ink2, w: 1.6 });
            const AD = { X: (v) => x0 + v * cw, Y: (v) => 640 - v * 72 };
            const ap = S.p(3, 0.8, 16.8);
            g.withAlpha(ap, () => {
              g.line(x0, 640, x0 + w, 640, { color: PAL.ink2, w: 1.6 });
              g.data(AD, D.ad.slice(0, Math.floor(shown) + 1).map((q, i) => [i + 0.5, q[0]]), { color: C1, w: 3.4 });
              g.data(AD, D.ad.slice(0, Math.floor(shown) + 1).map((q, i) => [i + 0.5, q[1]]), { color: C2, w: 3.4 });
              note(g, 'long-lived adults carry each species through its bad years', 820, 682, { color: PAL.ink });
            });
          });
          // relative nonlinearity (right, bottom)
          const rn = S.p(3, 0.8, 20.4);
          g.withAlpha(rn, () => {
            g.line(820, 712, 1290, 712, { color: PAL.rule, w: 1 });
            const RN = g.axes({ x: 830, y: 742, w: 210, h: 120, xmin: 0, xmax: 1, ymin: 0, ymax: 1, arrows: false });
            g.text('R', 1046, 870, { size: 22, role: 'math', italic: true, color: RES });
            g.plot(RN, (x) => 0.92 * x, { color: C1, w: 3 });
            g.plot(RN, (x) => 1.2 * x / (0.25 + x), { color: C2, w: 3 });
            const rr = 0.5 + 0.42 * Math.sin(S.t * 2.2);
            g.line(RN.X(rr), RN.Y(0), RN.X(rr), RN.Y(1), { color: RES, w: 2, alpha: 0.8 });
            g.dot(RN.X(rr), RN.Y(0.92 * rr), 5, C1, 1, 2.4); g.dot(RN.X(rr), RN.Y(Math.min(1, 1.2 * rr / (0.25 + rr))), 5, C2, 1, 2.4);
            g.text('Relative nonlinearity', 1070, 760, { size: 26, role: 'display', color: PAL.ink });
            g.wrap('different curvature, so resource fluctuations favor one species and hurt the other', 1070, 792, 220, { size: 19, color: PAL.ink2, lh: 1.28 });
          });
        });
        // ================= beat 4: paradox of the plankton =================
        const v4 = S.p(4, 1.0);
        g.withAlpha(v4, () => {
          label(g, 'The paradox of the plankton · Hutchinson (1961)', 140, 262);
          const c = g.ctx; const sy = 340;
          // basin
          c.save(); c.beginPath(); c.moveTo(150, sy); c.lineTo(1290, sy); c.bezierCurveTo(1270, 700, 1180, 870, 980, 876); c.lineTo(460, 876); c.bezierCurveTo(260, 870, 170, 700, 150, sy); c.closePath();
          const gr = c.createLinearGradient(0, sy, 0, 880); gr.addColorStop(0, U.rgba(PAL.lagoon, 0.30)); gr.addColorStop(0.5, U.rgba(PAL.lagoon, 0.14)); gr.addColorStop(1, 'rgba(10,30,34,0.5)');
          c.fillStyle = gr; c.fill(); c.strokeStyle = U.rgba(PAL.lagoon, 0.5); c.lineWidth = 2; c.stroke(); c.clip();
          // light rays
          for (let k = 0; k < 9; k++) { const x = 300 + k * 120 + 20 * Math.sin(S.t * 0.4 + k); const gl = c.createLinearGradient(0, sy, 0, sy + 300); gl.addColorStop(0, 'rgba(232,180,74,0.16)'); gl.addColorStop(1, 'rgba(232,180,74,0)'); c.fillStyle = gl; c.beginPath(); c.moveTo(x, sy); c.lineTo(x + 40, sy); c.lineTo(x - 30, sy + 300); c.lineTo(x - 70, sy + 300); c.closePath(); c.fill(); }
          // hidden spatial structure: patches and eddies
          const hs = S.p(4, 1, 13.6);
          for (let k = 0; k < 4; k++) { const ex = 330 + k * 270, ey = 500 + 120 * (k % 2); for (let j = 0; j < 3; j++) g.ellipse(ex, ey, 70 + j * 26, 34 + j * 13, { rot: S.t * 0.2 * (k % 2 ? 1 : -1) + j, stroke: PAL.lagoon, w: 1.6, alpha: 0.35 * hs, dash: [10, 12] }); }
          g.line(150, 590, 1290, 590, { color: PAL.ink3, w: 1.4, dash: [10, 10], alpha: 0.7 });
          g.rect(150, 846, 1140, 40, { fill: 'rgba(216,196,155,0.18)' });
          c.restore();
          g.text('thermocline', 1222, 582, { size: 20, color: PAL.ink2, align: 'right' });
          // surface
          const wv = []; for (let k = 0; k <= 60; k++) { const x = 150 + 1140 * k / 60; wv.push([x, sy + 3 * Math.sin(k * 0.6 + S.t * 1.5)]); }
          g.poly(wv, { color: PAL.lagoon, w: 2.5, alpha: 0.8 });
          // phytoplankton
          const tv = S.p(4, 1, 11.4);
          D.cells.forEach((cl, k) => {
            const x = 175 + ((cl.x - 175 + cl.vx * S.t) % 1090 + 1090) % 1090, y = cl.y + 10 * Math.sin(S.t * 0.5 + cl.ph);
            const inside = y < 846 && (x > 200 + (y - 340) * 0.08 && x < 1240 - (y - 340) * 0.08);
            if (!inside) return;
            const turn = 1 - tv * 0.75 * (0.5 + 0.5 * Math.sin(S.t * 0.9 + cl.era * 6.28));
            phyto(g, cl.type, x, y, cl.s, cl.col, 0.35 + 0.65 * clamp((S.since(4) - 4.6 - (k % 32) * 0.05) / 0.6) * turn, cl.rot + S.t * cl.spin);
          });
          // zooplankton grazers
          const za = S.p(4, 0.8, 12.4);
          for (let k = 0; k < 4; k++) { const x = 300 + k * 260 + 40 * Math.sin(S.t * 0.5 + k), y = 470 + 160 * ((k * 37) % 3) / 2 + 16 * Math.sin(S.t * 1.3 + k); daphnia(g, x, y, 15, ENEMY, za, 0.3 * Math.sin(S.t + k)); }
          // the few resources
          const rp = S.p(4, 0.8, 7.4);
          const tok = (s, x, y) => { g.circle(x, y, 26, { fill: 'rgba(11,22,24,0.85)', stroke: RES, w: 2.4, alpha: rp }); g.text(s, x, y + 9, { size: 26, weight: 600, color: RES, align: 'center', alpha: rp }); };
          tok('N', 520, 660); tok('P', 900, 720);
          g.glow(1010, 300, 70, RES, 0.6 * rp); g.circle(1010, 300, 16, { fill: RES, alpha: rp });
          g.text('light', 984, 307, { size: 21, color: RES, align: 'right', alpha: rp });
          // counters
          g.text('dozens of species', 150, 318, { size: 30, role: 'display', color: PAL.mint, alpha: S.p(4, 0.8, 4.8) });
          g.text('a handful of resources', 1290, 318, { size: 30, role: 'display', color: RES, align: 'right', alpha: S.p(4, 0.8, 7.6) });
          // explanations
          const ex = [['variation in time', 11.6, PAL.sand], ['natural enemies', 12.5, ENEMY], ['hidden spatial structure', 13.8, PAL.lagoon]];
          let xx = 200; ex.forEach(([s, d, col]) => { const w = g.pill(s, xx, 812, { color: col, size: 22, fill: 'rgba(11,22,24,0.85)', stroke: col, alpha: S.p(4, 0.6, d) }); xx += w + 24; });
          g.text('…so exclusion is never reached', 1250, 820, { size: 24, role: 'display', italic: true, color: PAL.ink, align: 'right', alpha: S.p(4, 0.8, 16.4) });
        });
      },
    },
  ],
});
})();
