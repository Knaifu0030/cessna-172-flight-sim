const { chromium } = require('playwright');
const fs = require('fs');
const three = fs.readFileSync('node_modules/three/build/three.min.js','utf8');
(async()=>{
  const script = fs.readFileSync(process.argv[2],'utf8');
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
  p.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack||'').split('\n').slice(1,4).join(' | ')));
  p.on('console', m => { if (m.type()==='log') console.log(m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({body: three, contentType:'application/javascript'}));
  await p.route('**/fonts.googleapis.com/**', r => r.abort()); await p.route('**/fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'), null, {timeout: 120000});
  await p.evaluate(fs.readFileSync('tests/harness.js','utf8'));
  const blocks = script.split('\n//---\n');
  for (const blk of blocks) {
    const m = blk.match(/^\/\/shot (\S+)/m);
    const r = await p.evaluate('(async()=>{' + blk + '})()');
    if (r !== undefined && r !== null) console.log(r);
    if (m) { await p.waitForTimeout(1600); await p.screenshot({path:'shots/'+m[1]+'.png'}); console.log('shot', m[1]); }
  }
  await b.close();
})();
