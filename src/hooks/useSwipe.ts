import { useRef, useCallback } from 'react'
import type React from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeOptions = {}) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const onLeftRef = useRef(onSwipeLeft)
  const onRightRef = useRef(onSwipeRight)
  onLeftRef.current = onSwipeLeft
  onRightRef.current = onSwipeRight

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!startRef.current) return
    const dx = e.changedTouches[0].clientX - startRef.current.x
    const dy = e.changedTouches[0].clientY - startRef.current.y
    startRef.current = null
    if (Math.abs(dx) < threshold) return
    // Require horizontal to clearly dominate to avoid false positives during scroll
    if (Math.abs(dy) > Math.abs(dx)) return
    if (dx > 0) onRightRef.current?.()
    else onLeftRef.current?.()
  }, [threshold])

  return { onTouchStart, onTouchEnd }
}
