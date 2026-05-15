import { useEffect, useState } from 'react'

/**
 * 1.5px sage thread that fills horizontally as the user scrolls. Pure ambient
 * affordance — uses transform: scaleX so the browser hardware-accelerates it.
 */
export function ScrollProgress() {
  const [ratio, setRatio] = useState(0)

  useEffect(() => {
    let rafId: number | null = null
    const compute = () => {
      const scroll = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setRatio(max > 0 ? Math.min(1, Math.max(0, scroll / max)) : 0)
      rafId = null
    }
    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', compute)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div className="scroll-progress__fill" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  )
}
