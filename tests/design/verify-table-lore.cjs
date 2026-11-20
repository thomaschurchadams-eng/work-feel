// Isolated reader journeys. First-party pages are read only. No game or GA requests leave this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async (browser, base, out, axePath) => {
  const cases = [
    ['home','/'],
    ['article','/news/corda-appli-calculator-rate-updates.html'],
    ['legacy','/news/veridian-greenlight-family-finance-app.html'],
    ['insight','/insight-ai-already-in-use.html']
  ];
  const rows = [];
  for (const [name, route] of cases) for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
    const gameRequests = [], errors = [];
    const origin = new URL(base).origin, gameOrigin = 'https://pineview-table-lore.vercel.app';
    try {
      await context.addInitScript(()=>{window.CUAIInternalTraffic=true});
      await context.route('**/*', r => {
        const req=r.request(), url=new URL(req.url());
        if (url.origin===origin && req.method()==='GET') return r.continue();
        if (url.origin===gameOrigin) {gameRequests.push(req.url()); if(req.isNavigationRequest()) return r.fulfill({status:200,contentType:'text/html',body:'<p>Isolated navigation receipt</p>'});}
        return r.abort();
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-11-29T22:00:00-05:00'));
      const response=await page.goto(base+route);assert.equal(response.status(),200);
      const card=page.locator('[data-table-lore]');await card.waitFor({state:'visible'});assert.equal(await card.count(),1);
      const placement=name==='home'?'homepage_card':'article_end_card';
      const href=gameOrigin+'/?utm_source=cuai&utm_medium=owned&utm_campaign=thanksgiving_2026&utm_content='+placement;
      assert.equal(await card.getAttribute('data-table-lore'),placement);
      assert.equal(await card.locator('h2').innerText(),'Who packed a toaster for a camping trip?');
      assert.equal(await card.locator('.tl-reveal').isVisible(),false);
      assert.ok(await card.evaluate((el,home)=>{
        const before=(a,b)=>!!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));
        const anchor=document.querySelector(home?'.latest-alert-section':'main .article-body');
        const next=anchor?.nextElementSibling;
        return (next===el || (next?.matches('.institute-banner[data-cai-banner-placement="contextual_followup"]')&&next.nextElementSibling===el))
          && before(el,document.querySelector('.cuai-house-campaign'))&&before(el,document.querySelector('footer.footer'))
          &&(!home||before(el,document.querySelector('.home-news-grid')));
      },name==='home'));
      await card.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-64));
      if(width===390&&['home','article'].includes(name)) await page.screenshot({path:path.join(out,'table-lore-'+name+'-390-before.png'),animations:'disabled'});
      const guess=width===390?'Uncle Pat':'Aunt Maya';
      await card.getByRole('button',{name:guess,exact:true}).click();
      assert.equal(await card.locator('.tl-story').innerText(),'It was Uncle Pat. He even remembered the extension cord. The nearest socket was five miles away.');
      assert.equal(await card.locator('.tl-price').innerText(),'First round free. Then $12 once for the whole table.');
      assert.equal(await card.locator('.tl-answers button:disabled').count(),3);
      const host=card.getByRole('link',{name:'Make a game for my Thanksgiving table',exact:true});
      assert.equal(await host.getAttribute('href'),href);assert.ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth&&document.documentElement.scrollWidth<=innerWidth));
      if(width===390&&['home','article'].includes(name)) await page.screenshot({path:path.join(out,'table-lore-'+name+'-390-after.png'),animations:'disabled'});
      await card.getByRole('button',{name:'Copy link for later'}).click();
      await card.getByText('Link copied.',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),href);
      assert.deepEqual(gameRequests,[]);
      await page.addScriptTag({path:axePath});
      const violations=await page.evaluate(async()=>(await axe.run(document.querySelector('[data-table-lore]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);
      await page.clock.setFixedTime(new Date('2026-11-30T00:00:00-05:00'));
      await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
      await card.getByRole('link',{name:'Make a game for my table',exact:true}).click();
      await page.waitForURL(href);assert.deepEqual(gameRequests,[href]);assert.deepEqual(errors,[]);
      rows.push({route,width,placement,guess,preClickGameRequests:0,clipboardExact:true,publicDestination:href,seasonalSwitchAtEasternMidnight:true,axeViolations:0});
    } finally {await context.close();}
  }
  fs.writeFileSync(path.join(out,'table-lore-journeys.json'),JSON.stringify(rows,null,2));
  console.log('Table Lore: '+rows.length+' reader journeys passed; mobile screenshots saved.');
};
