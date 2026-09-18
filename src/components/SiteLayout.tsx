import { Outlet } from 'react-router'
import { SiteFooter } from './SiteFooter'

/** Wraps every page so the legal links and the Spotify disclaimer are always one click away. */
export function SiteLayout() {
  return (
    <>
      <Outlet />
      <SiteFooter />
    </>
  )
}
