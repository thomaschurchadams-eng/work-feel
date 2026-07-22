import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://creditunionainews.com/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
const result = await new AxeBuilder({ page }).analyze();
const violations = result.violations.map((violation) => ({
  id: violation.id,
  impact: violation.impact,
  help: violation.help,
  description: violation.description,
  nodes: violation.nodes.map((node) => ({
    target: node.target,
    html: node.html,
    failureSummary: node.failureSummary,
    any: node.any,
    all: node.all,
    none: node.none
  }))
}));
await fs.mkdir('automation/ux-audit', { recursive: true });
await fs.writeFile('automation/ux-audit/home-aria-diagnostic.json', JSON.stringify(violations, null, 2));
await browser.close();
