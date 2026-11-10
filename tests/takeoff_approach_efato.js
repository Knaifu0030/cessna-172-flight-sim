// lesson 4: takeoff
const F = window.__FS, ac = F.ac; F.env.wx.windKt = 3; F.env.wx.gustKt = 3; F.env.wx.turb = 0.03;
F.app.startLesson('takeoff'); AP.reset(); ac.elec.land = true; ac.elec.strobe = true; ac.ctl.trim = 0.24;
sim(1.5);
sim(120, () => { const c = ac.ctl; c.throttle = 1; if (ac.onGround) { c.yaw = Math.max(-1, Math.min(1, -ac.pos.z*0.05 - ac.vel.z*0.15 + ac.w.y*1.5)); c.pitch = ac.o.ias > 55 ? 0.22 : 0; } else { AP.pitch(ac.o.ias < 70 ? 7 : 9.5 + (74 - ac.o.ias)*-0.5); AP.hdg(F.rwy().hdg + Math.max(-15, Math.min(15, -ac.pos.z*0.1)), 15); AP.ball(); } return ac.o.indAlt > 2240; });
console.log('climbed: ' + st());
sim(60, () => { ac.ctl.throttle = 0.74; AP.alt(2300); AP.hdg(F.rwy().hdg, 15); AP.ball(); return !F.Lessons.cur || F.Lessons.finished; });
const out = st() + '\n' + window.__log.join('\n'); window.__log.length = 0; return out;
//---
// lesson 6: approach
const F = window.__FS, ac = F.ac;
F.app.startLesson('approach'); AP.reset();
const r = F.rwy();
sim(10, () => { AP.ias(74); AP.hdg(r.hdg, 20); AP.ball(); ac.ctl.throttle = 0.42; });
ac.ctl.flapSel = 2;
sim(14, () => { AP.ias(69); AP.hdg(r.hdg + Math.max(-20, Math.min(20, r.left(ac.pos.z)*0.12)), 20); AP.ball(); ac.ctl.throttle = 0.4; });
ac.ctl.flapSel = 3; console.log('configured: ' + st());
landing(); sim(3);
const out = st() + '\n' + window.__log.join('\n'); window.__log.length = 0; return out;
//---
// lesson 8: engine failure
const F = window.__FS, ac = F.ac;
F.app.startLesson('efato'); AP.reset(); ac.ctl.trim = 0.24;
sim(1);
sim(120, () => { const c = ac.ctl; c.throttle = 1; if (ac.onGround) { c.yaw = Math.max(-1, Math.min(1, -ac.pos.z*0.05 - ac.vel.z*0.15 + ac.w.y*1.5)); c.pitch = ac.o.ias > 55 ? 0.22 : 0; } else { AP.pitch(ac.o.ias < 70 ? 7 : 9.5); AP.hdg(F.rwy().hdg, 15); AP.ball(); } return ac.eng.fail; });
console.log('failed at: ' + st());
let fl = false;
sim(200, () => { const c = ac.ctl, o = ac.o; if (ac.onGround) { c.pitch = 0.1; c.yaw = Math.max(-1, Math.min(1, -ac.pos.z*0.06 + ac.w.y*1.5)); c.brakeL = c.brakeR = 0.7; return o.gs < 2; }
  if (o.aglFt < 14) fl = true; if (fl) AP.pitch(Math.max(2, 6 - o.aglFt*0.25)); else AP.ias(68); if (o.aglFt < 250) c.flapSel = 3; AP.hdg(F.rwy().hdg + Math.max(-15, Math.min(15, -ac.pos.z*0.15)), 15); AP.ball(); });
sim(3);
const out = st() + '\n' + window.__log.join('\n'); window.__log.length = 0; return out;
