import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://creditunionainews.com/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);
const result = await new AxeBuilder({ page }).withRules(['aria-required-children']).analyze();
await fs.mkdir('automation/ux-audit', { recursive: true });
await fs.writeFile('automation/ux-audit/home-aria-diagnostic.json', JSON.stringify(result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failureSummary: n.failureSummary, any: n.any, all: n.all, none: n.none })) })), null, 2));
await browser.close();
