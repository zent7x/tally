# Tally

**Your money, on your machine.** A personal finance tracker that runs entirely on your device — no account, no bank login, no cloud, no tracking. It's a single HTML file. Double-click it and it works, forever, offline.

When Mint shut down, millions of people were pushed toward apps that make money by watching your spending. Tally is the opposite bet: the most private tool for understanding your money is the one that never sends it anywhere. Everything you see below is computed in your browser and stored only in your browser.

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
- **Zero install.** No npm, no Docker, no sign-up. One `index.html`. Works on a laptop, a phone, a locked-down work machine, a Raspberry Pi, or a USB stick.
- **You own the file.** Your data is a JSON backup you export whenever you want. Move it, encrypt it, delete it. It's yours.

## What it does

- **Import any bank CSV.** Tally guesses your date / description / amount columns (and handles separate debit/credit columns, `$1,234.56`, and `(45.00)` accounting negatives). If it guesses wrong, you fix it in one dropdown.
- **Auto-categorizes** transactions with editable keyword rules. Re-categorize once by tapping a chip, and Tally *learns the rule* and applies it to every matching transaction — past and future.
- **Finds the subscriptions draining you.** It detects charges that repeat on a steady cadence at a steady amount, then shows you the number nobody ever adds up: what they cost *per year*.
- **Budgets** per category with live progress against the current month.
- **Forecasts your next 12 months.** This is the part other trackers don't do: it separates fixed recurring costs from discretionary spending, projects your balance forward, and tells you the month you'd run low — *before* it happens. Then you can play with what-ifs privately: trim discretionary spending by X%, model a raise, or "cancel" a subscription and watch the line change.
- **Light & dark**, keyboard-friendly, and responsive down to a phone screen.

## Use it

1. Download [`index.html`](index.html).
2. Open it in any browser.
3. Click **Try with demo data** to explore, or **Import bank CSV** to use your own. A ready-made [`sample-statement.csv`](sample-statement.csv) is included so you can see a real import.

That's the whole setup. Nothing else to run.

## The privacy guarantee, in code

Tally's core promise is *no network, ever*. The test suite treats that as a hard invariant:

```js
ok("no fetch() calls",           !/\bfetch\s*\(/.test(script));
ok("no external resource links", !/(src|href)\s*=\s*["']https?:/i.test(html));
ok("no XMLHttpRequest",          !/XMLHttpRequest/.test(script));
```

If a future change (or a well-meaning "just add analytics" PR) tries to phone home, `node test.js` goes red. You never have to *trust* that Tally is private — you can read the ~20 lines that prove it.

## How the forecast works

Tally looks at your history and splits spending into two buckets:

- **Fixed recurring** — rent, subscriptions, insurance: charges that repeat on a monthly / weekly / yearly cadence with a stable amount.
- **Discretionary** — everything else, averaged per month.

Starting from your current balance (set it under **Data → Set balance** for accuracy), it projects `balance + income − fixed − discretionary` forward month by month, flags the first month you'd go negative, and lets the what-if levers recompute the line instantly. It's a projection, not a promise: it assumes your recent patterns continue. But seeing "you run low in March" in September is the whole point.

## Develop

No build step. Edit `index.html` and refresh. The logic engine (CSV/date/amount parsing, categorization, recurring detection) is unit-tested headlessly:

```bash
node test.js      # or: npm test
```

The tests run the app's real functions — extracted from `index.html`, not reimplemented — so they can't drift from the shipped code.

## Roadmap

- Optional client-side encryption of the local store with a passphrase
- Import mapping presets per bank (remember your column layout)
- Multi-account / net-worth view
- CSV *export* of categorized data
- Recurring-income smoothing for irregular / gig earners

Ideas and PRs welcome — with one rule that will never bend: **Tally does not talk to the network.**

## License

MIT © 2026 Adeeb Bashir ([zent7x](https://github.com/zent7x))
