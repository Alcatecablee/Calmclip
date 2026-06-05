export interface RecordingResult {
  file:     File
  duration: number
}

export async function startScreenRecording(): Promise<RecordingResult> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
  })

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    })

    const startTime = Date.now()

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const duration = (Date.now() - startTime) / 1000
      const blob = new Blob(chunks, { type: 'video/webm' })
      const file = new File([blob], 'screen-recording.webm', { type: 'video/webm' })
      resolve({ file, duration })
    }

    recorder.onerror = () => {
      stream.getTracks().forEach(t => t.stop())
      reject(new Error('Recording failed. Your browser may not support screen capture.'))
    }

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (recorder.state !== 'inactive') recorder.stop()
    })

    recorder.start(250)
  })
}

export function isScreenRecordSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
}
