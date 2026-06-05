import { ShieldCheck, MapPin, Cpu, Clock, ShieldAlert } from 'lucide-react'
import type { VideoMeta } from '../lib/metadata'

interface Props {
  meta:          VideoMeta
  strip:         boolean
  onToggleStrip: (v: boolean) => void
}

export default function MetadataReport({ meta, strip, onToggleStrip }: Props) {
  const hasAnyFlag = meta.hasGps || meta.hasDeviceInfo || meta.hasTimestamp

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-3"
      style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Embedded metadata
        </span>
        {hasAnyFlag
          ? <span className="text-xs" style={{ color: '#f59e0b' }}>
              {meta.flagCount} {meta.flagCount === 1 ? 'issue' : 'issues'}
            </span>
          : <span className="text-xs" style={{ color: '#10b981' }}>Clean</span>
        }
      </div>

      <div className="flex flex-col gap-1.5">
        {meta.hasGps && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#f59e0b' }}>
            <MapPin size={11} />
            <span>GPS coordinates{meta.gpsString ? `: ${meta.gpsString}` : ' detected'}</span>
          </div>
        )}
        {meta.hasDeviceInfo && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#f59e0b' }}>
            <Cpu size={11} />
            <span>Device information detected</span>
          </div>
        )}
        {meta.hasTimestamp && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={11} />
            <span>Creation timestamp present</span>
          </div>
        )}
        {!hasAnyFlag && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <ShieldCheck size={11} />
            <span>No GPS, device, or identifying metadata found</span>
          </div>
        )}
      </div>

      <button
        onClick={() => onToggleStrip(!strip)}
        className="flex items-center gap-2 text-xs py-2 w-full"
        style={{
          borderLeft:   `2px solid ${strip ? '#10b981' : '#ef4444'}`,
          borderTop:    'none',
          borderRight:  'none',
          borderBottom: 'none',
          paddingLeft:  8,
          background:   'transparent',
          color:        strip ? '#10b981' : '#ef4444',
          cursor:       'pointer',
          textAlign:    'left',
        }}
      >
        {strip
          ? <><ShieldCheck size={12} /> Strip all metadata on export</>
          : <><ShieldAlert size={12} /> Metadata will be kept in export</>
        }
      </button>
    </div>
  )
}
