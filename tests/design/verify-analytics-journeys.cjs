const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verifyAnalyticsJourneys(browser,base,out,axePath){
 const results=[];
 for(const width of [320,390,1440])for(const slug of ['psecu-gemini-member-guidance','plaid-ai-cash-flow-underwriting']){
  const context=await browser.newContext({viewport:{width,height:width<700?844:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(base).origin){external.push(u.hostname);return r.abort();}if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return r.continue();});
  page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto(base+'/news/'+slug+'.html');assert.equal(response.status(),200);
   assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('h1').count(),1);
   const opening=await page.locator('.article-summary').innerText();assert.ok(opening.length<180&&opening.length>60);
   const before=await page.evaluate(()=>({headlineTop:document.querySelector('h1').getBoundingClientRect().top,summaryTop:document.querySelector('.article-summary').getBoundingClientRect().top,bannerHeight:document.querySelector('.institute-banner').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(before.overflow,false);if(width<700){assert.ok(before.bannerHeight<300,JSON.stringify(before));assert.ok(before.headlineTop<620,JSON.stringify(before));}
   await page.locator('.article-reading-link a').click();const questions=page.locator('#pilot-questions');assert.equal(await questions.isVisible(),true);assert.equal(await page.locator('.article-next-step ol li').count(),3);
   const destinations=await page.locator('.article-next-step a').evaluateAll(a=>a.map(x=>new URL(x.href).pathname));for(const dest of destinations)assert.equal((await context.request.get(base+dest)).status(),200,dest);
   const top=await questions.evaluate(e=>e.getBoundingClientRect().top);assert.ok(top>=0&&top<500,'Jump should reveal the pilot questions below navigation');
   assert.match(await page.locator('.institute-banner-kicker').first().innerText(),/Sponsored · Cooperative AI Institute/i);
   await page.addScriptTag({path:axePath});const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[]);
   assert.deepEqual(errors,[]);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,slug+'-'+width+'.png'),fullPage:true});await page.screenshot({path:path.join(out,slug+'-opening-'+width+'.png')});
   const emitted=await page.evaluate(()=>Array.from(window.dataLayer||[]).filter(x=>x[0]==='event'));assert.equal(emitted.length,0,'Loopback QA must not become publication demand');
   results.push({slug,width,opening,...before,jumpToQuestions:true,relatedDestinations:destinations,violations,errors,publicationEventsSuppressed:true,externalRequestsBlocked:[...new Set(external)]});console.log(`Approved article journey ${slug} ${width}: PASS`);
  }finally{await context.close();}
 }
 for(const width of [390,1440]){
  const c=await browser.newContext({viewport:{width,height:844}}),p=await c.newPage();try{await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await p.goto(base+'/newsletter.html');assert.match(await p.locator('.newsletter-request-note').innerText(),/signup.*(?:not available|unavailable)|(?:not available|unavailable).*signup/i);assert.equal(await p.locator('#newsletter-form').count(),0);const link=p.locator('.newsletter-subscribe-action');assert.match(await link.getAttribute('href'),/^mailto:info@creditunionainews.com/);assert.equal(await p.locator('body').innerText().then(t=>/Thanks for subscribing|Subscription confirmed/.test(t)),false);results.push({route:'/newsletter.html',width,emailRequestOnly:true,providerConfirmationConnected:false});}finally{await c.close();}
 }
 for(const width of [390,1440]){
  const c=await browser.newContext({viewport:{width,height:844}}),p=await c.newPage();
  try{
   await c.addInitScript(()=>{window.CUAIInternalTraffic=true;localStorage.setItem('cuai_newsletter_signups',JSON.stringify([{email:'reader@example.invalid',firstName:'Example, \"Reader\"',timestamp:'Nov 3, 2026, 12:00'}]));});
   await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
   const logResponse=await p.goto(base+'/newsletter-log.html');
   if(new URL(p.url()).pathname==='/newsletter.html'){
    // Production intentionally redirects this legacy browser-only utility.
    // Verify the real route contract; do not expose it or pretend a CSV UI ran.
    const rule=JSON.parse(fs.readFileSync(path.join(__dirname,'../../vercel.json'),'utf8')).redirects.find(r=>r.source==='/newsletter-log.html');
    assert.equal(rule?.destination,'/newsletter.html');assert.equal(rule.permanent,true);assert.equal(logResponse.status(),200);
    const previous=logResponse.request().redirectedFrom();assert.ok(previous);assert.equal(new URL(previous.url()).pathname,'/newsletter-log.html');
    assert.ok([301,308].includes((await previous.response()).status()));
    assert.equal(await p.locator('.newsletter-hero h1').count(),1);assert.equal(await p.locator('#newsletter-form').count(),0);assert.equal(await p.locator('#signup-table-body').count(),0);
    results.push({route:'/newsletter-log.html',width,redirectedTo:'/newsletter.html',legacyLogExposed:false,fixtureDownloadExercised:false});
    continue;
   }
   assert.match(await p.locator('main').innerText(),/not confirmed subscriptions/);
   assert.doesNotMatch(await p.locator('table').innerText(),/Subscribed At/);
   const downloadPromise=p.waitForEvent('download');await p.locator('#export-signups').click();const download=await downloadPromise;
   assert.equal(download.suggestedFilename(),'creditunionai-saved-email-requests.csv');
   const file=path.join(out,`saved-email-requests-${width}.csv`);await download.saveAs(file);const csv=fs.readFileSync(file,'utf8');
   assert.equal(csv.split('\n')[0],'Email,First Name,Saved At');assert.equal(csv.split('\n')[1],'"reader@example.invalid","Example, ""Reader""","Nov 3, 2026, 12:00"');assert.doesNotMatch(csv,/Subscribed/);
   await p.screenshot({path:path.join(out,`saved-email-requests-${width}.png`)});
   results.push({route:'/newsletter-log.html',width,fixtureOnly:true,savedRequestNotSubscription:true,exportFilename:download.suggestedFilename(),exportHeader:csv.split('\n')[0]});
  }finally{await c.close();}
 }
 fs.writeFileSync(path.join(out,'analytics-journeys.json'),JSON.stringify(results,null,2)+'\n');
};
