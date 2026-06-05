import { useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Upload, Film } from 'lucide-react'

interface Props {
  onFile: (file: File) => void
}

export interface DropZoneHandle {
  open: () => void
}

const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.ts', '.wmv']

function isVideoFile(f: File): boolean {
  if (f.type.startsWith('video/')) return true
  const ext = '.' + f.name.split('.').pop()?.toLowerCase()
  return VIDEO_EXTS.includes(ext)
}

const DropZone = forwardRef<DropZoneHandle, Props>(function DropZone({ onFile }, ref) {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.click(),
  }))

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!isVideoFile(f)) return
    onFile(f)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`dropzone${dragging ? ' is-dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => {
        if (!(e.currentTarget as HTMLDivElement).contains(e.relatedTarget as Node)) {
          setDragging(false)
        }
      }}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      <div className="dropzone-icon" style={{ color: dragging ? 'var(--primary)' : 'var(--text-dim)' }}>
        {dragging ? <Film size={28} /> : <Upload size={28} />}
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {dragging ? 'Release to open' : 'Drop your video here'}
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          or <span style={{ color: 'var(--primary)', fontWeight: 500 }}>browse files</span>
          <span style={{ color: 'var(--text-faint)' }}> · </span>MP4, MOV, WebM, MKV
        </p>
      </div>
    </div>
  )
})

export default DropZone
