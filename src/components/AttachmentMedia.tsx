import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { IconClose } from './icons'

function DownloadIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v2h16v-2" /></svg> }
function useDownload(url: string, name: string) {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const ref = useRef<XMLHttpRequest | null>(null)
  useEffect(() => () => { ref.current?.abort() }, [url])
  const start = () => {
    if (ref.current) return
    setError(false); setProgress({ loaded: 0, total: 0 })
    const xhr = new XMLHttpRequest(); ref.current = xhr
    xhr.open('GET', url); xhr.responseType = 'blob'
    xhr.onprogress = e => setProgress({ loaded: e.loaded, total: e.lengthComputable ? e.total : 0 })
    xhr.onload = () => {
      ref.current = null; setProgress(null)
      if (xhr.status < 200 || xhr.status >= 300) { setError(true); return }
      const objectUrl = URL.createObjectURL(xhr.response as Blob)
      const link = document.createElement('a'); link.href = objectUrl; link.download = name || 'download'; document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    }
    xhr.onerror = () => { ref.current = null; setProgress(null); setError(true) }
    xhr.onabort = () => { ref.current = null; setProgress(null) }
    xhr.send()
  }
  return { start, cancel: () => ref.current?.abort(), progress, error }
}
const size = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`

export function FileAttachment({ url, name }: { url: string; name: string }) {
  const { t } = useI18n(); const { start, cancel, progress, error } = useDownload(url, name)
  return <div className="attachment-download">
    <button className="attachment-download-action" type="button" onClick={progress ? cancel : start} aria-label={progress ? t('common.cancel') : t('media.download')}>
      {progress ? <><span className="download-ring" /><IconClose size={20} /></> : <DownloadIcon />}
    </button>
    <button type="button" className="attachment-download-label" onClick={progress ? cancel : start}><strong>{name || t('attach.file')}</strong><small>{error ? t('media.downloadError') : progress ? progress.total ? `${size(progress.loaded)} / ${size(progress.total)}` : `${size(progress.loaded)} · ${t('media.downloading')}` : t('media.download')}</small></button>
  </div>
}

export function ImageAttachment({ url, name }: { url: string; name: string }) {
  const { t } = useI18n(); const [open, setOpen] = useState(false); const { start, cancel, progress, error } = useDownload(url, name)
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [open])
  return <>
    <button type="button" className="attachment-image-button" onClick={() => setOpen(true)} aria-label={t('media.open')}><img className="attachment-img" src={url} alt={name || t('media.image')} loading="lazy" /></button>
    {open && createPortal(<div className="image-viewer" role="dialog" aria-modal="true" aria-label={t('media.image')}>
      <header className="image-viewer-head"><button type="button" className="image-viewer-icon" onClick={() => setOpen(false)} aria-label={t('media.close')}><IconClose size={23} /></button><span>{name || t('media.image')}</span><button type="button" className="image-viewer-icon" onClick={progress ? cancel : start} aria-label={progress ? t('common.cancel') : t('media.save')}>{progress ? <IconClose size={23} /> : <DownloadIcon />}</button></header>
      <div className="image-viewer-stage" onClick={() => setOpen(false)}><img src={url} alt={name || t('media.image')} onClick={e => e.stopPropagation()} /></div>
      <div className="image-viewer-bottom">{error && <span role="alert">{t('media.downloadError')}</span>}{progress && <span role="status">{t('media.downloading')} {progress.total ? `${size(progress.loaded)} / ${size(progress.total)}` : size(progress.loaded)}</span>}<button type="button" className="btn btn-primary" onClick={progress ? cancel : start}>{progress ? t('common.cancel') : t('media.save')}</button></div>
    </div>, document.body)}
  </>
}
