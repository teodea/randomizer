import { useId, useState } from 'react'
import { trackCountLabel } from '../format'
import type { Source } from '../spotify/types'

interface SourcePickerProps {
  sources: Source[]
  selectedIds: string[]
  /** Sources Spotify won't let the app read; shown but not selectable. */
  unavailableIds: string[]
  onToggle: (id: string) => void
}

/** The list of sources to pick from, searchable by name. */
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
          {shown.map((source) => {
            const unavailable = unavailableIds.includes(source.id)
            return (
              <li key={source.id}>
                <label className={unavailable ? 'unavailable' : undefined}>
                  <input
                    type="checkbox"
                    checked={!unavailable && selectedIds.includes(source.id)}
                    disabled={unavailable}
                    onChange={() => onToggle(source.id)}
                  />
                  {source.imageUrl ? (
                    <img className="source-cover" src={source.imageUrl} alt="" width={48} height={48} loading="lazy" />
                  ) : (
                    <span className="source-cover" aria-hidden="true" />
                  )}
                  <span className="source-text">
                    <span className="source-name">{source.name}</span>
                    <span className="muted">
                      {source.owner} · {trackCountLabel(source.trackCount)}
                      {unavailable && ' · Unavailable'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
