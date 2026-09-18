import type { RouteObject } from 'react-router'
import { SiteLayout } from './components/SiteLayout'
import { Callback } from './pages/Callback'
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
      { path: '/mix', element: <SpotifyMixer /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
