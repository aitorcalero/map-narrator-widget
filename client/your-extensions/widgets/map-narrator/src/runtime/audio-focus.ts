type FocusableAudio = {
  focus: () => void
}

export function focusAudioAfterGeneration (audio: FocusableAudio | null, audioUrl: string | undefined): void {
  if (audioUrl) audio?.focus()
}
