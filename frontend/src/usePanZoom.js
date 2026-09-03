import { useEffect, useRef, useState } from 'react'

// k=1 is the full plot (current default). That is now the farthest you can zoom out.
const MIN_K = 2
const MAX_K = 80
const INITIAL_K = 10
// Fraction of plot size. Positive X is right (east); negative Y is up (north).
const INITIAL_X = 0.12
const INITIAL_Y = -0.12

function centeredView(width, height, k) {
  const focusX = width * (0.5 + INITIAL_X)
  const focusY = height * (0.5 + INITIAL_Y)
  return {
    k,
    x: width / 2 - focusX * k,
    y: height / 2 - focusY * k,
  }
}

function clientToSvg(svg, clientX, clientY) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
}

export function usePanZoom(width = 0, height = 0) {
  const [svg, setSvg] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, k: INITIAL_K })
  const [panning, setPanning] = useState(false)
  const drag = useRef(null)

  useEffect(() => {
    if (!width || !height) return
    setView(centeredView(width, height, INITIAL_K))
  }, [width, height])

  useEffect(() => {
    if (!svg) return

    const onWheel = (e) => {
      e.preventDefault()
      const p = clientToSvg(svg, e.clientX, e.clientY)
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView(({ x, y, k }) => {
        const nextK = Math.min(MAX_K, Math.max(MIN_K, k * factor))
        const s = nextK / k
        return {
          k: nextK,
          x: p.x - (p.x - x) * s,
          y: p.y - (p.y - y) * s,
        }
      })
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svg])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = clientToSvg(e.currentTarget, e.clientX, e.clientY)
    setPanning(true)
  }

  const onPointerMove = (e) => {
    if (!drag.current) return
    const p = clientToSvg(e.currentTarget, e.clientX, e.clientY)
    const dx = p.x - drag.current.x
    const dy = p.y - drag.current.y
    drag.current = p
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  const onPointerUp = () => {
    drag.current = null
    setPanning(false)
  }

  return {
    ref: setSvg,
    view,
    panning,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
