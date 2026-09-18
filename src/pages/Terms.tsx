import { LegalPage } from '../components/LegalPage'

export function Terms() {
  return (
    <LegalPage title="Terms" effectiveDate="18 September 2026">
      <p className="lead">
        Randomizer is a free, personal, non-commercial project. Use it as it is, and keep following
        Spotify&rsquo;s rules.
      </p>

      <h2>What Randomizer is</h2>
      <p>
        A free web app that mixes tracks from several of your Spotify playlists into one temporary
        playlist. There are no ads, payments or paid features.
      </p>

      <h2>Who can use it</h2>
      <p>
        Anyone can try the demo. Logging in with Spotify is limited to accounts the owner has invited.
      </p>

      <h2>Your Spotify account</h2>
      <p>
        By logging in, you let Randomizer read your playlists and Liked Songs, create and manage one
        private temporary playlist, and start playback, as described in the privacy policy. You can
        disconnect at any time. You remain bound by the{' '}
        <a href="https://www.spotify.com/legal/end-user-agreement/">Spotify Terms of Use</a>. Starting
        playback from Randomizer requires Spotify Premium.
      </p>

      <h2>No warranty</h2>
      <p>
        Randomizer is provided &ldquo;as is&rdquo;, without any warranty. It may have bugs, and Spotify
        can change or limit its API at any time, so features may stop working or some playlists may
        become unavailable. The owner is not liable for any loss arising from its use.
      </p>

      <h2>Not affiliated with Spotify</h2>
      <p>
        Randomizer is independent and is not affiliated with, endorsed or sponsored by Spotify. Music,
        cover art and track information belong to their owners and are provided by Spotify.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change, and the app may be shut down at any time. If the terms change, the date
        at the top changes too. For questions, open an issue on{' '}
        <a href="https://github.com/teodea/randomizer/issues">GitHub</a>.
      </p>
    </LegalPage>
  )
}
