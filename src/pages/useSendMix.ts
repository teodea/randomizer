import { useRef, useState } from 'react'
import { TEMPORARY_PLAYLIST } from '../app/temporaryPlaylist'
import type { PlaybackOutcome, SpotifyGateway } from '../spotify/gateway'

export type SendState =
  | { step: 'idle' }
  | { step: 'writing'; written: number; total: number }
  | { step: 'starting'; playlistId: string }
  /** The mix is in the playlist; `playback` says whether it's playing, or why not. */
  | { step: 'sent'; playlistId: string; playback: PlaybackOutcome | 'failed' }
  | { step: 'failed' }

/**
 * Sends mixes to the temporary playlist and plays them. `knownPlaylistId` is the
 * temporary playlist found in the user's library, if any; the first send creates
 * one otherwise, and every later send overwrites that same playlist.
 */
export function useSendMix(gateway: SpotifyGateway, knownPlaylistId: string | null) {
  const [state, setState] = useState<SendState>({ step: 'idle' })
  const createdId = useRef<string | null>(null)
  // Bumped by `reset`, so a send that's still running no longer updates what the user sees.
  const version = useRef(0)
  // Sends run one after another: two at once could each create a playlist.
  const queue = useRef<Promise<void>>(Promise.resolve())

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
      playlistId =
        createdId.current ?? knownPlaylistId ?? (createdId.current = await gateway.createPlaylist(TEMPORARY_PLAYLIST))
      await gateway.replacePlaylistTracks(playlistId, trackIds, (written) =>
        update({ step: 'writing', written, total: trackIds.length }),
      )
    } catch {
      update({ step: 'failed' })
      return
    }
    await play(playlistId, run)
  }

  const busy = state.step === 'writing' || state.step === 'starting'

  return {
    state,
    busy,
    /** Writes the tracks to the temporary playlist, then starts playing it. */
    send(trackIds: string[]) {
      const run = ++version.current
      setState({ step: 'writing', written: 0, total: trackIds.length })
      queue.current = queue.current.then(() => write(trackIds, run))
    },
    /** Tries to start playback again, e.g. once the user has opened Spotify on a device. */
    retryPlayback() {
      if (state.step !== 'sent') return
      const run = ++version.current
      queue.current = queue.current.then(() => play(state.playlistId, run))
    },
    /** Forgets the last send's outcome, e.g. because the mix changed. */
    reset() {
      version.current++
      setState({ step: 'idle' })
    },
  }
}
