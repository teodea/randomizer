import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { buildMix, type MixItem } from '../mixer/engine'
import { createRng, randomSeed } from '../mixer/random'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Source } from '../spotify/types'
import { defaultPoolForm, toPoolOptions } from './poolForm'
import { PoolSettings } from './PoolSettings'
import './Mixer.css'

/** A mix needs at least this many sources. */
const MIN_SOURCES = 2

interface MixerProps {
  gateway: SpotifyGateway
  /** Seed for each new mix; injectable so tests get predictable orders. */
  newSeed?: () => number
}

export function Mixer({ gateway, newSeed = randomSeed }: MixerProps) {
  const [sources, setSources] = useState<Source[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mix, setMix] = useState<MixItem[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateFailed, setGenerateFailed] = useState(false)
  const [poolForm, setPoolForm] = useState(defaultPoolForm)
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

  function changeSelection(next: string[]) {
    selectionVersion.current++
    setSelectedIds(next)
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
    if (!pool) return
    const version = selectionVersion.current
    setGenerating(true)
    setGenerateFailed(false)
    try {
      const mixSources = await Promise.all(
        selectedIds.map(async (id) => ({ id, tracks: await gateway.getSourceTracks(id) })),
      )
      if (version !== selectionVersion.current) return
      setMix(buildMix(mixSources, { pool }, createRng(newSeed())))
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

      <PoolSettings form={poolForm} onChange={setPoolForm} />

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
        <p>
          <button type="button" disabled={selected.length < MIN_SOURCES || !pool || generating} onClick={generate}>
            {mix ? 'Regenerate' : 'Generate mix'}
          </button>
        </p>
        {selected.length < MIN_SOURCES && <p className="muted">Select at least {MIN_SOURCES} sources.</p>}
        {!pool && <p className="muted">Check the track settings: durations and the number of tracks must be valid.</p>}
        {generateFailed && <p role="alert">Couldn&rsquo;t read the tracks. Try again.</p>}
      </section>

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

function trackCountLabel(count: number) {
  return `${count} ${count === 1 ? 'track' : 'tracks'}`
}
