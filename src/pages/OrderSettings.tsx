import { Segmented, type SegmentedOption } from '../components/Segmented'
import type { OrderForm } from './orderForm'

const ORDER_MODES: SegmentedOption<OrderForm['mode']>[] = [
  { value: 'random', label: 'Random', hint: 'Any source can come next.' },
  { value: 'alternate', label: 'Alternate', hint: 'Sources take turns, following their weights.' },
  { value: 'blocks', label: 'Blocks', hint: 'A few tracks from one source, then the next.' },
]

interface OrderSettingsProps {
  form: OrderForm
  onChange: (form: OrderForm) => void
}

export function OrderSettings({ form, onChange }: OrderSettingsProps) {
  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => onChange({ ...form, [key]: value })

  return (
    <section className="block" data-reveal="" aria-labelledby="order-heading">
      <h2 id="order-heading">Order</h2>
      <div className="settings-fields">
        <Segmented
          legend="How the sources follow each other"
          name="order"
          options={ORDER_MODES}
          value={form.mode}
          onChange={(mode) => set('mode', mode)}
        >
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
        </Segmented>
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
