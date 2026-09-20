const items = [
  ["Does Tally upload my data?", "No. Your transactions, accounts, and settings stay in your browser. There are no analytics or bank connections. Data leaves only when you export it yourself."],
  ["Does it work offline?", "Yes, after the page has loaded. For a fully local setup, serve a downloaded build on your machine. Export backups to keep a separate copy of your ledger."],
  ["Can I encrypt my ledger?", "Yes. Set a passphrase in Data & privacy to encrypt the local store with AES-256-GCM. Keep your passphrase safe: Tally cannot recover it."],
  ["Can I move my data?", "Download a full JSON backup and restore it in another browser. You can also export categorized transactions as CSV. Encrypted backups need their original passphrase."],
];
export function FaqAccordion() {
  return <div className="faq-list">{items.map(([title,content]) => <details key={title}><summary>{title}</summary><p>{content}</p></details>)}</div>;
}
