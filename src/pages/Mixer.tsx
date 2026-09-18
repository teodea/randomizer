import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TEMPORARY_PLAYLIST, splitLibrary } from '../app/temporaryPlaylist'
import { SourcePicker } from '../components/SourcePicker'
import { trackCountLabel } from '../format'
import { buildMix, type MixItem, type Weighting } from '../mixer/engine'
import { createRng, randomSeed } from '../mixer/random'
import { equalShares, setShare, type Shares } from '../mixer/shares'
import { SourceUnavailableError } from '../spotify/errors'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Source } from '../spotify/types'
import { defaultOrderForm, toOrder } from './orderForm'
import { OrderSettings } from './OrderSettings'
import { defaultPoolForm, toPoolOptions } from './poolForm'
import { PoolSettings } from './PoolSettings'
import { SendMix } from './SendMix'
import { useSendMix, type CleanupState } from './useSendMix'
import './Mixer.css'

/** A mix needs at least this many sources. */
const MIN_SOURCES = 2

type WeightingMode = Weighting['mode']

const WEIGHTING_MODES: { mode: WeightingMode; label: string; hint: string }[] = [
  { mode: 'uniform', label: 'Uniform', hint: 'Every track equally likely, so bigger sources play more.' },
  { mode: 'balanced', label: 'Balanced', hint: 'Every source equally likely, whatever its size.' },
  { mode: 'custom', label: 'Custom', hint: 'You choose each source’s share.' },
]

interface MixerProps {
  gateway: SpotifyGateway
  /** One line under the title saying where the sources come from. */
  subtitle?: string
  /** Ends the session; given, the page offers Log out, which first removes the temporary playlist. */
  onLogout?: () => void
  /** Seed for each new mix; injectable so tests get predictable orders. */
  newSeed?: () => number
  /** Whether the mix can be sent to the user's Spotify; not in demo mode. */
  canSend?: boolean
}

