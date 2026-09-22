import { useId, useState, type CSSProperties } from 'react'
import { trackCountLabel } from '../format'
import { sourceUrl } from '../spotify/links'
import type { Source } from '../spotify/types'
import { OpenIcon } from './icons'

interface SourcePickerProps {
  sources: Source[]
  selectedIds: string[]
  /** Sources Spotify won't let the app read; shown but not selectable. */
  unavailableIds: string[]
  onToggle: (id: string) => void
}

/**
 * The rack: one spine per source, searchable by name. A selected spine is struck
 * with its place in the rotation, which is the same number the share rail uses.
 */
export function SourcePicker({ sources, selectedIds, unavailableIds, onToggle }: SourcePickerProps) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const needle = query.trim().toLocaleLowerCase()
  const shown = needle ? sources.filter((source) => source.name.toLocaleLowerCase().includes(needle)) : sources

  return (
    <>
      <p className="source-search">
        <label htmlFor={searchId}>Search playlists</label>
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </p>
      {shown.length === 0 ? (
        <p className="muted">No playlists match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <ul className="source-list">
          {shown.map((source, index) => {
            const unavailable = unavailableIds.includes(source.id)
            const place = selectedIds.indexOf(source.id)
            return (
              <li
                key={source.id}
                data-reveal=""
                // Cells stamp in a short run that repeats, so a 150-playlist rack
                // never has a last cell waiting four seconds for its turn.
                style={{ '--i': index % 8 } as CSSProperties}
              >
                <label className={unavailable ? 'spine unavailable' : 'spine'}>
                  <input
                    className="visually-hidden"
                    type="checkbox"
                    checked={!unavailable && place !== -1}
                    disabled={unavailable}
                    onChange={() => onToggle(source.id)}
                  />
                  {/* The index is the selection; a source not in the mix has no number yet. */}
                  <span className="spine-index" aria-hidden="true">
                    {place === -1 ? '' : place + 1}
                  </span>
                  {source.imageUrl ? (
                    <img className="source-cover" src={source.imageUrl} alt="" width={48} height={48} loading="lazy" />
                  ) : (
                    // No sleeve on file: the slot is drawn as an empty cell, not left blank.
                    <span className="source-cover no-sleeve" aria-hidden="true" />
                  )}
                  <span className="source-text">
                    <span className="source-name">{source.name}</span>
                    <span className="source-meta">
                      {source.owner} · {trackCountLabel(source.trackCount)}
                      {unavailable && ' · Unavailable'}
                    </span>
                  </span>
                </label>
                {/* Spotify requires every playlist shown to link back to its page. */}
                <a
                  className="spine-link"
                  href={sourceUrl(source.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${source.name} on Spotify`}
                >
                  <OpenIcon />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
