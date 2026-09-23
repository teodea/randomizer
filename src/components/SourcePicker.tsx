import { useId, useState, type CSSProperties } from 'react'
import { trackCountLabel } from '../format'
import { sourceUrl } from '../spotify/links'
import type { Source } from '../spotify/types'
import { ChevronIcon, OpenIcon } from './icons'
import { Segmented } from './Segmented'

interface SourcePickerProps {
  sources: Source[]
  selectedIds: string[]
  /** Ids last mixed, most recent first; they rank under the selection. */
  recentIds: string[]
  /** Sources Spotify won't let the app read; shown but not selectable. */
  unavailableIds: string[]
  onToggle: (id: string) => void
}

type Maker = 'anyone' | 'me' | 'others'
type SortOrder = 'recent' | 'library' | 'name' | 'size'

const SORT_ORDERS: { value: SortOrder; label: string }[] = [
  { value: 'recent', label: 'Recently mixed' },
  { value: 'library', label: 'Library order' },
  { value: 'name', label: 'Name, A–Z' },
  { value: 'size', label: 'Most tracks' },
]

/**
 * The rack: one spine per source, searchable by name, narrowed by who made it and
 * sortable. A selected spine is struck with its place in the rotation, which is
 * the same number the share rail uses.
 *
 * On anything narrower than the board the rack is a *window* onto the library
 * rather than the whole of it — five rows and a sixth cut in half — so a library
 * of two hundred playlists stops being the entire page and everything the mixer
 * does stays within a screen of the top. The window is only bearable because
 * what it shows first is ranked: by default chosen, then last mixed, then
 * Spotify's order.
 */
export function SourcePicker({ sources, selectedIds, recentIds, unavailableIds, onToggle }: SourcePickerProps) {
  const [query, setQuery] = useState('')
  const [maker, setMaker] = useState<Maker>('anyone')
  const [sort, setSort] = useState<SortOrder>('recent')
  const searchId = useId()
  const sortId = useId()
  const needle = query.trim().toLocaleLowerCase()

  /*
   * The order settles; it does not follow the finger. Ranking the selection live
   * would send the row you just tapped to the top of a window you have scrolled
   * away from — it would vanish under your thumb, which is the one thing a touch
   * list may never do. So the selection is read when the order is *re-settled*:
   * when the library arrives, when the search or the sort changes, when a mix is
   * made. Between those, tapping a spine stamps it and moves nothing.
   *
   * Re-settling on render, rather than in an effect, is React's own way of
   * recomputing state from changed props: the new order is on screen in the same
   * paint as the change that caused it, so the rack never flashes its old order.
   */
  const [settled, setSettled] = useState(() => settle(sources, selectedIds, recentIds, query, sort))
  if (
    settled.sources !== sources ||
    settled.recentIds !== recentIds ||
    settled.query !== query ||
    settled.sort !== sort
  ) {
    setSettled(settle(sources, selectedIds, recentIds, query, sort))
  }

  const mine = sources.filter((source) => source.ownedByUser).length
  const shown = settled.order.filter(
    (source) =>
      (maker === 'anyone' || source.ownedByUser === (maker === 'me')) &&
      (!needle || source.name.toLocaleLowerCase().includes(needle)),
  )
  const narrowed = needle !== '' || maker !== 'anyone'

  return (
    <>
      <div className="rack-tools">
        <p className="source-search">
          <span className="rack-head">
            <label htmlFor={searchId}>Search playlists</label>
            {/*
             * The count is the window's honesty: it says how much a search or a filter
             * has cut the library to. Unfiltered, the whole library's size is already
             * on Made by's first cell, so it is not said twice.
             *
             * `aria-live` rather than `role="status"`: the announcement is the same,
             * but the page does not gain a second status region for a screen reader
             * to enumerate alongside the one that reports what a mix left out.
             */}
            <span className="rack-count" aria-live="polite" aria-atomic="true">
              {narrowed && `${shown.length} of ${sources.length}`}
            </span>
          </span>
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </p>
        <Segmented<Maker>
          legend="Made by"
          showLegend
          name="made-by"
          options={[
            { value: 'anyone', label: 'Anyone', count: sources.length },
            { value: 'me', label: 'Me', count: mine },
            { value: 'others', label: 'Others', count: sources.length - mine },
          ]}
          value={maker}
          onChange={setMaker}
        />
        <p className="source-sort">
          <label htmlFor={sortId}>Sort</label>
          <span className="select">
            <select id={sortId} value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
              {SORT_ORDERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </span>
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="muted rack-empty">{emptyRack(query.trim(), maker)}</p>
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
                    <img
                      className="source-cover"
                      src={source.imageUrl}
                      srcSet={source.imageSrcSet ?? undefined}
                      // The widths Mixer.css draws the cover at: a spine's 3.75rem,
                      // or a sheet cell, which is 10rem and grows to about 14.
                      sizes="(min-width: 64rem) 14rem, 3.75rem"
                      alt=""
                      width={60}
                      height={60}
                      loading="lazy"
                    />
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
  sort: SortOrder
  order: Source[]
}

function settle(
  sources: Source[],
  selectedIds: string[],
  recentIds: string[],
  query: string,
  sort: SortOrder,
): SettledOrder {
  return { sources, recentIds, query, sort, order: sortSources(sources, sort, selectedIds, recentIds) }
}

/**
 * The rack's order. Recent, the default: what you have chosen, then what you
 * last mixed, then the library as Spotify hands it over. Library order is
 * Spotify's alone. The others are stable sorts over it, so ties keep that order.
 */
function sortSources(sources: Source[], sort: SortOrder, selectedIds: string[], recentIds: string[]): Source[] {
  if (sort === 'name') return sources.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  if (sort === 'size') return sources.toSorted((a, b) => b.trackCount - a.trackCount)
  if (sort === 'library') return sources
  const place = (id: string) => {
    const chosen = selectedIds.indexOf(id)
    if (chosen !== -1) return chosen
    const recent = recentIds.indexOf(id)
    // A finite floor, not Infinity: `Infinity - Infinity` is NaN and would
    // silently corrupt the comparison between two unranked sources.
    return recent === -1 ? Number.MAX_SAFE_INTEGER : selectedIds.length + recent
  }
  return sources.toSorted((a, b) => place(a.id) - place(b.id))
}

function emptyRack(query: string, maker: Maker) {
  const whose = maker === 'me' ? ' of yours' : maker === 'others' ? ' by others' : ''
  if (query) return <>No playlists{whose} match &ldquo;{query}&rdquo;.</>
  return maker === 'me' ? 'You haven’t made any playlists.' : 'No playlists by others in your library.'
}
