/** Spotify won't let the app read this source's tracks (403/404). The rest of the flow carries on. */
export class SourceUnavailableError extends Error {
  readonly sourceId: string

  constructor(sourceId: string) {
    super(`Source unavailable: ${sourceId}`)
    this.name = 'SourceUnavailableError'
    this.sourceId = sourceId
  }
}

/** The login can't be used any more (expired, revoked or missing); the user has to log in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('The Spotify session has expired')
    this.name = 'SessionExpiredError'
  }
}

/**
 * Spotify refuses this account: it isn't on the app's invite list. A bare 403
 * never says which no it is — a private playlist, a restricted endpoint and an
 * uninvited account all look alike — so this is thrown only when `/me` itself
 * is refused, which has no other reading.
 */
export class NotInvitedError extends Error {
  constructor() {
    super('This Spotify account is not on the invite list')
    this.name = 'NotInvitedError'
  }
}
