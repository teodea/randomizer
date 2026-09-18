/** Each source's share of a custom-weighted mix, in whole percents that add up to 100. */
export type Shares = Record<string, number>

/** 100% split as equally as whole percents allow. */
export function equalShares(ids: string[]): Shares {
  return apportion(
    100,
    ids.map((id) => ({ id, weight: 1 })),
  )
}

/**
 * Sets one source's share and gives the rest to the others in their current
 * proportions (equally if they are all at 0%), so the total stays at 100.
 */
export function setShare(shares: Shares, id: string, value: number): Shares {
  const others = Object.keys(shares).filter((other) => other !== id)
  if (others.length === 0) return { [id]: 100 }

  const share = Math.round(Math.min(100, Math.max(0, value)))
  const allZero = others.every((other) => shares[other] <= 0)
  const rest = apportion(
    100 - share,
    others.map((other) => ({ id: other, weight: allZero ? 1 : Math.max(0, shares[other]) })),
  )
  return Object.fromEntries(Object.keys(shares).map((key) => [key, key === id ? share : rest[key]]))
}

/**
 * Splits `total` whole units in proportion to the weights (largest remainder),
 * so the parts are whole numbers that add up to exactly `total`.
 */
function apportion(total: number, parts: { id: string; weight: number }[]): Shares {
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0)
  const exact = parts.map((part) => ({ id: part.id, value: weightSum > 0 ? (total * part.weight) / weightSum : 0 }))
  const result: Shares = Object.fromEntries(exact.map((part) => [part.id, Math.floor(part.value)]))

  let left = total - Object.values(result).reduce((sum, value) => sum + value, 0)
  const byRemainder = [...exact].sort((x, y) => (y.value % 1) - (x.value % 1))
  for (const part of byRemainder) {
    if (left <= 0) break
    result[part.id]++
    left--
  }
  return result
}
