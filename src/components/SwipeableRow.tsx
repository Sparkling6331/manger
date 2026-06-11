import { useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

const REVEAL = 76

interface Props {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onDelete: () => void
  children: React.ReactNode
}

export default function SwipeableRow({ isOpen, onOpen, onClose, onDelete, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const touchStart = useRef({ x: 0, y: 0 })
  const baseX = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)

  function translate(x: number, anim = false) {
    if (!ref.current) return
    ref.current.style.transition = anim ? 'transform 0.2s ease' : 'none'
    ref.current.style.transform = `translateX(${x}px)`
  }

  useEffect(() => { translate(isOpen ? -REVEAL : 0, true) }, [isOpen])

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    baseX.current = isOpen ? -REVEAL : 0
    direction.current = null
    translate(baseX.current)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y

    if (!direction.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      direction.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (direction.current !== 'h') return

    translate(Math.max(-REVEAL, Math.min(0, baseX.current + dx)))
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (direction.current !== 'h') {
      if (isOpen) { onClose(); translate(0, true) }
      return
    }
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const finalX = baseX.current + dx
    if (finalX < -REVEAL / 2) { translate(-REVEAL, true); onOpen() }
    else { translate(0, true); onClose() }
  }

  return (
    <div className="relative overflow-hidden border-b border-gray-50 last:border-0">
      <div className="absolute right-0 inset-y-0 w-[76px] bg-red-500 flex items-center justify-center">
        <button
          onClick={onDelete}
          className="w-full h-full flex items-center justify-center active:bg-red-600"
        >
          <Trash2 size={20} className="text-white" />
        </button>
      </div>
      <div
        ref={ref}
        className="relative bg-white flex items-center px-4 py-2.5 gap-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
