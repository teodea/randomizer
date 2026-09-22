import { useId, useState, type CSSProperties } from 'react'
import { sourceCountLabel, trackCountLabel } from '../format'
import { sourceUrl } from '../spotify/links'
import type { Source } from '../spotify/types'
import { OpenIcon } from './icons'

interface SourcePickerProps {
  sources: Source[]
  selectedIds: string[]
  /** Ids last mixed, most recent first; they rank under the selection. */
  recentIds: string[]
  /** Sources Spotify won't let the app read; shown but not selectable. */
  unavailableIds: string[]
  onToggle: (id: string) => void
}

/**
 * The rack: one spine per source, searchable by name. A selected spine is struck
 * with its place in the rotation, which is the same number the share rail uses.
 *
 * On anything narrower than the board the rack is a *window* onto the library
 * rather than the whole of it — five rows and a sixth cut in half — so a library
 * of two hundred playlists stops being the entire page and everything the mixer
 * does stays within a screen of the top. The window is only bearable because
 * what it shows first is ranked: chosen, then last mixed, then Spotify's order.
 */
export function SourcePicker({ sources, selectedIds, recentIds, unavailableIds, onToggle }: SourcePickerProps) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const needle = query.trim().toLocaleLowerCase()

  /*
   * The order settles; it does not follow the finger. Ranking the selection live
   * would send the row you just tapped to the top of a window you have scrolled
   * away from — it would vanish under your thumb, which is the one thing a touch
   * list may never do. So the selection is read when the order is *re-settled*:
   * when the library arrives, when the search changes, when a mix is made.
   * Between those, tapping a spine stamps it and moves nothing.
   *
   * Re-settling on render, rather than in an effect, is React's own way of
   * recomputing state from changed props: the new order is on screen in the same
   * paint as the change that caused it, so the rack never flashes its old order.
   */
  const [settled, setSettled] = useState(() => settle(sources, selectedIds, recentIds, query))
  if (settled.sources !== sources || settled.recentIds !== recentIds || settled.query !== query) {
    setSettled(settle(sources, selectedIds, recentIds, query))
  }

  const shown = needle
    ? settled.order.filter((source) => source.name.toLocaleLowerCase().includes(needle))
    : settled.order

  return (
    <>
      <p className="source-search">
        <span className="rack-head">
          <label htmlFor={searchId}>Search playlists</label>
          {/*
           * The count is the window's honesty: it says how much of the library is
           * behind the five rows on screen, and how much a search has cut it to.
           *
           * `aria-live` rather than `role="status"`: the announcement is the same,
           * but the page does not gain a second status region for a screen reader
           * to enumerate alongside the one that reports what a mix left out.
           */}
          <span className="rack-count" aria-live="polite" aria-atomic="true">
            {needle ? `${shown.length} of ${sources.length}` : sourceCountLabel(sources.length)}
          </span>
        </span>
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

/**
 * A settled order, kept beside the inputs it was settled from. The inputs are
 * compared by identity, which is why `sources` has to be the same array between
 * renders — `Mixer` memoises it — or the rack would re-settle on every keystroke
 * anywhere on the page.
 */
interface SettledOrder {
  sources: Source[]
  recentIds: string[]
  query: string
  order: Source[]
}

function settle(sources: Source[], selectedIds: string[], recentIds: string[], query: string): SettledOrder {
  return { sources, recentIds, query, order: rankSources(sources, selectedIds, recentIds) }
}

/**
 * The rack's order: what you have chosen, then what you last mixed, then the
 * library as Spotify hands it over. Sort is stable, so everything unranked keeps
 * that order exactly rather than being shuffled into a new arbitrary one.
 */
function rankSources(sources: Source[], selectedIds: string[], recentIds: string[]): Source[] {
  const place = (id: string) => {
    const chosen = selectedIds.indexOf(id)
    if (chosen !== -1) return chosen
    const recent = recentIds.indexOf(id)
    // A finite floor, not Infinity: `Infinity - Infinity` is NaN and would
    // silently corrupt the comparison between two unranked sources.
    return recent === -1 ? Number.MAX_SAFE_INTEGER : selectedIds.length + recent
  }
  return [...sources].sort((a, b) => place(a.id) - place(b.id))
}
