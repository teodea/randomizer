import { ChevronIcon } from '../components/icons'
import { Segmented } from '../components/Segmented'
import type { PoolForm } from './poolForm'

interface PoolSettingsProps {
  form: PoolForm
  onChange: (form: PoolForm) => void
}

type LengthMode = 'all' | 'fixed'

export function PoolSettings({ form, onChange }: PoolSettingsProps) {
  const set = <K extends keyof PoolForm>(key: K, value: PoolForm[K]) => onChange({ ...form, [key]: value })
  const limits = durationSummary(form)

  return (
    <section className="block" data-reveal="" aria-labelledby="pool-heading">
      <h2 id="pool-heading">Tracks</h2>
      <div className="settings-fields">
        <label className="check">
          <input
            type="checkbox"
            checked={form.removeDuplicates}
            onChange={(event) => set('removeDuplicates', event.target.checked)}
          />
          Remove duplicates
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.excludeExplicit}
            onChange={(event) => set('excludeExplicit', event.target.checked)}
          />
          Skip explicit tracks
        </label>
        <Segmented<LengthMode>
          legend="Mix length"
          showLegend
          name="mix-length"
          options={[
            { value: 'all', label: 'All eligible tracks' },
            { value: 'fixed', label: 'Fixed number' },
          ]}
          value={form.fixedLength ? 'fixed' : 'all'}
          onChange={(mode) => set('fixedLength', mode === 'fixed')}
        >
          {form.fixedLength && (
            <label className="field">
              Stop after
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.length}
                aria-label="Number of tracks"
                onChange={(event) => set('length', event.target.value)}
              />
              <span className="unit">tracks</span>
            </label>
          )}
        </Segmented>
        {/*
         * Duration limits are rarely wanted, so they fold away — but a limit that
         * is on says so on the closed row, because a filter nobody can see is a
         * mix that is shorter for no visible reason.
         */}
        <details className="more">
          <summary>
            <span>Duration limits</span>
            <span className={limits ? 'more-state on' : 'more-state'}>{limits ?? 'Off'}</span>
            <ChevronIcon />
          </summary>
          <label className="field">
            Skip tracks shorter than
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.minMinutes}
              aria-label="Skip tracks shorter than (minutes)"
              onChange={(event) => set('minMinutes', event.target.value)}
            />
            <span className="unit">min</span>
          </label>
          <label className="field">
            Skip tracks longer than
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.maxMinutes}
              aria-label="Skip tracks longer than (minutes)"
              onChange={(event) => set('maxMinutes', event.target.value)}
            />
            <span className="unit">min</span>
          </label>
        </details>
      </div>
    </section>
  )
}

/** The limits in force, as the closed row prints them, or null when there are none. */
function durationSummary({ minMinutes, maxMinutes }: PoolForm): string | null {
  const min = minMinutes.trim()
  const max = maxMinutes.trim()
  if (min && max) return `${min}–${max} min`
  if (min) return `≥ ${min} min`
  if (max) return `≤ ${max} min`
  return null
}
