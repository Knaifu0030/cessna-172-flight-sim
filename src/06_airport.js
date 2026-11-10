/* ============================================================
   Coimbatore International (VOCB). Runway frame, metres from THR 05.
   Verified from the AIP: runway, thresholds, slope, lighting, PAPI angles,
   taxiways A / D / E reference points, WDI, DVOR, GP, LOC, NDB, floodlights.
   Approximated: apron outlines, stand positions, building footprints.
   ============================================================ */
(function () {
  const G = FS.G, V3 = THREE.Vector3;
  const A = FS.Airport = {};
  const RW = AD.RWY_LEN, HW = AD.RWY_W / 2;
  const WHITE = 0xe9e9e6, YEL = 0xe6bd1e;

  A.paved = [
    { t: 'runway', n: 'RWY 05/23', x0: 0, x1: RW, z0: -HW, z1: HW },
    { t: 'shoulder', n: '', x0: -60, x1: RW + 60, z0: -HW - 7.5, z1: HW + 7.5 },
    { t: 'taxi', n: 'A', x0: 948.5, x1: 971.5, z0: -148.5, z1: -22.5 },
    { t: 'taxi', n: 'E', x0: 1215, x1: 2975, z0: -171.5, z1: -148.5 },
    { t: 'taxi', n: 'E', x0: 2952, x1: 2975, z0: -171.5, z1: -22.5 },
    { t: 'apron', n: 'Main apron', x0: 870, x1: 1425, z0: -290, z1: -148.5 },
    { t: 'apron', n: 'Apron 2', x0: 1480, x1: 1650, z0: -265, z1: -171.5 },
    { t: 'apron', n: 'Isolation', x0: 1840, x1: 1990, z0: -245, z1: -171.5 },
    { t: 'apron', n: 'Apron 4', x0: 2230, x1: 2530, z0: -275, z1: -171.5 },
    { t: 'taxi', n: 'D', x0: 994.75, x1: 1005.25, z0: 22.5, z1: 205 },
    { t: 'apron', n: 'Flying Club', x0: 950, x1: 1092, z0: 205, z1: 271 }
  ];
  FS.surfaceAt = (x, z) => {
    for (const r of A.paved) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.t;
    return 'grass';
  };
  A.stands = [];
  for (let i = 0; i < 11; i++) A.stands.push({ n: String(i + 1), x: 905 + i * 47, zl: -160, zn: -236 });
  A.stands.push({ n: '13', x: 1525, zl: -160, zn: -232 }, { n: '14', x: 1605, zl: -160, zn: -232 });
  for (let i = 0; i < 5; i++) A.stands.push({ n: String(16 + i), x: 2262 + i * 59, zl: -160, zn: -240 });
  A.buildings = [
    { n: 'Terminal', x0: 955, x1: 1255, z0: -346, z1: -298, h: 19 },
    { n: 'Tower', x0: 1303, x1: 1333, z0: -334, z1: -310, h: 34 },
    { n: 'Fire station', x0: 789, x1: 835, z0: -216, z1: -194, h: 13 },
    { n: 'Cargo', x0: 1365, x1: 1435, z0: -355, z1: -315, h: 14 },
    { n: 'Flying Club', x0: 975, x1: 1025, z0: 273, z1: 307, h: 12 },
    { n: 'Hangar', x0: 1035, x1: 1085, z0: 273, z1: 311, h: 14 }
  ];
  FS.obstacles = A.buildings.map((b) => [b.x0, b.x1, b.z0, b.z1, b.h, 'the ' + b.n.toLowerCase()]);

  /* ---- simple airliners (no real liveries) ---- */
  function airliner(batch, type, x, z, yaw, tailCol) {
    const big = type === 'jet';
    const Lh = big ? 18.8 : 13.6, r = big ? 1.98 : 1.32, cy = big ? 3.5 : 2.55;
    const st = [], ns = [[1, 0.02, 0.3], [0.97, 0.3, 0.2], [0.9, 0.62, 0.05], [0.8, 0.9, 0], [0.66, 1, 0], [-0.35, 1, 0], [-0.62, 0.8, 0.12], [-0.85, 0.42, 0.42], [-1, 0.1, 0.72]];
    for (const [f, k, lift] of ns) st.push({ x: f * Lh, w: r * k, yb: cy - r * k + lift * r, yt: cy + r * k + lift * r * 0.4, n: 2.1 });
    const fus = G.loft(st, 14, (px, py) => (px < -Lh * 0.62 ? tailCol : py < cy - r * 0.55 ? 0xb9bec4 : 0xf2f3f1));
    const m = new THREE.Matrix4().compose(new V3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw), new V3(1, 1, 1));
    batch.geo(fus, m, null);
    const span = big ? 17 : 13.5, wy = big ? cy - r * 0.55 : cy + r * 0.85, sweep = big ? 7.2 : 0.6;
    const half = (s) => [{ z: 0, xle: big ? 3.2 : 1.6, chord: big ? 6.4 : 2.9, y: wy, t: 0.12 }, { z: s * span, xle: (big ? 3.2 : 1.6) - sweep, chord: big ? 1.6 : 1.5, y: wy + (big ? 1.3 : 0.2), t: 0.1 }];
    batch.geo(G.wing(half(-1).reverse(), 0, 1, 0.01), m, 0xdfe2e4);
    batch.geo(G.wing(half(1), 0, 1, 0.01), m, 0xdfe2e4);
    const ts = big ? 6.2 : 3.6, tx = -Lh + (big ? 4.6 : 3.0), ty = big ? cy + r * 0.75 : cy + r * 0.7 + 4.2;
    const hst = (s) => [{ z: 0, xle: tx, chord: big ? 3.6 : 2.0, y: ty, t: 0.1 }, { z: s * ts, xle: tx - (big ? 3.2 : 0.5), chord: big ? 1.3 : 1.1, y: ty + (big ? 0.5 : 0), t: 0.09 }];
    batch.geo(G.wing(hst(-1).reverse(), 0, 1, 0), m, 0xe4e6e8);
    batch.geo(G.wing(hst(1), 0, 1, 0), m, 0xe4e6e8);
    const fh = big ? 6.0 : 4.4, fb = cy + r * 0.8;
    batch.geo(G.wing([{ z: fb, xle: -Lh + (big ? 6.8 : 5.0), chord: big ? 5.6 : 3.8, y: 0, t: 0.1 }, { z: fb + fh, xle: -Lh + (big ? 1.6 : 2.2), chord: big ? 2.0 : 1.9, y: 0, t: 0.09 }], 0, 1, 0, true), m, tailCol);
    for (const s of [-1, 1]) {
      const eg = new THREE.CylinderGeometry(big ? 1.05 : 0.5, big ? 0.85 : 0.42, big ? 3.6 : 2.8, 10); eg.rotateZ(Math.PI / 2);
      eg.translate(big ? 3.4 : 2.6, big ? cy - r * 1.05 : wy - 0.25, s * (big ? 5.7 : 4.0));
      batch.geo(eg, m, 0x9aa1a8);
      const leg = new THREE.BoxGeometry(0.5, cy - r * 0.6, 0.9); leg.translate(big ? -1.6 : -0.6, (cy - r * 0.6) / 2, s * (big ? 3.8 : 2.0));
      batch.geo(leg, m, 0x44474b);
    }
    const nl = new THREE.BoxGeometry(0.4, cy - r * 0.8, 0.6); nl.translate(Lh * 0.72, (cy - r * 0.8) / 2, 0); batch.geo(nl, m, 0x44474b);
    FS.obstacles.push([x - span, x + span, z - Lh, z + Lh, cy + 2, 'a parked airliner']);
  }

  A.build = (scene, Q) => {
    const grp = A.group = new THREE.Group();
    grp.matrixAutoUpdate = false;
    grp.matrix.set(1, 0, 0, 0, -AD.SLOPE, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    scene.add(grp);
    const po = (f) => ({ polygonOffset: true, polygonOffsetFactor: -f, polygonOffsetUnits: -4 * f });

    /* ---- grass ---- */
    const grassTex = G.tex(G.surfaceCanvas(256, 0x878a58, 0.3, 21, (c, s, rnd) => {
      for (let i = 0; i < 260; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(150,140,90,0.13)' : 'rgba(70,95,50,0.13)'; c.beginPath(); c.arc(rnd() * s, rnd() * s, 2 + rnd() * 9, 0, 7); c.fill(); }
    }), true);
    grassTex.repeat.set(1 / 46, 1 / 46);
    const gb = new G.Batch(), gc = new THREE.Color();
    for (let i = 0; i < 40; i++) for (let j = 0; j < 10; j++) {
      const x0 = -470 + i * 98.5, z0 = -500 + j * 94, n = fbm(i * 0.37 + 2, j * 0.41 + 5, 3), n2 = hash2(i * 7 + 1, j * 13 + 3);
      gc.setRGB(Math.min(1, 0.72 + n * 0.28 + n2 * 0.05), Math.min(1, 0.72 + n * 0.24 + n2 * 0.04), Math.min(1, 0.7 + n * 0.16));
      gb.rect(x0, z0, x0 + 98.5, z0 + 94, 0, gc.getHex());
    }
    const grass = gb.mesh(new THREE.MeshLambertMaterial(Object.assign({ map: grassTex, vertexColors: true }, po(1)))); grass.receiveShadow = true; grp.add(grass);

    /* ---- pavements ---- */
    const asTex = G.tex(G.surfaceCanvas(256, 0x58595b, 0.2, 5, (c, s, rnd) => {
      c.strokeStyle = 'rgba(20,20,22,0.35)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { c.beginPath(); let x = rnd() * s, y = rnd() * s; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    }), true);
    asTex.repeat.set(1 / 28, 1 / 28);
    const coTex = G.tex(G.surfaceCanvas(256, 0x9c9a93, 0.14, 9, (c, s) => {
      c.strokeStyle = 'rgba(40,40,40,0.4)'; c.lineWidth = 1.5; c.strokeRect(0.5, 0.5, s - 1, s - 1); c.beginPath(); c.moveTo(s / 2, 0); c.lineTo(s / 2, s); c.moveTo(0, s / 2); c.lineTo(s, s / 2); c.stroke();
    }), true);
    coTex.repeat.set(1 / 15, 1 / 15);
    const asB = new G.Batch(), coB = new G.Batch();
    for (const r of A.paved) {
      if (r.t === 'shoulder') asB.rect(r.x0, r.z0, r.x1, r.z1, 0, 0xd6d6d6);
      else if (r.t === 'runway') asB.rect(r.x0, r.z0, r.x1, r.z1, 0.012, 0x9c9c9f);
      else if (r.t === 'taxi') asB.rect(r.x0, r.z0, r.x1, r.z1, 0.006, 0xbdbdbf);
      else coB.rect(r.x0, r.z0, r.x1, r.z1, 0.004, r.n === 'Flying Club' ? 0xd2cfc6 : 0xffffff);
    }
    // perimeter road and car park
    asB.strip(-458, -488, 3458, -488, 5, 0, 0xcfcfcf); asB.strip(-458, 428, 3458, 428, 5, 0, 0xcfcfcf);
    asB.strip(-458, -488, -458, 428, 5, 0, 0xcfcfcf); asB.strip(3458, -488, 3458, 428, 5, 0, 0xcfcfcf);
    asB.rect(985, -458, 1228, -366, 0, 0xc4c4c6); asB.rect(1097, -500, 1113, -346, 0.002, 0xb8b8ba);
    asB.rect(820, -194, 874, -170, 0, 0xc6c6c8);
    const asMat = new THREE.MeshPhongMaterial(Object.assign({ map: asTex, vertexColors: true, shininess: 4, specular: 0x555555 }, po(2)));
    const coMat = new THREE.MeshPhongMaterial(Object.assign({ map: coTex, vertexColors: true, shininess: 4, specular: 0x555555 }, po(2)));
    FS.World.wetMats = [asMat, coMat];
    for (const [b, m] of [[asB, asMat], [coB, coMat]]) { const me = b.mesh(m); me.receiveShadow = true; me.renderOrder = 1; grp.add(me); }

    /* ---- markings ---- */
    const mk = new G.Batch(), atlas = new G.Atlas(1024, 64), dc = new G.Batch();
    const Y = 0.02;
    const both = (fn) => { fn((x) => x, 1); fn((x) => RW - x, -1); };
    both((X, s) => {
      const R = (xa, xb, za, zb, col) => { const x0 = Math.min(X(xa), X(xb)), x1 = Math.max(X(xa), X(xb)), z0 = Math.min(za * s, zb * s), z1 = Math.max(za * s, zb * s); mk.rect(x0, z0, x1, z1, Y, col || WHITE); };
      for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) R(6, 36, sd * (1.8 + i * 3.4), sd * (1.8 + i * 3.4 + 1.7));
      const tdz = [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]];
      for (const [d, n] of tdz) for (let k = 0; k < n; k++) for (const sd of [-1, 1]) R(d, d + 22.5, sd * (9 + k * 3.3), sd * (9 + k * 3.3 + 1.8));
      for (const sd of [-1, 1]) R(400, 450, sd * 9, sd * 16.5);
      // tyre marks
      for (const sd of [-1, 1]) R(250, 780, sd * 1.6, sd * 5.2, 0x35363a);
    });
    for (let x = 75; x < RW - 100; x += 50) mk.rect(x, -0.45, x + 30, 0.45, Y, WHITE);
    mk.rect(0, -HW + 0.4, RW, -HW + 1.3, Y, WHITE); mk.rect(0, HW - 1.3, RW, HW - 0.4, Y, WHITE);
    mk.rect(-0.9, -HW, 0.9, HW, Y, WHITE); mk.rect(RW - 0.9, -HW, RW + 0.9, HW, Y, WHITE);
    const num = (t) => atlas.text('rw' + t, t, 4, 3, '#ffffff');
    dc.decal(52, 0, 13, 17, Y + 0.004, 0, WHITE, num('05'));
    dc.decal(RW - 52, 0, 13, 17, Y + 0.004, Math.PI, WHITE, num('23'));
    // taxi centre lines
    const TL = (ax, az, bx, bz, w) => mk.strip(ax, az, bx, bz, w || 0.42, Y, YEL);
    TL(960, -160, 960, -34); TL(960, -34, 990, -2); TL(960, -34, 930, -2);
    TL(885, -160, 2963.5, -160); TL(2963.5, -160, 2963.5, -34); TL(2963.5, -34, 2935, -2);
    TL(1000, 246, 1000, 34); TL(1000, 34, 1030, 2); TL(1000, 34, 970, 2);
    TL(1000, 246, 1000, 262, 0.26); TL(962, 246, 1080, 246, 0.26);
    // holding positions: solid pair away from runway, dashed pair toward it
    const hold = (x0, x1, zc, toward) => {
      mk.rect(x0, zc - 0.2 - 1.3 * toward, x1, zc + 0.2 - 1.3 * toward, Y, YEL); mk.rect(x0, zc - 0.2 - 0.55 * toward, x1, zc + 0.2 - 0.55 * toward, Y, YEL);
      for (let x = x0 + 0.3; x < x1 - 0.6; x += 1.8) { mk.rect(x, zc - 0.2 + 0.2 * toward, x + 0.9, zc + 0.2 + 0.2 * toward, Y, YEL); mk.rect(x, zc - 0.2 + 0.95 * toward, x + 0.9, zc + 0.2 + 0.95 * toward, Y, YEL); }
    };
    hold(948.5, 971.5, -91, 1); hold(2952, 2975, -91, 1); hold(994.75, 1005.25, 91, -1);
    // stands
    for (const st of A.stands) {
      TL(st.x, st.zl, st.x, st.zn, 0.36); mk.rect(st.x - 3, st.zn - 0.25, st.x + 3, st.zn + 0.25, Y, YEL);
      dc.decal(st.x + 5.5, st.zl - 16, 5, 5.5, Y + 0.004, -Math.PI / 2, YEL, atlas.text('st' + st.n, st.n, 2, 2, '#ffffff'));
    }
    for (const x of [1915]) { TL(x, -160, x, -225, 0.36); mk.rect(x - 3, -225.25, x + 3, -224.75, Y, YEL); }
    for (const x of [968, 1040, 1068]) { mk.rect(x - 3, 258.8, x + 3, 259.2, Y, YEL); mk.rect(x - 0.2, 252, x + 0.2, 259, Y, YEL); }
    // signal area with landing T
    mk.rect(924, -114, 936, -102, Y, 0x1a1b1d); mk.rect(925.5, -108.6, 934.5, -107.4, Y + 0.003, WHITE); mk.rect(933.3, -111.5, 934.5, -104.5, Y + 0.003, WHITE);
    // car park bays
    for (let r = 0; r < 4; r++) for (let x = 990; x < 1224; x += 2.7) if (Math.abs(x - 1105) > 9) mk.rect(x, -452 + r * 22, x + 0.12, -447 + r * 22, Y, 0xcfcfcf);
    const mkMesh = mk.mesh(new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, po(3)))); mkMesh.renderOrder = 2; mkMesh.receiveShadow = true; grp.add(mkMesh);

    /* ---- structures ---- */
    const sb = new G.Batch(), gl = new G.Batch(), em = new G.Batch();
    const lights = A.lights = new G.LightField(2600);
    const WALL = 0xd8d4cb, ROOF = 0x8d969b, CONC = 0xc9c5ba;
    // terminal
    sb.box(1105, -322, 300, 48, 13, 0, 0, WALL, ROOF);
    sb.box(1105, -322, 120, 42, 5, 13, 0, 0xe4e1d9, ROOF); sb.vault(1105, -322, 120, 42, 18, 2.6, 0, 0x7f8a90);
    sb.box(1105, -293, 306, 11, 0.7, 12.6, 0, 0x9aa3a8); sb.box(1105, -352, 306, 12, 0.7, 9.5, 0, 0x9aa3a8);
    for (let x = 962; x <= 1250; x += 24) { sb.cyl(x, -289, 0.45, 0.45, 12.6, 0, 0xbfc2c4, 6); sb.cyl(x, -357, 0.4, 0.4, 9.5, 0, 0xbfc2c4, 6); }
    gl.quad([960, 1.6, -297.9], [1250, 1.6, -297.9], [1250, 11.4, -297.9], [960, 11.4, -297.9], 0xffffff);
    gl.quad([1250, 2, -346.1], [960, 2, -346.1], [960, 9, -346.1], [1250, 9, -346.1], 0xffffff);
    for (let x = 972; x < 1250; x += 12) sb.box(x, -297.75, 0.5, 0.3, 9.8, 1.6, 0, 0xe9e7e2);
    for (const bx of [999, 1093]) { sb.box(bx - 5, -271, 3.2, 54, 3, 4.2, 0, 0xcdd2d6, 0x8f979c); sb.cyl(bx - 5, -247, 0.5, 0.5, 4.2, 0, 0x8a8f94, 6); sb.box(bx - 5, -246, 4.2, 4.2, 3.4, 4, 0, 0xb9bfc4); }
    // control tower
    const [tx, tz] = AD.TOWER;
    sb.box(tx, tz, 30, 24, 9, 0, 0, WALL, ROOF); sb.box(tx, tz, 7.5, 7.5, 26, 0, 0, 0xe3e0d8);
    sb.cyl(tx, tz, 5.2, 6.6, 1.2, 25.2, 0xd0cdc6, 8); gl.cyl(tx, tz, 6.4, 7.0, 3.4, 26.4, 0xffffff, 8, 0x9aa3a8);
    sb.cyl(tx, tz, 7.6, 1.2, 1.4, 29.8, 0x8d969b, 8); sb.cyl(tx, tz, 0.16, 0.1, 5.5, 31.2, 0xd8d8d8, 5);
    // fire station
    sb.box(812, -205, 46, 22, 8, 0, 0, 0xcfc8ba, 0x9a8f85); sb.box(832, -211, 6, 6, 13, 0, 0, 0xcfc8ba, 0x9a8f85);
    for (let i = 0; i < 4; i++) sb.box(797 + i * 9, -193.8, 6.5, 0.4, 5.6, 0, 0, 0xb32a22);
    for (let i = 0; i < 3; i++) { sb.box(830 + i * 12, -182, 9, 3, 2.6, 0.6, 0, 0xc4281f, 0xd9d9d9); sb.box(833.5 + i * 12, -182, 2.4, 2.8, 1.0, 3.2, 0, 0xc4281f); }
    // cargo complex and fuel
    sb.box(1400, -335, 70, 40, 9, 0, 0, 0xbfc6c9, 0x7e888d); sb.vault(1400, -335, 70, 40, 9, 4, 0, 0x8e989d);
    for (let i = 0; i < 3; i++) sb.cyl(1500 + i * 17, -335, 6, 6, 9, 0, 0xe8e8e4, 12, 0xcfd2d0);
    for (const [bx, bz, r] of [[1445, -276, 0], [1451, -262, 0.2]]) { sb.box(bx, bz, 3, 9.5, 2.8, 0.7, r, 0xe9e9e9, 0xd9d9d9); sb.box(bx, bz - 5.6, 2.8, 2.6, 2.4, 0.7, r, 0x2f6fb5); }
    // hangars
    sb.box(1000, 290, 50, 34, 7, 0, 0, 0xc8ccc8); sb.vault(1000, 290, 34, 50, 7, 5, Math.PI / 2, 0x9aa5a0);
    sb.box(1060, 292, 50, 38, 8, 0, 0, 0xbcc3c6); sb.vault(1060, 292, 38, 50, 8, 6, Math.PI / 2, 0x87939a);
    em.quad([1021, 0.02, 272.9], [979, 0.02, 272.9], [979, 6.4, 272.9], [1021, 6.4, 272.9], 0x1b1e21);
    em.quad([1082, 0.02, 272.9], [1038, 0.02, 272.9], [1038, 7.2, 272.9], [1082, 7.2, 272.9], 0x1b1e21);
    {
      const uvr = atlas.add('fc', 12, 1, (c, w, h) => { c.fillStyle = '#16324f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1e6'; c.font = '700 ' + Math.floor(h * 0.62) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('COIMBATORE FLYING CLUB', w / 2, h * 0.54, w * 0.95); });
      const [u0, v0, u1, v1] = uvr;
      dc.quad([1016, 7.2, 272.8], [984, 7.2, 272.8], [984, 9.9, 272.8], [1016, 9.9, 272.8], 0xffffff, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      const uv2 = atlas.add('term', 12, 1, (c, w, h) => { c.fillStyle = '#1d3a5c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = '700 ' + Math.floor(h * 0.6) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('COIMBATORE INTERNATIONAL AIRPORT', w / 2, h * 0.54, w * 0.95); });
      const [a0, b0, a1, b1] = uv2;
      dc.quad([1075, 13.6, -297.7], [1135, 13.6, -297.7], [1135, 17.4, -297.7], [1075, 17.4, -297.7], 0xffffff, [[a0, b0], [a1, b0], [a1, b1], [a0, b1]]);
    }
    // boundary wall
    const wall = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); sb.box((ax + bx) / 2, (az + bz) / 2, L, 0.35, 2.5, 0, Math.atan2(bz - az, bx - ax), 0xb9b3a6); };
    wall(-470, -500, 1090, -500); wall(1120, -500, 3470, -500); wall(-470, 440, 3470, 440); wall(-470, -500, -470, 440); wall(3470, -500, 3470, 440);
    // navaids
    const mast = (x, z, h, light) => { for (let i = 0; i < 6; i++) sb.cyl(x, z, 0.22, 0.22, h / 6, i * h / 6, i % 2 ? 0xe9e9e9 : 0xd8402b, 5); if (light !== false) lights.add(x, h + 0.6, z, 0xff2a18, 1.8); };
    { const [x, z] = AD.DVOR; sb.box(x, z, 9, 9, 3.6, 0, 0, 0xe6e4dd); sb.cyl(x, z, 15, 15, 0.35, 4.6, 0xd8d8d4, 20, 0xcfcfcb); for (let i = 0; i < 8; i++) sb.cyl(x + Math.cos(i * 0.785) * 12, z + Math.sin(i * 0.785) * 12, 0.15, 0.15, 4.6, 0, 0xb5b5b5, 4); sb.cyl(x, z, 1.1, 0.8, 2.2, 4.95, 0xf0f0ec, 8); for (let i = 0; i < 24; i++) sb.cyl(x + Math.cos(i * 0.2618) * 13.5, z + Math.sin(i * 0.2618) * 13.5, 0.25, 0.25, 1.2, 4.95, 0xf0f0ec, 4); lights.add(x, 8, z, 0xff2a18, 1.6); }
    { const [x, z] = AD.GP; sb.box(x - 4, z + 3, 3.2, 3.2, 2.7, 0, 0, 0xe6e4dd); mast(x, z, 16); for (const yy of [6, 10.5, 15]) sb.box(x, z, 0.4, 2.6, 1.2, yy, 0, 0xe65a2a); }
    { const [x, z] = AD.LOC; sb.box(x, z, 1.2, 34, 0.5, 2.6, 0, 0xe65a2a); for (let i = -7; i <= 7; i++) { sb.cyl(x, z + i * 2.3, 0.08, 0.08, 2.6, 0, 0xcfcfcf, 4); sb.box(x + 0.9, z + i * 2.3, 1.6, 0.25, 1.1, 2.4, 0, 0xe65a2a); } sb.box(x, 62, 4, 3.5, 2.8, 0, 0, 0xe6e4dd); lights.add(x, 3.6, -16, 0xff2a18, 1.4); lights.add(x, 3.6, 16, 0xff2a18, 1.4); }
    { const [x, z] = AD.NDBPOS; mast(x, z, 22); sb.box(x + 5, z, 3.5, 3.5, 2.7, 0, 0, 0xe6e4dd); }
    // PAPI boxes
    A.papi = [];
    for (let i = 0; i < 4; i++) {
      const z05 = -(HW + 15 + 9 * i), z23 = HW + 15 + 9 * i;
      sb.box(320, z05, 1.1, 1.3, 0.5, 0.25, 0, 0xe66a1e); sb.box(2640, z23, 1.1, 1.3, 0.5, 0.25, 0, 0xe66a1e);
      A.papi.push({ x: 320, z: z05, z0: z05, k: i, y: 0.7, set: AD.PAPI05 + (1.5 - i) / 3, dir: -1 }, { x: 2640, z: z23, z0: z23, k: i, y: 0.7, set: AD.PAPI23 + (1.5 - i) / 3, dir: 1 });
    }
    // windsock mast
    sb.cyl(AD.WDI[0], AD.WDI[1], 0.12, 0.08, 6.2, 0, 0xe9e9e9, 6); lights.add(AD.WDI[0], 6.9, AD.WDI[1], 0xfff2d6, 1.2);
    // floodlight masts (first three from the AIP obstacle list)
    A.floods = [[1068, -277], [1151, -278], [1259, -250], [905, -284], [1385, -284], [1565, -262], [1915, -242], [2300, -272], [2460, -272], [1020, 268]];
    for (const [x, z] of A.floods) { sb.cyl(x, z, 0.42, 0.24, 21, 0, 0xa9aeb2, 6); sb.box(x, z, 3.4, 0.9, 1.1, 21, 0, 0x8d9296); lights.add(x, 21.6, z, 0xfff3da, 3.4); }
    // car park cars, ground vehicles
    const rnd = mulberry32(555), carCol = [0xe9e9e9, 0xb9bcc0, 0x7a2a2a, 0x2c3d55, 0x1d1d1f, 0xcbb38a, 0x8a9aa8, 0xf2f2f2];
    for (let r = 0; r < 4; r++) for (let x = 991.4; x < 1224; x += 2.7) if (Math.abs(x - 1105) > 10 && rnd() < 0.62) { const c = carCol[Math.floor(rnd() * carCol.length)]; sb.box(x, -449.5 + r * 22, 1.75, 4.1, 0.75, 0.3, 0, c); sb.box(x, -449.7 + r * 22, 1.6, 2.2, 0.55, 1.05, 0, 0x2a3138); }
    for (const [x, z, w, d, h, c] of [[1010, -252, 2.6, 4.2, 1.7, 0xe2b21c], [1104, -250, 2.6, 4.2, 1.7, 0xe2b21c], [1250, -262, 2.6, 11, 3, 0xf1f1ee], [925, -262, 2.6, 11, 3, 0xf1f1ee], [1180, -270, 2.2, 5, 2, 0xdedede], [1300, -272, 2, 3.4, 1.6, 0x2f6fb5], [2340, -262, 2.6, 4.2, 1.7, 0xe2b21c], [1048, 262, 2, 4.2, 1.6, 0xd8d8d8]]) sb.box(x, z, w, d, h, 0.3, 0, c);
    for (let i = 0; i < 5; i++) sb.box(1022 + i * 3.4, -258, 2.6, 1.6, 1.1, 0.4, 0, 0x8c9399);
    // hold-position signs
    const sign = (x, z, face, name) => {
      const uvr = atlas.add('sg' + name, 6, 2, (c, w, h) => {
        c.fillStyle = '#111'; c.fillRect(0, 0, w * 0.3, h); c.strokeStyle = '#f2c500'; c.lineWidth = h * 0.07; c.strokeRect(h * 0.07, h * 0.07, w * 0.3 - h * 0.14, h - h * 0.14);
        c.fillStyle = '#f2c500'; c.font = '700 ' + Math.floor(h * 0.74) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, w * 0.15, h * 0.55);
        c.fillStyle = '#c4261d'; c.fillRect(w * 0.3, 0, w * 0.7, h); c.fillStyle = '#fff'; c.fillText('05-23', w * 0.65, h * 0.55, w * 0.62);
      });
      const [u0, v0, u1, v1] = uvr, w = 3.6, y0 = 0.5, y1 = 1.7, zz = z - face * 0.16;
      sb.box(x, z, w + 0.2, 0.3, 1.3, 0.45, 0, 0x2a2a2a); sb.cyl(x - 1.2, z, 0.06, 0.06, 0.5, 0, 0x888888, 4); sb.cyl(x + 1.2, z, 0.06, 0.06, 0.5, 0, 0x888888, 4);
      if (face < 0) dc.quad([x + w / 2, y0, zz], [x - w / 2, y0, zz], [x - w / 2, y1, zz], [x + w / 2, y1, zz], 0xffffff, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      else dc.quad([x - w / 2, y0, z + 0.16], [x + w / 2, y0, z + 0.16], [x + w / 2, y1, z + 0.16], [x - w / 2, y1, z + 0.16], 0xffffff, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    };
    sign(978, -92.5, -1, 'A'); sign(2981.5, -92.5, -1, 'E'); sign(992, 92.5, 1, 'D');
    // airliners
    const lb = new G.Batch(), yaw = Math.PI / 2;
    airliner(lb, 'jet', A.stands[2].x, -236 + 18.8 + 3, yaw, 0x25357a); airliner(lb, 'jet', A.stands[4].x, -236 + 18.8 + 3, yaw, 0xc23a2e);
    airliner(lb, 'jet', A.stands[7].x, -236 + 18.8 + 3, yaw, 0x25357a); airliner(lb, 'prop', A.stands[0].x, -236 + 13.6 + 6, yaw, 0x1f7a6d);
    airliner(lb, 'prop', A.stands[9].x, -236 + 13.6 + 6, yaw, 0xd98a1f); airliner(lb, 'jet', A.stands[14].x, -240 + 18.8 + 3, yaw, 0x25357a);
    const flat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const sMesh = sb.mesh(flat); sMesh.castShadow = false; grp.add(sMesh);
    const lMesh = lb.mesh(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x444444 })); grp.add(lMesh);
    A.glassMat = new THREE.MeshPhongMaterial({ color: 0x2c4257, specular: 0xaabbcc, shininess: 90, emissive: 0x000000, side: THREE.DoubleSide });
    grp.add(gl.mesh(A.glassMat));
    grp.add(em.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
    const dMesh = dc.mesh(new THREE.MeshLambertMaterial(Object.assign({ map: atlas.texture(), vertexColors: true, alphaTest: 0.35, side: THREE.DoubleSide }, po(4)))); dMesh.renderOrder = 3; grp.add(dMesh);

    /* ---- lighting ---- */
    for (let x = 0; x <= RW; x += 59.8) { lights.add(x, 0.4, -HW - 1.6, 0xfff0d2, 1.3); lights.add(x, 0.4, HW + 1.6, 0xfff0d2, 1.3); }
    for (let z = -21; z <= 21; z += 3) {
      lights.add(-1.2, 0.3, z, 0x24e060, 1.0, -1, 0.1, 0); lights.add(1.2, 0.3, z, 0xff2414, 1.0, 1, 0.1, 0);
      lights.add(RW + 1.2, 0.3, z, 0x24e060, 1.0, 1, 0.1, 0); lights.add(RW - 1.2, 0.3, z, 0xff2414, 1.0, -1, 0.1, 0);
    }
    for (let k = 1; k <= 7; k++) for (const [x, d] of [[-60 * k, -1], [RW + 60 * k, 1]]) {
      for (let z = -3; z <= 3; z += 1.5) lights.add(x, 0.6 + k * 0.12, z, 0xfff6e4, 1.25, d, 0.1, 0);
      if (k === 5) for (const sd of [-1, 1]) for (let j = 0; j < 4; j++) lights.add(x, 1.2, sd * (6 + j * 2.6), 0xfff6e4, 1.25, d, 0.1, 0);
      sb.cyl(x, 0, 0.05, 0.05, 0.6 + k * 0.12, 0, 0xbbbbbb, 4);
    }
    const blue = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 30)); for (let i = 0; i <= n; i++) lights.add(lerp(ax, bx, i / n), 0.35, lerp(az, bz, i / n), 0x2a58ff, 0.75); };
    blue(947, -148, 947, -34); blue(973, -148, 973, -34); blue(1425, -147, 2950, -147); blue(1215, -173, 1480, -173); blue(1650, -173, 1840, -173); blue(1990, -173, 2230, -173); blue(2530, -173, 2976.5, -173);
    blue(2950.5, -147, 2950.5, -34); blue(2976.5, -173, 2976.5, -34); blue(870, -147, 946, -147); blue(974, -147, 1215, -147); blue(868.5, -290, 868.5, -149);
    for (let x = 965; x <= 1245; x += 20) lights.add(x, 11.8, -292, 0xffe9c4, 1.5);
    for (let x = 1000; x <= 1210; x += 42) for (const z of [-440, -396]) { lights.add(x, 8, z, 0xffdcae, 1.8); }
    lights.add(tx, 37, tz, 0xff2a18, 1.8); lights.add(1000, 9.5, 272, 0xffe9c4, 1.6); lights.add(1060, 10.5, 272, 0xffe9c4, 1.6);
    grp.add(lights.build(2.2)); lights.mat.uniforms.uMinPx.value = 3.2; lights.mat.uniforms.uPow.value = 0.22;
    A.papiLF = new G.LightField(8); for (const p of A.papi) p.i = A.papiLF.add(p.x, p.y, p.z, 0xffffff, 1.7, p.dir, 0.06, 0);
    grp.add(A.papiLF.build(1.4, true)); A.papiLF.always = true; A.papiLF.mat.uniforms.uMinPx.value = 3.0; A.papiLF.mat.uniforms.uPow.value = 0.1; A.papiLF.points.renderOrder = 21;
    A.beaconLF = new G.LightField(2); A.beaconLF.add(tx, 32.4, tz, 0xffffff, 3.2); grp.add(A.beaconLF.build(1.5)); A.beaconLF.always = true; A.beaconLF.mat.uniforms.uMinPx.value = 3.5;
    // floodlight pools on the aprons
    {
      const s = 128, cv = G.canvas(s, s), c = cv.getContext('2d'), g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,236,200,0.85)'); g.addColorStop(0.5, 'rgba(255,230,190,0.32)'); g.addColorStop(1, 'rgba(255,230,190,0)'); c.fillStyle = g; c.fillRect(0, 0, s, s);
      const pb = new G.Batch();
      for (const [x, z] of A.floods) { const R = 85, zc = z + (z < 0 ? 45 : -30); pb.rect(x - R, zc - R, x + R, zc + R, 0.05, 0xffffff, [0, 0, 1, 1]); }
      A.poolMat = new THREE.MeshBasicMaterial(Object.assign({ map: G.tex(cv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }, po(5)));
      const pm = pb.mesh(A.poolMat); pm.renderOrder = 4; grp.add(pm);
    }
    /* ---- windsock ---- */
    {
      const pivot = new THREE.Group(); pivot.position.set(AD.WDI[0], 6.2, AD.WDI[1]);
      const droop = new THREE.Group(); pivot.add(droop);
      const mats = [new THREE.MeshLambertMaterial({ color: 0xe8611c, side: THREE.DoubleSide }), new THREE.MeshLambertMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide })];
      for (let i = 0; i < 5; i++) {
        const r0 = 0.5 - i * 0.055, r1 = 0.5 - (i + 1) * 0.055, g = new THREE.CylinderGeometry(r1, r0, 0.74, 10, 1, true);
        g.rotateZ(-Math.PI / 2); g.translate(0.37 + i * 0.74, 0, 0);
        droop.add(new THREE.Mesh(g, mats[i % 2]));
      }
      grp.add(pivot); A.sock = pivot; A.sockDroop = droop;
    }
  };

  /* ---- per frame ---- */
  A.update = (dt, viewPos) => {
    const env = FS.env, L = env.L;
    // PAPI: white above the unit's setting angle, red below
    const lf = A.papiLF, sc = FS.World.pxScale || 700;
    for (const p of A.papi) {
      const dist = Math.hypot(viewPos.x - p.x, viewPos.z - p.z0, viewPos.y), sp = Math.max(9, 6.5 * dist / sc);
      p.z = p.z0 + Math.sign(p.z0) * p.k * (sp - 9); lf.pos[p.i * 3 + 2] = p.z;
      const dx = (viewPos.x - p.x) * -p.dir, dy = viewPos.y - (p.y - AD.SLOPE * p.x);
      const ang = Math.atan2(dy, Math.max(1, Math.hypot(dx, viewPos.z - p.z))) / DEG;
      const w = sstep(p.set - 0.06, p.set + 0.06, ang);
      const r = 1, g = lerp(0.1, 1, w), b = lerp(0.06, 0.95, w);
      A.papiLF.col[p.i * 3] = r; A.papiLF.col[p.i * 3 + 1] = g; A.papiLF.col[p.i * 3 + 2] = b;
    }
    A.papiLF.points.geometry.attributes.color.needsUpdate = true; A.papiLF.points.geometry.attributes.position.needsUpdate = true;
    // beacon: white flash, then green flash, every 2 s
    const ph = env.t % 2;
    const k = ph < 0.22 ? 1 : (ph > 1 && ph < 1.22) ? 1 : 0;
    A.beaconLF.setColor(0, ph < 1 ? 0xffffff : 0x22ff66, k); A.beaconLF.points.geometry.attributes.color.needsUpdate = true;
    // windsock
    const d = FS.hdgToDir(env.windDirNow + 180);
    A.sock.rotation.y = -Math.atan2(d.z, d.x) + Math.sin(env.t * 2.3) * 0.05;
    const kk = clamp(env.windKtNow / 15, 0, 1);
    A.sockDroop.rotation.z = -(1 - kk) * 1.25 + Math.sin(env.t * 5.1) * 0.04 * kk;
    const night = Math.max(L.nightF, 0.5 * (1 - L.dayF));
    A.poolMat.opacity = night * 0.42;
    A.glassMat.emissive.setRGB(0.42 * night, 0.36 * night, 0.22 * night);
  };

  /* ---- chart drawing (moving map, G1000 MFD). ctx is already transformed so 1 unit = 1 m ---- */
  A.drawChart = (c, o) => {
    o = o || {};
    c.fillStyle = o.grass || '#2f3a2c'; c.fillRect(-470, -500, 3940, 940);
    for (const r of A.paved) {
      if (r.t === 'shoulder') continue;
      c.fillStyle = r.t === 'runway' ? (o.rwy || '#15171a') : r.t === 'taxi' ? (o.twy || '#5e646b') : (o.apron || '#7a7f85');
      c.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
    }
    c.fillStyle = o.bldg || '#b9a98a';
    for (const b of A.buildings) c.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.setLineDash([30, 20]); c.beginPath(); c.moveTo(60, 0); c.lineTo(RW - 60, 0); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#e6bd1e'; c.lineWidth = 1.6; c.beginPath();
    c.moveTo(960, -160); c.lineTo(960, -22); c.moveTo(885, -160); c.lineTo(2963.5, -160); c.lineTo(2963.5, -22); c.moveTo(1000, 246); c.lineTo(1000, 22); c.stroke();
    c.strokeStyle = '#ff5a3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(948.5, -91); c.lineTo(971.5, -91); c.moveTo(2952, -91); c.lineTo(2975, -91); c.moveTo(994.75, 91); c.lineTo(1005.25, 91); c.stroke();
  };
  A.labels = [['05', 60, 0, 1], ['23', RW - 60, 0, 1], ['A', 985, -95, 0], ['D', 1022, 110, 0], ['E', 2100, -185, 0], ['E', 2995, -100, 0], ['Terminal', 1105, -372, 0], ['Tower', 1345, -350, 0], ['Flying Club', 1000, 330, 0], ['Main apron', 1150, -215, 0], ['Stands 16-20', 2380, -300, 0], ['DVOR', 1925, 175, 0], ['Fire', 812, -235, 0]];
})();
