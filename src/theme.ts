/**
 * Which rendition of the catalogue is on screen.
 *
 * The default follows the device, because someone whose phone is in daylight
 * mode should not have to find a switch first. An explicit choice beats the
 * device and is remembered here, on this device only: it is a preference, not
 * account data, so it survives logging out and never reaches a server.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'randomizer:theme'
const LIGHT = '(prefers-color-scheme: light)'

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Private browsing and blocked storage both throw; neither is worth a failure. */
export function storedChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY)
    return isChoice(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function remember(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // A remembered preference is a convenience; losing it is not a failure.
  }
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.(LIGHT).matches ? 'light' : 'dark'
}

export function resolve(choice: ThemeChoice): 'light' | 'dark' {
  return choice === 'system' ? systemTheme() : choice
}

/** Sets the attribute the stylesheet keys on. Called before the first paint. */
export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice)
}

export function chooseTheme(choice: ThemeChoice) {
  remember(choice)
  applyTheme(choice)
}

/** Follows the device while the choice is `system`, and stops when it isn't. */
export function watchSystem(onChange: () => void): () => void {
  const query = window.matchMedia?.(LIGHT)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
