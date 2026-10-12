import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=(p)=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const taxonomy=read('automation/image-taxonomy.json');
const concepts=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]||''),'utf8'));
const ledger=process.argv[3]?JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8')):read('automation/image-ledger.json');
if(!Array.isArray(concepts)) throw new Error('Concept input must be a JSON array.');
const recent=[...(ledger.images||[])].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
const dims=['medium','subject','composition','perspective','palette','lighting','texture'];
const count=(items,key,value)=>items.filter((x)=>x[key]===value).length;
const isBlue=(palette)=>['navy-teal','cobalt-coral'].includes(palette);

function evaluate(c){
  const failures=[];
  for(const key of dims){
    const allowed=taxonomy[`${key}s`]||taxonomy[key==='medium'?'mediums':key==='palette'?'palettes':key==='lighting'?'lighting':key==='texture'?'textures':key==='subject'?'subjects':key==='composition'?'compositions':'perspectives'];
    if(!allowed?.includes(c[key])) failures.push(`invalid-${key}`);
  }
  const last=recent[0];
  if(last?.medium===c.medium) failures.push('same-medium-consecutive');
  if(count(recent.slice(0,5),'palette',c.palette)>=taxonomy.hardRules.samePaletteInLastFiveMax) failures.push('palette-overused');
  if(isBlue(c.palette)&&recent.slice(0,5).filter((x)=>isBlue(x.palette)).length>=taxonomy.hardRules.blueDominantInLastFiveMax) failures.push('blue-dominant-overused');
  if(c.scene==='boardroom'&&count(recent.slice(0,10),'scene','boardroom')>=taxonomy.hardRules.boardroomInLastTenMax) failures.push('boardroom-overused');
  const exact=recent.slice(0,taxonomy.hardRules.exactCombinationLookback).some((x)=>dims.every((key)=>x[key]===c[key]));
  if(exact) failures.push('exact-combination-repeated');
  if((c.prohibitedElements||[]).some((x)=>taxonomy.hardRules.prohibited.includes(x))) failures.push('prohibited-element');
  const novelty=dims.reduce((sum,key)=>sum+(count(recent.slice(0,10),key,c[key])===0?1:0),0)/dims.length*100;
  const topicFit=Math.max(0,Math.min(100,c.topicFit??0));
  const clarity=Math.max(0,Math.min(100,c.editorialClarity??0));
  const score=Math.round((novelty*.5+topicFit*.3+clarity*.2)*10)/10;
  return {...c,score,metrics:{novelty:Math.round(novelty),topicFit,editorialClarity:clarity},rejected:failures.length>0,reasons:failures};
}

const ranked=concepts.map(evaluate).sort((a,b)=>b.score-a.score);
process.stdout.write(JSON.stringify({selected:ranked.find((x)=>!x.rejected)||null,ranked},null,2)+'\n');
if(!ranked.some((x)=>!x.rejected)) process.exitCode=2;
