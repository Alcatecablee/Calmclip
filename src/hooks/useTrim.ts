import { useState } from 'react'

export function useTrim() {
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd,   setTrimEnd]   = useState(0)
  return { trimStart, setTrimStart, trimEnd, setTrimEnd }
}
