import { Component, Suspense, lazy, useState, type ReactNode } from 'react'
import astraImage from '../assets/bot/astra-original.png'

const AstraModel = lazy(() => import('./AstraSplat'))

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Keep the original artwork as a fallback when 3D is unavailable. */
export default function Astra({ greeting = false, speaking = false, activity = 0 }: { greeting?: boolean; speaking?: boolean; activity?: number }) {
  void speaking
  const [failed, setFailed] = useState(false)
  const fallback = <img className="astra-figure astra-fallback" src={astraImage} alt="Astra" />
  if (failed) return fallback
  return <ModelBoundary fallback={fallback}><Suspense fallback={fallback}><AstraModel greeting={greeting} activity={activity} onFailure={() => setFailed(true)} fallback={fallback} /></Suspense></ModelBoundary>
}
