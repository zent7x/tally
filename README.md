# Tally

[![CI](https://github.com/zent7x/tally/actions/workflows/test.yml/badge.svg)](https://github.com/zent7x/tally/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![live demo](https://img.shields.io/badge/demo-live-16a34a.svg)](https://zent7x.com/tally/)

**Your money, on your machine.** Tally is a personal finance tracker with bank CSV imports, multiple accounts, budgets, and a plan for uneven income. No sign-up, bank login, backend, or analytics. Calculations and financial data stay in your browser.

**[Open Tally](https://zent7x.com/tally/)** · **[What's new in v0.3.1](CHANGELOG.md)**

## Get started

1. Choose **Open your ledger**, or **Try the demo** to try example data.
2. In **Accounts**, add your accounts and current balances.
3. Choose **Import CSV**, select the destination account, and review the column mapping and preview before importing. You can also **Add transaction** manually.
4. Explore **Overview**, **Transactions**, **Categories**, **Recurring**, and **Budgets**. Use **Income plan** and **Forecast** to look ahead.
5. In **Data & privacy**, enable optional passphrase protection and download a JSON backup.

Data belongs to this browser profile and website address. Clearing site data removes it; there is no cloud sync. Export a backup before changing browsers, devices, or hosting addresses.

## What ships

- **Bank import presets.** Map dates, descriptions, signed amounts or separate debit/credit columns; choose date order and reverse amount signs when needed. Review valid and skipped rows before importing. Save, update, or delete named bank presets. One compatible preset applies automatically; several matching presets require an explicit choice or manual mapping. Compatibility requires the complete column layout, and you choose the destination account separately.
- **Accounts and net worth.** Track checking, savings, cash, investments, credit cards, and loans. See assets, amounts owed, net worth, and liquid cash. A supplied balance is a current snapshot: imported history is not added again. Leave the balance blank to calculate it from assigned transactions, which may omit an opening balance. Enter debt as **Amount owed**. All accounts share one display currency; Tally does not convert currencies or retrieve live balances.
- **Income smoothing.** Choose 3, 6, or 12 completed calendar months and an average, conservative (25th percentile), or manual planning income. Missing months after the ledger begins count as zero; the incomplete current month and transfers are excluded. Set a desired monthly draw and earmarked reserve to see an illustrative cushion and reserve gap. Earmarked cash is already part of your accounts and never increases their balances.
- **Twelve-month cash scenarios.** Forecast uses liquid cash from checking, savings, and cash accounts, your saved income estimate, and average recorded spending. Try a monthly income adjustment or reduce Dining, Shopping, and Entertainment spending without changing your saved plan. Investments and debts are outside the starting liquid balance. Unrecorded expenses, investment returns, and future debt payments are not added automatically; this is a planning scenario, not a prediction.
- **Everyday tracking.** Add, edit, categorize, search, and filter transactions; save categorization rules; set category budgets; review recurring charges; export categorized transactions with account names as CSV.
- **A compact frontend.** Clear section navigation, a continuous balance summary, transaction and account lists, light/dark themes, and keyboard-accessible forms. The landing page includes a working 3D calculator; its calculations are temporary and never alter the ledger. The visual redesign follows [Uncodixfy](https://github.com/cyxzdev/Uncodixfy).

## Privacy, protection, and backups

The website downloads its static HTML, scripts, styles, and assets when opened. Once loaded, ledger operations run locally without API requests or financial-data uploads. Tally has no backend. It does not provide an installed PWA or guarantee a fresh offline page load; self-host the built files if you need a locally served copy.

Optional local encryption uses **AES-256-GCM** with a passphrase-derived key (**PBKDF2-SHA-256, 250,000 iterations**). After unlocking, edits remain encrypted when saved. Reloading or explicitly locking requires the passphrase again. There is no passphrase recovery.

**Data & privacy → Download JSON backup** exports the complete ledger, including accounts, presets, rules, budgets, and settings. Backups are encrypted while local protection is enabled. **Restore JSON backup** validates the file and previews the replacement; it replaces rather than merges data, preserving this browser's current protection setting. An encrypted backup needs its original passphrase. **Export unencrypted CSV** always produces plaintext transactions and is not a complete backup.

Save errors stay visible. If another tab changes the ledger, the stale tab stops saving to avoid overwriting newer data. Export its changes as a backup, then reload before continuing.

## Develop and verify

Use Node.js 24 LTS with its bundled npm; CI and deployment use the same runtime.

```bash
npm ci
npm run dev                  # http://localhost:5173
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs source-level privacy checks and finance, import, account, income, storage, export, and encryption tests through `tsx`, importing the actual TypeScript finance modules in `src/lib/finance/`. Browser tests use Playwright against the production build and cover workflows, persistence, protection, navigation, mobile layout, and use after the loaded app goes offline. CI runs both suites and the build.

Privacy checks reject known network APIs and remote resource patterns in application source; the production Content Security Policy also blocks connections with `connect-src 'none'`. These are safeguards, not a claim that static analysis proves every possible behavior of every dependency.

To self-host, upload the complete `dist/` directory from `npm run build` to a static web server. Relative asset paths support subfolders. Run `npm run preview` to inspect the build locally. Pushes to `main` deploy through [GitHub Pages](.github/workflows/pages.yml).

## Roadmap

- [x] Optional passphrase encryption of the local store (AES-256-GCM) — shipped in v0.1
- [x] CSV export of categorized data — shipped
- [x] Import mapping presets per bank — shipped in v0.3.0
- [x] Multi-account / net-worth view — shipped in v0.3.0
- [x] Recurring-income smoothing for irregular / gig earners — shipped in v0.3.0

Ideas and PRs welcome. Keep financial data and calculations local.

## License

MIT © 2026 Adeeb Bashir ([zent7x](https://github.com/zent7x)) · [zent7x.com](https://zent7x.com)
