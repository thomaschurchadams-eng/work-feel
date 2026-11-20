const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const manifest = require('../automation/analytics-measurement.json').events;

// Exercise the actual component and the actual publisher telemetry gate with no external client.
function fixture({home=true, hostname='creditunionainews.com', webdriver=false, internal=false,
  storedInternal=false, copyFails=false, now='2026-11-29T23:59:59-05:00'}={}) {
  const events=[], handlers={}, nodes={}, choices=[], written=[];
  let attached, intersect, timer, next=Date.parse(now);
  const mk=()=>({dataset:{},classList:{add(){}},addEventListener(k,v){this[k]=v},setAttribute(){},focus(){this.focused=true},select(){this.selected=true}});
  for(let i=0;i<3;i++)choices.push(mk());
  const card={...mk(),querySelector:s=>nodes[s]??=(mk()),querySelectorAll:()=>choices};
  const anchor={after(el){attached=el}};
  const doc={visibilityState:'visible',body:{classList:{contains:s=>s===(home?'page-home':'page-article')}},
    querySelector:s=>s==='[data-table-lore]'?attached:anchor,createElement:()=>card,
    addEventListener(k,v){(handlers[k]??=[]).push(v)},removeEventListener(k,v){handlers[k]=handlers[k].filter(x=>x!==v)}};
  const sandbox={document:doc,pagePath:home?'/':'/news/test.html',window:{location:{hostname}, CUAIInternalTraffic:internal,
    localStorage:{getItem:()=>storedInternal?'true':null},gtag:(...x)=>events.push(x),setTimeout:f=>timer=f},
    navigator:{webdriver,clipboard:{async writeText(s){if(copyFails)throw Error('denied');written.push(s)}}},
    Date:class extends Date {static now(){return next}},IntersectionObserver:class{constructor(f){intersect=f}observe(){}disconnect(){}}};
  const component=app.slice(app.indexOf('  function renderTableLore('),app.indexOf('  // Privacy-safe publication analytics.'));
  const sender=app.slice(app.indexOf('    const sendEvent = '),app.indexOf('    const body = document.body;',app.indexOf('    const sendEvent = ')));
  vm.runInNewContext(component+'\n'+sender+'\nrenderTableLore(sendEvent);renderTableLore(sendEvent);',sandbox);
  return {events,choices,card,nodes,written,doc,view(r=.5){intersect([{target:nodes['.tl-card'],isIntersecting:r>0,intersectionRatio:r}])},
    show(){doc.visibilityState='visible';handlers.visibilitychange.forEach(f=>f())},
    crossMidnight(){next=Date.parse('2026-11-30T00:00:00-05:00');timer()}};
}
for(const home of [true,false])test('Table Lore renders one placement, counts only visible views and first response: '+(home?'homepage':'article'),async()=>{
  const f=fixture({home}),surface=home?'home':'article',placement=home?'homepage_card':'article_end_card';
  const expected='https://pineview-table-lore.vercel.app/?view=host&utm_source=cuai&utm_medium=owned&utm_campaign=thanksgiving_2026&utm_content='+placement;
  assert.equal(f.card.dataset.tableLore,placement);
  assert.equal(f.nodes['.tl-host'].href,expected);
  assert.equal(f.nodes['.tl-host'].textContent,'Make a game for my Thanksgiving table');
  f.view(.49); f.doc.visibilityState='hidden';f.view(.51);assert.equal(f.events.length,0);f.show();f.view();
  f.choices[0].click();f.choices[2].click();f.nodes['.tl-host'].click();await f.nodes['.tl-copy'].click();
  assert.deepEqual(f.written,[expected]);assert.equal(f.nodes['.tl-reveal'].hidden,false);assert.ok(f.choices.every(x=>x.disabled));
  const names=['view','first_guess','host_cta','copy_link'].map(a=>'cuai_table_lore_'+a+'_'+surface);
  assert.deepEqual(f.events.map(e=>e[1]),names);for(const [_,name,params]of f.events){assert.ok(manifest[name]);assert.deepEqual({...params},{campaign_id:'thanksgiving_2026',placement,variant:'v1',measurement_version:'publication-v2'})}
  f.crossMidnight();assert.equal(f.nodes['.tl-host'].textContent,'Make a game for my table');
});
test('Table Lore excludes internal, automation, loopback and preview traffic; denied clipboard never counts',async()=>{
  for(const config of [{webdriver:true},{internal:true},{storedInternal:true},{hostname:'localhost'},{hostname:'work-feel-preview.vercel.app'}]){
    const f=fixture(config);f.view();f.choices[0].click();f.nodes['.tl-host'].click();await f.nodes['.tl-copy'].click();assert.equal(f.events.length,0);
  }
  const f=fixture({copyFails:true}); f.choices[1].click();await f.nodes['.tl-copy'].click();
  assert.equal(f.nodes['.tl-manual'].value,f.nodes['.tl-host'].href);assert.equal(f.nodes['.tl-manual'].selected,true);
  assert.equal(f.events.some(e=>e[1].includes('copy_link')),false);
});
test('published news/insight article shells and templates have both the placement anchor and common game runtime',()=>{
  const dirs=[...fs.readdirSync(path.join(root,'news')).filter(f=>f.endsWith('.html')).map(f=>'news/'+f),...fs.readdirSync(root).filter(f=>/^insight-.+\.html$/.test(f)),'templates/news-article.html','templates/insight-article.html'];
  for(const name of dirs){const html=fs.readFileSync(path.join(root,name),'utf8');assert.match(html,/class=["'][^"']*\barticle-body\b/,name);assert.match(html,/<script[^>]*src=["'][^"']*assets\/(?:app|site)\.js/,name)}
  assert.match(fs.readFileSync(path.join(root,'assets/site.js'),'utf8'),/script.src = '\/assets\/app\.js'/);
});
