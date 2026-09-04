import { useEffect, useState } from 'react'
import type { Prediction } from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL
export const PREDICTION_POLL_MS = 15_000

const HIDDEN = new Set(['CANCELLED', 'SKIPPED', 'NO_DATA'])

function when(prediction: Prediction) {
  const iso = prediction.arrival_time ?? prediction.departure_time
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function visiblePredictions(
  predictions: Prediction[],
  route?: string | null,
) {
  const now = Date.now() - 30_000
  return predictions.filter((prediction) => {
    if (HIDDEN.has(prediction.schedule_relationship ?? '')) return false
    if (route && prediction.route && prediction.route !== route) return false
    const time = when(prediction)
    if (!time) return false
    return time.getTime() >= now
  })
}

export function usePredictions(stopIds: string[], enabled: boolean) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const stop = stopIds.join(',')

  useEffect(() => {
    if (!enabled || !stop) {
      setPredictions([])
      setError(null)
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    const load = (initial: boolean) => {
      fetch(`${API_BASE}/predictions?stop=${encodeURIComponent(stop)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
          return res.json() as Promise<Prediction[]>
        })
        .then((data) => {
          if (!cancelled) {
            setPredictions(data)
            setError(null)
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message)
        })
        .finally(() => {
          if (!cancelled && initial) setLoaded(true)
        })
    }
    load(true)
    const id = setInterval(() => load(false), PREDICTION_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, stop])

  return { predictions, error, loading: enabled && !loaded }
}
