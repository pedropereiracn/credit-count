'use client'

import { useEffect, useState } from 'react'

/**
 * True once the viewport matches `query`. Starts false so the server render and
 * the first client render agree (no hydration mismatch); the real value lands on
 * mount, via `useEffect`, which is always before a viewer can have opened the one
 * dialog this hook gates (it only opens after a click).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [query])

  return matches
}
