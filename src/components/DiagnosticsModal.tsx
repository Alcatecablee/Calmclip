import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function DiagnosticsModal({ onClose }: Props) {
  const kbdStyle: React.CSSProperties = {
    background: 'var(--bg-surface-2)',
    padding: '0 4px',
    borderRadius: 3,
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 10,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.60)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        data-cc-modal
        className="w-full max-w-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden"
        style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)' }}
      >
        <div
          data-cc-modal-header
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center" style={{ gap: 2 }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{ height: 22, width: 22, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/wordmark.png" alt="CalmClip" className="modal-wordmark" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0, marginTop: 5 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 2 }}>Help & Support</span>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>

          <div style={{ background: 'var(--primary-a8)', border: '1px solid var(--primary-a20)', borderRadius: 6, padding: '8px 12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.55, margin: 0 }}>
              CalmClip runs entirely in your browser using WebAssembly. Nothing you load or edit is ever sent to a server.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>1. Is my video private?</span>
            <p>
              Yes. CalmClip runs entirely inside your browser. Your video files and audio tracks are processed on your own computer and are never uploaded to any external server. Closing the tab or refreshing the page permanently removes all loaded media from memory.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>2. What video formats and file sizes are supported?</span>
            <p>
              CalmClip accepts MP4, MOV, MKV, AVI, WebM, and most other common container formats. The hard file size limit is 4 GB to protect browser memory stability. Files under 500 MB process near-instantly. Files between 500 MB and 2 GB work well but may require a few seconds to load. Files between 2 GB and 4 GB are supported but benefit from closing other heavy browser tabs first.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>3. What browsers are supported?</span>
            <p>
              Chromium-based browsers (Chrome 112+, Edge 112+, Brave, Opera) are recommended and provide the fastest multi-threaded export performance. Firefox 115+ works but may be slower for large exports. Safari has limited WebAssembly thread support and is not recommended for export-heavy workflows. All browsers must have JavaScript and WebAssembly enabled.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>4. Why is the silence cutter removing too much or too little?</span>
            <p>
              The threshold slider controls how quiet a section must be before it is cut. A lower threshold (further left, around -50 dB) only removes very long, very deep silences such as pauses between sentences. A higher threshold (further right, around -30 dB) is more aggressive and will remove shorter gaps and background noise floors. Start at -40 dB and adjust. If speech is being cut, lower the threshold. If pauses remain, raise it. The minimum silence duration slider sets the shortest gap that qualifies as a cut.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>5. How do I undo or redo a cut?</span>
            <p>
              Manual cuts support full undo and redo. Press <kbd style={kbdStyle}>Ctrl + Z</kbd> (Windows/Linux) or <kbd style={kbdStyle}>Cmd + Z</kbd> (macOS) to undo the most recent cut. Press <kbd style={kbdStyle}>Ctrl + Shift + Z</kbd> to redo it. The Undo and Redo buttons in the Manual Cuts panel do the same thing. Deleting a cut also pushes it onto the undo stack so you can recover it.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>6. Keyboard shortcuts reference</span>
            <p>Shortcuts are active when focus is not inside a text field. Press <kbd style={kbdStyle}>?</kbd> at any time to open the full shortcuts panel.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
              <div className="p-3 rounded-lg flex flex-col gap-1.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Playback</span>
                <span><kbd style={kbdStyle}>Space</kbd> play/pause</span>
                <span><kbd style={kbdStyle}>J</kbd> rewind 5 s, <kbd style={kbdStyle}>L</kbd> forward 5 s</span>
                <span><kbd style={kbdStyle}>Left / Right</kbd> step one frame</span>
              </div>
              <div className="p-3 rounded-lg flex flex-col gap-1.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Editing</span>
                <span><kbd style={kbdStyle}>[</kbd> trim start, <kbd style={kbdStyle}>]</kbd> trim end</span>
                <span><kbd style={kbdStyle}>M</kbd> cut at playhead</span>
                <span><kbd style={kbdStyle}>Ctrl Z</kbd> undo, <kbd style={kbdStyle}>Ctrl Shift Z</kbd> redo</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>7. How do export presets and batch export work?</span>
            <p>
              Export presets let you save your full export configuration (codec, quality level, audio normalization settings, aspect ratio, and crop mode) as a named preset stored in your browser. Presets persist across sessions. Batch export runs the export pipeline once for each supported aspect ratio (16:9, 9:16, 1:1, and 4:3) automatically, producing separate output files for each. All processing happens locally and files are downloaded directly to your device.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>8. Why is my export slow or stuck?</span>
            <p>
              Export speed depends on your CPU speed, available RAM, and how many other tabs or applications are running. Tips to speed it up: close unused browser tabs, quit memory-heavy applications, ensure hardware acceleration is enabled in your browser settings (Settings &gt; System &gt; Use hardware acceleration), and use a Chromium-based browser which makes better use of multi-threaded WebAssembly. If an export appears completely stuck for more than two minutes, refresh the page, reload your file, and try again. The FFmpeg engine prints progress to the browser console if you need to diagnose a hang.
            </p>
            <a
              href="https://calmpc.com?ref=calmclip"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <img src="/calmpc-logo.png" alt="CalmPC" height="16" style={{ width: 'auto', objectFit: 'contain', flexShrink: 0, mixBlendMode: 'screen' }} />
              <span>Consistently slow? CalmPC runs a free health check on your computer and walks you through fixes.</span>
            </a>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>9. How does face blur work?</span>
            <p>
              Draw a rectangular region over the face or area you want to blur in the Face Blur panel. You can add multiple regions. Each region is blurred with a pixelate filter applied by FFmpeg during export. Regions are fixed to the coordinates you draw and do not track movement. For a moving subject, draw a region that covers the full range of movement, or add overlapping regions.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>10. How do I add a watermark or logo?</span>
            <p>
              Open the Watermark panel and upload a PNG, SVG, or WebP image file. Set the position (corner or center), scale (as a percentage of the output frame width), and opacity. The watermark is composited onto every frame during export. For best results use a PNG with a transparent background. If your logo file is rejected, check that it is a supported image type and not a PDF or video file.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
