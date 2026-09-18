import { useRef, useState } from 'react'
import { TEMPORARY_PLAYLIST, removeTemporaryPlaylist } from '../app/temporaryPlaylist'
import type { PlaybackOutcome, SpotifyGateway } from '../spotify/gateway'

export type SendState =
  | { step: 'idle' }
  | { step: 'writing'; written: number; total: number }
  | { step: 'starting'; playlistId: string }
  /** The mix is in the playlist; `playback` says whether it's playing, or why not. */
  | { step: 'sent'; playlistId: string; playback: PlaybackOutcome | 'failed' }
  | { step: 'failed' }

/** How the last clean up of the temporary playlist went. */
export type CleanupState = 'idle' | 'removing' | 'removed' | 'failed'

/**
 * Sends mixes to the temporary playlist, plays them, and cleans the playlist up.
 * `knownPlaylistId` is the temporary playlist found in the user's library: null
 * if there's none, undefined while the library is loading. The first send creates
 * one if needed, and every later send overwrites that same playlist.
 */
export function useSendMix(gateway: SpotifyGateway, knownPlaylistId: string | null | undefined) {
  const [state, setState] = useState<SendState>({ step: 'idle' })
  const [cleanup, setCleanup] = useState<CleanupState>('idle')
  // The temporary playlist as this session knows it: undefined until the session
  // sends to it, keeps it or removes it, and `knownPlaylistId` stands in meanwhile.
  const [ownId, setOwnIdState] = useState<string | null | undefined>(undefined)
  const ownIdRef = useRef(ownId)
  // Bumped by `reset`, so a send that's still running no longer updates what the user sees.
  const version = useRef(0)
  // Sends run one after another: two at once could each create a playlist.
  const queue = useRef<Promise<void>>(Promise.resolve())

  function setOwnId(id: string | null) {
    ownIdRef.current = id
    setOwnIdState(id)
  }

  /** The temporary playlist as far as anyone knows right now; queued work reads it when it runs. */
  function currentId() {
    return ownIdRef.current === undefined ? knownPlaylistId : ownIdRef.current
  }

  /** Shows `next`, unless a later send or a reset has taken over since `run` started. */
  function updateFor(run: number) {
    return (next: SendState) => run === version.current && setState(next)
  }

  async function play(playlistId: string, run: number) {
    const update = updateFor(run)
    update({ step: 'starting', playlistId })
    try {
      update({ step: 'sent', playlistId, playback: await gateway.startPlayback(playlistId) })
    } catch {
      update({ step: 'sent', playlistId, playback: 'failed' })
    }
  }

  async function write(trackIds: string[], run: number) {
    const update = updateFor(run)
    update({ step: 'writing', written: 0, total: trackIds.length })
    let playlistId: string
    try {
      playlistId = currentId() ?? (await gateway.createPlaylist(TEMPORARY_PLAYLIST))
      setOwnId(playlistId)
      await gateway.replacePlaylistTracks(playlistId, trackIds, (written) =>
        update({ step: 'writing', written, total: trackIds.length }),
      )
    } catch {
      update({ step: 'failed' })
      return
    }
    await play(playlistId, run)
  }

  const busy = state.step === 'writing' || state.step === 'starting' || cleanup === 'removing'
  const playlistId = ownId === undefined ? knownPlaylistId : ownId

  return {
    state,
    cleanup,
    busy,
    /** The temporary playlist in the user's library, if there is one; undefined while that's unknown. */
    playlistId,
    /** Whether the temporary playlist is one from an earlier visit this session hasn't used or kept yet. */
    isLeftover: ownId === undefined && Boolean(knownPlaylistId),
    /** Writes the tracks to the temporary playlist, then starts playing it. */
    send(trackIds: string[]) {
      const run = ++version.current
      setCleanup('idle')
      setState({ step: 'writing', written: 0, total: trackIds.length })
      queue.current = queue.current.then(() => write(trackIds, run))
    },
    /** Tries to start playback again, e.g. once the user has opened Spotify on a device. */
    retryPlayback() {
      if (state.step !== 'sent') return
      const run = ++version.current
      queue.current = queue.current.then(() => play(state.playlistId, run))
    },
    /** Keeps a leftover temporary playlist: the session takes it as its own. */
    keepLeftover() {
      if (knownPlaylistId) setOwnId(knownPlaylistId)
    },
    /**
     * Removes the temporary playlist from the user's library, once any send in
     * progress is done. Resolves either way; `cleanup` says how it went.
     */
    cleanUp(): Promise<void> {
      setCleanup('removing')
      const done = queue.current.then(async () => {
        try {
          await removeTemporaryPlaylist(gateway, currentId())
          setOwnId(null)
          setState({ step: 'idle' })
          setCleanup('removed')
        } catch {
          setCleanup('failed')
        }
      })
      queue.current = done
      return done
    },
    /** Forgets the last send's outcome, e.g. because the mix changed. */
    reset() {
      version.current++
      setState({ step: 'idle' })
    },
  }
}
