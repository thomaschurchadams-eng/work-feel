const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const css=fs.readFileSync('assets/styles.css','utf8');
function stickySelectors(source){
  return [...source.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, ,body])=>/\bposition\s*:\s*(?:-webkit-)?sticky\b/i.test(body))
    .flatMap(([,selector])=>selector.split(',').map(s=>s.trim()));
}
test('sticky chrome is scoped to site navigation, never a semantic article header',()=>{
  assert.deepEqual(stickySelectors(css),['.site-header']);
  assert.doesNotMatch(css,/(?:^|[{}])\s*header\s*\{/m);
  // The original selector is rejected even though both elements use <header>.
  const oldRule='header { position: sticky; top: 0; z-index: 20; }';
  assert.notDeepEqual(stickySelectors(oldRule),['.site-header']);
});
test('public and article-template headers keep distinct navigation/content identities',()=>{
  const files=execFileSync('git',['ls-files','*.html'],{encoding:'utf8'}).trim().split('\n')
    .filter(f=>!f.startsWith('.')&&!/^(automation|drafts|review|tests)\//.test(f));
  let articleHeaders=0;
  for(const file of files){
    const html=fs.readFileSync(file,'utf8'),mainAt=html.search(/<main\b/);
    for(const match of html.matchAll(/<header\b([^>]*)>/g)){
      const site=/\bclass=["'][^"']*\bsite-header\b/.test(match[1]);
      if(mainAt<0||match.index<mainAt)assert.ok(site,file+' navigation header lacks site-header');
      else {assert.equal(site,false,file+' content header marked as sticky navigation');articleHeaders++;}
    }
  }
  assert.ok(articleHeaders>0,'Exercise actual nested article-header markup');
});