export function Mixer({
  gateway,
  subtitle = 'Demo mode: sample playlists, no login.',
  onLogout,
  newSeed = randomSeed,
  canSend = false,
}: MixerProps) {
  const [library, setLibrary] = useState<Source[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [weightingMode, setWeightingMode] = useState<WeightingMode>('uniform')
  const [shares, setShares] = useState<Shares>({})
  const [unavailableIds, setUnavailableIds] = useState<string[]>([])
  // Sources found unavailable by the last Generate, to tell the user what was left out.
  const [leftOut, setLeftOut] = useState<Source[]>([])
  const [mix, setMix] = useState<MixItem[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateFailed, setGenerateFailed] = useState(false)
  const [poolForm, setPoolForm] = useState(defaultPoolForm)
  const [orderForm, setOrderForm] = useState(defaultOrderForm)
  const [loggingOut, setLoggingOut] = useState(false)
  // Bumped whenever the selection changes, so a mix built for an older selection is discarded.
  const selectionVersion = useRef(0)

  useEffect(() => {
    let active = true
    gateway.listSources().then(
      (list) => active && setLibrary(list),
      () => active && setLoadFailed(true),
    )
    return () => {
      active = false
    }
  }, [gateway])

  // The app's own playlist is where mixes go, never something to mix from.
  const { sources, temporaryPlaylistId } = library
    ? splitLibrary(library)
    : { sources: null, temporaryPlaylistId: null }
  const sendMix = useSendMix(gateway, library ? temporaryPlaylistId : undefined)

  const selected = selectedIds
    .map((id) => sources?.find((source) => source.id === id))
    .filter((source) => source !== undefined)
  const pool = toPoolOptions(poolForm)
  const order = toOrder(orderForm)

  function changeSelection(next: string[]) {
    selectionVersion.current++
    setSelectedIds(next)
    setShares(equalShares(next))
    setMix(null)
    sendMix.reset()
    setGenerateFailed(false)
    setGenerating(false)
    setLeftOut([])
  }

  function deselect(id: string) {
    changeSelection(selectedIds.filter((other) => other !== id))
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) deselect(id)
    else changeSelection([...selectedIds, id])
  }

  /** Nothing is left behind: the temporary playlist goes first, then the session. */
  async function logOut() {
    setLoggingOut(true)
    // If removing fails, the next visit finds the playlist and offers to remove it.
    await sendMix.cleanUp()
    onLogout?.()
  }

  async function generate() {
    if (!pool || !order) return
    const weighting: Weighting =
      weightingMode === 'custom' ? { mode: 'custom', weights: shares } : { mode: weightingMode }
    const version = selectionVersion.current
    sendMix.reset()
    setGenerating(true)
    setGenerateFailed(false)
    setLeftOut([])
    try {
      const reads = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            return { id, tracks: await gateway.getSourceTracks(id) }
          } catch (error) {
            if (error instanceof SourceUnavailableError) return { id, tracks: null }
            throw error
          }
        }),
      )
      if (version !== selectionVersion.current) return
      const mixSources = reads.flatMap(({ id, tracks }) => (tracks ? [{ id, tracks }] : []))
      const unavailable = reads.filter(({ tracks }) => tracks === null).map(({ id }) => id)
      if (unavailable.length > 0) {
        setUnavailableIds((previous) => [...new Set([...previous, ...unavailable])])
        setSelectedIds(mixSources.map(({ id }) => id))
        setLeftOut(selected.filter((source) => unavailable.includes(source.id)))
      }
      const options = { pool, weighting, order, spreadArtists: orderForm.spreadArtists }
      setMix(mixSources.length > 0 ? buildMix(mixSources, options, createRng(newSeed())) : null)
    } catch {
      if (version === selectionVersion.current) setGenerateFailed(true)
    } finally {
      if (version === selectionVersion.current) setGenerating(false)
    }
  }

  return (
    <main className="page">
      <p className="mixer-nav">
        <Link to="/">Home</Link>
        {canSend && sendMix.playlistId && !sendMix.isLeftover && (
          <button
            className="link-button"
            type="button"
            title={`Remove “${TEMPORARY_PLAYLIST.name}” from your Spotify library`}
            disabled={sendMix.busy || loggingOut}
            onClick={() => sendMix.cleanUp()}
          >
            Clean up
          </button>
        )}
        {onLogout && (
          <button className="link-button" type="button" disabled={loggingOut} onClick={logOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        )}
      </p>
      <h1>Build a mix</h1>
      <p className="muted">{subtitle}</p>

      {canSend && sendMix.isLeftover && (
        <section className="leftover" aria-labelledby="leftover-heading">
          <h2 id="leftover-heading">An earlier mix is still in your library</h2>
          <p>
            &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo; is left from an earlier visit. Remove it, or keep it and your
            next mix will replace it.
          </p>
          <p className="actions">
            <button type="button" disabled={sendMix.busy || loggingOut} onClick={() => sendMix.cleanUp()}>
              Remove it
            </button>
            <button type="button" disabled={sendMix.busy || loggingOut} onClick={sendMix.keepLeftover}>
              Keep it
            </button>
          </p>
        </section>
      )}
      {canSend &&
        !loggingOut &&
        (sendMix.cleanup === 'failed' ? (
          <p role="alert">
            Couldn&rsquo;t remove &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo; from your library. Try again.
          </p>
        ) : (
          <p role="status">{cleanupMessage(sendMix.cleanup)}</p>
        ))}

      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        {loadFailed ? (
          <p role="alert">Couldn&rsquo;t load the playlists. Reload the page to try again.</p>
        ) : sources === null ? (
          <p className="muted">Loading playlists…</p>
        ) : (
          <SourcePicker
            sources={sources}
            selectedIds={selectedIds}
            unavailableIds={unavailableIds}
            onToggle={toggle}
          />
        )}
      </section>

      <section aria-labelledby="selection-heading">
        <h2 id="selection-heading">Selected</h2>
        {selected.length === 0 ? (
          <p className="muted">Nothing selected yet.</p>
        ) : (
          <ul className="selection">
            {selected.map((source) => (
              <li key={source.id}>
                <span>{source.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${source.name}`}
                  onClick={() => deselect(source.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PoolSettings form={poolForm} onChange={setPoolForm} />

      <section aria-labelledby="weighting-heading">
        <h2 id="weighting-heading">Weighting</h2>
        <fieldset className="mode-options">
          <legend>How often each source plays</legend>
          {WEIGHTING_MODES.map(({ mode, label, hint }) => (
            <label key={mode}>
              <input
                type="radio"
                name="weighting"
                value={mode}
                checked={weightingMode === mode}
                onChange={() => setWeightingMode(mode)}
              />
              <span className="source-name">{label}</span>
              <span className="muted">{hint}</span>
            </label>
          ))}
        </fieldset>
        {weightingMode === 'custom' &&
          (selected.length === 0 ? (
            <p className="muted">Select sources to set their shares.</p>
          ) : (
            <>
              <ul className="weights">
                {selected.map((source) => {
                  const share = shares[source.id] ?? 0
                  return (
                    <li key={source.id}>
                      <label htmlFor={`weight-${source.id}`}>{source.name}</label>
                      <input
                        id={`weight-${source.id}`}
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={share}
                        aria-valuetext={`${share}%`}
                        onChange={(event) => setShares(setShare(shares, source.id, Number(event.target.value)))}
                      />
                      <output htmlFor={`weight-${source.id}`}>{share}%</output>
                    </li>
                  )
                })}
              </ul>
              <p className="muted">
                Shares always add up to 100%. When a source runs out, the rest keep their proportions.
              </p>
            </>
          ))}
      </section>

      <OrderSettings form={orderForm} onChange={setOrderForm} />

      <div>
        <p>
          <button
            type="button"
            disabled={selected.length < MIN_SOURCES || !pool || !order || generating || sendMix.busy}
            onClick={generate}
          >
            {mix ? 'Regenerate' : 'Generate mix'}
          </button>
        </p>
        {selected.length < MIN_SOURCES && <p className="muted">Select at least {MIN_SOURCES} sources.</p>}
        {!pool && (
          <p className="muted">
            Check the track settings: the shortest length can&rsquo;t exceed the longest, and the number of
            tracks must be a whole number.
          </p>
        )}
        {!order && <p className="muted">Check the block size: it must be a whole number of tracks.</p>}
        {generateFailed && <p role="alert">Couldn&rsquo;t read the tracks. Try again.</p>}
        <p role="status">{leftOut.length > 0 && unavailableNotice(leftOut)}</p>
      </div>

      {mix && (
        <section aria-labelledby="mix-heading">
          <h2 id="mix-heading">Your mix</h2>
          <p>{mix.length === 0 ? 'No tracks match these settings.' : trackCountLabel(mix.length)}</p>
          {mix.length > 0 &&
            (canSend ? (
              <SendMix
                state={sendMix.state}
                busy={sendMix.busy}
                onSend={() => sendMix.send(mix.map(({ track }) => track.id))}
                onRetryPlayback={sendMix.retryPlayback}
              />
            ) : (
              <p className="muted">Demo mode: log in to play a mix on Spotify.</p>
            ))}
          <ol aria-label="Mix">
            {mix.map(({ track }, index) => (
              <li key={`${index}-${track.id}`}>
                {track.name} — {track.artists.join(', ')}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  )
}

function cleanupMessage(cleanup: Exclude<CleanupState, 'failed'>) {
  switch (cleanup) {
    case 'removing':
      return <>Removing &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo;…</>
    case 'removed':
      return <>Removed &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo; from your library.</>
    default:
      return null
  }
}

function unavailableNotice(sources: Source[]) {
  const names = sources.map((source) => source.name)
  if (names.length === 1) {
    return `${names[0]} is unavailable: Spotify doesn't let Randomizer read its tracks, so it was left out.`
  }
  const list = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `${list} are unavailable: Spotify doesn't let Randomizer read their tracks, so they were left out.`
}
