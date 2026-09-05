/**
 * How long something took, said the way a person would say it.
 *
 * Rounded to the minute throughout. A stopwatch reading "1h 25min 03s" is
 * precision nobody asked for, and it makes two similar sessions look different
 * when they are not.
 */
export function formatDuration(seconds: number): string {
  // Checked before rounding: 30 seconds rounds up to "1 min", which reads as a
  // minute of work that did not happen.
  if (seconds < 60) return 'meno di 1 min'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
}

/** Seconds elapsed; a missing end means it is still running. */
export function secondsBetween(startedAt: string | Date, endedAt: string | Date | null): number {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()

  return Math.round((end - start) / 1000)
}
