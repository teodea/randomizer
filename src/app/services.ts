import { createContext, useContext } from 'react'
import { config } from '../config'
import { createAuth, type Auth, type LoginFailure } from '../spotify/auth'
import type { SpotifyGateway } from '../spotify/gateway'
import { createWebGateway } from '../spotify/webGateway'

/** What the pages need from the outside world; tests swap in fakes. */
export interface Services {
  /** Null when the build has no Spotify Client ID: only the demo works. */
  auth: Auth | null
  /** The gateway for the logged-in user. */
  createGateway: (auth: Auth) => SpotifyGateway
}

function defaultServices(): Services {
  const clientId = config.spotifyClientId
  return {
    auth: clientId
      ? createAuth({
          clientId,
          // Must match a redirect URI registered in the Spotify dashboard, e.g.
          // https://teodea.github.io/randomizer/callback or http://127.0.0.1:5173/randomizer/callback
          redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}callback`,
        })
      : null,
    createGateway: (auth) => createWebGateway({ getAccessToken: auth.getAccessToken }),
  }
}

export const ServicesContext = createContext<Services>(defaultServices())

export function useServices(): Services {
  return useContext(ServicesContext)
}

/** Why the user landed back on the home page, shown there as a message. */
export type Notice = LoginFailure | 'expired' | 'logged-out'
