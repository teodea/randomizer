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
