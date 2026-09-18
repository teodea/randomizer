interface ReshuffleControlsProps {
  /** In demo mode, the simulated player's position in the mix; null with a real player. */
  simulatedPosition: number | null
  mixLength: number
  disabled: boolean
  /** How the last reshuffle went, if there's something to say. */
  notice: string | null
  onNextTrack: () => void
  onReshuffle: () => void
}

/** Re-mixes the part of the mix still to come, and in demo mode steps through a pretend player. */
export function ReshuffleControls({
  simulatedPosition,
  mixLength,
  disabled,
  notice,
  onNextTrack,
  onReshuffle,
}: ReshuffleControlsProps) {
  return (
    <div>
      {simulatedPosition !== null && (
        <p className="muted">
          Simulated playback: track {simulatedPosition + 1} of {mixLength}.
        </p>
      )}
      <p className="reshuffle-actions">
        {simulatedPosition !== null && (
          <button type="button" disabled={disabled || simulatedPosition >= mixLength - 1} onClick={onNextTrack}>
            Next track
          </button>
        )}
        <button type="button" disabled={disabled} onClick={onReshuffle}>
          Reshuffle the rest
        </button>
      </p>
      <p role="status">{notice}</p>
    </div>
  )
}
