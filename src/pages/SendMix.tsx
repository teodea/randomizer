import { TEMPORARY_PLAYLIST, playlistUrl } from '../app/temporaryPlaylist'
import type { SendState } from './useSendMix'

interface SendMixProps {
  state: SendState
  busy: boolean
  onRetryPlayback: () => void
}

/**
 * How sending the mix to Spotify went. The button itself lives on the ticket, so
 * the action stays with the listener while they read the mix.
 */
export function SendMix({ state, busy, onRetryPlayback }: SendMixProps) {
  return (
    <div className="send-mix">
      {state.step === 'failed' ? (
        <p className="notice" data-label="Spotify" role="alert">
          Couldn&rsquo;t send the mix to Spotify. Try again.
        </p>
      ) : (
        <div role="status">
          <SendStatus state={state} busy={busy} onRetryPlayback={onRetryPlayback} />
        </div>
      )}
    </div>
  )
}

const playlistName = <>&ldquo;{TEMPORARY_PLAYLIST.name}&rdquo;</>

function SendStatus({
  state,
  busy,
  onRetryPlayback,
}: {
  state: SendState
  busy: boolean
  onRetryPlayback: () => void
}) {
  switch (state.step) {
    case 'writing':
      return (
        <>
          <p className="hint">
            Writing the mix to {playlistName}: {state.written} of {state.total} tracks…
          </p>
          <progress aria-label="Tracks written" max={state.total} value={state.written} />
        </>
      )
    case 'starting':
      return <p className="hint">Starting playback…</p>
    case 'sent':
      return (
        <>
          <p>{playbackMessage(state.playback)}</p>
          <p className="send-mix-actions">
            {(state.playback === 'no-device' || state.playback === 'failed') && (
              <button className="button" type="button" disabled={busy} onClick={onRetryPlayback}>
                Try again
              </button>
            )}
            <a className="button" href={playlistUrl(state.playlistId)} target="_blank" rel="noreferrer">
              Open Spotify
            </a>
          </p>
        </>
      )
    default:
      return null
  }
}

function playbackMessage(playback: Extract<SendState, { step: 'sent' }>['playback']) {
  switch (playback) {
    case 'started':
      return <>Playing your mix. It&rsquo;s in your library as {playlistName}.</>
    case 'no-device':
      return (
        <>
          Your mix is in {playlistName}, but no Spotify device is active. Open Spotify on your phone, computer or
          speaker, then try again.
        </>
      )
    case 'premium-required':
      return (
        <>
          Your mix is in {playlistName}. Starting playback from Randomizer needs Spotify Premium, so open the
          playlist in Spotify to listen.
        </>
      )
    case 'failed':
      return <>Your mix is in {playlistName}, but playback couldn&rsquo;t start.</>
  }
}
