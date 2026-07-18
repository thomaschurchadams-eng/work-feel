#!/usr/bin/env node
import fs from 'node:fs';
const file=process.argv[2];
if(!file){console.error('Usage: node scripts/validate-newsletter.mjs <edition.html>');process.exit(2);}
const html=fs.readFileSync(file,'utf8');
const checks={
  doctype:/<!DOCTYPE html>/i.test(html),
  noNoindex:!/<meta\s+[^>]*content=["'][^"']*noindex/i.test(html),
  canonical:/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/creditunionainews\.com\/newsletter\/\d{4}-\d{2}-\d{2}\.html["']/i.test(html),
  date:/<time[^>]*datetime=["']\d{4}-\d{2}-\d{2}["']/i.test(html),
  week:/The week in one minute/i.test(html),
  lead:/Lead story/i.test(html),
  changed:/What changed/i.test(html),
  actions:/What credit unions should do next/i.test(html),
  links:(html.match(/href=["']\/(?:news\/|insight-)[^"']+/gi)||[]).length>=3,
  subscribe:/mailto:info@creditunionainews\.com/i.test(html),
  noPlaceholders:!/\bReplace\b/i.test(html)
};
const errors=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
if(errors.length){console.error(`${file}: FAIL ${errors.join(', ')}`);process.exit(1);}
console.log(`${file}: PASS`);
