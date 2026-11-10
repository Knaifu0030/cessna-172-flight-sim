/* ============================================================
   World: terrain, Western Ghats, sky, clouds, rain, city, trees, roads
   ============================================================ */
(function () {
  const G = FS.G, V3 = THREE.Vector3;
  const W = FS.World = { u: {} };
  const AVI = (x) => -1250 + 0.3 * (x - 1000);          // Avinashi Road line
  const TRI = (x) => -4350 + 0.81 * (x + 9140);          // Trichy Road line
  const UPV = new V3(0, 1, 0);
  const inAerodrome = (x, z, m) => x > -470 - m && x < 3470 + m && z > -500 - m && z < 440 + m;

  function urban(x, z) {
    if (inAerodrome(x, z, 0)) return 0;
    let d = 0;
    const dc = Math.hypot(x - AD.CITY[0], z - AD.CITY[1]);
    d = Math.max(d, Math.exp(-dc * dc / (2 * 4200 * 4200)));
    if (x > -13000 && x < 9500) {
      const dr = Math.abs(z - AVI(x)) / 1.044;
      d = Math.max(d, 0.85 * Math.exp(-dr * dr / (2 * 800 * 800)) * (1 - 0.5 * sstep(4000, 9000, x)));
      const dt = Math.abs(z - TRI(x)) / 1.287;
      d = Math.max(d, 0.5 * Math.exp(-dt * dt / (2 * 550 * 550)));
    }
    const dp = Math.hypot(x + 2600, z + 300);
    d = Math.max(d, 0.72 * Math.exp(-dp * dp / (2 * 2500 * 2500)));
    const de = Math.hypot(x - 4700, z + 500);
    d = Math.max(d, 0.5 * Math.exp(-de * de / (2 * 1100 * 1100)));
    d = Math.max(d, 0.4 * sstep(0.6, 0.78, fbm(x / 1900 + 3, z / 1900 + 8, 3)));
    // keep Sulur air base clear
    if (Math.hypot(x - AD.SULUR[0], z - AD.SULUR[1]) < 2300) d *= 0.05;
    return d;
  }
  W.urban = urban;

  /* ---- textures ---- */
  function fieldsCanvas(size) {
    const cv = G.canvas(size, size), c = cv.getContext('2d'), rnd = mulberry32(42);
    const pal = ['#a6935f', '#9a7850', '#7d8a52', '#66784a', '#b3a476', '#857354', '#929863', '#a58258', '#74824e', '#ae9c6c', '#978957', '#8c8f5e'];
    c.fillStyle = '#8f7f55'; c.fillRect(0, 0, size, size);
    const n = 10, cs = size / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = i * cs, y0 = j * cs;
      const sub = (x, y, w, h, depth) => {
        if (depth > 0 && rnd() < 0.75) {
          if (w > h) { const s = w * (0.35 + rnd() * 0.3); sub(x, y, s, h, depth - 1); sub(x + s, y, w - s, h, depth - 1); }
          else { const s = h * (0.35 + rnd() * 0.3); sub(x, y, w, s, depth - 1); sub(x, y + s, w, h - s, depth - 1); }
          return;
        }
        c.fillStyle = pal[Math.floor(rnd() * pal.length)]; c.globalAlpha = 0.75 + rnd() * 0.25;
        c.fillRect(x + 1, y + 1, w - 2, h - 2); c.globalAlpha = 1;
        if (rnd() < 0.45) { // crop rows
          c.strokeStyle = 'rgba(40,50,20,0.16)'; c.lineWidth = 1; c.beginPath();
          const horiz = rnd() < 0.5, step = 3 + rnd() * 3;
          if (horiz) for (let yy = y + 2; yy < y + h - 1; yy += step) { c.moveTo(x + 2, yy); c.lineTo(x + w - 2, yy); }
          else for (let xx = x + 2; xx < x + w - 1; xx += step) { c.moveTo(xx, y + 2); c.lineTo(xx, y + h - 2); }
          c.stroke();
        }
        c.fillStyle = 'rgba(38,62,30,0.85)';
        const trees = Math.floor(rnd() * 5);
        for (let t = 0; t < trees; t++) { c.beginPath(); c.arc(x + rnd() * w, y + (rnd() < 0.5 ? 1 : h - 1), 1.2 + rnd() * 2, 0, 7); c.fill(); }
      };
      sub(x0, y0, cs, cs, 2);
    }
    c.strokeStyle = 'rgba(196,178,140,0.75)'; c.lineWidth = Math.max(1.5, size / 512);
    for (let k = 0; k < 3; k++) { const p = Math.floor(rnd() * n) * cs; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, size); c.stroke(); c.beginPath(); c.moveTo(0, p); c.lineTo(size, p); c.stroke(); }
    const img = c.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const k = 0.9 + rnd() * 0.2; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function puffCanvas() {
    const s = 128, cv = G.canvas(s, s), c = cv.getContext('2d'), rnd = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + (rnd() - 0.5) * s * 0.5, y = s / 2 + (rnd() - 0.5) * s * 0.36, r = s * (0.12 + rnd() * 0.16);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
    return cv;
  }

  W.build = (scene, Q) => {
    W.scene = scene; W.Q = Q;
    /* ---------- terrain ---------- */
    const N = Q.low ? 72 : 110, R = 75000;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2), idx = [];
    const coord = (i) => { const t = i / N * 2 - 1; return Math.sign(t) * R * Math.pow(Math.abs(t), 2.3); };
    let k = 0;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) {
      const x = 1500 + coord(i), z = coord(j);
      const r = Math.hypot(x - 1500, z), f = 1 - sstep(7000, 14000, r);
      pos[k * 3] = x; pos[k * 3 + 1] = -AD.SLOPE * x * f - 0.02; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 2600; uv[k * 2 + 1] = z / 2600;
      const u = urban(x, z), hill = clamp(FS.hillH(x, z) / 300, 0, 1), nz = 0.88 + 0.24 * fbm(x / 6000, z / 6000, 3);
      let cr = lerp(1, 0.8, u * 0.7), cg = lerp(1, 0.78, u * 0.7), cb = lerp(1, 0.8, u * 0.6);
      cr = lerp(cr, 0.62, hill); cg = lerp(cg, 0.9, hill); cb = lerp(cb, 0.6, hill);
      col[k * 3] = cr * nz; col[k * 3 + 1] = cg * nz; col[k * 3 + 2] = cb * nz;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c2 = a + N + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    tg.setIndex(idx); tg.computeVertexNormals();
    const ft = G.tex(fieldsCanvas(Q.low ? 512 : 1024), true);
    W.terrainMat = new THREE.MeshLambertMaterial({ map: ft, vertexColors: true });
    const terrain = new THREE.Mesh(tg, W.terrainMat); terrain.receiveShadow = true; terrain.matrixAutoUpdate = false;
    scene.add(terrain);

    /* ---------- mountains ---------- */
    {
      const A0 = 228, A1 = 396, NA = Q.low ? 110 : 200, NR = Q.low ? 14 : 22, p = [], c = [], ix = [], cc = new THREE.Color();
      const lo = new THREE.Color(0x6f7a4c), mid = new THREE.Color(0x40603c), hi = new THREE.Color(0x5d6f74);
      for (let a = 0; a <= NA; a++) for (let rr = 0; rr <= NR; rr++) {
        const brg = A0 + (A1 - A0) * a / NA, rad = 15000 + 52000 * Math.pow(rr / NR, 1.25);
        const dir = FS.hdgToDir(brg), x = 1500 + dir.x * rad, z = dir.z * rad, h = FS.hillH(x, z);
        p.push(x, h - 12, z);
        cc.copy(lo).lerp(mid, sstep(60, 500, h)).lerp(hi, sstep(900, 1900, h));
        const nn = 0.85 + 0.3 * vnoise(x / 900, z / 900); c.push(cc.r * nn, cc.g * nn, cc.b * nn);
      }
      for (let a = 0; a < NA; a++) for (let rr = 0; rr < NR; rr++) { const i0 = a * (NR + 1) + rr, i1 = i0 + 1, j0 = i0 + NR + 1, j1 = j0 + 1; ix.push(i0, j0, i1, i1, j0, j1); }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      mg.setIndex(ix); mg.computeVertexNormals();
      const mm = new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ vertexColors: true })); mm.matrixAutoUpdate = false;
      scene.add(mm);
    }

    /* ---------- roads ---------- */
    const roads = new G.Batch();
    W.cityLights = new G.LightField(Q.cityLights + 3000);
    const road = (pts, w, colr, lamps) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 350));
        const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
        for (let s = 0; s < n; s++) {
          const x0 = lerp(ax, bx, s / n), z0 = lerp(az, bz, s / n), x1 = lerp(ax, bx, (s + 1) / n), z1 = lerp(az, bz, (s + 1) / n);
          const y0 = FS.groundH(x0, z0) + 0.12, y1 = FS.groundH(x1, z1) + 0.12;
          roads.quad([x0 - nx, y0, z0 - nz], [x0 + nx, y0, z0 + nz], [x1 + nx, y1, z1 + nz], [x1 - nx, y1, z1 - nz], colr);
        }
        if (lamps) for (let d = 0; d < L; d += lamps) {
          const x = lerp(ax, bx, d / L), z = lerp(az, bz, d / L);
          if (Math.hypot(x - 1500, z) < 14000) W.cityLights.add(x + nx * 1.1, FS.groundH(x, z) + 9, z + nz * 1.1, 0xffc27a, 2.6);
        }
      }
    };
    road([[-14000, AVI(-14000)], [10500, AVI(10500)]], 26, 0x4a4b4d, 70);
    road([[-10500, TRI(-10500)], [12500, TRI(12500)]], 20, 0x4d4d4f, 90);
    road([[-215, -1650], [-215, 1900]], 9, 0x55524d, 0);
    road([[3215, AVI(3215)], [3215, 2200]], 9, 0x55524d, 0);
    road([[1105, -470], [1105, AVI(1105)]], 14, 0x4c4c4e, 45);         // airport approach road
    road([[-215, 1900], [3215, 2200]], 8, 0x58544e, 0);
    road([[-6500, AVI(-6500)], [-5200, TRI(-5200)]], 12, 0x505052, 110);
    road([[5200, AVI(5200)], [6900, TRI(6900)]], 12, 0x505052, 0);
    const roadMesh = roads.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
    roadMesh.updateMatrix(); scene.add(roadMesh);

    /* ---------- Sulur air base (distant landmark) ---------- */
    {
      const sb = new G.Batch(), [sx, sz] = AD.SULUR, y = FS.groundH(sx, sz) + 0.15;
      sb.strip(sx - 1250, sz, sx + 1250, sz, 46, y, 0x3a3b3d);
      const a = (100 - AD.RWY_TRUE) * DEG;
      sb.strip(sx - Math.cos(a) * 900 + 300, sz - Math.sin(a) * 900, sx + Math.cos(a) * 900 + 300, sz + Math.sin(a) * 900, 40, y + 0.03, 0x404144);
      sb.strip(sx - 1250, sz - 190, sx + 1250, sz - 190, 20, y, 0x47484a);
      for (let i = 0; i < 9; i++) sb.box(sx - 700 + i * 170, sz - 300, 60, 45, 12, y, 0, 0x8a9186, 0x6f766c);
      for (let i = -11; i <= 11; i++) sb.rect(sx + i * 100 - 15, sz - 0.5, sx + i * 100 + 15, sz + 0.5, y + 0.06, 0xdedede);
      const sm = sb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
      sm.updateMatrix(); scene.add(sm);
      for (let i = -20; i <= 20; i++) { W.cityLights.add(sx + i * 60, y + 1, sz - 24, 0xfff2d8, 1.6); W.cityLights.add(sx + i * 60, y + 1, sz + 24, 0xfff2d8, 1.6); }
    }

    /* ---------- city: plots and buildings ---------- */
    {
      const rnd = mulberry32(1234), nMax = Q.buildings;
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), nMax);
      const pal = [0xe8e2d4, 0xd9d2c2, 0xf0ead8, 0xcfc6b4, 0xe3c9a8, 0xc9d3d6, 0xe6d3c4, 0xb9b3a7, 0xd8b99a, 0xf2efe6, 0xc98f6e, 0xaeb7b0];
      const plotCol = [0xb4ada0, 0xa7a196, 0xc0b5a2, 0x9d998f, 0xb9b1a3, 0x93997c, 0xaaa59b, 0xbfae98];
      const lampCol = [0xffd9a3, 0xfff0d6, 0xffe4b8, 0xe9f0ff, 0xffc98a];
      const plots = new G.Batch();
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), c = new THREE.Color();
      const CELL = 74, R1 = Q.low ? 6500 : 10500, cells = [];
      for (let gx = -R1; gx <= R1; gx += CELL) for (let gz = -R1; gz <= R1; gz += CELL) {
        const x = 1500 + gx, z = gz, u = urban(x, z);
        if (u < 0.1 || hash2(gx * 3 + 1, gz * 5 + 7) > u * 1.35) continue;
        if (Math.abs(z - AVI(x)) < 30 || (Math.abs(x - 1105) < 24 && z < -470 && z > AVI(x))) continue;
        cells.push([x, z, u, Math.hypot(gx - 0, gz)]);
      }
      cells.sort((a, b) => a[3] - b[3]);
      let i = 0;
      for (const [x, z, u, d] of cells) {
        const rot = 0.28 + (fbm(x / 3000, z / 3000, 2) - 0.5) * 1.2, cs = Math.cos(rot), sn = Math.sin(rot), gy = FS.groundH(x, z);
        const P = (a, b2) => [x + a * cs - b2 * sn, gy + 0.06, z + a * sn + b2 * cs];
        const hw = 26 + rnd() * 8, hd = 26 + rnd() * 8;
        const pc = plotCol[Math.floor(rnd() * plotCol.length)];
        if (u > 0.3) plots.quad(P(-hw, -hd), P(-hw, hd), P(hw, hd), P(hw, -hd), pc);
        const core = Math.exp(-Math.pow(Math.hypot(x - AD.CITY[0], z - AD.CITY[1]) / 2600, 2));
        const nb = d < 7000 ? 1 + Math.floor(rnd() * 2.2 * u + 0.35) : (rnd() < 0.35 ? 1 : 0);
        for (let b2 = 0; b2 < nb && i < nMax; b2++) {
          const w = 9 + rnd() * 16, dd = 8 + rnd() * 13, tall = rnd() < 0.04 + core * 0.3;
          let h = 3.5 + rnd() * 8 + (tall ? 10 + rnd() * 30 * (0.3 + core) : 0);
          const ox = (rnd() - 0.5) * (hw * 1.5), oz = (rnd() - 0.5) * (hd * 1.5), bx = x + ox * cs - oz * sn, bz = z + ox * sn + oz * cs;
          if (bx > -1500 && bx < 4500 && Math.abs(bz) < 1200) h = Math.min(h, 9);
          p.set(bx, gy - 0.3, bz); q.setFromAxisAngle(UPV, -rot + (rnd() < 0.5 ? Math.PI / 2 : 0));
          s.set(w, h, dd); m.compose(p, q, s); mesh.setMatrixAt(i, m);
          c.set(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.82 + rnd() * 0.18); mesh.setColorAt(i, c);
          if (tall && h > 28) W.cityLights.add(bx, gy + h + 1.5, bz, 0xff2a1a, 2.2);
          i++;
        }
        if (rnd() < 0.75) W.cityLights.add(x + (rnd() - 0.5) * 50, gy + 4 + rnd() * 5, z + (rnd() - 0.5) * 50, lampCol[Math.floor(rnd() * lampCol.length)], 1.6 + rnd() * 1.3);
      }
      mesh.count = i; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false; scene.add(mesh); W.buildings = mesh;
      const pm = plots.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
      pm.updateMatrix(); scene.add(pm);
    }
    scene.add(W.cityLights.build(0.75));

    /* ---------- trees ---------- */
    {
      const rnd = mulberry32(99), n = Q.trees, nPalm = Math.floor(n * 0.28);
      const cg = new THREE.IcosahedronGeometry(1, 0);
      const can = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff }), n - nPalm);
      const tg2 = new THREE.CylinderGeometry(0.1, 0.17, 1, 5); tg2.translate(0, 0.5, 0);
      const trunk = new THREE.InstancedMesh(tg2, new THREE.MeshLambertMaterial({ color: 0x6b5a45 }), nPalm);
      const crg = new THREE.IcosahedronGeometry(1, 0); crg.scale(2.7, 0.75, 2.7);
      const crown = new THREE.InstancedMesh(crg, new THREE.MeshLambertMaterial({ color: 0x3f6a34 }), nPalm);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), c = new THREE.Color();
      const greens = [0x3e5f2e, 0x4a6d33, 0x35532b, 0x567a3a, 0x445f35, 0x607f42];
      let ic = 0, ip = 0, guard = 0;
      while ((ic < n - nPalm || ip < nPalm) && guard++ < n * 40) {
        let x, z;
        const mode = rnd();
        if (mode < 0.3) { // ring just outside the boundary wall
          const side = Math.floor(rnd() * 4), t = rnd(), off = 12 + rnd() * 110;
          if (side === 0) { x = -470 + t * 3940; z = -500 - off; } else if (side === 1) { x = -470 + t * 3940; z = 440 + off; }
          else if (side === 2) { x = -470 - off; z = -500 + t * 940; } else { x = 3470 + off; z = -500 + t * 940; }
        } else { x = -9000 + rnd() * 18500; z = -7500 + rnd() * 15000; if (rnd() > 0.25 + 0.6 * Math.min(1, urban(x, z) * 2)) continue; }
        if (inAerodrome(x, z, 4)) continue;
        if (Math.abs(z - AVI(x)) < 22 || Math.abs(x - 1105) < 12 && z < -470) continue;
        const gy = FS.groundH(x, z);
        const lowZone = x > -1300 && x < 4300 && Math.abs(z) < 260;      // keep the approach paths low
        if (ip < nPalm && rnd() < 0.3 && !lowZone) {
          const h = 8 + rnd() * 6;
          p.set(x, gy, z); s.set(1.4, h, 1.4); q.identity(); m.compose(p, q, s); trunk.setMatrixAt(ip, m);
          p.set(x, gy + h, z); s.set(1, 1, 1); m.compose(p, q, s); crown.setMatrixAt(ip, m); ip++;
        } else if (ic < n - nPalm) {
          const r = (lowZone ? 2.2 : 3) + rnd() * (lowZone ? 1.6 : 4.2);
          p.set(x, gy + r * 0.85, z); s.set(r, r * (0.75 + rnd() * 0.3), r); q.setFromAxisAngle(UPV, rnd() * 6.28);
          m.compose(p, q, s); can.setMatrixAt(ic, m);
          c.set(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.85 + rnd() * 0.3); can.setColorAt(ic, c); ic++;
        }
      }
      can.count = ic; trunk.count = ip; crown.count = ip;
      for (const im of [can, trunk, crown]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; scene.add(im); }
    }

    /* ---------- sky ---------- */
    const u = W.u = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uSun: { value: new V3(0, 1, 0) }, uMoon: { value: new V3(0, -1, 0) }, uSunVis: { value: 1 }, uMoonI: { value: 0 }, uHaze: { value: 0 }, uFlash: { value: 0 }
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position*1000.0 + cameraPosition, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uGlow, uSun, uMoon; uniform float uSunVis, uMoonI, uHaze, uFlash; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uZenith, uHorizon, pow(1.0 - h, 3.2));
          float sd = max(dot(d, uSun), 0.0);
          float low = 1.0 - smoothstep(0.0, 0.45, uSun.y);
          col += uGlow * (pow(sd, 5.0) * (0.10 + 0.32*low) * pow(1.0 - h, 1.5) + pow(sd, 90.0) * 0.45) * uSunVis;
          col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99988, 0.99996, sd) * 2.0 * uSunVis * uSunVis;
          float md = max(dot(d, uMoon), 0.0);
          col += vec3(0.82, 0.86, 0.95) * (smoothstep(0.99990, 0.99996, md) * 1.3 + pow(md, 400.0) * 0.25) * uMoonI;
          col = mix(col, uHorizon, clamp(uHaze * (0.35 + 0.65*pow(1.0 - h, 2.0)), 0.0, 1.0));
          col = mix(col, uHorizon, step(d.y, 0.0));
          col += uFlash * vec3(0.55, 0.6, 0.75) * (0.4 + 0.6*pow(1.0-h, 2.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    }));
    sky.frustumCulled = false; sky.renderOrder = -100; scene.add(sky); W.sky = sky;

    /* ---------- stars ---------- */
    {
      const n = 1400, sp = new Float32Array(n * 3), rnd = mulberry32(31);
      for (let i = 0; i < n; i++) {
        const y = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - y * y);
        sp[i * 3] = Math.cos(a) * r * 60000; sp[i * 3 + 1] = y * 60000; sp[i * 3 + 2] = Math.sin(a) * r * 60000;
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      W.stars.frustumCulled = false; W.stars.renderOrder = -90; scene.add(W.stars);
    }

    /* ---------- clouds ---------- */
    const noiseTex = G.tex(G.noiseCanvas(256, 4, 5, 11), true, 1);
    const cu = W.cu = {
      uNoise: { value: noiseTex }, uThresh: { value: 0.5 }, uOff: { value: new THREE.Vector2() }, uLight: { value: new THREE.Color() }, uDark: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() }, uFar: { value: 30000 }, uOpacity: { value: 1 }
    };
    const layerMat = () => new THREE.ShaderMaterial({
      uniforms: cu, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `
        uniform sampler2D uNoise; uniform float uThresh, uFar, uOpacity; uniform vec2 uOff; uniform vec3 uLight, uDark, uFog; varying vec3 vW;
        void main(){
          vec2 p = vW.xz/9000.0 + uOff;
          float n = texture2D(uNoise, p).r*0.58 + texture2D(uNoise, p*2.9 + 0.31).r*0.3 + texture2D(uNoise, p*8.3).r*0.12;
          float d = smoothstep(uThresh - 0.10, uThresh + 0.16, n);
          float dist = length(vW.xz - cameraPosition.xz);
          float fade = 1.0 - smoothstep(uFar*0.45, uFar, dist);
          vec3 col = mix(uLight, uDark, smoothstep(uThresh, uThresh + 0.4, n));
          col = mix(col, uFog, smoothstep(uFar*0.15, uFar*0.9, dist)*0.8);
          gl_FragColor = vec4(col, d * fade * uOpacity);
        }`
    });
    W.layerLo = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), layerMat()); W.layerLo.rotation.x = -Math.PI / 2; W.layerLo.renderOrder = 5; W.layerLo.frustumCulled = false;
    W.layerHi = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), W.layerLo.material); W.layerHi.rotation.x = -Math.PI / 2; W.layerHi.renderOrder = 5; W.layerHi.frustumCulled = false;
    scene.add(W.layerLo); scene.add(W.layerHi);
    {
      const nC = Q.clouds, per = 7, n = nC * per, rnd = mulberry32(77), L = 44000;
      const cen = new Float32Array(n * 4 * 3), cor = new Float32Array(n * 4 * 2), siz = new Float32Array(n * 4), seed = new Float32Array(n * 4), ix = [];
      let q = 0;
      for (let c = 0; c < nC; c++) {
        const cx = rnd() * L, cz = rnd() * L, sc = 0.7 + rnd() * 1.1, sd = rnd();
        for (let j = 0; j < per; j++, q++) {
          const px = cx + (rnd() - 0.5) * 900 * sc, pz = cz + (rnd() - 0.5) * 900 * sc, py = (j === 0 ? 0 : rnd() * 260 * sc) + 120 * sc, s = (260 + rnd() * 320) * sc * (py > 250 * sc ? 0.75 : 1);
          for (let v = 0; v < 4; v++) {
            const o = (q * 4 + v);
            cen[o * 3] = px; cen[o * 3 + 1] = py; cen[o * 3 + 2] = pz;
            cor[o * 2] = (v === 1 || v === 2) ? 1 : -1; cor[o * 2 + 1] = v >= 2 ? 1 : -1; siz[o] = s; seed[o] = sd;
          }
          ix.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
        }
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(cen, 3)); pg.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2));
      pg.setAttribute('aSize', new THREE.BufferAttribute(siz, 1)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); pg.setIndex(ix);
      const pu = W.pu = { uTex: { value: G.tex(puffCanvas()) }, uL: { value: L }, uDrift: { value: new THREE.Vector2() }, uBase: { value: 1000 }, uCover: { value: 0.3 }, uLight: cu.uLight, uDark: cu.uDark, uFog: cu.uFog, uFar: { value: 21000 } };
      W.puffs = new THREE.Mesh(pg, new THREE.ShaderMaterial({
        uniforms: pu, transparent: true, depthWrite: false, fog: false,
        vertexShader: `
          attribute vec2 aCorner; attribute float aSize, aSeed; uniform float uL, uBase, uCover, uFar; uniform vec2 uDrift;
          varying vec2 vUv; varying float vA; varying float vH;
          void main(){
            vec3 c = position; c.xz += uDrift;
            c.x = cameraPosition.x + mod(c.x - cameraPosition.x + uL*0.5, uL) - uL*0.5;
            c.z = cameraPosition.z + mod(c.z - cameraPosition.z + uL*0.5, uL) - uL*0.5;
            float vis = smoothstep(aSeed - 0.04, aSeed + 0.04, uCover);
            vH = clamp((c.y + aCorner.y*aSize*0.5) / 420.0, 0.0, 1.0);
            c.y += uBase;
            vec4 mv = viewMatrix * vec4(c, 1.0);
            float dist = length(c.xz - cameraPosition.xz);
            vA = vis * (1.0 - smoothstep(uFar*0.6, uFar, dist)) * smoothstep(60.0, 500.0, -mv.z);
            mv.xy += aCorner * aSize * 0.5 * vec2(1.25, 0.8) * step(0.001, vis);
            vUv = aCorner*0.5 + 0.5;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex; uniform vec3 uLight, uDark, uFog; varying vec2 vUv; varying float vA; varying float vH;
          void main(){
            float a = texture2D(uTex, vUv).a;
            vec3 col = mix(uDark, uLight, clamp(0.25 + 0.75*vH + (vUv.y - 0.5)*0.5, 0.0, 1.0));
            gl_FragColor = vec4(col, a * vA * 0.9);
          }`
      }));
      W.puffs.frustumCulled = false; W.puffs.renderOrder = 6; scene.add(W.puffs);
    }

    /* ---------- rain ---------- */
    {
      const n = Q.low ? 700 : 1600, B = 42, rp = new Float32Array(n * 2 * 3), re = new Float32Array(n * 2), rnd = mulberry32(8);
      for (let i = 0; i < n; i++) {
        const x = rnd() * B, y = rnd() * B, z = rnd() * B;
        for (let v = 0; v < 2; v++) { rp[(i * 2 + v) * 3] = x; rp[(i * 2 + v) * 3 + 1] = y; rp[(i * 2 + v) * 3 + 2] = z; re[i * 2 + v] = v; }
      }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
      const ru = W.ru = { uOff: { value: new V3() }, uStreak: { value: new V3(0, 1, 0) }, uB: { value: B }, uA: { value: 0 }, uCol: { value: new THREE.Color(0xbfcad6) } };
      W.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
        uniforms: ru, transparent: true, depthWrite: false, fog: false,
        vertexShader: `attribute float aEnd; uniform vec3 uOff, uStreak; uniform float uB; varying float vE;
          void main(){ vec3 p = mod(position + uOff, uB) - uB*0.5 + cameraPosition + uStreak*aEnd; vE = aEnd; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`,
        fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vE; void main(){ gl_FragColor = vec4(uCol, uA*(0.25+0.5*vE)); }'
      }));
      W.rain.frustumCulled = false; W.rain.renderOrder = 30; W.rain.visible = false; scene.add(W.rain);
    }
    W.rainOff = new V3();
  };

  /* ---------- per frame ---------- */
  const tmpC = new THREE.Color(), tv = new V3();
  W.update = (dt, cam, camVel) => {
    const env = FS.env, L = env.L, wx = env.wx, u = W.u;
    u.uZenith.value.copy(L.zenith); u.uHorizon.value.copy(L.horizon); u.uGlow.value.copy(L.glow);
    u.uSun.value.copy(L.sunDir); u.uMoon.value.copy(L.moonDir);
    const ovc = sstep(0.55, 1, wx.cover);
    u.uSunVis.value = sstep(-3, 1, L.sunEl) * (1 - 0.93 * ovc) * (1 - 0.6 * (1 - sstep(1, 6, wx.visKm)));
    u.uMoonI.value = sstep(-2, 6, Math.asin(clamp(L.moonDir.y, -1, 1)) / DEG) * (1 - ovc) * (0.35 + 0.65 * L.nightF);
    u.uHaze.value = 1 - sstep(0.4, 9, wx.visKm);
    u.uFlash.value = env.flash;
    W.stars.material.opacity = L.starA; W.stars.visible = L.starA > 0.01;
    if (W.stars.visible) { W.stars.position.copy(cam.position); W.stars.rotation.set(0.2, env.time / 24 * 6.283, 0.8); }
    // fog
    const visM = wx.visKm * 1000;
    const baseY = wx.baseFt * FT, thick = wx.storm ? 2600 : wx.cover > 0.9 ? 900 : 500, topY = baseY + thick;
    let far = Math.min(visM * 1.25, 80000), near = far * 0.06;
    const layered = wx.cover >= 0.5;
    let inCloud = 0;
    if (layered) inCloud = sstep(baseY - 60, baseY + 40, cam.position.y) * (1 - sstep(topY - 40, topY + 60, cam.position.y)) * sstep(0.5, 0.75, wx.cover);
    far = lerp(far, 140, inCloud); near = lerp(near, 4, inCloud);
    const fog = W.scene.fog; fog.near = near; fog.far = far;
    tmpC.copy(L.fog); if (inCloud > 0) tmpC.lerp(W.cu.uLight.value, inCloud * 0.7);
    fog.color.copy(tmpC); fog.color.r += env.flash * 0.25; fog.color.g += env.flash * 0.27; fog.color.b += env.flash * 0.33;
    // clouds
    const cu = W.cu, day = L.dayF;
    cu.uLight.value.setRGB(1, 1, 1).lerp(L.glow, 0.25 * (1 - sstep(8, 25, L.sunEl))).multiplyScalar(0.07 + 0.93 * day + L.moonI * 0.5).multiplyScalar(wx.storm ? 0.6 : 1 - 0.2 * ovc);
    cu.uLight.value.addScalar(env.flash * 0.6);
    cu.uDark.value.set(wx.storm ? 0x30363e : 0x8d97a6).multiplyScalar(0.06 + 0.94 * day).lerp(cu.uLight.value, 0.25 * (1 - ovc)).addScalar(env.flash * 0.35);
    cu.uFog.value.copy(L.fog);
    cu.uThresh.value = lerp(0.72, 0.2, sstep(0.45, 1, wx.cover));
    cu.uFar.value = Math.min(far * 1.6, 42000);
    tv.copy(env.windNow).multiplyScalar(dt / 9000);
    cu.uOff.value.x += tv.x; cu.uOff.value.y += tv.z;
    W.layerLo.visible = W.layerHi.visible = layered;
    if (layered) {
      W.layerLo.position.set(cam.position.x, baseY, cam.position.z);
      W.layerHi.position.set(cam.position.x, topY, cam.position.z);
      cu.uOpacity.value = 1 - inCloud;
    }
    const pu = W.pu;
    W.puffs.visible = wx.cover > 0.03 && wx.cover < 0.9 && visM > 1500;
    pu.uBase.value = baseY; pu.uCover.value = clamp(wx.cover * 1.9, 0, 1); pu.uFar.value = Math.min(21000, far * 1.2);
    pu.uDrift.value.x += env.windNow.x * dt; pu.uDrift.value.y += env.windNow.z * dt;
    // rain
    const rainA = wx.rain * (cam.position.y < baseY + 100 ? 1 : 0);
    W.rain.visible = rainA > 0.02;
    if (W.rain.visible) {
      const ru = W.ru;
      tv.set(env.windNow.x - camVel.x, -9 - camVel.y, env.windNow.z - camVel.z);
      W.rainOff.addScaledVector(tv, dt); ru.uOff.value.copy(W.rainOff);
      ru.uStreak.value.copy(tv).multiplyScalar(-0.035);
      ru.uA.value = (0.25 + 0.5 * rainA) * (0.25 + 0.75 * day);
    }
    // light fields
    const scale = W.pxScale || 800;
    for (const lf of G.lightFields) { const m = lf.mat.uniforms; m.uScale.value = scale; m.uNight.value = lf.always ? 1 : Math.max(L.nightF, 1 - sstep(0, 0.6, L.dayF * (1 - 0.6 * ovc) * sstep(0.5, 6, wx.visKm))); m.uVis.value = lerp(visM, 120, inCloud); }
    W.inCloud = inCloud;
    // wet look
    if (W.wetMats) for (const m of W.wetMats) { m.color.setScalar(lerp(1, 0.62, env.wet)); if (m.shininess !== undefined) m.shininess = lerp(4, 70, env.wet); }
  };
})();
