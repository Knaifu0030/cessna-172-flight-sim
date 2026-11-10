// lesson 3 taxi
const F = window.__FS, ac = F.ac; F.env.wx.windKt = 3;
F.app.startLesson('taxi'); AP.reset();
sim(1); F.cockpit('atisBtn'); sim(1); F.cockpit('twrBtn'); sim(6); ac.elec.taxi = true; ac.ctl.parkBrake = false; sim(1);
sim(240, () => { const c = ac.ctl, o = ac.o; const tgt = ac.pos.z > 116 ? 9 : 0; c.throttle = o.gs < tgt ? 0.32 : 0.05; c.brakeL = c.brakeR = (ac.pos.z < 116 || o.gs > tgt + 3) ? 0.8 : 0;
  const herr = ((o.hdg - (45.77 - 90) + 540) % 360) - 180; c.yaw = Math.max(-1, Math.min(1, -herr*0.08 - (ac.pos.x - 1000)*0.25)); 
  return F.Lessons.i >= 6; });
console.log('at hold: ' + st());
ac.ctl.parkBrake = true; sim(10, () => { ac.ctl.throttle = 0; });
const out = st() + '\n' + window.__log.join('\n'); window.__log.length = 0; return out;
//---
// lesson 2 start-up
const F = window.__FS, ac = F.ac, c = ac.ctl, el = ac.elec;
F.app.startLesson('start'); AP.reset();
sim(1);
sim(3, (t) => { c.pitch = Math.sin(t*4); c.roll = Math.cos(t*4); }); c.pitch = c.roll = 0;
ac.fuel.sel = 'BOTH'; sim(1); F.cockpit('masterBat'); F.cockpit('masterAlt'); sim(1); F.cockpit('beacon'); sim(1); c.mixture = 1; sim(1); c.throttle = 0.1; sim(1);
F.cockpit('pump'); sim(3); F.cockpit('pump'); sim(1);
F.cockpit('ign', 1); F.cockpit('ign', 1); F.cockpit('ign', 1); F.cockpit('ign', 1); sim(4);
c.throttle = 0.12; sim(12); console.log('1000rpm? ' + st() + ' oilP ' + ac.eng.oilP.toFixed(0));
F.cockpit('avionics'); F.cockpit('nav'); sim(1);
while (Math.round(ac.inst.kollsman) !== Math.round(F.env.wx.qnh)) F.cockpit('kollsman', Math.round(ac.inst.kollsman) > Math.round(F.env.wx.qnh) ? -1 : 1); sim(1);
let thr = 0.5; sim(25, () => { thr += (1800 - ac.eng.rpm)*0.00002; c.throttle = thr; return F.Lessons.i >= 14; });
console.log('runup: ' + st() + ' thr ' + thr.toFixed(2));
F.cockpit('ign', -1); F.cockpit('ign', -1); sim(3); console.log('mag R rpm ' + ac.eng.rpm.toFixed(0));
F.cockpit('ign', 1); sim(3); console.log('mag L rpm ' + ac.eng.rpm.toFixed(0)); F.cockpit('ign', 1); sim(2);
c.throttle = 0; sim(8); c.throttle = 0.12; sim(10);
const out = st() + '\n' + window.__log.filter(l=>!l.startsWith('STEP')).join('\n'); window.__log.length = 0; return out;
