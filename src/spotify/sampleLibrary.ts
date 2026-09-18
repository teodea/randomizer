import { createFakeGateway, type FakeSource } from './fakeGateway'
import type { Track } from './types'

// Invented playlists, artists and songs for demo mode. None of it is real Spotify content.
// A few songs appear in more than one playlist and one is a short interlude, so the
// duplicate and duration settings have something to do.

type SampleTrack = [name: string, artist: string, seconds: number, explicit?: boolean]

function playlist(id: string, name: string, tracks: SampleTrack[]): FakeSource {
  return {
    id,
    name,
    owner: 'Demo',
    tracks: tracks.map(
      ([trackName, artist, seconds, explicit = false], index): Track => ({
        id: `${id}-${index + 1}`,
        name: trackName,
        artists: [artist],
        durationMs: seconds * 1000,
        explicit,
        isrc: null,
      }),
    ),
  }
}

export const sampleLibrary: FakeSource[] = [
  playlist('late-night-drive', 'Late Night Drive', [
    ['Neon Overpass', 'The Midnight Engines', 244],
    ['Tail Lights', 'Cobalt Avenue', 213],
    ['Exit 42', 'The Midnight Engines', 198],
    ['Radio Static', 'Lena Farrow', 231],
    ['Empty Highway', 'Cobalt Avenue', 267],
    ['Sodium Glow', 'Night Tram', 205],
    ['Last Gas Station', 'Lena Farrow', 189],
    ['Headlights on Water', 'Night Tram', 256],
    ['Rearview', 'The Midnight Engines', 222],
    ['Streetlamp Choir', 'Pale Harbor', 240],
    ['Overdrive', 'Cobalt Avenue', 201],
    ['Home by Dawn', 'Pale Harbor', 274],
  ]),
  playlist('sunday-coffee', 'Sunday Coffee', [
    ['Warm Cup', 'Juniper Lane', 182],
    ['Window Seat', 'Odette Moss', 207],
    ['Slow Pour', 'Juniper Lane', 195],
    ['Paper Crane', 'The Linen Club', 224],
    ['Crossword', 'Odette Moss', 176],
    ['Late Breakfast', 'The Linen Club', 211],
    ['Home by Dawn', 'Pale Harbor', 274],
  ]),
  playlist('gym-rotation', 'Gym Rotation', [
    ['Heavy Lifting', 'Kid Carbon', 168, true],
    ['Redline', 'Voltage Twins', 194],
    ['No Days Off', 'Kid Carbon', 176, true],
    ['Sprint', 'Voltage Twins', 181],
    ['Iron Lungs', 'MC Tempest', 203, true],
    ['Personal Best', 'Voltage Twins', 187],
    ['Cooldown', 'Harbor Lights', 229],
    ['Final Set', 'MC Tempest', 172, true],
  ]),
  playlist('indie-finds', 'Indie Finds', [
    ['Cardboard Castles', 'Wren & the Weather', 219],
    ['Small Town Satellite', 'Fern Club', 241],
    ['Borrowed Jacket', 'Wren & the Weather', 198],
    ['Kites', 'The Quiet Arcade', 233],
    ['Porch Light', 'Fern Club', 207],
    ['Interlude (Tape Hiss)', 'Fern Club', 42],
    ['Sodium Glow', 'Night Tram', 205],
  ]),
  playlist('rainy-day-jazz', 'Rainy Day Jazz', [
    ['Umbrella Waltz', 'The Blue Hour Trio', 312],
    ['Puddle Steps', 'Marcel Dupont Quartet', 287],
    ['Grey Afternoon', 'The Blue Hour Trio', 344],
    ['Fogged Glass', 'Ines Calloway', 268],
    ['Drizzle', 'Marcel Dupont Quartet', 295],
    ['After the Storm', 'Ines Calloway', 301],
    ['Wet Pavement', 'The Blue Hour Trio', 276],
  ]),
]

/** The gateway demo mode runs on: the fake implementation over the sample library. */
export const demoGateway = createFakeGateway(sampleLibrary)
