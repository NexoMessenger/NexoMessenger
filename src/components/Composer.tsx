import { useRef, useState } from 'react'
import type { AttachmentInfo } from '../lib/types'
import { ErrorBox } from './ui'
import { useI18n } from '../i18n'
import { IconAttach, IconSend, IconImage, IconFile } from './icons'

interface Props {
  placeholder: string
  sending: boolean
  onSend: (text: string, att?: AttachmentInfo) => Promise<void>
  onTyping: () => void
  upload: (file: File) => Promise<AttachmentInfo>
}

export default function Composer({ placeholder, sending, onSend, onTyping, upload }: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<AttachmentInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const lastTyping = useRef(0)

  const grow = () => {
    const ta = taRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px' }
  }

  const handleTyping = () => {
    const t = Date.now()
    if (t - lastTyping.current > 2500) { lastTyping.current = t; onTyping() }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const att = await upload(file)
      setPending(att)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.generic'))
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
    try {
      await onSend(body, att)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.generic'))
      setText(body); if (att) setPending(att)
    }
  }

  return (
    <div>
      <div style={{ padding: '0 16px' }}><ErrorBox error={error} /></div>
      {pending && (
        <div className="pending-attachment glass">
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>{pending.type.startsWith('image/') ? <IconImage size={17} /> : <IconFile size={17} />}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending.name}</span>
          <button className="link-btn" onClick={() => setPending(null)}>{t('composer.remove')}</button>
        </div>
      )}
      {uploading && <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--text-2)' }}>{t('composer.uploading')}</div>}
      <div className="composer">
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.zip,.doc,.docx"
          onChange={(e) => pickFile(e.target.files?.[0])} />
        <button className="icon-btn" style={{ width: 44, height: 44, borderRadius: '50%' }} onClick={() => fileRef.current?.click()}
          aria-label={t('composer.attach')} disabled={uploading}><IconAttach size={19} /></button>
        <textarea ref={taRef} className="composer-input" rows={1} placeholder={placeholder} value={text}
          onChange={(e) => { setText(e.target.value); grow(); handleTyping() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
        <button className="send-btn" onClick={submit} disabled={sending || uploading || (!text.trim() && !pending)} aria-label={t('composer.send')}>
          {sending ? '…' : <IconSend size={18} />}
        </button>
      </div>
    </div>
  )
}
