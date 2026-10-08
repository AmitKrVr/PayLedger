"use client"

import * as React from "react"

/** Delays reflecting `value` by `delayMs` -- used for search inputs so
 * every keystroke doesn't trigger its own list request. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
