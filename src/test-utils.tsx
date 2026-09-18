import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ServicesContext, type Services } from './app/services'
import { createFakeGateway, type FakeSource } from './spotify/fakeGateway'
import { routes } from './routes'
import type { Auth } from './spotify/auth'

/** Renders the whole app as if the browser had opened `path`. */
export function renderAt(path: string, services?: Partial<Services>) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const app = <RouterProvider router={router} />
  render(services ? <ServicesContext value={{ ...noServices, ...services }}>{app}</ServicesContext> : app)
  return router
}

const noServices: Services = {
  auth: null,
  createGateway: () => {
    throw new Error('No gateway in this test')
  },
}

/** An in-memory login: `completeLogin` succeeds unless told to fail. */
export function createFakeAuth({
  loggedIn = false,
  completeLogin,
}: { loggedIn?: boolean; completeLogin?: Auth['completeLogin'] } = {}) {
  let session = loggedIn
  const calls = { beginLogin: 0, completeLogin: [] as URLSearchParams[] }
  const auth: Auth = {
    isLoggedIn: () => session,
    async beginLogin() {
      calls.beginLogin++
    },
    async completeLogin(params) {
      calls.completeLogin.push(params)
      await completeLogin?.(params)
      session = true
    },
    async getAccessToken() {
      return 'fake-token'
    },
    logout() {
      session = false
    },
  }
  return { auth, calls }
}

export function fakeServices(auth: Auth, sources: FakeSource[]): Partial<Services> {
  return { auth, createGateway: () => createFakeGateway(sources) }
}
