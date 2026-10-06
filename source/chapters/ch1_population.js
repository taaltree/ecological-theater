/* Chapter I — Population dynamics. Reference implementation for other chapters. */
(function () {
const { PAL, U, Theater } = window; const { clamp, lerp, ease, rng, gauss } = U;
const COL = PAL.moss;

// Small shared helpers ---------------------------------------------------------
const label = (g, s, x, y, a = 1, col = PAL.ink3) => g.text(s.toUpperCase(), x, y, { size: 17, weight: 600, color: col, ls: 2.6, alpha: a });
// visibility envelope: fade in at beat k0, fade out at beat k1 (optional)
const vis = (S, k0, k1, d = 0.8) => S.p(k0, d) * (k1 === undefined ? 1 : 1 - S.p(k1, 0.6));

Theater.chapter({
  id: 'pop', roman: 'I', title: 'Population Dynamics', color: COL,
  question: 'How, and why, do populations change in size?',
  intro: { t: 'Chapter one. Population dynamics: the rules by which numbers change through time.' },
  motif(g, t) {
    const A = { X: (v) => 1080 + v * 70, Y: (v) => 300 - v * 1.6 };
    const p = ease.inOut((t - 0.6) / 3);
    g.plot(A, (x) => 100 / (1 + 40 * Math.exp(-0.9 * x)), { from: 0, to: 11, color: COL, w: 2.5, alpha: 0.35, progress: p });
  },
  scenes: [
    /* ------------------------------------------------------------------ 1 */
    {
      id: 'pop-exp', title: 'Exponential & geometric growth',
      beats: [
        { t: 'Begin with a single population and no limits. If each individual has a constant per-capita birth rate, b, and death rate, d, the population grows as dN/dt = rN, where r = b − d is the intrinsic rate of increase.',
          s: 'Begin with a single population and no limits. If each individual has a constant per-capita birth rate, b, and death rate, d, the population grows as d N d t equals r N, where r, equal to b minus d, is the intrinsic rate of increase.' },
        { t: 'The result is exponential growth: a J-shaped curve in which the population doubles every ln 2 / r time units, no matter how large it already is.',
          s: 'The result is exponential growth: a J-shaped curve in which the population doubles every natural log of two over r time units, no matter how large it already is.' },
        { t: 'Species that breed in discrete pulses follow the geometric model, N(t+1) = λN(t). Lambda, the finite rate of increase, equals e^r. When λ > 1 the population grows, when λ < 1 it declines, and when λ = 1 it simply replaces itself.',
          s: 'Species that breed in discrete pulses follow the geometric model, N at t plus one equals lambda times N at t. Lambda, the finite rate of increase, equals e to the r. When lambda is greater than one the population grows, when lambda is less than one it declines, and when lambda equals one it simply replaces itself.' },
        { t: 'Both models are density-independent: per-capita rates do not change with crowding. No population sustains this for long, but it is the baseline every other model modifies, and it describes invasions and recoveries surprisingly well in their early phases.' },
      ],
      terms: [
        { beat: 0.55, term: 'Intrinsic rate of increase (r)', def: 'Instantaneous per-capita growth rate, b − d, under ideal conditions; units of 1/time.' },
        { beat: 2.3, term: 'Finite rate of increase (λ)', def: 'Ratio of population sizes in successive time steps, N(t+1)/N(t); λ = e^r.' },
        { beat: 3, term: 'Density independence', def: 'Per-capita birth and death rates that do not change with population density.' },
      ],
      init() {
        const n = 256, pos = [];
        for (let i = 0; i < n; i++) { const rr = 200 * Math.sqrt((i + 0.5) / n), th = i * 2.39996; pos.push([380 + rr * Math.cos(th), 590 + rr * Math.sin(th)]); }
        return { pos };
      },
      draw(g, t, S, D) {
        const tau = 8 * ease.inOut(S.span(0.15, 1.9)); // doublings elapsed
        const N = Math.pow(2, tau);
        // ---- left panel A: dividing culture (beats 0–1)
        const aA = vis(S, 0, 2);
        g.withAlpha(aA, () => {
          label(g, 'A growing culture', 140, 260);
          g.circle(380, 590, 228, { stroke: PAL.rule, w: 2 }); g.circle(380, 590, 238, { stroke: PAL.faint, w: 6 });
          for (let i = 0; i < D.pos.length; i++) {
            const born = Math.log2(i + 1); if (tau < born) break;
            const age = tau - born; const m = ease.out(age / 0.45);
            const par = i ? i - Math.pow(2, Math.floor(Math.log2(i))) : 0;
            const [px, py] = D.pos[par], [qx, qy] = D.pos[i];
            g.dot(lerp(px, qx, m), lerp(py, qy, m), 7, COL, 0.55 + 0.45 * m, 2.2);
          }
          g.text('N = ' + Math.floor(N), 380, 880, { size: 30, role: 'mono', color: PAL.ink, align: 'center' });
        });
        // ---- right panel: J-curve
        const A = g.axes({ x: 730, y: 310, w: 540, h: 540, xmax: 8, ymax: 260, progress: S.p(0, 1.2, 0.3), xlab: 't', ylab: 'N' });
        g.math('\\frac{dN}{dt} = rN', 760, 268, { size: 46, alpha: S.p(0, 1, 2.0) });
        g.math('r = b − d', 1000, 262, { size: 34, color: PAL.ink2, alpha: S.p(0, 1, 6.0) });
        const tip = g.plot(A, (x) => Math.pow(2, x), { from: 0, to: Math.max(0.001, tau), color: COL, w: 4 });
        if (tip && S.at(0.2)) g.dot(tip[0], tip[1], 7, COL, 1, 3.4);
        // beat 1: doubling-time guides
        const b1 = vis(S, 1, 2);
        g.withAlpha(b1, () => {
          for (let k = 5; k <= 8; k++) {
            const pk = S.p(1, 0.6, 1.0 + (k - 5) * 0.5);
            g.line(A.X(0), A.Y(2 ** k), A.X(k), A.Y(2 ** k), { color: PAL.ink3, w: 1.5, dash: [5, 7], alpha: pk });
            g.line(A.X(k), A.Y(2 ** k), A.X(k), A.Y(0), { color: PAL.ink3, w: 1.5, dash: [5, 7], alpha: pk });
            g.text(String(2 ** k), A.X(0) - 12, A.Y(2 ** k) + 6, { size: 18, role: 'mono', color: PAL.ink3, align: 'right', alpha: pk });
            if (k > 5) { g.arrow(A.X(k - 1) + 4, A.Y(0) - 22, A.X(k) - 4, A.Y(0) - 22, { color: PAL.ochre, w: 2, head: 10, both: true, alpha: pk }); g.math('t_d', (A.X(k - 1) + A.X(k)) / 2, A.Y(0) - 34, { size: 24, color: PAL.ochre, align: 'center', alpha: pk }); }
          }
          g.math('t_d = \\frac{\\ln 2}{r}', 790, 420, { size: 50, color: PAL.ochre, alpha: S.p(1, 1, 2.2) });
          g.math('N(t) = N_0 e^{rt}', 790, 510, { size: 40, color: PAL.ink, alpha: S.p(1, 1, 0.4) });
        });
        // ---- left panel B: geometric growth (beat 2)
        const aB = vis(S, 2, 3);
        g.withAlpha(aB, () => {
          label(g, 'Discrete generations', 140, 260);
          g.math('N_{t+1} = λN_t', 150, 330, { size: 44 });
          g.math('λ = e^{r}', 430, 330, { size: 38, color: PAL.ink2 });
          const B = g.axes({ x: 170, y: 390, w: 440, h: 450, xmax: 10.5, ymax: 70, xlab: 't', ylab: 'N', progress: S.p(2, 1) });
          const series = [[1.2, COL, 'λ = 1.2'], [1.0, PAL.ink2, 'λ = 1'], [0.8, PAL.coral, 'λ = 0.8']];
          const gp = S.lin(2, 7, 0.6) * 10;
          series.forEach(([lam, col, lab]) => {
            let prev = null;
            for (let k = 0; k <= Math.floor(gp); k++) {
              const n = 10 * Math.pow(lam, k); const x = B.X(k), y = B.Y(n);
              if (prev) { g.line(prev[0], prev[1], x, prev[1], { color: col, w: 2, alpha: 0.5 }); g.line(x, prev[1], x, y, { color: col, w: 2, alpha: 0.5 }); }
              g.dot(x, y, 5, col, 1, 2); prev = [x, y];
            }
            if (gp >= 10) g.math(lab, B.X(10) + 18, B.Y(10 * Math.pow(lam, 10)) + 8, { size: 26, color: col, alpha: S.p(2, 0.6, 7.8) });
          });
        });
        // ---- left panel C: density independence (beat 3)
        const aC = S.p(3, 0.8);
        g.withAlpha(aC, () => {
          label(g, 'Per-capita growth vs. density', 140, 260);
          const C = g.axes({ x: 170, y: 340, w: 440, h: 500, xmax: 100, ymax: 1.2, xlab: 'N', progress: S.p(3, 1) });
          g.math('\\frac{1}{N}\\frac{dN}{dt}', 190, 316, { size: 30, color: PAL.ink });
          g.plot(C, () => 0.8, { color: COL, w: 4, progress: S.p(3, 1.2, 0.8) });
          g.text('constant r: density-independent', C.X(50), C.Y(0.8) - 20, { size: 23, color: COL, align: 'center', alpha: S.p(3, 0.8, 1.6) });
          g.plot(C, (x) => 0.8 * (1 - x / 85), { from: 0, to: 85, color: PAL.ink3, w: 2.5, dash: [8, 8], progress: S.p(3, 1.4, 6) });
          g.text('density-dependent (next)', C.X(70), C.Y(0.22) + 4, { size: 21, color: PAL.ink3, align: 'center', alpha: S.p(3, 0.8, 7) });
        });
      },
    },
    /* ------------------------------------------------------------------ 2 */
    {
      id: 'pop-logistic', title: 'Logistic growth & density dependence',
      beats: [
        { t: 'No population grows forever. As density rises, resources dwindle and per-capita growth declines: density dependence. Its simplest form is the logistic model, dN/dt = rN(1 − N/K).',
          s: 'No population grows forever. As density rises, resources dwindle and per-capita growth declines: density dependence. Its simplest form is the logistic model: d N d t equals r N times one minus N over K.' },
        { t: 'K is the carrying capacity, the density at which births balance deaths. Population growth is fastest at K/2, the inflection point of the S-shaped curve, which is why classic fisheries models place maximum sustainable yield there.',
          s: 'K is the carrying capacity, the density at which births balance deaths. Population growth is fastest at K over two, the inflection point of the S-shaped curve, which is why classic fisheries models place maximum sustainable yield there.' },
        { t: 'Density dependence can act on births, deaths, or both. It is compensatory when recruitment levels off at high density, as in the Beverton–Holt model, and overcompensatory when recruitment actually falls at high density, as in the Ricker model, which can produce boom-and-bust dynamics.',
          s: 'Density dependence can act on births, deaths, or both. It is compensatory when recruitment levels off at high density, as in the Beverton Holt model, and overcompensatory when recruitment actually falls at high density, as in the Ricker model, which can produce boom and bust dynamics.' },
        { t: 'At very low density the relationship can reverse. Under an Allee effect, per-capita growth increases with density, because mates are hard to find or group defenses fail. A strong Allee effect creates a critical threshold below which the population declines toward extinction.' },
      ],
      terms: [
        { beat: 0.4, term: 'Density dependence', def: 'Per-capita birth or death rates that change with population density; the basis of population regulation.' },
        { beat: 1, term: 'Carrying capacity (K)', def: 'Equilibrium density at which per-capita births equal deaths.' },
        { beat: 1.6, term: 'Maximum sustainable yield', def: 'Largest harvest a population can sustain indefinitely; at N = K/2 in the logistic model.' },
        { beat: 2.2, term: 'Compensation & overcompensation', def: 'Recruitment that saturates (Beverton–Holt) versus recruitment that declines at high density (Ricker).' },
        { beat: 3.3, term: 'Allee effect', def: 'Positive density dependence at low density; a strong Allee effect produces an extinction threshold.' },
      ],
      draw(g, t, S) {
        const K = 100, r = 0.9;
        const logi = (n0) => (x) => K / (1 + ((K - n0) / n0) * Math.exp(-r * x));
        // ---- Panel A: N(t) curves (beats 0–2), Allee (beat 3)
        const aA = vis(S, 0, 3);
        g.withAlpha(aA, () => {
          label(g, 'Population through time', 140, 262);
          const A = g.axes({ x: 170, y: 310, w: 460, h: 400, xmax: 12, ymax: 150, xlab: 't', ylab: 'N', progress: S.p(0, 1, 0.2) });
          g.line(A.X(0), A.Y(K), A.X(12), A.Y(K), { color: PAL.ink2, w: 1.6, dash: [8, 8], alpha: S.p(0, 1, 1) });
          g.math('K', A.X(12) + 10, A.Y(K) + 10, { size: 32, color: PAL.ink, alpha: S.p(0, 1, 1) });
          const pr = S.lin(0, 5, 2.0);
          g.plot(A, logi(3), { color: COL, w: 4, progress: pr });
          g.plot(A, logi(145), { color: PAL.lagoon, w: 3, progress: S.lin(0, 4, 5.5), alpha: 0.85 });
          const ip = S.p(1, 0.8, 2.6);
          const xi = Math.log((K - 3) / 3) / r;
          g.line(A.X(0), A.Y(K / 2), A.X(xi), A.Y(K / 2), { color: PAL.ochre, w: 1.5, dash: [5, 6], alpha: ip });
          g.dot(A.X(xi), A.Y(K / 2), 8, PAL.ochre, ip, 3);
          g.text('inflection at K/2', A.X(xi) + 18, A.Y(K / 2) + 30, { size: 22, color: PAL.ochre, alpha: ip });
        });
        // ---- Panel B1: per-capita growth vs N (beat 0)
        const b1 = vis(S, 0, 1);
        g.withAlpha(b1, () => {
          label(g, 'Per-capita growth', 800, 262);
          const B = g.axes({ x: 830, y: 310, w: 430, h: 400, xmax: 120, ymax: 1.1, xlab: 'N', progress: S.p(0, 1, 0.6) });
          g.math('\\frac{1}{N}\\frac{dN}{dt}', 850, 300, { size: 28 });
          g.plot(B, (n) => r * (1 - n / K), { from: 0, to: 110, color: COL, w: 4, progress: S.p(0, 1.6, 3.0) });
          g.math('r', B.X(0) - 14, B.Y(r) + 8, { size: 28, color: COL, align: 'right', alpha: S.p(0, 1, 3) });
          g.dot(B.X(K), B.Y(0), 6, PAL.ink, S.p(0, 1, 4.5));
          g.math('K', B.X(K), B.Y(0) + 40, { size: 28, align: 'center', alpha: S.p(0, 1, 4.5) });
        });
        // ---- Panel B2: dN/dt vs N, MSY (beat 1)
        const b2 = vis(S, 1, 2);
        g.withAlpha(b2, () => {
          label(g, 'Population growth rate', 800, 262);
          const B = g.axes({ x: 830, y: 310, w: 430, h: 400, xmax: 110, ymax: 26, xlab: 'N', progress: S.p(1, 1) });
          g.math('\\frac{dN}{dt}', 850, 300, { size: 28 });
          g.plot(B, (n) => r * n * (1 - n / K), { from: 0, to: 100, color: COL, w: 4, progress: S.p(1, 1.6, 0.6), fillTo: 0, fillColor: U.rgba(COL, 0.12) });
          const mp = S.p(1, 0.8, 4.5);
          g.line(B.X(50), B.Y(0), B.X(50), B.Y(22.5), { color: PAL.ochre, w: 1.5, dash: [5, 6], alpha: mp });
          g.dot(B.X(50), B.Y(22.5), 8, PAL.ochre, mp, 3);
          g.text('MSY', B.X(50), B.Y(22.5) - 22, { size: 24, weight: 600, color: PAL.ochre, align: 'center', alpha: mp });
          g.math('K/2', B.X(50), B.Y(0) + 40, { size: 26, color: PAL.ochre, align: 'center', alpha: mp });
          g.math('K', B.X(100), B.Y(0) + 40, { size: 26, align: 'center', alpha: mp });
        });
        // ---- Panel B3: stock–recruitment (beat 2)
        const b3 = vis(S, 2, 3);
        g.withAlpha(b3, () => {
          label(g, 'Stock–recruitment', 800, 262);
          const B = g.axes({ x: 840, y: 310, w: 420, h: 400, xmax: 1.5, ymax: 1.3, xlab: 'stock', ylab: 'recruits', labSize: 22, progress: S.p(2, 1) });
          g.plot(B, (s) => s, { color: PAL.ink3, w: 2, dash: [6, 7], progress: S.p(2, 1, 0.5) });
          g.text('replacement', B.X(1.18), B.Y(1.18) + 30, { size: 19, color: PAL.ink3, alpha: S.p(2, 1, 1) });
          g.plot(B, (s) => 4 * s / (1 + 4 * s), { color: PAL.lagoon, w: 4, progress: S.p(2, 1.4, 4.0) });
          g.text('Beverton–Holt', B.X(1.5), B.Y(0.86) - 14, { size: 22, color: PAL.lagoon, align: 'right', alpha: S.p(2, 1, 5) });
          g.plot(B, (s) => 5 * s * Math.exp(-1.6 * s), { color: PAL.coral, w: 4, progress: S.p(2, 1.4, 9.5) });
          g.text('Ricker', B.X(0.62), B.Y(1.15) - 16, { size: 22, color: PAL.coral, align: 'center', alpha: S.p(2, 1, 10.5) });
        });
        // ---- Panel B4: Allee effect, spans full width (beat 3)
        const b4 = S.p(3, 0.9);
        g.withAlpha(b4, () => {
          label(g, 'Strong Allee effect', 150, 262);
          const Aa = 22;
          const f = (n) => 1.2 * (1 - n / K) * (n / Aa - 1) / 3.2;
          const X = (n) => 190 + n / 125 * 1040, Y = (v) => 560 - v * 400;
          const B = { X, Y, xmin: 0, xmax: 125, ymin: -0.45, ymax: 0.62 };
          const ax = S.p(3, 1);
          g.arrow(X(0), Y(-0.45), X(0), Y(0.62) - 10, { color: PAL.ink2, w: 2.2, head: 13, progress: ax });
          g.arrow(X(0), Y(0), X(125) + 16, Y(0), { color: PAL.ink2, w: 2.2, head: 13, progress: ax });
          g.math('\\frac{1}{N}\\frac{dN}{dt}', 210, 318, { size: 30 });
          g.math('N', X(125) + 20, Y(0) + 34, { size: 34 });
          g.text('+', X(0) - 22, Y(0.3), { size: 28, color: PAL.ink3, align: 'center' });
          g.text('−', X(0) - 22, Y(-0.28), { size: 28, color: PAL.ink3, align: 'center' });
          g.plot(B, f, { from: 0, to: 120, color: COL, w: 4.5, progress: S.p(3, 1.8, 0.8), fillTo: 0, fillColor: U.rgba(COL, 0.1) });
          const pa = S.p(3, 0.8, 4.0);
          const arrow = (x1, x2, a) => g.arrow(X(x1), Y(0) + 34, X(x2), Y(0) + 34, { color: PAL.ink, w: 2.5, head: 13, alpha: a });
          arrow(17, 3, pa); arrow(30, 88, pa); arrow(123, 106, pa);
          g.circle(X(Aa), Y(0), 10, { fill: PAL.bg, stroke: PAL.coral, w: 3, alpha: pa });
          g.dot(X(K), Y(0), 10, COL, pa, 2.5);
          g.text('Allee threshold A', X(Aa), Y(0) - 48, { size: 24, color: PAL.coral, align: 'center', alpha: pa });
          g.text('unstable', X(Aa), Y(0) - 22, { size: 19, color: PAL.ink3, align: 'center', alpha: pa });
          g.text('carrying capacity K', X(K), Y(0) - 48, { size: 24, color: COL, align: 'center', alpha: pa });
          g.text('stable', X(K), Y(0) - 22, { size: 19, color: PAL.ink3, align: 'center', alpha: pa });
          g.text('toward extinction', X(10), Y(0) + 72, { size: 21, color: PAL.ink3, align: 'center', alpha: pa });
          g.text('mate limitation  ·  failed group defense  ·  reduced cooperative feeding', 710, 860, { size: 23, color: PAL.ink2, align: 'center', alpha: S.p(3, 1, 6) });
        });
        // ---- equation row
        g.math('\\frac{dN}{dt} = rN(1 − \\frac{N}{K})', 705, 840, { size: 56, align: 'center', alpha: S.p(0, 1, 9.0) * (1 - S.p(3, 0.6)) });
      },
    },
    /* ------------------------------------------------------------------ 3 */
    {
      id: 'pop-chaos', title: 'Time lags, cycles & chaos',
      beats: [
        { t: 'Density dependence rarely acts instantly. If growth responds to density at some time τ in the past, a population can overshoot its carrying capacity.',
          s: 'Density dependence rarely acts instantly. If growth responds to density at some time, tau, in the past, a population can overshoot its carrying capacity.' },
        { t: 'In Hutchinson’s lagged logistic, small values of rτ give a smooth approach to K. Intermediate values give damped oscillations. When rτ exceeds π/2, about 1.57, the population settles into a stable limit cycle and oscillates indefinitely.',
          s: 'In Hutchinson’s lagged logistic, small values of r tau give a smooth approach to K. Intermediate values give damped oscillations. When r tau exceeds pi over two, about one point five seven, the population settles into a stable limit cycle and oscillates indefinitely.' },
        { t: 'Populations with discrete generations can do stranger things still. In the logistic map, studied by Robert May in 1976, raising the growth rate drives the population from a stable point, through a cascade of period-doubling bifurcations, into deterministic chaos.', pause: 1.5 },
        { t: 'Chaos means erratic, aperiodic fluctuations generated by a simple deterministic rule, with extreme sensitivity to initial conditions. May’s lesson: complex dynamics in nature need not have complex causes.', pause: 1.0 },
      ],
      terms: [
        { beat: 0.3, term: 'Time lag', def: 'Delay between a change in density and the resulting change in per-capita growth.' },
        { beat: 1.55, term: 'Limit cycle', def: 'A self-sustaining oscillation of fixed amplitude that trajectories approach from any start.' },
        { beat: 2.45, term: 'Period-doubling bifurcation', def: 'Abrupt doubling of a cycle’s period as a parameter increases: 1 → 2 → 4 → … → chaos.' },
        { beat: 3, term: 'Deterministic chaos', def: 'Bounded, aperiodic dynamics from a deterministic rule, with sensitive dependence on initial conditions.' },
      ],
      init() {
        // Hutchinson delayed logistic, tau = 1, K = 100
        const sim = (r) => {
          const dt = 0.01, lag = 100, out = []; const N = new Array(lag + 1).fill(8);
          let n = 8; for (let k = 0; k <= 3000; k++) { const nl = N[N.length - 1 - lag]; n += dt * r * n * (1 - nl / 100); N.push(n); if (k % 10 === 0) out.push([k * dt, n]); }
          return out;
        };
        const runs = [sim(0.3), sim(1.0), sim(1.75)];
        const ymax = Math.max(...runs.flat().map((p) => p[1])) * 1.05;
        // Bifurcation diagram pre-rendered
        const bw = 720, bh = 570; const img = Theater.makeCanvas(bw, bh); const c = img.getContext('2d');
        for (let col = 0; col < bw; col++) {
          const rr = 2.5 + 1.5 * col / (bw - 1); let x = 0.4;
          for (let k = 0; k < 600; k++) x = rr * x * (1 - x);
          const hue = rr < 3 ? PAL.moss : rr < 3.57 ? PAL.ochre : PAL.coral;
          c.fillStyle = U.rgba(hue, 0.42);
          for (let k = 0; k < 220; k++) { x = rr * x * (1 - x); c.fillRect(col, bh - x * bh, 1.25, 1.25); }
        }
        return { runs, ymax, img };
      },
      draw(g, t, S, D) {
        // ---- view 1: delayed logistic (beats 0–1)
        const v1 = vis(S, 0, 2, 1);
        g.withAlpha(v1, () => {
          label(g, 'Delayed density dependence', 140, 262);
          const A = g.axes({ x: 170, y: 300, w: 1070, h: 390, xmax: 30, ymax: D.ymax, xlab: 't', ylab: 'N', progress: S.p(0, 1) });
          g.line(A.X(0), A.Y(100), A.X(30), A.Y(100), { color: PAL.ink2, w: 1.5, dash: [8, 8] });
          g.math('K', A.X(30) + 10, A.Y(100) + 10, { size: 30 });
          const cols = [COL, PAL.ochre, PAL.coral], labs = ['rτ = 0.3   smooth approach', 'rτ = 1.0   damped oscillation', 'rτ = 1.75  limit cycle'];
          D.runs.forEach((run, k) => {
            const pr = k === 1 ? S.lin(0, 6, 1.5) : S.lin(1, 5, k === 0 ? 1.2 : 9.0);
            g.data(A, run, { color: cols[k], w: k === 1 ? 4 : 3.2, progress: pr });
            g.text(labs[k], 820, 770 + k * 42, { size: 24, role: 'mono', color: cols[k], alpha: k === 1 ? S.p(0, 1, 3) : S.p(1, 1, k === 0 ? 1.5 : 9.5) });
          });
          // the lag bracket travelling along the damped curve
          const bp = vis(S, 0, 1);
          if (bp > 0) {
            const run = D.runs[1]; const tt = 3 + 6 * S.lin(0, 6, 1.5); const i = Math.min(run.length - 1, Math.round(tt * 10)), j = Math.max(0, i - 10);
            const x1 = A.X(run[j][0]), x2 = A.X(run[i][0]); const yb = A.Y(0) - 34;
            g.withAlpha(bp, () => {
              g.dot(x2, A.Y(run[i][1]), 7, PAL.ochre, 1);
              g.circle(x1, A.Y(run[j][1]), 7, { stroke: PAL.ink, w: 2 });
              g.line(x1, A.Y(run[j][1]), x1, yb, { color: PAL.ink3, w: 1.2, dash: [3, 5] });
              g.line(x2, A.Y(run[i][1]), x2, yb, { color: PAL.ink3, w: 1.2, dash: [3, 5] });
              g.arrow(x2, yb, x1, yb, { color: PAL.ink, w: 2, head: 10 });
              g.math('τ', (x1 + x2) / 2, yb - 10, { size: 28, align: 'center' });
            });
          }
          g.math('\\frac{dN}{dt} = rN(t)(1 − \\frac{N(t − τ)}{K})', 170, 800, { size: 48, alpha: S.p(0, 1, 2.5) });
          g.math('rτ > π/2 ≈ 1.57', 170, 880, { size: 34, color: PAL.coral, alpha: S.p(1, 1, 9.5) });
        });
        // ---- view 2: logistic map bifurcation (beats 2–3)
        const v2 = S.p(2, 1);
        g.withAlpha(v2, () => {
          label(g, 'The logistic map', 140, 262);
          const bx = 170, by = 290, bw = 720, bh = 570;
          const scan = S.at(3) ? lerp(4.0, 3.9, S.p(3, 1.5)) : 2.5 + 1.5 * clamp(S.span(2.15, 3) * 1.05);
          const reveal = clamp((scan - 2.5) / 1.5);
          g.clip(bx, by, bw * reveal + 1, bh, () => g.ctx.drawImage(D.img, bx, by));
          const A = g.axes({ x: bx, y: by, w: bw, h: bh, xmin: 2.5, xmax: 4, ymax: 1, xlab: 'r', ylab: 'x', progress: S.p(2, 1), xticks: [{ v: 2.5, l: '2.5' }, { v: 3, l: '3' }, { v: 3.449, l: '' }, { v: 3.57, l: '3.57' }, { v: 4, l: '4' }] });
          const sx = A.X(scan);
          g.line(sx, by, sx, by + bh, { color: PAL.ink, w: 1.5, alpha: 0.7 });
          const ann = (r0, txt, y, d) => g.text(txt, A.X(r0), y, { size: 20, color: PAL.ink2, align: 'center', alpha: S.p(2, 0.8, d) * (scan > r0 ? 1 : 0) });
          ann(2.75, 'stable point', by + 26, 2); ann(3.22, 'period 2', by + 26, 5); ann(3.5, '4', by + 26, 7); ann(3.78, 'chaos', by + 26, 8.5); ann(3.84, 'period-3 window', by + bh - 14, 10);
          // inset: time series at the scanner
          g.math('x_{t+1} = r\\,x_t(1 − x_t)', 940, 290, { size: 40 });
          const I = g.axes({ x: 960, y: 340, w: 300, h: 190, xmax: 40, ymax: 1, xlab: 't', ylab: '', progress: S.p(2, 1, 0.5), labSize: 22 });
          let x = 0.2; for (let k = 0; k < 300; k++) x = scan * x * (1 - x);
          const pts = []; for (let k = 0; k <= 40; k++) { pts.push([k, x]); x = scan * x * (1 - x); }
          g.data(I, pts, { color: scan < 3 ? COL : scan < 3.57 ? PAL.ochre : PAL.coral, w: 2.2 });
          pts.forEach(([k, v]) => g.circle(I.X(k), I.Y(v), 2.8, { fill: PAL.ink }));
          g.text('r = ' + scan.toFixed(2), 1260, 330, { size: 22, role: 'mono', color: PAL.ink2, align: 'right' });
          // beat 3: sensitivity to initial conditions
          const sp = S.p(3, 1, 0.8);
          g.withAlpha(sp, () => {
            const J = g.axes({ x: 960, y: 660, w: 300, h: 190, xmax: 40, ymax: 1, xlab: 't', labSize: 22 });
            const run = (x0) => { const o = []; let y = x0; for (let k = 0; k <= 40; k++) { o.push([k, y]); y = 3.9 * y * (1 - y); } return o; };
            const pr = S.lin(3, 5, 1.2);
            g.data(J, run(0.2), { color: PAL.lagoon, w: 2.2, progress: pr });
            g.data(J, run(0.2001), { color: PAL.coral, w: 2.2, progress: pr });
            g.text('x₀ = 0.2 vs 0.2001', 960, 632, { size: 21, role: 'mono', color: PAL.ink2 });
            g.text('sensitive dependence', 1260, 900, { size: 20, color: PAL.ink3, align: 'right' });
          });
        });
      },
    },
    /* ------------------------------------------------------------------ 4 */
    {
      id: 'pop-structure', title: 'Life tables & matrix models',
      beats: [
        { t: 'Real populations have structure. A life table tracks survivorship, lₓ, the proportion of a cohort alive at age x, and fecundity, mₓ, the offspring produced per individual at that age.',
          s: 'Real populations have structure. A life table tracks survivorship, l x, the proportion of a cohort alive at age x, and fecundity, m x, the offspring produced per individual at that age.' },
        { t: 'Survivorship curves come in three classic types. Type I: most individuals survive to old age, as in large mammals. Type II: a constant risk of death at every age, as in many birds. Type III: massive early mortality, as in oysters, most fish, and trees.',
          s: 'Survivorship curves come in three classic types. Type one: most individuals survive to old age, as in large mammals. Type two: a constant risk of death at every age, as in many birds. Type three: massive early mortality, as in oysters, most fish, and trees.' },
        { t: 'Summing lₓmₓ across ages gives R₀, the net reproductive rate: expected lifetime offspring per individual. When R₀ > 1, the population grows each generation.',
          s: 'Summing l x times m x across ages gives R nought, the net reproductive rate: expected lifetime offspring per individual. When R nought is greater than one, the population grows each generation.' },
        { t: 'Matrix models generalize the life table. In a Leslie matrix, organized by age, or a Lefkovitch matrix, organized by stage, the dominant eigenvalue is the asymptotic growth rate λ. The right eigenvector is the stable stage distribution, and the left eigenvector gives reproductive values.',
          s: 'Matrix models generalize the life table. In a Leslie matrix, organized by age, or a Lefkovich matrix, organized by stage, the dominant eigenvalue is the asymptotic growth rate, lambda. The right eigenvector is the stable stage distribution, and the left eigenvector gives reproductive values.' },
        { t: 'Sensitivity and elasticity analyses ask which vital rate most affects λ. For loggerhead sea turtles, Crouse and colleagues showed in 1987 that λ responds far more to the survival of large juveniles than to egg survival, shifting conservation from nesting beaches toward turtle excluder devices on shrimp trawls.',
          s: 'Sensitivity and elasticity analyses ask which vital rate most affects lambda. For loggerhead sea turtles, Crouse and colleagues showed in 1987 that lambda responds far more to the survival of large juveniles than to egg survival, shifting conservation from nesting beaches toward turtle excluder devices on shrimp trawls.', pause: 1 },
      ],
      terms: [
        { beat: 0.3, term: 'Survivorship (lₓ)', def: 'Proportion of a cohort surviving from birth to age x.' },
        { beat: 2.1, term: 'Net reproductive rate (R₀)', def: 'R₀ = Σ lₓmₓ: expected lifetime offspring per individual; growth per generation.' },
        { beat: 3.25, term: 'Leslie & Lefkovitch matrices', def: 'Projection matrices of age- or stage-specific survival and fecundity; dominant eigenvalue = λ.' },
        { beat: 3.6, term: 'Stable stage distribution', def: 'Constant proportions among stages approached under fixed vital rates (right eigenvector).' },
        { beat: 4.2, term: 'Elasticity', def: 'Proportional change in λ per proportional change in a vital rate; elasticities sum to 1.' },
      ],
      draw(g, t, S) {
        // ---- life table (beats 0–2)
        const vT = vis(S, 0, 3);
        const rows = [[0, 1000, '1.00', '0.0', '0.00'], [1, 400, '0.40', '1.0', '0.40'], [2, 200, '0.20', '2.5', '0.50'], [3, 100, '0.10', '3.0', '0.30'], [4, 40, '0.04', '2.0', '0.08'], [5, 0, '0.00', '—', '—']];
        const cx = [150, 250, 370, 480, 590];
        g.withAlpha(vT, () => {
          label(g, 'Cohort life table', 140, 262);
          ['x', 'n_x', 'l_x', 'm_x', 'l_x m_x'].forEach((h, k) => g.math(h, cx[k], 330, { size: 34, color: k === 4 ? PAL.ochre : PAL.ink }));
          g.line(140, 352, 680, 352, { color: PAL.rule, w: 1.5 });
          rows.forEach((rw, i) => {
            const p = S.p(0, 0.6, 1.5 + i * 0.5); const y = 410 + i * 60;
            rw.forEach((v, k) => g.text(String(v), cx[k] + (k === 0 ? 6 : 0), y, { size: 26, role: 'mono', color: k === 4 ? PAL.ochre : k === 2 ? COL : PAL.ink2, alpha: p * (k === 4 ? S.p(2, 0.8) * 0.7 + 0.3 : 1) }));
          });
          const hp = vis(S, 2, 3);
          g.rect(cx[4] - 14, 368, 104, 6 * 60 + 6, { stroke: PAL.ochre, w: 2, r: 6, alpha: hp });
          g.math('R_0 = \\sum l_x m_x = 1.28', 150, 815, { size: 44, color: PAL.ochre, alpha: S.p(2, 1, 1.0) });
          g.text('R₀ > 1: the population grows each generation', 150, 875, { size: 24, color: PAL.ink2, alpha: S.p(2, 1, 4.5) });
        });
        // ---- survivorship curves (beats 1–2)
        const vS = vis(S, 1, 3);
        g.withAlpha(vS, () => {
          label(g, 'Survivorship curves', 800, 262);
          const A = g.axes({ x: 840, y: 320, w: 420, h: 500, xmax: 1, ymin: 0.001, ymax: 1, logy: true, xlab: 'relative age', ylab: '', labSize: 22, progress: S.p(1, 1), yticks: [{ v: 1, l: '1' }, { v: 0.1, l: '0.1' }, { v: 0.01, l: '0.01' }, { v: 0.001, l: '0.001' }] });
          g.text('lₓ (log scale)', 820, 300, { size: 20, color: PAL.ink2, alpha: S.p(1, 1) });
          const types = [[(x) => Math.pow(10, -3 * Math.pow(x, 6)), PAL.lagoon, 'I', 'deer', 0.86], [(x) => Math.pow(10, -3 * x), COL, 'II', 'songbird', 0.5], [(x) => Math.pow(10, -3 * (1 - Math.pow(1 - x, 5))), PAL.coral, 'III', 'fish', 0.2]];
          types.forEach(([f, col, nm, ic, lx], k) => {
            const d = [1.6, 5.0, 8.2][k];
            g.plot(A, (x) => Math.max(0.001, f(x)), { from: 0, to: 0.999, color: col, w: 4, progress: S.p(1, 1.4, d) });
            const pk = S.p(1, 0.8, d + 0.6); const X = A.X(lx), Y = A.Y(Math.max(0.0012, f(lx)));
            g.text('Type ' + nm, X + 14, Y - 18 + (k === 2 ? 50 : 0), { size: 24, weight: 600, color: col, alpha: pk });
            g.icon(ic, X + 40 + (k === 2 ? 60 : 30), Y - 60 + (k === 2 ? 40 : 0), 46, col, { alpha: pk });
          });
        });
        // ---- life-cycle graph (beats 3–4)
        const vM = S.p(3, 0.9);
        const el = S.p(4, 1.2, 1.0); // elasticity weighting of arrows
        g.withAlpha(vM, () => {
          label(g, 'Stage-structured life cycle', 140, 262);
          const nodes = [[230, 470, 'J'], [430, 470, 'S'], [630, 470, 'A']];
          const wts = { P1: 0.12, G1: 0.2, P2: 0.36, G2: 0.18, P3: 0.1, F: 0.04 };
          const W = (k) => lerp(3, 3 + 36 * wts[k], el);
          const lab = (s, x, y) => g.math(s, x, y, { size: 30, color: PAL.ink, align: 'center' });
          g.arrow(nodes[0][0] + 50, 470, nodes[1][0] - 52, 470, { color: COL, w: W('G1'), head: 16 }); lab('G_1', 330, 452);
          g.arrow(nodes[1][0] + 50, 470, nodes[2][0] - 52, 470, { color: COL, w: W('G2'), head: 16 }); lab('G_2', 530, 452);
          [['P1', 0], ['P2', 1], ['P3', 2]].forEach(([k, i]) => { const [x, y] = nodes[i]; g.carrow(x - 26, y - 44, x + 26, y - 44, -0.95, { color: PAL.lagoon, w: W(k), head: 13 }); lab('P_' + (i + 1), x, y - 96); });
          g.carrow(nodes[2][0] - 20, 518, nodes[0][0] + 20, 518, -0.22, { color: PAL.ochre, w: W('F'), head: 16 }); lab('F', 430, 596);
          nodes.forEach(([x, y, s]) => { g.circle(x, y, 46, { fill: PAL.panel, stroke: PAL.ink2, w: 2 }); g.math(s, x, y + 12, { size: 38, align: 'center' }); });
          g.text('J juvenile · S subadult · A adult', 150, 690, { size: 21, color: PAL.ink3 });
          // matrix
          const mx = 170, my = 815; g.math('\\mathbf{n}(t+1) = ', mx, my + 10, { size: 36 });
          const M = [['P_1', '0', 'F'], ['G_1', 'P_2', '0'], ['0', 'G_2', 'P_3']];
          const ox = mx + 210; g.line(ox, my - 62, ox, my + 70, { color: PAL.ink, w: 2.5 }); g.line(ox, my - 62, ox + 10, my - 62, { color: PAL.ink, w: 2.5 }); g.line(ox, my + 70, ox + 10, my + 70, { color: PAL.ink, w: 2.5 });
          M.forEach((rw, i) => rw.forEach((v, j) => g.math(v, ox + 40 + j * 70, my - 32 + i * 46, { size: 30, color: v === '0' ? PAL.ink3 : PAL.ink, align: 'center' })));
          const ex = ox + 230; g.line(ex, my - 62, ex, my + 70, { color: PAL.ink, w: 2.5 }); g.line(ex - 10, my - 62, ex, my - 62, { color: PAL.ink, w: 2.5 }); g.line(ex - 10, my + 70, ex, my + 70, { color: PAL.ink, w: 2.5 });
          g.math('\\mathbf{n}(t)', ex + 18, my + 10, { size: 36 });
        });
        // eigen statements (beat 3) → elasticity bars (beat 4)
        const vE = vis(S, 3, 4);
        g.withAlpha(vE, () => {
          label(g, 'What the matrix tells you', 820, 262);
          const items = [['λ', 'dominant eigenvalue', 'asymptotic growth rate'], ['w', 'right eigenvector', 'stable stage distribution'], ['v', 'left eigenvector', 'reproductive values']];
          items.forEach(([sym, a, b], k) => {
            const p = S.p(3, 0.8, 4 + k * 3.2); const y = 400 + k * 160;
            g.math(sym, 840, y + 10, { size: 56, color: [COL, PAL.lagoon, PAL.ochre][k], alpha: p });
            g.text(a, 920, y - 6, { size: 26, color: PAL.ink, alpha: p });
            g.text('= ' + b, 920, y + 30, { size: 26, color: PAL.ink2, alpha: p });
          });
        });
        const vB = S.p(4, 0.9);
        g.withAlpha(vB, () => {
          label(g, 'Elasticity of λ · loggerhead turtle', 820, 262);
          g.icon('turtle', 1205, 330, 96, PAL.mint, {});
          const bars = [['fecundity', 0.04, PAL.ochre], ['egg & hatchling survival', 0.08, PAL.ink3], ['small juvenile survival', 0.2, PAL.lagoon], ['large juvenile survival', 0.42, COL], ['adult survival', 0.26, PAL.lagoon]];
          bars.forEach(([nm, v, col], k) => {
            const p = S.p(4, 1, 1.2 + k * 0.5); const y = 420 + k * 84;
            g.text(nm, 840, y, { size: 22, color: PAL.ink2, alpha: p });
            g.rect(840, y + 12, 420 * v / 0.42 * p, 22, { fill: col, r: 3, alpha: 0.9 });
          });
          g.text('illustrative values after Crouse, Crowder & Caswell (1987)', 840, 852, { size: 19, color: PAL.ink3, italic: true, alpha: S.p(4, 1, 3) });
          g.pill('turtle excluder devices', 840, 895, { color: PAL.mint, size: 22, alpha: S.p(4, 1, 9) });
        });
      },
    },
    /* ------------------------------------------------------------------ 5 */
    {
      id: 'pop-stoch', title: 'Stochasticity, viability & life history',
      beats: [
        { t: 'Finally, chance. Demographic stochasticity is randomness in the fates of individuals: who lives, who dies, who breeds. It matters most in small populations. Environmental stochasticity is year-to-year variation in vital rates that affects all individuals together, and catastrophes are its extreme form.' },
        { t: 'Under environmental variation, long-run growth follows the geometric mean of λ, not the arithmetic mean. Because the geometric mean is always lower, variability itself depresses growth: a population averaging λ = 1.05 can still decline.',
          s: 'Under environmental variation, long-run growth follows the geometric mean of lambda, not the arithmetic mean. Because the geometric mean is always lower, variability itself depresses growth: a population averaging a lambda of one point zero five can still decline.' },
        { t: 'Population viability analysis projects these processes forward to estimate extinction risk, often as the probability of falling below a quasi-extinction threshold. A minimum viable population is the smallest size with an acceptable chance of persistence; Shaffer’s classic benchmark was ninety-nine percent over a thousand years.' },
        { t: 'Small populations can spiral downward as inbreeding, lost genetic variation, Allee effects, and stochasticity reinforce one another. Gilpin and Soulé called this the extinction vortex in 1986.',
          s: 'Small populations can spiral downward as inbreeding, lost genetic variation, Allee effects, and stochasticity reinforce one another. Gilpin and Soolay called this the extinction vortex in 1986.' },
        { t: 'Life history ties it together. MacArthur and Wilson’s r- and K-selection contrasted fast, fecund species favored in uncrowded, unpredictable settings with slow, competitive species favored near carrying capacity. Today the fast–slow continuum and Grime’s C-S-R triangle of competitors, stress-tolerators, and ruderals refine that dichotomy.',
          s: 'Life history ties it together. MacArthur and Wilson’s r selection and K selection contrasted fast, fecund species favored in uncrowded, unpredictable settings with slow, competitive species favored near carrying capacity. Today the fast slow continuum and Grime’s C S R triangle of competitors, stress tolerators, and ruderals refine that dichotomy.', pause: 1 },
      ],
      terms: [
        { beat: 0.25, term: 'Demographic stochasticity', def: 'Chance variation in individual births and deaths; strongest in small populations.' },
        { beat: 0.62, term: 'Environmental stochasticity', def: 'Temporal variation in vital rates that affects all individuals together; catastrophes are extreme cases.' },
        { beat: 1.3, term: 'Geometric mean growth', def: 'Long-run λ under variability; always ≤ the arithmetic mean, so variance reduces growth.' },
        { beat: 2.15, term: 'PVA & minimum viable population', def: 'Projection of extinction risk; MVP = smallest population with an acceptable persistence probability.' },
        { beat: 3.4, term: 'Extinction vortex', def: 'Mutually reinforcing genetic and demographic declines in small populations (Gilpin & Soulé 1986).' },
        { beat: 4.2, term: 'r- and K-selection', def: 'Life-history strategies favored at low density and high variability (r) versus near carrying capacity (K).' },
      ],
      init() {
        const r = rng(42);
        const demo = [], env = [];
        for (let k = 0; k < 22; k++) {
          let n = 7; const tr = [[0, n]]; let ext = -1;
          for (let y = 1; y <= 40; y++) {
            let nn = 0; for (let i = 0; i < n; i++) { if (r() < 0.78) nn++; if (r() < 0.24) nn++; }
            n = nn; tr.push([y, n]); if (n === 0 && ext < 0) { ext = y; break; }
          }
          demo.push({ tr, ext });
        }
        for (let k = 0; k < 22; k++) {
          let n = 60; const tr = [[0, n]];
          for (let y = 1; y <= 40; y++) { let lam = Math.exp(gauss(r) * 0.22); if (r() < 0.025) lam *= 0.3; n = Math.max(0.5, n * lam); tr.push([y, Math.min(n, 330)]); }
          env.push({ tr });
        }
        // PVA: cumulative quasi-extinction for several N0
        const pva = [15, 40, 120].map((n0) => {
          const hit = new Array(101).fill(0); const runs = 500;
          for (let k = 0; k < runs; k++) { let n = n0; for (let y = 1; y <= 100; y++) { n *= Math.exp(-0.006 + gauss(r) * 0.18); if (n < 10) { for (let z = y; z <= 100; z++) hit[z]++; break; } } }
          return hit.map((h, y) => [y, h / runs]);
        });
        return { demo, env, pva };
      },
      draw(g, t, S, D) {
        // ---- beat 0: demographic vs environmental fans
        const v0 = vis(S, 0, 1);
        g.withAlpha(v0, () => {
          label(g, 'Demographic stochasticity · N₀ = 7', 140, 262);
          const A = g.axes({ x: 170, y: 300, w: 460, h: 460, xmax: 40, ymax: 40, xlab: 't', ylab: 'N', progress: S.p(0, 1) });
          const pr = S.lin(0, 7, 0.8);
          D.demo.forEach((d) => {
            const last = d.tr[d.tr.length - 1][0]; const dead = d.ext > 0 && pr * 40 >= d.ext;
            g.data(A, d.tr, { color: dead ? PAL.ink3 : COL, w: 1.8, alpha: dead ? 0.5 : 0.8, progress: clamp(pr * 40 / last) });
            if (dead) g.text('×', A.X(d.ext), A.Y(0) + 6, { size: 22, color: PAL.coral, align: 'center' });
          });
          const nExt = D.demo.filter((d) => d.ext > 0 && pr * 40 >= d.ext).length;
          g.text(`${nExt} of ${D.demo.length} lineages extinct`, 170, 840, { size: 22, role: 'mono', color: PAL.coral });
          label(g, 'Environmental stochasticity · N₀ = 60', 800, 262);
          const B = g.axes({ x: 830, y: 300, w: 430, h: 460, xmax: 40, ymax: 330, xlab: 't', ylab: 'N', progress: S.p(0, 1, 9) });
          const pe = S.lin(0, 7, 10);
          D.env.forEach((d) => g.data(B, d.tr, { color: PAL.lagoon, w: 1.6, alpha: 0.7, progress: pe }));
          g.text('good and bad years hit everyone at once', 830, 840, { size: 22, color: PAL.ink2, alpha: S.p(0, 1, 13) });
        });
        // ---- beat 1: geometric vs arithmetic mean
        const v1 = vis(S, 1, 2);
        g.withAlpha(v1, () => {
          label(g, 'Alternating good and bad years', 140, 262);
          const lams = [1.5, 0.6, 1.5, 0.6, 1.5, 0.6, 1.5, 0.6, 1.5, 0.6];
          const A = g.axes({ x: 170, y: 300, w: 460, h: 430, xmin: 0, xmax: 10.5, ymax: 1.7, xlab: 'year', ylab: 'λ', labSize: 24, progress: S.p(1, 0.8) });
          lams.forEach((l, k) => { const p = S.p(1, 0.5, 0.6 + k * 0.25); g.rect(A.X(k + 0.2), A.Y(l), A.X(0.6) - A.X(0), (A.Y(0) - A.Y(l)) * 1, { fill: l > 1 ? COL : PAL.coral, alpha: 0.75 * p }); });
          const ap = S.p(1, 0.8, 4), gp = S.p(1, 0.8, 7);
          g.line(A.X(0), A.Y(1.05), A.X(10.5), A.Y(1.05), { color: PAL.ochre, w: 2.5, dash: [9, 7], alpha: ap });
          g.text('arithmetic mean 1.05', A.X(10.5), A.Y(1.05) - 12, { size: 21, color: PAL.ochre, align: 'right', alpha: ap });
          g.line(A.X(0), A.Y(0.949), A.X(10.5), A.Y(0.949), { color: PAL.ink, w: 2.5, alpha: gp });
          g.text('geometric mean 0.95', A.X(10.5), A.Y(0.949) + 28, { size: 21, color: PAL.ink, align: 'right', alpha: gp });
          label(g, 'The population still declines', 800, 262);
          const B = g.axes({ x: 830, y: 300, w: 430, h: 430, xmax: 10, ymax: 170, xlab: 'year', ylab: 'N', labSize: 24, progress: S.p(1, 0.8, 1) });
          const tr = [[0, 100]]; let n = 100; lams.forEach((l, k) => { n *= l; tr.push([k + 1, n]); });
          g.data(B, tr, { color: PAL.lagoon, w: 3.5, progress: S.lin(1, 5, 2) });
          g.plot(B, (x) => 100 * Math.pow(1.05, x), { color: PAL.ochre, w: 2, dash: [8, 7], progress: S.p(1, 1.2, 8), alpha: 0.8 });
          g.plot(B, (x) => 100 * Math.pow(0.949, x), { color: PAL.ink, w: 2, progress: S.p(1, 1.2, 9) });
          g.math('\\bar{λ}_G = (\\prod λ_t)^{1/T} < \\bar{λ}_A', 170, 860, { size: 42, alpha: S.p(1, 1, 10) });
        });
        // ---- beat 2: PVA
        const v2 = vis(S, 2, 3);
        g.withAlpha(v2, () => {
          label(g, 'Population viability analysis', 140, 262);
          const A = g.axes({ x: 180, y: 320, w: 740, h: 520, xmax: 100, ymax: 1, xlab: 'years', ylab: '', labSize: 22, progress: S.p(2, 1), yticks: [{ v: 0, l: '0' }, { v: 0.5, l: '0.5' }, { v: 1, l: '1' }], grid: true });
          g.text('P(N < 10 quasi-extinction)', 180, 300, { size: 21, color: PAL.ink2 });
          const cols = [PAL.coral, PAL.ochre, COL], labs = ['N₀ = 15', 'N₀ = 40', 'N₀ = 120'];
          D.pva.forEach((c, k) => { g.data(A, c, { color: cols[k], w: 3.5, progress: S.lin(2, 4, 1 + k * 1.2) }); g.text(labs[k], A.X(100) + 14, A.Y(c[100][1]) + 8, { size: 22, role: 'mono', color: cols[k], alpha: S.p(2, 0.8, 4 + k * 1.2) }); });
          g.text('Larger populations buy time,', 980, 420, { size: 26, role: 'display', italic: true, color: PAL.ink, alpha: S.p(2, 1, 9) });
          g.text('not immunity.', 980, 456, { size: 26, role: 'display', italic: true, color: PAL.ink, alpha: S.p(2, 1, 9) });
          g.text('MVP benchmark (Shaffer 1981):', 980, 560, { size: 21, color: PAL.ink2, alpha: S.p(2, 1, 13) });
          g.text('99% persistence, 1000 years', 980, 592, { size: 21, weight: 600, color: PAL.ochre, alpha: S.p(2, 1, 13) });
        });
        // ---- beat 3: extinction vortex
        const v3 = vis(S, 3, 4);
        g.withAlpha(v3, () => {
          const cx = 700, cy = 575; const rot = t * 0.35;
          const pts = []; for (let k = 0; k <= 300; k++) { const u = k / 300; const a = rot + u * Math.PI * 2 * 3.2; const r = 250 * (1 - u) + 14; pts.push([cx + r * 1.15 * Math.cos(a), cy + r * 0.82 * Math.sin(a)]); }
          const sp = S.p(3, 2.5, 0.3);
          g.poly(pts, { color: PAL.coral, w: 3, progress: sp, alpha: 0.85 });
          for (let k = 1; k < 10; k++) { const i = k * 30; if (sp * 300 > i + 2) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 2]; g.arrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1), 16, PAL.coral); } }
          g.dot(cx, cy, 9, PAL.coral, S.p(3, 1, 2), 3);
          const labs = [[['small population'], cx, 330, 'center'], [['inbreeding &', 'lost genetic diversity'], cx + 330, 560, 'left'], [['lower survival', '& fecundity'], cx, 830, 'center'], [['stochasticity &', 'Allee effects'], cx - 330, 560, 'right']];
          labs.forEach(([lines, x, y, al], k) => { const p = S.p(3, 0.8, 1.2 + k * 1.4); lines.forEach((ln, j) => g.text(ln, x, y + j * 32, { size: 26, color: PAL.ink, align: al, alpha: p })); });
          g.text('EXTINCTION VORTEX', 150, 262, { size: 17, weight: 600, color: PAL.ink3, ls: 2.6 });
        });
        // ---- beat 4: life-history continua
        const v4 = S.p(4, 0.9);
        g.withAlpha(v4, () => {
          label(g, 'r- and K-selection', 140, 262);
          const x0 = 160, x1 = 720, y = 390;
          const grd = g.ctx.createLinearGradient(x0, 0, x1, 0); grd.addColorStop(0, PAL.ochre); grd.addColorStop(1, PAL.lagoon);
          g.ctx.save(); g.ctx.globalAlpha *= S.p(4, 1, 0.5); g.ctx.fillStyle = grd; g.ctx.fillRect(x0, y, x1 - x0, 8); g.ctx.restore();
          g.text('r', x0, y - 22, { size: 40, role: 'math', italic: true, color: PAL.ochre }); g.text('K', x1, y - 22, { size: 40, role: 'math', italic: true, color: PAL.lagoon, align: 'right' });
          g.icon('bug', x0 + 30, y + 80, 52, PAL.ochre); g.icon('plant', x0 + 100, y + 80, 56, PAL.ochre);
          g.icon('deer', x1 - 110, y + 80, 62, PAL.lagoon); g.icon('conifer', x1 - 30, y + 76, 60, PAL.lagoon);
          const rL = ['small body, short life', 'many small offspring', 'little parental care', 'density-indep. mortality'], kL = ['large body, long life', 'few large offspring', 'extensive parental care', 'density-dep. mortality'];
          g.text('r-selected', x0, y + 168, { size: 22, weight: 600, color: PAL.ochre, alpha: S.p(4, 0.8, 3.5) });
          g.text('K-selected', x0 + 300, y + 168, { size: 22, weight: 600, color: PAL.lagoon, alpha: S.p(4, 0.8, 3.5) });
          rL.forEach((s, k) => g.text(s, x0, y + 210 + k * 36, { size: 21, color: PAL.ink2, alpha: S.p(4, 0.8, 4 + k * 0.4) }));
          kL.forEach((s, k) => g.text(s, x0 + 300, y + 210 + k * 36, { size: 21, color: PAL.ink2, alpha: S.p(4, 0.8, 4 + k * 0.4) }));
          // CSR triangle
          label(g, 'Grime’s C-S-R triangle', 820, 262);
          const p = S.p(4, 1.4, 12); const T = [[1050, 410], [840, 770], [1260, 770]];
          g.poly([...T, T[0]], { color: PAL.ink2, w: 2, progress: p });
          const vl = [['C', 'competitors', 'low stress · low disturbance', 0, -18, 'center'], ['S', 'stress-tolerators', 'high stress', -6, 48, 'center'], ['R', 'ruderals', 'high disturbance', 6, 48, 'center']];
          vl.forEach(([L, nm, d, dx, dy, al], k) => {
            const [x, y] = T[k]; const pk = S.p(4, 0.8, 13 + k * 1.2);
            g.text(L, x + dx, y + dy, { size: 40, role: 'display', italic: true, color: [PAL.coral, PAL.lagoon, PAL.ochre][k], align: al, alpha: pk });
            g.text(nm, x + dx, y + dy + (k ? 32 : -46), { size: 22, color: PAL.ink, align: al, alpha: pk });
            g.text(d, x + dx, y + dy + (k ? 58 : -74), { size: 19, color: PAL.ink3, align: al, alpha: pk });
          });
          const r2 = rng(5); for (let k = 0; k < 26; k++) { let a = r2(), b = r2(); if (a + b > 1) { a = 1 - a; b = 1 - b; } const x = T[0][0] + a * (T[1][0] - T[0][0]) + b * (T[2][0] - T[0][0]); const yy = T[0][1] + a * (T[1][1] - T[0][1]) + b * (T[2][1] - T[0][1]); g.dot(x, yy, 3.5, PAL.mint, p * 0.8, 2); }
        });
      },
    },
  ],
});
})();
