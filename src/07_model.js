/* ============================================================
   Cessna 172S model. Local axes: +X nose, +Y up, +Z right wing, origin at CG.
   ============================================================ */
(function () {
  const G = FS.G, V3 = THREE.Vector3;
  const M = FS.Model = { hit: [] };
  const PANEL = FS.PANEL = { W: 2048, H: 860, w: 1.12, h: 0.47, x: 0.60, yTop: 0.36 };
  PANEL.toLocal = (u, v, out, lift) => (out || new V3()).set(PANEL.x - (lift || 0), PANEL.yTop - v / PANEL.H * PANEL.h, -PANEL.w / 2 + u / PANEL.W * PANEL.w);

  const ST = [
    { x: 2.07, w: 0.03, yb: -0.10, yt: -0.04, n: 2 },
    { x: 2.06, w: 0.33, yb: -0.36, yt: 0.20, n: 2.4 },
    { x: 1.98, w: 0.43, yb: -0.43, yt: 0.315, n: 2.6 },
    { x: 1.55, w: 0.52, yb: -0.52, yt: 0.362, n: 2.8 },
    { x: 0.98, w: 0.55, yb: -0.56, yt: 0.36, n: 3.0 },
    { x: 0.55, w: 0.56, yb: -0.58, yt: 0.63, n: 3.2 },
    { x: 0.22, w: 0.56, yb: -0.58, yt: 0.80, n: 3.4 },
    { x: -1.05, w: 0.55, yb: -0.56, yt: 0.80, n: 3.4 },
    { x: -1.55, w: 0.50, yb: -0.50, yt: 0.63, n: 3.0 },
    { x: -2.05, w: 0.42, yb: -0.42, yt: 0.46, n: 2.8 },
    { x: -3.4, w: 0.26, yb: -0.22, yt: 0.40, n: 2.6 },
    { x: -4.8, w: 0.12, yb: 0.02, yt: 0.36, n: 2.4 },
    { x: -5.78, w: 0.035, yb: 0.17, yt: 0.31, n: 2.2 }
  ];
  const secPt = (s, ang, k) => {
    const yc = (s.yb + s.yt) / 2, h = (s.yt - s.yb) / 2, e = 2 / s.n, ca = Math.cos(ang), sa = Math.sin(ang);
    return [s.x, yc + h * Math.sign(sa) * Math.pow(Math.abs(sa), e) * k, s.w * Math.sign(ca) * Math.pow(Math.abs(ca), e) * k];
  };
  /* glass patch lying just outside the fuselage skin between two stations */
  function patch(b, iA, iB, a0, a1, seg) {
    const A = ST[iA], B = ST[iB], k = 1.012;
    for (let j = 0; j < seg; j++) {
      const t0 = lerp(a0, a1, j / seg) * DEG, t1 = lerp(a0, a1, (j + 1) / seg) * DEG;
      b.quad(secPt(A, t0, k), secPt(A, t1, k), secPt(B, t1, k), secPt(B, t0, k), 0xffffff);
    }
  }
  function paintCanvas() {
    const cv = G.canvas(1024, 256), c = cv.getContext('2d');
    const X = (x) => (x + 5.8) / 7.9 * 1024, Y = (y) => (1 - (y + 0.6) / 1.45) * 256;
    c.fillStyle = '#f3f2ed'; c.fillRect(0, 0, 1024, 256);
    c.fillStyle = '#dcdad3'; c.fillRect(0, Y(-0.38), 1024, 256);
    // sweeping stripes
    c.fillStyle = '#17386b';
    c.beginPath(); c.moveTo(X(2.05), Y(-0.16)); c.bezierCurveTo(X(0.9), Y(-0.2), X(-1.4), Y(-0.12), X(-5.8), Y(0.3)); c.lineTo(X(-5.8), Y(0.16)); c.bezierCurveTo(X(-1.4), Y(-0.3), X(0.9), Y(-0.36), X(2.05), Y(-0.33)); c.fill();
    c.fillStyle = '#e08a1c';
    c.beginPath(); c.moveTo(X(2.05), Y(-0.09)); c.bezierCurveTo(X(0.9), Y(-0.13), X(-1.4), Y(-0.05), X(-5.8), Y(0.345)); c.lineTo(X(-5.8), Y(0.315)); c.bezierCurveTo(X(-1.4), Y(-0.095), X(0.9), Y(-0.17), X(2.05), Y(-0.13)); c.fill();
    c.strokeStyle = 'rgba(60,60,60,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(0.2), Y(0.28)); c.lineTo(X(0.2), Y(-0.5)); c.lineTo(X(-0.45), Y(-0.5)); c.lineTo(X(-0.45), Y(0.28)); c.stroke();
    c.beginPath(); c.moveTo(X(0.98), Y(0.36)); c.lineTo(X(0.98), Y(-0.56)); c.moveTo(X(1.55), Y(0.33)); c.lineTo(X(1.55), Y(-0.1)); c.stroke();
    c.fillStyle = 'rgba(40,40,40,0.5)';
    for (let x = -5.4; x < 2; x += 0.11) { c.fillRect(X(x), Y(0.3) + (x < -2 ? 6 : 0), 1, 1); }
    c.fillStyle = 'rgba(30,25,20,0.25)'; c.beginPath(); c.ellipse(X(1.2), Y(-0.5), 60, 7, 0, 0, 7); c.fill();
    return cv;
  }

  function hinged(geom, p0, p1, mat) {
    const pivot = new THREE.Group(); pivot.position.copy(p0);
    pivot.quaternion.setFromUnitVectors(new V3(0, 0, 1), p1.clone().sub(p0).normalize());
    pivot.updateMatrix();
    geom.applyMatrix4(new THREE.Matrix4().copy(pivot.matrix).invert());
    const mesh = new THREE.Mesh(geom, mat); mesh.castShadow = true; pivot.add(mesh);
    return mesh;
  }
  const hitBox = (w, h, d, id) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.userData.id = id; M.hit.push(m); return m; };

  M.build = (scene, Q) => {
    const g = M.group = new THREE.Group(); scene.add(g);
    const ext = M.ext = new THREE.Group(); g.add(ext);
    const paint = new THREE.MeshPhongMaterial({ map: G.tex(paintCanvas()), color: 0xffffff, specular: 0x666666, shininess: 60 });
    const white = new THREE.MeshPhongMaterial({ color: 0xf3f2ed, specular: 0x666666, shininess: 60, vertexColors: true });
    const whiteP = new THREE.MeshPhongMaterial({ color: 0xf3f2ed, specular: 0x666666, shininess: 60 });
    const dark = new THREE.MeshPhongMaterial({ color: 0x1b1c1e, specular: 0x333333, shininess: 30 });
    const metal = new THREE.MeshPhongMaterial({ color: 0xb9bdc2, specular: 0xffffff, shininess: 90 });
    const tyre = new THREE.MeshLambertMaterial({ color: 0x18181a });
    const add = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || ext).add(m); return m; };

    /* fuselage */
    const fg = G.loft(ST, 24);
    { const p = fg.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + 5.8) / 7.9; uv[i * 2 + 1] = (p.getY(i) + 0.6) / 1.45; } fg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    add(fg, paint);
    /* glazing */
    const gb = new G.Batch();
    patch(gb, 4, 5, 30, 150, 10); patch(gb, 5, 6, 28, 152, 10);
    patch(gb, 6, 7, 7, 58, 4); patch(gb, 6, 7, 122, 173, 4);
    patch(gb, 7, 8, 12, 168, 10);
    const glass = new THREE.MeshPhongMaterial({ color: 0x15222b, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.86 });
    const gm = gb.mesh(glass); ext.add(gm);
    // window posts painted over the glass
    const pb = new G.Batch(), post = (x, w) => { for (const sgn of [1, -1]) { const s = { x, w: 0.565, yb: -0.58, yt: 0.80, n: 3.4 }; const a0 = sgn > 0 ? 5 : 124, a1 = sgn > 0 ? 56 : 175; const A2 = Object.assign({}, s, { x: x + w / 2 }), B2 = Object.assign({}, s, { x: x - w / 2 }); for (let j = 0; j < 4; j++) { const t0 = lerp(a0, a1, j / 4) * DEG, t1 = lerp(a0, a1, (j + 1) / 4) * DEG; pb.quad(secPt(A2, t0, 1.02), secPt(A2, t1, 1.02), secPt(B2, t1, 1.02), secPt(B2, t0, 1.02), 0xf3f2ed); } } };
    post(-0.46, 0.09);
    ext.add(pb.mesh(new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x444444, shininess: 40 })));

    /* wings */
    const wcol = (xc, z) => (Math.abs(z) > 5.0 ? 0x17386b : 0xf3f2ed);
    const fsec = (h) => { const t = (h - 0.30) / 1.32; return { z: h, xle: lerp(-4.50, -5.36, t), chord: lerp(1.36, 0.72, t), y: 0, t: 0.09 }; };
    const R = [{ z: 0.5, xle: 0.62, chord: 1.63, y: 0.86, t: 0.12 }, { z: 2.55, xle: 0.62, chord: 1.63, y: 0.91, t: 0.12 }, { z: 4.98, xle: 0.516, chord: 1.187, y: 0.979, t: 0.12 }, { z: 5.02, xle: 0.514, chord: 1.18, y: 0.981, t: 0.12 }, { z: 5.35, xle: 0.50, chord: 1.12, y: 0.99, t: 0.12 }];
    const mir = (arr) => arr.map((s) => Object.assign({}, s, { z: -s.z })).reverse();
    add(G.wing(R, 0, 0.7, 0.02, false, wcol), white); add(G.wing(mir(R), 0, 0.7, 0.02, false, wcol), white);
    add(G.wing([{ z: -0.5, xle: 0.62, chord: 1.63, y: 0.86, t: 0.12 }, { z: 0.5, xle: 0.62, chord: 1.63, y: 0.86, t: 0.12 }], 0, 1, 0.02, false, wcol), white);
    const hx = (s) => s.xle - 0.7 * s.chord;
    const flapSec = [{ z: 0.56, xle: 0.62, chord: 1.63, y: 0.862, t: 0.12 }, R[1]], ailSec = [Object.assign({}, R[1], { z: 2.6 }), { z: 4.98, xle: 0.516, chord: 1.187, y: 0.979, t: 0.12 }, { z: 5.02, xle: 0.514, chord: 1.18, y: 0.981, t: 0.12 }, { z: 5.2, xle: 0.506, chord: 1.147, y: 0.986, t: 0.12 }];
    M.flapR = hinged(G.wing(flapSec, 0.7, 1, 0.02, false, wcol), new V3(hx(flapSec[0]), 0.86, 0.56), new V3(hx(flapSec[1]), 0.91, 2.55), white);
    M.flapL = hinged(G.wing(mir(flapSec), 0.7, 1, 0.02, false, wcol), new V3(hx(flapSec[1]), 0.91, -2.55), new V3(hx(flapSec[0]), 0.86, -0.56), white);
    M.ailR = hinged(G.wing(ailSec, 0.7, 1, 0.02, false, wcol), new V3(hx(ailSec[0]), 0.91, 2.6), new V3(hx(ailSec[3]), 0.986, 5.2), white);
    M.ailL = hinged(G.wing(mir(ailSec), 0.7, 1, 0.02, false, wcol), new V3(hx(ailSec[3]), 0.986, -5.2), new V3(hx(ailSec[0]), 0.91, -2.6), white);
    for (const m of [M.flapR, M.flapL, M.ailR, M.ailL]) ext.add(m.parent);
    /* struts */
    for (const s of [-1, 1]) {
      const a = new V3(0.30, -0.50, s * 0.56), b = new V3(0.22, 0.80, s * 2.55), L = a.distanceTo(b);
      const m = add(new THREE.BoxGeometry(0.13, L, 0.035), whiteP);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    }
    /* tail */
    const HS = [{ z: 0, xle: -4.22, chord: 1.38, y: 0.22, t: 0.09 }, { z: 1.72, xle: -4.60, chord: 0.80, y: 0.22, t: 0.09 }];
    add(G.wing(HS, 0, 0.58, 0, false, wcol), white); add(G.wing(mir(HS), 0, 0.58, 0, false, wcol), white);
    const eh = (s) => s.xle - 0.58 * s.chord;
    M.elevR = hinged(G.wing(HS, 0.58, 1, 0, false, wcol), new V3(eh(HS[0]), 0.22, 0), new V3(eh(HS[1]), 0.22, 1.72), white);
    M.elevL = hinged(G.wing(mir(HS), 0.58, 1, 0, false, wcol), new V3(eh(HS[1]), 0.22, -1.72), new V3(eh(HS[0]), 0.22, 0), white);
    const FIN = [fsec(0.30), fsec(1.16), fsec(1.18), fsec(1.24), fsec(1.26), fsec(1.62)];
    const fcol = (xc, yy) => (yy > 1.25 ? 0x17386b : yy > 1.17 ? 0xe08a1c : 0xf3f2ed);
    add(G.wing(FIN, 0, 0.6, 0, true, fcol), white);
    add(G.wing([{ z: 0.36, xle: -3.1, chord: 1.6, y: 0, t: 0.03 }, { z: 0.72, xle: -4.62, chord: 0.2, y: 0, t: 0.05 }], 0, 1, 0, true, fcol), white);
    const rh = (s) => s.xle - 0.6 * s.chord;
    M.rud = hinged(G.wing([{ z: 0.12, xle: -4.42, chord: 1.40, y: 0, t: 0.085 }, fsec(1.16), fsec(1.18), fsec(1.24), fsec(1.26), fsec(1.62)], 0.6, 1, 0, true, fcol), new V3(rh(FIN[0]), 0.30, 0), new V3(rh(FIN[5]), 1.62, 0), white);
    for (const m of [M.elevR, M.elevL, M.rud]) ext.add(m.parent);
    /* registration */
    {
      const cv = G.canvas(256, 64), c = cv.getContext('2d'); c.fillStyle = '#17386b'; c.font = '700 54px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(AD.CALLSIGN, 128, 35);
      const rb = new G.Batch(), wz = (x) => interp([[-4.8, 0.12], [-3.4, 0.26], [-2.05, 0.42]], x) + 0.014;
      rb.quad([-3.75, 0.06, wz(-3.75)], [-2.45, 0.06, wz(-2.45)], [-2.45, 0.37, wz(-2.45)], [-3.75, 0.37, wz(-3.75)], 0xffffff, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      rb.quad([-2.45, 0.06, -wz(-2.45)], [-3.75, 0.06, -wz(-3.75)], [-3.75, 0.37, -wz(-3.75)], [-2.45, 0.37, -wz(-2.45)], 0xffffff, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      ext.add(rb.mesh(new THREE.MeshLambertMaterial({ map: G.tex(cv), transparent: true, alphaTest: 0.3 })));
    }
    /* landing gear */
    M.wheels = [];
    const wheelGeo = (r, w) => { const c = new THREE.CylinderGeometry(r, r, w, 18); c.rotateX(Math.PI / 2); return c; };
    const pantGeo = (sx) => { const s = new THREE.SphereGeometry(1, 14, 10); s.scale(sx, 0.165, 0.105); return s; };
    for (const s of [-1, 1]) {
      const a = new V3(-0.35, -0.50, s * 0.48), b = new V3(-0.35, -1.0, s * 1.2), L = a.distanceTo(b);
      const leg = add(new THREE.BoxGeometry(0.17, L, 0.045), whiteP);
      leg.position.copy(a).add(b).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
      const wg = new THREE.Group(); wg.position.set(-0.35, -1.05, s * 1.27); ext.add(wg);
      const w = add(wheelGeo(0.2, 0.15), tyre, wg); add(wheelGeo(0.09, 0.16), metal, w);
      const pant = add(pantGeo(0.43), whiteP, wg); pant.position.set(-0.04, 0.045, 0);
      M.wheels.push({ grp: wg, wheel: w, y0: -1.05, leg });
    }
    {
      const ng = new THREE.Group(); ng.position.set(1.30, -1.07, 0); ext.add(ng);
      const w = add(wheelGeo(0.18, 0.13), tyre, ng); add(wheelGeo(0.08, 0.14), metal, w);
      const pant = add(pantGeo(0.36), whiteP, ng); pant.position.set(-0.03, 0.04, 0);
      const fork = add(new THREE.BoxGeometry(0.05, 0.3, 0.2), metal, ng); fork.position.set(0.0, 0.2, 0);
      M.noseStrut = add(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), metal); M.noseStrut.position.set(1.30, -0.62, 0);
      M.wheels.unshift({ grp: ng, wheel: w, y0: -1.07, nose: true });
    }
    /* propeller */
    const pg = M.prop = new THREE.Group(); pg.position.set(2.1, -0.07, 0); ext.add(pg);
    { const sp = new THREE.ConeGeometry(0.15, 0.36, 16); sp.rotateZ(-Math.PI / 2); sp.translate(0.2, 0, 0); add(sp, metal, pg); }
    M.blades = new THREE.Group(); pg.add(M.blades);
    for (const s of [0, Math.PI]) { const bl = new THREE.BoxGeometry(0.035, 0.86, 0.15); bl.translate(0, 0.52, 0); bl.rotateY(0.45); bl.rotateX(s); add(bl, dark, M.blades); const tip = new THREE.BoxGeometry(0.037, 0.09, 0.152); tip.translate(0, 0.905, 0); tip.rotateY(0.45); tip.rotateX(s); add(tip, new THREE.MeshLambertMaterial({ color: 0xe2b21c }), M.blades); }
    {
      const s = 128, cv = G.canvas(s, s), c = cv.getContext('2d');
      const gr = c.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(30,30,30,0)'); gr.addColorStop(0.2, 'rgba(30,30,30,0.5)'); gr.addColorStop(0.86, 'rgba(40,40,40,0.34)'); gr.addColorStop(0.9, 'rgba(226,178,28,0.5)'); gr.addColorStop(0.97, 'rgba(226,178,28,0.4)'); gr.addColorStop(1, 'rgba(40,40,40,0)');
      c.fillStyle = gr; c.fillRect(0, 0, s, s);
      const dg = new THREE.CircleGeometry(0.965, 36); dg.rotateY(Math.PI / 2);
      M.disc = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: G.tex(cv), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      M.disc.position.set(0.02, 0, 0); M.disc.renderOrder = 8; pg.add(M.disc);
    }
    /* lights */
    const lf = M.lf = new G.LightField(10);
    M.li = {
      beacon: lf.add(-5.45, 1.72, 0, 0xff2414, 0.9), navL: lf.add(0.3, 0.99, -5.4, 0xff2414, 0.5), navR: lf.add(0.3, 0.99, 5.4, 0x22e060, 0.5), tail: lf.add(-5.85, 0.3, 0, 0xffffff, 0.4),
      stL: lf.add(0.25, 1.0, -5.42, 0xffffff, 1.6), stR: lf.add(0.25, 1.0, 5.42, 0xffffff, 1.6), land: lf.add(0.66, 0.9, -2.95, 0xfff6e2, 2.4, 1, 0, 0), taxi: lf.add(0.66, 0.9, -2.75, 0xfff6e2, 1.5, 1, 0, 0)
    };
    g.add(lf.build(2.2));
    M.spot = new THREE.SpotLight(0xfff2d8, 0, 420, 0.42, 0.6, 1.2); M.spot.position.set(0.7, 0.9, -2.9); M.spot.target.position.set(60, -5, -2.9); g.add(M.spot); g.add(M.spot.target);

    /* ---------------- cockpit interior ---------------- */
    const inn = M.int = new THREE.Group(); g.add(inn); inn.visible = false;
    const ib = new G.Batch();
    const TRIM = 0x8b867a, DARK = 0x222325, HEAD = 0xc2bdb0, SEAT = 0x4a4d52, CARPET = 0x35363a;
    // floor, side panels below the windows, firewall kick panels, ceiling, aft bulkhead
    ib.quad([0.98, -0.56, -0.56], [0.98, -0.56, 0.56], [-1.95, -0.56, 0.56], [-1.95, -0.56, -0.56], CARPET);
    for (const s of [-1, 1]) {
      const z = s * 0.555, q = [[0.98, -0.56, z], [-1.95, -0.56, z], [-1.95, 0.29, z], [0.98, 0.29, z]];
      if (s > 0) ib.quad(q[0], q[1], q[2], q[3], TRIM); else ib.quad(q[3], q[2], q[1], q[0], TRIM);
      // door post, front post, A-pillar, upper sill
      ib.box(-0.46, z, 0.09, 0.03, 0.52, 0.29, 0, HEAD);
      ib.box(-0.9, z, 2.1, 0.03, 0.05, 0.765, 0, HEAD);
      const p0 = [0.99, 0.34, z], p1 = [0.21, 0.80, z];
      ib.quad([p0[0], p0[1], z - 0.02], [p1[0], p1[1], z - 0.02], [p1[0] - 0.07, p1[1], z - 0.02], [p0[0] - 0.07, p0[1], z - 0.02], HEAD);
      ib.quad([p0[0] - 0.07, p0[1], z + 0.02], [p1[0] - 0.07, p1[1], z + 0.02], [p1[0], p1[1], z + 0.02], [p0[0], p0[1], z + 0.02], HEAD);
      ib.quad([p0[0] - 0.07, p0[1], z - 0.02 * s], [p1[0] - 0.07, p1[1], z - 0.02 * s], [p1[0] - 0.07, p1[1], z + 0.02 * s], [p0[0] - 0.07, p0[1], z + 0.02 * s], HEAD);
    }
    ib.quad([0.24, 0.795, -0.56], [-1.95, 0.795, -0.56], [-1.95, 0.795, 0.56], [0.24, 0.795, 0.56], HEAD);
    ib.quad([-1.95, -0.56, -0.56], [-1.95, -0.56, 0.56], [-1.95, 0.795, 0.56], [-1.95, 0.795, -0.56], 0x6f6b62);
    ib.quad([0.24, 0.795, -0.56], [0.24, 0.795, 0.56], [0.24, 0.74, 0.56], [0.24, 0.74, -0.56], HEAD);
    // glareshield and lower panel surround
    ib.box(0.745, 0, 0.39, 1.12, 0.022, 0.36, 0, DARK);
    ib.quad([0.6, -0.11, -0.56], [0.6, -0.11, 0.56], [0.98, -0.3, 0.56], [0.98, -0.3, -0.56], 0x18191b);
    ib.quad([0.6, -0.11, -0.56], [0.6, -0.56, -0.56], [0.6, -0.56, -0.09], [0.6, -0.11, -0.09], 0x18191b);
    // pedestal
    ib.box(0.47, 0, 0.26, 0.17, 0.42, -0.56, 0, 0x2b2c2f);
    // seats
    for (const s of [-1, 1]) {
      ib.box(-0.32, s * 0.27, 0.46, 0.46, 0.12, -0.33, 0, SEAT); ib.box(-0.60, s * 0.27, 0.1, 0.46, 0.66, -0.25, 0, SEAT); ib.box(-0.62, s * 0.27, 0.08, 0.24, 0.17, 0.43, 0, 0x3f4246);
      ib.box(-1.32, s * 0.27, 0.46, 0.5, 0.12, -0.3, 0, SEAT); ib.box(-1.62, s * 0.27, 0.1, 0.5, 0.6, -0.22, 0, SEAT);
    }
    for (const s of [-1, 1]) for (const zz of [-0.07, 0.07]) ib.box(0.88, s * 0.27 + zz, 0.03, 0.08, 0.11, -0.47, 0, 0x777a7e);
    inn.add(ib.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    // instrument panel face
    const pgeo = new THREE.PlaneGeometry(PANEL.w, PANEL.h); pgeo.rotateY(-Math.PI / 2);
    M.panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    M.panel = new THREE.Mesh(pgeo, M.panelMat); M.panel.position.set(PANEL.x, PANEL.yTop - PANEL.h / 2, 0); inn.add(M.panel);
    // yokes
    const ctrlMat = new THREE.MeshPhongMaterial({ color: 0x1d1e20, specular: 0x555555, shininess: 40 });
    M.yokes = [];
    for (const s of [-1, 1]) {
      const y = new THREE.Group(); y.position.set(0.37, -0.005, s * 0.27); inn.add(y);
      const sh = new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8); sh.rotateZ(Math.PI / 2); sh.translate(0.15, 0, 0); y.add(new THREE.Mesh(sh, metal));
      const bar = new THREE.BoxGeometry(0.03, 0.035, 0.27); y.add(new THREE.Mesh(bar, ctrlMat));
      for (const k of [-1, 1]) { const h = new THREE.BoxGeometry(0.032, 0.115, 0.036); h.translate(0, 0.05, k * 0.135); y.add(new THREE.Mesh(h, ctrlMat)); }
      const hub = new THREE.BoxGeometry(0.035, 0.07, 0.08); y.add(new THREE.Mesh(hub, ctrlMat));
      M.yokes.push(y);
    }
    // throttle, mixture
    const knob = (u, v, col, id) => {
      const k = new THREE.Group(); PANEL.toLocal(u, v, k.position); inn.add(k);
      const sh = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6); sh.rotateZ(Math.PI / 2); sh.translate(0.06, 0, 0); k.add(new THREE.Mesh(sh, metal));
      const kn = new THREE.CylinderGeometry(0.024, 0.024, 0.03, 14); kn.rotateZ(Math.PI / 2); k.add(new THREE.Mesh(kn, new THREE.MeshPhongMaterial({ color: col, specular: 0x666666, shininess: 50 })));
      const hb = hitBox(0.14, 0.085, 0.085, id); hb.position.set(0.02, 0, 0); k.add(hb);
      return k;
    };
    M.thr = knob(1010, 648, 0x161617, 'throttle'); M.mix = knob(1104, 648, 0xb5221b, 'mixture');
    // flap lever
    M.flapLever = new THREE.Group(); PANEL.toLocal(1222, 650, M.flapLever.position); inn.add(M.flapLever);
    { const l = new THREE.BoxGeometry(0.05, 0.013, 0.034); l.translate(-0.025, 0, 0); M.flapLever.add(new THREE.Mesh(l, new THREE.MeshPhongMaterial({ color: 0xe9e9e4 }))); }
    M.flapHitUp = hitBox(0.08, 0.06, 0.07, 'flapUp'); PANEL.toLocal(1222, 590, M.flapHitUp.position, 0.03); inn.add(M.flapHitUp);
    M.flapHitDn = hitBox(0.08, 0.06, 0.07, 'flapDn'); PANEL.toLocal(1222, 715, M.flapHitDn.position, 0.03); inn.add(M.flapHitDn);
    // trim wheel on the pedestal
    M.trimWheel = new THREE.Group(); M.trimWheel.position.set(0.345, -0.25, -0.045); inn.add(M.trimWheel);
    { const w = new THREE.CylinderGeometry(0.062, 0.062, 0.022, 20); w.rotateX(Math.PI / 2); M.trimWheel.add(new THREE.Mesh(w, ctrlMat)); for (let i = 0; i < 12; i++) { const n = new THREE.BoxGeometry(0.008, 0.012, 0.024); n.translate(0.062, 0, 0); n.rotateZ(i * Math.PI / 6); M.trimWheel.add(new THREE.Mesh(n, metal)); } }
    { const hb = hitBox(0.12, 0.17, 0.09, 'trim'); hb.position.set(0.33, -0.25, -0.045); inn.add(hb); }
    M.trimMark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff })); M.trimMark.position.set(0.338, -0.25, 0.0); inn.add(M.trimMark);
    { const sc = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.11, 0.012), new THREE.MeshBasicMaterial({ color: 0x0c0c0d })); sc.position.set(0.339, -0.25, 0.0); inn.add(sc); const to = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.014), new THREE.MeshBasicMaterial({ color: 0x3fbf5a })); to.position.set(0.3385, -0.25 + 0.012, 0.0); inn.add(to); }
    // fuel selector
    M.fuelSel = new THREE.Group(); M.fuelSel.position.set(0.338, -0.43, 0); inn.add(M.fuelSel);
    {
      const cv = G.canvas(128, 128), c = cv.getContext('2d'); c.fillStyle = '#b01c16'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 20px Arial'; c.textAlign = 'center';
      c.fillText('BOTH', 64, 24); c.fillText('L', 16, 70); c.fillText('R', 112, 70); c.font = '600 12px Arial'; c.fillText('FUEL', 64, 118);
      const pl = new THREE.PlaneGeometry(0.11, 0.11); pl.rotateY(-Math.PI / 2); const pm = new THREE.Mesh(pl, new THREE.MeshBasicMaterial({ map: G.tex(cv), transparent: true })); inn.add(pm); pm.position.set(0.339, -0.43, 0); M.fuelPlate = pm;
      const ptr = new THREE.BoxGeometry(0.012, 0.05, 0.012); ptr.translate(0, 0.018, 0); M.fuelSel.add(new THREE.Mesh(ptr, new THREE.MeshPhongMaterial({ color: 0xe9e9e4 })));
      const hb = hitBox(0.05, 0.12, 0.12, 'fuelSel'); hb.position.set(0.33, -0.43, 0); inn.add(hb);
    }
    // parking brake handle
    M.pbrake = new THREE.Group(); M.pbrake.position.set(0.59, -0.15, -0.44); inn.add(M.pbrake);
    { const sh = new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6); sh.rotateZ(Math.PI / 2); sh.translate(0.04, 0, 0); M.pbrake.add(new THREE.Mesh(sh, metal)); const t = new THREE.BoxGeometry(0.016, 0.02, 0.07); M.pbrake.add(new THREE.Mesh(t, ctrlMat)); const hb = hitBox(0.1, 0.08, 0.11, 'parkBrake'); M.pbrake.add(hb); }
    // magnetic compass
    {
      M.compassCv = G.canvas(160, 64); M.compassTex = G.tex(M.compassCv);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.09), ctrlMat); body.position.set(0.56, 0.705, 0); inn.add(body);
      const f = new THREE.PlaneGeometry(0.078, 0.032); f.rotateY(-Math.PI / 2); const fm = new THREE.Mesh(f, new THREE.MeshBasicMaterial({ map: M.compassTex })); fm.position.set(0.524, 0.705, 0); inn.add(fm); M.compassFace = fm;
    }
    for (const h of M.hit) h.renderOrder = 50;
    /* contact shadow for low quality */
    {
      const s = 128, cv = G.canvas(s, s), c = cv.getContext('2d');
      c.filter = 'blur(5px)'; c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillRect(s * 0.46, s * 0.06, s * 0.1, s * 0.84); c.fillRect(s * 0.04, s * 0.33, s * 0.92, s * 0.13); c.fillRect(s * 0.34, s * 0.82, s * 0.32, s * 0.07);
      const pl = new THREE.PlaneGeometry(11.6, 11.6); pl.rotateX(-Math.PI / 2); pl.rotateY(-Math.PI / 2);
      M.blob = new THREE.Mesh(pl, new THREE.MeshBasicMaterial({ map: G.tex(cv), transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 }));
      M.blob.renderOrder = 4; scene.add(M.blob);
    }
  };

  const fwd = new V3(), tq = new THREE.Quaternion();
  M.update = (ac, dt, interiorView, useBlob) => {
    const g = M.group, s = ac.surf, e = ac.eng, el = ac.elec, env = FS.env, P = FS.P;
    g.position.copy(ac.pos); g.quaternion.copy(ac.q);
    M.int.visible = interiorView;
    M.flapR.rotation.z = M.flapL.rotation.z = s.flap * 30 * DEG;
    M.ailR.rotation.z = -s.ail * P.ailMax; M.ailL.rotation.z = s.ail * P.ailMax;
    const ea = s.elev > 0 ? -s.elev * P.elevUp : -s.elev * P.elevDn;
    M.elevR.rotation.z = M.elevL.rotation.z = ea + ac.ctl.trim * 0.05;
    M.rud.rotation.z = s.rud * P.rudMax;
    // gear
    ac.gear.forEach((gr, i) => {
      const w = M.wheels[i]; w.grp.position.y = w.y0 + Math.min(gr.comp, 0.22);
      w.wheel.rotation.z = -gr.spin;
      if (w.nose) { w.grp.rotation.y = -s.steer; M.noseStrut.position.y = -0.62 + Math.min(gr.comp, 0.22) * 0.5; }
    });
    // propeller
    M.prop.rotation.x = e.propAng;
    const blur = sstep(140, 520, e.rpm);
    M.blades.visible = blur < 0.7; M.disc.visible = blur > 0.02;
    M.disc.material.opacity = blur * (interiorView ? 0.3 : 0.8);
    // lights
    const lf = M.lf, li = M.li, t = env.t, bus = el.bus;
    lf.setColor(li.beacon, 0xff2414, bus && el.beacon && (t % 1.1) < 0.14 ? 1 : 0);
    lf.setColor(li.navL, 0xff2414, bus && el.nav ? 0.9 : 0); lf.setColor(li.navR, 0x22e060, bus && el.nav ? 0.9 : 0); lf.setColor(li.tail, 0xffffff, bus && el.nav ? 0.7 : 0);
    const st = bus && el.strobe && ((t % 1.3) < 0.05 || ((t % 1.3) > 0.16 && (t % 1.3) < 0.21)) ? 1 : 0;
    lf.setColor(li.stL, 0xffffff, st); lf.setColor(li.stR, 0xffffff, st);
    lf.setColor(li.land, 0xfff6e2, bus && el.land ? 1 : 0); lf.setColor(li.taxi, 0xfff6e2, bus && el.taxi ? 1 : 0);
    fwd.set(1, 0, 0).applyQuaternion(ac.q);
    for (const i of [li.land, li.taxi]) { lf.dir[i * 3] = fwd.x; lf.dir[i * 3 + 1] = fwd.y; lf.dir[i * 3 + 2] = fwd.z; }
    lf.points.geometry.attributes.color.needsUpdate = true; lf.points.geometry.attributes.aDir.needsUpdate = true;
    const lamp = bus ? (el.land ? 1 : 0) + (el.taxi ? 0.45 : 0) : 0;
    M.spot.intensity = lamp * (0.25 + 1.9 * env.L.nightF);
    // cockpit
    if (interiorView) {
      for (const y of M.yokes) { y.position.x = 0.37 - s.elev * 0.06; y.rotation.x = s.ail * 1.05; y.visible = !M.hideYoke; }
      M.thr.position.x = PANEL.x - 0.035 - (1 - ac.ctl.throttle) * 0.075; M.mix.position.x = PANEL.x - 0.035 - (1 - ac.ctl.mixture) * 0.075;
      M.flapLever.position.y = PANEL.toLocal(1222, 590 + s.flap * 125, tmpV).y;
      M.trimWheel.rotation.z = -ac.ctl.trim * 5; M.trimMark.position.y = -0.25 + ac.ctl.trim * 0.05;
      M.fuelSel.rotation.x = ac.fuel.sel === 'L' ? -1.0 : ac.fuel.sel === 'R' ? 1.0 : 0;
      M.pbrake.position.x = 0.59 - (ac.ctl.parkBrake ? 0.045 : 0);
    }
    // contact shadow
    M.blob.visible = !!useBlob;
    if (useBlob) {
      const gh = FS.groundH(ac.pos.x, ac.pos.z), h = ac.pos.y - gh, L = env.L.lightDir;
      const k = L.y > 0.15 ? h / L.y : 0;
      M.blob.position.set(ac.pos.x - L.x * k, FS.groundH(ac.pos.x - L.x * k, ac.pos.z - L.z * k) + 0.06, ac.pos.z - L.z * k);
      fwd.set(1, 0, 0).applyQuaternion(ac.q); M.blob.rotation.y = -Math.atan2(fwd.z, fwd.x);
      M.blob.material.opacity = 0.5 * clamp(1 - h / 120, 0, 1) * env.L.dirI * sstep(0.1, 0.3, L.y);
    }
  };
  const tmpV = new V3();
})();
