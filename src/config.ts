export interface AppConfig {
  /** Public Client ID of the Spotify app, or null when the build didn't provide one. */
  spotifyClientId: string | null
}

export function readConfig(env: Pick<ImportMetaEnv, 'VITE_SPOTIFY_CLIENT_ID'>): AppConfig {
  const clientId = env.VITE_SPOTIFY_CLIENT_ID?.trim()
  return { spotifyClientId: clientId ? clientId : null }
}

export const config: AppConfig = readConfig(import.meta.env)
