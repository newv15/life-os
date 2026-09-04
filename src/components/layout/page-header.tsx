import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <header className="mb-7 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-heading text-2xl leading-none md:text-3xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="border-l-2 border-rule py-1 pl-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
