import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { routes } from './routes'
import { applyTheme, storedChoice } from './theme'

const router = createBrowserRouter(routes, {
  // Vite's `base` without the trailing slash, e.g. "/randomizer".
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

applyTheme(storedChoice())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
