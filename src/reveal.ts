/*
 * The catalogue prints itself as you reach it.
 *
 * A block's rule draws across, its rows settle under it, a sheet's cells stamp
 * in a few at a time. One observer for the whole page rather than one per
 * element, nothing running on scroll, and the work is CSS — this file only
 * decides when a thing has been reached.
 *
 * Every way out ends with the catalogue visible, because this file hides things
 * and a decoration may never be the reason a page is blank. Reduced motion does
 * not arm it. Neither does a browser without an observer. And an observer that
 * is *present but silent* — which is what a page rendered offscreen, or in some
 * embedded views, actually does — is caught by a watchdog that disarms the whole
 * effect rather than leaving the reader looking at nothing.
 */

/** Marks the document as able to reveal, which is what lets the stylesheet hide anything. */
const ARMED = 'reveals-armed'

/** Put on an element once it has been reached, and never taken off again. */
const SHOWN = 'is-shown'

/** How long a silent observer gets before the effect is abandoned as unsafe. */
const WATCHDOG_MS = 1200

export function armReveals(): () => void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (reduced || typeof IntersectionObserver !== 'function') return () => undefined

  document.documentElement.classList.add(ARMED)

  /*
   * A working observer reports on everything it is given almost at once, whether
   * or not it is in view. If nothing has been reported by the time the watchdog
   * runs, the observer is present but not answering and the effect gives up.
   */
  let heard = false

  const observer = new IntersectionObserver(
    (entries) => {
      heard = true
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add(SHOWN)
        // Printed once: a block does not un-print when it scrolls away.
        observer.unobserve(entry.target)
      }
    },
    // Meet it slightly before the edge, so nothing is caught mid-print.
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  )

  const seen = new WeakSet<Element>()
  function observeAll() {
    for (const element of document.querySelectorAll('[data-reveal]')) {
      if (seen.has(element) || element.classList.contains(SHOWN)) continue
      seen.add(element)
      observer.observe(element)
    }
  }

  observeAll()
  // Sources arrive from Spotify after the first paint, and a mix arrives later
  // still, so new cells have to be picked up as the page fills.
  const mutations = new MutationObserver(observeAll)
  mutations.observe(document.body, { childList: true, subtree: true })

  function disarm() {
    observer.disconnect()
    mutations.disconnect()
    clearTimeout(watchdog)
    // Taking the class off is what un-hides everything, instantly and for good.
    document.documentElement.classList.remove(ARMED)
  }

  const watchdog = setTimeout(() => {
    if (!heard) disarm()
  }, WATCHDOG_MS)

  return disarm
}
