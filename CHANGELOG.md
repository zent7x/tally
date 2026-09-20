# Changelog

## v0.3.0 — 2026-09-20

### Added

- Named bank CSV mapping presets, editable column and date/sign settings, destination accounts, and a preview of valid and skipped rows. A single compatible preset applies automatically; multiple compatible presets require a choice.
- Accounts for checking, savings, cash, investments, credit cards, and loans, with assets, debt, liquid cash, and net-worth summaries. Current balance snapshots remain separate from transaction-derived balances. Accounts use one display currency without conversion.
- Income plans over 3, 6, or 12 completed calendar months, with average, conservative, and manual estimates; desired monthly draws; and illustrative reserve requirements. Empty months after the ledger begins count as zero, while the current month and transfers are excluded.
- Twelve-month liquid-cash forecasts driven by the saved income plan, with temporary income and discretionary-spending adjustments. Earmarked reserves are not counted twice.
- Complete JSON backup export and validated restore previews, including accounts, import presets, and income settings. Categorized CSV exports include account names.

### Fixed and improved

- Reworked the landing page and ledger with responsive navigation, useful empty states, accessible dialogs, readable light/dark themes, and working import, add, and demo links.
- Completed account editing, transaction editing and categorization, recurring summaries, budgets, and save feedback across the frontend.
- Kept local storage encrypted after unlock and subsequent edits. Serialized asynchronous saves, protected pending edits during locking, and retained current protection settings when restoring or replacing a ledger.
- Added visible storage failures and conflict protection so stale tabs cannot silently overwrite newer data. Backup export can preserve in-memory edits when local saving fails.
- Expanded tests against the actual TypeScript finance modules and added Playwright coverage for import/account/income workflows, encrypted persistence and backups, stale tabs, mobile navigation, and operation after the loaded app goes offline.
- Strengthened source privacy checks and added a production Content Security Policy that blocks runtime connections. Static website assets still load from the host; no cold-start offline or installed-PWA support is claimed.
- Updated setup instructions, feature documentation, and the canonical website link to [zent7x.com/tally](https://zent7x.com/tally/).
