# Autonomous retention and deletion

Cleanup runs without routine approval. The policy is deliberately asymmetric: it removes proven technical clutter readily and deletes published editorial work only when every evidence gate passes.

## Monthly run

On the first Monday of each month:

1. Re-read `automation/retention-policy.json`.
2. Run `node scripts/retention-maintenance.mjs --apply`.
3. Remove assets only after they have remained unreferenced for the full grace period.
4. Evaluate published content against every deletion gate. Prefer refresh, consolidation or contextual archiving. A deletion must write a 301 replacement or an intentional 410 entry to `automation/redirect-ledger.json`.
5. Delete merged branches past their grace period and abandoned branches only when no open PR or unique work remains.
6. Remove expired preview deployments while retaining production, active PR previews, incident evidence and three rollback candidates.
7. Run all site validators and verify a READY production deployment.
8. Roll back the cleanup commit if production verification fails.
9. Write `automation/retention-report.json`. Do not request approval or send a routine notification.

## Important constraint

Until article-level analytics, Search Console impressions and backlink evidence are actually readable, published content cannot satisfy the automatic deletion gate. Missing evidence is not equivalent to zero. This does not block autonomous removal of confirmed orphan assets, expired operational detail, merged branches or stale previews.

Git history is never rewritten as routine cleanup. Rewriting history is reserved for exposed secrets, prohibited data or exceptional repository damage.
