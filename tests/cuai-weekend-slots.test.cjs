'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSchedule, checkCapacity, selectSlot } = require('../lib/media-slots.cjs');

test('both newly eligible weekend dates use 12:30 Eastern; historical weekends and wrong times stay closed', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  for (const date of ['2026-11-21', '2026-11-22']) {
    assert.deepEqual(validateSchedule(date + 'T12:30:00-05:00', {}, undefined, now),
      { date, dueAt: date + 'T17:30:00.000Z' });
    assert.equal(validateSchedule(date + 'T11:30:00-05:00', {}, undefined, now).error, 'scheduled_for_outside_policy');
    assert.equal(validateSchedule(date + 'T12:30:00-05:00', { timingExperimentId: 'cuai-timing-media-2026-10-20' }, undefined, now).error, 'timing_test_not_authorized');
  }
  assert.equal(validateSchedule('2026-11-15T12:30:00-05:00', {}, undefined, Date.parse('2026-11-14T12:00:00Z')).error, 'scheduled_for_weekend');
  assert.equal(validateSchedule('2026-11-24T11:30:00-05:00', {}, undefined, now).date, '2026-11-24');
  assert.equal(validateSchedule('2026-07-11T12:30:00-04:00', {}, undefined, Date.parse('2026-07-10T12:00:00Z')).error, 'scheduled_for_weekend');
  assert.equal(validateSchedule('2027-07-10T12:30:00-04:00', {}, undefined, Date.parse('2027-07-09T12:00:00Z')).dueAt, '2027-07-10T16:30:00.000Z');
});

test('weekend opportunities keep one per day and enforce the prospective seven-per-Monday–Sunday cap', () => {
  const rows = [16, 17, 18, 19, 20].map((day, index) => ({ id: String(index), status: 'sent', sentAt: '2026-11-' + day + 'T17:30:00Z' }));
  const sat = { id: 'sat', platform: 'linkedin', status: 'queued', scheduledFor: '2026-11-21T17:30:00Z',
    articleUrl: 'https://creditunionainews.com/news/existing.html' };
  assert.deepEqual(checkCapacity('2026-11-21', [], rows), { ok: true });
  assert.equal(checkCapacity('2026-11-21', [sat], rows).error, 'linkedin_daily_cap_conflict');
  assert.deepEqual(checkCapacity('2026-11-22', [sat], rows), { ok: true });
  const extra = { id:'unexpected-provider-duplicate-day', status:'sent', sentAt:'2026-11-20T18:00:00Z' };
  assert.equal(checkCapacity('2026-11-22', [sat], [...rows, extra]).error, 'linkedin_weekly_cap_conflict');
  assert.deepEqual(checkCapacity('2026-11-23', [sat], rows), { ok: true });
  assert.deepEqual(selectSlot({date:'2026-11-21', queue:[sat], providerPosts:rows}), {status:'reserved',itemId:'sat'});
  const candidate = { id:'new-story', eligible:true, classification:'High', canonicalUrl:'https://creditunionainews.com/news/new-story.html' };
  assert.equal(selectSlot({date:'2026-11-22', queue:[], articles:[candidate], providerPosts:rows}).status, 'selected');
  assert.equal(selectSlot({date:'2026-11-22', queue:[], articles:[{...candidate, eligible:false}], providerPosts:rows}).status, 'no-qualified-selection');
});

test('the reviewed runtime loader pins the exact changed guard and executes it without widening privileges', async () => {
  const fs = require('node:fs');
  const { createHash } = require('node:crypto');
  const policy = fs.readFileSync('automation/scheduled-tasks/publish-cuai-daily-article.md', 'utf8');
  const loader = policy.match(/(`{3}javascript\n)(async function loadPublisherWritePlanner[\s\S]+?)\n`{3}/)?.[2];
  assert.ok(loader);
  const load = new Function(loader + '\nreturn loadPublisherWritePlanner;')();
  const read = async ({ path, ref }) => {
    assert.equal(ref, 'f'.repeat(40));
    const content = fs.readFileSync(path);
    const sha = createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
    return { structuredContent: { content: content.toString(), encoding: 'utf-8', sha } };
  };
  const planner = await load({ mcp__codex_apps__github_fetch_file: read }, 'f'.repeat(40));
  assert.equal(typeof planner.validateArticleReview, 'function');
  await assert.rejects(() => load({ mcp__codex_apps__github_fetch_file: async req => {
    const result = await read(req);
    result.structuredContent.sha = 'a'.repeat(40);
    return result;
  } }, 'f'.repeat(40)), /reviewed-write-source-unavailable-or-mismatched/);
});
