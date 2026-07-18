#!/usr/bin/env node
import fs from "node:fs";

const config=JSON.parse(fs.readFileSync("automation/topic-hubs.json","utf8"));
const checkOnly=process.argv.includes("--check");
const required=["id","type","label","description","function","technology","articles"];
let failed=false;
const nav='<header><div class="container navbar"><a href="../index.html" class="brand"><img src="../assets/download.png" alt="CreditUnionAI News logo" class="brand-logo"></a><div class="nav-toggle" aria-label="Toggle navigation" role="button" tabindex="0"><span></span><span></span><span></span></div><nav class="nav-links"><a href="../index.html">Home</a><a href="/alerts/">AI Newsroom Alerts</a><a href="../news.html">News</a><a href="../insights.html">Insights</a><a href="../topics.html">Topics</a><a href="../newsletter.html">Subscribe</a><a href="../about.html">About</a></nav></div></header>';
const footer='<footer class="footer"><div class="container" style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap"><div>© CreditUnionAI News</div><div class="footer-links"><a href="../news.html">News</a><a href="../insights.html">Insights</a><a href="../topics.html">Topics</a><a href="../newsletter.html">Subscribe</a></div></div></footer><script src="../assets/app.js"></script>';

function render(hub){
 const canonical=`${config.baseUrl}/topics/${hub.id}.html`;
 const items=hub.articles.map(article=>`<article class="card"><span class="label-tag">${hub.type==="function"?"Credit Union Function":"Technology"}</span><h2><a href="../${article.path}">${article.title}</a></h2><p>${article.summary}</p><a class="link" href="../${article.path}">Read coverage →</a></article>`).join("\n");
 const list=hub.articles.map((article,index)=>JSON.stringify({"@type":"ListItem",position:index+1,url:`${config.baseUrl}/${article.path}`,name:article.title}));
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage",name:hub.label,description:hub.description,url:canonical,mainEntity:{"@type":"ItemList",itemListElement:list.map(JSON.parse)}});
 return `<!DOCTYPE html><html lang="en"><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-RF6EFK06G5"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-RF6EFK06G5');</script><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${hub.label} | CreditUnionAI News</title><meta name="description" content="${hub.description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${hub.label}"><meta property="og:description" content="${hub.description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${config.baseUrl}/assets/download.png"><meta name="twitter:card" content="summary"><script type="application/ld+json">${schema}</script><link rel="stylesheet" href="../assets/styles.css"></head><body data-section="topics" data-editorial-function="${hub.function}" data-technology="${hub.technology}" data-content-format="topic-hub" data-audience="functional-leader" data-maturity="all">${nav}<main><section class="section"><div class="container"><a class="link" href="../topics.html">← All topics</a><div style="max-width:850px;margin:28px 0 34px"><span class="label-tag">${hub.type==="function"?"Credit Union Function":"Technology Theme"}</span><h1>${hub.label}</h1><p class="article-summary">${hub.description}</p></div><div class="card-grid">${items}</div><div class="card" style="margin-top:32px"><h2>Stay current on ${hub.label}</h2><p>Get the week’s most important credit-union AI developments and practical implications.</p><a class="button" href="../newsletter.html">Subscribe to the Weekly Briefing</a></div></div></section></main>${footer}</body></html>`;
}

for(const hub of config.hubs){
 for(const key of required) if(!hub[key]){console.error(`Missing ${key} on hub ${hub.id||"(unknown)"}`);failed=true;}
 if(!hub.articles||hub.articles.length<config.minimumArticles){console.error(`Thin hub ${hub.id}`);failed=true;continue;}
 for(const article of hub.articles) if(!fs.existsSync(article.path)){console.error(`Missing article ${article.path} referenced by ${hub.id}`);failed=true;}
 const output=`topics/${hub.id}.html`, rendered=render(hub);
 if(checkOnly){
  if(!fs.existsSync(output)||fs.readFileSync(output,"utf8")!==rendered){console.error(`Stale generated hub ${output}`);failed=true;}
 }else{
  fs.mkdirSync("topics",{recursive:true});
  fs.writeFileSync(output,rendered);
 }
}
console.log(`Topic hubs ${checkOnly?"checked":"generated"}: ${config.hubs.length} hubs, ${config.hubs.reduce((n,h)=>n+h.articles.length,0)} article placements.`);
if(failed) process.exitCode=1;
