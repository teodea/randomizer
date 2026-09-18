import { useCallback, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useServices, type Notice } from '../app/services'
import type { Auth } from '../spotify/auth'
import { SessionExpiredError } from '../spotify/errors'
import type { SpotifyGateway } from '../spotify/gateway'
import { Mixer } from './Mixer'

/** The mixer over the logged-in user's real playlists. */
export function SpotifyMixer() {
  const { auth } = useServices()
  if (!auth?.isLoggedIn()) return <Navigate to="/" replace />
  return <LoggedInMixer auth={auth} />
}

function LoggedInMixer({ auth }: { auth: Auth }) {
  const { createGateway } = useServices()
  const navigate = useNavigate()

  /** Ends the session and goes home, saying why. */
  const leave = useCallback(
    (notice: Notice) => {
      auth.logout()
      navigate('/', { replace: true, state: { notice } })
    },
    [auth, navigate],
  )

  const gateway = useMemo(() => guardSession(createGateway(auth), () => leave('expired')), [auth, createGateway, leave])

  return (
    <Mixer
      gateway={gateway}
      subtitle="Your playlists and Liked Songs on Spotify."
      canSend
      actions={
        <button className="link-button" type="button" onClick={() => leave('logged-out')}>
          Log out
        </button>
      }
    />
  )
}

/**
 * Calls `onExpired` when the session turns out to be over. The failed call then
 * never settles, so the page doesn't flash an error while the user is sent away.
 */
function guardSession(gateway: SpotifyGateway, onExpired: () => void): SpotifyGateway {
  const guard = <T,>(promise: Promise<T>) =>
    promise.catch((error: unknown): Promise<T> => {
      if (!(error instanceof SessionExpiredError)) throw error
      onExpired()
      return new Promise<T>(() => {})
    })
  return {
    listSources: () => guard(gateway.listSources()),
    getSourceTracks: (sourceId) => guard(gateway.getSourceTracks(sourceId)),
    createPlaylist: (details) => guard(gateway.createPlaylist(details)),
    replacePlaylistTracks: (playlistId, trackIds, onProgress) =>
      guard(gateway.replacePlaylistTracks(playlistId, trackIds, onProgress)),
    startPlayback: (playlistId) => guard(gateway.startPlayback(playlistId)),
  }
}
