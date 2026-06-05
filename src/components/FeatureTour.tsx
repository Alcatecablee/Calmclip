import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import {
  type TabType,
  TOUR_TABS,
  WAVEFORM_BARS,
  CROP_RATIO_OPTIONS,
  CROP_MODE_OPTIONS,
  getSilentSegments,
} from '../lib/tourSteps'

export default function FeatureTour() {
  const [activeTab, setActiveTab] = useState<TabType>('silence')

  // Silence Cutter States
  const [threshold, setThreshold] = useState(-35)
  const [isPlayingSilence, setIsPlayingSilence] = useState(false)
  const [playheadPos, setPlayheadPos] = useState(0)
  const animationFrameRef = useRef<number | null>(null)


  // Smart Crop States
  const [cropRatio, setCropRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')
  const [cropMode, setCropMode] = useState<'fill' | 'fit'>('fill')
  const [subjectX, setSubjectX] = useState(50) // Percentage from left

  // Face Blur States
  const [hasBlurRegion, setHasBlurRegion] = useState(true)
  const [blurIntensity, setBlurIntensity] = useState(10)

  // Subject movement for crop playground
  useEffect(() => {
    let direction = 1
    let currentX = 50
    const interval = setInterval(() => {
      currentX += direction * 0.8
      if (currentX > 75) {
        direction = -1
      } else if (currentX < 25) {
        direction = 1
      }
      setSubjectX(currentX)
    }, 40)
    return () => clearInterval(interval)
  }, [])

  const silentZones = getSilentSegments(threshold)

  // Silence playhead update
  useEffect(() => {
    if (!isPlayingSilence) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    let lastTime = performance.now()
    const animate = (time: number) => {
      const delta = (time - lastTime) / 30 // controls speed
      lastTime = time

      setPlayheadPos(prev => {
        let nextPos = prev + delta
        if (nextPos >= 100) {
          nextPos = 0
        }

        // Jump over silent segments instantly
        for (const zone of silentZones) {
          if (nextPos >= zone.start && nextPos < zone.end) {
            nextPos = zone.end
          }
        }

        return nextPos
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlayingSilence, silentZones])

  const togglePlaySilence = () => {
    setIsPlayingSilence(!isPlayingSilence)
  }

  const handleResetSilence = () => {
    setIsPlayingSilence(false)
    setPlayheadPos(0)
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 24,
      marginTop: 20,
    }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{
          fontSize: 10,
          color: 'var(--text-faint)',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          flexShrink: 0,
        }}>
          Interactive local engine tour
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <p style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        marginBottom: 16
      }}>
        Explore how our high performance WebAssembly models edit files instantly directly inside your browser. No server uploads required.
      </p>

      {/* Tabs list */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: 4,
        marginBottom: 20,
      }}>
        {TOUR_TABS.map(tab => {
          const isActive = activeTab === tab.id
          const TabIcon = tab.Icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                height: 36,
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                borderRadius: '4px 4px 0 0',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 500,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="tab-hover-btn"
            >
              <TabIcon size={13} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Playground Area */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 4,
        padding: 16,
      }}>
        {/* TAB 1: SILENCE CUTTER */}
        {activeTab === 'silence' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Silence threshold cutter</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  FFmpeg analyzes local decibel volumes and slices out absolute quiet spots.
                </p>
              </div>
              <span style={{
                fontSize: 9,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: 'var(--primary)',
                background: 'var(--primary-a8)',
                border: '1px solid var(--primary-a20)',
                padding: '2px 6px',
                borderRadius: 12,
              }}>
                WASM Core
              </span>
            </div>

            {/* Threshold Slider */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '12px 14px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cut threshold:</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{threshold} dB</span>
              </div>
              <input
                type="range"
                min="-60"
                max="-20"
                value={threshold}
                onChange={e => {
                  setThreshold(Number(e.target.value))
                  setPlayheadPos(0)
                  setIsPlayingSilence(false)
                }}
                style={{
                  width: '100%',
                  height: 4,
                  accentColor: 'var(--primary)',
                  background: 'var(--border)',
                  borderRadius: 2,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-faint)', marginTop: 4 }}>
                <span>-60 dB (Very quiet)</span>
                <span>-20 dB (Aggressive cut)</span>
              </div>
            </div>

            {/* Simulated Waveform Display */}
            <div style={{
              height: 70,
              background: 'var(--bg-surface-2)',
              borderRadius: 4,
              border: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
            }}>
              {/* Silent Zones Highlights */}
              {silentZones.map((zone, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${zone.start}%`,
                    width: `${zone.end - zone.start}%`,
                    top: 0,
                    bottom: 0,
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderLeft: '1px dashed rgba(239, 68, 68, 0.5)',
                    borderRight: '1px dashed rgba(239, 68, 68, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  <span style={{ fontSize: 8, color: 'rgba(239, 68, 68, 0.72)', fontFamily: 'monospace', fontWeight: 600 }}>CUT</span>
                </div>
              ))}

              {/* Fake Audio Bars */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                height: '60%',
                position: 'relative',
                zIndex: 2,
              }}>
                {WAVEFORM_BARS.map((val, idx) => {
                  const isSilentBar = silentZones.some(z => {
                    const barPct = (idx / 29) * 100
                    return barPct >= z.start && barPct <= z.end
                  })
                  return (
                    <div
                      key={idx}
                      style={{
                        width: '2%',
                        height: `${val}%`,
                        background: isSilentBar ? 'rgba(255,255,255,0.12)' : 'var(--primary)',
                        borderRadius: 1,
                        transition: 'all 0.2s ease',
                      }}
                    />
                  )
                })}
              </div>

              {/* Animating Playhead */}
              <div style={{
                position: 'absolute',
                left: `${playheadPos}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--primary)',
                zIndex: 10,
                pointerEvents: 'none',
              }} />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={togglePlaySilence}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 4,
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    fontWeight: 600,
                    fontSize: 12,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  className="tour-primary-btn"
                >
                  {isPlayingSilence ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isPlayingSilence ? 'Pause Preview' : 'Preview Jump-Cuts'}</span>
                </button>
                <button
                  onClick={handleResetSilence}
                  style={{
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 4,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  className="tour-secondary-btn"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>

              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} />
                <span>
                  {silentZones.length} quiet gaps removed: {(silentZones.length * 1.2).toFixed(1)}s saved
                </span>
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: SMART CROP */}
        {activeTab === 'crop' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Smart crop auto-reframer</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Intelligently reframe landscape horizontal files into vertical reels.
                </p>
              </div>
              <span style={{
                fontSize: 9,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: 'var(--primary)',
                background: 'var(--primary-a8)',
                border: '1px solid var(--primary-a20)',
                padding: '2px 6px',
                borderRadius: 12,
              }}>
                GPU Layout
              </span>
            </div>

            {/* Target Ratio Selection */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 6 }}>Target Ratio:</span>
              {CROP_RATIO_OPTIONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setCropRatio(r.id as '16:9' | '9:16' | '1:1')}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    background: cropRatio === r.id ? 'rgba(255,255,255,0.10)' : 'transparent',
                    color: cropRatio === r.id ? '#ffffff' : 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="tab-hover-btn"
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Crop Mode Switcher */}
            {cropRatio !== '16:9' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 15 }}>Crop Mode:</span>
                {CROP_MODE_OPTIONS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setCropMode(m.id as 'fill' | 'fit')}
                    style={{
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: cropMode === m.id ? 'rgba(255,255,255,0.10)' : 'transparent',
                      color: cropMode === m.id ? '#ffffff' : 'var(--text-muted)',
                      fontSize: 9,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    className="tab-hover-btn"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* Simulated Video Canvas */}
            <div style={{
              height: 120,
              background: '#000000',
              borderRadius: 4,
              border: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Outer boundary representing output video */}
              <div style={{
                transition: 'all 0.3s ease',
                background: 'var(--bg-surface-2)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...(cropRatio === '16:9' && {
                  width: '100%',
                  height: '100%',
                }),
                ...(cropRatio === '9:16' && {
                  ...(cropMode === 'fill' ? {
                    width: 67.5, // 9:16 ratio bounding container width
                    height: '100%',
                  } : {
                    width: '100%',
                    height: '100%',
                  })
                }),
                ...(cropRatio === '1:1' && {
                  ...(cropMode === 'fill' ? {
                    width: 120,
                    height: '100%',
                  } : {
                    width: '100%',
                    height: '100%',
                  })
                })
              }}>
                {/* Moving Face subject inside the landscape source */}
                <div style={{
                  position: 'absolute',
                  left: `${subjectX}%`,
                  transform: 'translateX(-50%)',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  transition: 'left 0.04s linear',
                  zIndex: 2,
                }}>
                  😊
                </div>

                {/* Subtitle preview overlaid */}
                <div style={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#f2f2f4',
                  fontSize: 8,
                  padding: '2px 6px',
                  borderRadius: 2,
                  zIndex: 3,
                  whiteSpace: 'nowrap',
                }}>
                  Smart Center crop preview
                </div>

                {/* Gridlines overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '1px solid var(--border-subtle)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }} />

                {/* Crop Box Overlay in Fit Mode */}
                {cropRatio !== '16:9' && cropMode === 'fit' && (
                  <div style={{
                    position: 'absolute',
                    border: '2px solid var(--primary)',
                    pointerEvents: 'none',
                    zIndex: 5,
                    transition: 'all 0.3s ease',
                    ...(cropRatio === '9:16' && {
                      width: '37.5%',
                      height: '100%',
                      top: 0,
                      bottom: 0,
                    }),
                    ...(cropRatio === '1:1' && {
                      width: '56.25%',
                      height: '100%',
                      top: 0,
                      bottom: 0,
                    })
                  }}>
                    <span style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      fontSize: 7,
                      fontWeight: 700,
                      padding: '1px 3px',
                      borderRadius: 1,
                    }}>
                      CROP AREA
                    </span>
                  </div>
                )}
              </div>

              {/* Letterboxing masks for Fit Mode */}
              {cropRatio !== '16:9' && cropMode === 'fit' && (
                <>
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.65)',
                    pointerEvents: 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 4,
                    ...(cropRatio === '9:16' && { width: '31.25%' }),
                    ...(cropRatio === '1:1' && { width: '21.87%' }),
                  }} />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.65)',
                    pointerEvents: 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 4,
                    ...(cropRatio === '9:16' && { width: '31.25%' }),
                    ...(cropRatio === '1:1' && { width: '21.87%' }),
                  }} />
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FACE BLUR */}
        {activeTab === 'blur' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Anonymizing face & region blur</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Mask sensitive info. Fast canvas pixelation occurs entirely in sandbox memory.
                </p>
              </div>
              <span style={{
                fontSize: 9,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: 'var(--primary)',
                background: 'var(--primary-a8)',
                border: '1px solid var(--primary-a20)',
                padding: '2px 6px',
                borderRadius: 12,
              }}>
                Privacy Lock
              </span>
            </div>

            {/* Blur Intensity Slider */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '12px 14px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Blur level (gblur sigma):</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{blurIntensity} px</span>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                value={blurIntensity}
                onChange={e => setBlurIntensity(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 4,
                  accentColor: 'var(--primary)',
                  background: 'var(--border)',
                  borderRadius: 2,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Video preview with local SVG filter */}
            <div style={{
              height: 110,
              background: 'var(--bg-surface-2)',
              borderRadius: 4,
              border: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}>
              {/* SVG blur filter definition */}
              <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                  <filter id="demo-face-blur">
                    <feGaussianBlur stdDeviation={hasBlurRegion ? blurIntensity / 2.5 : 0} />
                  </filter>
                </defs>
              </svg>

              {/* Simulated Subject layout */}
              <div style={{
                position: 'relative',
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
              }}>
                <span>👤</span>
                
                {/* Highlighted Face Blur Mask */}
                {hasBlurRegion && (
                  <div style={{
                    position: 'absolute',
                    width: 48,
                    height: 48,
                    top: 10,
                    borderRadius: '50%',
                    backdropFilter: 'none', // Strict rule alignment
                    filter: 'url(#demo-face-blur)',
                    background: 'rgba(63, 63, 75, 0.9)',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Dash boundary box representing active blur area */}
                {hasBlurRegion && (
                  <div style={{
                    position: 'absolute',
                    width: 52,
                    height: 52,
                    top: 8,
                    border: '1.5px dashed var(--primary)',
                    borderRadius: '50%',
                    zIndex: 3,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>

              {hasBlurRegion && (
                <span style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  fontSize: 9,
                  color: 'var(--primary)',
                  background: 'var(--primary-a10)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--primary-a20)'
                }}>
                  Blur Region 01 Active
                </span>
              )}
            </div>

            {/* Toggle Blur button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setHasBlurRegion(!hasBlurRegion)}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 4,
                  background: hasBlurRegion ? 'rgba(239, 68, 68, 0.15)' : 'var(--primary)',
                  color: hasBlurRegion ? '#ef4444' : 'var(--primary-foreground)',
                  border: hasBlurRegion ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                className="tour-primary-btn"
              >
                <span>{hasBlurRegion ? 'Remove Blur Mask' : 'Add Blur Mask'}</span>
              </button>

              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Perfect for blurring credentials and faces locally
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
