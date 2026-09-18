/** "1 track", "12 tracks". */
export function trackCountLabel(count: number) {
  return `${count} ${count === 1 ? 'track' : 'tracks'}`
}
