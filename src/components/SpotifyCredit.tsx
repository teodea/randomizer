import fullLogoBlack from '../assets/spotify/spotify-full-logo-black.svg'
import fullLogoWhite from '../assets/spotify/spotify-full-logo-white.svg'
import iconBlack from '../assets/spotify/spotify-icon-black.svg'
import iconWhite from '../assets/spotify/spotify-icon-white.svg'

/**
 * Spotify's brand, where its content shows.
 *
 * The Design & Branding Guidelines require the Spotify brand on any view that
 * displays Spotify metadata or cover art: the full logo where there is room, the
 * icon alone where there isn't, with clear space of half the icon's height. The
 * marks are the official files from Spotify's design page, unmodified. The green
 * cut is only allowed on pure white or black, so both renditions take a
 * monochrome mark — white on the ink board, black on the printed stock — and
 * which one shows is the stylesheet's business, since neither may be recoloured.
 */

/** Minimum sizes Spotify sets: 70px for the full logo, 21px for the icon. */
const MARKS = {
  full: { dark: fullLogoWhite, light: fullLogoBlack, width: 82, height: 22 },
  icon: { dark: iconWhite, light: iconBlack, width: 21, height: 20 },
}

interface SpotifyCreditProps {
  /** `icon` where space is short, such as a rail; `full` everywhere else. */
  variant?: 'full' | 'icon'
  /** What the mark sits beside, so the link says where it goes. */
  label?: string
}

export function SpotifyCredit({ variant = 'icon', label = 'Spotify' }: SpotifyCreditProps) {
  const mark = MARKS[variant]
  return (
    <a className="spotify-credit" href="https://open.spotify.com" target="_blank" rel="noreferrer">
      <img className="on-board" src={mark.dark} alt="" width={mark.width} height={mark.height} />
      <img className="on-stock" src={mark.light} alt="" width={mark.width} height={mark.height} aria-hidden="true" />
      <span className="visually-hidden">{label} on Spotify</span>
    </a>
  )
}
