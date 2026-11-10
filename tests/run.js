const { chromium } = require('playwright');
const fs = require('fs');
const three = fs.readFileSync('node_modules/three/build/three.min.js','utf8');
(async()=>{
  const steps = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const W = +(process.argv[3]||1280), H = +(process.argv[4]||720), touch = process.argv[5]==='touch';
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  const ctx = await b.newContext({viewport:{width:W,height:H}, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch?2:1});
  const p = await ctx.newPage();
  const seen = new Set();
  p.on('console', m => { const t=m.text(); if ((m.type()==='error' || m.type()==='warning') && !/GL Driver|GPU stall|ReadPixels/.test(t) && !seen.has(t)) { seen.add(t); console.log('[console.'+m.type()+']', t.slice(0,500)); } });
  p.on('pageerror', e => { const k=e.message; if(!seen.has(k)){seen.add(k); console.log('[pageerror]', e.message, (e.stack||'').split('\n').slice(1,4).join(' | '));} });
  await p.route('**/three.min.js', r => r.fulfill({body: three, contentType:'application/javascript'}));
  await p.route('**/fonts.googleapis.com/**', r => r.abort()); await p.route('**/fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'), null, {timeout: 120000});
  for (const s of steps) {
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined && r !== null) console.log('  eval:', typeof r==='string'? r : JSON.stringify(r)); }
    if (s.key) await p.keyboard.press(s.key);
    if (s.down) await p.keyboard.down(s.down);
    if (s.up) await p.keyboard.up(s.up);
    if (s.click) await p.click(s.click);
    if (s.mouse) await p.mouse.click(s.mouse[0], s.mouse[1]);
    if (s.shot) { await p.screenshot({path:'shots/'+s.shot+'.png'}); console.log('shot', s.shot); }
  }
  await b.close();
})();
