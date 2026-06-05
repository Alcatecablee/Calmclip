export function fmtTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtElapsed(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function fmtTimePrecise(s: number): string {
  const m    = Math.floor(s / 60)
  const sec  = s % 60
  const secS = sec < 10 ? `0${sec.toFixed(1)}` : sec.toFixed(1)
  return `${m}:${secS}`
}
