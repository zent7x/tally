# Tally

[![CI](https://github.com/zent7x/tally/actions/workflows/test.yml/badge.svg)](https://github.com/zent7x/tally/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![live demo](https://img.shields.io/badge/demo-live-16a34a.svg)](https://zent7x.github.io/tally/)
[![encryption](https://img.shields.io/badge/at%20rest-AES--256--GCM-7c3aed.svg)](#the-privacy-guarantee-in-code)

**Your money, on your machine.** A personal finance tracker that runs entirely on your device — no account, no bank login, no cloud, no tracking. Use it on the [live website](https://zent7x.github.io/tally/), or build the static files and host them anywhere.

When Mint shut down, millions of people were pushed toward apps that make money by watching your spending. Tally is the opposite bet: the most private tool for understanding your money is the one that never sends it anywhere. Everything you see below is computed in your browser and stored only in your browser.

**▸ [Try the live demo](https://zent7x.github.io/tally/)** — open the site or click *"Try demo data"*. Nothing you enter is ever uploaded; the page has no backend to upload it to.

```
┌──────────────────────────────────────────────┐
│  income  $4,200    spending  $3,010   net +$1,190 │
│                                                │
│  Where it went          Projected balance      │
│  ▇▇▇▇▇▇▇ Housing        ╱‾‾‾‾‾╲                 │
│  ▇▇▇▇▇ Groceries       ╱       ╲___             │
│  ▇▇▇ Dining           ╱            ╲__ runs low │
│  ▇▇ Subscriptions    now  ·  ·  ·  ·  Dec       │
└──────────────────────────────────────────────┘
```

## Why it's different

- **Truly local.** There is no backend. There is no server to hack, no company to sell your data, no terms of service. A test in this repo (`no fetch() calls`, `no external resource links`) *fails the build* if anyone ever adds a network call. Privacy isn't a promise here — it's enforced by CI.
- **Zero install.** Open the website, or host the built static files yourself. Works on a laptop, a phone, a locked-down work machine, or a USB stick.
- **You own the data.** Export a JSON backup whenever you want. Move it, encrypt it, delete it. It's yours.

## What it does

- **Import any bank CSV.** Tally guesses your date / description / amount columns (and handles separate debit/credit columns, `$1,234.56`, and `(45.00)` accounting negatives). If it guesses wrong, you fix it in one dropdown.
- **Auto-categorizes** transactions with editable keyword rules. Re-categorize once by tapping a chip, and Tally *learns the rule* and applies it to every matching transaction — past and future.
- **Finds the subscriptions draining you.** It detects charges that repeat on a steady cadence at a steady amount, then shows you the number nobody ever adds up: what they cost *per year*.
- **Budgets** per category with live progress against the current month.
- **Plain-language insights.** The overview surfaces auto-generated observations — spending up or down versus last month, the share of income you actually kept, what your subscriptions cost per year, and where the money went — so you get the story, not just the numbers.
- **Exports to CSV.** One click writes your categorized transactions back out as a clean CSV, so your data is never trapped inside the app.
- **Forecasts your next 12 months.** This is the part other trackers don't do: it separates fixed recurring costs from discretionary spending, projects your balance forward, and tells you the month you'd run low — *before* it happens. Then you can play with what-ifs privately: trim discretionary spending by X%, model a raise, or "cancel" a subscription and watch the line change.
- **Encrypts on your device.** Set a passphrase and the whole store is **AES-256-GCM** encrypted at rest, with the key stretched from your passphrase via **PBKDF2 (250k iterations)**. The passphrase stays in memory and is never stored or sent. There's no recovery link — because there's no server to send a recovery link. Lose the passphrase, lose the data (so keep a backup export). The crypto round-trip is covered by the test suite.
- **Light & dark**, keyboard-friendly, and responsive down to a phone screen.

## Use it

### On the website

1. Open **[zent7x.github.io/tally](https://zent7x.github.io/tally/)**.
2. Click **Open app**, or use **Import / Add / Demo** on the landing dock.
3. Everything stays in your browser — refresh and your local ledger is still there.

### Host it yourself (upload anywhere)

```bash
npm install
npm run build
```

Upload the entire `dist/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, nginx, a USB stick web server). Paths are relative, so it works from a subdomain or a subfolder.

Local preview of the production build:

```bash
npm run preview
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # privacy + finance core (test.cjs)
npm run build    # static site → dist/
```

The tests import the same finance core used by the offline app (`lib/finance-core.mjs`, mirrored from `src/lib/finance/`) — not reimplemented — so they can't drift from the shipped code.

Pushes to `main` build and deploy the website via GitHub Pages (`.github/workflows/pages.yml`).

## The privacy guarantee, in code

Tally's core promise is *no network, ever*. The test suite treats that as a hard invariant:

```js
ok("no fetch() calls",           !/\bfetch\s*\(/.test(script));
ok("no external resource links", !/(src|href)\s*=\s*["']https?:/i.test(html));
ok("no XMLHttpRequest",          !/XMLHttpRequest/.test(script));
```

If a future change (or a well-meaning "just add analytics" PR) tries to phone home, `npm test` goes red. You never have to *trust* that Tally is private — you can read the ~20 lines that prove it.

## How the forecast works

Tally looks at your history and splits spending into two buckets:

- **Fixed recurring** — rent, subscriptions, insurance: charges that repeat on a monthly / weekly / yearly cadence with a stable amount.
- **Discretionary** — everything else, averaged per month.

Starting from your current balance (set it under **Data → Set balance** for accuracy), it projects `balance + income − fixed − discretionary` forward month by month, flags the first month you'd go negative, and lets the what-if levers recompute the line instantly. It's a projection, not a promise: it assumes your recent patterns continue. But seeing "you run low in March" in September is the whole point.

## Roadmap

- [x] Optional passphrase encryption of the local store (AES-256-GCM) — **shipped in v0.1**
- [x] CSV *export* of categorized data — **shipped**
- [ ] Import mapping presets per bank (remember your column layout)
- [ ] Multi-account / net-worth view
- [ ] Recurring-income smoothing for irregular / gig earners

Ideas and PRs welcome — with one rule that will never bend: **Tally does not talk to the network.**

## License

MIT © 2026 Adeeb Bashir ([zent7x](https://github.com/zent7x))
