import { cn } from '@/lib/utils'

/**
 * A bar is only worth drawing when the number behind it is real.
 *
 * The percentage is written next to it rather than left to be read off the
 * fill: at these sizes the difference between 40% and 60% is a few pixels, and
 * the number is what actually gets compared.
 */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            clamped === 100 ? 'bg-positive' : 'bg-primary',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="data shrink-0 text-xs text-muted-foreground">{clamped}%</span>
    </div>
  )
}
