/* ============================================================
   Input: keyboard + mouse, gamepad (remappable), touch, tilt.
   ctl.pitch +1 = pull, ctl.roll +1 = right, ctl.yaw +1 = right pedal.
   ============================================================ */
(function () {
  const In = FS.Input = {
    keys: {}, kb: { pitch: 0, roll: 0, yaw: 0 }, mouse: { pitch: 0, roll: 0, x: 0, y: 0 }, pad: { pitch: 0, roll: 0, yaw: 0, brake: 0, connected: false, name: '' },
    touch: { pitch: 0, roll: 0, yaw: 0, brake: 0, active: false }, tilt: { pitch: 0, roll: 0, ok: false, base: null },
    lookDX: 0, lookDY: 0, zoomD: 0, padLookX: 0, padLookY: 0, device: 'keyboard', capture: null, prevBtn: {}, drag: null
  };
  In.padDefault = { roll: { axis: 0 }, pitch: { axis: 1 }, lookX: { axis: 2 }, lookY: { axis: 3 }, rudL: { btn: 6 }, rudR: { btn: 7 }, flapUp: { btn: 4 }, flapDn: { btn: 5 }, brake: { btn: 0 }, park: { btn: 1 }, view: { btn: 2 }, map: { btn: 3 }, thrUp: { btn: 12 }, thrDn: { btn: 13 }, trimDn: { btn: 14 }, trimUp: { btn: 15 }, pause: { btn: 9 }, reset: { btn: 8 } };
  In.padLabels = { roll: 'Roll', pitch: 'Pitch', lookX: 'Look left / right', lookY: 'Look up / down', rudL: 'Rudder left', rudR: 'Rudder right', flapUp: 'Flaps up one notch', flapDn: 'Flaps down one notch', brake: 'Brakes', park: 'Parking brake', view: 'Next view', map: 'Map', thrUp: 'Throttle up', thrDn: 'Throttle down', trimDn: 'Trim nose down', trimUp: 'Trim nose up', pause: 'Pause', reset: 'Reset flight' };
  In.padMap = () => FS.settings.padMap || In.padDefault;
  In.keyHelp = [
    ['Pitch', '↑ ↓  or  W S'], ['Roll', '← →  or  A D'], ['Rudder', 'Q  E'], ['Throttle', 'PageUp PageDown  or  = −'], ['Mixture', '9 lean, 0 rich'],
    ['Flaps', 'F down, V up'], ['Trim', 'End nose up, Home nose down (or U J)'], ['Brakes', 'B or Space (hold)'], ['Left / right brake', ',  .'], ['Parking brake', 'P'],
    ['Change view', 'C, or 1–8'], ['Look around', 'drag with the mouse; L centres'], ['Zoom', 'mouse wheel; I for instruments'], ['Mouse yoke', 'Y'], ['Map', 'M'], ['Hide yokes', 'K'], ['Beginner HUD', 'H'], ['Pause / menu', 'Esc'], ['Reset flight', 'R']
  ];

  const expo = (v) => { const dz = FS.settings.deadzone, a = Math.abs(v); if (a < dz) return 0; const n = (a - dz) / (1 - dz), e = FS.settings.expo; return Math.sign(v) * (n * (1 - e) + n * n * n * e); };

  /* ---------- cockpit actions ---------- */
  const COM = [AD.TWR, AD.ATIS, AD.APP, 121.5], NAVF = [AD.ILS23, AD.VOR];
  FS.cockpit = (id, dir, amt) => {
    const ac = FS.ac, el = ac.elec, I = ac.inst, c = ac.ctl, P = FS.Panel;
    dir = dir || 1; let click = true, msg = null;
    switch (id) {
      case 'masterAlt': el.alt = !el.alt; break;
      case 'masterBat': el.bat = !el.bat; break;
      case 'pump': case 'beacon': case 'land': case 'taxi': case 'nav': case 'strobe': case 'pitot': case 'avionics': el[id] = !el[id]; break;
      case 'ign': ac.eng.mags = clamp(ac.eng.mags + dir, 0, 4); if (ac.eng.mags === 4) { ac.eng.startT = 2.8; if (!el.bus) msg = 'Nothing happens: the master switch is off.'; else if (c.mixture < 0.3) msg = 'The engine cranks but will not fire: mixture is at idle cut-off.'; } break;
      case 'kollsman': I.kollsman = clamp(I.kollsman + dir * (amt || 1), 950, 1050); msg = 'Altimeter ' + Math.round(I.kollsman) + ' hPa'; break;
      case 'hdgBug': I.hdgBug = wrap360(I.hdgBug + dir * (amt || 5)); msg = 'Heading bug ' + ('00' + Math.round(I.hdgBug)).slice(-3) + '°'; break;
      case 'obs': I.obs = wrap360(I.obs + dir * (amt || 5)); msg = 'Course ' + ('00' + Math.round(I.obs)).slice(-3) + '°'; break;
      case 'hdgSync': I.hdgDrift = 0; msg = 'Heading indicator aligned with the compass'; break;
      case 'panelLt': el.panelLt = clamp(el.panelLt + dir * (amt || 0.15), 0, 1); break;
      case 'throttle': c.throttle = clamp(c.throttle + dir * (amt || 0.1), 0, 1); click = false; break;
      case 'mixture': c.mixture = clamp(c.mixture + dir * (amt || 0.1), 0, 1); click = false; break;
      case 'flapUp': c.flapSel = Math.max(0, c.flapSel - 1); break;
      case 'flapDn': c.flapSel = Math.min(3, c.flapSel + 1); if (!el.bus) msg = 'Flaps need electrical power.'; break;
      case 'trim': c.trim = clamp(c.trim + dir * (amt || 0.03), -1, 1); click = false; break;
      case 'fuelSel': ac.fuel.sel = ac.fuel.sel === 'L' ? 'BOTH' : ac.fuel.sel === 'BOTH' ? 'R' : 'L'; msg = 'Fuel selector ' + ac.fuel.sel; break;
      case 'parkBrake': c.parkBrake = !c.parkBrake; msg = 'Parking brake ' + (c.parkBrake ? 'set' : 'released'); break;
      case 'comSwap': { const t = I.com1; I.com1 = I.com1s; I.com1s = t; FS.bus.emit('comTuned'); break; }
      case 'navSwap': { const t = I.nav1; I.nav1 = I.nav1s; I.nav1s = t; break; }
      case 'comKnob': if (amt) I.com1s = clamp(Math.round((I.com1s + dir * 0.025) * 1000) / 1000, 118, 136.975); else I.com1s = COM[(COM.indexOf(I.com1s) + 1) % COM.length]; break;
      case 'navKnob': if (amt) I.nav1s = clamp(Math.round((I.nav1s + dir * 0.05) * 100) / 100, 108, 117.95); else I.nav1s = NAVF[(NAVF.indexOf(I.nav1s) + 1) % NAVF.length]; break;
      case 'atisBtn': if (I.com1 !== AD.ATIS) { I.com1s = I.com1; I.com1 = AD.ATIS; } FS.bus.emit('comTuned'); break;
      case 'twrBtn': if (I.com1 !== AD.TWR) { I.com1s = I.com1; I.com1 = AD.TWR; } FS.bus.emit('comTuned'); break;
      case 'xpdr': I.xpdr = I.xpdr === 2000 ? 1200 : I.xpdr === 1200 ? 7000 : 2000; break;
      case 'rangeIn': P.range = [0.5, 0.5, 1.5, 3, 6, 12][[0.5, 1.5, 3, 6, 12, 24].indexOf(P.range)] || 0.5; break;
      case 'rangeOut': P.range = [1.5, 3, 6, 12, 24, 24][[0.5, 1.5, 3, 6, 12, 24].indexOf(P.range)] || 24; break;
      default: click = false; msg = P.names[id] || null;
    }
    P.lastClick = id;
    FS.bus.emit('cockpit', { id, click, msg, name: P.names[id] });
  };
  const DRAGGABLE = { throttle: 1, mixture: 1, trim: 1, kollsman: 1, hdgBug: 1, obs: 1, panelLt: 1, comKnob: 1, navKnob: 1 };

  /* ---------- pointer / raycast ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  In.pick = (cx, cy) => {
    if (!FS.view || !FS.view.interior()) return null;
    const r = FS.renderer.domElement.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, FS.cam);
    const h3 = ray.intersectObjects(FS.Model.hit, false)[0], hp = ray.intersectObject(FS.Model.panel, false)[0];
    if (h3 && (!hp || h3.distance < hp.distance + 0.02)) return { id: h3.object.userData.id, side: 1 };
    if (hp && hp.uv) {
      const u = hp.uv.x * FS.PANEL.W, v = (1 - hp.uv.y) * FS.PANEL.H, h = FS.Panel.hitTest(u, v);
      if (h) return { id: h.id, side: u < (h.r ? h.x : h.x + h.w / 2) ? -1 : 1, u, v };
    }
    return null;
  };

  In.init = (canvas) => {
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) e.preventDefault();
      if (!In.keys[e.code]) FS.bus.emit('key', e.code);
      In.keys[e.code] = true; In.device = 'keyboard';
    });
    addEventListener('keyup', (e) => { In.keys[e.code] = false; });
    addEventListener('blur', () => { In.keys = {}; });
    const pts = new Map(); let pinch = 0;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
      if (e.pointerType === 'touch') In.device = 'touch';
      if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); In.drag = null; return; }
      const hit = In.pick(e.clientX, e.clientY);
      In.drag = hit && DRAGGABLE[hit.id] ? { id: hit.id, side: hit.side, acc: 0, moved: false } : null;
      pts.get(e.pointerId).hit = hit;
      FS.bus.emit('gesture');
    });
    canvas.addEventListener('pointermove', (e) => {
      In.mouse.x = e.clientX; In.mouse.y = e.clientY;
      const p = pts.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse') FS.bus.emit('hover', In.pick(e.clientX, e.clientY)); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) p.moved = true;
      if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); In.zoomD += (pinch - d) * 0.12; pinch = d; return; }
      if (In.drag) {
        const d = In.drag; d.acc += -dy; d.moved = d.moved || p.moved;
        if (d.id === 'throttle' || d.id === 'mixture') FS.cockpit(d.id, 1, -dy / 170);
        else if (d.id === 'trim') FS.cockpit('trim', 1, dy / 900);
        else if (d.id === 'panelLt') FS.cockpit('panelLt', 1, -dy / 120);
        else { const step = d.id === 'kollsman' ? 7 : 5; while (Math.abs(d.acc) >= step) { const s = Math.sign(d.acc); d.acc -= s * step; FS.cockpit(d.id, s, d.id === 'kollsman' ? 1 : d.id.endsWith('Knob') ? 1 : 1); } }
      } else if (p.moved && !(FS.settings.mouseYoke && e.pointerType === 'mouse' && e.buttons === 1 && false)) { In.lookDX += dx; In.lookDY += dy; }
    });
    const up = (e) => {
      const p = pts.get(e.pointerId); pts.delete(e.pointerId);
      if (!p) return;
      if (!p.moved && p.hit && !(In.drag && In.drag.moved)) {
        const id = p.hit.id;
        if (id === 'throttle' || id === 'mixture' || id === 'trim') FS.cockpit(id, 1, 0.0001);
        else FS.cockpit(id, p.hit.side, 0);
      }
      In.drag = null;
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const hit = In.pick(e.clientX, e.clientY), s = e.deltaY < 0 ? 1 : -1;
      if (hit && DRAGGABLE[hit.id]) {
        if (hit.id === 'throttle' || hit.id === 'mixture') FS.cockpit(hit.id, s, 0.05);
        else if (hit.id === 'trim') FS.cockpit('trim', -s, 0.02);
        else if (hit.id === 'panelLt') FS.cockpit('panelLt', s, 0.1);
        else FS.cockpit(hit.id, s, 1);
      } else In.zoomD += e.deltaY * 0.03;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('gamepadconnected', (e) => { In.pad.connected = true; In.pad.name = e.gamepad.id; FS.bus.emit('pad', true); });
    addEventListener('gamepaddisconnected', () => { In.pad.connected = false; In.pad.pitch = In.pad.roll = In.pad.yaw = In.pad.brake = 0; FS.bus.emit('pad', false); });
  };

  /* ---------- tilt ---------- */
  In.enableTilt = async () => {
    try {
      if (typeof DeviceOrientationEvent === 'undefined') return false;
      if (DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; }
      In.tilt.base = null;
      if (!In.tilt.bound) {
        addEventListener('deviceorientation', (e) => {
          if (e.beta === null || !FS.settings.tilt) return;
          const land = Math.abs((screen.orientation && screen.orientation.angle) || window.orientation || 0) === 90, sgn = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) === 90 ? 1 : -1;
          const rollRaw = land ? e.beta * sgn : e.gamma, pitchRaw = land ? -e.gamma * sgn : e.beta;
          if (!In.tilt.base) In.tilt.base = [rollRaw, pitchRaw];
          In.tilt.roll = clamp((rollRaw - In.tilt.base[0]) / 28, -1, 1); In.tilt.pitch = clamp((pitchRaw - In.tilt.base[1]) / 22, -1, 1); In.tilt.ok = true;
        });
        In.tilt.bound = true;
      }
      return true;
    } catch (err) { return false; }
  };

  /* ---------- gamepad ---------- */
  function readPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const g of pads) if (g && g.connected) { gp = g; break; }
    const pad = In.pad;
    if (!gp) { pad.connected = false; return; }
    pad.connected = true; pad.name = gp.id;
    const m = In.padMap();
    const axisV = (b) => (b ? (b.axis !== undefined ? (gp.axes[b.axis] || 0) : (gp.buttons[b.btn] && gp.buttons[b.btn].pressed ? 1 : 0)) : 0);
    const btnV = (b) => (b ? (b.btn !== undefined ? (gp.buttons[b.btn] ? gp.buttons[b.btn].value : 0) : Math.max(0, Math.abs(gp.axes[b.axis] || 0) * 2 - 1)) : 0);
    if (In.capture) {
      for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i].pressed && !In.prevBtn['c' + i]) { const cb = In.capture; In.capture = null; cb({ btn: i }); break; }
      if (In.capture) for (let i = 0; i < gp.axes.length; i++) if (Math.abs(gp.axes[i]) > 0.7 && Math.abs(In.prevBtn['a' + i] || 0) < 0.4) { const cb = In.capture; In.capture = null; cb({ axis: i }); break; }
      for (let i = 0; i < gp.buttons.length; i++) In.prevBtn['c' + i] = gp.buttons[i].pressed;
      for (let i = 0; i < gp.axes.length; i++) In.prevBtn['a' + i] = gp.axes[i];
      return;
    }
    for (let i = 0; i < gp.buttons.length; i++) In.prevBtn['c' + i] = gp.buttons[i].pressed;
    for (let i = 0; i < gp.axes.length; i++) In.prevBtn['a' + i] = gp.axes[i];
    const s = FS.settings.sens;
    pad.roll = clamp(expo(axisV(m.roll)) * s, -1, 1); pad.pitch = clamp(expo(axisV(m.pitch)) * s, -1, 1) * (FS.settings.invertPitch ? -1 : 1);
    pad.yaw = btnV(m.rudR) - btnV(m.rudL); pad.brake = btnV(m.brake);
    In.padLookX = expo(axisV(m.lookX)); In.padLookY = expo(axisV(m.lookY));
    if (Math.abs(pad.roll) + Math.abs(pad.pitch) + Math.abs(pad.yaw) > 0.2) In.device = 'gamepad';
    const edge = (name) => { const v = btnV(m[name]) > 0.5, was = In.prevBtn[name]; In.prevBtn[name] = v; return v && !was; };
    const c = FS.ac.ctl;
    if (btnV(m.thrUp) > 0.5) c.throttle = clamp(c.throttle + dt * 0.5, 0, 1);
    if (btnV(m.thrDn) > 0.5) c.throttle = clamp(c.throttle - dt * 0.5, 0, 1);
    if (btnV(m.trimUp) > 0.5) c.trim = clamp(c.trim + dt * 0.12, -1, 1);
    if (btnV(m.trimDn) > 0.5) c.trim = clamp(c.trim - dt * 0.12, -1, 1);
    if (edge('flapUp')) FS.cockpit('flapUp'); if (edge('flapDn')) FS.cockpit('flapDn');
    if (edge('park')) FS.cockpit('parkBrake'); if (edge('view')) FS.bus.emit('key', 'KeyC'); if (edge('map')) FS.bus.emit('key', 'KeyM');
    if (edge('pause')) FS.bus.emit('key', 'Escape'); if (edge('reset')) FS.bus.emit('key', 'KeyR');
  }

  /* ---------- per frame ---------- */
  In.update = (dt, paused) => {
    readPad(dt);
    if (paused) return;
    const ac = FS.ac, c = ac.ctl, k = In.keys, kb = In.kb, st = FS.settings;
    const tgt = (neg, pos) => ((k[pos[0]] || k[pos[1]]) ? 1 : 0) - ((k[neg[0]] || k[neg[1]]) ? 1 : 0);
    const ramp = (v, t) => approach(v, t * 0.85, dt * (t === 0 || Math.sign(t) !== Math.sign(v) ? 3.6 : 2.0));
    kb.pitch = ramp(kb.pitch, tgt(['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS']));
    kb.roll = ramp(kb.roll, tgt(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']));
    kb.yaw = ramp(kb.yaw, tgt(['KeyQ', 'KeyQ'], ['KeyE', 'KeyE']));
    // mouse yoke
    const ms = In.mouse;
    if (st.mouseYoke && In.device !== 'touch') {
      const r = FS.renderer.domElement.getBoundingClientRect();
      ms.roll = clamp((ms.x - (r.left + r.width / 2)) / (r.width * 0.3), -1, 1); ms.pitch = clamp((ms.y - (r.top + r.height / 2)) / (r.height * 0.3), -1, 1) * (st.invertPitch ? -1 : 1);
    } else ms.roll = ms.pitch = 0;
    const tl = st.tilt && In.tilt.ok ? In.tilt : { pitch: 0, roll: 0 }, tc = In.touch, pd = In.pad;
    c.pitch = clamp(kb.pitch + ms.pitch + pd.pitch + tc.pitch + tl.pitch, -1, 1);
    c.roll = clamp(kb.roll + ms.roll + pd.roll + tc.roll + tl.roll, -1, 1);
    let yaw = kb.yaw + pd.yaw + tc.yaw;
    if (st.autoRudder && !ac.crashed) {
      if (ac.onGround) yaw += clamp(0.3 * clamp(ac.o.thrust / 2200, 0, 1) * clamp(1 - ac.o.gs / 70, 0, 1) + ac.w.y * 1.4 * clamp(ac.o.gs / 15, 0, 1), -0.7, 0.7);
      else yaw += clamp(ac.o.ball * 4, -0.7, 0.7);
    }
    c.yaw = clamp(yaw, -1, 1);
    const both = (k.KeyB || k.Space) ? 1 : Math.max(pd.brake, tc.brake);
    c.brakeL = Math.max(both, k.Comma ? 1 : 0); c.brakeR = Math.max(both, k.Period ? 1 : 0);
    if (both > 0.3 && ac.onGround && Math.abs(c.yaw) > 0.35) { if (c.yaw > 0) c.brakeL *= 0.25; else c.brakeR *= 0.25; }
    const thr = (k.PageUp || k.Equal || k.NumpadAdd ? 1 : 0) - (k.PageDown || k.Minus || k.NumpadSubtract ? 1 : 0);
    if (thr) c.throttle = clamp(c.throttle + thr * dt * 0.45, 0, 1);
    const mix = (k.Digit0 ? 1 : 0) - (k.Digit9 ? 1 : 0);
    if (mix) c.mixture = clamp(c.mixture + mix * dt * 0.5, 0, 1);
    const trim = (k.End || k.KeyU ? 1 : 0) - (k.Home || k.KeyJ ? 1 : 0);
    if (trim) c.trim = clamp(c.trim + trim * dt * 0.1, -1, 1);
  };
})();
