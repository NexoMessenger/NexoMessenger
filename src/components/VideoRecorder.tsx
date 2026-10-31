import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { fmtDuration } from './MessageExtras'

const MAX_SEC = 60
const MIN_MS = 500
const VIDEO_MIMES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

export function pickMime(candidates: string[]): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || ''
}
export function mediaSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
}

export type VideoHoldIntent = 'holding' | 'send' | 'cancel'

/** A hold gesture begins at the composer's button, not inside this overlay. */
export default function VideoRecorder({ intent, onSend, onClose, onError }: {
  intent: VideoHoldIntent
  onSend: (blob: Blob, durationSec: number) => void
  onClose: () => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<number>()
  const intentRef = useRef(intent)
  const sent = useRef(false)
  const startedAt = useRef(0)
  const [phase, setPhase] = useState<'starting' | 'recording' | 'finishing'>('starting')
  const [elapsed, setElapsed] = useState(0)
  intentRef.current = intent

  useEffect(() => {
    let disposed = false
    intentRef.current = intent
    const stopTracks = () => {
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    const currentIntent = (): VideoHoldIntent => intentRef.current
    const start = async () => {
      if (currentIntent() !== 'holding') { if (currentIntent() === 'send') onError(t('composer.videoTooShort')); onClose(); return }
      if (!mediaSupported()) { onError(t('composer.mediaUnsupported')); onClose(); return }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: true })
      } catch {
        if (!disposed) { if (currentIntent() !== 'cancel') onError(t('composer.camDenied')); onClose() }
        return
      }
      if (disposed || currentIntent() !== 'holding') {
        stream.getTracks().forEach(track => track.stop())
        if (!disposed) { if (currentIntent() === 'send') onError(t('composer.videoTooShort')); onClose() }
        return
      }
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined) }
      const chunks: Blob[] = []
      try {
        const mime = pickMime(VIDEO_MIMES)
        const recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 }) : new MediaRecorder(stream)
        recorderRef.current = recorder
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
        recorder.onerror = () => {
          if (disposed) return
          intentRef.current = 'cancel'; stopTracks(); onError(t('composer.mediaUnsupported')); onClose()
        }
        recorder.onstop = () => {
          window.clearInterval(timerRef.current)
          stopTracks()
          if (disposed || sent.current) return
          if (intentRef.current === 'cancel') { onClose(); return }
          const durationMs = Date.now() - startedAt.current
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
          if (durationMs < MIN_MS || !blob.size) { onError(t('composer.videoTooShort')); onClose(); return }
          sent.current = true
          onSend(blob, Math.max(1, Math.min(MAX_SEC, Math.round(durationMs / 1000))))
          onClose()
        }
        recorder.start(250)
        startedAt.current = Date.now()
        setPhase('recording')
        timerRef.current = window.setInterval(() => {
          const seconds = (Date.now() - startedAt.current) / 1000
          setElapsed(Math.min(seconds, MAX_SEC))
          if (seconds >= MAX_SEC && recorder.state !== 'inactive') {
            intentRef.current = 'send'; setPhase('finishing'); recorder.stop()
          }
        }, 150)
      } catch {
        stopTracks()
        if (!disposed) { onError(t('composer.mediaUnsupported')); onClose() }
      }
    }
    void start()
    return () => {
      disposed = true
      intentRef.current = 'cancel'
      window.clearInterval(timerRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      stopTracks()
    }
    // The gesture has one lifetime. A new component is mounted for every hold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (intent === 'holding') return
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') { setPhase('finishing'); recorder.stop() }
    else if (!recorder) { if (intent === 'send') onError(t('composer.videoTooShort')); onClose() }
    // Cleanup stops a stream which resolves after a cancelled permission prompt.
  }, [intent])

  return <div className="video-hold-overlay" role="status" aria-live="polite">
    <div className="video-hold-preview"><video className="nexo-camera-frame" ref={videoRef} playsInline muted autoPlay />
      {phase === 'recording' && <span className="video-hold-dot" aria-hidden="true" />}
    </div>
    <div className="video-hold-footer"><span>{phase === 'starting' ? t('composer.videoStarting') : phase === 'finishing' ? t('composer.videoFinishing') : `${fmtDuration(elapsed)} / ${fmtDuration(MAX_SEC)}`}</span><span>{t('composer.videoHoldHint')}</span></div>
  </div>
}
