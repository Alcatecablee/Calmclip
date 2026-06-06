import type { Word } from './captionEngine'

const TAG = '[CalmClip Whisper]'

// Decode a 16 kHz mono WAV Blob to a Float32Array of PCM samples.
// AudioContext is available on the main thread; the worker receives the raw
// samples directly, matching the original worker-based implementation.
async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    return decoded.getChannelData(0) // mono: channel 0
  } finally {
    audioCtx.close()
  }
}

function distributeWords(transcript: string, durationSeconds: number): Word[] {
  const tokens = transcript.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const avgDur = durationSeconds / tokens.length
  return tokens.map((text, i) => ({
    text,
    startTime: parseFloat((i * avgDur).toFixed(3)),
    endTime: parseFloat(((i + 1) * avgDur).toFixed(3)),
  }))
}

export async function transcribeToTimedWords(
  audioBlob: Blob,
  videoDurationSeconds: number,
  onStatusUpdate?: (msg: string) => void,
  model?: string,
  language?: string,
): Promise<{ transcript: string; words: Word[]; detectedLanguage?: string }> {
  console.log(TAG, 'transcribeToTimedWords: audioBlob size:', audioBlob.size, 'duration:', videoDurationSeconds)

  onStatusUpdate?.('Decoding audio...')
  const audio = await blobToFloat32Array(audioBlob)
  console.log(TAG, 'decoded Float32Array length:', audio.length)

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/whisper.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as {
        type: string
        info?: { status: string; progress?: number; file?: string }
        durationSec?: number
        backend?: string
        progress?: number
        result?: { text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }
        message?: string
        detectedLanguage?: string
      }

      if (msg.type === 'model-progress') {
        const info = msg.info
        if (!info) return
        if (info.status === 'init') {
          onStatusUpdate?.('Loading Whisper model...')
        } else if ((info.status === 'progress' || info.status === 'download') && info.progress != null) {
          const pct = Math.round(info.progress)
          onStatusUpdate?.(`Downloading model: ${pct}%`)
        } else if (info.status === 'done' || info.status === 'ready') {
          onStatusUpdate?.('Model ready, transcribing...')
        }
      } else if (msg.type === 'transcribing') {
        onStatusUpdate?.('Transcribing audio...')
      } else if (msg.type === 'transcribe-progress' && msg.progress != null) {
        onStatusUpdate?.(`Transcribing... ${msg.progress}%`)
      } else if (msg.type === 'result') {
        worker.terminate()

        const result = msg.result
        if (!result) {
          reject(new Error('Worker returned empty result.'))
          return
        }

        const transcript = result.text || ''
        if (!transcript.trim()) {
          reject(new Error('Whisper returned an empty transcript. Check that your video has clear speech.'))
          return
        }

        let words: Word[] = []

        if (result.chunks && result.chunks.length > 0) {
          words = result.chunks
            .filter(c => c.timestamp && c.timestamp[0] !== null)
            .map(c => ({
              text: c.text.trim(),
              startTime: c.timestamp[0] ?? 0,
              endTime: c.timestamp[1] ?? (c.timestamp[0]! + 0.5),
            }))
            .filter(w => w.text.length > 0)
          console.log(TAG, 'words from chunks:', words.length)
        }

        if (words.length === 0) {
          console.warn(TAG, 'no timestamp chunks, using distributeWords fallback')
          words = distributeWords(transcript, videoDurationSeconds)
        }

        words = words.map(w => ({
          ...w,
          startTime: Math.max(0, Math.min(w.startTime, videoDurationSeconds)),
          endTime: Math.max(0, Math.min(w.endTime, videoDurationSeconds)),
        }))

        console.log(TAG, 'done:', words.length, 'words')
        onStatusUpdate?.('Done')
        resolve({ transcript, words, detectedLanguage: msg.detectedLanguage })
      } else if (msg.type === 'error') {
        worker.terminate()
        reject(new Error(msg.message ?? 'Transcription failed.'))
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      console.error(TAG, 'worker onerror — message:', err.message, '| file:', err.filename, '| line:', err.lineno, '| col:', err.colno)
      reject(new Error(err.message || 'Worker failed to load. Check browser console for details.'))
    }

    worker.addEventListener('error', (err) => {
      console.error(TAG, 'worker error event — message:', err.message, '| file:', err.filename, '| line:', err.lineno)
    })

    worker.postMessage({
      type: 'transcribe',
      audio,
      durationSec: videoDurationSeconds,
      model: model ?? 'Xenova/whisper-base',
      ...(language ? { language } : {}),
    }, [audio.buffer])
  })
}
