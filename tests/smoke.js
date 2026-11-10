const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']});
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? {width: 844, height: 390} : {width: 1280, height: 720}, hasTouch: mobile, isMobile: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(process.env.TEST_URL || pathToFileURL(path.resolve('dist/index.html')).href);
      if (response) assert(response.ok(), 'Page must load successfully');
      await page.waitForFunction(() => window.__FS && document.getElementById('loading').classList.contains('done'), null, {timeout: 120000});
      assert(await page.locator('#bStart').isVisible());
      await page.locator('#bStart').click();
      await page.waitForFunction(() => window.__FS.app.state === 'fly');
      await page.waitForFunction(() => window.__FS.debug.renderer.info.render.calls > 0);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__FS.app.paused);
      await page.locator('#bResume').click();
      await page.waitForFunction(() => !window.__FS.app.paused);
      const result = await page.evaluate(() => {
        const F = window.__FS;
        F.app.setPaused(true);
        const lessons = F.Lessons.list.map(l => l.id);
        for (const id of lessons) { F.app.startLesson(id); if (F.Lessons.cur.id !== id) throw new Error('Lesson failed: '+id); }
        F.app.setPaused(true);
        return {state: F.app.state, lessons, drawCalls: F.debug.renderer.info.render.calls, finitePosition: Number.isFinite(F.ac.pos.x) && Number.isFinite(F.ac.pos.y), touch: document.body.classList.contains('touch')};
      });
      assert(result.finitePosition);
      assert(result.drawCalls > 0);
      if (mobile) assert(result.touch);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({mode: mobile ? 'mobile landscape' : 'desktop', status: 'PASS', ...result}));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
