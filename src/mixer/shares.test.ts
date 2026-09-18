import { describe, expect, it } from 'vitest'
import { equalShares, setShare, type Shares } from './shares'

const total = (shares: Shares) => Object.values(shares).reduce((sum, share) => sum + share, 0)

describe('equalShares', () => {
  it('splits 100% equally, in whole percents', () => {
    expect(equalShares(['a', 'b'])).toEqual({ a: 50, b: 50 })
    const thirds = equalShares(['a', 'b', 'c'])
    expect(total(thirds)).toBe(100)
    expect(Object.values(thirds).sort()).toEqual([33, 33, 34])
  })

  it('gives nothing to nobody', () => {
    expect(equalShares([])).toEqual({})
  })
})

describe('setShare', () => {
  it('sets one share and gives the rest to the other source', () => {
    expect(setShare({ a: 50, b: 50 }, 'a', 70)).toEqual({ a: 70, b: 30 })
  })

  it('shares the rest among the others in their current proportions', () => {
    expect(setShare({ a: 40, b: 40, c: 20 }, 'a', 70)).toEqual({ a: 70, b: 20, c: 10 })
  })

  it('always adds up to 100, rounding to whole percents', () => {
    const shares = setShare(equalShares(['a', 'b', 'c', 'd']), 'a', 33)

    expect(shares.a).toBe(33)
    expect(total(shares)).toBe(100)
    expect(Object.values(shares).every(Number.isInteger)).toBe(true)
  })

  it('splits the rest equally when the others are all at 0%', () => {
    expect(setShare({ a: 100, b: 0, c: 0 }, 'a', 60)).toEqual({ a: 60, b: 20, c: 20 })
  })

  it('keeps shares between 0% and 100%', () => {
    expect(setShare({ a: 50, b: 50 }, 'a', 140)).toEqual({ a: 100, b: 0 })
    expect(setShare({ a: 50, b: 50 }, 'a', -10)).toEqual({ a: 0, b: 100 })
  })

  it('keeps a lone source at 100%', () => {
    expect(setShare({ a: 100 }, 'a', 30)).toEqual({ a: 100 })
  })
})
