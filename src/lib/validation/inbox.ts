import { z } from 'zod'
import { text } from '@/lib/validation/common'

/**
 * Capture has exactly one rule: there has to be something there.
 *
 * The ceiling is generous on purpose. This is where a half-formed thought
 * lands, often dictated, often unpunctuated, and a validation error at the
 * moment of capture would teach the person to stop capturing.
 */
const RAW_TEXT_MAX = 10_000

export const captureInboxSchema = z.object({
  rawText: text(RAW_TEXT_MAX),
})

export type CaptureInboxInput = z.infer<typeof captureInboxSchema>
