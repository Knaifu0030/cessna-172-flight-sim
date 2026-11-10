'use strict';
/* ============================================================
   VOCB Skyhawk trainer — core constants and helpers
   World frame: +X along runway 05 -> 23, +Y up, +Z to the south-east.
   Origin: threshold of runway 05 (elevation 1,328 ft).
   ============================================================ */
const FS = {};
const DEG = Math.PI / 180, KT = 0.514444, FT = 0.3048, NM = 1852;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const approach = (v, target, maxStep) => (v < target ? Math.min(v + maxStep, target) : Math.max(v - maxStep, target));
const wrap360 = (d) => ((d % 360) + 360) % 360;
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
const interp = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const a = table[i - 1], b = table[i];
      return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
  }
  const n = table.length, a = table[n - 2], b = table[n - 1];
  return b[1] + (b[1] - a[1]) * (x - b[0]) / (b[0] - a[0]);
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Aerodrome data (AAI AIP, VOCB) ---- */
const AD = {
  RWY_LEN: 2990, RWY_W: 45,
  RWY_TRUE: 45.77,            // true bearing of runway 05
  MAGVAR_W: 2.0,              // magnetic = true + 2
  SLOPE: (1328 - 1275) * FT / 2990, // downslope toward runway 23
  ELEV_M: 1328 * FT,          // elevation of world y = 0
  REF_TEMP: 35,
  TWR: 118.15, APP: 120.05, ATIS: 128.05,
  ILS23: 109.1, VOR: 112.9, NDB: 354,
  PAPI05: 3.4, PAPI23: 3.0,
  CALLSIGN: 'VT-KVY',
  // points of interest, runway frame (x along, z lateral; NW is negative z)
  WDI: [1306, -108], DVOR: [1925, 136], GP: [2640, 127], LOC: [-310, 0], NDBPOS: [1020, 460],
  TOWER: [1318, -322], SULUR: [9236, 10503], CITY: [-9140, -4350],
  HANGAR_SPAWN: [1012, 246], HOLD_D: [1000, 91], HOLD_A: [960, -91], HOLD_E: [2972, -91]
};
FS.AD = AD;

/* Heading helpers. True heading h -> unit vector in world XZ. */
FS.hdgToDir = (hTrue, out) => {
  const a = (hTrue - AD.RWY_TRUE) * DEG;
  out = out || new THREE.Vector3();
  return out.set(Math.cos(a), 0, Math.sin(a));
};
FS.dirToHdg = (x, z) => wrap360(AD.RWY_TRUE + Math.atan2(z, x) / DEG);
FS.toMag = (hTrue) => wrap360(hTrue + AD.MAGVAR_W);

/* ---- value noise ---- */
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}
function fbm(x, z, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < (oct || 4); i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; }
  return s;
}
FS.vnoise = vnoise; FS.fbm = fbm;

/* ---- terrain ----
   Flat sloping plain around the aerodrome; Western Ghats / Nilgiris rise to the
   west and north-west beyond ~20 km. */
FS.hillH = (x, z) => {
  const dx = x - 1500, r = Math.hypot(dx, z);
  if (r < 15000) return 0;
  const brg = wrap360(AD.RWY_TRUE + Math.atan2(z, dx) / DEG);
  const dAng = Math.abs(angDiff(brg, 312));
  const env = 1 - sstep(48, 80, dAng);
  if (env <= 0) return 0;
  const r0 = 19000 + 9000 * sstep(280, 345, brg);
  const t = sstep(r0, r0 + 15000, r);
  if (t <= 0) return 0;
  const n = fbm(x / 5200 + 7.1, z / 5200 - 3.3, 4);
  const ridge = 1 - Math.abs(fbm(x / 9000, z / 9000, 3) * 2 - 1);
  return env * t * (500 + 1500 * n * (0.5 + 0.5 * ridge)) * (0.75 + 0.5 * sstep(300, 340, brg));
};
FS.groundH = (x, z) => {
  const dx = x - 1500, r = Math.hypot(dx, z);
  const f = 1 - sstep(7000, 14000, r);
  let h = -AD.SLOPE * x * f;
  if (r > 15000) h += FS.hillH(x, z);
  return h;
};

/* ---- persistent settings ---- */
FS.defaults = {
  quality: 'auto', panel: 'analog', units: 'aviation', hud: true, mapOn: false,
  sens: 1.0, expo: 0.35, deadzone: 0.12, invertPitch: false, mouseYoke: false, tilt: false,
  volume: 0.7, shake: true, autoRudder: false,
  padMap: null, lessonBest: {}
};
FS.settings = Object.assign({}, FS.defaults);
FS.loadSettings = () => {
  try {
    const raw = localStorage.getItem('vocb172.settings');
    if (raw) Object.assign(FS.settings, JSON.parse(raw));
  } catch (e) { /* storage unavailable: run with defaults */ }
};
FS.saveSettings = () => {
  try { localStorage.setItem('vocb172.settings', JSON.stringify(FS.settings)); } catch (e) { /* ignore */ }
};

/* tiny event bus */
FS.bus = {
  h: {},
  on(n, f) { (this.h[n] = this.h[n] || []).push(f); },
  emit(n, a) { (this.h[n] || []).forEach((f) => f(a)); }
};
