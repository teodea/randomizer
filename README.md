# Randomizer

Mix tracks from several of your playlists into one shuffled queue.

Live at <https://teodea.github.io/randomizer/>.

A static single-page app (Vite + React + TypeScript) with no backend, hosted on GitHub Pages.

## Development

Requires Node.js 22.12 or newer; CI uses the version in `.nvmrc` (24).

```sh
npm install        # install dependencies
npm run dev        # dev server at http://127.0.0.1:5173/randomizer/
npm test           # run the tests once (npm run test:watch to watch)
npm run lint       # lint with oxlint
npm run typecheck  # type-check
npm run build      # production build into dist/
npm run preview    # serve the production build at http://127.0.0.1:4173/randomizer/
```

The dev server uses `127.0.0.1` rather than `localhost` because Spotify doesn't accept `localhost` redirect URIs.

## Configuration

The Spotify Client ID is read at build time from `VITE_SPOTIFY_CLIENT_ID`. Locally, copy `.env.example` to `.env.local` and fill it in. In CI it comes from the `SPOTIFY_CLIENT_ID` repository variable.

Login uses the Authorization Code flow with PKCE, so the Client ID is the only credential the app needs. It's public by design. There is no Client Secret anywhere in this project.

## Deployment

The `CI` workflow lints, tests and builds every push and pull request. On pushes to `main` it also deploys `dist/` to GitHub Pages (Settings → Pages → Source: GitHub Actions).

The build writes a copy of `index.html` as `404.html`, so GitHub Pages hands unknown paths to the client-side router and deep links survive a refresh.
