import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'calmclip_pro_license'

function makeLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

describe('pro lib', () => {
  let lsMock: ReturnType<typeof makeLocalStorage>

  beforeEach(async () => {
    lsMock = makeLocalStorage()
    vi.stubGlobal('localStorage', lsMock)
    vi.resetModules()
  })

  it('getProStatus returns { active: false } when nothing is stored', async () => {
    const { getProStatus } = await import('../pro')
    expect(getProStatus()).toEqual({ active: false })
  })

  it('getProStatus returns { active: false, storageError } when stored JSON is invalid', async () => {
    lsMock.setItem(STORAGE_KEY, 'not-json')
    const { getProStatus } = await import('../pro')
    const status = getProStatus()
    expect(status.active).toBe(false)
    expect('storageError' in status).toBe(true)
  })

  it('getProStatus returns { active: false } when stored object has active: false', async () => {
    lsMock.setItem(STORAGE_KEY, JSON.stringify({ active: false }))
    const { getProStatus } = await import('../pro')
    expect(getProStatus()).toEqual({ active: false })
  })

  it('getProStatus returns { active: false } when licenseKey is not a string', async () => {
    lsMock.setItem(STORAGE_KEY, JSON.stringify({ active: true, licenseKey: 12345 }))
    const { getProStatus } = await import('../pro')
    expect(getProStatus()).toEqual({ active: false })
  })

  it('getProStatus returns active status when valid data is stored', async () => {
    const payload = { active: true, licenseKey: 'ABC-123', activatedAt: 1700000000000 }
    lsMock.setItem(STORAGE_KEY, JSON.stringify(payload))
    const { getProStatus } = await import('../pro')
    const status = getProStatus()
    expect(status.active).toBe(true)
    if (status.active) {
      expect(status.licenseKey).toBe('ABC-123')
      expect(status.activatedAt).toBe(1700000000000)
    }
  })

  it('getProStatus defaults activatedAt to 0 when missing', async () => {
    lsMock.setItem(STORAGE_KEY, JSON.stringify({ active: true, licenseKey: 'KEY' }))
    const { getProStatus } = await import('../pro')
    const status = getProStatus()
    expect(status.active).toBe(true)
    if (status.active) {
      expect(status.activatedAt).toBe(0)
    }
  })

  it('isPro returns false when no license is stored', async () => {
    const { isPro } = await import('../pro')
    expect(isPro()).toBe(false)
  })

  it('isPro returns true when a valid license is stored', async () => {
    lsMock.setItem(STORAGE_KEY, JSON.stringify({ active: true, licenseKey: 'VALID' }))
    const { isPro } = await import('../pro')
    expect(isPro()).toBe(true)
  })

  it('clearProStatus removes the stored license', async () => {
    lsMock.setItem(STORAGE_KEY, JSON.stringify({ active: true, licenseKey: 'VALID' }))
    const { clearProStatus, getProStatus } = await import('../pro')
    clearProStatus()
    expect(lsMock.getItem(STORAGE_KEY)).toBeNull()
    expect(getProStatus()).toEqual({ active: false })
  })

  it('verifyAndActivate returns error when license key is empty', async () => {
    const { verifyAndActivate } = await import('../pro')
    const result = await verifyAndActivate('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('enter your license key')
    }
  })

  it('verifyAndActivate returns ok: false for a non-empty key (network or config error)', async () => {
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({ success: false, message: 'Invalid license.' }),
    }))
    const { verifyAndActivate } = await import('../pro')
    const result = await verifyAndActivate('SOME-KEY')
    expect(result.ok).toBe(false)
    vi.unstubAllGlobals()
  })
})
