import { useState } from 'react'
import { ExternalLink, X, Check, AlertTriangle, Trash2 } from 'lucide-react'
import { verifyAndActivate, clearProStatus, type ProStatus } from '../lib/pro'

interface Props {
  onClose: () => void
  onActivated: () => void
  onDeactivated?: () => void
  proStatus?: ProStatus
  initialView?: 'manage' | 'unlock' | 'restore'
}

const GUMROAD_URL = import.meta.env.VITE_GUMROAD_URL as string | undefined

const PRO_FEATURES = [
  '1080p export quality',
  'Batch export (all ratios)',
  'Region blur (face blur)',
  'Export presets',
  'Watermark overlay',
]

type Phase = 'idle' | 'verifying' | 'done' | 'error'

function formatActivationDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function maskLicenseKey(key: string): string {
  const parts = key.split('-')
  if (parts.length < 2) return key.slice(-8).padStart(key.length, '*')
  return parts
    .map((p, i) => (i < parts.length - 1 ? p.replace(/./g, '*') : p))
    .join('-')
}

const MODAL_SHADOW = '0 24px 48px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)'

export default function ProUnlockModal({ onClose, onActivated, onDeactivated, proStatus, initialView }: Props) {
  const isManage = proStatus?.active === true
  const defaultView = initialView ?? (isManage ? 'manage' : 'unlock')
  const [view, setView] = useState<'manage' | 'unlock' | 'restore'>(defaultView)
  const [key, setKey] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  async function handleVerify() {
    if (phase === 'verifying') return
    setPhase('verifying')
    setErrorMsg('')
    const result = await verifyAndActivate(key)
    if (result.ok) {
      setPhase('done')
      setTimeout(() => {
        onActivated()
        onClose()
      }, 1200)
    } else {
      setPhase('error')
      setErrorMsg(result.error)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleVerify()
  }

  function handleDeactivate() {
    clearProStatus()
    onDeactivated?.()
    onClose()
  }

  const activeRecord = proStatus?.active === true ? proStatus : null
  const isDisabled = !key.trim() || phase === 'verifying' || phase === 'done'

  const inputStyle = (ph: Phase): React.CSSProperties => ({
    flex: 1,
    background: 'var(--bg-surface)',
    border: `1.5px solid ${ph === 'error' ? '#ef4444' : ph === 'done' ? '#10b981' : 'var(--border)'}`,
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    padding: '0 10px',
    height: 34,
    outline: 'none',
    letterSpacing: '0.03em',
    minWidth: 0,
  })

  const activateBtnStyle: React.CSSProperties = {
    background: isDisabled ? 'var(--bg-surface-2)' : 'var(--primary)',
    border: `1px solid ${isDisabled ? 'var(--border)' : 'var(--primary)'}`,
    borderRadius: 6,
    color: isDisabled ? 'var(--text-faint)' : 'var(--primary-foreground)',
    fontSize: 11,
    fontWeight: 600,
    padding: '0 14px',
    height: 34,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  const closeButtonStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.60)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        data-cc-modal
        className="w-full max-w-sm flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: MODAL_SHADOW,
        }}
      >
        <div
          data-cc-modal-header
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center" style={{ gap: 2 }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{ height: 22, width: 22, objectFit: 'contain', flexShrink: 0 }} />
            <img src="/wordmark.png" alt="CalmClip" className="modal-wordmark" style={{ height: 16, width: 'auto', objectFit: 'contain', flexShrink: 0, marginTop: 5 }} />
            {view !== 'unlock' && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 2 }}>
                {view === 'manage' ? 'Manage License' : 'Restore Purchases'}
              </span>
            )}
          </div>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={13} />
          </button>
        </div>
        {'storageError' in (proStatus ?? {}) && (
          <div
            className="flex items-center gap-2 px-5 py-2.5 text-xs"
            style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}
          >
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            {'storageError' in proStatus! ? (proStatus as { storageError: string }).storageError : ''}
          </div>
        )}

        {view === 'restore' ? (
          <div className="flex flex-col gap-3 p-5">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Enter the license key from your Gumroad confirmation email to restore Pro on this device.
            </p>
            <div className="flex flex-col gap-1.5">
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={key}
                  onChange={e => { setKey(e.target.value); if (phase === 'error') setPhase('idle') }}
                  onKeyDown={handleKeyDown}
                  placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  spellCheck={false}
                  autoComplete="off"
                  style={inputStyle(phase)}
                  onFocus={e => { if (phase !== 'error' && phase !== 'done') e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { if (phase !== 'error' && phase !== 'done') e.target.style.borderColor = 'var(--border)' }}
                  disabled={phase === 'verifying' || phase === 'done'}
                />
                <button onClick={handleVerify} disabled={isDisabled} style={activateBtnStyle}>
                  {phase === 'verifying' ? 'Checking...' : phase === 'done' ? 'Activated' : 'Activate'}
                </button>
              </div>
              {phase === 'error' && (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={11} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#ef4444', lineHeight: 1.5 }}>{errorMsg}</span>
                </div>
              )}
              {phase === 'done' && (
                <div className="flex items-center gap-1.5">
                  <Check size={11} color="#10b981" />
                  <span style={{ fontSize: 11, color: '#10b981' }}>License verified. Pro is now active.</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setView('unlock')}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', textAlign: 'center', padding: 0 }}
            >
              Don't have a key yet? View Pro plans
            </button>
          </div>
        ) : view === 'manage' && activeRecord ? (
          <div className="flex flex-col gap-4 p-5">
            <div
              className="flex flex-col gap-2 p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
            >
              <div className="flex items-center gap-2">
                <Check size={12} color="#10b981" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Pro is active in this browser</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>License key</span>
                  <span style={{ fontSize: 11, fontFamily: "'SF Mono','Fira Code',monospace", color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {maskLicenseKey(activeRecord.licenseKey)}
                  </span>
                </div>
                {activeRecord.activatedAt > 0 && (
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Activated</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatActivationDate(activeRecord.activatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!confirmDeactivate ? (
              <button
                onClick={() => setConfirmDeactivate(true)}
                style={{
                  background: 'none', border: '1px solid rgba(239,68,68,0.28)',
                  borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 500,
                  padding: '7px 0', cursor: 'pointer', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Trash2 size={11} />
                Deactivate license
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
                  This removes Pro from this browser. Reactivate anytime with your key.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setConfirmDeactivate(false)}
                    style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, padding: '7px 0', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeactivate}
                    style={{ flex: 1, background: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, color: '#ffffff', fontSize: 11, fontWeight: 600, padding: '7px 0', cursor: 'pointer' }}
                  >
                    Yes, deactivate
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setView('unlock')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, cursor: 'pointer', textAlign: 'center', padding: 0 }}
            >
              Enter a different license key
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-5">
            <div
              className="p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
            >
              <p style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                What you unlock
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                {PRO_FEATURES.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Check size={9} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {GUMROAD_URL ? (
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--primary)', color: 'var(--primary-foreground)', textDecoration: 'none',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                  borderRadius: 8, height: 38,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                Get Pro on Gumroad
                <ExternalLink size={11} />
              </a>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Purchase CalmClip Pro on Gumroad. Your license key arrives in the confirmation email immediately after checkout.
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 500 }}>already purchased?</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={key}
                  onChange={e => { setKey(e.target.value); if (phase === 'error') setPhase('idle') }}
                  onKeyDown={handleKeyDown}
                  placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  spellCheck={false}
                  autoComplete="off"
                  style={inputStyle(phase)}
                  onFocus={e => { if (phase !== 'error' && phase !== 'done') e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { if (phase !== 'error' && phase !== 'done') e.target.style.borderColor = 'var(--border)' }}
                  disabled={phase === 'verifying' || phase === 'done'}
                />
                <button onClick={handleVerify} disabled={isDisabled} style={activateBtnStyle}>
                  {phase === 'verifying' ? 'Checking...' : phase === 'done' ? 'Activated' : 'Activate'}
                </button>
              </div>
              {phase === 'error' && (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={11} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#ef4444', lineHeight: 1.5 }}>{errorMsg}</span>
                </div>
              )}
              {phase === 'done' && (
                <div className="flex items-center gap-1.5">
                  <Check size={11} color="#10b981" />
                  <span style={{ fontSize: 11, color: '#10b981' }}>License verified. Pro is now active.</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setView(isManage ? 'manage' : 'restore')}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', textAlign: 'center', padding: 0 }}
            >
              {isManage ? 'Back to license details' : 'Already purchased on another device?'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
