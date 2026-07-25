export interface PlaceholderViewProps {
  title: string;
  description: string;
}

export function PlaceholderView({ title, description }: PlaceholderViewProps) {
  return (
    <section
      className="rounded-2xl border p-6 shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {description}
      </p>
      <p className="mt-4 text-xs" style={{ color: "var(--faint, var(--muted))" }}>
        TODO: migrate this view from the legacy app shell.
      </p>
    </section>
  );
}
