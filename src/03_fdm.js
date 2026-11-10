/* ============================================================
   Cessna 172S flight dynamics.
   Aircraft local axes: +X nose, +Y up, +Z right wing. Origin at CG.
   p = w.x (roll right), q = w.z (pitch up), r = -w.y (yaw right).
   ============================================================ */
(function () {
  const V3 = THREE.Vector3, Quat = THREE.Quaternion;
  const P = FS.P = {
    S: 16.17, b: 11.0, c: 1.494, D: 1.93,
    baseLb: 2300 - 53 * 6, IX: 1285, IY: 2667, IZ: 1825,
    CL0: 0.31, CLa: 4.9, CD0: 0.0335, K: 0.0568,
    aStall0: 15.6 * DEG, aStall30: 12.6 * DEG,
    Cm0: -0.015, Cma: -0.89, Cmq: -12.4, Cmde: 1.28,
    CYb: -0.31, CYdr: -0.187,
    Clb: -0.089, Clp: -0.47, Clda: 0.178, Cldr: -0.0147,
    Cnb: 0.065, Cnp: -0.03, Cnr: -0.099, Cnda: -0.0075, Cndr: 0.0657,
    Ct0: 0.094, J0: 1.02,
    elevUp: 28 * DEG, elevDn: 23 * DEG, ailMax: 17 * DEG, rudMax: 17 * DEG, trimAuth: 13 * DEG,
    gearRest: 1.15
  };
  const FLAP_CL = [[0, 0], [0.3333, 0.25], [0.6667, 0.45], [1, 0.60]];
  const FLAP_CD = [[0, 0], [0.3333, 0.009], [0.6667, 0.021], [1, 0.036]];
  const IAS_UP = [[0, 0], [30, 22], [45, 37], [53, 48], [56, 50], [62, 60], [70, 70], [78, 80], [87, 90], [97, 100], [107, 110], [117, 120], [127, 130], [137, 140], [147, 150], [157, 160], [170, 173]];
  const IAS_DN = [[0, 0], [30, 20], [42, 32], [48, 40], [54, 50], [62, 60], [71, 70], [81, 80], [86, 85], [100, 99]];
  FS.casToIas = (cas, flap) => lerp(interp(IAS_UP, cas), interp(IAS_DN, cas), clamp(flap * 1.5, 0, 1));

  const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tE = new V3(), tF = new V3();
  const qInv = new Quat(), dq = new Quat(), AX = new V3();
  const UP = new V3(0, 1, 0);

  class Aircraft {
    constructor() {
      this.pos = new V3(); this.vel = new V3(); this.q = new Quat(); this.w = new V3();
      this.ctl = { pitch: 0, roll: 0, yaw: 0, throttle: 0, mixture: 1, brakeL: 0, brakeR: 0, flapSel: 0, trim: 0, parkBrake: true };
      this.surf = { ail: 0, elev: 0, rud: 0, flap: 0, steer: 0 };
      this.eng = { rpm: 0, running: false, crank: 0, startT: 0, mags: 0, oilT: 85, oilP: 0, egt: 85, ff: 0, power: 0, fail: false, propAng: 0, hobbs: 0 };
      this.elec = { bat: false, alt: false, avionics: false, pump: false, beacon: false, land: false, taxi: false, nav: false, strobe: false, pitot: false, panelLt: 0.7, cabinLt: 0, volts: 0, amps: 0, bus: false, charge: 1 };
      this.fuel = { L: 26.5, R: 26.5, sel: 'BOTH' };
      this.inst = { kollsman: 1013, hdgBug: 45, obs: 48, gyro: 0, vsInd: 0, compass: 48, com1: AD.TWR, com1s: AD.ATIS, nav1: AD.ILS23, nav1s: AD.VOR, xpdr: 2000, hdgDrift: 0 };
      this.gear = [
        { p: new V3(1.30, -1.25, 0), k: 24000, c: 2600, nose: true, comp: 0, N: 0, spin: 0 },
        { p: new V3(-0.35, -1.25, -1.27), k: 45000, c: 4700, side: -1, comp: 0, N: 0, spin: 0 },
        { p: new V3(-0.35, -1.25, 1.27), k: 45000, c: 4700, side: 1, comp: 0, N: 0, spin: 0 }
      ];
      this.struct = [
        { p: new V3(2.1, -0.90, 0), name: 'propeller', crash: true },
        { p: new V3(0.3, 0.95, -5.45), name: 'left wingtip', crash: true },
        { p: new V3(0.3, 0.95, 5.45), name: 'right wingtip', crash: true },
        { p: new V3(0, -0.62, 0), name: 'fuselage', crash: true },
        { p: new V3(-5.0, -0.2, 0), name: 'tail', crash: false }
      ];
      this.onGround = true; this.airT = 0; this.gndT = 5; this.crashed = false; this.crashReason = '';
      this.o = { ias: 0, cas: 0, tas: 0, gs: 0, vs: 0, altFt: 0, aglFt: 0, hdg: 45, hdgMag: 47, pitch: 0, bank: 0, aoa: 0, beta: 0, ball: 0, nz: 1, turnRate: 0, stallWarn: false, stall: 0, buffet: 0, thrust: 0, rho: 1.1, surface: 'apron', indAlt: 0, track: 45 };
      this.fAcc = new V3(); this.tailStrike = 0; this.overspeedT = 0;
    }
    mass() { return (P.baseLb + (this.fuel.L + this.fuel.R) * 6) * 0.4536; }

    /* place the aircraft. opt: x,z,hdg(true),agl(m, 0 = on ground),kias,state:'cold'|'idle'|'flight',flaps */
    place(opt) {
      const a = (opt.hdg - AD.RWY_TRUE) * DEG;
      this.q.setFromAxisAngle(UP, -a);
      this.w.set(0, 0, 0); this.vel.set(0, 0, 0);
      const gh = FS.groundH(opt.x, opt.z);
      const c = this.ctl, e = this.eng, el = this.elec;
      this.crashed = false; this.crashReason = ''; e.fail = false;
      c.pitch = c.roll = c.yaw = 0; c.brakeL = c.brakeR = 0; c.trim = 0.0; c.mixture = 1;
      this.surf.ail = this.surf.elev = this.surf.rud = 0;
      this.fuel.L = this.fuel.R = 26.5; this.fuel.sel = 'BOTH';
      this.inst.kollsman = Math.round(FS.env.wx.qnh); this.inst.vsInd = 0; this.inst.hdgBug = Math.round(FS.toMag(opt.hdg));
      if (opt.state === 'cold') {
        e.running = false; e.rpm = 0; e.mags = 0; e.oilT = FS.env.wx.tempC * 1.8 + 32; e.oilP = 0; e.egt = e.oilT;
        Object.assign(el, { bat: false, alt: false, avionics: false, pump: false, beacon: false, land: false, taxi: false, nav: false, strobe: false, pitot: false });
        c.throttle = 0; c.mixture = 0; c.parkBrake = true; c.flapSel = 0; this.surf.flap = 0; this.inst.gyro = 0;
        this.inst.kollsman = 1013;
      } else {
        e.running = true; e.mags = 3; e.oilT = 175; e.oilP = 60; e.egt = 1200;
        Object.assign(el, { bat: true, alt: true, avionics: true, pump: false, beacon: true, land: opt.agl > 0, taxi: false, nav: true, strobe: opt.agl > 0, pitot: false });
        this.inst.gyro = 1; el.volts = 28;
        c.flapSel = opt.flaps || 0; this.surf.flap = c.flapSel / 3;
        if (opt.agl > 0) {
          const v = (opt.kias || 75) * KT / Math.sqrt(FS.env.rhoAt(gh + opt.agl + AD.ELEV_M) / 1.225) * 1.03;
          const path = (opt.pathDeg || 0) * DEG;
          this.vel.set(Math.cos(a) * Math.cos(path) * v, Math.sin(path) * v, Math.sin(a) * Math.cos(path) * v);
          const aoa = (opt.aoaDeg === undefined ? 4 : opt.aoaDeg) * DEG;
          dq.setFromAxisAngle(tA.set(0, 0, 1), aoa + path); this.q.multiply(dq);
          c.throttle = opt.throttle === undefined ? 0.55 : opt.throttle; c.parkBrake = false; c.trim = opt.trim === undefined ? 0.12 : opt.trim;
          e.rpm = 1900;
        } else {
          c.throttle = 0.0; c.parkBrake = opt.park !== false; e.rpm = 700;
        }
      }
      this.pos.set(opt.x, gh + (opt.agl > 0 ? opt.agl : P.gearRest), opt.z);
      this.onGround = !(opt.agl > 0); this.airT = this.onGround ? 0 : 10; this.gndT = this.onGround ? 5 : 0;
      for (const g of this.gear) { g.comp = this.onGround ? 0.1 : 0; g.N = 0; }
      this.derive(0.016);
      this.inst.compass = this.o.hdgMag; this.inst.vsInd = this.o.vs;
    }

    systems(dt) {
      const c = this.ctl, e = this.eng, el = this.elec, f = this.fuel, env = FS.env;
      el.bus = (el.bat && el.charge > 0.03) || (el.alt && e.running && e.rpm > 580 && el.bat);
      const fuelOK = f.sel === 'L' ? f.L > 0.01 : f.sel === 'R' ? f.R > 0.01 : (f.L > 0.01 || f.R > 0.01);
      // starter
      if (e.mags === 4) {
        e.startT -= dt;
        if (el.bus && !e.running) {
          e.crank += dt;
          if (e.crank > 1.3 && fuelOK && c.mixture > 0.3 && !e.fail && !this.crashed) { e.running = true; FS.bus.emit('engineStart'); }
        }
        if (e.startT <= 0 || (e.running && e.crank > 1.6)) { e.mags = 3; e.crank = 0; }
      } else e.crank = 0;
      if (e.running && (e.mags === 0 || c.mixture < 0.08 || !fuelOK || e.fail || this.crashed)) { e.running = false; FS.bus.emit('engineStop'); }
      const vkt = Math.max(0, this.uAxial || 0) / KT;
      let tgt;
      if (e.running) {
        const dens = this.o.rho / 1.225;
        const mixF = c.mixture < 0.5 ? lerp(0.55, 1, sstep(0.08, 0.5, c.mixture)) : 1;
        const pf = Math.pow(dens, 0.7) * mixF;
        const full = 2350 + 0.8 * vkt + 0.0167 * vkt * vkt;
        tgt = 650 + (full - 650) * Math.pow(c.throttle, 0.62);
        tgt = 650 + (tgt - 650) * (0.78 + 0.22 * pf);
        tgt = Math.max(tgt, 450 + 9.5 * vkt);
        if (e.mags === 1 || e.mags === 2) tgt *= e.mags === 1 ? 0.95 : 0.957;
        e.rpm += (tgt - e.rpm) * Math.min(1, dt * 2.6);
        e.power = clamp(Math.pow(clamp((e.rpm - 600) / 2100, 0, 1.1), 2.4) * pf, 0, 1.1);
        e.ff = (1.6 + 16 * e.power) * (0.72 + 0.28 * sstep(0.3, 1, c.mixture));
        const burn = e.ff / 3600 * dt;
        if (f.sel === 'L') f.L -= burn; else if (f.sel === 'R') f.R -= burn; else {
          if (f.L > 0 && f.R > 0) { f.L -= burn / 2; f.R -= burn / 2; } else if (f.L > 0) f.L -= burn; else f.R -= burn;
        }
        f.L = Math.max(0, f.L); f.R = Math.max(0, f.R);
        e.hobbs += dt / 3600;
      } else {
        tgt = e.crank > 0 && el.bus ? 190 + 40 * Math.sin(e.crank * 22) : (vkt > 50 ? 7 * vkt : 0);
        e.rpm += (tgt - e.rpm) * Math.min(1, dt * (e.crank > 0 ? 6 : 1.4));
        if (e.rpm < 2) e.rpm = 0;
        e.power = 0; e.ff = 0;
      }
      e.propAng = (e.propAng + e.rpm / 60 * 2 * Math.PI * dt) % (Math.PI * 2);
      const amb = env.wx.tempC * 1.8 + 32;
      e.oilT += ((e.running ? 150 + 60 * e.power : amb) - e.oilT) * dt / (e.running ? 45 : 400);
      e.oilP += ((e.running ? 20 + 45 * sstep(400, 1400, e.rpm) + 10 * sstep(1400, 2500, e.rpm) : e.rpm * 0.05) - e.oilP) * Math.min(1, dt * 2);
      e.egt += ((e.running ? 1080 + 380 * e.power * (1.06 - 0.12 * Math.abs(c.mixture - 0.62)) : amb) - e.egt) * Math.min(1, dt / 3);
      const charging = e.running && el.alt && e.rpm > 580;
      const load = (el.bat ? 4 : 0) + (el.avionics ? 6 : 0) + (el.land ? 8 : 0) + (el.taxi ? 6 : 0) + (el.pitot ? 7 : 0) + (el.pump ? 4 : 0) + (el.beacon ? 2 : 0) + (el.nav ? 3 : 0) + (el.strobe ? 3 : 0) + (e.crank > 0 ? 120 : 0);
      el.amps = !el.bat ? 0 : charging ? 3 + (1 - el.charge) * 30 : -load;
      el.charge = clamp(el.charge + el.amps * dt / 3600 / 35, 0, 1);
      el.volts += ((!el.bat ? 0 : charging ? 28.0 : 22.5 + 2.2 * el.charge - (e.crank > 0 ? 4 : 0)) - el.volts) * Math.min(1, dt * 4);
      const vac = 5.1 * sstep(150, 760, e.rpm);
      this.inst.vac = vac;
      this.inst.gyro = approach(this.inst.gyro, vac > 3.6 ? 1 : 0, dt / (vac > 3.6 ? 9 : 70));
    }

    step(dt) {
      const c = this.ctl, s = this.surf, env = FS.env, o = this.o;
      this.systems(dt);
      // control surfaces
      s.ail = approach(s.ail, clamp(c.roll, -1, 1), dt * 6);
      s.elev = approach(s.elev, clamp(c.pitch, -1, 1), dt * 6);
      s.rud = approach(s.rud, clamp(c.yaw, -1, 1), dt * 6);
      if (this.elec.bus) s.flap = approach(s.flap, c.flapSel / 3, dt / 7.5);
      const m = this.mass();
      const gh = FS.groundH(this.pos.x, this.pos.z);
      const aglCG = this.pos.y - gh;
      const rho = o.rho = env.rhoAt(this.pos.y + AD.ELEV_M);
      qInv.copy(this.q).invert();
      // air-relative velocity in local axes
      env.windAt(Math.max(0, aglCG - P.gearRest), tA);
      tB.copy(this.vel).sub(tA).applyQuaternion(qInv);
      const u = tB.x, vy = tB.y, vz = tB.z;
      const V = tB.length();
      this.uAxial = u;
      const alpha = V > 1.5 ? Math.atan2(-vy, Math.max(u, 0.01)) : 0;
      const beta = V > 1.5 ? Math.atan2(vz, Math.hypot(u, vy)) : 0;
      const qbar = 0.5 * rho * V * V;
      const Ve = Math.max(V, 10);
      const p = this.w.x, qr = this.w.z, r = -this.w.y;
      const ph = p * P.b / (2 * Ve), qh = qr * P.c / (2 * Ve), rh = r * P.b / (2 * Ve);
      const fl = s.flap;
      const dCL = interp(FLAP_CL, fl), dCD = interp(FLAP_CD, fl);
      const aS = lerp(P.aStall0, P.aStall30, fl);
      // lift curve with stall break
      const sg = sstep(aS - 1.2 * DEG, aS + 5.5 * DEG, alpha);
      const sgN = sstep(11 * DEG, 17 * DEG, -alpha);
      let CLl = P.CL0 + dCL + P.CLa * Math.min(alpha, aS);
      CLl = Math.max(CLl, P.CL0 + dCL + P.CLa * (-12 * DEG));
      const a2 = Math.abs(alpha);
      const CLpost = lerp(0.98 + 0.25 * fl, 1.1 * Math.sin(2 * Math.min(a2, 1.4)), sstep(20 * DEG, 42 * DEG, a2));
      let CL = lerp(CLl, CLpost, sg);
      CL = lerp(CL, -0.75, sgN);
      const hb = (aglCG + 0.9) / P.b;
      const ge = hb < 1.2 ? (256 * hb * hb) / (1 + 256 * hb * hb) : 1;
      CL *= 1 + 0.06 * (1 - ge);
      let CD = P.CD0 + dCD + P.K * CL * CL * ge + 0.55 * beta * beta;
      CD = lerp(CD, Math.max(CD, P.CD0 + dCD + 1.7 * Math.pow(Math.sin(a2), 2)), Math.max(sg, sgN));
      const dr = s.rud * P.rudMax, da = s.ail * P.ailMax;
      const de = (s.elev > 0 ? s.elev * P.elevUp : s.elev * P.elevDn) + c.trim * P.trimAuth;
      // propeller
      const e = this.eng;
      const n = e.rpm / 60;
      let T = 0;
      if (e.running || e.crank > 0) {
        const J = Math.max(u, 0) / (Math.max(n, 2) * P.D);
        const Ct = Math.max(-0.03, P.Ct0 * (1 - (J / P.J0) * (J / P.J0)));
        T = Ct * rho * n * n * Math.pow(P.D, 4);
      } else T = -0.5 * rho * u * Math.abs(u) * 0.26;
      o.thrust = T;
      const qTail = qbar + 0.7 * Math.max(T, 0) / 2.925;
      // forces, local
      const F = tC.set(0, 0, 0);
      if (V > 1.5) {
        const wx = tB.x / V, wy = tB.y / V, wz = tB.z / V;
        const Lf = qbar * P.S * CL, Df = qbar * P.S * CD, Yf = qbar * P.S * (P.CYb * beta + P.CYdr * dr);
        const ll = Math.hypot(wy, wx) || 1;
        F.set(-Df * wx + Lf * (-wy / ll), -Df * wy + Lf * (wx / ll), -Df * wz + Yf);
      }
      F.x += T;
      // moments, local
      const stallRnd = sg * 0.018 * (fbm(env.t * 1.7, 20.3, 2) - 0.5) * 2;
      const Clp = P.Clp * (1 - 1.25 * sg), Clr = 0.05 + 0.2 * clamp(CL, 0, 1.8);
      let Lr = qbar * P.S * P.b * (P.Clb * beta + Clp * ph + Clr * rh + P.Clda * da * (1 - 0.55 * sg) + P.Cldr * dr + stallRnd);
      let Mp = qbar * P.S * P.c * (P.Cm0 + P.Cma * alpha + P.Cmq * qh + 0.035 * fl - 0.1 * sg) + qTail * P.S * P.c * P.Cmde * de;
      let Ny = qbar * P.S * P.b * (P.Cnb * beta + P.Cnp * ph + P.Cnr * rh + P.Cnda * da) + qTail * P.S * P.b * P.Cndr * dr;
      if (T > 0) { Ny -= T * (0.2 + 2.0 * clamp(alpha, 0, 0.3)); Lr -= T * 0.055; }
      const Tq = tD.set(Lr, -Ny, Mp);
      // to world
      const Fw = tE.copy(F).applyQuaternion(this.q);
      Fw.y -= m * 9.80665;
      // ground contact
      let anyMain = false, anyWheel = false, Ntot = 0;
      const wW = tF.copy(this.w).applyQuaternion(this.q);
      const fwd = Aircraft._f.set(1, 0, 0).applyQuaternion(this.q);
      const fh = Aircraft._fh.set(fwd.x, 0, fwd.z); const fhl = fh.length() || 1; fh.multiplyScalar(1 / fhl);
      const rgh = Aircraft._rh.set(-fh.z, 0, fh.x);
      const surf = FS.surfaceAt ? FS.surfaceAt(this.pos.x, this.pos.z) : 'runway';
      o.surface = surf;
      const paved = surf !== 'grass';
      const wet = env.wet;
      const muRoll = paved ? 0.022 : 0.085, muBrake = paved ? lerp(0.6, 0.36, wet) : 0.32, muSide = paved ? lerp(0.78, 0.5, wet) : 0.55;
      const gs = Math.hypot(this.vel.x, this.vel.z);
      s.steer = s.rud * 11 * DEG / (1 + Math.pow(gs / 26, 2)) + (c.brakeR - c.brakeL) * 14 * DEG / (1 + gs / 6);
      const nrmX = AD.SLOPE * (1 - sstep(7000, 14000, Math.hypot(this.pos.x - 1500, this.pos.z)));
      const allPts = Aircraft._pts;
      allPts.length = 0;
      for (const g of this.gear) allPts.push(g);
      for (const g of this.struct) allPts.push(g);
      for (const g of allPts) {
        const rW = Aircraft._r.copy(g.p).applyQuaternion(this.q);
        const px = this.pos.x + rW.x, py = this.pos.y + rW.y, pz = this.pos.z + rW.z;
        const h = FS.groundH(px, pz);
        const pen = h - py;
        if (pen <= 0) { if (g.k) { g.N = 0; g.comp = Math.max(0, g.comp - dt * 2); } continue; }
        // contact point velocity
        const vp = Aircraft._vp.copy(wW).cross(rW).add(this.vel);
        let N, k = g.k || 90000, cd = g.c || 9000;
        N = k * pen - cd * vp.y;
        if (g.k && pen > 0.24) N += 250000 * (pen - 0.24);
        if (N < 0) N = 0;
        let dirF = fh, dirR = rgh;
        if (g.nose) {
          const cs = Math.cos(s.steer), sn = Math.sin(s.steer);
          dirF = Aircraft._nf.set(fh.x * cs - fh.z * sn, 0, fh.z * cs + fh.x * sn);
          dirR = Aircraft._nr.set(-dirF.z, 0, dirF.x);
        }
        const vl = vp.x * dirF.x + vp.z * dirF.z, vr = vp.x * dirR.x + vp.z * dirR.z;
        let fx = 0, fz = 0;
        if (g.k) {
          g.N = N; g.comp = Math.min(pen, 0.3); anyWheel = true; Ntot += N;
          if (!g.nose) anyMain = true;
          const br = g.nose ? 0 : (c.parkBrake ? 1 : g.side < 0 ? c.brakeL : c.brakeR);
          const fLong = -(muRoll + br * muBrake) * N * clamp(vl / 0.35, -1, 1);
          const fLat = -muSide * N * clamp(vr / Math.max(0.5, 0.14 * Math.abs(vl)), -1, 1);
          fx = dirF.x * fLong + dirR.x * fLat; fz = dirF.z * fLong + dirR.z * fLat;
          g.spin += vl * dt / 0.2;
        } else {
          const sp = Math.hypot(vp.x, vp.z) || 1;
          fx = -0.6 * N * vp.x / sp * clamp(sp / 0.5, 0, 1); fz = -0.6 * N * vp.z / sp * clamp(sp / 0.5, 0, 1);
          if (g.crash && !this.crashed && (this.vel.length() > 4 || vp.y < -2)) this.crash('The ' + g.name + ' struck the ground.');
          if (!g.crash) this.tailStrike = 1.5;
        }
        const fW = Aircraft._fw.set(fx + N * nrmX, N, fz);
        Fw.add(fW);
        // torque about CG (world) -> local
        Aircraft._tq.copy(rW).cross(fW).applyQuaternion(qInv);
        Tq.add(Aircraft._tq);
      }
      // integrate
      const ax = Fw.x / m, ay = Fw.y / m, az = Fw.z / m;
      this.fAcc.set(ax, ay + 9.80665, az).applyQuaternion(qInv);
      this.vel.x += ax * dt; this.vel.y += ay * dt; this.vel.z += az * dt;
      const w = this.w;
      const dwx = (Tq.x - (P.IZ - P.IY) * w.y * w.z) / P.IX;
      const dwy = (Tq.y - (P.IX - P.IZ) * w.z * w.x) / P.IY;
      const dwz = (Tq.z - (P.IY - P.IX) * w.x * w.y) / P.IZ;
      w.x += dwx * dt; w.y += dwy * dt; w.z += dwz * dt;
      // static friction lock when braked and nearly stopped
      const brk = c.parkBrake ? 1 : Math.min(c.brakeL, c.brakeR);
      if (anyMain && brk > 0.6 && gs < 0.35 && T < muBrake * Ntot * 0.8 && Math.abs(this.vel.y) < 0.3) {
        this.vel.x *= 0.5; this.vel.z *= 0.5; w.y *= 0.5;
      }
      if (this.crashed) { this.vel.x *= 1 - Math.min(1, dt * 1.2); this.vel.z *= 1 - Math.min(1, dt * 1.2); w.multiplyScalar(1 - Math.min(1, dt * 2)); }
      this.pos.addScaledVector(this.vel, dt);
      const wl = w.length();
      if (wl > 1e-7) { dq.setFromAxisAngle(AX.copy(w).multiplyScalar(1 / wl), wl * dt); this.q.multiply(dq).normalize(); }
      // state tracking and events
      o.aoa = alpha; o.beta = beta;
      o.stall = V > 13 ? sg : 0; o.buffet = sstep(aS - 2.5 * DEG, aS + 1.5 * DEG, alpha) * (V > 13 ? 1 : 0);
      o.stallWarn = alpha > aS - 5.5 * DEG && V > 14 && !anyWheel;
      const was = this.onGround;
      if (anyWheel) {
        if (!was && this.airT > 1.2 && anyMain) {
          const sink = -this.vel.y + 0;
          const crab = angDiff(FS.dirToHdg(fwd.x, fwd.z), FS.dirToHdg(this.vel.x, this.vel.z));
          FS.bus.emit('touchdown', { sink, ias: o.ias, x: this.pos.x, z: this.pos.z, bank: o.bank, pitch: o.pitch, crab, gs: gs, noseFirst: this.gear[0].N > 0 && this.gear[1].N === 0 && this.gear[2].N === 0 });
          if (sink > 4.7 && !this.crashed) this.crash('Touchdown at ' + Math.round(sink / FT * 60) + ' ft/min collapsed the landing gear.');
        }
        this.onGround = true; this.airT = 0; this.gndT += dt;
      } else {
        this.airT += dt;
        if (was && this.airT > 0.35) {
          this.onGround = false;
          if (this.gndT > 1) FS.bus.emit('liftoff', { ias: o.ias, x: this.pos.x, z: this.pos.z });
          this.gndT = 0;
        }
      }
      this.tailStrike = Math.max(0, this.tailStrike - dt);
      // buildings
      if (FS.obstacles && !this.crashed && this.pos.y - gh < 40) {
        for (const b of FS.obstacles) {
          if (this.pos.x > b[0] && this.pos.x < b[1] && this.pos.z > b[2] && this.pos.z < b[3] && this.pos.y - gh < b[4] + 1) { this.crash('You hit ' + (b[5] || 'a building') + '.'); break; }
        }
      }
      if (this.pos.y < gh - 2) { this.pos.y = gh + 0.3; this.vel.set(0, 0, 0); if (!this.crashed) this.crash('The aircraft hit the ground.'); }
    }

    crash(reason) {
      if (this.crashed) return;
      this.crashed = true; this.crashReason = reason;
      FS.bus.emit('crash', reason);
    }

    /* derived values for instruments and HUD; call once per frame */
    derive(dt) {
      const o = this.o, env = FS.env, q = this.q;
      const f = Aircraft._f.set(1, 0, 0).applyQuaternion(q);
      const up = Aircraft._r.set(0, 1, 0).applyQuaternion(q);
      const rt = Aircraft._vp.set(0, 0, 1).applyQuaternion(q);
      const hdgPrev = o.hdg;
      o.hdg = FS.dirToHdg(f.x, f.z); o.hdgMag = FS.toMag(o.hdg);
      o.pitch = Math.asin(clamp(f.y, -1, 1)) / DEG;
      o.bank = Math.atan2(-rt.y, up.y) / DEG;
      const gh = FS.groundH(this.pos.x, this.pos.z);
      const altM = this.pos.y + AD.ELEV_M;
      const rho = o.rho = env.rhoAt(altM);
      env.windAt(Math.max(0, this.pos.y - gh - P.gearRest), tA);
      const tas = tB.copy(this.vel).sub(tA).length();
      qInv.copy(q).invert();
      const ua = tB.applyQuaternion(qInv).x;
      o.tas = tas / KT;
      o.cas = Math.max(0, ua) * Math.sqrt(rho / 1.225) / KT;
      o.ias = FS.casToIas(o.cas, this.surf.flap) * sstep(8, 26, o.cas);
      o.gs = Math.hypot(this.vel.x, this.vel.z) / KT;
      o.track = o.gs > 2 ? FS.dirToHdg(this.vel.x, this.vel.z) : o.hdg;
      o.vs = this.vel.y / FT * 60;
      o.altFt = altM / FT; o.aglFt = (this.pos.y - gh - P.gearRest) / FT;
      o.indAlt = env.indicatedAlt(altM, this.inst.kollsman) / FT;
      o.nz = this.fAcc.y / 9.80665;
      const fy = Math.max(2, Math.abs(this.fAcc.y));
      o.ball += (clamp(-this.fAcc.z / fy, -0.35, 0.35) - o.ball) * Math.min(1, dt * 5);
      if (dt > 0) o.turnRate += (clamp(angDiff(o.hdg, hdgPrev) / dt, -30, 30) - o.turnRate) * Math.min(1, dt * 4);
      const I = this.inst;
      I.vsInd += (o.vs - I.vsInd) * Math.min(1, dt / 1.1);
      I.compass += angDiff(o.hdgMag + clamp(o.bank * 0.25, -12, 12), I.compass) * Math.min(1, dt * 1.2);
      I.compass = wrap360(I.compass);
      if (o.ias > 163) this.overspeedT += dt; else this.overspeedT = 0;
    }
  }
  Aircraft._f = new V3(); Aircraft._fh = new V3(); Aircraft._rh = new V3(); Aircraft._r = new V3(); Aircraft._vp = new V3();
  Aircraft._nf = new V3(); Aircraft._nr = new V3(); Aircraft._fw = new V3(); Aircraft._tq = new V3(); Aircraft._pts = [];
  FS.Aircraft = Aircraft;
})();
