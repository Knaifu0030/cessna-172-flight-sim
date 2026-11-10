/* ============================================================
   Application: renderer, lights, cameras, loop
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id), env = FS.env, V3 = THREE.Vector3, In = FS.Input, M = FS.Model;
  const app = FS.app = { state: 'menu', paused: false, last: { key: 'ready', lesson: null }, frame: 0 };
  const view = FS.view = {
    mode: 6, look: { yaw: 0, pitch: -0.21 }, pad: { yaw: 0, pitch: 0 }, fov: 62, zoomI: false,
    orbit: { yaw: 2.2, pitch: 0.16, dist: 15 }, chase: { yaw: 0, pitch: 0.2, dist: 13 }, top: { h: 150 }, fly: { pos: new V3(), ok: false }, cpos: new V3(), cinit: false,
    names: ['Pilot seat', 'Co-pilot seat', 'Chase', 'Wing', 'Tower', 'Fly-by', 'Orbit', 'Taxi view from above'],
    interior() { return this.mode < 2; }
  };
  let renderer, scene, camera, hemi, sun, Q, ac, last = 0, apronLt = [];

  function pickQuality() {
    let q = FS.settings.quality;
    if (q === 'auto') { const mobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900; q = mobile ? ((navigator.deviceMemory || 4) >= 4 ? 'medium' : 'low') : 'high'; }
    const T = {
      low: { pr: 1.25, shadows: 0, buildings: 2500, cityLights: 6000, trees: 1200, clouds: 50, panel: 0.75, low: true, aa: false, pt: false },
      medium: { pr: 1.75, shadows: 1024, buildings: 5500, cityLights: 14000, trees: 2600, clouds: 80, panel: 0.75, low: false, aa: true, pt: true },
      high: { pr: 2, shadows: 2048, buildings: 9000, cityLights: 22000, trees: 4200, clouds: 110, panel: 1, low: false, aa: true, pt: true }
    };
    return Object.assign({ name: q }, T[q] || T.high);
  }
  const step = (pct, text) => new Promise((res) => { $('loadBar').style.width = pct + '%'; if (text) $('loadText').textContent = text; setTimeout(res, 40); });

  async function init() {
    FS.loadSettings();
    Q = app.Q = pickQuality();
    const canvas = $('gl');
    try { renderer = FS.renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance' }); }
    catch (e) { $('loadText').textContent = 'This browser could not start 3D graphics (WebGL). Try another browser or device.'; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr)); renderer.setSize(innerWidth, innerHeight, false);
    if (Q.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    FS.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfd3e6, 200, 40000);
    camera = FS.cam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 90000);
    hemi = new THREE.HemisphereLight(0xffffff, 0x665544, 0.6); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun); scene.add(sun.target);
    if (Q.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(Q.shadows, Q.shadows); const c = sun.shadow.camera; c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 20; c.far = 260; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; }
    if (Q.pt) { for (const [x, y, z, d] of [[1150, 30, -215, 420], [1010, 16, 250, 130]]) { const p = new THREE.PointLight(0xffe6bd, 0, d, 1.4); p.position.set(x, y - AD.SLOPE * x, z); scene.add(p); apronLt.push(p); } }
    await step(12, 'Laying out the city and the Western Ghats…');
    FS.World.build(scene, Q);
    await step(45, 'Painting runway 05/23…');
    FS.Airport.build(scene, Q);
    await step(65, 'Rolling ' + AD.CALLSIGN + ' out of the hangar…');
    M.build(scene, Q);
    ac = FS.ac = new FS.Aircraft();
    env.applyPreset('scattered'); env.time = 8.6; env.doy = 314; env.update(0);
    ac.place(FS.starts.cold.make());
    await step(82, 'Calibrating instruments…');
    FS.Panel.init(Q.panel); M.panelMat.map = FS.Panel.tex; M.panelMat.needsUpdate = true;
    FS.UI.init(); In.init(canvas); wire();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => FS.Panel.setType(FS.Panel.type));
    await step(100, 'Ready');
    FS.UI.showMenu(true, false);
    $('loading').classList.add('done');
    addEventListener('resize', resize); resize();
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); FS.UI.checkRotate && FS.UI.checkRotate(); }

  /* ---------- flow ---------- */
  app.flying = () => app.state === 'fly';
  app.startFlight = (key, lessonId) => {
    FS.Audio.init();
    const st = FS.starts[key] || FS.starts.ready;
    if (!lessonId && app.wxSaved) { Object.assign(env.wx, app.wxSaved); app.wxSaved = null; }
    if (!lessonId) FS.activeRwy = st.rwy || env.activeRunway(); else if (st.rwy) FS.activeRwy = st.rwy;
    ac.place(st.make());
    if (key !== 'cold' && !(key === 'final')) ac.ctl.trim = lessonId ? 0 : 0.24;
    FS.Metrics.reset(); FS.ATC.reset(key);
    view.mode = 0; view.look.yaw = 0; view.look.pitch = -0.21; view.fov = 62; view.zoomI = false; view.cinit = false; view.fly.ok = false;
    app.state = 'fly'; app.paused = false; app.last = { key, lesson: lessonId || null }; app.crashT = 0;
    FS.UI.closeDebrief(); FS.UI.showMenu(false); $('hud').classList.remove('off');
    if (lessonId) FS.Lessons.start(lessonId); else { FS.Lessons.stop(); if (FS.Panel.type !== FS.settings.panel) FS.Panel.setType(FS.settings.panel); }
    FS.UI.coach(true); FS.UI.checkRotate && FS.UI.checkRotate();
    if (!lessonId) FS.UI.toast(key === 'cold' ? 'Cold and dark. Open the menu for “Start the engine for me”, or fly lesson 2 to learn the start.' : (document.body.classList.contains('touch') ? 'Tap Menu for options. Drag to look around.' : 'Press Esc for the menu. Drag to look around.'), 5000);
  };
  app.startLesson = (id) => {
    const l = FS.Lessons.list.find((q) => q.id === id); if (!l) return;
    FS.activeRwy = env.activeRunway();
    if (app.wxSaved && !l.crosswind) { Object.assign(env.wx, app.wxSaved); app.wxSaved = null; }
    FS.activeRwy = env.activeRunway();
    if (l.crosswind) { if (!app.wxSaved) app.wxSaved = Object.assign({}, env.wx); FS.activeRwy = '05'; Object.assign(env.wx, { windDir: wrap360(AD.RWY_TRUE - 85), windKt: 12, gustKt: 14, turb: 0.1, key: 'custom', name: 'Crosswind' }); }
    if (l.analog && FS.Panel.type !== 'analog') FS.Panel.setType('analog'); else if (!l.analog && FS.Panel.type !== FS.settings.panel) FS.Panel.setType(FS.settings.panel);
    const key = l.start === 'lineup' ? 'rwy' + FS.activeRwy : l.start;
    app.startFlight(key, id);
  };
  app.reset = () => { if (app.last.lesson) app.startLesson(app.last.lesson); else app.startFlight(app.last.key); };
  app.setPaused = (p, quiet) => {
    if (app.state !== 'fly') return;
    app.paused = p;
    if (p && !quiet) FS.UI.showMenu(true, true); else if (!p) { FS.UI.closeDebrief(); FS.UI.showMenu(false); $('hud').classList.remove('off'); }
  };
  app.autoStart = () => {
    const e = ac.eng, el = ac.elec;
    Object.assign(el, { bat: true, alt: true, avionics: true, beacon: true, nav: true, pump: false });
    ac.ctl.mixture = 1; e.mags = 3; e.fail = false; if (!e.running) { e.running = true; e.rpm = 700; e.oilP = 55; } ac.inst.gyro = 1; ac.inst.kollsman = Math.round(env.wx.qnh); ac.fuel.sel = 'BOTH';
    FS.UI.toast('Engine running. Release the parking brake (P) when you are ready to taxi.', 4000);
  };
  app.cycleView = (m) => { view.mode = m === undefined ? (view.mode + 1) % 8 : m; view.cinit = false; view.fly.ok = false; view.zoomI = false; FS.UI.viewName(view.names[view.mode]); };

  function wire() {
    const bus = FS.bus;
    bus.on('gesture', () => FS.Audio.init());
    bus.on('cockpit', (e) => { if (e.click) FS.Audio.click(); });
    bus.on('touchdown', (e) => FS.Audio.chirp(clamp(e.sink / 2.5, 0.3, 1.5)));
    bus.on('lightning', (d) => FS.Audio.thunder(d));
    bus.on('crash', (reason) => { FS.Audio.crash(); app.crashT = 1.6; app.crashReason = reason; });
    bus.on('landed', () => {
      if (FS.Lessons.cur || app.state !== 'fly') return;
      const rows = FS.Metrics.landingReport(), s = rows.filter((r) => r[2] !== null);
      FS.UI.debrief({ title: 'Landing report', rows, score: Math.round(s.reduce((a, r) => a + r[2], 0) / Math.max(1, s.length) * 100) });
    });
    bus.on('reposition', (opts) => { ac.place(opts); const d = FS.Metrics.d; d.td = null; d.tdCount = 0; d.apN = 0; d.apIas = d.apIas2 = d.apOn = d.apDev = 0; d.landed = false; FS.ATC.phase = 'final0'; FS.ATC.t = 0; view.cinit = false; });
    bus.on('key', (code) => {
      FS.Audio.init();
      if (code === 'Escape') { if ($('debrief').classList.contains('on')) return; if (app.state === 'fly') app.setPaused(!app.paused); return; }
      if (app.state !== 'fly' || app.paused) return;
      const st = FS.settings;
      switch (code) {
        case 'KeyC': app.cycleView(); break;
        case 'KeyM': $('bMap').click(); break;
        case 'KeyY': st.mouseYoke = !st.mouseYoke; FS.UI.toast('Mouse yoke ' + (st.mouseYoke ? 'on: the centre of the screen is neutral' : 'off')); FS.saveSettings(); break;
        case 'KeyH': st.hud = !st.hud; FS.saveSettings(); break;
        case 'KeyK': M.hideYoke = !M.hideYoke; break;
        case 'KeyI': view.zoomI = !view.zoomI; if (view.zoomI && !view.interior()) app.cycleView(0); if (view.zoomI) { view.look.yaw = 0.05; view.look.pitch = -0.4; view.fov = 36; } else { view.look.yaw = 0; view.look.pitch = -0.21; view.fov = 62; } break;
        case 'KeyL': view.look.yaw = 0; view.look.pitch = -0.21; view.fov = 62; view.chase.yaw = 0; view.chase.pitch = 0.2; break;
        case 'KeyR': app.reset(); break;
        case 'KeyF': case 'BracketRight': FS.cockpit('flapDn'); break;
        case 'KeyV': case 'BracketLeft': FS.cockpit('flapUp'); break;
        case 'KeyP': FS.cockpit('parkBrake'); break;
        case 'KeyG': FS.Panel.setType(FS.Panel.type === 'analog' ? 'glass' : 'analog'); break;
        default: if (/^Digit[1-8]$/.test(code)) app.cycleView(+code.slice(5) - 1);
      }
    });
  }

  /* ---------- camera ---------- */
  const tA = new V3(), tB = new V3(), tC = new V3(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), UP = new V3(0, 1, 0), ZA = new V3(0, 0, 1);
  const QBASE = new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2);
  function updateCamera(dt) {
    const dx = In.lookDX, dy = In.lookDY, zd = In.zoomD; In.lookDX = In.lookDY = In.zoomD = 0;
    const o = ac.o, m = app.state === 'menu' ? 6 : view.mode, k = 0.0042;
    view.pad.yaw += (-In.padLookX * 1.7 - view.pad.yaw) * Math.min(1, dt * 8); view.pad.pitch += (-In.padLookY * 0.9 - view.pad.pitch) * Math.min(1, dt * 8);
    const fwd = tA.set(1, 0, 0).applyQuaternion(ac.q), fh = tB.set(fwd.x, 0, fwd.z).normalize();
    let near = 1, fov = 55;
    camera.up.set(0, 1, 0);
    if (m < 2) {
      view.look.yaw = clamp(view.look.yaw + dx * k, -2.7, 2.7); view.look.pitch = clamp(view.look.pitch + dy * k, -1.25, 1.1);
      view.fov = clamp(view.fov + zd * 0.35, 20, 88); fov = view.fov; near = 0.1;
      camera.position.set(-0.06, 0.5, m === 0 ? -0.27 : 0.27);
      if (FS.settings.shake) { const a = o.buffet * 0.006 + (ac.onGround ? clamp(o.gs / 60, 0, 1) * (o.surface === 'grass' ? 0.012 : 0.0025) : 0) + env.wx.turb * 0.002; camera.position.x += (vnoise(env.t * 23, 1) - 0.5) * a; camera.position.y += (vnoise(env.t * 27, 5) - 0.5) * a * 2; }
      camera.position.applyQuaternion(ac.q).add(ac.pos);
      qA.setFromAxisAngle(UP, view.look.yaw + view.pad.yaw); qB.setFromAxisAngle(ZA, view.look.pitch + view.pad.pitch);
      camera.quaternion.copy(ac.q).multiply(qA).multiply(qB).multiply(QBASE);
    } else if (m === 2) {
      const c = view.chase; c.yaw += dx * k; c.pitch = clamp(c.pitch + dy * k, -0.2, 1.3); c.dist = clamp(c.dist + zd * 0.3, 6, 80);
      const a = Math.atan2(fh.z, fh.x) + c.yaw + view.pad.yaw;
      tC.set(ac.pos.x - Math.cos(a) * c.dist * Math.cos(c.pitch), ac.pos.y + 1.2 + c.dist * Math.sin(c.pitch), ac.pos.z - Math.sin(a) * c.dist * Math.cos(c.pitch));
      if (!view.cinit) { view.cpos.copy(tC); view.cinit = true; } else view.cpos.lerp(tC, Math.min(1, dt * 7));
      view.cpos.y = Math.max(view.cpos.y, FS.groundH(view.cpos.x, view.cpos.z) + 0.5);
      camera.position.copy(view.cpos); camera.lookAt(tC.copy(ac.pos).addScaledVector(fwd, 2.5).setY(ac.pos.y + 0.6)); fov = 58;
    } else if (m === 3) {
      camera.position.set(-1.25, 0.25, -1.75).applyQuaternion(ac.q).add(ac.pos); camera.up.set(0, 1, 0).applyQuaternion(ac.q);
      camera.lookAt(tC.set(8, -0.9, -5.5).applyQuaternion(ac.q).add(ac.pos)); fov = 72; near = 0.2;
    } else if (m === 4) {
      camera.position.set(AD.TOWER[0], 29.6 - AD.SLOPE * AD.TOWER[0], AD.TOWER[1] + 8); camera.lookAt(ac.pos);
      fov = clamp(2 * Math.atan(9 / camera.position.distanceTo(ac.pos)) / DEG, 1.6, 55); near = 3;
    } else if (m === 5) {
      const f = view.fly, d = f.pos.distanceTo(ac.pos);
      if (!f.ok || d > 520) {
        const sp = Math.max(ac.vel.length(), 8); tC.copy(ac.vel); if (tC.lengthSq() < 4) tC.copy(fwd); tC.normalize();
        f.pos.copy(ac.pos).addScaledVector(tC, sp * 3.2 + 35); f.pos.x += -tC.z * 22; f.pos.z += tC.x * 22;
        f.pos.y = Math.max(FS.groundH(f.pos.x, f.pos.z) + 1.7, ac.pos.y - 6 + ac.vel.y * 3); f.ok = true;
      }
      camera.position.copy(f.pos); camera.lookAt(ac.pos); fov = clamp(2 * Math.atan(11 / Math.max(d, 8)) / DEG, 7, 50);
    } else if (m === 6) {
      const c = view.orbit;
      if (app.state === 'menu') { c.yaw += dt * 0.07; c.pitch = 0.14; c.dist = 15; } else { c.yaw += dx * k; c.pitch = clamp(c.pitch + dy * k, -0.3, 1.45); c.dist = clamp(c.dist + zd * 0.3, 5, 400); }
      camera.position.set(ac.pos.x + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist, ac.pos.y + Math.sin(c.pitch) * c.dist + 0.3, ac.pos.z + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist);
      camera.position.y = Math.max(camera.position.y, FS.groundH(camera.position.x, camera.position.z) + 0.4);
      camera.lookAt(tC.copy(ac.pos).setY(ac.pos.y + 0.2)); fov = app.state === 'menu' ? 42 : 55;
    } else {
      view.top.h = clamp(view.top.h + zd * 3, 40, 2500);
      camera.position.set(ac.pos.x, ac.pos.y + view.top.h, ac.pos.z); camera.up.copy(fh); camera.lookAt(ac.pos); fov = 50; near = 5;
    }
    if (camera.fov !== fov || camera.near !== near) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
    // keep the aircraft clear of the menu panel
    const mEl = app.state === 'menu' ? $('menu').offsetWidth : 0, mw = mEl && innerWidth > mEl + 220 ? mEl : 0;
    if (mw !== app.vo) { app.vo = mw; if (mw) camera.setViewOffset(innerWidth, innerHeight, -mw / 2, 0, innerWidth, innerHeight); else camera.clearViewOffset(); }
    FS.World.pxScale = renderer.domElement.height / (2 * Math.tan(fov * DEG / 2));
  }

  /* ---------- loop ---------- */
  const zero = new V3();
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); last = t; app.frame++;
    const flying = app.state === 'fly', run = !app.paused;
    In.update(dt, !flying || app.paused);
    if (run) {
      env.update(dt);
      const n = clamp(Math.round(dt * 240), 1, 14), h = dt / n;
      for (let i = 0; i < n; i++) ac.step(h);
      ac.derive(dt);
      if (flying) {
        FS.Metrics.update(dt); FS.ATC.update(dt); FS.Lessons.update(dt);
        if (app.crashT > 0) { app.crashT -= dt; if (app.crashT <= 0) { FS.Lessons.finished = true; FS.UI.coach(); FS.UI.debrief({ title: 'Flight ended', sub: app.crashReason, rows: [['What happened', '', null, app.crashReason], ['What to do', '', null, 'Every pilot makes mistakes in the simulator: that is what it is for. Reset and fly it again, a little slower and a little earlier with each correction.']], score: 0, crash: true, again: () => app.reset() }); } }
      }
    }
    if (!run) env.updateLight();
    updateCamera(run ? dt : 0.0001);
    const L = env.L, interior = flying && view.interior();
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGnd); hemi.intensity = L.hemiI;
    sun.color.copy(L.sunCol); sun.intensity = L.dirI + env.flash * 0.8;
    sun.position.copy(ac.pos).addScaledVector(L.lightDir, 130); sun.target.position.copy(ac.pos);
    if (Q.shadows) sun.castShadow = L.dirI > 0.12 && L.lightDir.y > 0.07;
    const night = Math.max(L.nightF, 0.6 * (1 - L.dayF));
    for (const p of apronLt) p.intensity = night * 0.85;
    M.update(ac, dt, interior, !Q.shadows || !sun.castShadow);
    FS.World.update(run ? dt : 0, camera, run ? ac.vel : zero); FS.Airport.update(dt, camera.position);
    if (interior) {
      if (!Q.low || app.frame % 2 === 0) FS.Panel.draw(ac, env.t);
      if (app.frame % 6 === 0) FS.Panel.drawCompass(M.compassCv, M.compassTex, ac.inst.compass);
      const lit = ac.elec.bus ? 0.2 + 0.8 * ac.elec.panelLt : 0.1;
      M.panelMat.color.setScalar(lerp(lit, 1, clamp(L.dayF * (1 - 0.35 * sstep(0.6, 1, env.wx.cover)) + 0.0, 0, 1)));
      M.compassFace.material.color.copy(M.panelMat.color);
    }
    FS.Audio.update(ac, dt, interior || app.state === 'menu', app.paused || app.state === 'menu');
    FS.UI.update(dt, flying && !app.paused, interior);
    renderer.render(scene, camera);
  }
  FS.debug = { get scene() { return scene; }, get renderer() { return renderer; } }; window.__FS = FS;
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
})();
