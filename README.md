# Randomizer

Mix tracks from several of your Spotify playlists into one shuffled queue.

- **Live app:** <https://teodea.github.io/randomizer/>
- **Demo, no login needed:** <https://teodea.github.io/randomizer/demo>

Pick two or more playlists, choose how to mix them, and Randomizer writes the mix into one private temporary playlist in your library and plays it. When you're done, the playlist goes away. It runs entirely in the browser, with no backend.

## The problem

Spotify shuffles one playlist at a time. Mixing several means copying them into a new playlist by hand, which then sits in your library and goes stale. You also get no say in *how* they mix: a 1,000-track playlist drowns out a 20-track one, and songs in two playlists play twice.

## What Randomizer does

Log in, pick your **sources** (your playlists, the ones you follow, and Liked Songs), set the options and press play. The mix goes into a single private **temporary playlist**. Each new mix overwrites it, and *Clean up* or logging out removes it. If you leave without cleaning up, the app offers to remove it on your next visit. While the mix plays, **Reshuffle the rest** mixes the tracks you haven't heard yet again. Playback starts on your active device with Spotify Premium. Without Premium, you get a link to open the playlist in Spotify.

Mixing happens in three stages:

1. **Pool**: which tracks can go in. You can remove duplicates across sources (different releases of the same recording count as one), filter by duration or explicit content, and cap the length.
2. **Weighting**: which source each next track comes from. The modes are *uniform* (every track equally likely), *balanced* (every source equally likely) and *custom* shares such as 70% / 30%. When a source runs out, the others keep their proportions.
3. **Order**: *random*, *alternate* (A, B, C, A, B, C…) or *blocks* of N tracks per source, all following your weights. A final *spread artists* pass, on by default, keeps the same artist from playing twice in a row whenever it can.

## Why login is invite-only

The app runs in Spotify's Development Mode. In that mode at most five accounts can use the Web API: the owner, who needs Spotify Premium, and four accounts added by hand. Opening it to everyone needs Spotify's extended quota, which is only available to registered organisations with a large user base. Anyone else can still log in, but Spotify refuses their requests. The app catches that and explains that it's invite-only. The [demo](https://teodea.github.io/randomizer/demo) runs the same app on sample playlists, so anyone can try the mixer.

## How it's built

- **Static single-page app**: Vite, React and TypeScript, with no backend and no database. Every Spotify call goes straight from the browser, and GitHub Pages hosts it for free.
- **Login with PKCE**: the Authorization Code flow with PKCE needs only the Client ID, which is public by design. The Client Secret isn't used anywhere. Tokens stay in the browser and refresh automatically, and the app asks only for the scopes it uses.
- **Mixer engine** ([`src/mixer/engine.ts`](src/mixer/engine.ts)): a pure module with no I/O. It takes the sources, the options and a seeded random number generator, and returns the ordered mix, running pool, then weighting, then order. Uniform, balanced and custom are one mechanism with different weights. Reshuffling the rest is a second entry point that keeps the played part fixed.
- **Spotify gateway** ([`src/spotify/gateway.ts`](src/spotify/gateway.ts)): one interface for everything the app needs from Spotify, with two implementations. The [real one](src/spotify/webGateway.ts) talks to the Web API. It pages through reads, batches writes to the API's per-request limits and backs off on HTTP 429 using `Retry-After`. The [fake one](src/spotify/fakeGateway.ts) keeps sample data in memory and runs both the tests and demo mode, so the demo exercises exactly the code real users run.
- **Safe with your playlists**: the app knows its temporary playlist by a marker in the description and by who owns it, not by name alone. It never modifies or removes any other playlist. A playlist whose tracks Spotify won't let the app read shows as *unavailable*, and the rest of the mix goes ahead.
- **No server-side data**: nothing is kept on a server. Your login session lives in your browser's storage, and logging out removes it. See the [privacy policy](https://teodea.github.io/randomizer/privacy).

### Testing

Tests check behaviour through public interfaces only, never through internal helpers, so a refactor that keeps behaviour doesn't break them.

- **Mixer engine**: unit tests with hand-built sources and a fixed seed. They cover the proportions for each weighting mode, source exhaustion, duplicate detection, filters, the three orders, spread artists and reshuffling. Seeded randomness keeps them free of flakes.
- **App flows**: React Testing Library tests drive the real UI against the fake gateway. They cover sending a mix, overwriting the temporary playlist, cleaning up, finding a leftover playlist, unavailable sources, and checking that no other playlist is ever touched.
- **Real gateway and login**: tests with a stubbed `fetch` cover paging, filtering, batching and retries. How Spotify itself behaves is checked by hand with real accounts.

## Running it locally

Requires Node.js 22.12 or newer. CI uses the version in `.nvmrc` (24).

```sh
npm install        # install dependencies
npm run dev        # dev server at http://127.0.0.1:5173/randomizer/
npm test           # run the tests once (npm run test:watch to watch)
npm run lint       # lint with oxlint
npm run typecheck  # type-check
npm run build      # production build into dist/
npm run preview    # serve the production build at http://127.0.0.1:4173/randomizer/
```

The demo at `/randomizer/demo` works without any configuration. To log in with Spotify locally:

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Its owner can use it straight away (with Spotify Premium), and other accounts have to be added under *User Management*.
2. Add the redirect URI `http://127.0.0.1:5173/randomizer/callback`. Spotify rejects `localhost` redirect URIs, which is why the dev server listens on `127.0.0.1`.
3. Copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID` to the app's Client ID.

In production, Spotify redirects to `https://teodea.github.io/randomizer/callback`, and CI reads the Client ID from the `SPOTIFY_CLIENT_ID` repository variable.

Spotify apps created after February 2026 can read the tracks of your own and collaborative playlists only. Playlists you just follow show as unavailable.

## Deployment

The `CI` workflow lints, tests and builds every push and pull request. On pushes to `main` it also deploys `dist/` to GitHub Pages (Settings → Pages → Source: GitHub Actions).

The build writes a copy of `index.html` as `404.html`, so GitHub Pages hands unknown paths to the client-side router and deep links survive a refresh.
