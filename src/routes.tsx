import type { RouteObject } from 'react-router'
import { SiteLayout } from './components/SiteLayout'
import { Callback } from './pages/Callback'
import { InviteOnly } from './pages/InviteOnly'
import { Landing } from './pages/Landing'
import { Mixer } from './pages/Mixer'
import { NotFound } from './pages/NotFound'
import { Privacy } from './pages/Privacy'
import { SpotifyMixer } from './pages/SpotifyMixer'
import { Terms } from './pages/Terms'
import { demoGateway } from './spotify/sampleLibrary'

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/demo', element: <Mixer gateway={demoGateway} /> },
      { path: '/callback', element: <Callback /> },
      // Its own address, so it survives a reload and can be read before logging in.
      { path: '/invite-only', element: <InviteOnly /> },
      { path: '/mix', element: <SpotifyMixer /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
