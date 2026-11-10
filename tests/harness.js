(() => {
  const F = window.__FS, ac = F.ac, env = F.env, cl = (v,a,b)=>Math.max(a,Math.min(b,v));
  const ang = (a,b)=>((a-b+540)%360)-180;
  const log = window.__log = [];
  F.bus.on('radio', r => log.push('RADIO: ' + r.text));
  F.bus.on('lesson', e => { if (e && e.step) log.push('STEP -> ' + (F.Lessons.i+1) + ': ' + F.Lessons.text().slice(0,70)); });
  F.bus.on('debrief', d => log.push('DEBRIEF ' + d.title + ' score ' + d.score + ' :: ' + d.rows.map(r => r[0] + '=' + r[1] + ' [' + (r[2]===null?'-':Math.round(r[2]*100)) + ']').join(' | ')));
  F.bus.on('crash', r => log.push('CRASH: ' + r));
  F.bus.on('touchdown', e => log.push('TOUCHDOWN sink ' + (e.sink/0.3048*60).toFixed(0) + ' fpm ias ' + e.ias.toFixed(0) + ' x ' + e.x.toFixed(0) + ' z ' + e.z.toFixed(1)));
  F.bus.on('liftoff', e => log.push('LIFTOFF ias ' + e.ias.toFixed(1) + ' x ' + e.x.toFixed(0)));
  const A = window.AP = { yi: 0, pi: 0, th: null, ti: 0, thrI: 0 };
  A.reset = () => { A.yi = 0; A.pi = 0; A.th = null; A.ti = 0; A.thrI = 0; };
  A.ball = () => { A.yi = cl(A.yi + ac.o.ball*2.0/60, -1, 1); ac.ctl.yaw = cl(A.yi + ac.o.ball*2.0 + ac.w.y*0.8, -1, 1); };
  A.bank = (b) => { ac.ctl.roll = cl((b - ac.o.bank)*0.04 - ac.w.x*0.6, -1, 1); };
  A.hdg = (h, maxB) => { A.bank(cl(ang(h, ac.o.hdg)*1.3, -(maxB||25), maxB||25)); };
  A.pitch = (thc) => { A.pi = cl(A.pi + (thc - ac.o.pitch)*0.05/60, -0.6, 0.6); ac.ctl.pitch = cl((thc - ac.o.pitch)*0.08 - ac.w.z*1.0 + A.pi, -1, 1); };
  A.ias = (v) => { if (A.th === null) A.th = ac.o.pitch; A.th = cl(A.th + (ac.o.ias - v)*0.15/60, -15, 20); A.pitch(cl(A.th + (ac.o.ias - v)*0.4, -15, 18)); };
  A.alt = (ft) => { const e = (ft - ac.o.indAlt)*0.3048; A.ti = cl(A.ti + e*0.02/60, -6, 12); A.pitch(cl(e*0.12 - ac.vel.y*0.9, -8, 10) + A.ti); };
  // run sim for T seconds at 60 Hz control rate; fn(t) returns true to stop
  window.sim = (T, fn) => {
    F.app.paused = true; const dt = 1/60; let t = 0;
    for (; t < T; t += dt) {
      if (fn && fn(t) === true) break;
      env.update(dt); for (let i = 0; i < 4; i++) ac.step(dt/4); ac.derive(dt);
      F.Metrics.update(dt); F.ATC.update(dt); F.Lessons.update(dt);
      if (ac.crashed) break;
    }
    return t;
  };
  window.st = () => { const o = ac.o; return 'ias ' + o.ias.toFixed(0) + ' alt ' + o.indAlt.toFixed(0) + ' agl ' + o.aglFt.toFixed(0) + ' hdg ' + o.hdg.toFixed(0) + ' vs ' + o.vs.toFixed(0) + ' x ' + ac.pos.x.toFixed(0) + ' z ' + ac.pos.z.toFixed(0) + ' rpm ' + ac.eng.rpm.toFixed(0) + ' gs ' + o.gs.toFixed(1) + ' step ' + (F.Lessons.cur ? F.Lessons.i+1 : '-') + ' atc ' + F.ATC.phase; };
  // generic phases for runway 05
  window.takeoff = (untilAgl) => sim(120, () => { const c = ac.ctl; c.throttle = 1; c.parkBrake = false; c.brakeL = c.brakeR = 0;
      if (ac.onGround) { c.yaw = cl(-ac.pos.z*0.05 - ac.vel.z*0.15 + ac.w.y*1.5, -1, 1); c.roll = 0; c.pitch = ac.o.ias > 55 ? 0.3 : 0; }
      else { A.ias(74); A.hdg(F.rwy().hdg + cl(-ac.pos.z*F.rwy().s*0.1, -15, 15), 15); A.ball(); }
      return ac.o.aglFt > untilAgl; });
  window.landing = () => { // from final: track centreline, PAPI path, flare
    const r = F.rwy(); let flare = false;
    return sim(400, () => { const c = ac.ctl, o = ac.o, al = r.along(ac.pos.x), left = r.left(ac.pos.z);
      if (ac.onGround) { c.throttle = 0; c.pitch = o.gs > 25 ? 0.25 : 0; c.roll = 0; c.yaw = cl(left*0.05*1 + (-ac.vel.z*r.s)*-0.0 + ac.w.y*1.5 - (-left)*0, -1, 1); c.yaw = cl((left*0.06) + ac.w.y*1.5, -1, 1); c.brakeL = c.brakeR = o.gs < 45 ? 0.6 : 0; return o.gs < 3; }
      A.hdg(r.hdg + cl(left*0.12, -25, 25), 20); A.ball();
      const hPath = Math.tan(r.papi*Math.PI/180) * (320 - al), h = ac.pos.y - (-0.0054*r.thrX), agl = o.aglFt*0.3048;
      if (agl < 4.5) flare = true;
      if (flare) { c.throttle = 0; A.pitch(cl(5.5 - agl*0.8, 2, 6)); }
      else { A.ias(66); A.thrI = cl(A.thrI + (hPath - h)*0.004/60, -0.3, 0.5); c.throttle = cl(0.38 + (hPath - h)*0.03 + A.thrI - ac.vel.y*0.0, 0, 1); }
      return false; });
  };
})();
