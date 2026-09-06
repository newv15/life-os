'use client'

import { useSyncExternalStore } from 'react'

/** Nothing ever changes this: the value is read once, after hydration. */
const NEVER_CHANGES = () => () => {}

/**
 * A value that only exists in the browser - which keyboard the machine has,
 * which theme was chosen - without an effect that sets state on mount.
 *
 * The effect version works but renders twice on every mount and is exactly
 * what `react-hooks/set-state-in-effect` is there to catch. This renders the
 * server value, then the real one, and React expects the difference instead of
 * warning about it.
 */
export function useClientValue<T>(read: () => T, onServer: T): T {
  return useSyncExternalStore(NEVER_CHANGES, read, () => onServer)
}
