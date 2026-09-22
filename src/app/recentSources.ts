/**
 * What the rack opens on.
 *
 * A library of two hundred playlists has no useful first row: Spotify's own
 * order is whatever the account happens to look like, and alphabetical answers
 * a question nobody asks. The one ranking that earns its place is the listener's
 * own history — the sources they actually mixed — so the rack keeps a short tail
 * of them here, on this device, and puts them at the top next time.
 *
 * Ids only. The names, covers and counts all come from Spotify on every visit,
 * so nothing about a playlist is stored: only that it was chosen. An id that no
 * longer matches anything in the library simply never ranks.
 */

const KEY = 'randomizer:recent-sources'

/**
 * How many are remembered. Long enough to cover the handful a listener returns
 * to, short enough that the top of the rack is still a recommendation rather
 * than a second library.
 */
const KEPT = 12

/** Private browsing and blocked storage both throw; neither is worth a failure. */
function read(): string[] {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === null) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, KEPT) : []
  } catch {
    return []
  }
}

/** The ids last mixed, most recent first. */
export function recentSources(): string[] {
  return read()
}

/**
 * Records a mix as having happened, most recent first. Sources already in the
 * tail move to the front rather than appearing twice.
 */
export function noteSourcesMixed(ids: string[]): string[] {
  const next = [...ids, ...read().filter((id) => !ids.includes(id))].slice(0, KEPT)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // A remembered order is a convenience; losing it is not a failure.
  }
  return next
}

/**
 * Forgets the tail. Called on log out, because these are ids from *an account's*
 * library: the next person to log in on this device may not be the same one, and
 * a rack opening on a stranger's playlists is worse than one opening on nothing.
 */
export function forgetRecentSources(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to forget if the storage was never reachable.
  }
}
