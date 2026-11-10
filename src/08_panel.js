/* ============================================================
   Instrument panel (2048 x 860 virtual pixels) rendered to a canvas texture.
   Analog six-pack and G1000-style glass variants share the switch row.
   ============================================================ */
(function () {
  const G = FS.G, A = FS.Airport;
  const P = FS.Panel = { hot: [], highlight: null, range: 1.5, type: 'analog', lastClick: null, scale: 1 };
  const W = 2048, H = 860;
  const FONT = '"B612","Barlow","Helvetica Neue",Arial,sans-serif';
  const INK = '#f1f0ea', AMB = '#ffb23c';
  const pol = (x, y, r, d) => [x + r * Math.sin(d * DEG), y - r * Math.cos(d * DEG)];
  const txt = (c, s, x, y, size, col, align, wt) => { c.fillStyle = col || INK; c.font = (wt || '700') + ' ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); };
  const tick = (c, x, y, r0, r1, d, w, col) => { const a = pol(x, y, r0, d), b = pol(x, y, r1, d); c.strokeStyle = col || INK; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
  const arc = (c, x, y, r, d0, d1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, (d0 - 90) * DEG, (d1 - 90) * DEG); c.stroke(); };
  const face = (c, x, y, r) => {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r * 1.1);
    g.addColorStop(0, '#5b5e62'); g.addColorStop(1, '#101112');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.08, 0, 7); c.fill();
    c.fillStyle = '#08090a'; c.beginPath(); c.arc(x, y, r * 0.98, 0, 7); c.fill();
  };
  const needle = (c, x, y, d, len, w, col, tail) => {
    c.save(); c.translate(x, y); c.rotate(d * DEG); c.fillStyle = col || '#fff';
    c.beginPath(); c.moveTo(-w / 2, tail || 0); c.lineTo(-w / 2, -len * 0.82); c.lineTo(0, -len); c.lineTo(w / 2, -len * 0.82); c.lineTo(w / 2, tail || 0); c.closePath(); c.fill(); c.restore();
  };
  const hub = (c, x, y, r) => { c.fillStyle = '#1b1c1e'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#44474a'; c.lineWidth = 1.5; c.stroke(); };
  const knobDraw = (c, x, y, r, ang, label) => {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); g.addColorStop(0, '#6a6d70'); g.addColorStop(1, '#17181a');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke();
    tick(c, x, y, r * 0.35, r * 0.95, ang || 0, 2.5, '#e9e9e4');
    if (label) txt(c, label, x, y + r + 9, 10, '#b9b9b2', 'center', '600');
  };

  /* ---------- navigation radio ---------- */
  FS.nav = (ac) => {
    const I = ac.inst, on = ac.elec.bus && ac.elec.avionics, out = { type: null, cdi: 0, gs: 0, gsOK: false, tf: 0, dme: null, ident: '', crs: I.obs };
    if (!on) return out;
    const p = ac.pos;
    if (Math.abs(I.nav1 - AD.ILS23) < 0.01) {
      const dx = p.x - AD.LOC[0], dz = p.z - AD.LOC[1], d = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx) / DEG;
      out.dme = Math.hypot(p.x - AD.GP[0], p.z - AD.GP[1]) / NM;
      if (dx > 0 && Math.abs(ang) < 35 && d < 46000) {
        out.type = 'ILS'; out.ident = 'ICMB'; out.crs = wrap360(AD.RWY_TRUE + 180 + AD.MAGVAR_W);
        out.cdi = clamp(ang / 2.5, -1.2, 1.2); out.tf = 1;
        const gx = AD.GP[0] - p.x, gh = p.y - (-AD.SLOPE * AD.GP[0]);
        if (gx < 0 && -gx < 19000) { const el = Math.atan2(gh, Math.hypot(gx, p.z - AD.GP[1])) / DEG; out.gs = clamp((el - 3) / 0.7, -1.2, 1.2); out.gsOK = true; }
      }
    } else if (Math.abs(I.nav1 - AD.VOR) < 0.01) {
      const dx = p.x - AD.DVOR[0], dz = p.z - AD.DVOR[1], d = Math.hypot(dx, dz);
      if (d < 75000) {
        out.type = 'VOR'; out.ident = 'CCB'; out.dme = Math.hypot(d, p.y) / NM;
        const radial = FS.toMag(FS.dirToHdg(dx, dz)), dF = angDiff(radial, I.obs);
        if (Math.abs(dF) <= 90) { out.tf = -1; out.cdi = clamp(-dF / 10, -1.2, 1.2); }
        else { out.tf = 1; out.cdi = clamp(angDiff(radial, I.obs + 180) / 10, -1.2, 1.2); }
        if (d < 150) out.tf = 0;
      }
    }
    return out;
  };

  /* ---------- analog gauges ---------- */
  const ASI_T = [[0, 0], [40, 32], [60, 75], [80, 122], [100, 168], [120, 210], [140, 250], [160, 285], [180, 315], [200, 340]];
  const asiA = (kt) => interp(ASI_T, clamp(kt, 0, 205));
  function asiS(c, x, y, r) {
    face(c, x, y, r);
    arc(c, x, y, r * 0.80, asiA(40), asiA(85), r * 0.06, '#f4f4f0');
    arc(c, x, y, r * 0.89, asiA(48), asiA(129), r * 0.085, '#27a54a');
    arc(c, x, y, r * 0.89, asiA(129), asiA(163), r * 0.085, '#e8c21a');
    for (let k = 40; k <= 200; k += 5) tick(c, x, y, r * (k % 10 ? 0.86 : 0.78), r * 0.95, asiA(k), k % 10 ? 1.5 : 2.6);
    tick(c, x, y, r * 0.74, r * 0.97, asiA(163), 4.5, '#e2271d');
    for (let k = 40; k <= 200; k += 20) { const p = pol(x, y, r * 0.6, asiA(k)); txt(c, String(k), p[0], p[1], r * 0.17); }
    txt(c, 'KNOTS', x, y - r * 0.28, r * 0.11, '#b9b9b2', 'center', '600'); txt(c, 'AIRSPEED', x, y + r * 0.32, r * 0.1, '#b9b9b2', 'center', '600');
  }
  function altS(c, x, y, r) {
    face(c, x, y, r);
    for (let i = 0; i < 50; i++) tick(c, x, y, r * (i % 5 ? 0.87 : 0.8), r * 0.95, i * 7.2, i % 5 ? 1.4 : 2.8);
    for (let i = 0; i < 10; i++) { const p = pol(x, y, r * 0.66, i * 36); txt(c, String(i), p[0], p[1], r * 0.21); }
    txt(c, 'ALT', x, y - r * 0.36, r * 0.11, '#b9b9b2', 'center', '600'); txt(c, '100 FT', x - r * 0.02, y + r * 0.42, r * 0.09, '#b9b9b2', 'center', '600');
  }
  function vsiS(c, x, y, r) {
    face(c, x, y, r);
    for (let v = -2000; v <= 2000; v += 100) tick(c, x, y, r * (v % 500 ? 0.87 : 0.79), r * 0.95, 270 + v * 0.09, v % 500 ? 1.4 : 2.8);
    for (const v of [500, 1000, 1500]) { let p = pol(x, y, r * 0.64, 270 + v * 0.09); txt(c, String(v / 100), p[0], p[1], r * 0.17); p = pol(x, y, r * 0.64, 270 - v * 0.09); txt(c, String(v / 100), p[0], p[1], r * 0.17); }
    txt(c, '0', x - r * 0.64, y, r * 0.17); txt(c, '20', x + r * 0.6, y, r * 0.17);
    txt(c, 'UP', x - r * 0.3, y - r * 0.24, r * 0.1, '#b9b9b2', 'center', '600'); txt(c, 'DN', x - r * 0.3, y + r * 0.24, r * 0.1, '#b9b9b2', 'center', '600');
    txt(c, 'VERTICAL SPEED', x + r * 0.12, y - r * 0.02, r * 0.08, '#b9b9b2', 'center', '600'); txt(c, '100 FT/MIN', x + r * 0.12, y + r * 0.1, r * 0.075, '#b9b9b2', 'center', '600');
  }
  const tachA = (rpm) => -130 + clamp(rpm, 0, 3500) / 3500 * 260;
  function tachS(c, x, y, r) {
    face(c, x, y, r);
    arc(c, x, y, r * 0.89, tachA(2100), tachA(2700), r * 0.08, '#27a54a');
    for (let k = 0; k <= 35; k++) tick(c, x, y, r * (k % 5 ? 0.86 : 0.78), r * 0.95, tachA(k * 100), k % 5 ? 1.4 : 2.6);
    tick(c, x, y, r * 0.74, r * 0.97, tachA(2700), 4.5, '#e2271d');
    for (let k = 5; k <= 35; k += 5) { const p = pol(x, y, r * 0.6, tachA(k * 100)); txt(c, String(k), p[0], p[1], r * 0.16); }
    txt(c, 'RPM', x, y - r * 0.3, r * 0.12, '#b9b9b2', 'center', '600'); txt(c, 'X 100', x, y - r * 0.17, r * 0.085, '#b9b9b2', 'center', '600');
  }
  function tcS(c, x, y, r) {
    face(c, x, y, r);
    for (const s of [-1, 1]) { tick(c, x, y, r * 0.72, r * 0.94, 90 * s, 5); tick(c, x, y, r * 0.72, r * 0.94, s * 110, 5); }
    txt(c, 'L', x - r * 0.62, y + r * 0.42, r * 0.15); txt(c, 'R', x + r * 0.62, y + r * 0.42, r * 0.15);
    txt(c, 'TURN COORDINATOR', x, y - r * 0.56, r * 0.085, '#b9b9b2', 'center', '600'); txt(c, '2 MIN', x, y + r * 0.82, r * 0.09, '#b9b9b2', 'center', '600');
  }
  function navS(c, x, y, r) {
    face(c, x, y, r);
    c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * 0.09, 0, 7); c.stroke();
    for (let i = 1; i <= 5; i++) for (const s of [-1, 1]) { c.fillStyle = INK; c.beginPath(); c.arc(x + s * i * r * 0.1, y, r * 0.018, 0, 7); c.fill(); c.beginPath(); c.arc(x, y + s * i * r * 0.1, r * 0.018, 0, 7); c.fill(); }
    txt(c, 'NAV 1', x, y + r * 0.62, r * 0.09, '#b9b9b2', 'center', '600');
  }
  function dualS(c, x, y, r, title, lL, lR, gL, gR) {
    face(c, x, y, r);
    for (let i = 0; i <= 4; i++) { tick(c, x, y, r * 0.78, r * 0.93, 215 + i * 27.5, 2); tick(c, x, y, r * 0.78, r * 0.93, 145 - i * 27.5, 2); }
    if (gL) arc(c, x, y, r * 0.86, 215 + gL[0] * 110, 215 + gL[1] * 110, r * 0.07, '#27a54a');
    if (gR) arc(c, x, y, r * 0.86, 145 - gR[1] * 110, 145 - gR[0] * 110, r * 0.07, '#27a54a');
    txt(c, title, x, y - r * 0.7, r * 0.17, '#d9d9d2', 'center', '700');
    txt(c, lL, x - r * 0.3, y + r * 0.66, r * 0.17, '#b9b9b2'); txt(c, lR, x + r * 0.3, y + r * 0.66, r * 0.17, '#b9b9b2');
  }
  const dualD = (c, x, y, r, vL, vR) => { needle(c, x, y, 215 + clamp(vL, -0.05, 1.05) * 110, r * 0.8, r * 0.07, '#fff', r * 0.1); needle(c, x, y, 145 - clamp(vR, -0.05, 1.05) * 110, r * 0.8, r * 0.07, '#fff', r * 0.1); hub(c, x, y, r * 0.13); };

  function aiD(c, x, y, r, pitch, bank, gyro, small) {
    const pd = pitch * gyro + (1 - gyro) * -9, bd = bank * gyro + (1 - gyro) * 24, k = r * 0.026;
    if (!small) face(c, x, y, r);
    c.save(); c.beginPath(); c.arc(x, y, r * 0.93, 0, 7); c.clip();
    c.translate(x, y); c.rotate(-bd * DEG); c.translate(0, pd * k);
    c.fillStyle = '#3f8bd6'; c.fillRect(-r * 2, -r * 3, r * 4, r * 3); c.fillStyle = '#7b5330'; c.fillRect(-r * 2, 0, r * 4, r * 3);
    c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-r * 2, 0); c.lineTo(r * 2, 0); c.stroke();
    c.lineWidth = 1.6;
    for (let p = -30; p <= 30; p += 5) { if (!p) continue; const w = p % 10 ? r * 0.1 : r * 0.24; c.beginPath(); c.moveTo(-w, -p * k); c.lineTo(w, -p * k); c.stroke(); if (!(p % 10) && !small) { txt(c, String(Math.abs(p)), -w - r * 0.11, -p * k, r * 0.1); } }
    c.restore();
    c.save(); c.translate(x, y); c.rotate(-bd * DEG);
    for (const b of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) tick(c, 0, 0, r * (Math.abs(b) % 30 ? 0.83 : 0.77), r * 0.92, b, Math.abs(b) % 30 ? 1.6 : 3, '#fff');
    c.restore();
    c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(x, y - r * 0.76); c.lineTo(x - r * 0.07, y - r * 0.62); c.lineTo(x + r * 0.07, y - r * 0.62); c.fill();
    c.strokeStyle = '#ff9a1f'; c.lineWidth = r * 0.045; c.beginPath(); c.moveTo(x - r * 0.52, y); c.lineTo(x - r * 0.2, y); c.lineTo(x - r * 0.2, y + r * 0.07); c.moveTo(x + r * 0.52, y); c.lineTo(x + r * 0.2, y); c.lineTo(x + r * 0.2, y + r * 0.07); c.stroke();
    c.fillStyle = '#ff9a1f'; c.beginPath(); c.arc(x, y, r * 0.035, 0, 7); c.fill();
    if (gyro < 0.6) { c.fillStyle = '#d6281e'; c.fillRect(x + r * 0.42, y - r * 0.8, r * 0.34, r * 0.2); txt(c, 'OFF', x + r * 0.59, y - r * 0.7, r * 0.12, '#fff'); }
  }
  function hiD(c, x, y, r, hdg, bug, gyro) {
    face(c, x, y, r);
    c.save(); c.translate(x, y); c.rotate(-hdg * DEG);
    const L = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
    for (let d = 0; d < 360; d += 5) tick(c, 0, 0, r * (d % 10 ? 0.87 : 0.8), r * 0.95, d, d % 10 ? 1.3 : 2.4);
    for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * 30 * DEG); txt(c, L[i], 0, -r * 0.65, r * (i % 3 ? 0.17 : 0.2)); c.restore(); }
    c.rotate(bug * DEG); c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(-r * 0.09, -r * 0.98); c.lineTo(-r * 0.09, -r * 0.88); c.lineTo(-r * 0.035, -r * 0.88); c.lineTo(0, -r * 0.81); c.lineTo(r * 0.035, -r * 0.88); c.lineTo(r * 0.09, -r * 0.88); c.lineTo(r * 0.09, -r * 0.98); c.fill();
    c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y - r * 0.34); c.lineTo(x, y + r * 0.34); c.moveTo(x - r * 0.3, y - r * 0.05); c.lineTo(x + r * 0.3, y - r * 0.05); c.moveTo(x - r * 0.12, y + r * 0.26); c.lineTo(x + r * 0.12, y + r * 0.26); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - r * 0.96); c.lineTo(x - r * 0.06, y - r * 1.06); c.lineTo(x + r * 0.06, y - r * 1.06); c.fill();
    if (gyro < 0.6) { c.fillStyle = '#d6281e'; c.fillRect(x + r * 0.3, y + r * 0.42, r * 0.34, r * 0.2); txt(c, 'OFF', x + r * 0.47, y + r * 0.52, r * 0.12, '#fff'); }
  }
  function altD(c, x, y, r, ft, koll, small) {
    if (!small) { c.fillStyle = '#000'; c.fillRect(x + r * 0.3, y - r * 0.1, r * 0.48, r * 0.2); c.strokeStyle = '#555'; c.lineWidth = 1; c.strokeRect(x + r * 0.3, y - r * 0.1, r * 0.48, r * 0.2); txt(c, String(Math.round(koll)), x + r * 0.54, y + 1, r * 0.15, INK); }
    const h = Math.max(0, ft);
    c.save(); c.translate(x, y); c.rotate(h / 100000 * 360 * DEG); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r * 0.86); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(-r * 0.06, -r * 0.94); c.lineTo(r * 0.06, -r * 0.94); c.fill(); c.restore();
    needle(c, x, y, (h % 10000) / 10000 * 360, r * 0.5, r * 0.11, '#fff', r * 0.1);
    needle(c, x, y, (h % 1000) / 1000 * 360, r * 0.86, r * 0.055, '#fff', r * 0.14);
    hub(c, x, y, r * 0.09);
  }
  function tcD(c, x, y, r, rate, ball, powered) {
    c.save(); c.translate(x, y); c.rotate(clamp(powered ? rate / 3 * 20 : 0, -42, 42) * DEG);
    c.fillStyle = '#f2f2ee'; c.fillRect(-r * 0.66, -r * 0.035, r * 1.32, r * 0.07); c.beginPath(); c.arc(0, 0, r * 0.11, 0, 7); c.fill(); c.fillRect(-r * 0.03, -r * 0.3, r * 0.06, r * 0.3); c.fillRect(-r * 0.2, -r * 0.12, r * 0.4, r * 0.04);
    c.restore();
    const by = y + r * 0.56;
    c.fillStyle = '#d8d6c8'; c.beginPath(); c.moveTo(x - r * 0.5, by - r * 0.1); c.quadraticCurveTo(x, by + r * 0.02, x + r * 0.5, by - r * 0.1); c.lineTo(x + r * 0.5, by + r * 0.08); c.quadraticCurveTo(x, by + r * 0.2, x - r * 0.5, by + r * 0.08); c.closePath(); c.fill();
    const bx = clamp(ball / 0.3, -1, 1) * r * 0.38;
    c.fillStyle = '#0c0c0d'; c.beginPath(); c.arc(x + bx, by + r * 0.05 - Math.abs(bx) / r * r * 0.14, r * 0.085, 0, 7); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * 0.1, by - r * 0.07); c.lineTo(x - r * 0.1, by + r * 0.17); c.moveTo(x + r * 0.1, by - r * 0.07); c.lineTo(x + r * 0.1, by + r * 0.17); c.stroke();
    if (!powered) { c.fillStyle = '#d6281e'; c.fillRect(x + r * 0.3, y - r * 0.5, r * 0.3, r * 0.18); }
  }
  function navD(c, x, y, r, nv, obs) {
    c.save(); c.translate(x, y); c.rotate(-obs * DEG);
    for (let d = 0; d < 360; d += 5) tick(c, 0, 0, r * (d % 10 ? 0.88 : 0.83), r * 0.95, d, 1.2);
    const L = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
    for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * 30 * DEG); txt(c, L[i], 0, -r * 0.73, r * 0.13); c.restore(); }
    c.restore();
    c.fillStyle = '#ffd21f'; c.beginPath(); c.moveTo(x, y - r * 0.8); c.lineTo(x - r * 0.06, y - r * 0.93); c.lineTo(x + r * 0.06, y - r * 0.93); c.fill();
    if (nv.type) {
      c.fillStyle = '#fff'; c.fillRect(x + nv.cdi * r * 0.5 - 1.6, y - r * 0.56, 3.2, r * 1.12);
      if (nv.gsOK) c.fillRect(x - r * 0.56, y - nv.gs * r * 0.5 - 1.6, r * 1.12, 3.2);
      if (nv.tf) { c.beginPath(); const s = nv.tf > 0 ? -1 : 1; c.moveTo(x + r * 0.34, y - r * 0.3 + s * r * 0.07); c.lineTo(x + r * 0.27, y - r * 0.3 - s * r * 0.05); c.lineTo(x + r * 0.41, y - r * 0.3 - s * r * 0.05); c.fill(); }
      txt(c, nv.ident, x - r * 0.36, y - r * 0.32, r * 0.11, '#8fd18f');
    } else { c.fillStyle = '#d6281e'; c.fillRect(x + r * 0.2, y - r * 0.4, r * 0.3, r * 0.17); txt(c, 'NAV', x + r * 0.35, y - r * 0.315, r * 0.1, '#fff'); }
  }

  /* ---------- layout ---------- */
  const SW = [['pump', 310, 'FUEL', 'PUMP'], ['beacon', 368, 'BCN', ''], ['land', 426, 'LAND', ''], ['taxi', 484, 'TAXI', ''], ['nav', 542, 'NAV', ''], ['strobe', 600, 'STROBE', ''], ['pitot', 658, 'PITOT', 'HEAT'], ['avionics', 748, 'AVIONICS', 'MASTER']];
  const AN = { six: [[270, 190], [466, 190], [662, 190], [270, 388], [466, 388], [662, 388]], R: 93 };
  function layout(type) {
    const h = P.hot = [];
    const circ = (id, x, y, r) => h.push({ id, x, y, r });
    const rect = (id, x, y, w, hh) => h.push({ id, x, y, w, h: hh });
    if (type === 'analog') {
      const ids = ['asi', 'ai', 'alt', 'tc', 'hi', 'vsi'];
      circ('kollsman', 590, 264, 20); circ('hdgSync', 394, 462, 20); circ('hdgBug', 538, 462, 20); circ('obs', 786, 256, 20);
      AN.six.forEach((p, i) => circ(ids[i], p[0], p[1], AN.R));
      circ('navInd', 850, 190, 82); circ('tach', 850, 388, 82);
      circ('fuelQty', 92, 190, 52); circ('egt', 92, 302, 52); circ('oil', 92, 414, 52); circ('vac', 92, 526, 52);
      rect('comSwap', 1088, 132, 46, 56); rect('comKnob', 1196, 128, 56, 62); rect('navSwap', 1088, 208, 46, 56); rect('navKnob', 1196, 204, 56, 62); rect('xpdr', 968, 340, 280, 56); rect('atisBtn', 968, 404, 136, 62); rect('twrBtn', 1114, 404, 136, 62);
    } else {
      rect('pfd', 150, 76, 620, 410); rect('mfd', 900, 76, 620, 410);
      circ('hdgBug', 112, 300, 24); circ('obs', 112, 400, 24); circ('kollsman', 808, 300, 24); circ('rangeOut', 1560, 300, 24); circ('rangeIn', 1560, 380, 24);
      circ('asi', 1700, 150, 64); circ('ai', 1700, 296, 64); circ('alt', 1700, 442, 64);
      rect('comSwap', 790, 96, 90, 44); rect('navSwap', 790, 150, 90, 44); rect('atisBtn', 790, 204, 90, 34); rect('twrBtn', 790, 244, 90, 34);
    }
    circ('ign', 110, 690, 54); rect('masterAlt', 196, 640, 34, 100); rect('masterBat', 230, 640, 34, 100);
    for (const [id, x] of SW) rect(id, x - 24, 640, 48, 100);
    circ('panelLt', 838, 690, 26);
  }
  P.names = { asi: 'Airspeed indicator', ai: 'Attitude indicator', alt: 'Altimeter', tc: 'Turn coordinator', hi: 'Heading indicator', vsi: 'Vertical speed indicator', navInd: 'VOR / ILS indicator', tach: 'Tachometer', fuelQty: 'Fuel quantity', egt: 'EGT and fuel flow', oil: 'Oil temperature and pressure', vac: 'Suction and ammeter', pfd: 'Primary flight display', mfd: 'Multi-function display', kollsman: 'Altimeter setting knob', hdgBug: 'Heading bug knob', hdgSync: 'Heading indicator sync knob', obs: 'Course (OBS) knob', ign: 'Ignition switch', masterAlt: 'Master switch (alternator)', masterBat: 'Master switch (battery)', pump: 'Fuel pump', beacon: 'Beacon', land: 'Landing light', taxi: 'Taxi light', nav: 'Navigation lights', strobe: 'Strobe lights', pitot: 'Pitot heat', avionics: 'Avionics master', panelLt: 'Panel lights', throttle: 'Throttle', mixture: 'Mixture', flapUp: 'Flap lever', flapDn: 'Flap lever', trim: 'Elevator trim wheel', fuelSel: 'Fuel selector', parkBrake: 'Parking brake', comSwap: 'COM frequency swap', navSwap: 'NAV frequency swap', comKnob: 'COM tuning', navKnob: 'NAV tuning', xpdr: 'Transponder', atisBtn: 'Listen to ATIS', twrBtn: 'Tune Tower', rangeIn: 'Map range in', rangeOut: 'Map range out' };
  P.hitTest = (u, v) => {
    let big = null;
    for (const h of P.hot) {
      const inside = h.r ? Math.hypot(u - h.x, v - h.y) <= h.r : (u >= h.x && u <= h.x + h.w && v >= h.y && v <= h.y + h.h);
      if (!inside) continue;
      if (h.r && h.r < 30) return h;
      if (!big) big = h;
    }
    return big;
  };
  P.hotPos = (id) => { const h = P.hot.find((q) => q.id === id); if (!h) return null; return h.r ? [h.x, h.y, h.r] : [h.x + h.w / 2, h.y + h.h / 2, Math.max(h.w, h.h) / 2 + 6]; };

  function drawStatic(c, type) {
    // panel plate
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#34363a'); g.addColorStop(1, '#27292c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.025)'; for (let i = 0; i < 2600; i++) c.fillRect(Math.random() * W, Math.random() * H, 2, 1);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.strokeRect(10, 10, W - 20, H - 20); c.beginPath(); c.moveTo(1278, 12); c.lineTo(1278, 560); c.moveTo(12, 575); c.lineTo(W - 12, 575); c.stroke();
    const screw = (x, y) => { c.fillStyle = '#17181a'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.strokeStyle = '#5b5e62'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y - 2); c.lineTo(x + 3, y + 2); c.stroke(); };
    for (const [x, y] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26], [1266, 26], [1290, 26], [640, 560], [1266, 548]]) screw(x, y);
    if (type === 'analog') {
      const R = AN.R, s = AN.six;
      asiS(c, s[0][0], s[0][1], R); face(c, s[1][0], s[1][1], R); altS(c, s[2][0], s[2][1], R); tcS(c, s[3][0], s[3][1], R); face(c, s[4][0], s[4][1], R); vsiS(c, s[5][0], s[5][1], R);
      navS(c, 850, 190, 82); tachS(c, 850, 388, 82);
      dualS(c, 92, 190, 50, 'FUEL QTY', 'L', 'R', [0.2, 1], [0.2, 1]); dualS(c, 92, 302, 50, 'EGT  FF', 'EGT', 'GPH', null, [0, 0.62]);
      dualS(c, 92, 414, 50, 'OIL', '°F', 'PSI', [0.0, 0.69], [0.43, 0.78]); dualS(c, 92, 526, 50, 'VAC  AMP', 'VAC', 'A', [0.38, 0.62], null);
      knobDraw(c, 590, 264, 15, 0); knobDraw(c, 394, 462, 15, 0, 'PUSH'); knobDraw(c, 538, 462, 15, 0, 'HDG'); knobDraw(c, 786, 256, 15, 0, 'OBS');
      // radio stack
      c.fillStyle = '#141516'; c.fillRect(958, 78, 300, 396); c.strokeStyle = '#4b4e52'; c.lineWidth = 2; c.strokeRect(958, 78, 300, 396);
      const unit = (y, h2, label) => { c.fillStyle = '#1e2022'; c.fillRect(964, y, 288, h2); c.strokeStyle = '#3a3d40'; c.lineWidth = 1; c.strokeRect(964, y, 288, h2); txt(c, label, 972, y + 10, 10, '#9a9c98', 'left', '600'); };
      unit(82, 38, 'AUDIO'); unit(124, 70, 'COM 1'); unit(200, 70, 'NAV 1'); unit(276, 56, 'DME'); unit(338, 60, 'XPDR'); unit(402, 68, '');
      for (const [x, t] of [[1008, 'COM1'], [1064, 'COM2'], [1120, 'NAV1'], [1176, 'MKR']]) { c.fillStyle = x === 1008 ? '#31c452' : '#273127'; c.fillRect(x - 5, 96, 10, 6); txt(c, t, x, 111, 9, '#9a9c98', 'center', '600'); }
      for (const y of [132, 208]) { c.fillStyle = '#2b2d30'; c.fillRect(1090, y + 6, 42, 44); txt(c, '⇄', 1111, y + 28, 26, '#e9e9e4'); knobDraw(c, 1224, y + 30, 22, 30); }
      for (const [x, t] of [[1036, 'ATIS'], [1182, 'TOWER']]) { c.fillStyle = '#2b2d30'; c.fillRect(x - 66, 408, 132, 56); c.strokeStyle = '#55585c'; c.strokeRect(x - 66, 408, 132, 56); txt(c, t, x, 437, 20, '#e9e9e4'); }
      // right side: reference card
      c.fillStyle = '#e9e6da'; c.fillRect(1316, 96, 380, 330); c.strokeStyle = '#111'; c.lineWidth = 2; c.strokeRect(1316, 96, 380, 330);
      txt(c, 'CESSNA 172S  ' + AD.CALLSIGN, 1506, 122, 22, '#17386b');
      const rows = [['Rotate', '55'], ['Best angle  Vx', '62'], ['Best rate  Vy', '74'], ['Best glide', '68'], ['Approach, flaps 30', '65'], ['Flaps 10 max', '110'], ['Flaps full max', '85'], ['Manoeuvring  Va', '105'], ['Never exceed', '163']];
      rows.forEach((rw, i) => { txt(c, rw[0], 1334, 160 + i * 28, 19, '#1b1c1e', 'left', '600'); txt(c, rw[1] + ' KIAS', 1678, 160 + i * 28, 19, '#1b1c1e', 'right', '700'); });
      c.strokeStyle = '#3a3d40'; c.lineWidth = 2; c.strokeRect(1730, 96, 270, 150); txt(c, 'VOCB  COIMBATORE', 1865, 122, 18, '#d9d9d2'); txt(c, 'RWY 05/23  2990 M', 1865, 150, 16, '#b9b9b2', 'center', '600'); txt(c, 'ELEV 1328 FT', 1865, 174, 16, '#b9b9b2', 'center', '600'); txt(c, 'TWR 118.15  ATIS 128.05', 1865, 198, 16, '#b9b9b2', 'center', '600'); txt(c, 'ILS 23  109.10   VOR 112.90', 1865, 222, 16, '#b9b9b2', 'center', '600');
      c.strokeRect(1730, 270, 270, 156); txt(c, 'HOURS', 1865, 296, 14, '#9a9c98', 'center', '600');
    } else {
      for (const x of [150, 900]) { c.fillStyle = '#0a0b0c'; c.fillRect(x - 46, 60, 712, 444); c.strokeStyle = '#5a5d61'; c.lineWidth = 3; c.strokeRect(x - 46, 60, 712, 444); c.fillStyle = '#000'; c.fillRect(x, 76, 620, 410); }
      knobDraw(c, 112, 300, 20, 0, 'HDG'); knobDraw(c, 112, 400, 20, 0, 'CRS'); knobDraw(c, 808, 300, 20, 0, 'BARO'); knobDraw(c, 1560, 300, 20, 0, 'RANGE −'); knobDraw(c, 1560, 380, 20, 0, 'RANGE +');
      for (const [y, t, hh] of [[96, 'COM ⇄', 44], [150, 'NAV ⇄', 44], [204, 'ATIS', 34], [244, 'TOWER', 34]]) { c.fillStyle = '#2b2d30'; c.fillRect(792, y, 86, hh); c.strokeStyle = '#55585c'; c.lineWidth = 1; c.strokeRect(792, y, 86, hh); txt(c, t, 835, y + hh / 2 + 1, 17, '#e9e9e4'); }
      asiS(c, 1700, 150, 62); face(c, 1700, 296, 62); altS(c, 1700, 442, 62);
      txt(c, 'STANDBY', 1700, 524, 14, '#9a9c98', 'center', '600');
      c.strokeStyle = '#3a3d40'; c.lineWidth = 2; c.strokeRect(1800, 96, 210, 150); txt(c, 'VOCB', 1905, 122, 20, '#d9d9d2'); txt(c, 'TWR 118.15', 1905, 152, 16, '#b9b9b2', 'center', '600'); txt(c, 'ATIS 128.05', 1905, 176, 16, '#b9b9b2', 'center', '600'); txt(c, 'ILS 109.10', 1905, 200, 16, '#b9b9b2', 'center', '600'); txt(c, 'VOR 112.90', 1905, 224, 16, '#b9b9b2', 'center', '600');
    }
    // annunciator
    c.fillStyle = '#0c0d0e'; c.fillRect(596, 20, 340, 44); c.strokeStyle = '#4b4e52'; c.lineWidth = 1.5; c.strokeRect(596, 20, 340, 44);
    // switch row
    txt(c, 'OFF', 62, 712, 12, '#d9d9d2'); txt(c, 'R', 70, 654, 12, '#d9d9d2'); txt(c, 'L', 110, 628, 12, '#d9d9d2'); txt(c, 'BOTH', 156, 652, 12, '#d9d9d2'); txt(c, 'START', 166, 716, 12, '#d9d9d2'); txt(c, 'IGNITION', 110, 760, 13, '#b9b9b2', 'center', '600');
    txt(c, 'MASTER', 230, 760, 13, '#b9b9b2', 'center', '600'); txt(c, 'ALT', 213, 628, 11, '#d9d9d2'); txt(c, 'BAT', 247, 628, 11, '#d9d9d2');
    for (const [, x, a, b] of SW) { txt(c, a, x, 758, 12, '#b9b9b2', 'center', '600'); if (b) txt(c, b, x, 773, 12, '#b9b9b2', 'center', '600'); }
    txt(c, 'PANEL LT', 838, 734, 12, '#b9b9b2', 'center', '600');
    for (let x = 300; x <= 870; x += 38) { c.fillStyle = '#0f1011'; c.beginPath(); c.arc(x, 812, 10, 0, 7); c.fill(); c.strokeStyle = '#55585c'; c.lineWidth = 1; c.stroke(); txt(c, x % 76 ? '5' : '10', x, 813, 9, '#8c8e8a', 'center', '600'); }
    txt(c, 'THROTTLE', 1010, 742, 13, '#b9b9b2', 'center', '600'); txt(c, 'MIXTURE', 1104, 742, 13, '#b9b9b2', 'center', '600');
    c.fillStyle = '#0c0d0e'; c.fillRect(1212, 576, 20, 156); c.strokeStyle = '#55585c'; c.strokeRect(1212, 576, 20, 156);
    [['UP', 590], ['10°', 632], ['20°', 673], ['FULL', 715]].forEach(([t, y]) => { txt(c, t, 1196, y, 13, '#d9d9d2', 'right', '600'); c.fillStyle = '#d9d9d2'; c.fillRect(1234, y - 1, 8, 2); });
    txt(c, 'WING FLAPS', 1222, 752, 13, '#b9b9b2', 'center', '600');
    c.fillStyle = '#0c0d0e'; c.fillRect(1262, 584, 12, 138); txt(c, 'POS', 1268, 734, 10, '#8c8e8a', 'center', '600');
    for (const [x, t] of [[920, 'ALT STATIC'], [1330, 'CABIN HT'], [1400, 'CABIN AIR']]) { knobDraw(c, x, 648, 17, 0); txt(c, t, x, 680, 10, '#8c8e8a', 'center', '600'); }
    txt(c, 'PARK BRAKE — PULL', 218, 836, 12, '#b9b9b2', 'center', '600');
    c.strokeStyle = '#3a3d40'; c.lineWidth = 2; c.strokeRect(1500, 600, 500, 220); txt(c, 'MAP & CHARTS', 1750, 618, 12, '#6f716e', 'center', '600');
  }

  P.init = (scale) => {
    P.scale = scale;
    P.cv = G.canvas(W * scale, H * scale); P.ctx = P.cv.getContext('2d');
    P.bg = G.canvas(W * scale, H * scale);
    P.tex = new THREE.CanvasTexture(P.cv); P.tex.anisotropy = FS.maxAniso || 4; P.tex.minFilter = THREE.LinearFilter; P.tex.generateMipmaps = false;
    P.setType(FS.settings.panel);
  };
  P.setType = (type) => {
    P.type = type; layout(type);
    const c = P.bg.getContext('2d'); c.setTransform(P.scale, 0, 0, P.scale, 0, 0); drawStatic(c, type);
  };

  /* ---------- moving map (MFD and HUD overlay) ---------- */
  P.drawMap = (c, cx, cy, rad, rangeNM, ac, northUp) => {
    const sc = rad / (rangeNM * NM), o = ac.o;
    const rot = northUp ? -(Math.atan2(-0.717, 0.697) + Math.PI / 2) : -(Math.atan2(Math.sin((o.hdg - AD.RWY_TRUE) * DEG), Math.cos((o.hdg - AD.RWY_TRUE) * DEG)) + Math.PI / 2);
    c.save(); c.beginPath(); c.rect(cx - rad * 1.6, cy - rad * 1.3, rad * 3.2, rad * 2.6); c.clip();
    c.fillStyle = '#20281f'; c.fillRect(cx - rad * 1.6, cy - rad * 1.3, rad * 3.2, rad * 2.6);
    c.translate(cx, cy); c.rotate(rot); c.scale(sc, sc); c.translate(-ac.pos.x, -ac.pos.z);
    const lw = 1 / sc;
    // city, roads, extended centrelines, Sulur
    c.fillStyle = 'rgba(150,140,120,0.22)'; c.beginPath(); c.arc(AD.CITY[0], AD.CITY[1], 5200, 0, 7); c.fill(); c.beginPath(); c.arc(-2600, -300, 2400, 0, 7); c.fill();
    c.strokeStyle = '#6b6252'; c.lineWidth = 2.2 * lw; c.beginPath(); c.moveTo(-14000, -1250 + 0.3 * -15000); c.lineTo(10500, -1250 + 0.3 * 9500); c.moveTo(-10500, -4350 + 0.81 * -1360); c.lineTo(12500, -4350 + 0.81 * 21640); c.stroke();
    c.strokeStyle = 'rgba(120,220,255,0.55)'; c.lineWidth = 1.2 * lw; c.setLineDash([260, 180]); c.beginPath(); c.moveTo(0, 0); c.lineTo(-11000, 0); c.moveTo(2990, 0); c.lineTo(14000, 0); c.stroke(); c.setLineDash([]);
    A.drawChart(c);
    c.strokeStyle = '#ff5a48'; c.lineWidth = 1.6 * lw; c.beginPath(); c.arc(AD.SULUR[0], AD.SULUR[1], 2 * NM, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,90,72,0.12)'; c.fill(); c.strokeStyle = '#aab'; c.lineWidth = 60; c.beginPath(); c.moveTo(AD.SULUR[0] - 1250, AD.SULUR[1]); c.lineTo(AD.SULUR[0] + 1250, AD.SULUR[1]); c.stroke();
    c.restore();
    // labels (upright)
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const S = (x, z) => { const dx = (x - ac.pos.x) * sc, dz = (z - ac.pos.z) * sc; return [cx + dx * cs - dz * sn, cy + dx * sn + dz * cs]; };
    c.save(); c.beginPath(); c.rect(cx - rad * 1.6, cy - rad * 1.3, rad * 3.2, rad * 2.6); c.clip();
    const fs = Math.max(9, rad * 0.085);
    for (const [t, x, z, big] of A.labels) { if (!big && sc < 0.11) continue; const p = S(x, z); txt(c, t, p[0], p[1], big ? fs * 1.15 : fs, big ? '#fff' : '#ffe27a', 'center', big ? '700' : '600'); }
    let p = S(AD.SULUR[0], AD.SULUR[1] - 2600); txt(c, 'SULUR AFB — KEEP CLEAR', p[0], p[1], fs, '#ff8a7a');
    p = S(AD.CITY[0], AD.CITY[1]); txt(c, 'COIMBATORE', p[0], p[1], fs * 1.1, '#cfc7b3');
    if (sc < 0.11) { p = S(1500, -260); txt(c, 'VOCB', p[0], p[1], fs * 1.1, '#fff'); }
    // range ring, north, aircraft
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, rad * 0.5, 0, 7); c.stroke();
    txt(c, (rangeNM / 2 < 1 ? (rangeNM / 2).toFixed(2) : (rangeNM / 2).toFixed(1)) + ' NM', cx + rad * 0.36, cy - rad * 0.4, fs * 0.9, 'rgba(255,255,255,0.75)', 'left', '600');
    const na = northUp ? 0 : -o.hdg * DEG;
    c.translate(cx - rad * 1.36, cy - rad * 1.02); c.rotate(na); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -fs * 1.1); c.lineTo(fs * 0.45, fs * 0.5); c.lineTo(0, fs * 0.2); c.lineTo(-fs * 0.45, fs * 0.5); c.fill(); txt(c, 'N', 0, -fs * 1.7, fs * 0.9);
    c.restore();
    c.save(); c.translate(cx, cy); if (northUp) c.rotate(o.hdg * DEG);
    const k = Math.max(7, rad * 0.075); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -k * 1.3); c.lineTo(k * 0.22, -k * 0.3); c.lineTo(k * 1.2, k * 0.1); c.lineTo(k * 1.2, k * 0.35); c.lineTo(k * 0.22, k * 0.2); c.lineTo(k * 0.15, k * 0.95); c.lineTo(k * 0.5, k * 1.2); c.lineTo(-k * 0.5, k * 1.2); c.lineTo(-k * 0.15, k * 0.95); c.lineTo(-k * 0.22, k * 0.2); c.lineTo(-k * 1.2, k * 0.35); c.lineTo(-k * 1.2, k * 0.1); c.lineTo(-k * 0.22, -k * 0.3); c.closePath(); c.stroke(); c.fill();
    c.restore();
  };

  /* ---------- glass displays ---------- */
  function tape(c, x, y, w, h, val, pxPer, step, numEvery, right) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = 'rgba(8,12,18,0.55)'; c.fillRect(x, y, w, h);
    const cy = y + h / 2, v0 = Math.floor((val - h / 2 / pxPer) / step) * step;
    for (let v = v0; v < val + h / 2 / pxPer + step; v += step) {
      if (v < 0) continue;
      const yy = cy - (v - val) * pxPer;
      c.fillStyle = '#fff'; c.fillRect(right ? x : x + w - 12, yy - 1, 12, 2);
      if (v % numEvery === 0) txt(c, String(v), right ? x + w - 6 : x + w - 18, yy, 17, '#fff', 'right', '600');
    }
    c.restore();
  }
  function drawPFD(c, x, y, w, h, ac, nv) {
    const o = ac.o, I = ac.inst, e = FS.env;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (!ac.elec.bus) { c.fillStyle = '#020203'; c.fillRect(x, y, w, h); c.restore(); return; }
    const cx = x + w / 2, cy = y + h * 0.4, k = 5.4;
    c.save(); c.translate(cx, cy); c.rotate(-o.bank * DEG); c.translate(0, o.pitch * k);
    c.fillStyle = '#2f7fd4'; c.fillRect(-w, -h * 3, w * 2, h * 3); c.fillStyle = '#6b4a2b'; c.fillRect(-w, 0, w * 2, h * 3);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w, 0); c.lineTo(w, 0); c.stroke();
    for (let p = -40; p <= 40; p += 5) { if (!p) continue; const ww = p % 10 ? 26 : 56; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-ww, -p * k); c.lineTo(ww, -p * k); c.stroke(); if (!(p % 10)) { txt(c, String(Math.abs(p)), -ww - 16, -p * k, 14); txt(c, String(Math.abs(p)), ww + 16, -p * k, 14); } }
    c.restore();
    c.save(); c.translate(cx, cy); c.rotate(-o.bank * DEG);
    for (const b of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) tick(c, 0, 0, 118, Math.abs(b) % 30 ? 128 : 136, b, 2, '#fff');
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -118); c.lineTo(-9, -134); c.lineTo(9, -134); c.fill(); c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx, cy - 117); c.lineTo(cx - 9, cy - 101); c.lineTo(cx + 9, cy - 101); c.fill();
    c.fillRect(cx - 12 + clamp(o.ball / 0.3, -1, 1) * 26, cy - 98, 24, 5);
    c.fillStyle = '#ffd21f'; c.strokeStyle = '#000'; c.lineWidth = 1;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 110, cy - 4); c.lineTo(cx + s * 44, cy - 4); c.lineTo(cx + s * 44, cy + 14); c.lineTo(cx + s * 34, cy + 14); c.lineTo(cx + s * 34, cy + 4); c.lineTo(cx + s * 110, cy + 4); c.closePath(); c.fill(); c.stroke(); }
    c.fillRect(cx - 4, cy - 4, 8, 8);
    // speed tape
    const tx = x + 26, ty = y + 44, th = 220, ias = o.ias;
    tape(c, tx, ty, 74, th, Math.max(ias, 20), 3.3, 10, 10, false);
    c.save(); c.beginPath(); c.rect(tx + 74, ty, 8, th); c.clip();
    const Y = (v) => ty + th / 2 - (v - Math.max(ias, 20)) * 3.3, band = (v0, v1, col, xo, ww) => { c.fillStyle = col; c.fillRect(tx + 74 + xo, Y(v1), ww, Y(v0) - Y(v1)); };
    band(0, 40, '#d6281e', 0, 8); band(40, 48, '#f4f4f0', 0, 4); band(48, 85, '#27a54a', 0, 8); band(48, 85, '#f4f4f0', 0, 4); band(85, 129, '#27a54a', 0, 8); band(129, 163, '#e8c21a', 0, 8); band(163, 260, '#d6281e', 0, 8);
    c.restore();
    for (const [v, t] of [[55, 'R'], [62, 'X'], [74, 'Y'], [68, 'G']]) { const yy = Y(v); if (yy > ty + 6 && yy < ty + th - 6) { c.fillStyle = '#0b0c0d'; c.fillRect(tx + 84, yy - 8, 16, 16); txt(c, t, tx + 92, yy + 1, 12, '#41d9f5'); } }
    c.fillStyle = '#000'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.fillRect(tx - 2, ty + th / 2 - 17, 66, 34); c.strokeRect(tx - 2, ty + th / 2 - 17, 66, 34);
    txt(c, ias < 20 ? '---' : String(Math.round(ias)), tx + 58, ty + th / 2 + 1, 26, ias > 163 ? '#ff6a5a' : '#fff', 'right');
    c.fillStyle = 'rgba(8,12,18,0.7)'; c.fillRect(tx, ty + th, 74, 20); txt(c, 'TAS ' + Math.round(o.tas) + 'KT', tx + 37, ty + th + 11, 13, '#fff', 'center', '600');
    // altitude tape
    const ax = x + w - 132, alt = o.indAlt;
    tape(c, ax, ty, 82, th, alt, 0.62, 100, 200, true);
    c.fillStyle = '#000'; c.fillRect(ax + 8, ty + th / 2 - 17, 78, 34); c.strokeRect(ax + 8, ty + th / 2 - 17, 78, 34);
    txt(c, String(Math.round(alt / 10) * 10), ax + 82, ty + th / 2 + 1, 24, '#fff', 'right');
    c.fillStyle = 'rgba(8,12,18,0.7)'; c.fillRect(ax, ty + th, 82, 20); txt(c, Math.round(I.kollsman) + ' HPA', ax + 41, ty + th + 11, 13, '#41d9f5', 'center', '600');
    // VSI
    const vx = x + w - 44, vy = ty + th / 2;
    c.fillStyle = 'rgba(8,12,18,0.55)'; c.fillRect(vx, ty + 20, 34, th - 40);
    for (const v of [-2000, -1000, 0, 1000, 2000]) { c.fillStyle = '#fff'; c.fillRect(vx, vy - v * 0.042 - 1, 8, 2); if (v) txt(c, String(Math.abs(v / 1000)), vx + 20, vy - v * 0.042, 12, '#fff', 'center', '600'); }
    const vs = clamp(I.vsInd, -2200, 2200); c.fillStyle = '#000'; c.fillRect(vx - 2, vy - vs * 0.042 - 9, 40, 18); c.strokeRect(vx - 2, vy - vs * 0.042 - 9, 40, 18);
    if (Math.abs(vs) > 60) txt(c, String(Math.round(I.vsInd / 50) * 50), vx + 36, vy - vs * 0.042 + 1, 12, '#fff', 'right', '600');
    // glideslope
    if (nv.gsOK) { const gx = ax - 22; c.fillStyle = 'rgba(8,12,18,0.55)'; c.fillRect(gx - 8, cy - 70, 16, 140); for (const d of [-2, -1, 1, 2]) { c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(gx, cy + d * 28, 3.5, 0, 7); c.stroke(); } c.fillStyle = '#35e06a'; const gy = cy - nv.gs * 56; c.beginPath(); c.moveTo(gx, gy - 9); c.lineTo(gx + 7, gy); c.lineTo(gx, gy + 9); c.lineTo(gx - 7, gy); c.fill(); txt(c, 'G', gx, cy - 80, 12, '#35e06a'); }
    // HSI
    const hx = cx, hy = y + h - 62, hr = 84, hdg = o.hdgMag;
    c.fillStyle = 'rgba(8,12,18,0.5)'; c.beginPath(); c.arc(hx, hy, hr + 6, 0, 7); c.fill();
    c.save(); c.translate(hx, hy); c.rotate(-hdg * DEG);
    const L = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
    for (let d = 0; d < 360; d += 10) tick(c, 0, 0, hr - (d % 30 ? 7 : 12), hr, d, 1.5, '#fff');
    for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * 30 * DEG); txt(c, L[i], 0, -hr + 24, i % 3 ? 13 : 16); c.restore(); }
    c.save(); c.rotate(I.hdgBug * DEG); c.fillStyle = '#41d9f5'; c.fillRect(-9, -hr - 5, 18, 7); c.restore();
    if (nv.type) {
      c.rotate(nv.crs * DEG); c.strokeStyle = '#35e06a'; c.fillStyle = '#35e06a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -hr + 30); c.lineTo(0, -hr * 0.42); c.moveTo(0, hr * 0.42); c.lineTo(0, hr - 30); c.stroke();
      c.beginPath(); c.moveTo(0, -hr + 22); c.lineTo(-8, -hr + 38); c.lineTo(8, -hr + 38); c.fill();
      const dv = nv.cdi * hr * 0.42; c.beginPath(); c.moveTo(dv, -hr * 0.4); c.lineTo(dv, hr * 0.4); c.stroke();
      for (const d of [-1, -0.5, 0.5, 1]) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.arc(d * hr * 0.42, 0, 3, 0, 7); c.stroke(); }
    }
    c.restore();
    c.fillStyle = '#000'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.fillRect(hx - 30, hy - hr - 30, 60, 22); c.strokeRect(hx - 30, hy - hr - 30, 60, 22); txt(c, ('00' + (Math.round(hdg) % 360 || 360)).slice(-3) + '°', hx, hy - hr - 18, 16);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx, hy - 11); c.lineTo(hx + 3, hy - 2); c.lineTo(hx + 12, hy + 2); c.lineTo(hx + 3, hy + 4); c.lineTo(hx + 2, hy + 10); c.lineTo(hx - 2, hy + 10); c.lineTo(hx - 3, hy + 4); c.lineTo(hx - 12, hy + 2); c.lineTo(hx - 3, hy - 2); c.fill();
    txt(c, nv.type ? (nv.type === 'ILS' ? 'LOC1' : 'VOR1') : 'NAV1 ---', hx - hr - 16, hy - 40, 14, '#35e06a', 'right', '600');
    if (nv.type) txt(c, nv.ident + (nv.dme !== null ? '  ' + nv.dme.toFixed(1) + 'NM' : ''), hx - hr - 16, hy - 22, 13, '#35e06a', 'right', '600');
    txt(c, 'HDG ' + ('00' + Math.round(I.hdgBug)).slice(-3) + '°', hx + hr + 16, hy - 40, 14, '#41d9f5', 'left', '600'); txt(c, 'CRS ' + ('00' + Math.round(nv.crs)).slice(-3) + '°', hx + hr + 16, hy - 22, 13, '#35e06a', 'left', '600');
    // top and bottom bars
    c.fillStyle = 'rgba(0,0,0,0.82)'; c.fillRect(x, y, w, 26); c.fillRect(x, y + h - 22, w, 22);
    txt(c, 'NAV1 ' + I.nav1.toFixed(2) + ' ⇄ ' + I.nav1s.toFixed(2), x + 8, y + 14, 14, '#fff', 'left', '600');
    txt(c, I.com1.toFixed(3) + ' ⇄ ' + I.com1s.toFixed(3) + ' COM1', x + w - 8, y + 14, 14, '#35e06a', 'right', '600');
    txt(c, 'OAT ' + Math.round(e.tempAt(ac.pos.y + AD.ELEV_M) - 273.15) + '°C   WIND ' + ('00' + Math.round(FS.toMag(e.windDirNow))).slice(-3) + '°/' + Math.round(e.windKtNow) + 'KT', x + 8, y + h - 10, 13, '#fff', 'left', '600');
    txt(c, 'XPDR ' + I.xpdr + ' ALT   ' + e.timeString().slice(0, 2) + ':' + e.timeString().slice(2) + ' LCL', x + w - 8, y + h - 10, 13, '#fff', 'right', '600');
    if (o.stallWarn) { c.fillStyle = '#d6281e'; c.fillRect(cx - 50, cy + 40, 100, 26); txt(c, 'STALL', cx, cy + 54, 18, '#fff'); }
    c.restore();
  }
  function drawMFD(c, x, y, w, h, ac) {
    const o = ac.o, e = ac.eng, el = ac.elec;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (!(el.bus && el.avionics)) { c.fillStyle = '#020203'; c.fillRect(x, y, w, h); c.restore(); return; }
    P.drawMap(c, x + 130 + (w - 130) / 2, y + 26 + (h - 26) / 2, (h - 26) / 2 / 1.3 * 1.25, P.range, ac, false);
    c.fillStyle = '#0a0c0f'; c.fillRect(x, y, 130, h); c.fillRect(x, y, w, 26);
    txt(c, 'MAP – VOCB', x + 140, y + 14, 14, '#fff', 'left', '600'); txt(c, 'GS ' + Math.round(o.gs) + 'KT   TRK ' + ('00' + Math.round(FS.toMag(o.track))).slice(-3) + '°   RNG ' + P.range + 'NM', x + w - 8, y + 14, 14, '#fff', 'right', '600');
    const lx = x + 65; let ly = y + 16;
    txt(c, 'ENGINE', lx, ly, 13, '#41d9f5', 'center', '600'); ly += 50;
    arc(c, lx, ly + 10, 44, -110, 110, 4, '#888'); arc(c, lx, ly + 10, 44, -110 + 2100 / 3000 * 220, -110 + 2700 / 3000 * 220, 5, '#27a54a'); arc(c, lx, ly + 10, 44, -110 + 2700 / 3000 * 220, 110, 5, '#d6281e');
    needle(c, lx, ly + 10, -110 + clamp(e.rpm, 0, 3000) / 3000 * 220, 40, 4, '#fff'); txt(c, String(Math.round(e.rpm / 10) * 10), lx, ly + 30, 18, e.rpm > 2700 ? '#ff6a5a' : '#fff'); txt(c, 'RPM', lx, ly + 48, 11, '#9ab');
    ly += 76;
    const bar = (label, v, lo, hi, g0, g1, val, red) => { txt(c, label, x + 8, ly, 11, '#9ab', 'left', '600'); txt(c, val, x + 122, ly, 12, red ? '#ff6a5a' : '#fff', 'right', '600'); c.fillStyle = '#333'; c.fillRect(x + 8, ly + 9, 114, 5); c.fillStyle = '#27a54a'; c.fillRect(x + 8 + (g0 - lo) / (hi - lo) * 114, ly + 9, (g1 - g0) / (hi - lo) * 114, 5); const px = x + 8 + clamp((v - lo) / (hi - lo), 0, 1) * 114; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(px, ly + 8); c.lineTo(px - 5, ly + 1); c.lineTo(px + 5, ly + 1); c.fill(); ly += 28; };
    bar('FFLOW GPH', e.ff, 0, 20, 0, 12, e.ff.toFixed(1));
    bar('OIL PRES', e.oilP, 0, 115, 50, 90, String(Math.round(e.oilP)), e.running && e.oilP < 20);
    bar('OIL TEMP', e.oilT, 100, 245, 100, 200, String(Math.round(e.oilT)));
    bar('EGT', e.egt, 1000, 1600, 1000, 1500, String(Math.round(e.egt)));
    bar('VAC', ac.inst.vac || 0, 3, 7, 4.5, 5.5, (ac.inst.vac || 0).toFixed(1), (ac.inst.vac || 0) < 3.5 && e.running);
    bar('FUEL L GAL', ac.fuel.L, 0, 26.5, 5, 26.5, ac.fuel.L.toFixed(1), ac.fuel.L < 5);
    bar('FUEL R GAL', ac.fuel.R, 0, 26.5, 5, 26.5, ac.fuel.R.toFixed(1), ac.fuel.R < 5);
    txt(c, 'VOLTS ' + el.volts.toFixed(1), x + 8, ly + 2, 12, el.volts < 24.5 ? '#ff6a5a' : '#fff', 'left', '600'); txt(c, 'AMPS ' + (el.amps > 0 ? '+' : '') + Math.round(el.amps), x + 8, ly + 20, 12, '#fff', 'left', '600');
    c.restore();
  }

  /* ---------- per frame ---------- */
  P.draw = (ac, t) => {
    const c = P.ctx, o = ac.o, I = ac.inst, e = ac.eng, el = ac.elec, s = P.scale;
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(P.bg, 0, 0); c.setTransform(s, 0, 0, s, 0, 0);
    const nv = FS.nav(ac), hdgI = wrap360(o.hdgMag + I.hdgDrift);
    if (P.type === 'analog') {
      const R = AN.R, q = AN.six;
      needle(c, q[0][0], q[0][1], asiA(o.ias), R * 0.86, R * 0.06, '#fff', R * 0.16); hub(c, q[0][0], q[0][1], R * 0.09);
      aiD(c, q[1][0], q[1][1], R, o.pitch, o.bank, I.gyro);
      altD(c, q[2][0], q[2][1], R, o.indAlt, I.kollsman);
      tcD(c, q[3][0], q[3][1], R, o.turnRate, o.ball, el.bus);
      hiD(c, q[4][0], q[4][1], R, hdgI, I.hdgBug, I.gyro);
      needle(c, q[5][0], q[5][1], 270 + clamp(I.vsInd, -2000, 2000) * 0.09, R * 0.84, R * 0.055, '#fff', R * 0.16); hub(c, q[5][0], q[5][1], R * 0.09);
      navD(c, 850, 190, 82, nv, I.obs);
      needle(c, 850, 388, tachA(e.rpm), 70, 5, '#fff', 13); hub(c, 850, 388, 7);
      c.fillStyle = '#000'; c.fillRect(812, 428, 76, 20); txt(c, ('00000' + Math.floor(1432.6 + e.hobbs) ).slice(-5) + '.' + Math.floor((e.hobbs * 10) % 10), 850, 439, 14, '#e9e9e4');
      dualD(c, 92, 190, 50, ac.fuel.L / 26.5 * (el.bus ? 1 : 0), ac.fuel.R / 26.5 * (el.bus ? 1 : 0));
      dualD(c, 92, 302, 50, (e.egt - 1000) / 600, e.ff / 19);
      dualD(c, 92, 414, 50, (e.oilT - 100) / 145, e.oilP / 115);
      dualD(c, 92, 526, 50, ((I.vac || 0) - 3) / 4, (el.amps + 60) / 120);
      // clock / OAT
      c.fillStyle = '#0b1310'; c.fillRect(38, 68, 108, 58); c.strokeStyle = '#4b4e52'; c.lineWidth = 1.5; c.strokeRect(38, 68, 108, 58);
      if (el.bus) { const ts = FS.env.timeString(); txt(c, ts.slice(0, 2) + ':' + ts.slice(2), 92, 86, 22, '#c9e6c9'); txt(c, Math.round(FS.env.tempAt(ac.pos.y + AD.ELEV_M) - 273.15) + '°C  ' + el.volts.toFixed(1) + 'V', 92, 111, 13, '#c9e6c9', 'center', '600'); }
      // radios
      if (el.bus && el.avionics) {
        txt(c, I.com1.toFixed(3), 1080, 162, 26, AMB, 'right'); txt(c, I.com1s.toFixed(3), 1190, 172, 17, AMB, 'right', '600');
        txt(c, I.nav1.toFixed(2), 1080, 238, 26, AMB, 'right'); txt(c, I.nav1s.toFixed(2), 1190, 248, 17, AMB, 'right', '600');
        txt(c, nv.dme !== null ? nv.dme.toFixed(1) + ' NM' : '--.- NM', 1080, 308, 22, AMB, 'right'); txt(c, nv.ident || '----', 1228, 308, 18, AMB, 'right', '600');
        txt(c, String(I.xpdr), 1080, 372, 24, AMB, 'right'); txt(c, 'ALT', 1228, 372, 16, AMB, 'right', '600');
      }
      txt(c, ('0000' + Math.floor(1432.6 + e.hobbs)).slice(-4) + '.' + Math.floor(((1432.6 + e.hobbs) * 10) % 10), 1865, 346, 34, '#e9e9e4');
    } else {
      drawPFD(c, 150, 76, 620, 410, ac, nv); drawMFD(c, 900, 76, 620, 410, ac);
      needle(c, 1700, 150, asiA(o.ias), 52, 4, '#fff', 10); hub(c, 1700, 150, 5);
      aiD(c, 1700, 296, 62, o.pitch, o.bank, 1, true); altD(c, 1700, 442, 62, o.indAlt, I.kollsman, true);
    }
    // annunciators
    if (el.bus) {
      const cells = [['L FUEL R', ac.fuel.L < 5 || ac.fuel.R < 5, AMB], ['OIL PRESS', e.oilP < 20, '#ff4a3a'], ['L VAC R', (I.vac || 0) < 3.5, AMB], ['VOLTS', el.volts < 24.5, '#ff4a3a']];
      cells.forEach((cl, i) => { if (cl[1]) { c.fillStyle = cl[2]; c.globalAlpha = 0.16; c.fillRect(600 + i * 84, 24, 80, 36); c.globalAlpha = 1; txt(c, cl[0], 640 + i * 84, 43, 14, cl[2]); } });
    }
    // ignition key
    const ka = [-120, -60, 0, 60, 115][e.mags];
    c.save(); c.translate(110, 690); c.fillStyle = '#17181a'; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.fill(); c.strokeStyle = '#6a6d70'; c.lineWidth = 2; c.stroke(); c.rotate(ka * DEG); c.fillStyle = '#c9ccd0'; c.fillRect(-6, -40, 12, 46); c.beginPath(); c.arc(0, -40, 13, 0, 7); c.fill(); c.fillStyle = '#17181a'; c.beginPath(); c.arc(0, -42, 4, 0, 7); c.fill(); c.restore();
    // rockers
    const rocker = (x, on, col, w) => { w = w || 40; c.fillStyle = '#0c0d0e'; c.fillRect(x - w / 2 - 3, 646, w + 6, 88); const g = c.createLinearGradient(0, 650, 0, 730); if (on) { g.addColorStop(0, col); g.addColorStop(0.55, col); g.addColorStop(1, '#222'); } else { g.addColorStop(0, '#1b1c1e'); g.addColorStop(0.45, col); g.addColorStop(1, col); } c.fillStyle = g; c.fillRect(x - w / 2, 650, w, 80); c.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.25)'; c.fillRect(x - 6, on ? 658 : 714, 12, 4); };
    rocker(213, el.alt, '#b3221b', 30); rocker(247, el.bat, '#b3221b', 30);
    for (const [id, x] of SW) rocker(x, el[id], id === 'avionics' ? '#d9d9d2' : '#5c6066');
    knobDraw(c, 838, 690, 22, -130 + el.panelLt * 260);
    c.fillStyle = '#e9e9e4'; c.fillRect(1263, 588 + ac.surf.flap * 125, 10, 6);
    // lesson highlight
    if (P.highlight) { const hp = P.hotPos(P.highlight) || P.hi3d[P.highlight]; if (hp) { const pu = 0.5 + 0.5 * Math.sin(t * 6); c.strokeStyle = 'rgba(255,214,40,' + (0.55 + 0.45 * pu) + ')'; c.lineWidth = 6; c.beginPath(); c.arc(hp[0], hp[1], hp[2] + 8 + pu * 6, 0, 7); c.stroke(); } }
    P.tex.needsUpdate = true;
  };
  P.hi3d = { throttle: [1010, 648, 34], mixture: [1104, 648, 34], flapUp: [1222, 652, 84], flapDn: [1222, 652, 84] };

  /* small compass strip */
  P.drawCompass = (cv, tex, hdg) => {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height;
    c.fillStyle = '#060707'; c.fillRect(0, 0, w, h);
    const L = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let d = -40; d <= 40; d += 5) { const v = Math.round((hdg + d) / 5) * 5, x = w / 2 - (v - hdg) * 2.6, vv = wrap360(v); if (x < 0 || x > w) continue; c.fillStyle = '#e9e9e4'; c.fillRect(x - 1, h - (vv % 10 ? 12 : 20), 2, vv % 10 ? 12 : 20); if (vv % 30 === 0) txt(c, L[vv] || String(vv / 10), x, 20, 22, '#e9e9e4'); }
    c.fillStyle = '#ff9a1f'; c.fillRect(w / 2 - 1.5, 0, 3, h);
    tex.needsUpdate = true;
  };
})();
