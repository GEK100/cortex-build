/**
 * MediaRecorder wrapper for voice capture.
 * Records audio/webm;codecs=opus — accepted directly by Whisper API.
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startTime = 0

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Prefer opus in webm; fall back to whatever the browser supports
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    })

    this.chunks = []
    this.startTime = Date.now()

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    this.mediaRecorder.start(1000) // collect in 1-second chunks
  }

  stop(): Promise<{ blob: Blob; durationSeconds: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Not recording'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        })
        const durationSeconds = (Date.now() - this.startTime) / 1000

        // Release microphone
        this.mediaRecorder?.stream.getTracks().forEach((t) => t.stop())

        resolve({ blob, durationSeconds })
      }

      this.mediaRecorder.onerror = () => {
        reject(new Error('Recording error'))
      }

      this.mediaRecorder.stop()
    })
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}
