import type { OrderForm } from './orderForm'

const ORDER_MODES: { mode: OrderForm['mode']; label: string; hint: string }[] = [
  { mode: 'random', label: 'Random', hint: 'Any source can come next.' },
  { mode: 'alternate', label: 'Alternate', hint: 'Sources take turns, following their weights.' },
  { mode: 'blocks', label: 'Blocks', hint: 'A few tracks from one source, then the next.' },
]

interface OrderSettingsProps {
  form: OrderForm
  onChange: (form: OrderForm) => void
}

export function OrderSettings({ form, onChange }: OrderSettingsProps) {
  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => onChange({ ...form, [key]: value })

  return (
    <section className="block" aria-labelledby="order-heading">
      <h2 id="order-heading">Order</h2>
      <fieldset className="mode-options">
        <legend>How the sources follow each other</legend>
        {ORDER_MODES.map(({ mode, label, hint }) => (
          <label key={mode}>
            <input
              type="radio"
              name="order"
              value={mode}
              checked={form.mode === mode}
              onChange={() => set('mode', mode)}
            />
            <span className="source-name">{label}</span>
            <span className="muted">{hint}</span>
          </label>
        ))}
      </fieldset>
      <div className="settings-fields order-settings">
        {form.mode === 'blocks' && (
          <label className="field">
            Blocks of
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.blockSize}
              aria-label="Block size (tracks)"
              onChange={(event) => set('blockSize', event.target.value)}
            />
            <span className="unit">tracks</span>
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={form.spreadArtists}
            onChange={(event) => set('spreadArtists', event.target.checked)}
          />
          Spread artists
          <span className="muted">Avoid the same artist twice in a row.</span>
        </label>
      </div>
    </section>
  )
}
