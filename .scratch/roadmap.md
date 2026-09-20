# Tally roadmap release

User request: ship unfinished roadmap screenshot items from zent7x/tally, fix frontend, and use 20 subagents (three concurrent workers per wave due to runtime limit).

## Acceptance criteria

- Save named bank column presets, select/reapply compatible layouts, preview parsed data with date/amount conventions, choose destination account, report skipped rows, persist presets in local/encrypted storage and backups.
- Manage checking, savings, cash, investments, credit and loans. Assign transactions to accounts; show assets, debt, net worth, and liquid cash. Preserve old ledgers. Explicit balances are current snapshots, never added to historical transaction totals. Transfers are not income/spending.
- Income planning for irregular earners: complete calendar months including gaps, average/conservative/manual planning, 3/6/12 month windows, configurable monthly draw and reserve. Persist plan, explain estimates, integrate into 12-month forecast with visible assumptions.
- Fix frontend end to end: real transaction forms and editing/categorization, CSV and JSON exports, backup restore, encryption enable/disable/lock/unlock, responsive desktop/mobile light/dark views and useful feedback.
- Preserve encrypted-at-rest storage after unlocking and every mutation. No background external calls, analytics, CDN fonts, remote data, or telemetry in application runtime.
- Test the actual shipped modules, meaningful finance regression cases, real browser flows including persistence/encryption and responsive behavior. Build production assets. Push reviewed release and verify deployment.

## Validation boundary

Existing public finance engine functions and rendered user flows are the test boundaries for this implementation. Financial examples use fixed independently calculated expectations. No tests of internal React details or CSS snapshots.

## Review baseline

Start: a43ed9d (origin/main when work began). Review against that fixed point and this spec. No additional project standards existed in the repository at startup.
