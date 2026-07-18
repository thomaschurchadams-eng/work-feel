import fs from 'node:fs';

const files=process.argv.slice(2);
if(!files.length){console.error('Usage: node scripts/validate-news-package.mjs news/article.html');process.exit(1);}
let failed=false;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  const checks={
    doctype:/<!DOCTYPE html>/i.test(html),
    title:/<title>[^<]{12,}<\/title>/i.test(html),
    description:/<meta name="description" content="[^"]{50,160}"/i.test(html),
    canonical:/<link rel="canonical" href="https:\/\/creditunionainews\.com\/news\/[^"]+"/i.test(html),
    ogTitle:/<meta property="og:title"/i.test(html),
    publishedDate:/<time[^>]*datetime="\d{4}-\d{2}-\d{2}"/i.test(html)||/class="article-date"[^>]*>[^<]*\d{4}/i.test(html),
    byline:/CreditUnionAI News Staff/i.test(html),
    sourceLink:/href="https:\/\//i.test(html),
    articleBody:/class="article-body"/i.test(html),
    noPlaceholders:!/(Headline|summary|tags here|full article text)/i.test(html)
  };
  const errors=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  if(errors.length){failed=true;console.error(`${file}: FAIL ${errors.join(', ')}`);}else console.log(`${file}: PASS`);
}
process.exit(failed?1:0);
