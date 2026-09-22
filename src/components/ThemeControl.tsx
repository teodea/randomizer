import { useEffect, useState } from 'react'
import { applyTheme, chooseTheme, storedChoice, watchSystem, type ThemeChoice } from '../theme'

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * The rendition switch. It lives in the run-out groove with the other things you
 * set once: the mix is what the visitor came for, and this is not it.
 */
export function ThemeControl() {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice)

  // Only while the choice is the device's: an explicit one stops following it.
  useEffect(() => {
    if (choice !== 'system') return
    return watchSystem(() => applyTheme('system'))
  }, [choice])

  function pick(next: ThemeChoice) {
    setChoice(next)
    chooseTheme(next)
  }

  return (
    <fieldset className="theme-control">
      <legend>Theme</legend>
      {CHOICES.map(({ value, label }) => (
        <label key={value}>
          <input
            type="radio"
            name="theme"
            value={value}
            checked={choice === value}
            onChange={() => pick(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
