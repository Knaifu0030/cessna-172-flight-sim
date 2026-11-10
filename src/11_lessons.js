/* ============================================================
   Start positions, flight metrics, Tower prompts, lessons and debriefs
   ============================================================ */
(function () {
  const RW = AD.RWY_LEN, env = FS.env;
  FS.activeRwy = '05';
  FS.rwy = () => {
    const id = FS.activeRwy, s = id === '05' ? 1 : -1;
    return { id, s, hdg: wrap360(AD.RWY_TRUE + (s > 0 ? 0 : 180)), mag: s > 0 ? 48 : 228, papi: s > 0 ? AD.PAPI05 : AD.PAPI23, thrX: s > 0 ? 0 : RW, along: (x) => (s > 0 ? x : RW - x), left: (z) => -z * s };
  };
  const lineup = (id) => (id === '05' ? { x: 38, z: 0, hdg: AD.RWY_TRUE, state: 'idle', park: false } : { x: RW - 38, z: 0, hdg: AD.RWY_TRUE + 180, state: 'idle', park: false });
  const finalAt = (nm, kias, flaps) => {
    const r = FS.rwy(), d = nm * NM, x = r.thrX - r.s * d, y = -AD.SLOPE * r.thrX + Math.tan(r.papi * DEG) * (d + 320);
    return { x, z: 0, hdg: r.hdg, agl: y - FS.groundH(x, 0), kias: kias || 75, flaps: flaps === undefined ? 1 : flaps, state: 'flight', pathDeg: -r.papi, aoaDeg: 5, throttle: 0.42, trim: 0.2 };
  };
  FS.starts = {
    cold: { label: 'Cold and dark at the Flying Club hangar', make: () => ({ x: 1000, z: 246, hdg: AD.RWY_TRUE - 90, state: 'cold' }) },
    ready: { label: 'Engine running at the hangar', make: () => ({ x: 1000, z: 246, hdg: AD.RWY_TRUE - 90, state: 'idle' }) },
    hold: { label: 'Holding short of the runway on taxiway D', make: () => ({ x: 1000, z: 98, hdg: AD.RWY_TRUE - 90, state: 'idle' }) },
    rwy05: { label: 'Lined up on runway 05', rwy: '05', make: () => lineup('05') },
    rwy23: { label: 'Lined up on runway 23', rwy: '23', make: () => lineup('23') },
    final: { label: '3 NM final for the runway in use', make: () => finalAt(3) }
  };
  const mins = () => env.timeString().slice(2);
  const windTxt = () => (env.wx.windKt < 1.5 ? 'wind calm' : 'wind ' + ('00' + (Math.round(FS.toMag(env.wx.windDir) / 10) * 10 || 360)).slice(-3) + ' degrees ' + Math.round(env.wx.windKt) + ' knots');
  const greet = () => (env.time < 12 ? 'good morning' : env.time < 17 ? 'good afternoon' : 'good evening');

  /* ---------------- metrics ---------------- */
  const M = FS.Metrics = { d: {} };
  M.reset = () => {
    M.d = { rollDev: 0, rotIas: null, liftX: null, climbN: 0, climbErr: 0, trkDev: 0, dwN: 0, dwErr: 0, apN: 0, apIas: 0, apIas2: 0, apOn: 0, apDev: 0, td: null, tdCount: 0, outDev: 0, taxiSpd: 0, taxiDev: 0, incursion: false, stallT: 0, failMinIas: null, failHdg: null, failTurn: 0, landed: false, t: 0, magR: false, magL: false, ctlP: [0, 0], ctlR: [0, 0], maxAgl: 0 };
  };
  M.reset();
  M.update = (dt) => {
    const ac = FS.ac, o = ac.o, d = M.d, r = FS.rwy(), c = ac.ctl;
    d.t += dt;
    const onRwy = Math.abs(ac.pos.z) < 30 && ac.pos.x > -30 && ac.pos.x < RW + 30;
    d.ctlP[0] = Math.min(d.ctlP[0], c.pitch); d.ctlP[1] = Math.max(d.ctlP[1], c.pitch); d.ctlR[0] = Math.min(d.ctlR[0], c.roll); d.ctlR[1] = Math.max(d.ctlR[1], c.roll);
    d.maxAgl = Math.max(d.maxAgl, o.aglFt);
    if (ac.onGround) {
      if (onRwy && c.throttle > 0.8 && o.gs > 8 && !d.td) d.rollDev = Math.max(d.rollDev, Math.abs(ac.pos.z));
      if (d.td && o.gs > 25) d.outDev = Math.max(d.outDev, Math.abs(ac.pos.z));
      if (!onRwy) { d.taxiSpd = Math.max(d.taxiSpd, o.gs); if (ac.pos.z > 112 && ac.pos.z < 200) d.taxiDev = Math.max(d.taxiDev, Math.abs(ac.pos.x - 1000)); }
      if (d.td && !d.landed && o.gs < 8) { d.landed = true; FS.bus.emit('landed'); }
    } else {
      if (!d.td && o.aglFt > 150 && o.aglFt < 900 && c.throttle > 0.8 && o.vs > 100) { d.climbN++; d.climbErr += Math.abs(o.ias - 74); }
      if (!d.td && o.aglFt < 500 && d.liftX !== null && r.along(ac.pos.x) > 0) d.trkDev = Math.max(d.trkDev, Math.abs(ac.pos.z));
      if (Math.abs(angDiff(o.hdg, r.hdg + 180)) < 25 && o.aglFt > 500 && Math.abs(ac.pos.z) > 500) { d.dwN++; d.dwErr += Math.abs(o.indAlt - 2300); }
      const al = r.along(ac.pos.x);
      if (al < 0 && al > -4 * NM && o.aglFt < 1300 && o.aglFt > 20 && Math.abs(angDiff(o.hdg, r.hdg)) < 35 && Math.abs(ac.pos.z) < 500 && o.vs < 100) {
        d.apN++; d.apIas += o.ias; d.apIas2 += o.ias * o.ias; d.apDev += Math.abs(ac.pos.z);
        const ang = Math.atan2(ac.pos.y - (-AD.SLOPE * r.thrX), -al + 320) / DEG;
        if (Math.abs(ang - r.papi) < 0.36) d.apOn++;
      }
      if (o.stall > 0.5) d.stallT += dt;
      if (ac.eng.fail && d.failHdg !== null && o.aglFt > 25) { d.failMinIas = Math.min(d.failMinIas, o.ias); d.failTurn = Math.max(d.failTurn, Math.abs(angDiff(o.hdg, d.failHdg))); }
    }
    if (ac.eng.mags === 1 && ac.eng.rpm > 1500) d.magR = true; if (ac.eng.mags === 2 && ac.eng.rpm > 1500) d.magL = true;
  };
  FS.bus.on('liftoff', (e) => { const d = M.d; if (d.rotIas === null) { d.rotIas = e.ias; d.liftX = e.x; } });
  FS.bus.on('touchdown', (e) => {
    const d = M.d, r = FS.rwy();
    if (d.maxAgl <= 40) { if (d.td && d.t - d.tdT < 14) d.tdCount++; d.maxAgl = 0; return; }
    d.tdCount = 1; d.tdT = d.t;
    d.td = { fpm: e.sink / FT * 60, ias: e.ias, along: r.along(e.x), off: Math.abs(e.z), crab: Math.abs(e.crab), bank: Math.abs(e.bank), onRwy: Math.abs(e.z) < 22.5 && e.x > 0 && e.x < RW, noseFirst: e.noseFirst };
    d.maxAgl = 0;
  });
  const sc = (v, good, bad) => clamp(1 - (v - good) / (bad - good), 0, 1);
  const fmt = (v, dp) => (v === null || v === undefined || isNaN(v) ? '—' : v.toFixed(dp || 0));
  const rows = {
    roll: (d) => ['Centreline on the take-off roll', 'within ' + fmt(d.rollDev, 1) + ' m', sc(d.rollDev, 2, 12), d.rollDev > 5 ? 'Look at the far end of the runway and make small, early rudder corrections. Full power pulls the nose left, so expect to hold right rudder.' : 'Good directional control.'],
    rot: (d) => ['Rotation speed', d.rotIas === null ? 'no lift-off' : fmt(d.rotIas) + ' KIAS (target 55)', d.rotIas === null ? 0 : sc(Math.abs(d.rotIas - 56), 3, 12), d.rotIas === null ? '' : d.rotIas < 52 ? 'You lifted off early, close to the stall. Wait for 55 before easing back.' : d.rotIas > 62 ? 'You held it on the runway too long. Ease back at 55.' : 'Rotated on speed.'],
    climb: (d) => ['Climb speed', d.climbN ? 'average error ' + fmt(d.climbErr / d.climbN, 1) + ' kt from 74' : 'not measured', d.climbN ? sc(d.climbErr / d.climbN, 3, 14) : null, d.climbN && d.climbErr / d.climbN > 6 ? 'Hold a pitch attitude, wait, then check the airspeed. Chasing the needle makes it worse. Trim to hold 74.' : 'Steady Vy climb.'],
    trk: (d) => ['Track after lift-off', 'drifted ' + fmt(d.trkDev) + ' m off the centreline', sc(d.trkDev, 25, 150), d.trkDev > 60 ? 'Keep the wings level and the ball centred with right rudder in the climb. In a crosswind, crab into it.' : 'Stayed on the extended centreline.'],
    dw: (d) => ['Circuit altitude on downwind', d.dwN ? 'average error ' + fmt(d.dwErr / d.dwN) + ' ft from 2,300' : 'downwind not flown', d.dwN ? sc(d.dwErr / d.dwN, 50, 300) : 0, d.dwN && d.dwErr / d.dwN > 120 ? 'Level off by lowering the nose first, then reduce power to about 2,200 rpm and trim.' : 'Altitude held well.'],
    apSpd: (d) => { const m = d.apN ? d.apIas / d.apN : NaN, sd = d.apN ? Math.sqrt(Math.max(0, d.apIas2 / d.apN - m * m)) : NaN; return ['Approach speed', d.apN ? 'average ' + fmt(m) + ' KIAS, varying ±' + fmt(sd, 1) : 'not measured', d.apN ? (sc(Math.abs(m - 67), 4, 15) + sc(sd, 3, 9)) / 2 : null, d.apN && m > 74 ? 'Too fast: you will float a long way. Aim for 65 with full flap.' : d.apN && m < 60 ? 'Too slow: little margin above the stall. Add power and lower the nose.' : 'Speed well controlled.']; },
    apPath: (d) => ['On the PAPI path', d.apN ? Math.round(d.apOn / d.apN * 100) + '% of the approach' : 'not measured', d.apN ? sc(1 - d.apOn / d.apN, 0.25, 0.8) : null, d.apN && d.apOn / d.apN < 0.5 ? 'Two red and two white is on path. More red than white: add power. More white: reduce power. Hold speed with pitch.' : 'Stable on the glide path.'],
    td: (d) => { const t = d.td; if (!t) return ['Touchdown', 'no landing recorded', 0, '']; return ['Touchdown rate', fmt(t.fpm) + ' ft/min', sc(t.fpm, 150, 550), t.fpm > 350 ? 'Firm. Start the flare a little higher and keep easing back as the aircraft sinks: try to hold it just off the runway.' : 'Smooth touchdown.']; },
    tdPt: (d) => { const t = d.td; if (!t) return ['Touchdown point', '—', null, '']; return ['Touchdown point', t.onRwy ? fmt(t.along) + ' m past the threshold, ' + fmt(t.off, 1) + ' m off centre' : 'off the runway', t.onRwy ? (sc(Math.abs(t.along - 320), 140, 700) + sc(t.off, 2, 14)) / 2 : 0, !t.onRwy ? 'You touched down off the paved runway.' : t.along > 650 ? 'Long landing. Fix the aiming point (the wide white blocks) in the windscreen and control speed.' : t.along < 80 ? 'Very short. Aim at the wide white aiming blocks, not the threshold.' : 'Landed in the touchdown zone.']; },
    tdAlign: (d) => { const t = d.td; if (!t) return ['Alignment at touchdown', '—', null, '']; return ['Alignment at touchdown', fmt(t.crab, 1) + '° crab, ' + fmt(t.bank, 1) + '° bank', sc(t.crab, 3, 15), t.crab > 6 ? 'Straighten the nose with rudder just before touchdown and hold the into-wind wing down with aileron.' : 'Aligned with the runway.']; },
    out: (d) => ['Roll-out', 'within ' + fmt(d.outDev, 1) + ' m of the centreline', sc(d.outDev, 3, 15), d.outDev > 7 ? 'Keep flying the aircraft after touchdown: rudder for direction, aileron into any crosswind, brake gently.' : 'Straight roll-out.'],
    bounce: (d) => ['Bounces', String(Math.max(0, d.tdCount - 1)), d.tdCount <= 1 ? 1 : d.tdCount === 2 ? 0.5 : 0, d.tdCount > 1 ? 'A bounce means too much speed or sink at touchdown. If it bounces high, add power and go around.' : '']
  };
  M.landingReport = () => { const d = M.d; return [rows.apSpd(d), rows.apPath(d), rows.td(d), rows.tdPt(d), rows.tdAlign(d), rows.out(d), rows.bounce(d)]; };

  /* ---------------- Tower ---------------- */
  const ATC = FS.ATC = { phase: 'idle', t: 0, holdT: 0, sulurT: 0, warned: false };
  ATC.say = (text) => FS.bus.emit('radio', { text, tower: true });
  ATC.reset = (startKey) => {
    ATC.phase = startKey === 'final' ? 'final0' : (startKey === 'rwy05' || startKey === 'rwy23') ? 'lined0' : startKey === 'hold' ? 'hold0' : 'idle';
    ATC.t = 0; ATC.holdT = 0; ATC.sulurT = 0; ATC.warned = false;
  };
  ATC.update = (dt) => {
    const ac = FS.ac, o = ac.o, r = FS.rwy(), cs = AD.CALLSIGN;
    ATC.t += dt;
    const radio = ac.elec.bus && ac.elec.avionics;
    if (!radio) return;
    const p = ac.pos, onStrip = Math.abs(p.z) < 88 && p.x > -60 && p.x < RW + 60;
    switch (ATC.phase) {
      case 'idle': if (ac.eng.running && ATC.t > 4) { ATC.say(cs + ', Coimbatore Tower, ' + greet() + '. Runway ' + r.id + ' in use, ' + windTxt() + ', QNH ' + Math.round(env.wx.qnh) + '. Taxi via D to the holding point runway ' + r.id + '.'); ATC.phase = 'taxi'; } break;
      case 'hold0': if (ATC.t > 3) { ATC.say(cs + ', Coimbatore Tower, hold short of runway ' + r.id + ' at D. Report ready for departure.'); ATC.phase = 'taxi'; } break;
      case 'taxi':
        if (onStrip && ac.onGround && !ATC.warned) { ATC.warned = true; M.d.incursion = true; ATC.say(cs + ', HOLD POSITION. You have passed the holding point without clearance.'); }
        if (ac.onGround && p.z > 90 && p.z < 118 && Math.abs(p.x - 1000) < 12 && o.gs < 1) { ATC.holdT += dt; if (ATC.holdT > 4) { ATC.say(cs + ', ' + (r.id === '05' ? 'backtrack and line up' : 'line up') + ' runway ' + r.id + ' via D, ' + windTxt() + ', cleared for take-off.'); ATC.phase = 'cleared'; } } else ATC.holdT = 0;
        if (!ac.onGround) ATC.phase = 'airborne';
        break;
      case 'lined0': if (ATC.t > 2.5) { ATC.say(cs + ', Coimbatore Tower, runway ' + r.id + ', ' + windTxt() + ', cleared for take-off.'); ATC.phase = 'cleared'; } break;
      case 'cleared': if (!ac.onGround && o.aglFt > 60) ATC.phase = 'airborne'; break;
      case 'airborne': if (o.aglFt > 400) { ATC.say(cs + ', airborne at ' + mins() + '. Join left-hand circuit runway ' + r.id + ' at 2,300 feet, report final.'); ATC.phase = 'circuit'; } break;
      case 'final0': if (ATC.t > 3) { ATC.say(cs + ', Coimbatore Tower, ' + windTxt() + ', runway ' + r.id + ' cleared to land.'); ATC.phase = 'final'; } break;
      case 'circuit': {
        const al = r.along(p.x);
        if (al < -700 && al > -4.5 * NM && Math.abs(p.z) < 300 && o.aglFt > 80 && o.aglFt < 1400 && Math.abs(angDiff(o.hdg, r.hdg)) < 30) { ATC.say(cs + ', ' + windTxt() + ', runway ' + r.id + ' cleared to land.'); ATC.phase = 'final'; }
        break;
      }
      case 'final':
        if (ac.onGround && M.d.td) ATC.phase = 'rollout';
        else if (r.along(p.x) > 400 && o.aglFt > 350 && o.vs > 200) { ATC.say(cs + ', roger, going around. Rejoin left-hand circuit, report final.'); ATC.phase = 'circuit'; }
        break;
      case 'rollout':
        if (!ac.onGround && o.aglFt > 150) { ATC.phase = 'circuit'; break; }
        if (o.gs < 18) { ATC.say(cs + ', landed at ' + mins() + '. Vacate via D and taxi to the Flying Club.'); ATC.phase = 'done'; }
        break;
      case 'done': if (!ac.onGround && o.aglFt > 200) ATC.phase = 'circuit'; break;
    }
    ATC.sulurT -= dt;
    if (ATC.sulurT <= 0 && Math.hypot(p.x - AD.SULUR[0], p.z - AD.SULUR[1]) < 3.2 * NM && o.aglFt < 5000 && !ac.onGround) { ATC.sulurT = 40; ATC.say(cs + ', you are approaching Sulur air base. Turn left heading north-west now. Do not mistake Sulur for Coimbatore: it also has a runway 05/23.'); }
  };

  /* ---------------- lessons ---------------- */
  const hd = (S, target, tol) => Math.abs(angDiff(S.o.hdg, target)) < tol;
  const takeoffSteps = [
    { t: 'Before take-off: mixture fully rich, landing light and strobes on, and set the trim to the green take-off mark on the wheel (End / Home keys).', hint: 'Flaps stay up for a normal take-off on this long runway.', ok: (S) => S.c.mixture > 0.9 && S.el.land && S.el.strobe && S.c.trim > 0.1 && S.c.trim < 0.4 },
    { t: 'Release the brakes and smoothly open the throttle fully. Check the engine makes at least 2,300 rpm and the airspeed needle comes alive.', hl: 'throttle', ok: (S) => S.c.throttle > 0.95 && S.o.ias > 30 },
    { t: 'Keep straight with rudder: expect to need right pedal. At 55 KIAS ease the yoke back and let the aircraft fly off.', hl: 'asi', ok: (S) => !S.ac.onGround && S.o.aglFt > 15 },
    { t: 'Pitch for 74 KIAS, the best rate of climb. Keep the wings level and the ball in the centre.', hl: 'asi', ok: (S) => S.o.aglFt > 400 }
  ];
  const landSteps = [
    { t: 'On final: full flap and 65 KIAS. Hold the PAPI at two red, two white using power. Hold the speed with pitch. Keep the runway numbers steady in the windscreen.', hint: 'More red than white means you are low: add power.', ok: (S) => S.o.aglFt < 60 || S.ac.onGround },
    { t: 'Over the threshold, close the throttle gently and look at the far end of the runway. Ease back to hold it just above the surface until it settles on the main wheels.', ok: (S) => S.ac.onGround && FS.Metrics.d.td },
    { t: 'Keep it straight with rudder, lower the nose wheel gently, then brake (B) to a walking pace.', ok: (S) => S.ac.onGround && S.o.gs < 10 }
  ];
  const L = FS.Lessons = { cur: null, i: 0, holdT: 0, rt: {}, list: [] };
  L.list = [
    { id: 'fam', title: 'Cockpit familiarisation', mins: 5, blurb: 'Find the six flight instruments and the main controls. No flying.', start: 'cold', analog: true,
      steps: [
        { t: 'Welcome aboard ' + AD.CALLSIGN + '. Drag to look around the cockpit: look left out of your window, then right.', ok: (S) => { const y = FS.view.look.yaw; S.rt.y0 = Math.min(S.rt.y0 === undefined ? y : S.rt.y0, y); S.rt.y1 = Math.max(S.rt.y1 === undefined ? y : S.rt.y1, y); return S.rt.y1 - S.rt.y0 > 1.2; } },
        { t: 'The six main instruments sit in two rows. Click the airspeed indicator, top left. It shows knots; the green arc is the normal range.', hl: 'asi', ok: () => FS.Panel.lastClick === 'asi' },
        { t: 'Click the attitude indicator, top centre: your artificial horizon, showing pitch and bank.', hl: 'ai', ok: () => FS.Panel.lastClick === 'ai' },
        { t: 'Click the altimeter, top right. The long needle reads hundreds of feet, the short one thousands.', hl: 'alt', ok: () => FS.Panel.lastClick === 'alt' },
        { t: 'Click the turn coordinator, bottom left. The ball shows whether you are slipping: step on the ball with rudder.', hl: 'tc', ok: () => FS.Panel.lastClick === 'tc' },
        { t: 'Click the heading indicator, bottom centre: a gyro compass.', hl: 'hi', ok: () => FS.Panel.lastClick === 'hi' },
        { t: 'Click the vertical speed indicator, bottom right: climb or descent in hundreds of feet per minute.', hl: 'vsi', ok: () => FS.Panel.lastClick === 'vsi' },
        { t: 'Click the tachometer, to the right of the six. With a fixed-pitch propeller, rpm is how you set power.', hl: 'tach', ok: () => FS.Panel.lastClick === 'tach' },
        { t: 'Now power. Switch on the battery: the right half of the red master switch, lower left.', hl: 'masterBat', ok: (S) => S.el.bat },
        { t: 'Drag the black throttle knob in (or hold PageUp) to open it past half, then pull it fully closed again.', hl: 'throttle', ok: (S) => { if (S.c.throttle > 0.5) S.rt.thr = true; return S.rt.thr && S.c.throttle < 0.05; } },
        { t: 'Select flaps 10° with the flap lever (or F), watch the position indicator move, then raise them again (V).', hl: 'flapDn', ok: (S) => { if (S.ac.surf.flap > 0.2) S.rt.fl = true; return S.rt.fl && S.c.flapSel === 0; } },
        { t: 'Roll the trim wheel on the centre pedestal (drag it, or use End and Home). Trim removes the load from the yoke.', ok: (S) => { S.rt.t0 = S.rt.t0 === undefined ? S.c.trim : S.rt.t0; return Math.abs(S.c.trim - S.rt.t0) > 0.06; } },
        { t: 'Press C to step through the outside views, then press 1 to return to the pilot seat.', ok: (S) => { if (!FS.view.interior()) S.rt.out = true; return S.rt.out && FS.view.mode === 0; } },
        { t: 'Last one: switch the battery master off again so you do not flatten the battery.', hl: 'masterBat', ok: (S) => !S.el.bat }
      ],
      debrief: (d) => [['Instruments identified', '7 of 7', 1, 'You know where everything is. Next: start the engine.']] },
    { id: 'start', title: 'Pre-flight, engine start and run-up', mins: 8, blurb: 'From cold and dark to ready to taxi, using the checklist.', start: 'cold',
      steps: [
        { t: 'Parking brake set: check the handle under the panel is pulled (P).', ok: (S) => S.c.parkBrake },
        { t: 'Controls free and correct: move the yoke fully left, right, forward and back.', ok: (S) => FS.Metrics.d.ctlP[0] < -0.7 && FS.Metrics.d.ctlP[1] > 0.7 && FS.Metrics.d.ctlR[0] < -0.7 && FS.Metrics.d.ctlR[1] > 0.7 },
        { t: 'Fuel selector to BOTH (red dial on the pedestal).', ok: (S) => S.ac.fuel.sel === 'BOTH' },
        { t: 'Master switch on: both halves, ALT and BAT.', hl: 'masterBat', ok: (S) => S.el.bat && S.el.alt },
        { t: 'Beacon on, so people outside know the engine is about to start.', hl: 'beacon', ok: (S) => S.el.beacon },
        { t: 'Mixture fully rich: push the red knob all the way in (hold 0).', hl: 'mixture', ok: (S) => S.c.mixture > 0.92 },
        { t: 'Throttle open about a centimetre: just cracked.', hl: 'throttle', ok: (S) => S.c.throttle > 0.03 && S.c.throttle < 0.25 },
        { t: 'Fuel pump on for a few seconds to prime the engine…', hl: 'pump', ok: (S) => S.el.pump, hold: 2 },
        { t: '…and fuel pump off.', hl: 'pump', ok: (S) => !S.el.pump },
        { t: 'Look outside, call “Clear prop!”, then turn the key to START: click the right side of the ignition switch until it reaches START.', hl: 'ign', ok: (S) => S.e.running },
        { t: 'Set about 1,000 rpm and check the oil pressure rises into the green within 30 seconds.', hl: 'tach', ok: (S) => S.e.rpm > 880 && S.e.rpm < 1200 && S.e.oilP > 40, hold: 1.5 },
        { t: 'Avionics master on, and navigation lights on.', hl: 'avionics', ok: (S) => S.el.avionics && S.el.nav },
        { t: (S) => 'Set the altimeter to QNH ' + Math.round(env.wx.qnh) + ' hPa using its knob (drag or scroll on it). It should then read the apron elevation, about 1,310 ft.', hl: 'kollsman', ok: (S) => Math.round(S.I.kollsman) === Math.round(env.wx.qnh) },
        { t: 'Engine run-up. With the parking brake set, open the throttle to 1,800 rpm.', hl: 'tach', ok: (S) => S.e.rpm > 1740 && S.e.rpm < 1870, hold: 2 },
        { t: 'Magneto check: turn the key to R and watch the rpm drop. It must not fall more than 150.', hl: 'ign', ok: (S) => S.e.mags === 1, hold: 1.5 },
        { t: 'Now L, note the drop, then back to BOTH.', hl: 'ign', ok: (S) => FS.Metrics.d.magL && S.e.mags === 3 },
        { t: 'Check suction, oil and ammeter are in the green. Then close the throttle: the engine should idle smoothly near 650 rpm.', hl: 'throttle', ok: (S) => S.c.throttle < 0.03 && S.e.rpm < 800 && S.e.running, hold: 2 },
        { t: 'Set 1,000 rpm. Run-up complete: you are ready to taxi.', hl: 'tach', ok: (S) => S.e.rpm > 900 && S.e.rpm < 1120, hold: 1 }
      ],
      debrief: (d) => [['Checklist completed', 'in ' + Math.round(d.t / 60 * 10) / 10 + ' min', sc(d.t, 240, 720), 'With practice the flow takes about four minutes.'], ['Magneto check', d.magR && d.magL ? 'both checked' : 'incomplete', d.magR && d.magL ? 1 : 0.3, 'Each magneto fires one of the two spark plugs in every cylinder. Checking them singly proves both systems work.']] },
    { id: 'taxi', title: 'Taxi to the runway via D', mins: 5, blurb: 'Steer with your feet, control speed with power, stop at the holding point.', start: 'ready',
      steps: [
        { t: 'Listen to the ATIS first: press ATIS on the radio stack.', hl: 'atisBtn', ok: (S) => S.I.com1 === AD.ATIS },
        { t: 'Now select Tower on 118.15 (press TOWER) and note the taxi clearance.', hl: 'twrBtn', ok: (S) => S.I.com1 === AD.TWR },
        { t: 'Taxi light on, then release the parking brake (P).', hl: 'taxi', ok: (S) => S.el.taxi && !S.c.parkBrake },
        { t: 'Add a little power to start rolling, then come back to about 1,000 rpm. Steer with the rudder pedals (Q and E). Keep to a brisk walking pace: under 15 knots.', ok: (S) => S.o.gs > 4 },
        { t: 'Follow the yellow centre line along taxiway D toward the runway.', ok: (S) => S.ac.pos.z < 150 },
        { t: 'Stop with the nose just short of the four yellow lines: the runway holding position. Never cross it without clearance.', ok: (S) => S.ac.pos.z < 113 && S.o.gs < 0.6 && S.ac.onGround, hold: 1 },
        { t: 'Set the parking brake. Tower will clear you when the runway is free.', ok: (S) => S.c.parkBrake }
      ],
      debrief: (d) => [['Taxi speed', 'peak ' + fmt(d.taxiSpd) + ' kt', sc(d.taxiSpd, 15, 28), d.taxiSpd > 18 ? 'Too fast. If you need to brake hard to stop, you were taxiing too quickly.' : 'Sensible pace.'], ['Centre line on D', 'within ' + fmt(d.taxiDev, 1) + ' m', sc(d.taxiDev, 1.2, 5), d.taxiDev > 2.5 ? 'Look well ahead rather than just over the nose, and lead each correction.' : 'On the line.'], ['Holding point', d.incursion ? 'crossed without clearance' : 'held correctly', d.incursion ? 0 : 1, d.incursion ? 'A runway incursion is one of the most serious errors on an aerodrome. Stop before the solid lines.' : 'Stopped before the lines.']] },
    { id: 'takeoff', title: 'Normal take-off and climb', mins: 6, blurb: 'Full power, rotate at 55, climb at 74 to circuit height.', start: 'lineup',
      steps: takeoffSteps.concat([
        { t: 'Keep climbing straight ahead at 74 KIAS to 2,300 ft: 1,000 ft above the aerodrome.', hl: 'alt', ok: (S) => S.o.indAlt > 2230 },
        { t: 'Level off: lower the nose to the horizon, let the speed build to about 95, reduce power to 2,300 rpm, then trim. Hold 2,300 ft for ten seconds.', hl: 'tach', ok: (S) => Math.abs(S.o.indAlt - 2300) < 130 && Math.abs(S.o.vs) < 250, hold: 10 }
      ]),
      debrief: (d) => [rows.roll(d), rows.rot(d), rows.climb(d), rows.trk(d)] },
    { id: 'circuit', title: 'Left-hand traffic circuit', mins: 12, blurb: 'Take off, fly the rectangular circuit at 1,000 ft and land.', start: 'lineup',
      steps: takeoffSteps.concat([
        { t: (S) => 'At 500 ft above the field (1,800 ft on the altimeter), look left, then turn left onto the crosswind leg: heading ' + ('00' + Math.round(wrap360(S.r.mag - 90))).slice(-3) + '°. Use about 20° of bank.', hl: 'hi', ok: (S) => hd(S, S.r.hdg - 90, 20) && S.o.aglFt > 350 },
        { t: (S) => 'Level off at 2,300 ft and turn left again onto downwind, heading ' + ('00' + Math.round(wrap360(S.r.mag + 180))).slice(-3) + '°, parallel to the runway. Set about 2,200 rpm for 90 knots.', hl: 'alt', ok: (S) => hd(S, S.r.hdg + 180, 18) && Math.abs(S.ac.pos.z) > 500 },
        { t: 'Downwind checks: brakes off, mixture rich, fuel on BOTH. Hold 2,300 ft. The runway should sit about halfway up your left window.', ok: (S) => S.r.along(S.ac.pos.x) < 150 },
        { t: 'Abeam the landing threshold: reduce to about 1,500 rpm, hold the nose up until the speed is in the white arc, select flaps 10° and descend at 75 knots.', ok: (S) => S.c.flapSel >= 1 && S.o.vs < -150 },
        { t: (S) => 'When the threshold is 45° behind your left shoulder, turn left onto base: heading ' + ('00' + Math.round(wrap360(S.r.mag + 90))).slice(-3) + '°. Flaps 20°, 70 knots.', hl: 'hi', ok: (S) => hd(S, S.r.hdg + 90, 22) && S.c.flapSel >= 2 },
        { t: 'Turn final to line up with the runway. Do not overshoot the centre line, and never steepen a low, slow turn.', ok: (S) => hd(S, S.r.hdg, 14) && Math.abs(S.ac.pos.z) < 140 && S.r.along(S.ac.pos.x) < -200 },
        { t: 'Flaps full.', hl: 'flapDn', ok: (S) => S.c.flapSel === 3 }
      ]).concat(landSteps),
      debrief: (d) => [rows.roll(d), rows.rot(d), rows.climb(d), rows.dw(d), rows.apSpd(d), rows.td(d), rows.tdPt(d)] },
    { id: 'approach', title: 'Approach and landing with the PAPI', mins: 5, blurb: 'Start on a 3 NM final. Fly a stable approach and land in the touchdown zone.', start: 'final',
      steps: [
        { t: 'You are on final at 75 knots with flaps 10°. Find the four PAPI lights left of the runway. Two red and two white means you are on the correct path.', ok: (S) => S.rt.t > 6 },
        { t: 'Select flaps 20° and slow to 70 knots. As the flaps travel the nose will rise: hold it down and re-trim.', hl: 'flapDn', ok: (S) => S.c.flapSel >= 2 && S.o.ias < 76 },
        { t: 'Select full flap.', hl: 'flapDn', ok: (S) => S.c.flapSel === 3 }
      ].concat(landSteps),
      debrief: (d) => M.landingReport() },
    { id: 'xwind', title: 'Crosswind take-off and landing', mins: 9, blurb: 'A 12-knot wind straight across the runway. Aileron into wind, rudder to stay straight.', start: 'lineup', crosswind: true,
      steps: [
        { t: 'The wind is from your left at 12 knots. Before you roll, hold the yoke fully toward the wind: left.', ok: (S) => S.c.roll < -0.5 },
        { t: 'Full power. Keep straight with rudder and gradually reduce the aileron as speed builds. Rotate cleanly at 55 to 60 knots.', hl: 'throttle', ok: (S) => !S.ac.onGround && S.o.aglFt > 20 },
        { t: 'Once airborne, let the nose turn into the wind and fly with wings level, ball centred. Track the extended centre line by crabbing. Climb to 500 ft above the field.', ok: (S) => S.o.aglFt > 500, done: () => { FS.bus.emit('reposition', finalAt(2, 72, 2)); } },
        { t: 'Now the landing: you are on a 2 NM final. Crab into the wind so the runway stays straight ahead. Flaps 20° is enough in a crosswind; add 5 knots: fly 70.', ok: (S) => S.o.aglFt < 80 },
        { t: 'In the flare, push the nose straight with right rudder and lower the left wing with aileron to stop the drift. Touch down on the left main wheel first.', ok: (S) => S.ac.onGround && FS.Metrics.d.td },
        { t: 'Keep increasing the aileron into the wind as you slow. Stay on the centre line and brake to a walking pace.', ok: (S) => S.ac.onGround && S.o.gs < 10 }
      ],
      debrief: (d) => [rows.roll(d), rows.rot(d), rows.apSpd(d), rows.td(d), rows.tdAlign(d), rows.tdPt(d), rows.out(d)] },
    { id: 'efato', title: 'Engine failure after take-off', mins: 5, blurb: 'The engine will stop shortly after lift-off. Fly the aircraft first.', start: 'lineup',
      steps: [
        { t: 'Brief yourself before every take-off: if the engine fails, lower the nose and land ahead. Now take off normally and climb at 74 knots.', hl: 'throttle', ok: (S) => !S.ac.onGround && S.o.aglFt > 180 + (S.rt.rand = S.rt.rand === undefined ? Math.random() * 110 : S.rt.rand), done: (S) => { S.ac.eng.fail = true; const d = FS.Metrics.d; d.failHdg = S.o.hdg; d.failMinIas = S.o.ias; FS.bus.emit('radio', { text: 'ENGINE FAILURE', alert: true }); } },
        { t: 'ENGINE FAILURE. Lower the nose at once and hold 68 KIAS: best glide. Speed is life.', hl: 'asi', ok: (S) => S.o.ias > 60 && S.o.ias < 78 && S.o.pitch < 3, hold: 2 },
        { t: 'Land ahead. Do not turn back to the runway behind you. This runway is nearly 3 km long: there is plenty left in front. Use flap once you are sure of reaching it.', ok: (S) => S.ac.onGround },
        { t: 'Brake to a stop.', ok: (S) => S.o.gs < 3 }
      ],
      debrief: (d) => [['Lowest speed after the failure', fmt(d.failMinIas) + ' KIAS', sc(58 - (d.failMinIas || 0), 0, 14), d.failMinIas < 52 ? 'The speed decayed toward the stall. The nose must go down immediately, before anything else.' : 'You protected the airspeed.'], ['Heading change', fmt(d.failTurn) + '°', sc(d.failTurn, 30, 100), d.failTurn > 45 ? 'Turning back at low height usually ends in a stall and spin. Pick a landing area within about 30° either side of the nose.' : 'Landed ahead.'], rows.td(d), ['Landing area', d.td && d.td.onRwy ? 'on the runway' : 'off the runway', d.td && d.td.onRwy ? 1 : 0.4, '']] }
  ];
  L.start = (id) => {
    const l = L.list.find((q) => q.id === id); if (!l) return;
    L.cur = l; L.i = 0; L.holdT = 0; L.rt = { t: 0 }; L.finished = false;
    FS.Panel.lastClick = null;
    FS.bus.emit('lesson');
  };
  L.stop = () => { L.cur = null; FS.Panel.highlight = null; FS.bus.emit('lesson'); };
  L.S = () => { const ac = FS.ac; return { ac, o: ac.o, c: ac.ctl, el: ac.elec, e: ac.eng, I: ac.inst, rt: L.rt, r: FS.rwy() }; };
  L.text = () => { const st = L.cur && L.cur.steps[L.i]; if (!st) return ''; return typeof st.t === 'function' ? st.t(L.S()) : st.t; };
  L.advance = () => {
    const st = L.cur.steps[L.i]; if (st && st.done) st.done(L.S());
    L.i++; L.holdT = 0; L.rt = { t: 0 }; FS.Panel.lastClick = null;
    if (L.i >= L.cur.steps.length) { L.finish(); return; }
    FS.bus.emit('lesson', { step: true });
  };
  L.finish = () => {
    if (!L.cur || L.finished) return; L.finished = true;
    const l = L.cur, rws = l.debrief(M.d).filter(Boolean), s = rws.filter((r) => r[2] !== null && r[2] !== undefined);
    const score = s.length ? Math.round(s.reduce((a, r) => a + r[2], 0) / s.length * 100) : 100;
    const best = FS.settings.lessonBest; if (!(best[l.id] >= score)) { best[l.id] = score; FS.saveSettings(); }
    FS.Panel.highlight = null;
    FS.bus.emit('debrief', { title: l.title, rows: rws, score, lesson: l.id });
  };
  L.update = (dt) => {
    if (!L.cur || L.finished) return;
    const st = L.cur.steps[L.i]; if (!st) return;
    L.rt.t += dt;
    FS.Panel.highlight = st.hl || null;
    const S = L.S();
    let ok = false; try { ok = st.ok(S); } catch (e) { ok = false; }
    if (ok) { L.holdT += dt; if (L.holdT >= (st.hold || 0.25)) L.advance(); } else L.holdT = 0;
  };
})();
