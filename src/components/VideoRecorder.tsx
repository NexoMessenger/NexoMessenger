import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { fmtDuration } from './MessageExtras'
import { IconClose, IconFlipCamera, IconPlay, IconPause, IconStop, IconSend, IconTrash } from './icons'

const MAX_SEC = 60
const VIDEO_MIMES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

export function pickMime(candidates: string[]): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || ''
}

export function mediaSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
}

/**
 * Telegram-style round video recorder. Camera/mic are requested only when the
 * recorder opens; every track is stopped on close, cancel, send or unmount.
 */
export default function VideoRecorder({ onSend, onClose }: {
  onSend: (blob: Blob, durationSec: number) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<'init' | 'ready' | 'recording' | 'preview' | 'error'>('init')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [previewUrl, setPreviewUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<number>()
  const startRef = useRef(0)
  const stoppingRef = useRef(false)

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  const startCamera = async (mode: 'user' | 'environment') => {
    stopTracks()
    if (!mediaSupported()) { setPhase('error'); setError(t('composer.mediaUnsupported')); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.src = ''; await videoRef.current.play().catch(() => undefined) }
      setPhase('ready'); setError('')
    } catch {
      setPhase('error'); setError(t('composer.camDenied'))
    }
  }

  useEffect(() => {
    startCamera(facing)
    return () => {
      stopTracks()
      window.clearInterval(timerRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream || phase !== 'ready') return
    const mime = pickMime(VIDEO_MIMES)
    try {
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 }) : new MediaRecorder(stream)
      recorderRef.current = rec
      chunksRef.current = []
      stoppingRef.current = false
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        window.clearInterval(timerRef.current)
        stopTracks()
        if (stoppingRef.current) return
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' })
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setPhase('preview')
        requestAnimationFrame(() => {
          if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.src = url; videoRef.current.loop = true; videoRef.current.play().catch(() => undefined) }
        })
      }
      rec.start(250)
      startRef.current = Date.now()
      setElapsed(0)
      setPhase('recording')
      timerRef.current = window.setInterval(() => {
        const sec = (Date.now() - startRef.current) / 1000
        setElapsed(sec)
        if (sec >= MAX_SEC) stopRecording()
      }, 200)
    } catch {
      setPhase('error'); setError(t('composer.mediaUnsupported'))
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  const discard = () => {
    stoppingRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    window.clearInterval(timerRef.current)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(''); blobRef.current = null
    onClose()
  }

  const send = () => {
    if (!blobRef.current) return
    const blob = blobRef.current
    const dur = Math.max(1, Math.round(elapsed))
    onSend(blob, dur)
    onClose()
  }

  return (
    <div className="video-overlay" role="dialog" aria-modal="true" aria-label={t('composer.video')}>
      <div className="video-panel glass card">
        <div className="video-panel-head">
          <span className="video-panel-title">{t('composer.video')}</span>
          <button className="icon-btn" onClick={discard} aria-label={t('common.cancel')}><IconClose size={17} /></button>
        </div>

        <div className="video-preview-circle">
          <video ref={videoRef} playsInline muted={phase !== 'preview'} autoPlay={phase !== 'preview'}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
          {phase === 'recording' && <span className="rec-dot" aria-hidden="true" />}
          <span className="video-timer">{fmtDuration(elapsed)}{phase === 'recording' ? ` / ${fmtDuration(MAX_SEC)}` : ''}</span>
        </div>

        {error && <div className="error-box" role="alert">{error}</div>}
        {phase === 'init' && !error && <div className="center-loader"><div className="spinner" /></div>}

        <div className="video-controls">
          {phase === 'ready' && (
            <>
              <button className="icon-btn video-side-btn" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label={t('composer.flip')}><IconFlipCamera size={19} /></button>
              <button className="record-btn" onClick={startRecording} aria-label={t('composer.record')} />
              <span className="video-side-spacer" />
            </>
          )}
          {phase === 'recording' && (
            <button className="btn btn-primary" onClick={stopRecording}><IconStop size={15} /> {t('composer.stop')}</button>
          )}
          {phase === 'preview' && (
            <>
              <button className="btn" onClick={() => { setPreviewUrl(''); blobRef.current = null; setElapsed(0); setPhase('init'); startCamera(facing) }}>
                <IconTrash size={15} /> {t('composer.retake')}
              </button>
              <button className="icon-btn" onClick={() => { const v = videoRef.current; if (v) playing ? v.pause() : v.play().catch(() => undefined) }}
                aria-label={playing ? t('composer.pause') : t('composer.record')}>
                {playing ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>
              <button className="btn btn-primary" onClick={send}><IconSend size={15} /> {t('composer.sendVideo')}</button>
            </>
          )}
          {phase === 'error' && <button className="btn btn-primary" onClick={discard}>{t('common.cancel')}</button>}
        </div>
      </div>
    </div>
  )
}
