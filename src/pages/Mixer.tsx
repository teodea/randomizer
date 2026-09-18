import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
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
  /** Extra controls next to the Home link, e.g. Log out. */
  actions?: ReactNode
  /** Seed for each new mix; injectable so tests get predictable orders. */
  newSeed?: () => number
}

export function Mixer({
  gateway,
  subtitle = 'Demo mode: sample playlists, no login.',
  actions,
  newSeed = randomSeed,
}: MixerProps) {
  const [sources, setSources] = useState<Source[] | null>(null)
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
  // Bumped whenever the selection changes, so a mix built for an older selection is discarded.
  const selectionVersion = useRef(0)

  useEffect(() => {
    let active = true
    gateway.listSources().then(
      (list) => active && setSources(list),
      () => active && setLoadFailed(true),
    )
    return () => {
      active = false
    }
  }, [gateway])

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

  async function generate() {
    if (!pool || !order) return
    const weighting: Weighting =
      weightingMode === 'custom' ? { mode: 'custom', weights: shares } : { mode: weightingMode }
    const version = selectionVersion.current
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
        {actions}
      </p>
      <h1>Build a mix</h1>
      <p className="muted">{subtitle}</p>

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
            disabled={selected.length < MIN_SOURCES || !pool || !order || generating}
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

function unavailableNotice(sources: Source[]) {
  const names = sources.map((source) => source.name)
  if (names.length === 1) {
    return `${names[0]} is unavailable: Spotify doesn't let Randomizer read its tracks, so it was left out.`
  }
  const list = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `${list} are unavailable: Spotify doesn't let Randomizer read their tracks, so they were left out.`
}
