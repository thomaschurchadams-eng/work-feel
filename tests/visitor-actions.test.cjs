const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('contact form prepares the correct email and preserves inquiry content without claiming delivery',()=>{
 const html=fs.readFileSync('contact.html','utf8');
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("getElementById('inquiry-form')"));
 assert.ok(script);let submit;const window={location:{href:''}};
 const values={name:'Sample Reader',email:'reader@example.invalid',organization:'Fictional CU','job-title':'Example role','inquiry-type':'General inquiry',message:'Fictional test inquiry'};
 vm.runInNewContext(script,{window,document:{getElementById:id=>{assert.equal(id,'inquiry-form');return{addEventListener:(event,cb)=>{assert.equal(event,'submit');submit=cb}}}},FormData:class{get(key){return values[key]}}});
 let prevented=false;submit({preventDefault(){prevented=true},currentTarget:{}});
 const url=new URL(window.location.href);assert.equal(prevented,true);assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'info@creditunionainews.com');assert.equal(url.searchParams.get('subject'),'CreditUnionAI News inquiry: General inquiry');
 for(const value of Object.values(values))assert.ok(url.searchParams.get('body').includes(value));
 assert.match(html,/>Open email to send inquiry<\/button>/);assert.doesNotMatch(html,/We review inquiries before responding|Reviewed before response|Message sent successfully/);
});
test('saved-request download keeps commas, quotes and newlines under three honest CSV columns',()=>{
 const app=fs.readFileSync('assets/app.js','utf8'),source=app.slice(app.indexOf('  if (exportSignupsBtn)'),app.indexOf('  if (clearSignupsBtn)'));
 const entries=[{email:'reader@example.invalid',firstName:'Example, "Reader"\nSecond line',timestamp:'Nov 3, 2026, 12:00'}],before=JSON.stringify(entries);
 let click,bytes='',clicked=false,revoked=false;const link={click(){clicked=true}};
 vm.runInNewContext(source,{exportSignupsBtn:{addEventListener:(event,cb)=>{assert.equal(event,'click');click=cb}},loadSignups:()=>entries,Blob:class{constructor(parts){bytes=parts.join('')}},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{revoked=true}},document:{createElement:()=>link}});
 click();assert.equal(link.download,'creditunionai-saved-email-requests.csv');assert.equal(bytes,'Email,First Name,Saved At\n"reader@example.invalid","Example, ""Reader""\nSecond line","Nov 3, 2026, 12:00"');
 assert.equal(JSON.stringify(entries),before);assert.equal(clicked,true);assert.equal(revoked,true);
});
