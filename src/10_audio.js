/* ============================================================
   Synthesised audio (Web Audio only, no sample files)
   ============================================================ */
(function () {
  const Au = FS.Audio = { ctx: null, ready: false, n: {} };
  Au.init = () => {
    if (Au.ctx) { if (Au.ctx.state === 'suspended') Au.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let ctx;
    try { ctx = Au.ctx = new AC(); } catch (e) { return; }
    const n = Au.n;
    n.master = ctx.createGain(); n.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    n.master.connect(comp); comp.connect(ctx.destination);
    // shared noise
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = w * 0.6 + last * 0.6; }
    Au.noiseBuf = buf;
    const noise = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(n.master); s.start(); return { f, g }; };
    const osc = (type, freq, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(dest); o.start(); return o; };
    // engine
    n.engF = ctx.createBiquadFilter(); n.engF.type = 'lowpass'; n.engF.frequency.value = 400; n.engF.Q.value = 0.8;
    n.engG = ctx.createGain(); n.engG.gain.value = 0; n.engF.connect(n.engG); n.engG.connect(n.master);
    const mix = (g) => { const x = ctx.createGain(); x.gain.value = g; x.connect(n.engF); return x; };
    n.e1 = osc('sawtooth', 40, mix(0.5)); n.e2 = osc('square', 20, mix(0.28)); n.e3 = osc('sawtooth', 60, mix(0.2)); n.e4 = osc('triangle', 80, mix(0.25));
    n.exh = noise('bandpass', 500, 0.6);
    n.wind = noise('bandpass', 700, 0.5); n.roll = noise('lowpass', 110, 0.8); n.rain = noise('highpass', 3200, 0.5);
    // stall horn
    n.hornG = ctx.createGain(); n.hornG.gain.value = 0; n.hornG.connect(n.master);
    n.horn = osc('square', 1950, n.hornG); const hf = osc('sine', 9, (() => { const g = ctx.createGain(); g.gain.value = 60; g.connect(n.horn.frequency); return g; })());
    // flap motor, starter, fuel pump
    n.flapG = ctx.createGain(); n.flapG.gain.value = 0; n.flapG.connect(n.master); osc('sawtooth', 210, n.flapG); osc('square', 318, n.flapG);
    n.startG = ctx.createGain(); n.startG.gain.value = 0; n.startG.connect(n.master); n.startO = osc('sawtooth', 62, n.startG);
    n.pumpG = ctx.createGain(); n.pumpG.gain.value = 0; n.pumpG.connect(n.master); osc('square', 118, n.pumpG);
    Au.ready = true;
  };
  const set = (param, v, tc) => { param.setTargetAtTime(v, Au.ctx.currentTime, tc || 0.05); };
  const burst = (dur, type, freq, gain, delay, q) => {
    if (!Au.ready) return;
    const ctx = Au.ctx, s = ctx.createBufferSource(); s.buffer = Au.noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8;
    const g = ctx.createGain(), t0 = ctx.currentTime + (delay || 0); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(Au.n.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
    return f;
  };
  Au.click = () => burst(0.035, 'highpass', 2400, 0.25);
  Au.chirp = (k) => { burst(0.16, 'bandpass', 1700, 0.35 * k, 0, 3); burst(0.3, 'lowpass', 160, 0.5 * k); };
  Au.crash = () => { burst(1.4, 'lowpass', 300, 1.2); burst(0.5, 'bandpass', 900, 0.7); };
  Au.thunder = (delay) => { const f = burst(4.5, 'lowpass', 150, 1.1, delay, 0.5); if (f) f.frequency.exponentialRampToValueAtTime(50, Au.ctx.currentTime + delay + 4); burst(0.5, 'lowpass', 700, 0.5, delay); };

  let flapPrev = 0;
  Au.update = (ac, dt, interior, paused) => {
    if (!Au.ready) return;
    const n = Au.n, e = ac.eng, o = ac.o, env = FS.env;
    set(n.master.gain, paused ? 0 : FS.settings.volume, 0.15);
    const f = Math.max(8, e.rpm / 60 * 2);
    for (const [os, k] of [[n.e1, 1], [n.e2, 0.5], [n.e3, 1.5], [n.e4, 2]]) set(os.frequency, f * k * (1 + 0.004 * Math.sin(env.t * 31)), 0.03);
    const run = e.running ? 1 : 0, pw = clamp(e.power, 0, 1), near = interior ? 1 : 0.8;
    set(n.engF.frequency, (interior ? 260 : 380) + (interior ? 900 : 1900) * pw + e.rpm * 0.12, 0.08);
    set(n.engG.gain, run * (0.12 + 0.42 * pw) * near + (e.crank > 0 ? 0.05 : 0), 0.08);
    set(n.exh.f.frequency, 300 + e.rpm * 0.35, 0.08); set(n.exh.g.gain, run * (0.04 + 0.3 * pw) * near, 0.1);
    const v = clamp(o.ias / 130, 0, 1.3);
    set(n.wind.f.frequency, 380 + o.ias * 9, 0.2); set(n.wind.g.gain, v * v * (interior ? 0.22 : 0.3), 0.2);
    set(n.roll.g.gain, ac.onGround ? clamp(o.gs / 60, 0, 1) * (o.surface === 'grass' ? 0.9 : 0.5) : 0, 0.1);
    set(n.rain.g.gain, env.wx.rain * (interior ? 0.16 : 0.1) * (FS.World.inCloud > 0.5 ? 0.4 : 1), 0.4);
    set(n.hornG.gain, o.stallWarn && ac.elec.bus !== undefined ? 0.07 : 0, 0.03);
    const moving = Math.abs(ac.surf.flap - flapPrev) > 1e-5; flapPrev = ac.surf.flap;
    set(n.flapG.gain, moving ? 0.018 : 0, 0.05);
    set(n.startG.gain, e.crank > 0 && ac.elec.bus ? 0.12 * (0.6 + 0.4 * Math.sin(env.t * 40)) : 0, 0.02); set(n.startO.frequency, 55 + e.rpm * 0.12, 0.05);
    set(n.pumpG.gain, ac.elec.pump && ac.elec.bus ? 0.008 : 0, 0.05);
  };
})();
