import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { armReveals } from '../reveal'
import { SiteFooter } from './SiteFooter'

/** Wraps every page so the legal links and the Spotify disclaimer are always one click away. */
export function SiteLayout() {
  // One observer for the whole site, armed once and torn down with it.
  useEffect(() => armReveals(), [])

  return (
    /*
     * One place decides that a reader who asked for stillness gets it, for every
     * animated component on every page, rather than each of them remembering to
     * ask. The CSS layer answers the same query on its own.
     */
    <MotionConfig reducedMotion="user">
      <Outlet />
      <SiteFooter />
    </MotionConfig>
  )
}
