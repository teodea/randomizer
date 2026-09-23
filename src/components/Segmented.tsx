import { useId, type ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** A measurement printed after the label, such as how many sources it covers. */
  count?: number
  /** What the option does, printed under the control while it is the chosen one. */
  hint?: string
}

interface SegmentedProps<T extends string> {
  /** Names the choice for assistive technology; shown only when `showLegend` is set. */
  legend: string
  showLegend?: boolean
  name: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Anything that belongs to the chosen option, such as its own number field. */
  children?: ReactNode
}

/**
 * One choice among a few, as a ruled strip of stamped cells: the chosen cell is
 * struck in vermilion. Radios underneath, so the keyboard and screen readers get
 * the control they already know.
 */
export function Segmented<T extends string>({
  legend,
  showLegend = false,
  name,
  options,
  value,
  onChange,
  children,
}: SegmentedProps<T>) {
  const hintId = useId()
  const hint = options.find((option) => option.value === value)?.hint

  return (
    <fieldset className="segmented" aria-describedby={hint ? hintId : undefined}>
      <legend className={showLegend ? undefined : 'visually-hidden'}>{legend}</legend>
      <div className="segments">
        {options.map((option) => (
          <label key={option.value}>
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
            {option.count !== undefined && <span className="segment-count">{option.count}</span>}
          </label>
        ))}
      </div>
      {hint && (
        <p className="hint segmented-hint" id={hintId}>
          {hint}
        </p>
      )}
      {children}
    </fieldset>
  )
}
