import { useState, useEffect } from 'react'

/** Debounces a fast-changing value. Plan spec: 150ms for instant search inputs. */
export function useDebounce<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])

  return debounced
}
