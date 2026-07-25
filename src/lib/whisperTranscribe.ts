import type { Word } from './captionEngine'

const TAG = '[CalmClip Whisper]'

// Decode a 16 kHz mono WAV Blob to a normalized Float32Array of PCM samples.
// AudioContext is available on the main thread; the worker receives the raw
// samples directly, matching the original worker-based implementation.
//
// Peak normalization mirrors the logic in whisper.ts extractAudioForWhisper:
// when 0.02 < peak < 0.9, scale to a 0.9 peak so Whisper receives consistent
// amplitude regardless of whether the source video was quiet or loud.
// Below 0.02 the audio is near-silent (VAD will handle it); above 0.9 no gain
// is needed. In both cases the raw samples are returned unchanged.
async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const raw = decoded.getChannelData(0) // mono: channel 0
    let peak = 0
    for (let i = 0; i < raw.length; i++) {
      const abs = Math.abs(raw[i])
      if (abs > peak) peak = abs
    }
    if (peak > 0.02 && peak < 0.9) {
      const gain = 0.9 / peak
      const normalised = new Float32Array(raw.length)
      for (let i = 0; i < raw.length; i++) normalised[i] = raw[i] * gain
      return normalised
    }
    return raw
  } finally {
    audioCtx.close()
  }
}

// Distributes words evenly across a duration starting at startOffset.
// Used as a fallback when Whisper returns no per-word timestamps.
function distributeWords(transcript: string, durationSeconds: number, startOffset = 0): Word[] {
  const tokens = transcript.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const avgDur = durationSeconds / tokens.length
  return tokens.map((text, i) => ({
    text,
    startTime: parseFloat((startOffset + i * avgDur).toFixed(3)),
    endTime: parseFloat((startOffset + (i + 1) * avgDur).toFixed(3)),
  }))
}

export interface TranscribeHandle {
  promise: Promise<{ transcript: string; words: Word[]; detectedLanguage?: string }>
  cancel:  () => void
}

// transcribeToTimedWords runs Whisper on the provided audio blob and returns
// word-level timed transcription.
//
// audioBlob must be 16 kHz mono WAV covering [trimStart, trimEnd] of the
// original video. Whisper returns timestamps relative to 0 (the start of the
// WAV); this function offsets them by trimStart so all returned Word objects
// carry absolute video timestamps that match videoRef.currentTime.
//
// videoDurationSeconds should be the duration of the audio blob itself
// (trimEnd - trimStart), not the full video duration, so the fallback word
// distribution and progress estimation operate over the correct range.
export function transcribeToTimedWords(
  audioBlob: Blob,
  videoDurationSeconds: number,
  onStatusUpdate?: (msg: string) => void,
  model?: string,
  language?: string,
  trimStart = 0,
): TranscribeHandle {
  let workerRef:  Worker | null                         = null
  let rejectRef:  ((reason?: unknown) => void) | null   = null

  const cancel = () => {
    workerRef?.terminate()
    workerRef = null
    rejectRef?.(new Error('cancelled'))
    rejectRef = null
  }

  const promise = (async () => {
    console.log(TAG, 'transcribeToTimedWords: audioBlob size:', audioBlob.size, 'duration:', videoDurationSeconds)

    onStatusUpdate?.('Decoding audio...')
    const audio = await blobToFloat32Array(audioBlob)
    console.log(TAG, 'decoded Float32Array length:', audio.length)

    return new Promise<{ transcript: string; words: Word[]; detectedLanguage?: string }>((resolve, reject) => {
      rejectRef = reject

      const worker = new Worker(
        new URL('../workers/whisper.worker.ts', import.meta.url),
        { type: 'module' },
      )
      workerRef = worker

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
          workerRef  = null
          rejectRef  = null

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
                // Whisper timestamps are 0-based relative to the start of the
                // audio blob. Offset by trimStart to produce absolute video
                // timestamps that align with videoRef.currentTime.
                startTime: trimStart + (c.timestamp[0] ?? 0),
                endTime:   trimStart + (c.timestamp[1] ?? ((c.timestamp[0] ?? 0) + 0.5)),
              }))
              .filter(w => w.text.length > 0)
            console.log(TAG, 'words from chunks:', words.length)
          }

          if (words.length === 0) {
            console.warn(TAG, 'no timestamp chunks, using distributeWords fallback')
            // Distribute words across the trimmed range starting at trimStart.
            words = distributeWords(transcript, videoDurationSeconds, trimStart)
          }

          // Clamp to the absolute trim range [trimStart, trimStart + audioDuration].
          // Words outside this range indicate a Whisper timing error; clamping
          // prevents captions from appearing at impossible video positions.
          const absEnd = trimStart + videoDurationSeconds
          words = words.map(w => ({
            ...w,
            startTime: Math.max(trimStart, Math.min(w.startTime, absEnd)),
            endTime:   Math.max(trimStart, Math.min(w.endTime,   absEnd)),
          }))

          console.log(TAG, 'done:', words.length, 'words')
          onStatusUpdate?.('Done')
          resolve({ transcript, words, detectedLanguage: msg.detectedLanguage })
        } else if (msg.type === 'error') {
          worker.terminate()
          workerRef = null
          rejectRef = null
          reject(new Error(msg.message ?? 'Transcription failed.'))
        }
      }

      worker.onerror = (err) => {
        worker.terminate()
        workerRef = null
        rejectRef = null
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
        model: model ?? 'Xenova/whisper-tiny',
        ...(language ? { language } : {}),
      }, [audio.buffer])
    })
  })()

  return { promise, cancel }
}
