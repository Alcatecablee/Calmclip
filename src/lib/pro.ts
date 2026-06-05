const STORAGE_KEY = 'calmclip_pro_license'

// Set to true while fixing bugs. Flip to false before going live.
const PRO_GATES_DISABLED = false

// In-memory session cache. Set by initPro() on app load.
// null  = initPro() has not run yet (synchronous fallback to localStorage is used).
// true  = Gumroad confirmed the stored key is valid this session.
// false = No key stored, or Gumroad rejected the stored key.
let _sessionVerified: boolean | null = null

export type ProStatus =
  | { active: false }
  | { active: true; licenseKey: string; activatedAt: number }
  | { active: false; storageError: string }

export function getProStatus(): ProStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { active: false }
    const parsed = JSON.parse(raw)
    if (parsed?.active === true && typeof parsed.licenseKey === 'string') {
      return { active: true, licenseKey: parsed.licenseKey, activatedAt: parsed.activatedAt ?? 0 }
    }
    return { active: false }
  } catch (e) {
    return { active: false, storageError: e instanceof Error ? e.message : 'Could not read license storage.' }
  }
}

// Called once on app mount. Re-verifies the stored license key against Gumroad
// (without incrementing the use count) and caches the result in memory for the
// session. Returns the verified Pro state.
//
// Behavior by case:
//   No key in storage        -> cache false, return false.
//   Key present, Gumroad OK  -> cache true, return true.
//   Key present, Gumroad bad -> clear storage, cache false, return false.
//   Key present, network err -> trust storage (offline legit user), cache true, return true.
//   PRODUCT_ID not configured -> trust storage, cache true, return true.
export async function initPro(): Promise<boolean> {
  if (PRO_GATES_DISABLED) {
    _sessionVerified = true
    return true
  }

  const status = getProStatus()
  if (!status.active) {
    _sessionVerified = false
    return false
  }

  const PRODUCT_ID = import.meta.env.VITE_GUMROAD_PRODUCT_ID as string | undefined
  if (!PRODUCT_ID) {
    // Cannot verify remotely without a product ID. Trust what is stored.
    _sessionVerified = true
    return true
  }

  try {
    const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: PRODUCT_ID,
        license_key: status.licenseKey,
        increment_uses_count: 'false',
      }),
    })
    const data = await res.json() as Record<string, unknown>
    if (data.success) {
      _sessionVerified = true
      return true
    }
    // Gumroad rejected the key. It was either forged or revoked.
    clearProStatus()
    _sessionVerified = false
    return false
  } catch {
    // Network unavailable. Trust the stored key so offline users keep access.
    _sessionVerified = true
    return true
  }
}

export function isPro(): boolean {
  if (PRO_GATES_DISABLED) return true
  // Use the in-memory session result when available.
  if (_sessionVerified !== null) return _sessionVerified
  // initPro() has not completed yet. Fall back to localStorage for the brief
  // window between first render and mount effect resolution.
  return getProStatus().active
}

function saveProStatus(licenseKey: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    active: true,
    licenseKey,
    activatedAt: Date.now(),
  }))
  // Update the session cache immediately so isPro() reflects activation
  // without waiting for a page reload.
  _sessionVerified = true
}

export function clearProStatus(): void {
  localStorage.removeItem(STORAGE_KEY)
  _sessionVerified = false
}

export type VerifyResult =
  | { ok: true; licenseKey: string }
  | { ok: false; error: string }

export async function verifyAndActivate(rawKey: string): Promise<VerifyResult> {
  const licenseKey = rawKey.trim()
  if (!licenseKey) {
    return { ok: false, error: 'Please enter your license key.' }
  }

  const PRODUCT_ID = import.meta.env.VITE_GUMROAD_PRODUCT_ID as string | undefined
  if (!PRODUCT_ID) {
    return { ok: false, error: 'Product ID is not configured. Contact support.' }
  }

  let data: Record<string, unknown>
  try {
    const res = await fetch(
      `https://api.gumroad.com/v2/licenses/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          product_id: PRODUCT_ID,
          license_key: licenseKey,
          increment_uses_count: 'true',
        }),
      }
    )
    data = await res.json() as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' }
  }

  if (!data.success) {
    const msg = typeof data.message === 'string' ? data.message : 'Invalid or already-used license key.'
    return { ok: false, error: msg }
  }

  const purchase = data.purchase as Record<string, unknown> | undefined
  if (purchase?.test === true) {
    return { ok: false, error: 'This is a test purchase. Only real purchases generate valid license keys.' }
  }

  saveProStatus(licenseKey)
  return { ok: true, licenseKey }
}
