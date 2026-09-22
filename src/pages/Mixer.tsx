import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { TEMPORARY_PLAYLIST, playlistUrl, splitLibrary } from '../app/temporaryPlaylist'
import { StrikeIcon } from '../components/icons'
import { SourcePicker } from '../components/SourcePicker'
import { SpotifyCredit } from '../components/SpotifyCredit'
import { durationAttr, durationLabel, trackCountLabel, trackCountParts, trackTimeLabel } from '../format'
import { buildMix, reshuffleRemaining, type MixItem, type MixOptions, type Weighting } from '../mixer/engine'
import { createRng, randomSeed } from '../mixer/random'
import { equalShares, setShare, sharesByWeight, type Shares } from '../mixer/shares'
import { SourceUnavailableError } from '../spotify/errors'
import type { SpotifyGateway } from '../spotify/gateway'
import { trackUrl } from '../spotify/links'
import type { Source } from '../spotify/types'
import { defaultOrderForm, toOrder } from './orderForm'
import { OrderSettings } from './OrderSettings'
import { defaultPoolForm, toPoolOptions } from './poolForm'
import { PoolSettings } from './PoolSettings'
import { ReshuffleControls } from './ReshuffleControls'
import { SendMix } from './SendMix'
import { useSendMix, type CleanupState, type SendState } from './useSendMix'
import './Mixer.css'

/** A mix needs at least this many sources. */
const MIN_SOURCES = 2

/**
 * How many tracks the mix lists on screen. The list is a receipt, not the
 * product: the mix itself is never truncated, and the whole of it is one tap
 * away in Spotify, which draws long lists better than this page can.
 */
