/* ============================================================
   UI: menu, HUD, instructor card, radio, map, touch controls, debrief
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id), env = FS.env;
  const UI = FS.UI = { startKey: 'ready', dev: 'keyboard', mapT: 0, radioT: 0, toastT: 0, viewT: 0 };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MDOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

  function tab(p) {
    document.querySelectorAll('#tabs button').forEach((b) => { const on = b.dataset.p === p; b.className = 'sign ' + (on ? 'loc' : 'quiet'); });
    document.querySelectorAll('.page').forEach((s) => s.classList.toggle('on', s.id === 'p-' + p));
    if (p === 'wx') syncWx(); if (p === 'controls') devPage(); if (p === 'fly') $('atisbox').textContent = env.atis();
  }
  function renderStarts() {
    const box = $('starts'); box.innerHTML = '';
    Object.keys(FS.starts).forEach((k) => {
      const b = el('button', 'opt' + (k === UI.startKey ? ' on' : ''), '<div><b>' + FS.starts[k].label + '</b></div>');
      b.onclick = () => { UI.startKey = k; renderStarts(); }; box.appendChild(b);
    });
  }
  function renderLessons() {
    const box = $('lessonList'); box.innerHTML = '';
    FS.Lessons.list.forEach((l, i) => {
      const best = FS.settings.lessonBest[l.id];
      const b = el('button', 'opt', '<span class="n">' + (i + 1) + '</span><div><b>' + l.title + '</b><span>' + l.blurb + ' About ' + l.mins + ' minutes.</span></div>' + (best !== undefined ? '<span class="best">' + best + '</span>' : ''));
      b.onclick = () => FS.app.startLesson(l.id); box.appendChild(b);
    });
  }
  /* ---- weather and time ---- */
  const visFrom = (v) => Math.round(0.3 * Math.pow(50 / 0.3, v / 100) * 10) / 10, visTo = (km) => Math.log(km / 0.3) / Math.log(50 / 0.3) * 100;
  const WX = [
    ['windDir', 'Wind from', 0, 359, 5, (v) => ('00' + Math.round(v)).slice(-3) + '° true'], ['windKt', 'Wind speed', 0, 35, 1, (v) => v + ' kt'], ['gustKt', 'Gusting to', 0, 45, 1, (v) => v + ' kt'],
    ['visKm', 'Visibility', 0, 100, 1, (v) => (visFrom(v) >= 10 ? Math.round(visFrom(v)) : visFrom(v)) + ' km', visFrom, visTo], ['baseFt', 'Cloud base', 300, 10000, 100, (v) => v + ' ft'],
    ['cover', 'Cloud cover', 0, 100, 1, (v) => v + '%', (v) => v / 100, (v) => v * 100], ['rain', 'Rain', 0, 100, 5, (v) => v + '%', (v) => v / 100, (v) => v * 100],
    ['turb', 'Turbulence', 0, 100, 5, (v) => v + '%', (v) => v / 100, (v) => v * 100], ['tempC', 'Temperature', 10, 42, 1, (v) => v + ' °C'], ['qnh', 'QNH', 995, 1030, 1, (v) => v + ' hPa']
  ];
  function buildWx() {
    const pr = $('wxPresets');
    Object.keys(env.presets).forEach((k) => { const b = el('button', 'sign quiet', env.presets[k].name); b.dataset.k = k; b.onclick = () => { env.applyPreset(k); syncWx(); }; pr.appendChild(b); });
    const box = $('wxRows');
    WX.forEach(([key, label, mn, mx, st, f, from, to]) => {
      const r = el('div', 'row'), id = 'wx_' + key;
      r.innerHTML = '<label for="' + id + '">' + label + '</label><input type="range" id="' + id + '" min="' + mn + '" max="' + mx + '" step="' + st + '"><output></output>';
      box.appendChild(r);
      const inp = r.querySelector('input'), out = r.querySelector('output');
      inp.oninput = () => { const v = +inp.value; env.wx[key] = from ? from(v) : v; if (key === 'windKt' && env.wx.gustKt < env.wx.windKt) env.wx.gustKt = env.wx.windKt; if (key === 'rain') env.wx.storm = env.wx.storm && env.wx.rain > 0.5; env.wx.key = 'custom'; env.wx.name = 'Custom'; out.textContent = f(v); markPreset(); };
      inp._sync = () => { const v = to ? to(env.wx[key]) : env.wx[key]; inp.value = v; out.textContent = f(Math.round(+inp.value / st) * st); };
    });
    const tb = $('timeRows');
    const r1 = el('div', 'row'); r1.innerHTML = '<label for="t_time">Local time</label><input type="range" id="t_time" min="0" max="23.9" step="0.1"><output></output>'; tb.appendChild(r1);
    const ti = r1.querySelector('input'), to2 = r1.querySelector('output');
    ti.oninput = () => { env.time = +ti.value; to2.textContent = env.timeString().slice(0, 2) + ':' + env.timeString().slice(2); };
    ti._sync = () => { ti.value = env.time; to2.textContent = env.timeString().slice(0, 2) + ':' + env.timeString().slice(2); };
    const r2 = el('div', 'row'); r2.innerHTML = '<label for="t_mon">Month</label><select id="t_mon">' + MON.map((m, i) => '<option value="' + i + '">' + m + '</option>').join('') + '</select><output></output>'; tb.appendChild(r2);
    const ms = r2.querySelector('select'); ms.onchange = () => { env.doy = MDOY[+ms.value]; };
    ms._sync = () => { let b = 0; MDOY.forEach((d, i) => { if (Math.abs(d - env.doy) < Math.abs(MDOY[b] - env.doy)) b = i; }); ms.value = b; };
    const r3 = el('div', 'toggle'); r3.innerHTML = '<div>Time passes<small>Speed up to watch the day turn to night</small></div><div class="seg" id="t_rate"></div>'; tb.appendChild(r3);
    [[1, '1×'], [60, '60×'], [600, '600×'], [3600, '3600×']].forEach(([v, t]) => { const b = el('button', '', t); b.onclick = () => { env.rate = v; syncWx(); }; b.dataset.v = v; r3.querySelector('.seg').appendChild(b); });
  }
  function markPreset() { document.querySelectorAll('#wxPresets button').forEach((b) => { b.className = 'sign ' + (b.dataset.k === env.wx.key ? 'loc' : 'quiet'); }); }
  function syncWx() {
    document.querySelectorAll('#wxRows input, #timeRows input, #timeRows select').forEach((i) => i._sync && i._sync());
    document.querySelectorAll('#t_rate button').forEach((b) => b.classList.toggle('on', +b.dataset.v === env.rate));
    markPreset();
  }
  /* ---- settings ---- */
  function seg(opts, get, set) { const s = el('div', 'seg'); opts.forEach(([v, t]) => { const b = el('button', get() === v ? 'on' : '', t); b.onclick = () => { set(v); s.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); FS.saveSettings(); }; s.appendChild(b); }); return s; }
  function toggleRow(box, title, sub, control) { const r = el('div', 'toggle'); r.innerHTML = '<div>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; r.appendChild(control); box.appendChild(r); return r; }
  const onoff = (key, cb) => seg([[true, 'On'], [false, 'Off']], () => !!FS.settings[key], (v) => { FS.settings[key] = v; cb && cb(v); });
  function sliderRow(box, label, key, mn, mx, st, f, cb) { const r = el('div', 'row'); r.innerHTML = '<label>' + label + '</label><input type="range" min="' + mn + '" max="' + mx + '" step="' + st + '"><output></output>'; const i = r.querySelector('input'), o = r.querySelector('output'); i.value = FS.settings[key]; o.textContent = f(+i.value); i.oninput = () => { FS.settings[key] = +i.value; o.textContent = f(+i.value); FS.saveSettings(); cb && cb(); }; box.appendChild(r); }
  function buildSettings() {
    const box = $('setRows'); box.innerHTML = '';
    toggleRow(box, 'Instrument panel', 'Classic gauges or a G1000-style glass cockpit', seg([['analog', 'Analog'], ['glass', 'Glass']], () => FS.settings.panel, (v) => { FS.settings.panel = v; FS.Panel.setType(v); }));
    toggleRow(box, 'Graphics quality', 'Changes apply after a restart', seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']], () => FS.settings.quality, (v) => { FS.settings.quality = v; $('bRestart').hidden = false; }));
    const rb = el('button', 'sign quiet', 'Restart now'); rb.id = 'bRestart'; rb.hidden = true; rb.style.margin = '8px 0'; rb.onclick = () => { FS.saveSettings(); location.reload(); }; box.appendChild(rb);
    toggleRow(box, 'Beginner read-outs', 'Speed, altitude and heading strip at the bottom', onoff('hud'));
    toggleRow(box, 'Units', 'For the read-out strip', seg([['aviation', 'kt, ft'], ['metric', 'km/h, m']], () => FS.settings.units, (v) => { FS.settings.units = v; }));
    toggleRow(box, 'Automatic rudder', 'Keeps the ball centred and helps you stay straight. Turn off to learn rudder control.', onoff('autoRudder'));
    toggleRow(box, 'Mouse yoke', 'Move the mouse to fly: centre of the screen is neutral', onoff('mouseYoke'));
    toggleRow(box, 'Cockpit shake', 'Buffet and runway vibration', onoff('shake'));
    sliderRow(box, 'Sound volume', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    const n = el('p', 'note', 'Runs in your browser. Settings and lesson scores are saved on this device.'); n.style.marginTop = '14px'; box.appendChild(n);
  }
  /* ---- controls help ---- */
  function devPage() {
    document.querySelectorAll('#devTabs button').forEach((b) => { b.className = 'sign ' + (b.dataset.d === UI.dev ? 'loc' : 'quiet'); });
    const box = $('devPage'), In = FS.Input; box.innerHTML = '';
    if (UI.dev === 'keyboard') {
      box.appendChild(el('p', '', 'Click any switch, knob or lever in the cockpit. Drag knobs and the throttle, or scroll the mouse wheel over them.'));
      const t = el('table', 'keys'); In.keyHelp.forEach(([a, k]) => { t.appendChild(el('tr', '', '<td>' + a + '</td><td>' + k + '</td>')); }); box.appendChild(t);
    } else if (UI.dev === 'gamepad') {
      box.appendChild(el('p', '', In.pad.connected ? 'Connected: ' + In.pad.name.slice(0, 60) : 'No controller found yet. Plug one in and press any button on it.'));
      const t = el('table', 'keys'), m = In.padMap();
      Object.keys(In.padLabels).forEach((k) => {
        const b = m[k] || {}, tr = el('tr', '', '<td>' + In.padLabels[k] + '</td><td></td>'), btn = el('button', '', b.axis !== undefined ? 'Axis ' + b.axis : b.btn !== undefined ? 'Button ' + b.btn : 'Not set');
        btn.onclick = () => { btn.textContent = 'Press or move…'; In.capture = (r) => { const nm = Object.assign({}, In.padMap()); nm[k] = r; FS.settings.padMap = nm; FS.saveSettings(); devPage(); }; };
        tr.lastChild.appendChild(btn); t.appendChild(tr);
      });
      box.appendChild(t);
      const rs = el('button', 'sign quiet', 'Restore default layout'); rs.style.margin = '10px 0'; rs.onclick = () => { FS.settings.padMap = null; FS.saveSettings(); devPage(); }; box.appendChild(rs);
      sliderRow(box, 'Sensitivity', 'sens', 0.4, 1.6, 0.05, (v) => v.toFixed(2) + '×'); sliderRow(box, 'Curve', 'expo', 0, 0.8, 0.05, (v) => Math.round(v * 100) + '%'); sliderRow(box, 'Dead zone', 'deadzone', 0, 0.3, 0.01, (v) => Math.round(v * 100) + '%');
      toggleRow(box, 'Invert pitch', 'Push forward to climb', onoff('invertPitch'));
      box.appendChild(el('p', 'note', 'Default: left stick flies, right stick looks, triggers are the rudder pedals, bumpers move the flaps, D-pad up and down is throttle, D-pad left and right is trim.'));
    } else {
      const t = el('table', 'keys');
      [['Pitch and roll', 'right-hand stick'], ['Throttle', 'left slider'], ['Rudder', 'bottom-left slider, springs back'], ['Brakes', 'hold BRAKE; PARK toggles the parking brake'], ['Flaps and trim', 'buttons beside the stick'], ['Look around', 'drag on the view'], ['Zoom', 'pinch'], ['Switches and knobs', 'tap them in the cockpit; drag knobs']].forEach(([a, k]) => t.appendChild(el('tr', '', '<td>' + a + '</td><td>' + k + '</td>')));
      box.appendChild(t);
      const tb = seg([[true, 'On'], [false, 'Off']], () => !!FS.settings.tilt, async (v) => { if (v) { const ok = await In.enableTilt(); FS.settings.tilt = ok; if (!ok) UI.toast('Tilt is not available in this browser.'); else UI.toast('Hold the phone how you want to fly, then tilt.'); } else FS.settings.tilt = false; });
      toggleRow(box, 'Tilt steering', 'Tilt the phone to roll and pitch', tb);
      toggleRow(box, 'Automatic rudder', 'Recommended on a phone', onoff('autoRudder'));
    }
  }

  /* ---- HUD ---- */
  UI.toast = (t, ms) => { const e = $('toast'); e.textContent = t; e.classList.add('on'); UI.toastT = (ms || 2600) / 1000; };
  UI.radio = (r) => {
    const e = $('radio'), ac = FS.ac;
    e.classList.toggle('alert', !!r.alert);
    if (r.tower && Math.abs(ac.inst.com1 - AD.TWR) > 0.001) { $('radioWho').textContent = 'Radio'; $('radioText').textContent = 'Tower is calling on 118.15, but COM1 is on ' + ac.inst.com1.toFixed(3) + '. Press TOWER on the radio.'; }
    else { $('radioWho').textContent = r.who || (r.tower ? 'Tower 118.15' : ''); $('radioText').textContent = r.text; }
    e.classList.add('on'); UI.radioT = r.alert ? 4 : Math.max(7, r.text.length * 0.075);
  };
  UI.viewName = (n) => { const e = $('viewname'); e.textContent = n; e.classList.add('on'); UI.viewT = 1.6; };
  UI.coach = (flash) => {
    const L = FS.Lessons, c = $('coach');
    if (!L.cur || L.finished) { c.hidden = true; return; }
    c.hidden = false; const st = L.cur.steps[L.i];
    $('coachTitle').textContent = L.cur.title; $('coachN').textContent = (L.i + 1) + ' of ' + L.cur.steps.length;
    $('coachText').textContent = L.text(); $('coachHint').textContent = st.hint || ''; $('coachHint').hidden = !st.hint;
    $('coachBar').style.width = (L.i / L.cur.steps.length * 100) + '%';
    if (flash) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  };
  UI.debrief = (d) => {
    $('dbTitle').textContent = d.title; $('dbScore').textContent = d.score;
    $('dbSub').textContent = d.sub || (d.score >= 85 ? 'Well flown.' : d.score >= 60 ? 'A solid attempt. Read the notes and fly it once more.' : 'Worth another go: the notes below say what to change.');
    const box = $('dbRows'); box.innerHTML = '';
    d.rows.forEach(([label, val, s, tip]) => {
      const r = el('div', 'r'); r.innerHTML = '<div class="l">' + label + '<span>' + val + '</span></div>' + (s === null || s === undefined ? '' : '<div class="m"><i class="' + (s < 0.4 ? 'low' : s < 0.75 ? 'mid' : '') + '" style="width:' + Math.round(Math.max(0.04, s) * 100) + '%"></i></div>') + (tip ? '<p>' + tip + '</p>' : '');
      box.appendChild(r);
    });
    const idx = d.lesson ? FS.Lessons.list.findIndex((l) => l.id === d.lesson) : -1;
    $('dbAgain').hidden = !d.again; $('dbNext').hidden = !(idx >= 0 && idx < FS.Lessons.list.length - 1); $('dbFree').hidden = !!d.crash;
    $('dbNext').onclick = () => { UI.closeDebrief(); FS.app.startLesson(FS.Lessons.list[idx + 1].id); };
    $('dbAgain').onclick = () => { UI.closeDebrief(); d.again(); };
    $('debrief').classList.add('on'); FS.app.setPaused(true, true);
  };
  UI.closeDebrief = () => { $('debrief').classList.remove('on'); };
  UI.showMenu = (on, inFlight) => {
    $('menu').classList.toggle('off', !on); $('hud').classList.toggle('off', on && !inFlight ? true : false);
    $('resumeBox').hidden = !inFlight; $('bHide').hidden = !inFlight; $('bStart').textContent = inFlight ? 'Start new flight' : 'Start flight';
    if (on) { renderLessons(); $('atisbox').textContent = env.atis(); }
  };

  /* ---- touch controls ---- */
  function bindTouch() {
    const T = FS.Input.touch;
    const dragPad = (elm, onMove, onEnd) => {
      let id = null;
      elm.addEventListener('pointerdown', (e) => { id = e.pointerId; elm.setPointerCapture(id); onMove(e, elm.getBoundingClientRect()); e.preventDefault(); FS.bus.emit('gesture'); });
      elm.addEventListener('pointermove', (e) => { if (e.pointerId === id) onMove(e, elm.getBoundingClientRect()); });
      const end = (e) => { if (e.pointerId === id) { id = null; onEnd && onEnd(); } };
      elm.addEventListener('pointerup', end); elm.addEventListener('pointercancel', end);
    };
    const stick = $('stick'), knob = stick.firstElementChild;
    dragPad(stick, (e, r) => { let x = (e.clientX - r.left - r.width / 2) / (r.width / 2 - 20), y = (e.clientY - r.top - r.height / 2) / (r.height / 2 - 20); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } T.roll = x * 0.9; T.pitch = y * 0.9 * (FS.settings.invertPitch ? -1 : 1); knob.style.transform = 'translate(' + x * 41 + 'px,' + y * 41 + 'px)'; }, () => { T.roll = T.pitch = 0; knob.style.transform = ''; });
    const thr = $('thr');
    dragPad(thr, (e, r) => { FS.ac.ctl.throttle = clamp(1 - (e.clientY - r.top - 15) / (r.height - 30), 0, 1); });
    const rud = $('rud'), rk = rud.querySelector('i');
    dragPad(rud, (e, r) => { T.yaw = clamp((e.clientX - r.left - r.width / 2) / (r.width / 2 - 20), -1, 1); rk.style.left = (53 + T.yaw * 52) + 'px'; }, () => { T.yaw = 0; rk.style.left = '53px'; });
    document.querySelectorAll('#touch button').forEach((b) => {
      const a = b.dataset.a; let iv = null;
      const down = (e) => { e.preventDefault(); b.classList.add('held'); FS.bus.emit('gesture');
        if (a === 'brake') T.brake = 1; else if (a === 'park') FS.cockpit('parkBrake'); else if (a === 'flapUp' || a === 'flapDn') FS.cockpit(a);
        else { const s = a === 'trimUp' ? 1 : -1; FS.cockpit('trim', s, 0.02); iv = setInterval(() => FS.cockpit('trim', s, 0.015), 90); } };
      const up = () => { b.classList.remove('held'); if (a === 'brake') T.brake = 0; if (iv) { clearInterval(iv); iv = null; } };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
  }

  /* ---- rain on the windscreen ---- */
  const drops = [];
  function drawDrops(dt, interior) {
    const cv = $('drops'), rain = env.wx.rain * (FS.World.inCloud > 0.6 ? 0.5 : 1) * (FS.ac.pos.y < env.wx.baseFt * FT + 200 ? 1 : 0);
    if (!interior || (rain < 0.03 && !drops.length)) { if (cv.width !== 2) { cv.width = 2; cv.height = 2; } drops.length = 0; return; }
    const w = Math.round(innerWidth / 2), h = Math.round(innerHeight / 2);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d'); c.clearRect(0, 0, w, h);
    const spd = clamp(FS.ac.o.ias / 90, 0, 1.4), want = rain * 110;
    while (drops.length < want) drops.push({ x: Math.random() * w, y: Math.random() * h * 0.5, r: 1.2 + Math.random() * 2.6, a: 1, vx: 0, vy: 0 });
    c.strokeStyle = 'rgba(215,228,240,0.22)'; c.fillStyle = 'rgba(215,228,240,0.2)';
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], dx = d.x - w / 2, dy = d.y - h * 0.5, l = Math.hypot(dx, dy) || 1;
      d.vx += (dx / l * spd * 260 - d.vx) * dt * 2; d.vy += ((dy / l * spd * 260 - (1 - spd) * -34) - d.vy) * dt * 2;
      const ox = d.x, oy = d.y; d.x += d.vx * dt; d.y += d.vy * dt; d.a -= dt * (0.25 + spd * 0.5);
      c.lineWidth = d.r; c.beginPath(); c.moveTo(ox - d.vx * 0.03, oy - d.vy * 0.03); c.lineTo(d.x, d.y); c.stroke();
      c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill();
      if (d.a <= 0 || d.x < -5 || d.x > w + 5 || d.y < -5 || d.y > h * 0.52) drops.splice(i, 1);
    }
  }

  /* ---- per frame ---- */
  let frame = 0; const cache = {};
  const setT = (id, v, cls) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } if (cls !== undefined && cache[id + 'c'] !== cls) { cache[id + 'c'] = cls; $(id).className = cls; } };
  UI.update = (dt, flying, interior) => {
    frame++;
    if (UI.radioT > 0) { UI.radioT -= dt; if (UI.radioT <= 0) $('radio').classList.remove('on'); }
    if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) $('toast').classList.remove('on'); }
    if (UI.viewT > 0) { UI.viewT -= dt; if (UI.viewT <= 0) $('viewname').classList.remove('on'); }
    drawDrops(dt, flying && interior);
    if (!flying) return;
    const ac = FS.ac, o = ac.o, met = FS.settings.units === 'metric';
    $('strip').style.display = FS.settings.hud ? 'flex' : 'none';
    if (FS.settings.hud && frame % 3 === 0) {
      setT('sIas', String(Math.round(met ? o.ias * 1.852 : o.ias)), o.stallWarn || o.ias > 163 ? 'bad' : '');
      setT('sAlt', String(Math.round((met ? o.indAlt * FT : o.indAlt) / 10) * 10));
      setT('sHdg', ('00' + (Math.round(o.hdgMag) % 360 || 360)).slice(-3));
      setT('sVs', met ? (o.vs * FT / 60).toFixed(1) : String(Math.round(o.vs / 50) * 50));
      setT('sRpm', String(Math.round(ac.eng.rpm / 10) * 10), ac.eng.rpm > 2700 ? 'bad' : '');
      setT('sFlap', ['UP', '10', '20', 'FULL'][ac.ctl.flapSel]);
      setT('sTrim', (ac.ctl.trim >= 0 ? '+' : '') + Math.round(ac.ctl.trim * 100));
    }
    if (frame % 6 === 0) {
      const w = [];
      if (o.stallWarn || o.stall > 0.4) w.push(['STALL', '']);
      if (o.ias > 163) w.push(['OVERSPEED', '']);
      if (ac.ctl.parkBrake && ac.ctl.throttle > 0.4 && ac.eng.running) w.push(['PARKING BRAKE SET', 'y']);
      if (ac.tailStrike > 0) w.push(['TAIL STRIKE', '']);
      if (ac.eng.fail && !ac.onGround) w.push(['ENGINE FAILED: 68 KIAS', '']);
      if (!ac.onGround && o.aglFt < 400 && o.vs < -1100) w.push(['SINK RATE', '']);
      const key = w.map((x) => x[0]).join('|');
      if (cache.warn !== key) { cache.warn = key; $('warn').innerHTML = w.map((x) => '<span class="' + x[1] + '">' + x[0] + '</span>').join(''); }
    }
    if (FS.settings.mapOn && frame % 4 === 0) {
      const cv = $('map'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
      FS.Panel.drawMap(c, cv.width / 2, cv.height / 2, cv.height / 2 / 1.3 * 1.27, ac.onGround ? 0.6 : 3, ac, false);
    }
    if (FS.Lessons.cur && frame % 20 === 0) UI.coach(false);
  };

  UI.init = () => {
    document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => tab(b.dataset.p); });
    document.querySelectorAll('#devTabs button').forEach((b) => { b.onclick = () => { UI.dev = b.dataset.d; devPage(); }; });
    renderStarts(); renderLessons(); buildWx(); buildSettings(); syncWx(); bindTouch();
    $('atisbox').textContent = env.atis();
    $('bStart').onclick = () => FS.app.startFlight(UI.startKey);
    $('bResume').onclick = () => FS.app.setPaused(false); $('bHide').onclick = () => FS.app.setPaused(false);
    $('bReset').onclick = () => FS.app.reset(); $('bAutoStart').onclick = () => { FS.app.autoStart(); FS.app.setPaused(false); };
    $('bMenu').onclick = () => FS.app.setPaused(true); $('bView').onclick = () => FS.app.cycleView();
    $('bMap').onclick = () => { FS.settings.mapOn = !FS.settings.mapOn; $('map').classList.toggle('on', FS.settings.mapOn); FS.saveSettings(); };
    $('bAtis').onclick = () => UI.radio({ who: 'ATIS 128.05', text: env.atis() });
    $('coachSkip').onclick = () => FS.Lessons.cur && FS.Lessons.advance(); $('coachEnd').onclick = () => { FS.Lessons.stop(); UI.toast('Lesson ended. You are in free flight.'); };
    $('dbMenu').onclick = () => { UI.closeDebrief(); FS.app.setPaused(true); }; $('dbFree').onclick = () => { UI.closeDebrief(); FS.Lessons.stop(); FS.app.setPaused(false); };
    $('map').classList.toggle('on', !!FS.settings.mapOn);
    const bus = FS.bus;
    bus.on('radio', UI.radio); bus.on('lesson', (e) => UI.coach(e && e.step)); bus.on('debrief', (d) => { d.again = () => FS.app.startLesson(d.lesson); UI.debrief(d); });
    bus.on('cockpit', (e) => { if (e.msg) UI.toast(e.msg, 1800); });
    bus.on('comTuned', () => { if (Math.abs(FS.ac.inst.com1 - AD.ATIS) < 0.001 && FS.ac.elec.bus && FS.ac.elec.avionics) UI.radio({ who: 'ATIS 128.05', text: env.atis() }); });
    bus.on('hover', (h) => { const t = $('tip'); if (h && FS.Panel.names[h.id]) { t.textContent = FS.Panel.names[h.id]; t.style.left = (FS.Input.mouse.x + 14) + 'px'; t.style.top = (FS.Input.mouse.y + 16) + 'px'; t.classList.add('on'); } else t.classList.remove('on'); });
    bus.on('pad', (on) => { UI.toast(on ? 'Controller connected' : 'Controller disconnected'); if (on) UI.dev = 'gamepad'; devPage(); });
    bus.on('weather', () => { $('atisbox').textContent = env.atis(); });
    const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (coarse) { document.body.classList.add('touch'); UI.dev = 'touch'; }
    const rot = () => { $('rotate').style.display = coarse && innerHeight > innerWidth * 1.15 && FS.app.flying() ? 'grid' : 'none'; };
    addEventListener('resize', rot); UI.checkRotate = rot;
  };
})();
