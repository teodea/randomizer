import type { RouteObject } from 'react-router'
import { Landing } from './pages/Landing'
import { NotFound } from './pages/NotFound'

export const routes: RouteObject[] = [
  { path: '/', element: <Landing /> },
  { path: '*', element: <NotFound /> },
]
