import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('readConfig', () => {
  it('reads the Spotify Client ID from the build environment', () => {
    expect(readConfig({ VITE_SPOTIFY_CLIENT_ID: 'abc123' })).toEqual({ spotifyClientId: 'abc123' })
  })

  it('trims surrounding whitespace', () => {
    expect(readConfig({ VITE_SPOTIFY_CLIENT_ID: '  abc123\n' }).spotifyClientId).toBe('abc123')
  })

  it('treats a missing or blank Client ID as not configured', () => {
    expect(readConfig({}).spotifyClientId).toBeNull()
    expect(readConfig({ VITE_SPOTIFY_CLIENT_ID: '   ' }).spotifyClientId).toBeNull()
  })
})
