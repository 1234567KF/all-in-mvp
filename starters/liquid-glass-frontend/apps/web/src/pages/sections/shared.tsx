/* ── Shared section components ── */

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
    </section>
  )
}

export function CodeLabel({ text }: { text: string }) {
  return (
    <code
      className="font-label-mono rounded px-1.5 py-0.5"
      style={{
        background: "var(--lg-surface-container)",
        color: "var(--lg-text-secondary)",
      }}
    >
      {text}
    </code>
  )
}
