/* ============================================================
   Environment: clock (IST), sun/moon for 11.03 N 77.04 E, weather,
   ISA-based atmosphere, wind with gusts and turbulence.
   ============================================================ */
(function () {
  const V3 = THREE.Vector3;
  const LAT = 11.03 * DEG, LON = 77.04;
  const NORTH = FS.hdgToDir(0), EAST = FS.hdgToDir(90);

  const env = FS.env = {
    doy: 314, time: 8.5, rate: 1, t: 0,
    wx: { name: 'Scattered cloud', key: 'scattered', windDir: 60, windKt: 6, gustKt: 6, visKm: 28, baseFt: 3500, cover: 0.35, turb: 0.12, tempC: 30, qnh: 1012, rain: 0, storm: false },
    windNow: new V3(), turbNow: new V3(), windKtNow: 0, windDirNow: 0,
    flash: 0, nextFlash: 8, wet: 0,
    L: {
      sunDir: new V3(0, 1, 0), moonDir: new V3(0, -1, 0), lightDir: new V3(0, 1, 0), sunEl: 60, dayF: 1,
      sunCol: new THREE.Color(), sunI: 1, hemiSky: new THREE.Color(), hemiGnd: new THREE.Color(), hemiI: 0.6,
      zenith: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(), glow: new THREE.Color(),
      starA: 0, moonI: 0, moonPhase: 0.5, nightF: 0
    }
  };

  env.presets = {
    winter:   { name: 'Clear winter morning', doy: 15, time: 7.4, windDir: 50, windKt: 4, gustKt: 4, visKm: 45, baseFt: 7000, cover: 0.04, turb: 0.03, tempC: 21, qnh: 1016, rain: 0, storm: false },
    summer:   { name: 'Hot summer afternoon', doy: 112, time: 14.5, windDir: 235, windKt: 9, gustKt: 16, visKm: 18, baseFt: 5500, cover: 0.28, turb: 0.42, tempC: 36, qnh: 1007, rain: 0, storm: false },
    haze:     { name: 'Haze', windDir: 70, windKt: 4, gustKt: 4, visKm: 5, baseFt: 6000, cover: 0.1, turb: 0.06, tempC: 29, qnh: 1011, rain: 0, storm: false },
    scattered:{ name: 'Scattered cloud', windDir: 60, windKt: 6, gustKt: 6, visKm: 28, baseFt: 3500, cover: 0.35, turb: 0.12, tempC: 30, qnh: 1012, rain: 0, storm: false },
    overcast: { name: 'Overcast', windDir: 240, windKt: 10, gustKt: 13, visKm: 12, baseFt: 2600, cover: 0.96, turb: 0.15, tempC: 26, qnh: 1010, rain: 0, storm: false },
    rain:     { name: 'Rain', windDir: 250, windKt: 12, gustKt: 19, visKm: 4.5, baseFt: 1900, cover: 1, turb: 0.28, tempC: 24, qnh: 1008, rain: 0.6, storm: false },
    monsoon:  { name: 'Southwest monsoon storm', doy: 192, windDir: 245, windKt: 18, gustKt: 30, visKm: 2.8, baseFt: 1300, cover: 1, turb: 0.7, tempC: 23, qnh: 1004, rain: 1, storm: true },
    fog:      { name: 'Fog', doy: 355, time: 7.5, windDir: 40, windKt: 1, gustKt: 1, visKm: 0.7, baseFt: 400, cover: 0.25, turb: 0, tempC: 19, qnh: 1015, rain: 0, storm: false }
  };
  env.applyPreset = (key, keepTime) => {
    const p = env.presets[key]; if (!p) return;
    for (const k in p) {
      if (k === 'doy') { env.doy = p.doy; continue; }
      if (k === 'time') { if (!keepTime) env.time = p.time; continue; }
      env.wx[k] = p[k];
    }
    env.wx.key = key;
    FS.bus.emit('weather');
  };

  /* ---- atmosphere ---- */
  env.fieldAltM = () => AD.ELEV_M;
  env.pressureAt = (hM) => env.wx.qnh * 100 * Math.pow(1 - 2.25577e-5 * hM, 5.25588);
  env.tempAt = (hM) => env.wx.tempC + 273.15 - 0.0065 * (hM - AD.ELEV_M);
  env.rhoAt = (hM) => env.pressureAt(hM) / (287.05 * env.tempAt(hM));
  env.indicatedAlt = (hM, kollsmanHpa) => {
    const p = env.pressureAt(hM);
    return (1 - Math.pow(p / (kollsmanHpa * 100), 1 / 5.25588)) / 2.25577e-5;
  };
  env.densityAltFt = () => {
    const pa = (1 - Math.pow(env.pressureAt(AD.ELEV_M) / 101325, 1 / 5.25588)) / 2.25577e-5 / FT;
    const isa = 15 - 1.98 * pa / 1000;
    return pa + 118.8 * (env.wx.tempC - isa);
  };
  env.dewPoint = () => Math.round(env.wx.tempC - (env.wx.rain > 0 ? 1 : env.wx.visKm < 1.5 ? 0.5 : env.wx.visKm < 6 ? 4 : 9));

  /* ---- wind ---- */
  const tmp = new V3(), wTgt = new V3();
  env.windAt = (aglM, out) => {
    const f = clamp(Math.pow(Math.max(aglM, 1.5) / 10, 0.16), 0.7, 1.55);
    return out.copy(env.windNow).multiplyScalar(f).add(tmp.copy(env.turbNow).multiplyScalar(aglM < 4 ? 0.45 : 1));
  };
  env.activeRunway = () => {
    const hw = Math.cos((env.wx.windDir - AD.RWY_TRUE) * DEG) * env.wx.windKt;
    return hw >= -0.5 ? '05' : '23';
  };
  env.windComponents = (rwy) => {
    const rh = rwy === '05' ? AD.RWY_TRUE : AD.RWY_TRUE + 180;
    const d = (env.wx.windDir - rh) * DEG;
    return { head: Math.cos(d) * env.wx.windKt, cross: Math.sin(d) * env.wx.windKt };
  };

  /* ---- sun and moon ---- */
  function solar(doy, timeH, outDir) {
    const decl = 23.44 * DEG * Math.sin(2 * Math.PI * (284 + doy) / 365);
    const B = 2 * Math.PI * (doy - 81) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const st = timeH + (4 * (LON - 82.5) + eot) / 60;
    const H = (st - 12) * 15 * DEG;
    return celestial(decl, H, outDir);
  }
  function celestial(decl, H, outDir) {
    const E = -Math.cos(decl) * Math.sin(H);
    const N = Math.cos(LAT) * Math.sin(decl) - Math.sin(LAT) * Math.cos(decl) * Math.cos(H);
    const U = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
    outDir.set(0, U, 0).addScaledVector(EAST, E).addScaledVector(NORTH, N).normalize();
    return { H, decl, el: Math.asin(clamp(U, -1, 1)) / DEG };
  }
  const C = (h) => new THREE.Color(h);
  const cNightZ = C(0x03050b), cNightH = C(0x0a101c), cDayZ = C(0x2a66b6), cDayH = C(0xb4cfe8),
    cTwiZ = C(0x1c2a58), cTwiH = C(0xf0915a), cHaze = C(0xcfd2cc), cOvc = C(0x8a9299), cStorm = C(0x4a525c),
    cSunDay = C(0xfff3de), cSunLow = C(0xff8b3d), cMoon = C(0x9fb4d8), tc = C(0);

  env.updateLight = () => {
    const L = env.L, wx = env.wx;
    const s = solar(env.doy, env.time, L.sunDir);
    L.sunEl = s.el;
    // moon: lags the sun by its phase
    const days = (env.doy + 26 * 365.25 + 9) % 29.53; // rough synodic age
    L.moonPhase = days / 29.53;
    const mDecl = 20 * DEG * Math.sin(2 * Math.PI * (days / 27.32 + env.doy / 365));
    const m = celestial(mDecl, s.H - 2 * Math.PI * L.moonPhase, L.moonDir);
    const illum = (1 - Math.cos(2 * Math.PI * L.moonPhase)) / 2;
    const dayF = L.dayF = sstep(-6, 7, s.el);
    L.nightF = 1 - sstep(-9, 0, s.el);
    const twi = sstep(-9, -1, s.el) * (1 - sstep(4, 16, s.el));
    const cov = wx.cover, dark = wx.storm ? 1 : 0;
    // sky colours
    L.zenith.copy(cNightZ).lerp(cTwiZ, sstep(-12, -2, s.el)).lerp(cDayZ, sstep(-2, 12, s.el));
    L.horizon.copy(cNightH).lerp(cTwiH, twi * 0.9).lerp(cDayH, sstep(0, 14, s.el));
    const hazeF = 1 - sstep(3, 16, wx.visKm);
    tc.copy(cHaze).multiplyScalar(0.12 + 0.88 * dayF);
    L.horizon.lerp(tc, hazeF * 0.85); L.zenith.lerp(tc, hazeF * 0.45);
    tc.copy(dark ? cStorm : cOvc).multiplyScalar(0.06 + 0.94 * dayF);
    const ovc = sstep(0.55, 1, cov);
    L.zenith.lerp(tc, ovc * 0.92); L.horizon.lerp(tc, ovc * 0.8);
    L.glow.copy(cSunLow).lerp(cSunDay, sstep(2, 20, s.el));
    L.fog.copy(L.horizon);
    // direct light
    const sunUp = sstep(-1.5, 6, s.el);
    const moonUp = sstep(0, 10, m.el) * illum;
    L.sunCol.copy(cSunLow).lerp(cSunDay, sstep(3, 22, s.el));
    const block = 1 - 0.82 * ovc - 0.25 * hazeF * (1 - ovc);
    L.sunI = sunUp * 1.05 * block;
    L.moonI = (1 - sunUp) * moonUp * 0.22 * (1 - 0.8 * ovc);
    if (L.sunI >= L.moonI * 0.5) L.lightDir.copy(L.sunDir); else { L.lightDir.copy(L.moonDir); L.sunCol.copy(cMoon); }
    L.dirI = Math.max(L.sunI, L.moonI);
    L.hemiSky.copy(L.zenith).lerp(L.horizon, 0.55).lerp(C(0xffffff), 0.25 * dayF);
    L.hemiGnd.set(0x8d897f).multiplyScalar(0.22 + 0.78 * dayF);
    L.hemiI = 0.26 + 0.52 * dayF * (1 - 0.25 * ovc) + 0.06 * moonUp + env.flash * 1.4;
    L.starA = (1 - sstep(-10, -3, s.el)) * (1 - ovc) * (1 - hazeF * 0.7);
  };

  /* ---- per-frame ---- */
  env.update = (dt) => {
    const wx = env.wx;
    env.t += dt;
    env.time += dt * env.rate / 3600;
    if (env.time >= 24) { env.time -= 24; env.doy = (env.doy % 365) + 1; }
    if (env.time < 0) env.time += 24;
    // gusts
    const g = sstep(0.52, 0.86, vnoise(env.t * 0.21, 3.7));
    const spd = wx.windKt + Math.max(0, wx.gustKt - wx.windKt) * g;
    const dir = wx.windDir + (vnoise(env.t * 0.09, 9.1) - 0.5) * (8 + 20 * wx.turb);
    env.windKtNow = spd; env.windDirNow = wrap360(dir);
    FS.hdgToDir(dir, wTgt).multiplyScalar(-spd * KT);
    if (dt <= 0 || env.windSnap) { env.windNow.copy(wTgt); env.windSnap = false; } else env.windNow.lerp(wTgt, Math.min(1, dt * 0.5));
    const sig = wx.turb * (1.4 + 0.13 * spd);
    const t = env.t;
    env.turbNow.set(
      (fbm(t * 0.9, 1.3, 3) - 0.47) * 2.2 * sig,
      (fbm(t * 1.1, 5.9, 3) - 0.47) * 2.0 * sig,
      (fbm(t * 0.8, 11.2, 3) - 0.47) * 2.2 * sig);
    // lightning
    env.flash = Math.max(0, env.flash - dt * 5);
    if (wx.storm) {
      env.nextFlash -= dt;
      if (env.nextFlash <= 0) {
        env.nextFlash = 3 + Math.random() * 11;
        env.flash = 1;
        env.flashAz = Math.random() * Math.PI * 2;
        FS.bus.emit('lightning', 0.6 + Math.random() * 4);
      }
    }
    env.wet = approach(env.wet, wx.rain > 0.05 ? 1 : 0, dt / (wx.rain > 0.05 ? 25 : 240));
    env.updateLight();
  };

  env.timeString = (h) => {
    h = h === undefined ? env.time : h;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return (hh < 10 ? '0' : '') + hh + (mm < 10 ? '0' : '') + mm;
  };
  const MONTHS = [['Jan', 31], ['Feb', 28], ['Mar', 31], ['Apr', 30], ['May', 31], ['Jun', 30], ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Oct', 31], ['Nov', 30], ['Dec', 31]];
  env.dateString = () => {
    let d = env.doy;
    for (const [n, len] of MONTHS) { if (d <= len) return d + ' ' + n; d -= len; }
    return '31 Dec';
  };
  env.cloudCode = () => {
    const c = env.wx.cover;
    return c < 0.06 ? 'SKC' : c < 0.25 ? 'FEW' : c < 0.5 ? 'SCT' : c < 0.88 ? 'BKN' : 'OVC';
  };
  env.atis = () => {
    const wx = env.wx, r = env.activeRunway();
    const letter = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(env.time) % 24];
    const wdir = Math.round(FS.toMag(wx.windDir) / 10) * 10 || 360;
    const wind = wx.windKt < 1.5 ? 'calm' : (('00' + wdir).slice(-3) + ' degrees ' + Math.round(wx.windKt) + ' knots' + (wx.gustKt > wx.windKt + 4 ? ', gusting ' + Math.round(wx.gustKt) : ''));
    const vis = wx.visKm >= 10 ? '10 km or more' : wx.visKm >= 1 ? wx.visKm.toFixed(wx.visKm < 5 ? 1 : 0) + ' km' : Math.round(wx.visKm * 1000) + ' m';
    const cc = env.cloudCode();
    const cloud = cc === 'SKC' ? 'sky clear' : cc + ' ' + Math.round(wx.baseFt / 100) * 100 + ' ft';
    const wxp = wx.storm ? ', thunderstorm with heavy rain' : wx.rain > 0.5 ? ', rain' : wx.rain > 0 ? ', light rain' : wx.visKm < 1 ? ', fog' : wx.visKm < 5 ? ', haze' : '';
    return 'Coimbatore information ' + letter + ', time ' + env.timeString() + ' IST. Runway ' + r + ' in use. Wind ' + wind +
      '. Visibility ' + vis + wxp + '. Cloud ' + cloud + '. Temperature ' + Math.round(wx.tempC) + ', dew point ' + env.dewPoint() +
      '. QNH ' + Math.round(wx.qnh) + '. Density altitude ' + Math.round(env.densityAltFt() / 100) * 100 + ' ft.' +
      (r === '05' ? ' PAPI 3.4 degrees.' : ' ILS 109.1 available, PAPI 3 degrees.');
  };
})();
