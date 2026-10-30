import { useEffect, useRef, useState } from 'react'
import type { AttachmentInfo } from '../lib/types'
import { ErrorBox, errText } from './ui'
import { useI18n } from '../i18n'
import {
  IconAttach, IconSend, IconImage, IconFile, IconMic, IconVideoCircle,
  IconSticker, IconStop, IconTrash, IconPlay, IconPause,
} from './icons'
import { StickerPicker } from './FoxStickers'
import { NEXO_ANIMATED_EMOJI } from '../lib/premiumData'
import { AudioBubble, fmtDuration } from './MessageExtras'
import VideoRecorder, { mediaSupported, pickMime } from './VideoRecorder'

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

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  // Stop mic/camera + timers if the composer unmounts (leaving the chat).
  useEffect(() => () => {
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
    if (sending || uploading) return
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
        <div className="composer">
          <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.zip,.doc,.docx"
            onChange={(e) => pickFile(e.target.files?.[0])} />
          <button className="icon-btn composer-btn" onClick={() => fileRef.current?.click()}
            aria-label={t('composer.attach')} disabled={busy}><IconAttach size={19} /></button>
          <button className={`icon-btn composer-btn ${stickerOpen ? 'active' : ''}`} onClick={() => setStickerOpen(!stickerOpen)}
            aria-label={t('composer.sticker')} aria-pressed={stickerOpen}><IconSticker size={19} /></button>
          <textarea ref={taRef} className="composer-input" rows={1} placeholder={placeholder} value={text}
            onChange={(e) => { setText(e.target.value); grow(); handleTyping() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
          {text.trim() || pending ? (
            <button className="send-btn" onClick={submit} disabled={busy} aria-label={t('composer.send')}>
              {sending ? '…' : <IconSend size={18} />}
            </button>
          ) : (
            <>
              <button className="icon-btn composer-btn" onClick={startAudio} aria-label={t('composer.voice')} disabled={busy}><IconMic size={19} /></button>
              <button className="icon-btn composer-btn" onClick={() => { setError(''); setVideoOpen(true) }} aria-label={t('composer.video')} disabled={busy}><IconVideoCircle size={19} /></button>
            </>
          )}
        </div>
      )}

      {videoOpen && (
        <VideoRecorder
          onClose={() => setVideoOpen(false)}
          onSend={(blob, dur) => sendMedia(blob, dur, `circle-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`)}
        />
      )}
    </div>
  )
}
