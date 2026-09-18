import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { buildMix, type MixItem, type Weighting } from '../mixer/engine'
import { createRng, randomSeed } from '../mixer/random'
import { equalShares, setShare, type Shares } from '../mixer/shares'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Source } from '../spotify/types'
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
  /** Seed for each new mix; injectable so tests get predictable orders. */
  newSeed?: () => number
}

export function Mixer({ gateway, newSeed = randomSeed }: MixerProps) {
  const [sources, setSources] = useState<Source[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [weightingMode, setWeightingMode] = useState<WeightingMode>('uniform')
  const [shares, setShares] = useState<Shares>({})
  const [mix, setMix] = useState<MixItem[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateFailed, setGenerateFailed] = useState(false)
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

  function changeSelection(next: string[]) {
    selectionVersion.current++
    setSelectedIds(next)
    setShares(equalShares(next))
    setMix(null)
    setGenerateFailed(false)
    setGenerating(false)
  }

  function deselect(id: string) {
    changeSelection(selectedIds.filter((other) => other !== id))
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) deselect(id)
    else changeSelection([...selectedIds, id])
  }

  async function generate() {
    const weighting: Weighting =
      weightingMode === 'custom' ? { mode: 'custom', weights: shares } : { mode: weightingMode }
    const version = selectionVersion.current
    setGenerating(true)
    setGenerateFailed(false)
    try {
      const mixSources = await Promise.all(
        selectedIds.map(async (id) => ({ id, tracks: await gateway.getSourceTracks(id) })),
      )
      if (version !== selectionVersion.current) return
      setMix(buildMix(mixSources, { weighting }, createRng(newSeed())))
    } catch {
      if (version === selectionVersion.current) setGenerateFailed(true)
    } finally {
      if (version === selectionVersion.current) setGenerating(false)
    }
  }

  return (
    <main className="page">
      <p>
        <Link to="/">Home</Link>
      </p>
      <h1>Build a mix</h1>
      <p className="muted">Demo mode: sample playlists, no login.</p>

      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        {loadFailed ? (
          <p role="alert">Couldn&rsquo;t load the playlists. Reload the page to try again.</p>
        ) : sources === null ? (
          <p className="muted">Loading playlists…</p>
        ) : (
          <ul className="source-list">
            {sources.map((source) => (
              <li key={source.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(source.id)}
                    onChange={() => toggle(source.id)}
                  />
                  <span className="source-name">{source.name}</span>
                  <span className="muted">
                    {source.owner} · {trackCountLabel(source.trackCount)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
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

      <section aria-labelledby="weighting-heading">
        <h2 id="weighting-heading">Weighting</h2>
        <fieldset className="weighting-modes">
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
                {selected.map((source) => (
                  <li key={source.id}>
                    <label htmlFor={`weight-${source.id}`}>{source.name}</label>
                    <input
                      id={`weight-${source.id}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={shares[source.id] ?? 0}
                      aria-valuetext={`${shares[source.id] ?? 0}%`}
                      onChange={(event) => setShares(setShare(shares, source.id, Number(event.target.value)))}
                    />
                    <output htmlFor={`weight-${source.id}`}>{shares[source.id] ?? 0}%</output>
                  </li>
                ))}
              </ul>
              <p className="muted">
                Shares always add up to 100%. When a source runs out, the rest keep their proportions.
              </p>
            </>
          ))}
      </section>

      <div>
        <p>
          <button type="button" disabled={selected.length < MIN_SOURCES || generating} onClick={generate}>
            {mix ? 'Regenerate' : 'Generate mix'}
          </button>
        </p>
        {selected.length < MIN_SOURCES && <p className="muted">Select at least {MIN_SOURCES} sources.</p>}
        {generateFailed && <p role="alert">Couldn&rsquo;t read the tracks. Try again.</p>}
      </div>

      {mix && (
        <section aria-labelledby="mix-heading">
          <h2 id="mix-heading">Your mix</h2>
          <p>{trackCountLabel(mix.length)}</p>
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

function trackCountLabel(count: number) {
  return `${count} ${count === 1 ? 'track' : 'tracks'}`
}
