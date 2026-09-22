import type { PoolForm } from './poolForm'

interface PoolSettingsProps {
  form: PoolForm
  onChange: (form: PoolForm) => void
}

export function PoolSettings({ form, onChange }: PoolSettingsProps) {
  const set = <K extends keyof PoolForm>(key: K, value: PoolForm[K]) => onChange({ ...form, [key]: value })

  return (
    <section className="block" id="mix-settings" aria-labelledby="pool-heading">
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
        <fieldset>
          <legend>Mix length</legend>
          <label className="check">
            <input
              type="radio"
              name="mix-length"
              checked={!form.fixedLength}
              onChange={() => set('fixedLength', false)}
            />
            All eligible tracks
          </label>
          <label className="check">
            <input
              type="radio"
              name="mix-length"
              checked={form.fixedLength}
              onChange={() => set('fixedLength', true)}
            />
            Fixed number
          </label>
          {form.fixedLength && (
            <label className="field">
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
        </fieldset>
      </div>
    </section>
  )
}
