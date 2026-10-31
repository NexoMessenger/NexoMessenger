import { useEffect, useRef, useState } from 'react'
import type { AttachmentInfo } from '../lib/types'
import { ErrorBox, Modal, errText } from './ui'
import * as api from '../lib/api'
import { useI18n } from '../i18n'
import {
  IconAttach, IconSend, IconImage, IconFile, IconMic, IconVideoCircle,
  IconSticker, IconStop, IconTrash, IconPlay, IconPause, IconWand,
} from './icons'
import { StickerPicker } from './FoxStickers'
import { NEXO_ANIMATED_EMOJI } from '../lib/premiumData'
import { AudioBubble, fmtDuration } from './MessageExtras'
import VideoRecorder, { mediaSupported, pickMime, type VideoHoldIntent } from './VideoRecorder'

const AUDIO_MIMES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
const MAX_AUDIO_SEC = 300

interface Props {
  placeholder: string
  sending: boolean
  onSend: (text: string, att?: AttachmentInfo) => Promise<void>
  onTyping: () => void
  upload: (file: File) => Promise<AttachmentInfo>
  /** Edit mode: when initialTextKey changes to a message id, the input is
   *  prefilled with initialText (and focused) instead of keeping the draft. */
  initialText?: string
  initialTextKey?: string
  /** NEXO Premium: unlocks the animated emoji panel. */
  premiumEmojiEnabled?: boolean
  onPremiumEmojiLocked?: () => void
}

