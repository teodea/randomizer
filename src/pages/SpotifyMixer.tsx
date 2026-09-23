import { useCallback, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useServices, type Notice } from '../app/services'
import type { Auth } from '../spotify/auth'
import { NotInvitedError, SessionExpiredError } from '../spotify/errors'
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

  /** Ends the session and explains the refusal on its own page. */
  const refused = useCallback(() => {
    auth.logout()
    // `removed`, not a plain visit: this one was inside a minute ago and may
    // have left a playlist behind that the app can no longer clean up.
    navigate('/invite-only?removed', { replace: true })
  }, [auth, navigate])

  const gateway = useMemo(
    () => guardAccess(createGateway(auth), { onExpired: () => leave('expired'), onRefused: refused }),
    [auth, createGateway, leave, refused],
  )

  return (
    <Mixer
      gateway={gateway}
      subtitle="Your playlists and Liked Songs on Spotify."
      canSend
      onLogout={() => leave('logged-out')}
    />
  )
}

/**
 * Catches the two failures that end the visit rather than interrupt it: the
 * session being over, and the account being off the invite list. The failed
 * call then never settles, so the page doesn't flash an error while the user
 * is sent away.
 */
function guardAccess(
  gateway: SpotifyGateway,
  { onExpired, onRefused }: { onExpired: () => void; onRefused: () => void },
): SpotifyGateway {
  const guard = <T,>(promise: Promise<T>) =>
    promise.catch((error: unknown): Promise<T> => {
      if (error instanceof SessionExpiredError) onExpired()
      else if (error instanceof NotInvitedError) onRefused()
      else throw error
      return new Promise<T>(() => {})
    })
  return {
    listSources: () => guard(gateway.listSources()),
    getSourceTracks: (sourceId) => guard(gateway.getSourceTracks(sourceId)),
    createPlaylist: (details) => guard(gateway.createPlaylist(details)),
    replacePlaylistTracks: (playlistId, trackIds, onProgress) =>
      guard(gateway.replacePlaylistTracks(playlistId, trackIds, onProgress)),
    replacePlaylistTail: (playlistId, kept, currentTail, nextTail, onProgress) =>
      guard(gateway.replacePlaylistTail(playlistId, kept, currentTail, nextTail, onProgress)),
    removePlaylist: (playlistId) => guard(gateway.removePlaylist(playlistId)),
    startPlayback: (playlistId) => guard(gateway.startPlayback(playlistId)),
    getPlaybackState: () => guard(gateway.getPlaybackState()),
  }
}
