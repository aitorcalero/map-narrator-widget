type FocusableAudio = {
  focus: () => void
  play: () => Promise<void>
}

export function focusAudioAfterGeneration (audio: FocusableAudio | null, audioUrl: string | undefined): void {
  if (!audioUrl || !audio) return
  audio.focus()
  void audio.play().catch(() => undefined)
}