const PREVIEW_ROWS = 6

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
  // The options the mix was built with, which a reshuffle keeps.
  const [mixOptions, setMixOptions] = useState<MixOptions>({})
  // The seed the current mix came from, shown on the rail as its catalogue number.
  const [mixSeed, setMixSeed] = useState<number | null>(null)
  // Where playback is in the mix, when known: the demo's simulated player, or the last reshuffle.
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [reshuffling, setReshuffling] = useState(false)
  const [reshuffleNotice, setReshuffleNotice] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateFailed, setGenerateFailed] = useState(false)
  const [poolForm, setPoolForm] = useState(defaultPoolForm)
  const [orderForm, setOrderForm] = useState(defaultOrderForm)
  const [loggingOut, setLoggingOut] = useState(false)
  // Bumped whenever the selection changes, so a mix built for an older selection is discarded.
  const selectionVersion = useRef(0)
  const countRef = useRef<HTMLSpanElement>(null)

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
  const blocked = selected.length < MIN_SOURCES || !pool || !order
  // What the chosen weighting actually works out to, so the rail shows the blend
  // every mode produces and not only the one the user typed in by hand.
  const railShares =
    weightingMode === 'custom'
      ? shares
      : sharesByWeight(
          selected.map((source) => ({
            id: source.id,
            weight: weightingMode === 'uniform' ? source.trackCount : 1,
          })),
        )

  function changeSelection(next: string[]) {
    selectionVersion.current++
    setSelectedIds(next)
    setShares(equalShares(next))
    showMix(null, {}, null)
    sendMix.reset()
    setGenerateFailed(false)
    setGenerating(false)
    setLeftOut([])
  }

  /** Shows a new mix, from the start: the demo's pretend player starts on its first track. */
  function showMix(next: MixItem[] | null, options: MixOptions, seed: number | null) {
    setMix(next)
    setMixOptions(options)
    setMixSeed(seed)
    setPlayingIndex(canSend ? null : 0)
    setReshuffleNotice(null)
    setReshuffling(false)
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
      const seed = newSeed()
      showMix(mixSources.length > 0 ? buildMix(mixSources, options, createRng(seed)) : null, options, seed)
    } catch {
      if (version === selectionVersion.current) setGenerateFailed(true)
    } finally {
      if (version === selectionVersion.current) setGenerating(false)
    }
  }

  /** Where the mix is playing on Spotify, or null when Spotify isn't playing it. */
  async function findPlaying(current: MixItem[]): Promise<number | null> {
    if (sendMix.state.step !== 'sent') return null
    const playlistId = sendMix.state.playlistId
    const playback = await gateway.getPlaybackState()
    if (!playback || playback.playlistId !== playlistId || !playback.trackId) return null
    // A track can be in the mix twice: prefer the copy at or after the last known position.
    const ids = trackIds(current)
    const from = playingIndex ?? 0
    const later = ids.indexOf(playback.trackId, from)
    const position = later === -1 ? ids.indexOf(playback.trackId) : later
    return position === -1 ? null : position
  }

  async function reshuffle() {
    if (!mix) return
    const current = mix
    const version = selectionVersion.current
    setReshuffling(true)
    setReshuffleNotice(null)
    try {
      const position = canSend ? await findPlaying(current) : (playingIndex ?? 0)
      if (version !== selectionVersion.current) return
      if (position === null) {
        setReshuffleNotice(NOT_PLAYING)
        return
      }
      const rest = current.length - position - 1
      if (rest === 0) {
        setReshuffleNotice(LAST_TRACK)
        return
      }

      const next = reshuffleRemaining(current, position, mixOptions, createRng(newSeed()))
      if (canSend) {
        const written = await sendMix.replaceTail(
          trackIds(current.slice(0, position + 1)),
          trackIds(current.slice(position + 1)),
          trackIds(next.slice(position + 1)),
        )
        if (!written || version !== selectionVersion.current) return
      }
      setMix(next)
      setPlayingIndex(position)
      setReshuffleNotice(`Reshuffled the ${trackCountLabel(rest)} after the one playing now.`)
    } catch {
      if (version === selectionVersion.current) setReshuffleNotice('Couldn’t check what’s playing on Spotify. Try again.')
    } finally {
      if (version === selectionVersion.current) setReshuffling(false)
    }
  }

  const sendable = canSend && mix !== null && mix.length > 0
  const runningMs = mix ? mix.reduce((total, { track }) => total + track.durationMs, 0) : 0
  useCountUp(mix ? mix.length : null, countRef)

  /*
   * The mix sits directly under the share rail, above the settings that shape it:
   * the thing being made and the controls that make it are one surface, and a new
   * mix is never a change below the fold.
   */
  const mixSection = mix && (
    <section className="block" aria-labelledby="mix-heading">
      <h2 id="mix-heading">Your mix</h2>
      {mix.length === 0 ? (
        <p className="muted">No tracks match these settings.</p>
      ) : canSend ? (
        <SendMix state={sendMix.state} busy={sendMix.busy || reshuffling} onRetryPlayback={sendMix.retryPlayback} />
      ) : (
        <p className="hint">Demo mode: log in to play a mix on Spotify.</p>
      )}
      {mix.length > 0 && (!canSend || sendMix.state.step === 'sent' || reshuffling) && (
        <ReshuffleControls
          simulatedPosition={canSend ? null : (playingIndex ?? 0)}
          mixLength={mix.length}
          disabled={reshuffling || sendMix.busy}
          notice={reshuffleNotice}
          onNextTrack={() => {
            setPlayingIndex((index) => Math.min((index ?? 0) + 1, mix.length - 1))
            setReshuffleNotice(null)
          }}
          onReshuffle={reshuffle}
        />
      )}
      <ol className="mix-tracks" aria-label="Mix">
        {mix.slice(0, PREVIEW_ROWS).map(({ track }, index) => (
          <li key={`${index}-${track.id}`} aria-current={index === playingIndex ? 'true' : undefined}>
            {/* Spotify requires every track shown to link back to its own page. */}
            <a href={trackUrl(track.id)} target="_blank" rel="noreferrer">
              <span className="track-name">{track.name}</span>
              <span className="visually-hidden"> — </span>
              <span className="track-artists">{track.artists.join(', ')}</span>
              <time className="track-time" dateTime={durationAttr(track.durationMs)}>
                {trackTimeLabel(track.durationMs)}
              </time>
            </a>
          </li>
        ))}
      </ol>
      {mix.length > PREVIEW_ROWS && <p className="mix-rest">{restOfMix(mix.length, sendMix.state)}</p>}
    </section>
  )

  return (
    <main className="page">
      <div className="rail">
        <Link className="rail-mark" to="/">
          Randomizer
        </Link>
        {/* The catalogue number is this mix's seed: no mix yet, no entry yet. */}
        <span className="rail-code" aria-hidden="true">
          {mixSeed === null ? '——————' : catalogueNumber(mixSeed)}
        </span>
        <span className="rail-actions">
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
          <SpotifyCredit label="Your playlists" />
        </span>
      </div>

      <h1>Build a mix</h1>
      <p className="muted">{subtitle}</p>

      {canSend && sendMix.isLeftover && (
        <section className="block" aria-labelledby="leftover-heading">
          <h2 id="leftover-heading">An earlier mix is still in your library</h2>
          <p>
            &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo; is left from an earlier visit. Remove it, or keep it and your
            next mix will replace it.
          </p>
          <p className="actions">
            <button
              className="button"
              type="button"
              disabled={sendMix.busy || loggingOut}
              onClick={() => sendMix.cleanUp()}
            >
              Remove it
            </button>
            <button className="button" type="button" disabled={sendMix.busy || loggingOut} onClick={sendMix.keepLeftover}>
              Keep it
            </button>
          </p>
        </section>
      )}
      {canSend &&
        !loggingOut &&
        (sendMix.cleanup === 'failed' ? (
          <p className="notice" data-label="Cleanup" role="alert">
            Couldn&rsquo;t remove &ldquo;{TEMPORARY_PLAYLIST.name}&rdquo; from your library. Try again.
          </p>
        ) : (
          <p role="status" className={sendMix.cleanup === 'idle' ? undefined : 'hint'}>
            {cleanupMessage(sendMix.cleanup)}
          </p>
        ))}

      <section className="block" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        {loadFailed ? (
          <p className="notice" data-label="Sources" role="alert">
            Couldn&rsquo;t load the playlists. Reload the page to try again.
          </p>
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

      <section className="block" aria-labelledby="selection-heading">
        <h2 id="selection-heading">Selected</h2>
        {/*
         * The share rail: one field reading 100% across. Uniform, balanced and custom
         * are the same mechanism with different weights, so they all read here. An
         * empty selection keeps the field and says what it needs, rather than
         * replacing the object with a sentence.
         */}
        <div
          className={selected.length === 0 ? 'share-rail waiting' : 'share-rail'}
          role="img"
          aria-label={
            selected.length === 0
              ? `No sources selected. Pick at least ${MIN_SOURCES} to build a mix.`
              : railLabel(selected, railShares)
          }
        >
          {selected.length === 0 ? (
            <span className="share-waiting">Pick at least {MIN_SOURCES}</span>
          ) : (
            selected.map((source, index) => {
              const share = railShares[source.id] ?? 0
              return (
                <span
                  key={source.id}
                  className={share === 0 ? 'share-seg empty' : 'share-seg'}
                  style={share === 0 ? undefined : { flexGrow: share }}
                >
                  <b className="seg-index">{index + 1}</b>
                  <b className="seg-share">{share}%</b>
                </span>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <ul className="selection">
            {selected.map((source, index) => (
              <li key={source.id}>
                <span className="chip-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{source.name}</span>
                <span className="chip-share" aria-hidden="true">
                  {railShares[source.id] ?? 0}%
                </span>
                <button type="button" aria-label={`Remove ${source.name}`} onClick={() => deselect(source.id)}>
                  <StrikeIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mixSection}

      <PoolSettings form={poolForm} onChange={setPoolForm} />

      <section className="block" aria-labelledby="weighting-heading">
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
              <p className="hint">
                Shares always add up to 100%. When a source runs out, the rest keep their proportions.
              </p>
            </>
          ))}
      </section>

      <OrderSettings form={orderForm} onChange={setOrderForm} />

      {generateFailed && (
        <p className="notice" data-label="Tracks" role="alert">
          Couldn&rsquo;t read the tracks. Try again.
        </p>
      )}
      <p role="status" className="hint">
        {leftOut.length > 0 && unavailableNotice(leftOut)}
      </p>

      {/*
       * The ticket. It stays with the listener, so pressing Generate produces
       * something visible and reachable instead of a change below the fold.
       */}
      <div className="ticket">
        {/*
         * The count is the entry: the numeral at catalogue scale, its unit and the
         * running time as the label beside it. Before there is a mix, the same slot
         * says what it still needs rather than standing empty.
         */}
        {mix ? (
          <div className="ticket-entry">
            {/*
             * Split for the eye, whole for the ear: the numeral carries catalogue
             * scale while a screen reader still hears one phrase.
             */}
            <p className="ticket-count">
              <span className="visually-hidden">{trackCountLabel(mix.length)}</span>
              <span className="ticket-number" aria-hidden="true" ref={countRef}>
                {mix.length}
              </span>
              <span className="ticket-unit" aria-hidden="true">
                {trackCountParts(mix.length).unit}
              </span>
            </p>
            <time className="ticket-time" dateTime={durationAttr(runningMs)}>
              {durationLabel(runningMs)}
            </time>
          </div>
        ) : (
          <p className="ticket-status">{blockedReason(selected.length, pool, order)}</p>
        )}
        <p className="actions">
          {mix && (
            <a className="ticket-jump" href="#mix-settings">
              Settings
            </a>
          )}
          <button
            className={sendable ? 'button' : 'button button-stamp'}
            type="button"
            disabled={blocked || generating || sendMix.busy || reshuffling}
            onClick={generate}
          >
            {mix ? 'Regenerate' : 'Generate mix'}
          </button>
          {sendable && (
            <button
              className="button button-stamp"
              type="button"
              disabled={sendMix.busy || reshuffling}
              onClick={() => {
                setPlayingIndex(null)
                setReshuffleNotice(null)
                sendMix.send(trackIds(mix))
              }}
            >
              Play on Spotify
            </button>
          )}
        </p>
      </div>
    </main>
  )
}

function trackIds(items: MixItem[]): string[] {
  return items.map(({ track }) => track.id)
}

/**
 * The ticket's count runs up to a new total instead of snapping, so a new mix is
 * something the listener sees happen. React renders the real number; this only
 * paints the frames in between, and reduced motion gets none of them.
 */
function useCountUp(target: number | null, node: RefObject<HTMLElement | null>) {
  const from = useRef<number | null>(null)

  useEffect(() => {
    const element = node.current
    const start = from.current
    from.current = target
    if (element === null || target === null) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced || start === null || start === target || typeof requestAnimationFrame !== 'function') return

    const began = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - began) / 420)
      const eased = 1 - (1 - progress) ** 3
      element.textContent = String(Math.round(start + (target - start) * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, node])
}

/** This mix's entry in the catalogue, from the seed that produced it. */
function catalogueNumber(seed: number): string {
  return `RND-${Math.abs(seed).toString(36).toUpperCase().padStart(6, '0').slice(-6)}`
}

/** The share rail's picture, in words, for anyone who can't see the field. */
function railLabel(sources: Source[], shares: Shares): string {
  const parts = sources.map((source) => `${source.name} ${shares[source.id] ?? 0}%`)
  return `Share of the mix: ${parts.join(', ')}`
}

/** What the ticket says while Generate can't run: the count's slot, not an empty one. */
function blockedReason(
  selectedCount: number,
  pool: ReturnType<typeof toPoolOptions>,
  order: ReturnType<typeof toOrder>,
): string {
  if (selectedCount < MIN_SOURCES) return `${MIN_SOURCES - selectedCount} more to pick`
  if (!pool) return 'Check the track settings'
  if (!order) return 'Check the block size'
  return 'Ready'
}

/** The rest of the mix: on Spotify once it is there, otherwise just its size. */
function restOfMix(total: number, state: SendState) {
  const rest = total - PREVIEW_ROWS
  if (state.step === 'sent') {
    return (
      <a href={playlistUrl(state.playlistId)} target="_blank" rel="noreferrer">
        {trackCountLabel(rest)} more on Spotify
      </a>
    )
  }
  return `${trackCountLabel(rest)} more in the mix.`
}

const NOT_PLAYING = 'Your mix isn’t playing on Spotify right now. Start it there, then try again.'
const LAST_TRACK = 'The last track of the mix is playing: there’s nothing left to reshuffle.'

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
