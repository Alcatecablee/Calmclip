import { RATIO_SLUG, type Ratio, type OutputFormat } from './ffmpeg'

export async function togglePip(video: HTMLVideoElement): Promise<'entered' | 'exited'> {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture()
    return 'exited'
  }
  await video.requestPictureInPicture()
  return 'entered'
}

export async function copyFrameToClipboard(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < 2) throw new Error('Video not ready yet.')
  const canvas = document.createElement('canvas')
  canvas.width  = video.videoWidth  || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context.')
  ctx.drawImage(video, 0, 0)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not capture frame.')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function shareExport(blob: Blob, format: OutputFormat, ratio: Ratio): Promise<void> {
  const ext      = format === 'webm' ? 'webm' : format === 'mov' ? 'mov' : 'mp4'
  const mimeType = format === 'webm' ? 'video/webm' : format === 'mov' ? 'video/quicktime' : 'video/mp4'
  const shareFile = new File([blob], `calmclip-${RATIO_SLUG[ratio]}.${ext}`, { type: mimeType })
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [shareFile] })) {
    throw new Error('Your browser does not support sharing video files. Try the Download or Save to disk option instead.')
  }
  await navigator.share({ files: [shareFile] })
}

type SavePickerWindow = Window & {
  showSaveFilePicker(opts: Record<string, unknown>): Promise<{
    createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>
  }>
}

export async function saveExportToDisk(blob: Blob, format: OutputFormat, ratio: Ratio): Promise<void> {
  const ext      = format === 'webm' ? 'webm' : format === 'mov' ? 'mov' : 'mp4'
  const mimeType = format === 'webm' ? 'video/webm' : format === 'mov' ? 'video/quicktime' : 'video/mp4'
  // showSaveFilePicker is a File System Access API method not yet in TypeScript's standard DOM
  // lib; SavePickerWindow above documents the expected shape.
  const handle = await (window as unknown as SavePickerWindow).showSaveFilePicker({
    suggestedName: `calmclip-${RATIO_SLUG[ratio]}.${ext}`,
    types: [{ description: 'Video file', accept: { [mimeType]: [`.${ext}`] } }],
  })
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}
