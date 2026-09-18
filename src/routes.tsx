import type { RouteObject } from 'react-router'
import { SiteLayout } from './components/SiteLayout'
import { Landing } from './pages/Landing'
import { NotFound } from './pages/NotFound'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
