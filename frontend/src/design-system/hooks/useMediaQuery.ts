import { useEffect, useState } from 'react'

/**
 * Listen to a CSS media query. SSR-safe (default false sebelum mount).
 *
 * Convention: Tailwind breakpoints
 *   xs:  '(min-width: 360px)'
 *   sm:  '(min-width: 640px)'
 *   md:  '(min-width: 768px)'
 *   lg:  '(min-width: 1024px)'
 *   xl:  '(min-width: 1280px)'
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const useIsMobile = () => !useMediaQuery('(min-width: 768px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export function useIsTablet() {
  // Panggil kedua hook unconditionally supaya rules-of-hooks tetap stabil.
  const aboveMd = useMediaQuery('(min-width: 768px)')
  const aboveLg = useMediaQuery('(min-width: 1024px)')
  return aboveMd && !aboveLg
}
