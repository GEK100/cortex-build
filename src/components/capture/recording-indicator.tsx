interface RecordingIndicatorProps {
  duration: number
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordingIndicator({ duration }: RecordingIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <span className="text-sm font-medium tabular-nums text-foreground">
        {formatDuration(duration)}
      </span>
    </div>
  )
}
