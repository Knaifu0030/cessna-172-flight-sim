/* ============================================================
   Geometry and texture helpers
   ============================================================ */
(function () {
  const V3 = THREE.Vector3;
  const G = FS.G = {};

  G.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  G.tex = (canvas, repeat, aniso) => {
    const t = new THREE.CanvasTexture(canvas);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = aniso || FS.maxAniso || 4;
    return t;
  };

  /* ---- Batch: merge many primitives into one mesh ---- */
  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
    tri(a, b, c, col, nrm, ua, ub, uc) {
      let nx, ny, nz;
      if (nrm) { nx = nrm[0]; ny = nrm[1]; nz = nrm[2]; } else {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      }
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      const r = ((col >> 16) & 255) / 255, g = ((col >> 8) & 255) / 255, bl = (col & 255) / 255;
      this.c.push(r, g, bl, r, g, bl, r, g, bl);
      if (ua) this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); else this.uv.push(a[0], a[2], b[0], b[2], c[0], c[2]);
    }
    quad(a, b, c, d, col, uvs) {
      if (uvs) { this.tri(a, b, c, col, null, uvs[0], uvs[1], uvs[2]); this.tri(a, c, d, col, null, uvs[0], uvs[2], uvs[3]); }
      else { this.tri(a, b, c, col); this.tri(a, c, d, col); }
    }
    /* horizontal rectangle facing up; uv = world xz * uvScale, or explicit uv rect [u0,v0,u1,v1] */
    rect(x0, z0, x1, z1, y, col, uvRect) {
      const a = [x0, y, z0], b = [x0, y, z1], c = [x1, y, z1], d = [x1, y, z0];
      if (uvRect) {
        const [u0, v0, u1, v1] = uvRect;
        this.quad(a, b, c, d, col, [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]);
      } else this.quad(a, b, c, d, col);
    }
    /* rectangle along a segment */
    strip(ax, az, bx, bz, w, y, col) {
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
      this.quad([ax - nx, y, az - nz], [ax + nx, y, az + nz], [bx + nx, y, bz + nz], [bx - nx, y, bz - nz], col);
    }
    /* textured rectangle along a direction (for painted numbers): centre, size along/ across, rotation */
    decal(cx, cz, len, wid, y, rot, col, uvRect) {
      const cs = Math.cos(rot), sn = Math.sin(rot), hl = len / 2, hw = wid / 2;
      const P = (l, w) => [cx + l * cs - w * sn, y, cz + l * sn + w * cs];
      const [u0, v0, u1, v1] = uvRect;
      // text "up" points along +len
      this.quad(P(-hl, -hw), P(-hl, hw), P(hl, hw), P(hl, -hw), col, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    }
    /* box with base at y0. rot about Y. skipBottom. cols: side colour, optional top colour */
    box(cx, cz, w, d, h, y0, rot, col, topCol) {
      const cs = Math.cos(rot || 0), sn = Math.sin(rot || 0), hw = w / 2, hd = d / 2;
      const P = (x, y, z) => [cx + x * cs - z * sn, y, cz + x * sn + z * cs];
      const y1 = y0 + h;
      const a = P(-hw, y0, -hd), b = P(hw, y0, -hd), c = P(hw, y0, hd), d2 = P(-hw, y0, hd);
      const e = P(-hw, y1, -hd), f = P(hw, y1, -hd), g = P(hw, y1, hd), h2 = P(-hw, y1, hd);
      this.quad(a, e, f, b, col); this.quad(b, f, g, c, col); this.quad(c, g, h2, d2, col); this.quad(d2, h2, e, a, col);
      this.quad(e, h2, g, f, topCol === undefined ? col : topCol);
    }
    /* vertical cylinder */
    cyl(cx, cz, r0, r1, h, y0, col, seg, capCol) {
      seg = seg || 10;
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0], p1 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
        const q0 = [cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1], q1 = [cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1];
        this.quad(p0, q0, q1, p1, col);
        if (r1 > 0.01) this.tri([cx, y0 + h, cz], q1, q0, capCol === undefined ? col : capCol);
      }
    }
    /* barrel-vault roof along local x: width d across z, length w, rise */
    vault(cx, cz, w, d, y0, rise, rot, col, seg) {
      seg = seg || 8;
      const cs = Math.cos(rot || 0), sn = Math.sin(rot || 0), hw = w / 2;
      const P = (x, y, z) => [cx + x * cs - z * sn, y, cz + x * sn + z * cs];
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg * Math.PI, t1 = (i + 1) / seg * Math.PI;
        const z0 = -Math.cos(t0) * d / 2, z1 = -Math.cos(t1) * d / 2, h0 = y0 + Math.sin(t0) * rise, h1 = y0 + Math.sin(t1) * rise;
        this.quad(P(-hw, h0, z0), P(-hw, h1, z1), P(hw, h1, z1), P(hw, h0, z0), col);
        this.tri(P(-hw, y0, 0), P(-hw, h1, z1), P(-hw, h0, z0), col);
        this.tri(P(hw, y0, 0), P(hw, h0, z0), P(hw, h1, z1), col);
      }
    }
    /* append a BufferGeometry with a transform */
    geo(geom, mat4, col) {
      const g = geom.index ? geom.toNonIndexed() : geom;
      const pos = g.attributes.position, nor = g.attributes.normal, gc = g.attributes.color;
      const nm = new THREE.Matrix3().getNormalMatrix(mat4), v = new V3();
      const r = ((col >> 16) & 255) / 255, gr = ((col >> 8) & 255) / 255, b = (col & 255) / 255;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat4); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
        if (gc && col === null) this.c.push(gc.getX(i), gc.getY(i), gc.getZ(i)); else this.c.push(r, gr, b);
        this.uv.push(0, 0);
      }
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      return g;
    }
    mesh(material) { const m = new THREE.Mesh(this.geometry(), material); m.matrixAutoUpdate = false; return m; }
    get count() { return this.p.length / 9; }
  }
  G.Batch = Batch;

  /* ---- lofted body along X. stations: {x, w, yb, yt, n} (half-width, bottom, top, superellipse power) ---- */
  G.loft = (st, seg, colorFn) => {
    seg = seg || 20;
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let i = 0; i < st.length; i++) {
      const s = st[i], yc = (s.yb + s.yt) / 2, h = (s.yt - s.yb) / 2, e = 2 / (s.n || 2.6);
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const z = s.w * Math.sign(ca) * Math.pow(Math.abs(ca), e), y = yc + h * Math.sign(sa) * Math.pow(Math.abs(sa), e);
        pos.push(s.x, y, z);
        if (colorFn) { c.set(colorFn(s.x, y, z, i)); col.push(c.r, c.g, c.b); }
      }
    }
    const row = seg + 1;
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * row + j, b = a + 1, d = a + row, e2 = d + 1;
      idx.push(a, b, d, b, e2, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };

  /* ---- wing / tail surface. sections: {z, xle, chord, y, t}; chord fraction range a..b ---- */
  const XC = [0, 0.0125, 0.04, 0.09, 0.17, 0.28, 0.4, 0.55, 0.7, 0.85, 1];
  function foil(xc, t, camber) {
    const yt = 5 * t * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1036 * xc * xc * xc * xc);
    const m = camber, p = 0.4;
    const yc = xc < p ? m / (p * p) * (2 * p * xc - xc * xc) : m / ((1 - p) * (1 - p)) * (1 - 2 * p + 2 * p * xc - xc * xc);
    return [yc + yt, yc - yt];
  }
  G.wing = (secs, a, b, camber, vertical, colorFn) => {
    a = a || 0; b = b === undefined ? 1 : b; camber = camber === undefined ? 0.02 : camber;
    const xs = [a]; for (const x of XC) if (x > a + 0.01 && x < b - 0.01) xs.push(x); xs.push(b);
    const ring = xs.length * 2, pos = [], idx = [], col = [], c = new THREE.Color();
    for (const s of secs) {
      const pts = [];
      for (let i = 0; i < xs.length; i++) pts.push([xs[i], foil(xs[i], s.t, camber)[0]]);
      for (let i = xs.length - 1; i >= 0; i--) pts.push([xs[i], foil(xs[i], s.t, camber)[1]]);
      for (const [xc, yy] of pts) {
        const x = s.xle - xc * s.chord, off = yy * s.chord;
        if (vertical) pos.push(x, s.z, s.y + off); else pos.push(x, s.y + off, s.z);
        if (colorFn) { c.set(colorFn(xc, s.z, yy > 0)); col.push(c.r, c.g, c.b); }
      }
    }
    for (let i = 0; i < secs.length - 1; i++) for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring, p0 = i * ring + j, p1 = i * ring + j2, q0 = p0 + ring, q1 = p1 + ring;
      if (vertical) idx.push(p0, q0, p1, p1, q0, q1); else idx.push(p0, p1, q0, p1, q1, q0);
    }
    // end caps
    const cap = (i, flip) => {
      const base = i * ring;
      for (let j = 1; j < ring - 1; j++) { if (flip) idx.push(base, base + j + 1, base + j); else idx.push(base, base + j, base + j + 1); }
    };
    cap(0, !vertical); cap(secs.length - 1, vertical);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };

  /* ---- text atlas for painted numbers and signs ---- */
  class Atlas {
    constructor(size, cell) { this.size = size; this.cell = cell; this.cv = G.canvas(size, size); this.ctx = this.cv.getContext('2d'); this.cx = 0; this.cy = 0; this.rowH = 0; this.map = {}; }
    add(key, cw, ch, draw) {
      if (this.map[key]) return this.map[key];
      const w = cw * this.cell, h = ch * this.cell;
      if (this.cx + w > this.size) { this.cx = 0; this.cy += this.rowH; this.rowH = 0; }
      const x = this.cx, y = this.cy; this.cx += w; this.rowH = Math.max(this.rowH, h);
      const c = this.ctx; c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip(); draw(c, w, h); c.restore();
      const pad = 1.5 / this.size;
      return (this.map[key] = [x / this.size + pad, 1 - (y + h) / this.size + pad, (x + w) / this.size - pad, 1 - y / this.size - pad]);
    }
    text(key, str, cw, ch, color, font) {
      return this.add(key, cw, ch, (c, w, h) => {
        c.fillStyle = color || '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = (font || '700 ') + Math.floor(h * 0.86) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
        c.fillText(str, w / 2, h * 0.54, w * 0.94);
      });
    }
    texture() { const t = G.tex(this.cv); t.needsUpdate = true; return t; }
  }
  G.Atlas = Atlas;

  /* ---- procedural tiling noise canvas ---- */
  G.noiseCanvas = (size, cells, oct, seed) => {
    const cv = G.canvas(size, size), ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
    const rnd = mulberry32(seed || 7), grids = [];
    for (let o = 0; o < oct; o++) { const n = cells << o, g = new Float32Array(n * n); for (let i = 0; i < n * n; i++) g[i] = rnd(); grids.push([n, g]); }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, tot = 0;
      for (const [n, g] of grids) {
        const fx = x / size * n, fy = y / size * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (ix + 1) % n, y1 = (iy + 1) % n;
        v += amp * lerp(lerp(g[iy * n + ix], g[iy * n + x1], sx), lerp(g[y1 * n + ix], g[y1 * n + x1], sx), sy);
        tot += amp; amp *= 0.5;
      }
      const b = Math.round(clamp(v / tot, 0, 1) * 255), i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };
  /* speckled surface texture from a base colour */
  G.surfaceCanvas = (size, base, vary, seed, extra) => {
    const cv = G.canvas(size, size), ctx = cv.getContext('2d');
    const n = G.noiseCanvas(size, 4, 5, seed).getContext('2d').getImageData(0, 0, size, size).data;
    const img = ctx.createImageData(size, size), rnd = mulberry32(seed + 3);
    const c = new THREE.Color(base);
    for (let i = 0; i < size * size; i++) {
      const k = 1 + ((n[i * 4] / 255) - 0.5) * vary + (rnd() - 0.5) * vary * 0.7;
      img.data[i * 4] = clamp(c.r * 255 * k, 0, 255); img.data[i * 4 + 1] = clamp(c.g * 255 * k, 0, 255); img.data[i * 4 + 2] = clamp(c.b * 255 * k, 0, 255); img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (extra) extra(ctx, size, rnd);
    return cv;
  };

  /* ---- light points: glowing dots that stay visible at range ---- */
  const LP_VS = `
    attribute vec3 color; attribute float size; attribute vec3 aDir;
    uniform float uScale, uNight, uVis, uMinPx, uBoost, uPow;
    varying vec3 vCol; varying float vA;
    void main(){
      vec4 wp = modelMatrix * vec4(position,1.0);
      vec4 mv = viewMatrix * wp;
      float d = max(-mv.z, 0.1);
      float px = size * uScale / d;
      float minPx = uMinPx * (0.55 + 1.0*uNight);
      float a = 1.0;
      if (px < minPx) { a = pow(px/minPx, uPow); px = minPx; }
      px = min(px, 54.0);
      float dl = length(aDir);
      if (dl > 0.01) { vec3 tc = normalize(cameraPosition - wp.xyz); a *= smoothstep(0.02, 0.22, dot(tc, aDir/dl)); }
      a *= exp(-d / (uVis*1.4)) * (0.25 + 0.75*uNight) * uBoost;
      vCol = color; vA = a;
      gl_PointSize = px * (0.8 + 0.6*uNight);
      gl_Position = projectionMatrix * mv;
    }`;
  const LP_FS = `
    varying vec3 vCol; varying float vA; uniform float uSolid;
    void main(){
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float g = smoothstep(1.0, 0.0, r);
      float core = smoothstep(0.45, 0.0, r);
      float k = (g*g*0.9 + core*1.2) * vA;
      gl_FragColor = mix(vec4(vCol * k, 1.0), vec4(vCol * (0.75 + 0.25*core), clamp(smoothstep(1.0, 0.55, r) * vA * 1.6, 0.0, 1.0)), uSolid);
    }`;
  class LightField {
    constructor(max) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.dir = new Float32Array(max * 3);
    }
    add(x, y, z, hex, size, dx, dy, dz) {
      if (this.n >= this.max) return -1;
      const i = this.n++;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.setColor(i, hex); this.size[i] = size;
      this.dir[i * 3] = dx || 0; this.dir[i * 3 + 1] = dy || 0; this.dir[i * 3 + 2] = dz || 0;
      return i;
    }
    setColor(i, hex, k) {
      k = k === undefined ? 1 : k;
      this.col[i * 3] = ((hex >> 16) & 255) / 255 * k; this.col[i * 3 + 1] = ((hex >> 8) & 255) / 255 * k; this.col[i * 3 + 2] = (hex & 255) / 255 * k;
    }
    build(boost, solid) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.n * 3), 3));
      g.setAttribute('size', new THREE.BufferAttribute(this.size.subarray(0, this.n), 1));
      g.setAttribute('aDir', new THREE.BufferAttribute(this.dir.subarray(0, this.n * 3), 3));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 800 }, uNight: { value: 0 }, uVis: { value: 20000 }, uMinPx: { value: 2.6 }, uBoost: { value: boost || 1 }, uPow: { value: 0.4 }, uSolid: { value: 0 } },
        vertexShader: LP_VS, fragmentShader: LP_FS, transparent: true, depthWrite: false, blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false
      });
      if (solid) this.mat.uniforms.uSolid.value = 1;
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false; this.points.renderOrder = 20;
      G.lightFields.push(this);
      return this.points;
    }
    dirty() { const a = this.points.geometry.attributes; a.color.needsUpdate = true; a.position.needsUpdate = true; }
  }
  G.LightField = LightField;
  G.lightFields = [];
})();
