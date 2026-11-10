const F = window.__FS; F.env.wx.windKt = 3; F.env.wx.gustKt = 3; F.env.wx.turb = 0.03;
F.app.startLesson('circuit'); AP.reset();
const ac = F.ac; ac.elec.land = true; ac.elec.strobe = true; ac.ctl.trim = 0.24; ac.ctl.mixture = 1;
sim(1.5); 
takeoff(520);
return st();
//---
const F = window.__FS, ac = F.ac, r = F.rwy();
// crosswind leg: climb at 74 on heading rwy-90 until 2300 ft, then level
sim(200, () => { ac.ctl.throttle = ac.o.indAlt > 2260 ? 0.72 : 1; if (ac.o.indAlt > 2260) AP.alt(2300); else AP.ias(76); AP.hdg(r.hdg - 90, 22); AP.ball(); return Math.abs(ac.pos.z) > 1500; });
console.log('crosswind done: ' + st());
// downwind
sim(300, () => { ac.ctl.throttle = 0.7; AP.alt(2300); AP.hdg(r.hdg + 180 + Math.max(-15, Math.min(15, (-1700 - ac.pos.z) * 0.05 * -1)), 22); AP.ball(); return r.along(ac.pos.x) < -100; });
console.log('downwind done: ' + st());
// abeam: reduce power, flaps 10, descend 75
sim(120, () => { ac.ctl.throttle = 0.3; ac.ctl.flapSel = 1; AP.ias(76); AP.hdg(r.hdg + 180, 22); AP.ball(); return r.along(ac.pos.x) < -1100; });
console.log('descending: ' + st());
// base
sim(200, () => { ac.ctl.throttle = 0.33; ac.ctl.flapSel = 2; AP.ias(71); AP.hdg(r.hdg + 90, 25); AP.ball(); return Math.abs(ac.pos.z) < 420; });
console.log('base done: ' + st());
ac.ctl.flapSel = 3;
return st();
//---
//shot fl_final
const F = window.__FS, ac = F.ac, r = F.rwy();
sim(60, () => { ac.ctl.flapSel = 3; AP.ias(66); AP.hdg(r.hdg + Math.max(-30, Math.min(30, r.left(ac.pos.z) * 0.12)), 25); AP.ball(); ac.ctl.throttle = 0.4; return r.along(ac.pos.x) > -1500 || ac.o.aglFt < 420; });
return 'on final: ' + st();
//---
landing();
sim(3);
return st() + '\n' + window.__log.join('\n');