export default function Composer({ placeholder, sending, onSend, onTyping, upload, initialText, initialTextKey, premiumEmojiEnabled = false, onPremiumEmojiLocked }: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<AttachmentInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [stickerOpen, setStickerOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [videoIntent, setVideoIntent] = useState<VideoHoldIntent>('cancel')
  const videoGesture = useRef<{ pointerId: number | null; x: number; cancel: boolean } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWorking, setAiWorking] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiResult, setAiResult] = useState('')
  const [aiSource, setAiSource] = useState('')
  const aiRequest = useRef(0)
  const [failedMedia, setFailedMedia] = useState<{ blob: Blob; duration: number; name: string } | null>(null)

  // audio recording state
  const [recPhase, setRecPhase] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [recElapsed, setRecElapsed] = useState(0)
  const [recPaused, setRecPaused] = useState(false)
  const [recUrl, setRecUrl] = useState('')
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<number>()
  const startRef = useRef(0)
  const discardRef = useRef(false)

  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const lastTyping = useRef(0)

  // Capture release even if the pointer moves outside the button or the overlay opens.
  useEffect(() => {
    const finish = (event: PointerEvent) => {
      const gesture = videoGesture.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      videoGesture.current = null
      setVideoIntent(event.type === 'pointercancel' || gesture.cancel ? 'cancel' : 'send')
    }
    const move = (event: PointerEvent) => {
      const gesture = videoGesture.current
      if (gesture && gesture.pointerId === event.pointerId && event.clientX < gesture.x - 90) gesture.cancel = true
    }
    const cancel = () => { if (videoGesture.current) { videoGesture.current = null; setVideoIntent('cancel') } }
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('blur', cancel)
    const visibility = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  const beginVideoHold = (pointerId: number | null, x: number) => {
    if (busy || videoGesture.current || videoOpen) return
    setError('')
    videoGesture.current = { pointerId, x, cancel: false }
    setVideoIntent('holding'); setVideoOpen(true)
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  // Stop mic/camera + timers if the composer unmounts (leaving the chat).
  useEffect(() => () => {
    aiRequest.current++
    stopStream()
    window.clearInterval(timerRef.current)
    if (recUrl) URL.revokeObjectURL(recUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grow = () => {
    const ta = taRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px' }
  }

  // Edit mode prefill (only when the edit target actually changes).
  const lastInitKey = useRef('')
  useEffect(() => {
    aiRequest.current++; setAiOpen(false); setAiWorking(false); setAiResult(''); setAiError('')
    if (initialTextKey && initialTextKey !== lastInitKey.current) {
      lastInitKey.current = initialTextKey
      setText(initialText || '')
      requestAnimationFrame(() => { grow(); taRef.current?.focus() })
    }
    if (!initialTextKey) lastInitKey.current = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTextKey])

  const handleTyping = () => {
    const ts = Date.now()
    if (ts - lastTyping.current > 2500) { lastTyping.current = ts; onTyping() }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true); setError('')
    try { setPending(await upload(file)) } catch (e) {
      setError(errText(e, t))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = async () => {
    if (sending || uploading || aiOpen || aiWorking) return
    if (!text.trim() && !pending) return
    const body = text; const att = pending || undefined
    setText(''); setPending(null)
    requestAnimationFrame(grow)
    try { await onSend(body, att) } catch (e) {
      setError(errText(e, t))
      setText(body); if (att) setPending(att)
    }
  }

  /* ---------------- voice recording ---------------- */

  const startAudio = async () => {
    setError(''); setFailedMedia(null)
    if (!mediaSupported()) { setError(t('composer.mediaUnsupported')); return }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(t('composer.micDenied')); return
    }
    streamRef.current = stream
    const mime = pickMime(AUDIO_MIMES)
    try {
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recRef.current = rec
      chunksRef.current = []
      discardRef.current = false
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        window.clearInterval(timerRef.current)
        stopStream()
        if (discardRef.current) { setRecPhase('idle'); return }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        blobRef.current = blob
        setRecUrl(URL.createObjectURL(blob))
        setRecPhase('preview')
      }
      rec.start(250)
      startRef.current = Date.now()
      setRecElapsed(0); setRecPaused(false)
      setRecPhase('recording')
      timerRef.current = window.setInterval(() => {
        if (recRef.current?.state === 'recording') {
          const sec = (Date.now() - startRef.current) / 1000
          setRecElapsed(sec)
          if (sec >= MAX_AUDIO_SEC) stopAudio()
        }
      }, 200)
    } catch {
      stopStream()
      setError(t('composer.mediaUnsupported'))
    }
  }

  const stopAudio = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }
  const discardAudio = () => {
    discardRef.current = true
    stopAudio()
    window.clearInterval(timerRef.current)
    stopStream()
    if (recUrl) URL.revokeObjectURL(recUrl)
    setRecUrl(''); blobRef.current = null
    setRecPhase('idle')
  }
  const togglePauseAudio = () => {
    const rec = recRef.current
    if (!rec) return
    if (rec.state === 'recording' && typeof rec.pause === 'function') { rec.pause(); setRecPaused(true) }
    else if (rec.state === 'paused' && typeof rec.resume === 'function') { rec.resume(); setRecPaused(false); startRef.current = Date.now() - recElapsed * 1000 }
  }

  /** Upload a recorded blob, then hand it to the normal message pipeline. */
  const sendMedia = async (blob: Blob, durationSec: number, name: string) => {
    setUploading(true); setError('')
    try {
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
      const att = await upload(file)
      await onSend('', { ...att, duration: Math.max(1, Math.round(durationSec)) })
      setFailedMedia(null)
    } catch (e) {
      setError(errText(e, t))
      setFailedMedia({ blob, duration: durationSec, name })
    } finally { setUploading(false) }
  }

  const sendRecordedAudio = async () => {
    if (!blobRef.current) return
    const blob = blobRef.current; const dur = recElapsed
    discardAudio()
    await sendMedia(blob, dur, `voice-${Date.now()}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`)
  }

  const busy = sending || uploading

  const closeAi = () => {
    aiRequest.current++; setAiOpen(false); setAiWorking(false); setAiResult(''); setAiError('')
  }
  const rewrite = async (action: api.AiRewriteAction) => {
    const source = text
    if (!source.trim() || source.length > 2000 || aiWorking || busy) return
    const request = ++aiRequest.current
    setAiWorking(true); setAiResult(''); setAiError(''); setAiSource(source)
    try {
      const output = await api.rewriteAi(source, action)
      if (aiRequest.current === request) setAiResult(output)
    } catch (e) {
      if (aiRequest.current === request) {
        const code = e instanceof Error ? e.message : ''
        const message = code === 'AI_DAILY_LIMIT' ? 'ai.dailyLimit' : code === 'AI_RATE_LIMIT' ? 'ai.rateLimit' : code === 'AI_BUSY' ? 'ai.busy' : code === 'AI_CERT_ERROR' ? 'ai.certError' : code === 'AI_AUTH_ERROR' ? 'ai.authError' : code === 'AI_FORBIDDEN' ? 'ai.forbidden' : code === 'AI_NOT_CONFIGURED' ? 'ai.setup' : 'nexo.error'
        setAiError(t(message))
      }
    } finally { if (aiRequest.current === request) setAiWorking(false) }
  }

  return (
    <div>
      <div style={{ padding: '0 16px' }}><ErrorBox error={error} /></div>
      {failedMedia && !uploading && (
        <div style={{ padding: '0 16px 8px' }}>
          <button className="btn btn-sm" onClick={() => sendMedia(failedMedia.blob, failedMedia.duration, failedMedia.name)}>
            ⟳ {t('composer.uploadRetry')}
          </button>
        </div>
      )}
      {pending && (
        <div className="pending-attachment glass">
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>{pending.type.startsWith('image/') ? <IconImage size={17} /> : <IconFile size={17} />}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending.name}</span>
          <button className="link-btn" onClick={() => setPending(null)}>{t('composer.remove')}</button>
        </div>
      )}
      {uploading && <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--text-2)' }}>{t('composer.uploading')}</div>}

      {stickerOpen && recPhase === 'idle' && (
        <div style={{ padding: '0 12px 8px' }}>
          <StickerPicker onSend={(key) => {
            setStickerOpen(false)
            onSend('', { url: key, name: 'NEXO Fox sticker', type: 'sticker/nexo-fox' }).catch((e) => {
              setError(errText(e, t))
            })
          }} />
        </div>
      )}

      {emojiOpen && recPhase === 'idle' && (
        <div style={{ padding: '0 12px 8px' }}>
          <div className="sticker-panel glass nexo-emoji-panel">
            <div className="sticker-panel-head">
              <span className="sticker-panel-title">{t('premium.emojiPanelTitle')}</span>
              <span className="pill pill-accent">NEXO Premium</span>
            </div>
            {premiumEmojiEnabled ? (
              <>
                <div className="nexo-emoji-grid">
                  {NEXO_ANIMATED_EMOJI.map(({ emoji, anim }) => (
                    <button key={emoji} className="nexo-emoji-cell" aria-label={emoji}
                      onClick={() => {
                        setText((prev) => prev + emoji)
                        requestAnimationFrame(() => { grow(); taRef.current?.focus() })
                      }}>
                      <span className={`nexo-emoji-anim anim-${anim}`}>{emoji}</span>
                    </button>
                  ))}
                </div>
                <p className="premium-hint" style={{ margin: '8px 2px 0' }}>{t('premium.emojiPanelHint')}</p>
              </>
            ) : (
              <div className="nexo-emoji-locked">
                <p>{t('premium.emojiLocked')}</p>
                <button className="btn btn-primary btn-sm" onClick={onPremiumEmojiLocked}>{t('premium.getPremium')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {recPhase === 'recording' ? (
        <div className="composer recorder-bar">
          <span className="rec-dot" aria-hidden="true" />
          <span className="rec-time">{recPaused ? '❚❚ ' : ''}{fmtDuration(recElapsed)} · {t('composer.recording')}</span>
          <span style={{ flex: 1 }} />
          {typeof MediaRecorder !== 'undefined' && 'pause' in MediaRecorder.prototype && (
            <button className="icon-btn" onClick={togglePauseAudio} aria-label={recPaused ? t('composer.resume') : t('composer.pause')}>
              {recPaused ? <IconPlay size={17} /> : <IconPause size={17} />}
            </button>
          )}
          <button className="icon-btn" onClick={discardAudio} aria-label={t('composer.discard')}><IconTrash size={17} /></button>
          <button className="btn btn-primary btn-sm" onClick={stopAudio}><IconStop size={14} /> {t('composer.stop')}</button>
        </div>
      ) : recPhase === 'preview' ? (
        <div className="composer recorder-bar">
          <AudioBubble url={recUrl} duration={recElapsed} label={t('composer.voice')} />
          <span style={{ flex: 1 }} />
          <button className="icon-btn" onClick={discardAudio} aria-label={t('composer.discard')}><IconTrash size={17} /></button>
          <button className="send-btn" onClick={sendRecordedAudio} disabled={busy} aria-label={t('composer.sendRecording')}><IconSend size={18} /></button>
        </div>
      ) : (
        <div className={`composer${text.trim() ? ' composer-with-ai' : ''}`}>
          <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.zip,.doc,.docx"
            onChange={(e) => pickFile(e.target.files?.[0])} />
          <button className="icon-btn composer-btn" onClick={() => fileRef.current?.click()}
            aria-label={t('composer.attach')} disabled={busy}><IconAttach size={19} /></button>
          <button className={`icon-btn composer-btn ${stickerOpen ? 'active' : ''}`} onClick={() => setStickerOpen(!stickerOpen)}
            aria-label={t('composer.sticker')} aria-pressed={stickerOpen}><IconSticker size={19} /></button>
          <textarea ref={taRef} className="composer-input" rows={1} placeholder={placeholder} value={text}
            onChange={(e) => { setText(e.target.value); grow(); handleTyping() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
          {text.trim() && <button className="icon-btn composer-btn composer-ai-btn" type="button" disabled={busy} onClick={() => { setAiOpen(true); setAiResult(''); setAiError('') }} aria-label={t('nexo.draftTools')} title={t('nexo.draftTools')}><IconWand size={19} /></button>}
          {text.trim() || pending ? (
            <button className="send-btn" onClick={submit} disabled={busy} aria-label={t('composer.send')}>
              {sending ? '…' : <IconSend size={18} />}
            </button>
          ) : (
            <>
              <button className="icon-btn composer-btn" onClick={startAudio} aria-label={t('composer.voice')} disabled={busy}><IconMic size={19} /></button>
              <button className="icon-btn composer-btn video-hold-button" type="button" aria-label={t('composer.videoHoldLabel')} title={t('composer.videoHoldLabel')} disabled={busy || Boolean(initialTextKey)}
                onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }; beginVideoHold(event.pointerId, event.clientX) }}
                onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); beginVideoHold(null, 0) } }}
                onKeyUp={event => { if ((event.key === ' ' || event.key === 'Enter') && videoGesture.current?.pointerId === null) { event.preventDefault(); videoGesture.current = null; setVideoIntent('send') } }}
                onContextMenu={event => event.preventDefault()}><IconVideoCircle size={19} /></button>
            </>
          )}
        </div>
      )}

      {aiOpen && <Modal title={t('nexo.draftTools')} onClose={closeAi}>
        <div className="composer-ai-panel">
          <p>{t('nexo.draftPrivacy')}</p>
          {text.length > 2000 && <p role="alert">{t('nexo.tooLong')}</p>}
          <div className="composer-ai-actions">
            {(['correct', 'improve', 'shorten'] as const).map(action => <button type="button" className="btn btn-sm" key={action} disabled={aiWorking || busy || !text.trim() || text.length > 2000} onClick={() => void rewrite(action)}>{t(`nexo.${action}`)}</button>)}
          </div>
          {aiWorking && <p role="status">{t('ai.thinking')}</p>}
          {aiError && <p className="composer-ai-error" role="alert">{aiError}</p>}
          {aiResult && <div className="composer-ai-preview">
            <strong>{t('nexo.result')}</strong><p>{aiResult}</p>
            {text !== aiSource && <p role="status">{t('nexo.draftChanged')}</p>}
            <button type="button" className="btn btn-primary btn-sm" disabled={text !== aiSource || busy} onClick={() => { setText(aiResult); closeAi(); requestAnimationFrame(() => { grow(); taRef.current?.focus() }) }}>{t('nexo.useDraft')}</button>
          </div>}
        </div>
      </Modal>}
      {videoOpen && (
        <VideoRecorder
          intent={videoIntent}
          onClose={() => { videoGesture.current = null; setVideoOpen(false) }}
          onError={setError}
          onSend={(blob, dur) => void sendMedia(blob, dur, `circle-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`)}
        />
      )}
    </div>
  )
}
